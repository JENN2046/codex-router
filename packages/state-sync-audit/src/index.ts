const CURRENT_STATE_DOC = "docs/current/CURRENT_STATE.md";
const STATE_SYNC_RECORD_DOC = "docs/current/state-sync-record.json";

const REQUIRED_PACKAGE_SCRIPTS = {
  governance: "tsx scripts/run-governance-check.ts"
} as const;

const STRICT_STATE_RECORD_PATHS = new Set([
  STATE_SYNC_RECORD_DOC
]);

const STATE_SYNC_REANCHOR_PR_BRANCH = "state-sync/reanchor-main";
const MAIN_BRANCH = "main";
const MAIN_UPSTREAM_REF = "refs/remotes/origin/main";

const ACCEPTED_CLAIM_SCHEMA_VERSION = 1;
const ACCEPTED_CLAIM_POLICY_VERSION = "state-sync-policy.v1";
const ACCEPTED_SOURCE_TREE_DIGEST_ALGORITHM = "git-ls-tree-sha256";
const ACCEPTED_TRANSITION_KINDS = new Set([
  "source_exact",
  "state_only_pending_push",
  "state_only_pushed",
  "detached_review_checkout"
]);

export interface StateSyncAuditInput {
  gitStatusShort: string;
  branch: string;
  head: string;
  parentHead?: string;
  allowedStateCommits?: string[];
  committedPathsSinceValidatedSource?: string[];
  validatedSourceTreeDiffPaths?: string[];
  validatedSourceCommitAvailable?: boolean;
  validatedSourceTreeDigest?: string;
  headSourceTreeDigest?: string;
  validatedSourceAncestorOfHead?: boolean;
  upstream: string;
  aheadBehind: string;
  validatedSourceAheadBehind?: string;
  packageJsonText: string;
  currentStateText: string;
  agentBoardText: string;
  agentBoardFiles?: StateSyncAgentBoardFile[];
  stateSyncClaimText?: string;
}

export interface StateSyncAgentBoardFile {
  path: string;
  text: string;
}

export type StateSyncClaimSource =
  | "structured"
  | "missing_structured"
  | "invalid_structured";

export type StateSyncTransitionKind =
  | "source_exact"
  | "state_only_pending_push"
  | "state_only_pushed"
  | "detached_review_checkout";

export interface StateSyncClaim {
  schemaVersion: 1;
  policyVersion: "state-sync-policy.v1";
  subject: {
    branch: string;
    upstream: string;
  };
  source: {
    validatedSourceCommit: string;
    latestValidatedCommit: string;
    recordedDivergence: {
      ahead: number;
      behind: number;
    };
    sourceTreeDigest: {
      algorithm: "git-ls-tree-sha256";
      value: string;
      excludedPaths: string[];
    };
  };
  transition: {
    kind: StateSyncTransitionKind;
    allowedStatePaths: string[];
  };
  validation?: {
    requiredCommands?: string[];
  };
}

export type StateSyncClaimParseResult =
  | { status: "absent" }
  | { status: "valid"; claim: StateSyncClaim }
  | { status: "invalid"; reason: string };

export interface StateSyncAuditIssue {
  code:
    | "state_document_secret_marker"
    | "state_document_windows_drive_path"
    | "state_document_unc_path"
    | "state_document_posix_machine_path";
  path: string;
  line: number;
  field?: string;
  risk: "secret_marker" | "machine_path_disclosure";
}

export interface StateSyncAuditResult {
  status: "passed" | "blocked";
  checks: {
    packageScriptPresent: boolean;
    currentStateRecorded: boolean;
    currentBranchMatches: boolean;
    validatedSourceHeadRecorded: boolean;
    validatedSourceCommitRecorded: boolean;
    upstreamRecorded: boolean;
    validatedSourceDivergenceRecorded: boolean;
    latestValidatedCommitRecorded: boolean;
    dirtyWorktreeStateOnly: boolean;
    staleAfterCommitRecorded: boolean;
    validationBaselineRecorded: boolean;
    executionBoundaryRecorded: boolean;
    agentBoardAligned: boolean;
    staleMarkersAbsent: boolean;
    structuredClaimValid: boolean;
    evidenceDriftAbsent: boolean;
    structuredTransitionAllowed: boolean;
    outputSanitized: boolean;
    auditReadOnly: boolean;
  };
  summary: {
    branch: string;
    head: string;
    upstream: string;
    ahead: number;
    behind: number;
    validatedSourceAhead: number;
    validatedSourceBehind: number;
    gitStatusEntryCount: number;
    packageScriptTargetCount: number;
    packageScriptMismatchCount: number;
    claimSource: StateSyncClaimSource;
    requiredValidationCommandCount: number;
    requiredBoundaryMarkerCount: number;
    staleMarkerHitCount: number;
    stateWritesDuringAudit: 0;
    remoteWritesDuringAudit: 0;
  };
  reasons: string[];
  issues: StateSyncAuditIssue[];
}

export type StateSyncAuditOutputFormat = "text" | "json";

interface ResolvedStateSyncClaim {
  claimSource: StateSyncClaimSource;
  structuredClaimValid: boolean;
  currentHead: string | undefined;
  branch: string | undefined;
  upstream: string | undefined;
  validatedSourceCommit: string | undefined;
  latestValidatedCommit: string | undefined;
  upstreamDivergence: string | undefined;
  sourceTreeDigest: StateSyncClaim["source"]["sourceTreeDigest"] | undefined;
  transitionKind: StateSyncTransitionKind | undefined;
  allowedStatePaths: string[] | undefined;
}

