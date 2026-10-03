import { ESLint } from "eslint";
import tseslint from "typescript-eslint";
import { expect, test } from "vitest";
import { createDocumentationConfig } from "./jsdoc-config.mjs";

const shippedEslint = new ESLint({ overrideConfig: tseslint.configs.disableTypeChecked });
const eslint = new ESLint({
	overrideConfigFile: true,
	overrideConfig: [
		...createDocumentationConfig(false),
		{ languageOptions: { parser: tseslint.parser, parserOptions: { ecmaFeatures: { jsx: true } } } },
	],
});
const publicEslint = new ESLint({
	overrideConfigFile: true,
	overrideConfig: [...createDocumentationConfig(true), { languageOptions: { parser: tseslint.parser } }],
});

async function violations(source: string, filePath = "src/documentation-example.ts", linter = eslint) {
	const results = await linter.lintText(source, { filePath });
	expect(results).toHaveLength(1);
	expect(results[0]?.fatalErrorCount).toBe(0);

	return results.flatMap((result) =>
		result.messages
			.filter((message) => message.ruleId === "no-restricted-syntax" || message.ruleId?.startsWith("jsdoc/"))
			.map((message) => message.ruleId),
	);
}

test.each([
	["FunctionDeclaration", "", "function run() {}", 1],
	["module-level function expression", "", "const run = function () {};", 1],
	["module-level arrow", "", "const run = () => {};", 1],
	["exported function constant", "", "export const run = () => {};", 1],
	["ClassDeclaration", "", "class State {}", 1],
	["ClassExpression", "", "const State = class {};", 2],
	["MethodDefinition", "/** Retain state. */ class State {", "run() {} }", 2],
	["TSAbstractMethodDefinition", "/** Retain state. */ abstract class State {", "abstract run(): void; }", 1],
	["TSDeclareFunction", "", "declare function run(): void;", 1],
	["TSMethodSignature", "/** Describe an operation. */ interface Operation {", "run(): void; }", 1],
	["TSPropertySignature", "/** Describe retained state. */ interface State {", "value: number; }", 1],
	["TSInterfaceDeclaration", "", "interface State {}", 1],
	["TSTypeAliasDeclaration", "", "type State = string;", 1],
	["TSEnumDeclaration", "", "enum State {}", 1],
	["TSEnumMember", "/** Name readiness states. */ enum State {", "Ready }", 1],
	["TSModuleDeclaration", "", "namespace Shapes {}", 1],
	["TSModuleDeclaration", "", "declare module 'x' {}", 1],
	["TSCallSignatureDeclaration", "/** Describe an operation. */ interface Operation {", "(): void; }", 1],
	["TSConstructSignatureDeclaration", "/** Describe an instance factory. */ interface Factory {", "new (): void; }", 1],
	["TSIndexSignature", "/** Describe named values. */ interface Values {", "[name: string]: number; }", 1],
	["module-level variable", "", "const value = 1;", 1],
	["namespace variable", "/** Group operations. */ namespace Operations {", "const value = 1; }", 1],
	["ambient-module variable", "/** Describe a module. */ declare module 'x' {", "const version: string; }", 1],
	["global variable", "/** Declare global state. */ declare global {", "var flag: boolean; }", 1],
	["ExportNamedDeclaration", "", "export const value = 1;", 1],
	["ExportDefaultDeclaration", "", "export default 1;", 1],
	["ExportAllDeclaration", "", "export * from './other.js';", 1],
	["TSExportAssignment", "", "export = value;", 1],
	["TSNamespaceExportDeclaration", "", "export as namespace Library;", 1],
])("covers the configured %s declaration", async (_node, prefix, declaration, count) => {
	// Methods and class-valued variables have overlapping coverage; either check being removed must fail.
	expect(await violations(`${prefix}\n${declaration}`)).toEqual(Array.from({ length: count }, () => "jsdoc/require-jsdoc"));
	expect(await violations(`${prefix}\n/** Define the operation's state or behavior. */\n${declaration}`)).toEqual([]);
});

