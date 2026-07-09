#!/usr/bin/env node

import { execFile } from "node:child_process";
import { lstat, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const BOUNDARY_DOC = "docs/governance/SOURCE_RELEASE_PACKAGE_BOUNDARY.md";
const GOVERNANCE_RUNNER = "scripts/run-governance-check.ts";
const ROOT_AGENT_INSTRUCTION = "AGENTS.md";

const REQUIRED_PACKAGE_SCRIPTS = {
  governance: "node --import tsx scripts/run-governance-check.ts"
} as const;

const SOURCE_REVIEW_ROOT_FILES = [
  ".gitignore",
  "AGENTS.md",
  "PROJECT_CONTINUE_ANCHOR.md",
  "README.md",
  "README.AGENTS_OS.md",
  "package.json",
  "package-lock.json",
  "routing-policy.yaml",
  "tsconfig.json"
] as const;

const SOURCE_REVIEW_PREFIXES = [
  ".github/",
  "docs/",
  "packages/",
  "scripts/",
  "tests/"
] as const;

const REQUIRED_SOURCE_REVIEW_ROOTS = [
  "docs/",
  "packages/",
  "scripts/",
  "tests/",
  "package.json",
  "package-lock.json",
  "routing-policy.yaml",
  "tsconfig.json"
] as const;

const RELEASE_EVIDENCE_PREFIXES = [
  "docs/evidence/",
  "dist/",
  "coverage/",
  "test-output/",
  "test-results/",
  "reports/",
  "logs/"
] as const;

const REQUIRED_BOUNDARY_DOC_MARKERS = [
  "SOURCE_RELEASE_PACKAGE_BOUNDARY_RECORDED",
  "source-review.zip",
  "release-evidence.zip",
  "npm run governance -- audit execution-boundary-current-surface",
  "npm run governance -- audit source-release-package-boundary",
  "strategy router, execution profiles, policy config, capability taxonomy, capability taxonomy escalation policy, routing engine, recovery control orchestration, runtime control, operator action executor gate, Codex CLI\nhost, public API facade, Agent OS local runtime, Agent OS MCP server manifest, Protocol MCP provider skeleton, Protocol A2A remote provider skeleton, Agent OS SDK, Agent OS CLI, Agent OS app-server wrapper, Agent OS public surfaces, Codex provider, preflight, approval\npermit, approval gate, approval consumption dispatch matrix, approval consumption dispatch, admission control, delegation policy, execution eligibility, execution observation, governance failure reducer, task graph, scheduler, execution planner,\nprovider registry, controlled provider execution taskbook, controlled provider execution taskbook review, provider execution runner, provider-core primitives, tool\ninvocation planner, desktop decision runner, final host locator,\nhost-dispatcher provider, Codex\ndesktop bridge, Codex desktop live host, Codex memory MCP client, Codex memory\nhost client, desktop host client, desktop live adapter dispatch, host-client\nexample, target host embedding, host executor, host executor taskbook,\nhost-client executor review, host executor receipt, agent-backed recovery\nexecutor, agent executor adapter taskbook, agent executor adapter review, agent\nexecutor adapter sandbox, task-control taskbook, task-control review, sub-agent\nruntime, and task-control sandbox boundaries",
  "narrow_readonly_provider_dispatch_without_boundary_inheritance",
  "read-only provider dispatch does not inherit into host executor authorization",
  "read-only provider dispatch does not inherit into sub-agent runtime authorization",
  "read-only provider dispatch does not inherit into workspace-write authorization",
  "read-only provider dispatch does not inherit into release authorization",
  "Codex CLI host does not authorize host executor or sub-agent runtime",
  "sub-agent runtime does not invoke Codex CLI or provider execution",
  "host executor does not execute provider or sub-agent runtime",
  "source-review root AGENTS must be present",
  "source-review root AGENTS boundary must be recorded",
  "Zone.Identifier environment artifacts absent",
  "archive pack-plan manifest",
  ".git/",
  ".agent_board/",
  "node_modules/",
  "dist/",
  "coverage/",
  "docs/evidence/",
  ".test-*",
  "tmp-*"
] as const;

const REQUIRED_ROOT_AGENT_INSTRUCTION_MARKERS = [
  "does not mean bypassing execution boundaries",
  "Codex CLI host does not authorize host executor or sub-agent runtime",
  "sub-agent runtime does not invoke Codex CLI or provider execution",
  "host executor does not execute provider or sub-agent runtime",
  "read-only provider dispatch does not inherit into host executor authorization"
] as const;

const FORBIDDEN_OUTPUT_MARKERS = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "sk-live-",
  "Bearer",
  "raw env",
  "raw token",
  "raw command",
  "raw stdout",
  "raw stderr",
  "requestedAction",
  "prompt"
] as const;

