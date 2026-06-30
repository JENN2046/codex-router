#!/usr/bin/env node

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import {
  formatStateSyncAuditResult,
  parseStateSyncClaim,
  reviewStateSyncAudit,
  type StateSyncAuditInput
} from "../packages/state-sync-audit/src/index.js";

const execFileAsync = promisify(execFile);

const CURRENT_STATE_DOC = "docs/current/CURRENT_STATE.md";
const STATE_SYNC_RECORD_DOC = "docs/current/state-sync-record.json";
const AGENT_BOARD_FILES = [
  ".agent_board/RUN_STATE.md",
  ".agent_board/TASK_QUEUE.md",
  ".agent_board/CHECKPOINT.md",
  ".agent_board/HANDOFF.md",
  ".agent_board/VALIDATION_LOG.md"
] as const;

export async function collectStateSyncAuditInput(
  cwd = process.cwd()
): Promise<StateSyncAuditInput> {
  const [
    gitStatusShort,
    branch,
    head,
    headFull,
    parentHead,
    mergeParentHead,
    mergeParentParentHead,
    mergeParentDeclaredParents,
    localUpstream,
    packageJsonText,
    currentStateText,
    agentBoardFiles,
    stateSyncClaimText
  ] =
    await Promise.all([
      git(["status", "--short"], cwd),
      git(["branch", "--show-current"], cwd),
      git(["rev-parse", "--short", "HEAD"], cwd),
      git(["rev-parse", "HEAD"], cwd),
      git(["rev-parse", "--short", "HEAD^"], cwd).catch(() => ""),
      git(["rev-parse", "--short", "HEAD^2"], cwd).catch(() => ""),
      git(["rev-parse", "--short", "HEAD^2^"], cwd).catch(() => ""),
      git(["show", "-s", "--format=%P", "HEAD^2"], cwd).catch(() => ""),
      git(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"], cwd)
        .catch(() => ""),
      read(cwd, "package.json"),
      read(cwd, CURRENT_STATE_DOC),
      readAgentBoardFiles(cwd),
      readOptional(cwd, STATE_SYNC_RECORD_DOC)
    ]);
  const agentBoardText = agentBoardFiles.map((file) => file.text).join("\n");

  const parsedClaim = parseStateSyncClaim(stateSyncClaimText);
  const observedUpstream = await resolveObservedUpstream(
    localUpstream.trim(),
    parsedClaim,
    cwd
  );
  const aheadBehind = await gitAheadBehindFromRef("HEAD", observedUpstream, cwd);
  const claimSourceTreeDigestExcludedPaths =
    parsedClaim.status === "valid"
      ? parsedClaim.claim.source.sourceTreeDigest.excludedPaths
      : undefined;

  const input: StateSyncAuditInput = {
    gitStatusShort,
    branch: branch.trim(),
    head: head.trim(),
    headFull: headFull.trim(),
    upstream: observedUpstream,
    aheadBehind: aheadBehind.trim(),
    packageJsonText,
    currentStateText,
    agentBoardText,
    agentBoardFiles
  };
  if (stateSyncClaimText !== undefined) {
    input.stateSyncClaimText = stateSyncClaimText;
  }
  if (claimSourceTreeDigestExcludedPaths !== undefined) {
    const headSourceTreeDigest = await gitFilteredTreeDigest(
      "HEAD",
      claimSourceTreeDigestExcludedPaths,
      cwd
    );
    if (headSourceTreeDigest !== undefined) {
      input.headSourceTreeDigest = headSourceTreeDigest;
    }
  }

  const trimmedParentHead = parentHead.trim();
  if (trimmedParentHead !== "") {
    input.parentHead = trimmedParentHead;
  }

  const allowedStateCommits = collectAllowedStateCommits({
    mergeBaseHead: trimmedParentHead,
    mergeParentHead,
    mergeParentParentHead,
    mergeParentDeclaredParents
  });
  if (allowedStateCommits.length > 0) {
    input.allowedStateCommits = allowedStateCommits;
  }

  const validatedSourceAnchor = validatedSourceAnchorFromClaimOrLegacy(
    parsedClaim,
    currentStateText
  );
  if (validatedSourceAnchor !== undefined) {
    if (isCommitLike(validatedSourceAnchor)) {
      const validatedSourceCommitAvailable =
        await gitCommitExists(validatedSourceAnchor, cwd);
      input.validatedSourceCommitAvailable = validatedSourceCommitAvailable;
      if (validatedSourceCommitAvailable) {
        input.validatedSourceAheadBehind = (
          await gitAheadBehindFromRef(validatedSourceAnchor, observedUpstream, cwd)
        ).trim();
        input.validatedSourceAncestorOfHead = await gitCommitIsAncestorOfHead(
          validatedSourceAnchor,
          cwd
        );
        const committedPathsSinceValidatedSource =
          await gitChangedPathsSince(validatedSourceAnchor, cwd);
        if (committedPathsSinceValidatedSource !== undefined) {
          input.committedPathsSinceValidatedSource = committedPathsSinceValidatedSource;
        }
        const validatedSourceTreeDiffPaths =
          await gitTreeChangedPathsSince(validatedSourceAnchor, cwd);
        if (validatedSourceTreeDiffPaths !== undefined) {
          input.validatedSourceTreeDiffPaths = validatedSourceTreeDiffPaths;
        }
        if (claimSourceTreeDigestExcludedPaths !== undefined) {
          const validatedSourceTreeDigest = await gitFilteredTreeDigest(
            validatedSourceAnchor,
            claimSourceTreeDigestExcludedPaths,
            cwd
          );
          if (validatedSourceTreeDigest !== undefined) {
            input.validatedSourceTreeDigest = validatedSourceTreeDigest;
          }
        }
      } else {
        input.validatedSourceAheadBehind = "unknown\tunknown";
        input.validatedSourceAncestorOfHead = false;
      }
    } else {
      input.validatedSourceAheadBehind = "unknown\tunknown";
      input.validatedSourceAncestorOfHead = false;
    }
  }

  return input;
}

async function resolveObservedUpstream(
  localUpstream: string,
  parsedClaim: ReturnType<typeof parseStateSyncClaim>,
  cwd: string
): Promise<string> {
  if (parsedClaim.status !== "valid") {
    return localUpstream;
  }

  const claimedUpstream = parsedClaim.claim.subject.upstream.trim();
  if (claimedUpstream === "") {
    return "";
  }

  if (!isAllowedClaimUpstreamRef(claimedUpstream)) {
    return "";
  }

  const normalizedUpstream = normalizeClaimUpstreamRef(claimedUpstream);
  return await gitRefExists(normalizedUpstream, cwd) ? normalizedUpstream : "";
}

async function readAgentBoardFiles(
  cwd: string
): Promise<Array<{ path: string; text: string }>> {
  return Promise.all(
    AGENT_BOARD_FILES.map(async (filePath) => ({
      path: filePath,
      text: await read(cwd, filePath).catch(() => "")
    }))
  );
}

function validatedSourceAnchorFromClaimOrLegacy(
  parsedClaim: ReturnType<typeof parseStateSyncClaim>,
  _currentStateText: string
): string | undefined {
  if (parsedClaim.status === "valid") {
    return parsedClaim.claim.source.validatedSourceCommit;
  }

  return undefined;
}

async function git(args: string[], cwd: string): Promise<string> {
  const { stdout } = await execFileAsync("git", args, {
    cwd,
    encoding: "utf8",
    windowsHide: true
  });

  return stdout;
}

async function gitCommitIsAncestorOfHead(
  commit: string,
  cwd: string
): Promise<boolean> {
  try {
    await execFileAsync("git", ["merge-base", "--is-ancestor", commit, "HEAD"], {
      cwd,
      encoding: "utf8",
      windowsHide: true
    });
    return true;
  } catch {
    return false;
  }
}

async function gitCommitExists(commit: string, cwd: string): Promise<boolean> {
  try {
    await git(["cat-file", "-e", `${commit}^{commit}`], cwd);
    return true;
  } catch {
    return false;
  }
}

async function gitAheadBehindFromRef(
  commit: string,
  upstream: string,
  cwd: string
): Promise<string> {
  if (upstream === "") {
    return "unknown\tunknown";
  }

  return git(["rev-list", "--left-right", "--count", `${commit}...${upstream}`], cwd)
    .catch(() => "unknown\tunknown");
}

async function gitRefExists(ref: string, cwd: string): Promise<boolean> {
  try {
    await git(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`], cwd);
    return true;
  } catch {
    return false;
  }
}

async function gitChangedPathsSince(
  commit: string,
  cwd: string
): Promise<string[] | undefined> {
  try {
    const output = await git(
      ["log", "--format=", "--name-only", "--no-renames", `${commit}..HEAD`],
      cwd
    );
    return uniqueNonEmpty(output.split(/\r?\n/));
  } catch {
    return undefined;
  }
}

async function gitTreeChangedPathsSince(
  commit: string,
  cwd: string
): Promise<string[] | undefined> {
  try {
    const output = await git(
      ["diff", "--name-only", "--no-renames", commit, "HEAD"],
      cwd
    );
    return uniqueNonEmpty(output.split(/\r?\n/));
  } catch {
    return undefined;
  }
}

export async function gitFilteredTreeDigest(
  ref: string,
  excludedPaths: string[],
  cwd: string
): Promise<string | undefined> {
  try {
    const output = await git(["ls-tree", "-r", "-z", ref], cwd);
    const excluded = new Set(excludedPaths);
    const entries = output
      .split("\0")
      .filter(Boolean)
      .map(parseLsTreeEntry)
      .filter((entry): entry is LsTreeEntry => entry !== undefined)
      .filter((entry) => !excluded.has(entry.path))
      .sort((left, right) => (
        left.path < right.path ? -1 : left.path > right.path ? 1 : 0
      ));
    const hash = createHash("sha256");
    for (const entry of entries) {
      hash.update(
        `${entry.mode} ${entry.type} ${entry.object}\t${entry.path}\n`,
        "utf8"
      );
    }
    return hash.digest("hex");
  } catch {
    return undefined;
  }
}

interface LsTreeEntry {
  mode: string;
  type: string;
  object: string;
  path: string;
}

function parseLsTreeEntry(value: string): LsTreeEntry | undefined {
  const tabIndex = value.indexOf("\t");
  if (tabIndex < 0) {
    return undefined;
  }

  const meta = value.slice(0, tabIndex).split(" ");
  const [mode, type, object] = meta;
  const path = value.slice(tabIndex + 1);
  if (mode === undefined || type === undefined || object === undefined || path === "") {
    return undefined;
  }

  return { mode, type, object, path };
}

function isCommitLike(value: string): boolean {
  return /^[0-9a-f]{7,40}$/i.test(value);
}

function isAllowedClaimUpstreamRef(ref: string): boolean {
  if (ref === "origin/HEAD" || ref === "refs/remotes/origin/HEAD") {
    return false;
  }

  const originShorthand = /^origin\/[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(ref);
  const originFullRef =
    /^refs\/remotes\/origin\/[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(ref);
  if (!originShorthand && !originFullRef) {
    return false;
  }

  return !ref.split("/").some((part) => (
    part === ""
    || part === "."
    || part === ".."
    || part.endsWith(".lock")
    || part.includes("@{")
    || part.includes("..")
    || part.includes("^")
    || part.includes("~")
    || part.includes(":")
    || part.includes("\\")
  ));
}

function normalizeClaimUpstreamRef(ref: string): string {
  return ref.startsWith("origin/") ? `refs/remotes/${ref}` : ref;
}

function uniqueNonEmpty(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export function collectAllowedStateCommits(input: {
  mergeBaseHead: string;
  mergeParentHead: string;
  mergeParentParentHead: string;
  mergeParentDeclaredParents: string;
}): string[] {
  const mergeBaseHead = input.mergeBaseHead.trim();
  return uniqueNonEmpty([
    input.mergeParentHead,
    input.mergeParentParentHead,
    ...shortCommitParents(input.mergeParentDeclaredParents)
  ]).filter((commit) => commit !== mergeBaseHead);
}

function shortCommitParents(value: string): string[] {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((commit) => commit.slice(0, 7));
}

async function read(cwd: string, filePath: string): Promise<string> {
  return readFile(join(cwd, filePath), "utf8");
}

async function readOptional(
  cwd: string,
  filePath: string
): Promise<string | undefined> {
  try {
    return await read(cwd, filePath);
  } catch {
    return undefined;
  }
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
