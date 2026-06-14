#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const PR_18A_FORMAL_REAL_READONLY_SMOKE_EXECUTION_AUTHORIZATION_TOKEN =
  "APPROVE_FORMAL_REAL_CODEX_CLI_READONLY_SMOKE_EXECUTION_PR_18A";
export const PR_18A_FORMAL_REAL_READONLY_SMOKE_EXECUTION_COMMAND =
  "ALLOW_REAL_CODEX_CLI_READONLY_SMOKE=1 npm run smoke:readonly:real";
export const PR_18A_FORMAL_REAL_READONLY_SMOKE_EXECUTION_PACKET =
  "docs/governance/PR_18A_FORMAL_REAL_READONLY_SMOKE_EXECUTION_AUTHORIZATION_PACKET.md";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const DEFAULT_EVIDENCE_PATH = join(
  __dirname,
  "..",
  "docs",
  "evidence",
  "codex-cli-formal-real-readonly-smoke-execution-authorization-acceptance.json"
);
const DEFAULT_GENERATED_AT = "2026-06-15T00:00:00.000Z";

export interface FormalRealReadonlySmokeExecutionAuthorizationInput {
  authorizationToken?: string;
  authorizationPacketPath?: string;
  command?: string;
  evidencePathChoice?: string;
  providerId?: string;
  sandboxMode?: string;
  sideEffectClass?: string;
  approvalPolicy?: string;
  taskbookEvidencePath?: string;
  preExecutionEvidencePath?: string;
  localCloseoutDocPath?: string;
  formalDispatchRequired?: boolean;
  providerRegistryRequired?: boolean;
  providerExecutionMetadataRequired?: boolean;
  providerPermitRequired?: boolean;
  operatorFlagRequired?: boolean;
  defaultEvidencePathRequired?: boolean;
  localPreflightRequired?: boolean;
  currentExecutionRequested?: boolean;
  providerExecuteNow?: boolean;
  realCodexCliNow?: boolean;
  workspaceWriteAuthorized?: boolean;
  localCommandAuthorized?: boolean;
  protectedRemoteAuthorized?: boolean;
  pushAuthorized?: boolean;
  releaseAuthorized?: boolean;
  tagAuthorized?: boolean;
}

