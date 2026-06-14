#!/usr/bin/env node

import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const REQUIRED_PACKAGE_SCRIPTS = {
  "acceptance:formal-readonly-provider-integration-taskbook":
    "tsx scripts/run-formal-readonly-provider-integration-taskbook-acceptance.ts",
  "acceptance:formal-readonly-provider-integration":
    "tsx scripts/run-formal-readonly-provider-integration-acceptance.ts",
  "audit:formal-readonly-provider-integration-local":
    "tsx scripts/run-formal-readonly-provider-integration-local-closeout-audit.ts"
} as const;

const REQUIRED_DOCS = {
  pr15aTaskbook:
    "docs/governance/PR_15A_FORMAL_READONLY_PROVIDER_INTEGRATION_TASKBOOK.md",
  pr15bLocal:
    "docs/governance/PR_15B_FORMAL_READONLY_PROVIDER_INTEGRATION_LOCAL.md",
  pr15cCloseout:
    "docs/governance/PR_15C_FORMAL_READONLY_PROVIDER_INTEGRATION_LOCAL_CLOSEOUT.md"
} as const;

const REQUIRED_EVIDENCE = {
  taskbook:
    "docs/evidence/codex-cli-formal-readonly-provider-integration-taskbook-acceptance.json",
  integration:
    "docs/evidence/codex-cli-formal-readonly-provider-integration-acceptance.json"
} as const;

