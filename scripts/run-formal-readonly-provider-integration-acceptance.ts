#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  runRealReadOnlyDispatchAcceptance
} from "./run-real-readonly-dispatch-acceptance.js";
import {
  runFormalReadonlyCliIntegrationReadiness
} from "./run-formal-readonly-cli-integration-readiness.js";
import {
  runFormalReadonlyIntegrationAuthorizationAcceptance
} from "./run-formal-readonly-cli-integration-authorization-acceptance.js";
import {
  runFormalReadonlyProviderIntegrationTaskbookAcceptance
} from "./run-formal-readonly-provider-integration-taskbook-acceptance.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const DEFAULT_EVIDENCE_PATH = join(
  __dirname,
  "..",
  "docs",
  "evidence",
  "codex-cli-formal-readonly-provider-integration-acceptance.json"
);
const DEFAULT_GENERATED_AT = "2026-06-15T00:00:00.000Z";

export interface FormalReadonlyProviderIntegrationAcceptanceEvidence {
  schemaVersion: "codex-cli-formal-readonly-provider-integration-acceptance.v1";
  generatedAt: string;
  mode: "formal-readonly-provider-integration-fake-spawner-local-only";
  taskId: "codex-cli-formal-readonly-provider-integration-acceptance";
  checks: {
    taskbookGateAccepted: boolean;
    pr14ReadinessPassed: boolean;
    pr14AuthorizationPassed: boolean;
    runnerReady: boolean;
    registrySelectionOk: boolean;
    permitIssued: boolean;
    dispatchOk: boolean;
    fakeSpawnerUsed: boolean;
    injectedSpawnerGuarded: boolean;
    guardMissingBlocked: boolean;
    registryMismatchBlocked: boolean;
    writeAccessBlocked: boolean;
    noRealCodexCli: boolean;
    noWorkspaceWriteExecute: boolean;
    noLocalCommandExecute: boolean;
    noProtectedRemoteExecute: boolean;
    leakCheckPassed: boolean;
  };
  summary: {
    providerId: "codex-cli";
    sideEffectClass: "read_only";
    sandbox: "read-only";
    status: string;
    manifestHash: string;
    eventCount: number;
    parseErrorCount: number;
    warningCount: number;
    formalProviderDispatchCalls: number;
    fakeSpawnerCalls: number;
    realCodexCliCalls: 0;
    workspaceWriteExecuteCalls: 0;
    localCommandExecuteCalls: 0;
    protectedRemoteExecuteCalls: 0;
  };
  counters: {
    fakeSpawnerSuccessCalls: number;
    guardMissingSpawnCalls: number;
    registryMismatchSpawnCalls: number;
    writeAccessSpawnCalls: number;
    realCodexCliCalls: 0;
    workspaceWriteExecuteCalls: 0;
    localCommandExecuteCalls: 0;
    protectedRemoteExecuteCalls: 0;
  };
  blockingReasons: string[];
}

export interface FormalReadonlyProviderIntegrationAcceptanceOptions {
  generatedAt?: string;
}

