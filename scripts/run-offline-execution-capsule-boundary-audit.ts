#!/usr/bin/env node

import { readdir, readFile, realpath, stat } from "node:fs/promises";
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
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
    fakeWorkerInputSafetyGated: boolean;
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
  const packageJsonText = await readFile(resolve(cwd, "package.json"), "utf8");
  return {
    sourceText,
    packageJsonText,
    publicApiText: await collectExportedPublicFacadeText(packageJsonText, cwd),
    testText: (await Promise.all([
      "tests/offline-execution-capsule.test.ts",
      "tests/offline-execution-capsule-fake-worker-input-gate.test.ts"
    ].map((path) => readFile(resolve(cwd, path), "utf8")))).join("\n"),
    adrText: await readFile(
      resolve(cwd, "docs/governance/decisions/ADR_011_OFFLINE_EXECUTION_CAPSULE.md"),
      "utf8"
    ),
    governanceRunnerText: await readFile(resolve(cwd, "scripts/run-governance-check.ts"), "utf8")
  };
}

export async function collectExportedPublicFacadeText(
  packageJsonText: string,
  cwd = process.cwd()
): Promise<string> {
  const packageJson = parsePackageJson(packageJsonText);
  const sourcePaths: string[] = [];
  for (const target of [...new Set(exportTargetStrings(packageJson?.exports))].sort()) {
    const sourcePath = await resolveExportedFacadeSourcePath(target, cwd);
    if (sourcePath === undefined) {
      if (target.replaceAll("\\", "/").startsWith("./")) {
        throw new Error(`offline_capsule_public_facade_target_unmapped:${target}`);
      }
      continue;
    }
    sourcePaths.push(sourcePath);
  }
  const collectedFiles = new Map<string, string>();
  for (const sourcePath of [...new Set(sourcePaths)].sort()) {
    await collectRepositoryFacadeDependencyClosure(sourcePath, cwd, collectedFiles);
  }
  return [...collectedFiles.entries()]
    .sort(([left], [right]) => left.localeCompare(right, "en-US"))
    .map(([path, text]) => `// ${relative(cwd, path)}\n${text}`)
    .join("\n");
}

async function collectRepositoryFacadeDependencyClosure(
  entryPath: string,
  cwd: string,
  collectedFiles: Map<string, string>
): Promise<void> {
  const packagesRoot = await realpath(resolve(cwd, "packages"));
  if (!isContainedPath(relative(packagesRoot, entryPath))) {
    throw new Error(`offline_capsule_public_facade_outside_package:${relative(cwd, entryPath)}`);
  }
  const pending = [entryPath];
  const queued = new Set(pending);
  while (pending.length > 0) {
    const sourcePath = pending.shift()!;
    if (collectedFiles.has(sourcePath)) {
      continue;
    }
    const sourceText = await readFile(sourcePath, "utf8");
    const dependencyAnalysis = analyzeStaticFacadeDependencies(sourceText);
    if (!dependencyAnalysis.parseSucceeded) {
      throw new Error(`offline_capsule_public_facade_parse_failed:${relative(cwd, sourcePath)}`);
    }
    collectedFiles.set(sourcePath, sourceText);
    for (const specifier of dependencyAnalysis.moduleSpecifiers.sort()) {
      const dependencyPath = await resolveRepositoryFacadeDependency(
        sourcePath,
        specifier,
        packagesRoot
      );
      if (
        dependencyPath !== undefined
        && !queued.has(dependencyPath)
        && !collectedFiles.has(dependencyPath)
      ) {
        queued.add(dependencyPath);
        pending.push(dependencyPath);
      }
    }
  }
}

