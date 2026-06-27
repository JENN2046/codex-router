#!/usr/bin/env node

import { execFile } from "node:child_process";
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
    parentHead,
    mergeParentHead,
    mergeParentParentHead,
    mergeParentDeclaredParents,
    localUpstream,
    packageJsonText,
    currentStateText,
    agentBoardText,
    stateSyncClaimText
  ] =
    await Promise.all([
      git(["status", "--short"], cwd),
      git(["branch", "--show-current"], cwd),
      git(["rev-parse", "--short", "HEAD"], cwd),
      git(["rev-parse", "--short", "HEAD^"], cwd).catch(() => ""),
      git(["rev-parse", "--short", "HEAD^2"], cwd).catch(() => ""),
      git(["rev-parse", "--short", "HEAD^2^"], cwd).catch(() => ""),
      git(["show", "-s", "--format=%P", "HEAD^2"], cwd).catch(() => ""),
      git(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"], cwd)
        .catch(() => ""),
      read(cwd, "package.json"),
      read(cwd, CURRENT_STATE_DOC),
      readAgentBoard(cwd),
      readOptional(cwd, STATE_SYNC_RECORD_DOC)
    ]);

  const parsedClaim = parseStateSyncClaim(stateSyncClaimText);
  const observedUpstream = await resolveObservedUpstream(
    localUpstream.trim(),
    parsedClaim,
    cwd
  );
  const aheadBehind = await gitAheadBehindFromRef("HEAD", observedUpstream, cwd);

  const input: StateSyncAuditInput = {
    gitStatusShort,
    branch: branch.trim(),
    head: head.trim(),
    upstream: observedUpstream,
    aheadBehind: aheadBehind.trim(),
    packageJsonText,
    currentStateText,
    agentBoardText
  };
  if (stateSyncClaimText !== undefined) {
    input.stateSyncClaimText = stateSyncClaimText;
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
  if (localUpstream !== "") {
    return localUpstream;
  }

  if (
    parsedClaim.status !== "valid"
    || parsedClaim.claim.subject.upstream.trim() === ""
  ) {
    return "";
  }

  const claimedUpstream = parsedClaim.claim.subject.upstream.trim();
  return await gitRefExists(claimedUpstream, cwd) ? claimedUpstream : "";
}

async function readAgentBoard(cwd: string): Promise<string> {
  const texts = await Promise.all(
    AGENT_BOARD_FILES.map((filePath) =>
      read(cwd, filePath).catch(() => "")
    )
  );

  return texts.join("\n");
}

function validatedSourceAnchorFromClaimOrLegacy(
  parsedClaim: ReturnType<typeof parseStateSyncClaim>,
  currentStateText: string
): string | undefined {
  if (parsedClaim.status === "valid") {
    return parsedClaim.claim.source.validatedSourceCommit;
  }

  if (parsedClaim.status === "invalid") {
    return undefined;
  }

  const validatedSourceCommit = stateFieldValue(
    currentStateText,
    "Validated source commit"
  );
  const latestValidatedCommit = stateFieldValue(
    currentStateText,
    "Latest validated commit"
  );
  return validatedSourceCommit ?? latestValidatedCommit;
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

function stateFieldValue(text: string, field: string): string | undefined {
  return new RegExp(`\\| ${escapeRegExp(field)} \\| \`([^\\\`]+)\` \\|`)
    .exec(text)?.[1];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isCommitLike(value: string): boolean {
  return /^[0-9a-f]{7,40}$/i.test(value);
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
