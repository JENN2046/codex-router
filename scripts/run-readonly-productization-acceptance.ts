#!/usr/bin/env node

import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import {
  collectReadonlyFormalIntegrationReadinessMatrixAuditInput,
  reviewReadonlyFormalIntegrationReadinessMatrixAudit,
  type ReadonlyFormalIntegrationReadinessMatrixAuditInput
} from "./run-readonly-formal-integration-readiness-matrix-audit.js";

const execFileAsync = promisify(execFile);

const PRODUCTIZATION_DOC =
  "docs/governance/READONLY_PRODUCTIZATION_ACCEPTANCE.md";
const ROADMAP_DOC = "docs/agent-os-transformation/current-roadmap-20260610.md";

const REQUIRED_PACKAGE_SCRIPTS = {
  governance: "tsx scripts/run-governance-check.ts"
} as const;

const REQUIRED_EVIDENCE = [
  {
    key: "real_readonly_smoke",
    path: "docs/evidence/codex-cli-real-readonly-smoke.json",
    schemaVersion: "codex-cli-real-readonly-smoke-gate.v1",
    status: "passed",
    booleanPaths: [
      ["checks", "readOnlySandbox"],
      ["checks", "approvalPolicyNever"],
      ["checks", "noWorkspaceWrite"],
      ["checks", "noFileWrite"],
      ["checks", "sanitizedEvidence"]
    ],
    stringPaths: [
      { path: ["mode"], value: "real-readonly-smoke" },
      { path: ["plan", "sandbox"], value: "read-only" },
      { path: ["plan", "approvalPolicy"], value: "never" },
      { path: ["run", "status"], value: "completed" }
    ],
    numberPaths: [
      { path: ["run", "exitCode"], value: 0 },
      { path: ["run", "parseErrorCount"], value: 0 }
    ]
  },
  {
    key: "formal_readonly_integration_readiness",
    path: "docs/evidence/codex-cli-formal-readonly-integration-readiness.json",
    schemaVersion: "codex-cli-formal-readonly-integration-readiness.v1",
    status: "passed",
    booleanPaths: [
      ["checks", "noProviderExecute"],
      ["checks", "noRealCodexCli"],
      ["checks", "noWorkspaceWriteExecute"],
      ["checks", "evidenceSanitized"]
    ],
    stringPaths: [
      { path: ["summary", "requiredSandbox"], value: "read-only" },
      { path: ["summary", "requiredSideEffectClass"], value: "read_only" },
      { path: ["summary", "requiredApprovalPolicy"], value: "never" }
    ],
    numberPaths: [
      { path: ["summary", "providerExecuteCalls"], value: 0 },
      { path: ["summary", "realCodexCliCalls"], value: 0 },
      { path: ["summary", "workspaceWriteExecuteCalls"], value: 0 }
    ]
  },
  {
    key: "formal_readonly_integration_authorization",
    path:
      "docs/evidence/codex-cli-formal-readonly-integration-authorization-acceptance.json",
    schemaVersion:
      "codex-cli-formal-readonly-integration-authorization-acceptance.v1",
    status: null,
    booleanPaths: [
      ["checks", "noProviderExecute"],
      ["checks", "noRealCodexCli"],
      ["checks", "noWorkspaceWriteExecute"],
      ["checks", "leakCheckPassed"],
      ["summary", "formalIntegrationAuthorizationOnly"],
      ["summary", "providerExecutionMustRemainSeparate"],
      ["summary", "realCliInvocationMustRemainSeparate"],
      ["summary", "workspaceWriteMustRemainClosed"]
    ],
    stringPaths: [
      { path: ["summary", "requiredSandbox"], value: "read-only" },
      { path: ["summary", "requiredSideEffectClass"], value: "read_only" },
      { path: ["summary", "requiredApprovalPolicy"], value: "never" }
    ],
    numberPaths: [
      { path: ["counters", "providerExecuteCalls"], value: 0 },
      { path: ["counters", "realCodexCliCalls"], value: 0 },
      { path: ["counters", "workspaceWriteExecuteCalls"], value: 0 }
    ]
  },
  {
    key: "formal_readonly_provider_integration_taskbook",
    path:
      "docs/evidence/codex-cli-formal-readonly-provider-integration-taskbook-acceptance.json",
    schemaVersion:
      "codex-cli-formal-readonly-provider-integration-taskbook-acceptance.v1",
    status: null,
    booleanPaths: [
      ["checks", "noProviderExecute"],
      ["checks", "noRealCodexCli"],
      ["checks", "noWorkspaceWriteExecute"],
      ["checks", "leakCheckPassed"],
      ["summary", "localTaskbookOnly"],
      ["summary", "realCliInvocationMustRemainClosed"],
      ["summary", "workspaceWriteMustRemainClosed"]
    ],
    stringPaths: [
      { path: ["summary", "requiredSandbox"], value: "read-only" },
      { path: ["summary", "requiredSideEffectClass"], value: "read_only" },
      { path: ["summary", "requiredApprovalPolicy"], value: "never" }
    ],
    numberPaths: [
      { path: ["counters", "providerExecuteCalls"], value: 0 },
      { path: ["counters", "realCodexCliCalls"], value: 0 },
      { path: ["counters", "workspaceWriteExecuteCalls"], value: 0 }
    ]
  },
  {
    key: "formal_readonly_provider_integration",
    path: "docs/evidence/codex-cli-formal-readonly-provider-integration-acceptance.json",
    schemaVersion: "codex-cli-formal-readonly-provider-integration-acceptance.v1",
    status: null,
    booleanPaths: [
      ["checks", "noRealCodexCli"],
      ["checks", "noWorkspaceWriteExecute"],
      ["checks", "noLocalCommandExecute"],
      ["checks", "noProtectedRemoteExecute"],
      ["checks", "leakCheckPassed"]
    ],
    stringPaths: [
      { path: ["summary", "sideEffectClass"], value: "read_only" },
      { path: ["summary", "sandbox"], value: "read-only" },
      { path: ["summary", "status"], value: "completed" }
    ],
    numberPaths: [
      { path: ["summary", "parseErrorCount"], value: 0 },
      { path: ["summary", "realCodexCliCalls"], value: 0 },
      { path: ["summary", "workspaceWriteExecuteCalls"], value: 0 },
      { path: ["summary", "localCommandExecuteCalls"], value: 0 },
      { path: ["summary", "protectedRemoteExecuteCalls"], value: 0 }
    ]
  },
  {
    key: "formal_readonly_dispatch_boundary",
    path: "docs/evidence/codex-cli-formal-readonly-dispatch-boundary-acceptance.json",
    schemaVersion: "codex-cli-formal-readonly-dispatch-boundary-acceptance.v1",
    status: null,
    booleanPaths: [
      ["checks", "noRealCodexCli"],
      ["checks", "noWorkspaceWriteExecute"],
      ["checks", "noLocalCommandExecute"],
      ["checks", "noProtectedRemoteExecute"],
      ["checks", "leakCheckPassed"]
    ],
    stringPaths: [
      { path: ["summary", "sideEffectClass"], value: "read_only" },
      { path: ["summary", "sandbox"], value: "read-only" },
      { path: ["summary", "status"], value: "completed" }
    ],
    numberPaths: [
      { path: ["summary", "realCodexCliCalls"], value: 0 },
      { path: ["summary", "workspaceWriteExecuteCalls"], value: 0 },
      { path: ["summary", "localCommandExecuteCalls"], value: 0 },
      { path: ["summary", "protectedRemoteExecuteCalls"], value: 0 }
    ]
  },
  {
    key: "formal_real_readonly_smoke_taskbook",
    path: "docs/evidence/codex-cli-formal-real-readonly-smoke-taskbook-acceptance.json",
    schemaVersion: "codex-cli-formal-real-readonly-smoke-taskbook-acceptance.v1",
    status: null,
    booleanPaths: [
      ["checks", "noProviderExecute"],
      ["checks", "noRealCodexCli"],
      ["checks", "noWorkspaceWriteExecute"],
      ["checks", "leakCheckPassed"],
      ["summary", "localTaskbookOnly"],
      ["summary", "realCliInvocationRequiresSeparateExecutionAuthorization"],
      ["summary", "providerExecuteRequiresSeparateExecutionAuthorization"],
      ["summary", "workspaceWriteMustRemainClosed"]
    ],
    stringPaths: [
      { path: ["summary", "requiredSandbox"], value: "read-only" },
      { path: ["summary", "requiredSideEffectClass"], value: "read_only" },
      { path: ["summary", "requiredApprovalPolicy"], value: "never" }
    ],
    numberPaths: [
      { path: ["counters", "providerExecuteCalls"], value: 0 },
      { path: ["counters", "realCodexCliCalls"], value: 0 },
      { path: ["counters", "workspaceWriteExecuteCalls"], value: 0 }
    ]
  },
  {
    key: "formal_real_readonly_smoke_pre_execution",
    path:
      "docs/evidence/codex-cli-formal-real-readonly-smoke-pre-execution-acceptance.json",
    schemaVersion:
      "codex-cli-formal-real-readonly-smoke-pre-execution-acceptance.v1",
    status: null,
    booleanPaths: [
      ["checks", "noProviderExecute"],
      ["checks", "noRealCodexCli"],
      ["checks", "noWorkspaceWriteExecute"],
      ["checks", "leakCheckPassed"],
      ["summary", "localPreExecutionOnly"],
      ["summary", "futureRealCliInvocationRequiresSeparateAuthorization"],
      ["summary", "providerExecuteRequiresSeparateAuthorization"],
      ["summary", "workspaceWriteMustRemainClosed"]
    ],
    stringPaths: [
      { path: ["summary", "requiredSandbox"], value: "read-only" },
      { path: ["summary", "requiredSideEffectClass"], value: "read_only" },
      { path: ["summary", "requiredApprovalPolicy"], value: "never" }
    ],
    numberPaths: [
      { path: ["counters", "providerExecuteCalls"], value: 0 },
      { path: ["counters", "realCodexCliCalls"], value: 0 },
      { path: ["counters", "workspaceWriteExecuteCalls"], value: 0 },
      { path: ["counters", "blockedSmokeRunnerCalls"], value: 0 }
    ]
  },
  {
    key: "formal_real_readonly_smoke_execution_authorization",
    path:
      "docs/evidence/codex-cli-formal-real-readonly-smoke-execution-authorization-acceptance.json",
    schemaVersion:
      "codex-cli-formal-real-readonly-smoke-execution-authorization-acceptance.v1",
    status: null,
    booleanPaths: [
      ["checks", "noProviderExecute"],
      ["checks", "noRealCodexCli"],
      ["checks", "noWorkspaceWriteExecute"],
      ["checks", "leakCheckPassed"],
      ["summary", "authorizationPacketOnly"],
      ["summary", "currentExecutionMustRemainClosed"],
      ["summary", "workspaceWriteMustRemainClosed"]
    ],
    stringPaths: [
      { path: ["summary", "requiredSandbox"], value: "read-only" },
      { path: ["summary", "requiredSideEffectClass"], value: "read_only" },
      { path: ["summary", "requiredApprovalPolicy"], value: "never" }
    ],
    numberPaths: [
      { path: ["counters", "providerExecuteCalls"], value: 0 },
      { path: ["counters", "realCodexCliCalls"], value: 0 },
      { path: ["counters", "workspaceWriteExecuteCalls"], value: 0 }
    ]
  },
  {
    key: "formal_real_readonly_smoke_final_preflight",
    path:
      "docs/evidence/codex-cli-formal-real-readonly-smoke-final-preflight-acceptance.json",
    schemaVersion:
      "codex-cli-formal-real-readonly-smoke-final-preflight-acceptance.v1",
    status: null,
    booleanPaths: [
      ["checks", "noProviderExecute"],
      ["checks", "noRealCodexCli"],
      ["checks", "noWorkspaceWriteExecute"],
      ["checks", "leakCheckPassed"],
      ["summary", "localPreflightOnly"],
      ["summary", "currentExecutionMustRemainClosed"],
      ["summary", "workspaceWriteMustRemainClosed"]
    ],
    stringPaths: [
      { path: ["summary", "requiredSandbox"], value: "read-only" },
      { path: ["summary", "requiredSideEffectClass"], value: "read_only" },
      { path: ["summary", "requiredApprovalPolicy"], value: "never" }
    ],
    numberPaths: [
      { path: ["counters", "providerExecuteCalls"], value: 0 },
      { path: ["counters", "realCodexCliCalls"], value: 0 },
      { path: ["counters", "workspaceWriteExecuteCalls"], value: 0 }
    ]
  }
] as const;

