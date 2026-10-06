/**
 * Import policy for application source, its tests and development tooling.
 * Each file takes its first matching category; the allowances below are the complete list of permitted local directions.
 * The entry composes the feature and library, while the library stays independent of the feature and entry.
 * Tests stay outside production dependencies and cannot import one another; only the entry's own test may import the entry.
 * Tooling and configuration may use each other, and stay separate from application source.
 * Checks use resolved files, including re-exports, type imports, literal dynamic imports, require and Vitest mock targets.
 * Unclassified files and unresolved local dependencies fail. Declared packages and Node built-ins are external.
 * The lint configuration requires literal dynamic imports so their targets can be resolved.
 */
import { fileURLToPath } from "node:url";
import { createConfig, type DependenciesRuleOptions, type Settings } from "eslint-plugin-boundaries/config";
import { defineConfig } from "eslint/config";
import rootPackage from "../package.json" with { type: "json" };

/** Roles in classification order, with specific files before their containing folders. */
const categories = {
	/** The sole test allowed to load the DOM entry. */
	entryTest: "entry-test",

	/** Tests of reusable application code. */
	libraryTest: "library-test",

	/** Tests of the application feature. */
	featureTest: "feature-test",

	/** Tests of development tooling. */
	toolingTest: "tooling-test",

	/** Tool configuration and package manifests. */
	config: "config",

	/** The DOM bootstrap module. */
	entry: "entry",

	/** Reusable code independent of the application feature. */
	library: "library",

	/** Application-specific code, declarations and assets. */
	feature: "feature",

	/** Development scripts loaded by configuration. */
	tooling: "tooling",
} as const;

/** One role assigned to a file. */
type Category = (typeof categories)[keyof typeof categories];

/** Paths owned by each role, including the currently empty library and entry-test locations. */
const patterns: Record<Category, string[]> = {
	[categories.entryTest]: ["src/index.test.ts"],
	[categories.libraryTest]: ["src/lib/**/*.test.{ts,mts}"],
	[categories.featureTest]: ["src/**/*.test.{ts,mts}"],
	[categories.toolingTest]: ["scripts/**/*.test.{ts,mts}"],
	[categories.config]: ["*.config.mts", "*.json", "src/tsconfig.json"],
	[categories.entry]: ["src/index.ts"],
	[categories.library]: ["src/lib/**"],
	[categories.feature]: ["src/**"],
	[categories.tooling]: ["scripts/**"],
};

/**
 * Select roles from the single file classification.
 * @param values - Roles allowed on this side of a dependency.
 * @returns A boundaries entity selector.
 */
function category(...values: Category[]) {
	return { file: { categories: values } };
}

/** Allow either dependency section to be absent in the package manifest. */
const manifest: {
	/** Packages used by the application. */
	dependencies?: Record<string, string>;

	/** Packages used by development tools. */
	devDependencies?: Record<string, string>;
} = rootPackage;

/** Declared packages and their subpaths are external to the local policy. */
const thirdParty = Object.keys({ ...manifest.dependencies, ...manifest.devDependencies });

/** Classify files once and include dependency syntax beyond ordinary imports. */
const settings = {
	"boundaries/root-path": fileURLToPath(new URL("../", import.meta.url)),
	"boundaries/files-single-match": true,
	"boundaries/files": Object.values(categories).flatMap((value) =>
		patterns[value].map((pattern) => ({ category: value, pattern })),
	),
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

/** Local directions permitted by the policy in this module's header. */
const dependencies = {
	default: "disallow",
	checkUnknownLocals: true,
	checkInternals: true,
	policies: [
		{ from: category(categories.entry), allow: { to: category(categories.feature, categories.library) } },
		{ from: category(categories.feature), allow: { to: category(categories.feature, categories.library) } },
		{ from: category(categories.library), allow: { to: category(categories.library) } },
		{
			from: category(categories.entryTest),
			allow: { to: category(categories.entry, categories.feature, categories.library) },
		},
		{ from: category(categories.featureTest), allow: { to: category(categories.feature, categories.library) } },
		{ from: category(categories.libraryTest), allow: { to: category(categories.library) } },
		{ from: category(categories.tooling), allow: { to: category(categories.tooling, categories.config) } },
		{ from: category(categories.config), allow: { to: category(categories.config, categories.tooling) } },
		{ from: category(categories.toolingTest), allow: { to: category(categories.tooling, categories.config) } },
	],
} satisfies DependenciesRuleOptions;

/** Enforce the resolved dependency directions owned by this module's header. */
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
				typescript: {
					project: ["tsconfig.json", "src/tsconfig.json"],
					alwaysTryTypes: true,
					noWarnOnMultipleProjects: true,
				},
			},
		},
	},
);