test.each([
	["ArrowFunctionExpression", "DOC\nconst run = (name: string) => name;"],
	["FunctionDeclaration", "DOC\nfunction run(name: string) { return name; }"],
	["FunctionExpression", "DOC\nconst run = function (name: string) { return name; };"],
	["TSDeclareFunction", "DOC\ndeclare function run(name: string): string;"],
	["TSMethodSignature", "/** Describe operations. */ interface Operations {\nDOC\nrun(name: string): string;\n}"],
	["TSFunctionType", "DOC\nexport type Operation = (name: string) => string;"],
	["function-typed variable", "DOC\nconst run: (name: string) => string = operation;"],
	["abstract method", "/** Implement operations. */ abstract class Operations {\nDOC\nabstract run(name: string): string;\n}"],
	["method overload", "/** Describe operations. */ declare class Operations {\nDOC\nrun(name: string): string;\n}"],
	["call signature", "/** Describe operations. */ interface Operations {\nDOC\n(name: string): string;\n}"],
	["construct signature", "/** Describe factories. */ interface Factory {\nDOC\nnew (name: string): object;\n}"],
	["constructor type", "/** Describe a factory. */ type Factory =\nDOC\nnew (name: string) => object;"],
	["property signature", "/** Describe operations. */ interface Operations {\nDOC\nrun: (name: string) => string;\n}"],
	["constructor property", "/** Describe factories. */ interface Factory {\nDOC\ncreate: new (name: string) => object;\n}"],
	["class field", "/** Implement operations. */ class Operations {\nDOC\nrun: (name: string) => string;\n}"],
	["abstract field", "/** Implement operations. */ abstract class Operations {\nDOC\nabstract run: (name: string) => string;\n}"],
	["accessor field", "/** Implement operations. */ class Operations {\nDOC\naccessor run: (name: string) => string;\n}"],
	[
		"abstract accessor field",
		"/** Implement operations. */ abstract class Operations {\nDOC\nabstract accessor run: (name: string) => string;\n}",
	],
])("requires complete parameter and result tags on %s", async (_kind, source) => {
	const documentation =
		"/**\n * Process the supplied name.\n * @param name - The supplied name.\n * @returns The resulting value.\n * @throws When the name is invalid.\n */";

	expect(await violations(source.replace("DOC", documentation))).toEqual([]);
	expect(await violations(source.replace("DOC", "/** Process the supplied name. */"))).toEqual([
		"jsdoc/require-param",
		"jsdoc/require-returns",
	]);
	expect(await violations(source.replace("DOC", documentation.replace(" - The supplied name.", "")))).toContain(
		"jsdoc/require-param-description",
	);
	expect(await violations(source.replace("DOC", documentation.replace(" The resulting value.", "")))).toContain(
		"jsdoc/require-returns-description",
	);
	expect(await violations(source.replace("DOC", documentation.replace(" When the name is invalid.", "")))).toContain(
		"jsdoc/require-throws-description",
	);
});

test.each(["void", "undefined", "never"])("does not demand a result tag for %s signatures", async (result) => {
	for (const source of [
		`/** Implement operations. */ abstract class Operations {\n/** Run an operation. */\nabstract run(): ${result};\n}`,
		`/** Describe operations. */ interface Operations {\n/** Run an operation. */\n(): ${result};\n}`,
		`/** Describe operations. */ interface Operations {\n/** Run an operation. */\nrun: () => ${result};\n}`,
	]) {
		expect(await violations(source)).toEqual([]);
	}
});

test("does not invent a result for an unannotated body-less method", async () => {
	expect(await violations("/** Describe operations. */ declare class Operations {\n/** Run an operation. */\nrun();\n}")).toEqual(
		[],
	);
});

test("requires parameter and result descriptions even on unattached comments", async () => {
	const source = "/**\n * Describe an operation.\n * @param name\n * @returns\n */";

	expect(await violations(source)).toEqual(["jsdoc/require-param-description", "jsdoc/require-returns-description"]);
});

test("requires a description on a generator's yielded result", async () => {
	const source = '/**\n * Supply operation names.\n * @yields The next name.\n */\nfunction* names() { yield "Ada"; }';

	expect(await violations(source)).toEqual([]);
	expect(await violations(source.replace(" The next name.", ""))).toEqual(["jsdoc/require-yields-description"]);
});