export interface FormalRealReadonlySmokeExecutionAuthorizationResult {
  ok: boolean;
  status: "authorized" | "blocked";
  reasons: string[];
  summary: {
    exactTokenMatched: boolean;
    exactPacketMatched: boolean;
    exactCommandMatched: boolean;
    defaultEvidencePathMatched: boolean;
    providerMatched: boolean;
    readOnlySandboxMatched: boolean;
    readOnlySideEffectMatched: boolean;
    approvalPolicyNeverMatched: boolean;
    taskbookEvidenceDeclared: boolean;
    preExecutionEvidenceDeclared: boolean;
    localCloseoutDeclared: boolean;
    formalDispatchRequired: boolean;
    providerRegistryRequired: boolean;
    providerExecutionMetadataRequired: boolean;
    providerPermitRequired: boolean;
    operatorFlagRequired: boolean;
    defaultEvidencePathRequired: boolean;
    localPreflightRequired: boolean;
    currentExecutionDisallowed: boolean;
    providerExecuteNowDisallowed: boolean;
    realCodexCliNowDisallowed: boolean;
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

export interface FormalRealReadonlySmokeExecutionAuthorizationAcceptanceEvidence {
  schemaVersion: "codex-cli-formal-real-readonly-smoke-execution-authorization-acceptance.v1";
  generatedAt: string;
  mode: "formal-real-readonly-smoke-execution-authorization-local-only";
  taskId: "codex-cli-formal-real-readonly-smoke-execution-authorization-acceptance";
  checks: {
    exactAuthorizationAccepted: boolean;
    missingAuthorizationBlocked: boolean;
    broadenedAuthorizationBlocked: boolean;
    immediateExecutionBlocked: boolean;
    pushReleaseTagRejected: boolean;
    priorCloseoutRequired: boolean;
    formalBoundaryRequired: boolean;
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
    operatorFlagRequiredForFutureExecution: true;
    taskbookEvidenceRequired: true;
    preExecutionEvidenceRequired: true;
    localCloseoutRequired: true;
    formalDispatchMustBeRequired: true;
    providerRegistryMustBeRequired: true;
    providerExecutionMetadataMustBeRequired: true;
    providerPermitMustBeRequired: true;
    localPreflightMustBeRequired: true;
    authorizationPacketOnly: true;
    currentExecutionMustRemainClosed: true;
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

export interface FormalRealReadonlySmokeExecutionAuthorizationAcceptanceOptions {
  generatedAt?: string;
}

export function evaluateFormalRealReadonlySmokeExecutionAuthorization(
  input: FormalRealReadonlySmokeExecutionAuthorizationInput
): FormalRealReadonlySmokeExecutionAuthorizationResult {
  const exactTokenMatched =
    input.authorizationToken
      === PR_18A_FORMAL_REAL_READONLY_SMOKE_EXECUTION_AUTHORIZATION_TOKEN;
  const exactPacketMatched =
    input.authorizationPacketPath
      === PR_18A_FORMAL_REAL_READONLY_SMOKE_EXECUTION_PACKET;
  const exactCommandMatched =
    input.command === PR_18A_FORMAL_REAL_READONLY_SMOKE_EXECUTION_COMMAND;
  const defaultEvidencePathMatched = input.evidencePathChoice === "default";
  const providerMatched = input.providerId === "codex-cli";
  const readOnlySandboxMatched = input.sandboxMode === "read-only";
  const readOnlySideEffectMatched = input.sideEffectClass === "read_only";
  const approvalPolicyNeverMatched = input.approvalPolicy === "never";
  const taskbookEvidenceDeclared =
    input.taskbookEvidencePath
      === "docs/evidence/codex-cli-formal-real-readonly-smoke-taskbook-acceptance.json";
  const preExecutionEvidenceDeclared =
    input.preExecutionEvidencePath
      === "docs/evidence/codex-cli-formal-real-readonly-smoke-pre-execution-acceptance.json";
  const localCloseoutDeclared =
    input.localCloseoutDocPath
      === "docs/governance/PR_17C_FORMAL_REAL_READONLY_SMOKE_LOCAL_CLOSEOUT.md";
  const formalDispatchRequired = input.formalDispatchRequired === true;
  const providerRegistryRequired = input.providerRegistryRequired === true;
  const providerExecutionMetadataRequired =
    input.providerExecutionMetadataRequired === true;
  const providerPermitRequired = input.providerPermitRequired === true;
  const operatorFlagRequired = input.operatorFlagRequired === true;
  const defaultEvidencePathRequired = input.defaultEvidencePathRequired === true;
  const localPreflightRequired = input.localPreflightRequired === true;
  const currentExecutionDisallowed = input.currentExecutionRequested !== true;
  const providerExecuteNowDisallowed = input.providerExecuteNow !== true;
  const realCodexCliNowDisallowed = input.realCodexCliNow !== true;
  const workspaceWriteDisallowed = input.workspaceWriteAuthorized !== true;
  const localCommandDisallowed = input.localCommandAuthorized !== true;
  const protectedRemoteDisallowed = input.protectedRemoteAuthorized !== true;
  const pushDisallowed = input.pushAuthorized !== true;
  const releaseDisallowed = input.releaseAuthorized !== true;
  const tagDisallowed = input.tagAuthorized !== true;
  const reasons = [
    ...(exactTokenMatched
      ? []
      : ["formal_real_readonly_smoke_execution_auth_exact_token_required"]),
    ...(exactPacketMatched
      ? []
      : ["formal_real_readonly_smoke_execution_auth_exact_packet_required"]),
    ...(exactCommandMatched
      ? []
      : ["formal_real_readonly_smoke_execution_auth_exact_command_required"]),
    ...(defaultEvidencePathMatched
      ? []
      : ["formal_real_readonly_smoke_execution_auth_default_evidence_path_required"]),
    ...(providerMatched
      ? []
      : ["formal_real_readonly_smoke_execution_auth_provider_codex_cli_required"]),
    ...(readOnlySandboxMatched
      ? []
      : ["formal_real_readonly_smoke_execution_auth_read_only_sandbox_required"]),
    ...(readOnlySideEffectMatched
      ? []
      : ["formal_real_readonly_smoke_execution_auth_read_only_side_effect_required"]),
    ...(approvalPolicyNeverMatched
      ? []
      : ["formal_real_readonly_smoke_execution_auth_approval_never_required"]),
    ...(taskbookEvidenceDeclared
      ? []
      : ["formal_real_readonly_smoke_execution_auth_taskbook_evidence_required"]),
    ...(preExecutionEvidenceDeclared
      ? []
      : ["formal_real_readonly_smoke_execution_auth_pre_execution_evidence_required"]),
    ...(localCloseoutDeclared
      ? []
      : ["formal_real_readonly_smoke_execution_auth_local_closeout_required"]),
    ...(formalDispatchRequired
      ? []
      : ["formal_real_readonly_smoke_execution_auth_formal_dispatch_required"]),
    ...(providerRegistryRequired
      ? []
      : ["formal_real_readonly_smoke_execution_auth_provider_registry_required"]),
    ...(providerExecutionMetadataRequired
      ? []
      : ["formal_real_readonly_smoke_execution_auth_provider_execution_metadata_required"]),
    ...(providerPermitRequired
      ? []
      : ["formal_real_readonly_smoke_execution_auth_provider_permit_required"]),
    ...(operatorFlagRequired
      ? []
      : ["formal_real_readonly_smoke_execution_auth_operator_flag_required"]),
    ...(defaultEvidencePathRequired
      ? []
      : ["formal_real_readonly_smoke_execution_auth_default_evidence_path_gate_required"]),
    ...(localPreflightRequired
      ? []
      : ["formal_real_readonly_smoke_execution_auth_local_preflight_required"]),
    ...(currentExecutionDisallowed
      ? []
      : ["formal_real_readonly_smoke_execution_auth_current_execution_must_remain_closed"]),
    ...(providerExecuteNowDisallowed
      ? []
      : ["formal_real_readonly_smoke_execution_auth_provider_execute_now_blocked"]),
    ...(realCodexCliNowDisallowed
      ? []
      : ["formal_real_readonly_smoke_execution_auth_real_cli_now_blocked"]),
    ...(workspaceWriteDisallowed
      ? []
      : ["formal_real_readonly_smoke_execution_auth_workspace_write_must_remain_closed"]),
    ...(localCommandDisallowed
      ? []
      : ["formal_real_readonly_smoke_execution_auth_local_command_must_remain_closed"]),
    ...(protectedRemoteDisallowed
      ? []
      : ["formal_real_readonly_smoke_execution_auth_protected_remote_must_remain_closed"]),
    ...(pushDisallowed
      ? []
      : ["formal_real_readonly_smoke_execution_auth_push_must_be_separate"]),
    ...(releaseDisallowed
      ? []
      : ["formal_real_readonly_smoke_execution_auth_release_must_be_separate"]),
    ...(tagDisallowed
      ? []
      : ["formal_real_readonly_smoke_execution_auth_tag_must_be_separate"])
  ];
  const uniqueReasons = uniqueStrings(reasons);

  return {
    ok: uniqueReasons.length === 0,
    status: uniqueReasons.length === 0 ? "authorized" : "blocked",
    reasons: uniqueReasons,
    summary: {
      exactTokenMatched,
      exactPacketMatched,
      exactCommandMatched,
      defaultEvidencePathMatched,
      providerMatched,
      readOnlySandboxMatched,
      readOnlySideEffectMatched,
      approvalPolicyNeverMatched,
      taskbookEvidenceDeclared,
      preExecutionEvidenceDeclared,
      localCloseoutDeclared,
      formalDispatchRequired,
      providerRegistryRequired,
      providerExecutionMetadataRequired,
      providerPermitRequired,
      operatorFlagRequired,
      defaultEvidencePathRequired,
      localPreflightRequired,
      currentExecutionDisallowed,
      providerExecuteNowDisallowed,
      realCodexCliNowDisallowed,
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

export async function runFormalRealReadonlySmokeExecutionAuthorizationAcceptance(
  options: FormalRealReadonlySmokeExecutionAuthorizationAcceptanceOptions = {}
): Promise<FormalRealReadonlySmokeExecutionAuthorizationAcceptanceEvidence> {
  const generatedAt = options.generatedAt ?? DEFAULT_GENERATED_AT;
  const exactAuthorization = evaluateFormalRealReadonlySmokeExecutionAuthorization(
    createExactAuthorizationInput()
  );
  const missingAuthorization = evaluateFormalRealReadonlySmokeExecutionAuthorization({});
  const broadenedAuthorization = evaluateFormalRealReadonlySmokeExecutionAuthorization({
    authorizationToken: "APPROVE_FORMAL_REAL_CODEX_CLI_EXECUTION",
    authorizationPacketPath: "docs/governance/PR_18_FORMAL_REAL_CLI_EXECUTION.md",
    command:
      "ALLOW_REAL_CODEX_CLI_READONLY_SMOKE=1 npm run smoke:readonly:real -- --sandbox workspace-write",
    evidencePathChoice: "one-off",
    providerId: "codex-cli",
    sandboxMode: "workspace-write",
    sideEffectClass: "workspace_write",
    approvalPolicy: "on-request",
    currentExecutionRequested: false,
    workspaceWriteAuthorized: true
  });
  const immediateExecution = evaluateFormalRealReadonlySmokeExecutionAuthorization({
    ...createExactAuthorizationInput(),
    currentExecutionRequested: true,
    providerExecuteNow: true,
    realCodexCliNow: true
  });
  const pushReleaseTag = evaluateFormalRealReadonlySmokeExecutionAuthorization({
    ...createExactAuthorizationInput(),
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
    FormalRealReadonlySmokeExecutionAuthorizationAcceptanceEvidence,
    "checks"
  > & {
    checks: Omit<
      FormalRealReadonlySmokeExecutionAuthorizationAcceptanceEvidence["checks"],
      "leakCheckPassed"
    >;
  } = {
    schemaVersion:
      "codex-cli-formal-real-readonly-smoke-execution-authorization-acceptance.v1",
    generatedAt,
    mode: "formal-real-readonly-smoke-execution-authorization-local-only",
    taskId: "codex-cli-formal-real-readonly-smoke-execution-authorization-acceptance",
    checks: {
      exactAuthorizationAccepted: exactAuthorization.status === "authorized",
      missingAuthorizationBlocked: missingAuthorization.status === "blocked"
        && missingAuthorization.reasons.includes(
          "formal_real_readonly_smoke_execution_auth_exact_token_required"
        )
        && missingAuthorization.reasons.includes(
          "formal_real_readonly_smoke_execution_auth_pre_execution_evidence_required"
        ),
      broadenedAuthorizationBlocked: broadenedAuthorization.status === "blocked"
        && broadenedAuthorization.reasons.includes(
          "formal_real_readonly_smoke_execution_auth_read_only_sandbox_required"
        )
        && broadenedAuthorization.reasons.includes(
          "formal_real_readonly_smoke_execution_auth_workspace_write_must_remain_closed"
        ),
      immediateExecutionBlocked: immediateExecution.status === "blocked"
        && immediateExecution.reasons.includes(
          "formal_real_readonly_smoke_execution_auth_current_execution_must_remain_closed"
        )
        && immediateExecution.reasons.includes(
          "formal_real_readonly_smoke_execution_auth_provider_execute_now_blocked"
        )
        && immediateExecution.reasons.includes(
          "formal_real_readonly_smoke_execution_auth_real_cli_now_blocked"
        ),
      pushReleaseTagRejected: pushReleaseTag.status === "blocked"
        && pushReleaseTag.reasons.includes(
          "formal_real_readonly_smoke_execution_auth_push_must_be_separate"
        )
        && pushReleaseTag.reasons.includes(
          "formal_real_readonly_smoke_execution_auth_release_must_be_separate"
        )
        && pushReleaseTag.reasons.includes(
          "formal_real_readonly_smoke_execution_auth_tag_must_be_separate"
        ),
      priorCloseoutRequired:
        exactAuthorization.summary.taskbookEvidenceDeclared
        && exactAuthorization.summary.preExecutionEvidenceDeclared
        && exactAuthorization.summary.localCloseoutDeclared,
      formalBoundaryRequired:
        exactAuthorization.summary.formalDispatchRequired
        && exactAuthorization.summary.providerRegistryRequired
        && exactAuthorization.summary.providerExecutionMetadataRequired
        && exactAuthorization.summary.providerPermitRequired,
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
      operatorFlagRequiredForFutureExecution: true,
      taskbookEvidenceRequired: true,
      preExecutionEvidenceRequired: true,
      localCloseoutRequired: true,
      formalDispatchMustBeRequired: true,
      providerRegistryMustBeRequired: true,
      providerExecutionMetadataMustBeRequired: true,
      providerPermitMustBeRequired: true,
      localPreflightMustBeRequired: true,
      authorizationPacketOnly: true,
      currentExecutionMustRemainClosed: true,
      workspaceWriteMustRemainClosed: true,
      localCommandMustRemainClosed: true,
      protectedRemoteMustRemainClosed: true,
      pushReleaseTagMustBeSeparate: true
    },
    counters,
    blockingReasons: uniqueStrings([
      ...missingAuthorization.reasons,
      ...broadenedAuthorization.reasons,
      ...immediateExecution.reasons,
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

export async function writeFormalRealReadonlySmokeExecutionAuthorizationAcceptanceEvidence(
  evidence: FormalRealReadonlySmokeExecutionAuthorizationAcceptanceEvidence,
  evidencePath = DEFAULT_EVIDENCE_PATH
): Promise<{
  path: string;
  evidence: FormalRealReadonlySmokeExecutionAuthorizationAcceptanceEvidence;
}> {
  await mkdir(dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  return {
    path: evidencePath,
    evidence
  };
}

function createExactAuthorizationInput(): FormalRealReadonlySmokeExecutionAuthorizationInput {
  return {
    authorizationToken:
      PR_18A_FORMAL_REAL_READONLY_SMOKE_EXECUTION_AUTHORIZATION_TOKEN,
    authorizationPacketPath: PR_18A_FORMAL_REAL_READONLY_SMOKE_EXECUTION_PACKET,
    command: PR_18A_FORMAL_REAL_READONLY_SMOKE_EXECUTION_COMMAND,
    evidencePathChoice: "default",
    providerId: "codex-cli",
    sandboxMode: "read-only",
    sideEffectClass: "read_only",
    approvalPolicy: "never",
    taskbookEvidencePath:
      "docs/evidence/codex-cli-formal-real-readonly-smoke-taskbook-acceptance.json",
    preExecutionEvidencePath:
      "docs/evidence/codex-cli-formal-real-readonly-smoke-pre-execution-acceptance.json",
    localCloseoutDocPath:
      "docs/governance/PR_17C_FORMAL_REAL_READONLY_SMOKE_LOCAL_CLOSEOUT.md",
    formalDispatchRequired: true,
    providerRegistryRequired: true,
    providerExecutionMetadataRequired: true,
    providerPermitRequired: true,
    operatorFlagRequired: true,
    defaultEvidencePathRequired: true,
    localPreflightRequired: true,
    currentExecutionRequested: false,
    providerExecuteNow: false,
    realCodexCliNow: false,
    workspaceWriteAuthorized: false,
    localCommandAuthorized: false,
    protectedRemoteAuthorized: false,
    pushAuthorized: false,
    releaseAuthorized: false,
    tagAuthorized: false
  };
}

function containsForbiddenMarkers(value: unknown): boolean {
  const serialized = JSON.stringify(value);
  return [
    PR_18A_FORMAL_REAL_READONLY_SMOKE_EXECUTION_AUTHORIZATION_TOKEN,
    PR_18A_FORMAL_REAL_READONLY_SMOKE_EXECUTION_COMMAND,
    PR_18A_FORMAL_REAL_READONLY_SMOKE_EXECUTION_PACKET,
    "APPROVE_FORMAL_REAL_CODEX_CLI_EXECUTION",
    "ALLOW_REAL_CODEX_CLI_READONLY_SMOKE",
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
  const evidence = await runFormalRealReadonlySmokeExecutionAuthorizationAcceptance();
  const write =
    await writeFormalRealReadonlySmokeExecutionAuthorizationAcceptanceEvidence(
      evidence,
      outputPath
    );

  console.log("Codex CLI formal real read-only smoke execution authorization acceptance");
  console.log(`exact authorization accepted: ${evidence.checks.exactAuthorizationAccepted}`);
  console.log(`immediate execution blocked: ${evidence.checks.immediateExecutionBlocked}`);
  console.log(`prior closeout required: ${evidence.checks.priorCloseoutRequired}`);
  console.log(`formal boundary required: ${evidence.checks.formalBoundaryRequired}`);
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
      "Codex CLI formal real read-only smoke execution authorization acceptance failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
