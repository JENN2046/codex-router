import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { loadPolicyFromFile } from "../packages/policy-config/src/index.js";
import { evaluateApprovalRequirement } from "../packages/governance-internal-approval-gate/src/index.js";
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

test("Chinese high-risk and release requests always require approval", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  for (const [taskId, requestedAction] of [
    ["gate-zh-permission", "修改权限并删除凭证文件"],
    ["gate-zh-release", "把修改推送到主分支并发布到生产"]
  ] as const) {
    const task = parseTaskEnvelope({
      taskId,
      source: "desktop-thread",
      intent: {
        summary: "执行受保护的中文动作",
        requestedAction,
        successCriteria: [],
        outOfScope: []
      },
      repoContext: {
        repoRoot: "A:/codex-router",
        branch: "feature/safe",
        worktreeClean: true,
        protectedBranch: false
      },
      target: { branches: [], files: ["docs/guide.md"], modules: [] },
      constraints: {},
      hints: { taskClassHint: "read_only", riskHints: [], tags: [] }
    });
    const decision = routeTask(task, classifyIntent(task), policy);
    const approval = evaluateApprovalRequirement(task, decision, policy);

    assert.equal(decision.classification.riskLevel, "high");
    assert.equal(approval.status, "pending");
    assert.ok(approval.reasons.some((reason) => reason.startsWith("risk:")));
  }
});

test("approval gate recomputes protected policy signals when routing approval is absent", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const task = parseTaskEnvelope({
    taskId: "gate-policy-recheck",
    source: "desktop-thread",
    intent: {
      summary: "prepare release",
      requestedAction: "merge to prod/stable and push production config",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: { repoRoot: "A:/codex-router", branch: "main", worktreeClean: true },
    target: { branches: ["prod/stable"], files: [], modules: [] },
    constraints: {},
    hints: { riskHints: [], tags: [] }
  });

  const decision = routeTask(task, classifyIntent(task), policy);
  const staleDecision = {
    ...decision,
    execution: {
      ...decision.execution,
      toolAccess: "read_only" as const
    },
    approval: {
      required: false,
      reasons: []
    },
    providerGrant: decision.providerGrant
      ? {
          ...decision.providerGrant,
          sideEffectClass: "read_only" as const,
          toolAccess: "read_only" as const,
          sandboxMode: "read-only" as const,
          approvalRequired: false,
          requiredApprovals: []
        }
      : undefined
  };

  assert.equal(decision.execution.toolAccess, "protected_remote");
  assert.equal(staleDecision.execution.toolAccess, "read_only");

  const approval = evaluateApprovalRequirement(task, staleDecision, policy);

  assert.equal(approval.status, "pending");
  assert.ok(approval.reasons.includes("tool_access:protected_remote"));
  assert.ok(approval.reasons.includes("protected_branch:prod/stable"));
  assert.ok(approval.reasons.includes("active_branch:main"));
  assert.ok(approval.reasons.includes("keyword:merge"));
  assert.ok(approval.reasons.includes("keyword:push"));
  assert.ok(approval.reasons.includes("keyword:production"));
});