test.each(["interface", "type"])("documents function properties on the %s rather than the implementation", async (kind) => {
	const prefix = kind === "interface" ? "interface Style {" : "type Style = {";
	const property = "normalize: (name: string) => string;";
	const source = `/** Describe name normalization. */\n${prefix}\n${property}\n}\n/** Provide plain formatting. */\nconst style: Style = { normalize: (name) => name };`;
	const documentation =
		"/**\n * Prepare a name for display.\n * @param name - The supplied name.\n * @returns The normalized name.\n */";

	expect(await violations(source)).toEqual(["jsdoc/require-jsdoc"]);
	expect(await violations(source.replace(property, `${documentation}\n${property}`))).toEqual([]);
});

test("documents each overload instead of borrowing an earlier block", async () => {
	const documentation =
		"/**\n * Preserve the supplied value.\n * @param value - The value to preserve.\n * @returns The unchanged value.\n */";
	const overload = "function preserve(value: number): number;";
	const source = `${documentation}\nfunction preserve(value: string): string;\n${overload}\n${documentation}\nfunction preserve(value: string | number) { return value; }`;

	expect(await violations(source)).toContain("jsdoc/require-jsdoc");
	expect(await violations(source.replace(overload, `${documentation}\n${overload}`))).toEqual([]);
});

test("keeps method coverage when an implemented interface already has documentation", async () => {
	const source =
		"/** Describe an operation. */\ninterface Operation {\n/** Start the operation. */\nrun(): void;\n}\n/** Implement an operation. */\nclass Implementation implements Operation { run() {} }";

	expect(await violations(source)).toEqual(["jsdoc/require-jsdoc"]);
});

test("requires module-level variables but not variables inside functions", async () => {
	expect(await violations("let count = 0;")).toEqual(["jsdoc/require-jsdoc"]);
	expect(await violations("/** Retain the number of operations. */\nlet count = 0;")).toEqual([]);
	expect(await violations("/** Start the operation. */\nfunction run() { const count = 0; }")).toEqual([]);
});

test.each(["(options: { limit: number }) => options.limit", "function (options: { limit: number }) { return options.limit; }"])(
	"exempts functions assigned to local variables: %s",
	async (implementation) => {
		expect(await violations(`/** Run a job. */\nfunction run() { const read = ${implementation}; }`)).toEqual([]);
	},
);

test.each(["return async function read() {};", "function read() {} return read;"])(
	"requires documentation on returned functions without a variable: %s",
	async (body) => {
		expect(
			await violations(`/**\n * Prepare a reader.\n * @returns The read operation.\n */\nfunction create() { ${body} }`),
		).toEqual(["jsdoc/require-jsdoc"]);
	},
);

test("checks tags on documented local function variables", async () => {
	const source =
		"/** Run a job. */\nfunction run() {\n/**\n * Read a value.\n * @param name - The requested name.\n * @returns The requested value.\n */\nconst read = (name: string) => name;\n}";

	expect(await violations(source)).toEqual([]);
	expect(await violations(source.replace(" * @param name - The requested name.\n", ""))).toEqual(["jsdoc/require-param"]);
	expect(await violations(source.replace(" * @returns The requested value.\n", ""))).toEqual(["jsdoc/require-returns"]);
});

test.each([
	"options: TYPE",
	"{ limit }: TYPE",
	"options: TYPE = { limit: 1 }",
	"{ limit }: TYPE = { limit: 1 }",
	"...options: unknown[] & TYPE",
	"options: Base & (Other | (Extra & (TYPE | undefined)))",
])("documents inline parameter members with one parameter tag: %s", async (parameter) => {
	const source = `/**\n * Apply options.\n * @param options - The supplied options.\n */\nfunction apply(${parameter.replace("TYPE", "{\nlimit: number;\n}")}) {}`;
	const documented = source.replace("limit: number;", "/** Maximum operations. */\nlimit: number;");

	expect(await violations(source)).toEqual(["jsdoc/require-jsdoc"]);
	expect(await violations(documented)).toEqual([]);
	expect(await violations(documented.replace(" * @param options - The supplied options.\n", ""))).toEqual([
		"jsdoc/require-param",
	]);
});

