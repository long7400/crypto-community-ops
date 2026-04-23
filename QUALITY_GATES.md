# Quality Gates

This file defines the minimum bar before a task is considered ready for review or merge.

Adjust the commands and thresholds to match your stack.

## Default gate

Every non-trivial change should satisfy all relevant items below:

1. The code path changed is covered by tests.
2. Relevant lint, typecheck, and test commands pass.
3. Boundary parsing or validation rules remain explicit.
4. Logging, errors, and observable behavior are good enough to debug failures.
5. Durable docs are updated if the task introduced a new rule or decision.

## Required commands

Package manager is **bun**. All commands run from repo root.

- Format check: `bun run format:check`
- Format (write): `bun run format`
- Lint (ESLint): `bunx eslint src`
- Typecheck: `bunx tsc --noEmit`
- Unit tests (all agents): `bun run test:the-org`
- Unit tests (single agent): `bun run test:<agentName>` (e.g. `test:communityManager`, `test:devRel`, `test:liaison`, `test:projectManager`, `test:socialMediaManager`)
- Single test file: `bunx vitest tests/<file>.test.ts`
- elizaOS integration tests: `bun run test` (alias for `elizaos test`)
- Build: `bun run build` (tsup)

Full pre-merge suite (must all pass):

```bash
bun run format:check && bunx tsc --noEmit && bun run test:the-org && bun run build
```

For changes that touch platform adapters (Discord/Telegram) or the elizaOS runtime, also run `bun run test` to exercise the integration layer.

## Testing expectations

Suggested default expectations (see `TDD_RULES.md` for detailed requirements):

- Add tests for new behavior.
- Update tests for changed behavior.
- Do not rely only on manual verification when automated checks are practical.
- For high-risk fixes, add a test that fails before and passes after.

## Review expectations

Before merge, the reviewer should be able to answer:

- Is the behavior change clear?
- Are the important risks covered by tests or explicit notes?
- Does the change respect `ARCHITECTURE.md`?
- Does the change preserve `PRODUCT_SENSE.md`?
- Are follow-ups captured rather than silently deferred?

## Escalate instead of guessing

Do not self-approve changes that affect:

- security boundaries
- destructive data behavior
- public contracts
- operational policies

Those require a human decision even if the code is otherwise ready.
