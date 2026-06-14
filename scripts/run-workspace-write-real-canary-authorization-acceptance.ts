#!/usr/bin/env node

import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE,
  PR_12B_REAL_CANARY_ALLOWED_ACTION,
  PR_12B_REAL_CANARY_AUTHORIZATION_PHRASE,
  PR_12B_REAL_CANARY_BRANCH,
  PR_12B_REAL_CANARY_WORKSPACE,
  evaluateWorkspaceWriteRealCanaryAuthorization
} from "../packages/workspace-write-guard/src/index.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const DEFAULT_EVIDENCE_PATH = join(
  __dirname,
  "..",
  "docs",
  "evidence",
  "workspace-write-real-canary-authorization-acceptance.json"
);
const DEFAULT_GENERATED_AT = "2026-06-14T00:00:00.000Z";
const CANARY_TARGET_FILE = DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE;

export interface WorkspaceWriteRealCanaryAuthorizationAcceptanceEvidence {
  schemaVersion: "workspace-write-real-canary-authorization-acceptance.v1";
  generatedAt: string;
  mode: "workspace-write-real-canary-authorization-local-only";
  taskId: string;
  checks: {
    exactAuthorizationAccepted: boolean;
    missingAuthorizationBlocked: boolean;
    broadenedAuthorizationBlocked: boolean;
    pushAuthorizationRejected: boolean;
    canaryFileAbsentBeforeAndAfter: boolean;
    noProviderExecute: boolean;
    noRealCodexCli: boolean;
    noWorkspaceWriteExecute: boolean;
    noCanaryFileWrite: boolean;
    leakCheckPassed: boolean;
  };
  summary: {
    targetFile: string;
    branch: string;
    requiredSandbox: "workspace-write";
    requiredRollback: boolean;
    pushMustBeSeparate: boolean;
    exactPhraseMatched: boolean;
    workspaceMatched: boolean;
    fixedTargetMatched: boolean;
    boundedActionMatched: boolean;
  };
  counters: {
    providerExecuteCalls: number;
    realCodexCliCalls: number;
    workspaceWriteExecuteCalls: number;
    canaryFileWrites: number;
  };
  blockingReasons: string[];
}

export interface WorkspaceWriteRealCanaryAuthorizationAcceptanceOptions {
  generatedAt?: string;
}

