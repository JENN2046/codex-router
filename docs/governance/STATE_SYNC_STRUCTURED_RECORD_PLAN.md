# State Sync Structured Record Plan

## Purpose

This plan records the proposed restructuring of the outer `state-sync` self-audit
layer.

The current state-sync layer can verify selected machine fields in
`docs/current/CURRENT_STATE.md` and `.agent_board/*`, but it still treats
Markdown surfaces as part of the authority chain. That creates recurring failure
modes:

- prose can become stale after push, merge, or squash;
- review checkout context can differ from branch-head context;
- fallback rules accumulate around Markdown parsing;
- `.agent_board` aggregation can pass without proving each board file is
  individually current;
- state-only transitions and provenance claims are mixed with human-facing
  status notes.

The target direction is to separate claim, observation, verification, and
display.

## Design Principle

State-sync should become a lightweight provenance verifier:

```text
StateSyncClaim + Git Observation + Policy Verification -> PASS / BLOCK
```

Markdown and `.agent_board` files should remain useful evidence and operator
surfaces, but they should not be the authority for core machine facts such as
validated source commit, upstream divergence, transition kind, and allowed
state-only paths.

## External References

This plan follows patterns used by mature provenance and governance systems:

- SLSA provenance separates subject, builder, build definition, inputs, and
  dependencies instead of relying on release prose.
  <https://slsa.dev/spec/v1.0/provenance>
- GitHub Artifact Attestations record structured claims about workflow,
  repository, commit, and triggering event, while leaving policy enforcement to
  the verifier.
  <https://docs.github.com/en/actions/concepts/security/artifact-attestations>
- in-toto link metadata records step evidence such as materials, products,
  command, and environment.
  <https://github.com/in-toto/attestation/blob/main/spec/predicates/link.md>
- Reproducible Builds and Debian `.buildinfo` separate build facts from
  changelog prose so independent rebuilders can verify artifacts.
  <https://reproducible-builds.org/events/berlin2016/buildinfofiles/>

## Proposed Model

### StateSyncClaim

`StateSyncClaim` is the committed, machine-readable statement of what the repo
claims about the current governance state.

Authoritative path:

```text
docs/current/state-sync-record.json
```

This path is fixed for the structured claim. `.agent_board/*` remains an
operator evidence surface, not the machine-authoritative claim location.

Candidate fields and field meaning:

```json
{
  "schemaVersion": 1,
  "policyVersion": "state-sync-policy.v1",
  "subject": {
    "branch": "main",
    "upstream": "origin/main"
  },
  "source": {
    "validatedSourceCommit": "42fc8e3",
    "latestValidatedCommit": "42fc8e3",
    "recordedDivergence": {
      "ahead": 1,
      "behind": 0
    },
    "sourceTreeDigest": {
      "algorithm": "git-ls-tree-sha256",
      "value": "64 lowercase hex characters",
      "excludedPaths": [
        "docs/current/CURRENT_STATE.md",
        "docs/current/state-sync-record.json",
        ".agent_board/CHECKPOINT.md",
        ".agent_board/HANDOFF.md",
        ".agent_board/RUN_STATE.md",
        ".agent_board/TASK_QUEUE.md",
        ".agent_board/VALIDATION_LOG.md"
      ]
    }
  },
  "transition": {
    "kind": "state_only_pushed",
    "allowedStatePaths": [
      "docs/current/CURRENT_STATE.md",
      "docs/current/state-sync-record.json",
      ".agent_board/CHECKPOINT.md",
      ".agent_board/HANDOFF.md",
      ".agent_board/RUN_STATE.md",
      ".agent_board/TASK_QUEUE.md",
      ".agent_board/VALIDATION_LOG.md"
    ]
  },
  "validation": {
    "requiredCommands": [
      "git diff --check",
      "node --import tsx --test tests/state-sync-audit.test.ts",
      "npm run typecheck",
      "npm run build",
      "node --import tsx scripts/run-state-sync-audit.ts --json"
    ]
  }
}
```

