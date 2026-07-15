#!/usr/bin/env node

import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const CAPSULE_SOURCE_DIRECTORY = "packages/execution-capsule/src";

export interface OfflineExecutionCapsuleBoundaryAuditInput {
  sourceText: string;
  packageJsonText: string;
  publicApiText: string;
  testText: string;
  adrText: string;
  governanceRunnerText: string;
}

export interface OfflineExecutionCapsuleBoundaryAuditResult {
  status: "passed" | "blocked";
  checks: {
    offlineContractFixed: boolean;
    inMemoryContentStoreOnly: boolean;
    testWorkerRegistryGuarded: boolean;
    passiveWorkerInputsRequired: boolean;
    sourceImportsAllowlisted: boolean;
    noFilesystemProcessOrSocketImports: boolean;
    noProviderOrHostExecutionCoupling: boolean;
    noApprovalRetainApplyCoupling: boolean;
    independentDigestVerificationPresent: boolean;
    publicExportAbsent: boolean;
    negativeCoverageRecorded: boolean;
    governanceBoundaryRecorded: boolean;
    simulatedEvidenceLimitDocumented: boolean;
  };
  summary: {
    executionMode: "test_only_simulated";
    contentStoreMode: "in_memory_only";
    publicExported: false;
    liveExecutionAuthorized: false;
    autoApprovalEligible: false;
    retainEligible: false;
    applyEligible: false;
    workspaceWriteEligible: false;
    injectedTransformSideEffectsMechanicallyExcluded: false;
    capsuleSourceRuntimeIoImportsPresent: false;
    childProcessesStartedDuringAudit: 0;
    socketsOpenedDuringAudit: 0;
    providerCallsDuringAudit: 0;
    filesystemWritesDuringAudit: 0;
  };
  reasons: string[];
}

export async function collectOfflineExecutionCapsuleBoundaryAuditInput(
  cwd = process.cwd()
): Promise<OfflineExecutionCapsuleBoundaryAuditInput> {
  const sourceDirectory = resolve(cwd, CAPSULE_SOURCE_DIRECTORY);
  const sourceFiles = (await readdir(sourceDirectory))
    .filter((name) => name.endsWith(".ts"))
    .sort();
  const sourceText = (await Promise.all(sourceFiles.map(async (name) => (
    `// ${name}\n${await readFile(join(sourceDirectory, name), "utf8")}`
  )))).join("\n");
  const publicApiFiles = ["protocol.ts", "policy.ts", "codex-adapter.ts", "evidence.ts", "provider.ts"];
  const publicApiText = (await Promise.all(publicApiFiles.map((name) => (
    readFile(resolve(cwd, "packages/public-api/src", name), "utf8")
  )))).join("\n");
  return {
    sourceText,
    packageJsonText: await readFile(resolve(cwd, "package.json"), "utf8"),
    publicApiText,
    testText: await readFile(resolve(cwd, "tests/offline-execution-capsule.test.ts"), "utf8"),
    adrText: await readFile(
      resolve(cwd, "docs/governance/decisions/ADR_011_OFFLINE_EXECUTION_CAPSULE.md"),
      "utf8"
    ),
    governanceRunnerText: await readFile(resolve(cwd, "scripts/run-governance-check.ts"), "utf8")
  };
}

