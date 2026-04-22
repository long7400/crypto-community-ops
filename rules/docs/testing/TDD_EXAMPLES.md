# TDD Examples for AI Agent

> **Read-only reference.** One block per rule in `TDD_RULES.md`, illustrating what TDD compliance *looks like* as intent. Snippets are **neutral pseudo-code**, not any real language — do not pattern-match to JS/Python/Java.
>
> **Do NOT edit.** No translation, no parameterization. Stack lives in `AGENTS.md`; rule customization lives in `TDD_RULES.md`.

**Index** (one section per rule in `TDD_RULES.md`):

1. Red → Green → Refactor — Beck's 3 strategies
2. Behavior over Implementation — assertion priority 1 → 2 → 3
3. FIRST — Fast, Independent, Repeatable, Self-validating, Timely
4. Antipatterns — all 7 forbidden shapes
5. Structure — naming, one-behavior, AAA
6. Test Doubles — Dummy → Stub → Fake → Spy → Mock
7. Specifics — seams, mutation, refactor-for-testability, TDD-Bypass
8. Edge-case discipline (checklist-aligned)

---

### 1. Rule 1 — Red → Green → Refactor (with Beck's 3 strategies)

```
# RED — smallest failing test first; production stub throws to compile
TEST "sum of empty is 0":
    ASSERT_EQUALS  sum([])  ==  0
DEFINE sum(xs):  RAISE NotImplemented

# GREEN — Fake It: a constant passes the single test. No generality yet.
DEFINE sum(xs):  RETURN 0

# RED #2 — Triangulate: a second test forces generalization
TEST "sum of [5] is 5":       ASSERT_EQUALS  sum([5])      ==  5
TEST "sum of [1,2,3] is 6":   ASSERT_EQUALS  sum([1,2,3])  ==  6

# GREEN — Obvious Implementation is now justified by pressure from tests
DEFINE sum(xs):  RETURN fold(xs, 0, +)

# REFACTOR — improve BOTH test and production code; behavior unchanged
PARAMETERIZED_TEST "sum(%xs) == %r" over:
    ([], 0), ([5], 5), ([1,2,3], 6), ([-1, 1], 0)
    ASSERT_EQUALS  sum(xs)  ==  r
```

Choice rule: **Fake It** first, **Triangulate** when a 2nd test forces it, **Obvious** only when truly trivial.

---

### 2. Rule 2 — Behavior over Implementation (assertion priority 1 → 2 → 3)

```
# BAD — Change-Detector: asserts PRIVATE internals (couples to how, not what)
ASSERT_EQUALS  list._rawUsers.length          ==  2
ASSERT_TRUE    list.__activeFilter.isApplied

# GOOD (priority 1) — return value of a public API
TEST "getActiveUsers returns only active":
    # Arrange
    list = UserList OF [{id:1,active:true}, {id:2,active:false}]
    # Act
    result = list.getActiveUsers()
    # Assert
    ASSERT_LENGTH  result  ==  1
    ASSERT_EQUALS  result[0].id  ==  1

# GOOD (priority 2) — observable state after the action
TEST "addItem increases cart total":
    cart = Cart()
    cart.addItem(price = 10)
    cart.addItem(price = 15)
    ASSERT_EQUALS  cart.total()  ==  25

# GOOD (priority 3) — interaction, only when no value/state is observable
TEST "logout emits session-ended event":
    bus = RecordingEventBus()
    Session(bus).logout()
    ASSERT_CONTAINS  bus.events  ==  [ "session.ended" ]
```

Rule of thumb: **prefer return value → observable state → interaction**, in that order. **Don't mock what you don't own** — wrap a vendor SDK behind a port you own, then mock the port.

---

### 3. Rule 3 — FIRST (Fast, Independent, Repeatable, Self-validating, Timely)

```
# Fast — unit tests run in milliseconds; push slow things out as seams
# BAD:   test hits real HTTP + real DB   → seconds per case → cycle dies
# GOOD:  inject a FakeRepo + FakeHttpPort

# Independent — no shared mutable state; each test sets up its own world
# BAD — hidden global fixture shared across tests:
sharedUser = new User(...)                  # mutated by test A, read by test B
TEST "A mutates": sharedUser.name = "x"; ...
TEST "B reads":   ASSERT_EQUALS sharedUser.name == "x"    # order-dependent!
# GOOD — each test constructs its own inputs:
TEST "A": user = new User(...); ...
TEST "B": user = new User(...); ...

# Repeatable — deterministic across machines/runs; control clock, RNG, I/O
# BAD:   uses WallClock.now() and RealRandom.next() directly
# GOOD:  accepts a Clock port + RNG port; tests pass FakeClock(fixed=...) + FakeRNG(seed=...)

# Self-validating — pass/fail is boolean; no human eyeballing logs
# BAD:   print(result);   # "looks ok"
# GOOD:  ASSERT_EQUALS result == expected

# Timely — tests are written JUST BEFORE the production code that makes them pass.
# Writing tests weeks after the fact = "test theater", not TDD.
```

