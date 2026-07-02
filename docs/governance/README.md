# Governance Docs

This directory is evidence-heavy by design. Treat it as an archive plus a small
current map, not as the primary operating surface.

## Current Surface

- [current state](../current/CURRENT_STATE.md): current branch, validation,
  execution boundary, and next safe action.
- [validation tiers](../validation-tiers.md): recommended local validation
  entry points and explicit smoke boundaries.
- [read-only productization acceptance](READONLY_PRODUCTIZATION_ACCEPTANCE.md):
  current read-only acceptance boundary.
- [source/release package boundary](SOURCE_RELEASE_PACKAGE_BOUNDARY.md):
  source and release package separation.
- [capability taxonomy escalation policy](CAPABILITY_TAXONOMY_ESCALATION_POLICY.md):
  capability classes and escalation stops.
- [approval consumption dispatch matrix](APPROVAL_CONSUMPTION_DISPATCH_AUDIT_MATRIX.md):
  approval consumption and dispatch evidence matrix.
- [PR-22A controlled provider execution taskbook](PR_22A_CONTROLLED_PROVIDER_EXECUTION_TASKBOOK.md):
  local-only planning line for the next controlled provider execution slice;
  this is not execution authorization.

## Runner Entry Points

Use the consolidated runner instead of per-check package scripts:

```bash
npm run governance -- list
npm run governance -- list --all
npm run governance -- audit state-sync
npm run governance -- audit controlled-provider-execution-taskbook-review
npm run governance -- acceptance readonly-chain
npm run governance -- operator readonly
```

Default `list` output stays focused on current/core checks. Use `--all` only
when deliberately browsing archived one-off audit and acceptance commands.

## Historical Evidence

- `PR_*_TASKBOOK.md`: scoped task plan or authorization taskbook.
- `PR_*_AUTHORIZATION_PACKET.md`: explicit future-execution gate.
- `PR_*_LOCAL_CLOSEOUT.md`: local closeout evidence for a completed slice.
- `PR_*_RECEIPT*.md`: receipt or review pass for a controlled run.
- `FUTURE_*`: draft gates for future controlled execution; not authorization
  by themselves.

When a boundary changes, update this index and the current state surface. When a
single historical slice changes, update the specific PR document only.