const FORBIDDEN_OUTPUT_MARKERS = [
  "APPROVE_FORMAL_CODEX_CLI_READONLY_PROVIDER_INTEGRATION_PR_15A",
  "APPROVE_FORMAL_CODEX_CLI_PROVIDER_INTEGRATION",
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

export interface FormalReadonlyProviderIntegrationLocalCloseoutAuditInput {
  gitStatusShort: string;
  branch: string;
  packageJsonText: string;
  pr15aTaskbookText: string;
  pr15bLocalText: string;
  pr15cCloseoutText: string;
  taskbookEvidenceText: string;
  integrationEvidenceText: string;
}

export interface FormalReadonlyProviderIntegrationLocalCloseoutAuditResult {
  status: "passed" | "blocked";
  checks: {
    worktreeClean: boolean;
    branchMain: boolean;
    packageScriptsPresent: boolean;
    pr15aTaskbookRecorded: boolean;
    pr15bLocalRecorded: boolean;
    pr15cCloseoutRecorded: boolean;
    taskbookEvidencePassed: boolean;
    integrationEvidencePassed: boolean;
    registrySelectionProved: boolean;
    permitIssued: boolean;
    fakeSpawnerOnly: boolean;
    guardMissingBlocked: boolean;
    registryMismatchBlocked: boolean;
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
    formalProviderDispatchCalls: number;
    fakeSpawnerCalls: number;
    realCodexCliCalls: number;
    workspaceWriteExecuteCalls: number;
    localCommandExecuteCalls: number;
    protectedRemoteExecuteCalls: number;
  };
  reasons: string[];
}

export type FormalReadonlyProviderIntegrationLocalCloseoutAuditOutputFormat =
  "text" | "json";

export async function collectFormalReadonlyProviderIntegrationLocalCloseoutAuditInput(
  cwd = process.cwd()
): Promise<FormalReadonlyProviderIntegrationLocalCloseoutAuditInput> {
  const [gitStatusShort, branch] = await Promise.all([
    git(["status", "--short"], cwd),
    git(["branch", "--show-current"], cwd)
  ]);
  const read = (path: string) => readFile(join(cwd, path), "utf8");
  const [
    packageJsonText,
    pr15aTaskbookText,
    pr15bLocalText,
    pr15cCloseoutText,
    taskbookEvidenceText,
    integrationEvidenceText
  ] = await Promise.all([
    read("package.json"),
    read(REQUIRED_DOCS.pr15aTaskbook),
    read(REQUIRED_DOCS.pr15bLocal),
    read(REQUIRED_DOCS.pr15cCloseout),
    read(REQUIRED_EVIDENCE.taskbook),
    read(REQUIRED_EVIDENCE.integration)
  ]);

  return {
    gitStatusShort,
    branch: branch.trim(),
    packageJsonText,
    pr15aTaskbookText,
    pr15bLocalText,
    pr15cCloseoutText,
    taskbookEvidenceText,
    integrationEvidenceText
  };
}

export function reviewFormalReadonlyProviderIntegrationLocalCloseoutAudit(
  input: FormalReadonlyProviderIntegrationLocalCloseoutAuditInput
): FormalReadonlyProviderIntegrationLocalCloseoutAuditResult {
  const packageJson = parseObject(input.packageJsonText);
  const taskbookEvidence = parseObject(input.taskbookEvidenceText);
  const integrationEvidence = parseObject(input.integrationEvidenceText);
  const packageScriptReview = reviewPackageScripts(packageJson);
  const checks = {
    worktreeClean: input.gitStatusShort.trim() === "",
    branchMain: input.branch === "main",
    packageScriptsPresent: packageScriptReview.mismatchCount === 0,
    pr15aTaskbookRecorded: pr15aTaskbookRecorded(input.pr15aTaskbookText),
    pr15bLocalRecorded: pr15bLocalRecorded(input.pr15bLocalText),
    pr15cCloseoutRecorded: pr15cCloseoutRecorded(input.pr15cCloseoutText),
    taskbookEvidencePassed: taskbookEvidencePassed(taskbookEvidence),
    integrationEvidencePassed: integrationEvidencePassed(integrationEvidence),
    registrySelectionProved:
      getBoolean(integrationEvidence, ["checks", "registrySelectionOk"]) === true,
    permitIssued: getBoolean(integrationEvidence, ["checks", "permitIssued"]) === true,
    fakeSpawnerOnly: fakeSpawnerOnly(integrationEvidence),
    guardMissingBlocked:
      getBoolean(integrationEvidence, ["checks", "guardMissingBlocked"]) === true,
    registryMismatchBlocked:
      getBoolean(integrationEvidence, ["checks", "registryMismatchBlocked"]) === true,
    writeAccessBlocked:
      getBoolean(integrationEvidence, ["checks", "writeAccessBlocked"]) === true,
    noRealCodexCli:
      getNumber(integrationEvidence, ["counters", "realCodexCliCalls"]) === 0,
    noWorkspaceWriteExecute:
      getNumber(integrationEvidence, ["counters", "workspaceWriteExecuteCalls"]) === 0,
    noLocalCommandExecute:
      getNumber(integrationEvidence, ["counters", "localCommandExecuteCalls"]) === 0,
    noProtectedRemoteExecute:
      getNumber(integrationEvidence, ["counters", "protectedRemoteExecuteCalls"]) === 0,
    evidenceSanitized: evidenceIsSanitized(
      input.taskbookEvidenceText,
      input.integrationEvidenceText
    ),
    closeoutNonAuthorizing: closeoutNonAuthorizing(input.pr15cCloseoutText)
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      branch: input.branch,
      packageScriptTargetCount: packageScriptReview.targetCount,
      packageScriptMismatchCount: packageScriptReview.mismatchCount,
      providerId: getString(integrationEvidence, ["summary", "providerId"]) ?? "unknown",
      sideEffectClass:
        getString(integrationEvidence, ["summary", "sideEffectClass"]) ?? "unknown",
      sandbox: getString(integrationEvidence, ["summary", "sandbox"]) ?? "unknown",
      status: getString(integrationEvidence, ["summary", "status"]) ?? "unknown",
      formalProviderDispatchCalls:
        getNumber(integrationEvidence, ["summary", "formalProviderDispatchCalls"]) ?? 0,
      fakeSpawnerCalls:
        getNumber(integrationEvidence, ["summary", "fakeSpawnerCalls"]) ?? 0,
      realCodexCliCalls:
        getNumber(integrationEvidence, ["summary", "realCodexCliCalls"]) ?? 0,
      workspaceWriteExecuteCalls:
        getNumber(integrationEvidence, ["summary", "workspaceWriteExecuteCalls"]) ?? 0,
      localCommandExecuteCalls:
        getNumber(integrationEvidence, ["summary", "localCommandExecuteCalls"]) ?? 0,
      protectedRemoteExecuteCalls:
        getNumber(integrationEvidence, ["summary", "protectedRemoteExecuteCalls"]) ?? 0
    },
    reasons
  };
}