---

### 4. Rule 4 — Antipatterns to delete on sight (all 7)

```
# 1) Anchor — asserts the ABSENCE of removed code
TEST "no LegacyAuth symbol":  ASSERT_UNDEFINED  global.LegacyAuth

# 2) Legacy Ballast — feature removed, test kept alive
TEST "supports MD5 passwords":  ...        # MD5 gone 2 releases ago

# 3) Change-Detector — mirrors the call sequence inside the SUT
TEST "calls _normalize then _persist then _emit":
    ASSERT_CALL_ORDER  spy  ==  [ _normalize, _persist, _emit ]

# 4) Over-mocking — mocking internals you own (fix = refactor, not mock)
TEST "service works":
    repo = MOCK(UserRepository)          # YOU own UserRepository
    repo.findById(1).returns(user)       # should be a Fake or Stub + state assert
    ...

# 5) Conditional logic in tests — hides branches, makes failure ambiguous
TEST "bad":
    IF env == "ci":  ASSERT_EQUALS f()  ==  1
    ELSE:            ASSERT_EQUALS f()  ==  2
# FIX: two separate tests, one per branch; remove env coupling.

# 6) Shared mutable fixtures — hidden coupling between tests
GLOBAL bag = []
TEST "push":   bag.push(1); ASSERT_LENGTH bag == 1
TEST "clear":  bag.clear(); ...           # order-dependent
# FIX: build `bag` fresh inside each test.

# 7) Assertion Roulette — many unrelated asserts, no message → which failed?
TEST "user flow":
    ASSERT_TRUE  user.created
    ASSERT_TRUE  email.sent
    ASSERT_TRUE  audit.logged
    ASSERT_TRUE  metric.incremented
# FIX: split into focused tests OR add assertion messages.

# Replacement pattern for anchor/ballast/change-detector: assert CURRENT behavior
TEST "authenticates with valid credentials":
    auth = NewAuth(repo = StubRepo({ "u": hash("p") }))
    ASSERT_TRUE  auth.login("u", "p")
```

---

### 5. Rule 5 — Structure (naming, one behavior, AAA)

```
# File naming — match project convention (only ONE is chosen per repo):
#   src/user_list.[ext]   →   test/user_list.test.[ext]
#   src/UserList.[ext]    →   test/UserListSpec.[ext]

# Test naming — pick ONE convention and stick to it for the whole repo.
# (a) should_<expected>_when_<condition>
TEST "should_return_empty_list_when_no_users_match_filter"

# (b) given_<context>_when_<action>_then_<outcome>
TEST "given_empty_cart_when_checkout_then_raises_empty_cart_error"

# One behavior per test — one concept, not one line.
# BAD — two unrelated behaviors packed in:
TEST "user crud":
    create(u); ASSERT_EXISTS  find(u.id)
    delete(u); ASSERT_MISSING find(u.id)
# GOOD:
TEST "create_persists_user":      create(u); ASSERT_EXISTS  find(u.id)
TEST "delete_removes_user":       create(u); delete(u); ASSERT_MISSING find(u.id)

# AAA layout — visible sections (blank lines or comments)
TEST "discount_applied_on_total_above_100":
    # Arrange
    cart = Cart with items totalling 120
    # Act
    total = cart.finalTotal()
    # Assert
    ASSERT_EQUALS  total  ==  108        # 10% off
```

---

### 6. Rule 6 — Test Doubles: pick the weakest one that works (all 5 types)

