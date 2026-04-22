# Execution Plan Rules

This file defines the house style for living execution plans in this repository.

Use an execution plan when the work is long, risky, cross-cutting, or likely to span multiple sessions.

The goal is not paperwork. The goal is to make a complex task restartable from repository state alone.

## Core rule

Every execution plan must be understandable by a capable engineer or coding agent that only has:

- the current repository contents
- the current working tree
- the single plan file

Assume no memory of prior chat.

## What a good plan does

A good plan:

- explains why the work matters in user terms
- names the exact files, modules, and boundaries involved
- describes what will be changed and in what order
- records key decisions and discoveries as the work proceeds
- defines how success will be validated
- states where human approval is still required

## When to stop and get approval

Plans must explicitly pause for human approval before:

- destructive migrations
- security-sensitive changes
- production or CI policy changes
- public API contract changes
- product behavior changes that are still ambiguous

## Required sections

Every plan in `rules/docs/exec-plans/` must contain these sections in this order:

1. `# Title`
2. `## Purpose / Big Picture`
3. `## Scope`
4. `## Progress`
5. `## Open Questions`
6. `## Decision Log`
7. `## Context and Orientation`
8. `## Plan of Work`
9. `## Validation and Acceptance`
10. `## Risks and Rollback`
11. `## Approvals`
12. `## Outcomes and Retrospective`

## Writing guidance

- Write in plain language.
- Define repository-specific terms the first time you use them.
- Prefer prose over giant checklists.
- Use checkboxes only in `Progress`.
- Name files by repository-relative path.
- Name functions, modules, routes, jobs, commands, or schemas precisely.
- Include the exact commands needed to validate the work.
- Keep the plan current as implementation proceeds.

## Progress rules

The `Progress` section is mandatory and must reflect the actual state of the work.

Use entries like this:

- [x] 2026-04-22 10:00Z - Reviewed current auth flow and documented affected files.
- [ ] Implement request parsing changes in `src/api/session.ts`.
- [ ] Run unit and integration checks and capture results.

If work stops mid-step, split the item so the completed and remaining parts are obvious.

## Minimal template

Copy this into a new plan file and replace the placeholders.

```md
# [Short task title]

This is a living document. Update `Progress`, `Open Questions`, `Decision Log`, and `Outcomes and Retrospective` as work proceeds.

## Purpose / Big Picture

Explain what a user, operator, or teammate can do after this change that they could not do before.

## Scope

State what is included and what is explicitly out of scope.

## Progress

- [ ] Initial investigation completed.
- [ ] Implementation completed.
- [ ] Validation completed.

## Open Questions

- [Question needing answer or approval]

## Decision Log

- Decision: [decision]
  Rationale: [why]
  Date/Author: [timestamp and author]

## Context and Orientation

Describe the current code paths, files, and architectural boundaries relevant to the task.

## Plan of Work

Describe the edits in sequence. Name files and modules precisely.

## Validation and Acceptance

List exact commands and the behavior that proves success.

## Risks and Rollback

State the main failure modes and how to recover safely.

## Approvals

- Requires human approval before implementation: [yes/no]
- Requires human approval before merge: [yes/no]
- Human-owned decisions: [list]

## Outcomes and Retrospective

Summarize what shipped, what did not, and what should change in future work.
```

## Naming convention

Store active plans in `rules/docs/exec-plans/active/` using a filename like:

`YYYY-MM-DD-short-task-name.md`

Move completed plans to `rules/docs/exec-plans/completed/`.
