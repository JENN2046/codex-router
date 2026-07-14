import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import { basename, isAbsolute, relative, resolve } from "node:path";
import { promisify } from "node:util";

export * from "./codex-app-server-wire-transcript.js";
export * from "./codex-app-server-offline-interception-harness.js";

export const APP_SERVER_FILE_CHANGE_INTERCEPTION_PROVEN = false;

export type AppServerFileChangeSmokeSandboxPolicy =
  | "read-only"
  | "workspace-write"
  | "danger-full-access";

export type AppServerFileChangeSmokeApprovalPolicy =
  | "untrusted"
  | "on-request"
  | "never";

export type AppServerFileChangeProposalMode =
  | "approval-request"
  | "deferred-patch"
  | "read-only-proposal";

export interface AppServerFileChangeInterceptionPlan {
  sandboxPolicy: AppServerFileChangeSmokeSandboxPolicy;
  approvalPolicy: AppServerFileChangeSmokeApprovalPolicy;
  proposalMode: AppServerFileChangeProposalMode;
}

export interface AppServerFileChangeInterceptionPreflight {
  schemaVersion: "app-server-file-change-interception-preflight.v1";
  status: "blocked";
  reason: string;
  connectionAllowed: false;
  interceptionProven: false;
  plan: AppServerFileChangeInterceptionPlan | null;
}

const APP_SERVER_FILE_CHANGE_SMOKE_SANDBOX_POLICIES = new Set<string>([
  "read-only",
  "workspace-write",
  "danger-full-access"
]);

const APP_SERVER_FILE_CHANGE_SMOKE_APPROVAL_POLICIES = new Set<string>([
  "untrusted",
  "on-request",
  "never"
]);

const APP_SERVER_FILE_CHANGE_PROPOSAL_MODES = new Set<string>([
  "approval-request",
  "deferred-patch",
  "read-only-proposal"
]);

function parseAppServerFileChangeInterceptionPlan(
  input: unknown
): AppServerFileChangeInterceptionPlan | undefined {
  try {
    if (!isRecord(input) || Object.getPrototypeOf(input) !== Object.prototype) return undefined;
    const expectedKeys = ["approvalPolicy", "proposalMode", "sandboxPolicy"];
    const ownKeys = Reflect.ownKeys(input);
    if (
      ownKeys.length !== expectedKeys.length
      || ownKeys.some((key) => typeof key !== "string" || !expectedKeys.includes(key))
    ) return undefined;
    const descriptors = Object.getOwnPropertyDescriptors(input);
    for (const key of expectedKeys) {
      const descriptor = descriptors[key];
      if (descriptor === undefined || !("value" in descriptor) || typeof descriptor.value !== "string") {
        return undefined;
      }
    }
    const sandboxPolicy = descriptors.sandboxPolicy?.value as string;
    const approvalPolicy = descriptors.approvalPolicy?.value as string;
    const proposalMode = descriptors.proposalMode?.value as string;
    if (
      !APP_SERVER_FILE_CHANGE_SMOKE_SANDBOX_POLICIES.has(sandboxPolicy)
      || !APP_SERVER_FILE_CHANGE_SMOKE_APPROVAL_POLICIES.has(approvalPolicy)
      || !APP_SERVER_FILE_CHANGE_PROPOSAL_MODES.has(proposalMode)
    ) return undefined;
    return Object.freeze({
      sandboxPolicy,
      approvalPolicy,
      proposalMode
    }) as AppServerFileChangeInterceptionPlan;
  } catch {
    return undefined;
  }
}

export function evaluateAppServerFileChangeInterceptionPreflight(
  input: unknown
): AppServerFileChangeInterceptionPreflight {
  const blocked = (
    reason: string,
    plan: AppServerFileChangeInterceptionPlan | null
  ): AppServerFileChangeInterceptionPreflight => ({
    schemaVersion: "app-server-file-change-interception-preflight.v1",
    status: "blocked",
    reason,
    connectionAllowed: false,
    interceptionProven: false,
    plan
  });
  const plan = parseAppServerFileChangeInterceptionPlan(input);
  if (plan === undefined) {
    return blocked("app_server_file_change_preflight_configuration_invalid", null);
  }
  if (plan.sandboxPolicy === "workspace-write" && plan.approvalPolicy === "on-request") {
    return blocked("workspace_write_on_request_cannot_prove_file_change_interception", plan);
  }
  if (plan.proposalMode === "approval-request") {
    return blocked("app_server_pre_apply_proposal_mechanism_required", plan);
  }
  if (plan.proposalMode === "read-only-proposal" && plan.sandboxPolicy !== "read-only") {
    return blocked("app_server_read_only_proposal_requires_read_only_sandbox", plan);
  }
  return blocked("app_server_file_change_interception_unproven", plan);
}

