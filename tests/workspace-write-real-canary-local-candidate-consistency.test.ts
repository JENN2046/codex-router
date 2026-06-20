import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE,
  PR_12B_REAL_CANARY_ALLOWED_ACTION,
  PR_12B_REAL_CANARY_AUTHORIZATION_PHRASE,
  PR_12B_REAL_CANARY_WORKSPACE
} from "../packages/workspace-write-guard/src/index.js";
import {
  formatWorkspaceWriteRealCanaryLocalCandidateConsistencyReview,
  reviewWorkspaceWriteRealCanaryLocalCandidateConsistency,
  type WorkspaceWriteRealCanaryLocalCandidateConsistencyInput
} from "../scripts/run-workspace-write-real-canary-local-candidate-consistency.js";

const requiredChangedFiles = [
  "packages/workspace-write-guard/src/index.ts",
  "tests/workspace-write-guard.test.ts",
  "scripts/run-workspace-write-real-canary-authorization-acceptance.ts",
  "scripts/run-workspace-write-real-canary-pre-execution-acceptance.ts",
  "scripts/run-workspace-write-real-canary-sensitive-scan.ts",
  "tests/workspace-write-real-canary-authorization-acceptance.test.ts",
  "tests/workspace-write-real-canary-pre-execution-acceptance.test.ts",
  "tests/workspace-write-real-canary-sensitive-scan.test.ts",
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
  "docs/governance/PR_12B_WORKSPACE_WRITE_REAL_CANARY_LOCAL_RC_REVIEW_PASS.md",
  "package.json"
];

const allowedChangedFiles = [
  ...requiredChangedFiles,
  "scripts/run-workspace-write-real-canary-local-candidate-consistency.ts",
  "scripts/run-workspace-write-real-canary-final-local-audit.ts",
  "tests/workspace-write-real-canary-local-candidate-consistency.test.ts",
  "tests/workspace-write-real-canary-final-local-audit.test.ts"
];

const governanceDocPaths = [
  "docs/governance/PR_12B_WORKSPACE_WRITE_REAL_CANARY_AUTHORIZATION_LOCAL_CLOSEOUT.md",
  "docs/governance/PR_12B_WORKSPACE_WRITE_REAL_CANARY_AUTHORIZATION_PACKET_COMPATIBILITY.md",
  "docs/governance/PR_12B_WORKSPACE_WRITE_REAL_CANARY_PRE_EXECUTION_LOCAL_CLOSEOUT.md",
  "docs/governance/PR_12B_WORKSPACE_WRITE_REAL_CANARY_PRE_EXECUTION_BOUNDARY_AUDIT.md",
  "docs/governance/PR_12B_WORKSPACE_WRITE_REAL_CANARY_CANDIDATE_REVIEW_RECEIPT.md",
  "docs/governance/PR_12B_WORKSPACE_WRITE_REAL_CANARY_FINAL_LOCAL_AUDIT.md",
  "docs/governance/PR_12B_WORKSPACE_WRITE_REAL_CANARY_LOCAL_AUDIT_INDEX.md",
  "docs/governance/PR_12B_WORKSPACE_WRITE_REAL_CANARY_FINAL_LOCAL_RC_RECEIPT.md",
  "docs/governance/PR_12B_WORKSPACE_WRITE_REAL_CANARY_LOCAL_RC_REVIEW_PASS.md"
];

const forbiddenMarkers = [
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
  "canary=ready"
];

const auditFieldConsistencyDocs = [
  "docs/governance/PR_12B_WORKSPACE_WRITE_REAL_CANARY_CANDIDATE_REVIEW_RECEIPT.md",
  "docs/governance/PR_12B_WORKSPACE_WRITE_REAL_CANARY_LOCAL_AUDIT_INDEX.md",
  "docs/governance/PR_12B_WORKSPACE_WRITE_REAL_CANARY_LOCAL_RC_REVIEW_PASS.md"
] as const;

const requiredAuditFieldValues = [
  ["packageScriptsPresent", "true"],
  ["packageScriptTargetCount", "1"],
  ["packageScriptTargetMismatchCount", "0"],
  ["finalAuditNoForbiddenCommands", "true"],
  ["sensitiveScanJsonContractValid", "true"],
  ["sensitiveScanTargetCount", "14"],
  ["sensitiveScanMarkerHitCount", "0"],
  ["noForbiddenCommands", "true"]
] as const;

