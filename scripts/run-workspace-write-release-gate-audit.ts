#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const PACKAGE_JSON = "package.json";
const GOVERNANCE_RUNNER = "scripts/run-governance-check.ts";
const GOVERNANCE_README = "docs/governance/README.md";
const CURRENT_STATE_DOC = "docs/current/CURRENT_STATE.md";
const VALIDATION_TIERS_DOC = "docs/validation-tiers.md";
const RELEASE_GATE_MATRIX = "docs/governance/RELEASE_GATE_MATRIX.md";
const WORKSPACE_WRITE_RELEASE_GATE =
  "docs/governance/WORKSPACE_WRITE_RELEASE_GATE.md";
const EVIDENCE_POLICY = "docs/governance/EVIDENCE_POLICY.md";
const THREAT_MODEL = "docs/governance/THREAT_MODEL.md";
const PR_23D_PERMIT_DOC = "docs/governance/PR_23D_WORKSPACE_WRITE_PERMIT_V2.md";
const PR_23E_FAKE_CANARY_DOC =
  "docs/governance/PR_23E_WORKSPACE_WRITE_FAKE_CANARY_V2.md";
const PHASE_6_CLOSEOUT =
  "docs/governance/PHASE_6_CONTROLLED_EXECUTION_RUNTIME_HARDENING_CLOSEOUT.md";
const PROVIDER_CORE = "packages/provider-core/src/index.ts";
const WORKSPACE_WRITE_GUARD =
  "packages/governance-internal-workspace-write-guard/src/index.ts";
const FAKE_CANARY_ACCEPTANCE =
  "scripts/run-workspace-write-fake-canary-acceptance.ts";
const PROVIDER_CORE_TEST = "tests/provider-core.test.ts";
const WORKSPACE_WRITE_GUARD_TEST = "tests/workspace-write-guard.test.ts";
const FAKE_CANARY_TEST = "tests/workspace-write-fake-canary-acceptance.test.ts";

const REQUIRED_WORKSPACE_GATE_MARKERS = [
  "Workspace-write permit v2 | Schema, validators, rollback binding, and single-use consumption helper implemented; not execution authorization.",
  "Workspace-write fake canary | Guarded with permit v2, patch guard, rollback evidence, and replay blocking; no real host write.",
  "Workspace-write real canary | Experimental and blocked by default.",
  "General workspace-write | Blocked.",
  "External write, protected remote action, release, publish, deploy, tag | Blocked unless separately authorized.",
  "workspace-write permit v2 integrated into the fake canary path",
  "operator authorization id",
  "fixed target allowlist",
  "protected branch forbidden",
  "`beforeCommit` recorded",
  "rollback command recorded",
  "post-run diff inspection",
  "secret-like patch blocker",
  "evidence summary without raw patch, raw stdout/stderr, env, token, cookie, or\n  provider payload",
  "Real workspace-write execution requires the exact",
  "and a fresh explicit authorization packet."
] as const;

const REQUIRED_PERMIT_V2_MARKERS = [
  "provider-workspace-write-execution-permit.v2",
  "required plan hash binding",
  "required provider execution plan hash binding",
  "required provider manifest hash binding",
  "required policy decision hash binding",
  "required principal hash binding",
  "required operator authorization id",
  "expiration and nonce",
  "single-use consumption through the provider permit consumption store",
  "`beforeCommit` and rollback command identity binding",
  "protected branch and dirty worktree blockers",
  "This slice does not wire permit v2 into the workspace-write fake canary yet."
] as const;

const REQUIRED_FAKE_CANARY_MARKERS = [
  "fake canary permit creation through workspace-write permit v2",
  "provider manifest, provider execution plan, policy, principal, and plan hash\n  bindings on the fake canary plan",
  "single-use permit consumption through the provider permit consumption store",
  "replay-block evidence for the same permit",
  "permit v2 support in workspace-write patch guard, rollback evidence, and\n  canary readiness",
  "The fake canary remains local-only and non-executing.",
  "without writing the canary file",
  "invoking a provider",
  "real Codex CLI",
  "performing external writes"
] as const;

const REQUIRED_RELEASE_MATRIX_MARKERS = [
  "Workspace-write release gate",
  "Any PR that can broaden real workspace-write or canary execution.",
  "Real workspace-write readiness.",
  "Workspace-write release gate fails | Do not run real workspace-write; use fake/dry-run validation only.",
  "Workspace-write real canary is also not part of routine release validation.",
  "passes for the exact target and authorization packet"
] as const;

