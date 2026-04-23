# AGENTS.md

Entrypoint for **non-Claude** coding agents (e.g. Codex) working in `crypto-community-ops` (`@elizaos/the-org`).

> **Claude Code uses `CLAUDE.md` as its primary entrypoint.** This file is a thin mirror so Codex and other tools that look for `AGENTS.md` still find the project's operating rules. **If anything here ever conflicts with `CLAUDE.md`, `CLAUDE.md` wins** — fix this file to match.

For the full project map, behavioral guidelines, Spectra workflow, commands, and approval gates, **read `CLAUDE.md`**. The summary below is intentionally short.

## Operating model

- Humans steer scope, priorities, and risk.
- Agents execute research, implementation, testing, and documentation updates.
- If a task is ambiguous, clarify through repository docs first, then ask the human only if risk remains.
- Planning system is **Spectra** (`openspec/`, `/spectra-*` skills). Fall back to `docs/exec-plans/` only for work that does not fit a single spec change (see `PLANS.md`).

## Read order

1. `CLAUDE.md` — primary entrypoint (project map, behavioral rules, Spectra flow, commands)
2. `ARCHITECTURE.md` — module map and invariants
3. `PRODUCT_SENSE.md` — persona/UX principles
4. `QUALITY_GATES.md` — pre-merge bar
5. `TDD_RULES.md` — vitest + TDD rules
6. `SECURITY.md` — risk gates
7. Active Spectra change under `openspec/changes/<name>/` (`spectra list`) if any
8. Per-agent `src/<agent>/spec.md` for the agent you're touching

## Quick reference

- **Stack**: TypeScript (ESM) · bun · elizaOS CLI · vitest · tsup
- **Pre-merge suite**: `bun run format:check && bunx tsc --noEmit && bun run test:the-org && bun run build`
- **Per-agent tests**: `bun run test:<agent>` (`communityManager` | `devRel` | `liaison` | `projectManager` | `socialMediaManager`)
- **Plan flow**: `/spectra-discuss` → `/spectra-propose` → `/spectra-apply` → `/spectra-archive`
- **Approval-required areas**: auth/secrets, prod infra, destructive migrations, public APIs, persona changes, on-chain actions, default-flipping moderation policy

For anything more, see `CLAUDE.md`.
