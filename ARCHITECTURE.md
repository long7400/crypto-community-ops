# Architecture Map

This file should stay short and stable.

Its job is to answer two questions quickly:

- Where does the code that does X live?
- What architectural boundaries must not be crossed?

Do not turn this into a full implementation manual. Keep deeper design details in focused docs under `docs/`.

## System overview

`crypto-community-ops` is the `@elizaos/the-org` package: a TypeScript ESM
elizaOS project that bundles several operations agents into one project export.

The main user-facing capabilities are:

- community onboarding, moderation, and greeting through Eli5
- developer support and documentation help through Eddy
- cross-community liaison and reporting through Ruby
- project coordination and check-ins through Jimmy
- social content drafting and publishing through Laura

## Module map

- `src/index.ts`: loads env, imports all agents, filters enabled agents by CLI flags, and exports the project object. It may depend on agent modules, but agent modules should not depend on the project entrypoint.
- `src/init.ts`: shared `initCharacter` wiring and onboarding event handlers for Discord and Telegram. Treat this as a runtime boundary: changes can affect every agent that calls `initCharacter`.
- `src/communityManager/`: Eli5 character, onboarding config, community plugin, Telegram/Discord behavior, greeting and moderation flows. Keep Telegram-specific assumptions here or in explicit platform adapters.
- `src/devRel/`: Eddy character and developer support behavior. Its `spec.md` describes intended product scope.
- `src/liaison/`: Ruby character and cross-community liaison behavior. Its `spec.md` describes intended product scope.
- `src/projectManager/`: Jimmy character plus `plugins/team-coordinator/` actions, forms, services, storage, scheduling, and reporting.
- `src/socialMediaManager/`: Laura character, onboarding config, and social posting actions.
- `src/loadTest/`: load testing service, utilities, types, and scale tests.
- `src/utils/`: small shared helpers only. Do not turn this into a catch-all for agent-specific behavior.
- `tests/`: Vitest tests, including agent suites and Telegram-specific test harnesses under `tests/test_suites/`.

## Architectural invariants

- Agent modules may depend on `src/init.ts`; `src/init.ts` must not import individual agent modules.
- Platform events such as `DISCORD_WORLD_JOINED`, `DISCORD_SERVER_CONNECTED`, and `TELEGRAM_WORLD_JOINED` are runtime contracts. Preserve payload compatibility or update tests and docs together.
- Secrets must enter through character settings and environment variables, not hard-coded values.
- Boundary inputs from Discord, Telegram, CLI args, env vars, or uploaded/social content are untrusted until checked or normalized.
- Prefer `@elizaos/core` logger/runtime APIs over ad-hoc side effects.
- Keep plugin actions/services close to their owning agent unless a shared abstraction has at least two real users.

## Cross-cutting concerns

Document the approved entrypoints for concerns that touch many parts of the system.

Typical examples:

- configuration loading: `src/index.ts` and each agent `index.ts` load `dotenv` and map env vars into character settings.
- onboarding: `src/init.ts` plus each agent's onboarding config.
- Telegram community onboarding: `src/init.ts`, `src/communityManager/index.ts`, and Telegram tests in `tests/eli5Telegram.test.ts`.
- Community moderation: `src/communityManager/plugins/communityManager/moderation/`
  owns Eli5 moderation settings, platform normalization, the Telegram
  always-run evaluator, classification, per-platform violation escalation,
  enforcement adapters, and audit logging. LLM output may classify risk, but
  mute/warning decisions must pass through the policy engine.
- Discord onboarding: `src/init.ts`.
- project check-ins and reports: `src/projectManager/plugins/team-coordinator/`.
- testing harnesses: `tests/test_suites/` and `src/plugins.test.ts`.

## Data and boundary rules

Capture the high-level rule here, then link to deeper docs if needed.

- External input is untrusted until parsed.
- Internal code should work with trusted types, not loose dictionaries or guessed shapes.
- Database and API contracts should be represented explicitly in code.
- Test runtime state should use isolated temp databases or mocks; do not point tests at a shared production-like database.

## Known pressure points

List the areas where changes are easy to get wrong.

- `src/init.ts` is shared by multiple agents and both Discord and Telegram onboarding paths.
- Telegram onboarding for Eli5 depends on dedicated bot token wiring and event payload shape; regressions can create 409 token conflicts or missed onboarding messages.
- `src/projectManager/plugins/team-coordinator/` crosses actions, forms, services, storage, and scheduling.
- Character plugin lists are env-driven. Changing fallback model/provider logic can alter runtime startup behavior.

## Related docs

- `README.md`
- `PRODUCT_SENSE.md`
- `QUALITY_GATES.md`
- `SECURITY.md`
- `TDD_RULES.md`
- `rules/docs/INDEX.md`
