## Project

Metadata Visualizer — a DHIS2 web app (React 18 + TypeScript + Vite) that visualizes metadata
relationships as interactive 3D graphs. The DHIS2 instance is the backend; there is no custom
server. See `openspec/config.yaml` for the full project context the AI uses.

## Git Workflow

- Default branch for new work: `master` (this repo's main branch).
- Branch from another feature branch only when there is a dependency on unmerged work.
  Merge back to the same branch you started from.
- Branch naming:
  - `feature/<human-readable-name>` for new features
  - `fix/<human-readable-name>` for bug fixes
  - `chore/<human-readable-name>` for maintenance
  - `refactor/<human-readable-name>` for restructuring without behavior change
- All commits use Conventional Commits:
  - `feat(scope): description` for new features
  - `fix(scope): description` for bug fixes
  - `refactor(scope): description` for restructuring
  - `test(scope): description` for test changes
  - `docs(scope): description` for documentation
  - `chore(scope): description` for maintenance
- Never commit as "Claude" — use the project's git user config.
- Never bypass the Husky `pre-push` hook (`prettify + lint + update-po + test`).
  If it fails, fix the underlying issue — do not pass `--no-verify`.


## Pull Requests

- Every PR description must include a link to the related issue(s) in the project tracker.
- Format:
```
  ## Related Tasks
  - [Task name](<issue-tracker-url>/<task-id>)
```
- If the PR covers a parent issue with subtasks, link the parent issue.
- If the PR covers multiple standalone issues, link all of them.
- Include the DHIS2 version(s) the change was verified against when the change touches
  DHIS2 API calls or metadata queries.

## Boy Scout Rule

Leave every file you touch cleaner than you found it. When working on a task, if you encounter code in the files you are already modifying that violates the conventions in this document (imperative loops that should be functional, tests with weak assertions, missing `describe` groups, mutable state that should be immutable, etc.), fix it as part of the same change. Keep the scope reasonable — refactor what you touch, don't go hunting across the entire codebase. Over time, this ensures the codebase converges to the agreed standards incrementally.

## Architecture

This project follows **Clean Architecture** with strict layered dependency rules. The DHIS2
instance is the only external system — there is no custom backend.

```
domain/         entities, repository interfaces (pure TS, no framework, no I/O)
   ^
   | depends on
   |
application/    use cases orchestrating domain via repository interfaces
   ^
   | depends on
   |
data/           concrete repository implementations (DHIS2 adapters via @eyeseetea/d2-api)
   ^
   | wired via CompositionRoot
   |
webapp/         React components, pages, contexts (presentation + wiring only)
```

### Hard Rules

- **Dependency Rule**: outer layers depend on inner layers, never the reverse.
  `domain/` has zero dependencies on React, DHIS2, `@eyeseetea/d2-api`, `fetch`, or any I/O.
- **Repository pattern**: all DHIS2 API access goes through repository interfaces defined in
  `src/domain/repositories/` with concrete implementations in `src/data/repositories/` that
  use `@eyeseetea/d2-api`.
- **Presentation is wiring only.** React components parse props/state, call use cases via
  `CompositionRoot`, and render. No business logic, no direct API calls, no `fetch`.
- **CompositionRoot is the single DI point.** `src/CompositionRoot.ts` wires repositories and
  use cases. Components receive use cases via context / props, never by instantiating
  repositories themselves.
- **No duplicated logic across components.** If two components share identical behavior,
  extract it into a shared utility or hook immediately — not in a follow-up.
- **Imports use the `$/` alias.** No relative imports that cross layer boundaries
  (enforced by `eslint-plugin-no-relative-import-paths`).
- **Use cases return purify-ts `Either` / `Future`.** Prefer them over throwing for
  domain-level failures; reserve exceptions for truly unrecoverable programmer errors.
- **i18n**: all user-facing strings go through `i18n.t("...")` from `@dhis2/d2-i18n`.
  After adding strings, run `yarn extract-pot` and `yarn localize`.

## Code Style

### Functional Programming and Immutability

Prefer declarative, functional patterns over imperative loops with mutable state:

- Use `array.flatMap(...)` instead of `for...of` + `results.push(...)` with a mutable accumulator.
- Use `array.find(...)` instead of `for...of` loops that search and break.
- Use `Array.from(...).reduce(...)` instead of `for` loops with manual index tracking and mutable variables.
- Avoid mutating function arguments or shared state in place — return new objects/arrays instead.
- When a loop body is a pure transformation, express it as `map`/`flatMap`/`filter`/`reduce`.
- Apply immutability comprehensively at the file level, not just per-function. Use `Readonly<T>` for data structures that should not be mutated after creation.
- Prefer composition over inheritance when structuring modules and behavior. Build functionality by composing small, focused functions rather than deep class hierarchies.
- Prefer purify-ts `Either` / `Maybe` / `Future` over throwing for domain error handling.

### TypeScript

- **Derive union types from const arrays.** When a union type also needs runtime values (e.g., for iteration or validation), define a `const` array first and derive the type from it. Never use unsafe `as Type[]` casts.
  ```ts
  // Good
  const statuses = ["pending", "active", "done"] as const;
  type Status = (typeof statuses)[number];

  // Bad
  type Status = "pending" | "active" | "done";
  const statuses = ["pending", "active", "done"] as Status[];
  ```
- No `any`. Prefer `unknown` at boundaries and narrow with type guards.
- Unused variables are allowed only if prefixed with `_`.
- No `console.log` — use `console.debug` / `console.warn` / `console.error` (enforced by ESLint).

### React

- Functional components only. Hooks at the top of the component body, no conditional hooks.
- Side effects go in `useEffect` / custom hooks — never inline in render.
- Data fetching goes through use cases returning `Future` / `Either`, invoked from hooks;
  components do not call `@eyeseetea/d2-api` or `fetch` directly.
- Cancellation: use `real-cancellable-promise` / the `Future` cancellation contract when a
  component unmounts mid-request.

### Test Quality

Write tests that validate behavior precisely and are easy to maintain:

- **Assert concrete values.** Never write `expect(result).toBeDefined()` or `expect(value).toBeTruthy()` when you can assert the exact expected value (e.g., `expect(result).toEqual({ startLine: 2, endLine: 5 })`).
- **Group with `describe`.** Organize related tests under `describe` blocks by feature or scenario.
- **Use helpers to reduce repetition.** Extract common setup into helper functions so each test only specifies what varies.
- **Extract constants for repeated strings.** Class names, paths, error messages, and other repeated literals should be constants, not duplicated strings.
- **Remove redundant tests.** If a behavior is already covered by another test, don't add a weaker test that only checks a subset. Either make it a distinct contract test with a comment explaining why, or remove it.
- **Testing-Library queries**: prefer accessible queries (`getByRole`, `getByLabelText`,
  `getByText`). `await` async queries. Use `screen.*` entry points.

## CI / Automated Checks

- CI lives in `.github/workflows/main.yml` (EyeSeeTea shared workflows + Syft SBOM).
- Do not restrict the `pull_request` trigger to specific branches — leave it unrestricted so all
  PRs get checked regardless of branch naming. Keep `push` triggers limited to `master` and
  `development`.
- Every PR should get automated feedback (lint, type-check, tests) before merge.
- The Husky `pre-push` hook runs `yarn prettify && yarn lint && yarn update-po && yarn test`.
  Always let it run; fix failures at the source.

## UI Design Workflow

This project has UI, so the design gate applies. When a feature includes user-facing UI
(pages, forms, visualization controls, dialogs):

1. **Design before implementation.** Wireframes/mockups must be created in Pencil (`.pen` files
   via MCP tools) and approved before any `[FE]` or `[GD]` implementation tasks begin.
2. **Design artifacts** live in `openspec/designs/`:
   - `.pen` files in `openspec/designs/wireframes/` or `openspec/designs/mockups/`
   - PNG exports in `openspec/designs/exports/` (naming: `[feature]-[screen]-[state].png`)
3. **Respect the existing design system.** The app uses Material-UI v4 + styled-components
   + `@dhis2/ui`. Reuse existing components and tokens — do not introduce a new styling library.
4. **Design is part of the proposal.** The change's `design.md` must reference the
   wireframes/exports. Approval of the proposal implicitly approves the design.
5. **Design tasks** are tagged `[GD]` in `tasks.md` and must be completed before `[FE]` tasks
   that depend on them.
6. **Always commit the `.pen` source file.** The `.pen` file is the source of truth — PNG
   exports are derived artifacts.
7. **Designs are part of the feature commit, not an afterthought.** When implementing a UI
   feature, the Pencil design and its PNG exports must be created and committed as part of the
   same body of work.

## After Every Feature Change

After implementing any feature addition, modification, or bug fix, always update **all** of the following before considering the work done:

1. **README.md** — Update command docs, examples, and feature list if the change affects user-facing behavior.
2. **PR description** — Check for an open PR on the current branch (`gh pr view`). If one exists, update its summary and test plan to reflect the latest changes (`gh pr edit`).
3. **OpenSpec specs** — If the change relates to an existing spec in `openspec/specs/`, update the relevant requirements and scenarios. Also update the archived copy in `openspec/changes/archive/` if it exists.
4. **UI designs** — If the change adds or modifies UI components, create or update the `.pen` files in Pencil and re-export PNGs.
5. **Translations** — If user-facing strings changed, run `yarn extract-pot` and `yarn localize`
   and commit the updated `i18n/*.pot` / `i18n/*.po` files.
6. **Local checks** — Run `yarn check-code` (lint + test) and `yarn tsc --noEmit` before
   opening or updating the PR.

This checklist applies to every code change, not just the initial implementation.

## Pre-Commit Self-Review

Before every commit, verify the following against the changed files. Do not commit until all items pass:

1. **Architecture** — Does the code respect the dependency rule? Is there any direct DHIS2 /
   `fetch` / `d2-api` call bypassing `domain/repositories/` → `data/repositories/`?
2. **Layer correctness** — Is each new file in the right layer (`domain` / `application` /
   `data` / `webapp`)? Is the `domain/` layer still free of React, DHIS2, and I/O imports?
3. **Patterns** — Does new code follow the same patterns as existing sibling files in the same
   layer? (Check at least one existing sibling file for reference.)
4. **Imports** — Are all cross-module imports using the `$/` alias? No
   `../../domain/...`-style relative imports across layers.
5. **Functional style** — Are there any `for` loops with mutable accumulators that should be
   `map` / `flatMap` / `filter` / `reduce` / `Object.fromEntries`?
6. **Error handling** — Do use cases use `Either` / `Future` rather than throwing for
   expected failure modes?
7. **Test assertions** — Are all assertions concrete values (`toEqual`, `toBe`)? No
   `toBeDefined`, `toBeTruthy`, `toHaveProperty` when an exact value is knowable?
8. **No duplication** — Is any logic copy-pasted between files? Extract it into a helper,
   hook, or use case.
9. **Separation of concerns** — Is business logic properly separated from presentation /
   wiring? Are components free of data-fetching and domain logic?
10. **Immutability** — Are new data structures using `Readonly<T>` / `ReadonlyArray<T>` where
    appropriate?
11. **i18n** — Are all new user-facing strings wrapped in `i18n.t(...)`?
12. **Boy Scout Rule** — In the files you touched, are there pre-existing violations of these
    rules? Fix them.
