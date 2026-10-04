import { defineConfig } from "vitest/config";

/** Run colocated application and tooling tests without a prior build. */
export default defineConfig({
	test: {
		include: ["src/**/*.test.ts", "scripts/**/*.test.mts"],
	},
});