test("workspace-write real canary local candidate consistency passes for local-only candidate", () => {
  const review = reviewWorkspaceWriteRealCanaryLocalCandidateConsistency(
    createConsistentInput()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.deepEqual(review.checks, {
    worktreeClean: true,
    branchMain: true,
    localAheadOnly: true,
    requiredRangeFilesPresent: true,
    changedFilesWithinPr12bScope: true,
    packageScriptsPresent: true,
    evidenceParseable: true,
    evidenceLocalOnly: true,
    evidenceNoExecution: true,
    evidenceTargetMatchesConfigured: true,
    evidenceSanitized: true,
    governanceDocsNonAuthorizing: true,
    auditFieldValuesRecorded: true,
    finalAuditJsonContractValid: true,
    canaryFileAbsent: true
  });
  assert.equal(review.summary.branch, "main");
  assert.equal(review.summary.ahead, 8);
  assert.equal(review.summary.behind, 0);
  assert.equal(review.summary.unexpectedChangedFileCount, 0);
  assert.equal(review.summary.packageScriptTargetCount, 1);
  assert.equal(review.summary.packageScriptTargetMismatchCount, 0);
  assert.equal(review.summary.finalAuditNoForbiddenCommands, true);
  assert.equal(review.summary.providerExecuteCalls, 0);
  assert.equal(review.summary.realCodexCliCalls, 0);
  assert.equal(review.summary.workspaceWriteExecuteCalls, 0);
  assert.equal(review.summary.canaryFileWrites, 0);
});

test("workspace-write real canary local candidate consistency blocks unexpected files", () => {
  const review = reviewWorkspaceWriteRealCanaryLocalCandidateConsistency(
    createConsistentInput({
      changedFiles: [
        ...allowedChangedFiles,
        "packages/providers/codex-cli/src/index.ts"
      ]
    })
  );

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("workspace_write_real_canary_candidate_unexpected_files"));
  assert.equal(review.summary.unexpectedChangedFileCount, 1);
});

test("workspace-write real canary local candidate consistency reports configured canary target", () => {
  const canaryTargetFile = "tmp/configured-candidate-canary.txt";
  const review = reviewWorkspaceWriteRealCanaryLocalCandidateConsistency(
    createConsistentInput({
      canaryTargetFile,
      authorizationEvidenceText: createEvidenceText(
        "workspace-write-real-canary-authorization-local-only",
        {},
        { summary: { targetFile: canaryTargetFile } }
      ),
      preExecutionEvidenceText: createEvidenceText(
        "workspace-write-real-canary-pre-execution-local-only",
        {},
        { summary: { targetFile: canaryTargetFile } }
      )
    })
  );

  assert.equal(review.status, "passed");
  assert.equal(review.summary.canaryTargetFile, canaryTargetFile);
});

test("workspace-write real canary local candidate consistency blocks evidence target mismatch", () => {
  const review = reviewWorkspaceWriteRealCanaryLocalCandidateConsistency(
    createConsistentInput({
      canaryTargetFile: "tmp/configured-candidate-canary.txt"
    })
  );

  assert.equal(review.status, "blocked");
  assert.equal(review.checks.evidenceTargetMatchesConfigured, false);
  assert.ok(review.reasons.includes(
    "workspace_write_real_canary_candidate_evidence_target_mismatch"
  ));
});

test("workspace-write real canary local candidate consistency blocks stale or unsafe state", () => {
  const input = createConsistentInput({
    gitStatusShort: " M package.json\n",
    behind: 1,
    canaryFileExists: true,
    preExecutionEvidenceText: createEvidenceText(
      "workspace-write-real-canary-pre-execution-local-only",
      {
        workspaceWriteExecuteCalls: 1
      }
    )
  });
  const review = reviewWorkspaceWriteRealCanaryLocalCandidateConsistency(input);

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("workspace_write_real_canary_candidate_worktree_dirty"));
  assert.ok(review.reasons.includes("workspace_write_real_canary_candidate_not_local_ahead_only"));
  assert.ok(review.reasons.includes("workspace_write_real_canary_candidate_execution_counter_nonzero"));
  assert.ok(review.reasons.includes("workspace_write_real_canary_candidate_canary_file_exists"));
});

test("workspace-write real canary local candidate consistency requires full audit script chain", () => {
  const packageJson = {
    scripts: {
      typecheck: "tsc -p tsconfig.json --noEmit"
    }
  };
  const review = reviewWorkspaceWriteRealCanaryLocalCandidateConsistency(
    createConsistentInput({
      packageJsonText: JSON.stringify(packageJson)
    })
  );

  assert.equal(review.status, "blocked");
  assert.equal(review.checks.packageScriptsPresent, false);
  assert.equal(review.summary.packageScriptTargetCount, 1);
  assert.equal(review.summary.packageScriptTargetMismatchCount, 1);
  assert.ok(review.reasons.includes(
    "workspace_write_real_canary_candidate_package_scripts_missing"
  ));
});

