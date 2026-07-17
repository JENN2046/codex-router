#!/usr/bin/env node

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import {
  access,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile
} from "node:fs/promises";
import { delimiter, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const FIXTURE_PREFIX = ".test-clean-build-determinism-";
const REMOVED_SOURCE_PACKAGE = "r3b-clean-build-removed-fixture";
const REPOSITORY_ENTRIES = [
  "packages",
  "scripts",
  "tests",
  "package.json",
  "tsconfig.json",
  "README.md",
  "README.AGENTS_OS.md"
] as const;
const AUDIT_STAGES = ["copy", "build", "pack", "manifest", "cleanup"] as const;
const FILESYSTEM_CODE_VALUES = [
  "EACCES",
  "EBUSY",
  "EEXIST",
  "EIO",
  "ENOENT",
  "ENOSPC",
  "ENOTDIR",
  "EPERM",
  "ETIMEDOUT"
] as const;
const FILESYSTEM_CODES = new Set<string>(FILESYSTEM_CODE_VALUES);
const SIGNAL_CATEGORY_VALUES = [
  "SIGABRT",
  "SIGBUS",
  "SIGFPE",
  "SIGHUP",
  "SIGILL",
  "SIGINT",
  "SIGKILL",
  "SIGPIPE",
  "SIGQUIT",
  "SIGSEGV",
  "SIGTERM",
  "SIGTRAP"
] as const;
const SIGNAL_CATEGORIES = new Set<string>(SIGNAL_CATEGORY_VALUES);
const SAFE_REASON_VALUES = [
  "clean_build_diagnostic_stage_invalid",
  "clean_build_dist_manifest_mismatch",
  "clean_build_manifest_non_file_entry",
  "clean_build_npm_execpath_missing",
  "clean_build_outdir_mismatch",
  "clean_build_outdir_missing",
  "clean_build_outdir_not_directory",
  "clean_build_outdir_symlink_rejected",
  "clean_build_pack_file_invalid",
  "clean_build_pack_file_list_mismatch",
  "clean_build_pack_file_size_mismatch",
  "clean_build_pack_files_missing",
  "clean_build_pack_json_invalid",
  "clean_build_pack_path_escape",
  "clean_build_pack_path_invalid",
  "clean_build_pack_result_invalid",
  "clean_build_pack_tarball_unexpected",
  "clean_build_package_json_invalid",
  "clean_build_removed_source_output_not_emitted",
  "clean_build_repository_identity_mismatch",
  "clean_build_stale_output_remained",
  "clean_build_tsconfig_invalid",
  "clean_build_unknown_error"
] as const;
const SAFE_REASONS = new Set<string>(SAFE_REASON_VALUES);
const MANIFEST_MISMATCH_REASONS = new Set([
  "clean_build_dist_manifest_mismatch",
  "clean_build_pack_file_list_mismatch"
]);
const STAGED_AUDIT_FAILURE = Symbol("staged-audit-failure");

export type CleanBuildAuditStage = typeof AUDIT_STAGES[number];
export type CleanBuildFilesystemCode = typeof FILESYSTEM_CODE_VALUES[number];
export type CleanBuildSignalCategory =
  | typeof SIGNAL_CATEGORY_VALUES[number]
  | "other_signal";
export type CleanBuildDiagnosticCategory =
  | "child_process_exit"
  | "filesystem_error"
  | "json_parse_error"
  | "manifest_mismatch"
  | "unknown_error";

export interface CleanBuildDiagnostic {
  stage: CleanBuildAuditStage;
  category: CleanBuildDiagnosticCategory;
  reason: string;
  exitCodeCategory?: "zero" | "nonzero";
  signalCategory?: CleanBuildSignalCategory;
  filesystemCode?: CleanBuildFilesystemCode;
}

interface StagedAuditFailure {
  [STAGED_AUDIT_FAILURE]: true;
  diagnostic: CleanBuildDiagnostic;
}

interface FileManifestEntry {
  path: string;
  size: number;
  sha256: string;
}

interface ArtifactSnapshot {
  distFiles: FileManifestEntry[];
  distDigest: string;
  packFiles: FileManifestEntry[];
  packFileListDigest: string;
}

interface NpmPackFile {
  path?: unknown;
  size?: unknown;
}

interface NpmPackResult {
  files?: unknown;
}

export interface CleanBuildDeterminismAuditResult {
  status: "passed" | "failed";
  scope: "clean_build_determinism_only";
  checks: {
    removedSourceOutputInitiallyEmitted: boolean;
    staleOutputRemovedBeforeRebuild: boolean;
    dirtyAndEmptyDistFilesMatch: boolean;
    dirtyAndEmptyPackFileListsMatch: boolean;
  };
  summary: {
    dirtyBuildDistFileCount: number;
    emptyBuildDistFileCount: number;
    dirtyBuildPackFileCount: number;
    emptyBuildPackFileCount: number;
    distDigest: string;
    packFileListDigest: string;
    coreOnlyArtifactProven: false;
    artifactAllowlistChanged: false;
    runtimeSurfaceChanged: false;
  };
  reasons: string[];
  diagnostics: CleanBuildDiagnostic[];
}

export interface CleanBuildDeterminismAuditOptions {
  keepFixture?: boolean;
}

export async function runCleanBuildDeterminismAudit(
  repositoryRoot = process.cwd(),
  options: CleanBuildDeterminismAuditOptions = {}
): Promise<CleanBuildDeterminismAuditResult> {
  const root = resolve(repositoryRoot);
  const checks: CleanBuildDeterminismAuditResult["checks"] = {
    removedSourceOutputInitiallyEmitted: false,
    staleOutputRemovedBeforeRebuild: false,
    dirtyAndEmptyDistFilesMatch: false,
    dirtyAndEmptyPackFileListsMatch: false
  };
  const diagnostics: CleanBuildDiagnostic[] = [];
  let fixtureRoot: string | undefined;
  let dirtySnapshot: ArtifactSnapshot | undefined;
  let emptySnapshot: ArtifactSnapshot | undefined;

  try {
    fixtureRoot = await runAuditStage(
      "copy",
      () => mkdtemp(resolve(root, FIXTURE_PREFIX))
    );
    await runAuditStage(
      "copy",
      () => copyRepositoryFixture(root, fixtureRoot as string)
    );
    const removedSourceRoot = resolve(
      fixtureRoot,
      "packages",
      REMOVED_SOURCE_PACKAGE
    );
    const removedOutputRoot = resolve(
      fixtureRoot,
      "dist",
      "packages",
      REMOVED_SOURCE_PACKAGE
    );
    await runAuditStage("copy", async () => {
      await mkdir(resolve(removedSourceRoot, "src"), { recursive: true });
      await writeFile(
        resolve(removedSourceRoot, "src", "index.ts"),
        "export const removedBuildFixture = true;\n",
        "utf8"
      );
    });

    await runAuditStage(
      "build",
      () => runNpm(fixtureRoot as string, root, ["run", "build"])
    );
    checks.removedSourceOutputInitiallyEmitted = await runAuditStage(
      "manifest",
      () => pathExists(resolve(removedOutputRoot, "src", "index.js"))
    );
    if (!checks.removedSourceOutputInitiallyEmitted) {
      appendUniqueAuditDiagnostic(diagnostics, normalizeAuditDiagnostic(
        "manifest",
        new Error("clean_build_removed_source_output_not_emitted")
      ));
    }

    await runAuditStage(
      "cleanup",
      () => rm(removedSourceRoot, { recursive: true, force: true })
    );
    await runAuditStage(
      "build",
      () => runNpm(fixtureRoot as string, root, ["run", "build"])
    );
    checks.staleOutputRemovedBeforeRebuild = !(await runAuditStage(
      "manifest",
      () => pathExists(removedOutputRoot)
    ));
    if (!checks.staleOutputRemovedBeforeRebuild) {
      appendUniqueAuditDiagnostic(diagnostics, normalizeAuditDiagnostic(
        "manifest",
        new Error("clean_build_stale_output_remained")
      ));
    }
    dirtySnapshot = await captureArtifactSnapshot(fixtureRoot, root);

    await runAuditStage(
      "cleanup",
      () => rm(resolve(fixtureRoot as string, "dist"), {
        recursive: true,
        force: true
      })
    );
    await runAuditStage(
      "build",
      () => runNpm(fixtureRoot as string, root, ["run", "build"])
    );
    emptySnapshot = await captureArtifactSnapshot(fixtureRoot, root);

    checks.dirtyAndEmptyDistFilesMatch = manifestsEqual(
      dirtySnapshot.distFiles,
      emptySnapshot.distFiles
    );
    if (!checks.dirtyAndEmptyDistFilesMatch) {
      appendUniqueAuditDiagnostic(diagnostics, normalizeAuditDiagnostic(
        "manifest",
        new Error("clean_build_dist_manifest_mismatch")
      ));
    }

    checks.dirtyAndEmptyPackFileListsMatch = manifestsEqual(
      dirtySnapshot.packFiles,
      emptySnapshot.packFiles
    );
    if (!checks.dirtyAndEmptyPackFileListsMatch) {
      appendUniqueAuditDiagnostic(diagnostics, normalizeAuditDiagnostic(
        "manifest",
        new Error("clean_build_pack_file_list_mismatch")
      ));
    }
  } catch (error) {
    appendUniqueAuditDiagnostic(
      diagnostics,
      isStagedAuditFailure(error)
        ? error.diagnostic
        : normalizeAuditDiagnostic("manifest", error)
    );
  } finally {
    if (options.keepFixture !== true && fixtureRoot !== undefined) {
      try {
        await rm(fixtureRoot, { recursive: true, force: true });
      } catch (error) {
        appendUniqueAuditDiagnostic(
          diagnostics,
          normalizeAuditDiagnostic("cleanup", error)
        );
      }
    }
  }

  const reasons = [...new Set(diagnostics.map(({ reason }) => reason))].sort();

  return {
    status: reasons.length === 0 ? "passed" : "failed",
    scope: "clean_build_determinism_only",
    checks,
    summary: {
      dirtyBuildDistFileCount: dirtySnapshot?.distFiles.length ?? 0,
      emptyBuildDistFileCount: emptySnapshot?.distFiles.length ?? 0,
      dirtyBuildPackFileCount: dirtySnapshot?.packFiles.length ?? 0,
      emptyBuildPackFileCount: emptySnapshot?.packFiles.length ?? 0,
      distDigest: dirtySnapshot?.distDigest ?? "",
      packFileListDigest: dirtySnapshot?.packFileListDigest ?? "",
      coreOnlyArtifactProven: false,
      artifactAllowlistChanged: false,
      runtimeSurfaceChanged: false
    },
    reasons,
    diagnostics
  };
}

async function copyRepositoryFixture(
  repositoryRoot: string,
  fixtureRoot: string
): Promise<void> {
  for (const entry of REPOSITORY_ENTRIES) {
    await cp(resolve(repositoryRoot, entry), resolve(fixtureRoot, entry), {
      recursive: true,
      force: false,
      errorOnExist: true
    });
  }
}

async function captureArtifactSnapshot(
  fixtureRoot: string,
  repositoryRoot: string
): Promise<ArtifactSnapshot> {
  const distFiles = await runAuditStage(
    "manifest",
    () => collectFileManifest(resolve(fixtureRoot, "dist"))
  );
  const packFiles = await runAuditStage(
    "pack",
    () => collectPackFileManifest(fixtureRoot, repositoryRoot)
  );
  return runAuditStage("manifest", async () => ({
      distFiles,
      distDigest: digestManifest(distFiles),
      packFiles,
      packFileListDigest: digestFileList(packFiles)
    }));
}

async function collectFileManifest(root: string): Promise<FileManifestEntry[]> {
  const paths = await collectFiles(root, root);
  return Promise.all(paths.map(async (path) => {
    const content = await readFile(resolve(root, ...path.split("/")));
    return {
      path,
      size: content.byteLength,
      sha256: createHash("sha256").update(content).digest("hex")
    };
  }));
}

async function collectFiles(root: string, directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries.sort((left, right) => compareCodeUnits(left.name, right.name))) {
    const absolutePath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(root, absolutePath));
      continue;
    }
    if (!entry.isFile()) {
      throw new Error("clean_build_manifest_non_file_entry");
    }
    files.push(normalizeRelativePath(relative(root, absolutePath)));
  }
  return files.sort(compareCodeUnits);
}

