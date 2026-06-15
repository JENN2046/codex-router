import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE
} from "../packages/workspace-write-guard/src/index.js";
import {
  formatCapabilityTaxonomyEscalationPolicyAuditResult,
  reviewCapabilityTaxonomyEscalationPolicyAudit,
  type CapabilityTaxonomyEscalationPolicyAuditInput
} from "../scripts/run-capability-taxonomy-escalation-policy-audit.js";

const forbiddenOutputMarkers = [
  "prompt",
  "stdout",
  "stderr",
  "raw command",
  "raw env",
  "raw token",
  "raw patch",
  "OPENAI_API_KEY",
  "sk-",
  "Bearer"
];

test("capability taxonomy escalation policy audit passes for current local evidence", async () => {
  const review = reviewCapabilityTaxonomyEscalationPolicyAudit(
    await createInputFromWorkspace()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.taxonomyRecorded, true);
  assert.equal(review.checks.taxonomyNonExecuting, true);
  assert.equal(review.checks.capabilityClassesRecorded, true);
  assert.equal(review.checks.escalationPolicyRecorded, true);
  assert.equal(review.checks.stopConditionsRecorded, true);
  assert.equal(review.checks.receiptBaselineRecorded, true);
  assert.equal(review.checks.priorCanaryEvidenceValid, true);
  assert.equal(review.checks.canaryFileAbsent, true);
  assert.equal(review.summary.capabilityClassCount, 9);
  assert.equal(review.summary.canaryTargetFile, DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE);
  assert.equal(review.summary.evidenceStatus, "passed");
  assert.equal(review.summary.executionStatus, "completed");
  assert.equal(review.summary.exitCode, 0);
  assert.equal(review.summary.providerExecuteCallsDuringTaxonomyReview, 0);
  assert.equal(review.summary.realCodexCliCallsDuringTaxonomyReview, 0);
  assert.equal(review.summary.workspaceWriteExecuteCallsDuringTaxonomyReview, 0);
  assert.equal(review.summary.canaryFileWritesDuringTaxonomyReview, 0);
  assert.equal(review.summary.generalProviderExecutionCallsDuringTaxonomyReview, 0);
  assert.equal(review.summary.externalWriteCallsDuringTaxonomyReview, 0);
});

test("capability taxonomy escalation policy audit blocks broadened policy text", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewCapabilityTaxonomyEscalationPolicyAudit({
    ...input,
    taxonomyDocText: input.taxonomyDocText
      .replaceAll("push authorized: `false`", "push authorized: `true`")
      .replaceAll(
        "It is not to run workspace-write execution or general provider execution.",
        "Run workspace-write execution and general provider execution."
      )
      .replaceAll(
        "`general_workspace_write` and `general_provider_execution` remain closed",
        "`general_workspace_write` and `general_provider_execution` are open"
      )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("capability_taxonomy_escalation_policy_taxonomyNonExecuting")
  );
  assert.ok(
    review.reasons.includes("capability_taxonomy_escalation_policy_escalationPolicyRecorded")
  );
});

test("capability taxonomy escalation policy audit blocks missing classes and stops", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewCapabilityTaxonomyEscalationPolicyAudit({
    ...input,
    taxonomyDocText: input.taxonomyDocText
      .replaceAll("`scoped_workspace_write`", "`scoped_local_change`")
      .replaceAll("rollback plan is missing", "rollback discussion is pending")
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "capability_taxonomy_escalation_policy_capabilityClassesRecorded"
    )
  );
  assert.ok(
    review.reasons.includes("capability_taxonomy_escalation_policy_stopConditionsRecorded")
  );
});

test("capability taxonomy escalation policy audit blocks stale evidence or local target", async () => {
  const input = await createInputFromWorkspace();
  const evidence = JSON.parse(input.evidenceText) as Record<string, unknown>;
  const review = reviewCapabilityTaxonomyEscalationPolicyAudit({
    ...input,
    evidenceText: JSON.stringify({
      ...evidence,
      status: "failed",
      approvalPacket: {
        targetFiles: ["tmp/other.txt"]
      },
      run: {
        executionStatus: "failed",
        exitCode: 1
      },
      summary: {
        passed: false,
        blockingReasons: ["unsafe"]
      }
    }),
    canaryFileExists: true
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("capability_taxonomy_escalation_policy_priorCanaryEvidenceValid")
  );
  assert.ok(
    review.reasons.includes("capability_taxonomy_escalation_policy_canaryFileAbsent")
  );
});

test("capability taxonomy escalation policy audit output stays summarized", async () => {
  const review = reviewCapabilityTaxonomyEscalationPolicyAudit(
    await createInputFromWorkspace()
  );
  const text = formatCapabilityTaxonomyEscalationPolicyAuditResult(review);
  const json = formatCapabilityTaxonomyEscalationPolicyAuditResult(review, "json");
  const parsed = JSON.parse(json) as typeof review;

  assert.match(text, /status: passed/);
  assert.match(text, /external write calls during taxonomy review: 0/);
  assert.equal(parsed.status, "passed");

  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false, `text output must omit ${marker}`);
    assert.equal(json.includes(marker), false, `json output must omit ${marker}`);
  }
});

async function createInputFromWorkspace(
  overrides: Partial<CapabilityTaxonomyEscalationPolicyAuditInput> = {}
): Promise<CapabilityTaxonomyEscalationPolicyAuditInput> {
  return {
    gitStatusShort: "",
    branch: "main",
    aheadBehind: "0\t0",
    packageJsonText: await readFile("package.json", "utf8"),
    taxonomyDocText: await readFile(
      "docs/governance/CAPABILITY_TAXONOMY_ESCALATION_POLICY.md",
      "utf8"
    ),
    postCanaryReceiptDocText: await readFile(
      "docs/governance/POST_CANARY_RECEIPT_ROLLBACK_VERIFICATION_GATE.md",
      "utf8"
    ),
    evidenceText: await readFile(
      "docs/evidence/codex-cli-workspace-write-real-canary-latest.json",
      "utf8"
    ),
    canaryFileExists: false,
    ...overrides
  };
}
