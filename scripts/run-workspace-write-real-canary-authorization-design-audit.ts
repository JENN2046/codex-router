#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const GOVERNANCE_RUNNER = "scripts/run-governance-check.ts";
const GOVERNANCE_README = "docs/governance/README.md";
const CURRENT_STATE_DOC = "docs/current/CURRENT_STATE.md";
const DESIGN_DOC =
  "docs/governance/WORKSPACE_WRITE_REAL_CANARY_AUTHORIZATION_PACKET.md";
const RELEASE_GATE_DOC = "docs/governance/WORKSPACE_WRITE_RELEASE_GATE.md";
const RUNBOOK_DOC = "docs/governance/runbooks/WORKSPACE_WRITE_CANARY_RUNBOOK.md";
const EVIDENCE_POLICY_DOC = "docs/governance/EVIDENCE_POLICY.md";
const THREAT_MODEL_DOC = "docs/governance/THREAT_MODEL.md";
const PERMIT_V2_DOC = "docs/governance/PR_23D_WORKSPACE_WRITE_PERMIT_V2.md";
const FAKE_CANARY_V2_DOC =
  "docs/governance/PR_23E_WORKSPACE_WRITE_FAKE_CANARY_V2.md";
const WORKSPACE_WRITE_GUARD =
  "packages/governance-internal-workspace-write-guard/src/index.ts";
const PRE_EXECUTION_ACCEPTANCE =
  "scripts/run-workspace-write-real-canary-pre-execution-acceptance.ts";
const AUTHORIZATION_ACCEPTANCE =
  "scripts/run-workspace-write-real-canary-authorization-acceptance.ts";
const DESIGN_TEST =
  "tests/workspace-write-real-canary-authorization-design-audit.test.ts";
const PRE_EXECUTION_TEST =
  "tests/workspace-write-real-canary-pre-execution-acceptance.test.ts";
const AUTHORIZATION_TEST =
  "tests/workspace-write-real-canary-authorization-acceptance.test.ts";

const REQUIRED_DESIGN_MARKERS = [
  "mode: `real_canary_authorization_design_only`",
  "`workspace-write-real-canary-authorization-packet.v1`",
  "`authorizationIntent`: `workspace_write_real_canary`",
  "`authorizationScope`: `single_local_canary_write_only`",
  "`operatorAuthorizationId`: required and unique for the run",
  "`providerId`: `codex-cli`",
  "`targetFile`: `tmp/codex-cli-write-canary.txt`",
  "`allowedAction`: `one bounded local canary write`",
  "`sideEffectClass`: `workspace_write`",
  "`sandbox`: `workspace-write`",
  "`maxChangedFiles`: `1`",
  "`maxDiffLines`: `2`",
  "`rollbackRequired`: `true`",
  "`canaryFileAbsentBeforeExecution`: `true`",
  "`branchPolicy`: `non_main_non_protected_branch_only`",
  "`worktreeCleanRequired`: `true`",
  "`beforeCommitRequired`: `true`",
  "`permitV2Required`: `true`",
  "`fakeCanaryV2Required`: `true`",
  "`releaseGateRequired`: `true`",
  "`pushAuthorized`: `false`",
  "`releaseAuthorized`: `false`",
  "`tagAuthorized`: `false`",
  "`deploymentAuthorized`: `false`",
  "`packagePublishAuthorized`: `false`",
  "`externalWriteAuthorized`: `false`",
  "`secretMutationAuthorized`: `false`",
  "`WORKSPACE_WRITE_REAL_CANARY_AUTHORIZATION_PACKET_DESIGNED`"
] as const;

