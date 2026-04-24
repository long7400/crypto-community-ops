# Quality Gates

This file defines the minimum bar before a task is considered ready for review or merge.

Use the smallest command that gives useful signal for the touched area, then broaden when risk or scope grows.

## Default gate

Every non-trivial change should satisfy all relevant items below:

1. The code path changed is covered by tests.
2. Relevant format, typecheck, and test commands pass. There is no dedicated ESLint script at the moment.
3. Boundary parsing or validation rules remain explicit.
4. Logging, errors, and observable behavior are good enough to debug failures.
5. Durable docs are updated if the task introduced a new rule or decision.

## Required commands

- Format check: `bun run format:check`
- Format write: `bun run format`
- Typecheck source and tests: `bunx tsc --noEmit -p tests/tsconfig.json`
- Targeted unit/regression test: `bunx vitest tests/<file>.test.ts`
- Agent suite scripts: `bun run test:communityManager`, `bun run test:devRel`, `bun run test:liaison`, `bun run test:projectManager`, `bun run test:socialMediaManager`
- Core project suite: `bun run test:the-org`
- elizaOS integration-style command: `bun run test`
- Build package: `bun run build`
- Suggested full pre-merge suite: `bun run format:check && bunx tsc --noEmit -p tests/tsconfig.json && bun run test:the-org && bun run build`
- Docs-only sanity check: `git diff --check`

## Testing expectations

Suggested default expectations (see `TDD_RULES.md` for detailed requirements):

- Add tests for new behavior.
- Update tests for changed behavior.
- Do not rely only on manual verification when automated checks are practical.
- For high-risk fixes, add a test that fails before and passes after.
- For moderation changes, cover allowed chats, admin authority, dry-run behavior, violation state, and audit records.
- For platform event changes, cover missing/partial Discord or Telegram payloads with runtime mocks.
- For docs-only changes, no behavior test is required, but run `git diff --check` and inspect the rendered Markdown mentally for broken structure.

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