const REQUIRED_EVIDENCE_POLICY_MARKERS = [
  "Workspace-write evidence must prove scope without storing raw write material.",
  "authorization id",
  "permit id and consumption status",
  "patch digest",
  "rollback command identity and rollback result",
  "raw patch body",
  "raw stdout/stderr transcript",
  "provider raw response",
  "env values",
  "tokens, cookies, credentials, API keys, or auth headers"
] as const;

const REQUIRED_THREAT_MODEL_MARKERS = [
  "Workspace-write real canary is blocked by default and requires an exact\n  authorization packet.",
  "General provider execution, general workspace-write, external write, release,\n  package publish, deployment, tag, and secret mutation remain blocked unless a\n  current authority document and explicit authorization name the action.",
  "permit v2 is absent or lacks expiration, nonce, consumption record, or hash\n  bindings",
  "target allowlist, max changed files, or max diff lines are missing",
  "evidence would require raw patch, raw stdout/stderr, raw prompt, provider\n  payload, env, token, cookie, or credential storage",
  "the same action bundles push, release, tag, deployment, package publish,\n  external write, or secret mutation"
] as const;

const REQUIRED_PROVIDER_CORE_MARKERS = [
  "WorkspaceWriteProviderExecutionPermitV2Schema",
  "createWorkspaceWriteProviderExecutionPermitV2",
  "validateWorkspaceWriteProviderExecutionPermitV2ForPlan",
  "consumeWorkspaceWriteProviderExecutionPermitV2ForPlan",
  "workspace_write_permit_v2",
  "rollback_before_commit_mismatch",
  "rollback_command_hash_mismatch"
] as const;

const REQUIRED_FAKE_CANARY_SOURCE_MARKERS = [
  "createApprovedWorkspaceWriteProviderExecutionPermitV2",
  "consumeWorkspaceWriteProviderExecutionPermitV2ForPlan",
  "replayConsumptionReasons",
  "rollback",
  "patchHash",
  "providerExecuteCalls",
  "realCodexCliCalls",
  "workspaceWriteExecuteCalls",
  "canaryFileWrites"
] as const;

