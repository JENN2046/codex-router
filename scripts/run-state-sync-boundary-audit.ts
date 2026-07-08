#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const GOVERNANCE_CONTROL_PLANE = "docs/governance/GOVERNANCE_CONTROL_PLANE.md";
const GOVERNANCE_README = "docs/governance/README.md";
const GOVERNANCE_RUNNER = "scripts/run-governance-check.ts";
const CURRENT_STATE_DOC = "docs/current/CURRENT_STATE.md";
const STATE_SYNC_RECORD = "docs/current/state-sync-record.json";
const STATE_SYNC_AUDIT = "scripts/run-state-sync-audit.ts";
const STATE_SYNC_PACKAGE = "packages/state-sync-audit/src/index.ts";
const STATE_SYNC_TEST = "tests/state-sync-audit.test.ts";
const CI_WORKFLOW = ".github/workflows/ci.yml";

const REQUIRED_COLLECTOR_MARKERS = [
  "git([\"status\", \"--short\"], cwd)",
  "git([\"branch\", \"--show-current\"], cwd)",
  "git([\"rev-parse\", \"--short\", \"HEAD\"], cwd)",
  "git([\"rev-parse\", \"refs/remotes/origin/main\"], cwd)",
  "gitAheadBehindFromRef(\"HEAD\", observedUpstream, cwd)",
  "collectStateSyncObservation",
  "parseStateSyncClaim(stateSyncClaimText)",
  "parseStateSyncPolicyV2Claim(stateSyncClaimText)",
  "gitFilteredTreeDigest"
] as const;

const REQUIRED_PACKAGE_MARKERS = [
  "STATE_SYNC_AUTHORITY_CHECKS",
  "STATE_SYNC_LEGACY_COMPATIBILITY_CHECKS",
  "structuredClaimValid",
  "structuredTransitionAllowed",
  "dirtyWorktreeStateOnly",
  "outputSanitized",
  "auditReadOnly",
  "stateWritesDuringAudit: 0",
  "remoteWritesDuringAudit: 0"
] as const;

const REQUIRED_TEST_MARKERS = [
  "state sync audit passes when clean HEAD matches a structured source claim",
  "state sync audit blocks when the structured claim is missing",
  "state sync audit blocks policy v2 source digest drift",
  "state sync audit blocks policy v2 dirty worktrees",
  "state sync audit blocks dirty non-state files",
  "assert.equal(review.summary.stateWritesDuringAudit, 0)",
  "assert.equal(review.summary.remoteWritesDuringAudit, 0)"
] as const;

const REQUIRED_CI_MARKERS = [
  "State Sync Audit",
  "needs: test",
  "Resolve State Sync Audit gate",
  "npm run governance -- audit state-sync"
] as const;

const REQUIRED_CURRENT_STATE_MARKERS = [
  "machine-authoritative state-sync claim",
  "docs/current/state-sync-record.json",
  "structured claim: `state-sync-policy.v2` content attestation",
  "branch, commit, and divergence are observed by the audit at runtime",
  "Display drift is informational"
] as const;

const FORBIDDEN_AUTHORIZATION_MARKERS = [
  "state-sync authorized provider execute: `true`",
  "state-sync authorized real Codex CLI: `true`",
  "state-sync authorized workspace-write: `true`",
  "state-sync authorized host executor: `true`",
  "state-sync authorized sub-agent runtime: `true`",
  "state-sync authorized external write: `true`",
  "state-sync authorized release: `true`",
  "state-sync authorized push: `true`",
  "state-sync authorized deploy: `true`",
  "state-sync writes state now",
  "state-sync pushes now",
  "state-sync releases now"
] as const;

const FORBIDDEN_OUTPUT_MARKERS = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
] as const;

export interface StateSyncBoundaryAuditInput {
  governanceControlPlaneText: string;
  governanceReadmeText: string;
  governanceRunnerText: string;
  currentStateText: string;
  stateSyncRecordText: string;
  stateSyncAuditText: string;
  stateSyncPackageText: string;
  stateSyncTestText: string;
  ciWorkflowText: string;
}

