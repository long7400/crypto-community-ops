# TDD Rules for crypto-community-ops

> **Project stack:** TypeScript ESM, Vitest, elizaOS runtime mocks, and Bun for package scripts.
>
> **Scope of edits (contract for AI agents):** This file — `TDD_RULES.md` — is the **only** TDD document agents customize to fit the project. `docs/testing/TDD_EXAMPLES.md` is a **fixed reference** that illustrates what TDD compliance looks like for each rule below; agents MUST NOT edit it to match the project's language/framework. Read it as intent, then translate snippets in your head to the stack declared in `AGENTS.md`.

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

-   **File naming**: Prefer `tests/<feature>.test.ts` for repo-level behavior and `src/**/__tests__/*.test.ts` only when the existing module already uses co-located tests.
-   **Test naming**: use Vitest `describe`/`it` names that describe behavior, not implementation. Existing tests mostly use `it("should ...")`; match the nearby file.
-   **One behavior per test.** Prefer a single logical assertion (one concept, not one line).
-   **AAA layout**: `// Arrange` → `// Act` → `// Assert`, visually separated.
-   **Independence**: no execution-order coupling; each test sets up and tears down its own world.

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

-   **Async**: use `await expect(promise).resolves/rejects`, `vi.fn()`, `vi.spyOn()`, and fake timers such as `vi.useFakeTimers()` / `vi.setSystemTime()` when touching time-dependent code. Never add real sleeps to unit tests.
-   **Time/Random/IO**: inject through runtime mocks, service ports, clock/RNG seams, or filesystem fixtures — never call real platform services in unit tests.
-   **Coverage**: an outcome, not a target. No mutation tool is configured yet; prefer stronger behavior tests over line-count chasing.
-   **Test-resistant code**: treat as a design smell → refactor (DI, hexagonal ports, pure functions). Do **not** weaken tests.
-   **TDD-Bypass** (last resort, reviewer-gated): production-only code that genuinely cannot be unit-tested (e.g., `main()`, DI wiring, platform bootstrap) may carry `// TDD-Bypass: <reason, approver>`. Must be:
    -   minimal in size,
    -   free of business logic,
    -   covered by an integration/E2E test instead,
    -   explicitly approved in code review.

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

**Related:** `ARCHITECTURE.md`, `QUALITY_GATES.md`, `docs/testing/TDD_EXAMPLES.md`.
