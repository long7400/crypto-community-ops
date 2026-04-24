# crypto-community-ops

`crypto-community-ops` is an elizaOS multi-agent project for running crypto and open-community operations across Discord and Telegram.

The package is currently named `@elizaos/the-org`. The runtime entrypoint is `src/index.ts`, which exports an elizaOS `project` and filters agents by the platform tokens available in the environment.

The main agents are:

- Eli5, the community manager: greetings, community support, Telegram moderation, and safe community operations.
- Eddy, the developer support agent: documentation-backed developer help and knowledge loading.
- Ruby, the liaison: cross-community awareness and report-style synthesis.
- Jimmy, the project manager: project coordination, check-ins, reports, and team coordinator services.
- Laura, the social media manager: concise public messaging and platform-aware social content.

This repo is intentionally human-in-the-loop. Humans steer intent, priorities, risk, and approvals; Codex executes research, implementation, tests, and documentation updates inside the repository rules.

## Getting Started

Use Bun because this repo has a `bun.lock` lockfile.

Common commands:

- Install dependencies: `bun install`
- Start the elizaOS dev runtime: `bun run dev`
- Start the elizaOS runtime: `bun run start`
- Build: `bun run build`
- Run a targeted Vitest file: `bunx vitest tests/<file>.test.ts`
- Run the core project suite: `bun run test:the-org`
- Run the elizaOS test command: `bun run test`
- Check formatting: `bun run format:check`
- Format source files: `bun run format`
- Typecheck tests and source: `bunx tsc --noEmit -p tests/tsconfig.json`

Copy `.env.example` to `.env` for local runtime work and fill only the tokens needed for the agents under test. Telegram bot tokens should be dedicated per agent to avoid 409 conflicts.

## Repository Layout

Top-level docs:

- `AGENTS.md`: short instructions and command map for coding agents.
- `PLANS.md`: rules for writing living execution plans.
- `ARCHITECTURE.md`: codemap and architectural invariants.
- `PRODUCT_SENSE.md`: product and UX principles.
- `QUALITY_GATES.md`: merge and validation expectations.
- `TDD_RULES.md`: Test-Driven Development rules and antipatterns.
- `SECURITY.md`: red flags and approval gates.

Product code:

- `src/index.ts`: elizaOS project entrypoint and agent availability filtering.
- `src/init.ts`: shared Discord and Telegram onboarding/world setup.
- `src/communityManager/`: Eli5 character, community services, Telegram moderation, and actions.
- `src/devRel/`, `src/liaison/`, `src/projectManager/`, `src/socialMediaManager/`: specialist agents.
- `src/projectManager/plugins/team-coordinator/`: Jimmy's team coordination actions, forms, services, and storage helpers.
- `src/loadTest/`: load-test utilities and local scale checks.
- `tests/`: Vitest suites and scenario test helpers.

Supporting docs and prompts:

- `docs/INDEX.md`: documentation map.
- `docs/workflows/`: human-agent collaboration loops.
- `docs/templates/`: reusable templates for briefs, plans, reviews, and decisions.
- `docs/tasks/`: active task briefs and lightweight delivery notes.
- `docs/exec-plans/`: long-running implementation plans.
- `docs/decisions/`: architecture and product decisions.

Optional prompt helpers:

- `prompts/`: copy-paste prompts for starting tasks, reviews, and follow-up passes with Codex.

## Daily Workflow

1. Use `AGENTS.md` as the agent entrypoint.
2. Read the source-of-truth docs listed there before non-trivial work.
3. Implement directly only for clear, local, low-risk tasks.
4. Create or update an execution plan for work that is long, risky, cross-cutting, or hard to resume from chat alone.
5. Run the smallest high-signal check first, then broader checks when warranted.
6. Capture durable rules in docs instead of leaving them only in chat.

## Approval Model

By default, Codex should pause for human approval before:

- irreversible schema or data migrations
- authentication, authorization, or security-sensitive changes
- production infra or deployment changes
- public API contract changes
- deletion of significant code paths
- moderation enforcement behavior that could warn, mute, restrict, or remove community members
- public posting behavior or marketing copy defaults
- changes that contradict existing product or architecture docs

Small local fixes, test additions, and low-risk refactors can proceed without a separate planning round once the task brief is clear.

## Suggested autonomy levels

- Level 1: Codex explores, drafts plans, and proposes changes. Human approves before edits.
- Level 2: Codex edits and validates low-risk work. Human approves risky work.
- Level 3: Codex self-reviews and prepares merge-ready changes. Human reviews exceptions and sampled work.

Start at Level 1 or 2. Move up only when your repo docs, checks, and recovery paths are solid.
