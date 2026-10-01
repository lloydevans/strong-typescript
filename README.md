# TypeScript template

A template for TypeScript projects: strict TypeScript, ESLint and Prettier at their strictest, unit and mutation testing, and CI out of the box. Webpack supplies bundling, CSS support, and a dev server with HMR, but it is a thin, interchangeable layer - the TypeScript tooling is the substance of the template.

## Requirements

- Node.js >= 24 (current LTS)

## Usage

| Command                  | Description                                 |
| ------------------------ | ------------------------------------------- |
| `npm start`              | Dev server with hot reload (localhost:8080) |
| `npm run serve-prod`     | Dev server with production build            |
| `npm run build`          | Development build to `build/`               |
| `npm run build-prod`     | Minified production build to `build/`       |
| `npm run typecheck`      | Type-check without emitting                 |
| `npm run lint`           | Lint with ESLint (warnings fail)            |
| `npm run format`         | Format the repo with Prettier               |
| `npm run format-check`   | Check formatting without writing            |
| `npm test`               | Run unit tests once                         |
| `npm run mutation`       | Mutation testing with Stryker               |
| `npm run mutation-bench` | Stryker performance benchmark (see below)   |
| `npm run verify-gate`    | Run the full CI gate locally                |
| `npm run test-watch`     | Run unit tests in watch mode                |

## Benchmarks

`benchmarks/` holds on-demand automated benchmark workloads, one per subfolder. Their tests and mutants are excluded from the default test and mutation runs, so the CI gate lints, formats, and type-checks this code but never executes it; run the workloads manually via the Benchmarks workflow (workflow_dispatch) or locally.

| Benchmark              | Command                  | Description                                                                                                                                              |
| ---------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `benchmarks/mutation/` | `npm run mutation-bench` | Fixed Stryker workload (about 45 utility functions, 320 mutants, expected score 100%) for measuring mutation testing performance on a machine or runner. |

## Notes

- The bundler is contained in [webpack.config.mjs](webpack.config.mjs), the build scripts, and a handful of devDependencies; swapping it for another bundler leaves the TypeScript, lint, format, test, and CI setup untouched.
- Targets ES2022; adjust `target` in [tsconfig.json](tsconfig.json) if you need to support older browsers.
- TypeScript is pinned to the 6.x line because ts-loader depends on the TypeScript programmatic API, which the native TypeScript 7 compiler does not expose yet (expected in 7.1).
