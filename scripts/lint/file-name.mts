import { basename } from "node:path";
import type { Rule } from "eslint";

/** Require kebab-case in every dotted component of a linted file's name. */
export const fileName: Rule.RuleModule = {
	meta: {
		type: "suggestion",
		schema: [],
		messages: {
			invalid: "Name each dotted part of '{{name}}' in kebab-case.",
		},
	},
	create(context) {
		const name = basename(context.physicalFilename);

		// ESLint uses this placeholder for text supplied without a file name.
		if (name === "__placeholder__.js") {
			return {};
		}

		const parts = name.replace(/^\./, "").split(".");
		const kebabCase = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

		if (!parts.every((part) => kebabCase.test(part))) {
			context.report({
				loc: { line: 1, column: 0 },
				messageId: "invalid",
				data: { name },
			});
		}

		return {};
	},
};
