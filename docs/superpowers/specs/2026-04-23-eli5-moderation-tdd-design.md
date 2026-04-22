# Eli5 Moderation TDD Strategy

Date: 2026-04-23
Target branch: `codex/telegram-moderation-settings`
Source implementation plan: `docs/superpowers/plans/2026-04-22-telegram-moderation-settings.md`
Primary rule set: `TDD_RULES.md`

## Purpose

Apply TDD to Eli5 Telegram moderation after implementation already exists. The goal is not to rewrite the feature from scratch. The goal is to make the existing moderation work auditable against this repo's TDD contract, with strict red-green-refactor evidence on the highest-risk public behavior and a lighter compliance pass on low-risk pure logic.

## Scope

In scope:

- Eli5 moderation under `src/communityManager/plugins/communityManager/moderation/`
- Telegram greeting behavior in `src/communityManager/plugins/communityManager/communityService.ts`
- Existing moderation tests on the feature branch
- TDD evidence expectations for focused Vitest runs and nearest-area suites

Out of scope:

- Re-implementing the whole moderation feature from zero
- Discord moderation
- A real dashboard or external write surface for `COMMUNITY_MODERATION`
- Enabling `dryRun: false` in any real Telegram group

## Current Observations

The current moderation implementation already exists on `codex/telegram-moderation-settings`, not on `main`.

Observed test ownership on the feature branch:

- `tests/eli5CommunityModerationSettings.test.ts`
  settings defaults, repository persistence, admin command parsing, admin auth
- `tests/eli5CommunityModerationPolicy.test.ts`
  rule classifier, LLM parser, policy engine, audit store
- `tests/eli5ModerationRunner.test.ts`
  normalizer, Telegram adapter, evaluator wiring, runner dry-run path, allowlist guard, admin mutation guard
- `tests/eli5Telegram.test.ts`
  onboarding/greeting behavior plus legacy `TIMEOUT_USER` compatibility

Observed gaps against `TDD_RULES.md`:

1. There is no durable recorded `RED` evidence for the current moderation behavior. The tests pass now, but passing tests alone do not prove TDD happened.
2. Test naming does not consistently follow repo style `should ... when ...`.
3. Some tests cover the right boundary but still combine multiple outcomes in a single example, especially runner and greeting scenarios.
4. The current suite covers the happy path better than the edge-case matrix required by `TDD_RULES.md` section 8: empty or malformed metadata, invalid config, unavailable platform service, and idempotence are not yet uniformly covered.
5. The current suite already uses mostly acceptable plain-object doubles, but the TDD flow needs to state which double class is intended for each test family so later edits do not regress into over-mocking.

## Decision

Use a risk-based hybrid TDD strategy.

This means:

- Public moderation behavior and boundary-heavy paths must get strict `RED -> GREEN -> REFACTOR` treatment.
- Low-risk contracts and pure helpers may use a compliance pass, but they still need failure-first proof when a new regression test is added.
- No new production behavior should be added outside this TDD pass.

## Strict TDD Zones

These areas control public moderation behavior, settings mutation, or boundary wiring. They require explicit red-green-refactor evidence.

### 1. Runner and Evaluator

Files:

- `src/communityManager/plugins/communityManager/moderation/moderationRunner.ts`
- `src/communityManager/plugins/communityManager/moderation/telegramModerationEvaluator.ts`
- `tests/eli5ModerationRunner.test.ts`

Why strict:

- This is the live policy entrypoint for Telegram memories.
- It decides whether Eli5 ignores, audits, warns, mutes, or patches settings.
- It is boundary-heavy and explicitly covered by `TDD_RULES.md` for moderation logic.

Required behavior slices:

- should record an audit-only decision when dry-run moderation detects a violation
- should not increment violation state when dry-run is enabled
- should skip moderation when `TELEGRAM_ALLOWED_CHATS` excludes the chat
- should reject non-admin settings mutation attempts
- should persist settings and send a summary when an admin command is valid
- should skip exempt Telegram users

Preferred `RED` tactic:

- Add one smallest missing edge-case test at a time and run `bunx vitest tests/eli5ModerationRunner.test.ts`.
- If the behavior is already fully implemented and no missing edge-case remains, temporarily break the specific behavior locally in the working tree, prove the focused test fails for the expected reason, then restore and run green again. This temporary break is evidence work, not a committed change.

### 2. Telegram Greeting Boundary

Files:

- `src/communityManager/plugins/communityManager/communityService.ts`
- `tests/eli5Telegram.test.ts`

Why strict:

- Greeting is public Telegram behavior.
- The logic now bridges legacy settings and `COMMUNITY_MODERATION`.
- The plan explicitly calls out payload-shape drift risk between `new_chat_member` and `new_chat_members`.

Required behavior slices:

- should greet with legacy settings when moderation greeting settings are absent
- should skip greeting when both legacy and moderation greeting are disabled
- should prefer `COMMUNITY_MODERATION.platforms.telegram.greeting`
- should preserve room and memory creation shape when greeting succeeds
- should preserve legacy `TIMEOUT_USER` availability while automation goes through the evaluator

Preferred `RED` tactic:

- Introduce missing boundary cases first, especially malformed or absent moderation metadata.
- If needed, temporarily remove the moderation greeting preference locally, prove the focused greeting test fails, then restore.

### 3. Telegram Adapter and Admin Boundary

Files:

- `src/communityManager/plugins/communityManager/moderation/telegramAdapter.ts`
- `src/communityManager/plugins/communityManager/moderation/adminAuth.ts`
- `src/communityManager/plugins/communityManager/moderation/adminConfig.ts`
- `tests/eli5ModerationRunner.test.ts`
- `tests/eli5CommunityModerationSettings.test.ts`

Why strict:

- These files sit at the platform boundary or permission boundary.
- Wrong behavior here can silently widen moderator access or fail to enforce Telegram capability checks.

Required behavior slices:

- should send warning text through Telegram message manager when service is available
- should fail closed when Telegram moderation service is unavailable
- should reject mute when the bot lacks restrict permission
- should allow configured admin user IDs
- should allow Telegram administrators from `getChatMember`
- should ignore malformed admin JSON patch commands

Preferred `RED` tactic:

- Add missing failure-mode tests first.
- Use plain-object runtime stubs and spies, not module-level mocks.

## Compliance-Only Zones

These areas are still important, but they are mostly pure logic or stable contracts. They do not require a full replay of the feature from zero.

Files:

- `tests/eli5CommunityModerationSettings.test.ts`
- `tests/eli5CommunityModerationPolicy.test.ts`
- `src/communityManager/plugins/communityManager/moderation/types.ts`
- `defaults.ts`
- `settingsRepository.ts`
- `normalizer.ts`
- `ruleClassifier.ts`
- `llmClassifier.ts`
- `policyEngine.ts`
- `recentMessageStore.ts`
- `violationStore.ts`
- `auditStore.ts`

Compliance work required:

- rename tests to `should ... when ...`
- split any test that clearly asserts more than one behavior
- add edge-case tests where coverage is obviously missing
- prefer return value and persisted memory shape over private interaction sequencing

These files may still get strict TDD treatment if a bug is found during the pass, but they do not need a blanket replay.

## TDD Matrix

| Plan area | Production owner | Test owner | TDD level | First proof target |
| --- | --- | --- | --- | --- |
| settings contract and merge | `defaults.ts`, `types.ts` | `tests/eli5CommunityModerationSettings.test.ts` | compliance | wrong default ladder or dropped nested default |
| settings persistence | `settingsRepository.ts` | `tests/eli5CommunityModerationSettings.test.ts` | compliance | overwrite of unrelated world settings |
| admin parsing and auth | `adminConfig.ts`, `adminAuth.ts` | `tests/eli5CommunityModerationSettings.test.ts` | strict | malformed patch or non-admin mutation |
| message normalization | `normalizer.ts` | `tests/eli5ModerationRunner.test.ts` | compliance | malformed Telegram memory metadata |
| deterministic classifier | `ruleClassifier.ts` | `tests/eli5CommunityModerationPolicy.test.ts` | compliance | flood, repeat, link, mention boundaries |
| LLM parse fallback | `llmClassifier.ts` | `tests/eli5CommunityModerationPolicy.test.ts` | compliance | invalid JSON or out-of-range confidence |
| policy escalation | `policyEngine.ts`, `violationStore.ts` | `tests/eli5CommunityModerationPolicy.test.ts` | compliance | reset window, disabled category, min severity |
| audit persistence | `auditStore.ts` | `tests/eli5CommunityModerationPolicy.test.ts` | compliance | missing moderation metadata |
| Telegram enforcement | `telegramAdapter.ts` | `tests/eli5ModerationRunner.test.ts` | strict | bot lacks restrict capability |
| runner orchestration | `moderationRunner.ts`, `telegramModerationEvaluator.ts` | `tests/eli5ModerationRunner.test.ts` | strict | dry-run writes audit without enforcement |
| greeting bridge | `communityService.ts` | `tests/eli5Telegram.test.ts` | strict | moderation greeting overrides legacy path |
| legacy timeout compatibility | `providers/timeout.ts`, `actions/timeout.ts` | `tests/eli5Telegram.test.ts` | strict | manual timeout remains available while automation stays in evaluator |