const REQUIRED_PREFLIGHT_MARKERS = [
  "workspace-write release gate passed for the exact target",
  "authorization packet design audit passed",
  "fake canary v2 acceptance passed with permit v2 and replay blocking",
  "pre-execution acceptance evidence is fresh, local-only, and sanitized",
  "exact target allowlist contains only `tmp/codex-cli-write-canary.txt`",
  "current branch is not `main`",
  "current branch is not protected",
  "worktree is clean",
  "local branch is not behind its reviewed base",
  "canary target file is absent before execution",
  "`beforeCommit` is recorded",
  "rollback command identity is recorded",
  "patch digest is recorded without raw patch contents",
  "patch guard passes",
  "sensitive-value scan passes",
  "post-run diff inspection plan is recorded",
  "no push, release, tag, deployment, package publish, external write, or secret\n  mutation is bundled into the same action"
] as const;

const REQUIRED_PERMIT_MARKERS = [
  "schema version: `provider-workspace-write-execution-permit.v2`",
  "expiration",
  "nonce",
  "single-use consumption record",
  "operator authorization id",
  "target file allowlist containing only `tmp/codex-cli-write-canary.txt`",
  "policy decision hash binding",
  "provider manifest hash binding",
  "provider execution plan hash binding",
  "principal hash binding",
  "`beforeCommit` binding",
  "rollback command identity binding",
  "protected branch forbidden",
  "dirty worktree forbidden"
] as const;

const REQUIRED_ALLOWED_EVIDENCE_MARKERS = [
  "authorization packet id",
  "operator authorization id",
  "permit id and consumption status",
  "patch digest",
  "rollback command identity and rollback result",
  "sanitized reason codes and summaries"
] as const;

const REQUIRED_FORBIDDEN_EVIDENCE_MARKERS = [
  "raw patch body",
  "raw stdout/stderr transcript",
  "raw prompt",
  "raw provider payload",
  "raw command arguments",
  "env values",
  "tokens, cookies, credentials, API keys, or auth headers",
  "private memory or browser login state"
] as const;

const REQUIRED_RELEASE_BINDING_MARKERS = [
  "Workspace-write real canary | Experimental and blocked by default.",
  "Real workspace-write execution requires the exact",
  "WORKSPACE_WRITE_REAL_CANARY_AUTHORIZATION_PACKET.md",
  "and a fresh explicit authorization packet."
] as const;

const REQUIRED_SOURCE_MARKERS = [
  "evaluateWorkspaceWriteRealCanaryAuthorization",
  "evaluateWorkspaceWriteRealCanaryPreExecutionGate",
  "evaluateWorkspaceWriteCanaryReadiness",
  "providerExecuteCalls: z.literal(0)",
  "realCodexCliCalls: z.literal(0)",
  "workspaceWriteExecuteCalls: z.literal(0)",
  "canaryFileWrites: z.literal(0)"
] as const;

const REQUIRED_ACCEPTANCE_MARKERS = [
  "workspace-write real canary authorization acceptance stays local-only",
  "workspace-write real canary pre-execution acceptance stays local-only",
  "noWorkspaceWriteExecute",
  "noRealCodexCli",
  "noCanaryFileWrite",
  "leakCheckPassed"
] as const;

const FORBIDDEN_AUTHORIZATION_MARKERS = [
  "workspace-write authorized: `true`",
  "real workspace-write authorized: `true`",
  "real Codex CLI authorized: `true`",
  "provider execute authorized: `true`",
  "host executor authorized: `true`",
  "sub-agent runtime authorized: `true`",
  "external write authorized: `true`",
  "push authorized: `true`",
  "release authorized: `true`",
  "deployment authorized: `true`",
  "package publish authorized: `true`",
  "secret mutation authorized: `true`",
  "`branchPolicy`: `main`",
  "`targetFile`: `*`",
  "run the real canary now",
  "execute the real canary now",
  "design audit is execution permission",
  "permit validation is execution authorization",
  "release gate review is execution authorization"
] as const;

const FORBIDDEN_RUNTIME_MARKERS = [
  "provider.execute(",
  "runCodexCli(",
  "dispatchGovernanceOperatorActionHostExecutor(",
  "invokeSubAgent(",
  "spawnSubAgent(",
  "dispatchToHost(",
  "runDesktopTask(",
  "fetch(",
  "writeFile(",
  "appendFile(",
  "rm(",
  "rename(",
  "copyFile("
] as const;

