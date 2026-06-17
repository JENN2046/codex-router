#!/usr/bin/env node

import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import {
  formatStateSyncAuditResult,
  reviewStateSyncAudit,
  type StateSyncAuditInput
} from "../packages/state-sync-audit/src/index.js";

const execFileAsync = promisify(execFile);

const CURRENT_STATE_DOC = "docs/current/CURRENT_STATE.md";
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
  const [gitStatusShort, branch, head, parentHead, upstream, aheadBehind] =
    await Promise.all([
      git(["status", "--short"], cwd),
      git(["branch", "--show-current"], cwd),
      git(["rev-parse", "--short", "HEAD"], cwd),
      git(["rev-parse", "--short", "HEAD^"], cwd).catch(() => ""),
      git(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"], cwd)
        .catch(() => ""),
      git(["rev-list", "--left-right", "--count", "HEAD...@{upstream}"], cwd)
        .catch(() => "unknown\tunknown")
    ]);

  const input: StateSyncAuditInput = {
    gitStatusShort,
    branch: branch.trim(),
    head: head.trim(),
    upstream: upstream.trim(),
    aheadBehind: aheadBehind.trim(),
    packageJsonText: await read(cwd, "package.json"),
    currentStateText: await read(cwd, CURRENT_STATE_DOC),
    agentBoardText: await readAgentBoard(cwd)
  };

  const trimmedParentHead = parentHead.trim();
  if (trimmedParentHead !== "") {
    input.parentHead = trimmedParentHead;
  }

  return input;
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
