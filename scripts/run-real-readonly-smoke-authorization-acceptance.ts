#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const PR_13A_REAL_READONLY_SMOKE_AUTHORIZATION_TOKEN =
  "APPROVE_REAL_CODEX_CLI_READONLY_SMOKE_PR_13A";
export const PR_13A_REAL_READONLY_SMOKE_COMMAND =
  "ALLOW_REAL_CODEX_CLI_READONLY_SMOKE=1 npm run smoke:readonly:real";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const DEFAULT_EVIDENCE_PATH = join(
  __dirname,
  "..",
  "docs",
  "evidence",
  "codex-cli-real-readonly-smoke-authorization-acceptance.json"
);
const DEFAULT_GENERATED_AT = "2026-06-14T00:00:00.000Z";

export interface RealReadonlySmokeAuthorizationInput {
  authorizationToken?: string;
  command?: string;
  sandboxMode?: string;
  approvalPolicy?: string;
  evidencePathChoice?: string;
  workspaceWriteAuthorized?: boolean;
  pushAuthorized?: boolean;
  releaseAuthorized?: boolean;
  tagAuthorized?: boolean;
}

export interface RealReadonlySmokeAuthorizationResult {
  ok: boolean;
  status: "authorized" | "blocked";
  reasons: string[];
  summary: {
    exactTokenMatched: boolean;
    exactCommandMatched: boolean;
    readOnlySandboxMatched: boolean;
    approvalPolicyNeverMatched: boolean;
    evidencePathChoiceDeclared: boolean;
    workspaceWriteDisallowed: boolean;
    pushDisallowed: boolean;
    releaseDisallowed: boolean;
    tagDisallowed: boolean;
    providerExecuteCalls: 0;
    realCodexCliCalls: 0;
    workspaceWriteExecuteCalls: 0;
  };
}

export interface RealReadonlySmokeAuthorizationAcceptanceEvidence {
  schemaVersion: "codex-cli-real-readonly-smoke-authorization-acceptance.v1";
  generatedAt: string;
  mode: "real-readonly-smoke-authorization-local-only";
  taskId: "codex-cli-real-readonly-smoke-authorization-acceptance";
  checks: {
    exactAuthorizationAccepted: boolean;
    missingAuthorizationBlocked: boolean;
    broadenedAuthorizationBlocked: boolean;
    pushReleaseTagRejected: boolean;
    noProviderExecute: boolean;
    noRealCodexCli: boolean;
    noWorkspaceWriteExecute: boolean;
    leakCheckPassed: boolean;
  };
  summary: {
    requiredSandbox: "read-only";
    requiredApprovalPolicy: "never";
    evidencePathChoiceRequired: boolean;
    workspaceWriteMustRemainClosed: boolean;
    pushReleaseTagMustBeSeparate: boolean;
    exactTokenMatched: boolean;
    exactCommandMatched: boolean;
  };
  counters: {
    providerExecuteCalls: 0;
    realCodexCliCalls: 0;
    workspaceWriteExecuteCalls: 0;
  };
  blockingReasons: string[];
}

export interface RealReadonlySmokeAuthorizationAcceptanceOptions {
  generatedAt?: string;
}

