# Handoff

Goal:

- Prepare a focused PR that makes runtime governance evidence refs canonical,
  parseable, and resolvable while preserving no-observationBus compatibility.

Current branch:

- `capability/runtime-governance-example-evidence`

Current validated source:

- `f73b620`

Current structured claim:

- `docs/current/state-sync-record.json`

Current transition:

- `state_only_pending_push`

Upstream baseline:

- `refs/remotes/origin/main`

Recorded divergence baseline:

- `ahead 5 / behind 0`

Completed:

- final plan document committed
- Phase 1 structured claim parser and resolver implemented
- Phase 2 missing structured claim gate implemented
- Phase 3 display-sync script implemented
- Phase 4 state-sync CI push-to-main coverage landed on `main` through the
  PR #50 squash merge, with main-push audit gated on a committed `main` /
  `state_only_pushed` record
- PR #51 strict state record path convergence was squash-merged into `main`
- post-PR #51 `main` state/docs reanchor was pushed and passed state-sync audit
  and main-push CI
- PR #52 state/docs cleanup was squash-merged into `main`
- PR #53 evidence drift and unknown structured claim field hardening was
  squash-merged into `main`
- collector reads `docs/current/state-sync-record.json`
- collector uses the structured claim upstream ref as the bounded baseline even
  when local feature-branch tracking exists, then computes divergence from Git
- collector rejects structured claim upstream refs outside `origin/*` or
  `refs/remotes/origin/*` remote-tracking refs
- bounded detached branch-head and PR merge-ref checkout contexts pass only when
  upstream, ancestry, divergence, and state-only path checks still pass
- bounded squash-only checkout contexts pass without the side-branch source
  commit object only when live `HEAD` has the recorded filtered source tree
  digest
- invalid structured claim does not fall back to Markdown
- machine-mirrored Markdown and `.agent_board/*` evidence drift blocks through
  `state_sync_evidenceDriftAbsent`
- empty or missing machine-mirrored Markdown fields block as evidence drift
  unless the structured claim itself expects an empty value
- stale `## Structured Record` mirror fields in `CURRENT_STATE.md`, including
  source tree digest and strict state paths, block as evidence drift
- stale `Validation recorded for source commit` and
  `## State Sync Expectations` fields in `CURRENT_STATE.md` block as evidence
  drift
- stale or missing `.agent_board/*` generated mirror blocks are checked per
  file, so aggregate block count cannot hide a missing or duplicate file block
- supported `.agent_board/*` heading mirrors block as evidence drift
- unknown structured claim fields fail closed in schema v1
- transition formulas are enforced for structured claims
- strict state-only path set includes `docs/current/state-sync-record.json`
- `scripts/prepare-state-sync-reanchor.ts` prepares post-merge state-sync
  reanchors without committing or pushing
- squash fallback reanchors now verify `HEAD` against the recorded filtered
  source tree digest before inferring it as source
- conservative post-merge reanchor PR automation is implemented on
  `automate/state-sync-reanchor-pr`
- the automation uses the fixed `state-sync/reanchor-main` branch, verifies
  strict state/docs diffs, and creates or updates a PR instead of pushing
  directly to `main`
- the workflow fetches the fixed reanchor branch before push and binds
  `--force-with-lease` to an explicit expected SHA or empty create-only
  expectation
- the generated PR body records that `GITHUB_TOKEN`-created or updated PR
  workflow runs may require write-permission approval before CI proceeds
- `## State Sync Expectations` divergence prose is generated from the
  structured transition, preventing pending-push records from retaining
  pushed-main wording
- `codex-cli` host-dispatch failures enter the shared runtime governance
  failure reducer when a governance state is supplied
- failed host dispatches emit `host_dispatch` execution observations and call
  `onGovernanceUpdate`
- host-dispatch recovery governance is returned only when the reducer routes
  the failure to recovery
- opaque Codex CLI spawn and host-dispatch errors normalize to
  `unknown_execution_error` before governance error class construction
- display sync matches standalone headings for `## State Sync Expectations`
  updates
- execution-observation evidence refs now have shared create/parse/resolve
  helpers
- runtime governance failure evidence refs in `desktop-live-adapter` use the
  shared helper instead of hand-built strings
- recovery packet `rawEvidenceRefs` are covered by tests that resolve them back
  to emitted observations
- malformed execution-observation refs fail closed
- no-observationBus recovery remains compatible and records no consumable
  evidence refs

Validation completed:

- `git diff --check`: PASS
- `npm run demo:runtime-governance`: PASS
- `node --import tsx --test tests/runtime-governance-demo.test.ts
  tests/host-client-example.test.ts tests/execution-observation.test.ts
  tests/desktop-live-adapter-governance.test.ts`: PASS
- `npm test`: PASS
- `npm run typecheck`: PASS
- `npm run build`: PASS
- `node --import tsx scripts/sync-state-sync-display.ts --check`: PASS
- `node --import tsx scripts/run-state-sync-audit.ts --json`: PASS

State-sync status:

- structured claim: `capability/runtime-governance-example-evidence` / `state_only_pending_push` against
  `refs/remotes/origin/main`
- validated source commit: `f73b620`
- latest validated commit: `f73b620`
- recorded divergence baseline: `ahead 5 / behind 0`
- branch-head audit command:
  `node --import tsx scripts/run-state-sync-audit.ts --json`
- expected audit source: `claimSource: structured`
- Git ancestry, divergence, source-tree digest, and strict state path
  checks remain enforced by the state-sync audit.
Not authorized:

- direct pushes to `main` for source, workflow, dependency, runtime, provider,
  env, secret, user config, or system config changes
- additional workflow edits beyond Phase 4 state-sync CI coverage
- dependency changes
- release or deploy
- manual CI rerun
- real provider execution
- real Codex CLI execution
- env, secret, user config, or system config edits

<!-- state-sync-display:start -->
Generated from `docs/current/state-sync-record.json`.

- branch: `capability/runtime-governance-example-evidence`
- upstream: `refs/remotes/origin/main`
- validated source commit: `f73b620`
- latest validated commit: `f73b620`
- recorded divergence baseline: `ahead 5 / behind 0`
- transition: `state_only_pending_push`
<!-- state-sync-display:end -->
