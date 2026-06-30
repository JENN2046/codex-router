#!/usr/bin/env node

import { execFile } from "node:child_process";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { prepareStateSyncReanchor } from "./prepare-state-sync-reanchor.js";
import { resolveStateSyncReanchorPrGate } from "./resolve-state-sync-reanchor-pr-gate.js";
import {
  STATE_SYNC_REANCHOR_ALLOWED_PATHS,
  verifyStateSyncReanchorDiff
} from "./verify-state-sync-reanchor-diff.js";

const execFileAsync = promisify(execFile);

export interface RunStateSyncMainReanchorOptions {
  write?: boolean;
  commit?: boolean;
  push?: boolean;
  source?: string;
  remote?: string;
  validate?: boolean;
  beforePush?: () => Promise<void>;
}

export interface RunStateSyncMainReanchorResult {
  mode: "check" | "write" | "commit" | "push";
  reanchorNeeded: boolean;
  branch: string;
  baseHead: string;
  remoteHeadBefore: string;
  preparedHead?: string;
  committedHead?: string;
  pushedHead?: string;
  changedPaths: string[];
  validations: string[];
}

export async function runStateSyncMainReanchor(
  cwd = process.cwd(),
  options: RunStateSyncMainReanchorOptions = {}
): Promise<RunStateSyncMainReanchorResult> {
  const remote = options.remote ?? "origin";
  const validate = options.validate ?? true;
  const write = options.write === true || options.commit === true || options.push === true;
  const commit = options.commit === true || options.push === true;

  const branch = await currentBranch(cwd);
  if (branch !== "main") {
    throw new Error(`state_sync_main_reanchor_requires_main_branch:${branch}`);
  }

  await fetchRemoteMain(cwd, remote);
  const baseHead = await gitTrim(["rev-parse", "HEAD"], cwd);
  const remoteHeadBefore = await remoteMainHead(cwd, remote);

  if (baseHead !== remoteHeadBefore) {
    throw new Error("state_sync_main_reanchor_requires_head_at_origin_main");
  }

  const validations: string[] = [];
  const gate = await resolveStateSyncReanchorPrGate(cwd);
  if (!gate.runReanchor) {
    return {
      mode: "check",
      reanchorNeeded: false,
      branch,
      baseHead,
      remoteHeadBefore,
      changedPaths: [],
      validations
    };
  }

  const prepareResult = await prepareStateSyncReanchor(cwd, {
    write,
    ...(options.source === undefined ? {} : { source: options.source })
  });

  if (!write) {
    return {
      mode: "check",
      reanchorNeeded: true,
      branch,
      baseHead,
      remoteHeadBefore,
      changedPaths: prepareResult.changedPaths,
      validations
    };
  }

  if (validate) {
    await runValidation(["diff", "--check"], cwd, "git diff --check", validations);
    await runNodeScript(
      "scripts/sync-state-sync-display.ts",
      ["--check"],
      cwd,
      "node --import tsx scripts/sync-state-sync-display.ts --check",
      validations
    );
    const diffVerification = await verifyStateSyncReanchorDiff(cwd);
    if (diffVerification.status !== "passed") {
      throw new Error("state_sync_main_reanchor_diff_verification_failed");
    }
    validations.push("node --import tsx scripts/verify-state-sync-reanchor-diff.ts");
    await runNodeScript(
      "scripts/run-state-sync-audit.ts",
      ["--json"],
      cwd,
      "node --import tsx scripts/run-state-sync-audit.ts --json",
      validations
    );
  }

  if (!commit) {
    return {
      mode: "write",
      reanchorNeeded: true,
      branch,
      baseHead,
      remoteHeadBefore,
      preparedHead: await gitTrim(["rev-parse", "HEAD"], cwd),
      changedPaths: prepareResult.changedPaths,
      validations
    };
  }

  await git(["add", ...STATE_SYNC_REANCHOR_ALLOWED_PATHS], cwd);
  if (validate) {
    const cachedVerification = await verifyStateSyncReanchorDiff(cwd, "cached");
    if (cachedVerification.status !== "passed") {
      throw new Error("state_sync_main_reanchor_cached_diff_verification_failed");
    }
    validations.push("node --import tsx scripts/verify-state-sync-reanchor-diff.ts --cached");
    await runValidation(
      ["diff", "--cached", "--check"],
      cwd,
      "git diff --cached --check",
      validations
    );
  }
  await git(["commit", "-m", "docs(state): reanchor main state-sync record"], cwd);
  const committedHead = await gitTrim(["rev-parse", "HEAD"], cwd);
  if (validate) {
    await runNodeScript(
      "scripts/run-state-sync-audit.ts",
      ["--json"],
      cwd,
      "node --import tsx scripts/run-state-sync-audit.ts --json after commit",
      validations
    );
  }

  if (options.push !== true) {
    return {
      mode: "commit",
      reanchorNeeded: true,
      branch,
      baseHead,
      remoteHeadBefore,
      committedHead,
      changedPaths: prepareResult.changedPaths,
      validations
    };
  }

  if (options.beforePush !== undefined) {
    await options.beforePush();
  }
  await fetchRemoteMain(cwd, remote);
  const remoteHeadAtPush = await remoteMainHead(cwd, remote);
  if (remoteHeadAtPush !== remoteHeadBefore) {
    throw new Error("state_sync_main_reanchor_origin_main_moved");
  }
  const divergence = await gitTrim(
    ["rev-list", "--left-right", "--count", `HEAD...refs/remotes/${remote}/main`],
    cwd
  );
  if (divergence !== "1\t0") {
    throw new Error(`state_sync_main_reanchor_unexpected_divergence:${divergence}`);
  }

  await git(["push", remote, "HEAD:main"], cwd);
  await fetchRemoteMain(cwd, remote);

  return {
    mode: "push",
    reanchorNeeded: true,
    branch,
    baseHead,
    remoteHeadBefore,
    committedHead,
    pushedHead: await remoteMainHead(cwd, remote),
    changedPaths: prepareResult.changedPaths,
    validations
  };
}

