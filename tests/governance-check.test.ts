import test from "node:test";
import assert from "node:assert/strict";
import {
  getValidationTierPlan,
  listGovernanceChecks,
  resolveGovernanceCheck
} from "../scripts/run-governance-check.js";

test("daily validation tier stays narrow and accepts targeted tests", () => {
  const plan = getValidationTierPlan("daily", {
    targetedTests: ["tests/desktop-live-adapter.test.ts"]
  });

  assert.deepEqual(
    plan.map((command) => command.id),
    ["typecheck", "targeted-tests"]
  );
  assert.deepEqual(
    plan[1]?.args,
    expectedTsxArgs(["--test", "tests/desktop-live-adapter.test.ts"])
  );
});

test("pr validation tier defines the normal pull request gate", () => {
  const plan = getValidationTierPlan("pr");

  assert.deepEqual(
    plan.map((command) => command.id),
    [
      "typecheck",
      "test",
      "build",
      "docs:governance",
      "governance-audit-execution-boundary-current-surface",
      "governance-audit-state-sync"
    ]
  );
  assert.deepEqual(
    plan[4]?.args,
    expectedTsxArgs(["scripts/run-execution-boundary-current-surface-audit.ts"])
  );
  assert.deepEqual(
    plan[5]?.args,
    expectedTsxArgs(["scripts/run-state-sync-audit.ts"])
  );
});

test("release validation tier avoids external and real host smoke by default", () => {
  const plan = getValidationTierPlan("release");
  const commandIds = plan.map((command) => command.id);

  assert.deepEqual(commandIds, [
    "typecheck",
    "test",
    "build",
    "docs:governance",
    "governance-audit-execution-boundary-current-surface",
    "governance-audit-state-sync",
    "canary",
    "canary:write",
    "smoke:contract",
    "governance-audit-workspace-write-release-gate",
    "evidence:collect"
  ]);
  assert.equal(commandIds.includes("canary:external"), false);
  assert.equal(commandIds.includes("smoke:telemetry"), false);
  assert.equal(commandIds.includes("smoke:workspace-write:telemetry"), false);
});

