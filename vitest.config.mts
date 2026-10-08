import { configDefaults, defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { readWorkspacePackages } from "./scripts/workspace/workspace-packages.mts";

/** Resolve package names inside this tree, including a mutation sandbox with shared node_modules. */
const packages = readWorkspacePackages(fileURLToPath(new URL("./", import.meta.url))).packages;

/** Run colocated application, package and tooling tests without a prior build. */
export default defineConfig({
	resolve: {
		alias: packages.map((pkg) => ({
			find: new RegExp(`^${pkg.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`),
			replacement: pkg.entry,
		})),
	},
	test: {
		include: ["src/**/*.test.ts", "packages/*/src/**/*.test.ts", "scripts/**/*.test.mts"],
		forceRerunTriggers: [
			...configDefaults.forceRerunTriggers,
			"**/{vitest,vite}.config.*",
			"**/package-lock.json",
			"**/eslint.config.*",
			"**/tsconfig*.json",
			"**/scripts/**/!(*.test).mts",
		],
	},
});
