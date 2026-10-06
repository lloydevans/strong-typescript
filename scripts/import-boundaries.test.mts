import { mkdirSync, mkdtempDisposableSync, symlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import tseslint from "typescript-eslint";
import { afterAll, beforeAll, expect, test } from "vitest";
import { resolve } from "./import-resolver.mts";

const files = {
	entry: "src/index.ts",
	application: "src/value.ts",
	entryTest: "src/index.test.ts",
	applicationTest: "src/value.test.ts",
	packageEntry: "packages/first/src/index.ts",
	packageSource: "packages/first/src/value.ts",
	packageTest: "packages/first/src/value.test.ts",
	tooling: "scripts/value.mts",
	toolingTest: "scripts/value.test.mts",
	config: "vitest.config.mts",
};

type Role = keyof typeof files;

const allowed: Record<Role, Role[]> = {
	entry: ["application", "packageEntry"],
	application: ["application", "packageEntry"],
	entryTest: ["entry", "application", "packageEntry"],
	applicationTest: ["application", "packageEntry"],
	packageEntry: ["packageSource", "packageEntry"],
	packageSource: ["packageSource", "packageEntry"],
	packageTest: ["packageSource", "packageEntry"],
	tooling: ["tooling", "config"],
	toolingTest: ["tooling", "config"],
	config: ["tooling", "config"],
};
const roles = Object.keys(files) as Role[];
const directions = roles.flatMap((from) => roles.map((to) => ({ from, to, permitted: allowed[from].includes(to) })));
const directory = mkdtempDisposableSync(join(tmpdir(), "import-boundaries-"));
const root = join(directory.path, "Project");
const configPath = fileURLToPath(new URL("../eslint.config.mts", import.meta.url));
const resolverPath = fileURLToPath(new URL("./import-resolver.mts", import.meta.url));

function createLinter(cwd = root) {
	return new ESLint({
		cwd,
		overrideConfigFile: configPath,
		overrideConfig: [
			tseslint.configs.disableTypeChecked,
			{
				settings: {
					"boundaries/root-path": cwd,
					"import/resolver": { [resolverPath]: { root: cwd, project: join(cwd, "tsconfig.json") } },
				},
			},
		],
	});
}

async function diagnostics(source: string, filePath: string, linter = createLinter()) {
	const results = await linter.lintText(source, { filePath });
	expect(results).toHaveLength(1);
	expect(results[0]?.fatalErrorCount).toBe(0);
	expect(results[0]?.messages.some((message) => message.message.includes("Resolve error"))).toBe(false);

	return results.flatMap((result) =>
		result.messages.filter(
			(message) => message.ruleId?.startsWith("boundaries/") === true || message.ruleId === "no-restricted-syntax",
		),
	);
}

function specifier(from: string, to: string) {
	return `./${relative(dirname(from), to).replaceAll("\\", "/")}`;
}

beforeAll(() => {
	for (const path of [
		...Object.values(files),
		"packages/second/src/index.ts",
		"packages/second/src/value.ts",
		"packages/second/src/value.test.ts",
	]) {
		mkdirSync(dirname(join(root, path)), { recursive: true });
		writeFileSync(join(root, path), "export const value = 1;\n");
	}

	writeFileSync(
		join(root, "tsconfig.json"),
		JSON.stringify({
			compilerOptions: { module: "ESNext", moduleResolution: "bundler" },
			include: ["**/*.ts", "**/*.mts"],
		}),
	);
	writeFileSync(join(root, "src/tsconfig.json"), "{}");
	writeFileSync(join(root, "src/style.css"), "body {}");
	writeFileSync(join(root, "package.json"), JSON.stringify({ workspaces: ["packages/*"] }));
	writeFileSync(join(root, "README.md"), "Unclassified");
	writeFileSync(join(directory.path, "outside.ts"), "export const outside = 1;");
	mkdirSync(join(root, "node_modules/@example"), { recursive: true });
	mkdirSync(join(root, "node_modules/undeclared"), { recursive: true });
	writeFileSync(join(root, "node_modules/undeclared/index.ts"), "export const value = 1;");

	for (const name of ["first", "second"]) {
		const path = join(root, "packages", name);
		writeFileSync(join(path, "package.json"), JSON.stringify({ name: `@example/${name}`, exports: { ".": "./src/index.ts" } }));
		writeFileSync(join(path, "tsconfig.json"), "{}");
		symlinkSync(path, join(root, "node_modules/@example", name), "junction");
	}
});

afterAll(() => directory.remove());

test.each(directions)("$from -> $to (allowed: $permitted)", async ({ from, to, permitted }) => {
	const source = `import ${JSON.stringify(specifier(files[from], files[to]))};`;
	const messages = await diagnostics(source, files[from]);

	if (permitted) {
		expect(messages).toEqual([]);
	} else {
		expect(messages).toContainEqual(expect.objectContaining({ ruleId: "boundaries/dependencies" }));
	}
});

test.each(["packageEntry", "packageSource", "packageTest"] as const)(
	"%s reaches another package only through its entry",
	async (role) => {
		expect(await diagnostics('import "@example/second";', files[role])).toEqual([]);
		expect(await diagnostics('import "../../second/src/index";', files[role])).toEqual([]);

		for (const source of ['import "../../second/src/value";', 'import "../../second/src/value.test.ts";']) {
			expect(await diagnostics(source, files[role])).toContainEqual(
				expect.objectContaining({ ruleId: "boundaries/dependencies" }),
			);
		}
	},
);

test.each(["first", "second"])("checks named entry and private subpaths of %s", async (name) => {
	expect(await diagnostics(`import "@example/${name}";`, "src/index.ts")).toEqual([]);
	expect(await diagnostics(`import "@example/${name}/src/value.ts";`, "src/index.ts")).toContainEqual(
		expect.objectContaining({ ruleId: "boundaries/no-unknown-dependencies" }),
	);
});

test.each([
	["relative traversal", 'import "./../src/../packages/first/src/value";'],
	["re-export", 'export { value } from "../packages/first/src/value";'],
	["type-only import", 'import type { value } from "../packages/first/src/value";'],
	["literal dynamic import", 'await import("../packages/first/src/value");'],
	["import type expression", 'type Value = typeof import("../packages/first/src/value");'],
	["CommonJS require", 'const value = require("../packages/first/src/value");'],
	["TypeScript import equals", 'import value = require("../packages/first/src/value");'],
	["namespace import", 'import * as value from "../packages/first/src/value";'],
])("checks the resolved target of a %s", async (_name, source) =>
	expect(await diagnostics(source, "src/index.ts")).toContainEqual(
		expect.objectContaining({ ruleId: "boundaries/dependencies" }),
	),
);

test.each(["mock", "doMock", "importActual", "importMock"])("checks vi.%s targets", async (method) =>
	expect(await diagnostics(`vi.${method}("../packages/first/src/value");`, "src/index.test.ts")).toContainEqual(
		expect.objectContaining({ ruleId: "boundaries/dependencies" }),
	),
);

test.each(["./missing.ts", "undeclared-package", "../README.md", "../../outside.ts", "../node_modules/undeclared/index.ts"])(
	"rejects an unresolved or unclassified dependency: %s",
	async (target) => {
		const messages = await diagnostics(`import ${JSON.stringify(target)};`, "src/value.ts");
		expect(messages).toContainEqual(expect.objectContaining({ ruleId: "boundaries/dependencies" }));
		expect(messages).toContainEqual(expect.objectContaining({ ruleId: "boundaries/no-unknown-dependencies" }));
	},
);

test("rejects a file in no category", async () =>
	expect(await diagnostics("export const value = 1;", "unclassified/example.mts")).toContainEqual(
		expect.objectContaining({ ruleId: "boundaries/no-unknown-files" }),
	));

test.each(['const path = "@example/first"; await import(path);', "await import(`@example/first`);"])(
	"rejects computed dynamic imports: %s",
	async (source) =>
		expect(await diagnostics(source, "src/index.ts")).toContainEqual(expect.objectContaining({ ruleId: "no-restricted-syntax" })),
);

test("allows literal dynamic imports, stylesheets, extensionless source and real tooling extensions", async () => {
	expect(await diagnostics('await import("@example/first");', "src/index.ts")).toEqual([]);
	expect(await diagnostics('import "./style.css";', "src/index.ts")).toEqual([]);
	expect(await diagnostics('import "./value";', "packages/first/src/index.ts")).toEqual([]);
	expect(await diagnostics('import "./scripts/value.mts";', "eslint.config.mts")).toEqual([]);
});

test.each(["src/tsconfig.json", "package.json", "packages/first/package.json", "packages/first/tsconfig.json"])(
	"classifies %s as configuration",
	async (path) => {
		expect(await diagnostics(`import ${JSON.stringify(specifier("scripts/example.mts", path))};`, "scripts/example.mts")).toEqual(
			[],
		);
		expect(await diagnostics(`import ${JSON.stringify(specifier("src/index.ts", path))};`, "src/index.ts")).toContainEqual(
			expect.objectContaining({ ruleId: "boundaries/dependencies" }),
		);
	},
);

test("keeps declared workspace names inside the real policy", async () => {
	symlinkSync(join(root, "packages/first"), join(root, "node_modules/@example/greeter"), "junction");

	expect(await diagnostics('import "@example/greeter";', "src/index.ts")).toEqual([]);
	expect(await diagnostics('import "@example/greeter";', "scripts/example.mts")).toContainEqual(
		expect.objectContaining({ ruleId: "boundaries/dependencies" }),
	);
});

test("allows declared third parties and Node built-ins", async () => {
	expect(await diagnostics('import "vitest";', "packages/first/src/value.test.ts")).toEqual([]);
	expect(await diagnostics('import "eslint/config";', "eslint.config.mts")).toEqual([]);
	expect(await diagnostics('import "node:url";', "scripts/example.mts")).toEqual([]);
});

test.skipIf(process.platform !== "win32")("classifies Windows workspace links with either root spelling", async () => {
	for (const cwd of [root, root.toUpperCase()]) {
		const linter = createLinter(cwd);
		expect(await diagnostics('import "@example/first";', "src/index.ts", linter)).toEqual([]);
		expect(await diagnostics('import "../PACKAGES/FIRST/src/index";', "src/index.ts", linter)).toEqual([]);
		expect(await diagnostics('import "../packages/FIRST/src/VALUE";', "src/index.ts", linter)).toContainEqual(
			expect.objectContaining({ ruleId: "boundaries/dependencies" }),
		);
		expect(await diagnostics('import "@example/first";', "scripts/value.mts", linter)).toContainEqual(
			expect.objectContaining({ ruleId: "boundaries/dependencies" }),
		);
	}
});

test("loads the native resolver and handles local, external, missing and core imports", () => {
	for (const [filePath, target, expected] of [
		["src/index.ts", "@example/first", "packages/first/src/index.ts"],
		["packages/first/src/index.ts", "./value", "packages/first/src/value.ts"],
		["src/index.ts", "./style.css", "src/style.css"],
		["eslint.config.mts", "./scripts/value.mts", "scripts/value.mts"],
	] as const) {
		expect(resolve(target, join(root, filePath), { root, project: join(root, "tsconfig.json") })).toEqual({
			found: true,
			path: join(root, expected),
		});
	}

	expect(resolve("./missing", join(root, "src/index.ts"), { root })).toEqual({ found: false });
	expect(resolve("node:url", join(root, "scripts/value.mts"), { root })).toEqual({ found: true, path: null });

	if (process.arch === "x64" && (process.platform === "win32" || process.platform === "linux")) {
		const binding =
			process.platform === "win32" ? "@unrs/resolver-binding-win32-x64-msvc" : "@unrs/resolver-binding-linux-x64-gnu";
		expect(createRequire(import.meta.url).resolve(binding)).toMatch(/\.node$/);
	}
});
