import { defineConfig } from "eslint/config";
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
import { documentationConfig } from "./scripts/jsdoc-config.mjs";
import { importBoundaries } from "./scripts/import-boundaries.mjs";

/** Combine type-aware checks with documentation and member-order rules. */
export default defineConfig(
	{ ignores: ["dist/", "coverage/", "reports/", ".stryker-tmp/"] },
	eslint.configs.recommended,
	tseslint.configs.strictTypeChecked,
	tseslint.configs.stylisticTypeChecked,
	{
		rules: {
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