## Red-Green-Refactor Workflow for Existing Code

For each strict TDD slice:

1. Write or isolate one focused test for one behavior only.
2. Run the smallest target first:
   `bunx vitest tests/eli5ModerationRunner.test.ts`
   or the focused file that owns the behavior under change.
3. Prove `RED` for the correct reason.
   Acceptable proofs:
   - a newly added edge-case test fails on current code
   - a temporary local break proves the existing focused test catches the regression
4. Apply the minimum production change needed to get `GREEN`.
5. Re-run the focused target.
6. Refactor the production code and test naming or structure while keeping the focused target green.
7. Run the nearest area suite:
   `bun run test:communityManager`

For compliance-only areas:

1. Prefer adding missing edge-case tests over rewriting broad existing tests.
2. If the new test already passes, it does not count as TDD evidence by itself.
3. When needed, temporarily break the owning logic locally to prove the test would fail, then restore and re-run green.

## Test Design Rules for This Pass

These rules are mandatory for all Eli5 moderation tests touched during the pass.

- Use repo naming style that starts with `should` and ends with `when ...`.
  For example: `it("should record an audit when dry run detects spam")`
- One behavior per test
- Keep Arrange, Act, Assert visually separate
- Prefer plain-object runtime fakes, stubs, and spies over deep module mocks
- Prefer observable behavior:
  1. return value
  2. persisted world or memory shape
  3. Telegram service interaction only when 1 and 2 are insufficient
- No real Telegram or Discord clients
- No dependence on `.env`
- No `sleep()`; use fake timers if time matters

## Missing Edge Cases to Add First

These are the first missing cases to backfill because they align with `TDD_RULES.md` section 8 and touch public risk.

### Runner and Evaluator

- malformed Telegram memory metadata with missing `chatId`
- unavailable Telegram service on warning path
- exempt user path
- valid admin patch success path, not only denial path
- runner idempotence around repeated dry-run messages in the same thread scope

### Greeting

- moderation greeting disabled while legacy greeting remains enabled
- malformed `COMMUNITY_MODERATION` value should fail closed to legacy settings

### Adapter and Admin

- malformed JSON patch command should stay `ignore`
- Telegram admin lookup failure should deny mutation
- Telegram 429 retry path in `telegramErrors.ts`
- Telegram 400 path should not retry

### Policy and Helper Compliance

- reset window expiry for `policyEngine`
- mention spam threshold in `ruleClassifier`
- invalid or missing `signals` array in LLM parser

## Validation Sequence

During the TDD pass, use this command order:

1. smallest focused file:
   `bunx vitest tests/eli5ModerationRunner.test.ts`
   or the owning file for the slice being worked on
2. nearest suite:
   `bun run test:communityManager`
3. after meaningful batch:
   `bunx tsc -p tsconfig.json --noEmit`
4. before closing the batch:
   `bun run format:check`
   `bun run build`

If a colocated `src/.../*.test.ts` file is touched later, run it directly as required by `TDD_RULES.md`.

## Acceptance Criteria

This TDD strategy is complete when:

- every strict zone has at least one explicit red-green proof captured during the pass
- the touched moderation tests follow repo naming style
- touched tests assert behavior at the correct boundary
- the first-wave missing edge cases above are covered
- Eli5 moderation still passes focused moderation tests and `bun run test:communityManager`
- no moderation behavior is enabled beyond `dryRun: true`

## Risks

- The biggest risk is producing test theater: renaming or expanding tests without real `RED` proof.
- The second risk is over-mocking Telegram behavior and losing boundary confidence.
- The third risk is letting the TDD pass turn into a feature rewrite. This strategy forbids that.

## Next Step

After this spec is reviewed and approved, create an implementation plan for the TDD pass itself. That plan should schedule the work in this order:

1. runner and evaluator strict TDD
2. greeting strict TDD
3. adapter and admin strict TDD
4. compliance pass on settings and policy files
5. batch validation and closeout