async function resolveRepositoryFacadeDependency(
  importerPath: string,
  rawSpecifier: string,
  packagesRoot: string
): Promise<string | undefined> {
  let specifier: string;
  try {
    specifier = decodeURIComponent(rawSpecifier);
  } catch {
    throw new Error(`offline_capsule_public_facade_specifier_invalid:${rawSpecifier}`);
  }
  if (!specifier.startsWith("./") && !specifier.startsWith("../")) {
    return undefined;
  }
  const unresolvedPath = resolve(dirname(importerPath), specifier);
  const packagesRelativePath = relative(packagesRoot, unresolvedPath);
  if (!isContainedPath(packagesRelativePath)) {
    throw new Error(`offline_capsule_public_facade_dependency_outside_packages:${rawSpecifier}`);
  }
  const candidates = facadeDependencyCandidates(unresolvedPath);
  for (const candidate of candidates) {
    try {
      const resolvedPath = await realpath(candidate);
      const resolvedRelativePath = relative(packagesRoot, resolvedPath);
      if (!isContainedPath(resolvedRelativePath)) {
        throw new Error(
          `offline_capsule_public_facade_dependency_outside_packages:${rawSpecifier}`
        );
      }
      if ((await stat(resolvedPath)).isFile()) {
        return resolvedPath;
      }
    } catch (error) {
      if (isMissingPathError(error)) {
        continue;
      }
      throw error;
    }
  }
  throw new Error(`offline_capsule_public_facade_dependency_missing:${rawSpecifier}`);
}

function facadeDependencyCandidates(unresolvedPath: string): string[] {
  const extension = extname(unresolvedPath);
  if (extension === ".js") {
    return [
      `${unresolvedPath.slice(0, -extension.length)}.ts`,
      `${unresolvedPath.slice(0, -extension.length)}.tsx`
    ];
  }
  if (extension === ".mjs") {
    return [`${unresolvedPath.slice(0, -extension.length)}.mts`];
  }
  if (extension === ".cjs") {
    return [`${unresolvedPath.slice(0, -extension.length)}.cts`];
  }
  if (extension !== "") {
    return [unresolvedPath];
  }
  return [
    unresolvedPath,
    `${unresolvedPath}.ts`,
    `${unresolvedPath}.tsx`,
    join(unresolvedPath, "index.ts"),
    join(unresolvedPath, "index.tsx")
  ];
}

function isContainedPath(relativePath: string): boolean {
  return relativePath !== ""
    && relativePath !== ".."
    && !relativePath.startsWith(`..${sep}`)
    && !isAbsolute(relativePath);
}

function isMissingPathError(error: unknown): boolean {
  return error instanceof Error
    && "code" in error
    && (error.code === "ENOENT" || error.code === "ENOTDIR");
}