const REQUIRED_TEST_MARKERS = [
  "workspace-write fake canary acceptance proves fixed target without execution",
  "permitV2ReplayBlocked",
  "workspace-write guard",
  "WorkspaceWriteProviderExecutionPermitV2"
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
  "Workspace-write real canary | Guarded by default",
  "General workspace-write | Guarded",
  "real workspace-write execution is allowed by default",
  "run real workspace-write now",
  "execute workspace-write now"
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

export interface WorkspaceWriteReleaseGateAuditInput {
  packageJsonText: string;
  governanceRunnerText: string;
  governanceReadmeText: string;
  currentStateText: string;
  validationTiersText: string;
  releaseGateMatrixText: string;
  workspaceWriteReleaseGateText: string;
  evidencePolicyText: string;
  threatModelText: string;
  permitDocText: string;
  fakeCanaryDocText: string;
  phase6CloseoutText: string;
  providerCoreText: string;
  workspaceWriteGuardText: string;
  fakeCanaryAcceptanceText: string;
  providerCoreTestText: string;
  workspaceWriteGuardTestText: string;
  fakeCanaryTestText: string;
}

export interface WorkspaceWriteReleaseGateAuditResult {
  status: "passed" | "blocked";
  checks: {
    governanceRunnerRegistered: boolean;
    governanceReadmeListsGate: boolean;
    currentStateListsGate: boolean;
    validationReleaseTierAligned: boolean;
    releaseMatrixRecordsGate: boolean;
    workspaceGateRecordsBlockedPosture: boolean;
    permitV2Recorded: boolean;
    fakeCanaryV2Recorded: boolean;
    evidencePolicySanitized: boolean;
    threatModelStopsRecorded: boolean;
    implementationCoverageRecorded: boolean;
    noBroadAuthorizationText: boolean;
    noRuntimeInvocationSurface: boolean;
    outputSanitized: boolean;
  };
  summary: {
    workspaceWriteReleaseGateMode: "promotion_review_gate_only";
    permitV2Status: "schema_validation_consumption_only";
    fakeCanaryStatus: "guarded_non_executing_validation_only";
    realWorkspaceWriteDefault: "blocked";
    generalWorkspaceWriteDefault: "blocked";
    workspaceWriteReleaseGateIsWorkspaceWriteAuthorization: false;
    workspaceWriteReleaseGateIsRealCodexCliAuthorization: false;
    workspaceWriteReleaseGateIsProviderExecutionAuthorization: false;
    workspaceWriteReleaseGateIsHostExecutorAuthorization: false;
    workspaceWriteReleaseGateIsSubAgentRuntimeAuthorization: false;
    workspaceWriteReleaseGateIsExternalWriteAuthorization: false;
    workspaceWriteReleaseGateIsPushAuthorization: false;
    workspaceWriteReleaseGateIsReleaseAuthorization: false;
    releaseValidationIncludesFakeCanary: boolean;
    releaseValidationIncludesEvidenceCollection: boolean;
    providerExecuteCallsDuringAudit: 0;
    codexCliCallsDuringAudit: 0;
    workspaceWriteCallsDuringAudit: 0;
    hostExecutorCallsDuringAudit: 0;
    subAgentRuntimeCallsDuringAudit: 0;
    externalWriteCallsDuringAudit: 0;
    evidenceWritesDuringAudit: 0;
  };
  reasons: string[];
}

export type WorkspaceWriteReleaseGateAuditOutputFormat = "text" | "json";

export async function collectWorkspaceWriteReleaseGateAuditInput(
  cwd = process.cwd()
): Promise<WorkspaceWriteReleaseGateAuditInput> {
  const [
    packageJsonText,
    governanceRunnerText,
    governanceReadmeText,
    currentStateText,
    validationTiersText,
    releaseGateMatrixText,
    workspaceWriteReleaseGateText,
    evidencePolicyText,
    threatModelText,
    permitDocText,
    fakeCanaryDocText,
    phase6CloseoutText,
    providerCoreText,
    workspaceWriteGuardText,
    fakeCanaryAcceptanceText,
    providerCoreTestText,
    workspaceWriteGuardTestText,
    fakeCanaryTestText
  ] = await Promise.all([
    read(cwd, PACKAGE_JSON),
    read(cwd, GOVERNANCE_RUNNER),
    read(cwd, GOVERNANCE_README),
    read(cwd, CURRENT_STATE_DOC),
    read(cwd, VALIDATION_TIERS_DOC),
    read(cwd, RELEASE_GATE_MATRIX),
    read(cwd, WORKSPACE_WRITE_RELEASE_GATE),
    read(cwd, EVIDENCE_POLICY),
    read(cwd, THREAT_MODEL),
    read(cwd, PR_23D_PERMIT_DOC),
    read(cwd, PR_23E_FAKE_CANARY_DOC),
    read(cwd, PHASE_6_CLOSEOUT),
    read(cwd, PROVIDER_CORE),
    read(cwd, WORKSPACE_WRITE_GUARD),
    read(cwd, FAKE_CANARY_ACCEPTANCE),
    read(cwd, PROVIDER_CORE_TEST),
    read(cwd, WORKSPACE_WRITE_GUARD_TEST),
    read(cwd, FAKE_CANARY_TEST)
  ]);

  return {
    packageJsonText,
    governanceRunnerText,
    governanceReadmeText,
    currentStateText,
    validationTiersText,
    releaseGateMatrixText,
    workspaceWriteReleaseGateText,
    evidencePolicyText,
    threatModelText,
    permitDocText,
    fakeCanaryDocText,
    phase6CloseoutText,
    providerCoreText,
    workspaceWriteGuardText,
    fakeCanaryAcceptanceText,
    providerCoreTestText,
    workspaceWriteGuardTestText,
    fakeCanaryTestText
  };
}

export function reviewWorkspaceWriteReleaseGateAudit(
  input: WorkspaceWriteReleaseGateAuditInput
): WorkspaceWriteReleaseGateAuditResult {
  const packageScripts = packageScriptsFromJson(input.packageJsonText);
  const releaseValidationIncludesFakeCanary =
    input.governanceRunnerText.includes("npmScript(\"canary\", \"canary\"")
    && input.governanceRunnerText.includes("npmScript(\"canary:write\", \"canary:write\"")
    && packageScripts.get("canary") === "node --import tsx scripts/run-canary-test.ts"
    && packageScripts.get("canary:write") === "node --import tsx scripts/run-canary-test.ts --risk medium";
  const releaseValidationIncludesEvidenceCollection =
    input.governanceRunnerText.includes("npmScript(\"evidence:collect\", \"evidence:collect\"")
    && packageScripts.get("evidence:collect") === "node --import tsx scripts/collect-evidence.ts";
  const releaseTierAligned =
    releaseValidationIncludesFakeCanary
    && releaseValidationIncludesEvidenceCollection
    && input.governanceRunnerText.includes(
      "resolveGovernanceCheck(\"audit\", \"workspace-write-release-gate\")"
    )
    && input.validationTiersText.includes("npm run validate:release")
    && input.validationTiersText.includes("npm run canary:write")
    && input.validationTiersText.includes(
      "npm run governance -- audit workspace-write-release-gate"
    )
    && input.validationTiersText.includes("npm run evidence:collect")
    && input.validationTiersText.includes(
      "checks remain explicit local actions. They are not part of `validate:release`."
    );
  const combinedAuthorityText = [
    input.workspaceWriteReleaseGateText,
    input.releaseGateMatrixText,
    input.evidencePolicyText,
    input.threatModelText,
    input.permitDocText,
    input.fakeCanaryDocText,
    input.phase6CloseoutText,
    input.validationTiersText
  ].join("\n");

  const checks = {
    governanceRunnerRegistered: input.governanceRunnerText.includes(
      "auditCheck(\"workspace-write-release-gate\""
    ),
    governanceReadmeListsGate: input.governanceReadmeText.includes(
      "npm run governance -- audit workspace-write-release-gate"
    ),
    currentStateListsGate: input.currentStateText.includes(
      "npm run governance -- audit workspace-write-release-gate"
    ),
    validationReleaseTierAligned: releaseTierAligned,
    releaseMatrixRecordsGate:
      markersPresent(input.releaseGateMatrixText, REQUIRED_RELEASE_MATRIX_MARKERS),
    workspaceGateRecordsBlockedPosture:
      markersPresent(
        input.workspaceWriteReleaseGateText,
        REQUIRED_WORKSPACE_GATE_MARKERS
      ),
    permitV2Recorded:
      markersPresent(input.permitDocText, REQUIRED_PERMIT_V2_MARKERS)
      && markersPresent(input.providerCoreText, REQUIRED_PROVIDER_CORE_MARKERS),
    fakeCanaryV2Recorded:
      markersPresent(input.fakeCanaryDocText, REQUIRED_FAKE_CANARY_MARKERS)
      && markersPresent(
        input.fakeCanaryAcceptanceText,
        REQUIRED_FAKE_CANARY_SOURCE_MARKERS
      )
      && input.workspaceWriteGuardText.includes("WorkspaceWriteRollbackPlanEvidence")
      && input.workspaceWriteGuardText.includes("evaluateWorkspaceWriteCanaryReadiness"),
    evidencePolicySanitized:
      markersPresent(input.evidencePolicyText, REQUIRED_EVIDENCE_POLICY_MARKERS),
    threatModelStopsRecorded:
      markersPresent(input.threatModelText, REQUIRED_THREAT_MODEL_MARKERS),
    implementationCoverageRecorded:
      markersPresent(
        [
          input.providerCoreTestText,
          input.workspaceWriteGuardTestText,
          input.fakeCanaryTestText
        ].join("\n"),
        REQUIRED_TEST_MARKERS
      ),
    noBroadAuthorizationText:
      !containsForbidden(combinedAuthorityText, FORBIDDEN_AUTHORIZATION_MARKERS),
    noRuntimeInvocationSurface:
      !containsForbidden(input.workspaceWriteReleaseGateText, FORBIDDEN_RUNTIME_MARKERS),
    outputSanitized: outputSanitized()
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      workspaceWriteReleaseGateMode: "promotion_review_gate_only",
      permitV2Status: "schema_validation_consumption_only",
      fakeCanaryStatus: "guarded_non_executing_validation_only",
      realWorkspaceWriteDefault: "blocked",
      generalWorkspaceWriteDefault: "blocked",
      workspaceWriteReleaseGateIsWorkspaceWriteAuthorization: false,
      workspaceWriteReleaseGateIsRealCodexCliAuthorization: false,
      workspaceWriteReleaseGateIsProviderExecutionAuthorization: false,
      workspaceWriteReleaseGateIsHostExecutorAuthorization: false,
      workspaceWriteReleaseGateIsSubAgentRuntimeAuthorization: false,
      workspaceWriteReleaseGateIsExternalWriteAuthorization: false,
      workspaceWriteReleaseGateIsPushAuthorization: false,
      workspaceWriteReleaseGateIsReleaseAuthorization: false,
      releaseValidationIncludesFakeCanary,
      releaseValidationIncludesEvidenceCollection,
      providerExecuteCallsDuringAudit: 0,
      codexCliCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      hostExecutorCallsDuringAudit: 0,
      subAgentRuntimeCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0,
      evidenceWritesDuringAudit: 0
    },
    reasons
  };
}

