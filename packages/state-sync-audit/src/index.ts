const CURRENT_STATE_DOC = "docs/current/CURRENT_STATE.md";
const STATE_SYNC_RECORD_DOC = "docs/current/state-sync-record.json";
const AGENT_BOARD_DIR = ".agent_board/";

const REQUIRED_PACKAGE_SCRIPTS = {
  governance: "tsx scripts/run-governance-check.ts"
} as const;

const REQUIRED_BOUNDARY_MARKERS = [
  "`general_workspace_write`",
  "`general_provider_execution`",
  "`protected_remote_write`",
  "`push_to_main`",
  "`release_tag_deploy`",
  "`secret_or_credential_change`",
  "`external_service_write`"
] as const;

const REQUIRED_VALIDATION_COMMANDS = [
  "`npx tsx --test tests\\codex-cli-host.test.ts`",
  "`npm run typecheck`",
  "`npm test`",
  "`npm run build`"
] as const;

const FORBIDDEN_STALE_MARKERS = [
  "`68320e3` mainline",
  "`68320e3`",
  "main` and `origin/main` are aligned at `68320e3`",
  "Current local branch:\n\n- `docs/update-agent-board-68320e3`",
  "Review and optionally commit the `.agent_board` refresh locally"
] as const;

const STRICT_STATE_RECORD_PATHS = new Set([
  CURRENT_STATE_DOC,
  STATE_SYNC_RECORD_DOC,
  ".agent_board/CHECKPOINT.md",
  ".agent_board/HANDOFF.md",
  ".agent_board/RUN_STATE.md",
  ".agent_board/TASK_QUEUE.md",
  ".agent_board/VALIDATION_LOG.md"
]);

const ACCEPTED_CLAIM_SCHEMA_VERSION = 1;
const ACCEPTED_CLAIM_POLICY_VERSION = "state-sync-policy.v1";
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
  validatedSourceAncestorOfHead?: boolean;
  upstream: string;
  aheadBehind: string;
  validatedSourceAheadBehind?: string;
  packageJsonText: string;
  currentStateText: string;
  agentBoardText: string;
  stateSyncClaimText?: string;
}