const REQUIRED_PRODUCTIZATION_DOC_MARKERS = [
  "READONLY_PRODUCTIZATION_ACCEPTANCE_RECORDED",
  "npm run governance -- audit readonly-productization",
  "npm run governance -- audit readonly-productization -- --json",
  "PR_21A_READONLY_FORMAL_INTEGRATION_READINESS_MATRIX_RECORDED",
  "PR_20C_READONLY_REAL_SMOKE_CHAIN_LOCAL_CLOSEOUT_COMPLETE",
  "does not authorize invoking the real Codex CLI",
  "does not authorize provider execute",
  "does not authorize workspace-write",
  "does not authorize remote write",
  "does not refresh evidence",
  "does not set an execution operator flag"
] as const;

const REQUIRED_ROADMAP_MARKERS = [
  "READONLY_PRODUCTIZATION_ACCEPTANCE_RECORDED",
  "npm run governance -- audit readonly-productization",
  "source and release package boundary fixes"
] as const;

const FORBIDDEN_SANITIZED_MARKERS = [
  "raw prompt",
  "argv",
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

const FORBIDDEN_AUTHORIZATION_MARKERS = [
  "real Codex CLI authorized: `true`",
  "provider execute authorized: `true`",
  "workspace-write authorized: `true`",
  "remote write authorized: `true`",
  "refresh evidence authorized: `true`",
  "push authorized: `true`",
  "release authorized: `true`",
  "tag authorized: `true`",
  "deployment authorized: `true`",
  "run real Codex CLI now",
  "invoke real Codex CLI now",
  "provider execute now",
  "execute workspace-write now",
  "refresh real read-only evidence now"
] as const;

export interface ReadonlyProductizationAcceptanceInput {
  gitStatusShort: string;
  branch: string;
  aheadBehind: string;
  headShort: string;
  packageJsonText: string | null;
  productizationDocText: string | null;
  roadmapText: string | null;
  evidenceTexts: Record<string, string | null>;
  readinessMatrixInput: ReadonlyFormalIntegrationReadinessMatrixAuditInput | null;
  readinessMatrixCollectError: string | null;
}

export interface ReadonlyProductizationAcceptanceResult {
  status: "passed" | "blocked";
  checks: {
    worktreeClean: boolean;
    branchMain: boolean;
    notBehindOrigin: boolean;
    packageScriptsPresent: boolean;
    requiredEvidencePresent: boolean;
    evidenceSchemaStatusValid: boolean;
    formalGateChainClosed: boolean;
    productizationDocRecorded: boolean;
    roadmapUpdated: boolean;
    governanceDocsNonAuthorizing: boolean;
    readOnlyBoundaryPreserved: boolean;
    outputSanitized: boolean;
    noProviderExecuteDuringAudit: boolean;
    noRealCodexCliDuringAudit: boolean;
    noWorkspaceWriteDuringAudit: boolean;
    noEvidenceWriteDuringAudit: boolean;
  };
  summary: {
    branch: string;
    ahead: number;
    behind: number;
    headShort: string;
    packageScriptTargetCount: number;
    packageScriptMismatchCount: number;
    evidenceTargetCount: number;
    evidencePresentCount: number;
    evidenceSchemaStatusPassedCount: number;
    governanceDocTargetCount: number;
    governanceDocPassedCount: number;
    readinessMatrixStatus: "passed" | "blocked" | "unavailable";
    missingItemCount: number;
    providerExecuteCallsDuringAudit: 0;
    realCodexCliCallsDuringAudit: 0;
    workspaceWriteCallsDuringAudit: 0;
    evidenceWritesDuringAudit: 0;
  };
  missingItems: string[];
  reasons: string[];
}

export type ReadonlyProductizationAcceptanceOutputFormat = "text" | "json";

export async function collectReadonlyProductizationAcceptanceInput(
  cwd = process.cwd()
): Promise<ReadonlyProductizationAcceptanceInput> {
  const [gitStatusShort, branch, aheadBehind, headShort] = await Promise.all([
    git(["status", "--short"], cwd),
    git(["branch", "--show-current"], cwd),
    git(["rev-list", "--left-right", "--count", "HEAD...origin/main"], cwd)
      .catch(() => "unknown\tunknown"),
    git(["rev-parse", "--short", "HEAD"], cwd)
  ]);

  let readinessMatrixInput: ReadonlyFormalIntegrationReadinessMatrixAuditInput | null =
    null;
  let readinessMatrixCollectError: string | null = null;

  try {
    readinessMatrixInput =
      await collectReadonlyFormalIntegrationReadinessMatrixAuditInput(cwd);
  } catch (error) {
    readinessMatrixCollectError =
      error instanceof Error ? error.message : String(error);
  }

  const evidenceTexts = Object.fromEntries(
    await Promise.all(
      REQUIRED_EVIDENCE.map(async (requirement) => [
        requirement.path,
        await readOptional(cwd, requirement.path)
      ])
    )
  ) as Record<string, string | null>;

  return {
    gitStatusShort,
    branch: branch.trim(),
    aheadBehind: aheadBehind.trim(),
    headShort: headShort.trim(),
    packageJsonText: await readOptional(cwd, "package.json"),
    productizationDocText: await readOptional(cwd, PRODUCTIZATION_DOC),
    roadmapText: await readOptional(cwd, ROADMAP_DOC),
    evidenceTexts,
    readinessMatrixInput,
    readinessMatrixCollectError
  };
}

export function reviewReadonlyProductizationAcceptance(
  input: ReadonlyProductizationAcceptanceInput
): ReadonlyProductizationAcceptanceResult {
  const packageJson = parseObject(input.packageJsonText);
  const packageScriptReview = reviewPackageScripts(packageJson);
  const evidenceReview = reviewEvidence(input.evidenceTexts);
  const { ahead, behind } = parseAheadBehind(input.aheadBehind);
  const readinessMatrix = input.readinessMatrixInput
    ? reviewReadonlyFormalIntegrationReadinessMatrixAudit(
      input.readinessMatrixInput
    )
    : null;
  const productizationDocText = input.productizationDocText ?? "";
  const roadmapText = input.roadmapText ?? "";
  const productizationDocRecorded =
    input.productizationDocText !== null
    && REQUIRED_PRODUCTIZATION_DOC_MARKERS.every((marker) =>
      productizationDocText.includes(marker)
    )
    && REQUIRED_EVIDENCE.every((requirement) =>
      productizationDocText.includes(requirement.path)
    );
  const roadmapUpdated =
    input.roadmapText !== null
    && roadmapText.includes("Date: 2026-06-16")
    && /Current base: `main` and `origin\/main` at `[0-9a-f]{7,}`/.test(
      roadmapText
    )
    && REQUIRED_ROADMAP_MARKERS.every((marker) => roadmapText.includes(marker));
  const docsNonAuthorizing =
    productizationNonAuthorizing(productizationDocText)
    && !containsForbiddenAuthorization(productizationDocText)
    && !containsForbiddenAuthorization(roadmapText);
  const docsSanitized =
    !containsForbiddenSanitizedMarker(productizationDocText)
    && !containsForbiddenSanitizedMarker(roadmapText);
  const checks = {
    worktreeClean: input.gitStatusShort.trim() === "",
    branchMain: input.branch === "main",
    notBehindOrigin: behind === 0,
    packageScriptsPresent: packageScriptReview.mismatchLabels.length === 0,
    requiredEvidencePresent: evidenceReview.missingLabels.length === 0,
    evidenceSchemaStatusValid:
      evidenceReview.schemaStatusPassedCount === REQUIRED_EVIDENCE.length,
    formalGateChainClosed:
      input.readinessMatrixCollectError === null
      && readinessMatrix?.status === "passed",
    productizationDocRecorded,
    roadmapUpdated,
    governanceDocsNonAuthorizing: docsNonAuthorizing,
    readOnlyBoundaryPreserved:
      evidenceReview.readOnlyBoundaryPreserved
      && readinessMatrix?.checks.readOnlyBoundaryPreserved === true,
    outputSanitized: evidenceReview.sanitized && docsSanitized,
    noProviderExecuteDuringAudit: true,
    noRealCodexCliDuringAudit: true,
    noWorkspaceWriteDuringAudit: true,
    noEvidenceWriteDuringAudit: true
  };
  const missingItems = [
    ...packageScriptReview.mismatchLabels,
    ...evidenceReview.missingLabels,
    ...(input.productizationDocText === null
      ? ["doc_readonly_productization_acceptance"]
      : []),
    ...(input.roadmapText === null ? ["doc_current_roadmap"] : []),
    ...(input.readinessMatrixCollectError !== null
      ? ["audit_readiness_matrix_input"]
      : [])
  ];
  const reasons = collectReasons(checks);
  const governanceDocPassedCount =
    Number(productizationDocRecorded) + Number(roadmapUpdated);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      branch: input.branch,
      ahead,
      behind,
      headShort: input.headShort,
      packageScriptTargetCount: Object.keys(REQUIRED_PACKAGE_SCRIPTS).length,
      packageScriptMismatchCount: packageScriptReview.mismatchLabels.length,
      evidenceTargetCount: REQUIRED_EVIDENCE.length,
      evidencePresentCount:
        REQUIRED_EVIDENCE.length - evidenceReview.missingLabels.length,
      evidenceSchemaStatusPassedCount: evidenceReview.schemaStatusPassedCount,
      governanceDocTargetCount: 2,
      governanceDocPassedCount,
      readinessMatrixStatus: readinessMatrix?.status ?? "unavailable",
      missingItemCount: missingItems.length,
      providerExecuteCallsDuringAudit: 0,
      realCodexCliCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      evidenceWritesDuringAudit: 0
    },
    missingItems,
    reasons
  };
}

