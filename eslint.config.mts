import { defineConfig } from "eslint/config";
import eslint from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import tseslint from "typescript-eslint";
import globals from "globals";
import type { Options } from "prettier";
import manifest from "./package.json" with { type: "json" };
import { documentationConfig } from "./scripts/lint/jsdoc-config.mts";
import { importBoundaries, vitestImportCalls } from "./scripts/lint/import-boundaries.mts";

/** Read optional formatter settings alongside the required print width. */
const prettierOptions: Options = manifest.prettier;

/** Combine type-aware checks with documentation and member-order rules. */
export default defineConfig(
	{ ignores: ["dist/", "coverage/", "reports/", ".stryker-tmp/"] },
	eslint.configs.recommended,
	tseslint.configs.strictTypeChecked,
	tseslint.configs.stylisticTypeChecked,
	{
		plugins: { "@stylistic": stylistic },
		rules: {
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
			"no-restricted-syntax": [
				"error",
				{
					selector: "ImportExpression[source.type!='Literal']",
					message: "Use a literal import so lint can resolve and enforce its boundary.",
				},
				{
					selector: `${vitestImportCalls}:not([arguments.0.type='Literal'][arguments.0.value=type(string)])`,
					message: "Use a string literal target so lint can resolve and enforce its boundary.",
				},
				{
					selector:
						":matches(:matches(Program, TSModuleBlock, ExportNamedDeclaration) > VariableDeclaration > VariableDeclarator > :matches(FunctionExpression, ArrowFunctionExpression, :matches(TSSatisfiesExpression, TSAsExpression, TSNonNullExpression)[expression.type=/^(FunctionExpression|ArrowFunctionExpression)$/]).init, ExportDefaultDeclaration > :matches(FunctionExpression, ArrowFunctionExpression).declaration)",
					message: "Write a function declaration for a module-level function.",
				},
				{
					selector: "ArrowFunctionExpression > BlockStatement.body[body.length=1] > ExpressionStatement",
					message: "Use an expression body for a single-statement arrow function.",
				},
			],
		},
		languageOptions: {
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
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
