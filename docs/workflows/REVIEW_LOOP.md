# Review Loop

Review is a first-class part of the workflow, not a last-minute ritual.

For this template, use a layered review loop:

1. Codex self-review
2. Optional second Codex pass focused on bugs and regressions
3. Human review for risky or sampled work

## Codex self-review pass

Before presenting work as complete, Codex should check:

- does the implementation match the task brief or approved plan?
- were tests added or updated?
- were docs updated if the change introduced a durable rule?
- does the change respect architecture boundaries?
- what could still be wrong?

## Human review focus

Humans should spend attention on the highest-leverage questions:

- Is the task solved in the right way?
- Did the change preserve product intent?
- Are there missing risks, regressions, or edge cases?
- Should any newly learned rule be promoted into docs or checks?

## Required human review

Require a human review for:

- security-sensitive changes
- destructive migrations
- public contract changes
- architecture changes
- operational or deployment changes

## Review outputs

Review should end with one of four outcomes:

- approved
- approved with follow-up task
- changes requested
- blocked pending product or architecture decision

## Findings format

Use `docs/templates/PR_REVIEW_TEMPLATE.md` to capture review findings consistently.
