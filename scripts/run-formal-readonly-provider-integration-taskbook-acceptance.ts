#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const PR_15A_FORMAL_READONLY_PROVIDER_INTEGRATION_TOKEN =
  "APPROVE_FORMAL_CODEX_CLI_READONLY_PROVIDER_INTEGRATION_PR_15A";
export const PR_15A_FORMAL_READONLY_PROVIDER_INTEGRATION_TASKBOOK =
  "docs/governance/PR_15A_FORMAL_READONLY_PROVIDER_INTEGRATION_TASKBOOK.md";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const DEFAULT_EVIDENCE_PATH = join(
  __dirname,
  "..",
  "docs",
  "evidence",
  "codex-cli-formal-readonly-provider-integration-taskbook-acceptance.json"
);
const DEFAULT_GENERATED_AT = "2026-06-15T00:00:00.000Z";

export interface FormalReadonlyProviderIntegrationTaskbookInput {
  authorizationToken?: string;
  taskbookPath?: string;
  implementationScope?: string;
  providerId?: string;
  sandboxMode?: string;
  sideEffectClass?: string;
  approvalPolicy?: string;
  pr14ReadinessEvidencePath?: string;
  pr14AuthorizationEvidencePath?: string;
  localOnly?: boolean;
  registrySelectionRequired?: boolean;
  providerPermitRequired?: boolean;
  injectedSpawnerRequired?: boolean;
  fakeSpawnerTestsRequired?: boolean;
  sanitizedEvidenceRequired?: boolean;
  realCodexCliAllowed?: boolean;
  workspaceWriteAllowed?: boolean;
  localCommandAllowed?: boolean;
  protectedRemoteAllowed?: boolean;
  pushAuthorized?: boolean;
  releaseAuthorized?: boolean;
  tagAuthorized?: boolean;
}

export interface FormalReadonlyProviderIntegrationTaskbookResult {
  ok: boolean;
  status: "accepted" | "blocked";
  reasons: string[];
  summary: {
    exactTokenMatched: boolean;
    exactTaskbookMatched: boolean;
    implementationScopeMatched: boolean;
    providerMatched: boolean;
    readOnlySandboxMatched: boolean;
    readOnlySideEffectMatched: boolean;
    approvalPolicyNeverMatched: boolean;
    pr14ReadinessEvidenceDeclared: boolean;
    pr14AuthorizationEvidenceDeclared: boolean;
    localOnly: boolean;
    registrySelectionRequired: boolean;
    providerPermitRequired: boolean;
    injectedSpawnerRequired: boolean;
    fakeSpawnerTestsRequired: boolean;
    sanitizedEvidenceRequired: boolean;
    realCodexCliDisallowed: boolean;
    workspaceWriteDisallowed: boolean;
    localCommandDisallowed: boolean;
    protectedRemoteDisallowed: boolean;
    pushDisallowed: boolean;
    releaseDisallowed: boolean;
    tagDisallowed: boolean;
    providerExecuteCalls: 0;
    realCodexCliCalls: 0;
    workspaceWriteExecuteCalls: 0;
  };
}

export interface FormalReadonlyProviderIntegrationTaskbookAcceptanceEvidence {
  schemaVersion: "codex-cli-formal-readonly-provider-integration-taskbook-acceptance.v1";
  generatedAt: string;
  mode: "formal-readonly-provider-integration-taskbook-local-only";
  taskId: "codex-cli-formal-readonly-provider-integration-taskbook-acceptance";
  checks: {
    exactTaskbookAccepted: boolean;
    missingTaskbookBlocked: boolean;
    broadenedScopeBlocked: boolean;
    forbiddenExecutionBlocked: boolean;
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
    pr14ReadinessEvidenceRequired: true;
    pr14AuthorizationEvidenceRequired: true;
    registrySelectionMustBeRequired: true;
    providerPermitMustBeRequired: true;
    injectedSpawnerMustBeRequired: true;
    fakeSpawnerTestsMustBeRequired: true;
    sanitizedEvidenceMustBeRequired: true;
    localTaskbookOnly: true;
    realCliInvocationMustRemainClosed: true;
    workspaceWriteMustRemainClosed: true;
    localCommandMustRemainClosed: true;
    protectedRemoteMustRemainClosed: true;
    pushReleaseTagMustBeSeparate: true;
  };
  counters: {
    providerExecuteCalls: 0;
    realCodexCliCalls: 0;
    workspaceWriteExecuteCalls: 0;
  };
  blockingReasons: string[];
}

