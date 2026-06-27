const CURRENT_STATE_DOC = "docs/current/CURRENT_STATE.md";
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
}

export interface StateSyncAuditIssue {
  code:
    | "state_document_secret_marker"
    | "state_document_windows_drive_path"
    | "state_document_unc_path"
    | "state_document_posix_machine_path";
  path: string;
  line: number;
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

export function reviewStateSyncAudit(
  input: StateSyncAuditInput
): StateSyncAuditResult {
  const packageJson = parseObject(input.packageJsonText);
  const packageScriptReview = reviewPackageScripts(packageJson);
  const { ahead, behind } = parseAheadBehind(input.aheadBehind);
  const {
    ahead: validatedSourceAhead,
    behind: validatedSourceBehind
  } = parseAheadBehind(input.validatedSourceAheadBehind ?? "unknown\tunknown");
  const currentHead = fieldValue(input.currentStateText, "Current head");
  const validatedSourceCommit = fieldValue(
    input.currentStateText,
    "Validated source commit"
  );
  const latestValidatedCommit = fieldValue(
    input.currentStateText,
    "Latest validated commit"
  );
  const upstreamDivergence = fieldValue(
    input.currentStateText,
    "Upstream divergence"
  );
  const staleAfterCommit = fieldIncludes(
    input.currentStateText,
    "Stale after commit",
    "true"
  );
  const staleMarkerHits = FORBIDDEN_STALE_MARKERS.filter((marker) =>
    input.agentBoardText.includes(marker) || input.currentStateText.includes(marker)
  );
  const sanitization = inspectStateSyncSanitization([
    {
      path: CURRENT_STATE_DOC,
      text: input.currentStateText
    },
    {
      path: ".agent_board/*",
      text: input.agentBoardText
    }
  ]);
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
      || fieldIncludes(input.currentStateText, "Current branch", input.branch),
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
      staleAfterCommit
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
      staleAfterCommit
    ),
    upstreamRecorded:
      input.upstream === "" || fieldIncludes(input.currentStateText, "Upstream", input.upstream),
    validatedSourceDivergenceRecorded:
      detachedSyntheticReviewCheckout
      || upstreamDivergenceMatches(
        upstreamDivergence,
        validatedSourceAhead,
        validatedSourceBehind
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
          staleAfterCommit
        ),
    dirtyWorktreeStateOnly: dirtyStatusEntriesAreAllowedStatePaths(input.gitStatusShort),
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
        staleAfterCommit
      ),
    staleMarkersAbsent: staleMarkerHits.length === 0,
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
      requiredValidationCommandCount: REQUIRED_VALIDATION_COMMANDS.length,
      requiredBoundaryMarkerCount: REQUIRED_BOUNDARY_MARKERS.length,
      staleMarkerHitCount: staleMarkerHits.length,
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

function stateCommitMatchesHead(
  value: string | undefined,
  head: string,
  parentHead: string | undefined,
  committedPathsSinceValidatedSource: string[] | undefined,
  validatedSourceAncestorOfHead: boolean | undefined,
  allowedStateCommits: string[] | undefined,
  syntheticReviewState: string | undefined,
  staleAfterCommit: boolean
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
      validatedSourceAncestorOfHead
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
  staleAfterCommit: boolean
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
      staleAfterCommit
    );
}

function upstreamDivergenceMatches(
  value: string | undefined,
  ahead: number,
  behind: number
): boolean {
  return value === `ahead ${ahead} / behind ${behind}`;
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
  staleAfterCommit: boolean
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
      staleAfterCommit
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
  validatedSourceAncestorOfHead: boolean | undefined
): boolean {
  if (value === head) {
    return true;
  }

  return validatedSourceAncestorOfHead === true
    && committedPathsSinceValidatedSource !== undefined
    && committedPathsSinceValidatedSource.every(isAllowedStatePath);
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
  if (!hasValidatedSourceEvidence) {
    return stateCommitIsAllowed(
      value,
      parentHead,
      allowedStateCommits,
      syntheticReviewState
    );
  }

  return (allowedStateCommits ?? []).includes(value)
    || value === syntheticReviewState;
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

function dirtyStatusEntriesAreAllowedStatePaths(gitStatusShort: string): boolean {
  return statusPaths(gitStatusShort).every(isAllowedStatePath);
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
  return path === CURRENT_STATE_DOC || path.startsWith(AGENT_BOARD_DIR);
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
