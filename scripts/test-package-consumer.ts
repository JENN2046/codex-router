#!/usr/bin/env node

import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface PackageConsumerTestResult {
  status: "passed" | "failed";
  checks: {
    packageBuilt: boolean;
    packageCreated: boolean;
    blankConsumerInstalled: boolean;
    publicSubpathsTypechecked: boolean;
    bareRootImportBlocked: boolean;
  };
  reasons: string[];
}

export interface PackageConsumerCommandInput {
  command: string;
  argv: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  maxBuffer: number;
}

export interface PackageConsumerTestOptions {
  runCommand?: (input: PackageConsumerCommandInput) => Promise<void>;
  npmInvocation?: {
    platform?: NodeJS.Platform;
    npmExecPath?: string;
    nodeExecutable?: string;
  };
}

export async function testPackageConsumer(
  repoRoot = process.cwd(),
  options: PackageConsumerTestOptions = {}
): Promise<PackageConsumerTestResult> {
  const tempRoot = await mkdtemp(join(tmpdir(), "codex-router-package-consumer-"));
  const runCommand = options.runCommand ?? runPackageConsumerCommand;
  const npmInvocation = (argv: string[]): { command: string; argv: string[] } => (
    resolveNpmInvocation(argv, options.npmInvocation)
  );
  const checks: PackageConsumerTestResult["checks"] = {
    packageBuilt: false,
    packageCreated: false,
    blankConsumerInstalled: false,
    publicSubpathsTypechecked: false,
    bareRootImportBlocked: false
  };
  const reasons: string[] = [];
  let stage = "build";

  try {
    const npmEnv = createNpmEnv(join(tempRoot, "npm-cache"));
    const build = npmInvocation(["run", "build"]);
    await runCommand({
      command: build.command,
      argv: build.argv,
      cwd: repoRoot,
      env: npmEnv,
      maxBuffer: 20 * 1024 * 1024
    });
    checks.packageBuilt = true;

    stage = "pack";
    const pack = npmInvocation([
      "pack",
      "--json",
      "--pack-destination",
      tempRoot
    ]);
    await runCommand({
      command: pack.command,
      argv: pack.argv,
      cwd: repoRoot,
      env: npmEnv,
      maxBuffer: 10 * 1024 * 1024
    });
    const filename = (await readdir(tempRoot))
      .filter((entry) => entry.endsWith(".tgz"))
      .sort()[0];
    if (filename === undefined) {
      throw new Error("package_consumer_pack_filename_missing");
    }
    const tarball = join(tempRoot, basename(filename));
    checks.packageCreated = true;

    stage = "install";
    const consumerRoot = join(tempRoot, "consumer");
    await mkdir(consumerRoot, { recursive: true });
    await writeFile(join(consumerRoot, "package.json"), `${JSON.stringify({
      name: "codex-router-blank-consumer",
      version: "0.0.0",
      private: true,
      type: "module"
    }, null, 2)}\n`, "utf8");
    const install = npmInvocation([
      "install",
      "--offline",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--no-package-lock",
      tarball,
      resolve(repoRoot, "node_modules/zod"),
      resolve(repoRoot, "node_modules/yaml")
    ]);
    await runCommand({
      command: install.command,
      argv: install.argv,
      cwd: consumerRoot,
      env: npmEnv,
      maxBuffer: 20 * 1024 * 1024
    });
    checks.blankConsumerInstalled = true;

    stage = "typecheck";
    const consumerSource = `
import { CapabilityFactsSchema } from "codex-router/protocol";
import { deriveCapabilityFacts } from "codex-router/policy";
import { CodexSdkAdapter } from "codex-router/codex-adapter";
import { RetainReceiptSchema } from "codex-router/evidence";
import { ProviderManifestSchema } from "codex-router/provider";

void CapabilityFactsSchema;
void deriveCapabilityFacts;
void CodexSdkAdapter;
void RetainReceiptSchema;
void ProviderManifestSchema;
`;
    const sourcePath = join(consumerRoot, "index.ts");
    await writeFile(sourcePath, consumerSource.trimStart(), "utf8");
    await execFileAsync(process.execPath, [
      resolve(repoRoot, "node_modules/typescript/bin/tsc"),
      "--noEmit",
      "--strict",
      "--skipLibCheck",
      "--target",
      "ES2022",
      "--module",
      "NodeNext",
      "--moduleResolution",
      "NodeNext",
      sourcePath
    ], {
      cwd: consumerRoot,
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 20 * 1024 * 1024
    });
    checks.publicSubpathsTypechecked = true;

    stage = "bare_root";
    try {
      await execFileAsync(process.execPath, [
        "--input-type=module",
        "-e",
        "await import('codex-router')"
      ], {
        cwd: consumerRoot,
        encoding: "utf8",
        windowsHide: true
      });
      reasons.push("package_consumer_bare_root_import_unexpectedly_resolved");
    } catch (error) {
      const output = collectProcessErrorOutput(error);
      if (output.includes("ERR_PACKAGE_PATH_NOT_EXPORTED")) {
        checks.bareRootImportBlocked = true;
      } else {
        reasons.push("package_consumer_bare_root_import_failed_unexpectedly");
      }
    }
  } catch (error) {
    reasons.push(`package_consumer_failed_at_${stage}`);
    reasons.push(normalizeError(error));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }

  for (const [name, passed] of Object.entries(checks)) {
    if (!passed) {
      reasons.push(`package_consumer_${name}_failed`);
    }
  }
  return {
    status: reasons.length === 0 ? "passed" : "failed",
    checks,
    reasons: [...new Set(reasons)].sort()
  };
}

async function runPackageConsumerCommand(
  input: PackageConsumerCommandInput
): Promise<void> {
  await execFileAsync(input.command, input.argv, {
    cwd: input.cwd,
    encoding: "utf8",
    env: input.env,
    windowsHide: true,
    maxBuffer: input.maxBuffer
  });
}

function collectProcessErrorOutput(error: unknown): string {
  if (typeof error !== "object" || error === null) {
    return "";
  }
  const record = error as { stdout?: unknown; stderr?: unknown; message?: unknown };
  return [record.stdout, record.stderr, record.message]
    .filter((value): value is string => typeof value === "string")
    .join("\n");
}

function normalizeError(error: unknown): string {
  const output = collectProcessErrorOutput(error);
  if (
    output.includes("ENETUNREACH")
    || output.includes("EAI_AGAIN")
    || output.includes("ENOTCACHED")
  ) {
    return "package_consumer_offline_dependency_cache_missing";
  }
  if (error instanceof Error && /^[a-z0-9_]+$/.test(error.message)) {
    return error.message;
  }
  return "package_consumer_unknown_error";
}

function createNpmEnv(cacheDir: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    npm_config_cache: cacheDir,
    npm_config_update_notifier: "false",
    npm_config_fund: "false",
    npm_config_audit: "false"
  };
  for (const key of ["PATH", "SystemRoot", "COMSPEC", "PATHEXT", "WINDIR"] as const) {
    const value = process.env[key];
    if (value !== undefined) {
      env[key] = value;
    }
  }
  return env;
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
    throw new Error("package_consumer_npm_execpath_missing");
  }
  return {
    command: options.nodeExecutable ?? process.execPath,
    argv: [npmExecPath, ...argv]
  };
}

async function main(): Promise<void> {
  const result = await testPackageConsumer();
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== "passed") {
    process.exitCode = 1;
  }
}

if (process.argv[1] !== undefined) {
  const invoked = resolve(process.argv[1]);
  const current = resolve(fileURLToPath(import.meta.url));
  if (invoked === current) {
    await main();
  }
}
