# Review Prompt

Review the current changes as a code reviewer.

Prioritize:

- correctness bugs
- regressions
- architecture boundary violations
- missing tests
- product behavior drift

Use the task brief at `[path]` and the execution plan at `[path or n/a]` as the intended contract.

Check the actual validation commands from `QUALITY_GATES.md`, especially targeted
Vitest suites for the affected agent.

Do not summarize the diff first. Lead with findings ordered by severity.
