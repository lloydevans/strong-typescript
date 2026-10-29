import type { Stryker } from "@stryker-mutator/core";

/**
 * Configure mutation testing: https://stryker-mutator.io/docs/stryker-js/configuration/
 * Only the application's src/index.ts is excluded: it is the DOM bootstrap entry point.
 */
const config = {
	testRunner: "vitest",
	mutate: ["src/**/*.ts", "packages/*/src/**/*.ts", "!**/*.test.ts", "!src/index.ts"],
	thresholds: { high: 80, low: 60, break: 60 },
	reporters: ["clear-text", "progress", "html"],
} satisfies ConstructorParameters<typeof Stryker>[0];

export default config;
