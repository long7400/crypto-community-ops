# Documentation Index

This directory holds durable workflow knowledge for `crypto-community-ops`.

Agents should read the root rule docs first, then use this directory for
task briefs, execution plans, decisions, templates, and workflow references.

## Start here

- `../../README.md`
- `../../AGENTS.md`
- `../../ARCHITECTURE.md`
- `../../PRODUCT_SENSE.md`
- `../../QUALITY_GATES.md`
- `../../SECURITY.md`
- `../../TDD_RULES.md`
- `../../PLANS.md`

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

## Testing Reference

- `testing/TDD_EXAMPLES.md`: optional Vitest examples for common test patterns in this repo

## Working areas

- `rules/docs/tasks/`: active task briefs and small task notes
- `rules/docs/exec-plans/active/`: plans in progress
- `rules/docs/exec-plans/completed/`: finished plans
- `rules/docs/decisions/`: durable decisions worth preserving

## Rules for docs

- Prefer updating an existing source-of-truth doc over creating a duplicate.
- Keep docs versioned and repository-local.
- If a design discussion in chat changes future work, capture it in a doc.
- If a doc stops matching real code behavior, fix the doc or fix the code.
- Root docs own project-wide rules; this directory owns workflow artifacts.
