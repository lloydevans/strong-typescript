import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { readWorkspacePackages } from "./workspace-packages.mts";

/**
 * Check each compiler project with the installed compiler, without nested npm shells.
 * @param root - The application root whose workspace manifests select package projects.
 * @returns Zero when every project passes, otherwise the first compiler failure.
 */
export function typecheck(root: string) {
	const compiler = createRequire(import.meta.url).resolve("typescript/bin/tsc");
	const projects = [
		join(root, "src/tsconfig.json"),
		join(root, "tsconfig.json"),
		...readWorkspacePackages(root).packages.map((pkg) => join(pkg.directory, "tsconfig.json")),
	];

	for (const project of projects) {
		const result = spawnSync(process.execPath, [compiler, "--noEmit", "-p", project], { stdio: "inherit" });
		if (result.status !== 0) {
			return result.status ?? 1;
		}
	}

	return 0;
}

if (import.meta.main) {
	process.exitCode = typecheck(fileURLToPath(new URL("../../", import.meta.url)));
}
