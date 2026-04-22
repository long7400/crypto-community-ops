# Human in the Loop Workflow

This repository does not assume full autonomous delivery. The default mode is:
human steers product and risk, Codex performs focused implementation and
validation.

The default loop is:

1. Human defines the problem.
2. Codex explores the codebase and relevant docs.
3. Codex proposes an implementation path.
4. Human approves or redirects.
5. Codex implements, tests, and documents.
6. Human reviews the result and decides what ships.

## Role split

Human owns:

- what matters now
- business tradeoffs
- ambiguity resolution when docs are insufficient
- approval for risky changes
- final merge or ship decision

Codex owns:

- codebase exploration
- implementation details within established constraints
- test updates
- documentation updates
- self-review and issue surfacing

## Default task flow

For small work:

1. Write a task brief in `rules/docs/tasks/` when scope needs to persist.
2. Ask Codex to read the brief and inspect the relevant code.
3. If the task is local and low risk, implement directly.
4. Run checks, update docs, and review.

For larger work:

1. Write a task brief in `rules/docs/tasks/`.
2. Ask Codex to draft an execution plan in `rules/docs/exec-plans/active/`.
3. Review the plan.
4. Approve implementation.
5. Have Codex maintain the plan as work proceeds.

## Approval checkpoints

Stop for human approval when the work affects:

- user-visible product behavior that is not clearly specified
- data models, migrations, or contract compatibility
- security or permission boundaries
- deployment, CI, or production operations
- architecture rules that may need to change
- Telegram/Discord bot token routing
- moderation, timeout, social publishing, or public-channel reporting behavior

## What "good collaboration" looks like

- Codex reads before editing.
- The human does not need to restate stable rules every session.
- Durable rules are written into repo docs.
- The result is understandable from repository state, not hidden chat history.
- Checks are reported by exact command, not by assumption.

## What this workflow avoids

This template intentionally does not assume:

- auto-pulling issues from an external tracker
- unattended agent loops merging to main
- background automation as the default execution model

Those can be added later, but only after the repository is legible and the checks are trustworthy.
