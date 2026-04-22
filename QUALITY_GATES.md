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

- Format check: `bun run format:check`
- Format write: `bun run format`
- Typecheck: `bunx tsc -p tsconfig.json --noEmit`
- Build: `bun run build`
- All project tests: `bun run test:the-org`
- elizaOS test harness: `bun run test`
- Targeted tests:
  - Community manager: `bun run test:communityManager`
  - DevRel: `bun run test:devRel`
  - Liaison: `bun run test:liaison`
  - Project manager: `bun run test:projectManager`
  - Social media manager: `bun run test:socialMediaManager`
- Reasonable pre-merge suite: `bun run format:check && bunx tsc -p tsconfig.json --noEmit && bun run build && bun run test:the-org`

## Testing expectations

Suggested default expectations (see `TDD_RULES.md` for detailed requirements):

- Add tests for new behavior.
- Update tests for changed behavior.
- Do not rely only on manual verification when automated checks are practical.
- For high-risk fixes, add a test that fails before and passes after.
- For Telegram/Eli5 behavior, update or add coverage in `tests/eli5Telegram.test.ts` and `tests/test_suites/TelegramTestSuite.ts`.
- For team coordinator behavior, prefer focused tests near `src/projectManager/plugins/team-coordinator/` plus the project manager suite when behavior crosses the agent boundary.

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

## Current caveats

- `bun run lint` currently writes formatting via Prettier; use `bun run format:check` for a non-mutating check.
- The root rule docs are project-specific, while reusable templates/workflows still live under `rules/docs/` and `rules/prompts/`.