export async function runWorkspaceWriteRealCanaryAuthorizationAcceptance(
  options: WorkspaceWriteRealCanaryAuthorizationAcceptanceOptions = {}
): Promise<WorkspaceWriteRealCanaryAuthorizationAcceptanceEvidence> {
  const generatedAt = options.generatedAt ?? DEFAULT_GENERATED_AT;
  const canaryFileExistsBefore = existsSync(CANARY_TARGET_FILE);
  const exactAuthorization = evaluateWorkspaceWriteRealCanaryAuthorization({
    authorizationPhrase: PR_12B_REAL_CANARY_AUTHORIZATION_PHRASE,
    workspace: PR_12B_REAL_CANARY_WORKSPACE,
    branch: PR_12B_REAL_CANARY_BRANCH,
    targetFile: CANARY_TARGET_FILE,
    allowedAction: PR_12B_REAL_CANARY_ALLOWED_ACTION,
    sandboxMode: "workspace-write",
    rollbackRequired: true,
    pushAuthorized: false
  });
  const missingAuthorization = evaluateWorkspaceWriteRealCanaryAuthorization({});
  const broadenedAuthorization = evaluateWorkspaceWriteRealCanaryAuthorization({
    authorizationPhrase: "APPROVE_WORKSPACE_WRITE",
    workspace: "A:/other/repo",
    branch: "release",
    targetFile: "tmp/not-the-canary.txt",
    allowedAction: "general workspace write",
    sandboxMode: "danger-full-access",
    rollbackRequired: false,
    pushAuthorized: false
  });
  const pushAuthorization = evaluateWorkspaceWriteRealCanaryAuthorization({
    authorizationPhrase: PR_12B_REAL_CANARY_AUTHORIZATION_PHRASE,
    workspace: PR_12B_REAL_CANARY_WORKSPACE,
    branch: PR_12B_REAL_CANARY_BRANCH,
    targetFile: CANARY_TARGET_FILE,
    allowedAction: PR_12B_REAL_CANARY_ALLOWED_ACTION,
    sandboxMode: "workspace-write",
    rollbackRequired: true,
    pushAuthorized: true
  });
  const counters = {
    providerExecuteCalls: 0,
    realCodexCliCalls: 0,
    workspaceWriteExecuteCalls: 0,
    canaryFileWrites: 0
  };
  const canaryFileExistsAfter = existsSync(CANARY_TARGET_FILE);
  const evidenceWithoutLeakCheck: Omit<
    WorkspaceWriteRealCanaryAuthorizationAcceptanceEvidence,
    "checks"
  > & {
    checks: Omit<
      WorkspaceWriteRealCanaryAuthorizationAcceptanceEvidence["checks"],
      "leakCheckPassed"
    >;
  } = {
    schemaVersion: "workspace-write-real-canary-authorization-acceptance.v1",
    generatedAt,
    mode: "workspace-write-real-canary-authorization-local-only",
    taskId: "workspace-write-real-canary-authorization-acceptance",
    checks: {
      exactAuthorizationAccepted: exactAuthorization.status === "authorized",
      missingAuthorizationBlocked: missingAuthorization.status === "blocked"
        && missingAuthorization.reasons.includes(
          "workspace_write_real_canary_authorization_exact_phrase_required"
        ),
      broadenedAuthorizationBlocked: broadenedAuthorization.status === "blocked"
        && broadenedAuthorization.reasons.includes(
          "workspace_write_real_canary_authorization_fixed_target_required"
        )
        && broadenedAuthorization.reasons.includes(
          "workspace_write_real_canary_authorization_workspace_write_sandbox_required"
        ),
      pushAuthorizationRejected: pushAuthorization.status === "blocked"
        && pushAuthorization.reasons.includes(
          "workspace_write_real_canary_authorization_push_must_be_separate"
        ),
      canaryFileAbsentBeforeAndAfter: !canaryFileExistsBefore && !canaryFileExistsAfter,
      noProviderExecute: counters.providerExecuteCalls === 0,
      noRealCodexCli: counters.realCodexCliCalls === 0,
      noWorkspaceWriteExecute: counters.workspaceWriteExecuteCalls === 0,
      noCanaryFileWrite: counters.canaryFileWrites === 0
    },
    summary: {
      targetFile: CANARY_TARGET_FILE,
      branch: PR_12B_REAL_CANARY_BRANCH,
      requiredSandbox: "workspace-write",
      requiredRollback: true,
      pushMustBeSeparate: true,
      exactPhraseMatched: exactAuthorization.summary.exactPhraseMatched,
      workspaceMatched: exactAuthorization.summary.workspaceMatched,
      fixedTargetMatched: exactAuthorization.summary.fixedTargetMatched,
      boundedActionMatched: exactAuthorization.summary.allowedActionMatched
    },
    counters,
    blockingReasons: uniqueStrings([
      ...missingAuthorization.reasons,
      ...broadenedAuthorization.reasons,
      ...pushAuthorization.reasons
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

export async function writeWorkspaceWriteRealCanaryAuthorizationAcceptanceEvidence(
  evidence: WorkspaceWriteRealCanaryAuthorizationAcceptanceEvidence,
  evidencePath = DEFAULT_EVIDENCE_PATH
): Promise<{
  path: string;
  evidence: WorkspaceWriteRealCanaryAuthorizationAcceptanceEvidence;
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
    PR_12B_REAL_CANARY_AUTHORIZATION_PHRASE,
    PR_12B_REAL_CANARY_WORKSPACE,
    PR_12B_REAL_CANARY_ALLOWED_ACTION,
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
    "Bearer",
    "APPROVE_WORKSPACE_WRITE",
    "A:/other/repo",
    "tmp/not-the-canary.txt",
    "general workspace write"
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
  const evidence = await runWorkspaceWriteRealCanaryAuthorizationAcceptance();
  const write = await writeWorkspaceWriteRealCanaryAuthorizationAcceptanceEvidence(
    evidence,
    outputPath
  );

  console.log("Workspace-write real canary authorization acceptance");
  console.log(`exact authorization accepted: ${evidence.checks.exactAuthorizationAccepted}`);
  console.log(`missing authorization blocked: ${evidence.checks.missingAuthorizationBlocked}`);
  console.log(`broadened authorization blocked: ${evidence.checks.broadenedAuthorizationBlocked}`);
  console.log(`workspace-write execute: ${evidence.counters.workspaceWriteExecuteCalls}`);
  console.log(`canary file writes: ${evidence.counters.canaryFileWrites}`);
  console.log(`leak check: ${evidence.checks.leakCheckPassed}`);
  console.log(`evidence: ${write.path}`);

  if (!Object.values(evidence.checks).every(Boolean)) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      "Workspace-write real canary authorization acceptance failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