export function formatReadonlyProductizationAcceptanceResult(
  review: ReadonlyProductizationAcceptanceResult,
  format: ReadonlyProductizationAcceptanceOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Read-only productization acceptance",
    `status: ${review.status}`,
    `branch: ${review.summary.branch}`,
    `ahead: ${review.summary.ahead}`,
    `behind: ${review.summary.behind}`,
    `head: ${review.summary.headShort}`,
    `package scripts: ${review.summary.packageScriptTargetCount - review.summary.packageScriptMismatchCount}/${review.summary.packageScriptTargetCount}`,
    `evidence files: ${review.summary.evidencePresentCount}/${review.summary.evidenceTargetCount}`,
    `evidence schema/status: ${review.summary.evidenceSchemaStatusPassedCount}/${review.summary.evidenceTargetCount}`,
    `governance docs: ${review.summary.governanceDocPassedCount}/${review.summary.governanceDocTargetCount}`,
    `readiness matrix: ${review.summary.readinessMatrixStatus}`,
    `missing items: ${review.summary.missingItemCount}`,
    `provider execute calls during audit: ${review.summary.providerExecuteCallsDuringAudit}`,
    `real CLI calls during audit: ${review.summary.realCodexCliCallsDuringAudit}`,
    `workspace-write calls during audit: ${review.summary.workspaceWriteCallsDuringAudit}`,
    `evidence writes during audit: ${review.summary.evidenceWritesDuringAudit}`,
    ...(review.missingItems.length > 0
      ? [`missing item ids: ${review.missingItems.join(",")}`]
      : []),
    ...(review.reasons.length > 0 ? [`reasons: ${review.reasons.join(",")}`] : [])
  ].join("\n");
}