test("workspace-write real canary local candidate consistency blocks changed audit script targets", () => {
  const packageJson = {
    scripts: {
      typecheck: "tsc -p tsconfig.json --noEmit",
      governance: "npm run smoke:readonly:real"
    }
  };
  const review = reviewWorkspaceWriteRealCanaryLocalCandidateConsistency(
    createConsistentInput({
      packageJsonText: JSON.stringify(packageJson)
    })
  );

  assert.equal(review.status, "blocked");
  assert.equal(review.checks.packageScriptsPresent, false);
  assert.ok(review.reasons.includes(
    "workspace_write_real_canary_candidate_package_scripts_missing"
  ));
});

test("workspace-write real canary local candidate consistency reviews later governance receipts", () => {
  const governanceDocs = createGovernanceDocs();
  governanceDocs["docs/governance/PR_12B_WORKSPACE_WRITE_REAL_CANARY_FINAL_LOCAL_AUDIT.md"] = [
    "This audit does not authorize:",
    "- real Codex CLI invocation",
    "- provider execute",
    "- workspace-write execute",
    "- canary file write"
  ].join("\n");

  const review = reviewWorkspaceWriteRealCanaryLocalCandidateConsistency(
    createConsistentInput({ governanceDocs })
  );

  assert.equal(review.status, "passed");
  assert.equal(review.checks.governanceDocsNonAuthorizing, true);

  const unsafeReview = reviewWorkspaceWriteRealCanaryLocalCandidateConsistency(
    createConsistentInput({
      governanceDocs: {
        ...governanceDocs,
        "docs/governance/PR_12B_WORKSPACE_WRITE_REAL_CANARY_CANDIDATE_REVIEW_RECEIPT.md": [
          "This receipt does not authorize execution.",
          "Real Codex CLI call: no",
          "Workspace-write execute: no"
        ].join("\n")
      }
    })
  );

  assert.equal(unsafeReview.status, "blocked");
  assert.equal(unsafeReview.checks.governanceDocsNonAuthorizing, false);
  assert.ok(unsafeReview.reasons.includes(
    "workspace_write_real_canary_candidate_docs_authorize_execution"
  ));
});

test("workspace-write real canary local candidate consistency omits raw sensitive inputs", () => {
  const input = createConsistentInput({
    authorizationEvidenceText: createEvidenceText(
      "workspace-write-real-canary-authorization-local-only",
      {},
      {
        extra: PR_12B_REAL_CANARY_AUTHORIZATION_PHRASE
      }
    )
  });
  const review = reviewWorkspaceWriteRealCanaryLocalCandidateConsistency(input);
  const serialized = JSON.stringify(review);

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("workspace_write_real_canary_candidate_evidence_leak_marker"));

  for (const marker of forbiddenMarkers) {
    assert.equal(
      serialized.includes(marker),
      false,
      `review result must omit ${marker}`
    );
  }
});

test("workspace-write real canary local candidate consistency formats text and json output", () => {
  const review = reviewWorkspaceWriteRealCanaryLocalCandidateConsistency(
    createConsistentInput()
  );
  const text = formatWorkspaceWriteRealCanaryLocalCandidateConsistencyReview(review);
  const json = formatWorkspaceWriteRealCanaryLocalCandidateConsistencyReview(
    review,
    "json"
  );
  const parsed = JSON.parse(json) as typeof review;

  assert.match(text, /status: passed/);
  assert.match(text, /unexpected changed files: 0/);
  assert.match(text, /package script targets: 1/);
  assert.match(text, /package script target mismatches: 0/);
  assert.match(text, /audit field values recorded: true/);
  assert.match(text, /final audit forbidden commands: false/);
  assert.equal(parsed.status, "passed");
  assert.equal(parsed.checks.auditFieldValuesRecorded, true);
  assert.equal(parsed.checks.finalAuditJsonContractValid, true);
  assert.equal(parsed.summary.unexpectedChangedFileCount, 0);
  assert.equal(parsed.summary.packageScriptTargetCount, 1);
  assert.equal(parsed.summary.packageScriptTargetMismatchCount, 0);
  assert.equal(parsed.summary.finalAuditNoForbiddenCommands, true);
  assert.equal(parsed.summary.providerExecuteCalls, 0);

  for (const marker of forbiddenMarkers) {
    assert.equal(json.includes(marker), false, `json output must omit ${marker}`);
  }
});