Field semantics:

- `schemaVersion`: numeric claim schema version. Phase 1 accepts only `1`.
- `policyVersion`: named verifier policy. Phase 1 accepts only
  `state-sync-policy.v1`.
- `subject.branch`: the expected branch name for normal branch-head audits. This
  is a policy expectation checked against Git observation, not a replacement for
  the live observed branch. Detached review compatibility is expressed through
  `transition.kind`, not by storing an empty branch as a generic success path.
- `subject.upstream`: the expected upstream ref for branch-head audits. This is
  a policy expectation checked against Git observation, not a live fact source.
- `source.validatedSourceCommit`: the source commit whose validation baseline is
  being carried by the state record.
- `source.latestValidatedCommit`: the latest validated source commit. Phase 1
  requires it to equal `source.validatedSourceCommit`.
- `source.recordedDivergence`: the upstream divergence snapshot recorded at the
  source-validation or state-record moment. It is a claim field, not a live Git
  observation.
- `source.sourceTreeDigest`: a filtered Git tree digest for the validated source
  content. It is computed from `git ls-tree -r -z`, excluding exactly the strict
  state record paths. Normal branch and merge-ref audits bind this digest back
  to `source.validatedSourceCommit`; squash-only audits use it to verify that
  live `HEAD` has the same non-state tree when the side-branch commit object is
  not present.
- `transition.kind`: the explicit allowed state transition model.
- `transition.allowedStatePaths`: the strict list of paths that may differ when a
  transition permits state-only descendants.
- `validation.requiredCommands`: non-authoritative policy metadata listing
  commands required by policy. Phase 1 treats this as a requirement list, not as
  proof that the commands were executed. It must not participate in
  source/divergence PASS decisions.

`StateSyncClaim` must not store live `HEAD`. Live `HEAD` belongs to Git
observation. This avoids reintroducing the current ambiguity where a state-only
record commit may be live `HEAD` while the validated source commit remains the
recorded source anchor.

`docs/current/state-sync-record.json` is itself a state-only record path. Any
strict state-only path helper introduced for this plan must include it.

### Git Observation

`run-state-sync-audit.ts` should continue to collect live facts from Git:

- current branch;
- current `HEAD`;
- normalized upstream ref;
- current branch ahead / behind;
- validated source ahead / behind;
- validated source ancestry;
- changed paths since validated source;
- filtered tree digest for live `HEAD`;
- filtered tree digest for the validated source commit when that commit object
  is available;
- whether the validated source commit object is locally available;
- dirty worktree paths;
- PR merge or detached checkout context where available.

Observation is not committed. It is generated at audit time.

For structured claims, `claim.subject.upstream` is the authoritative upstream
baseline selector for the audit. A local `@{upstream}` may reflect ordinary
operator branch tracking, such as `origin/<feature>`, and must not silently
override the structured baseline. Phase 1 accepts only remote-tracking refs under
`origin`, expressed as `origin/<name>` or `refs/remotes/origin/<name>`, and
rejects `origin/HEAD`, `HEAD`, local branch names, tags, bare SHAs, and revision
expressions. The collector must normalize shorthand refs such as `origin/main`
to `refs/remotes/origin/main` before calling Git, then verify that the bounded
ref resolves to a commit in the local Git repository. This prevents Git refname
disambiguation from selecting same-named tags or local refs. The collector then
computes both current branch divergence and validated-source divergence from Git
against that normalized ref. If the claimed upstream ref is outside the allowed
remote-tracking namespace or does not resolve, upstream and divergence
observations remain unknown and the audit blocks. This keeps `subject.upstream`
as a policy expectation and bounded ref selector; it is not proof of divergence
and does not replace Git observation.

### Claim Parsing And Compatibility

Claim handling must fail closed:

- if `docs/current/state-sync-record.json` exists but cannot be parsed as JSON,
  the audit blocks;
