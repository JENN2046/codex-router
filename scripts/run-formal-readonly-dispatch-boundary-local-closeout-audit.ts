#!/usr/bin/env node

import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const REQUIRED_PACKAGE_SCRIPTS = {
  governance: "tsx scripts/run-governance-check.ts"
} as const;

const REQUIRED_DOCS = {
  pr16aBoundary:
    "docs/governance/PR_16A_FORMAL_READONLY_DISPATCH_BOUNDARY.md",
  pr16bCloseout:
    "docs/governance/PR_16B_FORMAL_READONLY_DISPATCH_BOUNDARY_LOCAL_CLOSEOUT.md"
} as const;

const REQUIRED_EVIDENCE = {
  boundary:
    "docs/evidence/codex-cli-formal-readonly-dispatch-boundary-acceptance.json"
} as const;

const FORBIDDEN_OUTPUT_MARKERS = [
  "requestedAction",
  "prompt",
  "args",
  "stdout",
  "stderr",
  "raw command",
  "raw task envelope",
  "raw env",
  "raw token",
  "raw patch",
  "OPENAI_API_KEY",
  "sk-",
  "Bearer"
] as const;

export interface FormalReadonlyDispatchBoundaryLocalCloseoutAuditInput {
  gitStatusShort: string;
  branch: string;
  packageJsonText: string;
  hostDispatcherSourceText: string;
  pr16aBoundaryText: string;
  pr16bCloseoutText: string;
  boundaryEvidenceText: string;
}

export interface FormalReadonlyDispatchBoundaryLocalCloseoutAuditResult {
  status: "passed" | "blocked";
  checks: {
    worktreeClean: boolean;
    branchMain: boolean;
    packageScriptsPresent: boolean;
    formalWrapperPresent: boolean;
    formalWrapperRequiresRegistry: boolean;
    formalWrapperRequiresMetadata: boolean;
    pr16aBoundaryRecorded: boolean;
    pr16bCloseoutRecorded: boolean;
    boundaryEvidencePassed: boolean;
    registrySelectionProved: boolean;
    permitIssued: boolean;
    fakeSpawnerOnly: boolean;
    guardMismatchBlocked: boolean;
    writeAccessBlocked: boolean;
    noRealCodexCli: boolean;
    noWorkspaceWriteExecute: boolean;
    noLocalCommandExecute: boolean;
    noProtectedRemoteExecute: boolean;
    evidenceSanitized: boolean;
    closeoutNonAuthorizing: boolean;
  };
  summary: {
    branch: string;
    packageScriptTargetCount: number;
    packageScriptMismatchCount: number;
    providerId: string;
    sideEffectClass: string;
    sandbox: string;
    status: string;
    formalDispatchCalls: number;
    fakeSpawnerCalls: number;
    realCodexCliCalls: number;
    workspaceWriteExecuteCalls: number;
    localCommandExecuteCalls: number;
    protectedRemoteExecuteCalls: number;
  };
  reasons: string[];
}

export type FormalReadonlyDispatchBoundaryLocalCloseoutAuditOutputFormat =
  "text" | "json";

export async function collectFormalReadonlyDispatchBoundaryLocalCloseoutAuditInput(
  cwd = process.cwd()
): Promise<FormalReadonlyDispatchBoundaryLocalCloseoutAuditInput> {
  const [gitStatusShort, branch] = await Promise.all([
    git(["status", "--short"], cwd),
    git(["branch", "--show-current"], cwd)
  ]);
  const read = (path: string) => readFile(join(cwd, path), "utf8");
  const [
    packageJsonText,
    hostDispatcherSourceText,
    pr16aBoundaryText,
    pr16bCloseoutText,
    boundaryEvidenceText
  ] = await Promise.all([
    read("package.json"),
    read("packages/host-dispatcher/src/index.ts"),
    read(REQUIRED_DOCS.pr16aBoundary),
    read(REQUIRED_DOCS.pr16bCloseout),
    read(REQUIRED_EVIDENCE.boundary)
  ]);

  return {
    gitStatusShort,
    branch: branch.trim(),
    packageJsonText,
    hostDispatcherSourceText,
    pr16aBoundaryText,
    pr16bCloseoutText,
    boundaryEvidenceText
  };
}

