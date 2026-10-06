import { realpathSync } from "node:fs";
import { relative, resolve as resolvePath } from "node:path";
import { resolve as resolveTypeScript, type TypeScriptResolverOptions } from "eslint-import-resolver-typescript";

/** The resolver interface used by the boundaries plugin. */
export const interfaceVersion = 2;

/**
 * Resolve TypeScript imports with the same root spelling as the boundary configuration.
 * @param source - The import specifier.
 * @param file - The importer.
 * @param options - Compiler resolution options and the boundary root.
 * @returns The resolver verdict, with Windows paths rebased to the configured root.
 */
export function resolve(
	source: string,
	file: string,
	options: TypeScriptResolverOptions & {
		/** Root spelling used by the file classifications. */
		root: string;
	},
) {
	const result = resolveTypeScript(source, file, options);
	if (process.platform === "win32" && result.found && result.path) {
		return {
			found: true,
			path: resolvePath(options.root, relative(realpathSync.native(options.root), realpathSync.native(result.path))),
		};
	}

	return result;
}
