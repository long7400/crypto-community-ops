# AGENTS.md

This file is the entrypoint for coding agents working in `crypto-community-ops`.

It is intentionally short. Treat it as a map to the repository's source of truth, not the source of truth itself.

## Operating model

- Humans steer scope, priorities, and risk.
- Codex executes research, implementation, testing, and documentation updates.
- If a task is ambiguous, clarify through repository docs first, then ask the human only if risk remains.
- If a task is cross-cutting, long-running, or risky, create or update an execution plan before implementing.
- When spawning a new Agent from this repo context, always set `fork_context = false`.

## Read order

For every non-trivial task, read these in order:

1. `README.md`
2. `ARCHITECTURE.md`
3. `PRODUCT_SENSE.md`
4. `QUALITY_GATES.md`
5. `TDD_RULES.md`
6. `SECURITY.md`
7. `PLANS.md` when the task may need or update an execution plan
8. Relevant docs under `docs/`

If there is an active brief or plan for the task, read that before editing code or docs.

## When a plan is required

Create or update an execution plan when work involves any of the following:

- more than one subsystem
- a new feature with unknown implementation details
- schema or API contract changes
- refactors that touch many files
- migrations, reliability work, or security-sensitive changes
- anything expected to take more than one focused coding session

The plan format and rules live in `PLANS.md`.

## Human approval gates

Pause and ask for human approval before making changes to:

- auth, permissions, secrets, or security boundaries
- production infra, deployment, or CI policy
- data migrations that are destructive or hard to reverse
- public interfaces or external contracts
- architecture changes that conflict with `ARCHITECTURE.md`
- product behavior that conflicts with `PRODUCT_SENSE.md`

## Repo knowledge rules

- Durable decisions belong in versioned docs, not only in chat.
- If you discover a missing rule that shaped the implementation, update the relevant doc before finishing.
- Prefer modifying an existing source-of-truth doc over creating a duplicate explanation.
- Keep docs aligned with observed code behavior.

## Code and validation rules

- Respect the boundaries described in `ARCHITECTURE.md`.
- Parse and normalize data at boundaries instead of spreading ad-hoc validation through the codebase.
- Prefer explicit types, names, and small well-scoped files over generic catch-all helpers.
- Run the smallest high-signal checks first, then broader checks when warranted.
- Do not claim completion without listing the checks you actually ran.

## Task completion checklist

Before finishing a task:

1. Update code.
2. Update or create tests.
3. Update relevant docs or plans.
4. Run relevant validation commands.
5. Note remaining risks, follow-ups, or approval needs.

For docs-only tasks, steps 1 and 2 become: update the relevant docs, then run docs sanity checks. Do not invent behavior tests for documentation-only edits.

## Project commands

Use Bun for dependency installation because the repo has `bun.lock`.

- Install deps: `bun install`
- Start dev environment: `bun run dev`
- Start runtime: `bun run start`
- Build package: `bun run build`
- Run targeted Vitest test: `bunx vitest tests/<file>.test.ts`
- Run agent suite scripts: `bun run test:communityManager`, `bun run test:devRel`, `bun run test:liaison`, `bun run test:projectManager`, `bun run test:socialMediaManager`
- Run core project suite: `bun run test:the-org`
- Run elizaOS test command: `bun run test`
- Check formatting: `bun run format:check`
- Format source files: `bun run format`
- Typecheck source and tests: `bunx tsc --noEmit -p tests/tsconfig.json`
- Suggested full pre-merge check: `bun run format:check && bunx tsc --noEmit -p tests/tsconfig.json && bun run test:the-org && bun run build`

## Directory map

- `src/index.ts`: elizaOS project entrypoint and agent availability filtering
- `src/init.ts`: shared onboarding/world/room setup for Discord and Telegram
- `src/communityManager/`: Eli5 community manager, greetings, actions, and moderation
- `src/communityManager/plugins/communityManager/moderation/`: Telegram moderation settings, classifiers, policy decisions, stores, and enforcement adapters
- `src/projectManager/`: Jimmy project manager and team-coordinator plugin
- `src/devRel/`, `src/liaison/`, `src/socialMediaManager/`: other specialist agents
- `src/loadTest/`: load-test service, runner, and scale tests
- `tests/`: Vitest suites and scenario helpers
- `docs/tasks/`: task briefs and lightweight task notes
- `docs/exec-plans/`: living execution plans
- `docs/decisions/`: durable design decisions
- `prompts/`: reusable prompt starters for Codex

## If you are unsure

Do the smallest safe thing that increases clarity:

- read the nearest relevant docs
- inspect the real code path
- write or update the plan
- ask for approval only when the risk is genuinely human-owned

---

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