test("governance check runner default list shows current checks only", () => {
  const checks = listGovernanceChecks();

  assert.ok(checks.audit.includes("state-sync"));
  assert.ok(checks.audit.includes("state-sync-boundary"));
  assert.ok(checks.audit.includes("readonly-productization-boundary"));
  assert.ok(checks.audit.includes("workspace-write-release-gate"));
  assert.ok(checks.audit.includes("strategy-router-execution-boundary"));
  assert.ok(checks.audit.includes("execution-profiles-boundary"));
  assert.ok(checks.audit.includes("policy-config-boundary"));
  assert.ok(checks.audit.includes("capability-taxonomy-boundary"));
  assert.ok(checks.audit.includes("capability-taxonomy-escalation-policy-boundary"));
  assert.ok(checks.audit.includes("routing-engine-boundary"));
  assert.ok(checks.audit.includes("recovery-control-orchestration-boundary"));
  assert.ok(checks.audit.includes("runtime-control-boundary"));
  assert.ok(checks.audit.includes("operator-action-executor-gate-boundary"));
  assert.ok(checks.audit.includes("codex-cli-host-boundary"));
  assert.ok(checks.audit.includes("public-api-execution-boundary"));
  assert.ok(checks.audit.includes("agent-os-local-runtime-boundary"));
  assert.ok(checks.audit.includes("agent-os-mcp-server-manifest-boundary"));
  assert.ok(checks.audit.includes("protocol-mcp-provider-skeleton-boundary"));
  assert.ok(checks.audit.includes("protocol-a2a-remote-provider-skeleton-boundary"));
  assert.ok(checks.audit.includes("agent-os-sdk-boundary"));
  assert.ok(checks.audit.includes("agent-os-cli-boundary"));
  assert.ok(checks.audit.includes("agent-os-app-server-boundary"));
  assert.ok(checks.audit.includes("agent-os-public-surfaces-boundary"));
  assert.ok(checks.audit.includes("codex-provider-execution-boundary"));
  assert.ok(checks.audit.includes("preflight-boundary"));
  assert.ok(checks.audit.includes("approval-permit-boundary"));
  assert.ok(checks.audit.includes("approval-gate-boundary"));
  assert.ok(checks.audit.includes("approval-consumption-dispatch-matrix-boundary"));
  assert.ok(checks.audit.includes("approval-consumption-dispatch-boundary"));
  assert.ok(checks.audit.includes("admission-control-boundary"));
  assert.ok(checks.audit.includes("delegation-policy-boundary"));
  assert.ok(checks.audit.includes("execution-eligibility-boundary"));
  assert.ok(checks.audit.includes("execution-observation-boundary"));
  assert.ok(checks.audit.includes("governance-failure-reducer-boundary"));
  assert.ok(checks.audit.includes("task-graph-boundary"));
  assert.ok(checks.audit.includes("scheduler-boundary"));
  assert.ok(checks.audit.includes("execution-planner-boundary"));
  assert.ok(checks.audit.includes("provider-registry-boundary"));
  assert.ok(checks.audit.includes("controlled-provider-execution-taskbook-boundary"));
  assert.ok(checks.audit.includes("controlled-provider-execution-taskbook-review-boundary"));
  assert.ok(checks.audit.includes("provider-execution-runner-boundary"));
  assert.ok(checks.audit.includes("provider-core-execution-primitives-boundary"));
  assert.ok(checks.audit.includes("tool-invocation-planner-boundary"));
  assert.ok(checks.audit.includes("desktop-agent-strategy-boundary"));
  assert.ok(checks.audit.includes("desktop-decision-runner-boundary"));
  assert.ok(checks.audit.includes("final-host-locator-boundary"));
  assert.ok(checks.audit.includes("host-dispatcher-provider-boundary"));
  assert.ok(checks.audit.includes("codex-desktop-bridge-boundary"));
  assert.ok(checks.audit.includes("codex-desktop-live-host-boundary"));
  assert.ok(checks.audit.includes("codex-memory-mcp-client-boundary"));
  assert.ok(checks.audit.includes("codex-memory-host-client-boundary"));
  assert.ok(checks.audit.includes("desktop-host-client-boundary"));
  assert.ok(checks.audit.includes("desktop-live-adapter-dispatch-boundary"));
  assert.ok(checks.audit.includes("host-client-example-boundary"));
  assert.ok(checks.audit.includes("target-host-embedding-boundary"));
  assert.ok(checks.audit.includes("host-executor-boundary"));
  assert.ok(checks.audit.includes("host-executor-taskbook-boundary"));
  assert.ok(checks.audit.includes("host-client-executor-review-boundary"));
  assert.ok(checks.audit.includes("host-executor-receipt-boundary"));
  assert.ok(checks.audit.includes("agent-backed-recovery-executor-boundary"));
  assert.ok(checks.audit.includes("agent-executor-adapter-taskbook-boundary"));
  assert.ok(checks.audit.includes("agent-executor-adapter-review-boundary"));
  assert.ok(checks.audit.includes("agent-executor-adapter-sandbox-boundary"));
  assert.ok(checks.audit.includes("agent-task-control-taskbook-boundary"));
  assert.ok(checks.audit.includes("agent-task-control-review-boundary"));
  assert.ok(checks.audit.includes("agent-task-control-sandbox-boundary"));
  assert.ok(checks.audit.includes("sub-agent-runtime-boundary"));
  assert.ok(checks.audit.includes("execution-boundary-current-surface"));
  assert.ok(checks.acceptance.includes("readonly-chain"));
  assert.ok(checks.acceptance.includes("controlled-readonly-provider-execution"));
  assert.ok(checks.operator.includes("readonly"));
  assert.equal(checks.audit.includes("future-codex-cli-canary-execution-gate"), false);
  assert.equal(checks.audit.includes("controlled-provider-execution-taskbook-review"), false);
  assert.equal(checks.audit.includes("capability-taxonomy-escalation-policy"), false);
  assert.equal(checks.audit.includes("approval-consumption-dispatch-matrix"), false);
  assert.equal(checks.audit.includes("readonly-productization"), false);
  assert.equal(checks.acceptance.includes("workspace-write-real-canary-auth"), false);
  assert.equal(checks.operator.includes("telemetry"), false);
});

