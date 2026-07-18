---
title: Codex Governance Gate 0 Baseline
status: active
owner: governance
created: 2026-07-11
last_verified: 2026-07-11
verified_by:
  - public API surface locks
  - authorization adversarial tests
  - CI static review
applies_to:
  - gate-0
  - public-api
  - execution-boundary
---

# Codex Governance Gate 0 Baseline

## Expansion Freeze

Until a later ADR changes this boundary, new work may serve only the unified
authorization kernel, the Codex adapter, preview/retain/rollback, evidence, or
public-surface contraction. Do not add a root export, new Agent OS facade,
MCP/A2A public entry, general provider runtime, or new legacy-contract consumer.

## Public API Baseline

The package export map contains exactly:

- `codex-router/protocol`;
- `codex-router/policy`;
- `codex-router/codex-adapter`;
- `codex-router/evidence`;
- `codex-router/provider`.

Runtime export names are locked by the five
`tests/fixtures/public-api-*-surface-lock.fixture.json` files. The blank consumer
test verifies installation, declarations, all five imports, and rejection of a
bare package import.

## Classification Counterexamples

The fixed adversarial set includes negated deletion, quoted protected actions,
low-risk hint deception, Chinese permission/credential/production/release
phrases, delete, rename, command, permission, network, external target,
credential, protected branch, ambiguous target, and unknown schema facts.

Required outcomes:

| Input class | Minimum outcome |
| --- | --- |
| safe exact create/update facts | conditional `policy_auto`, still approval-bound |
| unknown or ambiguous write | blocked; no write capability |
| high/critical risk | `human_required` and not authorized |
| command or permission approval | exact proposal, human only |
| delete or rename | beta declines before apply |
| sensitive, network, external, release | never auto-approved |
| create/update without exact expected hashes | declined before apply |
| untrusted/low-risk hint over protected facts | factual risk wins |

## CI Baseline

Dedicated typecheck and build remain Node 20/22 gates. The acceptance matrix
runs build, tests, and blank-consumer packaging on Linux, Windows, and macOS
with Node 20/22. Existing governance, state-sync, fake-canary, and
contract-smoke jobs remain separate. No ordinary CI job is authorized to invoke
real Codex CLI, a real App Server, a paid provider, source-workspace write,
external write, release, publication, tag, or deployment.

The dedicated Node 22 coverage job enforces ≥90% branch coverage for
authorization, preview, and retain/permit/rollback. Local evidence at this
baseline is 96.83%, 91.12%, and 90.24%; the configured remote matrix has not yet
run for this uncommitted worktree.

## Execution Boundary Baseline

- App Server owns actual change application and retention in the workspace.
- The new adapter sends only approval responses through an injected transport.
- No live preview enforcer ships in `0.1.0`; live sessions remain observe-only.
- The internal test-only preview factory writes only to a disposable fixture
  clone and is not exported as live isolation evidence.
- Retain is post-state verification, not a write executor.
- Rollback is the sole new direct workspace mutation and requires a fresh,
  exact, durable single-use operator permit, coordinator lock, adjacent
  precondition recheck, and drift-free receipt binding.
- SDK automation is read-only.
- Generic provider execution is not public and remains blocked.
- Fake transport acceptance is not live App Server acceptance.

## Deferred Work

Live schema generation, a real App Server smoke, full legacy migration, signed
permits, distributed journal storage, destructive automation, external writes,
release/deploy, and a production-readiness claim are outside this baseline.
