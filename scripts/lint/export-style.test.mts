import { ESLint } from "eslint";
import tseslint from "typescript-eslint";
import { expect, test } from "vitest";
import config from "../../eslint.config.mts";

const eslint = new ESLint({ overrideConfig: tseslint.configs.disableTypeChecked });

async function diagnostics(source: string, linter = eslint, filePath = "src/library-entry.ts") {
	const results = await linter.lintText(source, { filePath });
	expect(results).toHaveLength(1);
	expect(results[0]?.fatalErrorCount).toBe(0);

	return results.flatMap((result) =>
		result.messages.filter((message) => message.ruleId === "no-restricted-syntax").map((message) => message.message),
	);
}

test.each([
	["const value = 1; export { value };", "Export a name on its declaration, not in a list."],
	[
		'export * from "./greeter";',
		"Do not export *; a library's entry file names what it re-exports, and no other file re-exports.",
	],
	[
		'export { default } from "./greeter";',
		"Do not re-export; import each name from the file that declares it. Only a library's entry file re-exports.",
	],
])("refuses %s", async (source, message) => expect(await diagnostics(source)).toEqual([message]));

test("allows declarations and named re-exports only at a listed entry", async () => {
	expect(config.find((entry) => entry.name === "re-exports")).toHaveProperty("ignores", ["packages/*/src/index.ts"]);

	const entryEslint = new ESLint({
		overrideConfigFile: true,
		overrideConfig: [
			...config.map((entry) => (entry.name === "re-exports" ? { ...entry, ignores: ["src/library-entry.ts"] } : entry)),
			tseslint.configs.disableTypeChecked,
		],
	});

	expect(await diagnostics("export const value = 1; export function run() {}", eslint)).toEqual([]);
	expect(await diagnostics('export { default } from "./greeter";', entryEslint)).toEqual([]);
	expect(await diagnostics('export * from "./greeter";', entryEslint)).toEqual([
		"Do not export *; a library's entry file names what it re-exports, and no other file re-exports.",
	]);
	expect(await diagnostics("const value = 1; export { value };", entryEslint)).toEqual([
		"Export a name on its declaration, not in a list.",
	]);
});

test("allows a named re-export in a package's entry and in no other file of the package", async () => {
	const source = 'export { value } from "./value";';

	expect(await diagnostics(source, eslint, "packages/greeter/src/index.ts")).toEqual([]);
	expect(await diagnostics(source, eslint, "packages/greeter/src/value.ts")).toEqual([
		"Do not re-export; import each name from the file that declares it. Only a library's entry file re-exports.",
	]);
});