test("governance check runner all list keeps archived checks discoverable", () => {
  const checks = listGovernanceChecks({ includeArchived: true });

  assert.ok(checks.audit.includes("state-sync"));
  assert.ok(checks.audit.includes("future-codex-cli-canary-execution-gate"));
  assert.ok(checks.audit.includes("capability-taxonomy-escalation-policy"));
  assert.ok(checks.audit.includes("approval-consumption-dispatch-matrix"));
  assert.ok(checks.audit.includes("readonly-productization"));
  assert.ok(checks.acceptance.includes("readonly-chain"));
  assert.ok(checks.acceptance.includes("workspace-write-real-canary-auth"));
  assert.ok(checks.operator.includes("default"));
  assert.ok(checks.operator.includes("readonly"));
  assert.ok(checks.operator.includes("telemetry"));
});

test("governance check runner resolves registered checks with passthrough args", () => {
  const audit = resolveGovernanceCheck("audit", "state-sync", ["--json"]);
  const stateSyncBoundaryAudit = resolveGovernanceCheck(
    "audit",
    "state-sync-boundary"
  );
  const strategyRouterAudit = resolveGovernanceCheck(
    "audit",
    "strategy-router-execution-boundary"
  );
  const executionProfilesAudit = resolveGovernanceCheck(
    "audit",
    "execution-profiles-boundary"
  );
  const policyConfigAudit = resolveGovernanceCheck(
    "audit",
    "policy-config-boundary"
  );
  const capabilityTaxonomyAudit = resolveGovernanceCheck(
    "audit",
    "capability-taxonomy-boundary"
  );
  const capabilityTaxonomyEscalationPolicyBoundaryAudit = resolveGovernanceCheck(
    "audit",
    "capability-taxonomy-escalation-policy-boundary"
  );
  const routingEngineAudit = resolveGovernanceCheck(
    "audit",
    "routing-engine-boundary"
  );
  const recoveryControlAudit = resolveGovernanceCheck(
    "audit",
    "recovery-control-orchestration-boundary"
  );
  const runtimeControlAudit = resolveGovernanceCheck(
    "audit",
    "runtime-control-boundary"
  );
  const operatorActionExecutorGateAudit = resolveGovernanceCheck(
    "audit",
    "operator-action-executor-gate-boundary"
  );
  const codexCliHostAudit = resolveGovernanceCheck(
    "audit",
    "codex-cli-host-boundary"
  );
  const publicApiAudit = resolveGovernanceCheck(
    "audit",
    "public-api-execution-boundary"
  );
  const agentOsMcpServerManifestAudit = resolveGovernanceCheck(
    "audit",
    "agent-os-mcp-server-manifest-boundary"
  );
  const protocolMcpProviderSkeletonAudit = resolveGovernanceCheck(
    "audit",
    "protocol-mcp-provider-skeleton-boundary"
  );
  const protocolA2aRemoteProviderSkeletonAudit = resolveGovernanceCheck(
    "audit",
    "protocol-a2a-remote-provider-skeleton-boundary"
  );
  const agentOsSdkAudit = resolveGovernanceCheck(
    "audit",
    "agent-os-sdk-boundary"
  );
  const agentOsCliAudit = resolveGovernanceCheck(
    "audit",
    "agent-os-cli-boundary"
  );
  const agentOsAppServerAudit = resolveGovernanceCheck(
    "audit",
    "agent-os-app-server-boundary"
  );
  const agentOsPublicSurfacesAudit = resolveGovernanceCheck(
    "audit",
    "agent-os-public-surfaces-boundary"
  );
  const codexProviderAudit = resolveGovernanceCheck(
    "audit",
    "codex-provider-execution-boundary"
  );
  const preflightAudit = resolveGovernanceCheck(
    "audit",
    "preflight-boundary"
  );
  const approvalPermitAudit = resolveGovernanceCheck(
    "audit",
    "approval-permit-boundary"
  );
  const approvalGateAudit = resolveGovernanceCheck(
    "audit",
    "approval-gate-boundary"
  );
  const approvalConsumptionDispatchMatrixBoundaryAudit = resolveGovernanceCheck(
    "audit",
    "approval-consumption-dispatch-matrix-boundary"
  );
  const approvalConsumptionDispatchAudit = resolveGovernanceCheck(
    "audit",
    "approval-consumption-dispatch-boundary"
  );
  const readonlyProductizationBoundaryAudit = resolveGovernanceCheck(
    "audit",
    "readonly-productization-boundary"
  );
  const admissionControlAudit = resolveGovernanceCheck(
    "audit",
    "admission-control-boundary"
  );
  const delegationPolicyAudit = resolveGovernanceCheck(
    "audit",
    "delegation-policy-boundary"
  );
  const executionEligibilityAudit = resolveGovernanceCheck(
    "audit",
    "execution-eligibility-boundary"
  );
  const executionObservationAudit = resolveGovernanceCheck(
    "audit",
    "execution-observation-boundary"
  );
  const governanceFailureReducerAudit = resolveGovernanceCheck(
    "audit",
    "governance-failure-reducer-boundary"
  );
  const taskGraphAudit = resolveGovernanceCheck(
    "audit",
    "task-graph-boundary"
  );
  const schedulerAudit = resolveGovernanceCheck(
    "audit",
    "scheduler-boundary"
  );
  const executionPlannerAudit = resolveGovernanceCheck(
    "audit",
    "execution-planner-boundary"
  );
  const providerRegistryAudit = resolveGovernanceCheck(
    "audit",
    "provider-registry-boundary"
  );
  const controlledProviderExecutionTaskbookAudit = resolveGovernanceCheck(
    "audit",
    "controlled-provider-execution-taskbook-boundary"
  );
  const controlledProviderExecutionTaskbookReviewBoundaryAudit = resolveGovernanceCheck(
    "audit",
    "controlled-provider-execution-taskbook-review-boundary"
  );
  const providerExecutionRunnerAudit = resolveGovernanceCheck(
    "audit",
    "provider-execution-runner-boundary"
  );
  const providerCorePrimitivesAudit = resolveGovernanceCheck(
    "audit",
    "provider-core-execution-primitives-boundary"
  );
  const toolInvocationPlannerAudit = resolveGovernanceCheck(
    "audit",
    "tool-invocation-planner-boundary"
  );
  const desktopAgentStrategyAudit = resolveGovernanceCheck(
    "audit",
    "desktop-agent-strategy-boundary"
  );
  const desktopDecisionRunnerAudit = resolveGovernanceCheck(
    "audit",
    "desktop-decision-runner-boundary"
  );
  const finalHostLocatorAudit = resolveGovernanceCheck(
    "audit",
    "final-host-locator-boundary"
  );
  const hostDispatcherProviderAudit = resolveGovernanceCheck(
    "audit",
    "host-dispatcher-provider-boundary"
  );
  const codexDesktopBridgeAudit = resolveGovernanceCheck(
    "audit",
    "codex-desktop-bridge-boundary"
  );
  const codexDesktopLiveHostAudit = resolveGovernanceCheck(
    "audit",
    "codex-desktop-live-host-boundary"
  );
  const codexMemoryMcpClientAudit = resolveGovernanceCheck(
    "audit",
    "codex-memory-mcp-client-boundary"
  );
  const codexMemoryHostClientAudit = resolveGovernanceCheck(
    "audit",
    "codex-memory-host-client-boundary"
  );
  const desktopHostClientAudit = resolveGovernanceCheck(
    "audit",
    "desktop-host-client-boundary"
  );
  const desktopLiveAdapterDispatchAudit = resolveGovernanceCheck(
    "audit",
    "desktop-live-adapter-dispatch-boundary"
  );
  const hostClientExampleAudit = resolveGovernanceCheck(
    "audit",
    "host-client-example-boundary"
  );
  const targetHostEmbeddingAudit = resolveGovernanceCheck(
    "audit",
    "target-host-embedding-boundary"
  );
  const hostExecutorAudit = resolveGovernanceCheck(
    "audit",
    "host-executor-boundary"
  );
  const hostExecutorTaskbookAudit = resolveGovernanceCheck(
    "audit",
    "host-executor-taskbook-boundary"
  );
  const hostClientExecutorReviewAudit = resolveGovernanceCheck(
    "audit",
    "host-client-executor-review-boundary"
  );
  const hostExecutorReceiptAudit = resolveGovernanceCheck(
    "audit",
    "host-executor-receipt-boundary"
  );
  const agentBackedRecoveryExecutorAudit = resolveGovernanceCheck(
    "audit",
    "agent-backed-recovery-executor-boundary"
  );
  const agentExecutorAdapterTaskbookAudit = resolveGovernanceCheck(
    "audit",
    "agent-executor-adapter-taskbook-boundary"
  );
  const agentExecutorAdapterReviewAudit = resolveGovernanceCheck(
    "audit",
    "agent-executor-adapter-review-boundary"
  );
  const agentExecutorAdapterSandboxAudit = resolveGovernanceCheck(
    "audit",
    "agent-executor-adapter-sandbox-boundary"
  );
  const agentTaskControlTaskbookAudit = resolveGovernanceCheck(
    "audit",
    "agent-task-control-taskbook-boundary"
  );
  const agentTaskControlReviewAudit = resolveGovernanceCheck(
    "audit",
    "agent-task-control-review-boundary"
  );
  const agentTaskControlAudit = resolveGovernanceCheck(
    "audit",
    "agent-task-control-sandbox-boundary"
  );
  const subAgentRuntimeAudit = resolveGovernanceCheck(
    "audit",
    "sub-agent-runtime-boundary"
  );
  const executionBoundarySurfaceAudit = resolveGovernanceCheck(
    "audit",
    "execution-boundary-current-surface"
  );
  const acceptance = resolveGovernanceCheck("acceptance", "readonly-chain");
  const operator = resolveGovernanceCheck("operator", "readonly");
  const archived = resolveGovernanceCheck("audit", "future-codex-cli-canary-execution-gate");
  const archivedCapabilityTaxonomyEscalationPolicy = resolveGovernanceCheck(
    "audit",
    "capability-taxonomy-escalation-policy"
  );
  const archivedApprovalConsumptionDispatchMatrix = resolveGovernanceCheck(
    "audit",
    "approval-consumption-dispatch-matrix"
  );
  const archivedReadonlyProductization = resolveGovernanceCheck(
    "audit",
    "readonly-productization"
  );

  assert.deepEqual(
    audit.args,
    expectedTsxArgs(["scripts/run-state-sync-audit.ts", "--json"])
  );
  assert.deepEqual(
    stateSyncBoundaryAudit.args,
    expectedTsxArgs(["scripts/run-state-sync-boundary-audit.ts"])
  );
  assert.deepEqual(
    strategyRouterAudit.args,
    expectedTsxArgs(["scripts/run-strategy-router-execution-boundary-audit.ts"])
  );
  assert.deepEqual(
    executionProfilesAudit.args,
    expectedTsxArgs(["scripts/run-execution-profiles-boundary-audit.ts"])
  );
  assert.deepEqual(
    policyConfigAudit.args,
    expectedTsxArgs(["scripts/run-policy-config-boundary-audit.ts"])
  );
  assert.deepEqual(
    capabilityTaxonomyAudit.args,
    expectedTsxArgs(["scripts/run-capability-taxonomy-boundary-audit.ts"])
  );
  assert.deepEqual(
    capabilityTaxonomyEscalationPolicyBoundaryAudit.args,
    expectedTsxArgs([
      "scripts/run-capability-taxonomy-escalation-policy-boundary-audit.ts"
    ])
  );
  assert.deepEqual(
    routingEngineAudit.args,
    expectedTsxArgs(["scripts/run-routing-engine-boundary-audit.ts"])
  );
  assert.deepEqual(
    recoveryControlAudit.args,
    expectedTsxArgs(["scripts/run-recovery-control-orchestration-boundary-audit.ts"])
  );
  assert.deepEqual(
    runtimeControlAudit.args,
    expectedTsxArgs(["scripts/run-runtime-control-boundary-audit.ts"])
  );
  assert.deepEqual(
    operatorActionExecutorGateAudit.args,
    expectedTsxArgs(["scripts/run-operator-action-executor-gate-boundary-audit.ts"])
  );
  assert.deepEqual(
    codexCliHostAudit.args,
    expectedTsxArgs(["scripts/run-codex-cli-host-boundary-audit.ts"])
  );
  assert.deepEqual(
    publicApiAudit.args,
    expectedTsxArgs(["scripts/run-public-api-execution-boundary-audit.ts"])
  );
  const agentOsLocalRuntimeAudit = resolveGovernanceCheck(
    "audit",
    "agent-os-local-runtime-boundary"
  );
  assert.deepEqual(
    agentOsLocalRuntimeAudit.args,
    expectedTsxArgs(["scripts/run-agent-os-local-runtime-boundary-audit.ts"])
  );
  assert.deepEqual(
    agentOsMcpServerManifestAudit.args,
    expectedTsxArgs(["scripts/run-agent-os-mcp-server-manifest-boundary-audit.ts"])
  );
  assert.deepEqual(
    protocolMcpProviderSkeletonAudit.args,
    expectedTsxArgs(["scripts/run-protocol-mcp-provider-skeleton-boundary-audit.ts"])
  );
  assert.deepEqual(
    protocolA2aRemoteProviderSkeletonAudit.args,
    expectedTsxArgs([
      "scripts/run-protocol-a2a-remote-provider-skeleton-boundary-audit.ts"
    ])
  );
  assert.deepEqual(
    agentOsSdkAudit.args,
    expectedTsxArgs(["scripts/run-agent-os-sdk-boundary-audit.ts"])
  );
  assert.deepEqual(
    agentOsCliAudit.args,
    expectedTsxArgs(["scripts/run-agent-os-cli-boundary-audit.ts"])
  );
  assert.deepEqual(
    agentOsAppServerAudit.args,
    expectedTsxArgs(["scripts/run-agent-os-app-server-boundary-audit.ts"])
  );
  assert.deepEqual(
    agentOsPublicSurfacesAudit.args,
    expectedTsxArgs(["scripts/run-agent-os-public-surfaces-boundary-audit.ts"])
  );
  assert.deepEqual(
    codexProviderAudit.args,
    expectedTsxArgs(["scripts/run-codex-provider-execution-boundary-audit.ts"])
  );
  assert.deepEqual(
    preflightAudit.args,
    expectedTsxArgs(["scripts/run-preflight-boundary-audit.ts"])
  );
  assert.deepEqual(
    approvalPermitAudit.args,
    expectedTsxArgs(["scripts/run-approval-permit-boundary-audit.ts"])
  );
  assert.deepEqual(
    approvalGateAudit.args,
    expectedTsxArgs(["scripts/run-approval-gate-boundary-audit.ts"])
  );
  assert.deepEqual(
    approvalConsumptionDispatchMatrixBoundaryAudit.args,
    expectedTsxArgs([
      "scripts/run-approval-consumption-dispatch-matrix-boundary-audit.ts"
    ])
  );
  assert.deepEqual(
    approvalConsumptionDispatchAudit.args,
    expectedTsxArgs(["scripts/run-approval-consumption-dispatch-boundary-audit.ts"])
  );
  assert.deepEqual(
    readonlyProductizationBoundaryAudit.args,
    expectedTsxArgs(["scripts/run-readonly-productization-boundary-audit.ts"])
  );
  assert.deepEqual(
    admissionControlAudit.args,
    expectedTsxArgs(["scripts/run-admission-control-boundary-audit.ts"])
  );
  assert.deepEqual(
    delegationPolicyAudit.args,
    expectedTsxArgs(["scripts/run-delegation-policy-boundary-audit.ts"])
  );
  assert.deepEqual(
    executionEligibilityAudit.args,
    expectedTsxArgs(["scripts/run-execution-eligibility-boundary-audit.ts"])
  );
  assert.deepEqual(
    executionObservationAudit.args,
    expectedTsxArgs(["scripts/run-execution-observation-boundary-audit.ts"])
  );
  assert.deepEqual(
    governanceFailureReducerAudit.args,
    expectedTsxArgs(["scripts/run-governance-failure-reducer-boundary-audit.ts"])
  );
  assert.deepEqual(
    taskGraphAudit.args,
    expectedTsxArgs(["scripts/run-task-graph-boundary-audit.ts"])
  );
  assert.deepEqual(
    schedulerAudit.args,
    expectedTsxArgs(["scripts/run-scheduler-boundary-audit.ts"])
  );
  assert.deepEqual(
    executionPlannerAudit.args,
    expectedTsxArgs(["scripts/run-execution-planner-boundary-audit.ts"])
  );
  assert.deepEqual(
    providerRegistryAudit.args,
    expectedTsxArgs(["scripts/run-provider-registry-boundary-audit.ts"])
  );
  assert.deepEqual(
    controlledProviderExecutionTaskbookAudit.args,
    expectedTsxArgs([
      "scripts/run-controlled-provider-execution-taskbook-boundary-audit.ts"
    ])
  );
  assert.deepEqual(
    controlledProviderExecutionTaskbookReviewBoundaryAudit.args,
    expectedTsxArgs([
      "scripts/run-controlled-provider-execution-taskbook-review-boundary-audit.ts"
    ])
  );
  assert.deepEqual(
    providerExecutionRunnerAudit.args,
    expectedTsxArgs(["scripts/run-provider-execution-runner-boundary-audit.ts"])
  );
  assert.deepEqual(
    providerCorePrimitivesAudit.args,
    expectedTsxArgs(["scripts/run-provider-core-execution-primitives-boundary-audit.ts"])
  );
  assert.deepEqual(
    toolInvocationPlannerAudit.args,
    expectedTsxArgs(["scripts/run-tool-invocation-planner-boundary-audit.ts"])
  );
  assert.deepEqual(
    desktopAgentStrategyAudit.args,
    expectedTsxArgs(["scripts/run-desktop-agent-strategy-boundary-audit.ts"])
  );
  assert.deepEqual(
    desktopDecisionRunnerAudit.args,
    expectedTsxArgs(["scripts/run-desktop-decision-runner-boundary-audit.ts"])
  );
  assert.deepEqual(
    finalHostLocatorAudit.args,
    expectedTsxArgs(["scripts/run-final-host-locator-boundary-audit.ts"])
  );
  assert.deepEqual(
    hostDispatcherProviderAudit.args,
    expectedTsxArgs(["scripts/run-host-dispatcher-provider-boundary-audit.ts"])
  );
  assert.deepEqual(
    codexDesktopBridgeAudit.args,
    expectedTsxArgs(["scripts/run-codex-desktop-bridge-boundary-audit.ts"])
  );
  assert.deepEqual(
    codexDesktopLiveHostAudit.args,
    expectedTsxArgs(["scripts/run-codex-desktop-live-host-boundary-audit.ts"])
  );
  assert.deepEqual(
    codexMemoryMcpClientAudit.args,
    expectedTsxArgs(["scripts/run-codex-memory-mcp-client-boundary-audit.ts"])
  );
  assert.deepEqual(
    codexMemoryHostClientAudit.args,
    expectedTsxArgs(["scripts/run-codex-memory-host-client-boundary-audit.ts"])
  );
  assert.deepEqual(
    desktopHostClientAudit.args,
    expectedTsxArgs(["scripts/run-desktop-host-client-boundary-audit.ts"])
  );
  assert.deepEqual(
    desktopLiveAdapterDispatchAudit.args,
    expectedTsxArgs(["scripts/run-desktop-live-adapter-dispatch-boundary-audit.ts"])
  );
  assert.deepEqual(
    hostClientExampleAudit.args,
    expectedTsxArgs(["scripts/run-host-client-example-boundary-audit.ts"])
  );
  assert.deepEqual(
    targetHostEmbeddingAudit.args,
    expectedTsxArgs(["scripts/run-target-host-embedding-boundary-audit.ts"])
  );
  assert.deepEqual(
    codexCliHostAudit.args,
    expectedTsxArgs(["scripts/run-codex-cli-host-boundary-audit.ts"])
  );
  assert.deepEqual(
    hostExecutorAudit.args,
    expectedTsxArgs(["scripts/run-host-executor-boundary-audit.ts"])
  );
  assert.deepEqual(
    hostExecutorTaskbookAudit.args,
    expectedTsxArgs(["scripts/run-host-executor-taskbook-boundary-audit.ts"])
  );
  assert.deepEqual(
    hostClientExecutorReviewAudit.args,
    expectedTsxArgs(["scripts/run-host-client-executor-review-boundary-audit.ts"])
  );
  assert.deepEqual(
    hostExecutorReceiptAudit.args,
    expectedTsxArgs(["scripts/run-host-executor-receipt-boundary-audit.ts"])
  );
  assert.deepEqual(
    agentBackedRecoveryExecutorAudit.args,
    expectedTsxArgs(["scripts/run-agent-backed-recovery-executor-boundary-audit.ts"])
  );
  assert.deepEqual(
    agentExecutorAdapterTaskbookAudit.args,
    expectedTsxArgs(["scripts/run-agent-executor-adapter-taskbook-boundary-audit.ts"])
  );
  assert.deepEqual(
    agentExecutorAdapterReviewAudit.args,
    expectedTsxArgs(["scripts/run-agent-executor-adapter-review-boundary-audit.ts"])
  );
  assert.deepEqual(
    agentExecutorAdapterSandboxAudit.args,
    expectedTsxArgs(["scripts/run-agent-executor-adapter-sandbox-boundary-audit.ts"])
  );
  assert.deepEqual(
    agentTaskControlTaskbookAudit.args,
    expectedTsxArgs(["scripts/run-agent-task-control-taskbook-boundary-audit.ts"])
  );
  assert.deepEqual(
    agentTaskControlReviewAudit.args,
    expectedTsxArgs(["scripts/run-agent-task-control-review-boundary-audit.ts"])
  );
  assert.deepEqual(
    agentTaskControlAudit.args,
    expectedTsxArgs(["scripts/run-agent-task-control-sandbox-boundary-audit.ts"])
  );
  assert.deepEqual(
    subAgentRuntimeAudit.args,
    expectedTsxArgs(["scripts/run-sub-agent-runtime-boundary-audit.ts"])
  );
  assert.deepEqual(
    executionBoundarySurfaceAudit.args,
    expectedTsxArgs(["scripts/run-execution-boundary-current-surface-audit.ts"])
  );
  assert.deepEqual(
    acceptance.args,
    expectedTsxArgs(["scripts/run-readonly-control-chain-acceptance.ts"])
  );
  assert.deepEqual(
    operator.args,
    expectedTsxArgs(["scripts/run-codex-cli-operator-acceptance-readonly.ts"])
  );
  assert.deepEqual(
    archived.args,
    expectedTsxArgs(["scripts/run-future-codex-cli-canary-execution-gate-audit.ts"])
  );
  assert.deepEqual(
    archivedCapabilityTaxonomyEscalationPolicy.args,
    expectedTsxArgs([
      "scripts/run-capability-taxonomy-escalation-policy-audit.ts"
    ])
  );
  assert.deepEqual(
    archivedApprovalConsumptionDispatchMatrix.args,
    expectedTsxArgs([
      "scripts/run-approval-consumption-dispatch-matrix-audit.ts"
    ])
  );
  assert.deepEqual(
    archivedReadonlyProductization.args,
    expectedTsxArgs(["scripts/run-readonly-productization-acceptance.ts"])
  );
});

