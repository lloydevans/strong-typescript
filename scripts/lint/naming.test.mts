import { ESLint } from "eslint";
import tseslint from "typescript-eslint";
import { expect, test } from "vitest";
import config from "../../eslint.config.mts";

const namingRule = config.find((entry) => entry.rules?.["@typescript-eslint/naming-convention"])?.rules?.[
	"@typescript-eslint/naming-convention"
];
const eslint = new ESLint({
	overrideConfig: [
		tseslint.configs.disableTypeChecked,
		{
			languageOptions: { parserOptions: { projectService: { allowDefaultProject: ["src/naming-example.test.ts"] } } },
			rules: { "@typescript-eslint/naming-convention": namingRule ?? "off" },
		},
	],
});

async function diagnostics(source: string) {
	const results = await eslint.lintText(source, { filePath: "src/naming-example.test.ts" });
	expect(results).toHaveLength(1);
	expect(results[0]?.fatalErrorCount).toBe(0);

	return results.flatMap((result) => result.messages.map(({ ruleId, messageId }) => ({ ruleId, messageId })));
}

test.each([
	["export const MAX_RETRIES = 3;", "export const maxRetries = 3;"],
	['export const GREETING = "Hello";', 'export const greeting = "Hello";'],
	["export const ENABLED = true;", "export const enabled = true;"],
	["export const LIMIT = Math.max(1, 2);", "export const limit = Math.max(1, 2);"],
])("requires UPPER_CASE on a module-level primitive constant: %s", async (source, camelCase) => {
	expect(await diagnostics(source)).toEqual([]);
	expect(await diagnostics(camelCase)).toEqual([
		{ ruleId: "@typescript-eslint/naming-convention", messageId: "doesNotMatchFormat" },
	]);
});

test.each([
	['export const directions = ["up", "down"] as const;', 'export const DIRECTIONS = ["up", "down"] as const;'],
	["export const limits = Object.freeze({ retries: 3 });", "export const LIMITS = Object.freeze({ retries: 3 });"],
	["export const cache = new Map<string, number>();", "export const CACHE = new Map<string, number>();"],
	["export function run() { const limit = 3; return limit; }", "export function run() { const LIMIT = 3; return LIMIT; }"],
])("requires camelCase on any other constant: %s", async (source, upperCase) => {
	expect(await diagnostics(source)).toEqual([]);
	expect(await diagnostics(upperCase)).toEqual([
		{ ruleId: "@typescript-eslint/naming-convention", messageId: "doesNotMatchFormat" },
	]);
});

test("allows an underscore only on an unused parameter", async () => {
	expect(await diagnostics("export function run(_unused: string) { return 1; }")).toEqual([]);
	expect(await diagnostics("export function run(unused: string, value: string) { return value; }")).toEqual([]);
	expect(await diagnostics("export function run(_value: string) { return _value; }")).toEqual([
		{ ruleId: "@typescript-eslint/naming-convention", messageId: "unexpectedUnderscore" },
	]);
});

test.each([
	['export interface Headers { "content-type": string; }', 1],
	['export interface Headers { "content-type": () => string; }', 1],
	['export class Headers { "content-type" = "text/plain"; }', 1],
	['export class Headers { "content-type"() { return "text/plain"; } }', 1],
	['export const headers = { get "content-type"() { return "text/plain"; } };', 1],
	['export class Headers { value = "text/plain"; get "content-type"() { return this.value; } }', 1],
	['export class Headers { accessor "content-type" = "text/plain"; }', 1],
])("exempts only names that require quotes: %s", async (source, count) => {
	expect(await diagnostics(source)).toEqual([]);
	expect(await diagnostics(source.replaceAll("content-type", "ContentType"))).toEqual(
		Array.from({ length: count }, () => ({
			ruleId: "@typescript-eslint/naming-convention",
			messageId: "doesNotMatchFormat",
		})),
	);
});

test.each([
	['export const headers = { ContentType: "text/plain" };', "export interface Headers { ContentType: string; }"],
	['export const headers = { ContentType() { return "text/plain"; } };', "export interface Headers { ContentType(): string; }"],
])("exempts object literal keys but checks declared members: %s", async (source, declaration) => {
	expect(await diagnostics(source)).toEqual([]);
	expect(await diagnostics(declaration)).toEqual([
		{ ruleId: "@typescript-eslint/naming-convention", messageId: "doesNotMatchFormat" },
	]);
});

test.each([
	[
		'const { ContentType } = { ContentType: "text/plain" }; export default ContentType;',
		'const { contentType: ContentType } = { contentType: "text/plain" }; export default ContentType;',
	],
	[
		"export function read({ ContentType }: Record<string, string>) { return ContentType; }",
		"export function read({ contentType: ContentType }: Record<string, string>) { return ContentType; }",
	],
])("exempts shorthand destructuring but checks renamed bindings: %s", async (source, renamed) => {
	expect(await diagnostics(source)).toEqual([]);
	expect(await diagnostics(renamed)).toEqual([
		{ ruleId: "@typescript-eslint/naming-convention", messageId: "doesNotMatchFormat" },
	]);
});

test.each(["greeter", "Greeter"])("allows the default import %s", async (name) =>
	expect(await diagnostics(`import ${name} from "@example/greeter"; export default ${name};`)).toEqual([]),
);
