# TypeScript template

A template for TypeScript projects: strict TypeScript, ESLint and Prettier, unit and mutation testing, and CI out of the box. Vite supplies bundling, CSS support, and a dev server with HMR, but it is a thin, interchangeable layer - the TypeScript tooling is the substance of the template.

See [CONTRIBUTING.md](CONTRIBUTING.md) for contributor conventions.

## Requirements

- Node.js >= 24 (current LTS)

## Usage

| Command                | Description                                            |
| ---------------------- | ------------------------------------------------------ |
| `npm start`            | Dev server with hot reload (localhost:5173 by default) |
| `npm run build`        | Minified production build to `dist/`                   |
| `npm run preview`      | Serve the built site (localhost:4173 by default)       |
| `npm run typecheck`    | Type-check browser source and tooling without emitting |
| `npm run lint`         | Lint with ESLint (warnings fail)                       |
| `npm run lint-fix`     | Apply ESLint's automatic fixes                         |
| `npm run format`       | Format the repo with Prettier                          |
| `npm run format-check` | Check formatting without writing                       |
| `npm test`             | Run unit tests once                                    |
| `npm run mutation`     | Mutation testing with Stryker                          |
| `npm run verify-gate`  | Run the full CI gate locally                           |
| `npm run test-watch`   | Run unit tests in watch mode                           |

## Notes

- [index.html](index.html) is the entry page. Vite uses its defaults without a configuration file, including its browser target and no production source maps.
- Vite transpiles TypeScript without type-checking. Run `npm run typecheck` to check types; `npm run verify-gate` includes it before the tests and build.
- TypeScript is pinned to the 6.x line.
