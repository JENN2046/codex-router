# PR-12B Workspace-write Real Canary Authorization Packet Compatibility

## 1. Workspace

- Workspace: `A:\AGENTS_OS_Workspace\governance\codex-router\repo`
- Review date: 2026-06-14
- Mode: local compatibility review only

## 2. Decision

PR-12B does not reuse or modify the existing Codex CLI workspace-write smoke approval packet.

Reason:

- The existing smoke packet is scoped to the workspace-write smoke target under `docs/evidence`.
- The PR-12B authorization preflight is scoped to the fixed canary target under `tmp`.
- The smoke packet records a smoke confirmation gate and sanitized command preview.
- The PR-12B preflight records exact canary authorization checks as sanitized booleans and reason codes.
- Joining the two implicitly would blur smoke approval, canary authorization, and execution readiness.

## 3. Current Split Of Responsibility

Existing workspace-write smoke approval packet:

- Helper: `createCodexCliWorkspaceWriteSmokeApprovalPacket()`
- Purpose: prepare an operator-facing packet for the existing workspace-write smoke flow.
- Target: `docs/evidence/codex-cli-workspace-write-smoke.txt`
- Includes: sanitized command preview, required smoke gate, rollback summary, target file list.
- Excludes: unsanitized task text and full argv.
- Execution: none by itself.

PR-12B real canary authorization preflight:

- Helper: `evaluateWorkspaceWriteRealCanaryAuthorization()`
- Purpose: fail closed unless the future real-canary authorization packet exactly matches the PR-12B constraints.
- Target: `tmp/codex-cli-write-canary.txt`
- Includes: sanitized match booleans, reason codes, zero execution counters.
- Excludes: raw authorization text, raw action text, raw mismatch values, process output, environment values, and patch body.
- Execution: none by itself.

## 4. Compatibility Rule

The two layers are compatible only as sequential gates:

1. Existing smoke packet remains dedicated to the historical workspace-write smoke flow.
2. PR-12B canary authorization preflight remains dedicated to the fixed canary flow.
3. A future canary-specific approval packet may be added only in a separate scoped change.
4. That future change must prove it does not weaken either existing smoke gates or PR-12B canary gates.

The PR-12B preflight must not silently accept:

- the smoke confirmation token as canary authorization
- the smoke target file as canary target
- a command preview as authorization
- bundled push permission
- broadened workspace-write scope

## 5. Boundary Confirmed

This compatibility review changes no runtime behavior.

Confirmed:

- Real Codex CLI call: no
- Provider execute: no
- Workspace-write execute: no
- Canary file write: no
- Smoke runner invocation: no
- Approval packet helper modification: no
- Push / release / tag: no

## 6. Future Adaptation Requirements

If a canary-specific approval packet is introduced later, it must be separate from this review and must include tests proving:

- the existing smoke packet still targets only the smoke evidence file
- the canary packet targets only `tmp/codex-cli-write-canary.txt`
- the canary packet does not contain raw authorization text
- the canary packet does not contain process output
- the canary packet does not contain environment values
- the canary packet does not authorize push
- no provider execute or real Codex CLI call happens while creating either packet

## 7. Result

Result:

- `PR_12B_AUTHORIZATION_PACKET_COMPATIBILITY_REVIEW_COMPLETE`

This keeps PR-12B in pre-execution governance only.

## 8. Next Safe Action

Next safe local action:

- continue with local-only review or push-readiness over the accumulated local candidate range.

Do not start:

- real canary execution
- workspace-write smoke execution
- provider execute wiring
- release or tag
