<!-- SPECTRA:START v1.0.1 -->

# Spectra Instructions

This project uses Spectra for Spec-Driven Development(SDD). Specs live in `openspec/specs/`, change proposals in `openspec/changes/`.

## Use `$spectra-*` skills when:

- A discussion needs structure before coding → `$spectra-discuss`
- User wants to plan, propose, or design a change → `$spectra-propose`
- Tasks are ready to implement → `$spectra-apply`
- There's an in-progress change to continue → `$spectra-ingest`
- User asks about specs or how something works → `$spectra-ask`
- Implementation is done → `$spectra-archive`

## Workflow

discuss? → propose → apply ⇄ ingest → archive

- `discuss` is optional — skip if requirements are clear
- Requirements change mid-work? `ingest` → resume `apply`

## Parked Changes

Changes can be parked（暫存）— temporarily moved out of `openspec/changes/`. Parked changes won't appear in `spectra list` but can be found with `spectra list --parked`. To restore: `spectra unpark <name>`. The `$spectra-apply` and `$spectra-ingest` skills handle parked changes automatically.

<!-- SPECTRA:END -->

# AGENTS.md

## Stack

- Bun 1.3.12 + Node v25.9.0; TypeScript 5.8.2 with `strict` + `moduleResolution: "Bundler"`
- ElizaOS CLI/runtime 1.7.2; bundled with tsup 8.4.0 from `src/index.ts`
- React 18.3.1 + Tailwind CSS 3.4.17 + Radix UI tabs/slot are installed, but the app entry is CLI/server-first
- Tests use Vitest plus `elizaos test`; lint/format is Prettier 3.5.3 writing `./src`

## Structure

- `src/index.ts` loads `../.env`, filters enabled agents, and exports `project`
- `src/{communityManager,devRel,liaison,projectManager,socialMediaManager}/` hold agent definitions; read local `spec.md` before behavior edits
- `src/projectManager/plugins/team-coordinator/` is the heaviest subsystem: actions, services, forms, storage, tasks, and tests
- `src/loadTest/` contains the harness, colocated tests, and generated logs; `tests/*.test.ts` covers higher-level agent behavior
- `.opencode/` and `.beads/` store AI workflow state and task tracking; no `.github/workflows/*`, `.cursorrules`, or `.github/copilot-instructions.md` were detected

## Commands (validated 2026-04-19)

- `bun run build` / `bun run lint` / `bunx tsc --noEmit` / `bun run test` ❌ all fail from `src/projectManager/plugins/team-coordinator/services/updateTracker.ts:846`
- `bun run dev` / `bun run start` ⚠️ can serve `:3000` while project import fails and runtime drops to `agentCount=0`

## Code example

```ts
const usesDiscord = agent.character.plugins?.includes("@elizaos/plugin-discord");
const usesTelegram = agent.character.plugins?.includes("@elizaos/plugin-telegram");
if (!usesDiscord && !usesTelegram) return true;
```

## Boundaries

- Always: prefer Bun scripts, preserve `src/index.ts` agent exports, and read the relevant `spec.md` before changing agent behavior
- Ask first: env contract changes, plugin mix, DB strategy, ports, or build/test script changes
- Never: commit `.env`, edit `dist/`, or assume local platform credentials/databases exist

## Gotchas

- `src/index.ts:2` reads `../.env`, not `./.env`; agents without Discord/Telegram secrets are filtered out before export
- `src/projectManager/plugins/team-coordinator/services/updateTracker.ts` currently has a broken `try/catch` block near line 846, which blocks build/lint/typecheck/test
- `dev`/`start` can look healthy while project import already failed
