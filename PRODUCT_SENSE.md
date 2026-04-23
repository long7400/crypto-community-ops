# Product Sense

This file captures the product and UX principles that coding agents should preserve.

It should be stable, short, and specific enough to resolve common implementation tradeoffs.

## Product goals

`crypto-community-ops` exists to help **crypto project teams and their communities** run day-to-day community operations (moderation, developer support, cross-community liaison, project tracking, social posting) with less **manual toil, inconsistent responses, and after-hours coverage gaps** — by deploying a coordinated team of specialized AI agents (Eli5, Eddy, Liaison, Project Manager, Social Media Manager) on the platforms the community already lives on (Discord, Telegram).

The primary users are:

- **Community members** who interact with agents as conversational teammates.
- **Community operators / project leads** who configure, supervise, and trust these agents to represent the project.

## Principles

1. **Agents are teammates, not bots.** Each agent has a stable persona (name, voice, domain). Preserve it across changes — do not let refactors flatten Eli5 into a generic "assistant."
2. **Predictable over clever.** A boring, consistent reply beats a surprising one. Community trust is the product.
3. **Diagnosable failures.** When an agent cannot answer or an action fails, say so clearly. Never fabricate confidence. Log enough context (via `@elizaos/core` `logger`) that an operator can debug after the fact.
4. **Platform-native behavior.** Follow Discord and Telegram conventions (reply threading, mentions, rate limits, ephemeral messages). Do not force cross-platform uniformity that breaks native UX.
5. **Reversible actions first.** Prefer soft-moderation (warn, hide, escalate) over hard actions (ban, delete) unless policy explicitly requires the hard path.
6. **Operator control is never hidden.** Configuration, secrets, and policy live in versioned config or env — not in runtime-only state that operators cannot inspect.

## UX guardrails

- **No hidden destructive behavior.** Ban, kick, delete, mass-DM, on-chain transactions, and posting to public channels require explicit config or operator approval. Default posture is "draft, don't send."
- **Persona integrity.** Do not introduce new agent personas or rename existing ones (`Eli5`, `Eddy`, etc.) without a decision record in `docs/decisions/`.
- **No silent default changes.** If a change flips a default (e.g. auto-moderation threshold, default reply mode, enabled plugins), record it in the decision log and call it out in the plan's Progress section.
- **Honest uncertainty.** When an agent lacks information (e.g. RAG returns nothing), it must say so rather than guess. Especially true for Eddy (dev support) and Liaison (cross-community claims).
- **Respect platform trust signals.** Do not bypass Discord roles/permissions or Telegram admin checks to "help" the user complete an action.
- **Trust over clicks.** When reducing friction conflicts with preserving user trust (e.g. skipping a confirmation on a destructive action), preserve trust.

## Definition of done for product work

Product work is not done when code compiles. It is done when:

- The intended user behavior exists end-to-end on the target platform (Discord and/or Telegram as applicable).
- Edge cases are handled or explicitly documented: missing credentials, rate limits, empty RAG results, unknown users/guilds, platform outages.
- The relevant agent's vitest suite passes (`bun run test:<agent>`), and a test exists for the new or changed behavior.
- Persona voice and response style are preserved (check against the agent's `character` config in `src/<agent>/index.ts`).
- Logs are sufficient for an operator to diagnose a failure without re-running the conversation.
- Docs or decision records reflect any new durable rule (policy thresholds, new plugin, new platform, persona change).

## Related docs

- `README.md`
- `ARCHITECTURE.md`
- `QUALITY_GATES.md`
- `TDD_RULES.md`
- `SECURITY.md`
- Per-agent specs under `src/<agent>/spec.md`
