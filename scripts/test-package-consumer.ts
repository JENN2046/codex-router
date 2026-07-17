#!/usr/bin/env node

import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, posix as pathPosix, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  CORE_DECLARATION_FILES,
  CORE_EXPORTS,
  CORE_METADATA_FILES,
  CORE_RUNTIME_FILES,
  reviewCoreArtifactBoundary
} from "./run-core-only-artifact-audit.js";

const execFileAsync = promisify(execFile);

export interface PackageConsumerTestResult {
  status: "passed" | "failed";
  checks: {
    packageBuilt: boolean;
    packageCreated: boolean;
    blankConsumerInstalled: boolean;
    exactArtifactVerified: boolean;
    publicSubpathsTypechecked: boolean;
    publicSubpathsRuntimeImported: boolean;
    publicSubpathsSmoked: boolean;
    bareRootImportBlocked: boolean;
    staleAliasesBlocked: boolean;
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
    exactArtifactVerified: false,
    publicSubpathsTypechecked: false,
    publicSubpathsRuntimeImported: false,
    publicSubpathsSmoked: false,
    bareRootImportBlocked: false,
    staleAliasesBlocked: false
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

    stage = "artifact";
    const installedPackageRoot = join(consumerRoot, "node_modules", "codex-router");
    const installedFiles = await readInstalledPackageFiles(installedPackageRoot);
    const installedManifest = JSON.parse(installedFiles["package.json"] ?? "null") as {
      exports?: Record<string, unknown>;
    } | null;
    const artifactReview = reviewCoreArtifactBoundary({
      files: installedFiles,
      packFiles: Object.keys(installedFiles),
      packageExports: Object.keys(installedManifest?.exports ?? {}),
      providerGovernancePublicSourceText: await readFile(
        resolve(repoRoot, "packages/provider-core/src/governance-public.ts"), "utf8"
      ),
      providerCoreInternalSourceText: await readFile(
        resolve(repoRoot, "packages/provider-core/src/index.ts"), "utf8"
      ),
      publicProviderFacadeSourceText: await readFile(
        resolve(repoRoot, "packages/public-api/src/provider.ts"), "utf8"
      ),
      legacyAdapterSourceText: await readFile(
        resolve(repoRoot, "packages/kernel-contracts/src/legacy-adapter.ts"), "utf8"
      )
    });
    if (artifactReview.status !== "passed") {
      throw new Error("package_consumer_artifact_boundary_failed");
    }
    checks.exactArtifactVerified = true;

    stage = "typecheck";
    const consumerSource = `
import { CapabilityFactsSchema } from "codex-router/protocol";
import { deriveCapabilityFacts } from "codex-router/policy";
import { CodexSdkAdapter } from "codex-router/codex-adapter";
// @ts-expect-error offline-only proposal runtime must not be public
import { NoEnvironmentProposalEventGate } from "codex-router/codex-adapter";
// @ts-expect-error offline-only proposal types must not be public
import type { NoEnvironmentProposalContract } from "codex-router/codex-adapter";
import { RetainReceiptSchema } from "codex-router/evidence";
import { ProviderManifestSchema, type GovernanceProvider } from "codex-router/provider";

void CapabilityFactsSchema;
void deriveCapabilityFacts;
void CodexSdkAdapter;
void RetainReceiptSchema;
void ProviderManifestSchema;
const manifest = ProviderManifestSchema.parse({
  providerId: "consumer-fixture",
  kind: "tool",
  displayName: "Consumer fixture",
  version: "1.0.0",
  securityBoundary: {}
});
const provider: GovernanceProvider = { manifest };
void provider;
`;
    const sourcePath = join(consumerRoot, "index.ts");
    await writeFile(sourcePath, consumerSource.trimStart(), "utf8");
    await writeFile(join(consumerRoot, "tsconfig.json"), `${JSON.stringify({
      compilerOptions: {
        module: "NodeNext",
        moduleResolution: "NodeNext",
        target: "ES2022",
        strict: true,
        noEmit: true,
        skipLibCheck: false,
        types: []
      },
      files: ["index.ts"]
    }, null, 2)}\n`, "utf8");
    await execFileAsync(process.execPath, [
      resolve(repoRoot, "node_modules/typescript/bin/tsc"), "-p", "tsconfig.json"
    ], {
      cwd: consumerRoot,
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 20 * 1024 * 1024
    });
    checks.publicSubpathsTypechecked = true;

    stage = "runtime";
    const surfaceLocks = Object.fromEntries(await Promise.all(
      ["protocol", "policy", "codex-adapter", "evidence", "provider"].map(async (name) => [
        name,
        JSON.parse(await readFile(
          resolve(repoRoot, `tests/fixtures/public-api-${name}-surface-lock.fixture.json`),
          "utf8"
        )) as string[]
      ] as const)
    ));
    await execFileAsync(process.execPath, ["--input-type=module", "-e", `
const protocol = await import("codex-router/protocol");
const policy = await import("codex-router/policy");
const adapter = await import("codex-router/codex-adapter");
const evidence = await import("codex-router/evidence");
const provider = await import("codex-router/provider");
const modules = { protocol, policy, "codex-adapter": adapter, evidence, provider };
const locks = ${JSON.stringify(surfaceLocks)};
for (const [name, module] of Object.entries(modules)) {
  const actual = Object.keys(module).sort();
  const expected = [...locks[name]].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error("public_runtime_surface_drift:" + name);
  }
}
if (!protocol.CapabilityFactsSchema || typeof policy.deriveCapabilityFacts !== "function"
  || typeof adapter.CodexSdkAdapter !== "function" || !evidence.RetainReceiptSchema
  || !provider.ProviderManifestSchema) throw new Error("public_runtime_import_missing");
const parsed = provider.ProviderManifestSchema.safeParse({
  providerId: "consumer-fixture", kind: "tool", displayName: "Consumer fixture",
  version: "1.0.0", securityBoundary: {}
});
if (!parsed.success) throw new Error("provider_manifest_smoke_failed");
`], { cwd: consumerRoot, encoding: "utf8", windowsHide: true });
    checks.publicSubpathsRuntimeImported = true;
    checks.publicSubpathsSmoked = true;

    stage = "negative_aliases";
    const aliases = [
      "codex-router", "codex-router/sdk", "codex-router/host", "codex-router/support",
      "codex-router/contracts", "codex-router/kernel-contracts",
      "codex-router/protocol-mcp", "codex-router/protocol-a2a",
      "codex-router/testing", "codex-router/diagnostics"
    ];
    await execFileAsync(process.execPath, ["--input-type=module", "-e", `
const aliases = ${JSON.stringify(aliases)};
for (const alias of aliases) {
  try { await import(alias); throw new Error("unexpected_alias:" + alias); }
  catch (error) {
    if (error instanceof Error && error.message.startsWith("unexpected_alias:")) throw error;
    if (!(error && typeof error === "object" && error.code === "ERR_PACKAGE_PATH_NOT_EXPORTED")) throw error;
  }
}
`], { cwd: consumerRoot, encoding: "utf8", windowsHide: true });
    checks.bareRootImportBlocked = true;
    checks.staleAliasesBlocked = true;
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

async function readInstalledPackageFiles(root: string): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  const visit = async (directory: string, prefix = ""): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const relative = prefix === "" ? entry.name : pathPosix.join(prefix, entry.name);
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) await visit(absolute, relative);
      else if (entry.isFile()) files[relative] = await readFile(absolute, "utf8");
    }
  };
  await visit(root);
  const expectedCount = CORE_RUNTIME_FILES.length + CORE_DECLARATION_FILES.length
    + CORE_METADATA_FILES.length;
  if (Object.keys(files).length !== expectedCount || CORE_EXPORTS.length !== 5) {
    throw new Error("package_consumer_artifact_entry_count_mismatch");
  }
  return files;
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