const FORBIDDEN_OUTPUT_MARKERS = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
] as const;

export interface WorkspaceWriteRealCanaryAuthorizationDesignAuditInput {
  governanceRunnerText: string;
  governanceReadmeText: string;
  currentStateText: string;
  designDocText: string;
  releaseGateText: string;
  runbookText: string;
  evidencePolicyText: string;
  threatModelText: string;
  permitV2DocText: string;
  fakeCanaryV2DocText: string;
  workspaceWriteGuardText: string;
  preExecutionAcceptanceText: string;
  authorizationAcceptanceText: string;
  designTestText: string;
  preExecutionTestText: string;
  authorizationTestText: string;
}

export interface WorkspaceWriteRealCanaryAuthorizationDesignAuditResult {
  status: "passed" | "blocked";
  checks: {
    governanceRunnerRegistered: boolean;
    governanceReadmeListsAudit: boolean;
    currentStateListsAudit: boolean;
    designDocRecorded: boolean;
    releaseGateBindingRecorded: boolean;
    runbookBindingRecorded: boolean;
    permitV2BindingRecorded: boolean;
    fakeCanaryV2BindingRecorded: boolean;
    preExecutionChecksRecorded: boolean;
    evidencePolicyAligned: boolean;
    threatModelAligned: boolean;
    implementationAnchorsRecorded: boolean;
    acceptanceCoverageRecorded: boolean;
    noBroadAuthorizationText: boolean;
    noRuntimeInvocationSurface: boolean;
    outputSanitized: boolean;
  };
  summary: {
    designMode: "real_canary_authorization_design_only";
    packetSchemaVersion: "workspace-write-real-canary-authorization-packet.v1";
    realCanaryDefault: "blocked";
    generalWorkspaceWriteDefault: "blocked";
    designIsWorkspaceWriteAuthorization: false;
    designIsRealCodexCliAuthorization: false;
    designIsProviderExecutionAuthorization: false;
    designIsHostExecutorAuthorization: false;
    designIsSubAgentRuntimeAuthorization: false;
    designIsExternalWriteAuthorization: false;
    designIsPushAuthorization: false;
    designIsReleaseAuthorization: false;
    providerExecuteCallsDuringAudit: 0;
    codexCliCallsDuringAudit: 0;
    workspaceWriteCallsDuringAudit: 0;
    hostExecutorCallsDuringAudit: 0;
    subAgentRuntimeCallsDuringAudit: 0;
    externalWriteCallsDuringAudit: 0;
    canaryFileWritesDuringAudit: 0;
    evidenceWritesDuringAudit: 0;
  };
  reasons: string[];
}

export type WorkspaceWriteRealCanaryAuthorizationDesignAuditOutputFormat =
  | "text"
  | "json";

export async function collectWorkspaceWriteRealCanaryAuthorizationDesignAuditInput(
  cwd = process.cwd()
): Promise<WorkspaceWriteRealCanaryAuthorizationDesignAuditInput> {
  const [
    governanceRunnerText,
    governanceReadmeText,
    currentStateText,
    designDocText,
    releaseGateText,
    runbookText,
    evidencePolicyText,
    threatModelText,
    permitV2DocText,
    fakeCanaryV2DocText,
    workspaceWriteGuardText,
    preExecutionAcceptanceText,
    authorizationAcceptanceText,
    designTestText,
    preExecutionTestText,
    authorizationTestText
  ] = await Promise.all([
    read(cwd, GOVERNANCE_RUNNER),
    read(cwd, GOVERNANCE_README),
    read(cwd, CURRENT_STATE_DOC),
    read(cwd, DESIGN_DOC),
    read(cwd, RELEASE_GATE_DOC),
    read(cwd, RUNBOOK_DOC),
    read(cwd, EVIDENCE_POLICY_DOC),
    read(cwd, THREAT_MODEL_DOC),
    read(cwd, PERMIT_V2_DOC),
    read(cwd, FAKE_CANARY_V2_DOC),
    read(cwd, WORKSPACE_WRITE_GUARD),
    read(cwd, PRE_EXECUTION_ACCEPTANCE),
    read(cwd, AUTHORIZATION_ACCEPTANCE),
    read(cwd, DESIGN_TEST),
    read(cwd, PRE_EXECUTION_TEST),
    read(cwd, AUTHORIZATION_TEST)
  ]);

  return {
    governanceRunnerText,
    governanceReadmeText,
    currentStateText,
    designDocText,
    releaseGateText,
    runbookText,
    evidencePolicyText,
    threatModelText,
    permitV2DocText,
    fakeCanaryV2DocText,
    workspaceWriteGuardText,
    preExecutionAcceptanceText,
    authorizationAcceptanceText,
    designTestText,
    preExecutionTestText,
    authorizationTestText
  };
}