test("governance check runner avoids Windows command shims for tsx", () => {
  withPlatform("win32", () => {
    const daily = getValidationTierPlan("daily", {
      targetedTests: ["tests/governance-check.test.ts"]
    });
    const pr = getValidationTierPlan("pr");
    const audit = resolveGovernanceCheck("audit", "state-sync");
    const expectedNpmCommand = process.env.npm_execpath
      ? process.execPath
      : "npm.cmd";

    assert.equal(daily[0]?.command, expectedNpmCommand);
    assert.equal(daily[1]?.command, process.execPath);
    assert.deepEqual(daily[1]?.args, [
      "node_modules/tsx/dist/cli.mjs",
      "--test",
      "tests/governance-check.test.ts"
    ]);
    assert.equal(pr[0]?.command, expectedNpmCommand);
    assert.equal(pr[1]?.command, expectedNpmCommand);
    assert.equal(pr[2]?.command, expectedNpmCommand);
    assert.equal(pr[3]?.command, expectedNpmCommand);
    assert.equal(pr[4]?.command, process.execPath);
    assert.equal(audit.command, process.execPath);
    assert.deepEqual(audit.args, [
      "node_modules/tsx/dist/cli.mjs",
      "scripts/run-state-sync-audit.ts"
    ]);
  });
});

function withPlatform<T>(platform: NodeJS.Platform, callback: () => T): T {
  const originalDescriptor = Object.getOwnPropertyDescriptor(process, "platform");
  Object.defineProperty(process, "platform", {
    configurable: true,
    value: platform
  });

  try {
    return callback();
  } finally {
    if (originalDescriptor) {
      Object.defineProperty(process, "platform", originalDescriptor);
    }
  }
}

function expectedTsxArgs(args: string[]): string[] {
  return process.platform === "win32"
    ? ["node_modules/tsx/dist/cli.mjs", ...args]
    : args;
}