export function parseStateSyncClaim(
  rawText: string | undefined
): StateSyncClaimParseResult {
  if (rawText === undefined) {
    return { status: "absent" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return { status: "invalid", reason: "invalid_json" };
  }

  if (!isRecord(parsed)) {
    return { status: "invalid", reason: "claim_not_object" };
  }

  if (!hasOnlyKeys(
    parsed,
    ["schemaVersion", "policyVersion", "subject", "source", "transition", "validation"]
  )) {
    return { status: "invalid", reason: "unknown_claim_field" };
  }

  if (parsed.schemaVersion !== ACCEPTED_CLAIM_SCHEMA_VERSION) {
    return { status: "invalid", reason: "unsupported_schema_version" };
  }

  if (parsed.policyVersion !== ACCEPTED_CLAIM_POLICY_VERSION) {
    return { status: "invalid", reason: "unsupported_policy_version" };
  }

  const subject = parsed.subject;
  if (!isRecord(subject)) {
    return { status: "invalid", reason: "subject_missing" };
  }
  if (!hasOnlyKeys(subject, ["branch", "upstream"])) {
    return { status: "invalid", reason: "subject_unknown_field" };
  }

  const branch = stringField(subject, "branch");
  const upstream = stringField(subject, "upstream");
  if (branch === undefined || branch.trim() === "" || upstream === undefined) {
    return { status: "invalid", reason: "subject_malformed" };
  }

  const source = parsed.source;
  if (!isRecord(source)) {
    return { status: "invalid", reason: "source_missing" };
  }
  if (!hasOnlyKeys(
    source,
    [
      "validatedSourceCommit",
      "latestValidatedCommit",
      "recordedDivergence",
      "sourceTreeDigest"
    ]
  )) {
    return { status: "invalid", reason: "source_unknown_field" };
  }

  const validatedSourceCommit = commitField(source, "validatedSourceCommit");
  const latestValidatedCommit = commitField(source, "latestValidatedCommit");
  if (validatedSourceCommit === undefined || latestValidatedCommit === undefined) {
    return { status: "invalid", reason: "source_commit_malformed" };
  }

  const recordedDivergence = source.recordedDivergence;
  if (!isRecord(recordedDivergence)) {
    return { status: "invalid", reason: "recorded_divergence_missing" };
  }
  if (!hasOnlyKeys(recordedDivergence, ["ahead", "behind"])) {
    return { status: "invalid", reason: "recorded_divergence_unknown_field" };
  }

  const recordedAhead = nonNegativeIntegerField(recordedDivergence, "ahead");
  const recordedBehind = nonNegativeIntegerField(recordedDivergence, "behind");
  if (recordedAhead === undefined || recordedBehind === undefined) {
    return { status: "invalid", reason: "recorded_divergence_malformed" };
  }

  const sourceTreeDigest = source.sourceTreeDigest;
  if (!isRecord(sourceTreeDigest)) {
    return { status: "invalid", reason: "source_tree_digest_missing" };
  }
  if (!hasOnlyKeys(sourceTreeDigest, ["algorithm", "value", "excludedPaths"])) {
    return { status: "invalid", reason: "source_tree_digest_unknown_field" };
  }

  const sourceTreeDigestAlgorithm = stringField(sourceTreeDigest, "algorithm");
  const sourceTreeDigestValue = stringField(sourceTreeDigest, "value");
  const sourceTreeDigestExcludedPaths =
    stringArrayField(sourceTreeDigest, "excludedPaths");
  if (
    sourceTreeDigestAlgorithm !== ACCEPTED_SOURCE_TREE_DIGEST_ALGORITHM
    || sourceTreeDigestValue === undefined
    || !isSha256Hex(sourceTreeDigestValue)
    || sourceTreeDigestExcludedPaths === undefined
    || sourceTreeDigestExcludedPaths.length === 0
    || !sourceTreeDigestExcludedPaths.every(isStrictStateRecordPath)
  ) {
    return { status: "invalid", reason: "source_tree_digest_malformed" };
  }

  const transition = parsed.transition;
  if (!isRecord(transition)) {
    return { status: "invalid", reason: "transition_missing" };
  }
  if (!hasOnlyKeys(transition, ["kind", "allowedStatePaths"])) {
    return { status: "invalid", reason: "transition_unknown_field" };
  }

  const transitionKind = transitionKindField(transition, "kind");
  if (transitionKind === undefined) {
    return { status: "invalid", reason: "transition_kind_malformed" };
  }

  const allowedStatePaths = stringArrayField(transition, "allowedStatePaths");
  if (
    allowedStatePaths === undefined
    || allowedStatePaths.length === 0
    || !allowedStatePaths.every(isStrictStateRecordPath)
  ) {
    return { status: "invalid", reason: "allowed_state_paths_malformed" };
  }

  if (!sameStringSet(sourceTreeDigestExcludedPaths, allowedStatePaths)) {
    return { status: "invalid", reason: "source_tree_digest_exclusions_mismatched" };
  }

  const validation = optionalValidation(parsed.validation);
  if (validation === false) {
    return { status: "invalid", reason: "validation_malformed" };
  }

  const claim: StateSyncClaim = {
    schemaVersion: ACCEPTED_CLAIM_SCHEMA_VERSION,
    policyVersion: ACCEPTED_CLAIM_POLICY_VERSION,
    subject: {
      branch,
      upstream
    },
    source: {
      validatedSourceCommit,
      latestValidatedCommit,
      recordedDivergence: {
        ahead: recordedAhead,
        behind: recordedBehind
      },
      sourceTreeDigest: {
        algorithm: ACCEPTED_SOURCE_TREE_DIGEST_ALGORITHM,
        value: sourceTreeDigestValue,
        excludedPaths: sourceTreeDigestExcludedPaths
      }
    },
    transition: {
      kind: transitionKind,
      allowedStatePaths
    }
  };

  if (validation !== undefined) {
    claim.validation = validation;
  }

  return {
    status: "valid",
    claim
  };
}

export function resolveStateSyncClaim(
  input: StateSyncAuditInput
): ResolvedStateSyncClaim {
  const parsed = parseStateSyncClaim(input.stateSyncClaimText);

  if (parsed.status === "invalid") {
    return {
      claimSource: "invalid_structured",
      structuredClaimValid: false,
      currentHead: undefined,
      branch: undefined,
      upstream: undefined,
      validatedSourceCommit: undefined,
      latestValidatedCommit: undefined,
      upstreamDivergence: undefined,
      sourceTreeDigest: undefined,
      transitionKind: undefined,
      allowedStatePaths: undefined
    };
  }

  if (parsed.status === "valid") {
    const upstreamDivergence = formatUpstreamDivergence(
      parsed.claim.source.recordedDivergence
    );

    return {
      claimSource: "structured",
      structuredClaimValid: true,
      currentHead: parsed.claim.source.validatedSourceCommit,
      branch: parsed.claim.subject.branch,
      upstream: normalizeClaimUpstreamRef(parsed.claim.subject.upstream),
      validatedSourceCommit: parsed.claim.source.validatedSourceCommit,
      latestValidatedCommit: parsed.claim.source.latestValidatedCommit,
      upstreamDivergence,
      sourceTreeDigest: parsed.claim.source.sourceTreeDigest,
      transitionKind: parsed.claim.transition.kind,
      allowedStatePaths: parsed.claim.transition.allowedStatePaths
    };
  }

  return {
    claimSource: "missing_structured",
    structuredClaimValid: false,
    currentHead: undefined,
    branch: undefined,
    upstream: undefined,
    validatedSourceCommit: undefined,
    latestValidatedCommit: undefined,
    upstreamDivergence: undefined,
    sourceTreeDigest: undefined,
    transitionKind: undefined,
    allowedStatePaths: undefined
  };
}

export function reviewStateSyncAudit(
  input: StateSyncAuditInput
): StateSyncAuditResult {
  const packageJson = parseObject(input.packageJsonText);
  const packageScriptReview = reviewPackageScripts(packageJson);
  const resolvedClaim = resolveStateSyncClaim(input);
  const { ahead, behind } = parseAheadBehind(input.aheadBehind);
  const {
    ahead: validatedSourceAhead,
    behind: validatedSourceBehind
  } = parseAheadBehind(input.validatedSourceAheadBehind ?? "unknown\tunknown");
  const currentHead = resolvedClaim.currentHead;
  const validatedSourceCommit = resolvedClaim.validatedSourceCommit;
  const latestValidatedCommit = resolvedClaim.latestValidatedCommit;
  const upstreamDivergence = resolvedClaim.upstreamDivergence;
  const stateSurfaces = [
    {
      path: CURRENT_STATE_DOC,
      text: input.currentStateText
    },
    {
      path: ".agent_board/*",
      text: input.agentBoardText
    }
  ];
  if (input.stateSyncClaimText !== undefined) {
    stateSurfaces.push({
      path: STATE_SYNC_RECORD_DOC,
      text: input.stateSyncClaimText
    });
  }
  const sanitization = inspectStateSyncSanitization(stateSurfaces);
  const syntheticReviewState = syntheticReviewStateAllowed(
    input,
    resolvedClaim,
    currentHead,
    validatedSourceCommit,
    latestValidatedCommit,
    ahead,
    behind,
    validatedSourceAhead,
    validatedSourceBehind
  );
  const detachedSyntheticReviewCheckout = syntheticReviewState !== undefined;
  const sourceTreeDigestCompatibleWithHead =
    sourceTreeDigestMatchesHead(resolvedClaim, input);
  const sourceTreeDigestCommitBindingValid =
    sourceTreeDigestMatchesValidatedSourceCommit(resolvedClaim, input);
  const sourceTreeDigestOnlyCompatibility =
    input.validatedSourceCommitAvailable === false
    && sourceTreeDigestCompatibleWithHead;
  const stateSyncReanchorPrCandidate =
    stateSyncReanchorPrCandidateCheckout(resolvedClaim, input);
  const checks = {
    packageScriptPresent: packageScriptReview.mismatchCount === 0,
    currentStateRecorded: true,
    currentBranchMatches:
      detachedSyntheticReviewCheckout
      || stateSyncReanchorPrCandidate
      || resolvedBranchMatchesInput(resolvedClaim, input),
    validatedSourceHeadRecorded: stateCommitMatchesValidatedSource(
      currentHead,
      validatedSourceCommit,
      latestValidatedCommit,
      input.head,
      input.parentHead,
      input.committedPathsSinceValidatedSource,
      input.validatedSourceTreeDiffPaths,
      input.validatedSourceAncestorOfHead,
      sourceTreeDigestOnlyCompatibility,
      input.allowedStateCommits,
      syntheticReviewState,
      resolvedClaim.allowedStatePaths
    ),
    validatedSourceCommitRecorded: stateCommitMatchesValidatedSource(
      validatedSourceCommit,
      validatedSourceCommit,
      latestValidatedCommit,
      input.head,
      input.parentHead,
      input.committedPathsSinceValidatedSource,
      input.validatedSourceTreeDiffPaths,
      input.validatedSourceAncestorOfHead,
      sourceTreeDigestOnlyCompatibility,
      input.allowedStateCommits,
      syntheticReviewState,
      resolvedClaim.allowedStatePaths
    ),
    upstreamRecorded:
      resolvedClaim.claimSource === "structured"
        ? resolvedClaim.upstream === input.upstream
        : input.upstream === "" || resolvedClaim.upstream === input.upstream,
    validatedSourceDivergenceRecorded:
      validatedSourceDivergenceIsRecorded(
        detachedSyntheticReviewCheckout,
        upstreamDivergence,
        stateOnlyDivergenceSnapshotAllowed(resolvedClaim),
        input.committedPathsSinceValidatedSource,
        input.validatedSourceAncestorOfHead,
        ahead,
        behind,
        validatedSourceAhead,
        validatedSourceBehind,
        resolvedClaim.allowedStatePaths,
        sourceTreeDigestOnlyCompatibility,
        stateSyncReanchorPrCandidate
      ),
    latestValidatedCommitRecorded:
      latestValidatedCommit !== undefined
      && latestValidatedCommit === validatedSourceCommit
      && stateCommitMatchesHead(
        latestValidatedCommit,
        input.head,
        input.parentHead,
        input.committedPathsSinceValidatedSource,
        input.validatedSourceTreeDiffPaths,
        input.validatedSourceAncestorOfHead,
        sourceTreeDigestOnlyCompatibility,
        input.allowedStateCommits,
        syntheticReviewState,
        resolvedClaim.allowedStatePaths
      ),
    dirtyWorktreeStateOnly: dirtyStatusEntriesAreAllowedStatePaths(
      input.gitStatusShort,
      resolvedClaim.allowedStatePaths
    ),
    staleAfterCommitRecorded: true,
    validationBaselineRecorded: true,
    executionBoundaryRecorded: true,
    agentBoardAligned: true,
    staleMarkersAbsent: true,
    structuredClaimValid: resolvedClaim.structuredClaimValid,
    evidenceDriftAbsent: true,
    structuredTransitionAllowed: structuredTransitionIsAllowed(
      resolvedClaim,
      input,
      ahead,
      behind,
      validatedSourceAhead,
      validatedSourceBehind,
      detachedSyntheticReviewCheckout,
      sourceTreeDigestCommitBindingValid,
      sourceTreeDigestOnlyCompatibility,
      stateSyncReanchorPrCandidate
    ),
    outputSanitized: sanitization.issues.length === 0,
    auditReadOnly: true
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      branch: input.branch,
      head: input.head,
      upstream: input.upstream,
      ahead,
      behind,
      validatedSourceAhead,
      validatedSourceBehind,
      gitStatusEntryCount: countStatusEntries(input.gitStatusShort),
      packageScriptTargetCount: packageScriptReview.targetCount,
      packageScriptMismatchCount: packageScriptReview.mismatchCount,
      claimSource: resolvedClaim.claimSource,
      requiredValidationCommandCount: 0,
      requiredBoundaryMarkerCount: 0,
      staleMarkerHitCount: 0,
      stateWritesDuringAudit: 0,
      remoteWritesDuringAudit: 0
    },
    reasons,
    issues: sanitization.issues
  };
}

