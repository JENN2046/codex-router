# Handoff

Goal:

- Prepare a focused PR that makes runtime governance state consumable by
  `runtime-control` escalation decisions.

Current branch:

- `content-attestation`

Current validated source:

- `content digest only`

Current structured claim:

- `docs/current/state-sync-record.json`

Current transition:

- `content_attestation`

Upstream baseline:

- `refs/remotes/origin/main`

Recorded divergence baseline:

- `observed at audit time`

Completed:

- final plan document committed
- Phase 1 structured claim parser and resolver implemented
- Phase 2 missing structured claim gate implemented
- Phase 3 display-sync script implemented
- Phase 4 state-sync CI push-to-main coverage landed on `main` through the
  PR #50 squash merge. Main-push audit now uses policy v2 content attestations
  as the main path; committed `main` / `state_only_pushed` records remain a
  legacy v1 fallback.
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
- Markdown and `.agent_board/*` display drift no longer blocks branch-head
  state-sync audit; `docs/current/state-sync-record.json` remains the machine
  authority
- `scripts/sync-state-sync-display.ts` is an optional operator-facing display
  freshness helper, not a required validation gate
- unknown structured claim fields fail closed in schema v1
- transition formulas are enforced for structured claims
- strict state-only path set includes `docs/current/state-sync-record.json`
- `scripts/prepare-state-sync-reanchor.ts` prepares post-merge state-sync
  reanchors without committing or pushing
- squash fallback reanchors now verify `HEAD` against the recorded filtered
  source tree digest before inferring it as source
- legacy v1 reanchor PR workflow is retained only as a manual compatibility
  fallback via `workflow_dispatch`
- the manual fallback uses the fixed `state-sync/reanchor-main` branch, verifies
  strict state/docs diffs, and creates or updates a PR instead of pushing
  directly to `main`
- the manual fallback fetches the fixed reanchor branch before push and binds
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
- guarded local `main` state-sync reanchor runner remains available as a
  low-level legacy v1 compatibility tool:
  `node --import tsx scripts/run-state-sync-main-reanchor.ts`
- the runner defaults to read-only, rejects non-`main` branches, requires local
  `HEAD` to match `refs/remotes/origin/main`, verifies strict state/docs diffs,
  and blocks stale pushes when `origin/main` moves before push
- the runner now delays full state-sync audit until after successful direct
  push, so default validation does not fail on the unavoidable pre-push
  `state_only_pushed` intermediate state
- README and the structured record plan document the legacy v1 runner as a
  low-level operator-authorized compatibility path while preserving the manual
  `state-sync/reanchor-main` PR workflow fallback
- `runtime-control` now exports `createRuntimeSignalFromGovernanceState()`
- runtime signal derivation counts `execution_failure` anomalies, preserves
  context pressure, and maps high/critical governance risk to `risk_detected`
- runtime-control tests now cover no-op, failure threshold, scope expansion,
  validation failure, context pressure, high-risk open-circuit, and governance
  state signal derivation

Validation completed:

- `git diff --check`: PASS
- `node --import tsx --test tests/runtime-control.test.ts`: PASS
- `npm test`: PASS
- `npm run typecheck`: PASS
- `npm run build`: PASS
- `node --import tsx scripts/run-state-sync-audit.ts --json`: PASS

State-sync status:

- structured claim: `state-sync-policy.v2` content attestation
- upstream target: `refs/remotes/origin/main`
- source identity: filtered tree digest, not a recorded commit SHA
- branch, commit, and divergence are observed by the audit at runtime
- branch-head audit command:
  `node --import tsx scripts/run-state-sync-audit.ts --json`
- expected audit source: `claimSource: structured`
- Source-tree digest, allowed context, clean worktree, and read-only
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
Optional display generated from `docs/current/state-sync-record.json`.

- schema version: `2`
- policy version: `state-sync-policy.v2`
- branch: `content-attestation`
- upstream: `refs/remotes/origin/main`
- validated source commit: `content digest only`
- latest validated commit: `content digest only`
- recorded divergence baseline: `observed at audit time`
- transition: `content_attestation`
<!-- state-sync-display:end -->
