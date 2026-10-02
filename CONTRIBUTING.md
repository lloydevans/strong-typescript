# Contributing

See [README.md](README.md) for requirements and commands.

## Types

- Favour strong typing. Model a value with the narrowest type that is true of it, keep an untrusted value `unknown` until it is checked, and reach for a type guard before a cast or a non-null assertion.
- Prefer an inferred type to a written one. Annotate where inference cannot reach, and leave the rest to the compiler.

## Code

- Use `.mts` wherever a repository-owned file would otherwise be `.mjs`, so the TypeScript configuration covers it.
- Prefer a built-in array method, such as `.map`, `.filter` or `.reduce`, to a hand-written loop wherever one expresses the transformation.
- Separate a function's logical blocks with a blank line, such as between checking input, computing a result and writing it out.
- Use `// prettier-ignore` above a statement only when its layout carries meaning, such as an array arranged in rows to show a 2D grid.

## Lint and formatting

- Before editing code by hand, use `npm run lint-fix` and `npm run format` wherever mechanical lint and formatting fixes apply. The gate only checks; it does not apply fixes.
- Fix a lint or type error at its cause. A disable comment is the exception and carries its reason on the same line.

## Comments and documentation

- A line comment belongs directly above the code it describes, inside that logical block. Preserve the separating blank line above the comment; the comment never takes its place.
- Document purpose, parameters, results and failures with JSDoc, without repeating TypeScript types.
- Inline callbacks need no JSDoc.
- Document an object's function members on its declared type, not on the implementation.
- Document a constructor parameter property once, in the constructor's `@param`.
- Tests need no JSDoc.
- Keep documents and comments true to the code in the same change. A contract lives in the code or configuration that owns it. Documents cite that owner and do not restate it.

## Testing

- Keep each test beside the code it covers.
- Every guard or fix needs a test that fails without it. Mutation testing checks this for the source it covers; where it does not reach, remove the guard or fix temporarily and confirm the test fails.
- A test should be able to fail because of a change to code in this repository. If only a change in a dependency could fail it, leave it out.
- Mutation testing can be slow, so it runs apart from the gate: on pull requests or on demand, as the project needs. Run `npm run mutation` locally at sensible intervals, such as after a series of commits for a pull request.

## Commits and pull requests

- Run `npm run verify-gate` before every commit. `package.json` owns the exact commands. Keep strict type checking and warnings-as-errors lint enabled.
- Commit messages use an imperative summary that stands on its own, without a `type:` prefix, and a short body only when needed. Keep each commit one coherent change.
- Do not commit build output, caches or editor files.
- Work on a branch named `<type>/<short-description>` and merge through a pull request, never by pushing to the default branch.
- A pull request description says what changed and why, and leaves the detail to the diff.