- if the parsed claim is not an object, the audit blocks;
- if `schemaVersion` or `policyVersion` is unknown, the audit blocks;
- if any required core field is missing or malformed, the audit blocks;
- if `subject.branch` is empty or only whitespace, the audit blocks;
- if commit fields are not 7-40 character lowercase or uppercase hex strings,
  the audit blocks;
- if divergence fields are missing, negative, non-integer, or not finite, the
  audit blocks;
- if `source.sourceTreeDigest` is missing, malformed, uses an unsupported
  algorithm, is not a lowercase SHA-256 hex digest, or excludes paths outside
  the strict state record path set, the audit blocks;
- if `source.sourceTreeDigest.excludedPaths` is not the same set as
  `transition.allowedStatePaths`, the audit blocks;
- if `transition.kind` is not an accepted enum value, the audit blocks;
- in Phase 1, if `transition.allowedStatePaths` is missing, empty, or contains
  paths outside the strict state record set, the audit blocks. All Phase 1
  accepted transitions use this path list for dirty worktree or state-only path
  checks.

Legacy Markdown fallback is allowed only during the compatibility window and only
when the claim file is completely absent.

No fallback is allowed when the claim file is present but invalid.

### Policy Verification

The verifier compares `StateSyncClaim` with Git observation through explicit
transition policies.

Initial transition kinds:

- `source_exact`: claim validated source commit equals live `HEAD`.
- `state_only_pending_push`: live `HEAD` is a state-only descendant of the
  validated source and the branch is still ahead of upstream.
- `state_only_pushed`: live `HEAD` is aligned with upstream and the recorded
  divergence is the bounded inverse snapshot of the validated source baseline.
- `detached_review_checkout`: detached or synthetic review checkout with
  explicitly allowed compatibility conditions.
- `merge_ref_checkout`: reserved for a later structured PR merge-ref claim. Phase
  1 keeps existing legacy merge-parent compatibility instead of accepting this as
  a structured claim transition.

There should be no catch-all syntax-only pass path.

For branch-head transitions, subject branch matching means either:

```text
claim.subject.branch == observation.branch
```

or this bounded detached checkout case:

```text
observation.branch == ""
claim.subject.branch is non-empty
claim.subject.upstream == observation.upstream
```

The detached branch-name case only compensates for checkout environments that do
not preserve a local branch name. It does not bypass upstream matching,
validated-source ancestry, divergence checks, allowed state paths, dirty
worktree checks, or synthetic anchor hardening.

Transition formulas:

`source_exact` passes only when:

```text
claim subject branch matches observation branch or bounded detached branch-name case
claim.subject.upstream == observation.upstream
claim.source.validatedSourceCommit == observation.head
claim.source.latestValidatedCommit == claim.source.validatedSourceCommit
claim.source.sourceTreeDigest == digest(observation.head excluding claim.transition.allowedStatePaths)
claim.source.recordedDivergence == observation.validatedSourceDivergence
dirty worktree paths are all in claim.transition.allowedStatePaths
```

`state_only_pending_push` passes only when:

```text
claim subject branch matches observation branch or bounded detached branch-name case
claim.subject.upstream == observation.upstream
observation.head != claim.source.validatedSourceCommit
state-only delta to observation.head is defined and non-empty, where:
  if observation.validatedSourceAncestorOfHead == true:
    delta = committed paths from claim.source.validatedSourceCommit to observation.head
  if observation.validatedSourceAncestorOfHead == false:
    delta = tree diff paths from claim.source.validatedSourceCommit to observation.head
    and this path is allowed only for structured claims with explicit
    claim.transition.allowedStatePaths
every delta path is in claim.transition.allowedStatePaths
claim.source.sourceTreeDigest == digest(claim.source.validatedSourceCommit excluding claim.transition.allowedStatePaths)
observation.currentAhead > 0
observation.currentBehind == 0
claim.source.recordedDivergence == observation.validatedSourceDivergence
claim.source.latestValidatedCommit == claim.source.validatedSourceCommit
dirty worktree paths are all in claim.transition.allowedStatePaths
```