export function formatFormalReadonlyProviderIntegrationLocalCloseoutAuditResult(
  review: FormalReadonlyProviderIntegrationLocalCloseoutAuditResult,
  format: FormalReadonlyProviderIntegrationLocalCloseoutAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Formal read-only provider integration local closeout audit",
    `status: ${review.status}`,
    `branch: ${review.summary.branch}`,
    `package script targets: ${review.summary.packageScriptTargetCount}`,
    `package script mismatches: ${review.summary.packageScriptMismatchCount}`,
    `provider: ${review.summary.providerId}`,
    `side effect: ${review.summary.sideEffectClass}`,
    `sandbox: ${review.summary.sandbox}`,
    `dispatch status: ${review.summary.status}`,
    `formal provider dispatch calls: ${review.summary.formalProviderDispatchCalls}`,
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

function pr15aTaskbookRecorded(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ");
  return text.includes("PR_15A_FORMAL_READONLY_PROVIDER_INTEGRATION_TASKBOOK_RECORDED")
    && text.includes("npm run acceptance:formal-readonly-provider-integration-taskbook")
    && text.includes(REQUIRED_EVIDENCE.taskbook)
    && normalized.includes("not an authorization to invoke the real Codex CLI")
    && normalized.includes("does not authorize workspace-write");
}

function pr15bLocalRecorded(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ");
  return text.includes("PR_15B_FORMAL_READONLY_PROVIDER_INTEGRATION_LOCAL_RECORDED")
    && text.includes("npm run acceptance:formal-readonly-provider-integration")
    && text.includes(REQUIRED_EVIDENCE.integration)
    && normalized.includes("provider dispatch completes through fake spawner")
    && normalized.includes("Real CLI invocation remains closed");
}

function pr15cCloseoutRecorded(text: string): boolean {
  return text.includes("PR_15C_FORMAL_READONLY_PROVIDER_INTEGRATION_LOCAL_CLOSEOUT_COMPLETE")
    && text.includes("npm run audit:formal-readonly-provider-integration-local")
    && text.includes("npm run audit:formal-readonly-provider-integration-local -- --json")
    && text.includes(REQUIRED_EVIDENCE.taskbook)
    && text.includes(REQUIRED_EVIDENCE.integration);
}

function taskbookEvidencePassed(evidence: Record<string, unknown> | undefined): boolean {
  return getString(evidence, ["schemaVersion"])
      === "codex-cli-formal-readonly-provider-integration-taskbook-acceptance.v1"
    && getString(evidence, ["mode"])
      === "formal-readonly-provider-integration-taskbook-local-only"
    && getBoolean(evidence, ["checks", "exactTaskbookAccepted"]) === true
    && getBoolean(evidence, ["checks", "broadenedScopeBlocked"]) === true
    && getBoolean(evidence, ["checks", "forbiddenExecutionBlocked"]) === true
    && getBoolean(evidence, ["checks", "noProviderExecute"]) === true
    && getBoolean(evidence, ["checks", "noRealCodexCli"]) === true
    && getBoolean(evidence, ["checks", "noWorkspaceWriteExecute"]) === true
    && getBoolean(evidence, ["checks", "leakCheckPassed"]) === true
    && getBoolean(evidence, ["summary", "localTaskbookOnly"]) === true;
}

function integrationEvidencePassed(evidence: Record<string, unknown> | undefined): boolean {
  return getString(evidence, ["schemaVersion"])
      === "codex-cli-formal-readonly-provider-integration-acceptance.v1"
    && getString(evidence, ["mode"])
      === "formal-readonly-provider-integration-fake-spawner-local-only"
    && getBoolean(evidence, ["checks", "taskbookGateAccepted"]) === true
    && getBoolean(evidence, ["checks", "pr14ReadinessPassed"]) === true
    && getBoolean(evidence, ["checks", "pr14AuthorizationPassed"]) === true
    && getBoolean(evidence, ["checks", "dispatchOk"]) === true
    && getBoolean(evidence, ["checks", "fakeSpawnerUsed"]) === true
    && getBoolean(evidence, ["checks", "injectedSpawnerGuarded"]) === true
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
  return getNumber(evidence, ["counters", "fakeSpawnerSuccessCalls"]) === 1
    && getNumber(evidence, ["counters", "guardMissingSpawnCalls"]) === 0
    && getNumber(evidence, ["counters", "registryMismatchSpawnCalls"]) === 0
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
    .map(([name]) => `formal_readonly_provider_integration_local_closeout_${name}`);
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
  const input = await collectFormalReadonlyProviderIntegrationLocalCloseoutAuditInput();
  const review = reviewFormalReadonlyProviderIntegrationLocalCloseoutAudit(input);
  const format = process.argv.includes("--json") ? "json" : "text";

  console.log(formatFormalReadonlyProviderIntegrationLocalCloseoutAuditResult(review, format));

  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      "Formal read-only provider integration local closeout audit failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