async function git(args: string[], cwd: string): Promise<string> {
  const { stdout } = await execFileAsync("git", args, {
    cwd,
    encoding: "utf8",
    windowsHide: true
  });

  return stdout;
}

async function readOptional(cwd: string, path: string): Promise<string | null> {
  try {
    return await readFile(join(cwd, path), "utf8");
  } catch {
    return null;
  }
}

function reviewPackageScripts(
  packageJson: Record<string, unknown> | undefined
): { mismatchLabels: string[] } {
  const scripts = packageJson?.scripts;

  return {
    mismatchLabels: Object.entries(REQUIRED_PACKAGE_SCRIPTS)
      .filter(
        ([name, command]) =>
          !isRecord(scripts) || scripts[name] !== command
      )
      .map(([name]) => `package_script_${name}`)
  };
}

function reviewEvidence(evidenceTexts: Record<string, string | null>): {
  missingLabels: string[];
  schemaStatusPassedCount: number;
  readOnlyBoundaryPreserved: boolean;
  sanitized: boolean;
} {
  const missingLabels: string[] = [];
  let schemaStatusPassedCount = 0;
  let readOnlyBoundaryPreserved = true;
  let sanitized = true;

  for (const requirement of REQUIRED_EVIDENCE) {
    const text = evidenceTexts[requirement.path] ?? null;
    if (text === null) {
      missingLabels.push(`evidence_${requirement.key}`);
      readOnlyBoundaryPreserved = false;
      sanitized = false;
      continue;
    }

    sanitized = sanitized && !containsForbiddenSanitizedMarker(text);
    const evidence = parseObject(text);
    const schemaStatusOk =
      getString(evidence, ["schemaVersion"]) === requirement.schemaVersion
      && (requirement.status === null
        || getString(evidence, ["status"]) === requirement.status);
    const booleanPathsOk = requirement.booleanPaths.every(
      (path) => getBoolean(evidence, [...path]) === true
    );
    const stringPathsOk = requirement.stringPaths.every(
      ({ path, value }) => getString(evidence, [...path]) === value
    );
    const numberPathsOk = requirement.numberPaths.every(
      ({ path, value }) => getNumber(evidence, [...path]) === value
    );

    if (schemaStatusOk && booleanPathsOk && stringPathsOk && numberPathsOk) {
      schemaStatusPassedCount += 1;
    } else {
      readOnlyBoundaryPreserved = false;
    }
  }

  return {
    missingLabels,
    schemaStatusPassedCount,
    readOnlyBoundaryPreserved,
    sanitized
  };
}

