#!/usr/bin/env node

import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, posix as pathPosix, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import ts from "typescript";

const execFileAsync = promisify(execFile);

export const CORE_RUNTIME_FILES = [
  "dist/packages/authorization-kernel/src/index.js",
  "dist/packages/capability/src/index.js",
  "dist/packages/codex-adapter/src/command-approval.js",
  "dist/packages/codex-adapter/src/index.js",
  "dist/packages/codex-adapter/src/permission-profile.js",
  "dist/packages/codex-adapter/src/v2-wire.js",
  "dist/packages/file-change-preview/src/index.js",
  "dist/packages/kernel-contracts/src/codex-governance.js",
  "dist/packages/kernel-contracts/src/core.js",
  "dist/packages/kernel-contracts/src/public.js",
  "dist/packages/provider-core/src/governance-public.js",
  "dist/packages/public-api/src/codex-adapter.js",
  "dist/packages/public-api/src/evidence.js",
  "dist/packages/public-api/src/policy.js",
  "dist/packages/public-api/src/protocol.js",
  "dist/packages/public-api/src/provider.js",
  "dist/packages/retain-control/src/index.js"
] as const;

export const CORE_DECLARATION_FILES = [
  "dist/packages/authorization-kernel/src/index.d.ts",
  "dist/packages/codex-adapter/src/index.d.ts",
  "dist/packages/codex-adapter/src/permission-profile.d.ts",
  "dist/packages/codex-adapter/src/v2-wire.d.ts",
  "dist/packages/file-change-preview/src/index.d.ts",
  "dist/packages/kernel-contracts/src/codex-governance.d.ts",
  "dist/packages/kernel-contracts/src/core.d.ts",
  "dist/packages/kernel-contracts/src/public.d.ts",
  "dist/packages/provider-core/src/governance-public.d.ts",
  "dist/packages/public-api/src/codex-adapter.d.ts",
  "dist/packages/public-api/src/evidence.d.ts",
  "dist/packages/public-api/src/policy.d.ts",
  "dist/packages/public-api/src/protocol.d.ts",
  "dist/packages/public-api/src/provider.d.ts",
  "dist/packages/retain-control/src/index.d.ts"
] as const;

export const CORE_METADATA_FILES = [
  "README.AGENTS_OS.md",
  "README.md",
  "package.json"
] as const;

export const CORE_EXPORTS = [
  "./codex-adapter",
  "./evidence",
  "./policy",
  "./protocol",
  "./provider"
] as const;

const runtimeEntryPaths = CORE_EXPORTS.map((entry) => (
  `dist/packages/public-api/src/${entry.slice(2)}.js`
));
const declarationEntryPaths = CORE_EXPORTS.map((entry) => (
  `dist/packages/public-api/src/${entry.slice(2)}.d.ts`
));

const kernelRuntime = [
  "dist/packages/kernel-contracts/src/codex-governance.js",
  "dist/packages/kernel-contracts/src/core.js",
  "dist/packages/kernel-contracts/src/public.js"
] as const;
const kernelDeclarations = kernelRuntime.map((path) => `${path.slice(0, -3)}.d.ts`);
const perEntryClosures: Readonly<Record<string, {
  runtime: readonly string[];
  declarations: readonly string[];
}>> = {
  "./protocol": {
    runtime: [...kernelRuntime, "dist/packages/public-api/src/protocol.js"],
    declarations: [...kernelDeclarations, "dist/packages/public-api/src/protocol.d.ts"]
  },
  "./policy": {
    runtime: [...kernelRuntime,
      "dist/packages/authorization-kernel/src/index.js",
      "dist/packages/capability/src/index.js",
      "dist/packages/file-change-preview/src/index.js",
      "dist/packages/public-api/src/policy.js"],
    declarations: [...kernelDeclarations,
      "dist/packages/authorization-kernel/src/index.d.ts",
      "dist/packages/file-change-preview/src/index.d.ts",
      "dist/packages/public-api/src/policy.d.ts"]
  },
  "./codex-adapter": {
    runtime: [...kernelRuntime,
      "dist/packages/authorization-kernel/src/index.js",
      "dist/packages/capability/src/index.js",
      "dist/packages/codex-adapter/src/command-approval.js",
      "dist/packages/codex-adapter/src/index.js",
      "dist/packages/codex-adapter/src/permission-profile.js",
      "dist/packages/codex-adapter/src/v2-wire.js",
      "dist/packages/file-change-preview/src/index.js",
      "dist/packages/public-api/src/codex-adapter.js",
      "dist/packages/retain-control/src/index.js"],
    declarations: [...kernelDeclarations,
      "dist/packages/codex-adapter/src/index.d.ts",
      "dist/packages/codex-adapter/src/permission-profile.d.ts",
      "dist/packages/codex-adapter/src/v2-wire.d.ts",
      "dist/packages/file-change-preview/src/index.d.ts",
      "dist/packages/public-api/src/codex-adapter.d.ts",
      "dist/packages/retain-control/src/index.d.ts"]
  },
  "./evidence": {
    runtime: [...kernelRuntime,
      "dist/packages/public-api/src/evidence.js",
      "dist/packages/retain-control/src/index.js"],
    declarations: [...kernelDeclarations,
      "dist/packages/public-api/src/evidence.d.ts",
      "dist/packages/retain-control/src/index.d.ts"]
  },
  "./provider": {
    runtime: [...kernelRuntime,
      "dist/packages/provider-core/src/governance-public.js",
      "dist/packages/public-api/src/provider.js"],
    declarations: [...kernelDeclarations,
      "dist/packages/provider-core/src/governance-public.d.ts",
      "dist/packages/public-api/src/provider.d.ts"]
  }
};