export function assertAppServerFileChangeInterceptionPreConnection(
  input: unknown
): never {
  const preflight = evaluateAppServerFileChangeInterceptionPreflight(input);
  throw new Error(preflight.reason);
}

const execFileAsync = promisify(execFile);

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function createAppServerSmokeProcessEnv(tempRoot: string): NodeJS.ProcessEnv {
  if (!isAbsolute(tempRoot)) throw new Error("live_smoke_environment_root_must_be_absolute");
  const env: NodeJS.ProcessEnv = {
    CI: "true",
    GIT_ATTR_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_NO_LAZY_FETCH: "1",
    GIT_OPTIONAL_LOCKS: "0",
    GIT_TERMINAL_PROMPT: "0",
    HOME: tempRoot,
    TMP: tempRoot,
    TEMP: tempRoot,
    TMPDIR: tempRoot
  };
  for (const key of ["PATH", "SystemRoot", "COMSPEC", "PATHEXT", "WINDIR"] as const) {
    const value = process.env[key];
    if (value !== undefined) env[key] = value;
  }
  return env;
}

async function git(cwd: string, args: string[], env: NodeJS.ProcessEnv): Promise<string> {
  const result = await execFileAsync("git", args, {
    cwd,
    encoding: "utf8",
    env,
    maxBuffer: 4 * 1024 * 1024
  });
  return result.stdout;
}

async function gitFilterInventory(cwd: string, env: NodeJS.ProcessEnv): Promise<string> {
  try {
    return await git(cwd, ["config", "--get-regexp", "^filter\\."], env);
  } catch (error) {
    if (isRecord(error) && error.code === 1) return "";
    throw new Error("live_smoke_git_filter_inventory_failed", { cause: error });
  }
}

function assertSafeRelativePath(path: string): void {
  if (path === "" || path.includes("\\") || path.startsWith("/") || path.split("/").includes("..")) {
    throw new Error("live_smoke_target_path_unsafe");
  }
}

export async function createIndependentAppServerSmokeClone(input: {
  sourceRepo: string;
  destinationRepo: string;
  expectedHead: string;
  targetPaths: string[];
}): Promise<{ repoRoot: string; head: string; appServerEnv: NodeJS.ProcessEnv }> {
  if (!/^[a-f0-9]{40,64}$/u.test(input.expectedHead)) throw new Error("live_smoke_expected_head_invalid");
  if (!isAbsolute(input.sourceRepo) || !isAbsolute(input.destinationRepo)) {
    throw new Error("live_smoke_clone_paths_must_be_absolute");
  }
  for (const path of input.targetPaths) assertSafeRelativePath(path);
  const sourceTopology = await lstat(resolve(input.sourceRepo));
  if (!sourceTopology.isDirectory() || sourceTopology.isSymbolicLink()) {
    throw new Error("live_smoke_source_topology_unsafe");
  }
  const sourceRoot = await realpath(input.sourceRepo);
  const tempRoot = await realpath(resolve(input.destinationRepo, ".."));
  const destinationRoot = resolve(tempRoot, basename(input.destinationRepo));
  try {
    await lstat(destinationRoot);
    throw new Error("live_smoke_destination_exists");
  } catch (error) {
    if (error instanceof Error && error.message === "live_smoke_destination_exists") throw error;
    if (!(isRecord(error) && error.code === "ENOENT")) throw error;
  }
  const appServerEnv = createAppServerSmokeProcessEnv(tempRoot);
  if ((await git(sourceRoot, ["status", "--porcelain=v1", "-z", "--untracked-files=all"], appServerEnv)) !== "") {
    throw new Error("live_smoke_source_dirty");
  }
  if ((await git(sourceRoot, ["rev-parse", "HEAD"], appServerEnv)).trim() !== input.expectedHead) {
    throw new Error("live_smoke_source_head_mismatch");
  }
  const trackedPaths = (await git(sourceRoot, ["ls-tree", "-r", "--name-only", input.expectedHead], appServerEnv))
    .split("\n").filter(Boolean);
  if (trackedPaths.some((path) => path === ".gitattributes" || path.endsWith("/.gitattributes"))) {
    throw new Error("live_smoke_git_attributes_forbidden");
  }
  if ((await gitFilterInventory(sourceRoot, appServerEnv)) !== "") {
    throw new Error("live_smoke_git_filters_forbidden");
  }
  await execFileAsync("git", [
    "clone", "--no-local", "--no-hardlinks", "--no-checkout", "--",
    sourceRoot, destinationRoot
  ], {
    cwd: tempRoot,
    encoding: "utf8",
    env: appServerEnv,
    maxBuffer: 4 * 1024 * 1024
  });
  await git(destinationRoot, ["remote", "remove", "origin"], appServerEnv);
  if ((await gitFilterInventory(destinationRoot, appServerEnv)) !== "") {
    throw new Error("live_smoke_git_filters_forbidden");
  }
  await git(destinationRoot, ["checkout", "--detach", input.expectedHead, "--"], appServerEnv);
  if ((await git(destinationRoot, ["remote"], appServerEnv)) !== "") throw new Error("live_smoke_clone_remote_present");
  try {
    await lstat(resolve(destinationRoot, ".git/objects/info/alternates"));
    throw new Error("live_smoke_clone_alternates_present");
  } catch (error) {
    if (error instanceof Error && error.message === "live_smoke_clone_alternates_present") throw error;
    if (!(isRecord(error) && error.code === "ENOENT")) throw error;
  }
  if ((await git(destinationRoot, ["status", "--porcelain=v1", "-z", "--untracked-files=all"], appServerEnv)) !== "") {
    throw new Error("live_smoke_clone_dirty");
  }
  return {
    repoRoot: await realpath(destinationRoot),
    head: input.expectedHead,
    appServerEnv: { ...appServerEnv }
  };
}