interface ArchivePackPlan {
  archiveName: "source-review.zip" | "release-evidence.zip";
  includeRootFiles: readonly string[];
  includePrefixes: readonly string[];
  excludesPath: (filePath: string) => boolean;
}

export interface SourceReleasePackageBoundaryAuditInput {
  gitStatusShort: string;
  branch: string;
  aheadBehind: string;
  sourceReviewManifestFiles: string[];
  releaseEvidenceManifestFiles: string[];
  packageJsonText: string;
  boundaryDocText: string;
  governanceRunnerText: string;
  rootAgentInstructionText: string;
}

export interface SourceReleasePackageBoundaryAuditResult {
  status: "passed" | "blocked";
  checks: {
    worktreeClean: boolean;
    branchMain: boolean;
    notBehindOrigin: boolean;
    packageScriptPresent: boolean;
    boundaryDocRecorded: boolean;
    sourceReviewHasFiles: boolean;
    sourceReviewRootAgentInstructionPresent: boolean;
    sourceReviewRootAgentInstructionBoundaryRecorded: boolean;
    sourceReviewRequiredRootsPresent: boolean;
    sourceReviewForbiddenPathsExcluded: boolean;
    releaseEvidenceHasFiles: boolean;
    releaseEvidenceSourceRootsExcluded: boolean;
    releaseEvidenceForbiddenPathsExcluded: boolean;
    profilesDisjoint: boolean;
    environmentArtifactsAbsent: boolean;
    auditReadOnly: boolean;
    outputSanitized: boolean;
  };
  summary: {
    branch: string;
    ahead: number;
    behind: number;
    sourceReviewFileCount: number;
    releaseEvidenceFileCount: number;
    sourceReviewRootAgentInstructionPresent: boolean;
    sourceReviewRootAgentInstructionBoundaryRecorded: boolean;
    sourceReviewRequiredRootCount: number;
    sourceReviewForbiddenMatchCount: number;
    releaseEvidenceSourceRootLeakCount: number;
    releaseEvidenceForbiddenMatchCount: number;
    profileOverlapCount: number;
    packageScriptTargetCount: number;
    packageScriptMismatchCount: number;
    dirtyWorktreeEntryCount: number;
    dirtyTrackedEntryCount: number;
    dirtyUntrackedEntryCount: number;
    dirtyDeletedEntryCount: number;
    dirtyBoundarySourceEntryCount: number;
    dirtyBoundarySourceRegisteredEntryCount: number;
    dirtyBoundarySourceUnregisteredEntryCount: number;
    dirtyBoundaryAuditScriptEntryCount: number;
    dirtyBoundaryAuditTestEntryCount: number;
    dirtyBoundaryAuditPairedAuditCount: number;
    dirtyBoundaryAuditUnpairedAuditCount: number;
    dirtyGovernanceDocEntryCount: number;
    dirtyGovernanceBoundaryDocEntryCount: number;
    dirtyCurrentStateDocEntryCount: number;
    dirtyValidationTierDocEntryCount: number;
    dirtyRoadmapDocEntryCount: number;
    dirtyCiWorkflowEntryCount: number;
    dirtyRootAgentInstructionEntryCount: number;
    dirtyRootAgentInstructionDeletedEntryCount: number;
    dirtyEnvironmentArtifactEntryCount: number;
    archivePackPlanCount: 2;
    archiveWritesDuringAudit: 0;
  };
  reasons: string[];
}

export type SourceReleasePackageBoundaryAuditOutputFormat = "text" | "json";

