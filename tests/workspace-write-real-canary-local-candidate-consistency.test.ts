import test from "node:test";
import assert from "node:assert/strict";
import {
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
  "docs/governance/PR_12B_WORKSPACE_WRITE_REAL_CANARY_FINAL_LOCAL_RC_RECEIPT.md"
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
    evidenceSanitized: true,
    governanceDocsNonAuthorizing: true,
    finalAuditJsonContractValid: true,
    canaryFileAbsent: true
  });
  assert.equal(review.summary.branch, "main");
  assert.equal(review.summary.ahead, 8);
  assert.equal(review.summary.behind, 0);
  assert.equal(review.summary.unexpectedChangedFileCount, 0);
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
  assert.equal(parsed.status, "passed");
  assert.equal(parsed.checks.finalAuditJsonContractValid, true);
  assert.equal(parsed.summary.unexpectedChangedFileCount, 0);
  assert.equal(parsed.summary.providerExecuteCalls, 0);

  for (const marker of forbiddenMarkers) {
    assert.equal(json.includes(marker), false, `json output must omit ${marker}`);
  }
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
        "acceptance:workspace-write-real-canary-auth": "tsx scripts/run-workspace-write-real-canary-authorization-acceptance.ts",
        "acceptance:workspace-write-real-canary-pre-execution": "tsx scripts/run-workspace-write-real-canary-pre-execution-acceptance.ts",
        "audit:workspace-write-real-canary-sensitive-scan": "tsx scripts/run-workspace-write-real-canary-sensitive-scan.ts"
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
      "Canary file write: no"
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
    counters,
    ...extraFields
  });
}