export interface WorkspaceSnapshot {
  head: string;
  statusHash: string;
  statusEmpty: boolean;
  targetHashes: Record<string, string>;
  workspaceMetadataHash: string;
}

async function hashWorkspaceMetadata(root: string): Promise<string> {
  const records: string[][] = [];
  const visit = async (relativePath: string): Promise<void> => {
    const absolute = relativePath === "" ? root : resolve(root, relativePath);
    const topology = await lstat(absolute, { bigint: true });
    records.push([
      relativePath,
      topology.isDirectory() ? "directory"
        : topology.isFile() ? "file"
          : topology.isSymbolicLink() ? "symlink"
            : "other",
      topology.dev.toString(),
      topology.ino.toString(),
      topology.mode.toString(),
      topology.nlink.toString(),
      topology.size.toString(),
      topology.mtimeNs.toString(),
      topology.ctimeNs.toString()
    ]);
    if (!topology.isDirectory() || topology.isSymbolicLink()) return;
    const children = await readdir(absolute);
    children.sort((left, right) => Buffer.from(left).compare(Buffer.from(right)));
    for (const child of children) {
      await visit(relativePath === "" ? child : `${relativePath}/${child}`);
    }
  };
  await visit("");
  return sha256(JSON.stringify(records));
}

export async function captureAppServerSmokeWorkspace(repoRoot: string, targetPaths: string[]): Promise<WorkspaceSnapshot> {
  const root = await realpath(repoRoot);
  const gitEnv = createAppServerSmokeProcessEnv(resolve(root, ".."));
  const status = await git(root, ["status", "--porcelain=v1", "-z", "--untracked-files=all"], gitEnv);
  const targetHashes: Record<string, string> = {};
  for (const path of targetPaths) {
    assertSafeRelativePath(path);
    const absolute = resolve(root, path);
    const pathFromRoot = relative(root, absolute);
    if (pathFromRoot.startsWith("..") || isAbsolute(pathFromRoot)) throw new Error("live_smoke_target_escape");
    const topology = await lstat(absolute);
    if (!topology.isFile() || topology.isSymbolicLink() || topology.nlink !== 1) {
      throw new Error("live_smoke_target_topology_unsafe");
    }
    targetHashes[path] = sha256(await readFile(absolute));
  }
  return {
    head: (await git(root, ["rev-parse", "HEAD"], gitEnv)).trim(),
    statusHash: sha256(status),
    statusEmpty: status === "",
    targetHashes,
    workspaceMetadataHash: await hashWorkspaceMetadata(root)
  };
}