test.each([
	[
		"parameter container",
		"/**\n * Run a job.\n * @param items - The supplied records.\n */\nfunction run(items: { MEMBER }[]) {}",
	],
	["return type", "/**\n * Load a record.\n * @returns The stored record.\n */\nfunction load(): { MEMBER } { return record; }"],
	["alias array", "/** Describe records. */\ntype Records = { MEMBER }[];"],
	["alias tuple", "/** Describe records. */\ntype Records = [{ MEMBER }];"],
	["alias generic argument", "/** Describe records. */\ntype Records = Readonly<{ MEMBER }>;"],
	["alias constraint", "/** Describe records. */\ntype Records<T extends { MEMBER }> = T;"],
	["interface member type", "/** Describe records. */\ninterface Records {\n/** Stored entries. */\nitems: { MEMBER }[];\n}"],
	["class member type", "/** Store records. */\nclass Records {\n/** Stored entries. */\nitems: { MEMBER }[];\n}"],
	["class index value", "/** Store records. */\nclass Records {\n/** Named entries. */\n[key: string]: { MEMBER };\n}"],
	["class constraint", "/** Store records. */\nclass Records<T extends { MEMBER }> {}"],
	["base class argument", "/** Store records. */\nclass Records extends Base<{ MEMBER }> {}"],
	["implemented type argument", "/** Store records. */\nclass Records implements Base<{ MEMBER }> {}"],
	["function constraint", "/** Run a job. */\nfunction run<T extends { MEMBER }>() {}"],
	[
		"declared function parameter",
		"/**\n * Run a job.\n * @param options - The supplied options.\n */\ndeclare function run(options: { MEMBER }): void;",
	],
	[
		"abstract method parameter",
		"/** Describe operations. */\nabstract class Operations {\n/**\n * Run a job.\n * @param options - The supplied options.\n */\nabstract run(options: { MEMBER }): void;\n}",
	],
	["module variable type", "/** Store a record. */\nconst record: { MEMBER } = value;"],
	["exported variable type", "/** Store a record. */\nexport const record: { MEMBER } = value;"],
	[
		"namespace variable type",
		"/** Group records. */\nnamespace Records {\n/** Store a record. */\nconst record: { MEMBER } = value;\n}",
	],
	[
		"nested callback parameter",
		"/**\n * Run a job.\n * @param callback - The operation to invoke.\n */\nfunction run(callback: (options: { MEMBER }) => void) {}",
	],
	[
		"nested callback result",
		"/**\n * Run a job.\n * @param callback - The operation to invoke.\n */\nfunction run(callback: () => { MEMBER }) {}",
	],
	[
		"inline method parameter",
		"/**\n * Run a job.\n * @param options - The supplied options.\n */\nfunction run(options: {\n/**\n * Apply settings.\n * @param input - The supplied settings.\n */\napply(input: { MEMBER }): void;\n}) {}",
	],
	[
		"function type alias",
		"/**\n * Describe an operation.\n * @param options - The supplied options.\n */\ntype Apply = (options: { MEMBER }) => void;",
	],
])("documents inline members in a %s", async (_kind, source) => {
	expect(await violations(source.replace("MEMBER", "limit: number;"))).toEqual(["jsdoc/require-jsdoc"]);
	expect(await violations(source.replace("MEMBER", "/** Maximum operations. */\nlimit: number;"))).toEqual([]);
});

test.each([
	"const record: { id: number } = value;",
	"value as { id: number };",
	"value satisfies { id: number };",
	"accept<{ id: number }>(value);",
])("exempts types inside an implementation: %s", async (body) => {
	expect(await violations(`/** Run a job. */\nfunction run() { ${body} }`)).toEqual([]);
});

test("documents local type aliases and their members", async () => {
	const source = "/** Run a job. */\nfunction run() {\ntype Options = {\nlimit: number;\n};\n}";
	const results = await eslint.lintText(source, { filePath: "src/documentation-example.ts" });

	expect(results).toMatchObject([
		{
			fatalErrorCount: 0,
			messages: [
				{ ruleId: "jsdoc/require-jsdoc", line: 3 },
				{ ruleId: "jsdoc/require-jsdoc", line: 4 },
			],
		},
	]);
	expect(
		await violations(
			source
				.replace("type Options", "/** Bound operations. */\ntype Options")
				.replace("limit:", "/** Maximum operations. */\nlimit:"),
		),
	).toEqual([]);
});

