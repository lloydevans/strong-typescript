import { copyFileSync, mkdirSync, mkdtempDisposableSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { expect, test } from "vitest";
import { readWorkspacePackages } from "./workspace-packages.mts";

test("Vitest resolves package names to entries inside its own copied tree", async () => {
	const directory = mkdtempDisposableSync(join(tmpdir(), "workspace-resolution-"));
	const root = directory.path;
	const project = fileURLToPath(new URL("../../", import.meta.url));

	try {
		mkdirSync(join(root, "scripts/workspace"), { recursive: true });
		copyFileSync(join(project, "vitest.config.mts"), join(root, "vitest.config.mts"));
		copyFileSync(
			join(project, "scripts/workspace/workspace-packages.mts"),
			join(root, "scripts/workspace/workspace-packages.mts"),
		);
		writeFileSync(join(root, "package.json"), JSON.stringify({ workspaces: ["packages/*"] }));
		symlinkSync(join(project, "node_modules"), join(root, "node_modules"), "junction");

		for (const [folder, name] of [
			["greeter", "@example/greeter"],
			["second", "@fixture/a.b"],
		] as const) {
			const path = join(root, "packages", folder);
			mkdirSync(join(path, "src"), { recursive: true });
			writeFileSync(join(path, "package.json"), JSON.stringify({ name, exports: { ".": "./src/index.ts" } }));
			writeFileSync(join(path, "src/index.ts"), "export const value = 1;");
			writeFileSync(join(path, "src/value.ts"), "export const value = 2;");
		}

		const server = await createServer({
			root,
			configFile: join(root, "vitest.config.mts"),
			server: { watch: null },
			logLevel: "silent",
		});

		try {
			for (const pkg of readWorkspacePackages(root).packages) {
				const resolved = await server.pluginContainer.resolveId(pkg.name, join(root, "src/consumer.ts"));
				expect(resolved?.id.replaceAll("\\", "/")).toBe(pkg.entry.replaceAll("\\", "/"));
			}

			expect(await server.pluginContainer.resolveId("@fixture/aXb", join(root, "src/consumer.ts"))).toBeNull();
			expect(await server.pluginContainer.resolveId("@fixture/a.b/../value", join(root, "src/consumer.ts"))).toBeNull();
		} finally {
			await server.close();
		}
	} finally {
		directory.remove();
	}
}, 15000);

function fixture() {
	const directory = mkdtempDisposableSync(join(tmpdir(), "workspace-packages-"));
	const write = (path: string, value: unknown) => writeFileSync(join(directory.path, path), JSON.stringify(value));
	mkdirSync(join(directory.path, "packages/first"), { recursive: true });
	mkdirSync(join(directory.path, "packages/second"), { recursive: true });
	write("package.json", {
		workspaces: ["packages/*"],
		dependencies: { "@example/first": "*", external: "*" },
		devDependencies: { testing: "*" },
	});
	write("packages/first/package.json", {
		name: "@example/first",
		exports: { ".": "./src/index.ts" },
		dependencies: { "@example/second": "*", external: "*" },
		devDependencies: { extra: "*" },
	});
	write("packages/second/package.json", { name: "@example/second", exports: { ".": "./src/index.ts" } });

	return { directory, write };
}

test("discovers every package and exempts only declared third parties", () => {
	const { directory } = fixture();

	try {
		expect(readWorkspacePackages(directory.path)).toEqual({
			packages: ["first", "second"].map((name) => ({
				name: `@example/${name}`,
				directory: join(directory.path, "packages", name),
				entry: join(directory.path, "packages", name, "src/index.ts"),
				dependencies: name === "first" ? ["@example/second", "external", "extra"] : [],
			})),
			rootDependencies: ["@example/first", "external", "testing"],
			externalPackages: ["external", "testing", "extra"],
		});
	} finally {
		directory.remove();
	}
});

test.each(["./src/public.ts", "./..entry.ts"])("uses workspace patterns and manifest export %s", (entry) => {
	const { directory, write } = fixture();

	try {
		write("package.json", { workspaces: ["packages/second"] });
		write("packages/second/package.json", { name: "@example/renamed", exports: { ".": entry } });
		expect(readWorkspacePackages(directory.path)).toEqual({
			packages: [
				{
					name: "@example/renamed",
					directory: join(directory.path, "packages/second"),
					entry: join(directory.path, "packages/second", entry),
					dependencies: [],
				},
			],
			rootDependencies: [],
			externalPackages: [],
		});
	} finally {
		directory.remove();
	}
});

test.each([
	{ names: ["first", "second", "first"], field: "dependencies" },
	{ names: ["first", "second", "third", "first"], field: "dependencies" },
	{ names: ["first", "first"], field: "dependencies" },
	{ names: ["first", "second", "first"], field: "devDependencies" },
])("rejects a cycle $names through $field", ({ names, field }) => {
	const { directory, write } = fixture();

	try {
		names.slice(0, -1).forEach((name, index) => {
			mkdirSync(join(directory.path, "packages", name), { recursive: true });
			write(`packages/${name}/package.json`, {
				name: `@example/${name}`,
				exports: { ".": "./src/index.ts" },
				[field]: { [`@example/${String(names[index + 1])}`]: "*" },
			});
		});

		expect(() => readWorkspacePackages(directory.path)).toThrow(
			`Workspace dependency cycle: ${names.map((name) => `@example/${name}`).join(" -> ")}`,
		);
	} finally {
		directory.remove();
	}
});

test("accepts an acyclic graph with shared and external dependencies", () => {
	const { directory, write } = fixture();

	try {
		mkdirSync(join(directory.path, "packages/third"));
		write("packages/third/package.json", {
			name: "@example/third",
			exports: { ".": "./src/index.ts" },
			dependencies: { "@example/first": "*", "@example/second": "*", external: "*" },
		});
		expect(readWorkspacePackages(directory.path).packages.map((pkg) => pkg.name)).toEqual([
			"@example/first",
			"@example/second",
			"@example/third",
		]);
	} finally {
		directory.remove();
	}
});

test.each([
	{ name: "null manifest", path: "package.json", value: null, error: "Expected a manifest object" },
	{ name: "array manifest", path: "package.json", value: [], error: "Expected a manifest object" },
	{ name: "primitive manifest", path: "package.json", value: 1, error: "Expected a manifest object" },
	{ name: "missing patterns", path: "package.json", value: {}, error: "Expected workspace patterns" },
	{ name: "non-string pattern", path: "package.json", value: { workspaces: [1] }, error: "Expected workspace patterns" },
	{
		name: "missing name",
		path: "packages/first/package.json",
		value: { exports: { ".": "./src/index.ts" } },
		error: "Expected a package name",
	},
	{ name: "missing exports", path: "packages/first/package.json", value: { name: "first" }, error: "Expected a package name" },
	{
		name: "non-string entry",
		path: "packages/first/package.json",
		value: { name: "first", exports: { ".": {} } },
		error: "Expected a package name",
	},
	{
		name: "bare entry",
		path: "packages/first/package.json",
		value: { name: "first", exports: { ".": "src/index.ts" } },
		error: "Entry must stay inside",
	},
	{
		name: "escaping entry",
		path: "packages/first/package.json",
		value: { name: "first", exports: { ".": "./../outside.ts" } },
		error: "Entry must stay inside",
	},
	{
		name: "invalid dependency map",
		path: "package.json",
		value: { workspaces: [], dependencies: [] },
		error: "Expected a dependency map",
	},
])("rejects $name", ({ path, value, error }) => {
	const { directory, write } = fixture();

	try {
		write(path, value);
		expect(() => readWorkspacePackages(directory.path)).toThrow(error);
	} finally {
		directory.remove();
	}
});