async function collectPackFileManifest(
  fixtureRoot: string,
  repositoryRoot: string
): Promise<FileManifestEntry[]> {
  const output = await runNpm(fixtureRoot, repositoryRoot, [
    "pack",
    "--dry-run",
    "--ignore-scripts",
    "--json"
  ]);
  if ((await readdir(fixtureRoot)).some((entry) => entry.endsWith(".tgz"))) {
    throw new Error("clean_build_pack_tarball_unexpected");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(output);
  } catch {
    throw new Error("clean_build_pack_json_invalid");
  }
  if (!Array.isArray(parsed) || parsed.length !== 1 || !isRecord(parsed[0])) {
    throw new Error("clean_build_pack_result_invalid");
  }
  const packResult = parsed[0] as NpmPackResult;
  if (!Array.isArray(packResult.files)) {
    throw new Error("clean_build_pack_files_missing");
  }

  const entries: FileManifestEntry[] = [];
  for (const value of packResult.files) {
    if (!isRecord(value)) {
      throw new Error("clean_build_pack_file_invalid");
    }
    const file = value as NpmPackFile;
    if (typeof file.path !== "string" || typeof file.size !== "number") {
      throw new Error("clean_build_pack_file_invalid");
    }
    const path = normalizePackPath(file.path);
    const content = await readFile(resolveContainedPath(fixtureRoot, path));
    if (content.byteLength !== file.size) {
      throw new Error("clean_build_pack_file_size_mismatch");
    }
    entries.push({
      path,
      size: file.size,
      sha256: createHash("sha256").update(content).digest("hex")
    });
  }
  return entries.sort((left, right) => compareCodeUnits(left.path, right.path));
}

