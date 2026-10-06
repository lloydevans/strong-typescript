import { ESLint } from "eslint";
import tseslint from "typescript-eslint";
import { expect, test } from "vitest";

const eslint = new ESLint({ overrideConfig: tseslint.configs.disableTypeChecked });

async function diagnostics(source: string) {
	const results = await eslint.lintText(source, { filePath: "scripts/declaration-example.mts" });
	expect(results).toHaveLength(1);
	expect(results[0]?.fatalErrorCount).toBe(0);

	return results.flatMap((result) => result.messages.filter((message) => message.ruleId === "one-var"));
}

test("requires separate variable declarations", async () => {
	expect(await diagnostics("const first = 1, second = 2;")).toHaveLength(1);
	expect(await diagnostics("const first = 1; const second = 2;")).toEqual([]);
});
