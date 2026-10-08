import { globSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

/** A local package and the entry declared by its manifest. */
export interface WorkspacePackage {
	/** The import specifier owned by this package. */
	name: string;

	/** The absolute package directory. */
	directory: string;

	/** The absolute public entry inside the package. */
	entry: string;

	/** Names declared in dependencies or devDependencies. */
	dependencies: string[];
}

/** Local packages and the third-party names declared across the project. */
export interface WorkspaceLayout {
	/** Packages matched by the root manifest's workspace patterns. */
	packages: WorkspacePackage[];

	/** Dependency names declared by the application's root manifest. */
	rootDependencies: string[];

	/** Declared dependency names excluding local packages. */
	externalPackages: string[];
}

/**
 * Narrow a parsed manifest object without trusting JSON's inferred type.
 * @param value - A parsed JSON value.
 * @returns Whether the value is a record.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Read one manifest as an object.
 * @param path - The manifest to read.
 * @returns Its unvalidated fields.
 * @throws When the file cannot be read or is not a JSON object.
 */
function readManifest(path: string) {
	const value: unknown = JSON.parse(readFileSync(path, "utf8"));
	if (!isRecord(value)) {
		throw new Error(`Expected a manifest object: ${path}`);
	}

	return value;
}

/**
 * Read the names from an optional dependency map.
 * @param value - The dependencies or development dependencies field.
 * @returns Declared names, or no names for an absent field.
 * @throws When the supplied field is not an object.
 */
function dependencyNames(value: unknown) {
	if (value === undefined) {
		return [];
	}
	if (!isRecord(value)) {
		throw new Error("Expected a dependency map");
	}

	return Object.keys(value);
}

/**
 * Reject cycles in the declared graph of local packages.
 * @param packages - Packages and their declared dependencies.
 * @throws When a package depends on itself or a path returns to an earlier package.
 */
function checkCycles(packages: WorkspacePackage[]) {
	const byName = new Map(packages.map((pkg) => [pkg.name, pkg]));
	const complete = new Set<string>();
	const active: string[] = [];

	/**
	 * Visit each local dependency before completing a package.
	 * @param name - A local or external dependency name.
	 * @throws When the name is already on the active path.
	 */
	function visit(name: string) {
		const start = active.indexOf(name);
		if (start !== -1) {
			throw new Error(`Workspace dependency cycle: ${[...active.slice(start), name].join(" -> ")}`);
		}

		const pkg = byName.get(name);
		if (!pkg || complete.has(name)) {
			return;
		}

		active.push(name);
		pkg.dependencies.forEach(visit);
		active.pop();
		complete.add(name);
	}

	packages.forEach((pkg) => visit(pkg.name));
}

/**
 * Discover local packages and external dependencies from their owning manifests.
 * @param root - The directory containing the root package manifest.
 * @returns Local package entries and names exempt from local import boundaries.
 * @throws When manifests or entries are invalid, an entry leaves its package, or local dependencies form a cycle.
 */
export function readWorkspacePackages(root: string): WorkspaceLayout {
	const manifest = readManifest(join(root, "package.json"));
	const workspaces = manifest.workspaces;
	if (!Array.isArray(workspaces) || !workspaces.every((pattern): pattern is string => typeof pattern === "string")) {
		throw new Error("Expected workspace patterns");
	}

	const rootDependencies = [...dependencyNames(manifest.dependencies), ...dependencyNames(manifest.devDependencies)];
	const packages = globSync(
		workspaces.map((pattern) => `${pattern}/package.json`),
		{ cwd: root },
	)
		.sort()
		.map((path) => {
			const directory = resolve(root, dirname(path));
			const pkg = readManifest(join(directory, "package.json"));
			if (typeof pkg.name !== "string" || !isRecord(pkg.exports) || typeof pkg.exports["."] !== "string") {
				throw new Error(`Expected a package name and root export: ${path}`);
			}

			const entry = resolve(directory, pkg.exports["."]);
			const local = relative(directory, entry);
			if (!pkg.exports["."].startsWith("./") || local === ".." || local.startsWith(`..${sep}`) || isAbsolute(local)) {
				throw new Error(`Entry must stay inside its package: ${path}`);
			}

			const dependencies = [...dependencyNames(pkg.dependencies), ...dependencyNames(pkg.devDependencies)];

			return { name: pkg.name, directory, entry, dependencies };
		});
	checkCycles(packages);

	const names = new Set(packages.map((pkg) => pkg.name));
	const externalNames = [...rootDependencies, ...packages.flatMap((pkg) => pkg.dependencies)];

	return { packages, rootDependencies, externalPackages: [...new Set(externalNames)].filter((name) => !names.has(name)) };
}