export type StateSyncClaimSource =
  | "structured"
  | "legacy_markdown"
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
    | "state_document_posix_machine_path"
    | "state_document_evidence_drift";
  path: string;
  line: number;
  field?: string;
  risk: "secret_marker" | "machine_path_disclosure" | "evidence_drift";
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
  transitionKind: StateSyncTransitionKind | undefined;
  allowedStatePaths: string[] | undefined;
  issues: StateSyncAuditIssue[];
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

  const branch = stringField(subject, "branch");
  const upstream = stringField(subject, "upstream");
  if (branch === undefined || upstream === undefined) {
    return { status: "invalid", reason: "subject_malformed" };
  }

  const source = parsed.source;
  if (!isRecord(source)) {
    return { status: "invalid", reason: "source_missing" };
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

  const recordedAhead = nonNegativeIntegerField(recordedDivergence, "ahead");
  const recordedBehind = nonNegativeIntegerField(recordedDivergence, "behind");
  if (recordedAhead === undefined || recordedBehind === undefined) {
    return { status: "invalid", reason: "recorded_divergence_malformed" };
  }

  const transition = parsed.transition;
  if (!isRecord(transition)) {
    return { status: "invalid", reason: "transition_missing" };
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
      transitionKind: undefined,
      allowedStatePaths: undefined,
      issues: []
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
      upstream: parsed.claim.subject.upstream,
      validatedSourceCommit: parsed.claim.source.validatedSourceCommit,
      latestValidatedCommit: parsed.claim.source.latestValidatedCommit,
      upstreamDivergence,
      transitionKind: parsed.claim.transition.kind,
      allowedStatePaths: parsed.claim.transition.allowedStatePaths,
      issues: collectStateSyncEvidenceDrift(input.currentStateText, parsed.claim)
    };
  }

  return {
    claimSource: "legacy_markdown",
    structuredClaimValid: true,
    currentHead: fieldValue(input.currentStateText, "Current head"),
    branch: fieldValue(input.currentStateText, "Current branch"),
    upstream: fieldValue(input.currentStateText, "Upstream"),
    validatedSourceCommit: fieldValue(input.currentStateText, "Validated source commit"),
    latestValidatedCommit: fieldValue(input.currentStateText, "Latest validated commit"),
    upstreamDivergence: fieldValue(input.currentStateText, "Upstream divergence"),
    transitionKind: undefined,
    allowedStatePaths: undefined,
    issues: []
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
  const staleAfterCommit = fieldIncludes(
    input.currentStateText,
    "Stale after commit",
    "true"
  );
  const staleMarkerHits = FORBIDDEN_STALE_MARKERS.filter((marker) =>
    input.agentBoardText.includes(marker) || input.currentStateText.includes(marker)
  );
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
    currentHead,
    validatedSourceCommit,
    latestValidatedCommit,
    ahead,
    behind,
    validatedSourceAhead,
    validatedSourceBehind,
    staleAfterCommit
  );
  const detachedSyntheticReviewCheckout = syntheticReviewState !== undefined;
  const checks = {
    packageScriptPresent: packageScriptReview.mismatchCount === 0,
    currentStateRecorded: input.currentStateText.includes("CURRENT_STATE_RECORDED"),
    currentBranchMatches:
      detachedSyntheticReviewCheckout
      || resolvedBranchMatchesInput(resolvedClaim, input),
    validatedSourceHeadRecorded: stateCommitMatchesValidatedSource(
      currentHead,
      validatedSourceCommit,
      latestValidatedCommit,
      input.head,
      input.parentHead,
      input.committedPathsSinceValidatedSource,
      input.validatedSourceAncestorOfHead,
      input.allowedStateCommits,
      syntheticReviewState,
      staleAfterCommit,
      resolvedClaim.allowedStatePaths
    ),
    validatedSourceCommitRecorded: stateCommitMatchesValidatedSource(
      validatedSourceCommit,
      validatedSourceCommit,
      latestValidatedCommit,
      input.head,
      input.parentHead,
      input.committedPathsSinceValidatedSource,
      input.validatedSourceAncestorOfHead,
      input.allowedStateCommits,
      syntheticReviewState,
      staleAfterCommit,
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
        stateOnlyDivergenceSnapshotAllowed(resolvedClaim, input.currentStateText),
        input.committedPathsSinceValidatedSource,
        input.validatedSourceAncestorOfHead,
        ahead,
        behind,
        validatedSourceAhead,
        validatedSourceBehind,
        resolvedClaim.allowedStatePaths
      ),
    latestValidatedCommitRecorded:
      latestValidatedCommit !== undefined
      && latestValidatedCommit === validatedSourceCommit
      && stateCommitMatchesHead(
          latestValidatedCommit,
          input.head,
          input.parentHead,
          input.committedPathsSinceValidatedSource,
          input.validatedSourceAncestorOfHead,
          input.allowedStateCommits,
          syntheticReviewState,
          staleAfterCommit,
          resolvedClaim.allowedStatePaths
        ),
    dirtyWorktreeStateOnly: dirtyStatusEntriesAreAllowedStatePaths(
      input.gitStatusShort,
      resolvedClaim.allowedStatePaths
    ),
    staleAfterCommitRecorded: staleAfterCommit,
    validationBaselineRecorded:
      REQUIRED_VALIDATION_COMMANDS.every((command) =>
        input.currentStateText.includes(command)
      ),
    executionBoundaryRecorded:
      REQUIRED_BOUNDARY_MARKERS.every((marker) =>
        input.currentStateText.includes(marker)
      ),
    agentBoardAligned:
      input.agentBoardText.includes(input.branch)
      && input.agentBoardText.includes(CURRENT_STATE_DOC)
      && agentBoardCommitsMatchState(
        input.agentBoardText,
        input.head,
        validatedSourceCommit,
        latestValidatedCommit,
        input.parentHead,
        input.committedPathsSinceValidatedSource,
        input.validatedSourceAncestorOfHead,
        input.allowedStateCommits,
        syntheticReviewState,
        staleAfterCommit,
        resolvedClaim.allowedStatePaths
      ),
    staleMarkersAbsent: staleMarkerHits.length === 0,
    structuredClaimValid: resolvedClaim.structuredClaimValid,
    structuredTransitionAllowed: structuredTransitionIsAllowed(
      resolvedClaim,
      input,
      ahead,
      behind,
      validatedSourceAhead,
      validatedSourceBehind,
      detachedSyntheticReviewCheckout
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
      requiredValidationCommandCount: REQUIRED_VALIDATION_COMMANDS.length,
      requiredBoundaryMarkerCount: REQUIRED_BOUNDARY_MARKERS.length,
      staleMarkerHitCount: staleMarkerHits.length,
      stateWritesDuringAudit: 0,
      remoteWritesDuringAudit: 0
    },
    reasons,
    issues: [
      ...sanitization.issues,
      ...resolvedClaim.issues
    ]
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

  const requiredCommands = stringArrayField(value, "requiredCommands");
  if (value.requiredCommands !== undefined && requiredCommands === undefined) {
    return false;
  }

  return requiredCommands === undefined ? {} : { requiredCommands };
}