export function formatStateSyncAuditResult(
  review: StateSyncAuditResult,
  format: StateSyncAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "State sync audit",
    `status: ${review.status}`,
    `branch: ${review.summary.branch}`,
    `head: ${review.summary.head}`,
    `upstream: ${review.summary.upstream}`,
    `ahead: ${review.summary.ahead}`,
    `behind: ${review.summary.behind}`,
    `validated source ahead: ${review.summary.validatedSourceAhead}`,
    `validated source behind: ${review.summary.validatedSourceBehind}`,
    `git status entries: ${review.summary.gitStatusEntryCount}`,
    `package script targets: ${review.summary.packageScriptTargetCount}`,
    `package script mismatches: ${review.summary.packageScriptMismatchCount}`,
    `claim source: ${review.summary.claimSource}`,
    `validation commands: ${review.summary.requiredValidationCommandCount}`,
    `boundary markers: ${review.summary.requiredBoundaryMarkerCount}`,
    `stale marker hits: ${review.summary.staleMarkerHitCount}`,
    `state writes during audit: ${review.summary.stateWritesDuringAudit}`,
    `remote writes during audit: ${review.summary.remoteWritesDuringAudit}`,
    ...(review.reasons.length > 0 ? [`reasons: ${review.reasons.join(",")}`] : []),
    ...review.issues.map((issue) => (
      `issue: ${issue.code} ${issue.path}:${issue.line} ${issue.risk}`
    ))
  ].join("\n");
}

