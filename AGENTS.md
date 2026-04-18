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

- Bun 1.3.12 + Node 22.22.2; TypeScript 5.8.2 with `strict` + `moduleResolution: "Bundler"`
- ElizaOS 1.0.19 multi-agent runtime; bundled with tsup 8.4.0 via `tsconfig.build.json`
- Tests use Vitest plus `elizaos test`; lint/format is Prettier 3.5.3 writing `./src`
- Config surface includes `.cursorrules`, `openspec/`, `.opencode/`, and Tailwind/PostCSS config files

## Structure

- `src/index.ts` loads `../.env`, filters enabled agents, and exports `project`
- `src/{communityManager,devRel,liaison,projectManager,socialMediaManager}/` hold agent definitions; read local `spec.md` before behavior edits
- `src/projectManager/plugins/team-coordinator/` contains check-ins, team members, reports, tasks, and tracker services
- `src/loadTest/` contains harness + colocated tests; `tests/*.test.ts` covers higher-level agent behavior
- `.opencode/` stores AI workflow config/memory; `openspec/{specs,changes}` stores Spectra specs and proposals

## Commands (validated 2026-04-16)

- `bun run build` ✅ works; tsup warns about `./services/checkInService` casing vs `CheckInService.ts`
- `bun run lint` ✅ works; runs `prettier --write ./src` and can modify tracked files
- `bunx tsc --noEmit` ❌ fails in `src/loadTest/__tests__/service.test.ts`, `src/plugins.test.ts`, `src/projectManager/plugins/team-coordinator/actions/teamMemberUpdate.ts`, and `src/projectManager/plugins/team-coordinator/actions/updateFormat.ts`
- `bun run test` ❌ fails after TS issues and runtime `this[writeSym] is not a function`
- `bun run start` ❌ fails on TS directory imports from `src/index.ts`, then SQL/PGlite migration aborts
- `bun run dev` ❌ loads `dist/index.js`, filters to Jimmy without platform vars, then hits SQL/PGlite migration abort in this environment

## Code example

```ts
const usesDiscord = agent.character.plugins?.includes("@elizaos/plugin-discord");
const usesTelegram = agent.character.plugins?.includes("@elizaos/plugin-telegram");
if (!usesDiscord && !usesTelegram) return true;
```

## Testing

- `tests/*.test.ts` covers named agents; `src/plugins.test.ts` checks plugin/env loading; `src/loadTest/__tests__/*.test.ts` covers load-test service behavior
- `elizaos test` boots runtime pieces; it is not a pure unit-test pass

## Boundaries

- Always: prefer Bun scripts, preserve `src/index.ts` agent exports, and read the relevant `spec.md` before changing agent behavior
- Ask first: env contract changes, plugin mix, DB strategy, ports, or build/test script changes
- Never: commit `.env`, edit `dist/`, or assume local platform credentials/databases exist

## Gotchas

- `src/index.ts:2` reads `../.env`; `bun.lock` is the lockfile though `README.md` still says `bun.lockb`
- Import casing around `CheckInService.ts` matters on case-sensitive systems; no `.github/workflows/*` or `.github/copilot-instructions.md` detected