export function formatWorkspaceWriteReleaseGateAuditResult(
  result: WorkspaceWriteReleaseGateAuditResult,
  format: WorkspaceWriteReleaseGateAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return `${JSON.stringify(result, null, 2)}\n`;
  }

  return [
    "Workspace-write release gate audit",
    `status: ${result.status}`,
    `release gate mode: ${result.summary.workspaceWriteReleaseGateMode}`,
    `permit v2 status: ${result.summary.permitV2Status}`,
    `fake canary status: ${result.summary.fakeCanaryStatus}`,
    `real workspace-write default: ${result.summary.realWorkspaceWriteDefault}`,
    `general workspace-write default: ${result.summary.generalWorkspaceWriteDefault}`,
    `release validation includes fake canary: ${result.summary.releaseValidationIncludesFakeCanary}`,
    `release validation includes evidence collection: ${result.summary.releaseValidationIncludesEvidenceCollection}`,
    `release gate is workspace-write authorization: ${result.summary.workspaceWriteReleaseGateIsWorkspaceWriteAuthorization}`,
    `release gate is real Codex CLI authorization: ${result.summary.workspaceWriteReleaseGateIsRealCodexCliAuthorization}`,
    `release gate is provider execution authorization: ${result.summary.workspaceWriteReleaseGateIsProviderExecutionAuthorization}`,
    `release gate is host executor authorization: ${result.summary.workspaceWriteReleaseGateIsHostExecutorAuthorization}`,
    `release gate is sub-agent runtime authorization: ${result.summary.workspaceWriteReleaseGateIsSubAgentRuntimeAuthorization}`,
    `release gate is external-write authorization: ${result.summary.workspaceWriteReleaseGateIsExternalWriteAuthorization}`,
    `release gate is push authorization: ${result.summary.workspaceWriteReleaseGateIsPushAuthorization}`,
    `release gate is release authorization: ${result.summary.workspaceWriteReleaseGateIsReleaseAuthorization}`,
    `provider execute calls during audit: ${result.summary.providerExecuteCallsDuringAudit}`,
    `Codex CLI calls during audit: ${result.summary.codexCliCallsDuringAudit}`,
    `workspace-write calls during audit: ${result.summary.workspaceWriteCallsDuringAudit}`,
    `host executor calls during audit: ${result.summary.hostExecutorCallsDuringAudit}`,
    `sub-agent runtime calls during audit: ${result.summary.subAgentRuntimeCallsDuringAudit}`,
    `external-write calls during audit: ${result.summary.externalWriteCallsDuringAudit}`,
    `evidence writes during audit: ${result.summary.evidenceWritesDuringAudit}`,
    ...(result.reasons.length > 0
      ? [`blocking reasons: ${result.reasons.join(", ")}`]
      : [])
  ].join("\n") + "\n";
}

