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

async function diagnostics(source: string) {
	const results = await eslint.lintText(source, { filePath: "scripts/lint/comment-width-example.mts" });
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