function reviewPackageScripts(packageJson: Record<string, unknown> | undefined): {
  targetCount: number;
  mismatchCount: number;
} {
  const scripts = packageJson?.scripts;
  const entries = Object.entries(REQUIRED_PACKAGE_SCRIPTS);

  return {
    targetCount: entries.length,
    mismatchCount: entries.filter(
      ([scriptName, expectedCommand]) =>
        !isRecord(scripts) || scripts[scriptName] !== expectedCommand
    ).length
  };
}

function stringField(
  record: Record<string, unknown>,
  key: string
): string | undefined {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

function stringArrayField(
  record: Record<string, unknown>,
  key: string
): string[] | undefined {
  const value = record[key];
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    return undefined;
  }

  return value;
}

function commitField(
  record: Record<string, unknown>,
  key: string
): string | undefined {
  const value = stringField(record, key);
  if (value === undefined || !isStateSyncCommitLike(value)) {
    return undefined;
  }

  return value;
}

function isSha256Hex(value: string): boolean {
  return /^[0-9a-f]{64}$/.test(value);
}

function sameStringSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  const rightSet = new Set(right);
  return left.every((value) => rightSet.has(value));
}

function nonNegativeIntegerField(
  record: Record<string, unknown>,
  key: string
): number | undefined {
  const value = record[key];
  if (
    typeof value !== "number"
    || !Number.isInteger(value)
    || value < 0
    || !Number.isFinite(value)
  ) {
    return undefined;
  }

  return value;
}

function isStateSyncCommitLike(value: string): boolean {
  return /^[0-9a-f]{7,40}$/i.test(value);
}

function transitionKindField(
  record: Record<string, unknown>,
  key: string
): StateSyncTransitionKind | undefined {
  const value = stringField(record, key);
  if (value === undefined || !ACCEPTED_TRANSITION_KINDS.has(value)) {
    return undefined;
  }

  return value as StateSyncTransitionKind;
}

function optionalValidation(
  value: unknown
): { requiredCommands?: string[] } | undefined | false {
  if (value === undefined) {
    return undefined;
  }

  if (!isRecord(value)) {
    return false;
  }

  if (!hasOnlyKeys(value, ["requiredCommands"])) {
    return false;
  }

  const requiredCommands = stringArrayField(value, "requiredCommands");
  if (value.requiredCommands !== undefined && requiredCommands === undefined) {
    return false;
  }

  return requiredCommands === undefined ? {} : { requiredCommands };
}

function hasOnlyKeys(
  record: Record<string, unknown>,
  allowedKeys: readonly string[]
): boolean {
  const allowed = new Set(allowedKeys);
  return Object.keys(record).every((key) => allowed.has(key));
}

function formatUpstreamDivergence(input: {
  ahead: number;
  behind: number;
}): string {
  return `ahead ${input.ahead} / behind ${input.behind}`;
}

function normalizeClaimUpstreamRef(ref: string): string {
  return ref.startsWith("origin/") ? `refs/remotes/${ref}` : ref;
}

function normalizeOptionalUpstreamRef(ref: string | undefined): string | undefined {
  return ref === undefined ? undefined : normalizeClaimUpstreamRef(ref);
}

function stateOnlyDivergenceSnapshotAllowed(
  resolvedClaim: ResolvedStateSyncClaim
): boolean {
  return resolvedClaim.claimSource === "structured"
    && resolvedClaim.transitionKind === "state_only_pushed";
}

