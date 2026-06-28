#!/usr/bin/env node

import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import {
  parseStateSyncClaim,
  type StateSyncClaim
} from "../packages/state-sync-audit/src/index.js";
import { gitFilteredTreeDigest } from "./run-state-sync-audit.js";
import {
  syncStateSyncDisplay,
  type StateSyncDisplaySyncResult
} from "./sync-state-sync-display.js";

const execFileAsync = promisify(execFile);

const STATE_SYNC_RECORD_DOC = "docs/current/state-sync-record.json";

export interface PrepareStateSyncReanchorOptions {
  source?: string;
  write?: boolean;
}

export interface PrepareStateSyncReanchorResult {
  mode: "check" | "write";
  branch: string;
  upstream: string;
  validatedSourceCommit: string;
  recordedDivergence: {
    ahead: number;
    behind: number;
  };
  sourceTreeDigest: string;
  stateCommitsAfterSourceBeforeWrite: number;
  changedPaths: string[];
  displaySync?: StateSyncDisplaySyncResult;
}

export async function prepareStateSyncReanchor(
  cwd = process.cwd(),
  options: PrepareStateSyncReanchorOptions = {}
): Promise<PrepareStateSyncReanchorResult> {
  const claimText = await read(cwd, STATE_SYNC_RECORD_DOC);
  const parsedClaim = parseStateSyncClaim(claimText);
  if (parsedClaim.status !== "valid") {
    throw new Error(
      `Cannot prepare state-sync reanchor from ${parsedClaim.status} claim`
    );
  }

  const branch = (await git(["branch", "--show-current"], cwd)).trim();
  if (branch === "") {
    throw new Error("Cannot prepare state-sync reanchor from detached checkout");
  }
  if (branch !== "main") {
    throw new Error(
      `State-sync reanchor preparation only runs on main; current branch is ${branch}`
    );
  }
  if (options.write === true) {
    await requireCleanWorktree(cwd);
  }

  const sourceRef =
    options.source ?? await inferSourceRef(parsedClaim.claim, cwd);
  await requireCommit(sourceRef, cwd);
  await requireAncestorOfHead(sourceRef, cwd);

  const allowedStatePaths = parsedClaim.claim.transition.allowedStatePaths;
  const pathsSinceSource = await changedPathsSince(sourceRef, cwd);
  const nonStatePaths = pathsSinceSource.filter(
    (filePath) => !allowedStatePaths.includes(filePath)
  );
  if (nonStatePaths.length > 0) {
    throw new Error(
      `Source ${sourceRef} is not followed only by state paths: ${nonStatePaths.join(", ")}`
    );
  }

  const stateCommitsAfterSourceBeforeWrite =
    await revListCount(`${sourceRef}..HEAD`, cwd);
  const validatedSourceCommit = (
    await git(["rev-parse", "--short", sourceRef], cwd)
  ).trim();
  const sourceTreeDigest = await gitFilteredTreeDigest(
    sourceRef,
    allowedStatePaths,
    cwd
  );
  if (sourceTreeDigest === undefined) {
    throw new Error(`Cannot compute source tree digest for ${sourceRef}`);
  }

  const updatedClaim = reanchorClaim(parsedClaim.claim, {
    branch,
    upstream: upstreamForBranch(branch, parsedClaim.claim),
    validatedSourceCommit,
    sourceTreeDigest,
    recordedAhead: stateCommitsAfterSourceBeforeWrite + 1
  });
  const updatedClaimText = `${JSON.stringify(updatedClaim, null, 2)}\n`;

  const changedPaths: string[] = [];
  if (claimText !== updatedClaimText) {
    changedPaths.push(STATE_SYNC_RECORD_DOC);
  }

  let displaySync: StateSyncDisplaySyncResult | undefined;
  if (options.write === true) {
    if (changedPaths.includes(STATE_SYNC_RECORD_DOC)) {
      await writeFile(join(cwd, STATE_SYNC_RECORD_DOC), updatedClaimText, "utf8");
    }
    displaySync = await syncStateSyncDisplay(cwd, { write: true });
    changedPaths.push(...displaySync.changedPaths);
  }

  return {
    mode: options.write === true ? "write" : "check",
    branch,
    upstream: updatedClaim.subject.upstream,
    validatedSourceCommit,
    recordedDivergence: updatedClaim.source.recordedDivergence,
    sourceTreeDigest,
    stateCommitsAfterSourceBeforeWrite,
    changedPaths: unique(changedPaths),
    ...(displaySync === undefined ? {} : { displaySync })
  };
}