export function evaluateRealReadonlySmokeAuthorization(
  input: RealReadonlySmokeAuthorizationInput
): RealReadonlySmokeAuthorizationResult {
  const exactTokenMatched =
    input.authorizationToken === PR_13A_REAL_READONLY_SMOKE_AUTHORIZATION_TOKEN;
  const exactCommandMatched = input.command === PR_13A_REAL_READONLY_SMOKE_COMMAND;
  const readOnlySandboxMatched = input.sandboxMode === "read-only";
  const approvalPolicyNeverMatched = input.approvalPolicy === "never";
  const evidencePathChoiceDeclared =
    input.evidencePathChoice === "default" || input.evidencePathChoice === "one-off";
  const workspaceWriteDisallowed = input.workspaceWriteAuthorized !== true;
  const pushDisallowed = input.pushAuthorized !== true;
  const releaseDisallowed = input.releaseAuthorized !== true;
  const tagDisallowed = input.tagAuthorized !== true;
  const reasons = [
    ...(exactTokenMatched
      ? []
      : ["codex_cli_real_readonly_smoke_authorization_exact_token_required"]),
    ...(exactCommandMatched
      ? []
      : ["codex_cli_real_readonly_smoke_authorization_exact_command_required"]),
    ...(readOnlySandboxMatched
      ? []
      : ["codex_cli_real_readonly_smoke_authorization_read_only_sandbox_required"]),
    ...(approvalPolicyNeverMatched
      ? []
      : ["codex_cli_real_readonly_smoke_authorization_approval_never_required"]),
    ...(evidencePathChoiceDeclared
      ? []
      : ["codex_cli_real_readonly_smoke_authorization_evidence_path_choice_required"]),
    ...(workspaceWriteDisallowed
      ? []
      : ["codex_cli_real_readonly_smoke_authorization_workspace_write_must_remain_closed"]),
    ...(pushDisallowed
      ? []
      : ["codex_cli_real_readonly_smoke_authorization_push_must_be_separate"]),
    ...(releaseDisallowed
      ? []
      : ["codex_cli_real_readonly_smoke_authorization_release_must_be_separate"]),
    ...(tagDisallowed
      ? []
      : ["codex_cli_real_readonly_smoke_authorization_tag_must_be_separate"])
  ];
  const uniqueReasons = uniqueStrings(reasons);

  return {
    ok: uniqueReasons.length === 0,
    status: uniqueReasons.length === 0 ? "authorized" : "blocked",
    reasons: uniqueReasons,
    summary: {
      exactTokenMatched,
      exactCommandMatched,
      readOnlySandboxMatched,
      approvalPolicyNeverMatched,
      evidencePathChoiceDeclared,
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

export async function runRealReadonlySmokeAuthorizationAcceptance(
  options: RealReadonlySmokeAuthorizationAcceptanceOptions = {}
): Promise<RealReadonlySmokeAuthorizationAcceptanceEvidence> {
  const generatedAt = options.generatedAt ?? DEFAULT_GENERATED_AT;
  const exactAuthorization = evaluateRealReadonlySmokeAuthorization({
    authorizationToken: PR_13A_REAL_READONLY_SMOKE_AUTHORIZATION_TOKEN,
    command: PR_13A_REAL_READONLY_SMOKE_COMMAND,
    sandboxMode: "read-only",
    approvalPolicy: "never",
    evidencePathChoice: "default",
    workspaceWriteAuthorized: false,
    pushAuthorized: false,
    releaseAuthorized: false,
    tagAuthorized: false
  });
  const missingAuthorization = evaluateRealReadonlySmokeAuthorization({});
  const broadenedAuthorization = evaluateRealReadonlySmokeAuthorization({
    authorizationToken: "APPROVE_REAL_CODEX_CLI",
    command: "ALLOW_REAL_CODEX_CLI_READONLY_SMOKE=1 npm run smoke:readonly:real -- --sandbox workspace-write",
    sandboxMode: "workspace-write",
    approvalPolicy: "on-request",
    workspaceWriteAuthorized: true,
    pushAuthorized: false,
    releaseAuthorized: false,
    tagAuthorized: false
  });
  const pushReleaseTagAuthorization = evaluateRealReadonlySmokeAuthorization({
    authorizationToken: PR_13A_REAL_READONLY_SMOKE_AUTHORIZATION_TOKEN,
    command: PR_13A_REAL_READONLY_SMOKE_COMMAND,
    sandboxMode: "read-only",
    approvalPolicy: "never",
    evidencePathChoice: "default",
    workspaceWriteAuthorized: false,
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
    RealReadonlySmokeAuthorizationAcceptanceEvidence,
    "checks"
  > & {
    checks: Omit<
      RealReadonlySmokeAuthorizationAcceptanceEvidence["checks"],
      "leakCheckPassed"
    >;
  } = {
    schemaVersion: "codex-cli-real-readonly-smoke-authorization-acceptance.v1",
    generatedAt,
    mode: "real-readonly-smoke-authorization-local-only",
    taskId: "codex-cli-real-readonly-smoke-authorization-acceptance",
    checks: {
      exactAuthorizationAccepted: exactAuthorization.status === "authorized",
      missingAuthorizationBlocked: missingAuthorization.status === "blocked"
        && missingAuthorization.reasons.includes(
          "codex_cli_real_readonly_smoke_authorization_exact_token_required"
        )
        && missingAuthorization.reasons.includes(
          "codex_cli_real_readonly_smoke_authorization_exact_command_required"
        ),
      broadenedAuthorizationBlocked: broadenedAuthorization.status === "blocked"
        && broadenedAuthorization.reasons.includes(
          "codex_cli_real_readonly_smoke_authorization_read_only_sandbox_required"
        )
        && broadenedAuthorization.reasons.includes(
          "codex_cli_real_readonly_smoke_authorization_workspace_write_must_remain_closed"
        ),
      pushReleaseTagRejected: pushReleaseTagAuthorization.status === "blocked"
        && pushReleaseTagAuthorization.reasons.includes(
          "codex_cli_real_readonly_smoke_authorization_push_must_be_separate"
        )
        && pushReleaseTagAuthorization.reasons.includes(
          "codex_cli_real_readonly_smoke_authorization_release_must_be_separate"
        )
        && pushReleaseTagAuthorization.reasons.includes(
          "codex_cli_real_readonly_smoke_authorization_tag_must_be_separate"
        ),
      noProviderExecute: counters.providerExecuteCalls === 0,
      noRealCodexCli: counters.realCodexCliCalls === 0,
      noWorkspaceWriteExecute: counters.workspaceWriteExecuteCalls === 0
    },
    summary: {
      requiredSandbox: "read-only",
      requiredApprovalPolicy: "never",
      evidencePathChoiceRequired: true,
      workspaceWriteMustRemainClosed: true,
      pushReleaseTagMustBeSeparate: true,
      exactTokenMatched: exactAuthorization.summary.exactTokenMatched,
      exactCommandMatched: exactAuthorization.summary.exactCommandMatched
    },
    counters,
    blockingReasons: uniqueStrings([
      ...missingAuthorization.reasons,
      ...broadenedAuthorization.reasons,
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

export async function writeRealReadonlySmokeAuthorizationAcceptanceEvidence(
  evidence: RealReadonlySmokeAuthorizationAcceptanceEvidence,
  evidencePath = DEFAULT_EVIDENCE_PATH
): Promise<{
  path: string;
  evidence: RealReadonlySmokeAuthorizationAcceptanceEvidence;
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
    PR_13A_REAL_READONLY_SMOKE_AUTHORIZATION_TOKEN,
    PR_13A_REAL_READONLY_SMOKE_COMMAND,
    "APPROVE_REAL_CODEX_CLI",
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
  const evidence = await runRealReadonlySmokeAuthorizationAcceptance();
  const write = await writeRealReadonlySmokeAuthorizationAcceptanceEvidence(
    evidence,
    outputPath
  );

  console.log("Codex CLI real read-only smoke authorization acceptance");
  console.log(`exact authorization accepted: ${evidence.checks.exactAuthorizationAccepted}`);
  console.log(`missing authorization blocked: ${evidence.checks.missingAuthorizationBlocked}`);
  console.log(`broadened authorization blocked: ${evidence.checks.broadenedAuthorizationBlocked}`);
  console.log(`push/release/tag rejected: ${evidence.checks.pushReleaseTagRejected}`);
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
      "Codex CLI real read-only smoke authorization acceptance failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