function structuredTransitionIsAllowed(
  resolvedClaim: ResolvedStateSyncClaim,
  input: StateSyncAuditInput,
  currentAhead: number,
  currentBehind: number,
  validatedSourceAhead: number,
  validatedSourceBehind: number,
  detachedSyntheticReviewCheckout: boolean,
  sourceTreeDigestCommitBindingValid: boolean,
  sourceTreeDigestOnlyCompatibility: boolean,
  stateSyncReanchorPrCandidate: boolean
): boolean {
  if (
    resolvedClaim.claimSource === "invalid_structured"
    || resolvedClaim.claimSource === "missing_structured"
    || resolvedClaim.transitionKind === undefined
    || resolvedClaim.allowedStatePaths === undefined
    || resolvedClaim.validatedSourceCommit === undefined
    || resolvedClaim.latestValidatedCommit === undefined
  ) {
    return false;
  }

  const recorded = parseUpstreamDivergenceField(resolvedClaim.upstreamDivergence);
  if (recorded === undefined || recorded.ahead < 0 || recorded.behind < 0) {
    return false;
  }

  const subjectMatches = subjectMatchesInput(resolvedClaim, input);
  const latestMatches =
    resolvedClaim.latestValidatedCommit === resolvedClaim.validatedSourceCommit;
  const dirtyPathsAllowed = dirtyStatusEntriesAreAllowedStatePaths(
    input.gitStatusShort,
    resolvedClaim.allowedStatePaths
  );

  if (resolvedClaim.transitionKind === "source_exact") {
    return subjectMatches
      && input.head === resolvedClaim.validatedSourceCommit
      && latestMatches
      && sourceTreeDigestCommitBindingValid
      && divergenceMatches(recorded, validatedSourceAhead, validatedSourceBehind)
      && dirtyPathsAllowed;
  }

  if (resolvedClaim.transitionKind === "state_only_pending_push") {
    const stateOnlyDeltaPaths = stateOnlyDeltaPathsToHead(
      input.committedPathsSinceValidatedSource,
      input.validatedSourceTreeDiffPaths,
      input.validatedSourceAncestorOfHead,
      resolvedClaim.allowedStatePaths
    );
    const stateOnlyDeltaAllowed =
      stateOnlyDeltaPaths !== undefined
      && stateOnlyDeltaPaths.length > 0
      && pathsAreAllowed(
        stateOnlyDeltaPaths,
        resolvedClaim.allowedStatePaths,
        isAllowedStatePath
      );
    const divergenceAllowed =
      divergenceMatches(recorded, validatedSourceAhead, validatedSourceBehind)
      || (
        sourceTreeDigestOnlyCompatibility
        && currentAhead > 0
        && currentBehind === 0
        && recorded.ahead > 0
        && recorded.behind === 0
      );

    return subjectMatches
      && input.head !== resolvedClaim.validatedSourceCommit
      && (
        (stateOnlyDeltaAllowed && sourceTreeDigestCommitBindingValid)
        || sourceTreeDigestOnlyCompatibility
      )
      && currentAhead > 0
      && currentBehind === 0
      && divergenceAllowed
      && latestMatches
      && dirtyPathsAllowed;
  }

  if (resolvedClaim.transitionKind === "state_only_pushed") {
    const pushedMainSnapshotAllowed = subjectMatches
      && input.validatedSourceAncestorOfHead === true
      && input.committedPathsSinceValidatedSource !== undefined
      && sourceTreeDigestCommitBindingValid
      && pathsAreAllowed(
        input.committedPathsSinceValidatedSource,
        resolvedClaim.allowedStatePaths,
        isStrictStateRecordPath
      )
      && currentAhead === 0
      && currentBehind === 0
      && validatedSourceAhead === 0
      && validatedSourceBehind > 0
      && recorded.ahead === validatedSourceBehind
      && recorded.behind === 0
      && latestMatches
      && dirtyPathsAllowed;

    const reanchorPrCandidateAllowed =
      stateSyncReanchorPrCandidate
      && input.validatedSourceAncestorOfHead === true
      && input.committedPathsSinceValidatedSource !== undefined
      && sourceTreeDigestCommitBindingValid
      && pathsAreAllowed(
        input.committedPathsSinceValidatedSource,
        resolvedClaim.allowedStatePaths,
        isStrictStateRecordPath
      )
      && currentAhead === 1
      && currentBehind === 0
      && validatedSourceAhead === 0
      && validatedSourceBehind === 0
      && recorded.ahead === 1
      && recorded.behind === 0
      && latestMatches
      && dirtyPathsAllowed;

    return pushedMainSnapshotAllowed || reanchorPrCandidateAllowed;
  }

  return detachedSyntheticReviewCheckout
    && input.branch === ""
    && input.upstream === ""
    && input.head === resolvedClaim.validatedSourceCommit
    && currentAhead === -1
    && currentBehind === -1
    && validatedSourceAhead === -1
    && validatedSourceBehind === -1
    && countStatusEntries(input.gitStatusShort) === 0
    && resolvedClaim.validatedSourceCommit === resolvedClaim.latestValidatedCommit;
}

function divergenceMatches(
  recorded: { ahead: number; behind: number },
  ahead: number,
  behind: number
): boolean {
  return ahead >= 0
    && behind >= 0
    && recorded.ahead === ahead
    && recorded.behind === behind;
}

function sourceTreeDigestMatchesValidatedSourceCommit(
  resolvedClaim: ResolvedStateSyncClaim,
  input: StateSyncAuditInput
): boolean {
  const expected = resolvedClaim.sourceTreeDigest?.value;
  if (expected === undefined) {
    return false;
  }

  if (input.validatedSourceTreeDigest !== undefined) {
    return input.validatedSourceTreeDigest === expected;
  }

  if (input.validatedSourceCommitAvailable === false) {
    return input.headSourceTreeDigest === expected;
  }

  return false;
}

function sourceTreeDigestMatchesHead(
  resolvedClaim: ResolvedStateSyncClaim,
  input: StateSyncAuditInput
): boolean {
  const expected = resolvedClaim.sourceTreeDigest?.value;
  return expected !== undefined && input.headSourceTreeDigest === expected;
}

function subjectMatchesInput(
  resolvedClaim: ResolvedStateSyncClaim,
  input: StateSyncAuditInput
): boolean {
  return resolvedClaim.upstream === input.upstream
    && (
      resolvedBranchMatchesInput(resolvedClaim, input)
      || stateSyncReanchorPrCandidateCheckout(resolvedClaim, input)
    );
}

