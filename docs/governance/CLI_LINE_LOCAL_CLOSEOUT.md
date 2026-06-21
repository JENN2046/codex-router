# CLI Line Local Closeout

## 1. Purpose

This document records the prior local closeout for the Codex CLI governance
line required by the PR-22A controlled provider execution taskbook review.

It consolidates the read-only productization chain, the recorded bounded
workspace-write canary receipt, rollback verification, and the post-canary
capability taxonomy. It is a local review and audit surface only.

## 2. Required Evidence

The closeout depends on these committed local artifacts:

- `docs/evidence/codex-cli-real-readonly-smoke.json`
- `docs/evidence/codex-cli-workspace-write-real-canary-gate.json`
- `docs/evidence/codex-cli-workspace-write-real-canary-latest.json`
- `docs/governance/READONLY_PRODUCTIZATION_ACCEPTANCE.md`
- `docs/governance/PR_21A_READONLY_FORMAL_INTEGRATION_READINESS_MATRIX.md`
- `docs/governance/CAPABILITY_TAXONOMY_ESCALATION_POLICY.md`

Required prior markers:

- `READONLY_PRODUCTIZATION_FINAL_CLOSEOUT_RECORDED`
- `PR_21A_READONLY_FORMAL_INTEGRATION_READINESS_MATRIX_RECORDED`
- `CAPABILITY_TAXONOMY_ESCALATION_POLICY_RECORDED`

## 3. Closeout Facts

The prior CLI line closeout records that:

- read-only smoke receipt is `passed`
- read-only smoke sandbox is `read-only`
- read-only smoke approval policy is `never`
- bounded workspace-write canary gate is `passed`
- bounded workspace-write canary receipt is `passed`
- bounded workspace-write canary execution status is `completed`
- bounded workspace-write canary exit code is `0`
- fixed target is `tmp/codex-cli-write-canary.txt`
- rollback is verified and the canary file is absent
- capability taxonomy audit passes
- recorded canary evidence remains sanitized

## 4. Capability Boundary

The completed workspace-write result is a `bounded_workspace_write_receipt`.

`general_workspace_write` remains closed.

`general_provider_execution` remains closed.

The recorded canary does not promote future tasks into default write or
execution capability. Future work beyond the fixed canary target must use a new
explicit gate with named scope, rollback, validation, and stop conditions.

## 5. Non-authorization

This closeout does not authorize invoking another real Codex CLI run.

This closeout does not authorize provider execute.

This closeout does not authorize workspace-write execution.

This closeout does not authorize push, release, tag, deployment, remote write,
secret change, or external service write.

## 6. Audit Counters

The closeout audit must keep these counts at `0`:

- provider execute calls during audit
- real Codex CLI calls during audit
- workspace-write calls during audit
- evidence writes during audit

## 7. Result

Result:

- `CLI_LINE_LOCAL_CLOSEOUT_RECORDED`

The CLI governance line is locally closed for PR-22A review purposes. Remaining
actions such as PR publication, push, release, or any broader execution scope
require separate explicit authorization.