export interface FormalReadonlyProviderIntegrationTaskbookAcceptanceOptions {
  generatedAt?: string;
}

export function evaluateFormalReadonlyProviderIntegrationTaskbook(
  input: FormalReadonlyProviderIntegrationTaskbookInput
): FormalReadonlyProviderIntegrationTaskbookResult {
  const exactTokenMatched =
    input.authorizationToken === PR_15A_FORMAL_READONLY_PROVIDER_INTEGRATION_TOKEN;
  const exactTaskbookMatched =
    input.taskbookPath === PR_15A_FORMAL_READONLY_PROVIDER_INTEGRATION_TASKBOOK;
  const implementationScopeMatched =
    input.implementationScope === "formal-readonly-provider-integration-local-only";
  const providerMatched = input.providerId === "codex-cli";
  const readOnlySandboxMatched = input.sandboxMode === "read-only";
  const readOnlySideEffectMatched = input.sideEffectClass === "read_only";
  const approvalPolicyNeverMatched = input.approvalPolicy === "never";
  const pr14ReadinessEvidenceDeclared =
    input.pr14ReadinessEvidencePath
      === "docs/evidence/codex-cli-formal-readonly-integration-readiness.json";
  const pr14AuthorizationEvidenceDeclared =
    input.pr14AuthorizationEvidencePath
      === "docs/evidence/codex-cli-formal-readonly-integration-authorization-acceptance.json";
  const localOnly = input.localOnly === true;
  const registrySelectionRequired = input.registrySelectionRequired === true;
  const providerPermitRequired = input.providerPermitRequired === true;
  const injectedSpawnerRequired = input.injectedSpawnerRequired === true;
  const fakeSpawnerTestsRequired = input.fakeSpawnerTestsRequired === true;
  const sanitizedEvidenceRequired = input.sanitizedEvidenceRequired === true;
  const realCodexCliDisallowed = input.realCodexCliAllowed !== true;
  const workspaceWriteDisallowed = input.workspaceWriteAllowed !== true;
  const localCommandDisallowed = input.localCommandAllowed !== true;
  const protectedRemoteDisallowed = input.protectedRemoteAllowed !== true;
  const pushDisallowed = input.pushAuthorized !== true;
  const releaseDisallowed = input.releaseAuthorized !== true;
  const tagDisallowed = input.tagAuthorized !== true;
  const reasons = [
    ...(exactTokenMatched
      ? []
      : ["formal_readonly_provider_integration_exact_token_required"]),
    ...(exactTaskbookMatched
      ? []
      : ["formal_readonly_provider_integration_exact_taskbook_required"]),
    ...(implementationScopeMatched
      ? []
      : ["formal_readonly_provider_integration_local_scope_required"]),
    ...(providerMatched
      ? []
      : ["formal_readonly_provider_integration_provider_codex_cli_required"]),
    ...(readOnlySandboxMatched
      ? []
      : ["formal_readonly_provider_integration_read_only_sandbox_required"]),
    ...(readOnlySideEffectMatched
      ? []
      : ["formal_readonly_provider_integration_read_only_side_effect_required"]),
    ...(approvalPolicyNeverMatched
      ? []
      : ["formal_readonly_provider_integration_approval_never_required"]),
    ...(pr14ReadinessEvidenceDeclared
      ? []
      : ["formal_readonly_provider_integration_pr14_readiness_required"]),
    ...(pr14AuthorizationEvidenceDeclared
      ? []
      : ["formal_readonly_provider_integration_pr14_authorization_required"]),
    ...(localOnly ? [] : ["formal_readonly_provider_integration_local_only_required"]),
    ...(registrySelectionRequired
      ? []
      : ["formal_readonly_provider_integration_registry_selection_required"]),
    ...(providerPermitRequired
      ? []
      : ["formal_readonly_provider_integration_provider_permit_required"]),
    ...(injectedSpawnerRequired
      ? []
      : ["formal_readonly_provider_integration_injected_spawner_required"]),
    ...(fakeSpawnerTestsRequired
      ? []
      : ["formal_readonly_provider_integration_fake_spawner_tests_required"]),
    ...(sanitizedEvidenceRequired
      ? []
      : ["formal_readonly_provider_integration_sanitized_evidence_required"]),
    ...(realCodexCliDisallowed
      ? []
      : ["formal_readonly_provider_integration_real_cli_must_remain_closed"]),
    ...(workspaceWriteDisallowed
      ? []
      : ["formal_readonly_provider_integration_workspace_write_must_remain_closed"]),
    ...(localCommandDisallowed
      ? []
      : ["formal_readonly_provider_integration_local_command_must_remain_closed"]),
    ...(protectedRemoteDisallowed
      ? []
      : ["formal_readonly_provider_integration_protected_remote_must_remain_closed"]),
    ...(pushDisallowed
      ? []
      : ["formal_readonly_provider_integration_push_must_be_separate"]),
    ...(releaseDisallowed
      ? []
      : ["formal_readonly_provider_integration_release_must_be_separate"]),
    ...(tagDisallowed
      ? []
      : ["formal_readonly_provider_integration_tag_must_be_separate"])
  ];
  const uniqueReasons = uniqueStrings(reasons);

  return {
    ok: uniqueReasons.length === 0,
    status: uniqueReasons.length === 0 ? "accepted" : "blocked",
    reasons: uniqueReasons,
    summary: {
      exactTokenMatched,
      exactTaskbookMatched,
      implementationScopeMatched,
      providerMatched,
      readOnlySandboxMatched,
      readOnlySideEffectMatched,
      approvalPolicyNeverMatched,
      pr14ReadinessEvidenceDeclared,
      pr14AuthorizationEvidenceDeclared,
      localOnly,
      registrySelectionRequired,
      providerPermitRequired,
      injectedSpawnerRequired,
      fakeSpawnerTestsRequired,
      sanitizedEvidenceRequired,
      realCodexCliDisallowed,
      workspaceWriteDisallowed,
      localCommandDisallowed,
      protectedRemoteDisallowed,
      pushDisallowed,
      releaseDisallowed,
      tagDisallowed,
      providerExecuteCalls: 0,
      realCodexCliCalls: 0,
      workspaceWriteExecuteCalls: 0
    }
  };
}

