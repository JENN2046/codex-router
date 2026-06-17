#!/usr/bin/env node

import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const CURRENT_STATE_DOC = "docs/current/CURRENT_STATE.md";
const AGENT_BOARD_FILES = [
  ".agent_board/RUN_STATE.md",
  ".agent_board/TASK_QUEUE.md",
  ".agent_board/CHECKPOINT.md",
  ".agent_board/HANDOFF.md",
  ".agent_board/VALIDATION_LOG.md"
] as const;

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

export async function collectStateSyncAuditInput(
  cwd = process.cwd()
): Promise<StateSyncAuditInput> {
  const [gitStatusShort, branch, head, upstream, aheadBehind] =
    await Promise.all([
      git(["status", "--short"], cwd),
      git(["branch", "--show-current"], cwd),
      git(["rev-parse", "--short", "HEAD"], cwd),
      git(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"], cwd)
        .catch(() => ""),
      git(["rev-list", "--left-right", "--count", "HEAD...@{upstream}"], cwd)
        .catch(() => "0\t0")
    ]);

  return {
    gitStatusShort,
    branch: branch.trim(),
    head: head.trim(),
    upstream: upstream.trim(),
    aheadBehind: aheadBehind.trim(),
    packageJsonText: await read(cwd, "package.json"),
    currentStateText: await read(cwd, CURRENT_STATE_DOC),
    agentBoardText: await readAgentBoard(cwd)
  };
}

export function reviewStateSyncAudit(
  input: StateSyncAuditInput
): StateSyncAuditResult {
  const packageJson = parseObject(input.packageJsonText);
  const packageScriptReview = reviewPackageScripts(packageJson);
  const { ahead, behind } = parseAheadBehind(input.aheadBehind);
  const staleMarkerHits = FORBIDDEN_STALE_MARKERS.filter((marker) =>
    input.agentBoardText.includes(marker) || input.currentStateText.includes(marker)
  );
  const combinedStateText = `${input.currentStateText}\n${input.agentBoardText}`;

  const checks = {
    packageScriptPresent: packageScriptReview.mismatchCount === 0,
    currentStateRecorded: input.currentStateText.includes("CURRENT_STATE_RECORDED"),
    currentBranchMatches: fieldIncludes(input.currentStateText, "Current branch", input.branch),
    currentHeadRecorded: fieldValueIsPresent(input.currentStateText, "Current head"),
    upstreamRecorded:
      input.upstream === "" || fieldIncludes(input.currentStateText, "Upstream", input.upstream),
    divergenceRecorded: fieldValueIsPresent(input.currentStateText, "Upstream divergence"),
    latestValidatedCommitRecorded:
      fieldValueIsPresent(input.currentStateText, "Latest validated commit"),
    staleAfterCommitRecorded:
      fieldIncludes(input.currentStateText, "Stale after commit", "true"),
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
      && input.agentBoardText.includes(CURRENT_STATE_DOC),
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

async function readAgentBoard(cwd: string): Promise<string> {
  const texts = await Promise.all(
    AGENT_BOARD_FILES.map((filePath) =>
      read(cwd, filePath).catch(() => "")
    )
  );

  return texts.join("\n");
}

async function git(args: string[], cwd: string): Promise<string> {
  const { stdout } = await execFileAsync("git", args, {
    cwd,
    encoding: "utf8",
    windowsHide: true
  });

  return stdout;
}

async function read(cwd: string, filePath: string): Promise<string> {
  return readFile(join(cwd, filePath), "utf8");
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
  return new RegExp(`\\| ${escapeRegExp(field)} \\| \`[^\\\`]+\` \\|`).test(text);
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
    return 0;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
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

async function main(): Promise<void> {
  const input = await collectStateSyncAuditInput();
  const review = reviewStateSyncAudit(input);
  const format = process.argv.includes("--json") ? "json" : "text";

  console.log(formatStateSyncAuditResult(review, format));

  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      "State sync audit failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