type ArtifactKind = "runtime" | "declaration";

export interface CoreArtifactBoundaryInput {
  files: Readonly<Record<string, string>>;
  packFiles: readonly string[];
  packageExports: readonly string[];
  runtimeEntries?: readonly string[];
  declarationEntries?: readonly string[];
  expectedRuntimeFiles?: readonly string[];
  expectedDeclarationFiles?: readonly string[];
  providerGovernancePublicSourceText?: string;
  providerCoreInternalSourceText?: string;
  publicProviderFacadeSourceText?: string;
  legacyAdapterSourceText?: string;
}

export interface CoreArtifactBoundaryResult {
  status: "passed" | "blocked";
  checks: {
    artifactManifestExact: boolean;
    packageExportsExact: boolean;
    runtimeClosureExact: boolean;
    declarationClosureExact: boolean;
    perEntryClosuresExact: boolean;
    pathsCanonical: boolean;
    noUnverifiableImports: boolean;
    noNodeAmbient: boolean;
    noProviderExecutionContract: boolean;
    noLegacyImportEdge: boolean;
    providerHelperOwnershipValid: boolean;
    compatibilityGraphAcyclic: boolean;
  };
  summary: {
    artifactEntryCount: number;
    runtimeClosureCount: number;
    declarationClosureCount: number;
    realProviderCalls: 0;
    workspaceWriteCalls: 0;
    externalWriteCalls: 0;
  };
  reasons: string[];
}