test("exempts a conditional type's matching pattern", async () => {
	expect(await violations("/** Extract a record's identifier. */\ntype Id<T> = T extends { id: infer U } ? U : never;")).toEqual(
		[],
	);
});

test("delegates inline parameter members to the plugin's public-only behavior", async () => {
	const source = "function run(options: { limit: number }) {}";
	const documentation = "/**\n * Run a job.\n * @param options - The supplied options.\n */\n";

	expect(await violations(source, "src/example.ts", publicEslint)).toEqual([]);
	expect(await violations(`export ${source}`, "src/example.ts", publicEslint)).toEqual(Array(3).fill("jsdoc/require-jsdoc"));
	expect(await violations(`${documentation}export ${source}`, "src/example.ts", publicEslint)).toEqual([]);
	expect(await violations(`${documentation}export ${source}`)).toEqual(["jsdoc/require-jsdoc"]);
});

test.each([
	"type Options = { limit: number } | string;",
	"type Options = Base & { limit: number };",
	"class Options { [name: string]: number; }",
])("keeps named type members documented: %s", async (declaration) => {
	const source = `/** Bound operations. */\n${declaration}`;

	expect(await violations(source)).toEqual(["jsdoc/require-jsdoc"]);
	expect(await violations(source.replace("{", "{ /** Bound each operation. */"))).toEqual([]);
});

test("documents an exported namespace once on its export", async () => {
	expect(await violations("/** Group operations. */\nexport namespace Operations {}")).toEqual([]);
	expect(await violations("export namespace Operations {}")).toEqual(["jsdoc/require-jsdoc"]);
});

test("requires the setter parameter to be documented", async () => {
	const source =
		"/** Retain state. */\nclass State {\n/**\n * Set the limit.\n * @param limit - Maximum operations.\n */\nset limit(limit: number) {}\n}";

	expect(await violations(source)).toEqual([]);
	expect(await violations(source.replace(" * @param limit - Maximum operations.\n", ""))).toEqual(["jsdoc/require-param"]);
});

test.each(["value = 1;", "abstract value: number;", "accessor value = 1;", "abstract accessor value: number;"])(
	"covers class properties through the custom selector: %s",
	async (property) => {
		const source = `/** Retain operation state. */\nabstract class State {\n${property}\n}`;

		expect(await violations(source)).toContain("jsdoc/require-jsdoc");
		expect(await violations(source.replace(property, `/** Bound pending operations. */\n${property}`))).toEqual([]);
	},
);

test.each(["register", "new Handler"])("exempts direct inline callbacks to %s, not array elements", async (call) => {
	expect(await violations(`${call}((options: { limit: number }) => {}, function (options: { limit: number }) {});`)).toEqual([]);
	expect(await violations("[function () {}];")).toContain("jsdoc/require-jsdoc");
});

test.each(["(function () {})();", "register(cond ? () => {} : undefined);"])(
	"keeps callbacks outside the direct-argument boundary documented: %s",
	async (source) => {
		expect(await violations(source)).toContain("jsdoc/require-jsdoc");
	},
);

test.each(["() => {}", "function () {}"])("exempts only direct JSX attribute handlers: %s", async (handler) => {
	expect(await violations(`<button onClick={${handler}} />;`, "src/view.tsx")).toEqual([]);
	expect(await violations(`<button>{${handler}}</button>;`, "src/view.tsx")).toEqual(["jsdoc/require-jsdoc"]);
	expect(await violations(`<button onClick={ready ? ${handler} : undefined} />;`, "src/view.tsx")).toEqual([
		"jsdoc/require-jsdoc",
	]);
});

test.each([
	"run: (options: { limit: number }) => {}",
	"run: function (options: { limit: number }) {}",
	"run(options: { limit: number }) {}",
])("exempts object function properties but not accessors: %s", async (member) => {
	expect(await violations(`/** Provide operation handlers. */\nconst handler = { ${member} };`)).toEqual([]);
	expect(await violations("/** Expose operation state. */\nconst handler = { get value() { return 1; } };")).toContain(
		"jsdoc/require-jsdoc",
	);
});

