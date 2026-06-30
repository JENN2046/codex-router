#!/usr/bin/env node

import { execFile } from "node:child_process";
import { pathToFileURL } from "node:url";
import { isDeepStrictEqual, promisify } from "node:util";
import {
  parseStateSyncClaim,
  type StateSyncClaim
} from "../packages/state-sync-audit/src/index.js";
import {
  buildStateSyncReanchorClaim,
  prepareStateSyncReanchor
} from "./prepare-state-sync-reanchor.js";
import { resolveStateSyncReanchorPrGate } from "./resolve-state-sync-reanchor-pr-gate.js";
import {
  STATE_SYNC_REANCHOR_ALLOWED_PATHS,
  verifyStateSyncReanchorDiff,
  verifyStateSyncReanchorRange
} from "./verify-state-sync-reanchor-diff.js";

const execFileAsync = promisify(execFile);
const STATE_SYNC_RECORD_DOC = "docs/current/state-sync-record.json";

export interface RunStateSyncMainReanchorOptions {
  write?: boolean;
  commit?: boolean;
  push?: boolean;
  source?: string;
  remote?: string;
  validate?: boolean;
  validationRunner?: (command: RunStateSyncMainReanchorValidationCommand) => Promise<void>;
  beforePush?: () => Promise<void>;
}

export interface RunStateSyncMainReanchorValidationCommand {
  type: "git" | "node";
  label: string;
  args: string[];
  cwd: string;
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
  if (remote !== "origin") {
    throw new Error(`state_sync_main_reanchor_requires_origin_remote:${remote}`);
  }

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
  const validations: string[] = [];

  if (baseHead !== remoteHeadBefore) {
    if (options.push === true) {
      return resumeCommittedMainReanchor(cwd, {
        branch,
        baseHead,
        remote,
        remoteHeadBefore,
        validate,
        validations,
        ...(options.validationRunner === undefined
          ? {}
          : { validationRunner: options.validationRunner }),
        ...(options.beforePush === undefined ? {} : { beforePush: options.beforePush })
      });
    }
    throw new Error("state_sync_main_reanchor_requires_head_at_origin_main");
  }

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
    await runValidation(
      ["diff", "--check"],
      cwd,
      "git diff --check",
      validations,
      options.validationRunner
    );
    await runNodeScript(
      "scripts/sync-state-sync-display.ts",
      ["--check"],
      cwd,
      "node --import tsx scripts/sync-state-sync-display.ts --check",
      validations,
      options.validationRunner
    );
    const diffVerification = await verifyStateSyncReanchorDiff(cwd);
    if (diffVerification.status !== "passed") {
      throw new Error("state_sync_main_reanchor_diff_verification_failed");
    }
    validations.push("node --import tsx scripts/verify-state-sync-reanchor-diff.ts");
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
      validations,
      options.validationRunner
    );
  }
  await git(["commit", "-m", "docs(state): reanchor main state-sync record"], cwd);
  const committedHead = await gitTrim(["rev-parse", "HEAD"], cwd);

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
  if (validate) {
    await runNodeScript(
      "scripts/run-state-sync-audit.ts",
      ["--json"],
      cwd,
      "node --import tsx scripts/run-state-sync-audit.ts --json after push",
      validations,
      options.validationRunner
    );
  }

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