function resolvedBranchMatchesInput(
  resolvedClaim: ResolvedStateSyncClaim,
  input: StateSyncAuditInput
): boolean {
  if (resolvedClaim.branch === input.branch) {
    return true;
  }

  return resolvedClaim.claimSource === "structured"
    && input.branch === ""
    && resolvedClaim.branch !== undefined
    && resolvedClaim.branch !== ""
    && resolvedClaim.upstream === input.upstream;
}

function stateSyncReanchorPrCandidateCheckout(
  resolvedClaim: ResolvedStateSyncClaim,
  input: StateSyncAuditInput
): boolean {
  return resolvedClaim.claimSource === "structured"
    && resolvedClaim.branch === MAIN_BRANCH
    && resolvedClaim.upstream === MAIN_UPSTREAM_REF
    && resolvedClaim.transitionKind === "state_only_pushed"
    && input.branch === STATE_SYNC_REANCHOR_PR_BRANCH
    && input.upstream === MAIN_UPSTREAM_REF;
}

function fieldIncludes(text: string, field: string, value: string): boolean {
  return text.includes(`| ${field} | \`${value}\` |`);
}

function lineForMarker(text: string, marker: string): number {
  const index = text.indexOf(marker);
  return index >= 0 ? lineAtIndex(text, index) : 1;
}

function lineAtIndex(text: string, index: number): number {
  return text.slice(0, index).split(/\r?\n/).length;
}

function stateCommitMatchesHead(
  value: string | undefined,
  head: string,
  parentHead: string | undefined,
  committedPathsSinceValidatedSource: string[] | undefined,
  validatedSourceTreeDiffPaths: string[] | undefined,
  validatedSourceAncestorOfHead: boolean | undefined,
  sourceTreeDigestCompatibleWithHead: boolean,
  allowedStateCommits: string[] | undefined,
  syntheticReviewState: string | undefined,
  allowedStatePaths: string[] | undefined
): boolean {
  if (value === undefined) {
    return false;
  }

  const hasValidatedSourceEvidence =
    validatedSourceAncestorOfHead !== undefined
    || committedPathsSinceValidatedSource !== undefined
    || sourceTreeDigestCompatibleWithHead;

  return value === head
    || stateCommitHasStateOnlyDeltaToHead(
      value,
      head,
      committedPathsSinceValidatedSource,
      validatedSourceTreeDiffPaths,
      validatedSourceAncestorOfHead,
      allowedStatePaths
    )
    || sourceTreeDigestCompatibleWithHead
    || (
      syntheticReviewState !== undefined
      && reviewCheckoutCommitIsAllowed(
        value,
        parentHead,
        allowedStateCommits,
        syntheticReviewState,
        hasValidatedSourceEvidence
      )
    );
}

function stateCommitMatchesValidatedSource(
  value: string | undefined,
  validatedSourceCommit: string | undefined,
  latestValidatedCommit: string | undefined,
  head: string,
  parentHead: string | undefined,
  committedPathsSinceValidatedSource: string[] | undefined,
  validatedSourceTreeDiffPaths: string[] | undefined,
  validatedSourceAncestorOfHead: boolean | undefined,
  sourceTreeDigestCompatibleWithHead: boolean,
  allowedStateCommits: string[] | undefined,
  syntheticReviewState: string | undefined,
  allowedStatePaths: string[] | undefined
): boolean {
  if (
    value === undefined
    || validatedSourceCommit === undefined
    || latestValidatedCommit === undefined
  ) {
    return false;
  }

  return value === latestValidatedCommit
    && value === validatedSourceCommit
    && stateCommitMatchesHead(
      value,
      head,
      parentHead,
      committedPathsSinceValidatedSource,
      validatedSourceTreeDiffPaths,
      validatedSourceAncestorOfHead,
      sourceTreeDigestCompatibleWithHead,
      allowedStateCommits,
      syntheticReviewState,
      allowedStatePaths
    );
}

function validatedSourceDivergenceIsRecorded(
  detachedSyntheticReviewCheckout: boolean,
  value: string | undefined,
  stateOnlySnapshotAllowed: boolean,
  committedPathsSinceValidatedSource: string[] | undefined,
  validatedSourceAncestorOfHead: boolean | undefined,
  currentAhead: number,
  currentBehind: number,
  computedValidatedAhead: number,
  computedValidatedBehind: number,
  allowedStatePaths: string[] | undefined,
  sourceTreeDigestOnlyCompatibility: boolean,
  stateSyncReanchorPrCandidate: boolean
): boolean {
  if (detachedSyntheticReviewCheckout) {
    return true;
  }

  const recorded = parseUpstreamDivergenceField(value);
  if (
    recorded === undefined
    || recorded.ahead < 0
    || recorded.behind < 0
  ) {
    return false;
  }

  if (computedValidatedAhead < 0 || computedValidatedBehind < 0) {
    return sourceTreeDigestOnlyCompatibility
      && currentAhead > 0
      && currentBehind === 0
      && recorded.ahead > 0
      && recorded.behind === 0;
  }

  const exactMatch =
    recorded.ahead === computedValidatedAhead
    && recorded.behind === computedValidatedBehind;
  if (exactMatch) {
    return true;
  }

  return validatedSourceDivergenceSnapshotIsAllowed(
    recorded,
    stateOnlySnapshotAllowed,
    stateSyncReanchorPrCandidate,
    committedPathsSinceValidatedSource,
    validatedSourceAncestorOfHead,
    currentAhead,
    currentBehind,
    computedValidatedAhead,
    computedValidatedBehind,
    allowedStatePaths
  );
}