test("workspace-write real canary local candidate consistency docs record audit field values", async () => {
  for (const docPath of auditFieldConsistencyDocs) {
    const docText = await readFile(docPath, "utf8");

    for (const [fieldName, expectedValue] of requiredAuditFieldValues) {
      assert.match(
        docText,
        new RegExp(`${fieldName}[^\\n]*\`${expectedValue}\``),
        `${docPath} must record ${fieldName} as ${expectedValue}`
      );
    }
  }
});

test("workspace-write real canary local candidate consistency blocks stale audit field values", () => {
  const governanceDocs = createGovernanceDocs();
  governanceDocs["docs/governance/PR_12B_WORKSPACE_WRITE_REAL_CANARY_CANDIDATE_REVIEW_RECEIPT.md"] = [
    "This review does not authorize execution.",
    "Real Codex CLI call: no",
    "Workspace-write execute: no",
    "Canary file write: no",
    "- candidate audit packageScriptsPresent: `true`",
    "- candidate audit packageScriptTargetCount: `1`",
    "- candidate audit packageScriptTargetMismatchCount: `1`",
    "- candidate audit finalAuditNoForbiddenCommands: `true`",
    "- final local audit sensitiveScanJsonContractValid: `true`",
    "- final local audit sensitiveScanTargetCount: `14`",
    "- final local audit sensitiveScanMarkerHitCount: `0`",
    "- final local audit noForbiddenCommands: `true`"
  ].join("\n");

  const review = reviewWorkspaceWriteRealCanaryLocalCandidateConsistency(
    createConsistentInput({ governanceDocs })
  );

  assert.equal(review.status, "blocked");
  assert.equal(review.checks.auditFieldValuesRecorded, false);
  assert.ok(review.reasons.includes(
    "workspace_write_real_canary_candidate_audit_field_values_missing"
  ));
});

function createConsistentInput(
  overrides: Partial<WorkspaceWriteRealCanaryLocalCandidateConsistencyInput> = {}
): WorkspaceWriteRealCanaryLocalCandidateConsistencyInput {
  return {
    gitStatusShort: "",
    branch: "main",
    ahead: 8,
    behind: 0,
    changedFiles: allowedChangedFiles,
    packageJsonText: JSON.stringify({
      scripts: {
        typecheck: "tsc -p tsconfig.json --noEmit",
        governance: "tsx scripts/run-governance-check.ts"
      }
    }),
    authorizationEvidenceText: createEvidenceText(
      "workspace-write-real-canary-authorization-local-only"
    ),
    preExecutionEvidenceText: createEvidenceText(
      "workspace-write-real-canary-pre-execution-local-only"
    ),
    governanceDocs: createGovernanceDocs(),
    canaryFileExists: false,
    ...overrides
  };
}

function createGovernanceDocs(): Record<string, string> {
  return Object.fromEntries(
    governanceDocPaths.map((path) => [path, [
      "This review does not authorize execution.",
      "Real Codex CLI call: no",
      "Workspace-write execute: no",
      "Canary file write: no",
      "- candidate audit packageScriptsPresent: `true`",
      "- candidate audit packageScriptTargetCount: `1`",
      "- candidate audit packageScriptTargetMismatchCount: `0`",
      "- candidate audit finalAuditNoForbiddenCommands: `true`",
      "- final local audit sensitiveScanJsonContractValid: `true`",
      "- final local audit sensitiveScanTargetCount: `14`",
      "- final local audit sensitiveScanMarkerHitCount: `0`",
      "- final local audit noForbiddenCommands: `true`"
    ].join("\n")])
  );
}

function createEvidenceText(
  mode: string,
  counterOverrides: Partial<Record<
    "providerExecuteCalls"
    | "realCodexCliCalls"
    | "workspaceWriteExecuteCalls"
    | "canaryFileWrites",
    number
  >> = {},
  extraFields: Record<string, unknown> = {}
): string {
  const counters = {
    providerExecuteCalls: 0,
    realCodexCliCalls: 0,
    workspaceWriteExecuteCalls: 0,
    canaryFileWrites: 0,
    ...counterOverrides
  };

  return JSON.stringify({
    mode,
    checks: {
      noProviderExecute: counters.providerExecuteCalls === 0,
      noRealCodexCli: counters.realCodexCliCalls === 0,
      noWorkspaceWriteExecute: counters.workspaceWriteExecuteCalls === 0,
      noCanaryFileWrite: counters.canaryFileWrites === 0
    },
    summary: {
      targetFile: DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE
    },
    counters,
    ...extraFields
  });
}