function formatUpstreamDivergence(input: {
  ahead: number;
  behind: number;
}): string {
  return `ahead ${input.ahead} / behind ${input.behind}`;
}

function collectStateSyncEvidenceDrift(
  currentStateText: string,
  claim: StateSyncClaim
): StateSyncAuditIssue[] {
  const expectedFields = [
    {
      field: "Current branch",
      expected: claim.subject.branch
    },
    {
      field: "Current head",
      expected: claim.source.validatedSourceCommit
    },
    {
      field: "Validated source commit",
      expected: claim.source.validatedSourceCommit
    },
    {
      field: "Upstream",
      expected: claim.subject.upstream
    },
    {
      field: "Upstream divergence",
      expected: formatUpstreamDivergence(claim.source.recordedDivergence)
    },
    {
      field: "Latest validated commit",
      expected: claim.source.latestValidatedCommit
    }
  ];

  return expectedFields.flatMap(({ field, expected }) => {
    const actual = fieldValue(currentStateText, field);
    if (actual === undefined || actual === expected) {
      return [];
    }

    return [{
      code: "state_document_evidence_drift",
      path: CURRENT_STATE_DOC,
      line: fieldLine(currentStateText, field),
      field,
      risk: "evidence_drift"
    }];
  });
}

function stateOnlyDivergenceSnapshotAllowed(
  resolvedClaim: ResolvedStateSyncClaim,
  currentStateText: string
): boolean {
  if (resolvedClaim.claimSource === "structured") {
    return resolvedClaim.transitionKind === "state_only_pushed";
  }

  return fieldIncludes(
    currentStateText,
    "State record mode",
    "state-only descendant allowed"
  );
}

