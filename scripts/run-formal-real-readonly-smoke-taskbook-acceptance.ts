#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const PR_17A_FORMAL_REAL_READONLY_SMOKE_TOKEN =
  "APPROVE_FORMAL_REAL_CODEX_CLI_READONLY_SMOKE_PR_17A";
export const PR_17A_FORMAL_REAL_READONLY_SMOKE_TASKBOOK =
  "docs/governance/PR_17A_FORMAL_REAL_READONLY_SMOKE_TASKBOOK.md";
export const PR_17A_FORMAL_REAL_READONLY_SMOKE_COMMAND =
  "ALLOW_REAL_CODEX_CLI_READONLY_SMOKE=1 npm run smoke:readonly:real";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const DEFAULT_EVIDENCE_PATH = join(
  __dirname,
  "..",
  "docs",
  "evidence",
  "codex-cli-formal-real-readonly-smoke-taskbook-acceptance.json"
);
const DEFAULT_GENERATED_AT = "2026-06-15T00:00:00.000Z";

export interface FormalRealReadonlySmokeTaskbookInput {
  authorizationToken?: string;
  taskbookPath?: string;
  command?: string;
  evidencePathChoice?: string;
  implementationScope?: string;
  providerId?: string;
  sandboxMode?: string;
  sideEffectClass?: string;
  approvalPolicy?: string;
  pr13AuthorizationEvidencePath?: string;
  pr16BoundaryEvidencePath?: string;
  pr16CloseoutDocPath?: string;
  formalDispatchRequired?: boolean;
  providerRegistryRequired?: boolean;
  providerExecutionMetadataRequired?: boolean;
  providerPermitRequired?: boolean;
  injectedSpawnerRequiredForLocalTests?: boolean;
  sanitizedEvidenceRequired?: boolean;
  localPreflightRequired?: boolean;
  realCodexCliAllowedByThisTaskbook?: boolean;
  providerExecuteAllowedByThisTaskbook?: boolean;
  workspaceWriteAllowed?: boolean;
  localCommandAllowed?: boolean;
  protectedRemoteAllowed?: boolean;
  pushAuthorized?: boolean;
  releaseAuthorized?: boolean;
  tagAuthorized?: boolean;
}

