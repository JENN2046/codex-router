#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const PR_14B_FORMAL_READONLY_INTEGRATION_AUTHORIZATION_TOKEN =
  "APPROVE_FORMAL_CODEX_CLI_READONLY_PROVIDER_INTEGRATION_PR_14B";
export const PR_14B_FORMAL_READONLY_INTEGRATION_COMMAND =
  "npm run governance -- acceptance formal-readonly-integration";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const DEFAULT_EVIDENCE_PATH = join(
  __dirname,
  "..",
  "docs",
  "evidence",
  "codex-cli-formal-readonly-integration-authorization-acceptance.json"
);
const DEFAULT_GENERATED_AT = "2026-06-15T00:00:00.000Z";

export interface FormalReadonlyIntegrationAuthorizationInput {
  authorizationToken?: string;
  command?: string;
  providerId?: string;
  sandboxMode?: string;
  sideEffectClass?: string;
  approvalPolicy?: string;
  readinessEvidencePath?: string;
  injectedSpawnerRequired?: boolean;
  permitRequired?: boolean;
  registrySelectionRequired?: boolean;
  realExecutionAllowed?: boolean;
  providerExecuteAuthorized?: boolean;
  realCodexCliAuthorized?: boolean;
  workspaceWriteAuthorized?: boolean;
  pushAuthorized?: boolean;
  releaseAuthorized?: boolean;
  tagAuthorized?: boolean;
}

export interface FormalReadonlyIntegrationAuthorizationResult {
  ok: boolean;
  status: "authorized" | "blocked";
  reasons: string[];
  summary: {
    exactTokenMatched: boolean;
    exactCommandMatched: boolean;
    providerMatched: boolean;
    readOnlySandboxMatched: boolean;
    readOnlySideEffectMatched: boolean;
    approvalPolicyNeverMatched: boolean;
    readinessEvidenceDeclared: boolean;
    injectedSpawnerRequired: boolean;
    permitRequired: boolean;
    registrySelectionRequired: boolean;
    realExecutionAllowanceDeclared: boolean;
    providerExecuteDisallowed: boolean;
    realCodexCliDisallowed: boolean;
    workspaceWriteDisallowed: boolean;
    pushDisallowed: boolean;
    releaseDisallowed: boolean;
    tagDisallowed: boolean;
    providerExecuteCalls: 0;
    realCodexCliCalls: 0;
    workspaceWriteExecuteCalls: 0;
  };
}

export interface FormalReadonlyIntegrationAuthorizationAcceptanceEvidence {
  schemaVersion: "codex-cli-formal-readonly-integration-authorization-acceptance.v1";
  generatedAt: string;
  mode: "formal-readonly-integration-authorization-local-only";
  taskId: "codex-cli-formal-readonly-integration-authorization-acceptance";
  checks: {
    exactAuthorizationAccepted: boolean;
    missingAuthorizationBlocked: boolean;
    broadenedAuthorizationBlocked: boolean;
    executionAuthorizationRejected: boolean;
    pushReleaseTagRejected: boolean;
    noProviderExecute: boolean;
    noRealCodexCli: boolean;
    noWorkspaceWriteExecute: boolean;
    leakCheckPassed: boolean;
  };
  summary: {
    requiredProviderId: "codex-cli";
    requiredSandbox: "read-only";
    requiredSideEffectClass: "read_only";
    requiredApprovalPolicy: "never";
    readinessEvidencePathRequired: boolean;
    injectedSpawnerMustBeRequired: boolean;
    permitMustBeRequired: boolean;
    registrySelectionMustBeRequired: boolean;
    formalIntegrationAuthorizationOnly: true;
    providerExecutionMustRemainSeparate: true;
    realCliInvocationMustRemainSeparate: true;
    workspaceWriteMustRemainClosed: true;
    pushReleaseTagMustBeSeparate: true;
  };
  counters: {
    providerExecuteCalls: 0;
    realCodexCliCalls: 0;
    workspaceWriteExecuteCalls: 0;
  };
  blockingReasons: string[];
}

export interface FormalReadonlyIntegrationAuthorizationAcceptanceOptions {
  generatedAt?: string;
}

