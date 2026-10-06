import { mkdirSync, mkdtempDisposableSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import { resolve } from "eslint-import-resolver-typescript";
import tseslint from "typescript-eslint";
import { expect, test } from "vitest";

const eslint = new ESLint({ overrideConfig: tseslint.configs.disableTypeChecked });

async function diagnostics(source: string, filePath: string, linter = eslint) {
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

test.each([
	["feature to entry", "src/greeting.ts", "./index"],
	["library to feature", "src/lib/example.ts", "../greeting"],
	["library to entry", "src/lib/example.ts", "../index"],
	["entry to tooling", "src/index.ts", "../scripts/jsdoc-config.mts"],
	["feature to tooling", "src/greeting.ts", "../scripts/jsdoc-config.mts"],
	["library to tooling", "src/lib/example.ts", "../../scripts/jsdoc-config.mts"],
	["entry to configuration", "src/index.ts", "../vitest.config.mts"],
	["feature to configuration", "src/greeting.ts", "./tsconfig.json"],
	["library to configuration", "src/lib/example.ts", "../../package.json"],
	["entry to tests", "src/index.ts", "./greeting.test.ts"],
	["feature to tests", "src/greeting.ts", "./greeting.test.ts"],
	["library to tests", "src/lib/example.ts", "../greeting.test.ts"],
	["tooling to feature", "scripts/example.mts", "../src/greeting"],
	["tooling to entry", "scripts/example.mts", "../src/index"],
	["configuration to feature", "vite.config.mts", "./src/greeting"],
	["configuration to entry", "vite.config.mts", "./src/index"],
	["tooling to tests", "scripts/example.mts", "./jsdoc-config.test.mts"],
	["configuration to tests", "vite.config.mts", "./scripts/jsdoc-config.test.mts"],
	["entry test to another test", "src/index.test.ts", "./greeting.test.ts"],
	["feature test to another test", "src/example.test.ts", "./greeting.test.ts"],
	["library test to another test", "src/lib/example.test.ts", "../greeting.test.ts"],
	["tooling test to another test", "scripts/example.test.mts", "./jsdoc-config.test.mts"],
	["feature test to entry", "src/greeting.test.ts", "./index"],
	["library test to entry", "src/lib/example.test.ts", "../index"],
	["library test to feature", "src/lib/example.test.ts", "../greeting"],
	["tooling test to entry", "scripts/example.test.mts", "../src/index"],
	["tooling test to feature", "scripts/example.test.mts", "../src/greeting"],
	["feature test to tooling", "src/greeting.test.ts", "../scripts/jsdoc-config.mts"],
	["entry test to configuration", "src/index.test.ts", "../package.json"],
])("rejects %s", async (_name, filePath, specifier) =>
	expect(await diagnostics(`import ${JSON.stringify(specifier)};`, filePath)).toContainEqual(
		expect.objectContaining({ ruleId: "boundaries/dependencies" }),
	),
);

test.each([
	["relative traversal", 'import "./../src/../scripts/jsdoc-config.mts";'],
	["re-export", 'export { documentationConfig } from "../scripts/jsdoc-config.mts";'],
	["type-only import", 'import type { documentationConfig } from "../scripts/jsdoc-config.mts";'],
	["literal dynamic import", 'await import("../scripts/jsdoc-config.mts");'],
	["import type expression", 'type Configuration = typeof import("../scripts/jsdoc-config.mts");'],
	["CommonJS require", 'const configuration = require("../scripts/jsdoc-config.mts");'],
	["TypeScript import equals", 'import configuration = require("../scripts/jsdoc-config.mts");'],
	["namespace import", 'import * as configuration from "../scripts/jsdoc-config.mts";'],
])("checks the resolved target of a %s", async (_name, source) =>
	expect(await diagnostics(source, "src/greeting.ts")).toContainEqual(
		expect.objectContaining({ ruleId: "boundaries/dependencies" }),
	),
);

test.each(["mock", "doMock", "importActual", "importMock"])("checks vi.%s targets", async (method) =>
	expect(await diagnostics(`vi.${method}("../scripts/jsdoc-config.mts");`, "src/greeting.test.ts")).toContainEqual(
		expect.objectContaining({ ruleId: "boundaries/dependencies" }),
	),
);

test.each([
	["entry to feature", "src/index.ts", 'import "./greeting";'],
	["feature to feature", "src/example.ts", 'import "./greeting";'],
	["entry test to entry", "src/index.test.ts", 'import "./index";'],
	["entry test to feature", "src/index.test.ts", 'import "./greeting";'],
	["feature test to feature", "src/greeting.test.ts", 'import "./greeting";'],
	["tooling to tooling", "scripts/example.mts", 'import "./jsdoc-config.mts";'],
	["tooling to configuration", "scripts/example.mts", 'import manifest from "../package.json" with { type: "json" };'],
	["configuration to tooling", "eslint.config.mts", 'import "./scripts/import-boundaries.mts";'],
	["configuration to configuration", "vitest.config.mts", 'import "./tsconfig.json";'],
	["tooling test to tooling", "scripts/example.test.mts", 'import "./jsdoc-config.mts";'],
	["tooling test to configuration", "scripts/example.test.mts", 'import "../package.json";'],
	["stylesheet", "src/index.ts", 'import "./style.css";'],
	["runtime extension", "eslint.config.mts", 'import "./scripts/jsdoc-config.mjs";'],
	["declared package", "src/greeting.test.ts", 'import { expect } from "vitest";'],
	["declared package subpath", "eslint.config.mts", 'import { defineConfig } from "eslint/config";'],
	["Node built-in", "scripts/example.mts", 'import { fileURLToPath } from "node:url";'],
])("allows %s", async (_name, filePath, source) => expect(await diagnostics(source, filePath)).toEqual([]));

test.each(["./missing.ts", "undeclared-package", "../README.md", "../node_modules/is-number/index.js"])(
	"rejects an unresolved or unclassified dependency: %s",
	async (specifier) => {
		const messages = await diagnostics(`import ${JSON.stringify(specifier)};`, "src/greeting.ts");

		expect(messages).toContainEqual(expect.objectContaining({ ruleId: "boundaries/dependencies" }));
		expect(messages).toContainEqual(expect.objectContaining({ ruleId: "boundaries/no-unknown-dependencies" }));
	},
);

test("rejects a file in no category", async () =>
	expect(await diagnostics("export const value = 1;", "unclassified/example.mts")).toContainEqual(
		expect.objectContaining({ ruleId: "boundaries/no-unknown-files" }),
	));

test.each(['const path = "./greeting"; await import(path);', "await import(`./greeting`);"])(
	"rejects a computed dynamic import: %s",
	async (source) =>
		expect(await diagnostics(source, "src/index.ts")).toContainEqual(
			expect.objectContaining({
				ruleId: "no-restricted-syntax",
				message: "Use a literal import so lint can resolve and enforce its boundary.",
			}),
		),
);

test("allows a literal dynamic import", async () =>
	expect(await diagnostics('await import("./greeting");', "src/index.ts")).toEqual([]));

test("checks library directions with the shipped policy outside the checkout", async () => {
	const directory = mkdtempDisposableSync(join(tmpdir(), "import-boundaries-"));
	const root = join(directory.path, "project");

	try {
		mkdirSync(join(root, "src/lib"), { recursive: true });
		writeFileSync(join(root, "src/lib/value.ts"), "export const value = 1;\n");
		writeFileSync(join(root, "tsconfig.json"), JSON.stringify({ include: ["src/**/*.ts"] }));
		writeFileSync(join(directory.path, "outside.ts"), "export const value = 1;\n");

		const linter = new ESLint({
			cwd: root,
			overrideConfigFile: fileURLToPath(new URL("../eslint.config.mts", import.meta.url)),
			overrideConfig: [
				tseslint.configs.disableTypeChecked,
				{
					settings: {
						"boundaries/root-path": root,
						"import/resolver": { typescript: { project: join(root, "tsconfig.json") } },
					},
				},
			],
		});

		for (const [filePath, specifier] of [
			["src/index.ts", "./lib/value"],
			["src/example.ts", "./lib/value"],
			["src/lib/example.ts", "./value"],
			["src/index.test.ts", "./lib/value"],
			["src/example.test.ts", "./lib/value"],
			["src/lib/example.test.ts", "./value"],
		] as const) {
			expect(await diagnostics(`import ${JSON.stringify(specifier)};`, filePath, linter), filePath).toEqual([]);
		}

		for (const [filePath, specifier] of [
			["scripts/example.mts", "../src/lib/value"],
			["scripts/example.test.mts", "../src/lib/value"],
			["vite.config.mts", "./src/lib/value"],
		] as const) {
			expect(await diagnostics(`import ${JSON.stringify(specifier)};`, filePath, linter), filePath).toContainEqual(
				expect.objectContaining({ ruleId: "boundaries/dependencies" }),
			);
		}

		expect(await diagnostics('import "../../outside.ts";', "src/example.ts", linter)).toContainEqual(
			expect.objectContaining({ ruleId: "boundaries/no-unknown-dependencies" }),
		);
	} finally {
		directory.remove();
	}
});

test("loads the native resolver and resolves application and tooling imports", () => {
	for (const [filePath, specifier, target] of [
		["src/index.ts", "./greeting", "src/greeting.ts"],
		["src/index.ts", "./style.css", "src/style.css"],
		["eslint.config.mts", "./scripts/jsdoc-config.mts", "scripts/jsdoc-config.mts"],
	] as const) {
		const importer = fileURLToPath(new URL(`../${filePath}`, import.meta.url));

		expect(resolve(specifier, importer)).toEqual({
			found: true,
			path: fileURLToPath(new URL(`../${target}`, import.meta.url)),
		});
	}

	if (process.arch === "x64" && (process.platform === "win32" || process.platform === "linux")) {
		const binding =
			process.platform === "win32" ? "@unrs/resolver-binding-win32-x64-msvc" : "@unrs/resolver-binding-linux-x64-gnu";

		expect(createRequire(import.meta.url).resolve(binding)).toMatch(/\.node$/);
	}
});
