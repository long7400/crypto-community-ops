# Product Sense

This file captures the product and UX principles that coding agents should preserve.

It should be stable, short, and specific enough to resolve common implementation tradeoffs.

## Product goals

`crypto-community-ops` exists to help crypto and open-source communities run
operations through specialized elizaOS agents with less manual coordination,
missed follow-up, and platform-specific busywork.

## Principles

1. Prefer clarity over cleverness.
2. Prefer predictable flows over surprising automation.
3. Make user-visible failures diagnosable.
4. Keep happy paths fast, but do not hide important decisions.
5. Favor reversible changes and progressive rollout where possible.
6. Preserve each agent's persona and job boundary: Eli5 handles community management, Eddy handles developer support, Ruby handles liaison/reporting, Jimmy handles project coordination, and Laura handles social content.
7. Prefer explicit approval or deep-link handoff before actions that publish, moderate, or change community state.

## UX guardrails

- Do not introduce hidden destructive behavior.
- Do not add new user-facing terms unless they are already established in the product.
- Do not silently change default behavior without recording the decision.
- When a tradeoff exists between reducing clicks and preserving user trust, preserve trust.
- Do not make bot startup depend on a shared Telegram token when a dedicated agent token is required.
- User-facing onboarding messages should be short, actionable, and test-covered when changed.

## Definition of done for product work

Product work is not done when code compiles. It is done when:

- the intended user behavior exists
- edge cases are handled or explicitly documented
- validation proves the behavior works
- docs or decision records reflect any new durable rule