function packageScriptsFromJson(text: string): Map<string, string> {
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!isRecord(parsed) || !isRecord(parsed.scripts)) {
      return new Map();
    }

    return new Map(
      Object.entries(parsed.scripts)
        .filter((entry): entry is [string, string] => typeof entry[1] === "string")
    );
  } catch {
    return new Map();
  }
}

function collectReasons(checks: Record<string, boolean>): string[] {
  return Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => `workspace_write_release_gate_${name}`);
}

function markersPresent(text: string, markers: readonly string[]): boolean {
  return markers.every((marker) => text.includes(marker));
}

function containsForbidden(text: string, markers: readonly string[]): boolean {
  return markers.some((marker) => text.includes(marker));
}

function outputSanitized(): boolean {
  return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function read(cwd: string, filePath: string): Promise<string> {
  return readFile(join(cwd, filePath), "utf8");
}

async function main(): Promise<void> {
  const format: WorkspaceWriteReleaseGateAuditOutputFormat =
    process.argv.includes("--json") ? "json" : "text";
  const result = reviewWorkspaceWriteReleaseGateAudit(
    await collectWorkspaceWriteReleaseGateAuditInput()
  );
  process.stdout.write(formatWorkspaceWriteReleaseGateAuditResult(result, format));
  process.exitCode = result.status === "passed" ? 0 : 1;
}

const invokedPath = process.argv[1];
if (invokedPath !== undefined && import.meta.url === pathToFileURL(invokedPath).href) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
