import { ESLint } from "eslint";
import { format } from "prettier";
import tseslint from "typescript-eslint";
import { expect, test } from "vitest";
import manifest from "../../package.json" with { type: "json" };

const eslint = new ESLint({ overrideConfig: tseslint.configs.disableTypeChecked });
const width = manifest.prettier.printWidth;

function paragraph(length: number) {
	return `${"word ".repeat(length).slice(0, length - 1)}.`;
}

async function diagnostics(source: string, filePath = "scripts/lint/comment-width-example.mts", linter = eslint) {
	const results = await linter.lintText(source, { filePath });
	expect(results).toHaveLength(1);
	expect(results[0]?.fatalErrorCount).toBe(0);

	return results.flatMap((result) => result.messages.filter((message) => message.ruleId === "@stylistic/max-len"));
}

test.each([
	{ name: "line comment", prefix: "// ", suffix: "" },
	{ name: "JSDoc line", prefix: "/**\n * ", suffix: "\n */" },
])("limits a $name to the configured print width", async ({ prefix, suffix }) => {
	const text = paragraph(width - 3);
	expect(await diagnostics(`${prefix}${text}${suffix}`)).toEqual([]);
	expect(await diagnostics(`${prefix}${text}.${suffix}`)).toEqual([expect.objectContaining({ messageId: "maxComment" })]);
});

test("counts indentation tabs as Prettier does", async () => {
	const formatted = await format("if (ready) { work(); }", {
		...manifest.prettier,
		parser: "typescript",
		useTabs: false,
	});
	const indentation = /\n( +)work/u.exec(formatted)?.[1] ?? "";
	expect(indentation.length).toBeGreaterThan(0);

	const text = paragraph(width - indentation.length - 3);
	expect(await diagnostics(`\t// ${text}`)).toEqual([]);
	expect(await diagnostics(`\t// ${text}.`)).toEqual([expect.objectContaining({ messageId: "maxComment" })]);
});

test("allows a line holding a long URL", async () => {
	const source = `// Read https://example.com/${"segment/".repeat(width)} for details.`;
	expect(await diagnostics(source)).toEqual([]);
});

test.each([
	{ prefix: "// eslint-disable-next-line", suffix: "" },
	{ prefix: "// eslint-disable-line", suffix: "" },
	{ prefix: "/* eslint-disable", suffix: " */" },
	{ prefix: "/* eslint-disable-next-line", suffix: " */" },
	{ prefix: "/* eslint-disable-line", suffix: " */" },
])("allows a long reason on $prefix", async ({ prefix, suffix }) => {
	const source = `${prefix} no-debugger -- ${paragraph(width)}${suffix}\ndebugger;`;
	expect(await diagnostics(source)).toEqual([]);
	expect(await diagnostics(`\t${source}`)).toEqual([]);
	expect(
		await diagnostics(`${prefix.replace("eslint-", "Mention eslint-")} no-debugger -- ${paragraph(width)}${suffix}`),
	).toEqual([expect.objectContaining({ messageId: "maxComment" })]);
});

test.each(["", " "])("allows JSX disable comments with spacing %j", async (spacing) => {
	const wrap = (comment: string) => `const element = <>\n\t{${spacing}/* ${comment} */}\n</>;`;
	const directive = `eslint-disable-next-line no-debugger -- ${paragraph(width)}`;

	expect(await diagnostics(wrap(directive), "src/example.tsx")).toEqual([]);
	expect(await diagnostics(wrap(`Mention ${directive}`), "src/example.tsx")).toEqual([
		expect.objectContaining({ messageId: "maxComment" }),
	]);
});

test.each([
	{ prefix: "//", suffix: "" },
	{ prefix: "///", suffix: "" },
	{ prefix: "/*", suffix: " */" },
])("allows a described type-error directive in $prefix", async ({ prefix, suffix }) => {
	for (const separator of [" -- ", ": ", "-example "]) {
		const directive = `@ts-expect-error${separator}${paragraph(width)}`;

		expect(await diagnostics(`${prefix} ${directive}${suffix}`)).toEqual([]);
		expect(await diagnostics(`${prefix} Mention ${directive}${suffix}`)).toEqual([
			expect.objectContaining({ messageId: "maxComment" }),
		]);
	}
});

test.each(["@ts-ignore", "@ts-nocheck", "@ts-check"])("does not exempt %s", async (directive) =>
	expect(await diagnostics(`// ${directive} -- ${paragraph(width)}`)).toEqual([
		expect.objectContaining({ messageId: "maxComment" }),
	]),
);

test.each(["eslint-disable-next-line no-debugger", "@ts-expect-error"])(
	"does not mistake %s inside JSDoc prose for a directive",
	async (directive) =>
		expect(await diagnostics(`/**\n * // ${directive} -- ${paragraph(width)}\n */`)).toEqual([
			expect.objectContaining({ messageId: "maxComment" }),
		]),
);

test("registers the width rule for files outside the documentation globs", async () => {
	const linter = new ESLint({
		overrideConfig: { ...tseslint.configs.disableTypeChecked, files: ["**/*.jsx"] },
	});
	const text = paragraph(width - 3);

	expect(await diagnostics(`// ${text}`, "scripts/lint/example.jsx", linter)).toEqual([]);
	expect(await diagnostics(`// ${text}.`, "scripts/lint/example.jsx", linter)).toEqual([
		expect.objectContaining({ messageId: "maxComment" }),
	]);
});

test.each([
	{ prefix: "// ", suffix: "", path: "scripts/lint/example.mts" },
	{ prefix: "/* ", suffix: " */", path: "scripts/lint/example.mts" },
	{ prefix: "/**\n * ", suffix: "\n */", path: "scripts/lint/example.mts" },
	{ prefix: "/*\n", suffix: "\n*/", path: "scripts/lint/example.mts" },
	{ prefix: "const element = <>\n\t{/* ", suffix: " */}\n</>;", path: "src/example.tsx" },
])("preserves a single unbroken token after $prefix", async ({ prefix, suffix, path }) => {
	const token = `packages/${"segment/".repeat(width)}/index.ts`;

	expect(await diagnostics(`${prefix}${token}${suffix}`, path)).toEqual([]);
	expect(await diagnostics(`${prefix}${token} description${suffix}`, path)).toEqual([
		expect.objectContaining({ messageId: "maxComment" }),
	]);
});

test.each([
	"// Mention eslint-disable-next-line here.",
	"// eslint-disable-next-line-example",
	"// eslint-disable",
	"/* Mention eslint-disable here.",
	"/* eslint-disable-example",
	"/** eslint-disable",
])("does not exempt ordinary prose starting with %s", async (prefix) => {
	const suffix = prefix.startsWith("/*") ? " */" : "";
	expect(await diagnostics(`${prefix} ${paragraph(width)}${suffix}`)).toEqual([
		expect.objectContaining({ messageId: "maxComment" }),
	]);
});

test.each(["", " // A trailing comment.", " /* A trailing comment. */"])(
	"leaves long code lines to Prettier with suffix %j",
	async (suffix) => {
		const source = `const value = ${"1 + ".repeat(width)}1;${suffix}`;
		expect(await diagnostics(source)).toEqual([]);
	},
);
