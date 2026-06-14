#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const DEFAULT_EVIDENCE_PATH = join(
  __dirname,
  "..",
  "docs",
  "evidence",
  "codex-cli-formal-readonly-integration-readiness.json"
);
const DEFAULT_GENERATED_AT = "2026-06-15T00:00:00.000Z";

const REQUIRED_PACKAGE_SCRIPTS = {
  "acceptance:real-readonly-dispatch":
    "tsx scripts/run-real-readonly-dispatch-acceptance.ts",
  "acceptance:formal-readonly-integration":
    "tsx scripts/run-formal-readonly-cli-integration-readiness.ts",
  "acceptance:real-readonly-smoke-auth":
    "tsx scripts/run-real-readonly-smoke-authorization-acceptance.ts",
  "audit:real-readonly-smoke-local":
    "tsx scripts/run-real-readonly-smoke-local-closeout-audit.ts"
} as const;

const FORBIDDEN_EVIDENCE_MARKERS = [
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

export interface FormalReadonlyCliIntegrationReadinessInput {
  packageJsonText: string;
  providerSourceText: string;
  dispatchEvidenceText: string;
  smokeEvidenceText: string;
  smokeAuthorizationEvidenceText: string;
  pr13bCloseoutText: string;
  pr14aPreflightText: string;
}

export interface FormalReadonlyCliIntegrationReadinessEvidence {
  schemaVersion: "codex-cli-formal-readonly-integration-readiness.v1";
  generatedAt: string;
  mode: "formal-readonly-integration-readiness-local-only";
  status: "passed" | "blocked";
  checks: {
    packageScriptsPresent: boolean;
    pr13aSmokePassed: boolean;
    pr13aAuthorizationLocalOnly: boolean;
    pr13bDispatchControlRecorded: boolean;
    dispatchEvidenceGuarded: boolean;
    providerRequiresInjectedSpawner: boolean;
    providerDefaultExecuteDisabled: boolean;
    pr14aPreflightRecorded: boolean;
    noProviderExecute: boolean;
    noRealCodexCli: boolean;
    noWorkspaceWriteExecute: boolean;
    evidenceSanitized: boolean;
  };
  summary: {
    readiness: "formal_readonly_integration_preflight_ready" | "blocked";
    providerId: "codex-cli";
    requiredSandbox: "read-only";
    requiredSideEffectClass: "read_only";
    requiredApprovalPolicy: "never";
    injectedSpawnerRequired: boolean;
    permitRequired: boolean;
    registrySelectionRequired: boolean;
    workspaceWriteAllowed: false;
    formalIntegrationAuthorized: false;
    providerExecuteCalls: 0;
    realCodexCliCalls: 0;
    workspaceWriteExecuteCalls: 0;
  };
  blockingReasons: string[];
}

export interface FormalReadonlyCliIntegrationReadinessOptions {
  generatedAt?: string;
}

export async function collectFormalReadonlyCliIntegrationReadinessInput(
  cwd = process.cwd()
): Promise<FormalReadonlyCliIntegrationReadinessInput> {
  const read = (path: string) => readFile(join(cwd, path), "utf8");

  const [
    packageJsonText,
    providerSourceText,
    dispatchEvidenceText,
    smokeEvidenceText,
    smokeAuthorizationEvidenceText,
    pr13bCloseoutText,
    pr14aPreflightText
  ] = await Promise.all([
    read("package.json"),
    read("packages/providers/codex-cli/src/index.ts"),
    read("docs/evidence/codex-cli-real-readonly-dispatch-acceptance.json"),
    read("docs/evidence/codex-cli-real-readonly-smoke.json"),
    read("docs/evidence/codex-cli-real-readonly-smoke-authorization-acceptance.json"),
    read("docs/governance/PR_13B_REAL_READONLY_DISPATCH_CONTROL_LOCAL_CLOSEOUT.md"),
    read("docs/governance/PR_14A_FORMAL_READONLY_CLI_INTEGRATION_PREFLIGHT.md")
  ]);

  return {
    packageJsonText,
    providerSourceText,
    dispatchEvidenceText,
    smokeEvidenceText,
    smokeAuthorizationEvidenceText,
    pr13bCloseoutText,
    pr14aPreflightText
  };
}

export function reviewFormalReadonlyCliIntegrationReadiness(
  input: FormalReadonlyCliIntegrationReadinessInput,
  options: FormalReadonlyCliIntegrationReadinessOptions = {}
): FormalReadonlyCliIntegrationReadinessEvidence {
  const packageJson = parseObject(input.packageJsonText);
  const dispatchEvidence = parseObject(input.dispatchEvidenceText);
  const smokeEvidence = parseObject(input.smokeEvidenceText);
  const authEvidence = parseObject(input.smokeAuthorizationEvidenceText);
  const checks = {
    packageScriptsPresent: packageScriptsPresent(packageJson),
    pr13aSmokePassed: pr13aSmokePassed(smokeEvidence),
    pr13aAuthorizationLocalOnly: pr13aAuthorizationLocalOnly(authEvidence),
    pr13bDispatchControlRecorded: pr13bDispatchControlRecorded(input.pr13bCloseoutText),
    dispatchEvidenceGuarded: dispatchEvidenceGuarded(dispatchEvidence),
    providerRequiresInjectedSpawner: providerRequiresInjectedSpawner(input.providerSourceText),
    providerDefaultExecuteDisabled: providerDefaultExecuteDisabled(input.providerSourceText),
    pr14aPreflightRecorded: pr14aPreflightRecorded(input.pr14aPreflightText),
    noProviderExecute: true,
    noRealCodexCli: true,
    noWorkspaceWriteExecute: true,
    evidenceSanitized: false
  };
  const evidenceWithoutLeakCheck = {
    schemaVersion: "codex-cli-formal-readonly-integration-readiness.v1" as const,
    generatedAt: options.generatedAt ?? DEFAULT_GENERATED_AT,
    mode: "formal-readonly-integration-readiness-local-only" as const,
    status: "blocked" as const,
    checks,
    summary: {
      readiness: "blocked" as const,
      providerId: "codex-cli" as const,
      requiredSandbox: "read-only" as const,
      requiredSideEffectClass: "read_only" as const,
      requiredApprovalPolicy: "never" as const,
      injectedSpawnerRequired: true,
      permitRequired: true,
      registrySelectionRequired: true,
      workspaceWriteAllowed: false as const,
      formalIntegrationAuthorized: false as const,
      providerExecuteCalls: 0 as const,
      realCodexCliCalls: 0 as const,
      workspaceWriteExecuteCalls: 0 as const
    },
    blockingReasons: collectBlockingReasons(checks)
  };
  const evidenceSanitized = !containsForbiddenMarkers(evidenceWithoutLeakCheck);
  const finalChecks = {
    ...checks,
    evidenceSanitized
  };
  const blockingReasons = collectBlockingReasons(finalChecks);
  const status = blockingReasons.length === 0 ? "passed" : "blocked";

  return {
    ...evidenceWithoutLeakCheck,
    status,
    checks: finalChecks,
    summary: {
      ...evidenceWithoutLeakCheck.summary,
      readiness: status === "passed"
        ? "formal_readonly_integration_preflight_ready"
        : "blocked"
    },
    blockingReasons
  };
}

export async function writeFormalReadonlyCliIntegrationReadinessEvidence(
  evidence: FormalReadonlyCliIntegrationReadinessEvidence,
  evidencePath = DEFAULT_EVIDENCE_PATH
): Promise<{
  path: string;
  evidence: FormalReadonlyCliIntegrationReadinessEvidence;
}> {
  await mkdir(dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  return {
    path: evidencePath,
    evidence
  };
}

export async function runFormalReadonlyCliIntegrationReadiness(
  options: FormalReadonlyCliIntegrationReadinessOptions = {}
): Promise<FormalReadonlyCliIntegrationReadinessEvidence> {
  return reviewFormalReadonlyCliIntegrationReadiness(
    await collectFormalReadonlyCliIntegrationReadinessInput(),
    options
  );
}

function packageScriptsPresent(packageJson: Record<string, unknown> | undefined): boolean {
  const scripts = packageJson?.scripts;
  return isRecord(scripts)
    && Object.entries(REQUIRED_PACKAGE_SCRIPTS).every(
      ([name, command]) => scripts[name] === command
    );
}

function pr13aSmokePassed(evidence: Record<string, unknown> | undefined): boolean {
  return getString(evidence, ["schemaVersion"]) === "codex-cli-real-readonly-smoke-gate.v1"
    && getString(evidence, ["mode"]) === "real-readonly-smoke"
    && getString(evidence, ["status"]) === "passed"
    && getBoolean(evidence, ["checks", "operatorFlagPresent"]) === true
    && getBoolean(evidence, ["checks", "runnerInvoked"]) === true
    && getBoolean(evidence, ["checks", "readOnlySandbox"]) === true
    && getBoolean(evidence, ["checks", "approvalPolicyNever"]) === true
    && getBoolean(evidence, ["checks", "noWorkspaceWrite"]) === true
    && getBoolean(evidence, ["checks", "noFileWrite"]) === true
    && getBoolean(evidence, ["checks", "sanitizedEvidence"]) === true
    && getString(evidence, ["plan", "sandbox"]) === "read-only"
    && getString(evidence, ["plan", "approvalPolicy"]) === "never"
    && getString(evidence, ["run", "status"]) === "completed"
    && getNumber(evidence, ["run", "exitCode"]) === 0;
}

function pr13aAuthorizationLocalOnly(evidence: Record<string, unknown> | undefined): boolean {
  return getString(evidence, ["schemaVersion"])
      === "codex-cli-real-readonly-smoke-authorization-acceptance.v1"
    && getString(evidence, ["mode"]) === "real-readonly-smoke-authorization-local-only"
    && getBoolean(evidence, ["checks", "exactAuthorizationAccepted"]) === true
    && getBoolean(evidence, ["checks", "broadenedAuthorizationBlocked"]) === true
    && getBoolean(evidence, ["checks", "pushReleaseTagRejected"]) === true
    && getBoolean(evidence, ["checks", "noProviderExecute"]) === true
    && getBoolean(evidence, ["checks", "noRealCodexCli"]) === true
    && getBoolean(evidence, ["checks", "noWorkspaceWriteExecute"]) === true
    && getBoolean(evidence, ["checks", "leakCheckPassed"]) === true;
}

function pr13bDispatchControlRecorded(text: string): boolean {
  return text.includes("PR_13B_REAL_READONLY_DISPATCH_CONTROL_LOCAL_CLOSEOUT_COMPLETE")
    && text.includes("environmentPreflight.checks.injectedSpawner === true")
    && text.includes("codex_cli_provider_real_execute_preflight_requires_injected_spawner")
    && text.includes("does not authorize that stage or execute a real CLI");
}

function dispatchEvidenceGuarded(evidence: Record<string, unknown> | undefined): boolean {
  return getString(evidence, ["schemaVersion"]) === "codex-cli-real-readonly-dispatch-acceptance.v1"
    && getString(evidence, ["mode"]) === "real-readonly-provider-dispatch-fake"
    && getBoolean(evidence, ["checks", "dispatchOk"]) === true
    && getBoolean(evidence, ["checks", "fakeSpawnerUsed"]) === true
    && getBoolean(evidence, ["checks", "injectedSpawnerGuarded"]) === true
    && getBoolean(evidence, ["checks", "guardMissingBlocked"]) === true
    && getBoolean(evidence, ["checks", "registryMismatchBlocked"]) === true
    && getBoolean(evidence, ["checks", "workspaceWriteBlocked"]) === true
    && getBoolean(evidence, ["checks", "noRealCodexCli"]) === true
    && getBoolean(evidence, ["checks", "leakCheckPassed"]) === true
    && getNumber(evidence, ["counters", "successSpawnCalls"]) === 1
    && getNumber(evidence, ["counters", "guardMissingSpawnCalls"]) === 0
    && getNumber(evidence, ["counters", "registryMismatchSpawnCalls"]) === 0
    && getNumber(evidence, ["counters", "workspaceWriteSpawnCalls"]) === 0;
}

function providerRequiresInjectedSpawner(source: string): boolean {
  return source.includes("preflight.checks.injectedSpawner !== true")
    && source.includes("codex_cli_provider_real_execute_preflight_requires_injected_spawner");
}

function providerDefaultExecuteDisabled(source: string): boolean {
  return source.includes("this.executionEnabled = options.executionEnabled ?? false")
    && source.includes("throw new CodexCliProviderExecutionDisabledError()");
}

function pr14aPreflightRecorded(text: string): boolean {
  return text.includes("PR_14A_FORMAL_READONLY_CLI_INTEGRATION_PREFLIGHT_RECORDED")
    && text.includes("not an authorization to invoke a real Codex CLI process")
    && text.includes("workspace-write remains closed")
    && text.includes("Formal integration remains disabled until a later exact authorization");
}

function collectBlockingReasons(checks: Record<string, boolean>): string[] {
  return Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([name]) => `formal_readonly_integration_readiness_${name}`);
}

function containsForbiddenMarkers(value: unknown): boolean {
  const serialized = JSON.stringify(value);
  return FORBIDDEN_EVIDENCE_MARKERS.some((marker) => serialized.includes(marker));
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
  const outputIdx = process.argv.indexOf("--output");
  const outputPath = outputIdx >= 0
    ? process.argv[outputIdx + 1]!
    : DEFAULT_EVIDENCE_PATH;
  const evidence = await runFormalReadonlyCliIntegrationReadiness();
  const write = await writeFormalReadonlyCliIntegrationReadinessEvidence(
    evidence,
    outputPath
  );

  console.log("Codex CLI formal read-only integration readiness");
  console.log(`status: ${evidence.status}`);
  console.log(`readiness: ${evidence.summary.readiness}`);
  console.log(`real Codex CLI calls: ${evidence.summary.realCodexCliCalls}`);
  console.log(`workspace-write execute: ${evidence.summary.workspaceWriteExecuteCalls}`);
  console.log(`formal integration authorized: ${evidence.summary.formalIntegrationAuthorized}`);
  console.log(`evidence: ${write.path}`);

  if (evidence.status !== "passed") {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      "Codex CLI formal read-only integration readiness failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