export interface StateSyncBoundaryAuditResult {
  status: "passed" | "blocked";
  checks: {
    controlPlaneAuthorityRecorded: boolean;
    governanceReadmeListsBoundary: boolean;
    governanceRunnerRegistersBoundary: boolean;
    stateSyncGateRemainsRegistered: boolean;
    ciKeepsStateSyncGate: boolean;
    collectorRecordsGitObservationOnly: boolean;
    packageRecordsStateConsistencyOnly: boolean;
    currentStateRecordsBoundary: boolean;
    structuredRecordUsesPolicyV2: boolean;
    coverageRecorded: boolean;
    docsNonAuthorizing: boolean;
    outputSanitized: boolean;
  };
  summary: {
    stateSyncBoundaryMode: "state_consistency_observation_gate_only";
    stateSyncIsProviderExecuteAuthorization: false;
    stateSyncIsRealCodexCliAuthorization: false;
    stateSyncIsWorkspaceWriteAuthorization: false;
    stateSyncIsLocalCommandAuthorization: false;
    stateSyncIsHostExecutorAuthorization: false;
    stateSyncIsSubAgentRuntimeAuthorization: false;
    stateSyncIsToolRuntimeAuthorization: false;
    stateSyncIsExternalWriteAuthorization: false;
    stateSyncIsEvidenceRefreshAuthorization: false;
    stateSyncIsPushAuthorization: false;
    stateSyncIsReleaseAuthorization: false;
    stateSyncGitStateIsExecutionAuthorization: false;
    stateSyncCleanWorktreeIsProviderExecutionAuthorization: false;
    stateSyncPolicyV2IsExecutionAuthorization: false;
    providerExecuteCallsDuringBoundaryAudit: 0;
    codexCliCallsDuringBoundaryAudit: 0;
    workspaceWriteCallsDuringBoundaryAudit: 0;
    localCommandCallsDuringBoundaryAudit: 0;
    hostExecutorCallsDuringBoundaryAudit: 0;
    subAgentRuntimeCallsDuringBoundaryAudit: 0;
    toolRuntimeCallsDuringBoundaryAudit: 0;
    externalWriteCallsDuringBoundaryAudit: 0;
    stateWritesDuringBoundaryAudit: 0;
    remoteWritesDuringBoundaryAudit: 0;
  };
  reasons: string[];
}

export type StateSyncBoundaryAuditOutputFormat = "text" | "json";

export async function collectStateSyncBoundaryAuditInput(
  cwd = process.cwd()
): Promise<StateSyncBoundaryAuditInput> {
  const [
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    currentStateText,
    stateSyncRecordText,
    stateSyncAuditText,
    stateSyncPackageText,
    stateSyncTestText,
    ciWorkflowText
  ] = await Promise.all([
    read(cwd, GOVERNANCE_CONTROL_PLANE),
    read(cwd, GOVERNANCE_README),
    read(cwd, GOVERNANCE_RUNNER),
    read(cwd, CURRENT_STATE_DOC),
    read(cwd, STATE_SYNC_RECORD),
    read(cwd, STATE_SYNC_AUDIT),
    read(cwd, STATE_SYNC_PACKAGE),
    read(cwd, STATE_SYNC_TEST),
    read(cwd, CI_WORKFLOW)
  ]);

  return {
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    currentStateText,
    stateSyncRecordText,
    stateSyncAuditText,
    stateSyncPackageText,
    stateSyncTestText,
    ciWorkflowText
  };
}

