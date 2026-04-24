# Architecture Map

This file should stay short and stable.

Its job is to answer two questions quickly:

- Where does the code that does X live?
- What architectural boundaries must not be crossed?

Do not turn this into a full implementation manual. Keep deeper design details in focused docs under `docs/`.

## System overview

`crypto-community-ops` is an elizaOS multi-agent package for coordinating crypto and open-community operations across Discord and Telegram.

The main user-facing capabilities are:

- community management, greetings, and Telegram moderation through Eli5
- developer support through documentation-backed answers from Eddy
- cross-community liaison reports through Ruby
- project coordination, check-ins, and reports through Jimmy
- concise social media messaging through Laura

## Module map

- `src/index.ts`: exports the elizaOS `project`, imports all agents, and filters enabled agents by Discord/Telegram environment configuration.
- `src/init.ts`: shared runtime wiring for onboarding, world creation, room creation, owner DMs, and Telegram onboarding deep links.
- `src/communityManager/index.ts`: Eli5 character definition, onboarding settings, and community manager plugin wiring.
- `src/communityManager/plugins/communityManager/`: community services, actions, providers, Telegram identity bridging, and moderation support.
- `src/communityManager/plugins/communityManager/moderation/`: Telegram moderation boundary. It owns payload normalization, settings, deterministic and LLM classification, policy decisions, violation/audit stores, and enforcement adapters.
- `src/devRel/`: Eddy character and optional synchronous knowledge loading from docs/source when `DEVREL_IMPORT_KNOWLEDGE` is set.
- `src/liaison/`: Ruby character for cross-organization community intelligence.
- `src/projectManager/`: Jimmy character and project management settings.
- `src/projectManager/plugins/team-coordinator/`: Discord forms, team check-in actions, update tracking services, storage helpers, and logging helpers.
- `src/socialMediaManager/`: Laura character and social messaging onboarding settings.
- `src/loadTest/`: local load-test utilities and scale checks.
- `tests/`: Vitest suites, scenario-style agent tests, and platform runtime mocks.

## Architectural invariants

- Agent directories should not import each other's internals. Put shared runtime behavior in `src/init.ts` or a small shared utility.
- Platform payloads from Discord, Telegram, and elizaOS runtime events are untrusted until normalized at the boundary.
- Business decisions should be testable without live Discord, Telegram, SQL, or LLM calls. Use runtime mocks, ports, adapters, fakes, and pure decision functions where practical.
- Durable runtime state should go through elizaOS world, room, memory, and service APIs using stable UUID helpers from `@elizaos/core`.
- New diagnostics should prefer `logger` from `@elizaos/core`; do not add permanent ad-hoc `console` logging.
- Secrets and platform tokens must come from environment variables documented in `.env.example`, never from literals in source.
- Moderation enforcement must preserve admin checks, allowlisted chat checks, audit records, violation state, and `dryRun` behavior.
- The public package surface is the built `dist` output from `src/index.ts`; changes to exports or runtime agent names are public-interface changes.

## Cross-cutting concerns

- Environment and platform availability: `src/index.ts` plus `.env.example`.
- Agent onboarding settings: each agent's `index.ts`, initialized through `src/init.ts`.
- Discord/Telegram world and room setup: `src/init.ts`.
- Telegram community moderation: `src/communityManager/plugins/communityManager/moderation/`.
- Community greetings and join events: `src/communityManager/plugins/communityManager/communityService.ts`.
- Project check-ins and reports: `src/projectManager/plugins/team-coordinator/services/`.
- Runtime logging helpers for team coordinator: `src/projectManager/plugins/team-coordinator/logging.ts`.
- Build output: `tsup.config.ts` and `tsconfig.build.json`.

## Data and boundary rules

- Parse and normalize external event payloads at the platform boundary before they reach policy or workflow logic.
- Keep moderation policy inputs explicit: settings, classification, violation state, and platform identity must be visible in types.
- Treat Discord and Telegram IDs as platform-specific identifiers. Convert to elizaOS UUIDs only at runtime storage boundaries.
- Runtime memory content should include enough metadata to explain what action happened and why, especially for moderation.
- Do not make LLM output the only source of truth for enforcement decisions; deterministic rules and configured thresholds must remain part of the path.

## Known pressure points

- Telegram identity and chat resolution: plugin payloads, worlds, rooms, `serverId`, and `messageServerId` have compatibility edge cases covered by tests.
- Moderation enforcement: warning, mute, audit, violation count, admin configuration, allowed chats, and dry-run behavior are user-safety sensitive.
- Agent plugin lists and environment gating: changing plugin names or token requirements can silently disable agents.
- `src/init.ts` onboarding flows: Discord and Telegram setup share concepts but receive different event payloads.
- Team coordinator services: they register runtime events/actions and store state through elizaOS memories; regression tests should mock runtime behavior.
- DevRel knowledge loading: when enabled, it synchronously reads docs/source and can become expensive or unexpectedly broad.

## Related docs

- `README.md`
- `PRODUCT_SENSE.md`
- `QUALITY_GATES.md`
- `TDD_RULES.md`
- `SECURITY.md`
- `docs/INDEX.md`
