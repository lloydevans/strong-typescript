import { ESLint } from "eslint";
import tseslint from "typescript-eslint";
import { expect, test } from "vitest";

const eslint = new ESLint({ overrideConfig: tseslint.configs.disableTypeChecked });
const typedEslint = new ESLint({
	overrideConfig: {
		languageOptions: { parserOptions: { projectService: { allowDefaultProject: ["private-members-example.mts"] } } },
	},
});
const MESSAGE = "Use a #private member instead of TypeScript's private modifier.";

async function diagnostics(members: string, rule = "no-restricted-syntax", linter = eslint) {
	const results = await linter.lintText(`export class Counter { ${members} }`, { filePath: "private-members-example.mts" });
	expect(results).toHaveLength(1);
	expect(results[0]?.fatalErrorCount).toBe(0);

	return results.flatMap((result) =>
		result.messages.filter((message) => message.ruleId === rule).map((message) => message.message),
	);
}

test.each([
	["private count = 0;", "#count = 0;"],
	["private static count = 0;", "static #count = 0;"],
	["private count() { return 0; }", "#count() { return 0; }"],
	["private get count() { return 0; }", "get #count() { return 0; }"],
	["private set count(value: number) {}", "set #count(value: number) {}"],
	["private accessor count = 0;", "accessor #count = 0;"],
	[
		"constructor(private readonly count: number) {}",
		"readonly #count: number; constructor(count: number) { this.#count = count; }",
	],
])("refuses %s and accepts its #private form", async (member, replacement) => {
	expect(await diagnostics(member)).toEqual([MESSAGE]);
	expect(await diagnostics(replacement)).toEqual([]);
});

test.each(["protected count = 0;", "private constructor() {}"])("allows %s, which has no #private form", async (member) =>
	expect(await diagnostics(member)).toEqual([]),
);

test.each([
	["count = 0; #step = 1;", "#step = 1; count = 0;"],
	["next() {} #advance() {}", "#advance() {} next() {}"],
])("orders #private members after public members of their kind: %s", async (ordered, misordered) => {
	expect(await diagnostics(ordered, "@typescript-eslint/member-ordering")).toEqual([]);
	expect(await diagnostics(misordered, "@typescript-eslint/member-ordering")).toHaveLength(1);
});

test("requires readonly on a #private field that is never reassigned", async () => {
	const rule = "@typescript-eslint/prefer-readonly";

	expect(await diagnostics("#step = 1; next() { return this.#step; }", rule, typedEslint)).toHaveLength(1);
	expect(await diagnostics("readonly #step = 1; next() { return this.#step; }", rule, typedEslint)).toEqual([]);
}, 15_000);
