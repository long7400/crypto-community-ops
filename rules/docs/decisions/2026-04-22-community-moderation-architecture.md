# Community Moderation Architecture for Eli5

Date: 2026-04-22

## Decision

Eli5 moderation uses a platform-agnostic policy-engine runner, versioned `COMMUNITY_MODERATION` settings, deterministic escalation, enforcement adapters, and audit records. Telegram is the first platform implemented through an always-run elizaOS evaluator and Telegram enforcement adapter; Discord and dashboard writes must reuse the same core contracts.

## Rationale

Warnings and mutes are public moderation behavior. The agent must be predictable, configurable, and auditable. LLM classification is allowed to classify message risk, but it does not directly decide enforcement. Enforcement is decided by settings, violation history, and the moderation ladder.

## Consequences

- Moderation settings live under world metadata key `COMMUNITY_MODERATION`.
- Platform-specific settings live under `platforms.telegram` and future `platforms.discord`.
- `TELEGRAM_ALLOWED_CHATS` remains the plugin-level Telegram allowlist; Eli5 settings can further narrow but not expand it.
- BotFather privacy mode must be disabled for full group moderation coverage.
- Forum topic moderation preserves `message_thread_id` as `threadId`.
- Default mode is dry-run until a human explicitly enables live enforcement.
- Future dashboard work must read and write the same settings contract through the settings repository/service.
- Platform API calls stay in enforcement adapters.
- Every moderation decision creates an audit record.