export interface FormalRealReadonlySmokeTaskbookResult {
  ok: boolean;
  status: "accepted" | "blocked";
  reasons: string[];
  summary: {
    exactTokenMatched: boolean;
    exactTaskbookMatched: boolean;
    exactCommandMatched: boolean;
    defaultEvidencePathDeclared: boolean;
    implementationScopeMatched: boolean;
    providerMatched: boolean;
    readOnlySandboxMatched: boolean;
    readOnlySideEffectMatched: boolean;
    approvalPolicyNeverMatched: boolean;
    pr13AuthorizationEvidenceDeclared: boolean;
    pr16BoundaryEvidenceDeclared: boolean;
    pr16CloseoutDeclared: boolean;
    formalDispatchRequired: boolean;
    providerRegistryRequired: boolean;
    providerExecutionMetadataRequired: boolean;
    providerPermitRequired: boolean;
    injectedSpawnerRequiredForLocalTests: boolean;
    sanitizedEvidenceRequired: boolean;
    localPreflightRequired: boolean;
    realCodexCliNotAuthorizedByThisTaskbook: boolean;
    providerExecuteNotAuthorizedByThisTaskbook: boolean;
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

export interface FormalRealReadonlySmokeTaskbookAcceptanceEvidence {
  schemaVersion: "codex-cli-formal-real-readonly-smoke-taskbook-acceptance.v1";
  generatedAt: string;
  mode: "formal-real-readonly-smoke-taskbook-local-only";
  taskId: "codex-cli-formal-real-readonly-smoke-taskbook-acceptance";
  checks: {
    exactTaskbookAccepted: boolean;
    missingTaskbookBlocked: boolean;
    broadenedScopeBlocked: boolean;
    forbiddenExecutionBlocked: boolean;
    pushReleaseTagRejected: boolean;
    priorEvidenceRequired: boolean;
    defaultEvidencePathRequired: boolean;
    formalDispatchRequired: boolean;
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
    requiredEvidencePathChoice: "default";
    pr13AuthorizationEvidenceRequired: true;
    pr16BoundaryEvidenceRequired: true;
    pr16CloseoutRequired: true;
    formalDispatchMustBeRequired: true;
    providerRegistryMustBeRequired: true;
    providerExecutionMetadataMustBeRequired: true;
    providerPermitMustBeRequired: true;
    localPreflightMustBeRequired: true;
    localTaskbookOnly: true;
    realCliInvocationRequiresSeparateExecutionAuthorization: true;
    providerExecuteRequiresSeparateExecutionAuthorization: true;
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

export interface FormalRealReadonlySmokeTaskbookAcceptanceOptions {
  generatedAt?: string;
}

export function evaluateFormalRealReadonlySmokeTaskbook(
  input: FormalRealReadonlySmokeTaskbookInput
): FormalRealReadonlySmokeTaskbookResult {
  const exactTokenMatched =
    input.authorizationToken === PR_17A_FORMAL_REAL_READONLY_SMOKE_TOKEN;
  const exactTaskbookMatched =
    input.taskbookPath === PR_17A_FORMAL_REAL_READONLY_SMOKE_TASKBOOK;
  const exactCommandMatched =
    input.command === PR_17A_FORMAL_REAL_READONLY_SMOKE_COMMAND;
  const defaultEvidencePathDeclared = input.evidencePathChoice === "default";
  const implementationScopeMatched =
    input.implementationScope === "formal-real-readonly-smoke-taskbook-local-only";
  const providerMatched = input.providerId === "codex-cli";
  const readOnlySandboxMatched = input.sandboxMode === "read-only";
  const readOnlySideEffectMatched = input.sideEffectClass === "read_only";
  const approvalPolicyNeverMatched = input.approvalPolicy === "never";
  const pr13AuthorizationEvidenceDeclared =
    input.pr13AuthorizationEvidencePath
      === "docs/evidence/codex-cli-real-readonly-smoke-authorization-acceptance.json";
  const pr16BoundaryEvidenceDeclared =
    input.pr16BoundaryEvidencePath
      === "docs/evidence/codex-cli-formal-readonly-dispatch-boundary-acceptance.json";
  const pr16CloseoutDeclared =
    input.pr16CloseoutDocPath
      === "docs/governance/PR_16B_FORMAL_READONLY_DISPATCH_BOUNDARY_LOCAL_CLOSEOUT.md";
  const formalDispatchRequired = input.formalDispatchRequired === true;
  const providerRegistryRequired = input.providerRegistryRequired === true;
  const providerExecutionMetadataRequired =
    input.providerExecutionMetadataRequired === true;
  const providerPermitRequired = input.providerPermitRequired === true;
  const injectedSpawnerRequiredForLocalTests =
    input.injectedSpawnerRequiredForLocalTests === true;
  const sanitizedEvidenceRequired = input.sanitizedEvidenceRequired === true;
  const localPreflightRequired = input.localPreflightRequired === true;
  const realCodexCliNotAuthorizedByThisTaskbook =
    input.realCodexCliAllowedByThisTaskbook !== true;
  const providerExecuteNotAuthorizedByThisTaskbook =
    input.providerExecuteAllowedByThisTaskbook !== true;
  const workspaceWriteDisallowed = input.workspaceWriteAllowed !== true;
  const localCommandDisallowed = input.localCommandAllowed !== true;
  const protectedRemoteDisallowed = input.protectedRemoteAllowed !== true;
  const pushDisallowed = input.pushAuthorized !== true;
  const releaseDisallowed = input.releaseAuthorized !== true;
  const tagDisallowed = input.tagAuthorized !== true;
  const reasons = [
    ...(exactTokenMatched
      ? []
      : ["formal_real_readonly_smoke_exact_token_required"]),
    ...(exactTaskbookMatched
      ? []
      : ["formal_real_readonly_smoke_exact_taskbook_required"]),
    ...(exactCommandMatched
      ? []
      : ["formal_real_readonly_smoke_exact_command_required"]),
    ...(defaultEvidencePathDeclared
      ? []
      : ["formal_real_readonly_smoke_default_evidence_path_required"]),
    ...(implementationScopeMatched
      ? []
      : ["formal_real_readonly_smoke_local_taskbook_scope_required"]),
    ...(providerMatched ? [] : ["formal_real_readonly_smoke_provider_codex_cli_required"]),
    ...(readOnlySandboxMatched
      ? []
      : ["formal_real_readonly_smoke_read_only_sandbox_required"]),
    ...(readOnlySideEffectMatched
      ? []
      : ["formal_real_readonly_smoke_read_only_side_effect_required"]),
    ...(approvalPolicyNeverMatched
      ? []
      : ["formal_real_readonly_smoke_approval_never_required"]),
    ...(pr13AuthorizationEvidenceDeclared
      ? []
      : ["formal_real_readonly_smoke_pr13_authorization_evidence_required"]),
    ...(pr16BoundaryEvidenceDeclared
      ? []
      : ["formal_real_readonly_smoke_pr16_boundary_evidence_required"]),
    ...(pr16CloseoutDeclared
      ? []
      : ["formal_real_readonly_smoke_pr16_closeout_required"]),
    ...(formalDispatchRequired ? [] : ["formal_real_readonly_smoke_formal_dispatch_required"]),
    ...(providerRegistryRequired ? [] : ["formal_real_readonly_smoke_provider_registry_required"]),
    ...(providerExecutionMetadataRequired
      ? []
      : ["formal_real_readonly_smoke_provider_execution_metadata_required"]),
    ...(providerPermitRequired ? [] : ["formal_real_readonly_smoke_provider_permit_required"]),
    ...(injectedSpawnerRequiredForLocalTests
      ? []
      : ["formal_real_readonly_smoke_injected_spawner_local_tests_required"]),
    ...(sanitizedEvidenceRequired
      ? []
      : ["formal_real_readonly_smoke_sanitized_evidence_required"]),
    ...(localPreflightRequired ? [] : ["formal_real_readonly_smoke_local_preflight_required"]),
    ...(realCodexCliNotAuthorizedByThisTaskbook
      ? []
      : ["formal_real_readonly_smoke_real_cli_requires_separate_execution_authorization"]),
    ...(providerExecuteNotAuthorizedByThisTaskbook
      ? []
      : ["formal_real_readonly_smoke_provider_execute_requires_separate_authorization"]),
    ...(workspaceWriteDisallowed
      ? []
      : ["formal_real_readonly_smoke_workspace_write_must_remain_closed"]),
    ...(localCommandDisallowed
      ? []
      : ["formal_real_readonly_smoke_local_command_must_remain_closed"]),
    ...(protectedRemoteDisallowed
      ? []
      : ["formal_real_readonly_smoke_protected_remote_must_remain_closed"]),
    ...(pushDisallowed ? [] : ["formal_real_readonly_smoke_push_must_be_separate"]),
    ...(releaseDisallowed ? [] : ["formal_real_readonly_smoke_release_must_be_separate"]),
    ...(tagDisallowed ? [] : ["formal_real_readonly_smoke_tag_must_be_separate"])
  ];
  const uniqueReasons = uniqueStrings(reasons);

  return {
    ok: uniqueReasons.length === 0,
    status: uniqueReasons.length === 0 ? "accepted" : "blocked",
    reasons: uniqueReasons,
    summary: {
      exactTokenMatched,
      exactTaskbookMatched,
      exactCommandMatched,
      defaultEvidencePathDeclared,
      implementationScopeMatched,
      providerMatched,
      readOnlySandboxMatched,
      readOnlySideEffectMatched,
      approvalPolicyNeverMatched,
      pr13AuthorizationEvidenceDeclared,
      pr16BoundaryEvidenceDeclared,
      pr16CloseoutDeclared,
      formalDispatchRequired,
      providerRegistryRequired,
      providerExecutionMetadataRequired,
      providerPermitRequired,
      injectedSpawnerRequiredForLocalTests,
      sanitizedEvidenceRequired,
      localPreflightRequired,
      realCodexCliNotAuthorizedByThisTaskbook,
      providerExecuteNotAuthorizedByThisTaskbook,
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

export async function runFormalRealReadonlySmokeTaskbookAcceptance(
  options: FormalRealReadonlySmokeTaskbookAcceptanceOptions = {}
): Promise<FormalRealReadonlySmokeTaskbookAcceptanceEvidence> {
  const generatedAt = options.generatedAt ?? DEFAULT_GENERATED_AT;
  const exactTaskbook = evaluateFormalRealReadonlySmokeTaskbook({
    authorizationToken: PR_17A_FORMAL_REAL_READONLY_SMOKE_TOKEN,
    taskbookPath: PR_17A_FORMAL_REAL_READONLY_SMOKE_TASKBOOK,
    command: PR_17A_FORMAL_REAL_READONLY_SMOKE_COMMAND,
    evidencePathChoice: "default",
    implementationScope: "formal-real-readonly-smoke-taskbook-local-only",
    providerId: "codex-cli",
    sandboxMode: "read-only",
    sideEffectClass: "read_only",
    approvalPolicy: "never",
    pr13AuthorizationEvidencePath:
      "docs/evidence/codex-cli-real-readonly-smoke-authorization-acceptance.json",
    pr16BoundaryEvidencePath:
      "docs/evidence/codex-cli-formal-readonly-dispatch-boundary-acceptance.json",
    pr16CloseoutDocPath:
      "docs/governance/PR_16B_FORMAL_READONLY_DISPATCH_BOUNDARY_LOCAL_CLOSEOUT.md",
    formalDispatchRequired: true,
    providerRegistryRequired: true,
    providerExecutionMetadataRequired: true,
    providerPermitRequired: true,
    injectedSpawnerRequiredForLocalTests: true,
    sanitizedEvidenceRequired: true,
    localPreflightRequired: true,
    realCodexCliAllowedByThisTaskbook: false,
    providerExecuteAllowedByThisTaskbook: false,
    workspaceWriteAllowed: false,
    localCommandAllowed: false,
    protectedRemoteAllowed: false,
    pushAuthorized: false,
    releaseAuthorized: false,
    tagAuthorized: false
  });
  const missingTaskbook = evaluateFormalRealReadonlySmokeTaskbook({});
  const broadenedScope = evaluateFormalRealReadonlySmokeTaskbook({
    authorizationToken: "APPROVE_FORMAL_REAL_CODEX_CLI",
    taskbookPath: "docs/governance/PR_17_FORMAL_REAL_CLI_SMOKE.md",
    command:
      "ALLOW_REAL_CODEX_CLI_READONLY_SMOKE=1 npm run smoke:readonly:real -- --sandbox workspace-write",
    evidencePathChoice: "one-off",
    implementationScope: "formal-real-cli-smoke",
    providerId: "codex-cli",
    sandboxMode: "workspace-write",
    sideEffectClass: "workspace_write",
    approvalPolicy: "on-request",
    realCodexCliAllowedByThisTaskbook: true,
    providerExecuteAllowedByThisTaskbook: true,
    workspaceWriteAllowed: true
  });
  const forbiddenExecution = evaluateFormalRealReadonlySmokeTaskbook({
    authorizationToken: PR_17A_FORMAL_REAL_READONLY_SMOKE_TOKEN,
    taskbookPath: PR_17A_FORMAL_REAL_READONLY_SMOKE_TASKBOOK,
    command: PR_17A_FORMAL_REAL_READONLY_SMOKE_COMMAND,
    evidencePathChoice: "default",
    implementationScope: "formal-real-readonly-smoke-taskbook-local-only",
    providerId: "codex-cli",
    sandboxMode: "read-only",
    sideEffectClass: "read_only",
    approvalPolicy: "never",
    pr13AuthorizationEvidencePath:
      "docs/evidence/codex-cli-real-readonly-smoke-authorization-acceptance.json",
    pr16BoundaryEvidencePath:
      "docs/evidence/codex-cli-formal-readonly-dispatch-boundary-acceptance.json",
    pr16CloseoutDocPath:
      "docs/governance/PR_16B_FORMAL_READONLY_DISPATCH_BOUNDARY_LOCAL_CLOSEOUT.md",
    formalDispatchRequired: true,
    providerRegistryRequired: true,
    providerExecutionMetadataRequired: true,
    providerPermitRequired: true,
    injectedSpawnerRequiredForLocalTests: true,
    sanitizedEvidenceRequired: true,
    localPreflightRequired: true,
    realCodexCliAllowedByThisTaskbook: true,
    providerExecuteAllowedByThisTaskbook: true,
    workspaceWriteAllowed: true,
    localCommandAllowed: true,
    protectedRemoteAllowed: true
  });
  const pushReleaseTag = evaluateFormalRealReadonlySmokeTaskbook({
    authorizationToken: PR_17A_FORMAL_REAL_READONLY_SMOKE_TOKEN,
    taskbookPath: PR_17A_FORMAL_REAL_READONLY_SMOKE_TASKBOOK,
    command: PR_17A_FORMAL_REAL_READONLY_SMOKE_COMMAND,
    evidencePathChoice: "default",
    implementationScope: "formal-real-readonly-smoke-taskbook-local-only",
    providerId: "codex-cli",
    sandboxMode: "read-only",
    sideEffectClass: "read_only",
    approvalPolicy: "never",
    pr13AuthorizationEvidencePath:
      "docs/evidence/codex-cli-real-readonly-smoke-authorization-acceptance.json",
    pr16BoundaryEvidencePath:
      "docs/evidence/codex-cli-formal-readonly-dispatch-boundary-acceptance.json",
    pr16CloseoutDocPath:
      "docs/governance/PR_16B_FORMAL_READONLY_DISPATCH_BOUNDARY_LOCAL_CLOSEOUT.md",
    formalDispatchRequired: true,
    providerRegistryRequired: true,
    providerExecutionMetadataRequired: true,
    providerPermitRequired: true,
    injectedSpawnerRequiredForLocalTests: true,
    sanitizedEvidenceRequired: true,
    localPreflightRequired: true,
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
    FormalRealReadonlySmokeTaskbookAcceptanceEvidence,
    "checks"
  > & {
    checks: Omit<
      FormalRealReadonlySmokeTaskbookAcceptanceEvidence["checks"],
      "leakCheckPassed"
    >;
  } = {
    schemaVersion: "codex-cli-formal-real-readonly-smoke-taskbook-acceptance.v1",
    generatedAt,
    mode: "formal-real-readonly-smoke-taskbook-local-only",
    taskId: "codex-cli-formal-real-readonly-smoke-taskbook-acceptance",
    checks: {
      exactTaskbookAccepted: exactTaskbook.status === "accepted",
      missingTaskbookBlocked: missingTaskbook.status === "blocked"
        && missingTaskbook.reasons.includes(
          "formal_real_readonly_smoke_exact_token_required"
        )
        && missingTaskbook.reasons.includes(
          "formal_real_readonly_smoke_exact_taskbook_required"
        ),
      broadenedScopeBlocked: broadenedScope.status === "blocked"
        && broadenedScope.reasons.includes(
          "formal_real_readonly_smoke_local_taskbook_scope_required"
        )
        && broadenedScope.reasons.includes(
          "formal_real_readonly_smoke_workspace_write_must_remain_closed"
        ),
      forbiddenExecutionBlocked: forbiddenExecution.status === "blocked"
        && forbiddenExecution.reasons.includes(
          "formal_real_readonly_smoke_real_cli_requires_separate_execution_authorization"
        )
        && forbiddenExecution.reasons.includes(
          "formal_real_readonly_smoke_provider_execute_requires_separate_authorization"
        )
        && forbiddenExecution.reasons.includes(
          "formal_real_readonly_smoke_workspace_write_must_remain_closed"
        )
        && forbiddenExecution.reasons.includes(
          "formal_real_readonly_smoke_local_command_must_remain_closed"
        )
        && forbiddenExecution.reasons.includes(
          "formal_real_readonly_smoke_protected_remote_must_remain_closed"
        ),
      pushReleaseTagRejected: pushReleaseTag.status === "blocked"
        && pushReleaseTag.reasons.includes(
          "formal_real_readonly_smoke_push_must_be_separate"
        )
        && pushReleaseTag.reasons.includes(
          "formal_real_readonly_smoke_release_must_be_separate"
        )
        && pushReleaseTag.reasons.includes(
          "formal_real_readonly_smoke_tag_must_be_separate"
        ),
      priorEvidenceRequired:
        exactTaskbook.summary.pr13AuthorizationEvidenceDeclared
        && exactTaskbook.summary.pr16BoundaryEvidenceDeclared
        && exactTaskbook.summary.pr16CloseoutDeclared,
      defaultEvidencePathRequired:
        exactTaskbook.summary.defaultEvidencePathDeclared,
      formalDispatchRequired:
        exactTaskbook.summary.formalDispatchRequired
        && exactTaskbook.summary.providerRegistryRequired
        && exactTaskbook.summary.providerExecutionMetadataRequired
        && exactTaskbook.summary.providerPermitRequired,
      noProviderExecute: counters.providerExecuteCalls === 0,
      noRealCodexCli: counters.realCodexCliCalls === 0,
      noWorkspaceWriteExecute: counters.workspaceWriteExecuteCalls === 0
    },
    summary: {
      requiredProviderId: "codex-cli",
      requiredSandbox: "read-only",
      requiredSideEffectClass: "read_only",
      requiredApprovalPolicy: "never",
      requiredEvidencePathChoice: "default",
      pr13AuthorizationEvidenceRequired: true,
      pr16BoundaryEvidenceRequired: true,
      pr16CloseoutRequired: true,
      formalDispatchMustBeRequired: true,
      providerRegistryMustBeRequired: true,
      providerExecutionMetadataMustBeRequired: true,
      providerPermitMustBeRequired: true,
      localPreflightMustBeRequired: true,
      localTaskbookOnly: true,
      realCliInvocationRequiresSeparateExecutionAuthorization: true,
      providerExecuteRequiresSeparateExecutionAuthorization: true,
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

export async function writeFormalRealReadonlySmokeTaskbookAcceptanceEvidence(
  evidence: FormalRealReadonlySmokeTaskbookAcceptanceEvidence,
  evidencePath = DEFAULT_EVIDENCE_PATH
): Promise<{
  path: string;
  evidence: FormalRealReadonlySmokeTaskbookAcceptanceEvidence;
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
    PR_17A_FORMAL_REAL_READONLY_SMOKE_TOKEN,
    PR_17A_FORMAL_REAL_READONLY_SMOKE_TASKBOOK,
    PR_17A_FORMAL_REAL_READONLY_SMOKE_COMMAND,
    "APPROVE_FORMAL_REAL_CODEX_CLI",
    "PR_17_FORMAL_REAL_CLI_SMOKE",
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
  const evidence = await runFormalRealReadonlySmokeTaskbookAcceptance();
  const write = await writeFormalRealReadonlySmokeTaskbookAcceptanceEvidence(
    evidence,
    outputPath
  );

  console.log("Codex CLI formal real read-only smoke taskbook acceptance");
  console.log(`exact taskbook accepted: ${evidence.checks.exactTaskbookAccepted}`);
  console.log(`prior evidence required: ${evidence.checks.priorEvidenceRequired}`);
  console.log(`default evidence path required: ${evidence.checks.defaultEvidencePathRequired}`);
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
      "Codex CLI formal real read-only smoke taskbook acceptance failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