If the validated source commit object is not available, the squash-only
compatibility path may replace the commit-path delta with this stricter formula:

```text
claim subject branch matches observation branch or bounded detached branch-name case
claim.subject.upstream == observation.upstream
observation.validatedSourceCommitAvailable == false
claim.source.sourceTreeDigest == digest(observation.head excluding claim.transition.allowedStatePaths)
observation.currentAhead > 0
observation.currentBehind == 0
claim.source.recordedDivergence is a non-negative ahead-only baseline
claim.source.latestValidatedCommit == claim.source.validatedSourceCommit
dirty worktree paths are all in claim.transition.allowedStatePaths
```

The squash-only path is not a general reachability bypass. It only covers review
or local validation contexts that rewrite the PR history into one squash commit
while preserving the validated source tree modulo strict state-record paths. If
the live filtered source tree differs from the recorded source digest, the
transition blocks. Normal branch and merge-ref checkouts still bind the digest
back to the validated source commit object when that object is available.

`state_only_pushed` passes only when:

```text
claim subject branch matches observation branch or bounded detached branch-name case
claim.subject.upstream == observation.upstream
observation.validatedSourceAncestorOfHead == true
observation.committedPathsSinceValidatedSource is defined
every committed path since validated source is in claim.transition.allowedStatePaths
observation.currentAhead == 0
observation.currentBehind == 0
observation.validatedSourceDivergence.ahead == 0
observation.validatedSourceDivergence.behind == N
claim.source.recordedDivergence.ahead == N
claim.source.recordedDivergence.behind == 0
N > 0
claim.source.latestValidatedCommit == claim.source.validatedSourceCommit
dirty worktree paths are all in claim.transition.allowedStatePaths
```

`detached_review_checkout` passes only when:

```text
observation.branch == ""
observation.upstream == ""
observation.currentDivergence is unknown
observation.validatedSourceDivergence is unknown
worktree is clean
claim.source.validatedSourceCommit == claim.source.latestValidatedCommit
claim explicitly marks detached review compatibility through transition.kind
no validated source evidence shows the source anchor is unreachable
validated source evidence, when present, must still be honored
synthetic fallback must not allow a stale or unreachable anchor when validated
source evidence exists
Markdown and agent board evidence must not become core anchor authority
output sanitization still passes
audit remains read-only
```

This transition may satisfy only the divergence compatibility portion of the
audit. It must not bypass source reachability, agent board evidence, output
sanitization, dirty worktree checks, or synthetic anchor hardening.

`merge_ref_checkout` is not accepted as a structured claim transition in Phase 1.
Detached pull request merge refs may still pass an existing branch-head
transition only when the branch name is the only missing subject fact and all
other transition checks pass against Git observation. This does not introduce a
merge-ref-specific claim mode.

Phase 1 keeps the existing legacy merge-parent compatibility path while the repo
is migrating from Markdown authority to structured claims. A future phase may add
structured `merge_ref_checkout` support only after the claim can record and
verify review context such as base branch, head branch, pull request head SHA,
and merge ref.

Future `merge_ref_checkout` support should pass only when:

```text
observation.parentHead is defined
observation.mergeParentHead is defined
observation.allowedStateCommits is non-empty
observation.allowedStateCommits excludes observation.parentHead when it is the
merge base
claim.subject.branch may differ from observation.branch only when observation is
a detached pull request merge checkout
claim.subject.upstream may differ from observation.upstream only when upstream
is unavailable in the detached checkout
claim.source.validatedSourceCommit is in observation.allowedStateCommits
claim.source.latestValidatedCommit == claim.source.validatedSourceCommit
claim.source.recordedDivergence == observation.validatedSourceDivergence when
validated source divergence is known
unknown divergence is allowed only through detached_review_checkout, not through
merge_ref_checkout
no merge base fallback is accepted as a state commit
dirty worktree paths are all in claim.transition.allowedStatePaths
```