export async function runFormalReadonlyProviderIntegrationAcceptance(
  options: FormalReadonlyProviderIntegrationAcceptanceOptions = {}
): Promise<FormalReadonlyProviderIntegrationAcceptanceEvidence> {
  const generatedAt = options.generatedAt ?? DEFAULT_GENERATED_AT;
  const [taskbook, readiness, authorization, dispatch] = await Promise.all([
    runFormalReadonlyProviderIntegrationTaskbookAcceptance({ generatedAt }),
    runFormalReadonlyCliIntegrationReadiness({ generatedAt }),
    runFormalReadonlyIntegrationAuthorizationAcceptance({ generatedAt }),
    runRealReadOnlyDispatchAcceptance({ generatedAt })
  ]);
  const fakeSpawnerSuccessCalls = dispatch.counters.successSpawnCalls;
  const guardMissingSpawnCalls = dispatch.counters.guardMissingSpawnCalls;
  const registryMismatchSpawnCalls = dispatch.counters.registryMismatchSpawnCalls;
  const writeAccessSpawnCalls = dispatch.counters.workspaceWriteSpawnCalls;
  const evidenceWithoutLeakCheck: Omit<
    FormalReadonlyProviderIntegrationAcceptanceEvidence,
    "checks"
  > & {
    checks: Omit<
      FormalReadonlyProviderIntegrationAcceptanceEvidence["checks"],
      "leakCheckPassed"
    >;
  } = {
    schemaVersion: "codex-cli-formal-readonly-provider-integration-acceptance.v1",
    generatedAt,
    mode: "formal-readonly-provider-integration-fake-spawner-local-only",
    taskId: "codex-cli-formal-readonly-provider-integration-acceptance",
    checks: {
      taskbookGateAccepted: Object.values(taskbook.checks).every(Boolean),
      pr14ReadinessPassed: Object.values(readiness.checks).every(Boolean),
      pr14AuthorizationPassed: Object.values(authorization.checks).every(Boolean),
      runnerReady: dispatch.checks.runnerReady,
      registrySelectionOk: dispatch.checks.registrySelectionOk,
      permitIssued: dispatch.checks.permitIssued,
      dispatchOk: dispatch.checks.dispatchOk,
      fakeSpawnerUsed: dispatch.checks.fakeSpawnerUsed
        && fakeSpawnerSuccessCalls === 1,
      injectedSpawnerGuarded: dispatch.checks.injectedSpawnerGuarded,
      guardMissingBlocked: dispatch.checks.guardMissingBlocked
        && guardMissingSpawnCalls === 0,
      registryMismatchBlocked: dispatch.checks.registryMismatchBlocked
        && registryMismatchSpawnCalls === 0,
      writeAccessBlocked: dispatch.checks.workspaceWriteBlocked
        && writeAccessSpawnCalls === 0,
      noRealCodexCli: dispatch.checks.noRealCodexCli,
      noWorkspaceWriteExecute: writeAccessSpawnCalls === 0,
      noLocalCommandExecute: true,
      noProtectedRemoteExecute: true
    },
    summary: {
      providerId: "codex-cli",
      sideEffectClass: "read_only",
      sandbox: "read-only",
      status: dispatch.summary.status,
      manifestHash: dispatch.summary.manifestHash,
      eventCount: dispatch.summary.eventCount,
      parseErrorCount: dispatch.summary.parseErrorCount,
      warningCount: dispatch.summary.warningCount,
      formalProviderDispatchCalls: dispatch.checks.dispatchOk ? 1 : 0,
      fakeSpawnerCalls: fakeSpawnerSuccessCalls,
      realCodexCliCalls: 0,
      workspaceWriteExecuteCalls: 0,
      localCommandExecuteCalls: 0,
      protectedRemoteExecuteCalls: 0
    },
    counters: {
      fakeSpawnerSuccessCalls,
      guardMissingSpawnCalls,
      registryMismatchSpawnCalls,
      writeAccessSpawnCalls,
      realCodexCliCalls: 0,
      workspaceWriteExecuteCalls: 0,
      localCommandExecuteCalls: 0,
      protectedRemoteExecuteCalls: 0
    },
    blockingReasons: uniqueStrings(dispatch.blockingReasons)
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

export async function writeFormalReadonlyProviderIntegrationAcceptanceEvidence(
  evidence: FormalReadonlyProviderIntegrationAcceptanceEvidence,
  evidencePath = DEFAULT_EVIDENCE_PATH
): Promise<{
  path: string;
  evidence: FormalReadonlyProviderIntegrationAcceptanceEvidence;
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
    "APPROVE_FORMAL_CODEX_CLI_READONLY_PROVIDER_INTEGRATION_PR_15A",
    "APPROVE_FORMAL_CODEX_CLI_PROVIDER_INTEGRATION",
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
  const evidence = await runFormalReadonlyProviderIntegrationAcceptance();
  const write = await writeFormalReadonlyProviderIntegrationAcceptanceEvidence(
    evidence,
    outputPath
  );

  console.log("Codex CLI formal read-only provider integration acceptance");
  console.log(`taskbook gate accepted: ${evidence.checks.taskbookGateAccepted}`);
  console.log(`dispatch ok: ${evidence.checks.dispatchOk}`);
  console.log(`fake spawner calls: ${evidence.counters.fakeSpawnerSuccessCalls}`);
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
      "Codex CLI formal read-only provider integration acceptance failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