export function evaluateFormalReadonlyIntegrationAuthorization(
  input: FormalReadonlyIntegrationAuthorizationInput
): FormalReadonlyIntegrationAuthorizationResult {
  const exactTokenMatched =
    input.authorizationToken === PR_14B_FORMAL_READONLY_INTEGRATION_AUTHORIZATION_TOKEN;
  const exactCommandMatched =
    input.command === PR_14B_FORMAL_READONLY_INTEGRATION_COMMAND;
  const providerMatched = input.providerId === "codex-cli";
  const readOnlySandboxMatched = input.sandboxMode === "read-only";
  const readOnlySideEffectMatched = input.sideEffectClass === "read_only";
  const approvalPolicyNeverMatched = input.approvalPolicy === "never";
  const readinessEvidenceDeclared =
    input.readinessEvidencePath
      === "docs/evidence/codex-cli-formal-readonly-integration-readiness.json";
  const injectedSpawnerRequired = input.injectedSpawnerRequired === true;
  const permitRequired = input.permitRequired === true;
  const registrySelectionRequired = input.registrySelectionRequired === true;
  const realExecutionAllowanceDeclared = input.realExecutionAllowed === true;
  const providerExecuteDisallowed = input.providerExecuteAuthorized !== true;
  const realCodexCliDisallowed = input.realCodexCliAuthorized !== true;
  const workspaceWriteDisallowed = input.workspaceWriteAuthorized !== true;
  const pushDisallowed = input.pushAuthorized !== true;
  const releaseDisallowed = input.releaseAuthorized !== true;
  const tagDisallowed = input.tagAuthorized !== true;
  const reasons = [
    ...(exactTokenMatched
      ? []
      : ["formal_readonly_integration_authorization_exact_token_required"]),
    ...(exactCommandMatched
      ? []
      : ["formal_readonly_integration_authorization_exact_command_required"]),
    ...(providerMatched
      ? []
      : ["formal_readonly_integration_authorization_provider_codex_cli_required"]),
    ...(readOnlySandboxMatched
      ? []
      : ["formal_readonly_integration_authorization_read_only_sandbox_required"]),
    ...(readOnlySideEffectMatched
      ? []
      : ["formal_readonly_integration_authorization_read_only_side_effect_required"]),
    ...(approvalPolicyNeverMatched
      ? []
      : ["formal_readonly_integration_authorization_approval_never_required"]),
    ...(readinessEvidenceDeclared
      ? []
      : ["formal_readonly_integration_authorization_readiness_evidence_required"]),
    ...(injectedSpawnerRequired
      ? []
      : ["formal_readonly_integration_authorization_injected_spawner_required"]),
    ...(permitRequired
      ? []
      : ["formal_readonly_integration_authorization_permit_required"]),
    ...(registrySelectionRequired
      ? []
      : ["formal_readonly_integration_authorization_registry_selection_required"]),
    ...(realExecutionAllowanceDeclared
      ? []
      : ["formal_readonly_integration_authorization_real_execution_allowance_required"]),
    ...(providerExecuteDisallowed
      ? []
      : ["formal_readonly_integration_authorization_provider_execute_must_be_separate"]),
    ...(realCodexCliDisallowed
      ? []
      : ["formal_readonly_integration_authorization_real_cli_must_be_separate"]),
    ...(workspaceWriteDisallowed
      ? []
      : ["formal_readonly_integration_authorization_workspace_write_must_remain_closed"]),
    ...(pushDisallowed
      ? []
      : ["formal_readonly_integration_authorization_push_must_be_separate"]),
    ...(releaseDisallowed
      ? []
      : ["formal_readonly_integration_authorization_release_must_be_separate"]),
    ...(tagDisallowed
      ? []
      : ["formal_readonly_integration_authorization_tag_must_be_separate"])
  ];
  const uniqueReasons = uniqueStrings(reasons);

  return {
    ok: uniqueReasons.length === 0,
    status: uniqueReasons.length === 0 ? "authorized" : "blocked",
    reasons: uniqueReasons,
    summary: {
      exactTokenMatched,
      exactCommandMatched,
      providerMatched,
      readOnlySandboxMatched,
      readOnlySideEffectMatched,
      approvalPolicyNeverMatched,
      readinessEvidenceDeclared,
      injectedSpawnerRequired,
      permitRequired,
      registrySelectionRequired,
      realExecutionAllowanceDeclared,
      providerExecuteDisallowed,
      realCodexCliDisallowed,
      workspaceWriteDisallowed,
      pushDisallowed,
      releaseDisallowed,
      tagDisallowed,
      providerExecuteCalls: 0,
      realCodexCliCalls: 0,
      workspaceWriteExecuteCalls: 0
    }
  };
}

