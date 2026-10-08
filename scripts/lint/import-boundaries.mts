/**
 * Import policy for the application, workspace packages and development tooling.
 * Each file takes its first matching category; local dependencies are denied unless listed below.
 * The application and packages may use entries declared in their own manifest's dependencies or devDependencies.
 * These allowances come from the shared workspace reader; relative paths do not bypass a missing declaration.
 * Packages may use their own internals. Manifest cycles, including self-dependencies, fail lint and typecheck.
 * Cycles between files inside one package are not checked, and declared imports need no particular spelling.
 * Packages never import application code, and production code never imports tests or development tooling.
 * Tests may use their subject's source, but never another test; only the entry's own test imports the DOM entry.
 * Tooling under scripts/ at any depth and configuration may use each other, separately from application and package source.
 * Checks use resolved files, including re-exports, type imports, literal dynamic imports, require and Vitest mock targets.
 * Unclassified files and unresolved local dependencies fail. Workspace names stay local; other declared packages are external.
 */
import { relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createConfig, type DependenciesRuleOptions, type Settings } from "eslint-plugin-boundaries/config";
import { defineConfig } from "eslint/config";
import { readWorkspacePackages } from "../workspace/workspace-packages.mts";

/** Vitest calls whose targets must be literal strings for boundary resolution. */
export const vitestImportCalls =
	"CallExpression[callee.object.name=/^(vi|vitest)$/][callee.property.name=/^(mock|doMock|importActual|importMock)$/]";

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
	},
	"boundaries/additional-dependency-nodes": [
		{ selector: "TSImportType > Literal", name: "import-type", kind: "type" },
		{ selector: "TSExternalModuleReference > Literal", name: "import-equals", kind: "value" },
		{
			selector: `${vitestImportCalls} > Literal:first-child`,
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
		{ from: category("entry", "application"), allow: { to: category("application") } },
		{ from: category("entry-test"), allow: { to: category("entry", "application") } },
		{ from: category("application-test"), allow: { to: category("application") } },
		{
			from: category("package-entry", "package-source", "package-test"),
			allow: {
				to: {
					file: { categories: ["package-entry", "package-source"], captured: { package: "{{ from.file.captured.package }}" } },
				},
			},
		},
		{ from: category("tooling", "config", "tooling-test"), allow: { to: category("tooling", "config") } },
	],
} satisfies DependenciesRuleOptions;

/**
 * Enforce the header's policy using the manifests in the supplied tree.
 * @param root - The application root whose manifests own dependency declarations.
 * @returns Boundary settings and rules for resolved files in that tree.
 * @throws When the workspace reader rejects a manifest or a package cycle.
 */
export function createImportBoundaries(root: string) {
	const layout = readWorkspacePackages(root);
	const owners = [
		{
			name: "",
			manifest: "package.json",
			dependencies: layout.rootDependencies,
			from: category("entry", "application", "entry-test", "application-test"),
		},
		...layout.packages.map((pkg) => ({
			name: pkg.name,
			manifest: `${relative(root, pkg.directory).replaceAll("\\", "/")}/package.json`,
			dependencies: pkg.dependencies,
			from: {
				file: {
					categories: ["package-entry", "package-source", "package-test"],
					path: `${relative(root, pkg.directory).replaceAll("\\", "/")}/src/**`,
				},
			},
		})),
	];
	const packagePolicies = owners.flatMap((owner) =>
		layout.packages
			.filter((target) => target.name !== owner.name)
			.map((target) => {
				const to = { file: { categories: ["package-entry"], path: relative(root, target.entry).replaceAll("\\", "/") } };

				return {
					from: owner.from,
					...(owner.dependencies.includes(target.name) ? { allow: { to } } : { disallow: { to } }),
					message: `Declare ${target.name} in ${owner.manifest} dependencies or devDependencies before importing it.`,
				};
			}),
	);

	return defineConfig(
		createConfig({
			files: ["**/*.{js,cjs,mjs,ts,cts,mts,tsx}"],
			settings: {
				...settings,
				"boundaries/root-path": root,
				"boundaries/flag-as-external": {
					...settings["boundaries/flag-as-external"],
					customSourcePatterns: layout.externalPackages.flatMap((name) => [name, `${name}/**`]),
				},
			},
			rules: {
				"boundaries/dependencies": ["error", { ...dependencies, policies: [...dependencies.policies, ...packagePolicies] }],
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
}

/** Enforce the policy in this module's header on this application's tree. */
export const importBoundaries = createImportBoundaries(fileURLToPath(new URL("../../", import.meta.url)));
