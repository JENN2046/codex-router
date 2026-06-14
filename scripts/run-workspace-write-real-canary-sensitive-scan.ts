#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const WORKSPACE_WRITE_REAL_CANARY_SENSITIVE_SCAN_TARGETS = [
  "docs/evidence/workspace-write-real-canary-authorization-acceptance.json",
  "docs/evidence/workspace-write-real-canary-pre-execution-acceptance.json",
  "docs/governance/PR_12B_WORKSPACE_WRITE_REAL_CANARY_AUTHORIZATION_LOCAL_CLOSEOUT.md",
  "docs/governance/PR_12B_WORKSPACE_WRITE_REAL_CANARY_AUTHORIZATION_PACKET_COMPATIBILITY.md",
  "docs/governance/PR_12B_WORKSPACE_WRITE_REAL_CANARY_PRE_EXECUTION_LOCAL_CLOSEOUT.md",
  "docs/governance/PR_12B_WORKSPACE_WRITE_REAL_CANARY_PRE_EXECUTION_BOUNDARY_AUDIT.md",
  "docs/governance/PR_12B_WORKSPACE_WRITE_REAL_CANARY_CANDIDATE_REVIEW_RECEIPT.md",
  "docs/governance/PR_12B_WORKSPACE_WRITE_REAL_CANARY_FINAL_LOCAL_AUDIT.md",
  "docs/governance/PR_12B_WORKSPACE_WRITE_REAL_CANARY_LOCAL_AUDIT_INDEX.md",
  "docs/governance/PR_12B_WORKSPACE_WRITE_REAL_CANARY_FINAL_LOCAL_RC_RECEIPT.md",
  "docs/governance/PR_12B_WORKSPACE_WRITE_REAL_CANARY_LOCAL_RC_REVIEW_PASS.md"
] as const;

const SENSITIVE_MARKERS = [
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
] as const;

export interface WorkspaceWriteRealCanarySensitiveScanInput {
  targetTexts: Record<string, string | undefined>;
}

export interface WorkspaceWriteRealCanarySensitiveScanResult {
  status: "passed" | "blocked";
  checks: {
    allTargetsPresent: boolean;
    noSensitiveMarkers: boolean;
  };
  summary: {
    targetCount: number;
    missingTargetCount: number;
    leakingTargetCount: number;
    markerHitCount: number;
  };
  reasons: string[];
}

export type WorkspaceWriteRealCanarySensitiveScanOutputFormat = "text" | "json";

export async function collectWorkspaceWriteRealCanarySensitiveScanInput(
  cwd = process.cwd()
): Promise<WorkspaceWriteRealCanarySensitiveScanInput> {
  const entries = await Promise.all(
    WORKSPACE_WRITE_REAL_CANARY_SENSITIVE_SCAN_TARGETS.map(async (target) => {
      try {
        return [target, await readFile(join(cwd, target), "utf8")] as const;
      } catch {
        return [target, undefined] as const;
      }
    })
  );

  return {
    targetTexts: Object.fromEntries(entries)
  };
}

export function reviewWorkspaceWriteRealCanarySensitiveScan(
  input: WorkspaceWriteRealCanarySensitiveScanInput
): WorkspaceWriteRealCanarySensitiveScanResult {
  const missingTargetCount = WORKSPACE_WRITE_REAL_CANARY_SENSITIVE_SCAN_TARGETS.filter(
    (target) => input.targetTexts[target] === undefined
  ).length;
  const markerHits = WORKSPACE_WRITE_REAL_CANARY_SENSITIVE_SCAN_TARGETS.map((target) =>
    countSensitiveMarkers(input.targetTexts[target] ?? "")
  );
  const leakingTargetCount = markerHits.filter((count) => count > 0).length;
  const markerHitCount = markerHits.reduce((sum, count) => sum + count, 0);
  const allTargetsPresent = missingTargetCount === 0;
  const noSensitiveMarkers = markerHitCount === 0;
  const reasons = [
    ...(allTargetsPresent ? [] : ["workspace_write_real_canary_sensitive_scan_target_missing"]),
    ...(noSensitiveMarkers ? [] : ["workspace_write_real_canary_sensitive_scan_marker_found"])
  ];

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks: {
      allTargetsPresent,
      noSensitiveMarkers
    },
    summary: {
      targetCount: WORKSPACE_WRITE_REAL_CANARY_SENSITIVE_SCAN_TARGETS.length,
      missingTargetCount,
      leakingTargetCount,
      markerHitCount
    },
    reasons
  };
}

export function formatWorkspaceWriteRealCanarySensitiveScanResult(
  result: WorkspaceWriteRealCanarySensitiveScanResult,
  format: WorkspaceWriteRealCanarySensitiveScanOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(result, null, 2);
  }

  return [
    "Workspace-write real canary sensitive marker scan",
    `status: ${result.status}`,
    `targets: ${result.summary.targetCount}`,
    `missing targets: ${result.summary.missingTargetCount}`,
    `leaking targets: ${result.summary.leakingTargetCount}`,
    `marker hits: ${result.summary.markerHitCount}`,
    ...(result.reasons.length > 0 ? [`reasons: ${result.reasons.join(",")}`] : [])
  ].join("\n");
}

function countSensitiveMarkers(value: string): number {
  return SENSITIVE_MARKERS.reduce(
    (count, marker) => count + (value.includes(marker) ? 1 : 0),
    0
  );
}

async function main(): Promise<void> {
  const input = await collectWorkspaceWriteRealCanarySensitiveScanInput();
  const result = reviewWorkspaceWriteRealCanarySensitiveScan(input);
  const format = process.argv.includes("--json") ? "json" : "text";

  console.log(formatWorkspaceWriteRealCanarySensitiveScanResult(result, format));

  if (result.status !== "passed") {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      "Workspace-write real canary sensitive marker scan failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