const SOURCE_REVIEW_PACK_PLAN: ArchivePackPlan = {
  archiveName: "source-review.zip",
  includeRootFiles: SOURCE_REVIEW_ROOT_FILES,
  includePrefixes: SOURCE_REVIEW_PREFIXES,
  excludesPath: matchesSourceReviewForbiddenPath
};

const RELEASE_EVIDENCE_PACK_PLAN: ArchivePackPlan = {
  archiveName: "release-evidence.zip",
  includeRootFiles: [],
  includePrefixes: RELEASE_EVIDENCE_PREFIXES,
  excludesPath: matchesReleaseEvidenceForbiddenPath
};

export async function collectSourceReleasePackageBoundaryAuditInput(
  cwd = process.cwd()
): Promise<SourceReleasePackageBoundaryAuditInput> {
  const [
    gitStatusShort,
    branch,
    aheadBehind,
    sourceReviewManifestFiles,
    releaseEvidenceManifestFiles
  ] = await Promise.all([
    git(["status", "--short"], cwd),
    git(["branch", "--show-current"], cwd),
    git(["rev-list", "--left-right", "--count", "HEAD...origin/main"], cwd)
      .catch(() => "unknown\tunknown"),
    collectArchiveManifest(cwd, SOURCE_REVIEW_PACK_PLAN),
    collectArchiveManifest(cwd, RELEASE_EVIDENCE_PACK_PLAN)
  ]);

  return {
    gitStatusShort,
    branch: branch.trim(),
    aheadBehind: aheadBehind.trim(),
    sourceReviewManifestFiles,
    releaseEvidenceManifestFiles,
    packageJsonText: await read(cwd, "package.json"),
    boundaryDocText: await read(cwd, BOUNDARY_DOC),
    governanceRunnerText: await read(cwd, GOVERNANCE_RUNNER),
    rootAgentInstructionText: await readOptional(cwd, ROOT_AGENT_INSTRUCTION)
  };
}