export function reviewOfflineExecutionCapsuleBoundary(
  input: OfflineExecutionCapsuleBoundaryAuditInput
): OfflineExecutionCapsuleBoundaryAuditResult {
  const packageJson = parsePackageJson(input.packageJsonText);
  const packageExports = packageJson?.exports;
  const sourceAnalysis = analyzeCapsuleSource(input.sourceText);
  const publicApiAnalysis = analyzeCapsuleSource(input.publicApiText);
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
      "ownPassiveKeys(worker)",
      "offline_fake_worker_output_invalid"
    ]),
    fakeWorkerInputSafetyGated: includesAll(input.sourceText, [
      "assertFakeWorkerTaskSafe(task);",
      "assertFakeWorkerInputTreeManifestSafe(inputTreeManifest.manifest, manifest);",
      "assertFakeWorkerInputTreeContentSafe(inputTree.files);",
      "offline_fake_worker_sensitive_path_forbidden",
      "offline_fake_worker_credential_like_content_forbidden"
    ]) && includesAll(input.testText, [
      "fake worker rejects credential-like task content before invoking transform",
      "fake worker rejects sensitive input paths before tree blob reads or transform",
      "fake worker rejects credential-like input content before invoking transform"
    ]),
    sourceImportsAllowlisted: sourceAnalysis.parseSucceeded
      && sourceImports.every(isAllowedCapsuleModuleSpecifier)
      && !sourceAnalysis.hasDynamicImport
      && !sourceAnalysis.hasImportEquals
      && !sourceAnalysis.hasRequireCall,
    noFilesystemProcessOrSocketImports: !sourceImports.some(isForbiddenRuntimeIoModule),
    noProviderOrHostExecutionCoupling: !sourceImports.some((specifier) => (
      /(?:provider|codex-cli|desktop-live|host-executor)/u.test(specifier)
    ))
      && !sourceAnalysis.identifiers.some(isForbiddenAmbientIdentifier)
      && !sourceAnalysis.hasFunctionConstructorReference,
    noApprovalRetainApplyCoupling: !sourceImports.some((specifier) => (
      /(?:file-change-preview|retain-control|approval-permit|approval-gate|workspace-write)/u.test(
        specifier
      )
    )),
    independentDigestVerificationPresent: includesAll(input.sourceText, [
      "loadCapsuleTask",
      "loadContentTree",
      "loadContentTreeManifest",
      "maxTaskBytes",
      "maxTreeManifestBytes",
      "maxTotalTreeFiles",
      "maxTotalTreeBytes",
      "isProxy(bytes)",
      "TYPED_ARRAY_BYTE_LENGTH_GETTER",
      "const requestedDigest = { ...expectedDigest }",
      "store.read(requestedDigest)",
      "actualByteLength !== expectedDigest.size",
      "sameContentDigest(digestBytes(copy), expectedDigest)",
      "isSensitiveOfflineTreePath",
      "inputTreeManifest.manifest.entries.some",
      "outputTreeManifest.manifest.entries.some",
      "verified offline assessment requires capsule bindings",
      "hashGovernedFileChangeSetContent",
      "offline-execution-capsule.v1",
      "offline_capsule_receipt_or_nonce_replay"
    ]),
    publicExportAbsent: packageJson !== undefined
      && !containsExecutionCapsuleReference(packageExports)
      && publicApiAnalysis.parseSucceeded
      && !publicApiAnalysis.moduleSpecifiers.some(containsExecutionCapsuleReference)
      && !publicApiAnalysis.hasDynamicImport
      && !publicApiAnalysis.hasImportEquals
      && !publicApiAnalysis.hasRequireCall,
    negativeCoverageRecorded: includesAll(input.testText, [
      "tree manifests sort canonically",
      "CAS is immutable",
      "schema drift or extra fields fail closed",
      "delete, rename, mode drift, outside target, and no-change",
      "changed binary, credential-like content, sensitive path, and size limits",
      "copyIterations",
      "ownByteLengthGetterCalls",
      "ownSpeciesGetterCalls",
      "offline_capsule_detached_read",
      "sensitiveReadHashes",
      "credentials.json",
      "client_secret.json",
      "oauth-credentials.json",
      "withoutManifestHash",
      "withoutOutputRoot",
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
    try {
      return [value, decodeURIComponent(value)].some((candidate) => (
        candidate.toLocaleLowerCase("en-US").includes("execution-capsule")
      ));
    } catch {
      return true;
    }
  }
  if (Array.isArray(value)) {
    return value.some(containsExecutionCapsuleReference);
  }
  if (value === null || typeof value !== "object") {
    return false;
  }
  return Object.entries(value).some(([key, target]) => (
    containsExecutionCapsuleReference(key)
    || containsExecutionCapsuleReference(target)
  ));
}

function exportTargetStrings(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap(exportTargetStrings);
  }
  if (value === null || typeof value !== "object") {
    return [];
  }
  return Object.values(value).flatMap(exportTargetStrings);
}

async function resolveExportedFacadeSourcePath(
  target: string,
  cwd: string
): Promise<string | undefined> {
  let sourcePath: string;
  try {
    sourcePath = decodeURIComponent(target.replaceAll("\\", "/"));
  } catch {
    return undefined;
  }
  if (!sourcePath.startsWith("./")) {
    return undefined;
  }
  sourcePath = sourcePath.slice(2);
  if (sourcePath.startsWith("dist/")) {
    sourcePath = sourcePath.slice("dist/".length);
  }
  if (!sourcePath.startsWith("packages/")) {
    return undefined;
  }
  const repositoryRoot = resolve(cwd);
  const lexicalPackagesRoot = resolve(repositoryRoot, "packages");
  const unresolvedPath = resolve(repositoryRoot, sourcePath);
  if (!isContainedPath(relative(lexicalPackagesRoot, unresolvedPath))) {
    return undefined;
  }
  let packagesRoot: string;
  try {
    packagesRoot = await realpath(lexicalPackagesRoot);
  } catch (error) {
    if (isMissingPathError(error)) {
      return undefined;
    }
    throw error;
  }
  for (const candidate of exportedFacadeSourceCandidates(unresolvedPath)) {
    try {
      const resolvedPath = await realpath(candidate);
      if (!isContainedPath(relative(packagesRoot, resolvedPath))) {
        return undefined;
      }
      if ((await stat(resolvedPath)).isFile()) {
        return resolvedPath;
      }
    } catch (error) {
      if (isMissingPathError(error)) {
        continue;
      }
      throw error;
    }
  }
  return undefined;
}

