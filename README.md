# The Org - Multi-Agent System

The Org is an elizaOS TypeScript project that packages specialized agents for
community operations, developer relations, project coordination, social media,
and cross-community liaison work.

## Agents

- Eli5 (`src/communityManager/`): community onboarding, greetings, moderation, and Telegram/Discord flows.
- Eddy (`src/devRel/`): developer support, documentation help, and code examples.
- Ruby (`src/liaison/`): cross-community awareness, liaison work, and reporting.
- Jimmy (`src/projectManager/`): project management, check-ins, reports, and team coordination.
- Laura (`src/socialMediaManager/`): social content drafting, approval support, and publishing workflows.

## Agent Working Rules

Coding agents should start with these root docs:

1. `AGENTS.md`
2. `ARCHITECTURE.md`
3. `PRODUCT_SENSE.md`
4. `QUALITY_GATES.md`
5. `SECURITY.md`
6. `PLANS.md` for long-running or risky work

Reusable workflow docs, templates, and prompt starters live under `rules/docs/`
and `rules/prompts/`.

## Prerequisites

- Bun
- Node.js
- A `.env` file copied from `.env.example`
- Optional PostgreSQL/Neon connection for local DB-backed runtime use

## Setup

```bash
bun install
cp .env.example .env
```

Fill in only the platform and model secrets needed for the agents you plan to
run. `src/index.ts` filters agents based on configured platform secrets.

## Running

Start the elizaOS dev runtime:

```bash
bun run dev
```

Start the production-style runtime:

```bash
bun run start
```

Run specific agents by passing flags recognized by `src/index.ts`:

```bash
bun src/index.ts --communityManager
bun src/index.ts --projectManager
```

Available flags:

- `--communityManager`
- `--devRel`
- `--liaison`
- `--projectManager`
- `--socialMediaManager`

## Commands

- Build: `bun run build`
- Format check: `bun run format:check`
- Apply formatting: `bun run format`
- Typecheck: `bunx tsc -p tsconfig.json --noEmit`
- Main project tests: `bun run test:the-org`
- elizaOS test harness: `bun run test`
- Community manager tests: `bun run test:communityManager`
- DevRel tests: `bun run test:devRel`
- Liaison tests: `bun run test:liaison`
- Project manager tests: `bun run test:projectManager`
- Social media manager tests: `bun run test:socialMediaManager`

For a reasonable pre-merge pass:

```bash
bun run format:check && bunx tsc -p tsconfig.json --noEmit && bun run build && bun run test:the-org
```

## Project Structure

```text
src/
  index.ts                         Project entrypoint and agent selection
  init.ts                          Shared runtime/onboarding event wiring
  communityManager/                Eli5 community manager
  devRel/                          Eddy developer support
  liaison/                         Ruby liaison
  projectManager/                  Jimmy project manager and team coordinator plugin
  socialMediaManager/              Laura social media manager
  loadTest/                        Load testing service and scale tests
  utils/                           Small shared helpers
tests/
  *.test.ts                        Vitest agent suites
  test_suites/                     Shared test harnesses
rules/
  docs/                            Workflow docs, task briefs, plans, decisions, templates
  prompts/                         Prompt starters for kickoff/review/follow-up
```

## Configuration Notes

- Model providers are enabled from env vars such as `OPENAI_API_KEY`,
  `ANTHROPIC_API_KEY`, and `OPENROUTER_API_KEY`.
- Discord and Telegram platform secrets are agent-specific in `.env.example`.
- Eli5 Telegram uses `COMMUNITY_MANAGER_TELEGRAM_BOT_TOKEN`; keep it dedicated
  to avoid Telegram `409 Conflict` issues.
- Do not commit `.env`, generated secrets, or logs containing tokens.

## Testing Notes

- Add or update tests for changed behavior.
- For Eli5 Telegram onboarding, prefer `tests/eli5Telegram.test.ts` and
  `tests/test_suites/TelegramTestSuite.ts`.
- For project manager team coordination, prefer focused tests near
  `src/projectManager/plugins/team-coordinator/` plus the project manager suite
  when behavior crosses the agent boundary.
- `bun run lint` currently writes formatting; use `bun run format:check` when
  you need a non-mutating check.

## License

This project is currently unlicensed.