export function reviewSourceReleasePackageBoundaryAudit(
  input: SourceReleasePackageBoundaryAuditInput
): SourceReleasePackageBoundaryAuditResult {
  const packageJson = parseObject(input.packageJsonText);
  const packageScriptReview = reviewPackageScripts(packageJson);
  const { ahead, behind } = parseAheadBehind(input.aheadBehind);
  const sourceReviewManifestFiles =
    normalizeManifest(input.sourceReviewManifestFiles);
  const releaseEvidenceManifestFiles =
    normalizeManifest(input.releaseEvidenceManifestFiles);
  const sourceReviewRequiredRootCount = countPresentRoots(
    sourceReviewManifestFiles,
    REQUIRED_SOURCE_REVIEW_ROOTS
  );
  const sourceReviewForbiddenMatches =
    sourceReviewManifestFiles.filter(matchesSourceReviewForbiddenPath);
  const releaseEvidenceSourceRootLeaks =
    releaseEvidenceManifestFiles.filter(isReleaseEvidenceSourceRootLeak);
  const releaseEvidenceForbiddenMatches =
    releaseEvidenceManifestFiles.filter(matchesReleaseEvidenceForbiddenPath);
  const overlaps = findOverlaps(
    sourceReviewManifestFiles,
    releaseEvidenceManifestFiles
  );
  const worktreeSummary = summarizeWorktreeStatus(
    input.gitStatusShort,
    input.governanceRunnerText
  );
  const checks = {
    worktreeClean: input.gitStatusShort.trim() === "",
    branchMain: input.branch === "main",
    notBehindOrigin: behind === 0,
    packageScriptPresent: packageScriptReview.mismatchCount === 0,
    boundaryDocRecorded: boundaryDocRecorded(input.boundaryDocText),
    sourceReviewHasFiles: sourceReviewManifestFiles.length > 0,
    sourceReviewRootAgentInstructionPresent:
      sourceReviewManifestFiles.includes("AGENTS.md"),
    sourceReviewRootAgentInstructionBoundaryRecorded:
      rootAgentInstructionBoundaryRecorded(input.rootAgentInstructionText),
    sourceReviewRequiredRootsPresent:
      sourceReviewRequiredRootCount === REQUIRED_SOURCE_REVIEW_ROOTS.length,
    sourceReviewForbiddenPathsExcluded: sourceReviewForbiddenMatches.length === 0,
    releaseEvidenceHasFiles: releaseEvidenceManifestFiles.length > 0,
    releaseEvidenceSourceRootsExcluded:
      releaseEvidenceSourceRootLeaks.length === 0,
    releaseEvidenceForbiddenPathsExcluded:
      releaseEvidenceForbiddenMatches.length === 0,
    profilesDisjoint: overlaps.length === 0,
    environmentArtifactsAbsent:
      worktreeSummary.environmentArtifactEntryCount === 0,
    auditReadOnly: true,
    outputSanitized: !containsForbiddenOutputMarkers(input.boundaryDocText)
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      branch: input.branch,
      ahead,
      behind,
      sourceReviewFileCount: sourceReviewManifestFiles.length,
      releaseEvidenceFileCount: releaseEvidenceManifestFiles.length,
      sourceReviewRootAgentInstructionPresent:
        sourceReviewManifestFiles.includes("AGENTS.md"),
      sourceReviewRootAgentInstructionBoundaryRecorded:
        rootAgentInstructionBoundaryRecorded(input.rootAgentInstructionText),
      sourceReviewRequiredRootCount,
      sourceReviewForbiddenMatchCount: sourceReviewForbiddenMatches.length,
      releaseEvidenceSourceRootLeakCount: releaseEvidenceSourceRootLeaks.length,
      releaseEvidenceForbiddenMatchCount: releaseEvidenceForbiddenMatches.length,
      profileOverlapCount: overlaps.length,
      packageScriptTargetCount: packageScriptReview.targetCount,
      packageScriptMismatchCount: packageScriptReview.mismatchCount,
      dirtyWorktreeEntryCount: worktreeSummary.entryCount,
      dirtyTrackedEntryCount: worktreeSummary.trackedEntryCount,
      dirtyUntrackedEntryCount: worktreeSummary.untrackedEntryCount,
      dirtyDeletedEntryCount: worktreeSummary.deletedEntryCount,
      dirtyBoundarySourceEntryCount: worktreeSummary.boundarySourceEntryCount,
      dirtyBoundarySourceRegisteredEntryCount:
        worktreeSummary.boundarySourceRegisteredEntryCount,
      dirtyBoundarySourceUnregisteredEntryCount:
        worktreeSummary.boundarySourceUnregisteredEntryCount,
      dirtyBoundaryAuditScriptEntryCount:
        worktreeSummary.boundaryAuditScriptEntryCount,
      dirtyBoundaryAuditTestEntryCount:
        worktreeSummary.boundaryAuditTestEntryCount,
      dirtyBoundaryAuditPairedAuditCount:
        worktreeSummary.boundaryAuditPairedAuditCount,
      dirtyBoundaryAuditUnpairedAuditCount:
        worktreeSummary.boundaryAuditUnpairedAuditCount,
      dirtyGovernanceDocEntryCount: worktreeSummary.governanceDocEntryCount,
      dirtyGovernanceBoundaryDocEntryCount:
        worktreeSummary.governanceBoundaryDocEntryCount,
      dirtyCurrentStateDocEntryCount: worktreeSummary.currentStateDocEntryCount,
      dirtyValidationTierDocEntryCount:
        worktreeSummary.validationTierDocEntryCount,
      dirtyRoadmapDocEntryCount: worktreeSummary.roadmapDocEntryCount,
      dirtyCiWorkflowEntryCount: worktreeSummary.ciWorkflowEntryCount,
      dirtyRootAgentInstructionEntryCount:
        worktreeSummary.rootAgentInstructionEntryCount,
      dirtyRootAgentInstructionDeletedEntryCount:
        worktreeSummary.rootAgentInstructionDeletedEntryCount,
      dirtyEnvironmentArtifactEntryCount:
        worktreeSummary.environmentArtifactEntryCount,
      archivePackPlanCount: 2,
      archiveWritesDuringAudit: 0
    },
    reasons
  };
}