export function reviewFormalReadonlyDispatchBoundaryLocalCloseoutAudit(
  input: FormalReadonlyDispatchBoundaryLocalCloseoutAuditInput
): FormalReadonlyDispatchBoundaryLocalCloseoutAuditResult {
  const packageJson = parseObject(input.packageJsonText);
  const boundaryEvidence = parseObject(input.boundaryEvidenceText);
  const packageScriptReview = reviewPackageScripts(packageJson);
  const checks = {
    worktreeClean: input.gitStatusShort.trim() === "",
    branchMain: input.branch === "main",
    packageScriptsPresent: packageScriptReview.mismatchCount === 0,
    formalWrapperPresent: formalWrapperPresent(input.hostDispatcherSourceText),
    formalWrapperRequiresRegistry:
      formalWrapperRequiresRegistry(input.hostDispatcherSourceText),
    formalWrapperRequiresMetadata:
      formalWrapperRequiresMetadata(input.hostDispatcherSourceText),
    pr16aBoundaryRecorded: pr16aBoundaryRecorded(input.pr16aBoundaryText),
    pr16bCloseoutRecorded: pr16bCloseoutRecorded(input.pr16bCloseoutText),
    boundaryEvidencePassed: boundaryEvidencePassed(boundaryEvidence),
    registrySelectionProved:
      getBoolean(boundaryEvidence, ["checks", "registrySelectionOk"]) === true,
    permitIssued: getBoolean(boundaryEvidence, ["checks", "permitIssued"]) === true,
    fakeSpawnerOnly: fakeSpawnerOnly(boundaryEvidence),
    guardMismatchBlocked:
      getBoolean(boundaryEvidence, ["checks", "guardMismatchBlocked"]) === true,
    writeAccessBlocked:
      getBoolean(boundaryEvidence, ["checks", "writeAccessBlocked"]) === true,
    noRealCodexCli:
      getNumber(boundaryEvidence, ["counters", "realCodexCliCalls"]) === 0,
    noWorkspaceWriteExecute:
      getNumber(boundaryEvidence, ["counters", "workspaceWriteExecuteCalls"]) === 0,
    noLocalCommandExecute:
      getNumber(boundaryEvidence, ["counters", "localCommandExecuteCalls"]) === 0,
    noProtectedRemoteExecute:
      getNumber(boundaryEvidence, ["counters", "protectedRemoteExecuteCalls"]) === 0,
    evidenceSanitized: evidenceIsSanitized(input.boundaryEvidenceText),
    closeoutNonAuthorizing: closeoutNonAuthorizing(input.pr16bCloseoutText)
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      branch: input.branch,
      packageScriptTargetCount: packageScriptReview.targetCount,
      packageScriptMismatchCount: packageScriptReview.mismatchCount,
      providerId: getString(boundaryEvidence, ["summary", "providerId"]) ?? "unknown",
      sideEffectClass:
        getString(boundaryEvidence, ["summary", "sideEffectClass"]) ?? "unknown",
      sandbox: getString(boundaryEvidence, ["summary", "sandbox"]) ?? "unknown",
      status: getString(boundaryEvidence, ["summary", "status"]) ?? "unknown",
      formalDispatchCalls:
        getNumber(boundaryEvidence, ["summary", "formalDispatchCalls"]) ?? 0,
      fakeSpawnerCalls:
        getNumber(boundaryEvidence, ["summary", "fakeSpawnerCalls"]) ?? 0,
      realCodexCliCalls:
        getNumber(boundaryEvidence, ["summary", "realCodexCliCalls"]) ?? 0,
      workspaceWriteExecuteCalls:
        getNumber(boundaryEvidence, ["summary", "workspaceWriteExecuteCalls"]) ?? 0,
      localCommandExecuteCalls:
        getNumber(boundaryEvidence, ["summary", "localCommandExecuteCalls"]) ?? 0,
      protectedRemoteExecuteCalls:
        getNumber(boundaryEvidence, ["summary", "protectedRemoteExecuteCalls"]) ?? 0
    },
    reasons
  };
}

