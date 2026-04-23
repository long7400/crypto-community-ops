# Architecture Map

This file should stay short and stable.

Its job is to answer two questions quickly:

- Where does the code that does X live?
- What architectural boundaries must not be crossed?

Deeper design details belong under `docs/` and per-agent `spec.md` files.

## System overview

`crypto-community-ops` (published as `@elizaos/the-org`) is a multi-agent project built on [elizaOS](https://github.com/elizaos/eliza) that runs a coordinated team of specialized AI agents for a crypto community. Each agent is a `ProjectAgent` with its own character, plugins, and platform bindings; agents are wired together in `src/index.ts` and launched via the `elizaos` CLI.

The main user-facing capabilities are:

- **Community management** — `Eli5` moderates and greets users on Discord/Telegram.
- **Developer relations** — `Eddy` answers developer questions using RAG over project docs.
- **Cross-community liaison** — relays information between external communities.
- **Project management** — tracks tasks, standups, and team check-ins.
- **Social media management** — drafts and posts content across social channels.

## Module map

Top-level runtime wiring:

- `src/index.ts` — project entrypoint. Declares the `ProjectAgent[]`, checks required env vars per agent (Discord/Telegram credentials), and exports the project for `elizaos start`.
- `src/init.ts` — shared `initCharacter` helper. Registers actions/providers/evaluators on the runtime and binds Discord world lifecycle events (`DISCORD_WORLD_JOINED`, `DISCORD_SERVER_CONNECTED`).

Per-agent modules (each is self-contained and exports a `ProjectAgent`):

- `src/communityManager/` — **Eli5**. Contains `plugins/communityManager` (agent-specific plugin), `platforms/{discord,telegram}` (platform adapters), `actions/` (e.g. `greet.ts`), `plugin/{actions,providers,services}` (moderation logic), `runtime/`, `shared/`.
- `src/devRel/` — **Eddy**. RAG-based dev support. See `src/devRel/spec.md`.
- `src/liaison/` — cross-community relay. See `src/liaison/spec.md`.
- `src/projectManager/` — task/standup agent. Contains `plugins/`, `types/`, `types.ts`, `utils/`. See `src/projectManager/spec.md`.
- `src/socialMediaManager/` — content agent. Contains `actions/`. See `src/socialMediaManager/spec.md`.

Shared code:

- `src/utils/` — cross-agent utilities (e.g. `discordHelper.ts`). Safe for any agent to import.

Tests and assets:

- `tests/` — `vitest` suites, one file per agent (`communityManager.test.ts`, `devRel.test.ts`, `liaison.test.ts`, `projectManager.test.ts`, `socialMediaManager.test.ts`) plus focused suites (e.g. `eli5ModerationRunner.test.ts`) and `test_suites/`.
- `src/assets/` — static assets bundled with agents.

Build and config:

- `tsup.config.ts`, `tsconfig*.json`, `tailwind.config.js`, `postcss.config.js` — build pipeline (tsup for the agent bundle, Tailwind for any UI surface).
- `openspec/` — Spectra spec-driven development artifacts. `openspec/changes/` holds in-flight proposals; `openspec/specs/` holds accepted specs.

## Architectural invariants

- **Agents do not import each other.** Each agent directory under `src/<agentName>/` is self-contained. If two agents need to share logic, it goes in `src/utils/` or a dedicated shared module — never a sideways import.
- **Character definition stays in each agent's `index.ts`.** Do not inline character config into runtime wiring or platform adapters.
- **Platform code is isolated.** Discord/Telegram adapters live under `<agent>/platforms/<platform>/`. Business logic must not import from `discord.js` or the Telegram SDK directly; go through the platform adapter or `src/utils/discordHelper.ts`.
- **Runtime side effects enter through `initCharacter`.** Actions, providers, evaluators, and event handlers must be registered via the shared init path, not attached ad hoc.
- **elizaOS plugin APIs are the public seam.** Do not reach into `@elizaos/core` internals; consume the documented `IAgentRuntime`, `Action`, `Provider`, `Evaluator`, and `Character` types.
- **Secrets come from env, never committed.** `character.settings.secrets` reads from `process.env`; `.env` is loaded in `src/index.ts` and each agent's `index.ts`.

## Cross-cutting concerns

- **Auth / platform credentials** — `src/index.ts` `hasRequiredEnvVars()` gates agent startup on Discord/Telegram env presence.
- **Logging** — `logger` from `@elizaos/core`. Do not use `console.*` in agent code.
- **Configuration loading** — `dotenv` at the project root (`src/index.ts`) and at each agent entry. Agent-specific tuning lives in the `Character` config.
- **Onboarding** — `initializeOnboarding` from `@elizaos/core`, invoked through `initCharacter` in `src/init.ts`.
- **Plugins** — declared in the agent's `Character.plugins` array. Third-party plugins come from `@elizaos/plugin-*` packages; agent-local plugins live under `src/<agent>/plugins/`.

## Data and boundary rules

- External input (Discord messages, Telegram updates, HTTP webhooks) is untrusted until parsed. Use `zod` (already a dependency) for schema validation at boundaries.
- Internal code works with elizaOS trusted types (`Character`, `IAgentRuntime`, `UUID`, `World`, etc.), not loose `any` shapes.
- Solana / on-chain interactions go through `@elizaos/plugin-solana`. Do not hand-roll RPC calls.
- PDF / video / file inputs go through the corresponding elizaOS plugin (`plugin-pdf`, `plugin-video-understanding`).

## Known pressure points

- **Agent startup ordering in `src/index.ts`** — env-var gating silently drops agents that lack credentials. A misconfigured `.env` can result in a partial team without an obvious error.
- **Discord world events in `src/init.ts`** — `DISCORD_WORLD_JOINED` / `DISCORD_SERVER_CONNECTED` handlers run per-guild and touch onboarding state; race conditions on first-join are easy to introduce.
- **Moderation policy for Eli5** — split across `src/communityManager/plugin/` and test suites `eli5CommunityModerationPolicy.test.ts`, `eli5CommunityModerationSettings.test.ts`, `eli5ModerationRunner.test.ts`. Policy changes must update all three.
- **Character plugin lists** — conditional plugin loading based on env keys (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, etc.) means the resolved plugin set depends on deploy environment.

## Related docs

- `README.md`
- `PRODUCT_SENSE.md`
- `QUALITY_GATES.md`
- `TDD_RULES.md`
- `SECURITY.md`
- `docs/INDEX.md`
- Per-agent specs: `src/devRel/spec.md`, `src/liaison/spec.md`, `src/projectManager/spec.md`, `src/socialMediaManager/spec.md`
