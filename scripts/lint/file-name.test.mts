import { ESLint } from "eslint";
import { expect, test } from "vitest";
import { fileName } from "./file-name.mts";

const eslint = new ESLint({
	overrideConfigFile: true,
	overrideConfig: {
		files: ["**/*.{js,mjs,cjs,ts,mts,cts,tsx}"],
		plugins: { local: { rules: { "file-name": fileName } } },
		rules: { "local/file-name": "error" },
	},
});

test.each([
	["wait-for.test.ts", 0],
	["vite-env.d.ts", 0],
	["eslint.config.mts", 0],
	["jsdoc-config.test.mts", 0],
	["vector-2.tsx", 0],
	["wait-for.js", 0],
	["wait-for.mjs", 0],
	["wait-for.cjs", 0],
	["wait-for.cts", 0],
	[".prettierrc.mjs", 0],
	[".lintstagedrc.mjs", 0],
	[".PrettierRc.mjs", 1],
	["..prettierrc.mjs", 1],
	["waitFor.ts", 1],
	["WaitFor.test.ts", 1],
	["wait_for.ts", 1],
	["wait-for.Test.ts", 1],
	["wait-for..test.ts", 1],
	["wait--for.ts", 1],
	["-wait.ts", 1],
	["wait-.ts", 1],
])("checks the dotted name %s", async (name, count) => {
	const results = await eslint.lintText("", { filePath: `src/${name}` });
	expect(results).toHaveLength(1);
	expect(results[0]?.fatalErrorCount).toBe(0);
	expect(results[0]?.messages).toHaveLength(count);

	if (count) {
		expect(results[0]?.messages[0]).toMatchObject({ ruleId: "local/file-name", messageId: "invalid" });
	}
});

test("allows text without a file name", async () => {
	const results = await eslint.lintText("");
	expect(results).toHaveLength(1);
	expect(results[0]?.messages).toEqual([]);
});

test("enables the file-name rule in the shipped configuration", async () => {
	const config: unknown = await new ESLint().calculateConfigForFile("src/greeter.ts");
	expect(config).toHaveProperty(["rules", "local/file-name", 0], 2);
});