function productizationNonAuthorizing(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ");

  return normalized.includes("does not authorize invoking the real Codex CLI")
    && normalized.includes("does not authorize provider execute")
    && normalized.includes("does not authorize workspace-write")
    && normalized.includes("does not authorize remote write")
    && normalized.includes("does not refresh evidence")
    && normalized.includes("does not set an execution operator flag")
    && !containsForbiddenAuthorization(text);
}

function containsForbiddenSanitizedMarker(text: string): boolean {
  return FORBIDDEN_SANITIZED_MARKERS.some((marker) => text.includes(marker))
    || containsTokenShapedValue(text);
}

function containsForbiddenAuthorization(text: string): boolean {
  const lower = text.toLowerCase();

  return FORBIDDEN_AUTHORIZATION_MARKERS.some((marker) =>
    lower.includes(marker.toLowerCase())
  );
}

function containsTokenShapedValue(text: string): boolean {
  return /\b(?:sk-[A-Za-z0-9_-]{8,}|Bearer\s+[A-Za-z0-9._-]{8,}|gh[pousr]_[A-Za-z0-9_]{8,})\b/.test(
    text
  );
}

function collectReasons(checks: Record<string, boolean>): string[] {
  return Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([name]) => `readonly_productization_${name}`);
}

function parseAheadBehind(value: string): { ahead: number; behind: number } {
  const [aheadText, behindText] = value.split(/\s+/);

  return {
    ahead: parseCount(aheadText),
    behind: parseCount(behindText)
  };
}

function parseCount(value: string | undefined): number {
  if (value === undefined) {
    return -1;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : -1;
}

function parseObject(value: string | null): Record<string, unknown> | undefined {
  if (value === null) {
    return undefined;
  }

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

function getNumber(
  value: Record<string, unknown> | undefined,
  path: string[]
): number | undefined {
  const found = getPath(value, path);
  return typeof found === "number" ? found : undefined;
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
  const result = reviewReadonlyProductizationAcceptance(
    await collectReadonlyProductizationAcceptanceInput()
  );
  const format = process.argv.includes("--json") ? "json" : "text";

  console.log(formatReadonlyProductizationAcceptanceResult(result, format));

  if (result.status !== "passed") {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      "Read-only productization acceptance failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