function structuredTransitionIsAllowed(
  resolvedClaim: ResolvedStateSyncClaim,
  input: StateSyncAuditInput,
  currentAhead: number,
  currentBehind: number,
  validatedSourceAhead: number,
  validatedSourceBehind: number,
  detachedSyntheticReviewCheckout: boolean
): boolean {
  if (resolvedClaim.claimSource === "legacy_markdown") {
    return true;
  }

  if (
    resolvedClaim.claimSource === "invalid_structured"
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
      && divergenceMatches(recorded, validatedSourceAhead, validatedSourceBehind)
      && dirtyPathsAllowed;
  }

  if (resolvedClaim.transitionKind === "state_only_pending_push") {
    return subjectMatches
      && input.head !== resolvedClaim.validatedSourceCommit
      && input.validatedSourceAncestorOfHead === true
      && input.committedPathsSinceValidatedSource !== undefined
      && input.committedPathsSinceValidatedSource.length > 0
      && pathsAreAllowed(
        input.committedPathsSinceValidatedSource,
        resolvedClaim.allowedStatePaths,
        isAllowedStatePath
      )
      && currentAhead > 0
      && currentBehind === 0
      && divergenceMatches(recorded, validatedSourceAhead, validatedSourceBehind)
      && latestMatches
      && dirtyPathsAllowed;
  }

  if (resolvedClaim.transitionKind === "state_only_pushed") {
    return subjectMatches
      && input.validatedSourceAncestorOfHead === true
      && input.committedPathsSinceValidatedSource !== undefined
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
  }

  return detachedSyntheticReviewCheckout
    && input.branch === ""
    && input.upstream === ""
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

function subjectMatchesInput(
  resolvedClaim: ResolvedStateSyncClaim,
  input: StateSyncAuditInput
): boolean {
  return resolvedClaim.upstream === input.upstream
    && resolvedBranchMatchesInput(resolvedClaim, input);
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

function fieldIncludes(text: string, field: string, value: string): boolean {
  return text.includes(`| ${field} | \`${value}\` |`);
}

function fieldValueIsPresent(text: string, field: string): boolean {
  return fieldValue(text, field) !== undefined;
}

function fieldValue(text: string, field: string): string | undefined {
  const match = new RegExp(`\\| ${escapeRegExp(field)} \\| \`([^\\\`]+)\` \\|`)
    .exec(text);
  return match?.[1];
}

function fieldLine(text: string, field: string): number {
  const marker = `| ${field} |`;
  const index = text.split(/\r?\n/).findIndex((line) => line.includes(marker));
  return index >= 0 ? index + 1 : 1;
}

function stateCommitMatchesHead(
  value: string | undefined,
  head: string,
  parentHead: string | undefined,
  committedPathsSinceValidatedSource: string[] | undefined,
  validatedSourceAncestorOfHead: boolean | undefined,
  allowedStateCommits: string[] | undefined,
  syntheticReviewState: string | undefined,
  staleAfterCommit: boolean,
  allowedStatePaths: string[] | undefined
): boolean {
  if (value === undefined) {
    return false;
  }

  const hasValidatedSourceEvidence =
    validatedSourceAncestorOfHead !== undefined
    || committedPathsSinceValidatedSource !== undefined;

  return value === head
    || stateCommitIsStateOnlyAncestor(
      value,
      head,
      committedPathsSinceValidatedSource,
      validatedSourceAncestorOfHead,
      allowedStatePaths
    )
    || (
      staleAfterCommit
      && syntheticReviewState !== undefined
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
  validatedSourceAncestorOfHead: boolean | undefined,
  allowedStateCommits: string[] | undefined,
  syntheticReviewState: string | undefined,
  staleAfterCommit: boolean,
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
      validatedSourceAncestorOfHead,
      allowedStateCommits,
      syntheticReviewState,
      staleAfterCommit,
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
  allowedStatePaths: string[] | undefined
): boolean {
  if (detachedSyntheticReviewCheckout) {
    return true;
  }

  const recorded = parseUpstreamDivergenceField(value);
  if (
    recorded === undefined
    || recorded.ahead < 0
    || recorded.behind < 0
    || computedValidatedAhead < 0
    || computedValidatedBehind < 0
  ) {
    return false;
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
  committedPathsSinceValidatedSource: string[] | undefined,
  validatedSourceAncestorOfHead: boolean | undefined,
  currentAhead: number,
  currentBehind: number,
  computedValidatedAhead: number,
  computedValidatedBehind: number,
  allowedStatePaths: string[] | undefined
): boolean {
  return stateOnlySnapshotAllowed
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

function agentBoardCommitsMatchState(
  text: string,
  head: string,
  validatedSourceCommit: string | undefined,
  latestValidatedCommit: string | undefined,
  parentHead: string | undefined,
  committedPathsSinceValidatedSource: string[] | undefined,
  validatedSourceAncestorOfHead: boolean | undefined,
  allowedStateCommits: string[] | undefined,
  syntheticReviewState: string | undefined,
  staleAfterCommit: boolean,
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
      validatedSourceAncestorOfHead,
      allowedStateCommits,
      syntheticReviewState,
      staleAfterCommit,
      allowedStatePaths
    )
  ) {
    allowed.add(latestValidatedCommit);
  }

  return commitLikeTokens(text).every((token) => allowed.has(token));
}

function stateCommitIsStateOnlyAncestor(
  value: string,
  head: string,
  committedPathsSinceValidatedSource: string[] | undefined,
  validatedSourceAncestorOfHead: boolean | undefined,
  allowedStatePaths: string[] | undefined
): boolean {
  if (value === head) {
    return true;
  }

  return validatedSourceAncestorOfHead === true
    && committedPathsSinceValidatedSource !== undefined
    && pathsAreAllowed(
      committedPathsSinceValidatedSource,
      allowedStatePaths,
      isAllowedStatePath
    );
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
  currentHead: string | undefined,
  validatedSourceCommit: string | undefined,
  latestValidatedCommit: string | undefined,
  ahead: number,
  behind: number,
  validatedSourceAhead: number,
  validatedSourceBehind: number,
  staleAfterCommit: boolean
): string | undefined {
  if (!fieldIncludes(input.currentStateText, "Synthetic review checkout", "allowed")) {
    return undefined;
  }

  if (
    currentHead === undefined
    || validatedSourceCommit === undefined
    || latestValidatedCommit === undefined
    || currentHead !== validatedSourceCommit
    || validatedSourceCommit !== latestValidatedCommit
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

  if (!staleAfterCommit || !cleanDetachedUnknownDivergence) {
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
  return path === CURRENT_STATE_DOC
    || path === STATE_SYNC_RECORD_DOC
    || path.startsWith(AGENT_BOARD_DIR);
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
