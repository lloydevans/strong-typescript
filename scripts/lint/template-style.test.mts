import { ESLint } from "eslint";
import { expect, test } from "vitest";

const eslint = new ESLint({
	overrideConfig: {
		languageOptions: {
			parserOptions: {
				projectService: { allowDefaultProject: ["template-style-example.mts"], defaultProject: "src/tsconfig.json" },
			},
		},
	},
});

async function diagnostics(type: string) {
	const results = await eslint.lintText(`declare const value: ${type}; export const text = \`value \${value}\`;`, {
		filePath: "template-style-example.mts",
	});
	expect(results).toHaveLength(1);
	expect(results[0]?.fatalErrorCount).toBe(0);

	return results.flatMap((result) =>
		result.messages.filter((message) => message.ruleId === "@typescript-eslint/restrict-template-expressions"),
	);
}

test.each(["number", "bigint"])("permits %s interpolation", async (type) => expect(await diagnostics(type)).toEqual([]), 15_000);

test.each(["Error", "URL", "URLSearchParams", "boolean"])(
	"refuses %s interpolation",
	async (type) => expect(await diagnostics(type)).toHaveLength(1),
	15_000,
);