export function reviewWorkspaceWriteRealCanaryAuthorizationDesignAudit(
  input: WorkspaceWriteRealCanaryAuthorizationDesignAuditInput
): WorkspaceWriteRealCanaryAuthorizationDesignAuditResult {
  const authorityText = [
    input.designDocText,
    input.releaseGateText,
    input.runbookText,
    input.evidencePolicyText,
    input.threatModelText,
    input.permitV2DocText,
    input.fakeCanaryV2DocText
  ].join("\n");
  const sourceText = [
    input.workspaceWriteGuardText,
    input.preExecutionAcceptanceText,
    input.authorizationAcceptanceText
  ].join("\n");
  const testsText = [
    input.designTestText,
    input.preExecutionTestText,
    input.authorizationTestText
  ].join("\n");

  const checks = {
    governanceRunnerRegistered: input.governanceRunnerText.includes(
      "auditCheck(\"workspace-write-real-canary-authorization-design\""
    ),
    governanceReadmeListsAudit: input.governanceReadmeText.includes(
      "npm run governance -- audit workspace-write-real-canary-authorization-design"
    ),
    currentStateListsAudit: input.currentStateText.includes(
      "npm run governance -- audit workspace-write-real-canary-authorization-design"
    ),
    designDocRecorded:
      markersPresent(input.designDocText, REQUIRED_DESIGN_MARKERS),
    releaseGateBindingRecorded:
      markersPresent(input.releaseGateText, REQUIRED_RELEASE_BINDING_MARKERS)
      && input.designDocText.includes("Workspace-write Release Gate"),
    runbookBindingRecorded:
      input.runbookText.includes("Workspace-write Release Gate")
      && input.runbookText.includes("WORKSPACE_WRITE_REAL_CANARY_AUTHORIZATION_PACKET.md")
      && input.designDocText.includes(
        "docs/governance/runbooks/WORKSPACE_WRITE_CANARY_RUNBOOK.md"
      ),
    permitV2BindingRecorded:
      markersPresent(input.designDocText, REQUIRED_PERMIT_MARKERS)
      && input.permitV2DocText.includes("provider-workspace-write-execution-permit.v2"),
    fakeCanaryV2BindingRecorded:
      input.designDocText.includes("fake canary v2 acceptance passed with permit v2")
      && input.fakeCanaryV2DocText.includes("single-use permit consumption"),
    preExecutionChecksRecorded:
      markersPresent(input.designDocText, REQUIRED_PREFLIGHT_MARKERS),
    evidencePolicyAligned:
      evidenceContractAligned(input.designDocText)
      && input.evidencePolicyText.includes(
        "Workspace-write evidence must prove scope without storing raw write material."
      ),
    threatModelAligned:
      input.threatModelText.includes(
        "Workspace-write real canary is blocked by default and requires an exact\n  authorization packet."
      )
      && input.designDocText.includes("current branch is not `main`"),
    implementationAnchorsRecorded:
      markersPresent(sourceText, REQUIRED_SOURCE_MARKERS),
    acceptanceCoverageRecorded:
      markersPresent(testsText, REQUIRED_ACCEPTANCE_MARKERS),
    noBroadAuthorizationText:
      !containsForbidden(authorityText, FORBIDDEN_AUTHORIZATION_MARKERS),
    noRuntimeInvocationSurface:
      !containsForbidden(authorityText, FORBIDDEN_RUNTIME_MARKERS),
    outputSanitized: outputSanitized()
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      designMode: "real_canary_authorization_design_only",
      packetSchemaVersion: "workspace-write-real-canary-authorization-packet.v1",
      realCanaryDefault: "blocked",
      generalWorkspaceWriteDefault: "blocked",
      designIsWorkspaceWriteAuthorization: false,
      designIsRealCodexCliAuthorization: false,
      designIsProviderExecutionAuthorization: false,
      designIsHostExecutorAuthorization: false,
      designIsSubAgentRuntimeAuthorization: false,
      designIsExternalWriteAuthorization: false,
      designIsPushAuthorization: false,
      designIsReleaseAuthorization: false,
      providerExecuteCallsDuringAudit: 0,
      codexCliCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      hostExecutorCallsDuringAudit: 0,
      subAgentRuntimeCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0,
      canaryFileWritesDuringAudit: 0,
      evidenceWritesDuringAudit: 0
    },
    reasons
  };
}