### Display And Evidence

`docs/current/CURRENT_STATE.md` and `.agent_board/*` remain valuable for humans,
but their role changes:

- they may display facts derived from `StateSyncClaim`;
- they may record validation summaries and handoff notes;
- they are checked for secret or machine-path leakage;
- they are checked for obvious stale phrases;
- conflicts between Markdown and `StateSyncClaim` become evidence drift.

They should not be the source of truth for validated source, latest validated
commit, upstream divergence, or transition kind.

Evidence drift output contract:

- Markdown / claim conflict in machine-mirrored fields is reported as a
  structured issue with `risk: "evidence_drift"`.
- After Markdown authority removal, machine-mirrored evidence drift is blocking.
  The audit reports `state_sync_evidenceDriftAbsent` when a mirrored field in
  `docs/current/CURRENT_STATE.md` conflicts with
  `docs/current/state-sync-record.json`.
- Free-form Markdown prose and handoff notes remain evidence/display surfaces;
  they do not become governance authority unless represented by a structured
  check.
- Evidence drift output must identify the surface and field name, but must not
  echo secrets or machine-local absolute paths.

Initial issue shape:

```ts
{
  code: "state_document_evidence_drift";
  path: string;
  line: number;
  field: string;
  risk: "evidence_drift";
}
```

`path` should identify the Markdown or `.agent_board` surface. `line` should use
the conflicting field line when available and `1` when the conflict is derived
from aggregate text. `field` should name the logical field, such as
`Current head`, `Validated source commit`, `Upstream divergence`, or
`Latest validated commit`.

## Implementation Phases

### Phase 0: Design Record

Create and review this plan before changing runtime logic.

Acceptance:

- plan exists in `docs/governance/`;
- plan explains purpose, model, phases, and non-goals;
- no runtime behavior changes.

Reality note:

- A design-only branch may be blocked by the legacy State Sync Audit because the
  current Markdown state surface records `main` while the branch name and dirty
  worktree differ.
- That blockage is evidence of the authority problem this plan is meant to fix,
  not a reason to distort the structured claim design.
- Before opening or merging a PR, decide separately whether to add a temporary
  state/docs alignment commit for the legacy audit surface. Do not make the
  structured-record plan serve the old Markdown self-audit model.

### Phase 1: Structured Claim MVP

Add `docs/current/state-sync-record.json`.

Update audit input collection so the verifier can read:

- the JSON claim;
- existing Markdown state surfaces for compatibility and evidence checks;
- live Git observation as today.

The verifier should use the JSON claim for core facts whenever the claim file is
present and valid. Markdown field parsing is only a temporary migration fallback
when the claim file is completely absent. When a claim exists, Markdown may only
produce evidence drift; it must not provide core source, divergence, transition,
or allowed-path facts.

Project-realistic implementation order:

1. Extend `StateSyncAuditInput` with a structured claim surface, such as
   `stateSyncClaimText?: string`.
2. Extend `StateSyncAuditIssue` so it can represent evidence drift:

   ```ts
   code: "state_document_evidence_drift";
   risk: "evidence_drift";
   ```

3. Extend `StateSyncAuditResult.summary` with:

   ```ts
   claimSource:
     | "structured"
     | "missing_structured"
     | "invalid_structured";
   ```

4. Update `scripts/run-state-sync-audit.ts` to read
   `docs/current/state-sync-record.json` when present.
5. Use the structured claim, when present and valid, to choose the validated
   source anchor used for live Git observation:

   ```text
   validatedSourceAnchor =
     structured claim source.validatedSourceCommit
     or legacy Markdown Validated source commit / Latest validated commit
   ```

   This is required because the collector currently computes ancestry,
   validated-source divergence, and changed paths from Markdown-derived fields.

   If the structured claim file is present but invalid, the collector must not
   fall back to Markdown to choose `validatedSourceAnchor`. It should emit
   unknown validated-source observation fields and let the audit fail closed with
   `summary.claimSource = "invalid_structured"`.

