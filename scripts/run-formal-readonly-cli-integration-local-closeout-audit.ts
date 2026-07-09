#!/usr/bin/env node

import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const REQUIRED_PACKAGE_SCRIPTS = {
  governance: "node --import tsx scripts/run-governance-check.ts"
} as const;

const REQUIRED_DOCS = {
  pr14aPreflight:
    "docs/governance/PR_14A_FORMAL_READONLY_CLI_INTEGRATION_PREFLIGHT.md",
  pr14bAuthorization:
    "docs/governance/PR_14B_FORMAL_READONLY_CLI_INTEGRATION_AUTHORIZATION_PACKET.md",
  pr14cCloseout:
    "docs/governance/PR_14C_FORMAL_READONLY_CLI_INTEGRATION_LOCAL_CLOSEOUT.md"
} as const;

const REQUIRED_EVIDENCE = {
  readiness:
    "docs/evidence/codex-cli-formal-readonly-integration-readiness.json",
  authorization:
    "docs/evidence/codex-cli-formal-readonly-integration-authorization-acceptance.json"
} as const;

const FORBIDDEN_OUTPUT_MARKERS = [
  "APPROVE_FORMAL_CODEX_CLI_READONLY_PROVIDER_INTEGRATION_PR_14B",
  "npm run governance -- acceptance formal-readonly-integration",
  "APPROVE_FORMAL_CODEX_CLI_PROVIDER_INTEGRATION",
  "npm run smoke:readonly:real",
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

export interface FormalReadonlyIntegrationLocalCloseoutAuditInput {
  gitStatusShort: string;
  branch: string;
  packageJsonText: string;
  providerSourceText: string;
  pr14aPreflightText: string;
  pr14bAuthorizationText: string;
  pr14cCloseoutText: string;
  readinessEvidenceText: string;
  authorizationEvidenceText: string;
}

export interface FormalReadonlyIntegrationLocalCloseoutAuditResult {
  status: "passed" | "blocked";
  checks: {
    worktreeClean: boolean;
    branchMain: boolean;
    packageScriptsPresent: boolean;
    pr14aPreflightRecorded: boolean;
    pr14bAuthorizationRecorded: boolean;
    pr14cCloseoutRecorded: boolean;
    readinessEvidencePassed: boolean;
    authorizationEvidencePassed: boolean;
    providerGatePreserved: boolean;
    noProviderExecute: boolean;
    noRealCodexCli: boolean;
    noWorkspaceWriteExecute: boolean;
    evidenceSanitized: boolean;
    closeoutNonAuthorizing: boolean;
  };
  summary: {
    branch: string;
    packageScriptTargetCount: number;
    packageScriptMismatchCount: number;
    readinessStatus: string;
    authorizationExactPacket: boolean;
    providerExecuteCalls: number;
    realCodexCliCalls: number;
    workspaceWriteExecuteCalls: number;
    formalIntegrationAuthorized: boolean;
  };
  reasons: string[];
}

export type FormalReadonlyIntegrationLocalCloseoutAuditOutputFormat =
  "text" | "json";

export async function collectFormalReadonlyIntegrationLocalCloseoutAuditInput(
  cwd = process.cwd()
): Promise<FormalReadonlyIntegrationLocalCloseoutAuditInput> {
  const [gitStatusShort, branch] = await Promise.all([
    git(["status", "--short"], cwd),
    git(["branch", "--show-current"], cwd)
  ]);
  const read = (path: string) => readFile(join(cwd, path), "utf8");

  const [
    packageJsonText,
    providerSourceText,
    pr14aPreflightText,
    pr14bAuthorizationText,
    pr14cCloseoutText,
    readinessEvidenceText,
    authorizationEvidenceText
  ] = await Promise.all([
    read("package.json"),
    read("packages/providers/codex-cli/src/index.ts"),
    read(REQUIRED_DOCS.pr14aPreflight),
    read(REQUIRED_DOCS.pr14bAuthorization),
    read(REQUIRED_DOCS.pr14cCloseout),
    read(REQUIRED_EVIDENCE.readiness),
    read(REQUIRED_EVIDENCE.authorization)
  ]);

  return {
    gitStatusShort,
    branch: branch.trim(),
    packageJsonText,
    providerSourceText,
    pr14aPreflightText,
    pr14bAuthorizationText,
    pr14cCloseoutText,
    readinessEvidenceText,
    authorizationEvidenceText
  };
}

export function reviewFormalReadonlyIntegrationLocalCloseoutAudit(
  input: FormalReadonlyIntegrationLocalCloseoutAuditInput
): FormalReadonlyIntegrationLocalCloseoutAuditResult {
  const packageJson = parseObject(input.packageJsonText);
  const readinessEvidence = parseObject(input.readinessEvidenceText);
  const authorizationEvidence = parseObject(input.authorizationEvidenceText);
  const packageScriptReview = reviewPackageScripts(packageJson);
  const readinessCounters = readFormalReadinessCounters(readinessEvidence);
  const authorizationCounters = readAuthorizationCounters(authorizationEvidence);
  const providerExecuteCalls =
    readinessCounters.providerExecuteCalls + authorizationCounters.providerExecuteCalls;
  const realCodexCliCalls =
    readinessCounters.realCodexCliCalls + authorizationCounters.realCodexCliCalls;
  const workspaceWriteExecuteCalls =
    readinessCounters.workspaceWriteExecuteCalls
    + authorizationCounters.workspaceWriteExecuteCalls;
  const checks = {
    worktreeClean: input.gitStatusShort.trim() === "",
    branchMain: input.branch === "main",
    packageScriptsPresent: packageScriptReview.mismatchCount === 0,
    pr14aPreflightRecorded: pr14aPreflightRecorded(input.pr14aPreflightText),
    pr14bAuthorizationRecorded: pr14bAuthorizationRecorded(input.pr14bAuthorizationText),
    pr14cCloseoutRecorded: pr14cCloseoutRecorded(input.pr14cCloseoutText),
    readinessEvidencePassed: readinessEvidencePassed(readinessEvidence),
    authorizationEvidencePassed: authorizationEvidencePassed(authorizationEvidence),
    providerGatePreserved: providerGatePreserved(input.providerSourceText),
    noProviderExecute: providerExecuteCalls === 0,
    noRealCodexCli: realCodexCliCalls === 0,
    noWorkspaceWriteExecute: workspaceWriteExecuteCalls === 0,
    evidenceSanitized: evidenceIsSanitized(input.readinessEvidenceText, input.authorizationEvidenceText),
    closeoutNonAuthorizing: closeoutNonAuthorizing(input.pr14cCloseoutText)
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      branch: input.branch,
      packageScriptTargetCount: packageScriptReview.targetCount,
      packageScriptMismatchCount: packageScriptReview.mismatchCount,
      readinessStatus: getString(readinessEvidence, ["status"]) ?? "unknown",
      authorizationExactPacket:
        getBoolean(authorizationEvidence, ["checks", "exactAuthorizationAccepted"]) === true,
      providerExecuteCalls,
      realCodexCliCalls,
      workspaceWriteExecuteCalls,
      formalIntegrationAuthorized:
        getBoolean(readinessEvidence, ["summary", "formalIntegrationAuthorized"]) === true
    },
    reasons
  };
}

