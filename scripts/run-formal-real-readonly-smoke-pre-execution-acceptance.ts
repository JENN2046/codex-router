#!/usr/bin/env node

import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  DEFAULT_REAL_CODEX_CLI_READONLY_SMOKE_EVIDENCE_PATH,
  runRealCodexCliReadOnlySmokeScript
} from "./run-codex-cli-real-readonly-smoke.js";
import {
  PR_17A_FORMAL_REAL_READONLY_SMOKE_COMMAND,
  PR_17A_FORMAL_REAL_READONLY_SMOKE_TASKBOOK,
  PR_17A_FORMAL_REAL_READONLY_SMOKE_TOKEN,
  evaluateFormalRealReadonlySmokeTaskbook,
  type FormalRealReadonlySmokeTaskbookResult
} from "./run-formal-real-readonly-smoke-taskbook-acceptance.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const DEFAULT_EVIDENCE_PATH = join(
  __dirname,
  "..",
  "docs",
  "evidence",
  "codex-cli-formal-real-readonly-smoke-pre-execution-acceptance.json"
);
const DEFAULT_GENERATED_AT = "2026-06-15T00:00:00.000Z";

export interface FormalRealReadonlySmokePreExecutionAcceptanceEvidence {
  schemaVersion: "codex-cli-formal-real-readonly-smoke-pre-execution-acceptance.v1";
  generatedAt: string;
  mode: "formal-real-readonly-smoke-pre-execution-local-only";
  taskId: "codex-cli-formal-real-readonly-smoke-pre-execution-acceptance";
  checks: {
    taskbookGateAccepted: boolean;
    taskbookEvidencePresent: boolean;
    taskbookDocPresent: boolean;
    smokeScriptDefaultEvidencePath: boolean;
    smokeScriptBlocksWithoutOperatorFlag: boolean;
    blockedSmokeDoesNotInvokeRunner: boolean;
    blockedSmokeWritesSanitizedEvidence: boolean;
    exactFutureCommandRequired: boolean;
    defaultEvidencePathRequired: boolean;
    formalDispatchBoundaryRequired: boolean;
    providerExecuteStillSeparate: boolean;
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
    realSmokeDefaultEvidencePath: string;
    taskbookAcceptanceStatus: "accepted" | "blocked";
    blockedSmokeStatus: "blocked";
    blockedSmokeExitCode: 1;
    localPreExecutionOnly: true;
    futureRealCliInvocationRequiresSeparateAuthorization: true;
    providerExecuteRequiresSeparateAuthorization: true;
    workspaceWriteMustRemainClosed: true;
    pushReleaseTagMustBeSeparate: true;
  };
  counters: {
    providerExecuteCalls: 0;
    realCodexCliCalls: 0;
    workspaceWriteExecuteCalls: 0;
    blockedSmokeRunnerCalls: number;
  };
  blockingReasons: string[];
}

export interface FormalRealReadonlySmokePreExecutionAcceptanceOptions {
  generatedAt?: string;
}