function snapshotsEqual(left: WorkspaceSnapshot, right: WorkspaceSnapshot): boolean {
  const orderedHashes = (hashes: Record<string, string>) => Object.keys(hashes)
    .sort()
    .map((path) => [path, hashes[path]]);
  return left.head === right.head
    && left.statusHash === right.statusHash
    && left.statusEmpty === right.statusEmpty
    && left.workspaceMetadataHash === right.workspaceMetadataHash
    && JSON.stringify(orderedHashes(left.targetHashes)) === JSON.stringify(orderedHashes(right.targetHashes));
}

export async function waitForAppServerSmokeQuiescence(input: {
  repoRoot: string;
  targetPaths: string[];
  expectedHead: string;
  expectedTargetHashes: Record<string, string>;
  expectedWorkspaceMetadataHash: string;
  quietPeriodMs: number;
  timeoutMs: number;
  sampleIntervalMs?: number;
  capture?: () => Promise<WorkspaceSnapshot>;
  sleep?: (milliseconds: number) => Promise<void>;
}): Promise<{
  status: "unchanged" | "blocked";
  reason?: string;
  samples: number;
  mutationObserved: boolean;
  finalSnapshot: WorkspaceSnapshot;
}> {
  if (input.quietPeriodMs <= 0 || input.timeoutMs < input.quietPeriodMs) {
    throw new Error("live_smoke_quiescence_window_invalid");
  }
  const sampleIntervalMs = input.sampleIntervalMs ?? 100;
  if (sampleIntervalMs <= 0) throw new Error("live_smoke_sample_interval_invalid");
  const capture = input.capture ?? (() => captureAppServerSmokeWorkspace(input.repoRoot, input.targetPaths));
  const sleep = input.sleep ?? ((milliseconds: number) => new Promise<void>((resolveSleep) => setTimeout(resolveSleep, milliseconds)));
  const expected: WorkspaceSnapshot = {
    head: input.expectedHead,
    statusHash: sha256(""),
    statusEmpty: true,
    targetHashes: input.expectedTargetHashes,
    workspaceMetadataHash: input.expectedWorkspaceMetadataHash
  };
  let previous = await capture();
  let samples = 1;
  let mutationObserved = !snapshotsEqual(previous, expected);
  let stableFor = 0;
  let elapsed = 0;
  while (stableFor < input.quietPeriodMs && elapsed < input.timeoutMs) {
    const delay = Math.min(sampleIntervalMs, input.timeoutMs - elapsed);
    await sleep(delay);
    elapsed += delay;
    const current = await capture();
    samples += 1;
    stableFor = snapshotsEqual(current, previous) ? stableFor + delay : 0;
    if (!snapshotsEqual(current, expected)) mutationObserved = true;
    previous = current;
  }
  if (stableFor < input.quietPeriodMs) {
    return { status: "blocked", reason: "live_smoke_quiescence_timeout", samples, mutationObserved, finalSnapshot: previous };
  }
  if (mutationObserved || !snapshotsEqual(previous, expected)) {
    return { status: "blocked", reason: "live_smoke_workspace_mutation_observed", samples, mutationObserved, finalSnapshot: previous };
  }
  return { status: "unchanged", samples, mutationObserved: false, finalSnapshot: previous };
}

export async function disconnectAndWaitForAppServerSmokeQuiescence(input: {
  disconnect: () => Promise<void>;
  repoRoot: string;
  targetPaths: string[];
  expectedHead: string;
  expectedTargetHashes: Record<string, string>;
  expectedWorkspaceMetadataHash: string;
  quietPeriodMs: number;
  timeoutMs: number;
  sampleIntervalMs?: number;
  capture?: () => Promise<WorkspaceSnapshot>;
  sleep?: (milliseconds: number) => Promise<void>;
}): ReturnType<typeof waitForAppServerSmokeQuiescence> {
  let disconnectFailed = false;
  try {
    await input.disconnect();
  } catch {
    disconnectFailed = true;
  }
  const quiescence = await waitForAppServerSmokeQuiescence(input);
  if (!disconnectFailed) return quiescence;
  return {
    ...quiescence,
    status: "blocked",
    reason: "live_smoke_disconnect_failed"
  };
}

export function assertAppServerFileChangeInterceptionProven(): never {
  throw new Error("app_server_file_change_interception_unproven");
}
