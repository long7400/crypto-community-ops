# AGENTS.md

Behavioral and project-specific guidelines for coding agents working in
`crypto-community-ops` (`@elizaos/the-org`), an elizaOS multi-agent project for
community operations.

These rules bias toward caution over speed. For trivial tasks, use judgment.

## Project Operating Model

- Humans steer scope, priorities, and risk.
- Codex executes research, implementation, testing, and documentation updates.
- If a task is ambiguous, clarify through repository docs first, then ask the human only if risk remains.
- If a task is cross-cutting, long-running, or risky, create or update an execution plan before implementing.

For every non-trivial task, read these in order:

1. `README.md`
2. `ARCHITECTURE.md`
3. `PRODUCT_SENSE.md`
4. `QUALITY_GATES.md`
5. `TDD_RULES.md`
6. `SECURITY.md`
7. Relevant supporting docs under `rules/docs/`

If there is an active brief or plan for the task, read that before editing code.

## Think Before Coding

Do not assume or hide confusion. Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop, name what is confusing, and ask.

## Simplicity First

Minimum code that solves the problem. Nothing speculative.

- No features beyond what was asked.
- No abstractions for single-use code.
- No flexibility or configurability that was not requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

## Surgical Changes

Touch only what you must. Clean up only your own mess.

- Do not improve adjacent code, comments, or formatting.
- Do not refactor things that are not broken.
- Match existing style, even if you would do it differently.
- If you notice unrelated dead code, mention it; do not delete it.
- Remove imports, variables, or functions that your changes made unused.
- Do not remove pre-existing dead code unless asked.

Every changed line should trace directly to the user's request.

## Goal-Driven Execution

Transform tasks into verifiable goals:

- Add validation -> write tests for invalid inputs, then make them pass.
- Fix a bug -> write or identify a test that reproduces it, then make it pass.
- Refactor code -> ensure relevant checks pass before and after.

For multi-step tasks, state a brief plan:

```text
1. [Step] -> verify: [check]
2. [Step] -> verify: [check]
3. [Step] -> verify: [check]
```

## When a Plan Is Required

Create or update an execution plan when work involves any of the following:

- more than one subsystem
- a new feature with unknown implementation details
- schema or API contract changes
- refactors that touch many files
- migrations, reliability work, or security-sensitive changes
- anything expected to take more than one focused coding session

The plan format and rules live in `PLANS.md`.

## Human Approval Gates

Pause and ask for human approval before making changes to:

- auth, permissions, secrets, or security boundaries
- production infra, deployment, or CI policy
- data migrations that are destructive or hard to reverse
- public interfaces or external contracts
- architecture changes that conflict with `ARCHITECTURE.md`
- product behavior that conflicts with `PRODUCT_SENSE.md`
- Telegram/Discord bot token routing or public moderation/publishing behavior

## Code and Validation Rules

- Respect the boundaries described in `ARCHITECTURE.md`.
- Parse and normalize data at boundaries instead of spreading ad-hoc validation through the codebase.
- Prefer explicit types, names, and small well-scoped files over generic catch-all helpers.
- Run the smallest high-signal checks first, then broader checks when warranted.
- Do not claim completion without listing the checks you actually ran.
- Durable decisions belong in versioned docs, not only in chat.
- If you discover a missing rule that shaped the implementation, update the relevant doc before finishing.

## Project Commands

- Install deps: `bun install`
- Start dev environment: `bun run dev`
- Start production-style runtime: `bun run start`
- Build package: `bun run build`
- Run all project tests: `bun run test:the-org`
- Run elizaOS test harness: `bun run test`
- Run targeted tests:
  - `bun run test:communityManager`
  - `bun run test:devRel`
  - `bun run test:liaison`
  - `bun run test:projectManager`
  - `bun run test:socialMediaManager`
- Run format check: `bun run format:check`
- Apply formatting: `bun run format`
- Typecheck: `bunx tsc -p tsconfig.json --noEmit`
- Reasonable pre-merge check: `bun run format:check && bunx tsc -p tsconfig.json --noEmit && bun run build && bun run test:the-org`

## Directory Map

- `src/index.ts`: project entrypoint that selects enabled agents and exports the elizaOS project.
- `src/init.ts`: shared runtime initialization and Discord/Telegram onboarding event handlers.
- `src/communityManager/`: Eli5 community manager, onboarding, greetings, moderation, and Telegram-specific behavior.
- `src/devRel/`: Eddy developer support agent.
- `src/liaison/`: Ruby cross-community liaison agent.
- `src/projectManager/`: Jimmy project management agent and team coordinator plugin.
- `src/socialMediaManager/`: Laura social media/marketing agent and posting actions.
- `src/loadTest/`: load-test service and scale tests.
- `src/utils/`: small shared helpers only.
- `tests/`: Vitest suites and test harnesses.
- `rules/docs/tasks/`: task briefs and lightweight task notes.
- `rules/docs/exec-plans/`: living execution plans.
- `rules/docs/decisions/`: durable design decisions.
- `rules/prompts/`: reusable prompt starters for Codex.

## context-mode

Raw tool output floods the context window. Use context-mode MCP tools when they
are available to keep raw data in the sandbox.

### Think in Code - Mandatory

When you need to analyze, count, filter, compare, search, parse, transform, or
process data, write code that does the work and only print the answer. Do not
read raw data into context to process mentally. Write robust, pure JavaScript
with Node.js built-ins where possible.

### Tool Selection

1. `batch_execute(commands, queries)` for primary research when available.
2. `search(queries: [...])` for follow-up questions when available.
3. `execute(language, code)` or `execute_file(path, language, code)` for API calls, log analysis, and data processing when available.
4. `fetch_and_index(url)` then `search(queries)` for web content when available.

If those MCP tools are unavailable, use local shell commands carefully and keep
output compact.

## If You Are Unsure

Do the smallest safe thing that increases clarity:

- read the nearest relevant docs
- inspect the real code path
- write or update the plan
- ask for approval only when the risk is genuinely human-owned