async function runNpm(
  cwd: string,
  repositoryRoot: string,
  argv: string[]
): Promise<string> {
  const invocation = resolveNpmInvocation(argv);
  const rootBin = resolve(repositoryRoot, "node_modules", ".bin");
  const path = process.env.PATH === undefined
    ? rootBin
    : `${rootBin}${delimiter}${process.env.PATH}`;
  const env: NodeJS.ProcessEnv = {
    PATH: path,
    npm_config_audit: "false",
    npm_config_cache: resolve(cwd, ".npm-cache"),
    npm_config_fund: "false",
    npm_config_update_notifier: "false"
  };
  for (const key of ["SystemRoot", "COMSPEC", "PATHEXT", "WINDIR"] as const) {
    const value = process.env[key];
    if (value !== undefined) {
      env[key] = value;
    }
  }
  const { stdout } = await execFileAsync(invocation.command, invocation.argv, {
    cwd,
    encoding: "utf8",
    windowsHide: true,
    env,
    maxBuffer: 40 * 1024 * 1024
  });
  return stdout;
}

export function resolveNpmInvocation(
  argv: string[],
  options: {
    platform?: NodeJS.Platform;
    npmExecPath?: string;
    nodeExecutable?: string;
  } = {}
): { command: string; argv: string[] } {
  const platform = options.platform ?? process.platform;
  if (platform !== "win32") {
    return { command: "npm", argv: [...argv] };
  }
  const npmExecPath = (options.npmExecPath ?? process.env.npm_execpath)?.trim();
  if (!npmExecPath) {
    throw new Error("clean_build_npm_execpath_missing");
  }
  return {
    command: options.nodeExecutable ?? process.execPath,
    argv: [npmExecPath, ...argv]
  };
}