function validatedSourceDivergenceSnapshotIsAllowed(
  recorded: { ahead: number; behind: number },
  stateOnlySnapshotAllowed: boolean,
  stateSyncReanchorPrCandidate: boolean,
  committedPathsSinceValidatedSource: string[] | undefined,
  validatedSourceAncestorOfHead: boolean | undefined,
  currentAhead: number,
  currentBehind: number,
  computedValidatedAhead: number,
  computedValidatedBehind: number,
  allowedStatePaths: string[] | undefined
): boolean {
  const pushedMainSnapshotAllowed = stateOnlySnapshotAllowed
    && validatedSourceAncestorOfHead === true
    && committedPathsSinceValidatedSource !== undefined
    && pathsAreAllowed(
      committedPathsSinceValidatedSource,
      allowedStatePaths,
      isStrictStateRecordPath
    )
    && currentAhead === 0
    && currentBehind === 0
    && computedValidatedAhead === 0
    && computedValidatedBehind > 0
    && recorded.ahead === computedValidatedBehind
    && recorded.behind === 0;

  const reanchorPrCandidateSnapshotAllowed = stateSyncReanchorPrCandidate
    && validatedSourceAncestorOfHead === true
    && committedPathsSinceValidatedSource !== undefined
    && pathsAreAllowed(
      committedPathsSinceValidatedSource,
      allowedStatePaths,
      isStrictStateRecordPath
    )
    && currentAhead === 1
    && currentBehind === 0
    && computedValidatedAhead === 0
    && computedValidatedBehind === 0
    && recorded.ahead === 1
    && recorded.behind === 0;

  return pushedMainSnapshotAllowed || reanchorPrCandidateSnapshotAllowed;
}

function parseUpstreamDivergenceField(
  value: string | undefined
): { ahead: number; behind: number } | undefined {
  const match = /^ahead (-?\d+) \/ behind (-?\d+)$/.exec(value ?? "");
  if (match === null) {
    return undefined;
  }

  return {
    ahead: Number.parseInt(match[1] ?? "", 10),
    behind: Number.parseInt(match[2] ?? "", 10)
  };
}

function isStrictStateRecordPath(path: string): boolean {
  return STRICT_STATE_RECORD_PATHS.has(path);
}

function agentBoardBranchIsAligned(
  text: string,
  inputBranch: string,
  resolvedClaim: ResolvedStateSyncClaim,
  stateSyncReanchorPrCandidate: boolean
): boolean {
  if (stateSyncReanchorPrCandidate) {
    return resolvedClaim.branch !== undefined && text.includes(resolvedClaim.branch);
  }

  return text.includes(inputBranch);
}

function agentBoardCommitsMatchState(
  text: string,
  head: string,
  validatedSourceCommit: string | undefined,
  latestValidatedCommit: string | undefined,
  parentHead: string | undefined,
  committedPathsSinceValidatedSource: string[] | undefined,
  validatedSourceTreeDiffPaths: string[] | undefined,
  validatedSourceAncestorOfHead: boolean | undefined,
  sourceTreeDigestCompatibleWithHead: boolean,
  allowedStateCommits: string[] | undefined,
  syntheticReviewState: string | undefined,
  allowedStatePaths: string[] | undefined
): boolean {
  const allowed = new Set([head]);
  if (
    latestValidatedCommit !== undefined
    && latestValidatedCommit === validatedSourceCommit
    && stateCommitMatchesHead(
      latestValidatedCommit,
      head,
      parentHead,
      committedPathsSinceValidatedSource,
      validatedSourceTreeDiffPaths,
      validatedSourceAncestorOfHead,
      sourceTreeDigestCompatibleWithHead,
      allowedStateCommits,
      syntheticReviewState,
      allowedStatePaths
    )
  ) {
    allowed.add(latestValidatedCommit);
  }

  return commitLikeTokens(text).every((token) => allowed.has(token));
}

function stateCommitHasStateOnlyDeltaToHead(
  value: string,
  head: string,
  committedPathsSinceValidatedSource: string[] | undefined,
  validatedSourceTreeDiffPaths: string[] | undefined,
  validatedSourceAncestorOfHead: boolean | undefined,
  allowedStatePaths: string[] | undefined
): boolean {
  if (value === head) {
    return true;
  }

  return stateOnlyDeltaToHeadIsAllowed(
    committedPathsSinceValidatedSource,
    validatedSourceTreeDiffPaths,
    validatedSourceAncestorOfHead,
    allowedStatePaths,
    isAllowedStatePath
  );
}

function stateOnlyDeltaToHeadIsAllowed(
  committedPathsSinceValidatedSource: string[] | undefined,
  validatedSourceTreeDiffPaths: string[] | undefined,
  validatedSourceAncestorOfHead: boolean | undefined,
  allowedStatePaths: string[] | undefined,
  legacyPathAllowed: (path: string) => boolean
): boolean {
  const paths = stateOnlyDeltaPathsToHead(
    committedPathsSinceValidatedSource,
    validatedSourceTreeDiffPaths,
    validatedSourceAncestorOfHead,
    allowedStatePaths
  );
  if (paths === undefined) {
    return false;
  }

  return pathsAreAllowed(paths, allowedStatePaths, legacyPathAllowed);
}

function stateOnlyDeltaPathsToHead(
  committedPathsSinceValidatedSource: string[] | undefined,
  validatedSourceTreeDiffPaths: string[] | undefined,
  validatedSourceAncestorOfHead: boolean | undefined,
  allowedStatePaths: string[] | undefined
): string[] | undefined {
  if (validatedSourceAncestorOfHead === true) {
    return committedPathsSinceValidatedSource;
  }

  if (validatedSourceAncestorOfHead === false && allowedStatePaths !== undefined) {
    return validatedSourceTreeDiffPaths;
  }

  return undefined;
}

function stateCommitIsAllowed(
  value: string,
  parentHead: string | undefined,
  allowedStateCommits: string[] | undefined,
  syntheticReviewState: string | undefined
): boolean {
  return stateCompatibleCommits(
    parentHead,
    allowedStateCommits,
    syntheticReviewState
  ).includes(value);
}

function reviewCheckoutCommitIsAllowed(
  value: string,
  parentHead: string | undefined,
  allowedStateCommits: string[] | undefined,
  syntheticReviewState: string | undefined,
  hasValidatedSourceEvidence: boolean
): boolean {
  if (hasValidatedSourceEvidence) {
    return (allowedStateCommits ?? []).includes(value);
  }

  return stateCommitIsAllowed(
    value,
    parentHead,
    allowedStateCommits,
    syntheticReviewState
  );
}