export function reviewCoreArtifactBoundary(
  input: CoreArtifactBoundaryInput
): CoreArtifactBoundaryResult {
  const reasons: string[] = [];
  const expectedRuntime = [...(input.expectedRuntimeFiles ?? CORE_RUNTIME_FILES)].sort();
  const expectedDeclarations = [
    ...(input.expectedDeclarationFiles ?? CORE_DECLARATION_FILES)
  ].sort();
  const expectedPack = [
    ...expectedRuntime,
    ...expectedDeclarations,
    ...CORE_METADATA_FILES
  ].sort();

  const pathsCanonical = canonicalPaths(input.packFiles);
  if (!pathsCanonical) reasons.push("artifact_path_not_canonical");

  const artifactManifestExact = sameStrings([...input.packFiles].sort(), expectedPack);
  if (!artifactManifestExact) {
    reasons.push("artifact_manifest_mismatch");
    for (const path of input.packFiles.filter((path) => !expectedPack.includes(path))) {
      reasons.push(...classifyForbiddenArtifactPath(path));
    }
  }

  const packageExportsExact = sameStrings(
    [...input.packageExports].sort(),
    [...CORE_EXPORTS].sort()
  );
  if (!packageExportsExact) reasons.push("stale_package_alias_present");

  const runtime = deriveClosure(
    input.files,
    input.runtimeEntries ?? runtimeEntryPaths,
    "runtime"
  );
  const declarations = deriveClosure(
    input.files,
    input.declarationEntries ?? declarationEntryPaths,
    "declaration"
  );
  reasons.push(...runtime.reasons, ...declarations.reasons);

  const runtimeClosureExact = sameStrings(runtime.files, expectedRuntime);
  if (!runtimeClosureExact) reasons.push("runtime_closure_mismatch");
  const declarationClosureExact = sameStrings(declarations.files, expectedDeclarations);
  if (!declarationClosureExact) reasons.push("declaration_closure_mismatch");
  const perEntryClosuresExact = input.runtimeEntries !== undefined
    || input.declarationEntries !== undefined
    || CORE_EXPORTS.every((entry, index) => {
      const expected = perEntryClosures[entry];
      if (expected === undefined) return false;
      const runtimeClosure = deriveClosure(input.files, [runtimeEntryPaths[index]!], "runtime");
      const declarationClosure = deriveClosure(
        input.files, [declarationEntryPaths[index]!], "declaration"
      );
      return runtimeClosure.reasons.length === 0
        && declarationClosure.reasons.length === 0
        && sameStrings(runtimeClosure.files, [...expected.runtime].sort())
        && sameStrings(declarationClosure.files, [...expected.declarations].sort());
    });
  if (!perEntryClosuresExact) reasons.push("per_entry_closure_mismatch");

  const selectedTexts = [...expectedRuntime, ...expectedDeclarations]
    .map((path) => input.files[path] ?? "");
  const declarationTexts = expectedDeclarations.map((path) => input.files[path] ?? "");
  const noNodeAmbient = declarationTexts.every((text) => !/\bNodeJS\b/u.test(text));
  if (!noNodeAmbient) reasons.push("declaration_node_ambient_present");

  const noProviderExecutionContract = selectedTexts.every((text) => (
    !/\bExecutorProvider\b/u.test(text)
    && !/\bprovider\s*\.\s*execute\b/u.test(text)
    && !providerInterfaceHasExecute(text)
  ));
  if (!noProviderExecutionContract) {
    reasons.push("provider_execute_contract_present");
    if (selectedTexts.some((text) => /\bprovider\s*\.\s*execute\b/u.test(text))) {
      reasons.push("provider_execute_call_present");
    }
  }

  const noLegacyImportEdge = [...expectedRuntime, ...expectedDeclarations]
    .every((path) => !hasLegacyImportEdge(path, input.files[path] ?? ""));
  if (!noLegacyImportEdge) reasons.push("legacy_import_edge_present");

  const providerHelperOwnershipValid = validateProviderHelperOwnership(input);
  if (!providerHelperOwnershipValid) {
    reasons.push("provider_hash_helper_ownership_invalid");
    const definition = /(?:export\s+)?function\s+stableStringifyProviderObject\s*\(/gu;
    const definitionCount = [
      input.providerGovernancePublicSourceText ?? "",
      input.providerCoreInternalSourceText ?? ""
    ].flatMap((text) => [...text.matchAll(definition)]).length;
    if (definitionCount !== 1) reasons.push("provider_hash_helper_duplicated");
    if (input.publicProviderFacadeSourceText?.includes("stableStringifyProviderObject")) {
      reasons.push("provider_internal_helper_exported");
    }
  }
  const compatibilityGraphAcyclic = input.legacyAdapterSourceText === undefined
    || !/from\s+["']\.\/index\.js["']/u.test(input.legacyAdapterSourceText);
  if (!compatibilityGraphAcyclic) reasons.push("legacy_initialization_cycle_present");

  const uniqueReasons = [...new Set(reasons)].sort();
  return {
    status: uniqueReasons.length === 0 ? "passed" : "blocked",
    checks: {
      artifactManifestExact,
      packageExportsExact,
      runtimeClosureExact,
      declarationClosureExact,
      perEntryClosuresExact,
      pathsCanonical,
      noUnverifiableImports:
        runtime.reasons.length === 0 && declarations.reasons.length === 0,
      noNodeAmbient,
      noProviderExecutionContract,
      noLegacyImportEdge,
      providerHelperOwnershipValid,
      compatibilityGraphAcyclic
    },
    summary: {
      artifactEntryCount: input.packFiles.length,
      runtimeClosureCount: runtime.files.length,
      declarationClosureCount: declarations.files.length,
      realProviderCalls: 0,
      workspaceWriteCalls: 0,
      externalWriteCalls: 0
    },
    reasons: uniqueReasons
  };
}

function classifyForbiddenArtifactPath(path: string): string[] {
  const reasons = ["artifact_file_not_allowlisted"];
  if (/^dist\/packages\/provider-core\/src\/index\.(?:js|d\.ts)$/u.test(path)) {
    reasons.push("provider_core_internal_present");
  }
  if (/governance-internal-workspace-write-executor/u.test(path)) {
    reasons.push("workspace_write_executor_present");
  }
  if (/^dist\/packages\/(?:contracts\/|kernel-contracts\/src\/(?:index|legacy-adapter)\.)/u.test(path)) {
    reasons.push("legacy_compatibility_present");
  }
  if (/^dist\/packages\/public-api\/src\/(?:index|sdk|host|support)\.(?:js|d\.ts)$/u.test(path)) {
    reasons.push("legacy_facade_present");
  }
  if (/^dist\/packages\/(?:agent-os-|codex-cli-host\/|codex-desktop-|codex-memory-|desktop-|protocol-mcp\/|protocol-a2a\/|host-client-example\/)/u.test(path)) {
    reasons.push("runtime_family_present");
  }
  if (/^(?:dist\/tests\/|dist\/scripts\/|tests\/|scripts\/|docs\/evidence\/)/u.test(path)
    || path.includes("/test-fixtures/")) {
    reasons.push("test_fixture_present");
  }
  return reasons;
}

export function deriveClosure(
  files: Readonly<Record<string, string>>,
  entries: readonly string[],
  kind: ArtifactKind
): { files: string[]; reasons: string[] } {
  const seen = new Set<string>();
  const pending = [...entries];
  const reasons: string[] = [];

  while (pending.length > 0) {
    const path = pending.pop()!;
    if (seen.has(path)) continue;
    const text = files[path];
    if (text === undefined) {
      reasons.push(kind === "runtime" ? "runtime_closure_missing" : "declaration_closure_missing");
      continue;
    }
    seen.add(path);
    const refs = moduleReferences(path, text);
    reasons.push(...refs.reasons);
    for (const specifier of refs.specifiers) {
      if (!specifier.startsWith(".")) continue;
      const target = resolveRelativeModule(path, specifier, kind);
      if (target === undefined) {
        reasons.push("artifact_import_outside_allowlist");
      } else {
        pending.push(target);
      }
    }
  }

  return { files: [...seen].sort(), reasons: [...new Set(reasons)].sort() };
}

function moduleReferences(
  path: string,
  text: string
): { specifiers: string[]; reasons: string[] } {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  const specifiers: string[] = [];
  const reasons: string[] = [];

  const visit = (node: ts.Node): void => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
      && node.moduleSpecifier !== undefined
      && ts.isStringLiteral(node.moduleSpecifier)) {
      specifiers.push(node.moduleSpecifier.text);
    } else if (ts.isImportTypeNode(node)
      && ts.isLiteralTypeNode(node.argument)
      && ts.isStringLiteral(node.argument.literal)) {
      specifiers.push(node.argument.literal.text);
    } else if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        reasons.push("artifact_dynamic_import_unverifiable");
      } else if (ts.isIdentifier(node.expression) && node.expression.text === "require") {
        reasons.push("artifact_commonjs_edge_unverifiable");
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return { specifiers, reasons };
}

function resolveRelativeModule(
  importer: string,
  specifier: string,
  kind: ArtifactKind
): string | undefined {
  const joined = pathPosix.normalize(pathPosix.join(dirname(importer), specifier));
  if (joined.startsWith("../") || joined.startsWith("/") || joined.includes("/../")) {
    return undefined;
  }
  if (kind === "declaration" && joined.endsWith(".js")) {
    return `${joined.slice(0, -3)}.d.ts`;
  }
  return joined;
}

function providerInterfaceHasExecute(text: string): boolean {
  const source = ts.createSourceFile("artifact.ts", text, ts.ScriptTarget.Latest, true);
  return source.statements.some((statement) => (
    ts.isInterfaceDeclaration(statement)
    && /Provider$/u.test(statement.name.text)
    && statement.members.some((member) => (
      ts.isMethodSignature(member)
      && member.name !== undefined
      && ts.isIdentifier(member.name)
      && member.name.text === "execute"
    ))
  ));
}

function hasLegacyImportEdge(path: string, text: string): boolean {
  const kind: ArtifactKind = path.endsWith(".d.ts") ? "declaration" : "runtime";
  return moduleReferences(path, text).specifiers.some((specifier) => {
    if (!specifier.startsWith(".")) return false;
    const target = resolveRelativeModule(path, specifier, kind);
    return target !== undefined && (
      target.startsWith("dist/packages/contracts/")
      || /dist\/packages\/kernel-contracts\/src\/(?:index|legacy-adapter)\.(?:js|d\.ts)$/u.test(target)
    );
  });
}

function validateProviderHelperOwnership(input: CoreArtifactBoundaryInput): boolean {
  const publicSource = input.providerGovernancePublicSourceText;
  const internalSource = input.providerCoreInternalSourceText;
  const facadeSource = input.publicProviderFacadeSourceText;
  if (publicSource === undefined || internalSource === undefined || facadeSource === undefined) {
    return true;
  }
  const definition = /(?:export\s+)?function\s+stableStringifyProviderObject\s*\(/gu;
  const definitions = [publicSource, internalSource]
    .flatMap((text) => [...text.matchAll(definition)]).length;
  return definitions === 1
    && /export\s+function\s+stableStringifyProviderObject\s*\(/u.test(publicSource)
    && internalSource.includes("stableStringifyProviderObject")
    && internalSource.includes('from "./governance-public.js"')
    && !facadeSource.includes("stableStringifyProviderObject");
}

function canonicalPaths(paths: readonly string[]): boolean {
  const folded = new Set<string>();
  for (const path of paths) {
    if (path.includes("\\") || path.startsWith("/") || pathPosix.normalize(path) !== path) {
      return false;
    }
    const key = path.toLocaleLowerCase("en-US");
    if (folded.has(key)) return false;
    folded.add(key);
  }
  return true;
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export async function runCoreOnlyArtifactAudit(
  repoRoot = process.cwd()
): Promise<CoreArtifactBoundaryResult> {
  const packageJson = JSON.parse(await readFile(resolve(repoRoot, "package.json"), "utf8")) as {
    exports?: Record<string, unknown>;
  };
  const compiled = [...CORE_RUNTIME_FILES, ...CORE_DECLARATION_FILES];
  const files = Object.fromEntries(await Promise.all(compiled.map(async (path) => (
    [path, await readFile(resolve(repoRoot, path), "utf8")] as const
  ))));
  const packFiles = await collectPackFiles(repoRoot);
  const result = reviewCoreArtifactBoundary({
    files,
    packFiles,
    packageExports: Object.keys(packageJson.exports ?? {}),
    providerGovernancePublicSourceText: await readFile(
      resolve(repoRoot, "packages/provider-core/src/governance-public.ts"),
      "utf8"
    ),
    providerCoreInternalSourceText: await readFile(
      resolve(repoRoot, "packages/provider-core/src/index.ts"),
      "utf8"
    ),
    publicProviderFacadeSourceText: await readFile(
      resolve(repoRoot, "packages/public-api/src/provider.ts"),
      "utf8"
    ),
    legacyAdapterSourceText: await readFile(
      resolve(repoRoot, "packages/kernel-contracts/src/legacy-adapter.ts"),
      "utf8"
    )
  });

  const declarationErrors = strictDeclarationDiagnostics(repoRoot);
  if (declarationErrors.length === 0) return result;
  return {
    ...result,
    status: "blocked",
    checks: { ...result.checks, noNodeAmbient: false },
    reasons: [...new Set([...result.reasons, "strict_declaration_consumer_failed"])].sort()
  };
}

function strictDeclarationDiagnostics(repoRoot: string): number[] {
  const program = ts.createProgram(
    declarationEntryPaths.map((path) => resolve(repoRoot, path)),
    {
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      noEmit: true,
      skipLibCheck: false,
      strict: true,
      target: ts.ScriptTarget.ES2022,
      types: []
    }
  );
  return ts.getPreEmitDiagnostics(program)
    .filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error)
    .map((diagnostic) => diagnostic.code);
}

async function collectPackFiles(repoRoot: string): Promise<string[]> {
  const invocation = resolveNpmInvocation([
    "pack",
    "--dry-run",
    "--ignore-scripts",
    "--json"
  ]);
  const { stdout } = await execFileAsync(invocation.command, invocation.argv, {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    windowsHide: true
  });
  const parsed = JSON.parse(stdout) as Array<{ files?: Array<{ path?: string }> }>;
  return (parsed[0]?.files ?? [])
    .map((entry) => entry.path)
    .filter((path): path is string => typeof path === "string")
    .sort();
}

function resolveNpmInvocation(argv: string[]): { command: string; argv: string[] } {
  if (process.platform !== "win32") return { command: "npm", argv };
  const npmExecPath = process.env.npm_execpath?.trim();
  if (!npmExecPath) throw new Error("core_artifact_npm_execpath_missing");
  return { command: process.execPath, argv: [npmExecPath, ...argv] };
}

async function main(): Promise<void> {
  const result = await runCoreOnlyArtifactAudit();
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== "passed") process.exitCode = 1;
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(resolve(entry)).href) {
  await main();
}
