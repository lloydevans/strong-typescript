import { defineConfig } from "eslint/config";
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
import { documentationConfig } from "./scripts/jsdoc-config.mjs";

/** Combine type-aware checks with documentation and member-order rules. */
export default defineConfig(
	{ ignores: ["dist/", "coverage/", "reports/", ".stryker-tmp/"] },
	eslint.configs.recommended,
	tseslint.configs.strictTypeChecked,
	tseslint.configs.stylisticTypeChecked,
	{
		rules: { "@typescript-eslint/member-ordering": "error" },
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
);
