#!/usr/bin/env node

import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const STATE_SYNC_REANCHOR_ALLOWED_PATHS = [
  "docs/current/CURRENT_STATE.md",
  "docs/current/state-sync-record.json",
  ".agent_board/CHECKPOINT.md",
  ".agent_board/HANDOFF.md",
  ".agent_board/RUN_STATE.md",
  ".agent_board/TASK_QUEUE.md",
  ".agent_board/VALIDATION_LOG.md"
] as const;

const STATE_SYNC_REANCHOR_ALLOWED_PATH_SET = new Set<string>(
  STATE_SYNC_REANCHOR_ALLOWED_PATHS
);

const STALE_PROSE_PATHS = [
  "docs/current/CURRENT_STATE.md",
  ".agent_board/CHECKPOINT.md",
  ".agent_board/HANDOFF.md",
  ".agent_board/RUN_STATE.md",
  ".agent_board/TASK_QUEUE.md",
  ".agent_board/VALIDATION_LOG.md"
] as const;

export const STATE_SYNC_REANCHOR_STALE_PHRASES = [
  "prepared for direct push",
  "push the post-PR",
  "verify post-push",
  "waiting for CI"
] as const;

export interface StateSyncReanchorDiffVerificationResult {
  status: "passed" | "blocked";
  mode: "worktree" | "cached";
  changedPaths: string[];
  disallowedPaths: string[];
  stalePhraseHits: Array<{
    path: string;
    phrase: string;
  }>;
}

export async function verifyStateSyncReanchorDiff(
  cwd = process.cwd(),
  mode: "worktree" | "cached" = "worktree"
): Promise<StateSyncReanchorDiffVerificationResult> {
  const changedPaths = await changedPathsForMode(cwd, mode);
  const disallowedPaths = changedPaths.filter(
    (filePath) => !STATE_SYNC_REANCHOR_ALLOWED_PATH_SET.has(filePath)
  );
  const stalePhraseHits = await collectStalePhraseHits(cwd);

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
    ? ["diff", "--cached", "--name-only"]
    : ["diff", "--name-only"];
  const output = await git(args, cwd);
  const changed = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (mode === "cached") {
    return changed;
  }

  const untracked = await git(
    ["ls-files", "--others", "--exclude-standard"],
    cwd
  );
  return unique([
    ...changed,
    ...untracked.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  ]);
}

async function collectStalePhraseHits(cwd: string): Promise<Array<{
  path: string;
  phrase: string;
}>> {
  const hits: Array<{ path: string; phrase: string }> = [];
  for (const filePath of STALE_PROSE_PATHS) {
    const text = await readFile(join(cwd, filePath), "utf8").catch(() => "");
    for (const phrase of STATE_SYNC_REANCHOR_STALE_PHRASES) {
      if (text.includes(phrase)) {
        hits.push({ path: filePath, phrase });
      }
    }
  }

  return hits;
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

async function main(): Promise<void> {
  const result = await verifyStateSyncReanchorDiff(
    process.cwd(),
    modeFromArgs(process.argv.slice(2))
  );
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