function normalizePackPath(path: string): string {
  if (path === "" || path.includes("\\") || path.startsWith("/") || /^[A-Za-z]:/u.test(path)) {
    throw new Error("clean_build_pack_path_invalid");
  }
  const segments = path.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new Error("clean_build_pack_path_invalid");
  }
  return path;
}

function resolveContainedPath(root: string, path: string): string {
  const absolutePath = resolve(root, ...path.split("/"));
  const prefix = `${resolve(root)}${sep}`;
  if (!absolutePath.startsWith(prefix)) {
    throw new Error("clean_build_pack_path_escape");
  }
  return absolutePath;
}

function normalizeRelativePath(path: string): string {
  return path.split(sep).join("/");
}

function digestManifest(entries: FileManifestEntry[]): string {
  return createHash("sha256")
    .update(JSON.stringify(entries))
    .digest("hex");
}

function digestFileList(entries: FileManifestEntry[]): string {
  return createHash("sha256")
    .update(JSON.stringify(entries.map(({ path }) => path)))
    .digest("hex");
}

function manifestsEqual(
  left: FileManifestEntry[],
  right: FileManifestEntry[]
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export function normalizeAuditDiagnostic(
  stage: unknown,
  error: unknown
): CleanBuildDiagnostic {
  if (!isAuditStage(stage)) {
    throw new Error("clean_build_diagnostic_stage_invalid");
  }
  const safeReason = readSafeReason(error);
  if (safeReason !== undefined && MANIFEST_MISMATCH_REASONS.has(safeReason)) {
    return {
      stage,
      category: "manifest_mismatch",
      reason: safeReason
    };
  }
  if (
    error instanceof SyntaxError
    || safeReason === "clean_build_pack_json_invalid"
  ) {
    return {
      stage,
      category: "json_parse_error",
      reason: `clean_build_determinism_${stage}_json_parse_error`
    };
  }
  const record = isRecord(error) ? error : undefined;
  const code = record === undefined ? undefined : readDataProperty(record, "code");
  const signal = record === undefined
    ? undefined
    : readDataProperty(record, "signal");
  if (typeof code === "number" && Number.isInteger(code)) {
    const diagnostic: CleanBuildDiagnostic = {
      stage,
      category: "child_process_exit",
      reason: `clean_build_determinism_${stage}_child_process_exit`,
      exitCodeCategory: code === 0 ? "zero" : "nonzero"
    };
    const signalCategory = normalizeSignalCategory(signal);
    if (signalCategory !== undefined) {
      diagnostic.signalCategory = signalCategory;
    }
    return diagnostic;
  }
  const signalCategory = normalizeSignalCategory(signal);
  if (signalCategory !== undefined) {
    return {
      stage,
      category: "child_process_exit",
      reason: `clean_build_determinism_${stage}_child_process_exit`,
      signalCategory
    };
  }
  if (isFilesystemCode(code)) {
    return {
      stage,
      category: "filesystem_error",
      reason: `clean_build_determinism_${stage}_filesystem_error`,
      filesystemCode: code
    };
  }
  if (code !== undefined) {
    return {
      stage,
      category: "unknown_error",
      reason: `clean_build_determinism_${stage}_unknown_error`
    };
  }
  return {
    stage,
    category: "unknown_error",
    reason: safeReason ?? `clean_build_determinism_${stage}_unknown_error`
  };
}

async function runAuditStage<T>(
  stage: CleanBuildAuditStage,
  operation: () => Promise<T>
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const failure: StagedAuditFailure = {
      [STAGED_AUDIT_FAILURE]: true,
      diagnostic: normalizeAuditDiagnostic(stage, error)
    };
    throw failure;
  }
}