function exportedFacadeSourceCandidates(unresolvedPath: string): string[] {
  for (const [outputSuffix, sourceSuffixes] of [
    [".d.mts", [".mts"]],
    [".d.cts", [".cts"]],
    [".d.ts", [".ts", ".tsx"]],
    [".mjs", [".mts"]],
    [".cjs", [".cts"]],
    [".js", [".ts", ".tsx"]]
  ] as const) {
    if (unresolvedPath.endsWith(outputSuffix)) {
      const stem = unresolvedPath.slice(0, -outputSuffix.length);
      return sourceSuffixes.map((sourceSuffix) => `${stem}${sourceSuffix}`);
    }
  }
  if ([".ts", ".tsx", ".mts", ".cts"].some((suffix) => unresolvedPath.endsWith(suffix))) {
    return [unresolvedPath];
  }
  return [];
}

function includesAll(text: string, markers: string[]): boolean {
  return markers.every((marker) => text.includes(marker));
}

interface CapsuleSourceAnalysis {
  classNames: string[];
  hasAnonymousClass: boolean;
  hasFunctionConstructorReference: boolean;
  identifiers: string[];
  moduleSpecifiers: string[];
  hasDynamicImport: boolean;
  hasImportEquals: boolean;
  hasRequireCall: boolean;
  parseSucceeded: boolean;
}

interface StaticFacadeDependencyAnalysis {
  moduleSpecifiers: string[];
  parseSucceeded: boolean;
}

