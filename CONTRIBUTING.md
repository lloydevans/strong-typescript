# Contributing

See [README.md](README.md) for requirements and commands.

## Types

- Favour strong typing. Model a value with the narrowest type that is true of it, keep an untrusted value `unknown` until it is checked, and reach for a type guard before a cast or a non-null assertion.
- Prefer an inferred type to a written one. Annotate where inference cannot reach, and leave the rest to the compiler.
- Write a type inline where it suits, such as a small shape that only one function takes or returns, and leave a return type inferred while its callers only use the value. Name a type when other code needs it, such as another function that takes or returns the same shape, or a consumer may want it. Spell a named type out as a documented interface, and have the function that produces it declare it, rather than aliasing what the function is inferred to return. Code then imports the name instead of deriving it with a utility such as `Parameters`, `ReturnType` or an indexed access type.
- Prefer an existing type name to an indexed access. Where no separate name exists, an implementation or test double may use the declared function signature of the member it supplies, such as `vi.fn<Client["call"]>()`. A type-level test may likewise reference the declared member whose type it checks. These uses do not replace naming a nested data shape when another function needs that shape. Where code across a boundary owns the shape, whether an internal module or a third-party package, use its type. For a third-party contract, use an exported type name where available; otherwise derive the needed type from its public declaration. Deriving is fine for a type inferred from a schema, a set's type from its `as const` object, and a lookup by a type parameter such as `Args[K]`.
- Use only erasable TypeScript syntax, as `erasableSyntaxOnly` enforces.

## Code

- Give every fact one home, in code, comments or documents, and refer to it from elsewhere. A copy has to be maintained and goes stale.
- Avoid repeating code, within reason. Consider extracting anything likely to be duplicated.
- Use `.mts` wherever a repository-owned file would otherwise be `.mjs`, so the TypeScript configuration covers it.
- Prefer a built-in array method, such as `.map`, `.filter` or `.reduce`, to a hand-written loop wherever one expresses the transformation.
- Separate a function's logical blocks with a blank line, such as between checking input, computing a result and writing it out.
- Use `// prettier-ignore` above a statement only when its layout carries meaning, such as an array arranged in rows to show a 2D grid.

## Lint and formatting

- Before editing code by hand, use `npm run lint-fix` and `npm run format` wherever mechanical lint and formatting fixes apply. The gate only checks; it does not apply fixes.
- Fix a lint or type error at its cause. A disable comment is the exception and carries its reason on the same line.

## Comments and documentation

- Keep comments brief and do not over-explain.
- A line comment belongs directly above the code it describes, inside that logical block. Preserve the separating blank line above the comment; the comment never takes its place.
- Document purpose, parameters, results and failures with JSDoc, without repeating TypeScript types.
- Inline callbacks need no JSDoc.
- A function assigned to a local variable needs no JSDoc, as an inline callback needs none. Where a returned function's contract is a documented function type, assign the function to a variable typed with it and return the variable, rather than repeating the type's docs; keep anything specific to the implementation in a plain line comment.
- Write a module-level function, exported or not, as a `function` declaration, not as a constant holding an arrow or function expression. Keep arrows for callbacks and local closures.
- Document an object's function members on its declared type, not on the implementation.
- Tests need no JSDoc.
- Keep documents and comments true to the code in the same change.

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
