# PR-12A Canary Approval Packet Compatibility Note

## 1. Workspace

- Workspace: `A:\AGENTS_OS_Workspace\governance\codex-router\repo`
- Review date: 2026-06-14
- Mode: local compatibility review only

## 2. Decision

PR-12A does not add a second workspace-write approval packet helper.

Reason:

- `codex-cli-host` already exposes `createCodexCliWorkspaceWriteSmokeApprovalPacket()`.
- That helper prepares operator confirmation material before any write-capable smoke.
- Existing tests cover omission of unsanitized task text and full argv.
- PR-12A is one layer earlier: fake-only fixed canary target readiness, with zero execution counters.

## 3. Current Split Of Responsibility

PR-12A canary readiness:

- Fixed target: `tmp/codex-cli-write-canary.txt`
- Proves default missing operator gate is blocked.
- Proves a fake readiness summary can be produced locally.
- Does not read environment variables.
- Does not write the canary file.
- Does not call provider execute.
- Does not call real Codex CLI.

Existing workspace-write smoke approval packet:

- Fixed smoke target: `docs/evidence/codex-cli-workspace-write-smoke.txt`
- Records required operator gates.
- Records sanitized command preview.
- Records rollback strategy.
- Omits unsanitized task text and full argv.
- Does not execute Codex CLI by itself.

## 4. Boundary

No new approval packet abstraction is introduced in PR-12A.

This avoids:

- duplicate operator packet formats
- confusion between fake canary readiness and live smoke approval
- accidental workspace-write execution path expansion

Next implementation step, if authorized later, should either adapt the existing smoke approval packet deliberately or create a separately scoped canary-specific packet with its own tests and evidence. It must not happen implicitly as part of PR-12A.