export function reviewOfflineExecutionCapsuleBoundary(
  input: OfflineExecutionCapsuleBoundaryAuditInput
): OfflineExecutionCapsuleBoundaryAuditResult {
  const packageJson = parsePackageJson(input.packageJsonText);
  const packageExports = packageJson?.exports;
  const sourceAnalysis = analyzeCapsuleSource(input.sourceText);
  const sourceImports = sourceAnalysis.moduleSpecifiers;
  const checks = {
    offlineContractFixed: includesAll(input.sourceText, [
      'z.literal("offline-execution-capsule.v1")',
      'z.literal("test_only_simulated")',
      'z.literal("synthetic_non_sensitive")',
      'z.literal("none")',
      'z.literal(false)'
    ]),
    inMemoryContentStoreOnly: includesAll(input.sourceText, [
      "class InMemoryContentAddressedStore",
      "new Map<string, Uint8Array>()",
      "readVerifiedBytes",
      "sameContentDigest"
    ]) && contentStoreClassesAreInMemoryOnly(sourceAnalysis),
    testWorkerRegistryGuarded: includesAll(input.sourceText, [
      "trustedFakeWorkers = new WeakMap",
      "createTestOnlyFakeCapsuleWorker",
      "offline_fake_worker_untrusted"
    ]),
    passiveWorkerInputsRequired: includesAll(input.sourceText, [
      "isProxy(worker)",
      "Reflect.ownKeys(worker)",
      "offline_fake_worker_output_invalid"
    ]),
    sourceImportsAllowlisted: sourceAnalysis.parseSucceeded
      && sourceImports.every(isAllowedCapsuleModuleSpecifier)
      && !sourceAnalysis.hasDynamicImport
      && !sourceAnalysis.hasImportEquals
      && !sourceAnalysis.hasRequireCall,
    noFilesystemProcessOrSocketImports: !sourceImports.some(isForbiddenRuntimeIoModule),
    noProviderOrHostExecutionCoupling: !sourceImports.some((specifier) => (
      /(?:provider|codex-cli|desktop-live|host-executor)/u.test(specifier)
    )) && !sourceAnalysis.identifiers.some(isForbiddenAmbientIdentifier),
    noApprovalRetainApplyCoupling: !sourceImports.some((specifier) => (
      /(?:file-change-preview|retain-control|approval-permit|approval-gate|workspace-write)/u.test(
        specifier
      )
    )),
    independentDigestVerificationPresent: includesAll(input.sourceText, [
      "loadCapsuleTask",
      "loadContentTree",
      "hashGovernedFileChangeSetContent",
      "offline-execution-capsule.v1",
      "offline_capsule_receipt_or_nonce_replay"
    ]),
    publicExportAbsent: packageJson !== undefined
      && !containsExecutionCapsuleReference(packageExports)
      && !input.publicApiText.includes("execution-capsule"),
    negativeCoverageRecorded: includesAll(input.testText, [
      "tree manifests sort canonically",
      "CAS is immutable",
      "schema drift or extra fields fail closed",
      "delete, rename, mode drift, outside target, and no-change",
      "changed binary, credential-like content, sensitive path, and size limits",
      "unregistered, proxy, and accessor workers"
    ]),
    governanceBoundaryRecorded: input.governanceRunnerText.includes(
      'auditCheck("offline-execution-capsule-boundary"'
    ),
    simulatedEvidenceLimitDocumented: includesAll(input.adrText, [
      "simulated contract evidence",
      "does not prove worker fidelity",
      "new schema version",
      "App Server exact-apply gap remains unresolved",
      "real workspace promotion",
      "Injected transform side effects are not mechanically excluded"
    ])
  };
  const reasons = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => `offline_execution_capsule_boundary_${name}`);
  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      executionMode: "test_only_simulated",
      contentStoreMode: "in_memory_only",
      publicExported: false,
      liveExecutionAuthorized: false,
      autoApprovalEligible: false,
      retainEligible: false,
      applyEligible: false,
      workspaceWriteEligible: false,
      injectedTransformSideEffectsMechanicallyExcluded: false,
      capsuleSourceRuntimeIoImportsPresent: false,
      childProcessesStartedDuringAudit: 0,
      socketsOpenedDuringAudit: 0,
      providerCallsDuringAudit: 0,
      filesystemWritesDuringAudit: 0
    },
    reasons
  };
}

export function formatOfflineExecutionCapsuleBoundaryAuditResult(
  result: OfflineExecutionCapsuleBoundaryAuditResult
): string {
  return `${JSON.stringify(result, null, 2)}\n`;
}

function parsePackageJson(text: string): { exports?: unknown } | undefined {
  try {
    const value = JSON.parse(text) as unknown;
    if (value === null || typeof value !== "object") {
      return undefined;
    }
    return value as { exports?: unknown };
  } catch {
    return undefined;
  }
}

function containsExecutionCapsuleReference(value: unknown): boolean {
  if (typeof value === "string") {
    return value.toLocaleLowerCase("en-US").includes("execution-capsule");
  }
  if (Array.isArray(value)) {
    return value.some(containsExecutionCapsuleReference);
  }
  if (value === null || typeof value !== "object") {
    return false;
  }
  return Object.entries(value).some(([key, target]) => (
    key.toLocaleLowerCase("en-US").includes("execution-capsule")
    || containsExecutionCapsuleReference(target)
  ));
}

