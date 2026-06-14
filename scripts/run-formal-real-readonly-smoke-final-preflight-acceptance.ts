#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const PR_18B_FORMAL_REAL_READONLY_SMOKE_FINAL_PREFLIGHT_PACKET =
  "docs/governance/PR_18B_FORMAL_REAL_READONLY_SMOKE_FINAL_PREFLIGHT.md";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const DEFAULT_EVIDENCE_PATH = join(
  __dirname,
  "..",
  "docs",
  "evidence",
  "codex-cli-formal-real-readonly-smoke-final-preflight-acceptance.json"
);
const DEFAULT_GENERATED_AT = "2026-06-15T00:00:00.000Z";

export interface FormalRealReadonlySmokeFinalPreflightInput {
  preflightPacketPath?: string;
  authorizationEvidencePath?: string;
  localCloseoutAuditRequired?: boolean;
  authorizationAcceptanceRequired?: boolean;
  taskbookAcceptanceRequired?: boolean;
  preExecutionAcceptanceRequired?: boolean;
  smokeScriptTestsRequired?: boolean;
  typecheckRequired?: boolean;
  fullTestRequired?: boolean;
  worktreeCleanRequired?: boolean;
  branchMainRequired?: boolean;
  notBehindRequired?: boolean;
  defaultEvidencePathRequired?: boolean;
  providerId?: string;
  sandboxMode?: string;
  sideEffectClass?: string;
  approvalPolicy?: string;
  formalDispatchRequired?: boolean;
  providerRegistryRequired?: boolean;
  providerExecutionMetadataRequired?: boolean;
  providerPermitRequired?: boolean;
  currentExecutionRequested?: boolean;
  operatorFlagSetByThisPreflight?: boolean;
  providerExecuteNow?: boolean;
  realCodexCliNow?: boolean;
  workspaceWriteAuthorized?: boolean;
  pushAuthorized?: boolean;
  releaseAuthorized?: boolean;
  tagAuthorized?: boolean;
}

export interface FormalRealReadonlySmokeFinalPreflightResult {
  ok: boolean;
  status: "accepted" | "blocked";
  reasons: string[];
  summary: {
    exactPacketMatched: boolean;
    authorizationEvidenceDeclared: boolean;
    localCloseoutAuditRequired: boolean;
    authorizationAcceptanceRequired: boolean;
    taskbookAcceptanceRequired: boolean;
    preExecutionAcceptanceRequired: boolean;
    smokeScriptTestsRequired: boolean;
    typecheckRequired: boolean;
    fullTestRequired: boolean;
    worktreeCleanRequired: boolean;
    branchMainRequired: boolean;
    notBehindRequired: boolean;
    defaultEvidencePathRequired: boolean;
    providerMatched: boolean;
    readOnlySandboxMatched: boolean;
    readOnlySideEffectMatched: boolean;
    approvalPolicyNeverMatched: boolean;
    formalDispatchRequired: boolean;
    providerRegistryRequired: boolean;
    providerExecutionMetadataRequired: boolean;
    providerPermitRequired: boolean;
    currentExecutionDisallowed: boolean;
    operatorFlagNotSetByPreflight: boolean;
    providerExecuteNowDisallowed: boolean;
    realCodexCliNowDisallowed: boolean;
    workspaceWriteDisallowed: boolean;
    pushDisallowed: boolean;
    releaseDisallowed: boolean;
    tagDisallowed: boolean;
    providerExecuteCalls: 0;
    realCodexCliCalls: 0;
    workspaceWriteExecuteCalls: 0;
  };
}

