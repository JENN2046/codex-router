const CURRENT_STATE_DOC = "docs/current/CURRENT_STATE.md";

const REQUIRED_PACKAGE_SCRIPTS = {
  "audit:state-sync": "tsx scripts/run-state-sync-audit.ts"
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
  upstream: string;
  aheadBehind: string;
  packageJsonText: string;
  currentStateText: string;
  agentBoardText: string;
}

export interface StateSyncAuditResult {
  status: "passed" | "blocked";
  checks: {
    packageScriptPresent: boolean;
    currentStateRecorded: boolean;
    currentBranchMatches: boolean;
    currentHeadRecorded: boolean;
    upstreamRecorded: boolean;
    divergenceRecorded: boolean;
    latestValidatedCommitRecorded: boolean;
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
}

export type StateSyncAuditOutputFormat = "text" | "json";

export function reviewStateSyncAudit(
  input: StateSyncAuditInput
): StateSyncAuditResult {
  const packageJson = parseObject(input.packageJsonText);
  const packageScriptReview = reviewPackageScripts(packageJson);
  const { ahead, behind } = parseAheadBehind(input.aheadBehind);
  const currentHead = fieldValue(input.currentStateText, "Current head");
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
  const combinedStateText = `${input.currentStateText}\n${input.agentBoardText}`;
  const syntheticReviewState = syntheticReviewStateAllowed(
    input,
    currentHead,
    latestValidatedCommit,
    ahead,
    behind,
    staleAfterCommit
  );

  const checks = {
    packageScriptPresent: packageScriptReview.mismatchCount === 0,
    currentStateRecorded: input.currentStateText.includes("CURRENT_STATE_RECORDED"),
    currentBranchMatches: fieldIncludes(input.currentStateText, "Current branch", input.branch),
    currentHeadRecorded: stateCommitMatchesHead(
      currentHead,
      input.head,
      input.parentHead,
      input.allowedStateCommits,
      syntheticReviewState,
      staleAfterCommit
    ),
    upstreamRecorded:
      input.upstream === "" || fieldIncludes(input.currentStateText, "Upstream", input.upstream),
    divergenceRecorded: upstreamDivergenceMatches(upstreamDivergence, ahead, behind),
    latestValidatedCommitRecorded:
      stateCommitMatchesHead(
        latestValidatedCommit,
        input.head,
        input.parentHead,
        input.allowedStateCommits,
        syntheticReviewState,
        staleAfterCommit
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
        input.parentHead,
        input.allowedStateCommits,
        syntheticReviewState,
        staleAfterCommit
      ),
    staleMarkersAbsent: staleMarkerHits.length === 0,
    outputSanitized: outputIsSanitized(combinedStateText),
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
      gitStatusEntryCount: countStatusEntries(input.gitStatusShort),
      packageScriptTargetCount: packageScriptReview.targetCount,
      packageScriptMismatchCount: packageScriptReview.mismatchCount,
      requiredValidationCommandCount: REQUIRED_VALIDATION_COMMANDS.length,
      requiredBoundaryMarkerCount: REQUIRED_BOUNDARY_MARKERS.length,
      staleMarkerHitCount: staleMarkerHits.length,
      stateWritesDuringAudit: 0,
      remoteWritesDuringAudit: 0
    },
    reasons
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
    `git status entries: ${review.summary.gitStatusEntryCount}`,
    `package script targets: ${review.summary.packageScriptTargetCount}`,
    `package script mismatches: ${review.summary.packageScriptMismatchCount}`,
    `validation commands: ${review.summary.requiredValidationCommandCount}`,
    `boundary markers: ${review.summary.requiredBoundaryMarkerCount}`,
    `stale marker hits: ${review.summary.staleMarkerHitCount}`,
    `state writes during audit: ${review.summary.stateWritesDuringAudit}`,
    `remote writes during audit: ${review.summary.remoteWritesDuringAudit}`,
    ...(review.reasons.length > 0 ? [`reasons: ${review.reasons.join(",")}`] : [])
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
  allowedStateCommits: string[] | undefined,
  syntheticReviewState: string | undefined,
  staleAfterCommit: boolean
): boolean {
  if (value === undefined) {
    return false;
  }

  return value === head
    || (staleAfterCommit && stateCommitIsAllowed(
      value,
      parentHead,
      allowedStateCommits,
      syntheticReviewState
    ));
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
  parentHead: string | undefined,
  allowedStateCommits: string[] | undefined,
  syntheticReviewState: string | undefined,
  staleAfterCommit: boolean
): boolean {
  const allowed = new Set([head]);
  if (staleAfterCommit) {
    for (const commit of stateCompatibleCommits(
      parentHead,
      allowedStateCommits,
      syntheticReviewState
    )) {
      allowed.add(commit);
    }
  }

  return commitLikeTokens(text).every((token) => allowed.has(token));
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

  return Array.from(new Set([
    ...fallbackCommits
  ]));
}

function syntheticReviewStateAllowed(
  input: StateSyncAuditInput,
  currentHead: string | undefined,
  latestValidatedCommit: string | undefined,
  ahead: number,
  behind: number,
  staleAfterCommit: boolean
): string | undefined {
  if (!fieldIncludes(input.currentStateText, "Synthetic review checkout", "allowed")) {
    return undefined;
  }

  if (
    currentHead === undefined
    || latestValidatedCommit === undefined
    || currentHead !== latestValidatedCommit
  ) {
    return undefined;
  }

  if (!staleAfterCommit || ahead !== 0 || behind !== 0) {
    return undefined;
  }

  if ((input.allowedStateCommits?.length ?? 0) > 0) {
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function outputIsSanitized(text: string): boolean {
  return [
    "OPENAI_API_KEY",
    "CODEX_API_KEY",
    "CODEX_ACCESS_TOKEN",
    "sk-",
    "Bearer ",
    "raw token",
    "raw env"
  ].every((marker) => !text.includes(marker));
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