export function formatFormalReadonlyDispatchBoundaryLocalCloseoutAuditResult(
  review: FormalReadonlyDispatchBoundaryLocalCloseoutAuditResult,
  format: FormalReadonlyDispatchBoundaryLocalCloseoutAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Formal read-only dispatch boundary local closeout audit",
    `status: ${review.status}`,
    `branch: ${review.summary.branch}`,
    `package script targets: ${review.summary.packageScriptTargetCount}`,
    `package script mismatches: ${review.summary.packageScriptMismatchCount}`,
    `provider: ${review.summary.providerId}`,
    `side effect: ${review.summary.sideEffectClass}`,
    `sandbox: ${review.summary.sandbox}`,
    `dispatch status: ${review.summary.status}`,
    `formal dispatch calls: ${review.summary.formalDispatchCalls}`,
    `fake spawner calls: ${review.summary.fakeSpawnerCalls}`,
    `real CLI calls: ${review.summary.realCodexCliCalls}`,
    `workspace-write execute calls: ${review.summary.workspaceWriteExecuteCalls}`,
    `local command execute calls: ${review.summary.localCommandExecuteCalls}`,
    `protected remote execute calls: ${review.summary.protectedRemoteExecuteCalls}`,
    ...(review.reasons.length > 0 ? [`reasons: ${review.reasons.join(",")}`] : [])
  ].join("\n");
}

async function git(args: string[], cwd: string): Promise<string> {
  const { stdout } = await execFileAsync("git", args, {
    cwd,
    encoding: "utf8",
    windowsHide: true
  });

  return stdout;
}

function reviewPackageScripts(packageJson: Record<string, unknown> | undefined): {
  targetCount: number;
  mismatchCount: number;
} {
  const scripts = packageJson?.scripts;
  const entries = Object.entries(REQUIRED_PACKAGE_SCRIPTS);

  return {
    targetCount: entries.length,
    mismatchCount: entries.filter(
      ([scriptName, expectedCommand]) =>
        !isRecord(scripts) || scripts[scriptName] !== expectedCommand
    ).length
  };
}

function formalWrapperPresent(source: string): boolean {
  return source.includes("dispatchFormalReadOnlyRunnerResultToProvider")
    && source.includes("FormalReadOnlyRunnerProviderDispatchInput");
}

function formalWrapperRequiresRegistry(source: string): boolean {
  return source.includes("host_dispatcher_formal_read_only_provider_registry_required")
    && source.includes("looseInput.providerRegistry === undefined");
}

function formalWrapperRequiresMetadata(source: string): boolean {
  return source.includes("host_dispatcher_formal_read_only_provider_metadata_required")
    && source.includes("!isRecord(looseInput.providerExecutionMetadata)");
}

function pr16aBoundaryRecorded(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ");
  return text.includes("PR_16A_FORMAL_READONLY_DISPATCH_BOUNDARY_RECORDED")
    && text.includes("npm run governance -- acceptance formal-readonly-dispatch-boundary")
    && text.includes(REQUIRED_EVIDENCE.boundary)
    && normalized.includes("does not authorize real Codex CLI invocation")
    && normalized.includes("workspace-write");
}

function pr16bCloseoutRecorded(text: string): boolean {
  return text.includes("PR_16B_FORMAL_READONLY_DISPATCH_BOUNDARY_LOCAL_CLOSEOUT_COMPLETE")
    && text.includes("npm run governance -- audit formal-readonly-dispatch-boundary-local")
    && text.includes("npm run governance -- audit formal-readonly-dispatch-boundary-local -- --json")
    && text.includes(REQUIRED_EVIDENCE.boundary);
}

