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

## Default secure posture

- Parse untrusted input at boundaries.
- Prefer allowlists over implicit trust.
- Fail closed when permission checks are unclear.
- Do not log secrets or sensitive payloads.
- Do not widen access in the name of convenience without approval.

## What agents should do when unsure

If the task touches a risky area and the intended behavior is not explicit in repository docs, stop and ask for approval before implementing.

## Security validation prompts

When reviewing a risky change, ask:

- What new trust boundary is introduced?
- What happens on malformed or hostile input?
- Can this change leak secrets or sensitive data into logs?
- Can this change widen access or bypass an existing check?
- Is rollback safe if the change behaves unexpectedly?

## Related docs

- `README.md`
- `ARCHITECTURE.md`
- `QUALITY_GATES.md`
- `TDD_RULES.md`
- `PRODUCT_SENSE.md`