export function formatSourceReleasePackageBoundaryAuditResult(
  review: SourceReleasePackageBoundaryAuditResult,
  format: SourceReleasePackageBoundaryAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Source/release package boundary audit",
    `status: ${review.status}`,
    `branch: ${review.summary.branch}`,
    `ahead: ${review.summary.ahead}`,
    `behind: ${review.summary.behind}`,
    `archive pack-plans: ${review.summary.archivePackPlanCount}`,
    `source-review manifest files: ${review.summary.sourceReviewFileCount}`,
    `release-evidence manifest files: ${review.summary.releaseEvidenceFileCount}`,
    `source-review root AGENTS present: ${review.summary.sourceReviewRootAgentInstructionPresent}`,
    `source-review root AGENTS boundary recorded: ${review.summary.sourceReviewRootAgentInstructionBoundaryRecorded}`,
    `required source roots: ${review.summary.sourceReviewRequiredRootCount}/${REQUIRED_SOURCE_REVIEW_ROOTS.length}`,
    `source forbidden matches: ${review.summary.sourceReviewForbiddenMatchCount}`,
    `release source-root leaks: ${review.summary.releaseEvidenceSourceRootLeakCount}`,
    `release forbidden matches: ${review.summary.releaseEvidenceForbiddenMatchCount}`,
    `profile overlaps: ${review.summary.profileOverlapCount}`,
    `package script targets: ${review.summary.packageScriptTargetCount}`,
    `package script mismatches: ${review.summary.packageScriptMismatchCount}`,
    `dirty worktree entries: ${review.summary.dirtyWorktreeEntryCount}`,
    `dirty tracked entries: ${review.summary.dirtyTrackedEntryCount}`,
    `dirty untracked entries: ${review.summary.dirtyUntrackedEntryCount}`,
    `dirty deleted entries: ${review.summary.dirtyDeletedEntryCount}`,
    `dirty boundary source entries: ${review.summary.dirtyBoundarySourceEntryCount}`,
    `dirty boundary source registered entries: ${review.summary.dirtyBoundarySourceRegisteredEntryCount}`,
    `dirty boundary source unregistered entries: ${review.summary.dirtyBoundarySourceUnregisteredEntryCount}`,
    `dirty boundary audit script entries: ${review.summary.dirtyBoundaryAuditScriptEntryCount}`,
    `dirty boundary audit test entries: ${review.summary.dirtyBoundaryAuditTestEntryCount}`,
    `dirty boundary audit paired audits: ${review.summary.dirtyBoundaryAuditPairedAuditCount}`,
    `dirty boundary audit unpaired audits: ${review.summary.dirtyBoundaryAuditUnpairedAuditCount}`,
    `dirty governance doc entries: ${review.summary.dirtyGovernanceDocEntryCount}`,
    `dirty governance boundary doc entries: ${review.summary.dirtyGovernanceBoundaryDocEntryCount}`,
    `dirty current state doc entries: ${review.summary.dirtyCurrentStateDocEntryCount}`,
    `dirty validation tier doc entries: ${review.summary.dirtyValidationTierDocEntryCount}`,
    `dirty roadmap doc entries: ${review.summary.dirtyRoadmapDocEntryCount}`,
    `dirty CI workflow entries: ${review.summary.dirtyCiWorkflowEntryCount}`,
    `dirty root AGENTS entries: ${review.summary.dirtyRootAgentInstructionEntryCount}`,
    `dirty root AGENTS deleted entries: ${review.summary.dirtyRootAgentInstructionDeletedEntryCount}`,
    `dirty environment artifact entries: ${review.summary.dirtyEnvironmentArtifactEntryCount}`,
    `archive writes during audit: ${review.summary.archiveWritesDuringAudit}`,
    ...(review.reasons.length > 0 ? [`reasons: ${review.reasons.join(",")}`] : [])
  ].join("\n");
}

async function collectArchiveManifest(
  cwd: string,
  plan: ArchivePackPlan
): Promise<string[]> {
  const fileSet = new Set<string>();

  for (const rootFile of plan.includeRootFiles) {
    const normalizedRootFile = normalizePath(rootFile);
    if (plan.excludesPath(normalizedRootFile)) {
      continue;
    }

    if (await isFile(cwd, normalizedRootFile)) {
      fileSet.add(normalizedRootFile);
    }
  }

  for (const prefix of plan.includePrefixes) {
    const normalizedPrefix = normalizeDirectoryPath(prefix);
    await collectFilesUnderPrefix(cwd, normalizedPrefix, plan, fileSet);
  }

  return Array.from(fileSet).sort();
}