test("keeps nested accessors outside the direct object-function exemption", async () => {
	expect(await violations("({ inner: { get value() { return 1; } } });")).toEqual(["jsdoc/require-jsdoc"]);
});

test("the no-tag-types selector covers tags outside parameters and returns", async () => {
	const source =
		"/**\n * Refuse unsupported input.\n * @throws {@link Error} When input cannot be accepted.\n */\nfunction refuse() { throw Error(); }";

	expect(await violations(source)).toEqual([]);
	expect(await violations(source.replace("{@link Error}", "{Error}"))).toContain("jsdoc/no-restricted-syntax");
});

test("the description selector covers unattached blocks", async () => {
	expect(await violations("/** Describe the module's purpose. */")).toEqual([]);
	expect(await violations("/** @see OtherModule */")).toContain("jsdoc/require-description");
});

test("requires descriptions to explain more than the declaration's name", async () => {
	expect(await violations("/** Address a list of recipients. */\nclass Greeter {}")).toEqual([]);
	expect(await violations("/** Greeter. */\nclass Greeter {}")).toEqual(["jsdoc/informative-docs"]);
});

test("rejects Closure-style optional types in tags", async () => {
	const source = "/**\n * Start an operation.\n * @param name - The supplied name.\n */\nfunction run(name?: string) {}";

	expect(await violations(source)).toEqual([]);
	expect(await violations(source.replace("@param name", "@param {string=} name"))).toContain("jsdoc/check-syntax");
});

test.each([
	["separated documentation", "run();\n\n/** Start an operation. */\nfunction run() {}", 0],
	["adjacent documentation", "run();\n/** Start an operation. */\nfunction run() {}", 1],
	["documentation at a block's start", "{\n/** Start an operation. */\nfunction run() {}\n}", 0],
	["an adjacent plain block comment", "run();\n/* Run the next operation. */\nrun();", 0],
])("checks spacing before %s", async (_kind, source, count) => {
	const results = await eslint.lintText(source, { filePath: "src/documentation-example.ts" });
	expect(results).toHaveLength(1);
	expect(results[0]?.fatalErrorCount).toBe(0);
	expect(
		results.flatMap((result) => result.messages.filter((message) => message.ruleId === "@stylistic/lines-around-comment")),
	).toHaveLength(count);
});

test("turns documentation coverage off throughout test files", async () => {
	const source =
		"function helper(options: { limit: number }) {} class State { value = 1; run() {} } test('case', () => { const local = () => {}; });";

	expect(await violations(source, "scripts/documentation-example.test.mts")).toEqual([]);
	expect(await violations(source)).toContain("jsdoc/require-jsdoc");
});

test("covers .mjs files without requiring a TypeScript project", async () => {
	const linter = new ESLint();

	expect(await violations("/** Start the operation. */\nfunction run() {}", "scripts/documentation-example.mjs", linter)).toEqual(
		[],
	);
	expect(await violations("function run() {}", "scripts/documentation-example.mjs", linter)).toContain("jsdoc/require-jsdoc");
});

test("wires the documentation fragments into the shipped configuration", async () => {
	const production: unknown = await shippedEslint.calculateConfigForFile("src/greeting.ts");
	const tests: unknown = await shippedEslint.calculateConfigForFile("src/greeting.test.ts");

	expect(production).toHaveProperty(["rules", "jsdoc/require-jsdoc", 1, "contexts", "length"], 3);
	expect(production).toHaveProperty(["rules", "jsdoc/require-jsdoc", 1, "publicOnly"], false);
	expect(tests).toHaveProperty(["rules", "jsdoc/require-jsdoc", 0], 0);
});

test.each(["function run() {}", "class State { value = 1; run() {} }"])(
	"supports full and public-only documentation coverage: %s",
	async (source) => {
		expect(await violations(source)).toContain("jsdoc/require-jsdoc");
		expect(await violations(source, "scripts/documentation-example.mts", publicEslint)).toEqual([]);
		expect(await violations(`export ${source}`, "scripts/documentation-example.mts", publicEslint)).toContain(
			"jsdoc/require-jsdoc",
		);
	},
);