export function formatWorkspaceWriteRealCanaryAuthorizationDesignAuditResult(
  result: WorkspaceWriteRealCanaryAuthorizationDesignAuditResult,
  format: WorkspaceWriteRealCanaryAuthorizationDesignAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return `${JSON.stringify(result, null, 2)}\n`;
  }

  return [
    "Workspace-write real canary authorization design audit",
    `status: ${result.status}`,
    `design mode: ${result.summary.designMode}`,
    `packet schema version: ${result.summary.packetSchemaVersion}`,
    `real canary default: ${result.summary.realCanaryDefault}`,
    `general workspace-write default: ${result.summary.generalWorkspaceWriteDefault}`,
    `design is workspace-write authorization: ${result.summary.designIsWorkspaceWriteAuthorization}`,
    `design is real Codex CLI authorization: ${result.summary.designIsRealCodexCliAuthorization}`,
    `design is provider execution authorization: ${result.summary.designIsProviderExecutionAuthorization}`,
    `design is host executor authorization: ${result.summary.designIsHostExecutorAuthorization}`,
    `design is sub-agent runtime authorization: ${result.summary.designIsSubAgentRuntimeAuthorization}`,
    `design is external-write authorization: ${result.summary.designIsExternalWriteAuthorization}`,
    `design is push authorization: ${result.summary.designIsPushAuthorization}`,
    `design is release authorization: ${result.summary.designIsReleaseAuthorization}`,
    `provider execute calls during audit: ${result.summary.providerExecuteCallsDuringAudit}`,
    `Codex CLI calls during audit: ${result.summary.codexCliCallsDuringAudit}`,
    `workspace-write calls during audit: ${result.summary.workspaceWriteCallsDuringAudit}`,
    `host executor calls during audit: ${result.summary.hostExecutorCallsDuringAudit}`,
    `sub-agent runtime calls during audit: ${result.summary.subAgentRuntimeCallsDuringAudit}`,
    `external-write calls during audit: ${result.summary.externalWriteCallsDuringAudit}`,
    `canary file writes during audit: ${result.summary.canaryFileWritesDuringAudit}`,
    `evidence writes during audit: ${result.summary.evidenceWritesDuringAudit}`,
    ...(result.reasons.length > 0
      ? [`blocking reasons: ${result.reasons.join(", ")}`]
      : [])
  ].join("\n") + "\n";
}

function collectReasons(checks: Record<string, boolean>): string[] {
  return Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => `workspace_write_real_canary_authorization_design_${name}`);
}

function markersPresent(text: string, markers: readonly string[]): boolean {
  return markers.every((marker) => text.includes(marker));
}

