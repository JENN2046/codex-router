import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { loadPolicyFromFile } from "../packages/policy-config/src/index.js";
import { evaluateApprovalRequirement } from "../packages/approval-gate/src/index.js";
import { routeTask } from "../packages/routing-engine/src/index.js";
import { classifyIntent } from "../packages/intent-gate/src/index.js";
import { parseTaskEnvelope } from "../packages/contracts/src/index.js";

const policyPath = fileURLToPath(new URL("../routing-policy.yaml", import.meta.url));

test("approval gate blocks protected actions", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const task = parseTaskEnvelope({
    taskId: "gate-1",
    source: "desktop-thread",
    intent: {
      summary: "merge release",
      requestedAction: "push to main and prod/stable",
      successCriteria: [],
      outOfScope: []
    },
      repoContext: { repoRoot: "A:/codex-router", branch: "main", worktreeClean: true, protectedBranch: true },
    target: { branches: ["main", "prod/stable"], files: [], modules: [] },
    constraints: {},
    hints: { riskHints: [], tags: [] }
  });

  const decision = routeTask(task, classifyIntent(task), policy);
  const approval = evaluateApprovalRequirement(task, decision, policy);

  assert.equal(approval.status, "pending");
  assert.match(approval.gateId ?? "", /^gate-/);
  assert.ok(approval.reasons.some((reason) => reason.includes("protected_branch")));
});

test("approval gate independently requires approval for protected write contexts", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const task = parseTaskEnvelope({
    taskId: "gate-write-context",
    source: "desktop-thread",
    intent: {
      summary: "small typo fix",
      requestedAction: "single file typo fix in docs",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: {
      repoRoot: "A:/codex-router",
      branch: "feature/docs",
      worktreeClean: false,
      protectedBranch: true
    },
    target: { branches: [], files: ["README.md"], modules: [] },
    constraints: {},
    hints: { riskHints: [], tags: [] }
  });

  const decision = routeTask(task, classifyIntent(task), policy);
  assert.equal(decision.approval.required, false);

  const approval = evaluateApprovalRequirement(task, decision, policy);

  assert.equal(approval.status, "pending");
  assert.ok(approval.reasons.includes("repo_context:protected_branch"));
  assert.ok(approval.reasons.includes("workspace:dirty"));
});
