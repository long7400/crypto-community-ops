# Security and Risk Gates

Use this file to keep security-sensitive work from being treated like ordinary refactoring.

## Mandatory human review

Require explicit human review for any change involving:

- auth or permission checks
- secrets, tokens, keys, or session handling
- personally identifiable information
- payments, billing, or financial state
- production deployment or infrastructure policy
- dependency additions with sensitive runtime access
- file deletion, data deletion, or irreversible migration logic
- Discord or Telegram moderation enforcement, including warning, muting, restricting, deleting, or ban-like behavior
- admin detection, allowed-chat filtering, or role/owner detection
- public posting defaults for announcements or social media
- crypto marketing language that implies returns, price movement, compliance status, or investment advice

## Default secure posture

- Parse untrusted input at boundaries.
- Prefer allowlists over implicit trust.
- Fail closed when permission checks are unclear.
- Do not log secrets or sensitive payloads.
- Do not widen access in the name of convenience without approval.
- Keep agent platform tokens in environment variables documented by `.env.example`.
- Use dedicated Telegram bot tokens per agent when possible; shared tokens can create 409 conflicts and make failures hard to diagnose.
- Preserve moderation `dryRun`, audit logging, and violation history when changing enforcement paths.
- Keep LLM classification advisory unless deterministic thresholds, settings, and policy logic also allow the action.

## What agents should do when unsure

If the task touches a risky area and the intended behavior is not explicit in repository docs, stop and ask for approval before implementing.

For low-risk docs or tests that only clarify existing behavior, proceed and list the checks run.

## Security validation prompts

When reviewing a risky change, ask:

- What new trust boundary is introduced?
- What happens on malformed or hostile input?
- Can this change leak secrets or sensitive data into logs?
- Can this change widen access or bypass an existing check?
- Is rollback safe if the change behaves unexpectedly?
- Could an agent speak publicly, moderate a user, or store sensitive community data without clear authorization?
- Does the change preserve the audit trail needed to explain community moderation actions?

## Related docs

- `README.md`
- `ARCHITECTURE.md`
- `QUALITY_GATES.md`
- `TDD_RULES.md`
- `PRODUCT_SENSE.md`