6. Add a resolver inside `packages/state-sync-audit`:

   ```text
   resolveStateSyncClaim(input) -> structured claim | legacy markdown claim | invalid
   ```

   The resolver owns parsing, schema validation, policy version validation,
   fallback selection, and evidence drift detection.

   The parser / validator used by this resolver must be exported from
   `packages/state-sync-audit` and reused by `scripts/run-state-sync-audit.ts`.
   The collector must not implement a second, looser claim parser. This keeps
   Git observation selection and final audit verification on the same schema and
   fail-closed rules.

   The exported parser should be a pure raw-claim parser, for example:

   ```text
   parseStateSyncClaim(rawText: string | undefined) -> parsed claim | absent | invalid
   ```

   `scripts/run-state-sync-audit.ts` can use this parser before the full
   `StateSyncAuditInput` exists. `resolveStateSyncClaim(input)` remains the audit
   layer resolver that combines parsed claim state, legacy Markdown fallback, and
   evidence drift reporting.

7. In Phase 1, feed resolved claim fields into the existing checks instead of
   rewriting all state-sync checks at once. Existing helpers such as
   state-only descendant, bounded divergence snapshot, synthetic checkout
   hardening, and merge-parent compatibility should stay in place.

   Phase 1 must not expand `.agent_board` authority. Existing agent board checks
   may remain for compatibility, but `.agent_board/*` must not become a source of
   core source, divergence, transition, or allowed-path facts.

8. Introduce transition formulas as explicit policy helper functions only after
   the resolver and collector are stable.

This order avoids replacing the existing 47-test behavior surface in one step
while still cutting the most important dependency: live Git observation must no
longer be derived from Markdown when a structured claim exists.

Phase 1 compatibility rules:

- claim present and valid: core facts come from the claim;
- claim present and invalid: BLOCK, with no Markdown fallback;
- claim absent: use legacy Markdown parsing and report legacy fallback mode;
- claim / Markdown conflict: report evidence drift;
- claim / observation conflict: BLOCK;
- Markdown prose stale but claim and observation valid: PASS with evidence drift
  only if a checked Markdown field conflicts with the claim.

Compatibility exit rule:

- Phase 1 is the only phase where a missing claim may fall back to Markdown.
- Phase 2 changes missing `docs/current/state-sync-record.json` from legacy
  fallback to BLOCK and reports `summary.claimSource = "missing_structured"`.
- The verifier output should expose `claimSource: "structured"` or
  `claimSource: "missing_structured"` or
  `claimSource: "invalid_structured"` in `summary.claimSource` after the Phase 2
  missing-claim gate is enabled so absent-claim and invalid-claim blocks are
  visible in tests, local output, and CI logs.

New tests should cover:

- valid claim plus matching observation passes;
- wrong subject branch or upstream blocks;
- wrong validated source commit blocks;
- wrong recorded divergence blocks;
- malformed claim blocks without Markdown fallback;
- unknown schema or policy version blocks;
- invalid transition kind blocks;
- stale Markdown prose does not override a valid claim;
- Markdown / claim conflict is reported as evidence drift;
- missing claim blocks after the Phase 2 missing-claim gate is enabled.

Project-realistic test migration requirements:

- update test helpers so they can build inputs with `stateSyncClaimText`;
- update strict state record path helpers to include
  `docs/current/state-sync-record.json`;
- add collector tests proving validated source observation is computed from the
  structured claim when present;
- add collector tests proving an invalid structured claim does not fall back to
  valid Markdown for validated-source ancestry, divergence, or changed-path
  observation;
- add a real-shape `state_only_pushed` fixture matching the current mainline
  pattern: live `HEAD` is a state/docs commit, the validated source commit is its
  ancestor, committed paths since validated source are strict state record paths,
  current branch divergence is `ahead 0 / behind 0`, and recorded divergence is
  the inverse validated-source baseline;