export async function runFormalReadonlyIntegrationAuthorizationAcceptance(
  options: FormalReadonlyIntegrationAuthorizationAcceptanceOptions = {}
): Promise<FormalReadonlyIntegrationAuthorizationAcceptanceEvidence> {
  const generatedAt = options.generatedAt ?? DEFAULT_GENERATED_AT;
  const exactAuthorization = evaluateFormalReadonlyIntegrationAuthorization({
    authorizationToken: PR_14B_FORMAL_READONLY_INTEGRATION_AUTHORIZATION_TOKEN,
    command: PR_14B_FORMAL_READONLY_INTEGRATION_COMMAND,
    providerId: "codex-cli",
    sandboxMode: "read-only",
    sideEffectClass: "read_only",
    approvalPolicy: "never",
    readinessEvidencePath:
      "docs/evidence/codex-cli-formal-readonly-integration-readiness.json",
    injectedSpawnerRequired: true,
    permitRequired: true,
    registrySelectionRequired: true,
    realExecutionAllowed: true,
    providerExecuteAuthorized: false,
    realCodexCliAuthorized: false,
    workspaceWriteAuthorized: false,
    pushAuthorized: false,
    releaseAuthorized: false,
    tagAuthorized: false
  });
  const missingAuthorization = evaluateFormalReadonlyIntegrationAuthorization({});
  const broadenedAuthorization = evaluateFormalReadonlyIntegrationAuthorization({
    authorizationToken: "APPROVE_FORMAL_CODEX_CLI_PROVIDER_INTEGRATION",
    command: "npm run smoke:readonly:real",
    providerId: "codex-cli",
    sandboxMode: "workspace-write",
    sideEffectClass: "workspace_write",
    approvalPolicy: "on-request",
    readinessEvidencePath:
      "docs/evidence/codex-cli-formal-readonly-integration-readiness.json",
    injectedSpawnerRequired: false,
    permitRequired: false,
    registrySelectionRequired: false,
    realExecutionAllowed: true,
    providerExecuteAuthorized: false,
    realCodexCliAuthorized: false,
    workspaceWriteAuthorized: true
  });
  const executionAuthorization = evaluateFormalReadonlyIntegrationAuthorization({
    authorizationToken: PR_14B_FORMAL_READONLY_INTEGRATION_AUTHORIZATION_TOKEN,
    command: PR_14B_FORMAL_READONLY_INTEGRATION_COMMAND,
    providerId: "codex-cli",
    sandboxMode: "read-only",
    sideEffectClass: "read_only",
    approvalPolicy: "never",
    readinessEvidencePath:
      "docs/evidence/codex-cli-formal-readonly-integration-readiness.json",
    injectedSpawnerRequired: true,
    permitRequired: true,
    registrySelectionRequired: true,
    realExecutionAllowed: true,
    providerExecuteAuthorized: true,
    realCodexCliAuthorized: true,
    workspaceWriteAuthorized: false
  });
  const pushReleaseTagAuthorization = evaluateFormalReadonlyIntegrationAuthorization({
    authorizationToken: PR_14B_FORMAL_READONLY_INTEGRATION_AUTHORIZATION_TOKEN,
    command: PR_14B_FORMAL_READONLY_INTEGRATION_COMMAND,
    providerId: "codex-cli",
    sandboxMode: "read-only",
    sideEffectClass: "read_only",
    approvalPolicy: "never",
    readinessEvidencePath:
      "docs/evidence/codex-cli-formal-readonly-integration-readiness.json",
    injectedSpawnerRequired: true,
    permitRequired: true,
    registrySelectionRequired: true,
    realExecutionAllowed: true,
    pushAuthorized: true,
    releaseAuthorized: true,
    tagAuthorized: true
  });
  const counters = {
    providerExecuteCalls: 0 as const,
    realCodexCliCalls: 0 as const,
    workspaceWriteExecuteCalls: 0 as const
  };
  const evidenceWithoutLeakCheck: Omit<
    FormalReadonlyIntegrationAuthorizationAcceptanceEvidence,
    "checks"
  > & {
    checks: Omit<
      FormalReadonlyIntegrationAuthorizationAcceptanceEvidence["checks"],
      "leakCheckPassed"
    >;
  } = {
    schemaVersion: "codex-cli-formal-readonly-integration-authorization-acceptance.v1",
    generatedAt,
    mode: "formal-readonly-integration-authorization-local-only",
    taskId: "codex-cli-formal-readonly-integration-authorization-acceptance",
    checks: {
      exactAuthorizationAccepted: exactAuthorization.status === "authorized",
      missingAuthorizationBlocked: missingAuthorization.status === "blocked"
        && missingAuthorization.reasons.includes(
          "formal_readonly_integration_authorization_exact_token_required"
        )
        && missingAuthorization.reasons.includes(
          "formal_readonly_integration_authorization_readiness_evidence_required"
        ),
      broadenedAuthorizationBlocked: broadenedAuthorization.status === "blocked"
        && broadenedAuthorization.reasons.includes(
          "formal_readonly_integration_authorization_read_only_sandbox_required"
        )
        && broadenedAuthorization.reasons.includes(
          "formal_readonly_integration_authorization_workspace_write_must_remain_closed"
        ),
      executionAuthorizationRejected: executionAuthorization.status === "blocked"
        && executionAuthorization.reasons.includes(
          "formal_readonly_integration_authorization_provider_execute_must_be_separate"
        )
        && executionAuthorization.reasons.includes(
          "formal_readonly_integration_authorization_real_cli_must_be_separate"
        ),
      pushReleaseTagRejected: pushReleaseTagAuthorization.status === "blocked"
        && pushReleaseTagAuthorization.reasons.includes(
          "formal_readonly_integration_authorization_push_must_be_separate"
        )
        && pushReleaseTagAuthorization.reasons.includes(
          "formal_readonly_integration_authorization_release_must_be_separate"
        )
        && pushReleaseTagAuthorization.reasons.includes(
          "formal_readonly_integration_authorization_tag_must_be_separate"
        ),
      noProviderExecute: counters.providerExecuteCalls === 0,
      noRealCodexCli: counters.realCodexCliCalls === 0,
      noWorkspaceWriteExecute: counters.workspaceWriteExecuteCalls === 0
    },
    summary: {
      requiredProviderId: "codex-cli",
      requiredSandbox: "read-only",
      requiredSideEffectClass: "read_only",
      requiredApprovalPolicy: "never",
      readinessEvidencePathRequired: true,
      injectedSpawnerMustBeRequired: true,
      permitMustBeRequired: true,
      registrySelectionMustBeRequired: true,
      formalIntegrationAuthorizationOnly: true,
      providerExecutionMustRemainSeparate: true,
      realCliInvocationMustRemainSeparate: true,
      workspaceWriteMustRemainClosed: true,
      pushReleaseTagMustBeSeparate: true
    },
    counters,
    blockingReasons: uniqueStrings([
      ...missingAuthorization.reasons,
      ...broadenedAuthorization.reasons,
      ...executionAuthorization.reasons,
      ...pushReleaseTagAuthorization.reasons
    ])
  };
  const leakCheckPassed = !containsForbiddenMarkers(evidenceWithoutLeakCheck);

  return {
    ...evidenceWithoutLeakCheck,
    checks: {
      ...evidenceWithoutLeakCheck.checks,
      leakCheckPassed
    }
  };
}