async function currentBranch(cwd: string): Promise<string> {
  return gitTrim(["branch", "--show-current"], cwd);
}

async function fetchRemoteMain(cwd: string, remote: string): Promise<void> {
  await git(["fetch", remote, `+refs/heads/main:refs/remotes/${remote}/main`], cwd);
}

async function remoteMainHead(cwd: string, remote: string): Promise<string> {
  return gitTrim(["rev-parse", `refs/remotes/${remote}/main`], cwd);
}

async function runNodeScript(
  scriptPath: string,
  args: string[],
  cwd: string,
  label: string,
  validations: string[]
): Promise<void> {
  await execFileAsync("node", ["--import", "tsx", scriptPath, ...args], {
    cwd,
    encoding: "utf8",
    windowsHide: true
  });
  validations.push(label);
}

async function runValidation(
  args: string[],
  cwd: string,
  label: string,
  validations: string[]
): Promise<void> {
  await git(args, cwd);
  validations.push(label);
}

async function gitTrim(args: string[], cwd: string): Promise<string> {
  return (await git(args, cwd)).trim();
}

async function git(args: string[], cwd: string): Promise<string> {
  const { stdout } = await execFileAsync("git", args, {
    cwd,
    encoding: "utf8",
    windowsHide: true
  });
  return stdout;
}

function hasArg(args: string[], name: string): boolean {
  return args.includes(name);
}

function argValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index < 0) {
    return undefined;
  }

  const value = args[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`Missing value for ${name}`);
  }

  return value;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const source = argValue(args, "--source");
  const remote = argValue(args, "--remote");
  const result = await runStateSyncMainReanchor(process.cwd(), {
    write: hasArg(args, "--write"),
    commit: hasArg(args, "--commit"),
    push: hasArg(args, "--push"),
    ...(source === undefined ? {} : { source }),
    ...(remote === undefined ? {} : { remote })
  });
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      "State-sync main reanchor failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