function stateCompatibleCommits(
  parentHead: string | undefined,
  allowedStateCommits: string[] | undefined,
  syntheticReviewState: string | undefined
): string[] {
  const mergeAncestryCommits = allowedStateCommits ?? [];
  const fallbackCommits = mergeAncestryCommits.length > 0
    ? mergeAncestryCommits
    : [
        ...(parentHead !== undefined ? [parentHead] : []),
        ...(syntheticReviewState !== undefined ? [syntheticReviewState] : [])
      ];

  return Array.from(new Set(fallbackCommits));
}

function syntheticReviewStateAllowed(
  input: StateSyncAuditInput,
  resolvedClaim: ResolvedStateSyncClaim,
  currentHead: string | undefined,
  validatedSourceCommit: string | undefined,
  latestValidatedCommit: string | undefined,
  ahead: number,
  behind: number,
  validatedSourceAhead: number,
  validatedSourceBehind: number
): string | undefined {
  if (
    resolvedClaim.claimSource !== "structured"
    || resolvedClaim.transitionKind !== "detached_review_checkout"
  ) {
    return undefined;
  }

  if (
    currentHead === undefined
    || validatedSourceCommit === undefined
    || latestValidatedCommit === undefined
    || currentHead !== validatedSourceCommit
    || validatedSourceCommit !== latestValidatedCommit
    || validatedSourceCommit !== input.head
  ) {
    return undefined;
  }

  const cleanDetachedUnknownDivergence =
    input.branch === ""
    && input.upstream === ""
    && ahead === -1
    && behind === -1
    && validatedSourceAhead === -1
    && validatedSourceBehind === -1;

  if (!cleanDetachedUnknownDivergence) {
    return undefined;
  }

  if (countStatusEntries(input.gitStatusShort) !== 0) {
    return undefined;
  }

  return currentHead;
}

function commitLikeTokens(text: string): string[] {
  return Array.from(new Set(text.match(/\b[0-9a-f]{7,40}\b/g) ?? []));
}

function dirtyStatusEntriesAreAllowedStatePaths(
  gitStatusShort: string,
  allowedStatePaths: string[] | undefined
): boolean {
  return pathsAreAllowed(
    statusPaths(gitStatusShort),
    allowedStatePaths,
    isAllowedStatePath
  );
}

function statusPaths(gitStatusShort: string): string[] {
  return gitStatusShort
    .split(/\r?\n/)
    .flatMap((line) => {
      if (line.trim() === "") {
        return [];
      }

      const pathText = line.length > 3 ? line.slice(3).trim() : line.trim();
      return pathText
        .split(" -> ")
        .map((path) => unquoteGitStatusPath(path.trim()))
        .filter(Boolean);
    });
}

function unquoteGitStatusPath(path: string): string {
  if (path.startsWith("\"") && path.endsWith("\"")) {
    return path.slice(1, -1);
  }

  return path;
}

function isAllowedStatePath(path: string): boolean {
  return isStrictStateRecordPath(path);
}

function pathsAreAllowed(
  paths: string[],
  allowedStatePaths: string[] | undefined,
  legacyPathAllowed: (path: string) => boolean
): boolean {
  if (allowedStatePaths === undefined) {
    return paths.every(legacyPathAllowed);
  }

  const allowed = new Set(allowedStatePaths);
  return paths.every((path) => allowed.has(path));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function inspectStateSyncSanitization(
  surfaces: Array<{ path: string; text: string }>
): { issues: StateSyncAuditIssue[] } {
  const issues: StateSyncAuditIssue[] = [];

  for (const surface of surfaces) {
    const lines = surface.text.split(/\r?\n/);
    for (const [index, line] of lines.entries()) {
      issues.push(...inspectStateSyncLine(surface.path, index + 1, line));
    }
  }

  return { issues };
}

function inspectStateSyncLine(
  path: string,
  line: number,
  text: string
): StateSyncAuditIssue[] {
  const issues: StateSyncAuditIssue[] = [];
  const withoutUrls = text.replace(/\bhttps?:\/\/[^\s`|)]+/gi, "<url>");
  const slashText = withoutUrls.replace(/\\/g, "/");

  const secretMarkers = [
    "OPENAI_API_KEY",
    "CODEX_API_KEY",
    "CODEX_ACCESS_TOKEN",
    "sk-",
    "Bearer ",
    "raw token",
    "raw env"
  ];
  if (secretMarkers.some((marker) => text.includes(marker))) {
    issues.push({
      code: "state_document_secret_marker",
      path,
      line,
      risk: "secret_marker"
    });
  }

  if (containsPosixMachinePath(slashText)) {
    issues.push({
      code: "state_document_posix_machine_path",
      path,
      line,
      risk: "machine_path_disclosure"
    });
  }

  if (containsWindowsDrivePath(slashText)) {
    issues.push({
      code: "state_document_windows_drive_path",
      path,
      line,
      risk: "machine_path_disclosure"
    });
  }

  if (containsUncMachinePath(slashText)) {
    issues.push({
      code: "state_document_unc_path",
      path,
      line,
      risk: "machine_path_disclosure"
    });
  }

  return issues;
}

function containsPosixMachinePath(text: string): boolean {
  return /(?:^|[\s`|])\/(?:mnt|home|Users|workspace|workspaces)\//.test(text);
}

function containsWindowsDrivePath(text: string): boolean {
  return /(?:^|[^\w])[A-Za-z]:\/[^\s`|]+/.test(text)
    || /(?:^|[^\w])\/\/\?\/[A-Za-z]:\/[^\s`|]+/i.test(text);
}

function containsUncMachinePath(text: string): boolean {
  return /(?:^|[^\w])\/\/\?\/UNC\/[^/\s`|]+\/[^/\s`|]+/i.test(text)
    || /(?:^|[^\w])\/\/(?!\?\/)(?:[^/\s`|]+\/){2,}[^/\s`|]*/.test(text);
}

function collectReasons(checks: Record<string, boolean>): string[] {
  return Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([name]) => `state_sync_${name}`);
}

function parseAheadBehind(value: string): { ahead: number; behind: number } {
  const [aheadText, behindText] = value.split(/\s+/);
  return {
    ahead: parseCount(aheadText),
    behind: parseCount(behindText)
  };
}

function parseCount(value: string | undefined): number {
  if (value === undefined) {
    return -1;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : -1;
}

function countStatusEntries(value: string): number {
  return value.split(/\r?\n/).filter((line) => line.trim() !== "").length;
}

function parseObject(value: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(value) as unknown;
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
