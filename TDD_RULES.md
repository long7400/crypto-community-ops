# TDD Rules for AI Agent — `crypto-community-ops`

> **Stack:** TypeScript (Node ESM, `tsconfig.json` `module: NodeNext`) · **Test framework:** [vitest](https://vitest.dev) · **Async helpers:** `vi.useFakeTimers`, `vi.advanceTimersByTimeAsync`, `vi.waitFor`, `expect.poll`, `await expect(promise).resolves/rejects` · **Mutation tool:** [Stryker Mutator](https://stryker-mutator.io/) for TypeScript (`@stryker-mutator/core` + `@stryker-mutator/vitest-runner`), used periodically — not on every PR.
>
> **Scope of edits:** This file is the project's TDD source of truth. `docs/testing/TDD_EXAMPLES.md` is a fixed reference — read it as intent and translate snippets to TypeScript + vitest as needed.

---

### 1. Mandatory Cycle: Red → Green → Refactor

1.  **Red**: Write the smallest failing test first. It MUST fail for the *right reason* (missing/incorrect behavior), not unrelated syntax/typos. Stub just enough API to compile and run.
2.  **Green**: Write the **minimum** production code to pass. No speculative generality, no optimization. Use one of Beck's strategies:
    -   **Fake It** → return a constant.
    -   **Triangulation** → generalize only when a 2nd test forces it.
    -   **Obvious Implementation** → only when truly trivial.
3.  **Refactor**: Improve design of **both production code AND tests** without changing behavior. MANDATORY — never skip. All tests stay green throughout.

---

### 2. Behavior over Implementation

-   **Black-box**: Test *what* (observable outcome), not *how* (private state/methods).
-   **Robustness**: Tests survive internal refactors if external behavior is unchanged.
-   **Assertion priority (prefer top-down)**:
    1.  Return value.
    2.  Observable state change.
    3.  Interaction / side-effect (API call, log, event) — only when 1 & 2 are infeasible.
-   **Don't mock what you don't own**: wrap third-party deps behind your own port, mock the port.

---

### 3. Test Quality — FIRST

-   **Fast** — milliseconds per unit test; slow suites kill the cycle.
-   **Independent/Isolated** — no shared state, no ordering assumptions, no hidden fixtures.
-   **Repeatable** — deterministic across machines/runs; control clock, randomness, I/O.
-   **Self-validating** — pass/fail is boolean; no human inspection of logs/output.
-   **Timely** — written just before the production code that makes them pass.

---

### 4. Antipatterns (forbidden)

-   **Anchor Test** — asserting the *absence* of removed code/features.
-   **Legacy Ballast** — tests kept alive after the feature they cover is gone or replaced.
-   **Change-Detector** — tests that re-state the implementation; break on every refactor.
-   **Over-mocking** — mocking internals you own instead of refactoring for testability.
-   **Conditional logic in tests** — `if`/`try`/loops that hide assertion paths.
-   **Shared mutable fixtures** across tests (breaks Independent).
-   **Assertion roulette** — many unrelated assertions in one test with no message.

---

### 5. Structure

-   **File naming**: `tests/<agentOrSubject>.test.ts` at the repo `tests/` root (matches existing convention: `communityManager.test.ts`, `eli5ModerationRunner.test.ts`, …). Co-located shared fixtures live under `tests/test_suites/`.
-   **Test naming**: describe behavior, not code. This repo uses vitest's `describe` + `it("should …")` form. Prefer:
    -   `it("should <expected> when <condition>", …)`, or
    -   `it("given <context>, when <action>, then <outcome>", …)`.
-   **One behavior per test.** Prefer a single logical assertion (one concept, not one line).
-   **AAA layout**: `// Arrange` → `// Act` → `// Assert`, visually separated.
-   **Independence**: no execution-order coupling. Use `beforeEach` to rebuild mocks (see `tests/communityManager.test.ts` for the canonical pattern); never share mutable state across `it` blocks.

---

### 6. Test Doubles (Meszaros taxonomy)

Use the *least powerful* double that works:

-   **Dummy** — passed but never used.
-   **Stub** — returns canned data (state verification).
-   **Fake** — working lightweight impl (e.g., in-memory repo).
-   **Spy** — stub that also records calls.
-   **Mock** — pre-programmed with expectations (interaction verification).

Prefer Stub/Fake + state assertions over Mock + interaction assertions.

---

### 7. Specifics

-   **Async**: use vitest helpers — `await expect(promise).resolves/rejects`, `vi.useFakeTimers()` + `vi.advanceTimersByTimeAsync()`, `vi.waitFor()`, `expect.poll()`. Never call `setTimeout(..., sleep)` to wait. Telegram/Discord retry logic must be tested with fake timers, not real delays (see `tests/eli5ModerationRunner.test.ts` `callTelegramApi` retry test).
-   **Time/Random/IO**: inject via seams. Wrap `Date.now`, `crypto.randomUUID`, `fs`, network, and `discord.js`/`@telegraf/*` clients behind a port; mock the port with `vi.fn()`. Never hit a real Discord/Telegram API or RPC endpoint in unit tests.
-   **elizaOS runtime**: build a typed mock of `IAgentRuntime` (cast via `as unknown as IAgentRuntime`) — see `tests/communityManager.test.ts`. Do not import live `@elizaos/core` services.
-   **Solana / on-chain**: never call live RPC. Stub the `@elizaos/plugin-solana` provider behind a port and assert against state, not interactions.
-   **Coverage**: an outcome, not a target. Run `bunx vitest run --coverage` for visibility. For high-risk modules (moderation policy, Telegram error handling, on-chain actions), run Stryker (`bunx stryker run`) before merge to verify *test strength*, not just line coverage.
-   **Test-resistant code**: treat as a design smell → refactor (DI, hexagonal ports, pure functions). Do **not** weaken tests. The agent boundary (`src/<agent>/index.ts` character config) is a known TDD-Bypass zone; the moderation/runtime logic underneath must be fully tested.
-   **TDD-Bypass** (last resort, reviewer-gated): production-only code that genuinely cannot be unit-tested (e.g., `src/index.ts` env-gating + `ProjectAgent` wiring, character config in `src/<agent>/index.ts`, dotenv bootstrap) may carry `// TDD-Bypass: <reason, approver>`. Must be:
    -   minimal in size,
    -   free of business logic (logic moves into a tested helper),
    -   covered by `bun run test` (elizaOS integration test) instead,
    -   explicitly approved in code review or a `docs/decisions/` ADR.

---

### 8. Checklist (per change)

- [ ] Saw the test fail first, for the right reason (Red)?
- [ ] Wrote only the **minimum** code to pass (Green)?
- [ ] Refactored **both** production code and tests (Refactor)?
- [ ] Test asserts observable behavior, not internal details?
- [ ] Test name describes behavior (not method name / implementation)?
- [ ] AAA structure visible?
- [ ] FIRST respected (fast, independent, repeatable, self-validating, timely)?
- [ ] Correct test double chosen (weakest that works)?
- [ ] Edge cases & boundaries covered (empty, null, max, error paths)?
- [ ] No anchor tests, legacy ballast, or change-detectors introduced?
- [ ] If `TDD-Bypass` used: justified, minimal, and covered elsewhere?

---

### 9. Spectra integration

This repo uses **Spectra** for spec-driven development. TDD lives *inside* the Spectra `apply` step — not beside it.

- A Spectra change's `tasks.md` (managed by `/spectra-apply`) is the single source of truth for progress. Each task that touches behavior expands into Red → Green → Refactor inside that one checkbox; do not split TDD steps into separate Spectra tasks.
- The proposal's `## Impact` section lists the production files that will change. The corresponding test files in `tests/` are implied — write them first as part of the Red step before editing the production file.
- Before marking a Spectra task complete, run at minimum the agent's own suite: `bun run test:<agent>`. Before `/spectra-archive`, run the full pre-merge suite from `QUALITY_GATES.md`.
- Mutation runs (Stryker) are not required per task. Run them at the change level for risky changes (moderation, on-chain, security) and record results in the change's `proposal.md` or a follow-up ADR.

---

**Related:** `ARCHITECTURE.md`, `QUALITY_GATES.md`, `docs/testing/TDD_EXAMPLES.md`, `openspec/` (Spectra changes and specs).
