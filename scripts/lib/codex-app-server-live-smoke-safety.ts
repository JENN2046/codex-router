import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { open, lstat, readFile, readdir, realpath } from "node:fs/promises";
import { basename, isAbsolute, relative, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const SAFE_WIRE_METHODS = new Set([
  "account/chatgptAuthTokens/refresh", "attestation/generate", "currentTime/read",
  "error", "initialize", "initialized", "item/agentMessage/delta",
  "item/autoApprovalReview/completed", "item/autoApprovalReview/started",
  "item/commandExecution/outputDelta", "item/commandExecution/requestApproval",
  "item/commandExecution/terminalInteraction", "item/completed",
  "item/fileChange/outputDelta", "item/fileChange/patchUpdated",
  "item/fileChange/requestApproval", "item/mcpToolCall/progress",
  "item/permissions/requestApproval", "item/plan/delta",
  "item/reasoning/summaryPartAdded", "item/reasoning/summaryTextDelta",
  "item/reasoning/textDelta", "item/started", "item/tool/call",
  "item/tool/requestUserInput", "mcpServer/elicitation/request",
  "mcpServer/startupStatus/updated", "model/rerouted",
  "model/safetyBuffering/updated", "model/verification", "openai/form",
  "remoteControl/status/changed", "serverRequest/resolved", "thread/closed",
  "thread/compacted", "thread/settings/updated", "thread/start",
  "thread/started", "thread/status/changed", "thread/tokenUsage/updated",
  "turn/completed", "turn/diff/updated", "turn/moderationMetadata",
  "turn/plan/updated", "turn/start", "turn/started", "warning"
]);
const SAFE_DECISIONS = new Set([
  "accept", "acceptForSession", "acceptWithExecpolicyAmendment",
  "applyNetworkPolicyAmendment", "cancel", "decline"
]);

export const APP_SERVER_FILE_CHANGE_INTERCEPTION_PROVEN = false;

export interface SanitizedWireTranscriptEntry {
  schemaVersion: "codex-app-server-sanitized-wire-entry.v1";
  sequence: number;
  observedAt: string;
  direction: "inbound" | "outbound";
  envelope: "notification" | "request" | "response" | "invalid";
  method?: string;
  methodHash?: string;
  requestIdHash?: string;
  correlationHashes: Record<string, string>;
  approvalDecision?: string;
  permissionGrantEmpty?: boolean;
  payloadShapeHash: string;
  stringCodeUnits: number;
  redactedScalarCount: number;
}

interface ShapeSummary {
  shape: unknown;
  stringCodeUnits: number;
  redactedScalarCount: number;
}

export interface SanitizedWireTranscriptHandle {
  appendFile(data: string, encoding: "utf8"): Promise<unknown>;
  sync(): Promise<unknown>;
  close(): Promise<unknown>;
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function summarizeShape(value: unknown): ShapeSummary {
  let stringCodeUnits = 0;
  let redactedScalarCount = 0;
  let values = 0;
  const seen = new Set<object>();
  const visit = (candidate: unknown, depth: number): unknown => {
    values += 1;
    if (values > 50_000 || depth > 64) throw new Error("wire_transcript_shape_limit_exceeded");
    if (candidate === null) return "null";
    if (typeof candidate === "string") {
      stringCodeUnits += candidate.length;
      redactedScalarCount += 1;
      return "string";
    }
    if (typeof candidate === "number") {
      if (!Number.isFinite(candidate)) throw new Error("wire_transcript_non_json_value");
      redactedScalarCount += 1;
      return "number";
    }
    if (typeof candidate === "boolean") {
      redactedScalarCount += 1;
      return "boolean";
    }
    if (Array.isArray(candidate)) {
      if (seen.has(candidate)) throw new Error("wire_transcript_cycle");
      seen.add(candidate);
      const result = candidate.map((entry) => visit(entry, depth + 1));
      seen.delete(candidate);
      return result;
    }
    if (isRecord(candidate)) {
      if (seen.has(candidate)) throw new Error("wire_transcript_cycle");
      seen.add(candidate);
      const result: Record<string, unknown> = {};
      for (const key of Object.keys(candidate).sort()) {
        const descriptor = Object.getOwnPropertyDescriptor(candidate, key);
        if (descriptor?.get !== undefined || descriptor?.set !== undefined) {
          throw new Error("wire_transcript_accessor_forbidden");
        }
        stringCodeUnits += key.length;
        result[sha256(key).slice(0, 16)] = visit(candidate[key], depth + 1);
      }
      seen.delete(candidate);
      return result;
    }
    throw new Error("wire_transcript_non_json_value");
  };
  return { shape: visit(value, 0), stringCodeUnits, redactedScalarCount };
}

function hashScalar(value: unknown): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  return sha256(String(value));
}

function correlationHashes(message: Record<string, unknown>): Record<string, string> {
  const params = isRecord(message.params) ? message.params : undefined;
  const item = params !== undefined && isRecord(params.item) ? params.item : undefined;
  const output: Record<string, string> = {};
  for (const [name, value] of [
    ["threadId", params?.threadId],
    ["turnId", params?.turnId],
    ["itemId", params?.itemId ?? item?.id]
  ] as const) {
    const hashed = hashScalar(value);
    if (hashed !== undefined) output[name] = hashed;
  }
  return output;
}

export function sanitizeWireTranscriptEntry(input: {
  sequence: number;
  observedAt: string;
  direction: "inbound" | "outbound";
  message: unknown;
}): SanitizedWireTranscriptEntry {
  const summary = summarizeShape(input.message);
  const message = isRecord(input.message) ? input.message : undefined;
  const rawMethod = typeof message?.method === "string" ? message.method : undefined;
  const method = rawMethod !== undefined && SAFE_WIRE_METHODS.has(rawMethod)
    ? rawMethod
    : undefined;
  const methodHash = rawMethod === undefined ? undefined : sha256(rawMethod);
  const idHash = message === undefined ? undefined : hashScalar(message.id);
  const hasResult = message !== undefined && Object.hasOwn(message, "result");
  const hasError = message !== undefined && Object.hasOwn(message, "error");
  const envelope = message === undefined
    ? "invalid"
    : rawMethod !== undefined && idHash !== undefined
      ? "request"
      : rawMethod !== undefined
        ? "notification"
        : idHash !== undefined && (hasResult || hasError)
          ? "response"
          : "invalid";
  const result = message !== undefined && isRecord(message.result) ? message.result : undefined;
  const decision = typeof result?.decision === "string" && SAFE_DECISIONS.has(result.decision)
    ? result.decision
    : undefined;
  const permissionGrantEmpty = result !== undefined
    && isRecord(result.permissions)
    && Object.keys(result.permissions).length === 0;
  return {
    schemaVersion: "codex-app-server-sanitized-wire-entry.v1",
    sequence: input.sequence,
    observedAt: input.observedAt,
    direction: input.direction,
    envelope,
    ...(method === undefined ? {} : { method }),
    ...(methodHash === undefined ? {} : { methodHash }),
    ...(idHash === undefined ? {} : { requestIdHash: idHash }),
    correlationHashes: message === undefined ? {} : correlationHashes(message),
    ...(decision === undefined ? {} : { approvalDecision: decision }),
    ...(permissionGrantEmpty ? { permissionGrantEmpty: true } : {}),
    payloadShapeHash: sha256(JSON.stringify(summary.shape)),
    stringCodeUnits: summary.stringCodeUnits,
    redactedScalarCount: summary.redactedScalarCount
  };
}

export class SanitizedWireTranscriptRecorder {
  private sequence = 0;
  private closed = false;
  private pending: Promise<void> = Promise.resolve();
  private persistenceFailed = false;
  private persistenceFailure: unknown;
  private constructor(
    private readonly handle: SanitizedWireTranscriptHandle,
    private readonly clock: () => Date
  ) {}

  static async create(path: string, clock: () => Date = () => new Date()): Promise<SanitizedWireTranscriptRecorder> {
    if (!isAbsolute(path)) throw new Error("wire_transcript_path_must_be_absolute");
    return new SanitizedWireTranscriptRecorder(await open(path, "wx", 0o600), clock);
  }

  static createTestOnly(
    handle: SanitizedWireTranscriptHandle,
    clock: () => Date = () => new Date()
  ): SanitizedWireTranscriptRecorder {
    return new SanitizedWireTranscriptRecorder(handle, clock);
  }

  async record(direction: "inbound" | "outbound", message: unknown): Promise<SanitizedWireTranscriptEntry> {
    if (this.closed) throw new Error("wire_transcript_closed");
    const entry = sanitizeWireTranscriptEntry({
      sequence: ++this.sequence,
      observedAt: this.clock().toISOString(),
      direction,
      message
    });
    const operation = this.pending.then(async () => {
      if (this.persistenceFailed) throw this.persistenceFailure;
      try {
        await this.handle.appendFile(`${JSON.stringify(entry)}\n`, "utf8");
        await this.handle.sync();
      } catch (error) {
        this.persistenceFailed = true;
        this.persistenceFailure = error;
        throw error;
      }
    });
    this.pending = operation.then(
      () => undefined,
      () => undefined
    );
    await operation;
    return entry;
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    try {
      await this.pending;
      if (this.persistenceFailed) throw this.persistenceFailure;
      await this.handle.sync();
    } finally {
      await this.handle.close();
    }
  }
}

export interface AppServerWireTranscriptSink {
  record(
    direction: "inbound" | "outbound",
    message: unknown
  ): Promise<SanitizedWireTranscriptEntry>;
}

export class RecordedAppServerWireBoundary {
  constructor(private readonly transcript: AppServerWireTranscriptSink) {}

  async ingest<T>(message: unknown, normalize: (message: unknown) => Promise<T> | T): Promise<T> {
    await this.transcript.record("inbound", message);
    return normalize(message);
  }

  async send<T>(message: unknown, transportSend: (message: unknown) => Promise<T> | T): Promise<T> {
    await this.transcript.record("outbound", message);
    return transportSend(message);
  }
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
  await input.disconnect();
  return waitForAppServerSmokeQuiescence(input);
}

export function assertAppServerFileChangeInterceptionProven(): never {
  throw new Error("app_server_file_change_interception_unproven");
}