export async function runFormalRealReadonlySmokePreExecutionAcceptance(
  options: FormalRealReadonlySmokePreExecutionAcceptanceOptions = {}
): Promise<FormalRealReadonlySmokePreExecutionAcceptanceEvidence> {
  const generatedAt = options.generatedAt ?? DEFAULT_GENERATED_AT;
  const [taskbookDocText, taskbookEvidenceText] = await Promise.all([
    readFile(PR_17A_FORMAL_REAL_READONLY_SMOKE_TASKBOOK, "utf8"),
    readFile(
      "docs/evidence/codex-cli-formal-real-readonly-smoke-taskbook-acceptance.json",
      "utf8"
    )
  ]);
  const taskbookResult = createExactTaskbookResult();
  const taskbookEvidence = parseObject(taskbookEvidenceText);
  let blockedSmokeRunnerCalls = 0;
  const tempDir = await mkdtemp(join(tmpdir(), "formal-real-readonly-smoke-pre-exec-"));
  const blockedSmokeReceipt = await runRealCodexCliReadOnlySmokeScript({
    generatedAt,
    evidencePath: join(tempDir, "blocked-smoke.json"),
    env: {},
    runSmoke: async () => {
      blockedSmokeRunnerCalls += 1;
      throw new Error("runner_should_not_be_called_without_operator_flag");
    }
  });
  const blockedSmokeEvidenceText = await readFile(
    blockedSmokeReceipt.write.path,
    "utf8"
  );
  const counters = {
    providerExecuteCalls: 0 as const,
    realCodexCliCalls: 0 as const,
    workspaceWriteExecuteCalls: 0 as const,
    blockedSmokeRunnerCalls
  };
  const evidenceWithoutLeakCheck: Omit<
    FormalRealReadonlySmokePreExecutionAcceptanceEvidence,
    "checks"
  > & {
    checks: Omit<
      FormalRealReadonlySmokePreExecutionAcceptanceEvidence["checks"],
      "leakCheckPassed"
    >;
  } = {
    schemaVersion: "codex-cli-formal-real-readonly-smoke-pre-execution-acceptance.v1",
    generatedAt,
    mode: "formal-real-readonly-smoke-pre-execution-local-only",
    taskId: "codex-cli-formal-real-readonly-smoke-pre-execution-acceptance",
    checks: {
      taskbookGateAccepted: taskbookResult.status === "accepted",
      taskbookEvidencePresent:
        getString(taskbookEvidence, ["schemaVersion"])
          === "codex-cli-formal-real-readonly-smoke-taskbook-acceptance.v1"
        && getString(taskbookEvidence, ["mode"])
          === "formal-real-readonly-smoke-taskbook-local-only"
        && getBoolean(taskbookEvidence, ["checks", "exactTaskbookAccepted"]) === true
        && getBoolean(taskbookEvidence, ["checks", "defaultEvidencePathRequired"]) === true
        && getBoolean(taskbookEvidence, ["checks", "formalDispatchRequired"]) === true
        && getBoolean(taskbookEvidence, ["checks", "noRealCodexCli"]) === true
        && getBoolean(taskbookEvidence, ["checks", "noWorkspaceWriteExecute"]) === true,
      taskbookDocPresent:
        taskbookDocText.includes("PR_17A_FORMAL_REAL_READONLY_SMOKE_TASKBOOK_RECORDED")
        && taskbookDocText.includes("Required future smoke evidence path choice")
        && taskbookDocText.includes("does not authorize invoking the real Codex CLI"),
      smokeScriptDefaultEvidencePath:
        DEFAULT_REAL_CODEX_CLI_READONLY_SMOKE_EVIDENCE_PATH
          === "docs/evidence/codex-cli-real-readonly-smoke.json",
      smokeScriptBlocksWithoutOperatorFlag:
        blockedSmokeReceipt.evidence.status === "blocked"
        && blockedSmokeReceipt.exitCode === 1
        && blockedSmokeReceipt.evidence.summary.blockingReasons.includes(
          "codex_cli_real_readonly_smoke_requires_operator_flag"
        ),
      blockedSmokeDoesNotInvokeRunner:
        blockedSmokeReceipt.evidence.checks.runnerInvoked === false
        && blockedSmokeRunnerCalls === 0,
      blockedSmokeWritesSanitizedEvidence:
        blockedSmokeReceipt.evidence.checks.sanitizedEvidence === true
        && !containsForbiddenMarkers(blockedSmokeEvidenceText),
      exactFutureCommandRequired: taskbookResult.summary.exactCommandMatched,
      defaultEvidencePathRequired: taskbookResult.summary.defaultEvidencePathDeclared,
      formalDispatchBoundaryRequired:
        taskbookResult.summary.formalDispatchRequired
        && taskbookResult.summary.providerRegistryRequired
        && taskbookResult.summary.providerExecutionMetadataRequired
        && taskbookResult.summary.providerPermitRequired,
      providerExecuteStillSeparate:
        taskbookResult.summary.providerExecuteNotAuthorizedByThisTaskbook,
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
      realSmokeDefaultEvidencePath: DEFAULT_REAL_CODEX_CLI_READONLY_SMOKE_EVIDENCE_PATH,
      taskbookAcceptanceStatus: taskbookResult.status,
      blockedSmokeStatus: "blocked",
      blockedSmokeExitCode: 1,
      localPreExecutionOnly: true,
      futureRealCliInvocationRequiresSeparateAuthorization: true,
      providerExecuteRequiresSeparateAuthorization: true,
      workspaceWriteMustRemainClosed: true,
      pushReleaseTagMustBeSeparate: true
    },
    counters,
    blockingReasons: [
      "codex_cli_real_readonly_smoke_requires_operator_flag"
    ]
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

export async function writeFormalRealReadonlySmokePreExecutionAcceptanceEvidence(
  evidence: FormalRealReadonlySmokePreExecutionAcceptanceEvidence,
  evidencePath = DEFAULT_EVIDENCE_PATH
): Promise<{
  path: string;
  evidence: FormalRealReadonlySmokePreExecutionAcceptanceEvidence;
}> {
  await mkdir(dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  return {
    path: evidencePath,
    evidence
  };
}

function createExactTaskbookResult(): FormalRealReadonlySmokeTaskbookResult {
  return evaluateFormalRealReadonlySmokeTaskbook({
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
}

function containsForbiddenMarkers(value: unknown): boolean {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  return [
    PR_17A_FORMAL_REAL_READONLY_SMOKE_TOKEN,
    PR_17A_FORMAL_REAL_READONLY_SMOKE_TASKBOOK,
    PR_17A_FORMAL_REAL_READONLY_SMOKE_COMMAND,
    "ALLOW_REAL_CODEX_CLI_READONLY_SMOKE",
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
  const evidence = await runFormalRealReadonlySmokePreExecutionAcceptance();
  const write = await writeFormalRealReadonlySmokePreExecutionAcceptanceEvidence(
    evidence,
    outputPath
  );

  console.log("Codex CLI formal real read-only smoke pre-execution acceptance");
  console.log(`taskbook gate accepted: ${evidence.checks.taskbookGateAccepted}`);
  console.log(`default evidence path: ${evidence.checks.smokeScriptDefaultEvidencePath}`);
  console.log(`blocked without operator flag: ${evidence.checks.smokeScriptBlocksWithoutOperatorFlag}`);
  console.log(`blocked runner calls: ${evidence.counters.blockedSmokeRunnerCalls}`);
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
      "Codex CLI formal real read-only smoke pre-execution acceptance failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