- keep existing Markdown-only tests passing through `legacy_markdown` fallback
  during Phase 1;
- update output tests to assert `summary.claimSource`.

### Phase 2: Markdown And Agent Board Downgrade

Downgrade Markdown and `.agent_board` from authority to evidence.

Phase 2-A removes the final missing-claim compatibility fallback:

- if `docs/current/state-sync-record.json` is absent, the audit blocks;
- Markdown `Current head`, `Validated source commit`, `Latest validated commit`,
  `Upstream`, and `Upstream divergence` fields are not used to choose the
  validated source anchor;
- collector observation fields that depend on the validated source anchor remain
  unknown until a valid structured claim is present;
- `summary.claimSource` reports `missing_structured` for this failure mode.

Phase 2-B keeps Markdown and `.agent_board/*` as evidence surfaces:

- structured claims remain the only authority for branch, upstream, validated
  source commit, recorded divergence, transition kind, and allowed state paths;
- conflicting `CURRENT_STATE.md` machine fields are emitted as
  `state_document_evidence_drift` issues, without being used as fallback
  authority;
- `.agent_board/*` alignment remains a display/evidence integrity check during
  the compatibility window, but it does not supply core source facts.

Checks should include:

- required files exist;
- no secret markers;
- no machine-local absolute paths;
- no known stale phase phrases such as `no push yet`, `not committed yet`, or
  `in progress` after a pushed state;
- current claim/source anchors are referenced where expected;
- conflicting prose is reported as evidence drift.

Core PASS / BLOCK should not depend on Markdown prose fields.

### Phase 3: Generated Or Semi-Generated Display

Render the machine field section of `CURRENT_STATE.md` from
`state-sync-record.json`, or provide a script that updates both consistently.

Goal:

- reduce manual drift;
- keep prose useful;
- avoid reintroducing Markdown as the authority.

Implemented display-sync path:

```bash
node --import tsx scripts/sync-state-sync-display.ts --check
node --import tsx scripts/sync-state-sync-display.ts --write
```

The script:

- reads and validates only `docs/current/state-sync-record.json`;
- fails closed when the structured claim is missing or invalid;
- updates fixed machine fields in `docs/current/CURRENT_STATE.md`;
- maintains a generated `state-sync-display` block in each listed
  `.agent_board/*` display file;
- defaults to check mode so drift can be detected without hidden writes.

Implemented reanchor preparation path:

```bash
node --import tsx scripts/prepare-state-sync-reanchor.ts --check
node --import tsx scripts/prepare-state-sync-reanchor.ts --write
node --import tsx scripts/prepare-state-sync-reanchor.ts --write --source <sha>
```

The helper prepares the structured record and generated display surfaces for a
post-merge `main` / `state_only_pushed` state record. It does not commit or
push, and write mode requires a clean worktree before it updates local files. By
default it infers a new source when `HEAD` contains non-state changes since the
previous recorded source, or when the previous branch source is unavailable or
not an ancestor after a squash merge. If `HEAD` already appears to be a
state-only descendant, the helper fails closed unless an explicit `--source` is
supplied.

### Phase 4: CI Coverage Adjustment

Evaluate running State Sync Audit on push to `main` as well as pull requests.

This should be a separate change because workflow behavior has a different risk
profile from verifier semantics.

Implemented Phase 4 adjustment:

- keep the workflow top-level triggers on `pull_request` to `main` and `push` to
  `main`;
- remove the State Sync Audit job's PR-only event gate so pull requests still run
  the audit and `push` events can run it after a committed
  `main`/`state_only_pushed` structured record exists;
- keep the state-sync job behind `test` and before evidence collection.
- on `push` events, gate the audit on the committed structured record having
  `subject.branch == "main"` and `transition.kind == "state_only_pushed"`.
  A squash merge that still carries a PR-branch `state_only_pending_push` claim
  does not run the push audit until a follow-up state/docs reanchor records the
  `main` claim; this is the expected fail-closed flow, not an instruction to
  weaken checkout or divergence verification.

