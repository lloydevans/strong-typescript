/**
 * Import policy for the application, workspace packages and development tooling.
 * Each file takes its first matching category; local dependencies are denied unless listed below.
 * The application may use package entries. Packages may use their own internals and other package entries.
 * Packages never import application code, and production code never imports tests or development tooling.
 * Tests may use their subject's source, but never another test; only the entry's own test imports the DOM entry.
 * Tooling and configuration may use each other, separately from application and package source.
 * Checks use resolved files, including re-exports, type imports, literal dynamic imports, require and Vitest mock targets.
 * Unclassified files and unresolved local dependencies fail. Workspace names stay local; other declared packages are external.
 */
import { fileURLToPath } from "node:url";
import { createConfig, type DependenciesRuleOptions, type Settings } from "eslint-plugin-boundaries/config";
import { defineConfig } from "eslint/config";
import { readWorkspacePackages } from "./workspace-packages.mts";

/** The directory whose imports this policy owns. */
const root = fileURLToPath(new URL("../", import.meta.url));

/** Manifest-owned dependency names, with local packages kept inside the policy. */
const thirdParty = readWorkspacePackages(root).externalPackages;

/**
 * Select one or more file roles.
 * @param names - The roles accepted on this side of a dependency.
 * @returns A file selector for those roles.
 */
function category(...names: string[]) {
	return { file: { categories: names } };
}

/** File roles ordered before the broader folders they belong to. */
const settings = {
	"boundaries/root-path": root,
	"boundaries/files-single-match": true,
	"boundaries/files": [
		{ category: "entry-test", pattern: "src/index.test.ts" },
		{ category: "application-test", pattern: "src/**/*.test.{ts,mts}" },
		{ category: "package-test", pattern: "packages/*/src/**/*.test.{ts,mts}", capture: ["package"] },
		{ category: "tooling-test", pattern: "scripts/**/*.test.{ts,mts}" },
		{ category: "config", pattern: ["*.config.mts", "*.json", "src/tsconfig.json", "packages/*/*.json"] },
		{ category: "entry", pattern: "src/index.ts" },
		{ category: "application", pattern: "src/**" },
		{ category: "package-entry", pattern: "packages/*/src/index.ts", capture: ["package"] },
		{ category: "package-source", pattern: "packages/*/src/**", capture: ["package"] },
		{ category: "tooling", pattern: "scripts/**" },
	],
	"boundaries/flag-as-external": {
		unresolvableAlias: false,
		inNodeModules: false,
		outsideRootPath: false,
		customSourcePatterns: thirdParty.flatMap((name) => [name, `${name}/**`]),
	},
	"boundaries/additional-dependency-nodes": [
		{ selector: "TSImportType > Literal", name: "import-type", kind: "type" },
		{ selector: "TSExternalModuleReference > Literal", name: "import-equals", kind: "value" },
		{
			selector:
				"CallExpression[callee.object.name=vi][callee.property.name=/^(mock|doMock|importActual|importMock)$/] > Literal:first-child",
			name: "vitest",
			kind: "value",
		},
	],
} satisfies Settings;

/** The allowed directions; captured package identity limits internal imports. */
const dependencies = {
	default: "disallow",
	checkUnknownLocals: true,
	policies: [
		{ from: category("entry", "application"), allow: { to: category("application", "package-entry") } },
		{ from: category("entry-test"), allow: { to: category("entry", "application", "package-entry") } },
		{ from: category("application-test"), allow: { to: category("application", "package-entry") } },
		{ from: category("package-entry", "package-source", "package-test"), allow: { to: category("package-entry") } },
		{
			from: category("package-entry", "package-source", "package-test"),
			allow: { to: { file: { categories: ["package-source"], captured: { package: "{{ from.file.captured.package }}" } } } },
		},
		{ from: category("tooling", "config", "tooling-test"), allow: { to: category("tooling", "config") } },
	],
} satisfies DependenciesRuleOptions;

/** Enforce the policy in this module's header on resolved paths. */
export const importBoundaries = defineConfig(
	createConfig({
		files: ["**/*.{js,cjs,mjs,ts,cts,mts,tsx}"],
		settings,
		rules: {
			"boundaries/dependencies": ["error", dependencies],
			"boundaries/no-unknown-dependencies": ["error", { require: "file" }],
			"boundaries/no-unknown-files": "error",
		},
	}),
	{
		settings: {
			"import/resolver": {
				[fileURLToPath(new URL("./import-resolver.mts", import.meta.url))]: {
					root,
					project: ["tsconfig.json", "src/tsconfig.json", "packages/*/tsconfig.json"],
					alwaysTryTypes: true,
					noWarnOnMultipleProjects: true,
				},
			},
		},
	},
);
