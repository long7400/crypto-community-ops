# Product Sense

This file captures the product and UX principles that coding agents should preserve.

It should be stable, short, and specific enough to resolve common implementation tradeoffs.

## Product goals

`crypto-community-ops` exists to help crypto and open-community teams coordinate public communities, project work, developer support, and social communication with less manual follow-up and less trust risk.

## Principles

1. Keep every agent tightly scoped to its role; silence or `IGNORE` is better than off-topic chatter.
2. Preserve community trust over automation speed, especially for moderation and public posting.
3. Avoid price speculation, financial promises, and hype-driven crypto language unless the human explicitly asks for reviewed copy.
4. Make platform configuration failures diagnosable: missing tokens, unavailable services, and unsupported payloads should fail clearly.
5. Prefer reversible, auditable actions for community operations. Warnings, mutes, and public messages need a visible reason or approval path.
6. Keep responses concise and useful in Discord/Telegram; long explanations belong in docs or reports, not routine chat.

## UX guardrails

- Do not introduce hidden destructive behavior.
- Do not add new user-facing terms unless they are already established in the product.
- Do not silently change default behavior without recording the decision.
- When a tradeoff exists between reducing clicks and preserving user trust, preserve trust.
- Do not make an agent speak in public channels unless the message is relevant to that agent's role or explicitly requested.
- Do not change moderation defaults, enforcement thresholds, or public posting defaults without tests and human approval.
- Do not make Telegram and Discord behavior diverge silently when the user expectation is platform parity.

## Definition of done for product work

Product work is not done when code compiles. It is done when:

- the intended user behavior exists
- edge cases are handled or explicitly documented
- validation proves the behavior works
- docs or decision records reflect any new durable rule
- risky public, moderation, or security behavior has explicit human approval recorded in the task or plan

## Related docs

- `README.md`
- `ARCHITECTURE.md`
- `QUALITY_GATES.md`
- `TDD_RULES.md`
- `SECURITY.md`
