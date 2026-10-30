import { defineConfig } from "eslint/config";
import eslint from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import tseslint from "typescript-eslint";
import globals from "globals";
import type { Options } from "prettier";
import manifest from "./package.json" with { type: "json" };
import { documentationConfig } from "./scripts/lint/jsdoc-config.mts";
import { fileName } from "./scripts/lint/file-name.mts";
import { importBoundaries, VITEST_IMPORT_CALLS } from "./scripts/lint/import-boundaries.mts";

/** Entry files that may re-export a library's API by name. */
const libraryEntries = ["packages/*/src/index.ts"];

/** Syntax refused in every file, including library entry files. */
const restrictedSyntax = [
	{
		selector: "ImportExpression[source.type!='Literal']",
		message: "Use a literal import so lint can resolve and enforce its boundary.",
	},
	{
		selector: `${VITEST_IMPORT_CALLS}:not([arguments.0.type='Literal'][arguments.0.value=type(string)])`,
		message: "Use a string literal target so lint can resolve and enforce its boundary.",
	},
	{
		selector:
			":matches(:matches(Program, TSModuleBlock, ExportNamedDeclaration) > VariableDeclaration, ExportDefaultDeclaration) [type=/^(FunctionExpression|ArrowFunctionExpression)$/]:not(:matches(:matches(Program, TSModuleBlock, ExportNamedDeclaration) > VariableDeclaration, ExportDefaultDeclaration) :not(VariableDeclarator, [type=/^TS(As|Satisfies|NonNull)Expression$/]) [type=/^(FunctionExpression|ArrowFunctionExpression)$/])",
		message: "Write a function declaration for a module-level function.",
	},
	{
		selector: "ArrowFunctionExpression > BlockStatement.body[body.length=1] > ExpressionStatement",
		message: "Use an expression body for a single-statement arrow function.",
	},
	{
		selector: "ExportNamedDeclaration:not([source])[specifiers.length>0]",
		message: "Export a name on its declaration, not in a list.",
	},
	{
		selector: "ExportAllDeclaration",
		message: "Do not export *; a library's entry file names what it re-exports, and no other file re-exports.",
	},
	// A constructor has no #private form, so it may keep the modifier.
	{
		selector: "[accessibility='private']:not([kind='constructor'])",
		message: "Use a #private member instead of TypeScript's private modifier.",
	},
];

/** Read optional formatter settings alongside the required print width. */
const prettierOptions: Options = manifest.prettier;

/** Combine type-aware checks with documentation, naming and module conventions. */
export default defineConfig(
	{ ignores: ["dist/", "coverage/", "reports/", ".stryker-tmp/"] },
	eslint.configs.recommended,
	tseslint.configs.strictTypeChecked,
	tseslint.configs.stylisticTypeChecked,
	{
		plugins: { "@stylistic": stylistic, local: { rules: { "file-name": fileName } } },
		rules: {
			"local/file-name": "error",
			"@stylistic/max-len": [
				"error",
				{
					// Prettier owns code width, including lines with trailing comments.
					code: Number.MAX_SAFE_INTEGER,
					comments: manifest.prettier.printWidth,
					// Use Prettier's default when the project does not set a tab width.
					tabWidth: prettierOptions.tabWidth ?? 2,
					ignoreUrls: true,
					ignorePattern: [
						String.raw`^\s*(?://\s*eslint-disable-(?:next-line|line)|(?:\{\s*)?/\*\s*eslint-disable(?:-next-line|-line)?)(?:\s|\*/|$)`,
						// TypeScript takes everything after this directive's name as its description.
						String.raw`^\s*(?:///?|/\*)\s*@ts-expect-error`,
						String.raw`^\s*(?://+|(?:\{\s*)?/\*+|\*)?\s*\S+\s*(?:\*/\s*\}?)?\s*$`,
					].join("|"),
				},
			],
			"@typescript-eslint/member-ordering": "error",
			"@typescript-eslint/prefer-readonly": "error",
			"@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
			"@typescript-eslint/naming-convention": [
				"error",
				{
					selector: "default",
					format: ["strictCamelCase"],
					leadingUnderscore: "forbid",
					trailingUnderscore: "forbid",
				},
				{ selector: "typeLike", format: ["StrictPascalCase"] },
				{ selector: "import", format: ["strictCamelCase", "StrictPascalCase"] },
				{ selector: "parameter", modifiers: ["unused"], format: ["strictCamelCase"], leadingUnderscore: "allow" },
				{ selector: ["objectLiteralProperty", "objectLiteralMethod"], format: null },
				{ selector: ["variable", "parameter"], modifiers: ["destructured"], filter: ".*", format: null },
				{ selector: "variable", modifiers: ["const", "global"], types: ["boolean", "string", "number"], format: ["UPPER_CASE"] },
				{
					selector: ["property", "method", "accessor"],
					modifiers: ["requiresQuotes"],
					format: null,
				},
			],
			"arrow-body-style": ["error", "as-needed"],
			"one-var": ["error", "never"],
			"max-params": ["error", 3],
			"no-nested-ternary": "error",
			"@typescript-eslint/no-confusing-void-expression": ["error", { ignoreArrowShorthand: true }],
			"@typescript-eslint/restrict-template-expressions": [
				"error",
				{
					allow: [],
					allowAny: false,
					allowBoolean: false,
					allowNever: false,
					allowNullish: false,
					allowNumber: true,
					allowRegExp: false,
				},
			],
			"no-restricted-syntax": ["error", ...restrictedSyntax],
		},
		languageOptions: {
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
	},
	{
		name: "re-exports",
		ignores: libraryEntries,
		rules: {
			"no-restricted-syntax": [
				"error",
				...restrictedSyntax,
				{
					selector: "ExportNamedDeclaration[source]",
					message: "Do not re-export; import each name from the file that declares it. Only a library's entry file re-exports.",
				},
			],
		},
	},
	{
		files: ["**/*.{js,mjs,cjs}"],
		extends: [tseslint.configs.disableTypeChecked],
		languageOptions: {
			globals: globals.node,
		},
	},
	...documentationConfig,
	...importBoundaries,
);