async function inferSourceRef(
  claim: StateSyncClaim,
  cwd: string
): Promise<string> {
  const existingSource = claim.source.validatedSourceCommit;
  const existingSourceAvailable = await commitExists(existingSource, cwd);
  if (!existingSourceAvailable) {
    await requireHeadMatchesRecordedSourceDigest(claim, cwd);
    return "HEAD";
  }

  const existingSourceIsAncestor = await commitIsAncestorOfHead(
    existingSource,
    cwd
  );
  if (!existingSourceIsAncestor) {
    await requireHeadMatchesRecordedSourceDigest(claim, cwd);
    return "HEAD";
  }

  const pathsSinceExistingSource = await changedPathsSince(existingSource, cwd);
  const onlyStatePathsSinceExistingSource =
    pathsSinceExistingSource.length === 0
    || pathsSinceExistingSource.every((filePath) => (
      claim.transition.allowedStatePaths.includes(filePath)
    ));
  if (onlyStatePathsSinceExistingSource) {
    throw new Error(
      "HEAD appears to be a state-only descendant of the recorded source; pass --source explicitly if another state-only record is intended"
    );
  }

  return "HEAD";
}

async function requireHeadMatchesRecordedSourceDigest(
  claim: StateSyncClaim,
  cwd: string
): Promise<void> {
  const headSourceTreeDigest = await gitFilteredTreeDigest(
    "HEAD",
    claim.source.sourceTreeDigest.excludedPaths,
    cwd
  );
  if (headSourceTreeDigest === undefined) {
    throw new Error("Cannot compute HEAD source tree digest for squash reanchor");
  }
  if (headSourceTreeDigest !== claim.source.sourceTreeDigest.value) {
    throw new Error(
      "Squash HEAD source tree digest does not match the recorded validated source; pass --source after explicit revalidation"
    );
  }
}

function reanchorClaim(
  claim: StateSyncClaim,
  input: {
    branch: string;
    upstream: string;
    validatedSourceCommit: string;
    sourceTreeDigest: string;
    recordedAhead: number;
  }
): StateSyncClaim {
  return {
    ...claim,
    subject: {
      branch: input.branch,
      upstream: input.upstream
    },
    source: {
      ...claim.source,
      validatedSourceCommit: input.validatedSourceCommit,
      latestValidatedCommit: input.validatedSourceCommit,
      recordedDivergence: {
        ahead: input.recordedAhead,
        behind: 0
      },
      sourceTreeDigest: {
        ...claim.source.sourceTreeDigest,
        value: input.sourceTreeDigest,
        excludedPaths: claim.transition.allowedStatePaths
      }
    },
    transition: {
      kind: "state_only_pushed",
      allowedStatePaths: claim.transition.allowedStatePaths
    }
  };
}

function upstreamForBranch(branch: string, claim: StateSyncClaim): string {
  const normalizedClaimUpstream = normalizeOriginRef(claim.subject.upstream);
  if (normalizedClaimUpstream.endsWith(`/${branch}`)) {
    return normalizedClaimUpstream;
  }

  return `refs/remotes/origin/${branch}`;
}

function normalizeOriginRef(ref: string): string {
  return ref.startsWith("origin/") ? `refs/remotes/${ref}` : ref;
}

async function requireCommit(ref: string, cwd: string): Promise<void> {
  if (!await commitExists(ref, cwd)) {
    throw new Error(`Commit does not exist: ${ref}`);
  }
}

async function requireAncestorOfHead(ref: string, cwd: string): Promise<void> {
  if (!await commitIsAncestorOfHead(ref, cwd)) {
    throw new Error(`Source is not an ancestor of HEAD: ${ref}`);
  }
}

async function requireCleanWorktree(cwd: string): Promise<void> {
  const status = (await git(["status", "--short"], cwd)).trim();
  if (status !== "") {
    throw new Error("Cannot write state-sync reanchor with a dirty worktree");
  }
}

async function commitExists(ref: string, cwd: string): Promise<boolean> {
  try {
    await git(["cat-file", "-e", `${ref}^{commit}`], cwd);
    return true;
  } catch {
    return false;
  }
}

async function commitIsAncestorOfHead(
  ref: string,
  cwd: string
): Promise<boolean> {
  try {
    await git(["merge-base", "--is-ancestor", ref, "HEAD"], cwd);
    return true;
  } catch {
    return false;
  }
}

async function changedPathsSince(ref: string, cwd: string): Promise<string[]> {
  const output = await git(
    ["log", "--format=", "--name-only", "--no-renames", `${ref}..HEAD`],
    cwd
  );
  return unique(output.split(/\r?\n/).map((value) => value.trim()).filter(Boolean));
}

async function revListCount(range: string, cwd: string): Promise<number> {
  const output = await git(["rev-list", "--count", range], cwd);
  return Number.parseInt(output.trim(), 10);
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

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function sourceOption(args: string[]): string | undefined {
  const index = args.indexOf("--source");
  if (index < 0) {
    return undefined;
  }

  const value = args[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new Error("Missing value for --source");
  }

  return value;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const write = args.includes("--write");
  const check = args.includes("--check") || !write;
  if (write && check && args.includes("--check")) {
    throw new Error("Use either --check or --write, not both");
  }

  const source = sourceOption(args);
  const result = await prepareStateSyncReanchor(process.cwd(), {
    write,
    ...(source === undefined ? {} : { source })
  });
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      "State sync reanchor preparation failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
