import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempDisposableSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, expect, test } from "vitest";
import { configDefaults } from "vitest/config";
import { createVitest, type Vitest } from "vitest/node";
import manifest from "../../package.json" with { type: "json" };

const project = fileURLToPath(new URL("../../", import.meta.url));
const directory = mkdtempDisposableSync(join(tmpdir(), "test-selection-"));
const root = directory.path;
const testFiles = [
	"packages/example/src/value.test.ts",
	"scripts/tools/tool.test.mts",
	"src/first.test.ts",
	"src/second.test.ts",
];
let runner: Vitest;

function write(path: string, content: string) {
	mkdirSync(dirname(join(root, path)), { recursive: true });
	writeFileSync(join(root, path), content);
}

beforeAll(async () => {
	for (const path of ["vitest.config.mts", "scripts/workspace/workspace-packages.mts"]) {
		mkdirSync(dirname(join(root, path)), { recursive: true });
		copyFileSync(join(project, path), join(root, path));
	}
	symlinkSync(join(project, "node_modules"), join(root, "node_modules"), "junction");
	write("package.json", JSON.stringify({ workspaces: ["packages/*"] }));
	write("packages/example/package.json", JSON.stringify({ name: "@fixture/example", exports: { ".": "./src/index.ts" } }));
	write("packages/example/src/index.ts", "export const value = 1;");
	write("src/value.ts", "export const value = 1;");
	write("scripts/tools/tool.mts", "export const value = 1;");
	write("README.md", "Unrelated documentation.");

	const imports = ["./index.ts", "./tool.mts", "./value.ts", "@fixture/example"];
	testFiles.forEach((path, index) =>
		write(
			path,
			`import { test, expect } from "vitest";
import { appendFileSync } from "node:fs";
import { value } from ${JSON.stringify(imports[index])};
test("uses its dependency", () => {
	expect(value).toBe(1);
	appendFileSync("executed.log", ${JSON.stringify(`${path}\n`)});
});`,
		),
	);

	runner = await createVitest("test", { root, watch: false }, { server: { watch: null } });
}, 15000);

afterAll(async () => {
	try {
		await runner.close();
	} finally {
		directory.remove();
	}
});

test("retains the default full-run triggers", () =>
	expect(runner.config.forceRerunTriggers).toEqual(expect.arrayContaining(configDefaults.forceRerunTriggers)));

test.each([
	"package-lock.json",
	"eslint.config.mts",
	"vitest.config.mts",
	"vite.config.ts",
	"tsconfig.base.json",
	"src/tsconfig.json",
	"packages/example/tsconfig.json",
	"scripts/tools/tool.mts",
	"scripts/workspace/workspace-packages.mts",
])("selects every test when %s changes", async (path) => {
	runner.config.related = [join(root, path).replaceAll("\\", "/")];
	const selected = await runner.getRelevantTestSpecifications();

	expect(selected.map((spec) => relative(root, spec.moduleId).replaceAll("\\", "/")).sort()).toEqual(testFiles);
});

test.each([
	{ path: "src/value.ts", expected: ["src/first.test.ts"] },
	{ path: "packages/example/src/index.ts", expected: ["packages/example/src/value.test.ts", "src/second.test.ts"] },
	{ path: "scripts/tools/tool.test.mts", expected: ["scripts/tools/tool.test.mts"] },
	{ path: "README.md", expected: [] },
])("selects only dependants of $path", async ({ path, expected }) => {
	runner.config.related = [join(root, path).replaceAll("\\", "/")];
	const selected = await runner.getRelevantTestSpecifications();

	expect(selected.map((spec) => relative(root, spec.moduleId).replaceAll("\\", "/")).sort()).toEqual(expected);
});

function runScript(name: string, args: string[] = []) {
	return spawnSync(`npm run ${name} -- ${args.join(" ")}`, {
		cwd: root,
		shell: true,
		encoding: "utf8",
		timeout: 30000,
	});
}

function readLines(path: string) {
	return readFileSync(join(root, path), "utf8").trim().split("\n").filter(Boolean);
}

test("refuses an unresolved changed reference before starting tests", () => {
	const missing = "refs/heads/missing-test-selection-reference";
	const script = manifest.scripts["test-changed"].replaceAll("origin/HEAD", missing);
	write("test-sentinel.mts", 'console.log("TESTS_STARTED");');
	write("package.json", JSON.stringify({ scripts: { "test-changed": script, test: "node test-sentinel.mts" } }));
	expect(runScript("test").stdout).toContain("TESTS_STARTED");

	const gitDirectory = spawnSync("git", ["rev-parse", "--absolute-git-dir"], { cwd: project, encoding: "utf8" });
	expect(gitDirectory.status, gitDirectory.stderr).toBe(0);
	const result = spawnSync("npm run test-changed", {
		cwd: root,
		shell: true,
		encoding: "utf8",
		timeout: 15000,
		env: { ...process.env, GIT_DIR: gitDirectory.stdout.trim(), GIT_WORK_TREE: project },
	});

	expect(result.error).toBeUndefined();
	expect(result.status).not.toBe(0);
	expect(result.stderr).toContain(missing);
	expect(result.stdout).not.toContain("TESTS_STARTED");
}, 30000);

test("keeps the gate stages in order and forwards arguments only to tests, covering each file once across shards", () => {
	// Record the npm stage boundaries. Execute the real test script in a small fixture.
	write(
		"record.mts",
		`import { appendFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const args = process.argv.slice(2);
appendFileSync("stages.log", args.join(" ") + "\\n");
if (args[0] === "test") {
	const result = spawnSync("npm " + args.join(" "), { shell: true, stdio: "inherit" });
	process.exitCode = result.status ?? 1;
}`,
	);
	write(
		"package.json",
		JSON.stringify({
			workspaces: ["packages/*"],
			scripts: {
				"verify-gate": manifest.scripts["verify-gate"].replaceAll("npm ", "node record.mts "),
				test: manifest.scripts.test,
			},
		}),
	);
	const stages = ["audit --audit-level=critical", "run lint", "run format-check", "run typecheck", "run build"];
	const run = (args: string[]) => {
		write("stages.log", "");
		write("executed.log", "");
		const result = runScript("verify-gate", args);
		expect(result.error).toBeUndefined();
		expect(result.status, result.stdout + result.stderr).toBe(0);
		expect(
			readLines("stages.log").map((line) =>
				line
					.split(" ")
					.filter((arg) => arg !== "--")
					.join(" "),
			),
		).toEqual([...stages, ["test", ...args].join(" ")]);

		return readLines("executed.log").sort();
	};

	expect(run([])).toEqual(testFiles);
	const shards = [1, 2, 3].map((index) => run([`--shard=${index}/3`]));
	expect(shards.every((files) => files.length > 0 && files.length < testFiles.length)).toBe(true);
	expect(shards.flat().sort()).toEqual(testFiles);
}, 60000);
