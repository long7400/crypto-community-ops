# Session Start Workflow

Use this when beginning a new thread or new block of work with Codex.

## For a fresh task

1. Create or update a task brief in `docs/tasks/`.
2. Tell Codex to read:
   - `AGENTS.md`
   - the task brief
   - any referenced plan or decision docs
3. Ask Codex to summarize:
   - the task
   - affected files or subsystems
   - whether a plan is needed
   - the first safe next step

## For an in-progress plan

1. Point Codex to the plan in `docs/exec-plans/active/`.
2. Ask it to read the plan and repository state.
3. Ask for:
   - current milestone status
   - what remains
   - whether any approval gate is next

## Good kickoff prompt shape

Use prompts that specify:

- the problem
- the desired outcome
- constraints or non-goals
- whether you want exploration, a plan, or implementation

Avoid vague prompts like "fix this" when the repository does not already contain the needed context.
