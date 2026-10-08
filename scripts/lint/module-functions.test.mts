import { ESLint } from "eslint";
import tseslint from "typescript-eslint";
import { expect, test } from "vitest";

const eslint = new ESLint({ overrideConfig: tseslint.configs.disableTypeChecked });

test.each([
	["an exported arrow", "export const run = () => {};", 1],
	["a module-level arrow", "const run = () => {};", 1],
	["a module-level function expression", "const run = function () {};", 1],
	["a typed function constant", "const read: Reader = () => {};", 1],
	["a namespace function constant", "namespace Operations { const run = () => {}; }", 1],
	["a default-exported arrow", "export default () => 1;", 1],
	["a default-exported function expression", "export default (function () { return 1; });", 1],
	["an arrow with satisfies", "export const count = (() => 1) satisfies () => number;", 1],
	["a function expression with satisfies", "const count = (function () { return 1; }) satisfies () => number;", 1],
	["an arrow with as", "const count = (() => 1) as () => number;", 1],
	["a function expression with as", "const count = (function () { return 1; }) as () => number;", 1],
	["an arrow with a non-null assertion", "const count = (() => 1)!;", 1],
	["a function expression with a non-null assertion", "const count = (function () { return 1; })!;", 1],
	["a function declaration", "function run() {}", 0],
	["a default-exported function declaration", "export default function () {}", 0],
	["a checked function reference", "function fn() { return 1; } export const count = fn satisfies () => number;", 0],
	["a typed function reference", "function fn() { return 1; } export const count: () => number = fn;", 0],
	["a local closure", "function run() { const exists = () => true; }", 0],
	["a wrapped local closure", "function run() { const exists = (() => true) satisfies () => boolean; }", 0],
	["an inline callback", "register(() => {});", 0],
])("checks module function syntax for %s", async (_kind, source, count) => {
	const results = await eslint.lintText(source, { filePath: "src/module-function-example.ts" });
	expect(results).toHaveLength(1);
	expect(results[0]?.fatalErrorCount).toBe(0);
	expect(
		results.flatMap((result) => result.messages.filter((message) => message.ruleId === "no-restricted-syntax")),
	).toHaveLength(count);
});
