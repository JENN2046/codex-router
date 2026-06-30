#!/usr/bin/env node

import { execFile } from "node:child_process";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const STATE_SYNC_REANCHOR_ALLOWED_PATHS = [
  "docs/current/state-sync-record.json"
] as const;

const STATE_SYNC_REANCHOR_ALLOWED_PATH_SET = new Set<string>(
  STATE_SYNC_REANCHOR_ALLOWED_PATHS
);

export interface StateSyncReanchorDiffVerificationResult {
  status: "passed" | "blocked";
  mode: "worktree" | "cached" | "range";
  changedPaths: string[];
  disallowedPaths: string[];
  stalePhraseHits: [];
}

export async function verifyStateSyncReanchorDiff(
  cwd = process.cwd(),
  mode: "worktree" | "cached" = "worktree"
): Promise<StateSyncReanchorDiffVerificationResult> {
  const changedPaths = await changedPathsForMode(cwd, mode);
  return verifyStateSyncReanchorPaths(cwd, mode, changedPaths);
}

export async function verifyStateSyncReanchorRange(
  cwd: string,
  baseRef: string,
  headRef = "HEAD"
): Promise<StateSyncReanchorDiffVerificationResult> {
  const changedPaths = await changedPathsForRange(cwd, baseRef, headRef);
  return verifyStateSyncReanchorPaths(cwd, "range", changedPaths);
}

async function verifyStateSyncReanchorPaths(
  cwd: string,
  mode: StateSyncReanchorDiffVerificationResult["mode"],
  changedPaths: string[]
): Promise<StateSyncReanchorDiffVerificationResult> {
  const disallowedPaths = changedPaths.filter(
    (filePath) => !STATE_SYNC_REANCHOR_ALLOWED_PATH_SET.has(filePath)
  );
  const stalePhraseHits: [] = [];

  return {
    status:
      disallowedPaths.length === 0 && stalePhraseHits.length === 0
        ? "passed"
        : "blocked",
    mode,
    changedPaths,
    disallowedPaths,
    stalePhraseHits
  };
}

async function changedPathsForMode(
  cwd: string,
  mode: "worktree" | "cached"
): Promise<string[]> {
  const args = mode === "cached"
    ? ["diff", "--cached", "--name-status", "-z", "--no-renames"]
    : ["diff", "--name-status", "-z", "--no-renames"];
  const output = await git(args, cwd);
  const changed = pathsFromNameStatusZ(output);
  if (mode === "cached") {
    return changed;
  }

  const untracked = await git(
    ["ls-files", "-z", "--others", "--exclude-standard"],
    cwd
  );
  return unique([
    ...changed,
    ...pathsFromNulOutput(untracked)
  ]);
}

async function changedPathsForRange(
  cwd: string,
  baseRef: string,
  headRef: string
): Promise<string[]> {
  const output = await git(
    ["diff", "--name-status", "-z", "--no-renames", baseRef, headRef],
    cwd
  );
  return pathsFromNameStatusZ(output);
}

function pathsFromNameStatusZ(output: string): string[] {
  const fields = pathsFromNulOutput(output);
  const paths: string[] = [];
  for (let index = 0; index < fields.length;) {
    const status = fields[index++];
    if (status === undefined) {
      break;
    }

    const pathCount = status.startsWith("R") || status.startsWith("C") ? 2 : 1;
    for (let offset = 0; offset < pathCount; offset += 1) {
      const filePath = fields[index++];
      if (filePath !== undefined) {
        paths.push(filePath);
      }
    }
  }

  return unique(paths);
}

function pathsFromNulOutput(output: string): string[] {
  return output.split("\0").filter((field) => field !== "");
}

async function git(args: string[], cwd: string): Promise<string> {
  const { stdout } = await execFileAsync("git", args, {
    cwd,
    encoding: "utf8",
    windowsHide: true
  });
  return stdout;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function modeFromArgs(args: string[]): "worktree" | "cached" {
  return args.includes("--cached") ? "cached" : "worktree";
}

function rangeRefsFromArgs(args: string[]): [string, string] {
  const index = args.indexOf("--range");
  const value = args[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new Error("Missing value for --range");
  }

  const separator = value.indexOf("..");
  if (separator >= 0) {
    const baseRef = value.slice(0, separator);
    const headRef = value.slice(separator + 2);
    if (baseRef === "" || headRef === "") {
      throw new Error("Invalid --range value");
    }
    return [baseRef, headRef];
  }

  const headRef = args[index + 2];
  if (headRef !== undefined && !headRef.startsWith("--")) {
    return [value, headRef];
  }

  return [value, "HEAD"];
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const result = args.includes("--range")
    ? await verifyStateSyncReanchorRange(process.cwd(), ...rangeRefsFromArgs(args))
    : await verifyStateSyncReanchorDiff(process.cwd(), modeFromArgs(args));
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== "passed") {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      "State-sync reanchor diff verification failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