export function reviewStateSyncBoundaryAudit(
  input: StateSyncBoundaryAuditInput
): StateSyncBoundaryAuditResult {
  const checks = {
    controlPlaneAuthorityRecorded: controlPlaneAuthorityRecorded(
      input.governanceControlPlaneText
    ),
    governanceReadmeListsBoundary: input.governanceReadmeText.includes(
      "npm run governance -- audit state-sync-boundary"
    ),
    governanceRunnerRegistersBoundary: input.governanceRunnerText.includes(
      "auditCheck(\"state-sync-boundary\""
    ),
    stateSyncGateRemainsRegistered: input.governanceRunnerText.includes(
      "auditCheck(\"state-sync\", \"scripts/run-state-sync-audit.ts\")"
    ),
    ciKeepsStateSyncGate: markersPresent(input.ciWorkflowText, REQUIRED_CI_MARKERS),
    collectorRecordsGitObservationOnly: markersPresent(
      input.stateSyncAuditText,
      REQUIRED_COLLECTOR_MARKERS
    ),
    packageRecordsStateConsistencyOnly: markersPresent(
      input.stateSyncPackageText,
      REQUIRED_PACKAGE_MARKERS
    ),
    currentStateRecordsBoundary: markersPresentNormalized(
      input.currentStateText,
      REQUIRED_CURRENT_STATE_MARKERS
    ),
    structuredRecordUsesPolicyV2: structuredRecordUsesPolicyV2(
      input.stateSyncRecordText
    ),
    coverageRecorded: markersPresent(input.stateSyncTestText, REQUIRED_TEST_MARKERS),
    docsNonAuthorizing:
      !containsForbiddenAuthorization(input.governanceControlPlaneText)
      && !containsForbiddenAuthorization(input.governanceReadmeText)
      && !containsForbiddenAuthorization(input.currentStateText),
    outputSanitized: outputSanitized()
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      stateSyncBoundaryMode: "state_consistency_observation_gate_only",
      stateSyncIsProviderExecuteAuthorization: false,
      stateSyncIsRealCodexCliAuthorization: false,
      stateSyncIsWorkspaceWriteAuthorization: false,
      stateSyncIsLocalCommandAuthorization: false,
      stateSyncIsHostExecutorAuthorization: false,
      stateSyncIsSubAgentRuntimeAuthorization: false,
      stateSyncIsToolRuntimeAuthorization: false,
      stateSyncIsExternalWriteAuthorization: false,
      stateSyncIsEvidenceRefreshAuthorization: false,
      stateSyncIsPushAuthorization: false,
      stateSyncIsReleaseAuthorization: false,
      stateSyncGitStateIsExecutionAuthorization: false,
      stateSyncCleanWorktreeIsProviderExecutionAuthorization: false,
      stateSyncPolicyV2IsExecutionAuthorization: false,
      providerExecuteCallsDuringBoundaryAudit: 0,
      codexCliCallsDuringBoundaryAudit: 0,
      workspaceWriteCallsDuringBoundaryAudit: 0,
      localCommandCallsDuringBoundaryAudit: 0,
      hostExecutorCallsDuringBoundaryAudit: 0,
      subAgentRuntimeCallsDuringBoundaryAudit: 0,
      toolRuntimeCallsDuringBoundaryAudit: 0,
      externalWriteCallsDuringBoundaryAudit: 0,
      stateWritesDuringBoundaryAudit: 0,
      remoteWritesDuringBoundaryAudit: 0
    },
    reasons
  };
}

export function formatStateSyncBoundaryAuditResult(
  review: StateSyncBoundaryAuditResult,
  format: StateSyncBoundaryAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "State-sync boundary audit",
    `status: ${review.status}`,
    `boundary mode: ${review.summary.stateSyncBoundaryMode}`,
    `state-sync is provider execute authorization: ${review.summary.stateSyncIsProviderExecuteAuthorization}`,
    `state-sync is real Codex CLI authorization: ${review.summary.stateSyncIsRealCodexCliAuthorization}`,
    `state-sync is workspace-write authorization: ${review.summary.stateSyncIsWorkspaceWriteAuthorization}`,
    `state-sync is host executor authorization: ${review.summary.stateSyncIsHostExecutorAuthorization}`,
    `state-sync is sub-agent runtime authorization: ${review.summary.stateSyncIsSubAgentRuntimeAuthorization}`,
    `state-sync is external write authorization: ${review.summary.stateSyncIsExternalWriteAuthorization}`,
    `state-sync is evidence refresh authorization: ${review.summary.stateSyncIsEvidenceRefreshAuthorization}`,
    `state-sync is push authorization: ${review.summary.stateSyncIsPushAuthorization}`,
    `state-sync is release authorization: ${review.summary.stateSyncIsReleaseAuthorization}`,
    `state-sync git state is execution authorization: ${review.summary.stateSyncGitStateIsExecutionAuthorization}`,
    `state-sync policy v2 is execution authorization: ${review.summary.stateSyncPolicyV2IsExecutionAuthorization}`,
    `provider execute calls during boundary audit: ${review.summary.providerExecuteCallsDuringBoundaryAudit}`,
    `real CLI calls during boundary audit: ${review.summary.codexCliCallsDuringBoundaryAudit}`,
    `workspace-write calls during boundary audit: ${review.summary.workspaceWriteCallsDuringBoundaryAudit}`,
    `state writes during boundary audit: ${review.summary.stateWritesDuringBoundaryAudit}`,
    `remote writes during boundary audit: ${review.summary.remoteWritesDuringBoundaryAudit}`,
    ...(review.reasons.length > 0 ? [`reasons: ${review.reasons.join(",")}`] : [])
  ].join("\n");
}

async function read(cwd: string, path: string): Promise<string> {
  return await readFile(join(cwd, path), "utf8");
}

