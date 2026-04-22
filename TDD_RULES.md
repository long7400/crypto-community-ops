# TDD Rules for `crypto-community-ops`

> Project stack: TypeScript ESM, Bun, and Vitest.
>
> This file is the project-specific TDD contract. `rules/docs/testing/TDD_EXAMPLES.md`
> is a read-only intent reference; do not edit it to match repo syntax.
>
> Use this file together with `AGENTS.md`, `ARCHITECTURE.md`,
> `QUALITY_GATES.md`, and `SECURITY.md`.

## Project defaults

- Prefer the smallest runnable Vitest target first: `bunx vitest <file>`.
- Then run the nearest area suite when it exists:
  - `bun run test:communityManager`
  - `bun run test:devRel`
  - `bun run test:liaison`
  - `bun run test:projectManager`
  - `bun run test:socialMediaManager`
- Use `bun run test:the-org` as the broader project suite for the main root
  tests, but do not assume it covers every colocated test under `src/`.
- If you change colocated tests such as
  `src/projectManager/plugins/team-coordinator/teamCoordinator.test.ts` or
  `src/loadTest/__tests__/*.test.ts`, run them directly with `bunx vitest ...`.
- `bun run test` is the elizaOS harness, not a replacement for focused
  regression tests in the TDD loop.
- `bun run format:check` currently checks `src/` only. When you change tests or
  docs, do not treat that command as proof those files were formatted.

## 1. Mandatory Cycle: Red -> Green -> Refactor

1. **Red**: write the smallest failing test first and prove it fails for the
   right reason.
   - Prefer the nearest owning test file or create one in the established
     location for that area.
   - For bug fixes in `src/init.ts`, Telegram/Discord onboarding, moderation,
     or team coordinator storage/scheduling, add a regression test before the
     production fix unless a human approval gate blocks the change.
2. **Green**: write the minimum production code that passes.
   - Use Beck's strategies deliberately:
     - **Fake It** for the first narrow behavior.
     - **Triangulate** when a second failing case forces generalization.
     - **Obvious Implementation** only when the behavior is truly trivial.
3. **Refactor**: improve both production code and tests while keeping behavior
   stable.
   - Re-run the focused test after each meaningful refactor.
   - If the code is still hard to test after Green, that is a design smell, not
     a reason to weaken the test.

## 2. Behavior over Implementation

- Assert observable behavior first:
  1. return values
  2. persisted state or created memory records
  3. emitted platform calls or service interactions only when 1 and 2 are not
     available
- For character and plugin wiring, prefer asserting plugin inclusion, secret
  mapping, onboarding messages, created room/memory shapes, or boundary-facing
  runtime calls instead of private helper sequencing.
- Do not mirror internal call order inside `src/init.ts`,
  `src/communityManager/plugins/...`, or team coordinator internals unless that
  ordering is itself the contract.
- Do not assert raw log lines unless the log message is part of a searchable
  operational contract such as a stable error code.
- Do not mock third-party behavior you do not own if a small port, fake, or
  runtime helper will do.

## 3. FIRST for this repo

- **Fast**: pure logic tests should stay in milliseconds. Runtime wiring,
  mocked-platform, or temp-db tests should stay under a couple seconds when
  practical. Long-running load tests belong in explicitly heavier test files,
  not in the default red-green loop.
- **Independent**: every test builds its own runtime, service, and input data.
  No shared mutable mocks across tests. No dependence on the current `.env`.
- **Repeatable**: use `vi.useFakeTimers()`, `vi.advanceTimersByTimeAsync()`,
  fixed inputs, temp directories, and deterministic stubs. Never use `sleep()`
  to wait for behavior.
- **Self-validating**: pass/fail must come from `expect(...)`, not from reading
  logs or manual runtime output.
- **Timely**: write the test immediately before the production change it forces.
  Retrofitting a regression test after the fact is acceptable only if you still
  reproduce the failure first.

## 4. Antipatterns to reject