function containsForbidden(text: string, markers: readonly string[]): boolean {
  return markers.some((marker) => text.includes(marker));
}

function evidenceContractAligned(text: string): boolean {
  const allowedEvidence = textBetween(
    text,
    "Allowed evidence:",
    "Forbidden evidence:"
  );
  const forbiddenEvidence = textBetween(
    text,
    "Forbidden evidence:",
    "## Non-actions"
  );

  return allowedEvidence !== undefined
    && forbiddenEvidence !== undefined
    && markersPresent(allowedEvidence, REQUIRED_ALLOWED_EVIDENCE_MARKERS)
    && markersPresent(forbiddenEvidence, REQUIRED_FORBIDDEN_EVIDENCE_MARKERS)
    && !containsForbidden(allowedEvidence, REQUIRED_FORBIDDEN_EVIDENCE_MARKERS);
}

function textBetween(
  text: string,
  startMarker: string,
  endMarker: string
): string | undefined {
  const start = text.indexOf(startMarker);
  if (start === -1) {
    return undefined;
  }
  const contentStart = start + startMarker.length;
  const end = text.indexOf(endMarker, contentStart);
  if (end === -1) {
    return undefined;
  }

  return text.slice(contentStart, end);
}

function outputSanitized(): boolean {
  const result = formatWorkspaceWriteRealCanaryAuthorizationDesignAuditResult({
    status: "passed",
    checks: {
      governanceRunnerRegistered: true,
      governanceReadmeListsAudit: true,
      currentStateListsAudit: true,
      designDocRecorded: true,
      releaseGateBindingRecorded: true,
      runbookBindingRecorded: true,
      permitV2BindingRecorded: true,
      fakeCanaryV2BindingRecorded: true,
      preExecutionChecksRecorded: true,
      evidencePolicyAligned: true,
      threatModelAligned: true,
      implementationAnchorsRecorded: true,
      acceptanceCoverageRecorded: true,
      noBroadAuthorizationText: true,
      noRuntimeInvocationSurface: true,
      outputSanitized: true
    },
    summary: {
      designMode: "real_canary_authorization_design_only",
      packetSchemaVersion: "workspace-write-real-canary-authorization-packet.v1",
      realCanaryDefault: "blocked",
      generalWorkspaceWriteDefault: "blocked",
      designIsWorkspaceWriteAuthorization: false,
      designIsRealCodexCliAuthorization: false,
      designIsProviderExecutionAuthorization: false,
      designIsHostExecutorAuthorization: false,
      designIsSubAgentRuntimeAuthorization: false,
      designIsExternalWriteAuthorization: false,
      designIsPushAuthorization: false,
      designIsReleaseAuthorization: false,
      providerExecuteCallsDuringAudit: 0,
      codexCliCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      hostExecutorCallsDuringAudit: 0,
      subAgentRuntimeCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0,
      canaryFileWritesDuringAudit: 0,
      evidenceWritesDuringAudit: 0
    },
    reasons: []
  });

  return FORBIDDEN_OUTPUT_MARKERS.every((marker) => !result.includes(marker));
}

async function read(cwd: string, filePath: string): Promise<string> {
  return readFile(join(cwd, filePath), "utf8");
}

async function main(): Promise<void> {
  const format: WorkspaceWriteRealCanaryAuthorizationDesignAuditOutputFormat =
    process.argv.includes("--json") ? "json" : "text";
  const result = reviewWorkspaceWriteRealCanaryAuthorizationDesignAudit(
    await collectWorkspaceWriteRealCanaryAuthorizationDesignAuditInput()
  );
  process.stdout.write(
    formatWorkspaceWriteRealCanaryAuthorizationDesignAuditResult(result, format)
  );
  process.exitCode = result.status === "passed" ? 0 : 1;
}

const invokedPath = process.argv[1];

if (invokedPath !== undefined && import.meta.url === pathToFileURL(invokedPath).href) {
  main().catch((error) => {
    console.error(
      "Workspace-write real canary authorization design audit failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
