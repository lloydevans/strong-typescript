import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempDisposableSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, vi } from "vitest";
import { typecheck } from "./typecheck.mts";

vi.mock("node:child_process", async (importOriginal) => {
	const original = await importOriginal<typeof import("node:child_process")>();

	return { ...original, spawnSync: vi.fn(original.spawnSync) };
});

test("reports a compiler that exits without a status as a failure", () => {
	vi.mocked(spawnSync).mockReturnValueOnce({
		pid: 0,
		output: [],
		stdout: Buffer.alloc(0),
		stderr: Buffer.alloc(0),
		status: null,
		signal: "SIGTERM",
	});
	expect(typecheck(fileURLToPath(new URL("../../", import.meta.url)))).toBe(1);
});

test("checks application, tooling and every package and returns compiler failures", () => {
	const directory = mkdtempDisposableSync(join(tmpdir(), "typecheck-"));
	const root = directory.path;
	const write = (path: string, value: unknown) => writeFileSync(join(root, path), JSON.stringify(value));

	try {
		write("package.json", { workspaces: ["packages/*"] });

		for (const folder of ["src", "scripts/workspace", "packages/first", "packages/second"]) {
			mkdirSync(join(root, folder), { recursive: true });
			writeFileSync(join(root, folder, "value.ts"), "export const value: number = 1;\n");
		}

		const options = { strict: true, skipLibCheck: true, types: [], target: "ES2022" };
		write("tsconfig.json", { compilerOptions: options, files: ["scripts/workspace/value.ts"] });
		write("src/tsconfig.json", { compilerOptions: options, files: ["value.ts"] });

		for (const name of ["first", "second"]) {
			write(`packages/${name}/package.json`, { name, exports: { ".": "./value.ts" } });
			write(`packages/${name}/tsconfig.json`, { compilerOptions: options, files: ["value.ts"] });
		}

		const project = fileURLToPath(new URL("../../", import.meta.url));
		for (const name of ["typecheck.mts", "workspace-packages.mts"]) {
			copyFileSync(join(project, "scripts/workspace", name), join(root, "scripts/workspace", name));
		}
		symlinkSync(join(project, "node_modules"), join(root, "node_modules"), "junction");

		expect(typecheck(root)).toBe(0);

		for (const folder of ["src", "scripts/workspace", "packages/first", "packages/second"]) {
			writeFileSync(join(root, folder, "value.ts"), 'export const value: number = "wrong";\n');
			expect(typecheck(root), folder).not.toBe(0);
			writeFileSync(join(root, folder, "value.ts"), "export const value: number = 1;\n");
		}

		expect(typecheck(root)).toBe(0);

		writeFileSync(join(root, "packages/second/value.ts"), 'export const value: number = "wrong";\n');
		const failed = spawnSync(process.execPath, [join(root, "scripts/workspace/typecheck.mts")], { encoding: "utf8" });
		expect(failed.status).not.toBe(0);
		expect(failed.stdout).toContain("TS2322");

		writeFileSync(join(root, "packages/second/value.ts"), "export const value: number = 1;\n");
		const passed = spawnSync(process.execPath, [join(root, "scripts/workspace/typecheck.mts")], { encoding: "utf8" });
		expect(passed.status).toBe(0);
	} finally {
		directory.remove();
	}
}, 30000);