function boundaryEvidencePassed(evidence: Record<string, unknown> | undefined): boolean {
  return getString(evidence, ["schemaVersion"])
      === "codex-cli-formal-readonly-dispatch-boundary-acceptance.v1"
    && getString(evidence, ["mode"]) === "formal-readonly-dispatch-boundary-local-only"
    && getBoolean(evidence, ["checks", "formalWrapperRequiresRegistry"]) === true
    && getBoolean(evidence, ["checks", "formalWrapperRequiresMetadata"]) === true
    && getBoolean(evidence, ["checks", "registrySelectionOk"]) === true
    && getBoolean(evidence, ["checks", "permitIssued"]) === true
    && getBoolean(evidence, ["checks", "formalDispatchOk"]) === true
    && getBoolean(evidence, ["checks", "fakeSpawnerUsed"]) === true
    && getBoolean(evidence, ["checks", "guardMismatchBlocked"]) === true
    && getBoolean(evidence, ["checks", "writeAccessBlocked"]) === true
    && getBoolean(evidence, ["checks", "noRealCodexCli"]) === true
    && getBoolean(evidence, ["checks", "noWorkspaceWriteExecute"]) === true
    && getBoolean(evidence, ["checks", "noLocalCommandExecute"]) === true
    && getBoolean(evidence, ["checks", "noProtectedRemoteExecute"]) === true
    && getBoolean(evidence, ["checks", "leakCheckPassed"]) === true
    && getString(evidence, ["summary", "providerId"]) === "codex-cli"
    && getString(evidence, ["summary", "sideEffectClass"]) === "read_only"
    && getString(evidence, ["summary", "sandbox"]) === "read-only";
}

function fakeSpawnerOnly(evidence: Record<string, unknown> | undefined): boolean {
  return getNumber(evidence, ["counters", "successSpawnCalls"]) === 1
    && getNumber(evidence, ["counters", "missingRegistrySpawnCalls"]) === 0
    && getNumber(evidence, ["counters", "missingMetadataSpawnCalls"]) === 0
    && getNumber(evidence, ["counters", "guardMismatchSpawnCalls"]) === 0
    && getNumber(evidence, ["counters", "writeAccessSpawnCalls"]) === 0
    && getNumber(evidence, ["counters", "realCodexCliCalls"]) === 0;
}

function closeoutNonAuthorizing(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ");
  return normalized.includes("does not authorize real Codex CLI invocation")
    && normalized.includes("does not authorize workspace-write")
    && normalized.includes("does not authorize local command")
    && normalized.includes("does not authorize protected remote")
    && normalized.includes("does not authorize push, release, or tag");
}

function evidenceIsSanitized(...texts: string[]): boolean {
  return !texts.some((text) =>
    FORBIDDEN_OUTPUT_MARKERS.some((marker) => text.includes(marker))
  );
}

function collectReasons(checks: Record<string, boolean>): string[] {
  return Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([name]) => `formal_readonly_dispatch_boundary_local_closeout_${name}`);
}

function parseObject(value: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(value) as unknown;
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function getBoolean(
  value: Record<string, unknown> | undefined,
  path: string[]
): boolean | undefined {
  const found = getPath(value, path);
  return typeof found === "boolean" ? found : undefined;
}

function getNumber(
  value: Record<string, unknown> | undefined,
  path: string[]
): number | undefined {
  const found = getPath(value, path);
  return typeof found === "number" ? found : undefined;
}

function getString(
  value: Record<string, unknown> | undefined,
  path: string[]
): string | undefined {
  const found = getPath(value, path);
  return typeof found === "string" ? found : undefined;
}

function getPath(
  value: Record<string, unknown> | undefined,
  path: string[]
): unknown {
  let current: unknown = value;

  for (const segment of path) {
    if (!isRecord(current)) {
      return undefined;
    }
    current = current[segment];
  }

  return current;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function main(): Promise<void> {
  const input = await collectFormalReadonlyDispatchBoundaryLocalCloseoutAuditInput();
  const review = reviewFormalReadonlyDispatchBoundaryLocalCloseoutAudit(input);
  const format = process.argv.includes("--json") ? "json" : "text";

  console.log(formatFormalReadonlyDispatchBoundaryLocalCloseoutAuditResult(review, format));

  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      "Formal read-only dispatch boundary local closeout audit failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
