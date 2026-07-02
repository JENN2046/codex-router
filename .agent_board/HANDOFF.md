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
- State-sync policy v2 content attestation is the main path for local,
  pull_request, and main-push audit; committed v1 `main` /
  `state_only_pushed` records remain a legacy fallback only.
- Earlier state-sync pruning and hardening work is merged; old post-merge
  reanchor events are history, not current operator steps.
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
- legacy v1 reanchor helper scripts, local runner, and manual PR workflow remain
  available only as explicit compatibility fallback for old v1 state-only
  records
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
- README and the structured record plan contain the low-level legacy v1
  reanchor details; this handoff surface keeps only the current main-path
  status
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
