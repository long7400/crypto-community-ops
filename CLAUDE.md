# CLAUDE.md

Primary entrypoint for Claude Code in `crypto-community-ops` (`@elizaos/the-org`).

This file is the **source of truth** for Claude Code sessions. `AGENTS.md` mirrors a short pointer back here for non-Claude tools (Codex, etc.); when the two ever diverge, **CLAUDE.md wins**.

It combines:

1. Behavioral guidelines (think → simplify → surgical → goal-driven)
2. Project map and read order
3. Commands, gates, and the Spectra planning flow

Keep it short. Deeper rules live in the source-of-truth docs linked below.

---

## Project at a glance

- **What it is**: a multi-agent elizaOS project (`@elizaos/the-org`) running 5 specialized agents — **communityManager (Eli5)**, **devRel (Eddy)**, **liaison**, **projectManager**, **socialMediaManager** — on Discord and Telegram for crypto communities.
- **Stack**: TypeScript (ESM, NodeNext) · **bun** · elizaOS CLI · **vitest** · tsup · Tailwind/React (UI surface) · zod at boundaries.
- **Entrypoint**: `src/index.ts` registers `ProjectAgent[]` and gates startup on env credentials. `src/init.ts` shares `initCharacter` wiring.
- **Each agent is self-contained** under `src/<agent>/`. **No sideways imports** between agents — share via `src/utils/` only.

## Read order (for non-trivial tasks)

1. This file (`CLAUDE.md`)
2. `ARCHITECTURE.md` — module map and architectural invariants
3. `PRODUCT_SENSE.md` — persona/UX principles to preserve
4. `QUALITY_GATES.md` — pre-merge bar
5. `TDD_RULES.md` — vitest + Red→Green→Refactor rules
6. `SECURITY.md` — risk gates
7. The active **Spectra change** under `openspec/changes/<name>/` if one exists (`spectra list`)
8. Per-agent `src/<agent>/spec.md` for the agent you're touching

`README.md` and `AGENTS.md` are background only — skim if you're new to the repo.

---

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

- State assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.
- Remove imports/variables/functions that **your** changes made unused; leave pre-existing dead code alone unless asked.

The test: every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan and check after each step.

---

<!-- SPECTRA:START v1.0.2 -->

# Spectra Instructions

This project uses Spectra for Spec-Driven Development(SDD). Specs live in `openspec/specs/`, change proposals in `openspec/changes/`.

## Use `/spectra-*` skills when:

- A discussion needs structure before coding → `/spectra-discuss`
- User wants to plan, propose, or design a change → `/spectra-propose`
- Tasks are ready to implement → `/spectra-apply`
- There's an in-progress change to continue → `/spectra-ingest`
- User asks about specs or how something works → `/spectra-ask`
- Implementation is done → `/spectra-archive`
- Commit only files related to a specific change → `/spectra-commit`

## Workflow

discuss? → propose → apply ⇄ ingest → archive

- `discuss` is optional — skip if requirements are clear
- Requirements change mid-work? Plan mode → `ingest` → resume `apply`

## Parked Changes

Changes can be parked — temporarily moved out of `openspec/changes/`. Parked changes won't appear in `spectra list` but can be found with `spectra list --parked`. To restore: `spectra unpark <name>`. The `/spectra-apply` and `/spectra-ingest` skills handle parked changes automatically.

<!-- SPECTRA:END -->

---

## Commands

Package manager: **bun** (`bun.lock` is the source of truth).

| Need | Command |
|---|---|
| Install deps | `bun install` |
| Dev | `bun run dev` (alias for `elizaos dev`) |
| Start prod | `bun run start` (alias for `elizaos start`) |
| Build | `bun run build` (tsup) |
| All agent tests | `bun run test:the-org` |
| One agent's tests | `bun run test:<agent>` (e.g. `test:communityManager`, `test:devRel`, `test:liaison`, `test:projectManager`, `test:socialMediaManager`) |
| Single test file | `bunx vitest tests/<file>.test.ts` |
| elizaOS integration | `bun run test` (alias for `elizaos test`) |
| Format check | `bun run format:check` |
| Format write | `bun run format` |
| Lint (ESLint) | `bunx eslint src` |
| Typecheck | `bunx tsc --noEmit` |
| Clean | `bun run clean` |

**Full pre-merge suite:**

```bash
bun run format:check && bunx tsc --noEmit && bun run test:the-org && bun run build
```

For changes touching platform adapters or the elizaOS runtime, also run `bun run test`.

---

## Human approval gates

Pause and ask before changing:

- auth, permissions, secrets, or security boundaries
- production infra, deployment, or CI policy
- destructive or hard-to-reverse data migrations
- public interfaces or external contracts
- architecture changes that conflict with `ARCHITECTURE.md`
- product behavior that conflicts with `PRODUCT_SENSE.md` (especially: persona changes, default-flipping moderation policy, on-chain/Solana actions, mass-DM)

When in doubt about a risky change, use `/spectra-audit` before proceeding.

## Task completion checklist

Before claiming done:

1. Code updated.
2. Tests written or updated (Red → Green → Refactor).
3. Relevant docs / spec / `tasks.md` updated.
4. Validation commands actually run — list them in the response.
5. Remaining risks, follow-ups, or approval needs called out.

## Repo knowledge rules

- Durable decisions belong in versioned docs, not chat. Capture as a `docs/decisions/` ADR.
- If you discover a missing rule that shaped the implementation, update the relevant doc before finishing.
- Prefer modifying an existing source-of-truth doc over creating a duplicate explanation.
- Keep docs aligned with observed code behavior — if doc and code disagree, fix one.

## If you are unsure

Do the smallest safe thing that increases clarity:

- read the nearest relevant doc
- inspect the real code path
- update the Spectra change or plan
- ask for approval only when the risk is genuinely human-owned
