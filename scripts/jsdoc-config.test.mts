import { ESLint } from "eslint";
import tseslint from "typescript-eslint";
import { expect, test } from "vitest";
import { createDocumentationConfig } from "./jsdoc-config.mjs";

const eslint = new ESLint({ overrideConfig: tseslint.configs.disableTypeChecked });
const publicEslint = new ESLint({
	overrideConfigFile: true,
	overrideConfig: [...createDocumentationConfig(true), { languageOptions: { parser: tseslint.parser } }],
});

async function violations(source: string, filePath = "src/documentation-example.ts", linter = eslint) {
	const results = await linter.lintText(source, { filePath });
	expect(results).toHaveLength(1);
	expect(results[0]?.fatalErrorCount).toBe(0);

	return results.flatMap((result) =>
		result.messages.filter((message) => message.ruleId?.startsWith("jsdoc/")).map((message) => message.ruleId),
	);
}

test.each([
	["FunctionDeclaration", "", "function run() {}", 1],
	["FunctionExpression", "", "const run = function () {};", 2],
	["ArrowFunctionExpression", "", "const run = () => {};", 2],
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
	// Methods and module-level function values have overlapping coverage; either check being removed must fail.
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

test("documents an inline parameter type through its parameter tags", async () => {
	const source =
		"/**\n * Apply options.\n * @param options - The supplied options.\n * @param options.limit - Maximum operations.\n */\nexport type Apply = (options: { limit: number }) => void;";

	expect(await violations(source)).toEqual([]);
	expect(await violations(source.replace(" * @param options.limit - Maximum operations.\n", ""))).toEqual([
		"jsdoc/require-param",
	]);
	expect(await violations("/** Bound operations. */\ntype Options = { limit: number };")).toEqual(["jsdoc/require-jsdoc"]);
});

test.each(["type Rows<T extends { id: number }> = T;", "type Rows = { id: number }[];"])(
	"exempts nested type literals: %s",
	async (declaration) => {
		expect(await violations(`/** Describe rows. */\n${declaration}`)).toEqual([]);
	},
);

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
	expect(await violations(`${call}(() => {}, function () {});`)).toEqual([]);
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

test.each(["run: () => {}", "run: function () {}", "run() {}"])(
	"exempts object function properties but not accessors: %s",
	async (member) => {
		expect(await violations(`/** Provide operation handlers. */\nconst handler = { ${member} };`)).toEqual([]);
		expect(await violations("/** Expose operation state. */\nconst handler = { get value() { return 1; } };")).toContain(
			"jsdoc/require-jsdoc",
		);
	},
);

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
	const source = "function helper() {} class State { value = 1; run() {} } test('case', () => { const local = () => {}; });";

	expect(await violations(source, "scripts/documentation-example.test.mts")).toEqual([]);
	expect(await violations(source)).toContain("jsdoc/require-jsdoc");
});

test("covers .mjs files without requiring a TypeScript project", async () => {
	const linter = new ESLint();

	expect(
		await violations("/** Start the operation. */\nconst run = () => {};", "scripts/documentation-example.mjs", linter),
	).toEqual([]);
	expect(await violations("const run = () => {};", "scripts/documentation-example.mjs", linter)).toContain("jsdoc/require-jsdoc");
});

test("wires the documentation fragments into the shipped configuration", async () => {
	const production: unknown = await eslint.calculateConfigForFile("src/greeting.ts");
	const tests: unknown = await eslint.calculateConfigForFile("src/greeting.test.ts");

	expect(production).toHaveProperty(["rules", "jsdoc/require-jsdoc", 1, "contexts", "length"], 3);
	expect(tests).toHaveProperty(["rules", "jsdoc/require-jsdoc", 0], 0);
});

test.each(["function run() {}", "class State { value = 1; run() {} }"])(
	"defaults to documenting internal declarations, with public-only coverage opt-in: %s",
	async (source) => {
		expect(await violations(source)).toContain("jsdoc/require-jsdoc");
		expect(await violations(source, "scripts/documentation-example.mts", publicEslint)).toEqual([]);
		expect(await violations(`export ${source}`, "scripts/documentation-example.mts", publicEslint)).toContain(
			"jsdoc/require-jsdoc",
		);
	},
);
