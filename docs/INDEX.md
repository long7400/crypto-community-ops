# Documentation Index

This directory holds the repository's durable knowledge for the elizaOS multi-agent project.

Agents should treat these docs as the source of truth after `AGENTS.md` points them here.

## Start here

- `../README.md`
- `../ARCHITECTURE.md`
- `../PRODUCT_SENSE.md`
- `../QUALITY_GATES.md`
- `../TDD_RULES.md`
- `../SECURITY.md`

## Testing

- `testing/TDD_EXAMPLES.md`: concrete examples for TDD rules

Do not edit `testing/TDD_EXAMPLES.md` to match TypeScript syntax; customize project-specific TDD guidance in `../TDD_RULES.md`.

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

- `tasks/`: active task briefs and small task notes
- `exec-plans/active/`: plans in progress
- `exec-plans/completed/`: finished plans
- `decisions/`: durable decisions worth preserving

## Rules for docs

- Prefer updating an existing source-of-truth doc over creating a duplicate.
- Keep docs versioned and repository-local.
- If a design discussion in chat changes future work, capture it in a doc.
- If a doc stops matching real code behavior, fix the doc or fix the code.