function analyzeStaticFacadeDependencies(text: string): StaticFacadeDependencyAnalysis {
  const sourceFile = ts.createSourceFile(
    "offline-execution-capsule-public-facade.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const parseDiagnostics = (
    sourceFile as ts.SourceFile & { parseDiagnostics?: readonly ts.Diagnostic[] }
  ).parseDiagnostics ?? [];
  const moduleSpecifiers: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
      && node.moduleSpecifier !== undefined
      && ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      moduleSpecifiers.push(node.moduleSpecifier.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return {
    moduleSpecifiers,
    parseSucceeded: parseDiagnostics.length === 0
  };
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
  let hasFunctionConstructorReference = false;
  let hasImportEquals = false;
  let hasRequireCall = false;
  const recordModuleSpecifier = (expression: ts.Expression | undefined): void => {
    if (expression !== undefined && ts.isStringLiteralLike(expression)) {
      moduleSpecifiers.push(expression.text);
    }
  };
  const visit = (node: ts.Node): void => {
    if (
      ts.isElementAccessExpression(node)
      && !isStaticallyKnownPropertyKey(node.argumentExpression)
    ) {
      hasFunctionConstructorReference = true;
    }
    if (
      (ts.isIdentifier(node) || ts.isStringLiteralLike(node))
      && isForbiddenCapabilityPropertyName(node.text)
      && !isApprovedTypedArrayByteLengthDescriptorReference(node)
    ) {
      hasFunctionConstructorReference = true;
    }
    if (
      (
        ts.isBinaryExpression(node)
        || ts.isCallExpression(node)
        || ts.isParenthesizedExpression(node)
        || ts.isTemplateExpression(node)
      )
      && isForbiddenCapabilityPropertyName(staticStringValue(node))
    ) {
      hasFunctionConstructorReference = true;
    }
    if (ts.isIdentifier(node) && !isApprovedTypedArrayByteLengthReflectApply(node)) {
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
    hasFunctionConstructorReference,
    identifiers,
    moduleSpecifiers,
    hasDynamicImport,
    hasImportEquals,
    hasRequireCall,
    parseSucceeded: parseDiagnostics.length === 0
  };
}

function staticStringValue(expression: ts.Expression): string | undefined {
  if (ts.isStringLiteralLike(expression)) {
    return expression.text;
  }
  if (ts.isParenthesizedExpression(expression)) {
    return staticStringValue(expression.expression);
  }
  if (
    ts.isBinaryExpression(expression)
    && expression.operatorToken.kind === ts.SyntaxKind.PlusToken
  ) {
    const left = staticStringValue(expression.left);
    const right = staticStringValue(expression.right);
    return left === undefined || right === undefined ? undefined : `${left}${right}`;
  }
  if (ts.isTemplateExpression(expression)) {
    let value = expression.head.text;
    for (const span of expression.templateSpans) {
      const part = staticStringValue(span.expression);
      if (part === undefined) {
        return undefined;
      }
      value += `${part}${span.literal.text}`;
    }
    return value;
  }
  if (
    ts.isCallExpression(expression)
    && ts.isPropertyAccessExpression(expression.expression)
    && expression.expression.name.text === "join"
    && ts.isArrayLiteralExpression(expression.expression.expression)
    && expression.arguments.length <= 1
  ) {
    const separator = expression.arguments.length === 0
      ? ","
      : staticStringValue(expression.arguments[0]!);
    if (separator === undefined) {
      return undefined;
    }
    const parts: string[] = [];
    for (const element of expression.expression.expression.elements) {
      if (ts.isSpreadElement(element)) {
        return undefined;
      }
      const part = staticStringValue(element);
      if (part === undefined) {
        return undefined;
      }
      parts.push(part);
    }
    return parts.join(separator);
  }
  return undefined;
}

function isStaticallyKnownPropertyKey(expression: ts.Expression): boolean {
  return ts.isNumericLiteral(expression) || staticStringValue(expression) !== undefined;
}

function isForbiddenCapabilityPropertyName(value: string | undefined): boolean {
  return value === "constructor" || value === "getOwnPropertyDescriptor";
}

function isApprovedTypedArrayByteLengthDescriptorReference(node: ts.Node): boolean {
  if (
    !ts.isIdentifier(node)
    || node.text !== "getOwnPropertyDescriptor"
    || !ts.isPropertyAccessExpression(node.parent)
    || node.parent.name !== node
    || !ts.isIdentifier(node.parent.expression)
    || node.parent.expression.text !== "Object"
    || !ts.isCallExpression(node.parent.parent)
    || node.parent.parent.expression !== node.parent
  ) {
    return false;
  }
  const [target, property, ...extraArguments] = node.parent.parent.arguments;
  return extraArguments.length === 0
    && target !== undefined
    && ts.isCallExpression(target)
    && ts.isPropertyAccessExpression(target.expression)
    && ts.isIdentifier(target.expression.expression)
    && target.expression.expression.text === "Object"
    && target.expression.name.text === "getPrototypeOf"
    && target.arguments.length === 1
    && target.arguments[0] !== undefined
    && isNamedPropertyAccess(target.arguments[0], "Uint8Array", "prototype")
    && property !== undefined
    && ts.isStringLiteralLike(property)
    && property.text === "byteLength";
}

function isApprovedTypedArrayByteLengthReflectApply(node: ts.Identifier): boolean {
  if (
    node.text !== "Reflect"
    || !ts.isPropertyAccessExpression(node.parent)
    || node.parent.expression !== node
    || node.parent.name.text !== "apply"
    || !ts.isCallExpression(node.parent.parent)
    || node.parent.parent.expression !== node.parent
  ) {
    return false;
  }
  const [callable, receiver, argumentList, ...extraArguments] = node.parent.parent.arguments;
  return extraArguments.length === 0
    && callable !== undefined
    && ts.isIdentifier(callable)
    && callable.text === "TYPED_ARRAY_BYTE_LENGTH_GETTER"
    && receiver !== undefined
    && ts.isIdentifier(receiver)
    && receiver.text === "bytes"
    && argumentList !== undefined
    && ts.isArrayLiteralExpression(argumentList)
    && argumentList.elements.length === 0;
}

function isNamedPropertyAccess(
  expression: ts.Expression,
  objectName: string,
  propertyName: string
): boolean {
  return ts.isPropertyAccessExpression(expression)
    && ts.isIdentifier(expression.expression)
    && expression.expression.text === objectName
    && expression.name.text === propertyName;
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
    "Reflect",
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
    "./input-safety.js",
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
