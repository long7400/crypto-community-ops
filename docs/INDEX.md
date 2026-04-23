# Documentation Index

This directory holds the repository's durable knowledge.

Agents should treat these docs as the source of truth after `AGENTS.md` points them here.

**Planning system:** this project uses **Spectra** (`openspec/` + `/spectra-*` skills) as the primary planning flow. `docs/exec-plans/` is reserved for multi-change or non-spec work (see `PLANS.md`).

## Start here

- `../README.md`
- `../ARCHITECTURE.md`
- `../PRODUCT_SENSE.md`
- `../QUALITY_GATES.md`
- `../TDD_RULES.md`
- `../SECURITY.md`
- `../CLAUDE.md` — Spectra workflow for coding agents

## Testing

- `testing/TDD_EXAMPLES.md`: concrete examples for TDD rules

## Workflows

- `workflows/HUMAN_IN_THE_LOOP.md`: the normal user + Codex delivery loop
- `workflows/REVIEW_LOOP.md`: how to review agent-produced changes
- `workflows/SESSION_START.md`: how to begin a new task cleanly

## Templates

- `templates/TASK_BRIEF_TEMPLATE.md`: short task brief for most work
- `templates/EXEC_PLAN_TEMPLATE.md`: living execution plan for larger work
- `templates/ADR_TEMPLATE.md`: architecture or design decision record
- `templates/PR_REVIEW_TEMPLATE.md`: review checklist and findings format
- `templates/RETRO_TEMPLATE.md`: short retrospective after larger work

## Working areas

- `../openspec/changes/`: active Spectra change proposals (primary)
- `../openspec/specs/`: accepted Spectra specs
- `tasks/`: lightweight task notes for work too small for Spectra
- `exec-plans/active/`: plans in progress (only for multi-change / non-spec work)
- `exec-plans/completed/`: finished plans
- `decisions/`: durable decisions worth preserving (ADRs)

## Rules for docs

- Prefer updating an existing source-of-truth doc over creating a duplicate.
- Keep docs versioned and repository-local.
- If a design discussion in chat changes future work, capture it in a doc.
- If a doc stops matching real code behavior, fix the doc or fix the code.