export interface FormalRealReadonlySmokeFinalPreflightAcceptanceEvidence {
  schemaVersion: "codex-cli-formal-real-readonly-smoke-final-preflight-acceptance.v1";
  generatedAt: string;
  mode: "formal-real-readonly-smoke-final-preflight-local-only";
  taskId: "codex-cli-formal-real-readonly-smoke-final-preflight-acceptance";
  checks: {
    exactPreflightAccepted: boolean;
    missingPreflightBlocked: boolean;
    broadenedPreflightBlocked: boolean;
    immediateExecutionBlocked: boolean;
    pushReleaseTagRejected: boolean;
    requiredValidationChainDeclared: boolean;
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
    requiredValidationCommandCount: number;
    localPreflightOnly: true;
    worktreeCleanMustBeRequired: true;
    branchMainMustBeRequired: true;
    notBehindMustBeRequired: true;
    operatorFlagMustNotBeSetByPreflight: true;
    currentExecutionMustRemainClosed: true;
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

export interface FormalRealReadonlySmokeFinalPreflightAcceptanceOptions {
  generatedAt?: string;
}

export function evaluateFormalRealReadonlySmokeFinalPreflight(
  input: FormalRealReadonlySmokeFinalPreflightInput
): FormalRealReadonlySmokeFinalPreflightResult {
  const exactPacketMatched =
    input.preflightPacketPath === PR_18B_FORMAL_REAL_READONLY_SMOKE_FINAL_PREFLIGHT_PACKET;
  const authorizationEvidenceDeclared =
    input.authorizationEvidencePath
      === "docs/evidence/codex-cli-formal-real-readonly-smoke-execution-authorization-acceptance.json";
  const localCloseoutAuditRequired = input.localCloseoutAuditRequired === true;
  const authorizationAcceptanceRequired = input.authorizationAcceptanceRequired === true;
  const taskbookAcceptanceRequired = input.taskbookAcceptanceRequired === true;
  const preExecutionAcceptanceRequired = input.preExecutionAcceptanceRequired === true;
  const smokeScriptTestsRequired = input.smokeScriptTestsRequired === true;
  const typecheckRequired = input.typecheckRequired === true;
  const fullTestRequired = input.fullTestRequired === true;
  const worktreeCleanRequired = input.worktreeCleanRequired === true;
  const branchMainRequired = input.branchMainRequired === true;
  const notBehindRequired = input.notBehindRequired === true;
  const defaultEvidencePathRequired = input.defaultEvidencePathRequired === true;
  const providerMatched = input.providerId === "codex-cli";
  const readOnlySandboxMatched = input.sandboxMode === "read-only";
  const readOnlySideEffectMatched = input.sideEffectClass === "read_only";
  const approvalPolicyNeverMatched = input.approvalPolicy === "never";
  const formalDispatchRequired = input.formalDispatchRequired === true;
  const providerRegistryRequired = input.providerRegistryRequired === true;
  const providerExecutionMetadataRequired =
    input.providerExecutionMetadataRequired === true;
  const providerPermitRequired = input.providerPermitRequired === true;
  const currentExecutionDisallowed = input.currentExecutionRequested !== true;
  const operatorFlagNotSetByPreflight = input.operatorFlagSetByThisPreflight !== true;
  const providerExecuteNowDisallowed = input.providerExecuteNow !== true;
  const realCodexCliNowDisallowed = input.realCodexCliNow !== true;
  const workspaceWriteDisallowed = input.workspaceWriteAuthorized !== true;
  const pushDisallowed = input.pushAuthorized !== true;
  const releaseDisallowed = input.releaseAuthorized !== true;
  const tagDisallowed = input.tagAuthorized !== true;
  const reasons = [
    ...(exactPacketMatched ? [] : ["formal_real_readonly_smoke_final_preflight_exact_packet_required"]),
    ...(authorizationEvidenceDeclared ? [] : ["formal_real_readonly_smoke_final_preflight_authorization_evidence_required"]),
    ...(localCloseoutAuditRequired ? [] : ["formal_real_readonly_smoke_final_preflight_closeout_audit_required"]),
    ...(authorizationAcceptanceRequired ? [] : ["formal_real_readonly_smoke_final_preflight_execution_auth_acceptance_required"]),
    ...(taskbookAcceptanceRequired ? [] : ["formal_real_readonly_smoke_final_preflight_taskbook_acceptance_required"]),
    ...(preExecutionAcceptanceRequired ? [] : ["formal_real_readonly_smoke_final_preflight_pre_execution_acceptance_required"]),
    ...(smokeScriptTestsRequired ? [] : ["formal_real_readonly_smoke_final_preflight_smoke_script_tests_required"]),
    ...(typecheckRequired ? [] : ["formal_real_readonly_smoke_final_preflight_typecheck_required"]),
    ...(fullTestRequired ? [] : ["formal_real_readonly_smoke_final_preflight_full_test_required"]),
    ...(worktreeCleanRequired ? [] : ["formal_real_readonly_smoke_final_preflight_clean_worktree_required"]),
    ...(branchMainRequired ? [] : ["formal_real_readonly_smoke_final_preflight_main_branch_required"]),
    ...(notBehindRequired ? [] : ["formal_real_readonly_smoke_final_preflight_not_behind_required"]),
    ...(defaultEvidencePathRequired ? [] : ["formal_real_readonly_smoke_final_preflight_default_evidence_path_required"]),
    ...(providerMatched ? [] : ["formal_real_readonly_smoke_final_preflight_provider_codex_cli_required"]),
    ...(readOnlySandboxMatched ? [] : ["formal_real_readonly_smoke_final_preflight_read_only_sandbox_required"]),
    ...(readOnlySideEffectMatched ? [] : ["formal_real_readonly_smoke_final_preflight_read_only_side_effect_required"]),
    ...(approvalPolicyNeverMatched ? [] : ["formal_real_readonly_smoke_final_preflight_approval_never_required"]),
    ...(formalDispatchRequired ? [] : ["formal_real_readonly_smoke_final_preflight_formal_dispatch_required"]),
    ...(providerRegistryRequired ? [] : ["formal_real_readonly_smoke_final_preflight_provider_registry_required"]),
    ...(providerExecutionMetadataRequired ? [] : ["formal_real_readonly_smoke_final_preflight_provider_execution_metadata_required"]),
    ...(providerPermitRequired ? [] : ["formal_real_readonly_smoke_final_preflight_provider_permit_required"]),
    ...(currentExecutionDisallowed ? [] : ["formal_real_readonly_smoke_final_preflight_current_execution_must_remain_closed"]),
    ...(operatorFlagNotSetByPreflight ? [] : ["formal_real_readonly_smoke_final_preflight_must_not_set_operator_flag"]),
    ...(providerExecuteNowDisallowed ? [] : ["formal_real_readonly_smoke_final_preflight_provider_execute_now_blocked"]),
    ...(realCodexCliNowDisallowed ? [] : ["formal_real_readonly_smoke_final_preflight_real_cli_now_blocked"]),
    ...(workspaceWriteDisallowed ? [] : ["formal_real_readonly_smoke_final_preflight_workspace_write_must_remain_closed"]),
    ...(pushDisallowed ? [] : ["formal_real_readonly_smoke_final_preflight_push_must_be_separate"]),
    ...(releaseDisallowed ? [] : ["formal_real_readonly_smoke_final_preflight_release_must_be_separate"]),
    ...(tagDisallowed ? [] : ["formal_real_readonly_smoke_final_preflight_tag_must_be_separate"])
  ];
  const uniqueReasons = uniqueStrings(reasons);

  return {
    ok: uniqueReasons.length === 0,
    status: uniqueReasons.length === 0 ? "accepted" : "blocked",
    reasons: uniqueReasons,
    summary: {
      exactPacketMatched,
      authorizationEvidenceDeclared,
      localCloseoutAuditRequired,
      authorizationAcceptanceRequired,
      taskbookAcceptanceRequired,
      preExecutionAcceptanceRequired,
      smokeScriptTestsRequired,
      typecheckRequired,
      fullTestRequired,
      worktreeCleanRequired,
      branchMainRequired,
      notBehindRequired,
      defaultEvidencePathRequired,
      providerMatched,
      readOnlySandboxMatched,
      readOnlySideEffectMatched,
      approvalPolicyNeverMatched,
      formalDispatchRequired,
      providerRegistryRequired,
      providerExecutionMetadataRequired,
      providerPermitRequired,
      currentExecutionDisallowed,
      operatorFlagNotSetByPreflight,
      providerExecuteNowDisallowed,
      realCodexCliNowDisallowed,
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

export async function runFormalRealReadonlySmokeFinalPreflightAcceptance(
  options: FormalRealReadonlySmokeFinalPreflightAcceptanceOptions = {}
): Promise<FormalRealReadonlySmokeFinalPreflightAcceptanceEvidence> {
  const generatedAt = options.generatedAt ?? DEFAULT_GENERATED_AT;
  const exactPreflight = evaluateFormalRealReadonlySmokeFinalPreflight(
    createExactFinalPreflightInput()
  );
  const missingPreflight = evaluateFormalRealReadonlySmokeFinalPreflight({});
  const broadenedPreflight = evaluateFormalRealReadonlySmokeFinalPreflight({
    preflightPacketPath: "docs/governance/PR_18_REAL_CLI_PREFLIGHT.md",
    authorizationEvidencePath:
      "docs/evidence/codex-cli-formal-real-readonly-smoke-execution-authorization-acceptance.json",
    localCloseoutAuditRequired: false,
    authorizationAcceptanceRequired: true,
    taskbookAcceptanceRequired: false,
    preExecutionAcceptanceRequired: false,
    smokeScriptTestsRequired: false,
    typecheckRequired: true,
    fullTestRequired: false,
    worktreeCleanRequired: false,
    branchMainRequired: true,
    notBehindRequired: false,
    defaultEvidencePathRequired: false,
    providerId: "codex-cli",
    sandboxMode: "workspace-write",
    sideEffectClass: "workspace_write",
    approvalPolicy: "on-request",
    formalDispatchRequired: false,
    providerRegistryRequired: false,
    providerExecutionMetadataRequired: false,
    providerPermitRequired: false,
    workspaceWriteAuthorized: true
  });
  const immediateExecution = evaluateFormalRealReadonlySmokeFinalPreflight({
    ...createExactFinalPreflightInput(),
    currentExecutionRequested: true,
    operatorFlagSetByThisPreflight: true,
    providerExecuteNow: true,
    realCodexCliNow: true
  });
  const pushReleaseTag = evaluateFormalRealReadonlySmokeFinalPreflight({
    ...createExactFinalPreflightInput(),
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
    FormalRealReadonlySmokeFinalPreflightAcceptanceEvidence,
    "checks"
  > & {
    checks: Omit<
      FormalRealReadonlySmokeFinalPreflightAcceptanceEvidence["checks"],
      "leakCheckPassed"
    >;
  } = {
    schemaVersion:
      "codex-cli-formal-real-readonly-smoke-final-preflight-acceptance.v1",
    generatedAt,
    mode: "formal-real-readonly-smoke-final-preflight-local-only",
    taskId: "codex-cli-formal-real-readonly-smoke-final-preflight-acceptance",
    checks: {
      exactPreflightAccepted: exactPreflight.status === "accepted",
      missingPreflightBlocked: missingPreflight.status === "blocked"
        && missingPreflight.reasons.includes(
          "formal_real_readonly_smoke_final_preflight_exact_packet_required"
        )
        && missingPreflight.reasons.includes(
          "formal_real_readonly_smoke_final_preflight_authorization_evidence_required"
        ),
      broadenedPreflightBlocked: broadenedPreflight.status === "blocked"
        && broadenedPreflight.reasons.includes(
          "formal_real_readonly_smoke_final_preflight_read_only_sandbox_required"
        )
        && broadenedPreflight.reasons.includes(
          "formal_real_readonly_smoke_final_preflight_workspace_write_must_remain_closed"
        ),
      immediateExecutionBlocked: immediateExecution.status === "blocked"
        && immediateExecution.reasons.includes(
          "formal_real_readonly_smoke_final_preflight_current_execution_must_remain_closed"
        )
        && immediateExecution.reasons.includes(
          "formal_real_readonly_smoke_final_preflight_must_not_set_operator_flag"
        )
        && immediateExecution.reasons.includes(
          "formal_real_readonly_smoke_final_preflight_real_cli_now_blocked"
        ),
      pushReleaseTagRejected: pushReleaseTag.status === "blocked"
        && pushReleaseTag.reasons.includes(
          "formal_real_readonly_smoke_final_preflight_push_must_be_separate"
        )
        && pushReleaseTag.reasons.includes(
          "formal_real_readonly_smoke_final_preflight_release_must_be_separate"
        )
        && pushReleaseTag.reasons.includes(
          "formal_real_readonly_smoke_final_preflight_tag_must_be_separate"
        ),
      requiredValidationChainDeclared:
        exactPreflight.summary.authorizationAcceptanceRequired
        && exactPreflight.summary.taskbookAcceptanceRequired
        && exactPreflight.summary.preExecutionAcceptanceRequired
        && exactPreflight.summary.localCloseoutAuditRequired
        && exactPreflight.summary.smokeScriptTestsRequired
        && exactPreflight.summary.typecheckRequired
        && exactPreflight.summary.fullTestRequired,
      formalBoundaryRequired:
        exactPreflight.summary.formalDispatchRequired
        && exactPreflight.summary.providerRegistryRequired
        && exactPreflight.summary.providerExecutionMetadataRequired
        && exactPreflight.summary.providerPermitRequired,
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
      requiredValidationCommandCount: 7,
      localPreflightOnly: true,
      worktreeCleanMustBeRequired: true,
      branchMainMustBeRequired: true,
      notBehindMustBeRequired: true,
      operatorFlagMustNotBeSetByPreflight: true,
      currentExecutionMustRemainClosed: true,
      workspaceWriteMustRemainClosed: true,
      pushReleaseTagMustBeSeparate: true
    },
    counters,
    blockingReasons: uniqueStrings([
      ...missingPreflight.reasons,
      ...broadenedPreflight.reasons,
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

export async function writeFormalRealReadonlySmokeFinalPreflightAcceptanceEvidence(
  evidence: FormalRealReadonlySmokeFinalPreflightAcceptanceEvidence,
  evidencePath = DEFAULT_EVIDENCE_PATH
): Promise<{
  path: string;
  evidence: FormalRealReadonlySmokeFinalPreflightAcceptanceEvidence;
}> {
  await mkdir(dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  return {
    path: evidencePath,
    evidence
  };
}

function createExactFinalPreflightInput(): FormalRealReadonlySmokeFinalPreflightInput {
  return {
    preflightPacketPath: PR_18B_FORMAL_REAL_READONLY_SMOKE_FINAL_PREFLIGHT_PACKET,
    authorizationEvidencePath:
      "docs/evidence/codex-cli-formal-real-readonly-smoke-execution-authorization-acceptance.json",
    localCloseoutAuditRequired: true,
    authorizationAcceptanceRequired: true,
    taskbookAcceptanceRequired: true,
    preExecutionAcceptanceRequired: true,
    smokeScriptTestsRequired: true,
    typecheckRequired: true,
    fullTestRequired: true,
    worktreeCleanRequired: true,
    branchMainRequired: true,
    notBehindRequired: true,
    defaultEvidencePathRequired: true,
    providerId: "codex-cli",
    sandboxMode: "read-only",
    sideEffectClass: "read_only",
    approvalPolicy: "never",
    formalDispatchRequired: true,
    providerRegistryRequired: true,
    providerExecutionMetadataRequired: true,
    providerPermitRequired: true,
    currentExecutionRequested: false,
    operatorFlagSetByThisPreflight: false,
    providerExecuteNow: false,
    realCodexCliNow: false,
    workspaceWriteAuthorized: false,
    pushAuthorized: false,
    releaseAuthorized: false,
    tagAuthorized: false
  };
}

function containsForbiddenMarkers(value: unknown): boolean {
  const serialized = JSON.stringify(value);
  return [
    "ALLOW_REAL_CODEX_CLI_READONLY_SMOKE",
    "smoke:readonly:real",
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
  const evidence = await runFormalRealReadonlySmokeFinalPreflightAcceptance();
  const write = await writeFormalRealReadonlySmokeFinalPreflightAcceptanceEvidence(
    evidence,
    outputPath
  );

  console.log("Codex CLI formal real read-only smoke final preflight acceptance");
  console.log(`exact preflight accepted: ${evidence.checks.exactPreflightAccepted}`);
  console.log(`validation chain declared: ${evidence.checks.requiredValidationChainDeclared}`);
  console.log(`formal boundary required: ${evidence.checks.formalBoundaryRequired}`);
  console.log(`immediate execution blocked: ${evidence.checks.immediateExecutionBlocked}`);
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
      "Codex CLI formal real read-only smoke final preflight acceptance failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
