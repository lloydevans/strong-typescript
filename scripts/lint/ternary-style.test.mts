import { ESLint } from "eslint";
import tseslint from "typescript-eslint";
import { expect, test } from "vitest";

const eslint = new ESLint({ overrideConfig: tseslint.configs.disableTypeChecked });

async function diagnostics(source: string) {
	const results = await eslint.lintText(source, { filePath: "scripts/ternary-example.mts" });
	expect(results).toHaveLength(1);
	expect(results[0]?.fatalErrorCount).toBe(0);

	return results.flatMap((result) => result.messages.filter((message) => message.ruleId === "no-nested-ternary"));
}

test("refuses nested conditional expressions", async () => {
	expect(await diagnostics("const size = count > 9 ? 'large' : count > 3 ? 'medium' : 'small';")).toHaveLength(1);
	expect(await diagnostics("const size = count > 3 ? 'large' : 'small';")).toEqual([]);
});