export async function runFormalReadonlyProviderIntegrationTaskbookAcceptance(
  options: FormalReadonlyProviderIntegrationTaskbookAcceptanceOptions = {}
): Promise<FormalReadonlyProviderIntegrationTaskbookAcceptanceEvidence> {
  const generatedAt = options.generatedAt ?? DEFAULT_GENERATED_AT;
  const exactTaskbook = evaluateFormalReadonlyProviderIntegrationTaskbook({
    authorizationToken: PR_15A_FORMAL_READONLY_PROVIDER_INTEGRATION_TOKEN,
    taskbookPath: PR_15A_FORMAL_READONLY_PROVIDER_INTEGRATION_TASKBOOK,
    implementationScope: "formal-readonly-provider-integration-local-only",
    providerId: "codex-cli",
    sandboxMode: "read-only",
    sideEffectClass: "read_only",
    approvalPolicy: "never",
    pr14ReadinessEvidencePath:
      "docs/evidence/codex-cli-formal-readonly-integration-readiness.json",
    pr14AuthorizationEvidencePath:
      "docs/evidence/codex-cli-formal-readonly-integration-authorization-acceptance.json",
    localOnly: true,
    registrySelectionRequired: true,
    providerPermitRequired: true,
    injectedSpawnerRequired: true,
    fakeSpawnerTestsRequired: true,
    sanitizedEvidenceRequired: true,
    realCodexCliAllowed: false,
    workspaceWriteAllowed: false,
    localCommandAllowed: false,
    protectedRemoteAllowed: false,
    pushAuthorized: false,
    releaseAuthorized: false,
    tagAuthorized: false
  });
  const missingTaskbook = evaluateFormalReadonlyProviderIntegrationTaskbook({});
  const broadenedScope = evaluateFormalReadonlyProviderIntegrationTaskbook({
    authorizationToken: "APPROVE_FORMAL_CODEX_CLI_PROVIDER_INTEGRATION",
    taskbookPath: "docs/governance/PR_15_PROVIDER_INTEGRATION.md",
    implementationScope: "formal-provider-integration",
    providerId: "codex-cli",
    sandboxMode: "workspace-write",
    sideEffectClass: "workspace_write",
    approvalPolicy: "on-request",
    localOnly: false,
    registrySelectionRequired: false,
    providerPermitRequired: false,
    injectedSpawnerRequired: false,
    fakeSpawnerTestsRequired: false,
    sanitizedEvidenceRequired: false,
    realCodexCliAllowed: true,
    workspaceWriteAllowed: true
  });
  const forbiddenExecution = evaluateFormalReadonlyProviderIntegrationTaskbook({
    authorizationToken: PR_15A_FORMAL_READONLY_PROVIDER_INTEGRATION_TOKEN,
    taskbookPath: PR_15A_FORMAL_READONLY_PROVIDER_INTEGRATION_TASKBOOK,
    implementationScope: "formal-readonly-provider-integration-local-only",
    providerId: "codex-cli",
    sandboxMode: "read-only",
    sideEffectClass: "read_only",
    approvalPolicy: "never",
    pr14ReadinessEvidencePath:
      "docs/evidence/codex-cli-formal-readonly-integration-readiness.json",
    pr14AuthorizationEvidencePath:
      "docs/evidence/codex-cli-formal-readonly-integration-authorization-acceptance.json",
    localOnly: true,
    registrySelectionRequired: true,
    providerPermitRequired: true,
    injectedSpawnerRequired: true,
    fakeSpawnerTestsRequired: true,
    sanitizedEvidenceRequired: true,
    realCodexCliAllowed: true,
    workspaceWriteAllowed: true,
    localCommandAllowed: true,
    protectedRemoteAllowed: true
  });
  const pushReleaseTag = evaluateFormalReadonlyProviderIntegrationTaskbook({
    authorizationToken: PR_15A_FORMAL_READONLY_PROVIDER_INTEGRATION_TOKEN,
    taskbookPath: PR_15A_FORMAL_READONLY_PROVIDER_INTEGRATION_TASKBOOK,
    implementationScope: "formal-readonly-provider-integration-local-only",
    providerId: "codex-cli",
    sandboxMode: "read-only",
    sideEffectClass: "read_only",
    approvalPolicy: "never",
    pr14ReadinessEvidencePath:
      "docs/evidence/codex-cli-formal-readonly-integration-readiness.json",
    pr14AuthorizationEvidencePath:
      "docs/evidence/codex-cli-formal-readonly-integration-authorization-acceptance.json",
    localOnly: true,
    registrySelectionRequired: true,
    providerPermitRequired: true,
    injectedSpawnerRequired: true,
    fakeSpawnerTestsRequired: true,
    sanitizedEvidenceRequired: true,
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
    FormalReadonlyProviderIntegrationTaskbookAcceptanceEvidence,
    "checks"
  > & {
    checks: Omit<
      FormalReadonlyProviderIntegrationTaskbookAcceptanceEvidence["checks"],
      "leakCheckPassed"
    >;
  } = {
    schemaVersion:
      "codex-cli-formal-readonly-provider-integration-taskbook-acceptance.v1",
    generatedAt,
    mode: "formal-readonly-provider-integration-taskbook-local-only",
    taskId: "codex-cli-formal-readonly-provider-integration-taskbook-acceptance",
    checks: {
      exactTaskbookAccepted: exactTaskbook.status === "accepted",
      missingTaskbookBlocked: missingTaskbook.status === "blocked"
        && missingTaskbook.reasons.includes(
          "formal_readonly_provider_integration_exact_token_required"
        )
        && missingTaskbook.reasons.includes(
          "formal_readonly_provider_integration_exact_taskbook_required"
        ),
      broadenedScopeBlocked: broadenedScope.status === "blocked"
        && broadenedScope.reasons.includes(
          "formal_readonly_provider_integration_local_scope_required"
        )
        && broadenedScope.reasons.includes(
          "formal_readonly_provider_integration_workspace_write_must_remain_closed"
        ),
      forbiddenExecutionBlocked: forbiddenExecution.status === "blocked"
        && forbiddenExecution.reasons.includes(
          "formal_readonly_provider_integration_real_cli_must_remain_closed"
        )
        && forbiddenExecution.reasons.includes(
          "formal_readonly_provider_integration_workspace_write_must_remain_closed"
        )
        && forbiddenExecution.reasons.includes(
          "formal_readonly_provider_integration_local_command_must_remain_closed"
        )
        && forbiddenExecution.reasons.includes(
          "formal_readonly_provider_integration_protected_remote_must_remain_closed"
        ),
      pushReleaseTagRejected: pushReleaseTag.status === "blocked"
        && pushReleaseTag.reasons.includes(
          "formal_readonly_provider_integration_push_must_be_separate"
        )
        && pushReleaseTag.reasons.includes(
          "formal_readonly_provider_integration_release_must_be_separate"
        )
        && pushReleaseTag.reasons.includes(
          "formal_readonly_provider_integration_tag_must_be_separate"
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
      pr14ReadinessEvidenceRequired: true,
      pr14AuthorizationEvidenceRequired: true,
      registrySelectionMustBeRequired: true,
      providerPermitMustBeRequired: true,
      injectedSpawnerMustBeRequired: true,
      fakeSpawnerTestsMustBeRequired: true,
      sanitizedEvidenceMustBeRequired: true,
      localTaskbookOnly: true,
      realCliInvocationMustRemainClosed: true,
      workspaceWriteMustRemainClosed: true,
      localCommandMustRemainClosed: true,
      protectedRemoteMustRemainClosed: true,
      pushReleaseTagMustBeSeparate: true
    },
    counters,
    blockingReasons: uniqueStrings([
      ...missingTaskbook.reasons,
      ...broadenedScope.reasons,
      ...forbiddenExecution.reasons,
      ...pushReleaseTag.reasons
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

export async function writeFormalReadonlyProviderIntegrationTaskbookAcceptanceEvidence(
  evidence: FormalReadonlyProviderIntegrationTaskbookAcceptanceEvidence,
  evidencePath = DEFAULT_EVIDENCE_PATH
): Promise<{
  path: string;
  evidence: FormalReadonlyProviderIntegrationTaskbookAcceptanceEvidence;
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
    PR_15A_FORMAL_READONLY_PROVIDER_INTEGRATION_TOKEN,
    PR_15A_FORMAL_READONLY_PROVIDER_INTEGRATION_TASKBOOK,
    "APPROVE_FORMAL_CODEX_CLI_PROVIDER_INTEGRATION",
    "docs/governance/PR_15_PROVIDER_INTEGRATION.md",
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
  const evidence = await runFormalReadonlyProviderIntegrationTaskbookAcceptance();
  const write =
    await writeFormalReadonlyProviderIntegrationTaskbookAcceptanceEvidence(
      evidence,
      outputPath
    );

  console.log("Codex CLI formal read-only provider integration taskbook acceptance");
  console.log(`exact taskbook accepted: ${evidence.checks.exactTaskbookAccepted}`);
  console.log(`broadened scope blocked: ${evidence.checks.broadenedScopeBlocked}`);
  console.log(`forbidden execution blocked: ${evidence.checks.forbiddenExecutionBlocked}`);
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
      "Codex CLI formal read-only provider integration taskbook acceptance failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