export async function writeFormalReadonlyIntegrationAuthorizationAcceptanceEvidence(
  evidence: FormalReadonlyIntegrationAuthorizationAcceptanceEvidence,
  evidencePath = DEFAULT_EVIDENCE_PATH
): Promise<{
  path: string;
  evidence: FormalReadonlyIntegrationAuthorizationAcceptanceEvidence;
}> {
  await mkdir(dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  return {
    path: evidencePath,
    evidence
  };
}

function containsForbiddenMarkers(value: unknown): boolean {
  const serialized = JSON.stringify(value);
  return [
    PR_14B_FORMAL_READONLY_INTEGRATION_AUTHORIZATION_TOKEN,
    PR_14B_FORMAL_READONLY_INTEGRATION_COMMAND,
    "APPROVE_FORMAL_CODEX_CLI_PROVIDER_INTEGRATION",
    "npm run smoke:readonly:real",
    "workspace-write",
    "on-request",
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
  ].some((marker) => serialized.includes(marker));
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

async function main(): Promise<void> {
  const outputIdx = process.argv.indexOf("--output");
  const outputPath = outputIdx >= 0
    ? process.argv[outputIdx + 1]!
    : DEFAULT_EVIDENCE_PATH;
  const evidence = await runFormalReadonlyIntegrationAuthorizationAcceptance();
  const write = await writeFormalReadonlyIntegrationAuthorizationAcceptanceEvidence(
    evidence,
    outputPath
  );

  console.log("Codex CLI formal read-only integration authorization acceptance");
  console.log(`exact authorization accepted: ${evidence.checks.exactAuthorizationAccepted}`);
  console.log(`broadened authorization blocked: ${evidence.checks.broadenedAuthorizationBlocked}`);
  console.log(`execution authorization rejected: ${evidence.checks.executionAuthorizationRejected}`);
  console.log(`real Codex CLI calls: ${evidence.counters.realCodexCliCalls}`);
  console.log(`workspace-write execute: ${evidence.counters.workspaceWriteExecuteCalls}`);
  console.log(`leak check: ${evidence.checks.leakCheckPassed}`);
  console.log(`evidence: ${write.path}`);

  if (!Object.values(evidence.checks).every(Boolean)) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      "Codex CLI formal read-only integration authorization acceptance failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