- **Anchor tests** that assert removed code stays gone.
- **Legacy ballast** that covers behavior the product no longer supports.
- **Change-detector tests** that restate private implementation steps.
- **Over-mocking** internals you own instead of making the code testable.
- **Conditional logic in tests** that hides which assertion path ran.
- **Shared mutable fixtures** across `describe` blocks or files.
- **Real platform I/O** in routine unit tests: no live Telegram/Discord clients,
  no real tokens, no real outbound publishing.
- **Assertion roulette**: too many unrelated expectations in one test with no
  clear single behavior.

## 5. Structure and placement

- File naming convention in this repo is `*.test.ts`.
- Use the existing placement pattern instead of inventing a new one:
  - `tests/*.test.ts` for root agent suites and cross-agent scenarios
  - `tests/test_suites/*.ts` for reusable harnesses and scenario builders
  - colocated tests only where the repo already does that, such as
    `src/projectManager/plugins/team-coordinator/teamCoordinator.test.ts` and
    `src/loadTest/__tests__/`
- Match the prevailing Vitest naming style:
  - `it("should <outcome> when <condition>")`
- One behavior per test. If a test name contains `and`, it is usually trying to
  cover too much.
- Keep Arrange, Act, and Assert visually distinct with whitespace or short
  comments when the setup is non-trivial.
- If setup becomes noisy, extract a small helper or builder in the local test
  file or in `tests/test_suites/` rather than hiding the behavior under a giant
  opaque fixture.

## 6. Test doubles in Vitest

Use the weakest double that works:

- **Dummy**: a placeholder argument that the code path does not use.
- **Stub**: canned return values through plain objects or `vi.fn()`.
- **Fake**: lightweight in-memory implementation for state-based assertions.
- **Spy**: `vi.fn()` or `vi.spyOn()` when interaction is part of the contract.
- **Mock**: pre-programmed expectation-heavy interaction checks as a last
  resort.

Repo-specific guidance:

- Prefer small plain-object runtimes and service doubles over deep global
  module mocks.
- Reuse helpers like `tests/test_suites/TelegramTestSuite.ts` when they reduce
  setup without hiding the behavior under test.
- When storage or scheduling logic is involved, prefer deterministic fakes and
  fake timers over timing-based assertions.

## 7. Project-specific specifics

- **Async**: use `await`, `expect(...).resolves`, `expect(...).rejects`, and
  Vitest fake timers. Never pause with arbitrary sleeps.
- **Boundary-heavy areas need focused regression tests**:
  - `src/init.ts`
  - Telegram/Discord onboarding handlers
  - public moderation or publishing logic
  - `src/projectManager/plugins/team-coordinator/`
- **Secrets and env wiring**:
  - do not load real secrets in tests
  - assert mapping and gating behavior with env stubs or `.env.example` when
    documentation/wiring is the contract
- **Character behavior**: test observable persona or platform behavior, not
  private prompt assembly details.
- **Load test code**: keep orchestration logic unit-testable; reserve slow or
  broad scale runs for explicit heavy tests.
- **TDD-Bypass** is rare and must stay tiny:
  - acceptable only for ultra-thin bootstrap or third-party glue with no real
    business logic
  - justify it in code or the task note
  - cover the behavior through a higher-level test when practical

## 8. Checklist per change

- [ ] Did I run a focused test first and see it fail for the right reason?
- [ ] Did I write only the minimum code required to pass?
- [ ] Did I refactor both test and production code after Green?
- [ ] Does the test assert observable behavior at the correct boundary?
- [ ] Does the test use the repo's `*.test.ts` placement and `should ... when ...`
      naming style?
- [ ] Is Arrange / Act / Assert easy to read?
- [ ] Is the test independent of shared env, shared mutable state, and real
      platform I/O?
- [ ] Did I choose the weakest useful test double?
- [ ] Did I cover the relevant edge cases for this repo:
      missing service, malformed metadata, invalid config, empty input,
      timer expiry, or unavailable platform client?
- [ ] If I changed colocated tests under `src/`, did I run them directly instead
      of assuming `bun run test:the-org` covered them?
- [ ] If I changed a durable testing rule, did I update the matching doc?

**Related:** `ARCHITECTURE.md`, `QUALITY_GATES.md`, `SECURITY.md`,
`rules/docs/testing/TDD_EXAMPLES.md`.
