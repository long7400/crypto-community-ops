# Codex Human-in-the-Loop Template

This repository template is for teams that want agent-driven development without turning the whole software process into unattended automation.

The operating model is simple:

- Humans steer intent, priorities, risk, and approvals.
- Codex executes research, implementation, testing, and documentation work.
- The repository is the source of truth.
- Rules are encoded in docs and checks, not held in someone's head.

This template is shaped by a few principles:

1. Keep `AGENTS.md` short and use it as a map, not an encyclopedia.
2. Put durable project knowledge in versioned repository docs.
3. Use execution plans for work that is long, cross-cutting, or risky.
4. Prefer explicit architecture boundaries over vague style guidance.
5. Increase autonomy only after checks, docs, and recovery paths exist.
6. Keep a human approval gate for decisions with product, security, data, or operational risk.

## Who this template is for

Use this if you want to work like:

- "I give Codex a task brief, it explores, proposes a plan, then implements after I approve."
- "Codex can do most of the coding and review prep, but I still want to decide what ships."
- "I want strong repository guidance and repeatable working loops, not a bot that auto-pulls issues and auto-merges code."

Do not use this template as-is if your goal is fully autonomous background delivery. It is intentionally opinionated toward `human steers, agent executes`.

## Repository layout

Top-level files:

- `AGENTS.md`: short instructions for coding agents.
- `PLANS.md`: rules for writing living execution plans.
- `ARCHITECTURE.md`: codemap and architectural invariants.
- `PRODUCT_SENSE.md`: product and UX principles.
- `QUALITY_GATES.md`: merge and validation expectations.
- `TDD_RULES.md`: Test-Driven Development rules and antipatterns.
- `SECURITY.md`: red flags and approval gates.

Supporting docs:

- `docs/INDEX.md`: documentation map.
- `docs/workflows/`: human-agent collaboration loops.
- `docs/templates/`: reusable templates for briefs, plans, reviews, and decisions.
- `docs/tasks/`: active task briefs and lightweight delivery notes.
- `docs/exec-plans/`: long-running implementation plans.
- `docs/decisions/`: architecture and product decisions.

Optional prompt helpers:

- `prompts/`: copy-paste prompts for starting tasks, reviews, and follow-up passes with Codex.

## Daily workflow

1. Create a task brief from `docs/templates/TASK_BRIEF_TEMPLATE.md`.
2. Ask Codex to read the brief, inspect the codebase, and either:
   - implement directly for small local work, or
   - write an execution plan for larger work.
3. Review the plan if one is needed.
4. Give explicit approval to implement.
5. Have Codex run relevant checks and update docs.
6. Review the result using `docs/templates/PR_REVIEW_TEMPLATE.md`.
7. Capture any durable rule or design decision back into repo docs.

## Approval model

By default, Codex should pause for human approval before:

- irreversible schema or data migrations
- authentication, authorization, or security-sensitive changes
- production infra or deployment changes
- public API contract changes
- deletion of significant code paths
- changes that contradict existing product or architecture docs

Small local fixes, test additions, and low-risk refactors can proceed without a separate planning round once the task brief is clear.

## How to bootstrap this template

Before first real use, replace bracketed placeholders such as `[PROJECT_NAME]` and `[FILL IN]` in these files.

Recommended first edits:

1. Fill in `ARCHITECTURE.md` with the real module map.
2. Fill in `AGENTS.md` with actual setup, build, and test commands.
3. Adjust `QUALITY_GATES.md` to match your toolchain.
4. Write your first real task brief in `docs/tasks/`.

## Suggested autonomy levels

- Level 1: Codex explores, drafts plans, and proposes changes. Human approves before edits.
- Level 2: Codex edits and validates low-risk work. Human approves risky work.
- Level 3: Codex self-reviews and prepares merge-ready changes. Human reviews exceptions and sampled work.

Start at Level 1 or 2. Move up only when your repo docs, checks, and recovery paths are solid.