```
# DUMMY — value passed but never used; satisfies a signature
TEST "login_ignores_logger_when_credentials_valid":
    dummyLogger = DUMMY(Logger)                    # never called in this path
    ASSERT_TRUE  Auth(repo, dummyLogger).login("u", "p")

# STUB — returns canned data; no behavior verification
TEST "greeting_uses_repo_name":
    repo = STUB(UserRepo).findById(1).returns( User(name="Alice") )
    ASSERT_EQUALS  Greeter(repo).greet(1)  ==  "Hello, Alice"

# FAKE — working lightweight implementation (state-based, PREFERRED)
TEST "email_recorded_in_outbox":
    outbox = InMemoryOutbox()                      # Fake
    Notifier(outbox).onUserCreated({ email: "a@b.c" })
    ASSERT_EQUALS  outbox.messages  ==  [ { to: "a@b.c" } ]

# SPY — stub that ALSO records calls (use when state is not observable)
TEST "audit_log_spy_records_login":
    audit = SPY(AuditPort)
    Auth(repo, audit).login("u", "p")
    ASSERT_CALLED_WITH  audit.log  ==  ( "login.success", userId=1 )

# MOCK — preprogrammed expectations (interaction verification; LAST resort)
TEST "invokes_owned_email_port_exactly_once":
    gateway = MOCK(EmailGateway)                   # port WE own
    EXPECT  gateway.send  CALLED_TIMES  1  WITH  "a@b.c"
    Notifier(gateway).onUserCreated({ email: "a@b.c" })
    VERIFY  gateway
```

Preference order (strongest coupling last): **Dummy → Stub → Fake → Spy → Mock**. Prefer Fake + state over Mock + interaction. Never mock code you don't own.

---

### 7. Rule 7 — Specifics: seams, coverage, refactor-for-testability, TDD-Bypass

#### 7a. Async / Time / Randomness — inject seams, never call real `sleep`, wall clock, or RNG

```
TEST "retries_twice_then_succeeds":
    # Arrange — all non-determinism is behind ports we own
    clock = FakeClock()
    rng   = FakeRNG(seed = 42)                     # if jitter is used
    api   = STUB(Api).getUser:
              call 1 → THROWS Timeout
              call 2 → THROWS Timeout
              call 3 → RETURNS User(name="Alice")
    service = UserService(api, clock, rng)

    # Act — drive time forward deterministically; no real sleep
    future  = service.getUserData(1)               # background retry loop
    clock.advanceBy(2 seconds)                     # simulated, not real
    clock.advanceBy(2 seconds)

    # Assert — observable outcome + interaction count
    ASSERT_EQUALS        future.result().name  ==  "Alice"
    ASSERT_CALLED_TIMES  api.getUser  ==  3
```

#### 7b. Coverage is an outcome — measure *test strength* with mutation, not just lines

```
# Line coverage 100% but ZERO mutation killed → tests are weak.
# Run mutation tool periodically; investigate SURVIVED mutants as missing tests.
# Example mutant survival:
#   original:   IF amount >  100: applyDiscount()
#   mutant:     IF amount >= 100: applyDiscount()      # boundary flipped
#   → if all tests pass on the mutant, add a boundary test at amount == 100.
```

#### 7c. Test-resistant code = design smell → refactor, do not weaken the test

```
# BAD — hard to test: wall clock and RNG hard-coded inside
CLASS TokenFactory
    DEFINE issue(userId):
        now   = WallClock.now()                    # real time
        nonce = RealRandom.next()                  # real RNG
        RETURN Token(userId, now, nonce)

# GOOD — seams injected; now fully testable with FakeClock + FakeRNG
CLASS TokenFactory  TAKES  clock, rng
    DEFINE issue(userId):
        RETURN Token(userId, clock.now(), rng.next())
```

#### 7d. TDD-Bypass — rare, reviewer-gated, non-logic only

```
# TDD-Bypass: platform entrypoint, no business logic.
# Reason:     DI wiring + process start only.
# Coverage:   exercised by e2e/smoke test "boot_succeeds".
# Approved-by: <reviewer>
DEFINE main():
    wireContainer().start()
```

Conditions (all must hold): minimal size · zero business logic · covered by integration/E2E · explicit reviewer approval in code review.

---

### 8. Edge-case discipline (checklist-aligned)

For every new behavior, cover these branches explicitly: **happy · empty/null · boundary (min/max/off-by-one) · invalid · idempotence**. This maps to the checklist item *"Edge cases & boundaries covered"* in `TDD_RULES.md` §8.

```
PARAMETERIZED_TEST "validate(%name)" over:
    ( "empty",     "",                   EXPECT_THROWS "input required" )
    ( "too_long",  repeat("a", MAX + 1), EXPECT_THROWS "input too long" )
    ( "min",       "a",                  EXPECT_OK     "a"              )
    ( "max",       repeat("a", MAX),     EXPECT_OK     repeat("a", MAX) )
    ( "null",      NULL,                 EXPECT_THROWS "input required" )
```

---

> Keep it dense. Code over prose. If a snippet looks like a real language, it isn't — translate intent via `AGENTS.md`.
