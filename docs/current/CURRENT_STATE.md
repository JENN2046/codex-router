# Current State

CURRENT_STATE_RECORDED

This is the compact operator-facing interpretation of repository state. The
machine-authoritative claim is:

- `docs/current/state-sync-record.json`

This Markdown file and `.agent_board/*` are display and handoff surfaces. They
do not override the structured record, CI, the reviewed commit, or runtime
audit results.

## Machine Authority

| Field | Current value |
| --- | --- |
| Schema | `2` |
| Policy | `state-sync-policy.v2` |
| Repository | `JENN2046/codex-router` (`1220937060`) |
| Source identity | filtered Git tree digest (`git-ls-tree-sha256`) |
| Source tree digest | `a4413db5fc8e77bddde2091ef2ac5c8fa465a1d95ace0cd8a61548915a2cec21` |
| Target | `refs/heads/main` |
| Allowed events | local, pull request, and push to the main target |

The record intentionally does not persist a branch name, HEAD SHA, divergence,
or a `stale after commit` flag. The audit observes branch, commit, clean-tree,
repository identity, target context, and the filtered digest at runtime.

The digest excludes only the structured record, this display, and the declared
`.agent_board/*` handoff files. It therefore covers README, governance indexes,
ADRs, source, tests, scripts, package metadata, and workflows.

## Active Product Boundary

`codex-router` is an auditable pre-production governance layer above the
official Codex App Server and SDK. It owns capability classification,
authorization, approval correlation, preview/evidence, reconciliation, retain
verification, and explicit Git rollback. Codex remains responsible for
authentication, conversations, streaming, and applying accepted changes.

The repository does not currently prove that a real App Server approval is
intercepted before file application. It therefore does not authorize a live App
Server file-change smoke or a real source-workspace write.

## Current Capability Posture

| Surface | Disposition |
| --- | --- |
| Authorization, preview, retain, reconciliation, rollback | Strong experimental / pre-production contracts |
| App Server wire normalization and deterministic decline harness | Offline contract evidence |
| Exact-version App Server file change | `blocked / no_go` |
| No-environment proposal | `verified_offline / no_go` |
| Runtime tool-inventory attestation | Test-only fake issuer; `verified_offline / no_go` |
| Offline execution capsule | `synthetic_non_sensitive`, `test_only_simulated`, non-promotable |
| Shipped capsule store | In-memory implementation only |
| Caller-injected capsule store/transform side effects | Not mechanically excluded |
| Real isolated worker or remote CAS | Not implemented or authorized |
| Real Codex CLI/provider execution | Not authorized |
| Real workspace-write, retain/apply promotion, release/deploy/publish | Not authorized |

The capsule prestore gate checks complete-tree, manifest, changed-file,
changed-byte, canonical-diff, sensitive-path, and credential-like-content
boundaries before output copying or CAS writes. Passing those checks produces
only `verified_offline` fixture evidence; it is not an execution permit.

## Active Decisions

- ADR 006 keeps Codex App Server as the runtime while unproven interception
  remains observe-only.
- ADR 007 requires an exact proposal before apply.
- ADR 008 records the exact-version security review and continuing live
  `NO-GO`.
- ADR 009 limits no-environment proposal verification to an offline contract.
- ADR 010 limits runtime tool-inventory attestation to a test-only fake issuer.
- ADR 011 limits offline execution capsules to synthetic, in-process,
  non-promotable test fixtures.

See `docs/governance/README.md` for the linked current decision surface.

## Governance Integrity Closeout

`R2_GOVERNANCE_INTEGRITY_CLOSEOUT` is one closeout project delivered through
small PRs:

1. PR #186 made the complete authorization-evaluation stage fail closed and
   covered successful decline plus uncertain-send reconciliation.
2. PR #187 added capsule prestore output boundaries, corrected the injected
   store trust claim, and added an independent capsule branch-coverage gate.
3. `docs/current-governance-reanchor` replaces stale current-state navigation,
   adds ADR 011 to current surfaces, and classifies old routes as history.
4. `ci/merge-integrity-hardening` remains separately gated because workflow
   modification requires Jenn's explicit authorization for the concrete diff.

Until this closeout is reviewed, do not add ADR 012, a real worker, remote CAS,
new App Server execution probes, retain/apply promotion, or other execution
capability expansion.

## Historical Routes

Phase-numbered runtime work, DGP, provider execution, Desktop host, VCPToolBox,
and Agent OS SDK/CLI/app-server documents remain available as implementation
and audit history. They are not parallel current roadmaps and do not authorize
new execution work.

GitHub Issue #2 tracked Phase 21 DGP hardening. The repository's
`docs/phase-21-closeout-audit-20260611.md` maps all 21.1-21.6 requirements to
implemented code, tests, and documentation. Issue #2 is therefore a completed
historical line, not a Phase 22 entry point.

## Current Entrypoints

- Documentation map: `docs/README.md`
- Governance current surface: `docs/governance/README.md`
- Governance runner discovery: `npm run governance -- list`
- Documentation validation: `npm run docs:governance`
- State-sync audit: `npm run governance -- audit state-sync`
- State-sync static boundary: `npm run governance -- audit state-sync-boundary`
- Execution boundary current surface:
  `npm run governance -- audit execution-boundary-current-surface`
- Workspace-write release gate:
  `npm run governance -- audit workspace-write-release-gate`
- Real-canary authorization design:
  `npm run governance -- audit workspace-write-real-canary-authorization-design`
- Source/release package boundary:
  `npm run governance -- audit source-release-package-boundary`
- Offline capsule boundary:
  `npm run governance -- audit offline-execution-capsule-boundary`

Run the execution-boundary current surface before claiming source/release
package separation.

These are audit and validation entry points, not execution authorization.
Historical commands remain discoverable through `list --all` only for
deliberate evidence review.

## Validation Baseline

For this documentation reanchor, the required local ladder is:

```bash
git diff --check
npm run docs:governance
npm run governance -- audit execution-boundary-current-surface
npm run governance -- audit state-sync
npm run validate:pr
```

The exact PR head must match the structured source-tree digest. GitHub CI must
then validate the same head. No real Codex CLI, App Server, provider, worker,
remote CAS, source-workspace write, release, deploy, or package publish belongs
in this validation.

## Next Governed Step

After this docs reanchor is merged and independently reviewed, prepare a
preflight for `ci/merge-integrity-hardening`: structured merge lock, pinned
GitHub Action SHAs, minimum workflow permissions, and risk-specific Canary job
names. Do not modify `.github/workflows/*` without Jenn's separate current
authorization for that concrete workflow change.