export function formatFormalReadonlyIntegrationLocalCloseoutAuditResult(
  review: FormalReadonlyIntegrationLocalCloseoutAuditResult,
  format: FormalReadonlyIntegrationLocalCloseoutAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Formal read-only CLI integration local closeout audit",
    `status: ${review.status}`,
    `branch: ${review.summary.branch}`,
    `package script targets: ${review.summary.packageScriptTargetCount}`,
    `package script mismatches: ${review.summary.packageScriptMismatchCount}`,
    `readiness status: ${review.summary.readinessStatus}`,
    `authorization exact packet: ${review.summary.authorizationExactPacket}`,
    `provider execute calls: ${review.summary.providerExecuteCalls}`,
    `real CLI calls: ${review.summary.realCodexCliCalls}`,
    `workspace-write execute calls: ${review.summary.workspaceWriteExecuteCalls}`,
    `formal integration authorized: ${review.summary.formalIntegrationAuthorized}`,
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

function pr14aPreflightRecorded(text: string): boolean {
  return text.includes("PR_14A_FORMAL_READONLY_CLI_INTEGRATION_PREFLIGHT_RECORDED")
    && text.includes(REQUIRED_EVIDENCE.readiness)
    && text.includes("not an authorization to invoke a real Codex CLI process")
    && text.includes("workspace-write remains closed");
}

function pr14bAuthorizationRecorded(text: string): boolean {
  return text.includes("PR_14B_FORMAL_READONLY_CLI_INTEGRATION_AUTHORIZATION_PACKET_RECORDED")
    && text.includes(REQUIRED_EVIDENCE.readiness)
    && text.includes("Provider execution and real CLI invocation must remain separate future gates")
    && text.includes("does not authorize or execute real provider execution");
}

function pr14cCloseoutRecorded(text: string): boolean {
  return text.includes("PR_14C_FORMAL_READONLY_CLI_INTEGRATION_LOCAL_CLOSEOUT_COMPLETE")
    && text.includes("npm run governance -- audit formal-readonly-integration-local -- --json")
    && text.includes(REQUIRED_EVIDENCE.readiness)
    && text.includes(REQUIRED_EVIDENCE.authorization);
}

function readinessEvidencePassed(evidence: Record<string, unknown> | undefined): boolean {
  return getString(evidence, ["schemaVersion"])
      === "codex-cli-formal-readonly-integration-readiness.v1"
    && getString(evidence, ["mode"]) === "formal-readonly-integration-readiness-local-only"
    && getString(evidence, ["status"]) === "passed"
    && getString(evidence, ["summary", "readiness"])
      === "formal_readonly_integration_preflight_ready"
    && getBoolean(evidence, ["checks", "dispatchEvidenceGuarded"]) === true
    && getBoolean(evidence, ["checks", "providerRequiresInjectedSpawner"]) === true
    && getBoolean(evidence, ["checks", "noProviderExecute"]) === true
    && getBoolean(evidence, ["checks", "noRealCodexCli"]) === true
    && getBoolean(evidence, ["checks", "noWorkspaceWriteExecute"]) === true
    && getBoolean(evidence, ["checks", "evidenceSanitized"]) === true
    && getBoolean(evidence, ["summary", "formalIntegrationAuthorized"]) === false;
}

function authorizationEvidencePassed(evidence: Record<string, unknown> | undefined): boolean {
  return getString(evidence, ["schemaVersion"])
      === "codex-cli-formal-readonly-integration-authorization-acceptance.v1"
    && getString(evidence, ["mode"])
      === "formal-readonly-integration-authorization-local-only"
    && getBoolean(evidence, ["checks", "exactAuthorizationAccepted"]) === true
    && getBoolean(evidence, ["checks", "broadenedAuthorizationBlocked"]) === true
    && getBoolean(evidence, ["checks", "executionAuthorizationRejected"]) === true
    && getBoolean(evidence, ["checks", "pushReleaseTagRejected"]) === true
    && getBoolean(evidence, ["checks", "noProviderExecute"]) === true
    && getBoolean(evidence, ["checks", "noRealCodexCli"]) === true
    && getBoolean(evidence, ["checks", "noWorkspaceWriteExecute"]) === true
    && getBoolean(evidence, ["checks", "leakCheckPassed"]) === true
    && getBoolean(evidence, ["summary", "providerExecutionMustRemainSeparate"]) === true
    && getBoolean(evidence, ["summary", "realCliInvocationMustRemainSeparate"]) === true;
}

function providerGatePreserved(source: string): boolean {
  return source.includes("this.executionEnabled = options.executionEnabled ?? false")
    && source.includes("throw new CodexCliProviderExecutionDisabledError()")
    && source.includes("preflight.checks.injectedSpawner !== true")
    && source.includes("codex_cli_provider_real_execute_preflight_requires_injected_spawner");
}

function closeoutNonAuthorizing(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ");
  return normalized.includes("does not authorize real Codex CLI invocation")
    && normalized.includes("does not authorize provider execution")
    && normalized.includes("does not authorize workspace-write")
    && normalized.includes("does not authorize push, release, or tag");
}

function evidenceIsSanitized(...texts: string[]): boolean {
  return !texts.some((text) =>
    FORBIDDEN_OUTPUT_MARKERS.some((marker) => text.includes(marker))
  );
}

function readFormalReadinessCounters(evidence: Record<string, unknown> | undefined): {
  providerExecuteCalls: number;
  realCodexCliCalls: number;
  workspaceWriteExecuteCalls: number;
} {
  return {
    providerExecuteCalls: getNumber(evidence, ["summary", "providerExecuteCalls"]) ?? 0,
    realCodexCliCalls: getNumber(evidence, ["summary", "realCodexCliCalls"]) ?? 0,
    workspaceWriteExecuteCalls:
      getNumber(evidence, ["summary", "workspaceWriteExecuteCalls"]) ?? 0
  };
}

function readAuthorizationCounters(evidence: Record<string, unknown> | undefined): {
  providerExecuteCalls: number;
  realCodexCliCalls: number;
  workspaceWriteExecuteCalls: number;
} {
  return {
    providerExecuteCalls: getNumber(evidence, ["counters", "providerExecuteCalls"]) ?? 0,
    realCodexCliCalls: getNumber(evidence, ["counters", "realCodexCliCalls"]) ?? 0,
    workspaceWriteExecuteCalls:
      getNumber(evidence, ["counters", "workspaceWriteExecuteCalls"]) ?? 0
  };
}

function collectReasons(checks: Record<string, boolean>): string[] {
  return Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([name]) => `formal_readonly_integration_local_closeout_${name}`);
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
  const input = await collectFormalReadonlyIntegrationLocalCloseoutAuditInput();
  const review = reviewFormalReadonlyIntegrationLocalCloseoutAudit(input);
  const format = process.argv.includes("--json") ? "json" : "text";

  console.log(formatFormalReadonlyIntegrationLocalCloseoutAuditResult(review, format));

  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      "Formal read-only CLI integration local closeout audit failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