function controlPlaneAuthorityRecorded(text: string): boolean {
  return markersPresentNormalized(text, [
    "State-sync boundary",
    "state consistency observation gate only",
    "state-sync is not provider execute authorization",
    "state-sync is not real Codex CLI authorization",
    "state-sync is not workspace-write authorization",
    "state-sync is not local command authorization",
    "state-sync is not host executor authorization",
    "state-sync is not sub-agent runtime authorization",
    "state-sync is not tool runtime authorization",
    "state-sync is not external-write authorization",
    "state-sync is not evidence refresh authorization",
    "state-sync is not push authorization",
    "state-sync is not release authorization",
    "state-sync git state is not execution authorization",
    "clean worktree is not provider execution authorization",
    "state-sync policy v2 is not execution authorization"
  ]);
}

function structuredRecordUsesPolicyV2(text: string): boolean {
  try {
    const parsed = JSON.parse(text) as unknown;
    return isRecord(parsed)
      && parsed.schemaVersion === 2
      && parsed.policyVersion === "state-sync-policy.v2";
  } catch {
    return false;
  }
}

function markersPresent(text: string, markers: readonly string[]): boolean {
  return markers.every((marker) => text.includes(marker));
}

function markersPresentNormalized(
  text: string,
  markers: readonly string[]
): boolean {
  const normalized = text.replace(/\s+/g, " ").toLowerCase();

  return markers.every((marker) =>
    normalized.includes(marker.replace(/\s+/g, " ").toLowerCase())
  );
}

function containsForbiddenAuthorization(text: string): boolean {
  const lower = text.toLowerCase();

  return FORBIDDEN_AUTHORIZATION_MARKERS.some((marker) =>
    lower.includes(marker.toLowerCase())
  );
}

function outputSanitized(): boolean {
  const fixture = formatStateSyncBoundaryAuditResult({
    status: "passed",
    checks: {
      controlPlaneAuthorityRecorded: true,
      governanceReadmeListsBoundary: true,
      governanceRunnerRegistersBoundary: true,
      stateSyncGateRemainsRegistered: true,
      ciKeepsStateSyncGate: true,
      collectorRecordsGitObservationOnly: true,
      packageRecordsStateConsistencyOnly: true,
      currentStateRecordsBoundary: true,
      structuredRecordUsesPolicyV2: true,
      coverageRecorded: true,
      docsNonAuthorizing: true,
      outputSanitized: true
    },
    summary: {
      stateSyncBoundaryMode: "state_consistency_observation_gate_only",
      stateSyncIsProviderExecuteAuthorization: false,
      stateSyncIsRealCodexCliAuthorization: false,
      stateSyncIsWorkspaceWriteAuthorization: false,
      stateSyncIsLocalCommandAuthorization: false,
      stateSyncIsHostExecutorAuthorization: false,
      stateSyncIsSubAgentRuntimeAuthorization: false,
      stateSyncIsToolRuntimeAuthorization: false,
      stateSyncIsExternalWriteAuthorization: false,
      stateSyncIsEvidenceRefreshAuthorization: false,
      stateSyncIsPushAuthorization: false,
      stateSyncIsReleaseAuthorization: false,
      stateSyncGitStateIsExecutionAuthorization: false,
      stateSyncCleanWorktreeIsProviderExecutionAuthorization: false,
      stateSyncPolicyV2IsExecutionAuthorization: false,
      providerExecuteCallsDuringBoundaryAudit: 0,
      codexCliCallsDuringBoundaryAudit: 0,
      workspaceWriteCallsDuringBoundaryAudit: 0,
      localCommandCallsDuringBoundaryAudit: 0,
      hostExecutorCallsDuringBoundaryAudit: 0,
      subAgentRuntimeCallsDuringBoundaryAudit: 0,
      toolRuntimeCallsDuringBoundaryAudit: 0,
      externalWriteCallsDuringBoundaryAudit: 0,
      stateWritesDuringBoundaryAudit: 0,
      remoteWritesDuringBoundaryAudit: 0
    },
    reasons: []
  });

  return FORBIDDEN_OUTPUT_MARKERS.every((marker) => !fixture.includes(marker));
}

function collectReasons(checks: Record<string, boolean>): string[] {
  return Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([name]) => `state_sync_boundary_${name}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function main(): Promise<void> {
  const review = reviewStateSyncBoundaryAudit(
    await collectStateSyncBoundaryAuditInput()
  );
  const format = process.argv.includes("--json") ? "json" : "text";

  console.log(formatStateSyncBoundaryAuditResult(review, format));

  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      "State-sync boundary audit failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