async function collectFilesUnderPrefix(
  cwd: string,
  prefix: string,
  plan: ArchivePackPlan,
  fileSet: Set<string>
): Promise<void> {
  if (plan.excludesPath(prefix)) {
    return;
  }

  let entries;
  try {
    entries = await readdir(join(cwd, prefix), { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const childPath = normalizePath(`${prefix}${entry.name}`);
    const childDirectoryPath = `${childPath}/`;

    if (entry.isDirectory()) {
      if (!plan.excludesPath(childDirectoryPath)) {
        await collectFilesUnderPrefix(cwd, childDirectoryPath, plan, fileSet);
      }
      continue;
    }

    if (entry.isFile() && !plan.excludesPath(childPath)) {
      fileSet.add(childPath);
    }
  }
}

async function isFile(cwd: string, filePath: string): Promise<boolean> {
  try {
    return (await lstat(join(cwd, filePath))).isFile();
  } catch {
    return false;
  }
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

async function readOptional(cwd: string, filePath: string): Promise<string> {
  try {
    return await read(cwd, filePath);
  } catch {
    return "";
  }
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

function boundaryDocRecorded(text: string): boolean {
  const normalizedText = normalizeDocTextForMarkerSearch(text);

  return REQUIRED_BOUNDARY_DOC_MARKERS.every((marker) =>
    normalizedText.includes(normalizeDocTextForMarkerSearch(marker))
  );
}

function rootAgentInstructionBoundaryRecorded(text: string): boolean {
  const normalizedText = normalizeDocTextForMarkerSearch(text);

  return REQUIRED_ROOT_AGENT_INSTRUCTION_MARKERS.every((marker) =>
    normalizedText.includes(normalizeDocTextForMarkerSearch(marker))
  );
}

function normalizeDocTextForMarkerSearch(text: string): string {
  return text.replace(/\s+/g, " ");
}

function normalizeManifest(filePaths: string[]): string[] {
  return [...new Set(filePaths.map(normalizePath).filter(Boolean))].sort();
}

function matchesSourceReviewForbiddenPath(filePath: string): boolean {
  return matchesSharedForbiddenPath(filePath)
    || filePath === "dist"
    || filePath.startsWith("dist/")
    || filePath === "coverage"
    || filePath.startsWith("coverage/")
    || filePath === "docs/evidence"
    || filePath.startsWith("docs/evidence/");
}

function matchesReleaseEvidenceForbiddenPath(filePath: string): boolean {
  return matchesSharedForbiddenPath(filePath);
}

function matchesSharedForbiddenPath(filePath: string): boolean {
  return filePath === ".git"
    || filePath.startsWith(".git/")
    || filePath === ".agent_board"
    || filePath.startsWith(".agent_board/")
    || filePath === "node_modules"
    || filePath.startsWith("node_modules/")
    || filePath === ".codex-home"
    || filePath.startsWith(".codex-home/")
    || filePath === ".omc"
    || filePath.startsWith(".omc/")
    || filePath === ".env"
    || filePath.startsWith(".env.")
    || filePath.endsWith("/.env")
    || filePath.includes("/.env.")
    || filePath === "config.env"
    || filePath.endsWith("/config.env")
    || rootNameStartsWith(filePath, ".test-")
    || rootNameStartsWith(filePath, "tmp-");
}

function isReleaseEvidenceSourceRootLeak(filePath: string): boolean {
  return filePath.startsWith(".github/")
    || filePath.startsWith("packages/")
    || filePath.startsWith("scripts/")
    || filePath.startsWith("tests/")
    || (filePath.startsWith("docs/") && !filePath.startsWith("docs/evidence/"))
    || SOURCE_REVIEW_ROOT_FILES.includes(
      filePath as (typeof SOURCE_REVIEW_ROOT_FILES)[number]
    );
}

function countPresentRoots(
  files: string[],
  requiredRoots: readonly string[]
): number {
  return requiredRoots.filter((root) =>
    root.endsWith("/")
      ? files.some((filePath) => filePath.startsWith(root))
      : files.includes(root)
  ).length;
}

function findOverlaps(left: string[], right: string[]): string[] {
  const rightSet = new Set(right);
  return left.filter((filePath) => rightSet.has(filePath));
}

interface WorktreeStatusEntry {
  code: string;
  path: string;
}

interface WorktreeStatusSummary {
  entryCount: number;
  trackedEntryCount: number;
  untrackedEntryCount: number;
  deletedEntryCount: number;
  boundarySourceEntryCount: number;
  boundarySourceRegisteredEntryCount: number;
  boundarySourceUnregisteredEntryCount: number;
  boundaryAuditScriptEntryCount: number;
  boundaryAuditTestEntryCount: number;
  boundaryAuditPairedAuditCount: number;
  boundaryAuditUnpairedAuditCount: number;
  governanceDocEntryCount: number;
  governanceBoundaryDocEntryCount: number;
  currentStateDocEntryCount: number;
  validationTierDocEntryCount: number;
  roadmapDocEntryCount: number;
  ciWorkflowEntryCount: number;
  rootAgentInstructionEntryCount: number;
  rootAgentInstructionDeletedEntryCount: number;
  environmentArtifactEntryCount: number;
}

function summarizeWorktreeStatus(
  gitStatusShort: string,
  governanceRunnerText: string
): WorktreeStatusSummary {
  const entries = parseWorktreeStatusEntries(gitStatusShort);
  const boundarySourceEntries = entries.filter((entry) =>
    isBoundarySourcePath(entry.path)
  );
  const registeredBoundarySourceEntries = boundarySourceEntries.filter((entry) =>
    boundarySourcePathRegistered(entry.path, governanceRunnerText)
  );
  const boundaryScriptAuditNames = new Set(
    boundarySourceEntries
      .map((entry) => boundaryScriptAuditName(entry.path))
      .filter((auditName): auditName is string => auditName !== undefined)
  );
  const boundaryTestAuditNames = new Set(
    boundarySourceEntries
      .map((entry) => boundaryTestAuditName(entry.path))
      .filter((auditName): auditName is string => auditName !== undefined)
  );
  const boundaryAuditNames = new Set([
    ...boundaryScriptAuditNames,
    ...boundaryTestAuditNames
  ]);
  const pairedBoundaryAuditNames = [...boundaryAuditNames].filter((auditName) =>
    boundaryScriptAuditNames.has(auditName) && boundaryTestAuditNames.has(auditName)
  );

  return {
    entryCount: entries.length,
    trackedEntryCount: entries.filter((entry) => entry.code !== "??").length,
    untrackedEntryCount: entries.filter((entry) => entry.code === "??").length,
    deletedEntryCount: entries.filter((entry) => entry.code.includes("D")).length,
    boundarySourceEntryCount: boundarySourceEntries.length,
    boundarySourceRegisteredEntryCount: registeredBoundarySourceEntries.length,
    boundarySourceUnregisteredEntryCount:
      boundarySourceEntries.length - registeredBoundarySourceEntries.length,
    boundaryAuditScriptEntryCount: boundaryScriptAuditNames.size,
    boundaryAuditTestEntryCount: boundaryTestAuditNames.size,
    boundaryAuditPairedAuditCount: pairedBoundaryAuditNames.length,
    boundaryAuditUnpairedAuditCount:
      boundaryAuditNames.size - pairedBoundaryAuditNames.length,
    governanceDocEntryCount: entries.filter((entry) =>
      isGovernanceDocPath(entry.path)
    ).length,
    governanceBoundaryDocEntryCount: entries.filter((entry) =>
      isGovernanceBoundaryDocPath(entry.path)
    ).length,
    currentStateDocEntryCount: entries.filter((entry) =>
      isCurrentStateDocPath(entry.path)
    ).length,
    validationTierDocEntryCount: entries.filter((entry) =>
      isValidationTierDocPath(entry.path)
    ).length,
    roadmapDocEntryCount: entries.filter((entry) =>
      isRoadmapDocPath(entry.path)
    ).length,
    ciWorkflowEntryCount: entries.filter((entry) =>
      entry.path.startsWith(".github/workflows/")
    ).length,
    rootAgentInstructionEntryCount: entries.filter((entry) =>
      isRootAgentInstructionPath(entry.path)
    ).length,
    rootAgentInstructionDeletedEntryCount: entries.filter((entry) =>
      isRootAgentInstructionPath(entry.path) && entry.code.includes("D")
    ).length,
    environmentArtifactEntryCount: entries.filter((entry) =>
      isEnvironmentArtifactPath(entry.path)
    ).length
  };
}

function parseWorktreeStatusEntries(gitStatusShort: string): WorktreeStatusEntry[] {
  return gitStatusShort
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map((line) => ({
      code: line.slice(0, 2),
      path: normalizeStatusPath(line.slice(3).trim())
    }))
    .filter((entry) => entry.path !== "");
}

function normalizeStatusPath(filePath: string): string {
  const unquoted =
    filePath.startsWith("\"") && filePath.endsWith("\"")
      ? filePath.slice(1, -1)
      : filePath;
  const renamedTarget = unquoted.includes(" -> ")
    ? unquoted.split(" -> ").at(-1) ?? unquoted
    : unquoted;

  return normalizePath(renamedTarget);
}

function isBoundarySourcePath(filePath: string): boolean {
  return (
    filePath.startsWith("scripts/run-") && filePath.endsWith("-boundary-audit.ts")
  ) || (
    filePath.startsWith("tests/") && filePath.endsWith("-boundary-audit.test.ts")
  );
}

function boundarySourcePathRegistered(
  filePath: string,
  governanceRunnerText: string
): boolean {
  const auditName = boundaryAuditNameFromSourcePath(filePath);

  return auditName !== undefined
    && governanceRunnerText.includes(
      `auditCheck("${auditName}", "scripts/run-${auditName}-audit.ts")`
    );
}

function boundaryAuditNameFromSourcePath(filePath: string): string | undefined {
  return boundaryScriptAuditName(filePath) ?? boundaryTestAuditName(filePath);
}

function boundaryScriptAuditName(filePath: string): string | undefined {
  return filePath.startsWith("scripts/run-") && filePath.endsWith("-audit.ts")
    ? filePath.slice("scripts/run-".length, -"-audit.ts".length)
    : undefined;
}

function boundaryTestAuditName(filePath: string): string | undefined {
  return filePath.startsWith("tests/") && filePath.endsWith("-audit.test.ts")
    ? filePath.slice("tests/".length, -"-audit.test.ts".length)
    : undefined;
}

function isGovernanceDocPath(filePath: string): boolean {
  return isGovernanceBoundaryDocPath(filePath)
    || isCurrentStateDocPath(filePath)
    || isValidationTierDocPath(filePath);
}

function isGovernanceBoundaryDocPath(filePath: string): boolean {
  return filePath.startsWith("docs/governance/");
}

function isCurrentStateDocPath(filePath: string): boolean {
  return filePath.startsWith("docs/current/");
}

function isValidationTierDocPath(filePath: string): boolean {
  return filePath === "docs/validation-tiers.md";
}

function isRoadmapDocPath(filePath: string): boolean {
  return filePath.startsWith("docs/agent-os-transformation/");
}

function isRootAgentInstructionPath(filePath: string): boolean {
  return filePath === "AGENTS.md"
    || filePath.startsWith("AGENTS ")
    || filePath.startsWith("AGENTS.");
}

function isEnvironmentArtifactPath(filePath: string): boolean {
  return filePath.endsWith(":Zone.Identifier");
}

function rootNameStartsWith(filePath: string, prefix: string): boolean {
  return filePath.split("/")[0]?.startsWith(prefix) === true;
}

function containsForbiddenOutputMarkers(text: string): boolean {
  return FORBIDDEN_OUTPUT_MARKERS.some((marker) => text.includes(marker));
}

function collectReasons(checks: Record<string, boolean>): string[] {
  return Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([name]) => `source_release_package_boundary_${name}`);
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

function normalizeDirectoryPath(filePath: string): string {
  const normalized = normalizePath(filePath);
  return normalized.endsWith("/") ? normalized : `${normalized}/`;
}

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/^\.\//, "");
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
  const input = await collectSourceReleasePackageBoundaryAuditInput();
  const review = reviewSourceReleasePackageBoundaryAudit(input);
  const format = process.argv.includes("--json") ? "json" : "text";

  console.log(formatSourceReleasePackageBoundaryAuditResult(review, format));

  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      "Source/release package boundary audit failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
