#!/usr/bin/env node

import { execFile } from "node:child_process";
import { lstat, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const BOUNDARY_DOC = "docs/governance/SOURCE_RELEASE_PACKAGE_BOUNDARY.md";

const REQUIRED_PACKAGE_SCRIPTS = {
  governance: "tsx scripts/run-governance-check.ts"
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
  "npm run governance -- audit source-release-package-boundary",
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

const FORBIDDEN_OUTPUT_MARKERS = [
  "OPENAI_API_KEY",
  "sk-",
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
    sourceReviewRequiredRootsPresent: boolean;
    sourceReviewForbiddenPathsExcluded: boolean;
    releaseEvidenceHasFiles: boolean;
    releaseEvidenceSourceRootsExcluded: boolean;
    releaseEvidenceForbiddenPathsExcluded: boolean;
    profilesDisjoint: boolean;
    auditReadOnly: boolean;
    outputSanitized: boolean;
  };
  summary: {
    branch: string;
    ahead: number;
    behind: number;
    sourceReviewFileCount: number;
    releaseEvidenceFileCount: number;
    sourceReviewRequiredRootCount: number;
    sourceReviewForbiddenMatchCount: number;
    releaseEvidenceSourceRootLeakCount: number;
    releaseEvidenceForbiddenMatchCount: number;
    profileOverlapCount: number;
    packageScriptTargetCount: number;
    packageScriptMismatchCount: number;
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
    boundaryDocText: await read(cwd, BOUNDARY_DOC)
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
  const checks = {
    worktreeClean: input.gitStatusShort.trim() === "",
    branchMain: input.branch === "main",
    notBehindOrigin: behind === 0,
    packageScriptPresent: packageScriptReview.mismatchCount === 0,
    boundaryDocRecorded: boundaryDocRecorded(input.boundaryDocText),
    sourceReviewHasFiles: sourceReviewManifestFiles.length > 0,
    sourceReviewRequiredRootsPresent:
      sourceReviewRequiredRootCount === REQUIRED_SOURCE_REVIEW_ROOTS.length,
    sourceReviewForbiddenPathsExcluded: sourceReviewForbiddenMatches.length === 0,
    releaseEvidenceHasFiles: releaseEvidenceManifestFiles.length > 0,
    releaseEvidenceSourceRootsExcluded:
      releaseEvidenceSourceRootLeaks.length === 0,
    releaseEvidenceForbiddenPathsExcluded:
      releaseEvidenceForbiddenMatches.length === 0,
    profilesDisjoint: overlaps.length === 0,
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
      sourceReviewRequiredRootCount,
      sourceReviewForbiddenMatchCount: sourceReviewForbiddenMatches.length,
      releaseEvidenceSourceRootLeakCount: releaseEvidenceSourceRootLeaks.length,
      releaseEvidenceForbiddenMatchCount: releaseEvidenceForbiddenMatches.length,
      profileOverlapCount: overlaps.length,
      packageScriptTargetCount: packageScriptReview.targetCount,
      packageScriptMismatchCount: packageScriptReview.mismatchCount,
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
    `required source roots: ${review.summary.sourceReviewRequiredRootCount}/${REQUIRED_SOURCE_REVIEW_ROOTS.length}`,
    `source forbidden matches: ${review.summary.sourceReviewForbiddenMatchCount}`,
    `release source-root leaks: ${review.summary.releaseEvidenceSourceRootLeakCount}`,
    `release forbidden matches: ${review.summary.releaseEvidenceForbiddenMatchCount}`,
    `profile overlaps: ${review.summary.profileOverlapCount}`,
    `package script targets: ${review.summary.packageScriptTargetCount}`,
    `package script mismatches: ${review.summary.packageScriptMismatchCount}`,
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
  return REQUIRED_BOUNDARY_DOC_MARKERS.every((marker) => text.includes(marker));
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
