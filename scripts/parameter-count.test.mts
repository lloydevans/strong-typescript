import { ESLint } from "eslint";
import tseslint from "typescript-eslint";
import { expect, test } from "vitest";

const eslint = new ESLint({ overrideConfig: tseslint.configs.disableTypeChecked });

async function diagnostics(source: string) {
	const results = await eslint.lintText(source, { filePath: "scripts/parameter-example.mts" });
	expect(results).toHaveLength(1);
	expect(results[0]?.fatalErrorCount).toBe(0);

	return results.flatMap((result) => result.messages.filter((message) => message.ruleId === "max-params"));
}

test("limits functions to three parameters", async () => {
	expect(await diagnostics("function run(first: number, second: number, third: number, fourth: number) {}")).toHaveLength(1);
	expect(await diagnostics("function run(first: number, second: number, third: number) {}")).toEqual([]);
});

test("permits a dictated signature under a reasoned disable", async () => {
	const signature = "type FillRectangle = (x: number, y: number, width: number, height: number) => void;";

	expect(await diagnostics(signature)).toHaveLength(1);
	expect(
		await diagnostics(`// eslint-disable-next-line max-params -- Match CanvasRenderingContext2D.fillRect.\n${signature}`),
	).toEqual([]);
});
