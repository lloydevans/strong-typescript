import { ESLint } from "eslint";
import tseslint from "typescript-eslint";
import { expect, test } from "vitest";

const eslint = new ESLint({ overrideConfig: tseslint.configs.disableTypeChecked });
const typedEslint = new ESLint({
	overrideConfig: {
		languageOptions: { parserOptions: { projectService: { allowDefaultProject: ["arrow-style-example.mts"] } } },
	},
});

async function diagnostics(source: string, rule: string, typed = false) {
	const results = await (typed ? typedEslint : eslint).lintText(source, { filePath: "arrow-style-example.mts" });
	expect(results).toHaveLength(1);
	expect(results[0]?.fatalErrorCount).toBe(0);

	return results.flatMap((result) => result.messages.filter((message) => message.ruleId === rule));
}

test("requires expression bodies for single returns", async () => {
	expect(await diagnostics("values.map((value: number) => { return value * 2; });", "arrow-body-style")).toHaveLength(1);
	expect(await diagnostics("values.map((value: number) => value * 2);", "arrow-body-style")).toEqual([]);
});

test("requires expression bodies for single expression statements", async () => {
	expect(await diagnostics("register(() => { finish(); });", "no-restricted-syntax")).toEqual([
		expect.objectContaining({ message: "Use an expression body for a single-statement arrow function." }),
	]);
	expect(await diagnostics("register(() => finish());", "no-restricted-syntax")).toEqual([]);
});

test(
	"permits void arrow shorthand",
	async () =>
		expect(
			await diagnostics(
				"declare function finish(): void; function run() { const callback = () => finish(); }",
				"@typescript-eslint/no-confusing-void-expression",
				true,
			),
		).toEqual([]),
	15_000,
);
