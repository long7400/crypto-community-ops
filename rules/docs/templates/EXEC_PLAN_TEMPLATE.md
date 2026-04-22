# Execution Plan Template

Copy this file into `rules/docs/exec-plans/active/YYYY-MM-DD-short-task-name.md`.

## Title

`[Short task title]`

This is a living document. Keep `Progress`, `Open Questions`, `Decision Log`, and `Outcomes and Retrospective` current.

## Purpose / Big Picture

Explain the user-visible or operator-visible improvement this work will create.

## Scope

Included:

- `[item]`
- `[item]`

Excluded:

- `[item]`
- `[item]`

## Progress

- [ ] Read current code paths and docs.
- [ ] Finalize implementation approach.
- [ ] Implement the change.
- [ ] Validate behavior.
- [ ] Update docs and capture decisions.

## Open Questions

- `[question]`

## Decision Log

- Decision: `[decision]`
  Rationale: `[why]`
  Date/Author: `[timestamp and author]`

## Context and Orientation

Describe the relevant parts of the codebase and how they fit together.
For this repo, call out affected agents or shared boundaries such as
`src/init.ts`, `src/index.ts`, Telegram/Discord runtime events, or
`src/projectManager/plugins/team-coordinator/` when relevant.

## Plan of Work

Describe the sequence of edits in prose. Name the files and modules precisely.

## Validation and Acceptance

List exact commands and the outputs or behaviors that prove success.
Prefer commands from `QUALITY_GATES.md`, starting with targeted tests before
broader checks.

## Risks and Rollback

List the main failure modes and the safe fallback path.

## Approvals

- Requires human approval before implementation: `[yes/no]`
- Requires human approval before merge: `[yes/no]`
- Human-owned decisions still open: `[list]`

## Outcomes and Retrospective

Summarize what landed, what did not, and what the repo should learn from the work.
