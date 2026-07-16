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
}

export interface CleanBuildDeterminismAuditOptions {
  keepFixture?: boolean;
}

export async function runCleanBuildDeterminismAudit(
  repositoryRoot = process.cwd(),
  options: CleanBuildDeterminismAuditOptions = {}
): Promise<CleanBuildDeterminismAuditResult> {
  const root = resolve(repositoryRoot);
  const fixtureRoot = await mkdtemp(resolve(root, FIXTURE_PREFIX));
  const checks: CleanBuildDeterminismAuditResult["checks"] = {
    removedSourceOutputInitiallyEmitted: false,
    staleOutputRemovedBeforeRebuild: false,
    dirtyAndEmptyDistFilesMatch: false,
    dirtyAndEmptyPackFileListsMatch: false
  };
  const reasons: string[] = [];
  let dirtySnapshot: ArtifactSnapshot | undefined;
  let emptySnapshot: ArtifactSnapshot | undefined;

  try {
    await copyRepositoryFixture(root, fixtureRoot);
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
    await mkdir(resolve(removedSourceRoot, "src"), { recursive: true });
    await writeFile(
      resolve(removedSourceRoot, "src", "index.ts"),
      "export const removedBuildFixture = true;\n",
      "utf8"
    );

    await runNpm(fixtureRoot, root, ["run", "build"]);
    checks.removedSourceOutputInitiallyEmitted = await pathExists(
      resolve(removedOutputRoot, "src", "index.js")
    );
    if (!checks.removedSourceOutputInitiallyEmitted) {
      reasons.push("clean_build_removed_source_output_not_emitted");
    }

    await rm(removedSourceRoot, { recursive: true, force: true });
    await runNpm(fixtureRoot, root, ["run", "build"]);
    checks.staleOutputRemovedBeforeRebuild = !(await pathExists(removedOutputRoot));
    if (!checks.staleOutputRemovedBeforeRebuild) {
      reasons.push("clean_build_stale_output_remained");
    }
    dirtySnapshot = await captureArtifactSnapshot(fixtureRoot, root);

    await rm(resolve(fixtureRoot, "dist"), { recursive: true, force: true });
    await runNpm(fixtureRoot, root, ["run", "build"]);
    emptySnapshot = await captureArtifactSnapshot(fixtureRoot, root);

    checks.dirtyAndEmptyDistFilesMatch = manifestsEqual(
      dirtySnapshot.distFiles,
      emptySnapshot.distFiles
    );
    if (!checks.dirtyAndEmptyDistFilesMatch) {
      reasons.push("clean_build_dist_manifest_mismatch");
    }

    checks.dirtyAndEmptyPackFileListsMatch = manifestsEqual(
      dirtySnapshot.packFiles,
      emptySnapshot.packFiles
    );
    if (!checks.dirtyAndEmptyPackFileListsMatch) {
      reasons.push("clean_build_pack_file_list_mismatch");
    }
  } catch (error) {
    reasons.push(normalizeError(error));
  } finally {
    if (options.keepFixture !== true) {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  }

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
    reasons: [...new Set(reasons)].sort()
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
  const distFiles = await collectFileManifest(resolve(fixtureRoot, "dist"));
  const packFiles = await collectPackFileManifest(
    fixtureRoot,
    repositoryRoot
  );
  return {
    distFiles,
    distDigest: digestManifest(distFiles),
    packFiles,
    packFileListDigest: digestFileList(packFiles)
  };
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

function normalizeError(error: unknown): string {
  if (error instanceof Error && /^[a-z0-9_]+$/u.test(error.message)) {
    return error.message;
  }
  return "clean_build_determinism_unknown_error";
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
      console.error(normalizeError(error));
      process.exitCode = 1;
    });
  }
}