async function resumeCommittedMainReanchor(
  cwd: string,
  input: {
    branch: string;
    baseHead: string;
    remote: string;
    remoteHeadBefore: string;
    validate: boolean;
    validations: string[];
    validationRunner?: (command: RunStateSyncMainReanchorValidationCommand) => Promise<void>;
    beforePush?: () => Promise<void>;
  }
): Promise<RunStateSyncMainReanchorResult> {
  const status = await gitTrim(["status", "--porcelain"], cwd);
  if (status !== "") {
    throw new Error("state_sync_main_reanchor_resume_requires_clean_worktree");
  }

  const divergence = await gitTrim(
    [
      "rev-list",
      "--left-right",
      "--count",
      `HEAD...refs/remotes/${input.remote}/main`
    ],
    cwd
  );
  if (divergence !== "1\t0") {
    throw new Error(
      `state_sync_main_reanchor_resume_requires_single_local_commit:${divergence}`
    );
  }

  const parent = await gitTrim(["rev-parse", "HEAD^"], cwd);
  if (parent !== input.remoteHeadBefore) {
    throw new Error("state_sync_main_reanchor_resume_parent_mismatch");
  }

  const gate = await resolveStateSyncReanchorPrGate(cwd);
  if (gate.runReanchor || gate.reason !== "already_reanchored") {
    throw new Error("state_sync_main_reanchor_resume_requires_reanchored_claim");
  }

  const rangeVerification = await verifyStateSyncReanchorRange(
    cwd,
    input.remoteHeadBefore,
    "HEAD"
  );
  if (rangeVerification.status !== "passed") {
    throw new Error("state_sync_main_reanchor_resume_diff_verification_failed");
  }
  if (!hasExpectedReanchorDelta(rangeVerification.changedPaths)) {
    throw new Error("state_sync_main_reanchor_resume_requires_reanchor_delta");
  }
  const parentClaim = await claimAtRef(cwd, input.remoteHeadBefore);
  if (claimIsMainPushed(parentClaim)) {
    throw new Error("state_sync_main_reanchor_resume_requires_reanchor_delta");
  }
  const headClaim = await claimAtRef(cwd, "HEAD");
  if (!claimIsMainPushed(headClaim)) {
    throw new Error("state_sync_main_reanchor_resume_requires_reanchored_claim");
  }
  const expectedReanchor = await buildStateSyncReanchorClaim(cwd, {
    claim: parentClaim,
    branch: "main",
    targetRef: input.remoteHeadBefore
  });
  if (!isDeepStrictEqual(headClaim, expectedReanchor.claim)) {
    throw new Error("state_sync_main_reanchor_resume_claim_mismatch");
  }

  if (input.validate) {
    await runValidation(
      ["diff", "--check", input.remoteHeadBefore, "HEAD"],
      cwd,
      "git diff --check origin/main..HEAD",
      input.validations,
      input.validationRunner
    );
    await runNodeScript(
      "scripts/sync-state-sync-display.ts",
      ["--check"],
      cwd,
      "node --import tsx scripts/sync-state-sync-display.ts --check",
      input.validations,
      input.validationRunner
    );
    await runNodeScript(
      "scripts/verify-state-sync-reanchor-diff.ts",
      ["--range", `refs/remotes/${input.remote}/main..HEAD`],
      cwd,
      `node --import tsx scripts/verify-state-sync-reanchor-diff.ts --range ${input.remote}/main..HEAD`,
      input.validations,
      input.validationRunner
    );
  }

  if (input.beforePush !== undefined) {
    await input.beforePush();
  }
  await fetchRemoteMain(cwd, input.remote);
  const remoteHeadAtPush = await remoteMainHead(cwd, input.remote);
  if (remoteHeadAtPush !== input.remoteHeadBefore) {
    throw new Error("state_sync_main_reanchor_origin_main_moved");
  }
  const divergenceAtPush = await gitTrim(
    [
      "rev-list",
      "--left-right",
      "--count",
      `HEAD...refs/remotes/${input.remote}/main`
    ],
    cwd
  );
  if (divergenceAtPush !== "1\t0") {
    throw new Error(`state_sync_main_reanchor_unexpected_divergence:${divergenceAtPush}`);
  }

  await git(["push", input.remote, "HEAD:main"], cwd);
  await fetchRemoteMain(cwd, input.remote);
  if (input.validate) {
    await runNodeScript(
      "scripts/run-state-sync-audit.ts",
      ["--json"],
      cwd,
      "node --import tsx scripts/run-state-sync-audit.ts --json after push",
      input.validations,
      input.validationRunner
    );
  }

  return {
    mode: "push",
    reanchorNeeded: true,
    branch: input.branch,
    baseHead: input.baseHead,
    remoteHeadBefore: input.remoteHeadBefore,
    committedHead: input.baseHead,
    pushedHead: await remoteMainHead(cwd, input.remote),
    changedPaths: rangeVerification.changedPaths,
    validations: input.validations
  };
}

async function claimAtRef(cwd: string, ref: string): Promise<StateSyncClaim> {
  const text = await git(["show", `${ref}:${STATE_SYNC_RECORD_DOC}`], cwd);
  const parsed = parseStateSyncClaim(text);
  if (parsed.status !== "valid") {
    throw new Error(
      `state_sync_main_reanchor_resume_invalid_claim:${ref}:${parsed.status}`
    );
  }

  return parsed.claim;
}

function claimIsMainPushed(claim: StateSyncClaim): boolean {
  return claim.subject.branch === "main"
    && claim.subject.upstream === "refs/remotes/origin/main"
    && claim.transition.kind === "state_only_pushed";
}

function hasExpectedReanchorDelta(changedPaths: string[]): boolean {
  if (changedPaths.length !== STATE_SYNC_REANCHOR_ALLOWED_PATHS.length) {
    return false;
  }

  const changed = new Set(changedPaths);
  return STATE_SYNC_REANCHOR_ALLOWED_PATHS.every((filePath) => changed.has(filePath));
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
  validations: string[],
  validationRunner?: (command: RunStateSyncMainReanchorValidationCommand) => Promise<void>
): Promise<void> {
  if (validationRunner !== undefined) {
    await validationRunner({
      type: "node",
      label,
      args: ["--import", "tsx", scriptPath, ...args],
      cwd
    });
    validations.push(label);
    return;
  }

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
  validations: string[],
  validationRunner?: (command: RunStateSyncMainReanchorValidationCommand) => Promise<void>
): Promise<void> {
  if (validationRunner !== undefined) {
    await validationRunner({
      type: "git",
      label,
      args,
      cwd
    });
    validations.push(label);
    return;
  }

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