function includesAll(text: string, markers: string[]): boolean {
  return markers.every((marker) => text.includes(marker));
}

interface CapsuleSourceAnalysis {
  classNames: string[];
  hasAnonymousClass: boolean;
  identifiers: string[];
  moduleSpecifiers: string[];
  hasDynamicImport: boolean;
  hasImportEquals: boolean;
  hasRequireCall: boolean;
  parseSucceeded: boolean;
}

function analyzeCapsuleSource(text: string): CapsuleSourceAnalysis {
  const sourceFile = ts.createSourceFile(
    "offline-execution-capsule-source.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const parseDiagnostics = (
    sourceFile as ts.SourceFile & { parseDiagnostics?: readonly ts.Diagnostic[] }
  ).parseDiagnostics ?? [];
  const identifiers: string[] = [];
  const moduleSpecifiers: string[] = [];
  const classNames: string[] = [];
  let hasDynamicImport = false;
  let hasAnonymousClass = false;
  let hasImportEquals = false;
  let hasRequireCall = false;
  const recordModuleSpecifier = (expression: ts.Expression | undefined): void => {
    if (expression !== undefined && ts.isStringLiteralLike(expression)) {
      moduleSpecifiers.push(expression.text);
    }
  };
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node)) {
      identifiers.push(node.text);
    }
    if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
      if (node.name === undefined) {
        hasAnonymousClass = true;
      } else {
        classNames.push(node.name.text);
      }
    }
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      recordModuleSpecifier(node.moduleSpecifier);
    }
    if (ts.isImportEqualsDeclaration(node)) {
      hasImportEquals = true;
      if (ts.isExternalModuleReference(node.moduleReference)) {
        recordModuleSpecifier(node.moduleReference.expression);
      }
    }
    if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        hasDynamicImport = true;
        recordModuleSpecifier(node.arguments[0]);
      }
      if (ts.isIdentifier(node.expression) && node.expression.text === "require") {
        hasRequireCall = true;
        recordModuleSpecifier(node.arguments[0]);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return {
    classNames: classNames.sort(),
    hasAnonymousClass,
    identifiers,
    moduleSpecifiers,
    hasDynamicImport,
    hasImportEquals,
    hasRequireCall,
    parseSucceeded: parseDiagnostics.length === 0
  };
}

function isForbiddenRuntimeIoModule(specifier: string): boolean {
  return /^(?:node:)?(?:child_process|fs|fs\/promises|net|tls|dgram|http|https|worker_threads)$/u.test(
    specifier
  );
}

function isForbiddenAmbientIdentifier(identifier: string): boolean {
  return new Set([
    "Bun",
    "Deno",
    "Function",
    "WebSocket",
    "XMLHttpRequest",
    "createConnection",
    "eval",
    "execFile",
    "fetch",
    "global",
    "globalThis",
    "navigator",
    "process",
    "require",
    "spawn"
  ]).has(identifier);
}

function isAllowedCapsuleModuleSpecifier(specifier: string): boolean {
  return new Set([
    "node:crypto",
    "node:path",
    "node:util/types",
    "zod",
    "../../authorization-kernel/src/index.js",
    "../../kernel-contracts/src/index.js",
    "./content-addressed-store.js",
    "./contracts.js",
    "./test-only-fake-worker.js",
    "./verifier.js"
  ]).has(specifier);
}

function contentStoreClassesAreInMemoryOnly(analysis: CapsuleSourceAnalysis): boolean {
  return !analysis.hasAnonymousClass && sameStrings(analysis.classNames, [
    "InMemoryContentAddressedStore",
    "InMemoryOfflineCapsuleReplayStore"
  ]);
}

function sameStrings(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

async function main(): Promise<void> {
  const result = reviewOfflineExecutionCapsuleBoundary(
    await collectOfflineExecutionCapsuleBoundaryAuditInput()
  );
  process.stdout.write(formatOfflineExecutionCapsuleBoundaryAuditResult(result));
  process.exitCode = result.status === "passed" ? 0 : 1;
}

const invokedPath = process.argv[1];
if (
  invokedPath !== undefined
  && pathToFileURL(resolve(invokedPath)).href === import.meta.url
) {
  await main();
}