## Non-Goals For The First Implementation

- no Sigstore or Rekor integration;
- no GitHub Artifact Attestation emission;
- no package or dependency changes;
- no provider execution;
- no real Codex CLI execution;
- no secret, environment, user config, or system config changes;
- no direct push to `main`;
- no removal of existing Markdown compatibility in Phase 1.

## Schema And Policy Version Rules

Phase 1 accepts:

```text
schemaVersion = 1
policyVersion = state-sync-policy.v1
```

Unknown schema or policy versions block. They must not silently fall back to
Markdown because an unknown version means the verifier does not know how to
interpret the committed claim.

Accepted transition kinds in Phase 1:

```text
source_exact
state_only_pending_push
state_only_pushed
detached_review_checkout
```

`merge_ref_checkout` is deliberately excluded from Phase 1 structured claims. It
continues to use the existing legacy merge-parent compatibility path until a
future structured review-context claim is designed.

Accepted strict state record paths:

```text
docs/current/CURRENT_STATE.md
docs/current/state-sync-record.json
.agent_board/CHECKPOINT.md
.agent_board/HANDOFF.md
.agent_board/RUN_STATE.md
.agent_board/TASK_QUEUE.md
.agent_board/VALIDATION_LOG.md
```

Strict path convergence removes the earlier broad `.agent_board/*` allowance.
Dirty worktree paths, committed state-only descendant paths, source-tree digest
exclusions, and claim `transition.allowedStatePaths` must all resolve through
the same fixed strict state record path set. Any other `.agent_board` file, such
as `.agent_board/EXTRA.md`, is treated as a non-state path and must block.

Structured claim schema v1 is fail-closed for unknown fields. Unknown fields in
the top-level claim object, `subject`, `source`, `source.recordedDivergence`,
`source.sourceTreeDigest`, `transition`, or `validation` make the claim invalid.
Future extensions should use an explicit schema or policy version change rather
than relying on ignored fields.

## Validation Field Semantics

`validation.requiredCommands` is a policy requirement list, not proof of
execution.

Phase 1 should not claim that a command passed only because it appears in the
claim. Actual validation evidence remains the local command output, CI checks,
or later structured validation result records.

If execution results are added later, they should use a separate shape such as:

```json
{
  "validation": {
    "requiredCommands": ["npm run build"],
    "results": [
      {
        "command": "npm run build",
        "status": "passed",
        "sourceCommit": "42fc8e3"
      }
    ]
  }
}
```

The `results` shape is explicitly out of scope for Phase 1.

## Validation Plan

Minimum validation for Phase 1:

```bash
git diff --check
node --import tsx --test tests/state-sync-audit.test.ts
node --import tsx --test tests/governance-check.test.ts
npm run typecheck
npm run build
node --import tsx scripts/run-state-sync-audit.ts --json
```

If behavior crosses more governance surfaces, also run:

```bash
npm test
```

## Rollback Plan

Phase 1 should preserve legacy Markdown compatibility. If the new structured
claim behavior causes unexpected blockage, revert the feature branch before
merge. If already merged, revert the source/test commit first, then re-anchor
state/docs through the existing state-only process.

## Resolved Decisions

- Push-to-main State Sync Audit is implemented. Pull requests and pushes to
  `main` both run the audit, with main-push audit gated on a committed
  `main` / `state_only_pushed` structured record.
- Strict state record path convergence is implemented. Broad `.agent_board/*`
  state-path allowance has been removed from state-sync path checks.
- Machine-mirrored Markdown evidence drift is blocking after Markdown authority
  removal. The claim remains authoritative; conflicting display fields block as
  stale evidence rather than overriding the claim.
- Unknown structured claim fields fail closed in schema v1. They are not warning
  fields and are not ignored.