function isStagedAuditFailure(error: unknown): error is StagedAuditFailure {
  return isRecord(error)
    && readDataProperty(error, STAGED_AUDIT_FAILURE) === true
    && isRecord(readDataProperty(error, "diagnostic"));
}

export function appendUniqueAuditDiagnostic(
  diagnostics: CleanBuildDiagnostic[],
  diagnostic: CleanBuildDiagnostic
): void {
  const serialized = JSON.stringify(diagnostic);
  if (!diagnostics.some((entry) => JSON.stringify(entry) === serialized)) {
    diagnostics.push(diagnostic);
  }
}

function isAuditStage(value: unknown): value is CleanBuildAuditStage {
  return typeof value === "string"
    && (AUDIT_STAGES as readonly string[]).includes(value);
}

function readSafeReason(error: unknown): string | undefined {
  if (!isRecord(error)) {
    return undefined;
  }
  const message = readDataProperty(error, "message");
  return typeof message === "string" && SAFE_REASONS.has(message)
    ? message
    : undefined;
}

function readDataProperty(
  record: Record<PropertyKey, unknown>,
  key: PropertyKey
): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(record, key);
  return descriptor !== undefined && "value" in descriptor
    ? descriptor.value
    : undefined;
}

function isFilesystemCode(value: unknown): value is CleanBuildFilesystemCode {
  return typeof value === "string" && FILESYSTEM_CODES.has(value);
}

function normalizeSignalCategory(
  signal: unknown
): CleanBuildSignalCategory | undefined {
  if (typeof signal !== "string") {
    return undefined;
  }
  return isKnownSignalCategory(signal) ? signal : "other_signal";
}

function isKnownSignalCategory(
  value: string
): value is typeof SIGNAL_CATEGORY_VALUES[number] {
  return SIGNAL_CATEGORIES.has(value);
}

async function main(): Promise<void> {
  const result = await runCleanBuildDeterminismAudit();
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== "passed") {
    process.exitCode = 1;
  }
}

if (process.argv[1] !== undefined) {
  const invoked = resolve(process.argv[1]);
  const current = resolve(fileURLToPath(import.meta.url));
  if (invoked === current) {
    await main().catch((error: unknown) => {
      console.error(normalizeAuditDiagnostic("cleanup", error).reason);
      process.exitCode = 1;
    });
  }
}
