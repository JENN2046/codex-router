#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  collectAgentTaskControlSandboxBoundaryAuditInput,
  reviewAgentTaskControlSandboxBoundaryAudit,
  type AgentTaskControlSandboxBoundaryAuditResult
} from "./run-agent-task-control-sandbox-boundary-audit.js";
import {
  collectStrategyRouterExecutionBoundaryAuditInput,
  reviewStrategyRouterExecutionBoundaryAudit,
  type StrategyRouterExecutionBoundaryAuditResult
} from "./run-strategy-router-execution-boundary-audit.js";
import {
  collectExecutionProfilesBoundaryAuditInput,
  reviewExecutionProfilesBoundaryAudit,
  type ExecutionProfilesBoundaryAuditResult
} from "./run-execution-profiles-boundary-audit.js";
import {
  collectPolicyConfigBoundaryAuditInput,
  reviewPolicyConfigBoundaryAudit,
  type PolicyConfigBoundaryAuditResult
} from "./run-policy-config-boundary-audit.js";
import {
  collectCapabilityTaxonomyBoundaryAuditInput,
  reviewCapabilityTaxonomyBoundaryAudit,
  type CapabilityTaxonomyBoundaryAuditResult
} from "./run-capability-taxonomy-boundary-audit.js";
import {
  collectCapabilityTaxonomyEscalationPolicyBoundaryAuditInput,
  reviewCapabilityTaxonomyEscalationPolicyBoundaryAudit,
  type CapabilityTaxonomyEscalationPolicyBoundaryAuditResult
} from "./run-capability-taxonomy-escalation-policy-boundary-audit.js";
import {
  collectRoutingEngineBoundaryAuditInput,
  reviewRoutingEngineBoundaryAudit,
  type RoutingEngineBoundaryAuditResult
} from "./run-routing-engine-boundary-audit.js";
import {
  collectRecoveryControlOrchestrationBoundaryAuditInput,
  reviewRecoveryControlOrchestrationBoundaryAudit,
  type RecoveryControlOrchestrationBoundaryAuditResult
} from "./run-recovery-control-orchestration-boundary-audit.js";
import {
  collectAgentTaskControlReviewBoundaryAuditInput,
  reviewAgentTaskControlReviewBoundaryAudit,
  type AgentTaskControlReviewBoundaryAuditResult
} from "./run-agent-task-control-review-boundary-audit.js";
import {
  collectAgentTaskControlTaskbookBoundaryAuditInput,
  reviewAgentTaskControlTaskbookBoundaryAudit,
  type AgentTaskControlTaskbookBoundaryAuditResult
} from "./run-agent-task-control-taskbook-boundary-audit.js";
import {
  collectAgentBackedRecoveryExecutorBoundaryAuditInput,
  reviewAgentBackedRecoveryExecutorBoundaryAudit,
  type AgentBackedRecoveryExecutorBoundaryAuditResult
} from "./run-agent-backed-recovery-executor-boundary-audit.js";
import {
  collectAgentExecutorAdapterTaskbookBoundaryAuditInput,
  reviewAgentExecutorAdapterTaskbookBoundaryAudit,
  type AgentExecutorAdapterTaskbookBoundaryAuditResult
} from "./run-agent-executor-adapter-taskbook-boundary-audit.js";
import {
  collectAgentExecutorAdapterReviewBoundaryAuditInput,
  reviewAgentExecutorAdapterReviewBoundaryAudit,
  type AgentExecutorAdapterReviewBoundaryAuditResult
} from "./run-agent-executor-adapter-review-boundary-audit.js";
import {
  collectAgentExecutorAdapterSandboxBoundaryAuditInput,
  reviewAgentExecutorAdapterSandboxBoundaryAudit,
  type AgentExecutorAdapterSandboxBoundaryAuditResult
} from "./run-agent-executor-adapter-sandbox-boundary-audit.js";
import {
  collectCodexProviderExecutionBoundaryAuditInput,
  reviewCodexProviderExecutionBoundaryAudit,
  type CodexProviderExecutionBoundaryAuditResult
} from "./run-codex-provider-execution-boundary-audit.js";
import {
  collectPreflightBoundaryAuditInput,
  reviewPreflightBoundaryAudit,
  type PreflightBoundaryAuditResult
} from "./run-preflight-boundary-audit.js";
import {
  collectApprovalPermitBoundaryAuditInput,
  reviewApprovalPermitBoundaryAudit,
  type ApprovalPermitBoundaryAuditResult
} from "./run-approval-permit-boundary-audit.js";
import {
  collectApprovalGateBoundaryAuditInput,
  reviewApprovalGateBoundaryAudit,
  type ApprovalGateBoundaryAuditResult
} from "./run-approval-gate-boundary-audit.js";
import {
  collectApprovalConsumptionDispatchBoundaryAuditInput,
  reviewApprovalConsumptionDispatchBoundaryAudit,
  type ApprovalConsumptionDispatchBoundaryAuditResult
} from "./run-approval-consumption-dispatch-boundary-audit.js";
import {
  collectApprovalConsumptionDispatchMatrixBoundaryAuditInput,
  reviewApprovalConsumptionDispatchMatrixBoundaryAudit,
  type ApprovalConsumptionDispatchMatrixBoundaryAuditResult
} from "./run-approval-consumption-dispatch-matrix-boundary-audit.js";
import {
  collectReadonlyProductizationBoundaryAuditInput,
  reviewReadonlyProductizationBoundaryAudit,
  type ReadonlyProductizationBoundaryAuditResult
} from "./run-readonly-productization-boundary-audit.js";
import {
  collectStateSyncBoundaryAuditInput,
  reviewStateSyncBoundaryAudit,
  type StateSyncBoundaryAuditResult
} from "./run-state-sync-boundary-audit.js";
import {
  collectWorkspaceWriteReleaseGateAuditInput,
  reviewWorkspaceWriteReleaseGateAudit,
  type WorkspaceWriteReleaseGateAuditResult
} from "./run-workspace-write-release-gate-audit.js";
import {
  collectAdmissionControlBoundaryAuditInput,
  reviewAdmissionControlBoundaryAudit,
  type AdmissionControlBoundaryAuditResult
} from "./run-admission-control-boundary-audit.js";
import {
  collectDelegationPolicyBoundaryAuditInput,
  reviewDelegationPolicyBoundaryAudit,
  type DelegationPolicyBoundaryAuditResult
} from "./run-delegation-policy-boundary-audit.js";
import {
  collectExecutionEligibilityBoundaryAuditInput,
  reviewExecutionEligibilityBoundaryAudit,
  type ExecutionEligibilityBoundaryAuditResult
} from "./run-execution-eligibility-boundary-audit.js";
import {
  collectExecutionObservationBoundaryAuditInput,
  reviewExecutionObservationBoundaryAudit,
  type ExecutionObservationBoundaryAuditResult
} from "./run-execution-observation-boundary-audit.js";
import {
  collectGovernanceFailureReducerBoundaryAuditInput,
  reviewGovernanceFailureReducerBoundaryAudit,
  type GovernanceFailureReducerBoundaryAuditResult
} from "./run-governance-failure-reducer-boundary-audit.js";
import {
  collectRuntimeControlBoundaryAuditInput,
  reviewRuntimeControlBoundaryAudit,
  type RuntimeControlBoundaryAuditResult
} from "./run-runtime-control-boundary-audit.js";
import {
  collectTaskGraphBoundaryAuditInput,
  reviewTaskGraphBoundaryAudit,
  type TaskGraphBoundaryAuditResult
} from "./run-task-graph-boundary-audit.js";
import {
  collectSchedulerBoundaryAuditInput,
  reviewSchedulerBoundaryAudit,
  type SchedulerBoundaryAuditResult
} from "./run-scheduler-boundary-audit.js";
import {
  collectExecutionPlannerBoundaryAuditInput,
  reviewExecutionPlannerBoundaryAudit,
  type ExecutionPlannerBoundaryAuditResult
} from "./run-execution-planner-boundary-audit.js";
import {
  collectProviderRegistryBoundaryAuditInput,
  reviewProviderRegistryBoundaryAudit,
  type ProviderRegistryBoundaryAuditResult
} from "./run-provider-registry-boundary-audit.js";
import {
  collectControlledProviderExecutionTaskbookBoundaryAuditInput,
  reviewControlledProviderExecutionTaskbookBoundaryAudit,
  type ControlledProviderExecutionTaskbookBoundaryAuditResult
} from "./run-controlled-provider-execution-taskbook-boundary-audit.js";
import {
  collectControlledProviderExecutionTaskbookReviewBoundaryAuditInput,
  reviewControlledProviderExecutionTaskbookReviewBoundaryAudit,
  type ControlledProviderExecutionTaskbookReviewBoundaryAuditResult
} from "./run-controlled-provider-execution-taskbook-review-boundary-audit.js";
import {
  collectControlledProviderExecutionDispatchPreflightBoundaryAuditInput,
  reviewControlledProviderExecutionDispatchPreflightBoundaryAudit,
  type ControlledProviderExecutionDispatchPreflightBoundaryAuditResult
} from "./run-controlled-provider-execution-dispatch-preflight-boundary-audit.js";
import {
  collectControlledProviderExecutionDispatcherBoundaryAuditInput,
  reviewControlledProviderExecutionDispatcherBoundaryAudit,
  type ControlledProviderExecutionDispatcherBoundaryAuditResult
} from "./run-controlled-provider-execution-dispatcher-boundary-audit.js";
import {
  collectCodexCliHostBoundaryAuditInput,
  reviewCodexCliHostBoundaryAudit,
  type CodexCliHostBoundaryAuditResult
} from "./run-codex-cli-host-boundary-audit.js";
import {
  collectPublicApiExecutionBoundaryAuditInput,
  reviewPublicApiExecutionBoundaryAudit,
  type PublicApiExecutionBoundaryAuditResult
} from "./run-public-api-execution-boundary-audit.js";
import {
  collectAgentOsLocalRuntimeBoundaryAuditInput,
  reviewAgentOsLocalRuntimeBoundaryAudit,
  type AgentOsLocalRuntimeBoundaryAuditResult
} from "./run-agent-os-local-runtime-boundary-audit.js";
import {
  collectAgentOsMcpServerManifestBoundaryAuditInput,
  reviewAgentOsMcpServerManifestBoundaryAudit,
  type AgentOsMcpServerManifestBoundaryAuditResult
} from "./run-agent-os-mcp-server-manifest-boundary-audit.js";
import {
  collectProtocolMcpProviderSkeletonBoundaryAuditInput,
  reviewProtocolMcpProviderSkeletonBoundaryAudit,
  type ProtocolMcpProviderSkeletonBoundaryAuditResult
} from "./run-protocol-mcp-provider-skeleton-boundary-audit.js";
import {
  collectProtocolA2aRemoteProviderSkeletonBoundaryAuditInput,
  reviewProtocolA2aRemoteProviderSkeletonBoundaryAudit,
  type ProtocolA2aRemoteProviderSkeletonBoundaryAuditResult
} from "./run-protocol-a2a-remote-provider-skeleton-boundary-audit.js";
import {
  collectAgentOsSdkBoundaryAuditInput,
  reviewAgentOsSdkBoundaryAudit,
  type AgentOsSdkBoundaryAuditResult
} from "./run-agent-os-sdk-boundary-audit.js";
import {
  collectAgentOsCliBoundaryAuditInput,
  reviewAgentOsCliBoundaryAudit,
  type AgentOsCliBoundaryAuditResult
} from "./run-agent-os-cli-boundary-audit.js";
import {
  collectAgentOsAppServerBoundaryAuditInput,
  reviewAgentOsAppServerBoundaryAudit,
  type AgentOsAppServerBoundaryAuditResult
} from "./run-agent-os-app-server-boundary-audit.js";
import {
  collectAgentOsPublicSurfacesBoundaryAuditInput,
  reviewAgentOsPublicSurfacesBoundaryAudit,
  type AgentOsPublicSurfacesBoundaryAuditResult
} from "./run-agent-os-public-surfaces-boundary-audit.js";
import {
  collectProviderExecutionRunnerBoundaryAuditInput,
  reviewProviderExecutionRunnerBoundaryAudit,
  type ProviderExecutionRunnerBoundaryAuditResult
} from "./run-provider-execution-runner-boundary-audit.js";
import {
  collectProviderCoreExecutionPrimitivesBoundaryAuditInput,
  reviewProviderCoreExecutionPrimitivesBoundaryAudit,
  type ProviderCoreExecutionPrimitivesBoundaryAuditResult
} from "./run-provider-core-execution-primitives-boundary-audit.js";
import {
  collectToolInvocationPlannerBoundaryAuditInput,
  reviewToolInvocationPlannerBoundaryAudit,
  type ToolInvocationPlannerBoundaryAuditResult
} from "./run-tool-invocation-planner-boundary-audit.js";
import {
  collectDesktopAgentStrategyBoundaryAuditInput,
  reviewDesktopAgentStrategyBoundaryAudit,
  type DesktopAgentStrategyBoundaryAuditResult
} from "./run-desktop-agent-strategy-boundary-audit.js";
import {
  collectDesktopDecisionRunnerBoundaryAuditInput,
  reviewDesktopDecisionRunnerBoundaryAudit,
  type DesktopDecisionRunnerBoundaryAuditResult
} from "./run-desktop-decision-runner-boundary-audit.js";
import {
  collectFinalHostLocatorBoundaryAuditInput,
  reviewFinalHostLocatorBoundaryAudit,
  type FinalHostLocatorBoundaryAuditResult
} from "./run-final-host-locator-boundary-audit.js";
import {
  collectHostDispatcherProviderBoundaryAuditInput,
  reviewHostDispatcherProviderBoundaryAudit,
  type HostDispatcherProviderBoundaryAuditResult
} from "./run-host-dispatcher-provider-boundary-audit.js";
import {
  collectCodexDesktopBridgeBoundaryAuditInput,
  reviewCodexDesktopBridgeBoundaryAudit,
  type CodexDesktopBridgeBoundaryAuditResult
} from "./run-codex-desktop-bridge-boundary-audit.js";
import {
  collectCodexDesktopLiveHostBoundaryAuditInput,
  reviewCodexDesktopLiveHostBoundaryAudit,
  type CodexDesktopLiveHostBoundaryAuditResult
} from "./run-codex-desktop-live-host-boundary-audit.js";
import {
  collectCodexMemoryMcpClientBoundaryAuditInput,
  reviewCodexMemoryMcpClientBoundaryAudit,
  type CodexMemoryMcpClientBoundaryAuditResult
} from "./run-codex-memory-mcp-client-boundary-audit.js";
import {
  collectCodexMemoryHostClientBoundaryAuditInput,
  reviewCodexMemoryHostClientBoundaryAudit,
  type CodexMemoryHostClientBoundaryAuditResult
} from "./run-codex-memory-host-client-boundary-audit.js";
import {
  collectDesktopHostClientBoundaryAuditInput,
  reviewDesktopHostClientBoundaryAudit,
  type DesktopHostClientBoundaryAuditResult
} from "./run-desktop-host-client-boundary-audit.js";
import {
  collectDesktopLiveAdapterDispatchBoundaryAuditInput,
  reviewDesktopLiveAdapterDispatchBoundaryAudit,
  type DesktopLiveAdapterDispatchBoundaryAuditResult
} from "./run-desktop-live-adapter-dispatch-boundary-audit.js";
import {
  collectHostClientExampleBoundaryAuditInput,
  reviewHostClientExampleBoundaryAudit,
  type HostClientExampleBoundaryAuditResult
} from "./run-host-client-example-boundary-audit.js";
import {
  collectTargetHostEmbeddingBoundaryAuditInput,
  reviewTargetHostEmbeddingBoundaryAudit,
  type TargetHostEmbeddingBoundaryAuditResult
} from "./run-target-host-embedding-boundary-audit.js";
import {
  collectOperatorActionExecutorGateBoundaryAuditInput,
  reviewOperatorActionExecutorGateBoundaryAudit,
  type OperatorActionExecutorGateBoundaryAuditResult
} from "./run-operator-action-executor-gate-boundary-audit.js";
import {
  collectHostExecutorBoundaryAuditInput,
  reviewHostExecutorBoundaryAudit,
  type HostExecutorBoundaryAuditResult
} from "./run-host-executor-boundary-audit.js";
import {
  collectHostExecutorTaskbookBoundaryAuditInput,
  reviewHostExecutorTaskbookBoundaryAudit,
  type HostExecutorTaskbookBoundaryAuditResult
} from "./run-host-executor-taskbook-boundary-audit.js";
import {
  collectHostClientExecutorReviewBoundaryAuditInput,
  reviewHostClientExecutorReviewBoundaryAudit,
  type HostClientExecutorReviewBoundaryAuditResult
} from "./run-host-client-executor-review-boundary-audit.js";
import {
  collectHostExecutorReceiptBoundaryAuditInput,
  reviewHostExecutorReceiptBoundaryAudit,
  type HostExecutorReceiptBoundaryAuditResult
} from "./run-host-executor-receipt-boundary-audit.js";
import {
  collectSubAgentRuntimeBoundaryAuditInput,
  reviewSubAgentRuntimeBoundaryAudit,
  type SubAgentRuntimeBoundaryAuditResult
} from "./run-sub-agent-runtime-boundary-audit.js";

const GOVERNANCE_CONTROL_PLANE = "docs/governance/GOVERNANCE_CONTROL_PLANE.md";
const GOVERNANCE_README = "docs/governance/README.md";
const GOVERNANCE_VALIDATION_TIERS = "docs/validation-tiers.md";
const CURRENT_STATE = "docs/current/CURRENT_STATE.md";
const GOVERNANCE_RUNNER = "scripts/run-governance-check.ts";
const CI_WORKFLOW = ".github/workflows/ci.yml";

const REQUIRED_CURRENT_AUDITS = [
  "strategy-router-execution-boundary",
  "execution-profiles-boundary",
  "policy-config-boundary",
  "capability-taxonomy-boundary",
  "capability-taxonomy-escalation-policy-boundary",
  "routing-engine-boundary",
  "recovery-control-orchestration-boundary",
  "runtime-control-boundary",
  "operator-action-executor-gate-boundary",
  "codex-cli-host-boundary",
  "public-api-execution-boundary",
  "agent-os-local-runtime-boundary",
  "agent-os-mcp-server-manifest-boundary",
  "protocol-mcp-provider-skeleton-boundary",
  "protocol-a2a-remote-provider-skeleton-boundary",
  "agent-os-sdk-boundary",
  "agent-os-cli-boundary",
  "agent-os-app-server-boundary",
  "agent-os-public-surfaces-boundary",
  "codex-provider-execution-boundary",
  "preflight-boundary",
  "approval-permit-boundary",
  "approval-gate-boundary",
  "approval-consumption-dispatch-matrix-boundary",
  "approval-consumption-dispatch-boundary",
  "readonly-productization-boundary",
  "state-sync-boundary",
  "workspace-write-release-gate",
  "admission-control-boundary",
  "delegation-policy-boundary",
  "execution-eligibility-boundary",
  "execution-observation-boundary",
  "governance-failure-reducer-boundary",
  "task-graph-boundary",
  "scheduler-boundary",
  "execution-planner-boundary",
  "provider-registry-boundary",
  "controlled-provider-execution-taskbook-boundary",
  "controlled-provider-execution-taskbook-review-boundary",
  "controlled-provider-execution-dispatch-preflight-boundary",
  "controlled-provider-execution-dispatcher-boundary",
  "provider-execution-runner-boundary",
  "provider-core-execution-primitives-boundary",
  "tool-invocation-planner-boundary",
  "desktop-agent-strategy-boundary",
  "desktop-decision-runner-boundary",
  "final-host-locator-boundary",
  "host-dispatcher-provider-boundary",
  "codex-desktop-bridge-boundary",
  "codex-desktop-live-host-boundary",
  "codex-memory-mcp-client-boundary",
  "codex-memory-host-client-boundary",
  "desktop-host-client-boundary",
  "desktop-live-adapter-dispatch-boundary",
  "host-client-example-boundary",
  "target-host-embedding-boundary",
  "host-executor-boundary",
  "host-executor-taskbook-boundary",
  "host-client-executor-review-boundary",
  "host-executor-receipt-boundary",
  "agent-backed-recovery-executor-boundary",
  "agent-executor-adapter-taskbook-boundary",
  "agent-executor-adapter-review-boundary",
  "agent-executor-adapter-sandbox-boundary",
  "agent-task-control-taskbook-boundary",
  "agent-task-control-review-boundary",
  "sub-agent-runtime-boundary",
  "agent-task-control-sandbox-boundary"
] as const;

const FORBIDDEN_OUTPUT_MARKERS = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
] as const;

export interface ExecutionBoundaryCurrentSurfaceAuditInput {
  governanceControlPlaneText: string;
  governanceReadmeText: string;
  governanceValidationTiersText: string;
  currentStateText: string;
  governanceRunnerText: string;
  ciWorkflowText: string;
  strategyRouterReview: StrategyRouterExecutionBoundaryAuditResult;
  executionProfilesReview: ExecutionProfilesBoundaryAuditResult;
  policyConfigReview: PolicyConfigBoundaryAuditResult;
  capabilityTaxonomyReview: CapabilityTaxonomyBoundaryAuditResult;
  capabilityTaxonomyEscalationPolicyReview: CapabilityTaxonomyEscalationPolicyBoundaryAuditResult;
  routingEngineReview: RoutingEngineBoundaryAuditResult;
  recoveryControlReview: RecoveryControlOrchestrationBoundaryAuditResult;
  runtimeControlReview: RuntimeControlBoundaryAuditResult;
  operatorActionExecutorGateReview: OperatorActionExecutorGateBoundaryAuditResult;
  codexCliHostReview: CodexCliHostBoundaryAuditResult;
  publicApiReview: PublicApiExecutionBoundaryAuditResult;
  agentOsLocalRuntimeReview: AgentOsLocalRuntimeBoundaryAuditResult;
  agentOsMcpServerManifestReview: AgentOsMcpServerManifestBoundaryAuditResult;
  protocolMcpProviderSkeletonReview: ProtocolMcpProviderSkeletonBoundaryAuditResult;
  protocolA2aRemoteProviderSkeletonReview: ProtocolA2aRemoteProviderSkeletonBoundaryAuditResult;
  agentOsSdkReview: AgentOsSdkBoundaryAuditResult;
  agentOsCliReview: AgentOsCliBoundaryAuditResult;
  agentOsAppServerReview: AgentOsAppServerBoundaryAuditResult;
  agentOsPublicSurfacesReview: AgentOsPublicSurfacesBoundaryAuditResult;
  codexProviderReview: CodexProviderExecutionBoundaryAuditResult;
  preflightReview: PreflightBoundaryAuditResult;
  approvalPermitReview: ApprovalPermitBoundaryAuditResult;
  approvalGateReview: ApprovalGateBoundaryAuditResult;
  approvalConsumptionDispatchMatrixReview: ApprovalConsumptionDispatchMatrixBoundaryAuditResult;
  approvalConsumptionDispatchReview: ApprovalConsumptionDispatchBoundaryAuditResult;
  readonlyProductizationReview: ReadonlyProductizationBoundaryAuditResult;
  stateSyncReview: StateSyncBoundaryAuditResult;
  workspaceWriteReleaseGateReview: WorkspaceWriteReleaseGateAuditResult;
  admissionControlReview: AdmissionControlBoundaryAuditResult;
  delegationPolicyReview: DelegationPolicyBoundaryAuditResult;
  executionEligibilityReview: ExecutionEligibilityBoundaryAuditResult;
  executionObservationReview: ExecutionObservationBoundaryAuditResult;
  governanceFailureReducerReview: GovernanceFailureReducerBoundaryAuditResult;
  taskGraphReview: TaskGraphBoundaryAuditResult;
  schedulerReview: SchedulerBoundaryAuditResult;
  executionPlannerReview: ExecutionPlannerBoundaryAuditResult;
  providerRegistryReview: ProviderRegistryBoundaryAuditResult;
  controlledProviderExecutionTaskbookReview: ControlledProviderExecutionTaskbookBoundaryAuditResult;
  controlledProviderExecutionTaskbookReviewBoundaryReview: ControlledProviderExecutionTaskbookReviewBoundaryAuditResult;
  controlledProviderExecutionDispatchPreflightReview: ControlledProviderExecutionDispatchPreflightBoundaryAuditResult;
  controlledProviderExecutionDispatcherReview: ControlledProviderExecutionDispatcherBoundaryAuditResult;
  providerExecutionRunnerReview: ProviderExecutionRunnerBoundaryAuditResult;
  providerCorePrimitivesReview: ProviderCoreExecutionPrimitivesBoundaryAuditResult;
  toolInvocationPlannerReview: ToolInvocationPlannerBoundaryAuditResult;
  desktopAgentStrategyReview: DesktopAgentStrategyBoundaryAuditResult;
  desktopDecisionRunnerReview: DesktopDecisionRunnerBoundaryAuditResult;
  finalHostLocatorReview: FinalHostLocatorBoundaryAuditResult;
  hostDispatcherProviderReview: HostDispatcherProviderBoundaryAuditResult;
  codexDesktopBridgeReview: CodexDesktopBridgeBoundaryAuditResult;
  codexDesktopLiveHostReview: CodexDesktopLiveHostBoundaryAuditResult;
  codexMemoryMcpClientReview: CodexMemoryMcpClientBoundaryAuditResult;
  codexMemoryHostClientReview: CodexMemoryHostClientBoundaryAuditResult;
  desktopHostClientReview: DesktopHostClientBoundaryAuditResult;
  desktopLiveAdapterDispatchReview: DesktopLiveAdapterDispatchBoundaryAuditResult;
  hostClientExampleReview: HostClientExampleBoundaryAuditResult;
  targetHostEmbeddingReview: TargetHostEmbeddingBoundaryAuditResult;
  hostExecutorReview: HostExecutorBoundaryAuditResult;
  hostExecutorTaskbookReview: HostExecutorTaskbookBoundaryAuditResult;
  hostClientExecutorReviewReview: HostClientExecutorReviewBoundaryAuditResult;
  hostExecutorReceiptReview: HostExecutorReceiptBoundaryAuditResult;
  agentBackedRecoveryExecutorReview: AgentBackedRecoveryExecutorBoundaryAuditResult;
  agentExecutorAdapterTaskbookReview: AgentExecutorAdapterTaskbookBoundaryAuditResult;
  agentExecutorAdapterReviewReview: AgentExecutorAdapterReviewBoundaryAuditResult;
  agentExecutorAdapterSandboxReview: AgentExecutorAdapterSandboxBoundaryAuditResult;
  agentTaskControlTaskbookReview: AgentTaskControlTaskbookBoundaryAuditResult;
  agentTaskControlReviewReview: AgentTaskControlReviewBoundaryAuditResult;
  subAgentRuntimeReview: SubAgentRuntimeBoundaryAuditResult;
  agentTaskControlReview: AgentTaskControlSandboxBoundaryAuditResult;
}

export interface ExecutionBoundaryCurrentSurfaceAuditResult {
  status: "passed" | "blocked";
  checks: {
    allComponentAuditsPassed: boolean;
    governanceRunnerRegistersAllCurrentAudits: boolean;
    governanceReadmeListsAllCurrentAudits: boolean;
    controlPlaneRecordsAllBoundaries: boolean;
    entryDocsRecordExecutionAuthorityLattice: boolean;
    currentStateRecordsExecutionAuthorityLattice: boolean;
    ciWorkflowRunsCurrentSurfaceGate: boolean;
    strategyRouterBoundaryConstrained: boolean;
    executionProfilesBoundaryConstrained: boolean;
    policyConfigBoundaryConstrained: boolean;
    capabilityTaxonomyBoundaryConstrained: boolean;
    capabilityTaxonomyEscalationPolicyBoundaryConstrained: boolean;
    routingEngineBoundaryConstrained: boolean;
    recoveryControlBoundaryConstrained: boolean;
    runtimeControlBoundaryConstrained: boolean;
    operatorActionExecutorGateBoundaryConstrained: boolean;
    codexCliHostBoundaryConstrained: boolean;
    publicApiBoundaryConstrained: boolean;
    agentOsLocalRuntimeBoundaryConstrained: boolean;
    agentOsMcpServerManifestBoundaryConstrained: boolean;
    protocolMcpProviderSkeletonBoundaryConstrained: boolean;
    protocolA2aRemoteProviderSkeletonBoundaryConstrained: boolean;
    agentOsSdkBoundaryConstrained: boolean;
    agentOsCliBoundaryConstrained: boolean;
    agentOsAppServerBoundaryConstrained: boolean;
    agentOsPublicSurfacesBoundaryConstrained: boolean;
    codexProviderBoundaryConstrained: boolean;
    preflightBoundaryConstrained: boolean;
    approvalPermitBoundaryConstrained: boolean;
    approvalGateBoundaryConstrained: boolean;
    approvalConsumptionDispatchMatrixBoundaryConstrained: boolean;
    approvalConsumptionDispatchBoundaryConstrained: boolean;
    readonlyProductizationBoundaryConstrained: boolean;
    stateSyncBoundaryConstrained: boolean;
    workspaceWriteReleaseGateBoundaryConstrained: boolean;
    admissionControlBoundaryConstrained: boolean;
    delegationPolicyBoundaryConstrained: boolean;
    executionEligibilityBoundaryConstrained: boolean;
    executionObservationBoundaryConstrained: boolean;
    governanceFailureReducerBoundaryConstrained: boolean;
    taskGraphBoundaryConstrained: boolean;
    schedulerBoundaryConstrained: boolean;
    executionPlannerBoundaryConstrained: boolean;
    providerRegistryBoundaryConstrained: boolean;
    controlledProviderExecutionTaskbookBoundaryConstrained: boolean;
    controlledProviderExecutionTaskbookReviewBoundaryConstrained: boolean;
    controlledProviderExecutionDispatchPreflightBoundaryConstrained: boolean;
    controlledProviderExecutionDispatcherBoundaryConstrained: boolean;
    providerExecutionRunnerBoundaryConstrained: boolean;
    providerCorePrimitivesBoundaryConstrained: boolean;
    toolInvocationPlannerBoundaryConstrained: boolean;
    desktopAgentStrategyBoundaryConstrained: boolean;
    desktopDecisionRunnerBoundaryConstrained: boolean;
    finalHostLocatorBoundaryConstrained: boolean;
    hostDispatcherProviderBoundaryConstrained: boolean;
    codexDesktopBridgeBoundaryConstrained: boolean;
    codexDesktopLiveHostBoundaryConstrained: boolean;
    codexMemoryMcpClientBoundaryConstrained: boolean;
    codexMemoryHostClientBoundaryConstrained: boolean;
    desktopHostClientBoundaryConstrained: boolean;
    desktopLiveAdapterDispatchBoundaryConstrained: boolean;
    hostClientExampleBoundaryConstrained: boolean;
    targetHostEmbeddingBoundaryConstrained: boolean;
    hostExecutorBoundaryConstrained: boolean;
    hostExecutorTaskbookBoundaryConstrained: boolean;
    hostClientExecutorReviewBoundaryConstrained: boolean;
    hostExecutorReceiptBoundaryConstrained: boolean;
    agentBackedRecoveryExecutorBoundaryConstrained: boolean;
    agentExecutorAdapterTaskbookBoundaryConstrained: boolean;
    agentExecutorAdapterReviewBoundaryConstrained: boolean;
    agentExecutorAdapterSandboxBoundaryConstrained: boolean;
    agentTaskControlTaskbookBoundaryConstrained: boolean;
    agentTaskControlReviewBoundaryConstrained: boolean;
    subAgentRuntimeBoundaryConstrained: boolean;
    agentTaskControlBoundaryConstrained: boolean;
    noCrossBoundaryExecutionBroadening: boolean;
    executionAuthorityLatticeConstrained: boolean;
    auditItselfIsNonExecuting: boolean;
    outputSanitized: boolean;
  };
  summary: {
    currentAudits: typeof REQUIRED_CURRENT_AUDITS;
    executionAuthorityLatticeMode:
      "narrow_readonly_provider_dispatch_without_boundary_inheritance";
    codexCliHostDoesNotAuthorizeHostExecutorOrSubAgentRuntime: boolean;
    subAgentRuntimeDoesNotInvokeCodexCliOrProviderExecution: boolean;
    hostExecutorDoesNotExecuteProviderOrSubAgentRuntime: boolean;
    strategyRouterMode: "advisory_budget_signal_only";
    executionProfilesMode: "profile_templates_only";
    policyConfigMode: "policy_schema_and_signal_resolution_only";
    capabilityTaxonomyMode: "capability_classification_and_escalation_policy_only";
    capabilityTaxonomyEscalationPolicyMode: "capability_escalation_policy_only";
    routingEngineMode: "routing_decision_and_provider_grant_only";
    recoveryControlMode: "schemas_packets_reviews_and_explicit_injected_witnesses_only";
    runtimeControlMode: "runtime_signal_and_escalation_outcome_only";
    operatorActionExecutorGateMode: "plan_only";
    codexCliHostMode: "explicit_codex_cli_host_execution_surface";
    publicApiMode: "named_governance_subpaths_only";
    agentOsLocalRuntimeMode: "local_state_and_provider_plan_runtime";
    agentOsMcpServerManifestMode: "manifest_only_no_runtime";
    protocolMcpProviderSkeletonMode: "protocol_mapping_and_disabled_provider_skeleton_only";
    protocolA2aRemoteProviderSkeletonMode: "agent_card_task_artifact_mapping_and_disabled_remote_provider_skeleton_only";
    agentOsSdkMode: "sdk_method_to_local_mcp_runtime_only";
    agentOsCliMode: "argv_parsing_to_local_mcp_runtime_only";
    agentOsAppServerMode: "http_like_request_routing_to_local_mcp_runtime_only";
    agentOsPublicSurfacesMode: "public_surface_to_local_mcp_runtime_only";
    codexProviderMode: "controlled-read-only";
    preflightMode: "pre_execution_signal_evaluation_only";
    approvalPermitMode: "permit_creation_validation_revocation_and_store_only";
    approvalGateMode: "approval_requirement_evaluation_only";
    approvalConsumptionDispatchMatrixBoundaryMode: "git_state_and_artifact_matrix_gate_only";
    approvalConsumptionDispatchMode: "approval_consumption_dispatch_matrix_only";
    readonlyProductizationBoundaryMode:
      "local_readonly_productization_acceptance_gate_only";
    stateSyncBoundaryMode: "state_consistency_observation_gate_only";
    workspaceWriteReleaseGateMode: "promotion_review_gate_only";
    admissionControlMode: "admission_status_and_requirement_derivation_only";
    delegationPolicyMode: "delegation_level_approval_requirement_and_recovery_filter_only";
    executionEligibilityMode: "admission_capability_permit_decision_only";
    executionObservationMode: "sanitized_task_scoped_observation_record_only";
    governanceFailureReducerMode: "pure_failure_to_governance_state_reducer_only";
    taskGraphMode: "structural_task_graph_state_only";
    schedulerMode: "queue_and_execution_lease_state_machine_only";
    executionPlannerMode: "provider_execution_plan_only";
    providerRegistryMode: "catalog_selection_attestation_and_manifest_store_only";
    controlledProviderExecutionTaskbookMode: "local_only_minimal_slice_taskbook";
    controlledProviderExecutionTaskbookReviewBoundaryMode: "git_state_and_artifact_review_gate_only";
    controlledProviderExecutionDispatchPreflightMode: "controlled_readonly_and_workspace_write_dispatch_preflight_matrix_only";
    controlledProviderExecutionDispatcherMode: "controlled_readonly_and_workspace_write_pre_runner_dispatcher";
    providerExecutionRunnerMode: "controlled_readonly_and_workspace_write_gate";
    providerCorePrimitiveMode: "manifest_permit_plan_only";
    toolInvocationPlannerMode: "tool_manifest_and_invocation_plan_only";
    desktopAgentStrategyMode: "agent_assignment_and_ownership_plan_only";
    desktopDecisionRunnerMode: "decision_package_only";
    finalHostLocatorMode: "source_candidate_pre_mapping_only";
    hostDispatcherProviderMode: "controlled_read_only_and_workspace_write_provider_dispatch";
    codexDesktopBridgeMode: "explicit_injected_desktop_host_bridge";
    codexDesktopLiveHostMode: "explicit_current_host_runtime_and_memory_bundle";
    codexMemoryMcpClientMode: "explicit_mcp_http_memory_transport_only";
    codexMemoryHostClientMode: "explicit_injected_memory_operations_only";
    desktopHostClientMode: "desktop_host_client_facade";
    desktopLiveAdapterDispatchMode: "route_separated_host_dispatch_or_desktop_bridge";
    hostClientExampleMode: "example_host_client_facade";
    targetHostEmbeddingMode: "explicit_target_host_contract_and_starter_only";
    strategyRouterExecuteActionFamilyIsAuthorization: false;
    strategyRouterWriteExecutionPredicateIsAuthorization: false;
    strategyRouterExecutorBudgetIsRuntimeInvocation: false;
    executionProfilesProfileStageIsRuntimeStep: false;
    executionProfilesDefaultRoleIsSubAgentRuntimeAuthorization: false;
    executionProfilesDefaultToolAccessIsToolRuntimeAuthorization: false;
    executionProfilesEngineeringWriteToolAccessIsWorkspaceWriteExecution: false;
    executionProfilesProtectedRemoteToolAccessIsExternalWriteAuthorization: false;
    executionProfilesAllowParallelIsSubAgentRuntimeAuthorization: false;
    executionProfilesMaxParallelAgentsIsSubAgentSpawnAuthorization: false;
    executionProfilesReleaseGovernanceProfileIsProtectedRemoteAuthorization: false;
    executionProfilesProfileSelectionIsProviderExecutionAuthorization: false;
    policyConfigHostRouteIsHostDispatchAuthorization: false;
    policyConfigCodexCliHostRouteIsCodexCliInvocation: false;
    policyConfigDesktopHostRouteIsDesktopRuntimeInvocation: false;
    policyConfigToolPolicyIsToolRuntimeAuthorization: false;
    policyConfigProtectedRemoteToolPolicyIsExternalWriteAuthorization: false;
    policyConfigApprovalRuleIsApprovalGrant: false;
    policyConfigMemoryHealthBlockIsRuntimeBlockExecution: false;
    policyConfigMemoryGuidanceIsSubAgentRuntimeAuthorization: false;
    policyConfigTelemetryThresholdIsRuntimeAuthorization: false;
    policyConfigTelemetryDeliveryWindowIsHostExecutorAuthorization: false;
    capabilityTaxonomyBoundedWorkspaceWriteCanaryIsWorkspaceWriteAuthorization: false;
    capabilityTaxonomyBoundedWorkspaceWriteReceiptIsExecutionAuthorization: false;
    capabilityTaxonomyScopedWorkspaceWriteClassIsWorkspaceWriteExecution: false;
    capabilityTaxonomyGeneralWorkspaceWriteClassIsExecutionAuthorization: false;
    capabilityTaxonomyGeneralProviderExecutionClassIsProviderExecuteAuthorization: false;
    capabilityTaxonomyExternalWriteClassIsExternalWriteAuthorization: false;
    capabilityTaxonomyReleaseOrDeployClassIsReleaseAuthorization: false;
    capabilityTaxonomySecretCredentialChangeClassIsSecretAccessAuthorization: false;
    capabilityTaxonomyEscalationPolicyIsRuntimeAuthorization: false;
    capabilityTaxonomyCanaryEvidenceBaselineIsExecutionAuthorization: false;
    capabilityTaxonomyEscalationPolicyIsProviderExecuteAuthorization: false;
    capabilityTaxonomyEscalationPolicyIsCodexCliAuthorization: false;
    capabilityTaxonomyEscalationPolicyIsWorkspaceWriteAuthorization: false;
    capabilityTaxonomyEscalationPolicyIsHostExecutorAuthorization: false;
    capabilityTaxonomyEscalationPolicyIsSubAgentRuntimeAuthorization: false;
    capabilityTaxonomyEscalationPolicyIsToolRuntimeAuthorization: false;
    capabilityTaxonomyEscalationPolicyIsExternalWriteAuthorization: false;
    capabilityTaxonomyEscalationPolicyIsReleaseAuthorization: false;
    capabilityTaxonomyEscalationPolicyIsSecretAccessAuthorization: false;
    capabilityTaxonomyEscalationPolicyBlockedCapabilityClassIsRuntimeBlockExecution: false;
    capabilityTaxonomyEscalationPolicySeverityIsRuntimeAuthorization: false;
    capabilityTaxonomyEscalationPolicyStatusIsExecutionAuthorization: false;
    routingEngineDecisionIsExecutionAuthorization: false;
    routingEngineHostRouteIsHostDispatchAuthorization: false;
    routingEngineProviderGrantIsProviderExecuteAuthorization: false;
    routingEngineCodexCliProviderIdIsCodexCliInvocation: false;
    routingEngineDesktopProviderIdIsDesktopRuntimeInvocation: false;
    routingEngineSandboxModeIsWorkspaceWriteExecution: false;
    routingEngineToolAccessIsToolRuntimeAuthorization: false;
    routingEngineApprovalRequiredIsApprovalGrant: false;
    routingEngineRiskScoreIsRuntimeAuthorization: false;
    routingEngineParallelismAllowedIsSubAgentRuntimeAuthorization: false;
    recoveryControlSchemaStatusIsExecutionAuthorization: false;
    recoveryControlExecutionPlanIsRecoveryExecutionAuthorization: false;
    recoveryControlExecutionGateIsRuntimeAuthorization: false;
    recoveryControlHostExecutorReviewIsHostDispatchAuthorization: false;
    recoveryControlDispatchAuthorizationReviewIsAdapterInvocationAuthorization: false;
    recoveryControlTaskControlReviewIsSubAgentRuntimeAuthorization: false;
    recoveryControlSandboxWitnessIsProductionRecoveryExecution: false;
    recoveryControlReceiptStatusIsCompletionAuthorization: false;
    recoveryControlRecoveryRecommendationIsHostExecutorAuthorization: false;
    runtimeControlRuntimeSignalIsExecutionAuthorization: false;
    runtimeControlEscalationOutcomeIsProviderExecutionAuthorization: false;
    runtimeControlUpgradeModelIsModelRuntimeInvocation: false;
    runtimeControlOpenCircuitIsHostDispatchAuthorization: false;
    runtimeControlFailureCountIsRecoveryExecutionAuthorization: false;
    runtimeControlContextPressureIsSubAgentRuntimeAuthorization: false;
    runtimeControlHighRiskSignalIsCodexCliAuthorization: false;
    operatorActionExecutorGateExecutionAllowed: false;
    codexCliHostWorkspaceWriteRequiresExplicitAllowance: true;
    codexCliHostWorkspaceWriteRequiresConfirmation: true;
    codexCliHostDefaultRealCodexCliAllowedByBoundaryAudit: false;
    codexCliHostProviderExecutionAllowedByHostBoundary: false;
    publicApiInternalGovernanceTopLevelExportsAllowed: false;
    publicApiProviderExecuteExportAllowed: false;
    publicApiCodexCliHostRunExportAllowed: false;
    agentOsLocalRuntimeProviderPlanCanBeStored: true;
    agentOsLocalRuntimeRealProviderExecutionAllowed: false;
    agentOsLocalRuntimeCodexCliInvocationAllowed: false;
    agentOsLocalRuntimeHostExecutorInvocationAllowed: false;
    agentOsLocalRuntimeWorkspaceWriteExecutionAllowed: false;
    agentOsMcpServerManifestRuntimeImplementedMeansLiveServer: false;
    agentOsMcpServerManifestToolManifestIsToolRuntimeAuthorization: false;
    agentOsMcpServerManifestRequiredCapabilityIsCapabilityGrant: false;
    agentOsMcpServerManifestApprovalRequiredIsApprovalGrant: false;
    agentOsMcpServerManifestLocalWriteSideEffectIsWorkspaceWriteExecution: false;
    agentOsMcpServerManifestProviderPlanningOutputIsProviderExecutionAuthorization: false;
    agentOsMcpServerManifestApprovalPermitOutputIsProviderExecutionAuthorization: false;
    agentOsMcpServerManifestListedToolIsMcpToolInvocation: false;
    agentOsMcpServerManifestExportIsPublicExecutionSurface: false;
    protocolMcpServerRefIsLiveServerConnection: false;
    protocolMcpCommandRefIsShellCommand: false;
    protocolMcpEndpointRefIsNetworkCall: false;
    protocolMcpToolManifestIsToolRuntimeAuthorization: false;
    protocolMcpInvocationPlanIsToolExecutionAuthorization: false;
    protocolMcpFakeProviderIsLiveMcpServer: false;
    protocolMcpInvokeMethodIsEnabled: false;
    protocolMcpUnknownSideEffectIsAutoApproved: false;
    protocolMcpAllowedToolIsMcpInvocationAuthorization: false;
    protocolA2aEndpointRefIsNetworkCall: false;
    protocolA2aAgentCardIsRemoteRuntimeAuthorization: false;
    protocolA2aTaskSkeletonIsRemoteExecutionAuthorization: false;
    protocolA2aArtifactUriIsFetchedBySkeleton: false;
    protocolA2aRemoteProviderIsEnabled: false;
    protocolA2aRemoteProviderCreatesRemoteTasks: false;
    protocolA2aFakeTransportIsLiveNetworkService: false;
    protocolA2aFakeTransportSubmissionIsRuntimeAuthorization: false;
    protocolA2aAnonymousRemoteInvocationAllowed: false;
    protocolA2aAuthSchemeIsCapabilityGrant: false;
    protocolA2aRemoteAgentProviderManifestIsSubAgentRuntimeAuthorization: false;
    agentOsSdkCallIsProviderExecutionAuthorization: false;
    agentOsSdkGrantInputIsCapabilityGrant: false;
    agentOsSdkApproveToolInputIsToolRuntimeAuthorization: false;
    agentOsSdkAllowLocalMutationIsWorkspaceWriteExecution: false;
    agentOsSdkPreferredProviderIsCodexCliInvocation: false;
    agentOsSdkLocalRuntimeCallIsProviderExecutionAuthorization: false;
    agentOsSdkApprovalPermitIssueIsProviderExecutionAuthorization: false;
    agentOsSdkApprovalPermitConsumptionIsProviderExecutionAuthorization: false;
    agentOsSdkRealProviderExecutionInvoked: false;
    agentOsCliGrantFlagIsCapabilityGrant: false;
    agentOsCliApproveToolFlagIsToolRuntimeAuthorization: false;
    agentOsCliAllowLocalMutationIsWorkspaceWriteExecution: false;
    agentOsCliPreferredProviderIsCodexCliInvocation: false;
    agentOsCliParsedCommandIsProviderExecutionAuthorization: false;
    agentOsCliLocalRuntimeCallIsProviderExecutionAuthorization: false;
    agentOsCliApprovalPermitIssueIsProviderExecutionAuthorization: false;
    agentOsCliApprovalPermitConsumptionIsProviderExecutionAuthorization: false;
    agentOsCliSanitizedArgvContainsRawSecrets: false;
    agentOsAppServerRequestEnvelopeIsCapabilityGrant: false;
    agentOsAppServerRouteIsLiveNetworkServer: false;
    agentOsAppServerStatusCodeIsHostExecutorReceipt: false;
    agentOsAppServerClientGateFieldsAreTrusted: false;
    agentOsAppServerServerSideOptionsAreClientControlled: false;
    agentOsAppServerLocalRuntimeCallIsProviderExecutionAuthorization: false;
    agentOsAppServerApprovalPermitIssueIsProviderExecutionAuthorization: false;
    agentOsAppServerApprovalPermitConsumptionIsProviderExecutionAuthorization: false;
    agentOsAppServerLiveHttpServerStarted: false;
    agentOsAppServerNetworkAccessed: false;
    agentOsAppServerRealProviderExecutionInvoked: false;
    agentOsPublicSurfacesSdkCallIsProviderExecutionAuthorization: false;
    agentOsPublicSurfacesCliGrantFlagIsProviderExecutionAuthorization: false;
    agentOsPublicSurfacesCliApproveToolFlagIsToolRuntimeAuthorization: false;
    agentOsPublicSurfacesCliAllowLocalMutationIsWorkspaceWriteExecution: false;
    agentOsPublicSurfacesPreferredProviderIsCodexCliInvocation: false;
    agentOsPublicSurfacesAppServerRequestEnvelopeIsCapabilityGrant: false;
    agentOsPublicSurfacesAppServerRouteIsNetworkServer: false;
    agentOsPublicSurfacesAppServerStatusCodeIsExecutionReceipt: false;
    agentOsPublicSurfacesApprovalPermitIssueIsProviderExecutionAuthorization: false;
    controlledReadOnlyProviderExecutionAllowed: true;
    preflightOkIsExecutionAuthorization: false;
    preflightMissingToolCheckIsToolRuntimeAuthorization: false;
    preflightAuthAvailableIsProviderExecutionAuthorization: false;
    preflightWorkspaceCleanIsWorkspaceWriteAuthorization: false;
    preflightProtectedBranchCheckIsWorkspaceWriteExecution: false;
    preflightMemoryOverviewIsRuntimeAuthorization: false;
    preflightMemoryHealthStatusIsSubAgentRuntimeAuthorization: false;
    preflightMemoryWarningIsHostExecutorAuthorization: false;
    preflightMemoryBlockingIssueIsProviderExecutionAuthorization: false;
    approvalPermitValidPermitIsProviderExecutionAuthorization: false;
    approvalPermitValidPermitIsCodexCliAuthorization: false;
    approvalPermitValidPermitIsSubAgentRuntimeAuthorization: false;
    approvalPermitValidPermitIsHostExecutorAuthorization: false;
    approvalPermitValidPermitIsToolRuntimeAuthorization: false;
    approvalPermitShellCapabilityScopeIsShellExecution: false;
    approvalPermitExternalCapabilityScopeIsExternalWriteExecution: false;
    approvalPermitStorePersistenceIsWorkspaceWriteExecution: false;
    approvalGateNotRequiredStatusIsExecutionAuthorization: false;
    approvalGateResolutionIsProviderExecutionAuthorization: false;
    approvalGateResolutionIsCodexCliAuthorization: false;
    approvalGateResolutionIsSubAgentRuntimeAuthorization: false;
    approvalGateResolutionIsHostExecutorAuthorization: false;
    approvalGateResolutionIsToolRuntimeAuthorization: false;
    approvalGatePendingStatusIsRuntimeInvocation: false;
    approvalGateProtectedBranchSignalIsWorkspaceWriteExecution: false;
    approvalGateDirtyWorkspaceSignalIsWorkspaceWriteExecution: false;
    approvalGateProtectedKeywordSignalIsExternalWriteExecution: false;
    approvalConsumptionDispatchMatrixAuditIsProviderExecuteAuthorization: false;
    approvalConsumptionDispatchMatrixAuditIsRealCodexCliAuthorization: false;
    approvalConsumptionDispatchMatrixAuditIsWorkspaceWriteAuthorization: false;
    approvalConsumptionDispatchMatrixAuditIsLocalCommandAuthorization: false;
    approvalConsumptionDispatchMatrixAuditIsHostExecutorAuthorization: false;
    approvalConsumptionDispatchMatrixAuditIsSubAgentRuntimeAuthorization: false;
    approvalConsumptionDispatchMatrixAuditIsToolRuntimeAuthorization: false;
    approvalConsumptionDispatchMatrixAuditIsExternalWriteAuthorization: false;
    approvalConsumptionDispatchMatrixAuditIsReleaseAuthorization: false;
    approvalConsumptionDispatchMatrixAuditGitStateIsExecutionAuthorization: false;
    approvalConsumptionDispatchMatrixAuditWorktreeCleanIsProviderExecutionAuthorization: false;
    approvalConsumptionDispatchMatrixIsProviderExecuteAuthorization: false;
    approvalConsumptionDispatchMatrixIsRealCodexCliAuthorization: false;
    approvalConsumptionDispatchMatrixIsWorkspaceWriteAuthorization: false;
    approvalConsumptionDispatchMatrixIsLocalCommandAuthorization: false;
    approvalConsumptionDispatchMatrixIsHostExecutorAuthorization: false;
    approvalConsumptionDispatchMatrixIsSubAgentRuntimeAuthorization: false;
    approvalConsumptionDispatchMatrixIsExternalWriteAuthorization: false;
    approvalConsumptionDispatchMatrixIsReleaseAuthorization: false;
    approvalConsumptionDispatchApprovalPermitConsumptionIsProviderExecutionAuthorization: false;
    approvalConsumptionDispatchHostDispatcherPreconditionIsProviderExecuteAuthorization: false;
    approvalConsumptionDispatchRedactionCoverageIsRuntimeAuthorization: false;
    readonlyProductizationIsProviderExecuteAuthorization: false;
    readonlyProductizationIsRealCodexCliAuthorization: false;
    readonlyProductizationIsWorkspaceWriteAuthorization: false;
    readonlyProductizationIsLocalCommandAuthorization: false;
    readonlyProductizationIsHostExecutorAuthorization: false;
    readonlyProductizationIsSubAgentRuntimeAuthorization: false;
    readonlyProductizationIsToolRuntimeAuthorization: false;
    readonlyProductizationIsExternalWriteAuthorization: false;
    readonlyProductizationIsEvidenceRefreshAuthorization: false;
    readonlyProductizationIsReleaseAuthorization: false;
    readonlyProductizationGitStateIsExecutionAuthorization: false;
    readonlyProductizationWorktreeCleanIsProviderExecutionAuthorization: false;
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
    workspaceWriteReleaseGateIsWorkspaceWriteAuthorization: false;
    workspaceWriteReleaseGateIsRealCodexCliAuthorization: false;
    workspaceWriteReleaseGateIsProviderExecutionAuthorization: false;
    workspaceWriteReleaseGateIsHostExecutorAuthorization: false;
    workspaceWriteReleaseGateIsSubAgentRuntimeAuthorization: false;
    workspaceWriteReleaseGateIsExternalWriteAuthorization: false;
    workspaceWriteReleaseGateIsPushAuthorization: false;
    workspaceWriteReleaseGateIsReleaseAuthorization: false;
    admissionControlAcceptedStatusIsExecutionAuthorization: false;
    admissionControlNeedsApprovalStatusIsApprovalGrant: false;
    admissionControlRejectedStatusIsRuntimeBlockExecution: false;
    admissionControlCapabilityMatchIsRuntimeInvocation: false;
    admissionControlRequiredApprovalIsProviderExecutionAuthorization: false;
    admissionControlRequiredApprovalIsCodexCliAuthorization: false;
    admissionControlRequiredApprovalIsSubAgentRuntimeAuthorization: false;
    admissionControlRequiredApprovalIsHostExecutorAuthorization: false;
    admissionControlExternalCapabilityIsExternalWriteExecution: false;
    admissionControlFileWriteCapabilityIsWorkspaceWriteExecution: false;
    delegationPolicyFullDelegationIsExecutionAuthorization: false;
    delegationPolicyRequiresApprovalFalseIsExecutionAuthorization: false;
    delegationPolicyApprovedProposalIsRuntimeAuthorization: false;
    delegationPolicyAppliedProposalIsProviderExecutionAuthorization: false;
    delegationPolicyFilteredRecoveryActionIsHostExecutorAuthorization: false;
    delegationPolicyRecoveryActionListIsRecoveryExecution: false;
    delegationPolicyHistoricalTrustIsRuntimeAuthorization: false;
    delegationPolicyRecordedResumeIsRuntimeInvocation: false;
    delegationPolicyFileStorePersistenceIsWorkspaceWriteExecution: false;
    executionEligibilityEligibleStatusIsExecutionAuthorization: false;
    executionEligibilityValidApprovalPermitIsProviderExecutionAuthorization: false;
    executionEligibilityCapabilityGrantIsRuntimeInvocation: false;
    executionEligibilityPermitStoreReadIsRuntimeInvocation: false;
    executionEligibilityProviderPlanCreationAllowed: false;
    executionEligibilityProviderExecuteAllowed: false;
    executionEligibilityCodexCliInvocationAllowed: false;
    executionEligibilitySubAgentRuntimeInvocationAllowed: false;
    executionEligibilityHostExecutorInvocationAllowed: false;
    executionEligibilityHostDispatchAllowed: false;
    executionObservationStatusIsExecutionAuthorization: false;
    executionObservationSucceededIsCompletionAuthorization: false;
    executionObservationFailedIsRecoveryAuthorization: false;
    executionObservationEvidenceRefIsRuntimeInvocation: false;
    executionObservationRefResolutionIsReplayAuthorization: false;
    executionObservationRecordWriteIsWorkspaceWriteExecution: false;
    executionObservationFileStorePersistenceAllowed: true;
    executionObservationProviderExecuteAllowed: false;
    executionObservationCodexCliInvocationAllowed: false;
    executionObservationSubAgentRuntimeInvocationAllowed: false;
    executionObservationHostExecutorInvocationAllowed: false;
    executionObservationHostDispatchAllowed: false;
    governanceFailureReducerExecutionFailureIsRecoveryAuthorization: false;
    governanceFailureReducerStrategyDecisionIsRuntimeAuthorization: false;
    governanceFailureReducerArbitrationPacketIsRecoveryExecution: false;
    governanceFailureReducerRecoveryRecommendationIsHostExecutorAuthorization: false;
    governanceFailureReducerAnomalyRecordIsRuntimeInvocation: false;
    governanceFailureReducerEvidenceRefIsReplayAuthorization: false;
    governanceFailureReducerRiskScoreIsProviderExecutionAuthorization: false;
    governanceFailureReducerStateUpdateIsWorkspaceWriteExecution: false;
    taskGraphNodeStatusIsExecutionAuthorization: false;
    taskGraphCompletionIsRuntimeCompletion: false;
    taskGraphDependencyEdgeIsSchedulerDispatch: false;
    taskGraphConflictEdgeIsRuntimeBlockExecution: false;
    taskGraphCheckpointNodeIsRollbackExecution: false;
    taskGraphDeltaIsWorkspaceRollbackAuthorization: false;
    taskGraphRollbackToCheckpointIsHostExecutorAuthorization: false;
    taskGraphBranchMergeIsGitMergeOrWorkspaceWrite: false;
    taskGraphFileStorePersistenceIsWorkspaceWriteExecution: false;
    schedulerQueuedStatusIsDispatchAuthorization: false;
    schedulerLeasedStatusIsExecutionAuthorization: false;
    schedulerActiveLeaseIsProviderExecuteAuthorization: false;
    schedulerWorkerIdIsHostOrSubAgentAuthorization: false;
    schedulerReleaseLeaseIsRuntimeCompletionProof: false;
    schedulerFailLeaseIsRecoveryExecution: false;
    schedulerExpiredLeaseIsRetryExecution: false;
    schedulerExhaustedStatusIsRuntimeBlockExecution: false;
    schedulerFileStatePersistenceIsWorkspaceWriteExecution: false;
    schedulerFileLockIsShellProcessExecution: false;
    executionPlannerPlannedStatusIsProviderExecutionAuthorization: false;
    executionPlannerCodexCliProviderSelectionIsCodexCliInvocation: false;
    executionPlannerRemoteAgentProviderSelectionIsSubAgentRuntimeInvocation: false;
    executionPlannerWorkspaceWriteSideEffectClassIsWorkspaceWriteExecution: false;
    executionPlannerLocalPlanStoreWritesAllowed: true;
    executionPlannerProviderPlanExecutionAllowed: false;
    executionPlannerProviderValidateExecutionPlanAllowed: false;
    executionPlannerProviderExecuteAllowed: false;
    executionPlannerCodexCliInvocationAllowed: false;
    executionPlannerSubAgentRuntimeInvocationAllowed: false;
    executionPlannerHostExecutorInvocationAllowed: false;
    executionPlannerHostDispatchAllowed: false;
    executionPlannerWorkspaceWriteExecutionAllowed: false;
    providerRegistrySelectedProviderIsExecutionAuthorization: false;
    providerRegistryProviderGrantSelectionIsProviderExecuteAuthorization: false;
    providerRegistryRoutingDecisionSelectionIsCodexCliAuthorization: false;
    providerRegistryRegisteredExecutorProviderIsRuntimeInvocation: false;
    providerRegistryRegisteredToolProviderIsToolRuntimeInvocation: false;
    providerRegistryRegisteredRemoteAgentProviderIsSubAgentRuntimeAuthorization: false;
    providerRegistryRemoteAgentAuthSchemesAreRuntimeAuthorization: false;
    providerRegistryManifestStorePersistenceIsWorkspaceWriteExecution: false;
    controlledProviderExecutionTaskbookIsProviderExecuteAuthorization: false;
    controlledProviderExecutionTaskbookIsRealCodexCliAuthorization: false;
    controlledProviderExecutionTaskbookIsWorkspaceWriteAuthorization: false;
    controlledProviderExecutionTaskbookIsLocalCommandAuthorization: false;
    controlledProviderExecutionTaskbookIsProtectedRemoteAuthorization: false;
    controlledProviderExecutionTaskbookIsHostExecutorAuthorization: false;
    controlledProviderExecutionTaskbookIsSubAgentRuntimeAuthorization: false;
    controlledProviderExecutionTaskbookIsExternalWriteAuthorization: false;
    controlledProviderExecutionTaskbookIsReleaseAuthorization: false;
    controlledProviderExecutionTaskbookIsSecretChangeAuthorization: false;
    controlledProviderExecutionTaskbookReviewAuditIsProviderExecuteAuthorization: false;
    controlledProviderExecutionTaskbookReviewAuditIsRealCodexCliAuthorization: false;
    controlledProviderExecutionTaskbookReviewAuditIsWorkspaceWriteAuthorization: false;
    controlledProviderExecutionTaskbookReviewAuditIsLocalCommandAuthorization: false;
    controlledProviderExecutionTaskbookReviewAuditIsHostExecutorAuthorization: false;
    controlledProviderExecutionTaskbookReviewAuditIsSubAgentRuntimeAuthorization: false;
    controlledProviderExecutionTaskbookReviewAuditIsExternalWriteAuthorization: false;
    controlledProviderExecutionTaskbookReviewAuditIsReleaseAuthorization: false;
    controlledProviderExecutionTaskbookReviewAuditGitStateIsExecutionAuthorization: false;
    controlledProviderExecutionTaskbookReviewAuditWorktreeCleanIsProviderExecutionAuthorization: false;
    controlledProviderExecutionDispatchPreflightIsProviderExecuteAuthorization: false;
    controlledProviderExecutionDispatchPreflightIsRealCodexCliAuthorization: false;
    controlledProviderExecutionDispatchPreflightIsWorkspaceWriteAuthorization: false;
    controlledProviderExecutionDispatchPreflightIsHostExecutorAuthorization: false;
    controlledProviderExecutionDispatchPreflightIsSubAgentRuntimeAuthorization: false;
    controlledProviderExecutionDispatchPreflightIsShellProcessAuthorization: false;
    controlledProviderExecutionDispatchPreflightIsExternalWriteAuthorization: false;
    controlledProviderExecutionDispatchPreflightIsReleaseAuthorization: false;
    controlledProviderExecutionDispatchPreflightRunnerRemainsFinalProviderExecuteGate: true;
    controlledProviderExecutionDispatchPreflightDryRunDefaultPreserved: true;
    controlledProviderExecutionDispatcherCallsProviderExecuteDirectly: false;
    controlledProviderExecutionDispatcherCallsRealCodexCliDirectly: false;
    controlledProviderExecutionDispatcherControlledWorkspaceWriteDispatchAllowed: true;
    controlledProviderExecutionDispatcherAuthorizesGeneralWorkspaceWrite: false;
    controlledProviderExecutionDispatcherWorkspaceWriteProviderExecuteAllowed: false;
    controlledProviderExecutionDispatcherAuthorizesHostExecutor: false;
    controlledProviderExecutionDispatcherAuthorizesSubAgentRuntime: false;
    controlledProviderExecutionDispatcherCallsRunnerBoundary: true;
    controlledProviderExecutionDispatcherDefaultDryRunPreserved: true;
    providerExecutionRunnerWorkspaceWriteAllowed: true;
    providerExecutionRunnerWorkspaceWriteProviderExecuteAllowed: false;
    providerExecutionRunnerDefaultRealCodexCliAllowed: false;
    providerExecutionRunnerNonCodexProviderExecutionAllowed: false;
    providerCorePrimitivesExecutionAllowed: false;
    toolInvocationPlannerPlannedStatusIsRuntimeInvocation: false;
    toolInvocationPlannerRemoteAgentToolManifestIsSubAgentRuntimeAuthorization: false;
    toolInvocationPlannerExternalWriteToolManifestIsExternalWriteAuthorization: false;
    toolInvocationPlannerApprovalPermitIsToolRuntimeAuthorization: false;
    toolInvocationPlannerLocalWriteToolPlanIsWorkspaceWriteExecution: false;
    toolInvocationPlannerInputPreviewStoresRawSecrets: false;
    toolInvocationPlannerDefaultCodexCliInvocationAllowed: false;
    toolInvocationPlannerProviderExecuteAllowed: false;
    toolInvocationPlannerSubAgentRuntimeInvocationAllowed: false;
    toolInvocationPlannerHostExecutorInvocationAllowed: false;
    toolInvocationPlannerToolRuntimeInvocationAllowed: false;
    toolInvocationPlannerShellProcessAllowedByDefault: false;
    toolInvocationPlannerWorkspaceWriteAllowedByDefault: false;
    toolInvocationPlannerExternalWriteAllowedByDefault: false;
    desktopAgentStrategyParallelPlanIsSubAgentRuntimeAuthorization: false;
    desktopAgentStrategyWorkerAssignmentIsRuntimeInvocation: false;
    desktopAgentStrategyWriteModeIsWorkspaceWriteExecution: false;
    desktopAgentStrategyOwnershipTargetIsWorkspaceWriteAuthorization: false;
    desktopAgentStrategyMaxAgentsIsSubAgentSpawnAuthorization: false;
    desktopAgentStrategyReadOnlyAnalystIsProviderExecutionAuthorization: false;
    desktopAgentStrategyReasonIsExecutionGate: false;
    desktopDecisionRunnerReadyStatusIsExecutionAuthorization: false;
    desktopDecisionRunnerProviderSelectionIsProviderExecute: false;
    desktopDecisionRunnerAgentStrategyIsSubAgentRuntimeInvocation: false;
    desktopDecisionRunnerHostDispatchAllowed: false;
    desktopDecisionRunnerProviderExecuteAllowed: false;
    desktopDecisionRunnerCodexCliInvocationAllowed: false;
    finalHostLocatorReadyForMappingIsHostExecutionAuthorization: false;
    finalHostLocatorHostExecutorInvocationAllowed: false;
    finalHostLocatorHostDispatchAllowed: false;
    finalHostLocatorProviderExecuteAllowed: false;
    finalHostLocatorCodexCliInvocationAllowed: false;
    finalHostLocatorSubAgentRuntimeInvocationAllowed: false;
    codexDesktopRuntimeToolInvocationAllowedByDefault: false;
    codexDesktopLiveHostDefaultRuntimeToolInvocationAllowed: false;
    codexDesktopLiveHostCodexCliInvocationAllowed: false;
    codexMemoryMcpClientMcpHttpCallsAreProviderExecution: false;
    codexMemoryMcpClientMcpHttpCallsAreHostExecutorAuthorization: false;
    codexMemoryMcpClientRecordMemoryIsWorkspaceWriteExecution: false;
    codexMemoryMcpClientSearchMemoryIsSubAgentRuntimeInvocation: false;
    codexMemoryMcpClientMemoryOverviewIsRuntimeAuthorization: false;
    codexMemoryMcpClientAdapterCheckpointWriteIsExecutionAuthorization: false;
    codexMemoryMcpClientDefaultEndpointLookupAllowed: false;
    codexMemoryMcpClientBearerTokenIsExecutionAuthorization: false;
    codexMemoryMcpClientDefaultCodexCliInvocationAllowed: false;
    codexMemoryMcpClientProviderExecuteAllowed: false;
    codexMemoryMcpClientSubAgentRuntimeInvocationAllowed: false;
    codexMemoryMcpClientShellProcessAllowedByDefault: false;
    codexMemoryMcpClientWorkspaceWriteAllowedByDefault: false;
    codexMemoryHostClientMemoryOperationCallsAreHostExecutorAuthorization: false;
    codexMemoryHostClientRecordMemoryIsWorkspaceWriteExecution: false;
    codexMemoryHostClientSearchMemoryIsSubAgentRuntimeInvocation: false;
    codexMemoryHostClientMemoryOverviewIsRuntimeAuthorization: false;
    codexMemoryHostClientAdapterCheckpointWriteIsExecutionAuthorization: false;
    codexMemoryHostClientMcpToolStyleAdapterIsDefaultHostLookup: false;
    codexMemoryHostClientDefaultRealHostExecutionAllowed: false;
    codexMemoryHostClientDefaultHostExecutorLookupAllowed: false;
    codexMemoryHostClientDefaultCodexCliInvocationAllowed: false;
    codexMemoryHostClientProviderExecuteAllowed: false;
    codexMemoryHostClientSubAgentRuntimeInvocationAllowed: false;
    codexMemoryHostClientShellProcessAllowedByDefault: false;
    codexMemoryHostClientWorkspaceWriteAllowedByDefault: false;
    desktopHostClientDefaultRealExecutionAllowed: false;
    desktopHostClientDefaultHostExecutorLookupAllowed: false;
    desktopHostClientDirectDispatchToHostAllowed: false;
    desktopHostClientExecuteInjectedDispatchAllowed: true;
    desktopHostClientControlledWorkspaceWriteDispatchAllowed: true;
    desktopHostClientGeneralWorkspaceWriteAllowed: false;
    desktopHostClientWorkspaceWriteProviderExecuteAllowed: false;
    desktopLiveAdapterBlockedDecisionExecutionAllowed: false;
    hostClientExampleRealShellProcessAllowed: false;
    hostClientExampleHostExecutorDispatchSurfacePresent: false;
    hostClientExampleWorkspaceWriteAllowed: false;
    targetHostEmbeddingPlaceholderMethodsAreRealExecution: false;
    targetHostEmbeddingScaffoldReadyStatusIsExecutionAuthorization: false;
    targetHostEmbeddingCreateBundleRequiresFullyWiredHost: true;
    targetHostEmbeddingCreateBundleIsHostExecutorAuthorization: false;
    targetHostEmbeddingDirectiveBuildersAreShellAuthorization: false;
    targetHostEmbeddingDefaultRealHostExecutionAllowed: false;
    targetHostEmbeddingDefaultHostExecutorLookupAllowed: false;
    targetHostEmbeddingDefaultCodexCliInvocationAllowed: false;
    targetHostEmbeddingProviderExecuteAllowed: false;
    targetHostEmbeddingSubAgentRuntimeInvocationAllowed: false;
    targetHostEmbeddingShellProcessAllowedByDefault: false;
    targetHostEmbeddingWorkspaceWriteAllowedByDefault: false;
    desktopLiveAdapterBridgeInvocationAllowedByCodexCliRoute: false;
    desktopLiveAdapterProviderInvocationAllowed: false;
    hostDispatcherReadOnlyProviderDispatchAllowed: true;
    hostDispatcherControlledWorkspaceWriteDispatchAllowed: true;
    hostDispatcherGeneralProviderExecutionAllowed: false;
    hostDispatcherGeneralWorkspaceWriteAllowed: false;
    hostDispatcherWorkspaceWriteProviderExecuteAllowed: false;
    hostExecutorDefaultRealExecutionAllowed: false;
    hostExecutorTaskbookExecutionAllowed: false;
    hostClientExecutorReviewDispatchAllowed: false;
    hostExecutorReceiptDispatchMeansBusinessRecoveryCompleted: false;
    agentBackedRecoveryProductionExecutionAllowed: false;
    agentExecutorAdapterTaskbookExecutionAllowed: false;
    agentExecutorAdapterReviewInvocationAllowed: false;
    agentExecutorAdapterSandboxProductionExecutionAllowed: false;
    taskControlTaskbookExecutionAllowed: false;
    taskControlReviewInvocationAllowed: false;
    subAgentRuntimeExecutionAllowed: false;
    taskControlAdapterKind: "sandbox_task_control_adapter";
    totalStrategyRouterCallsDuringAudit: 0;
    totalStrategyRouterProviderPlanExecutionCallsDuringAudit: 0;
    totalStrategyRouterProviderValidateExecutionPlanCallsDuringAudit: 0;
    totalStrategyRouterProviderExecuteCallsDuringAudit: 0;
    totalExecutionProfileLookupsDuringAudit: 0;
    totalExecutionProfilesProviderExecuteCallsDuringAudit: 0;
    totalExecutionProfilesCodexCliCallsDuringAudit: 0;
    totalExecutionProfilesDesktopPrimitiveCallsDuringAudit: 0;
    totalExecutionProfilesSubAgentRuntimeCallsDuringAudit: 0;
    totalExecutionProfilesHostExecutorCallsDuringAudit: 0;
    totalExecutionProfilesHostDispatchCallsDuringAudit: 0;
    totalExecutionProfilesToolRuntimeCallsDuringAudit: 0;
    totalExecutionProfilesShellProcessCallsDuringAudit: 0;
    totalExecutionProfilesWorkspaceWriteCallsDuringAudit: 0;
    totalExecutionProfilesExternalWriteCallsDuringAudit: 0;
    totalPolicyConfigLoadCallsDuringAudit: 0;
    totalPolicyConfigProviderExecuteCallsDuringAudit: 0;
    totalPolicyConfigCodexCliCallsDuringAudit: 0;
    totalPolicyConfigDesktopPrimitiveCallsDuringAudit: 0;
    totalPolicyConfigSubAgentRuntimeCallsDuringAudit: 0;
    totalPolicyConfigHostExecutorCallsDuringAudit: 0;
    totalPolicyConfigHostDispatchCallsDuringAudit: 0;
    totalPolicyConfigToolRuntimeCallsDuringAudit: 0;
    totalPolicyConfigShellProcessCallsDuringAudit: 0;
    totalPolicyConfigWorkspaceWriteCallsDuringAudit: 0;
    totalPolicyConfigExternalWriteCallsDuringAudit: 0;
    totalCapabilityTaxonomyProviderExecuteCallsDuringAudit: 0;
    totalCapabilityTaxonomyCodexCliCallsDuringAudit: 0;
    totalCapabilityTaxonomyWorkspaceWriteCallsDuringAudit: 0;
    totalCapabilityTaxonomyCanaryFileWriteCallsDuringAudit: 0;
    totalCapabilityTaxonomyGeneralProviderExecutionCallsDuringAudit: 0;
    totalCapabilityTaxonomyExternalWriteCallsDuringAudit: 0;
    totalCapabilityTaxonomyReleaseCallsDuringAudit: 0;
    totalCapabilityTaxonomySecretAccessCallsDuringAudit: 0;
    totalCapabilityTaxonomyShellProcessCallsDuringAudit: 0;
    totalCapabilityTaxonomyEscalationPolicyProviderExecuteCallsDuringAudit: 0;
    totalCapabilityTaxonomyEscalationPolicyCodexCliCallsDuringAudit: 0;
    totalCapabilityTaxonomyEscalationPolicyWorkspaceWriteCallsDuringAudit: 0;
    totalCapabilityTaxonomyEscalationPolicyHostExecutorCallsDuringAudit: 0;
    totalCapabilityTaxonomyEscalationPolicySubAgentRuntimeCallsDuringAudit: 0;
    totalCapabilityTaxonomyEscalationPolicyToolRuntimeCallsDuringAudit: 0;
    totalCapabilityTaxonomyEscalationPolicyShellProcessCallsDuringAudit: 0;
    totalCapabilityTaxonomyEscalationPolicyExternalWriteCallsDuringAudit: 0;
    totalCapabilityTaxonomyEscalationPolicyReleaseCallsDuringAudit: 0;
    totalCapabilityTaxonomyEscalationPolicySecretAccessCallsDuringAudit: 0;
    totalControlledProviderExecutionTaskbookProviderExecuteCallsDuringAudit: 0;
    totalControlledProviderExecutionTaskbookCodexCliCallsDuringAudit: 0;
    totalControlledProviderExecutionTaskbookWorkspaceWriteCallsDuringAudit: 0;
    totalControlledProviderExecutionTaskbookHostExecutorCallsDuringAudit: 0;
    totalControlledProviderExecutionTaskbookSubAgentRuntimeCallsDuringAudit: 0;
    totalControlledProviderExecutionTaskbookShellProcessCallsDuringAudit: 0;
    totalControlledProviderExecutionTaskbookExternalWriteCallsDuringAudit: 0;
    totalControlledProviderExecutionTaskbookEvidenceWritesDuringAudit: 0;
    totalControlledProviderExecutionTaskbookReviewBoundaryProviderExecuteCallsDuringAudit: 0;
    totalControlledProviderExecutionTaskbookReviewBoundaryCodexCliCallsDuringAudit: 0;
    totalControlledProviderExecutionTaskbookReviewBoundaryWorkspaceWriteCallsDuringAudit: 0;
    totalControlledProviderExecutionTaskbookReviewBoundaryHostExecutorCallsDuringAudit: 0;
    totalControlledProviderExecutionTaskbookReviewBoundarySubAgentRuntimeCallsDuringAudit: 0;
    totalControlledProviderExecutionTaskbookReviewBoundaryShellProcessCallsDuringAudit: 0;
    totalControlledProviderExecutionTaskbookReviewBoundaryExternalWriteCallsDuringAudit: 0;
    totalControlledProviderExecutionTaskbookReviewBoundaryEvidenceWritesDuringAudit: 0;
    totalControlledProviderExecutionDispatchPreflightProviderExecuteCallsDuringAudit: 0;
    totalControlledProviderExecutionDispatchPreflightCodexCliCallsDuringAudit: 0;
    totalControlledProviderExecutionDispatchPreflightWorkspaceWriteCallsDuringAudit: 0;
    totalControlledProviderExecutionDispatchPreflightHostExecutorCallsDuringAudit: 0;
    totalControlledProviderExecutionDispatchPreflightSubAgentRuntimeCallsDuringAudit: 0;
    totalControlledProviderExecutionDispatchPreflightShellProcessCallsDuringAudit: 0;
    totalControlledProviderExecutionDispatchPreflightExternalWriteCallsDuringAudit: 0;
    totalControlledProviderExecutionDispatchPreflightEvidenceWritesDuringAudit: 0;
    totalControlledProviderExecutionDispatcherRunnerInvocationsDuringAudit: 0;
    totalControlledProviderExecutionDispatcherProviderExecuteCallsDuringAudit: 0;
    totalControlledProviderExecutionDispatcherRealCodexCliCallsDuringAudit: 0;
    totalControlledProviderExecutionDispatcherWorkspaceWriteCallsDuringAudit: 0;
    totalControlledProviderExecutionDispatcherHostExecutorCallsDuringAudit: 0;
    totalControlledProviderExecutionDispatcherSubAgentRuntimeCallsDuringAudit: 0;
    totalControlledProviderExecutionDispatcherShellProcessCallsDuringAudit: 0;
    totalControlledProviderExecutionDispatcherExternalWriteCallsDuringAudit: 0;
    totalRoutingEngineCallsDuringAudit: 0;
    totalRoutingEngineProviderGrantCreationsDuringAudit: 0;
    totalRoutingEngineProviderExecuteCallsDuringAudit: 0;
    totalRoutingEngineCodexCliCallsDuringAudit: 0;
    totalRoutingEngineDesktopRuntimeCallsDuringAudit: 0;
    totalRoutingEngineSubAgentRuntimeCallsDuringAudit: 0;
    totalRoutingEngineHostExecutorCallsDuringAudit: 0;
    totalRoutingEngineHostDispatchCallsDuringAudit: 0;
    totalRoutingEngineToolRuntimeCallsDuringAudit: 0;
    totalRoutingEngineShellProcessCallsDuringAudit: 0;
    totalRoutingEngineWorkspaceWriteCallsDuringAudit: 0;
    totalRoutingEngineExternalWriteCallsDuringAudit: 0;
    totalRecoveryControlCallsDuringAudit: 0;
    totalRecoveryControlHostExecutorInvocationsDuringAudit: 0;
    totalRecoveryControlAdapterInvocationsDuringAudit: 0;
    totalRecoveryControlCodexCliCallsDuringAudit: 0;
    totalRecoveryControlProviderExecuteCallsDuringAudit: 0;
    totalRecoveryControlSubAgentRuntimeCallsDuringAudit: 0;
    totalRecoveryControlShellProcessCallsDuringAudit: 0;
    totalRecoveryControlWorkspaceWriteCallsDuringAudit: 0;
    totalRecoveryControlExternalWriteCallsDuringAudit: 0;
    totalRuntimeControlCallsDuringAudit: 0;
    totalRuntimeControlProviderExecuteCallsDuringAudit: 0;
    totalRuntimeControlCodexCliCallsDuringAudit: 0;
    totalRuntimeControlSubAgentRuntimeCallsDuringAudit: 0;
    totalRuntimeControlHostExecutorCallsDuringAudit: 0;
    totalRuntimeControlHostDispatchCallsDuringAudit: 0;
    totalRuntimeControlModelRuntimeCallsDuringAudit: 0;
    totalRuntimeControlShellProcessCallsDuringAudit: 0;
    totalRuntimeControlWorkspaceWriteCallsDuringAudit: 0;
    totalRuntimeControlExternalWriteCallsDuringAudit: 0;
    totalOperatorActionExecutorGateInvocationsDuringAudit: 0;
    totalCodexCliHostProcessSpawnsDuringAudit: 0;
    totalPublicApiCallsDuringAudit: 0;
    totalAgentOsLocalRuntimeCallsDuringAudit: 0;
    totalAgentOsMcpServerManifestCallsDuringAudit: 0;
    totalAgentOsMcpServerManifestLiveServerStartsDuringAudit: 0;
    totalAgentOsMcpServerManifestLocalRuntimeCallsDuringAudit: 0;
    totalAgentOsMcpServerManifestToolRuntimeCallsDuringAudit: 0;
    totalAgentOsMcpServerManifestProviderExecuteCallsDuringAudit: 0;
    totalAgentOsMcpServerManifestCodexCliCallsDuringAudit: 0;
    totalAgentOsMcpServerManifestDesktopPrimitiveCallsDuringAudit: 0;
    totalAgentOsMcpServerManifestSubAgentRuntimeCallsDuringAudit: 0;
    totalAgentOsMcpServerManifestHostExecutorCallsDuringAudit: 0;
    totalAgentOsMcpServerManifestHostDispatchCallsDuringAudit: 0;
    totalAgentOsMcpServerManifestShellProcessCallsDuringAudit: 0;
    totalAgentOsMcpServerManifestNetworkCallsDuringAudit: 0;
    totalAgentOsMcpServerManifestWorkspaceWriteCallsDuringAudit: 0;
    totalAgentOsMcpServerManifestExternalWriteCallsDuringAudit: 0;
    totalProtocolMcpCallsDuringAudit: 0;
    totalProtocolMcpLiveServerConnectionsDuringAudit: 0;
    totalProtocolMcpToolRuntimeCallsDuringAudit: 0;
    totalProtocolMcpProviderExecuteCallsDuringAudit: 0;
    totalProtocolMcpCodexCliCallsDuringAudit: 0;
    totalProtocolMcpDesktopPrimitiveCallsDuringAudit: 0;
    totalProtocolMcpSubAgentRuntimeCallsDuringAudit: 0;
    totalProtocolMcpHostExecutorCallsDuringAudit: 0;
    totalProtocolMcpHostDispatchCallsDuringAudit: 0;
    totalProtocolMcpShellProcessCallsDuringAudit: 0;
    totalProtocolMcpNetworkCallsDuringAudit: 0;
    totalProtocolMcpWorkspaceWriteCallsDuringAudit: 0;
    totalProtocolMcpExternalWriteCallsDuringAudit: 0;
    totalProtocolA2aCallsDuringAudit: 0;
    totalProtocolA2aLiveNetworkServiceStartsDuringAudit: 0;
    totalProtocolA2aRemoteAgentRuntimeCallsDuringAudit: 0;
    totalProtocolA2aRemoteTaskCreationsDuringAudit: 0;
    totalProtocolA2aProviderExecuteCallsDuringAudit: 0;
    totalProtocolA2aCodexCliCallsDuringAudit: 0;
    totalProtocolA2aDesktopPrimitiveCallsDuringAudit: 0;
    totalProtocolA2aSubAgentRuntimeCallsDuringAudit: 0;
    totalProtocolA2aHostExecutorCallsDuringAudit: 0;
    totalProtocolA2aHostDispatchCallsDuringAudit: 0;
    totalProtocolA2aShellProcessCallsDuringAudit: 0;
    totalProtocolA2aNetworkCallsDuringAudit: 0;
    totalProtocolA2aWorkspaceWriteCallsDuringAudit: 0;
    totalProtocolA2aExternalWriteCallsDuringAudit: 0;
    totalAgentOsSdkCallsDuringAudit: 0;
    totalAgentOsSdkLocalRuntimeCallsDuringAudit: 0;
    totalAgentOsSdkProviderExecuteCallsDuringAudit: 0;
    totalAgentOsSdkCodexCliCallsDuringAudit: 0;
    totalAgentOsSdkDesktopPrimitiveCallsDuringAudit: 0;
    totalAgentOsSdkSubAgentRuntimeCallsDuringAudit: 0;
    totalAgentOsSdkHostExecutorCallsDuringAudit: 0;
    totalAgentOsSdkHostDispatchCallsDuringAudit: 0;
    totalAgentOsSdkShellProcessCallsDuringAudit: 0;
    totalAgentOsSdkNetworkCallsDuringAudit: 0;
    totalAgentOsSdkWorkspaceWriteCallsDuringAudit: 0;
    totalAgentOsSdkExternalWriteCallsDuringAudit: 0;
    totalAgentOsCliWrapperCallsDuringAudit: 0;
    totalAgentOsCliLocalRuntimeCallsDuringAudit: 0;
    totalAgentOsCliProviderExecuteCallsDuringAudit: 0;
    totalAgentOsCliCodexCliCallsDuringAudit: 0;
    totalAgentOsCliDesktopPrimitiveCallsDuringAudit: 0;
    totalAgentOsCliSubAgentRuntimeCallsDuringAudit: 0;
    totalAgentOsCliHostExecutorCallsDuringAudit: 0;
    totalAgentOsCliHostDispatchCallsDuringAudit: 0;
    totalAgentOsCliShellProcessCallsDuringAudit: 0;
    totalAgentOsCliNetworkCallsDuringAudit: 0;
    totalAgentOsCliWorkspaceWriteCallsDuringAudit: 0;
    totalAgentOsCliExternalWriteCallsDuringAudit: 0;
    totalAgentOsAppServerWrapperCallsDuringAudit: 0;
    totalAgentOsAppServerLocalRuntimeCallsDuringAudit: 0;
    totalAgentOsAppServerLiveHttpServerStartsDuringAudit: 0;
    totalAgentOsAppServerNetworkCallsDuringAudit: 0;
    totalAgentOsAppServerProviderExecuteCallsDuringAudit: 0;
    totalAgentOsAppServerCodexCliCallsDuringAudit: 0;
    totalAgentOsAppServerDesktopPrimitiveCallsDuringAudit: 0;
    totalAgentOsAppServerSubAgentRuntimeCallsDuringAudit: 0;
    totalAgentOsAppServerHostExecutorCallsDuringAudit: 0;
    totalAgentOsAppServerHostDispatchCallsDuringAudit: 0;
    totalAgentOsAppServerShellProcessCallsDuringAudit: 0;
    totalAgentOsAppServerWorkspaceWriteCallsDuringAudit: 0;
    totalAgentOsAppServerExternalWriteCallsDuringAudit: 0;
    totalAgentOsPublicSurfaceCallsDuringAudit: 0;
    totalAgentOsPublicSurfaceLocalRuntimeCallsDuringAudit: 0;
    totalAgentOsPublicSurfaceProviderExecuteCallsDuringAudit: 0;
    totalAgentOsPublicSurfaceCodexCliCallsDuringAudit: 0;
    totalAgentOsPublicSurfaceDesktopPrimitiveCallsDuringAudit: 0;
    totalAgentOsPublicSurfaceSubAgentRuntimeCallsDuringAudit: 0;
    totalAgentOsPublicSurfaceHostExecutorCallsDuringAudit: 0;
    totalAgentOsPublicSurfaceHostDispatchCallsDuringAudit: 0;
    totalAgentOsPublicSurfaceShellProcessCallsDuringAudit: 0;
    totalAgentOsPublicSurfaceNetworkCallsDuringAudit: 0;
    totalAgentOsPublicSurfaceWorkspaceWriteCallsDuringAudit: 0;
    totalAgentOsPublicSurfaceExternalWriteCallsDuringAudit: 0;
    totalProviderExecuteCallsDuringAudit: 0;
    totalPreflightCallsDuringAudit: 0;
    totalPreflightProviderExecuteCallsDuringAudit: 0;
    totalPreflightCodexCliCallsDuringAudit: 0;
    totalPreflightDesktopPrimitiveCallsDuringAudit: 0;
    totalPreflightSubAgentRuntimeCallsDuringAudit: 0;
    totalPreflightHostExecutorCallsDuringAudit: 0;
    totalPreflightHostDispatchCallsDuringAudit: 0;
    totalPreflightToolRuntimeCallsDuringAudit: 0;
    totalPreflightShellProcessCallsDuringAudit: 0;
    totalPreflightNetworkCallsDuringAudit: 0;
    totalPreflightWorkspaceWriteCallsDuringAudit: 0;
    totalPreflightExternalWriteCallsDuringAudit: 0;
    totalApprovalPermitCallsDuringAudit: 0;
    totalApprovalPermitValidationCallsDuringAudit: 0;
    totalApprovalPermitProviderExecuteCallsDuringAudit: 0;
    totalApprovalPermitCodexCliCallsDuringAudit: 0;
    totalApprovalPermitSubAgentRuntimeCallsDuringAudit: 0;
    totalApprovalPermitHostExecutorCallsDuringAudit: 0;
    totalApprovalPermitToolRuntimeCallsDuringAudit: 0;
    totalApprovalPermitShellProcessCallsDuringAudit: 0;
    totalApprovalPermitWorkspaceWriteCallsDuringAudit: 0;
    totalApprovalPermitExternalWriteCallsDuringAudit: 0;
    totalApprovalGateCallsDuringAudit: 0;
    totalApprovalGateResolutionChecksDuringAudit: 0;
    totalApprovalGateProviderExecuteCallsDuringAudit: 0;
    totalApprovalGateCodexCliCallsDuringAudit: 0;
    totalApprovalGateSubAgentRuntimeCallsDuringAudit: 0;
    totalApprovalGateHostExecutorCallsDuringAudit: 0;
    totalApprovalGateToolRuntimeCallsDuringAudit: 0;
    totalApprovalGateShellProcessCallsDuringAudit: 0;
    totalApprovalGateWorkspaceWriteCallsDuringAudit: 0;
    totalApprovalGateExternalWriteCallsDuringAudit: 0;
    totalApprovalConsumptionDispatchMatrixBoundaryProviderExecuteCallsDuringAudit: 0;
    totalApprovalConsumptionDispatchMatrixBoundaryCodexCliCallsDuringAudit: 0;
    totalApprovalConsumptionDispatchMatrixBoundaryWorkspaceWriteCallsDuringAudit: 0;
    totalApprovalConsumptionDispatchMatrixBoundaryHostExecutorCallsDuringAudit: 0;
    totalApprovalConsumptionDispatchMatrixBoundarySubAgentRuntimeCallsDuringAudit: 0;
    totalApprovalConsumptionDispatchMatrixBoundaryToolRuntimeCallsDuringAudit: 0;
    totalApprovalConsumptionDispatchMatrixBoundaryShellProcessCallsDuringAudit: 0;
    totalApprovalConsumptionDispatchMatrixBoundaryExternalWriteCallsDuringAudit: 0;
    totalApprovalConsumptionDispatchProviderExecuteCallsDuringAudit: 0;
    totalApprovalConsumptionDispatchCodexCliCallsDuringAudit: 0;
    totalApprovalConsumptionDispatchWorkspaceWriteCallsDuringAudit: 0;
    totalApprovalConsumptionDispatchHostExecutorCallsDuringAudit: 0;
    totalApprovalConsumptionDispatchSubAgentRuntimeCallsDuringAudit: 0;
    totalApprovalConsumptionDispatchShellProcessCallsDuringAudit: 0;
    totalApprovalConsumptionDispatchExternalWriteCallsDuringAudit: 0;
    totalReadonlyProductizationBoundaryProviderExecuteCallsDuringAudit: 0;
    totalReadonlyProductizationBoundaryCodexCliCallsDuringAudit: 0;
    totalReadonlyProductizationBoundaryWorkspaceWriteCallsDuringAudit: 0;
    totalReadonlyProductizationBoundaryHostExecutorCallsDuringAudit: 0;
    totalReadonlyProductizationBoundarySubAgentRuntimeCallsDuringAudit: 0;
    totalReadonlyProductizationBoundaryToolRuntimeCallsDuringAudit: 0;
    totalReadonlyProductizationBoundaryShellProcessCallsDuringAudit: 0;
    totalReadonlyProductizationBoundaryExternalWriteCallsDuringAudit: 0;
    totalReadonlyProductizationBoundaryEvidenceWritesDuringAudit: 0;
    totalStateSyncBoundaryProviderExecuteCallsDuringAudit: 0;
    totalStateSyncBoundaryCodexCliCallsDuringAudit: 0;
    totalStateSyncBoundaryWorkspaceWriteCallsDuringAudit: 0;
    totalStateSyncBoundaryLocalCommandCallsDuringAudit: 0;
    totalStateSyncBoundaryHostExecutorCallsDuringAudit: 0;
    totalStateSyncBoundarySubAgentRuntimeCallsDuringAudit: 0;
    totalStateSyncBoundaryToolRuntimeCallsDuringAudit: 0;
    totalStateSyncBoundaryExternalWriteCallsDuringAudit: 0;
    totalStateSyncBoundaryStateWritesDuringAudit: 0;
    totalStateSyncBoundaryRemoteWritesDuringAudit: 0;
    totalWorkspaceWriteReleaseGateProviderExecuteCallsDuringAudit: 0;
    totalWorkspaceWriteReleaseGateCodexCliCallsDuringAudit: 0;
    totalWorkspaceWriteReleaseGateWorkspaceWriteCallsDuringAudit: 0;
    totalWorkspaceWriteReleaseGateHostExecutorCallsDuringAudit: 0;
    totalWorkspaceWriteReleaseGateSubAgentRuntimeCallsDuringAudit: 0;
    totalWorkspaceWriteReleaseGateExternalWriteCallsDuringAudit: 0;
    totalWorkspaceWriteReleaseGateEvidenceWritesDuringAudit: 0;
    totalAdmissionControlCallsDuringAudit: 0;
    totalAdmissionControlProviderExecuteCallsDuringAudit: 0;
    totalAdmissionControlCodexCliCallsDuringAudit: 0;
    totalAdmissionControlSubAgentRuntimeCallsDuringAudit: 0;
    totalAdmissionControlHostExecutorCallsDuringAudit: 0;
    totalAdmissionControlToolRuntimeCallsDuringAudit: 0;
    totalAdmissionControlShellProcessCallsDuringAudit: 0;
    totalAdmissionControlWorkspaceWriteCallsDuringAudit: 0;
    totalAdmissionControlExternalWriteCallsDuringAudit: 0;
    totalDelegationPolicyCallsDuringAudit: 0;
    totalDelegationPolicyProposalLifecycleCallsDuringAudit: 0;
    totalDelegationPolicyFileStoreWritesDuringAudit: 0;
    totalDelegationPolicyProviderExecuteCallsDuringAudit: 0;
    totalDelegationPolicyCodexCliCallsDuringAudit: 0;
    totalDelegationPolicySubAgentRuntimeCallsDuringAudit: 0;
    totalDelegationPolicyHostExecutorCallsDuringAudit: 0;
    totalDelegationPolicyToolRuntimeCallsDuringAudit: 0;
    totalDelegationPolicyShellProcessCallsDuringAudit: 0;
    totalDelegationPolicyWorkspaceWriteCallsDuringAudit: 0;
    totalDelegationPolicyExternalWriteCallsDuringAudit: 0;
    totalExecutionEligibilityCallsDuringAudit: 0;
    totalExecutionEligibilityPermitStoreReadsDuringAudit: 0;
    totalExecutionEligibilityProviderPlanCreationCallsDuringAudit: 0;
    totalExecutionEligibilityProviderExecuteCallsDuringAudit: 0;
    totalExecutionEligibilityCodexCliCallsDuringAudit: 0;
    totalExecutionEligibilitySubAgentRuntimeCallsDuringAudit: 0;
    totalExecutionEligibilityHostExecutorCallsDuringAudit: 0;
    totalExecutionEligibilityHostDispatchCallsDuringAudit: 0;
    totalExecutionEligibilityShellProcessCallsDuringAudit: 0;
    totalExecutionEligibilityWorkspaceWriteCallsDuringAudit: 0;
    totalExecutionEligibilityExternalWriteCallsDuringAudit: 0;
    totalExecutionObservationBusEmitsDuringAudit: 0;
    totalExecutionObservationStoreWritesDuringAudit: 0;
    totalExecutionObservationProviderExecuteCallsDuringAudit: 0;
    totalExecutionObservationCodexCliCallsDuringAudit: 0;
    totalExecutionObservationSubAgentRuntimeCallsDuringAudit: 0;
    totalExecutionObservationHostExecutorCallsDuringAudit: 0;
    totalExecutionObservationHostDispatchCallsDuringAudit: 0;
    totalExecutionObservationShellProcessCallsDuringAudit: 0;
    totalExecutionObservationWorkspaceWriteCallsDuringAudit: 0;
    totalExecutionObservationExternalWriteCallsDuringAudit: 0;
    totalGovernanceFailureReducerCallbackCallsDuringAudit: 0;
    totalGovernanceFailureReducerPersistenceWritesDuringAudit: 0;
    totalGovernanceFailureReducerProviderExecuteCallsDuringAudit: 0;
    totalGovernanceFailureReducerCodexCliCallsDuringAudit: 0;
    totalGovernanceFailureReducerSubAgentRuntimeCallsDuringAudit: 0;
    totalGovernanceFailureReducerHostExecutorCallsDuringAudit: 0;
    totalGovernanceFailureReducerHostDispatchCallsDuringAudit: 0;
    totalGovernanceFailureReducerToolRuntimeCallsDuringAudit: 0;
    totalGovernanceFailureReducerShellProcessCallsDuringAudit: 0;
    totalGovernanceFailureReducerWorkspaceWriteCallsDuringAudit: 0;
    totalGovernanceFailureReducerExternalWriteCallsDuringAudit: 0;
    totalTaskGraphCallsDuringAudit: 0;
    totalTaskGraphStoreWritesDuringAudit: 0;
    totalTaskGraphProviderExecuteCallsDuringAudit: 0;
    totalTaskGraphCodexCliCallsDuringAudit: 0;
    totalTaskGraphSubAgentRuntimeCallsDuringAudit: 0;
    totalTaskGraphHostExecutorCallsDuringAudit: 0;
    totalTaskGraphHostDispatchCallsDuringAudit: 0;
    totalTaskGraphToolRuntimeCallsDuringAudit: 0;
    totalTaskGraphShellProcessCallsDuringAudit: 0;
    totalTaskGraphWorkspaceWriteCallsDuringAudit: 0;
    totalTaskGraphExternalWriteCallsDuringAudit: 0;
    totalSchedulerCallsDuringAudit: 0;
    totalSchedulerLeaseAcquisitionsDuringAudit: 0;
    totalSchedulerStateWritesDuringAudit: 0;
    totalSchedulerProviderExecuteCallsDuringAudit: 0;
    totalSchedulerCodexCliCallsDuringAudit: 0;
    totalSchedulerSubAgentRuntimeCallsDuringAudit: 0;
    totalSchedulerHostExecutorCallsDuringAudit: 0;
    totalSchedulerHostDispatchCallsDuringAudit: 0;
    totalSchedulerToolRuntimeCallsDuringAudit: 0;
    totalSchedulerShellProcessCallsDuringAudit: 0;
    totalSchedulerWorkspaceWriteCallsDuringAudit: 0;
    totalSchedulerExternalWriteCallsDuringAudit: 0;
    totalExecutionPlannerCallsDuringAudit: 0;
    totalExecutionPlannerLocalPlanStoreWritesDuringAudit: 0;
    totalExecutionPlannerProviderPlanExecutionCallsDuringAudit: 0;
    totalExecutionPlannerProviderValidateExecutionPlanCallsDuringAudit: 0;
    totalExecutionPlannerProviderExecuteCallsDuringAudit: 0;
    totalExecutionPlannerCodexCliCallsDuringAudit: 0;
    totalExecutionPlannerSubAgentRuntimeCallsDuringAudit: 0;
    totalExecutionPlannerHostExecutorCallsDuringAudit: 0;
    totalExecutionPlannerHostDispatchCallsDuringAudit: 0;
    totalExecutionPlannerShellProcessCallsDuringAudit: 0;
    totalExecutionPlannerWorkspaceWriteCallsDuringAudit: 0;
    totalExecutionPlannerExternalWriteCallsDuringAudit: 0;
    totalProviderRegistryCallsDuringAudit: 0;
    totalProviderRegistrySelectionCallsDuringAudit: 0;
    totalProviderRegistryProviderExecuteCallsDuringAudit: 0;
    totalProviderRegistryCodexCliCallsDuringAudit: 0;
    totalProviderRegistrySubAgentRuntimeCallsDuringAudit: 0;
    totalProviderRegistryHostExecutorCallsDuringAudit: 0;
    totalProviderRegistryToolRuntimeCallsDuringAudit: 0;
    totalProviderRegistryShellProcessCallsDuringAudit: 0;
    totalProviderRegistryWorkspaceWriteCallsDuringAudit: 0;
    totalProviderRegistryExternalWriteCallsDuringAudit: 0;
    totalProviderExecutionRunnerCallsDuringAudit: 0;
    totalProviderExecutionRunnerPlanExecutionCallsDuringAudit: 0;
    totalProviderExecutionRunnerValidateExecutionPlanCallsDuringAudit: 0;
    totalProviderExecutionRunnerExecuteCallsDuringAudit: 0;
    totalProviderCoreRuntimeCallsDuringAudit: 0;
    totalToolRegistryCallsDuringAudit: 0;
    totalToolInvocationPlansDuringAudit: 0;
    totalToolInvocationPlannerToolRuntimeCallsDuringAudit: 0;
    totalToolInvocationPlannerProviderExecuteCallsDuringAudit: 0;
    totalToolInvocationPlannerCodexCliCallsDuringAudit: 0;
    totalToolInvocationPlannerSubAgentRuntimeCallsDuringAudit: 0;
    totalToolInvocationPlannerHostExecutorCallsDuringAudit: 0;
    totalToolInvocationPlannerShellProcessCallsDuringAudit: 0;
    totalToolInvocationPlannerWorkspaceWriteCallsDuringAudit: 0;
    totalToolInvocationPlannerExternalWriteCallsDuringAudit: 0;
    totalDesktopAgentStrategyCallsDuringAudit: 0;
    totalDesktopAgentStrategyProviderExecuteCallsDuringAudit: 0;
    totalDesktopAgentStrategyCodexCliCallsDuringAudit: 0;
    totalDesktopAgentStrategyDesktopPrimitiveCallsDuringAudit: 0;
    totalDesktopAgentStrategySubAgentRuntimeCallsDuringAudit: 0;
    totalDesktopAgentStrategyHostExecutorCallsDuringAudit: 0;
    totalDesktopAgentStrategyHostDispatchCallsDuringAudit: 0;
    totalDesktopAgentStrategyShellProcessCallsDuringAudit: 0;
    totalDesktopAgentStrategyWorkspaceWriteCallsDuringAudit: 0;
    totalDesktopAgentStrategyExternalWriteCallsDuringAudit: 0;
    totalDesktopDecisionRunnerCallsDuringAudit: 0;
    totalDesktopDecisionRunnerHostDispatchCallsDuringAudit: 0;
    totalDesktopDecisionRunnerProviderExecuteCallsDuringAudit: 0;
    totalFinalHostLocatorCallsDuringAudit: 0;
    totalFinalHostLocatorHostExecutorCallsDuringAudit: 0;
    totalFinalHostLocatorHostDispatchCallsDuringAudit: 0;
    totalFinalHostLocatorProviderExecuteCallsDuringAudit: 0;
    totalFinalHostLocatorCodexCliCallsDuringAudit: 0;
    totalFinalHostLocatorSubAgentRuntimeCallsDuringAudit: 0;
    totalFinalHostLocatorShellProcessCallsDuringAudit: 0;
    totalFinalHostLocatorWorkspaceWriteCallsDuringAudit: 0;
    totalFinalHostLocatorExternalWriteCallsDuringAudit: 0;
    totalRemoteAgentRuntimeCallsDuringAudit: 0;
    totalToolRuntimeCallsDuringAudit: 0;
    totalHostDispatcherProviderDispatchCallsDuringAudit: 0;
    totalCodexDesktopBridgeCallsDuringAudit: 0;
    totalCodexDesktopRuntimeToolCallsDuringAudit: 0;
    totalCodexDesktopLiveHostBundleCreationsDuringAudit: 0;
    totalCodexDesktopLiveHostRuntimeToolCallsDuringAudit: 0;
    totalCodexDesktopLiveHostMemoryToolCallsDuringAudit: 0;
    totalCodexDesktopLiveHostBridgeCallsDuringAudit: 0;
    totalCodexDesktopLiveHostClientRunCallsDuringAudit: 0;
    totalCodexDesktopLiveHostSmokeRunsDuringAudit: 0;
    totalCodexMemoryMcpClientMcpHttpCallsDuringAudit: 0;
    totalCodexMemoryMcpClientMemoryToolCallsDuringAudit: 0;
    totalCodexMemoryMcpClientHostExecutorInvocationsDuringAudit: 0;
    totalCodexMemoryMcpClientCodexCliCallsDuringAudit: 0;
    totalCodexMemoryMcpClientProviderExecuteCallsDuringAudit: 0;
    totalCodexMemoryMcpClientSubAgentRuntimeCallsDuringAudit: 0;
    totalCodexMemoryMcpClientShellProcessCallsDuringAudit: 0;
    totalCodexMemoryMcpClientWorkspaceWriteCallsDuringAudit: 0;
    totalCodexMemoryMcpClientExternalWriteCallsDuringAudit: 0;
    totalCodexMemoryHostClientCallsDuringAudit: 0;
    totalCodexMemoryHostClientMemoryOperationCallsDuringAudit: 0;
    totalCodexMemoryHostClientHostExecutorInvocationsDuringAudit: 0;
    totalCodexMemoryHostClientCodexCliCallsDuringAudit: 0;
    totalCodexMemoryHostClientProviderExecuteCallsDuringAudit: 0;
    totalCodexMemoryHostClientSubAgentRuntimeCallsDuringAudit: 0;
    totalCodexMemoryHostClientShellProcessCallsDuringAudit: 0;
    totalCodexMemoryHostClientWorkspaceWriteCallsDuringAudit: 0;
    totalCodexMemoryHostClientExternalWriteCallsDuringAudit: 0;
    totalDesktopHostClientCallsDuringAudit: 0;
    totalDesktopHostClientLiveAdapterCallsDuringAudit: 0;
    totalDesktopHostClientHostExecutorInvocationsDuringAudit: 0;
    totalDesktopHostClientDispatchToHostCallsDuringAudit: 0;
    totalDesktopLiveAdapterCallsDuringAudit: 0;
    totalDesktopLiveAdapterDispatchToHostCallsDuringAudit: 0;
    totalDesktopLiveAdapterBridgeCallsDuringAudit: 0;
    totalHostClientExampleCallsDuringAudit: 0;
    totalHostClientExampleLiveAdapterCallsDuringAudit: 0;
    totalHostClientExampleHostExecutorInvocationsDuringAudit: 0;
    totalTargetHostEmbeddingBundleCreationsDuringAudit: 0;
    totalTargetHostEmbeddingHostClientRunCallsDuringAudit: 0;
    totalTargetHostEmbeddingHostExecutorInvocationsDuringAudit: 0;
    totalTargetHostEmbeddingCodexCliCallsDuringAudit: 0;
    totalTargetHostEmbeddingProviderExecuteCallsDuringAudit: 0;
    totalTargetHostEmbeddingSubAgentRuntimeCallsDuringAudit: 0;
    totalTargetHostEmbeddingShellProcessCallsDuringAudit: 0;
    totalTargetHostEmbeddingWorkspaceWriteCallsDuringAudit: 0;
    totalTargetHostEmbeddingExternalWriteCallsDuringAudit: 0;
    totalHostExecutorInvocationsDuringAudit: 0;
    totalHostExecutorTaskbookDispatchCallsDuringAudit: 0;
    totalHostClientReviewBridgeCallsDuringAudit: 0;
    totalHostClientReviewDispatchCallsDuringAudit: 0;
    totalHostExecutorReceiptInvocationsDuringAudit: 0;
    totalAgentBackedSandboxExecutorInvocationsDuringAudit: 0;
    totalAgentExecutorAdapterTaskbookInvocationsDuringAudit: 0;
    totalAgentExecutorAdapterReviewInvocationsDuringAudit: 0;
    totalAgentExecutorAdapterInvocationsDuringAudit: 0;
    totalAgentTaskControlTaskbookInvocationsDuringAudit: 0;
    totalAgentTaskControlReviewInvocationsDuringAudit: 0;
    totalSubAgentRuntimeCallsDuringAudit: 0;
    totalShellProcessCallsDuringAudit: 0;
    totalWorkspaceWriteCallsDuringAudit: 0;
    totalExternalWriteCallsDuringAudit: 0;
    totalAdapterInvocationsDuringAudit: 0;
  };
  reasons: string[];
}

export type ExecutionBoundaryCurrentSurfaceAuditOutputFormat = "text" | "json";

export async function collectExecutionBoundaryCurrentSurfaceAuditInput(
  cwd = process.cwd()
): Promise<ExecutionBoundaryCurrentSurfaceAuditInput> {
  const [
    governanceControlPlaneText,
    governanceReadmeText,
    governanceValidationTiersText,
    currentStateText,
    governanceRunnerText,
    ciWorkflowText,
    strategyRouterInput,
    executionProfilesInput,
    policyConfigInput,
    capabilityTaxonomyInput,
    capabilityTaxonomyEscalationPolicyInput,
    routingEngineInput,
    recoveryControlInput,
    runtimeControlInput,
    operatorActionExecutorGateInput,
    codexCliHostInput,
    publicApiInput,
    agentOsLocalRuntimeInput,
    agentOsMcpServerManifestInput,
    protocolMcpProviderSkeletonInput,
    protocolA2aRemoteProviderSkeletonInput,
    agentOsSdkInput,
    agentOsCliInput,
    agentOsAppServerInput,
    agentOsPublicSurfacesInput,
    codexProviderInput,
    preflightInput,
    approvalPermitInput,
    approvalGateInput,
    approvalConsumptionDispatchMatrixInput,
    approvalConsumptionDispatchInput,
    readonlyProductizationInput,
    stateSyncInput,
    workspaceWriteReleaseGateInput,
    admissionControlInput,
    delegationPolicyInput,
    executionEligibilityInput,
    executionObservationInput,
    governanceFailureReducerInput,
    taskGraphInput,
    schedulerInput,
    executionPlannerInput,
    providerRegistryInput,
    controlledProviderExecutionTaskbookInput,
    controlledProviderExecutionTaskbookReviewBoundaryInput,
    controlledProviderExecutionDispatchPreflightInput,
    controlledProviderExecutionDispatcherInput,
    providerExecutionRunnerInput,
    providerCorePrimitivesInput,
    toolInvocationPlannerInput,
    desktopAgentStrategyInput,
    desktopDecisionRunnerInput,
    finalHostLocatorInput,
    hostDispatcherProviderInput,
    codexDesktopBridgeInput,
    codexDesktopLiveHostInput,
    codexMemoryMcpClientInput,
    codexMemoryHostClientInput,
    desktopHostClientInput,
    desktopLiveAdapterDispatchInput,
    hostClientExampleInput,
    targetHostEmbeddingInput,
    hostExecutorInput,
    hostExecutorTaskbookInput,
    hostClientExecutorReviewInput,
    hostExecutorReceiptInput,
    agentBackedRecoveryExecutorInput,
    agentExecutorAdapterTaskbookInput,
    agentExecutorAdapterReviewInput,
    agentExecutorAdapterSandboxInput,
    agentTaskControlTaskbookInput,
    agentTaskControlReviewInput,
    subAgentRuntimeInput,
    agentTaskControlInput
  ] = await Promise.all([
    read(cwd, GOVERNANCE_CONTROL_PLANE),
    read(cwd, GOVERNANCE_README),
    read(cwd, GOVERNANCE_VALIDATION_TIERS),
    read(cwd, CURRENT_STATE),
    read(cwd, GOVERNANCE_RUNNER),
    read(cwd, CI_WORKFLOW),
    collectStrategyRouterExecutionBoundaryAuditInput(cwd),
    collectExecutionProfilesBoundaryAuditInput(cwd),
    collectPolicyConfigBoundaryAuditInput(cwd),
    collectCapabilityTaxonomyBoundaryAuditInput(cwd),
    collectCapabilityTaxonomyEscalationPolicyBoundaryAuditInput(cwd),
    collectRoutingEngineBoundaryAuditInput(cwd),
    collectRecoveryControlOrchestrationBoundaryAuditInput(cwd),
    collectRuntimeControlBoundaryAuditInput(cwd),
    collectOperatorActionExecutorGateBoundaryAuditInput(cwd),
    collectCodexCliHostBoundaryAuditInput(cwd),
    collectPublicApiExecutionBoundaryAuditInput(cwd),
    collectAgentOsLocalRuntimeBoundaryAuditInput(cwd),
    collectAgentOsMcpServerManifestBoundaryAuditInput(cwd),
    collectProtocolMcpProviderSkeletonBoundaryAuditInput(cwd),
    collectProtocolA2aRemoteProviderSkeletonBoundaryAuditInput(cwd),
    collectAgentOsSdkBoundaryAuditInput(cwd),
    collectAgentOsCliBoundaryAuditInput(cwd),
    collectAgentOsAppServerBoundaryAuditInput(cwd),
    collectAgentOsPublicSurfacesBoundaryAuditInput(cwd),
    collectCodexProviderExecutionBoundaryAuditInput(cwd),
    collectPreflightBoundaryAuditInput(cwd),
    collectApprovalPermitBoundaryAuditInput(cwd),
    collectApprovalGateBoundaryAuditInput(cwd),
    collectApprovalConsumptionDispatchMatrixBoundaryAuditInput(cwd),
    collectApprovalConsumptionDispatchBoundaryAuditInput(cwd),
    collectReadonlyProductizationBoundaryAuditInput(cwd),
    collectStateSyncBoundaryAuditInput(cwd),
    collectWorkspaceWriteReleaseGateAuditInput(cwd),
    collectAdmissionControlBoundaryAuditInput(cwd),
    collectDelegationPolicyBoundaryAuditInput(cwd),
    collectExecutionEligibilityBoundaryAuditInput(cwd),
    collectExecutionObservationBoundaryAuditInput(cwd),
    collectGovernanceFailureReducerBoundaryAuditInput(cwd),
    collectTaskGraphBoundaryAuditInput(cwd),
    collectSchedulerBoundaryAuditInput(cwd),
    collectExecutionPlannerBoundaryAuditInput(cwd),
    collectProviderRegistryBoundaryAuditInput(cwd),
    collectControlledProviderExecutionTaskbookBoundaryAuditInput(cwd),
    collectControlledProviderExecutionTaskbookReviewBoundaryAuditInput(cwd),
    collectControlledProviderExecutionDispatchPreflightBoundaryAuditInput(cwd),
    collectControlledProviderExecutionDispatcherBoundaryAuditInput(cwd),
    collectProviderExecutionRunnerBoundaryAuditInput(cwd),
    collectProviderCoreExecutionPrimitivesBoundaryAuditInput(cwd),
    collectToolInvocationPlannerBoundaryAuditInput(cwd),
    collectDesktopAgentStrategyBoundaryAuditInput(cwd),
    collectDesktopDecisionRunnerBoundaryAuditInput(cwd),
    collectFinalHostLocatorBoundaryAuditInput(cwd),
    collectHostDispatcherProviderBoundaryAuditInput(cwd),
    collectCodexDesktopBridgeBoundaryAuditInput(cwd),
    collectCodexDesktopLiveHostBoundaryAuditInput(cwd),
    collectCodexMemoryMcpClientBoundaryAuditInput(cwd),
    collectCodexMemoryHostClientBoundaryAuditInput(cwd),
    collectDesktopHostClientBoundaryAuditInput(cwd),
    collectDesktopLiveAdapterDispatchBoundaryAuditInput(cwd),
    collectHostClientExampleBoundaryAuditInput(cwd),
    collectTargetHostEmbeddingBoundaryAuditInput(cwd),
    collectHostExecutorBoundaryAuditInput(cwd),
    collectHostExecutorTaskbookBoundaryAuditInput(cwd),
    collectHostClientExecutorReviewBoundaryAuditInput(cwd),
    collectHostExecutorReceiptBoundaryAuditInput(cwd),
    collectAgentBackedRecoveryExecutorBoundaryAuditInput(cwd),
    collectAgentExecutorAdapterTaskbookBoundaryAuditInput(cwd),
    collectAgentExecutorAdapterReviewBoundaryAuditInput(cwd),
    collectAgentExecutorAdapterSandboxBoundaryAuditInput(cwd),
    collectAgentTaskControlTaskbookBoundaryAuditInput(cwd),
    collectAgentTaskControlReviewBoundaryAuditInput(cwd),
    collectSubAgentRuntimeBoundaryAuditInput(cwd),
    collectAgentTaskControlSandboxBoundaryAuditInput(cwd)
  ]);

  return {
    governanceControlPlaneText,
    governanceReadmeText,
    governanceValidationTiersText,
    currentStateText,
    governanceRunnerText,
    ciWorkflowText,
    strategyRouterReview:
      reviewStrategyRouterExecutionBoundaryAudit(strategyRouterInput),
    executionProfilesReview:
      reviewExecutionProfilesBoundaryAudit(executionProfilesInput),
    policyConfigReview:
      reviewPolicyConfigBoundaryAudit(policyConfigInput),
    capabilityTaxonomyReview:
      reviewCapabilityTaxonomyBoundaryAudit(capabilityTaxonomyInput),
    capabilityTaxonomyEscalationPolicyReview:
      reviewCapabilityTaxonomyEscalationPolicyBoundaryAudit(
        capabilityTaxonomyEscalationPolicyInput
      ),
    routingEngineReview:
      reviewRoutingEngineBoundaryAudit(routingEngineInput),
    recoveryControlReview:
      reviewRecoveryControlOrchestrationBoundaryAudit(recoveryControlInput),
    runtimeControlReview:
      reviewRuntimeControlBoundaryAudit(runtimeControlInput),
    operatorActionExecutorGateReview:
      reviewOperatorActionExecutorGateBoundaryAudit(
        operatorActionExecutorGateInput
      ),
    codexCliHostReview: reviewCodexCliHostBoundaryAudit(codexCliHostInput),
    publicApiReview: reviewPublicApiExecutionBoundaryAudit(publicApiInput),
    agentOsLocalRuntimeReview:
      reviewAgentOsLocalRuntimeBoundaryAudit(agentOsLocalRuntimeInput),
    agentOsMcpServerManifestReview:
      reviewAgentOsMcpServerManifestBoundaryAudit(agentOsMcpServerManifestInput),
    protocolMcpProviderSkeletonReview:
      reviewProtocolMcpProviderSkeletonBoundaryAudit(
        protocolMcpProviderSkeletonInput
      ),
    protocolA2aRemoteProviderSkeletonReview:
      reviewProtocolA2aRemoteProviderSkeletonBoundaryAudit(
        protocolA2aRemoteProviderSkeletonInput
      ),
    agentOsSdkReview:
      reviewAgentOsSdkBoundaryAudit(agentOsSdkInput),
    agentOsCliReview:
      reviewAgentOsCliBoundaryAudit(agentOsCliInput),
    agentOsAppServerReview:
      reviewAgentOsAppServerBoundaryAudit(agentOsAppServerInput),
    agentOsPublicSurfacesReview:
      reviewAgentOsPublicSurfacesBoundaryAudit(agentOsPublicSurfacesInput),
    codexProviderReview: reviewCodexProviderExecutionBoundaryAudit(codexProviderInput),
    preflightReview: reviewPreflightBoundaryAudit(preflightInput),
    approvalPermitReview: reviewApprovalPermitBoundaryAudit(approvalPermitInput),
    approvalGateReview: reviewApprovalGateBoundaryAudit(approvalGateInput),
    approvalConsumptionDispatchMatrixReview:
      reviewApprovalConsumptionDispatchMatrixBoundaryAudit(
        approvalConsumptionDispatchMatrixInput
      ),
    approvalConsumptionDispatchReview:
      reviewApprovalConsumptionDispatchBoundaryAudit(
        approvalConsumptionDispatchInput
      ),
    readonlyProductizationReview:
      reviewReadonlyProductizationBoundaryAudit(readonlyProductizationInput),
    stateSyncReview:
      reviewStateSyncBoundaryAudit(stateSyncInput),
    workspaceWriteReleaseGateReview:
      reviewWorkspaceWriteReleaseGateAudit(workspaceWriteReleaseGateInput),
    admissionControlReview:
      reviewAdmissionControlBoundaryAudit(admissionControlInput),
    delegationPolicyReview:
      reviewDelegationPolicyBoundaryAudit(delegationPolicyInput),
    executionEligibilityReview:
      reviewExecutionEligibilityBoundaryAudit(executionEligibilityInput),
    executionObservationReview:
      reviewExecutionObservationBoundaryAudit(executionObservationInput),
    governanceFailureReducerReview:
      reviewGovernanceFailureReducerBoundaryAudit(governanceFailureReducerInput),
    taskGraphReview: reviewTaskGraphBoundaryAudit(taskGraphInput),
    schedulerReview: reviewSchedulerBoundaryAudit(schedulerInput),
    executionPlannerReview:
      reviewExecutionPlannerBoundaryAudit(executionPlannerInput),
    providerRegistryReview:
      reviewProviderRegistryBoundaryAudit(providerRegistryInput),
    controlledProviderExecutionTaskbookReview:
      reviewControlledProviderExecutionTaskbookBoundaryAudit(
        controlledProviderExecutionTaskbookInput
      ),
    controlledProviderExecutionTaskbookReviewBoundaryReview:
      reviewControlledProviderExecutionTaskbookReviewBoundaryAudit(
        controlledProviderExecutionTaskbookReviewBoundaryInput
      ),
    controlledProviderExecutionDispatchPreflightReview:
      reviewControlledProviderExecutionDispatchPreflightBoundaryAudit(
        controlledProviderExecutionDispatchPreflightInput
      ),
    controlledProviderExecutionDispatcherReview:
      reviewControlledProviderExecutionDispatcherBoundaryAudit(
        controlledProviderExecutionDispatcherInput
      ),
    providerExecutionRunnerReview:
      reviewProviderExecutionRunnerBoundaryAudit(providerExecutionRunnerInput),
    providerCorePrimitivesReview:
      reviewProviderCoreExecutionPrimitivesBoundaryAudit(
        providerCorePrimitivesInput
      ),
    toolInvocationPlannerReview:
      reviewToolInvocationPlannerBoundaryAudit(toolInvocationPlannerInput),
    desktopAgentStrategyReview:
      reviewDesktopAgentStrategyBoundaryAudit(desktopAgentStrategyInput),
    desktopDecisionRunnerReview:
      reviewDesktopDecisionRunnerBoundaryAudit(desktopDecisionRunnerInput),
    finalHostLocatorReview:
      reviewFinalHostLocatorBoundaryAudit(finalHostLocatorInput),
    hostDispatcherProviderReview:
      reviewHostDispatcherProviderBoundaryAudit(hostDispatcherProviderInput),
    codexDesktopBridgeReview:
      reviewCodexDesktopBridgeBoundaryAudit(codexDesktopBridgeInput),
    codexDesktopLiveHostReview:
      reviewCodexDesktopLiveHostBoundaryAudit(codexDesktopLiveHostInput),
    codexMemoryMcpClientReview:
      reviewCodexMemoryMcpClientBoundaryAudit(codexMemoryMcpClientInput),
    codexMemoryHostClientReview:
      reviewCodexMemoryHostClientBoundaryAudit(codexMemoryHostClientInput),
    desktopHostClientReview:
      reviewDesktopHostClientBoundaryAudit(desktopHostClientInput),
    desktopLiveAdapterDispatchReview:
      reviewDesktopLiveAdapterDispatchBoundaryAudit(desktopLiveAdapterDispatchInput),
    hostClientExampleReview:
      reviewHostClientExampleBoundaryAudit(hostClientExampleInput),
    targetHostEmbeddingReview:
      reviewTargetHostEmbeddingBoundaryAudit(targetHostEmbeddingInput),
    hostExecutorReview: reviewHostExecutorBoundaryAudit(hostExecutorInput),
    hostExecutorTaskbookReview:
      reviewHostExecutorTaskbookBoundaryAudit(hostExecutorTaskbookInput),
    hostClientExecutorReviewReview:
      reviewHostClientExecutorReviewBoundaryAudit(hostClientExecutorReviewInput),
    hostExecutorReceiptReview:
      reviewHostExecutorReceiptBoundaryAudit(hostExecutorReceiptInput),
    agentBackedRecoveryExecutorReview:
      reviewAgentBackedRecoveryExecutorBoundaryAudit(
        agentBackedRecoveryExecutorInput
      ),
    agentExecutorAdapterTaskbookReview:
      reviewAgentExecutorAdapterTaskbookBoundaryAudit(
        agentExecutorAdapterTaskbookInput
      ),
    agentExecutorAdapterReviewReview:
      reviewAgentExecutorAdapterReviewBoundaryAudit(
        agentExecutorAdapterReviewInput
      ),
    agentExecutorAdapterSandboxReview:
      reviewAgentExecutorAdapterSandboxBoundaryAudit(
        agentExecutorAdapterSandboxInput
      ),
    agentTaskControlTaskbookReview:
      reviewAgentTaskControlTaskbookBoundaryAudit(agentTaskControlTaskbookInput),
    agentTaskControlReviewReview:
      reviewAgentTaskControlReviewBoundaryAudit(agentTaskControlReviewInput),
    subAgentRuntimeReview: reviewSubAgentRuntimeBoundaryAudit(subAgentRuntimeInput),
    agentTaskControlReview: reviewAgentTaskControlSandboxBoundaryAudit(
      agentTaskControlInput
    )
  };
}

export function reviewExecutionBoundaryCurrentSurfaceAudit(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): ExecutionBoundaryCurrentSurfaceAuditResult {
  const checks = {
    allComponentAuditsPassed: allComponentAuditsPassed(input),
    governanceRunnerRegistersAllCurrentAudits:
      REQUIRED_CURRENT_AUDITS.every((audit) =>
        input.governanceRunnerText.includes(`auditCheck("${audit}"`)
      ),
    governanceReadmeListsAllCurrentAudits:
      REQUIRED_CURRENT_AUDITS.every((audit) =>
        input.governanceReadmeText.includes(`npm run governance -- audit ${audit}`)
      ),
    controlPlaneRecordsAllBoundaries: controlPlaneRecordsAllBoundaries(
      input.governanceControlPlaneText
    ),
    entryDocsRecordExecutionAuthorityLattice:
      entryDocsRecordExecutionAuthorityLattice(input),
    currentStateRecordsExecutionAuthorityLattice:
      currentStateRecordsExecutionAuthorityLattice(input.currentStateText),
    ciWorkflowRunsCurrentSurfaceGate:
      ciWorkflowRunsCurrentSurfaceGate(input.ciWorkflowText),
    strategyRouterBoundaryConstrained:
      strategyRouterBoundaryConstrained(input),
    executionProfilesBoundaryConstrained:
      executionProfilesBoundaryConstrained(input),
    policyConfigBoundaryConstrained:
      policyConfigBoundaryConstrained(input),
    capabilityTaxonomyBoundaryConstrained:
      capabilityTaxonomyBoundaryConstrained(input),
    capabilityTaxonomyEscalationPolicyBoundaryConstrained:
      capabilityTaxonomyEscalationPolicyBoundaryConstrained(input),
    routingEngineBoundaryConstrained:
      routingEngineBoundaryConstrained(input),
    recoveryControlBoundaryConstrained:
      recoveryControlBoundaryConstrained(input),
    runtimeControlBoundaryConstrained:
      runtimeControlBoundaryConstrained(input),
    operatorActionExecutorGateBoundaryConstrained:
      operatorActionExecutorGateBoundaryConstrained(input),
    codexCliHostBoundaryConstrained: codexCliHostBoundaryConstrained(input),
    publicApiBoundaryConstrained: publicApiBoundaryConstrained(input),
    agentOsLocalRuntimeBoundaryConstrained:
      agentOsLocalRuntimeBoundaryConstrained(input),
    agentOsMcpServerManifestBoundaryConstrained:
      agentOsMcpServerManifestBoundaryConstrained(input),
    protocolMcpProviderSkeletonBoundaryConstrained:
      protocolMcpProviderSkeletonBoundaryConstrained(input),
    protocolA2aRemoteProviderSkeletonBoundaryConstrained:
      protocolA2aRemoteProviderSkeletonBoundaryConstrained(input),
    agentOsSdkBoundaryConstrained:
      agentOsSdkBoundaryConstrained(input),
    agentOsCliBoundaryConstrained:
      agentOsCliBoundaryConstrained(input),
    agentOsAppServerBoundaryConstrained:
      agentOsAppServerBoundaryConstrained(input),
    agentOsPublicSurfacesBoundaryConstrained:
      agentOsPublicSurfacesBoundaryConstrained(input),
    codexProviderBoundaryConstrained: codexProviderBoundaryConstrained(input),
    preflightBoundaryConstrained: preflightBoundaryConstrained(input),
    approvalPermitBoundaryConstrained: approvalPermitBoundaryConstrained(input),
    approvalGateBoundaryConstrained: approvalGateBoundaryConstrained(input),
    approvalConsumptionDispatchMatrixBoundaryConstrained:
      approvalConsumptionDispatchMatrixBoundaryConstrained(input),
    approvalConsumptionDispatchBoundaryConstrained:
      approvalConsumptionDispatchBoundaryConstrained(input),
    readonlyProductizationBoundaryConstrained:
      readonlyProductizationBoundaryConstrained(input),
    stateSyncBoundaryConstrained:
      stateSyncBoundaryConstrained(input),
    workspaceWriteReleaseGateBoundaryConstrained:
      workspaceWriteReleaseGateBoundaryConstrained(input),
    admissionControlBoundaryConstrained:
      admissionControlBoundaryConstrained(input),
    delegationPolicyBoundaryConstrained:
      delegationPolicyBoundaryConstrained(input),
    executionEligibilityBoundaryConstrained:
      executionEligibilityBoundaryConstrained(input),
    executionObservationBoundaryConstrained:
      executionObservationBoundaryConstrained(input),
    governanceFailureReducerBoundaryConstrained:
      governanceFailureReducerBoundaryConstrained(input),
    taskGraphBoundaryConstrained: taskGraphBoundaryConstrained(input),
    schedulerBoundaryConstrained: schedulerBoundaryConstrained(input),
    executionPlannerBoundaryConstrained:
      executionPlannerBoundaryConstrained(input),
    providerRegistryBoundaryConstrained:
      providerRegistryBoundaryConstrained(input),
    controlledProviderExecutionTaskbookBoundaryConstrained:
      controlledProviderExecutionTaskbookBoundaryConstrained(input),
    controlledProviderExecutionTaskbookReviewBoundaryConstrained:
      controlledProviderExecutionTaskbookReviewBoundaryConstrained(input),
    controlledProviderExecutionDispatchPreflightBoundaryConstrained:
      controlledProviderExecutionDispatchPreflightBoundaryConstrained(input),
    controlledProviderExecutionDispatcherBoundaryConstrained:
      controlledProviderExecutionDispatcherBoundaryConstrained(input),
    providerExecutionRunnerBoundaryConstrained:
      providerExecutionRunnerBoundaryConstrained(input),
    providerCorePrimitivesBoundaryConstrained:
      providerCorePrimitivesBoundaryConstrained(input),
    toolInvocationPlannerBoundaryConstrained:
      toolInvocationPlannerBoundaryConstrained(input),
    desktopAgentStrategyBoundaryConstrained:
      desktopAgentStrategyBoundaryConstrained(input),
    desktopDecisionRunnerBoundaryConstrained:
      desktopDecisionRunnerBoundaryConstrained(input),
    finalHostLocatorBoundaryConstrained:
      finalHostLocatorBoundaryConstrained(input),
    hostDispatcherProviderBoundaryConstrained:
      hostDispatcherProviderBoundaryConstrained(input),
    codexDesktopBridgeBoundaryConstrained:
      codexDesktopBridgeBoundaryConstrained(input),
    codexDesktopLiveHostBoundaryConstrained:
      codexDesktopLiveHostBoundaryConstrained(input),
    codexMemoryMcpClientBoundaryConstrained:
      codexMemoryMcpClientBoundaryConstrained(input),
    codexMemoryHostClientBoundaryConstrained:
      codexMemoryHostClientBoundaryConstrained(input),
    desktopHostClientBoundaryConstrained:
      desktopHostClientBoundaryConstrained(input),
    desktopLiveAdapterDispatchBoundaryConstrained:
      desktopLiveAdapterDispatchBoundaryConstrained(input),
    hostClientExampleBoundaryConstrained:
      hostClientExampleBoundaryConstrained(input),
    targetHostEmbeddingBoundaryConstrained:
      targetHostEmbeddingBoundaryConstrained(input),
    hostExecutorBoundaryConstrained: hostExecutorBoundaryConstrained(input),
    hostExecutorTaskbookBoundaryConstrained:
      hostExecutorTaskbookBoundaryConstrained(input),
    hostClientExecutorReviewBoundaryConstrained:
      hostClientExecutorReviewBoundaryConstrained(input),
    hostExecutorReceiptBoundaryConstrained:
      hostExecutorReceiptBoundaryConstrained(input),
    agentBackedRecoveryExecutorBoundaryConstrained:
      agentBackedRecoveryExecutorBoundaryConstrained(input),
    agentExecutorAdapterTaskbookBoundaryConstrained:
      agentExecutorAdapterTaskbookBoundaryConstrained(input),
    agentExecutorAdapterReviewBoundaryConstrained:
      agentExecutorAdapterReviewBoundaryConstrained(input),
    agentExecutorAdapterSandboxBoundaryConstrained:
      agentExecutorAdapterSandboxBoundaryConstrained(input),
    agentTaskControlTaskbookBoundaryConstrained:
      agentTaskControlTaskbookBoundaryConstrained(input),
    agentTaskControlReviewBoundaryConstrained:
      agentTaskControlReviewBoundaryConstrained(input),
    subAgentRuntimeBoundaryConstrained: subAgentRuntimeBoundaryConstrained(input),
    agentTaskControlBoundaryConstrained: agentTaskControlBoundaryConstrained(input),
    noCrossBoundaryExecutionBroadening: noCrossBoundaryExecutionBroadening(input),
    executionAuthorityLatticeConstrained:
      executionAuthorityLatticeConstrained(input),
    auditItselfIsNonExecuting: auditItselfIsNonExecuting(input),
    outputSanitized: outputSanitized()
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      currentAudits: REQUIRED_CURRENT_AUDITS,
      executionAuthorityLatticeMode:
        "narrow_readonly_provider_dispatch_without_boundary_inheritance",
      codexCliHostDoesNotAuthorizeHostExecutorOrSubAgentRuntime:
        codexCliHostDoesNotAuthorizeHostExecutorOrSubAgentRuntime(input),
      subAgentRuntimeDoesNotInvokeCodexCliOrProviderExecution:
        subAgentRuntimeDoesNotInvokeCodexCliOrProviderExecution(input),
      hostExecutorDoesNotExecuteProviderOrSubAgentRuntime:
        hostExecutorDoesNotExecuteProviderOrSubAgentRuntime(input),
      strategyRouterMode: "advisory_budget_signal_only",
      executionProfilesMode:
        input.executionProfilesReview.summary.executionProfilesMode,
      policyConfigMode:
        input.policyConfigReview.summary.policyConfigMode,
      capabilityTaxonomyMode:
        input.capabilityTaxonomyReview.summary.capabilityTaxonomyMode,
      capabilityTaxonomyEscalationPolicyMode:
        input.capabilityTaxonomyEscalationPolicyReview.summary.escalationPolicyMode,
      routingEngineMode: "routing_decision_and_provider_grant_only",
      recoveryControlMode:
        "schemas_packets_reviews_and_explicit_injected_witnesses_only",
      runtimeControlMode: "runtime_signal_and_escalation_outcome_only",
      operatorActionExecutorGateMode: "plan_only",
      codexCliHostMode: "explicit_codex_cli_host_execution_surface",
      publicApiMode: "named_governance_subpaths_only",
      agentOsLocalRuntimeMode: "local_state_and_provider_plan_runtime",
      agentOsMcpServerManifestMode:
        input.agentOsMcpServerManifestReview.summary.agentOsMcpServerManifestMode,
      protocolMcpProviderSkeletonMode:
        input.protocolMcpProviderSkeletonReview.summary.protocolMcpProviderSkeletonMode,
      protocolA2aRemoteProviderSkeletonMode:
        input.protocolA2aRemoteProviderSkeletonReview.summary.protocolA2aRemoteProviderSkeletonMode,
      agentOsSdkMode:
        input.agentOsSdkReview.summary.agentOsSdkMode,
      agentOsCliMode:
        input.agentOsCliReview.summary.agentOsCliMode,
      agentOsAppServerMode:
        input.agentOsAppServerReview.summary.agentOsAppServerMode,
      agentOsPublicSurfacesMode:
        input.agentOsPublicSurfacesReview.summary.agentOsPublicSurfacesMode,
      codexProviderMode: "controlled-read-only",
      preflightMode:
        input.preflightReview.summary.preflightMode,
      approvalPermitMode: "permit_creation_validation_revocation_and_store_only",
      approvalGateMode: "approval_requirement_evaluation_only",
      approvalConsumptionDispatchMatrixBoundaryMode:
        input.approvalConsumptionDispatchMatrixReview.summary.matrixBoundaryMode,
      approvalConsumptionDispatchMode:
        input.approvalConsumptionDispatchReview.summary.approvalConsumptionDispatchMode,
      readonlyProductizationBoundaryMode:
        input.readonlyProductizationReview.summary.readonlyProductizationBoundaryMode,
      stateSyncBoundaryMode:
        input.stateSyncReview.summary.stateSyncBoundaryMode,
      workspaceWriteReleaseGateMode:
        input.workspaceWriteReleaseGateReview.summary.workspaceWriteReleaseGateMode,
      admissionControlMode: "admission_status_and_requirement_derivation_only",
      delegationPolicyMode: "delegation_level_approval_requirement_and_recovery_filter_only",
      executionEligibilityMode: "admission_capability_permit_decision_only",
      executionObservationMode: "sanitized_task_scoped_observation_record_only",
      governanceFailureReducerMode: "pure_failure_to_governance_state_reducer_only",
      taskGraphMode: "structural_task_graph_state_only",
      schedulerMode: "queue_and_execution_lease_state_machine_only",
      executionPlannerMode: "provider_execution_plan_only",
      providerRegistryMode: "catalog_selection_attestation_and_manifest_store_only",
      controlledProviderExecutionTaskbookMode:
        input.controlledProviderExecutionTaskbookReview.summary.taskbookMode,
      controlledProviderExecutionTaskbookReviewBoundaryMode:
        input.controlledProviderExecutionTaskbookReviewBoundaryReview.summary.reviewBoundaryMode,
      controlledProviderExecutionDispatchPreflightMode:
        input.controlledProviderExecutionDispatchPreflightReview.summary.dispatchPreflightMode,
      controlledProviderExecutionDispatcherMode:
        input.controlledProviderExecutionDispatcherReview.summary.dispatcherMode,
      providerExecutionRunnerMode: "controlled_readonly_and_workspace_write_gate",
      providerCorePrimitiveMode: "manifest_permit_plan_only",
      toolInvocationPlannerMode: "tool_manifest_and_invocation_plan_only",
      desktopAgentStrategyMode: "agent_assignment_and_ownership_plan_only",
      desktopDecisionRunnerMode: "decision_package_only",
      finalHostLocatorMode: "source_candidate_pre_mapping_only",
      hostDispatcherProviderMode: "controlled_read_only_and_workspace_write_provider_dispatch",
      codexDesktopBridgeMode: "explicit_injected_desktop_host_bridge",
      codexDesktopLiveHostMode: "explicit_current_host_runtime_and_memory_bundle",
      codexMemoryMcpClientMode: "explicit_mcp_http_memory_transport_only",
      codexMemoryHostClientMode: "explicit_injected_memory_operations_only",
      desktopHostClientMode: "desktop_host_client_facade",
      desktopLiveAdapterDispatchMode: "route_separated_host_dispatch_or_desktop_bridge",
      hostClientExampleMode: "example_host_client_facade",
      targetHostEmbeddingMode: "explicit_target_host_contract_and_starter_only",
      strategyRouterExecuteActionFamilyIsAuthorization: false,
      strategyRouterWriteExecutionPredicateIsAuthorization: false,
      strategyRouterExecutorBudgetIsRuntimeInvocation: false,
      executionProfilesProfileStageIsRuntimeStep:
        input.executionProfilesReview.summary.profileStageIsRuntimeStep,
      executionProfilesDefaultRoleIsSubAgentRuntimeAuthorization:
        input.executionProfilesReview.summary.defaultRoleIsSubAgentRuntimeAuthorization,
      executionProfilesDefaultToolAccessIsToolRuntimeAuthorization:
        input.executionProfilesReview.summary.defaultToolAccessIsToolRuntimeAuthorization,
      executionProfilesEngineeringWriteToolAccessIsWorkspaceWriteExecution:
        input.executionProfilesReview.summary.engineeringWriteToolAccessIsWorkspaceWriteExecution,
      executionProfilesProtectedRemoteToolAccessIsExternalWriteAuthorization:
        input.executionProfilesReview.summary.protectedRemoteToolAccessIsExternalWriteAuthorization,
      executionProfilesAllowParallelIsSubAgentRuntimeAuthorization:
        input.executionProfilesReview.summary.allowParallelIsSubAgentRuntimeAuthorization,
      executionProfilesMaxParallelAgentsIsSubAgentSpawnAuthorization:
        input.executionProfilesReview.summary.maxParallelAgentsIsSubAgentSpawnAuthorization,
      executionProfilesReleaseGovernanceProfileIsProtectedRemoteAuthorization:
        input.executionProfilesReview.summary.releaseGovernanceProfileIsProtectedRemoteAuthorization,
      executionProfilesProfileSelectionIsProviderExecutionAuthorization:
        input.executionProfilesReview.summary.profileSelectionIsProviderExecutionAuthorization,
      policyConfigHostRouteIsHostDispatchAuthorization:
        input.policyConfigReview.summary.hostRouteIsHostDispatchAuthorization,
      policyConfigCodexCliHostRouteIsCodexCliInvocation:
        input.policyConfigReview.summary.codexCliHostRouteIsCodexCliInvocation,
      policyConfigDesktopHostRouteIsDesktopRuntimeInvocation:
        input.policyConfigReview.summary.desktopHostRouteIsDesktopRuntimeInvocation,
      policyConfigToolPolicyIsToolRuntimeAuthorization:
        input.policyConfigReview.summary.toolPolicyIsToolRuntimeAuthorization,
      policyConfigProtectedRemoteToolPolicyIsExternalWriteAuthorization:
        input.policyConfigReview.summary.protectedRemoteToolPolicyIsExternalWriteAuthorization,
      policyConfigApprovalRuleIsApprovalGrant:
        input.policyConfigReview.summary.approvalRuleIsApprovalGrant,
      policyConfigMemoryHealthBlockIsRuntimeBlockExecution:
        input.policyConfigReview.summary.memoryHealthBlockIsRuntimeBlockExecution,
      policyConfigMemoryGuidanceIsSubAgentRuntimeAuthorization:
        input.policyConfigReview.summary.memoryGuidanceIsSubAgentRuntimeAuthorization,
      policyConfigTelemetryThresholdIsRuntimeAuthorization:
        input.policyConfigReview.summary.telemetryThresholdIsRuntimeAuthorization,
      policyConfigTelemetryDeliveryWindowIsHostExecutorAuthorization:
        input.policyConfigReview.summary.telemetryDeliveryWindowIsHostExecutorAuthorization,
      capabilityTaxonomyBoundedWorkspaceWriteCanaryIsWorkspaceWriteAuthorization:
        input.capabilityTaxonomyReview.summary.boundedWorkspaceWriteCanaryIsWorkspaceWriteAuthorization,
      capabilityTaxonomyBoundedWorkspaceWriteReceiptIsExecutionAuthorization:
        input.capabilityTaxonomyReview.summary.boundedWorkspaceWriteReceiptIsExecutionAuthorization,
      capabilityTaxonomyScopedWorkspaceWriteClassIsWorkspaceWriteExecution:
        input.capabilityTaxonomyReview.summary.scopedWorkspaceWriteClassIsWorkspaceWriteExecution,
      capabilityTaxonomyGeneralWorkspaceWriteClassIsExecutionAuthorization:
        input.capabilityTaxonomyReview.summary.generalWorkspaceWriteClassIsExecutionAuthorization,
      capabilityTaxonomyGeneralProviderExecutionClassIsProviderExecuteAuthorization:
        input.capabilityTaxonomyReview.summary.generalProviderExecutionClassIsProviderExecuteAuthorization,
      capabilityTaxonomyExternalWriteClassIsExternalWriteAuthorization:
        input.capabilityTaxonomyReview.summary.externalWriteClassIsExternalWriteAuthorization,
      capabilityTaxonomyReleaseOrDeployClassIsReleaseAuthorization:
        input.capabilityTaxonomyReview.summary.releaseOrDeployClassIsReleaseAuthorization,
      capabilityTaxonomySecretCredentialChangeClassIsSecretAccessAuthorization:
        input.capabilityTaxonomyReview.summary.secretCredentialChangeClassIsSecretAccessAuthorization,
      capabilityTaxonomyEscalationPolicyIsRuntimeAuthorization:
        input.capabilityTaxonomyReview.summary.capabilityEscalationPolicyIsRuntimeAuthorization,
      capabilityTaxonomyCanaryEvidenceBaselineIsExecutionAuthorization:
        input.capabilityTaxonomyReview.summary.canaryEvidenceBaselineIsExecutionAuthorization,
      capabilityTaxonomyEscalationPolicyIsProviderExecuteAuthorization:
        input.capabilityTaxonomyEscalationPolicyReview.summary.escalationPolicyIsProviderExecuteAuthorization,
      capabilityTaxonomyEscalationPolicyIsCodexCliAuthorization:
        input.capabilityTaxonomyEscalationPolicyReview.summary.escalationPolicyIsCodexCliAuthorization,
      capabilityTaxonomyEscalationPolicyIsWorkspaceWriteAuthorization:
        input.capabilityTaxonomyEscalationPolicyReview.summary.escalationPolicyIsWorkspaceWriteAuthorization,
      capabilityTaxonomyEscalationPolicyIsHostExecutorAuthorization:
        input.capabilityTaxonomyEscalationPolicyReview.summary.escalationPolicyIsHostExecutorAuthorization,
      capabilityTaxonomyEscalationPolicyIsSubAgentRuntimeAuthorization:
        input.capabilityTaxonomyEscalationPolicyReview.summary.escalationPolicyIsSubAgentRuntimeAuthorization,
      capabilityTaxonomyEscalationPolicyIsToolRuntimeAuthorization:
        input.capabilityTaxonomyEscalationPolicyReview.summary.escalationPolicyIsToolRuntimeAuthorization,
      capabilityTaxonomyEscalationPolicyIsExternalWriteAuthorization:
        input.capabilityTaxonomyEscalationPolicyReview.summary.escalationPolicyIsExternalWriteAuthorization,
      capabilityTaxonomyEscalationPolicyIsReleaseAuthorization:
        input.capabilityTaxonomyEscalationPolicyReview.summary.escalationPolicyIsReleaseAuthorization,
      capabilityTaxonomyEscalationPolicyIsSecretAccessAuthorization:
        input.capabilityTaxonomyEscalationPolicyReview.summary.escalationPolicyIsSecretAccessAuthorization,
      capabilityTaxonomyEscalationPolicyBlockedCapabilityClassIsRuntimeBlockExecution:
        input.capabilityTaxonomyEscalationPolicyReview.summary.blockedCapabilityClassIsRuntimeBlockExecution,
      capabilityTaxonomyEscalationPolicySeverityIsRuntimeAuthorization:
        input.capabilityTaxonomyEscalationPolicyReview.summary.severityIsRuntimeAuthorization,
      capabilityTaxonomyEscalationPolicyStatusIsExecutionAuthorization:
        input.capabilityTaxonomyEscalationPolicyReview.summary.statusIsExecutionAuthorization,
      routingEngineDecisionIsExecutionAuthorization:
        input.routingEngineReview.summary.routingDecisionIsExecutionAuthorization,
      routingEngineHostRouteIsHostDispatchAuthorization:
        input.routingEngineReview.summary.hostRouteIsHostDispatchAuthorization,
      routingEngineProviderGrantIsProviderExecuteAuthorization:
        input.routingEngineReview.summary.providerGrantIsProviderExecuteAuthorization,
      routingEngineCodexCliProviderIdIsCodexCliInvocation:
        input.routingEngineReview.summary.codexCliProviderIdIsCodexCliInvocation,
      routingEngineDesktopProviderIdIsDesktopRuntimeInvocation:
        input.routingEngineReview.summary.desktopProviderIdIsDesktopRuntimeInvocation,
      routingEngineSandboxModeIsWorkspaceWriteExecution:
        input.routingEngineReview.summary.sandboxModeIsWorkspaceWriteExecution,
      routingEngineToolAccessIsToolRuntimeAuthorization:
        input.routingEngineReview.summary.toolAccessIsToolRuntimeAuthorization,
      routingEngineApprovalRequiredIsApprovalGrant:
        input.routingEngineReview.summary.approvalRequiredIsApprovalGrant,
      routingEngineRiskScoreIsRuntimeAuthorization:
        input.routingEngineReview.summary.riskScoreIsRuntimeAuthorization,
      routingEngineParallelismAllowedIsSubAgentRuntimeAuthorization:
        input.routingEngineReview.summary.parallelismAllowedIsSubAgentRuntimeAuthorization,
      recoveryControlSchemaStatusIsExecutionAuthorization:
        input.recoveryControlReview.summary.schemaStatusIsExecutionAuthorization,
      recoveryControlExecutionPlanIsRecoveryExecutionAuthorization:
        input.recoveryControlReview.summary.executionPlanIsRecoveryExecutionAuthorization,
      recoveryControlExecutionGateIsRuntimeAuthorization:
        input.recoveryControlReview.summary.executionGateIsRuntimeAuthorization,
      recoveryControlHostExecutorReviewIsHostDispatchAuthorization:
        input.recoveryControlReview.summary.hostExecutorReviewIsHostDispatchAuthorization,
      recoveryControlDispatchAuthorizationReviewIsAdapterInvocationAuthorization:
        input.recoveryControlReview.summary.dispatchAuthorizationReviewIsAdapterInvocationAuthorization,
      recoveryControlTaskControlReviewIsSubAgentRuntimeAuthorization:
        input.recoveryControlReview.summary.taskControlReviewIsSubAgentRuntimeAuthorization,
      recoveryControlSandboxWitnessIsProductionRecoveryExecution:
        input.recoveryControlReview.summary.sandboxWitnessIsProductionRecoveryExecution,
      recoveryControlReceiptStatusIsCompletionAuthorization:
        input.recoveryControlReview.summary.receiptStatusIsCompletionAuthorization,
      recoveryControlRecoveryRecommendationIsHostExecutorAuthorization:
        input.recoveryControlReview.summary.recoveryRecommendationIsHostExecutorAuthorization,
      runtimeControlRuntimeSignalIsExecutionAuthorization:
        input.runtimeControlReview.summary.runtimeSignalIsExecutionAuthorization,
      runtimeControlEscalationOutcomeIsProviderExecutionAuthorization:
        input.runtimeControlReview.summary.escalationOutcomeIsProviderExecutionAuthorization,
      runtimeControlUpgradeModelIsModelRuntimeInvocation:
        input.runtimeControlReview.summary.upgradeModelIsModelRuntimeInvocation,
      runtimeControlOpenCircuitIsHostDispatchAuthorization:
        input.runtimeControlReview.summary.openCircuitIsHostDispatchAuthorization,
      runtimeControlFailureCountIsRecoveryExecutionAuthorization:
        input.runtimeControlReview.summary.failureCountIsRecoveryExecutionAuthorization,
      runtimeControlContextPressureIsSubAgentRuntimeAuthorization:
        input.runtimeControlReview.summary.contextPressureIsSubAgentRuntimeAuthorization,
      runtimeControlHighRiskSignalIsCodexCliAuthorization:
        input.runtimeControlReview.summary.highRiskSignalIsCodexCliAuthorization,
      operatorActionExecutorGateExecutionAllowed: false,
      codexCliHostWorkspaceWriteRequiresExplicitAllowance: true,
      codexCliHostWorkspaceWriteRequiresConfirmation: true,
      codexCliHostDefaultRealCodexCliAllowedByBoundaryAudit: false,
      codexCliHostProviderExecutionAllowedByHostBoundary: false,
      publicApiInternalGovernanceTopLevelExportsAllowed: false,
      publicApiProviderExecuteExportAllowed: false,
      publicApiCodexCliHostRunExportAllowed: false,
      agentOsLocalRuntimeProviderPlanCanBeStored: true,
      agentOsLocalRuntimeRealProviderExecutionAllowed: false,
      agentOsLocalRuntimeCodexCliInvocationAllowed: false,
      agentOsLocalRuntimeHostExecutorInvocationAllowed: false,
      agentOsLocalRuntimeWorkspaceWriteExecutionAllowed: false,
      agentOsMcpServerManifestRuntimeImplementedMeansLiveServer:
        input.agentOsMcpServerManifestReview.summary.runtimeImplementedMeansLiveServer,
      agentOsMcpServerManifestToolManifestIsToolRuntimeAuthorization:
        input.agentOsMcpServerManifestReview.summary.toolManifestIsToolRuntimeAuthorization,
      agentOsMcpServerManifestRequiredCapabilityIsCapabilityGrant:
        input.agentOsMcpServerManifestReview.summary.requiredCapabilityIsCapabilityGrant,
      agentOsMcpServerManifestApprovalRequiredIsApprovalGrant:
        input.agentOsMcpServerManifestReview.summary.approvalRequiredIsApprovalGrant,
      agentOsMcpServerManifestLocalWriteSideEffectIsWorkspaceWriteExecution:
        input.agentOsMcpServerManifestReview.summary.localWriteSideEffectIsWorkspaceWriteExecution,
      agentOsMcpServerManifestProviderPlanningOutputIsProviderExecutionAuthorization:
        input.agentOsMcpServerManifestReview.summary.providerPlanningOutputIsProviderExecutionAuthorization,
      agentOsMcpServerManifestApprovalPermitOutputIsProviderExecutionAuthorization:
        input.agentOsMcpServerManifestReview.summary.approvalPermitOutputIsProviderExecutionAuthorization,
      agentOsMcpServerManifestListedToolIsMcpToolInvocation:
        input.agentOsMcpServerManifestReview.summary.listedToolIsMcpToolInvocation,
      agentOsMcpServerManifestExportIsPublicExecutionSurface:
        input.agentOsMcpServerManifestReview.summary.manifestExportIsPublicExecutionSurface,
      protocolMcpServerRefIsLiveServerConnection:
        input.protocolMcpProviderSkeletonReview.summary.serverRefIsLiveServerConnection,
      protocolMcpCommandRefIsShellCommand:
        input.protocolMcpProviderSkeletonReview.summary.commandRefIsShellCommand,
      protocolMcpEndpointRefIsNetworkCall:
        input.protocolMcpProviderSkeletonReview.summary.endpointRefIsNetworkCall,
      protocolMcpToolManifestIsToolRuntimeAuthorization:
        input.protocolMcpProviderSkeletonReview.summary.toolManifestIsToolRuntimeAuthorization,
      protocolMcpInvocationPlanIsToolExecutionAuthorization:
        input.protocolMcpProviderSkeletonReview.summary.invocationPlanIsToolExecutionAuthorization,
      protocolMcpFakeProviderIsLiveMcpServer:
        input.protocolMcpProviderSkeletonReview.summary.fakeProviderIsLiveMcpServer,
      protocolMcpInvokeMethodIsEnabled:
        input.protocolMcpProviderSkeletonReview.summary.invokeMethodIsEnabled,
      protocolMcpUnknownSideEffectIsAutoApproved:
        input.protocolMcpProviderSkeletonReview.summary.unknownSideEffectIsAutoApproved,
      protocolMcpAllowedToolIsMcpInvocationAuthorization:
        input.protocolMcpProviderSkeletonReview.summary.allowedToolIsMcpInvocationAuthorization,
      protocolA2aEndpointRefIsNetworkCall:
        input.protocolA2aRemoteProviderSkeletonReview.summary.endpointRefIsNetworkCall,
      protocolA2aAgentCardIsRemoteRuntimeAuthorization:
        input.protocolA2aRemoteProviderSkeletonReview.summary.agentCardIsRemoteRuntimeAuthorization,
      protocolA2aTaskSkeletonIsRemoteExecutionAuthorization:
        input.protocolA2aRemoteProviderSkeletonReview.summary.taskSkeletonIsRemoteExecutionAuthorization,
      protocolA2aArtifactUriIsFetchedBySkeleton:
        input.protocolA2aRemoteProviderSkeletonReview.summary.artifactUriIsFetchedBySkeleton,
      protocolA2aRemoteProviderIsEnabled:
        input.protocolA2aRemoteProviderSkeletonReview.summary.remoteProviderIsEnabled,
      protocolA2aRemoteProviderCreatesRemoteTasks:
        input.protocolA2aRemoteProviderSkeletonReview.summary.remoteProviderCreatesRemoteTasks,
      protocolA2aFakeTransportIsLiveNetworkService:
        input.protocolA2aRemoteProviderSkeletonReview.summary.fakeTransportIsLiveNetworkService,
      protocolA2aFakeTransportSubmissionIsRuntimeAuthorization:
        input.protocolA2aRemoteProviderSkeletonReview.summary.fakeTransportSubmissionIsRuntimeAuthorization,
      protocolA2aAnonymousRemoteInvocationAllowed:
        input.protocolA2aRemoteProviderSkeletonReview.summary.anonymousRemoteInvocationAllowed,
      protocolA2aAuthSchemeIsCapabilityGrant:
        input.protocolA2aRemoteProviderSkeletonReview.summary.authSchemeIsCapabilityGrant,
      protocolA2aRemoteAgentProviderManifestIsSubAgentRuntimeAuthorization:
        input.protocolA2aRemoteProviderSkeletonReview.summary.remoteAgentProviderManifestIsSubAgentRuntimeAuthorization,
      agentOsSdkCallIsProviderExecutionAuthorization:
        input.agentOsSdkReview.summary.sdkCallIsProviderExecutionAuthorization,
      agentOsSdkGrantInputIsCapabilityGrant:
        input.agentOsSdkReview.summary.sdkGrantInputIsCapabilityGrant,
      agentOsSdkApproveToolInputIsToolRuntimeAuthorization:
        input.agentOsSdkReview.summary.sdkApproveToolInputIsToolRuntimeAuthorization,
      agentOsSdkAllowLocalMutationIsWorkspaceWriteExecution:
        input.agentOsSdkReview.summary.sdkAllowLocalMutationIsWorkspaceWriteExecution,
      agentOsSdkPreferredProviderIsCodexCliInvocation:
        input.agentOsSdkReview.summary.preferredProviderIsCodexCliInvocation,
      agentOsSdkLocalRuntimeCallIsProviderExecutionAuthorization:
        input.agentOsSdkReview.summary.localRuntimeCallIsProviderExecutionAuthorization,
      agentOsSdkApprovalPermitIssueIsProviderExecutionAuthorization:
        input.agentOsSdkReview.summary.approvalPermitIssueIsProviderExecutionAuthorization,
      agentOsSdkApprovalPermitConsumptionIsProviderExecutionAuthorization:
        input.agentOsSdkReview.summary.approvalPermitConsumptionIsProviderExecutionAuthorization,
      agentOsSdkRealProviderExecutionInvoked:
        input.agentOsSdkReview.summary.realProviderExecutionInvoked,
      agentOsCliGrantFlagIsCapabilityGrant:
        input.agentOsCliReview.summary.cliGrantFlagIsCapabilityGrant,
      agentOsCliApproveToolFlagIsToolRuntimeAuthorization:
        input.agentOsCliReview.summary.cliApproveToolFlagIsToolRuntimeAuthorization,
      agentOsCliAllowLocalMutationIsWorkspaceWriteExecution:
        input.agentOsCliReview.summary.cliAllowLocalMutationIsWorkspaceWriteExecution,
      agentOsCliPreferredProviderIsCodexCliInvocation:
        input.agentOsCliReview.summary.preferredProviderIsCodexCliInvocation,
      agentOsCliParsedCommandIsProviderExecutionAuthorization:
        input.agentOsCliReview.summary.parsedCommandIsProviderExecutionAuthorization,
      agentOsCliLocalRuntimeCallIsProviderExecutionAuthorization:
        input.agentOsCliReview.summary.localRuntimeCallIsProviderExecutionAuthorization,
      agentOsCliApprovalPermitIssueIsProviderExecutionAuthorization:
        input.agentOsCliReview.summary.approvalPermitIssueIsProviderExecutionAuthorization,
      agentOsCliApprovalPermitConsumptionIsProviderExecutionAuthorization:
        input.agentOsCliReview.summary.approvalPermitConsumptionIsProviderExecutionAuthorization,
      agentOsCliSanitizedArgvContainsRawSecrets:
        input.agentOsCliReview.summary.sanitizedArgvContainsRawSecrets,
      agentOsAppServerRequestEnvelopeIsCapabilityGrant:
        input.agentOsAppServerReview.summary.requestEnvelopeIsCapabilityGrant,
      agentOsAppServerRouteIsLiveNetworkServer:
        input.agentOsAppServerReview.summary.routeIsLiveNetworkServer,
      agentOsAppServerStatusCodeIsHostExecutorReceipt:
        input.agentOsAppServerReview.summary.statusCodeIsHostExecutorReceipt,
      agentOsAppServerClientGateFieldsAreTrusted:
        input.agentOsAppServerReview.summary.clientGateFieldsAreTrusted,
      agentOsAppServerServerSideOptionsAreClientControlled:
        input.agentOsAppServerReview.summary.serverSideOptionsAreClientControlled,
      agentOsAppServerLocalRuntimeCallIsProviderExecutionAuthorization:
        input.agentOsAppServerReview.summary.localRuntimeCallIsProviderExecutionAuthorization,
      agentOsAppServerApprovalPermitIssueIsProviderExecutionAuthorization:
        input.agentOsAppServerReview.summary.approvalPermitIssueIsProviderExecutionAuthorization,
      agentOsAppServerApprovalPermitConsumptionIsProviderExecutionAuthorization:
        input.agentOsAppServerReview.summary.approvalPermitConsumptionIsProviderExecutionAuthorization,
      agentOsAppServerLiveHttpServerStarted:
        input.agentOsAppServerReview.summary.liveHttpServerStarted,
      agentOsAppServerNetworkAccessed:
        input.agentOsAppServerReview.summary.networkAccessed,
      agentOsAppServerRealProviderExecutionInvoked:
        input.agentOsAppServerReview.summary.realProviderExecutionInvoked,
      agentOsPublicSurfacesSdkCallIsProviderExecutionAuthorization:
        input.agentOsPublicSurfacesReview.summary.sdkCallIsProviderExecutionAuthorization,
      agentOsPublicSurfacesCliGrantFlagIsProviderExecutionAuthorization:
        input.agentOsPublicSurfacesReview.summary.cliGrantFlagIsProviderExecutionAuthorization,
      agentOsPublicSurfacesCliApproveToolFlagIsToolRuntimeAuthorization:
        input.agentOsPublicSurfacesReview.summary.cliApproveToolFlagIsToolRuntimeAuthorization,
      agentOsPublicSurfacesCliAllowLocalMutationIsWorkspaceWriteExecution:
        input.agentOsPublicSurfacesReview.summary.cliAllowLocalMutationIsWorkspaceWriteExecution,
      agentOsPublicSurfacesPreferredProviderIsCodexCliInvocation:
        input.agentOsPublicSurfacesReview.summary.preferredProviderIsCodexCliInvocation,
      agentOsPublicSurfacesAppServerRequestEnvelopeIsCapabilityGrant:
        input.agentOsPublicSurfacesReview.summary.appServerRequestEnvelopeIsCapabilityGrant,
      agentOsPublicSurfacesAppServerRouteIsNetworkServer:
        input.agentOsPublicSurfacesReview.summary.appServerRouteIsNetworkServer,
      agentOsPublicSurfacesAppServerStatusCodeIsExecutionReceipt:
        input.agentOsPublicSurfacesReview.summary.appServerStatusCodeIsExecutionReceipt,
      agentOsPublicSurfacesApprovalPermitIssueIsProviderExecutionAuthorization:
        input.agentOsPublicSurfacesReview.summary.approvalPermitIssueIsProviderExecutionAuthorization,
      controlledReadOnlyProviderExecutionAllowed: true,
      preflightOkIsExecutionAuthorization:
        input.preflightReview.summary.preflightOkIsExecutionAuthorization,
      preflightMissingToolCheckIsToolRuntimeAuthorization:
        input.preflightReview.summary.missingToolCheckIsToolRuntimeAuthorization,
      preflightAuthAvailableIsProviderExecutionAuthorization:
        input.preflightReview.summary.authAvailableIsProviderExecutionAuthorization,
      preflightWorkspaceCleanIsWorkspaceWriteAuthorization:
        input.preflightReview.summary.workspaceCleanIsWorkspaceWriteAuthorization,
      preflightProtectedBranchCheckIsWorkspaceWriteExecution:
        input.preflightReview.summary.protectedBranchCheckIsWorkspaceWriteExecution,
      preflightMemoryOverviewIsRuntimeAuthorization:
        input.preflightReview.summary.memoryOverviewIsRuntimeAuthorization,
      preflightMemoryHealthStatusIsSubAgentRuntimeAuthorization:
        input.preflightReview.summary.memoryHealthStatusIsSubAgentRuntimeAuthorization,
      preflightMemoryWarningIsHostExecutorAuthorization:
        input.preflightReview.summary.memoryWarningIsHostExecutorAuthorization,
      preflightMemoryBlockingIssueIsProviderExecutionAuthorization:
        input.preflightReview.summary.memoryBlockingIssueIsProviderExecutionAuthorization,
      approvalPermitValidPermitIsProviderExecutionAuthorization:
        input.approvalPermitReview.summary.validPermitIsProviderExecutionAuthorization,
      approvalPermitValidPermitIsCodexCliAuthorization:
        input.approvalPermitReview.summary.validPermitIsCodexCliAuthorization,
      approvalPermitValidPermitIsSubAgentRuntimeAuthorization:
        input.approvalPermitReview.summary.validPermitIsSubAgentRuntimeAuthorization,
      approvalPermitValidPermitIsHostExecutorAuthorization:
        input.approvalPermitReview.summary.validPermitIsHostExecutorAuthorization,
      approvalPermitValidPermitIsToolRuntimeAuthorization:
        input.approvalPermitReview.summary.validPermitIsToolRuntimeAuthorization,
      approvalPermitShellCapabilityScopeIsShellExecution:
        input.approvalPermitReview.summary.shellCapabilityScopeIsShellExecution,
      approvalPermitExternalCapabilityScopeIsExternalWriteExecution:
        input.approvalPermitReview.summary.externalCapabilityScopeIsExternalWriteExecution,
      approvalPermitStorePersistenceIsWorkspaceWriteExecution:
        input.approvalPermitReview.summary.storePersistenceIsWorkspaceWriteExecution,
      approvalGateNotRequiredStatusIsExecutionAuthorization:
        input.approvalGateReview.summary.approvalNotRequiredIsExecutionAuthorization,
      approvalGateResolutionIsProviderExecutionAuthorization:
        input.approvalGateReview.summary.approvalResolvedIsProviderExecutionAuthorization,
      approvalGateResolutionIsCodexCliAuthorization:
        input.approvalGateReview.summary.approvalResolvedIsCodexCliAuthorization,
      approvalGateResolutionIsSubAgentRuntimeAuthorization:
        input.approvalGateReview.summary.approvalResolvedIsSubAgentRuntimeAuthorization,
      approvalGateResolutionIsHostExecutorAuthorization:
        input.approvalGateReview.summary.approvalResolvedIsHostExecutorAuthorization,
      approvalGateResolutionIsToolRuntimeAuthorization:
        input.approvalGateReview.summary.approvalResolvedIsToolRuntimeAuthorization,
      approvalGatePendingStatusIsRuntimeInvocation:
        input.approvalGateReview.summary.pendingGateIsRuntimeInvocation,
      approvalGateProtectedBranchSignalIsWorkspaceWriteExecution:
        input.approvalGateReview.summary.protectedBranchSignalIsWorkspaceWriteExecution,
      approvalGateDirtyWorkspaceSignalIsWorkspaceWriteExecution:
        input.approvalGateReview.summary.dirtyWorkspaceSignalIsWorkspaceWriteExecution,
      approvalGateProtectedKeywordSignalIsExternalWriteExecution:
        input.approvalGateReview.summary.protectedKeywordSignalIsExternalWriteExecution,
      approvalConsumptionDispatchMatrixAuditIsProviderExecuteAuthorization:
        input.approvalConsumptionDispatchMatrixReview.summary.matrixAuditIsProviderExecuteAuthorization,
      approvalConsumptionDispatchMatrixAuditIsRealCodexCliAuthorization:
        input.approvalConsumptionDispatchMatrixReview.summary.matrixAuditIsRealCodexCliAuthorization,
      approvalConsumptionDispatchMatrixAuditIsWorkspaceWriteAuthorization:
        input.approvalConsumptionDispatchMatrixReview.summary.matrixAuditIsWorkspaceWriteAuthorization,
      approvalConsumptionDispatchMatrixAuditIsLocalCommandAuthorization:
        input.approvalConsumptionDispatchMatrixReview.summary.matrixAuditIsLocalCommandAuthorization,
      approvalConsumptionDispatchMatrixAuditIsHostExecutorAuthorization:
        input.approvalConsumptionDispatchMatrixReview.summary.matrixAuditIsHostExecutorAuthorization,
      approvalConsumptionDispatchMatrixAuditIsSubAgentRuntimeAuthorization:
        input.approvalConsumptionDispatchMatrixReview.summary.matrixAuditIsSubAgentRuntimeAuthorization,
      approvalConsumptionDispatchMatrixAuditIsToolRuntimeAuthorization:
        input.approvalConsumptionDispatchMatrixReview.summary.matrixAuditIsToolRuntimeAuthorization,
      approvalConsumptionDispatchMatrixAuditIsExternalWriteAuthorization:
        input.approvalConsumptionDispatchMatrixReview.summary.matrixAuditIsExternalWriteAuthorization,
      approvalConsumptionDispatchMatrixAuditIsReleaseAuthorization:
        input.approvalConsumptionDispatchMatrixReview.summary.matrixAuditIsReleaseAuthorization,
      approvalConsumptionDispatchMatrixAuditGitStateIsExecutionAuthorization:
        input.approvalConsumptionDispatchMatrixReview.summary.matrixAuditGitStateIsExecutionAuthorization,
      approvalConsumptionDispatchMatrixAuditWorktreeCleanIsProviderExecutionAuthorization:
        input.approvalConsumptionDispatchMatrixReview.summary.matrixAuditWorktreeCleanIsProviderExecutionAuthorization,
      approvalConsumptionDispatchMatrixIsProviderExecuteAuthorization:
        input.approvalConsumptionDispatchReview.summary.matrixIsProviderExecuteAuthorization,
      approvalConsumptionDispatchMatrixIsRealCodexCliAuthorization:
        input.approvalConsumptionDispatchReview.summary.matrixIsRealCodexCliAuthorization,
      approvalConsumptionDispatchMatrixIsWorkspaceWriteAuthorization:
        input.approvalConsumptionDispatchReview.summary.matrixIsWorkspaceWriteAuthorization,
      approvalConsumptionDispatchMatrixIsLocalCommandAuthorization:
        input.approvalConsumptionDispatchReview.summary.matrixIsLocalCommandAuthorization,
      approvalConsumptionDispatchMatrixIsHostExecutorAuthorization:
        input.approvalConsumptionDispatchReview.summary.matrixIsHostExecutorAuthorization,
      approvalConsumptionDispatchMatrixIsSubAgentRuntimeAuthorization:
        input.approvalConsumptionDispatchReview.summary.matrixIsSubAgentRuntimeAuthorization,
      approvalConsumptionDispatchMatrixIsExternalWriteAuthorization:
        input.approvalConsumptionDispatchReview.summary.matrixIsExternalWriteAuthorization,
      approvalConsumptionDispatchMatrixIsReleaseAuthorization:
        input.approvalConsumptionDispatchReview.summary.matrixIsReleaseAuthorization,
      approvalConsumptionDispatchApprovalPermitConsumptionIsProviderExecutionAuthorization:
        input.approvalConsumptionDispatchReview.summary.approvalPermitConsumptionIsProviderExecutionAuthorization,
      approvalConsumptionDispatchHostDispatcherPreconditionIsProviderExecuteAuthorization:
        input.approvalConsumptionDispatchReview.summary.hostDispatcherPreconditionIsProviderExecuteAuthorization,
      approvalConsumptionDispatchRedactionCoverageIsRuntimeAuthorization:
        input.approvalConsumptionDispatchReview.summary.redactionCoverageIsRuntimeAuthorization,
      readonlyProductizationIsProviderExecuteAuthorization:
        input.readonlyProductizationReview.summary.readonlyProductizationIsProviderExecuteAuthorization,
      readonlyProductizationIsRealCodexCliAuthorization:
        input.readonlyProductizationReview.summary.readonlyProductizationIsRealCodexCliAuthorization,
      readonlyProductizationIsWorkspaceWriteAuthorization:
        input.readonlyProductizationReview.summary.readonlyProductizationIsWorkspaceWriteAuthorization,
      readonlyProductizationIsLocalCommandAuthorization:
        input.readonlyProductizationReview.summary.readonlyProductizationIsLocalCommandAuthorization,
      readonlyProductizationIsHostExecutorAuthorization:
        input.readonlyProductizationReview.summary.readonlyProductizationIsHostExecutorAuthorization,
      readonlyProductizationIsSubAgentRuntimeAuthorization:
        input.readonlyProductizationReview.summary.readonlyProductizationIsSubAgentRuntimeAuthorization,
      readonlyProductizationIsToolRuntimeAuthorization:
        input.readonlyProductizationReview.summary.readonlyProductizationIsToolRuntimeAuthorization,
      readonlyProductizationIsExternalWriteAuthorization:
        input.readonlyProductizationReview.summary.readonlyProductizationIsExternalWriteAuthorization,
      readonlyProductizationIsEvidenceRefreshAuthorization:
        input.readonlyProductizationReview.summary.readonlyProductizationIsEvidenceRefreshAuthorization,
      readonlyProductizationIsReleaseAuthorization:
        input.readonlyProductizationReview.summary.readonlyProductizationIsReleaseAuthorization,
      readonlyProductizationGitStateIsExecutionAuthorization:
        input.readonlyProductizationReview.summary.readonlyProductizationGitStateIsExecutionAuthorization,
      readonlyProductizationWorktreeCleanIsProviderExecutionAuthorization:
        input.readonlyProductizationReview.summary.readonlyProductizationWorktreeCleanIsProviderExecutionAuthorization,
      stateSyncIsProviderExecuteAuthorization:
        input.stateSyncReview.summary.stateSyncIsProviderExecuteAuthorization,
      stateSyncIsRealCodexCliAuthorization:
        input.stateSyncReview.summary.stateSyncIsRealCodexCliAuthorization,
      stateSyncIsWorkspaceWriteAuthorization:
        input.stateSyncReview.summary.stateSyncIsWorkspaceWriteAuthorization,
      stateSyncIsLocalCommandAuthorization:
        input.stateSyncReview.summary.stateSyncIsLocalCommandAuthorization,
      stateSyncIsHostExecutorAuthorization:
        input.stateSyncReview.summary.stateSyncIsHostExecutorAuthorization,
      stateSyncIsSubAgentRuntimeAuthorization:
        input.stateSyncReview.summary.stateSyncIsSubAgentRuntimeAuthorization,
      stateSyncIsToolRuntimeAuthorization:
        input.stateSyncReview.summary.stateSyncIsToolRuntimeAuthorization,
      stateSyncIsExternalWriteAuthorization:
        input.stateSyncReview.summary.stateSyncIsExternalWriteAuthorization,
      stateSyncIsEvidenceRefreshAuthorization:
        input.stateSyncReview.summary.stateSyncIsEvidenceRefreshAuthorization,
      stateSyncIsPushAuthorization:
        input.stateSyncReview.summary.stateSyncIsPushAuthorization,
      stateSyncIsReleaseAuthorization:
        input.stateSyncReview.summary.stateSyncIsReleaseAuthorization,
      stateSyncGitStateIsExecutionAuthorization:
        input.stateSyncReview.summary.stateSyncGitStateIsExecutionAuthorization,
      stateSyncCleanWorktreeIsProviderExecutionAuthorization:
        input.stateSyncReview.summary.stateSyncCleanWorktreeIsProviderExecutionAuthorization,
      stateSyncPolicyV2IsExecutionAuthorization:
        input.stateSyncReview.summary.stateSyncPolicyV2IsExecutionAuthorization,
      workspaceWriteReleaseGateIsWorkspaceWriteAuthorization:
        input.workspaceWriteReleaseGateReview.summary.workspaceWriteReleaseGateIsWorkspaceWriteAuthorization,
      workspaceWriteReleaseGateIsRealCodexCliAuthorization:
        input.workspaceWriteReleaseGateReview.summary.workspaceWriteReleaseGateIsRealCodexCliAuthorization,
      workspaceWriteReleaseGateIsProviderExecutionAuthorization:
        input.workspaceWriteReleaseGateReview.summary.workspaceWriteReleaseGateIsProviderExecutionAuthorization,
      workspaceWriteReleaseGateIsHostExecutorAuthorization:
        input.workspaceWriteReleaseGateReview.summary.workspaceWriteReleaseGateIsHostExecutorAuthorization,
      workspaceWriteReleaseGateIsSubAgentRuntimeAuthorization:
        input.workspaceWriteReleaseGateReview.summary.workspaceWriteReleaseGateIsSubAgentRuntimeAuthorization,
      workspaceWriteReleaseGateIsExternalWriteAuthorization:
        input.workspaceWriteReleaseGateReview.summary.workspaceWriteReleaseGateIsExternalWriteAuthorization,
      workspaceWriteReleaseGateIsPushAuthorization:
        input.workspaceWriteReleaseGateReview.summary.workspaceWriteReleaseGateIsPushAuthorization,
      workspaceWriteReleaseGateIsReleaseAuthorization:
        input.workspaceWriteReleaseGateReview.summary.workspaceWriteReleaseGateIsReleaseAuthorization,
      admissionControlAcceptedStatusIsExecutionAuthorization:
        input.admissionControlReview.summary.acceptedStatusIsExecutionAuthorization,
      admissionControlNeedsApprovalStatusIsApprovalGrant:
        input.admissionControlReview.summary.needsApprovalStatusIsApprovalGrant,
      admissionControlRejectedStatusIsRuntimeBlockExecution:
        input.admissionControlReview.summary.rejectedStatusIsRuntimeBlockExecution,
      admissionControlCapabilityMatchIsRuntimeInvocation:
        input.admissionControlReview.summary.capabilityMatchIsRuntimeInvocation,
      admissionControlRequiredApprovalIsProviderExecutionAuthorization:
        input.admissionControlReview.summary.requiredApprovalIsProviderExecutionAuthorization,
      admissionControlRequiredApprovalIsCodexCliAuthorization:
        input.admissionControlReview.summary.requiredApprovalIsCodexCliAuthorization,
      admissionControlRequiredApprovalIsSubAgentRuntimeAuthorization:
        input.admissionControlReview.summary.requiredApprovalIsSubAgentRuntimeAuthorization,
      admissionControlRequiredApprovalIsHostExecutorAuthorization:
        input.admissionControlReview.summary.requiredApprovalIsHostExecutorAuthorization,
      admissionControlExternalCapabilityIsExternalWriteExecution:
        input.admissionControlReview.summary.externalCapabilityIsExternalWriteExecution,
      admissionControlFileWriteCapabilityIsWorkspaceWriteExecution:
        input.admissionControlReview.summary.fileWriteCapabilityIsWorkspaceWriteExecution,
      delegationPolicyFullDelegationIsExecutionAuthorization:
        input.delegationPolicyReview.summary.fullDelegationIsExecutionAuthorization,
      delegationPolicyRequiresApprovalFalseIsExecutionAuthorization:
        input.delegationPolicyReview.summary.requiresApprovalFalseIsExecutionAuthorization,
      delegationPolicyApprovedProposalIsRuntimeAuthorization:
        input.delegationPolicyReview.summary.approvedProposalIsRuntimeAuthorization,
      delegationPolicyAppliedProposalIsProviderExecutionAuthorization:
        input.delegationPolicyReview.summary.appliedProposalIsProviderExecutionAuthorization,
      delegationPolicyFilteredRecoveryActionIsHostExecutorAuthorization:
        input.delegationPolicyReview.summary.filteredRecoveryActionIsHostExecutorAuthorization,
      delegationPolicyRecoveryActionListIsRecoveryExecution:
        input.delegationPolicyReview.summary.recoveryActionListIsRecoveryExecution,
      delegationPolicyHistoricalTrustIsRuntimeAuthorization:
        input.delegationPolicyReview.summary.historicalTrustIsRuntimeAuthorization,
      delegationPolicyRecordedResumeIsRuntimeInvocation:
        input.delegationPolicyReview.summary.recordedResumeIsRuntimeInvocation,
      delegationPolicyFileStorePersistenceIsWorkspaceWriteExecution:
        input.delegationPolicyReview.summary.fileStorePersistenceIsWorkspaceWriteExecution,
      executionEligibilityEligibleStatusIsExecutionAuthorization: false,
      executionEligibilityValidApprovalPermitIsProviderExecutionAuthorization: false,
      executionEligibilityCapabilityGrantIsRuntimeInvocation: false,
      executionEligibilityPermitStoreReadIsRuntimeInvocation: false,
      executionEligibilityProviderPlanCreationAllowed: false,
      executionEligibilityProviderExecuteAllowed: false,
      executionEligibilityCodexCliInvocationAllowed: false,
      executionEligibilitySubAgentRuntimeInvocationAllowed: false,
      executionEligibilityHostExecutorInvocationAllowed: false,
      executionEligibilityHostDispatchAllowed: false,
      executionObservationStatusIsExecutionAuthorization: false,
      executionObservationSucceededIsCompletionAuthorization: false,
      executionObservationFailedIsRecoveryAuthorization: false,
      executionObservationEvidenceRefIsRuntimeInvocation: false,
      executionObservationRefResolutionIsReplayAuthorization: false,
      executionObservationRecordWriteIsWorkspaceWriteExecution: false,
      executionObservationFileStorePersistenceAllowed: true,
      executionObservationProviderExecuteAllowed: false,
      executionObservationCodexCliInvocationAllowed: false,
      executionObservationSubAgentRuntimeInvocationAllowed: false,
      executionObservationHostExecutorInvocationAllowed: false,
      executionObservationHostDispatchAllowed: false,
      governanceFailureReducerExecutionFailureIsRecoveryAuthorization:
        input.governanceFailureReducerReview.summary.executionFailureIsRecoveryAuthorization,
      governanceFailureReducerStrategyDecisionIsRuntimeAuthorization:
        input.governanceFailureReducerReview.summary.strategyDecisionIsRuntimeAuthorization,
      governanceFailureReducerArbitrationPacketIsRecoveryExecution:
        input.governanceFailureReducerReview.summary.arbitrationPacketIsRecoveryExecution,
      governanceFailureReducerRecoveryRecommendationIsHostExecutorAuthorization:
        input.governanceFailureReducerReview.summary.recoveryRecommendationIsHostExecutorAuthorization,
      governanceFailureReducerAnomalyRecordIsRuntimeInvocation:
        input.governanceFailureReducerReview.summary.anomalyRecordIsRuntimeInvocation,
      governanceFailureReducerEvidenceRefIsReplayAuthorization:
        input.governanceFailureReducerReview.summary.evidenceRefIsReplayAuthorization,
      governanceFailureReducerRiskScoreIsProviderExecutionAuthorization:
        input.governanceFailureReducerReview.summary.riskScoreIsProviderExecutionAuthorization,
      governanceFailureReducerStateUpdateIsWorkspaceWriteExecution:
        input.governanceFailureReducerReview.summary.reducerStateUpdateIsWorkspaceWriteExecution,
      taskGraphNodeStatusIsExecutionAuthorization:
        input.taskGraphReview.summary.nodeStatusIsExecutionAuthorization,
      taskGraphCompletionIsRuntimeCompletion:
        input.taskGraphReview.summary.graphCompletionIsRuntimeCompletion,
      taskGraphDependencyEdgeIsSchedulerDispatch:
        input.taskGraphReview.summary.dependencyEdgeIsSchedulerDispatch,
      taskGraphConflictEdgeIsRuntimeBlockExecution:
        input.taskGraphReview.summary.conflictEdgeIsRuntimeBlockExecution,
      taskGraphCheckpointNodeIsRollbackExecution:
        input.taskGraphReview.summary.checkpointNodeIsRollbackExecution,
      taskGraphDeltaIsWorkspaceRollbackAuthorization:
        input.taskGraphReview.summary.graphDeltaIsWorkspaceRollbackAuthorization,
      taskGraphRollbackToCheckpointIsHostExecutorAuthorization:
        input.taskGraphReview.summary.rollbackToCheckpointIsHostExecutorAuthorization,
      taskGraphBranchMergeIsGitMergeOrWorkspaceWrite:
        input.taskGraphReview.summary.branchMergeIsGitMergeOrWorkspaceWrite,
      taskGraphFileStorePersistenceIsWorkspaceWriteExecution:
        input.taskGraphReview.summary.fileStorePersistenceIsWorkspaceWriteExecution,
      schedulerQueuedStatusIsDispatchAuthorization:
        input.schedulerReview.summary.queuedStatusIsDispatchAuthorization,
      schedulerLeasedStatusIsExecutionAuthorization:
        input.schedulerReview.summary.leasedStatusIsExecutionAuthorization,
      schedulerActiveLeaseIsProviderExecuteAuthorization:
        input.schedulerReview.summary.activeLeaseIsProviderExecuteAuthorization,
      schedulerWorkerIdIsHostOrSubAgentAuthorization:
        input.schedulerReview.summary.workerIdIsHostOrSubAgentAuthorization,
      schedulerReleaseLeaseIsRuntimeCompletionProof:
        input.schedulerReview.summary.releaseLeaseIsRuntimeCompletionProof,
      schedulerFailLeaseIsRecoveryExecution:
        input.schedulerReview.summary.failLeaseIsRecoveryExecution,
      schedulerExpiredLeaseIsRetryExecution:
        input.schedulerReview.summary.expiredLeaseIsRetryExecution,
      schedulerExhaustedStatusIsRuntimeBlockExecution:
        input.schedulerReview.summary.exhaustedStatusIsRuntimeBlockExecution,
      schedulerFileStatePersistenceIsWorkspaceWriteExecution:
        input.schedulerReview.summary.fileStatePersistenceIsWorkspaceWriteExecution,
      schedulerFileLockIsShellProcessExecution:
        input.schedulerReview.summary.fileLockIsShellProcessExecution,
      executionPlannerPlannedStatusIsProviderExecutionAuthorization: false,
      executionPlannerCodexCliProviderSelectionIsCodexCliInvocation: false,
      executionPlannerRemoteAgentProviderSelectionIsSubAgentRuntimeInvocation: false,
      executionPlannerWorkspaceWriteSideEffectClassIsWorkspaceWriteExecution: false,
      executionPlannerLocalPlanStoreWritesAllowed: true,
      executionPlannerProviderPlanExecutionAllowed: false,
      executionPlannerProviderValidateExecutionPlanAllowed: false,
      executionPlannerProviderExecuteAllowed: false,
      executionPlannerCodexCliInvocationAllowed: false,
      executionPlannerSubAgentRuntimeInvocationAllowed: false,
      executionPlannerHostExecutorInvocationAllowed: false,
      executionPlannerHostDispatchAllowed: false,
      executionPlannerWorkspaceWriteExecutionAllowed: false,
      providerRegistrySelectedProviderIsExecutionAuthorization:
        input.providerRegistryReview.summary.selectedProviderIsExecutionAuthorization,
      providerRegistryProviderGrantSelectionIsProviderExecuteAuthorization:
        input.providerRegistryReview.summary.providerGrantSelectionIsProviderExecuteAuthorization,
      providerRegistryRoutingDecisionSelectionIsCodexCliAuthorization:
        input.providerRegistryReview.summary.routingDecisionSelectionIsCodexCliAuthorization,
      providerRegistryRegisteredExecutorProviderIsRuntimeInvocation:
        input.providerRegistryReview.summary.registeredExecutorProviderIsRuntimeInvocation,
      providerRegistryRegisteredToolProviderIsToolRuntimeInvocation:
        input.providerRegistryReview.summary.registeredToolProviderIsToolRuntimeInvocation,
      providerRegistryRegisteredRemoteAgentProviderIsSubAgentRuntimeAuthorization:
        input.providerRegistryReview.summary.registeredRemoteAgentProviderIsSubAgentRuntimeAuthorization,
      providerRegistryRemoteAgentAuthSchemesAreRuntimeAuthorization:
        input.providerRegistryReview.summary.remoteAgentAuthSchemesAreRuntimeAuthorization,
      providerRegistryManifestStorePersistenceIsWorkspaceWriteExecution:
        input.providerRegistryReview.summary.manifestStorePersistenceIsWorkspaceWriteExecution,
      controlledProviderExecutionTaskbookIsProviderExecuteAuthorization:
        input.controlledProviderExecutionTaskbookReview.summary.taskbookIsProviderExecuteAuthorization,
      controlledProviderExecutionTaskbookIsRealCodexCliAuthorization:
        input.controlledProviderExecutionTaskbookReview.summary.taskbookIsRealCodexCliAuthorization,
      controlledProviderExecutionTaskbookIsWorkspaceWriteAuthorization:
        input.controlledProviderExecutionTaskbookReview.summary.taskbookIsWorkspaceWriteAuthorization,
      controlledProviderExecutionTaskbookIsLocalCommandAuthorization:
        input.controlledProviderExecutionTaskbookReview.summary.taskbookIsLocalCommandAuthorization,
      controlledProviderExecutionTaskbookIsProtectedRemoteAuthorization:
        input.controlledProviderExecutionTaskbookReview.summary.taskbookIsProtectedRemoteAuthorization,
      controlledProviderExecutionTaskbookIsHostExecutorAuthorization:
        input.controlledProviderExecutionTaskbookReview.summary.taskbookIsHostExecutorAuthorization,
      controlledProviderExecutionTaskbookIsSubAgentRuntimeAuthorization:
        input.controlledProviderExecutionTaskbookReview.summary.taskbookIsSubAgentRuntimeAuthorization,
      controlledProviderExecutionTaskbookIsExternalWriteAuthorization:
        input.controlledProviderExecutionTaskbookReview.summary.taskbookIsExternalWriteAuthorization,
      controlledProviderExecutionTaskbookIsReleaseAuthorization:
        input.controlledProviderExecutionTaskbookReview.summary.taskbookIsReleaseAuthorization,
      controlledProviderExecutionTaskbookIsSecretChangeAuthorization:
        input.controlledProviderExecutionTaskbookReview.summary.taskbookIsSecretChangeAuthorization,
      controlledProviderExecutionTaskbookReviewAuditIsProviderExecuteAuthorization:
        input.controlledProviderExecutionTaskbookReviewBoundaryReview.summary.reviewAuditIsProviderExecuteAuthorization,
      controlledProviderExecutionTaskbookReviewAuditIsRealCodexCliAuthorization:
        input.controlledProviderExecutionTaskbookReviewBoundaryReview.summary.reviewAuditIsRealCodexCliAuthorization,
      controlledProviderExecutionTaskbookReviewAuditIsWorkspaceWriteAuthorization:
        input.controlledProviderExecutionTaskbookReviewBoundaryReview.summary.reviewAuditIsWorkspaceWriteAuthorization,
      controlledProviderExecutionTaskbookReviewAuditIsLocalCommandAuthorization:
        input.controlledProviderExecutionTaskbookReviewBoundaryReview.summary.reviewAuditIsLocalCommandAuthorization,
      controlledProviderExecutionTaskbookReviewAuditIsHostExecutorAuthorization:
        input.controlledProviderExecutionTaskbookReviewBoundaryReview.summary.reviewAuditIsHostExecutorAuthorization,
      controlledProviderExecutionTaskbookReviewAuditIsSubAgentRuntimeAuthorization:
        input.controlledProviderExecutionTaskbookReviewBoundaryReview.summary.reviewAuditIsSubAgentRuntimeAuthorization,
      controlledProviderExecutionTaskbookReviewAuditIsExternalWriteAuthorization:
        input.controlledProviderExecutionTaskbookReviewBoundaryReview.summary.reviewAuditIsExternalWriteAuthorization,
      controlledProviderExecutionTaskbookReviewAuditIsReleaseAuthorization:
        input.controlledProviderExecutionTaskbookReviewBoundaryReview.summary.reviewAuditIsReleaseAuthorization,
      controlledProviderExecutionTaskbookReviewAuditGitStateIsExecutionAuthorization:
        input.controlledProviderExecutionTaskbookReviewBoundaryReview.summary.reviewAuditGitStateIsExecutionAuthorization,
      controlledProviderExecutionTaskbookReviewAuditWorktreeCleanIsProviderExecutionAuthorization:
        input.controlledProviderExecutionTaskbookReviewBoundaryReview.summary.reviewAuditWorktreeCleanIsProviderExecutionAuthorization,
      controlledProviderExecutionDispatchPreflightIsProviderExecuteAuthorization:
        input.controlledProviderExecutionDispatchPreflightReview.summary.dispatchPreflightIsProviderExecuteAuthorization,
      controlledProviderExecutionDispatchPreflightIsRealCodexCliAuthorization:
        input.controlledProviderExecutionDispatchPreflightReview.summary.dispatchPreflightIsRealCodexCliAuthorization,
      controlledProviderExecutionDispatchPreflightIsWorkspaceWriteAuthorization:
        input.controlledProviderExecutionDispatchPreflightReview.summary.dispatchPreflightIsWorkspaceWriteAuthorization,
      controlledProviderExecutionDispatchPreflightIsHostExecutorAuthorization:
        input.controlledProviderExecutionDispatchPreflightReview.summary.dispatchPreflightIsHostExecutorAuthorization,
      controlledProviderExecutionDispatchPreflightIsSubAgentRuntimeAuthorization:
        input.controlledProviderExecutionDispatchPreflightReview.summary.dispatchPreflightIsSubAgentRuntimeAuthorization,
      controlledProviderExecutionDispatchPreflightIsShellProcessAuthorization:
        input.controlledProviderExecutionDispatchPreflightReview.summary.dispatchPreflightIsShellProcessAuthorization,
      controlledProviderExecutionDispatchPreflightIsExternalWriteAuthorization:
        input.controlledProviderExecutionDispatchPreflightReview.summary.dispatchPreflightIsExternalWriteAuthorization,
      controlledProviderExecutionDispatchPreflightIsReleaseAuthorization:
        input.controlledProviderExecutionDispatchPreflightReview.summary.dispatchPreflightIsReleaseAuthorization,
      controlledProviderExecutionDispatchPreflightRunnerRemainsFinalProviderExecuteGate:
        input.controlledProviderExecutionDispatchPreflightReview.summary.runnerRemainsFinalProviderExecuteGate,
      controlledProviderExecutionDispatchPreflightDryRunDefaultPreserved:
        input.controlledProviderExecutionDispatchPreflightReview.summary.dryRunDefaultPreserved,
      controlledProviderExecutionDispatcherCallsProviderExecuteDirectly:
        input.controlledProviderExecutionDispatcherReview.summary.callsProviderExecuteDirectly,
      controlledProviderExecutionDispatcherCallsRealCodexCliDirectly:
        input.controlledProviderExecutionDispatcherReview.summary.callsRealCodexCliDirectly,
      controlledProviderExecutionDispatcherControlledWorkspaceWriteDispatchAllowed:
        input.controlledProviderExecutionDispatcherReview.summary
          .controlledWorkspaceWriteDispatchAllowed,
      controlledProviderExecutionDispatcherAuthorizesGeneralWorkspaceWrite:
        input.controlledProviderExecutionDispatcherReview.summary
          .authorizesGeneralWorkspaceWrite,
      controlledProviderExecutionDispatcherWorkspaceWriteProviderExecuteAllowed:
        input.controlledProviderExecutionDispatcherReview.summary
          .workspaceWriteProviderExecuteAllowed,
      controlledProviderExecutionDispatcherAuthorizesHostExecutor:
        input.controlledProviderExecutionDispatcherReview.summary.authorizesHostExecutor,
      controlledProviderExecutionDispatcherAuthorizesSubAgentRuntime:
        input.controlledProviderExecutionDispatcherReview.summary.authorizesSubAgentRuntime,
      controlledProviderExecutionDispatcherCallsRunnerBoundary:
        input.controlledProviderExecutionDispatcherReview.summary.callsRunnerBoundary,
      controlledProviderExecutionDispatcherDefaultDryRunPreserved:
        input.controlledProviderExecutionDispatcherReview.summary.defaultDryRunPreserved,
      providerExecutionRunnerWorkspaceWriteAllowed:
        input.providerExecutionRunnerReview.summary.workspaceWriteAllowedByRunner,
      providerExecutionRunnerWorkspaceWriteProviderExecuteAllowed:
        input.providerExecutionRunnerReview.summary.workspaceWriteProviderExecuteAllowed,
      providerExecutionRunnerDefaultRealCodexCliAllowed: false,
      providerExecutionRunnerNonCodexProviderExecutionAllowed: false,
      providerCorePrimitivesExecutionAllowed: false,
      toolInvocationPlannerPlannedStatusIsRuntimeInvocation: false,
      toolInvocationPlannerRemoteAgentToolManifestIsSubAgentRuntimeAuthorization: false,
      toolInvocationPlannerExternalWriteToolManifestIsExternalWriteAuthorization: false,
      toolInvocationPlannerApprovalPermitIsToolRuntimeAuthorization: false,
      toolInvocationPlannerLocalWriteToolPlanIsWorkspaceWriteExecution: false,
      toolInvocationPlannerInputPreviewStoresRawSecrets: false,
      toolInvocationPlannerDefaultCodexCliInvocationAllowed: false,
      toolInvocationPlannerProviderExecuteAllowed: false,
      toolInvocationPlannerSubAgentRuntimeInvocationAllowed: false,
      toolInvocationPlannerHostExecutorInvocationAllowed: false,
      toolInvocationPlannerToolRuntimeInvocationAllowed: false,
      toolInvocationPlannerShellProcessAllowedByDefault: false,
      toolInvocationPlannerWorkspaceWriteAllowedByDefault: false,
      toolInvocationPlannerExternalWriteAllowedByDefault: false,
      desktopAgentStrategyParallelPlanIsSubAgentRuntimeAuthorization:
        input.desktopAgentStrategyReview.summary.parallelPlanIsSubAgentRuntimeAuthorization,
      desktopAgentStrategyWorkerAssignmentIsRuntimeInvocation:
        input.desktopAgentStrategyReview.summary.workerAssignmentIsRuntimeInvocation,
      desktopAgentStrategyWriteModeIsWorkspaceWriteExecution:
        input.desktopAgentStrategyReview.summary.writeModeIsWorkspaceWriteExecution,
      desktopAgentStrategyOwnershipTargetIsWorkspaceWriteAuthorization:
        input.desktopAgentStrategyReview.summary.ownershipTargetIsWorkspaceWriteAuthorization,
      desktopAgentStrategyMaxAgentsIsSubAgentSpawnAuthorization:
        input.desktopAgentStrategyReview.summary.maxAgentsIsSubAgentSpawnAuthorization,
      desktopAgentStrategyReadOnlyAnalystIsProviderExecutionAuthorization:
        input.desktopAgentStrategyReview.summary.readOnlyAnalystIsProviderExecutionAuthorization,
      desktopAgentStrategyReasonIsExecutionGate:
        input.desktopAgentStrategyReview.summary.strategyReasonIsExecutionGate,
      desktopDecisionRunnerReadyStatusIsExecutionAuthorization: false,
      desktopDecisionRunnerProviderSelectionIsProviderExecute: false,
      desktopDecisionRunnerAgentStrategyIsSubAgentRuntimeInvocation: false,
      desktopDecisionRunnerHostDispatchAllowed: false,
      desktopDecisionRunnerProviderExecuteAllowed: false,
      desktopDecisionRunnerCodexCliInvocationAllowed: false,
      finalHostLocatorReadyForMappingIsHostExecutionAuthorization: false,
      finalHostLocatorHostExecutorInvocationAllowed: false,
      finalHostLocatorHostDispatchAllowed: false,
      finalHostLocatorProviderExecuteAllowed: false,
      finalHostLocatorCodexCliInvocationAllowed: false,
      finalHostLocatorSubAgentRuntimeInvocationAllowed: false,
      codexDesktopRuntimeToolInvocationAllowedByDefault: false,
      codexDesktopLiveHostDefaultRuntimeToolInvocationAllowed: false,
      codexDesktopLiveHostCodexCliInvocationAllowed: false,
      codexMemoryMcpClientMcpHttpCallsAreProviderExecution: false,
      codexMemoryMcpClientMcpHttpCallsAreHostExecutorAuthorization: false,
      codexMemoryMcpClientRecordMemoryIsWorkspaceWriteExecution: false,
      codexMemoryMcpClientSearchMemoryIsSubAgentRuntimeInvocation: false,
      codexMemoryMcpClientMemoryOverviewIsRuntimeAuthorization: false,
      codexMemoryMcpClientAdapterCheckpointWriteIsExecutionAuthorization: false,
      codexMemoryMcpClientDefaultEndpointLookupAllowed: false,
      codexMemoryMcpClientBearerTokenIsExecutionAuthorization: false,
      codexMemoryMcpClientDefaultCodexCliInvocationAllowed: false,
      codexMemoryMcpClientProviderExecuteAllowed: false,
      codexMemoryMcpClientSubAgentRuntimeInvocationAllowed: false,
      codexMemoryMcpClientShellProcessAllowedByDefault: false,
      codexMemoryMcpClientWorkspaceWriteAllowedByDefault: false,
      codexMemoryHostClientMemoryOperationCallsAreHostExecutorAuthorization: false,
      codexMemoryHostClientRecordMemoryIsWorkspaceWriteExecution: false,
      codexMemoryHostClientSearchMemoryIsSubAgentRuntimeInvocation: false,
      codexMemoryHostClientMemoryOverviewIsRuntimeAuthorization: false,
      codexMemoryHostClientAdapterCheckpointWriteIsExecutionAuthorization: false,
      codexMemoryHostClientMcpToolStyleAdapterIsDefaultHostLookup: false,
      codexMemoryHostClientDefaultRealHostExecutionAllowed: false,
      codexMemoryHostClientDefaultHostExecutorLookupAllowed: false,
      codexMemoryHostClientDefaultCodexCliInvocationAllowed: false,
      codexMemoryHostClientProviderExecuteAllowed: false,
      codexMemoryHostClientSubAgentRuntimeInvocationAllowed: false,
      codexMemoryHostClientShellProcessAllowedByDefault: false,
      codexMemoryHostClientWorkspaceWriteAllowedByDefault: false,
      desktopHostClientDefaultRealExecutionAllowed: false,
      desktopHostClientDefaultHostExecutorLookupAllowed: false,
      desktopHostClientDirectDispatchToHostAllowed: false,
      desktopHostClientExecuteInjectedDispatchAllowed: true,
      desktopHostClientControlledWorkspaceWriteDispatchAllowed:
        input.desktopHostClientReview.summary
          .controlledWorkspaceWriteDispatchAllowedByClient,
      desktopHostClientGeneralWorkspaceWriteAllowed:
        input.desktopHostClientReview.summary.generalWorkspaceWriteAllowedByClient,
      desktopHostClientWorkspaceWriteProviderExecuteAllowed:
        input.desktopHostClientReview.summary
          .workspaceWriteProviderExecuteAllowedByClient,
      desktopLiveAdapterBlockedDecisionExecutionAllowed: false,
      hostClientExampleRealShellProcessAllowed: false,
      hostClientExampleHostExecutorDispatchSurfacePresent: false,
      hostClientExampleWorkspaceWriteAllowed: false,
      targetHostEmbeddingPlaceholderMethodsAreRealExecution: false,
      targetHostEmbeddingScaffoldReadyStatusIsExecutionAuthorization: false,
      targetHostEmbeddingCreateBundleRequiresFullyWiredHost: true,
      targetHostEmbeddingCreateBundleIsHostExecutorAuthorization: false,
      targetHostEmbeddingDirectiveBuildersAreShellAuthorization: false,
      targetHostEmbeddingDefaultRealHostExecutionAllowed: false,
      targetHostEmbeddingDefaultHostExecutorLookupAllowed: false,
      targetHostEmbeddingDefaultCodexCliInvocationAllowed: false,
      targetHostEmbeddingProviderExecuteAllowed: false,
      targetHostEmbeddingSubAgentRuntimeInvocationAllowed: false,
      targetHostEmbeddingShellProcessAllowedByDefault: false,
      targetHostEmbeddingWorkspaceWriteAllowedByDefault: false,
      desktopLiveAdapterBridgeInvocationAllowedByCodexCliRoute: false,
      desktopLiveAdapterProviderInvocationAllowed: false,
      hostDispatcherReadOnlyProviderDispatchAllowed: true,
      hostDispatcherControlledWorkspaceWriteDispatchAllowed: true,
      hostDispatcherGeneralProviderExecutionAllowed: false,
      hostDispatcherGeneralWorkspaceWriteAllowed: false,
      hostDispatcherWorkspaceWriteProviderExecuteAllowed: false,
      hostExecutorDefaultRealExecutionAllowed: false,
      hostExecutorTaskbookExecutionAllowed: false,
      hostClientExecutorReviewDispatchAllowed: false,
      hostExecutorReceiptDispatchMeansBusinessRecoveryCompleted: false,
      agentBackedRecoveryProductionExecutionAllowed: false,
      agentExecutorAdapterTaskbookExecutionAllowed: false,
      agentExecutorAdapterReviewInvocationAllowed: false,
      agentExecutorAdapterSandboxProductionExecutionAllowed: false,
      taskControlTaskbookExecutionAllowed: false,
      taskControlReviewInvocationAllowed: false,
      subAgentRuntimeExecutionAllowed: false,
      taskControlAdapterKind: "sandbox_task_control_adapter",
      totalStrategyRouterCallsDuringAudit: 0,
      totalStrategyRouterProviderPlanExecutionCallsDuringAudit: 0,
      totalStrategyRouterProviderValidateExecutionPlanCallsDuringAudit: 0,
      totalStrategyRouterProviderExecuteCallsDuringAudit: 0,
      totalExecutionProfileLookupsDuringAudit:
        input.executionProfilesReview.summary.executionProfileLookupsDuringAudit,
      totalExecutionProfilesProviderExecuteCallsDuringAudit:
        input.executionProfilesReview.summary.providerExecuteCallsDuringAudit,
      totalExecutionProfilesCodexCliCallsDuringAudit:
        input.executionProfilesReview.summary.codexCliCallsDuringAudit,
      totalExecutionProfilesDesktopPrimitiveCallsDuringAudit:
        input.executionProfilesReview.summary.desktopPrimitiveCallsDuringAudit,
      totalExecutionProfilesSubAgentRuntimeCallsDuringAudit:
        input.executionProfilesReview.summary.subAgentRuntimeCallsDuringAudit,
      totalExecutionProfilesHostExecutorCallsDuringAudit:
        input.executionProfilesReview.summary.hostExecutorCallsDuringAudit,
      totalExecutionProfilesHostDispatchCallsDuringAudit:
        input.executionProfilesReview.summary.hostDispatchCallsDuringAudit,
      totalExecutionProfilesToolRuntimeCallsDuringAudit:
        input.executionProfilesReview.summary.toolRuntimeCallsDuringAudit,
      totalExecutionProfilesShellProcessCallsDuringAudit:
        input.executionProfilesReview.summary.shellProcessCallsDuringAudit,
      totalExecutionProfilesWorkspaceWriteCallsDuringAudit:
        input.executionProfilesReview.summary.workspaceWriteCallsDuringAudit,
      totalExecutionProfilesExternalWriteCallsDuringAudit:
        input.executionProfilesReview.summary.externalWriteCallsDuringAudit,
      totalPolicyConfigLoadCallsDuringAudit:
        input.policyConfigReview.summary.policyLoadCallsDuringAudit,
      totalPolicyConfigProviderExecuteCallsDuringAudit:
        input.policyConfigReview.summary.providerExecuteCallsDuringAudit,
      totalPolicyConfigCodexCliCallsDuringAudit:
        input.policyConfigReview.summary.codexCliCallsDuringAudit,
      totalPolicyConfigDesktopPrimitiveCallsDuringAudit:
        input.policyConfigReview.summary.desktopPrimitiveCallsDuringAudit,
      totalPolicyConfigSubAgentRuntimeCallsDuringAudit:
        input.policyConfigReview.summary.subAgentRuntimeCallsDuringAudit,
      totalPolicyConfigHostExecutorCallsDuringAudit:
        input.policyConfigReview.summary.hostExecutorCallsDuringAudit,
      totalPolicyConfigHostDispatchCallsDuringAudit:
        input.policyConfigReview.summary.hostDispatchCallsDuringAudit,
      totalPolicyConfigToolRuntimeCallsDuringAudit:
        input.policyConfigReview.summary.toolRuntimeCallsDuringAudit,
      totalPolicyConfigShellProcessCallsDuringAudit:
        input.policyConfigReview.summary.shellProcessCallsDuringAudit,
      totalPolicyConfigWorkspaceWriteCallsDuringAudit:
        input.policyConfigReview.summary.workspaceWriteCallsDuringAudit,
      totalPolicyConfigExternalWriteCallsDuringAudit:
        input.policyConfigReview.summary.externalWriteCallsDuringAudit,
      totalCapabilityTaxonomyProviderExecuteCallsDuringAudit:
        input.capabilityTaxonomyReview.summary.providerExecuteCallsDuringAudit,
      totalCapabilityTaxonomyCodexCliCallsDuringAudit:
        input.capabilityTaxonomyReview.summary.codexCliCallsDuringAudit,
      totalCapabilityTaxonomyWorkspaceWriteCallsDuringAudit:
        input.capabilityTaxonomyReview.summary.workspaceWriteCallsDuringAudit,
      totalCapabilityTaxonomyCanaryFileWriteCallsDuringAudit:
        input.capabilityTaxonomyReview.summary.canaryFileWriteCallsDuringAudit,
      totalCapabilityTaxonomyGeneralProviderExecutionCallsDuringAudit:
        input.capabilityTaxonomyReview.summary.generalProviderExecutionCallsDuringAudit,
      totalCapabilityTaxonomyExternalWriteCallsDuringAudit:
        input.capabilityTaxonomyReview.summary.externalWriteCallsDuringAudit,
      totalCapabilityTaxonomyReleaseCallsDuringAudit:
        input.capabilityTaxonomyReview.summary.releaseCallsDuringAudit,
      totalCapabilityTaxonomySecretAccessCallsDuringAudit:
        input.capabilityTaxonomyReview.summary.secretAccessCallsDuringAudit,
      totalCapabilityTaxonomyShellProcessCallsDuringAudit:
        input.capabilityTaxonomyReview.summary.shellProcessCallsDuringAudit,
      totalCapabilityTaxonomyEscalationPolicyProviderExecuteCallsDuringAudit:
        input.capabilityTaxonomyEscalationPolicyReview.summary.providerExecuteCallsDuringAudit,
      totalCapabilityTaxonomyEscalationPolicyCodexCliCallsDuringAudit:
        input.capabilityTaxonomyEscalationPolicyReview.summary.codexCliCallsDuringAudit,
      totalCapabilityTaxonomyEscalationPolicyWorkspaceWriteCallsDuringAudit:
        input.capabilityTaxonomyEscalationPolicyReview.summary.workspaceWriteCallsDuringAudit,
      totalCapabilityTaxonomyEscalationPolicyHostExecutorCallsDuringAudit:
        input.capabilityTaxonomyEscalationPolicyReview.summary.hostExecutorCallsDuringAudit,
      totalCapabilityTaxonomyEscalationPolicySubAgentRuntimeCallsDuringAudit:
        input.capabilityTaxonomyEscalationPolicyReview.summary.subAgentRuntimeCallsDuringAudit,
      totalCapabilityTaxonomyEscalationPolicyToolRuntimeCallsDuringAudit:
        input.capabilityTaxonomyEscalationPolicyReview.summary.toolRuntimeCallsDuringAudit,
      totalCapabilityTaxonomyEscalationPolicyShellProcessCallsDuringAudit:
        input.capabilityTaxonomyEscalationPolicyReview.summary.shellProcessCallsDuringAudit,
      totalCapabilityTaxonomyEscalationPolicyExternalWriteCallsDuringAudit:
        input.capabilityTaxonomyEscalationPolicyReview.summary.externalWriteCallsDuringAudit,
      totalCapabilityTaxonomyEscalationPolicyReleaseCallsDuringAudit:
        input.capabilityTaxonomyEscalationPolicyReview.summary.releaseCallsDuringAudit,
      totalCapabilityTaxonomyEscalationPolicySecretAccessCallsDuringAudit:
        input.capabilityTaxonomyEscalationPolicyReview.summary.secretAccessCallsDuringAudit,
      totalRoutingEngineCallsDuringAudit:
        input.routingEngineReview.summary.routingEngineCallsDuringAudit,
      totalRoutingEngineProviderGrantCreationsDuringAudit:
        input.routingEngineReview.summary.providerGrantCreationsDuringAudit,
      totalRoutingEngineProviderExecuteCallsDuringAudit:
        input.routingEngineReview.summary.providerExecuteCallsDuringAudit,
      totalRoutingEngineCodexCliCallsDuringAudit:
        input.routingEngineReview.summary.codexCliCallsDuringAudit,
      totalRoutingEngineDesktopRuntimeCallsDuringAudit:
        input.routingEngineReview.summary.desktopRuntimeCallsDuringAudit,
      totalRoutingEngineSubAgentRuntimeCallsDuringAudit:
        input.routingEngineReview.summary.subAgentRuntimeCallsDuringAudit,
      totalRoutingEngineHostExecutorCallsDuringAudit:
        input.routingEngineReview.summary.hostExecutorCallsDuringAudit,
      totalRoutingEngineHostDispatchCallsDuringAudit:
        input.routingEngineReview.summary.hostDispatchCallsDuringAudit,
      totalRoutingEngineToolRuntimeCallsDuringAudit:
        input.routingEngineReview.summary.toolRuntimeCallsDuringAudit,
      totalRoutingEngineShellProcessCallsDuringAudit:
        input.routingEngineReview.summary.shellProcessCallsDuringAudit,
      totalRoutingEngineWorkspaceWriteCallsDuringAudit:
        input.routingEngineReview.summary.workspaceWriteCallsDuringAudit,
      totalRoutingEngineExternalWriteCallsDuringAudit:
        input.routingEngineReview.summary.externalWriteCallsDuringAudit,
      totalRecoveryControlCallsDuringAudit:
        input.recoveryControlReview.summary.recoveryControlCallsDuringAudit,
      totalRecoveryControlHostExecutorInvocationsDuringAudit:
        input.recoveryControlReview.summary.hostExecutorInvocationsDuringAudit,
      totalRecoveryControlAdapterInvocationsDuringAudit:
        input.recoveryControlReview.summary.adapterInvocationsDuringAudit,
      totalRecoveryControlCodexCliCallsDuringAudit:
        input.recoveryControlReview.summary.codexCliCallsDuringAudit,
      totalRecoveryControlProviderExecuteCallsDuringAudit:
        input.recoveryControlReview.summary.providerExecuteCallsDuringAudit,
      totalRecoveryControlSubAgentRuntimeCallsDuringAudit:
        input.recoveryControlReview.summary.subAgentRuntimeCallsDuringAudit,
      totalRecoveryControlShellProcessCallsDuringAudit:
        input.recoveryControlReview.summary.shellProcessCallsDuringAudit,
      totalRecoveryControlWorkspaceWriteCallsDuringAudit:
        input.recoveryControlReview.summary.workspaceWriteCallsDuringAudit,
      totalRecoveryControlExternalWriteCallsDuringAudit:
        input.recoveryControlReview.summary.externalWriteCallsDuringAudit,
      totalRuntimeControlCallsDuringAudit:
        input.runtimeControlReview.summary.runtimeControlCallsDuringAudit,
      totalRuntimeControlProviderExecuteCallsDuringAudit:
        input.runtimeControlReview.summary.providerExecuteCallsDuringAudit,
      totalRuntimeControlCodexCliCallsDuringAudit:
        input.runtimeControlReview.summary.codexCliCallsDuringAudit,
      totalRuntimeControlSubAgentRuntimeCallsDuringAudit:
        input.runtimeControlReview.summary.subAgentRuntimeCallsDuringAudit,
      totalRuntimeControlHostExecutorCallsDuringAudit:
        input.runtimeControlReview.summary.hostExecutorCallsDuringAudit,
      totalRuntimeControlHostDispatchCallsDuringAudit:
        input.runtimeControlReview.summary.hostDispatchCallsDuringAudit,
      totalRuntimeControlModelRuntimeCallsDuringAudit:
        input.runtimeControlReview.summary.modelRuntimeCallsDuringAudit,
      totalRuntimeControlShellProcessCallsDuringAudit:
        input.runtimeControlReview.summary.shellProcessCallsDuringAudit,
      totalRuntimeControlWorkspaceWriteCallsDuringAudit:
        input.runtimeControlReview.summary.workspaceWriteCallsDuringAudit,
      totalRuntimeControlExternalWriteCallsDuringAudit:
        input.runtimeControlReview.summary.externalWriteCallsDuringAudit,
      totalOperatorActionExecutorGateInvocationsDuringAudit: 0,
      totalCodexCliHostProcessSpawnsDuringAudit: 0,
      totalPublicApiCallsDuringAudit: 0,
      totalAgentOsLocalRuntimeCallsDuringAudit: 0,
      totalAgentOsMcpServerManifestCallsDuringAudit:
        input.agentOsMcpServerManifestReview.summary.agentOsMcpServerManifestCallsDuringAudit,
      totalAgentOsMcpServerManifestLiveServerStartsDuringAudit:
        input.agentOsMcpServerManifestReview.summary.liveMcpServerStartsDuringAudit,
      totalAgentOsMcpServerManifestLocalRuntimeCallsDuringAudit:
        input.agentOsMcpServerManifestReview.summary.localRuntimeCallsDuringAudit,
      totalAgentOsMcpServerManifestToolRuntimeCallsDuringAudit:
        input.agentOsMcpServerManifestReview.summary.toolRuntimeCallsDuringAudit,
      totalAgentOsMcpServerManifestProviderExecuteCallsDuringAudit:
        input.agentOsMcpServerManifestReview.summary.providerExecuteCallsDuringAudit,
      totalAgentOsMcpServerManifestCodexCliCallsDuringAudit:
        input.agentOsMcpServerManifestReview.summary.codexCliCallsDuringAudit,
      totalAgentOsMcpServerManifestDesktopPrimitiveCallsDuringAudit:
        input.agentOsMcpServerManifestReview.summary.desktopPrimitiveCallsDuringAudit,
      totalAgentOsMcpServerManifestSubAgentRuntimeCallsDuringAudit:
        input.agentOsMcpServerManifestReview.summary.subAgentRuntimeCallsDuringAudit,
      totalAgentOsMcpServerManifestHostExecutorCallsDuringAudit:
        input.agentOsMcpServerManifestReview.summary.hostExecutorCallsDuringAudit,
      totalAgentOsMcpServerManifestHostDispatchCallsDuringAudit:
        input.agentOsMcpServerManifestReview.summary.hostDispatchCallsDuringAudit,
      totalAgentOsMcpServerManifestShellProcessCallsDuringAudit:
        input.agentOsMcpServerManifestReview.summary.shellProcessCallsDuringAudit,
      totalAgentOsMcpServerManifestNetworkCallsDuringAudit:
        input.agentOsMcpServerManifestReview.summary.networkCallsDuringAudit,
      totalAgentOsMcpServerManifestWorkspaceWriteCallsDuringAudit:
        input.agentOsMcpServerManifestReview.summary.workspaceWriteCallsDuringAudit,
      totalAgentOsMcpServerManifestExternalWriteCallsDuringAudit:
        input.agentOsMcpServerManifestReview.summary.externalWriteCallsDuringAudit,
      totalProtocolMcpCallsDuringAudit:
        input.protocolMcpProviderSkeletonReview.summary.protocolMcpCallsDuringAudit,
      totalProtocolMcpLiveServerConnectionsDuringAudit:
        input.protocolMcpProviderSkeletonReview.summary.liveMcpServerConnectionsDuringAudit,
      totalProtocolMcpToolRuntimeCallsDuringAudit:
        input.protocolMcpProviderSkeletonReview.summary.toolRuntimeCallsDuringAudit,
      totalProtocolMcpProviderExecuteCallsDuringAudit:
        input.protocolMcpProviderSkeletonReview.summary.providerExecuteCallsDuringAudit,
      totalProtocolMcpCodexCliCallsDuringAudit:
        input.protocolMcpProviderSkeletonReview.summary.codexCliCallsDuringAudit,
      totalProtocolMcpDesktopPrimitiveCallsDuringAudit:
        input.protocolMcpProviderSkeletonReview.summary.desktopPrimitiveCallsDuringAudit,
      totalProtocolMcpSubAgentRuntimeCallsDuringAudit:
        input.protocolMcpProviderSkeletonReview.summary.subAgentRuntimeCallsDuringAudit,
      totalProtocolMcpHostExecutorCallsDuringAudit:
        input.protocolMcpProviderSkeletonReview.summary.hostExecutorCallsDuringAudit,
      totalProtocolMcpHostDispatchCallsDuringAudit:
        input.protocolMcpProviderSkeletonReview.summary.hostDispatchCallsDuringAudit,
      totalProtocolMcpShellProcessCallsDuringAudit:
        input.protocolMcpProviderSkeletonReview.summary.shellProcessCallsDuringAudit,
      totalProtocolMcpNetworkCallsDuringAudit:
        input.protocolMcpProviderSkeletonReview.summary.networkCallsDuringAudit,
      totalProtocolMcpWorkspaceWriteCallsDuringAudit:
        input.protocolMcpProviderSkeletonReview.summary.workspaceWriteCallsDuringAudit,
      totalProtocolMcpExternalWriteCallsDuringAudit:
        input.protocolMcpProviderSkeletonReview.summary.externalWriteCallsDuringAudit,
      totalProtocolA2aCallsDuringAudit:
        input.protocolA2aRemoteProviderSkeletonReview.summary.protocolA2aCallsDuringAudit,
      totalProtocolA2aLiveNetworkServiceStartsDuringAudit:
        input.protocolA2aRemoteProviderSkeletonReview.summary.liveNetworkServiceStartsDuringAudit,
      totalProtocolA2aRemoteAgentRuntimeCallsDuringAudit:
        input.protocolA2aRemoteProviderSkeletonReview.summary.remoteAgentRuntimeCallsDuringAudit,
      totalProtocolA2aRemoteTaskCreationsDuringAudit:
        input.protocolA2aRemoteProviderSkeletonReview.summary.remoteTaskCreationsDuringAudit,
      totalProtocolA2aProviderExecuteCallsDuringAudit:
        input.protocolA2aRemoteProviderSkeletonReview.summary.providerExecuteCallsDuringAudit,
      totalProtocolA2aCodexCliCallsDuringAudit:
        input.protocolA2aRemoteProviderSkeletonReview.summary.codexCliCallsDuringAudit,
      totalProtocolA2aDesktopPrimitiveCallsDuringAudit:
        input.protocolA2aRemoteProviderSkeletonReview.summary.desktopPrimitiveCallsDuringAudit,
      totalProtocolA2aSubAgentRuntimeCallsDuringAudit:
        input.protocolA2aRemoteProviderSkeletonReview.summary.subAgentRuntimeCallsDuringAudit,
      totalProtocolA2aHostExecutorCallsDuringAudit:
        input.protocolA2aRemoteProviderSkeletonReview.summary.hostExecutorCallsDuringAudit,
      totalProtocolA2aHostDispatchCallsDuringAudit:
        input.protocolA2aRemoteProviderSkeletonReview.summary.hostDispatchCallsDuringAudit,
      totalProtocolA2aShellProcessCallsDuringAudit:
        input.protocolA2aRemoteProviderSkeletonReview.summary.shellProcessCallsDuringAudit,
      totalProtocolA2aNetworkCallsDuringAudit:
        input.protocolA2aRemoteProviderSkeletonReview.summary.networkCallsDuringAudit,
      totalProtocolA2aWorkspaceWriteCallsDuringAudit:
        input.protocolA2aRemoteProviderSkeletonReview.summary.workspaceWriteCallsDuringAudit,
      totalProtocolA2aExternalWriteCallsDuringAudit:
        input.protocolA2aRemoteProviderSkeletonReview.summary.externalWriteCallsDuringAudit,
      totalAgentOsSdkCallsDuringAudit:
        input.agentOsSdkReview.summary.sdkCallsDuringAudit,
      totalAgentOsSdkLocalRuntimeCallsDuringAudit:
        input.agentOsSdkReview.summary.localRuntimeCallsDuringAudit,
      totalAgentOsSdkProviderExecuteCallsDuringAudit:
        input.agentOsSdkReview.summary.providerExecuteCallsDuringAudit,
      totalAgentOsSdkCodexCliCallsDuringAudit:
        input.agentOsSdkReview.summary.codexCliCallsDuringAudit,
      totalAgentOsSdkDesktopPrimitiveCallsDuringAudit:
        input.agentOsSdkReview.summary.desktopPrimitiveCallsDuringAudit,
      totalAgentOsSdkSubAgentRuntimeCallsDuringAudit:
        input.agentOsSdkReview.summary.subAgentRuntimeCallsDuringAudit,
      totalAgentOsSdkHostExecutorCallsDuringAudit:
        input.agentOsSdkReview.summary.hostExecutorCallsDuringAudit,
      totalAgentOsSdkHostDispatchCallsDuringAudit:
        input.agentOsSdkReview.summary.hostDispatchCallsDuringAudit,
      totalAgentOsSdkShellProcessCallsDuringAudit:
        input.agentOsSdkReview.summary.shellProcessCallsDuringAudit,
      totalAgentOsSdkNetworkCallsDuringAudit:
        input.agentOsSdkReview.summary.networkCallsDuringAudit,
      totalAgentOsSdkWorkspaceWriteCallsDuringAudit:
        input.agentOsSdkReview.summary.workspaceWriteCallsDuringAudit,
      totalAgentOsSdkExternalWriteCallsDuringAudit:
        input.agentOsSdkReview.summary.externalWriteCallsDuringAudit,
      totalAgentOsCliWrapperCallsDuringAudit:
        input.agentOsCliReview.summary.cliWrapperCallsDuringAudit,
      totalAgentOsCliLocalRuntimeCallsDuringAudit:
        input.agentOsCliReview.summary.localRuntimeCallsDuringAudit,
      totalAgentOsCliProviderExecuteCallsDuringAudit:
        input.agentOsCliReview.summary.providerExecuteCallsDuringAudit,
      totalAgentOsCliCodexCliCallsDuringAudit:
        input.agentOsCliReview.summary.codexCliCallsDuringAudit,
      totalAgentOsCliDesktopPrimitiveCallsDuringAudit:
        input.agentOsCliReview.summary.desktopPrimitiveCallsDuringAudit,
      totalAgentOsCliSubAgentRuntimeCallsDuringAudit:
        input.agentOsCliReview.summary.subAgentRuntimeCallsDuringAudit,
      totalAgentOsCliHostExecutorCallsDuringAudit:
        input.agentOsCliReview.summary.hostExecutorCallsDuringAudit,
      totalAgentOsCliHostDispatchCallsDuringAudit:
        input.agentOsCliReview.summary.hostDispatchCallsDuringAudit,
      totalAgentOsCliShellProcessCallsDuringAudit:
        input.agentOsCliReview.summary.shellProcessCallsDuringAudit,
      totalAgentOsCliNetworkCallsDuringAudit:
        input.agentOsCliReview.summary.networkCallsDuringAudit,
      totalAgentOsCliWorkspaceWriteCallsDuringAudit:
        input.agentOsCliReview.summary.workspaceWriteCallsDuringAudit,
      totalAgentOsCliExternalWriteCallsDuringAudit:
        input.agentOsCliReview.summary.externalWriteCallsDuringAudit,
      totalAgentOsAppServerWrapperCallsDuringAudit:
        input.agentOsAppServerReview.summary.appServerWrapperCallsDuringAudit,
      totalAgentOsAppServerLocalRuntimeCallsDuringAudit:
        input.agentOsAppServerReview.summary.localRuntimeCallsDuringAudit,
      totalAgentOsAppServerLiveHttpServerStartsDuringAudit:
        input.agentOsAppServerReview.summary.liveHttpServerStartsDuringAudit,
      totalAgentOsAppServerNetworkCallsDuringAudit:
        input.agentOsAppServerReview.summary.networkCallsDuringAudit,
      totalAgentOsAppServerProviderExecuteCallsDuringAudit:
        input.agentOsAppServerReview.summary.providerExecuteCallsDuringAudit,
      totalAgentOsAppServerCodexCliCallsDuringAudit:
        input.agentOsAppServerReview.summary.codexCliCallsDuringAudit,
      totalAgentOsAppServerDesktopPrimitiveCallsDuringAudit:
        input.agentOsAppServerReview.summary.desktopPrimitiveCallsDuringAudit,
      totalAgentOsAppServerSubAgentRuntimeCallsDuringAudit:
        input.agentOsAppServerReview.summary.subAgentRuntimeCallsDuringAudit,
      totalAgentOsAppServerHostExecutorCallsDuringAudit:
        input.agentOsAppServerReview.summary.hostExecutorCallsDuringAudit,
      totalAgentOsAppServerHostDispatchCallsDuringAudit:
        input.agentOsAppServerReview.summary.hostDispatchCallsDuringAudit,
      totalAgentOsAppServerShellProcessCallsDuringAudit:
        input.agentOsAppServerReview.summary.shellProcessCallsDuringAudit,
      totalAgentOsAppServerWorkspaceWriteCallsDuringAudit:
        input.agentOsAppServerReview.summary.workspaceWriteCallsDuringAudit,
      totalAgentOsAppServerExternalWriteCallsDuringAudit:
        input.agentOsAppServerReview.summary.externalWriteCallsDuringAudit,
      totalAgentOsPublicSurfaceCallsDuringAudit:
        input.agentOsPublicSurfacesReview.summary.agentOsPublicSurfaceCallsDuringAudit,
      totalAgentOsPublicSurfaceLocalRuntimeCallsDuringAudit:
        input.agentOsPublicSurfacesReview.summary.localRuntimeCallsDuringAudit,
      totalAgentOsPublicSurfaceProviderExecuteCallsDuringAudit:
        input.agentOsPublicSurfacesReview.summary.providerExecuteCallsDuringAudit,
      totalAgentOsPublicSurfaceCodexCliCallsDuringAudit:
        input.agentOsPublicSurfacesReview.summary.codexCliCallsDuringAudit,
      totalAgentOsPublicSurfaceDesktopPrimitiveCallsDuringAudit:
        input.agentOsPublicSurfacesReview.summary.desktopPrimitiveCallsDuringAudit,
      totalAgentOsPublicSurfaceSubAgentRuntimeCallsDuringAudit:
        input.agentOsPublicSurfacesReview.summary.subAgentRuntimeCallsDuringAudit,
      totalAgentOsPublicSurfaceHostExecutorCallsDuringAudit:
        input.agentOsPublicSurfacesReview.summary.hostExecutorCallsDuringAudit,
      totalAgentOsPublicSurfaceHostDispatchCallsDuringAudit:
        input.agentOsPublicSurfacesReview.summary.hostDispatchCallsDuringAudit,
      totalAgentOsPublicSurfaceShellProcessCallsDuringAudit:
        input.agentOsPublicSurfacesReview.summary.shellProcessCallsDuringAudit,
      totalAgentOsPublicSurfaceNetworkCallsDuringAudit:
        input.agentOsPublicSurfacesReview.summary.networkCallsDuringAudit,
      totalAgentOsPublicSurfaceWorkspaceWriteCallsDuringAudit:
        input.agentOsPublicSurfacesReview.summary.workspaceWriteCallsDuringAudit,
      totalAgentOsPublicSurfaceExternalWriteCallsDuringAudit:
        input.agentOsPublicSurfacesReview.summary.externalWriteCallsDuringAudit,
      totalProviderExecuteCallsDuringAudit: 0,
      totalPreflightCallsDuringAudit:
        input.preflightReview.summary.preflightCallsDuringAudit,
      totalPreflightProviderExecuteCallsDuringAudit:
        input.preflightReview.summary.providerExecuteCallsDuringAudit,
      totalPreflightCodexCliCallsDuringAudit:
        input.preflightReview.summary.codexCliCallsDuringAudit,
      totalPreflightDesktopPrimitiveCallsDuringAudit:
        input.preflightReview.summary.desktopPrimitiveCallsDuringAudit,
      totalPreflightSubAgentRuntimeCallsDuringAudit:
        input.preflightReview.summary.subAgentRuntimeCallsDuringAudit,
      totalPreflightHostExecutorCallsDuringAudit:
        input.preflightReview.summary.hostExecutorCallsDuringAudit,
      totalPreflightHostDispatchCallsDuringAudit:
        input.preflightReview.summary.hostDispatchCallsDuringAudit,
      totalPreflightToolRuntimeCallsDuringAudit:
        input.preflightReview.summary.toolRuntimeCallsDuringAudit,
      totalPreflightShellProcessCallsDuringAudit:
        input.preflightReview.summary.shellProcessCallsDuringAudit,
      totalPreflightNetworkCallsDuringAudit:
        input.preflightReview.summary.networkCallsDuringAudit,
      totalPreflightWorkspaceWriteCallsDuringAudit:
        input.preflightReview.summary.workspaceWriteCallsDuringAudit,
      totalPreflightExternalWriteCallsDuringAudit:
        input.preflightReview.summary.externalWriteCallsDuringAudit,
      totalApprovalPermitCallsDuringAudit:
        input.approvalPermitReview.summary.approvalPermitCallsDuringAudit,
      totalApprovalPermitValidationCallsDuringAudit:
        input.approvalPermitReview.summary.permitValidationCallsDuringAudit,
      totalApprovalPermitProviderExecuteCallsDuringAudit:
        input.approvalPermitReview.summary.providerExecuteCallsDuringAudit,
      totalApprovalPermitCodexCliCallsDuringAudit:
        input.approvalPermitReview.summary.codexCliCallsDuringAudit,
      totalApprovalPermitSubAgentRuntimeCallsDuringAudit:
        input.approvalPermitReview.summary.subAgentRuntimeCallsDuringAudit,
      totalApprovalPermitHostExecutorCallsDuringAudit:
        input.approvalPermitReview.summary.hostExecutorCallsDuringAudit,
      totalApprovalPermitToolRuntimeCallsDuringAudit:
        input.approvalPermitReview.summary.toolRuntimeCallsDuringAudit,
      totalApprovalPermitShellProcessCallsDuringAudit:
        input.approvalPermitReview.summary.shellProcessCallsDuringAudit,
      totalApprovalPermitWorkspaceWriteCallsDuringAudit:
        input.approvalPermitReview.summary.workspaceWriteCallsDuringAudit,
      totalApprovalPermitExternalWriteCallsDuringAudit:
        input.approvalPermitReview.summary.externalWriteCallsDuringAudit,
      totalApprovalGateCallsDuringAudit:
        input.approvalGateReview.summary.approvalGateCallsDuringAudit,
      totalApprovalGateResolutionChecksDuringAudit:
        input.approvalGateReview.summary.approvalResolutionChecksDuringAudit,
      totalApprovalGateProviderExecuteCallsDuringAudit:
        input.approvalGateReview.summary.providerExecuteCallsDuringAudit,
      totalApprovalGateCodexCliCallsDuringAudit:
        input.approvalGateReview.summary.codexCliCallsDuringAudit,
      totalApprovalGateSubAgentRuntimeCallsDuringAudit:
        input.approvalGateReview.summary.subAgentRuntimeCallsDuringAudit,
      totalApprovalGateHostExecutorCallsDuringAudit:
        input.approvalGateReview.summary.hostExecutorCallsDuringAudit,
      totalApprovalGateToolRuntimeCallsDuringAudit:
        input.approvalGateReview.summary.toolRuntimeCallsDuringAudit,
      totalApprovalGateShellProcessCallsDuringAudit:
        input.approvalGateReview.summary.shellProcessCallsDuringAudit,
      totalApprovalGateWorkspaceWriteCallsDuringAudit:
        input.approvalGateReview.summary.workspaceWriteCallsDuringAudit,
      totalApprovalGateExternalWriteCallsDuringAudit:
        input.approvalGateReview.summary.externalWriteCallsDuringAudit,
      totalApprovalConsumptionDispatchMatrixBoundaryProviderExecuteCallsDuringAudit:
        input.approvalConsumptionDispatchMatrixReview.summary.providerExecuteCallsDuringBoundaryAudit,
      totalApprovalConsumptionDispatchMatrixBoundaryCodexCliCallsDuringAudit:
        input.approvalConsumptionDispatchMatrixReview.summary.codexCliCallsDuringBoundaryAudit,
      totalApprovalConsumptionDispatchMatrixBoundaryWorkspaceWriteCallsDuringAudit:
        input.approvalConsumptionDispatchMatrixReview.summary.workspaceWriteCallsDuringBoundaryAudit,
      totalApprovalConsumptionDispatchMatrixBoundaryHostExecutorCallsDuringAudit:
        input.approvalConsumptionDispatchMatrixReview.summary.hostExecutorCallsDuringBoundaryAudit,
      totalApprovalConsumptionDispatchMatrixBoundarySubAgentRuntimeCallsDuringAudit:
        input.approvalConsumptionDispatchMatrixReview.summary.subAgentRuntimeCallsDuringBoundaryAudit,
      totalApprovalConsumptionDispatchMatrixBoundaryToolRuntimeCallsDuringAudit:
        input.approvalConsumptionDispatchMatrixReview.summary.toolRuntimeCallsDuringBoundaryAudit,
      totalApprovalConsumptionDispatchMatrixBoundaryShellProcessCallsDuringAudit:
        input.approvalConsumptionDispatchMatrixReview.summary.shellProcessCallsDuringBoundaryAudit,
      totalApprovalConsumptionDispatchMatrixBoundaryExternalWriteCallsDuringAudit:
        input.approvalConsumptionDispatchMatrixReview.summary.externalWriteCallsDuringBoundaryAudit,
      totalApprovalConsumptionDispatchProviderExecuteCallsDuringAudit:
        input.approvalConsumptionDispatchReview.summary.providerExecuteCallsDuringAudit,
      totalApprovalConsumptionDispatchCodexCliCallsDuringAudit:
        input.approvalConsumptionDispatchReview.summary.codexCliCallsDuringAudit,
      totalApprovalConsumptionDispatchWorkspaceWriteCallsDuringAudit:
        input.approvalConsumptionDispatchReview.summary.workspaceWriteCallsDuringAudit,
      totalApprovalConsumptionDispatchHostExecutorCallsDuringAudit:
        input.approvalConsumptionDispatchReview.summary.hostExecutorCallsDuringAudit,
      totalApprovalConsumptionDispatchSubAgentRuntimeCallsDuringAudit:
        input.approvalConsumptionDispatchReview.summary.subAgentRuntimeCallsDuringAudit,
      totalApprovalConsumptionDispatchShellProcessCallsDuringAudit:
        input.approvalConsumptionDispatchReview.summary.shellProcessCallsDuringAudit,
      totalApprovalConsumptionDispatchExternalWriteCallsDuringAudit:
        input.approvalConsumptionDispatchReview.summary.externalWriteCallsDuringAudit,
      totalReadonlyProductizationBoundaryProviderExecuteCallsDuringAudit:
        input.readonlyProductizationReview.summary.providerExecuteCallsDuringBoundaryAudit,
      totalReadonlyProductizationBoundaryCodexCliCallsDuringAudit:
        input.readonlyProductizationReview.summary.codexCliCallsDuringBoundaryAudit,
      totalReadonlyProductizationBoundaryWorkspaceWriteCallsDuringAudit:
        input.readonlyProductizationReview.summary.workspaceWriteCallsDuringBoundaryAudit,
      totalReadonlyProductizationBoundaryHostExecutorCallsDuringAudit:
        input.readonlyProductizationReview.summary.hostExecutorCallsDuringBoundaryAudit,
      totalReadonlyProductizationBoundarySubAgentRuntimeCallsDuringAudit:
        input.readonlyProductizationReview.summary.subAgentRuntimeCallsDuringBoundaryAudit,
      totalReadonlyProductizationBoundaryToolRuntimeCallsDuringAudit:
        input.readonlyProductizationReview.summary.toolRuntimeCallsDuringBoundaryAudit,
      totalReadonlyProductizationBoundaryShellProcessCallsDuringAudit:
        input.readonlyProductizationReview.summary.shellProcessCallsDuringBoundaryAudit,
      totalReadonlyProductizationBoundaryExternalWriteCallsDuringAudit:
        input.readonlyProductizationReview.summary.externalWriteCallsDuringBoundaryAudit,
      totalReadonlyProductizationBoundaryEvidenceWritesDuringAudit:
        input.readonlyProductizationReview.summary.evidenceWritesDuringBoundaryAudit,
      totalStateSyncBoundaryProviderExecuteCallsDuringAudit:
        input.stateSyncReview.summary.providerExecuteCallsDuringBoundaryAudit,
      totalStateSyncBoundaryCodexCliCallsDuringAudit:
        input.stateSyncReview.summary.codexCliCallsDuringBoundaryAudit,
      totalStateSyncBoundaryWorkspaceWriteCallsDuringAudit:
        input.stateSyncReview.summary.workspaceWriteCallsDuringBoundaryAudit,
      totalStateSyncBoundaryLocalCommandCallsDuringAudit:
        input.stateSyncReview.summary.localCommandCallsDuringBoundaryAudit,
      totalStateSyncBoundaryHostExecutorCallsDuringAudit:
        input.stateSyncReview.summary.hostExecutorCallsDuringBoundaryAudit,
      totalStateSyncBoundarySubAgentRuntimeCallsDuringAudit:
        input.stateSyncReview.summary.subAgentRuntimeCallsDuringBoundaryAudit,
      totalStateSyncBoundaryToolRuntimeCallsDuringAudit:
        input.stateSyncReview.summary.toolRuntimeCallsDuringBoundaryAudit,
      totalStateSyncBoundaryExternalWriteCallsDuringAudit:
        input.stateSyncReview.summary.externalWriteCallsDuringBoundaryAudit,
      totalStateSyncBoundaryStateWritesDuringAudit:
        input.stateSyncReview.summary.stateWritesDuringBoundaryAudit,
      totalStateSyncBoundaryRemoteWritesDuringAudit:
        input.stateSyncReview.summary.remoteWritesDuringBoundaryAudit,
      totalWorkspaceWriteReleaseGateProviderExecuteCallsDuringAudit:
        input.workspaceWriteReleaseGateReview.summary.providerExecuteCallsDuringAudit,
      totalWorkspaceWriteReleaseGateCodexCliCallsDuringAudit:
        input.workspaceWriteReleaseGateReview.summary.codexCliCallsDuringAudit,
      totalWorkspaceWriteReleaseGateWorkspaceWriteCallsDuringAudit:
        input.workspaceWriteReleaseGateReview.summary.workspaceWriteCallsDuringAudit,
      totalWorkspaceWriteReleaseGateHostExecutorCallsDuringAudit:
        input.workspaceWriteReleaseGateReview.summary.hostExecutorCallsDuringAudit,
      totalWorkspaceWriteReleaseGateSubAgentRuntimeCallsDuringAudit:
        input.workspaceWriteReleaseGateReview.summary.subAgentRuntimeCallsDuringAudit,
      totalWorkspaceWriteReleaseGateExternalWriteCallsDuringAudit:
        input.workspaceWriteReleaseGateReview.summary.externalWriteCallsDuringAudit,
      totalWorkspaceWriteReleaseGateEvidenceWritesDuringAudit:
        input.workspaceWriteReleaseGateReview.summary.evidenceWritesDuringAudit,
      totalAdmissionControlCallsDuringAudit:
        input.admissionControlReview.summary.admissionControlCallsDuringAudit,
      totalAdmissionControlProviderExecuteCallsDuringAudit:
        input.admissionControlReview.summary.providerExecuteCallsDuringAudit,
      totalAdmissionControlCodexCliCallsDuringAudit:
        input.admissionControlReview.summary.codexCliCallsDuringAudit,
      totalAdmissionControlSubAgentRuntimeCallsDuringAudit:
        input.admissionControlReview.summary.subAgentRuntimeCallsDuringAudit,
      totalAdmissionControlHostExecutorCallsDuringAudit:
        input.admissionControlReview.summary.hostExecutorCallsDuringAudit,
      totalAdmissionControlToolRuntimeCallsDuringAudit:
        input.admissionControlReview.summary.toolRuntimeCallsDuringAudit,
      totalAdmissionControlShellProcessCallsDuringAudit:
        input.admissionControlReview.summary.shellProcessCallsDuringAudit,
      totalAdmissionControlWorkspaceWriteCallsDuringAudit:
        input.admissionControlReview.summary.workspaceWriteCallsDuringAudit,
      totalAdmissionControlExternalWriteCallsDuringAudit:
        input.admissionControlReview.summary.externalWriteCallsDuringAudit,
      totalDelegationPolicyCallsDuringAudit:
        input.delegationPolicyReview.summary.delegationPolicyCallsDuringAudit,
      totalDelegationPolicyProposalLifecycleCallsDuringAudit:
        input.delegationPolicyReview.summary.proposalLifecycleCallsDuringAudit,
      totalDelegationPolicyFileStoreWritesDuringAudit:
        input.delegationPolicyReview.summary.fileStoreWritesDuringAudit,
      totalDelegationPolicyProviderExecuteCallsDuringAudit:
        input.delegationPolicyReview.summary.providerExecuteCallsDuringAudit,
      totalDelegationPolicyCodexCliCallsDuringAudit:
        input.delegationPolicyReview.summary.codexCliCallsDuringAudit,
      totalDelegationPolicySubAgentRuntimeCallsDuringAudit:
        input.delegationPolicyReview.summary.subAgentRuntimeCallsDuringAudit,
      totalDelegationPolicyHostExecutorCallsDuringAudit:
        input.delegationPolicyReview.summary.hostExecutorCallsDuringAudit,
      totalDelegationPolicyToolRuntimeCallsDuringAudit:
        input.delegationPolicyReview.summary.toolRuntimeCallsDuringAudit,
      totalDelegationPolicyShellProcessCallsDuringAudit:
        input.delegationPolicyReview.summary.shellProcessCallsDuringAudit,
      totalDelegationPolicyWorkspaceWriteCallsDuringAudit:
        input.delegationPolicyReview.summary.workspaceWriteCallsDuringAudit,
      totalDelegationPolicyExternalWriteCallsDuringAudit:
        input.delegationPolicyReview.summary.externalWriteCallsDuringAudit,
      totalExecutionEligibilityCallsDuringAudit: 0,
      totalExecutionEligibilityPermitStoreReadsDuringAudit: 0,
      totalExecutionEligibilityProviderPlanCreationCallsDuringAudit: 0,
      totalExecutionEligibilityProviderExecuteCallsDuringAudit: 0,
      totalExecutionEligibilityCodexCliCallsDuringAudit: 0,
      totalExecutionEligibilitySubAgentRuntimeCallsDuringAudit: 0,
      totalExecutionEligibilityHostExecutorCallsDuringAudit: 0,
      totalExecutionEligibilityHostDispatchCallsDuringAudit: 0,
      totalExecutionEligibilityShellProcessCallsDuringAudit: 0,
      totalExecutionEligibilityWorkspaceWriteCallsDuringAudit: 0,
      totalExecutionEligibilityExternalWriteCallsDuringAudit: 0,
      totalExecutionObservationBusEmitsDuringAudit: 0,
      totalExecutionObservationStoreWritesDuringAudit: 0,
      totalExecutionObservationProviderExecuteCallsDuringAudit: 0,
      totalExecutionObservationCodexCliCallsDuringAudit: 0,
      totalExecutionObservationSubAgentRuntimeCallsDuringAudit: 0,
      totalExecutionObservationHostExecutorCallsDuringAudit: 0,
      totalExecutionObservationHostDispatchCallsDuringAudit: 0,
      totalExecutionObservationShellProcessCallsDuringAudit: 0,
      totalExecutionObservationWorkspaceWriteCallsDuringAudit: 0,
      totalExecutionObservationExternalWriteCallsDuringAudit: 0,
      totalGovernanceFailureReducerCallbackCallsDuringAudit:
        input.governanceFailureReducerReview.summary.reducerCallsCallbacksDuringAudit,
      totalGovernanceFailureReducerPersistenceWritesDuringAudit:
        input.governanceFailureReducerReview.summary.reducerPersistenceWritesDuringAudit,
      totalGovernanceFailureReducerProviderExecuteCallsDuringAudit:
        input.governanceFailureReducerReview.summary.providerExecuteCallsDuringAudit,
      totalGovernanceFailureReducerCodexCliCallsDuringAudit:
        input.governanceFailureReducerReview.summary.codexCliCallsDuringAudit,
      totalGovernanceFailureReducerSubAgentRuntimeCallsDuringAudit:
        input.governanceFailureReducerReview.summary.subAgentRuntimeCallsDuringAudit,
      totalGovernanceFailureReducerHostExecutorCallsDuringAudit:
        input.governanceFailureReducerReview.summary.hostExecutorCallsDuringAudit,
      totalGovernanceFailureReducerHostDispatchCallsDuringAudit:
        input.governanceFailureReducerReview.summary.hostDispatchCallsDuringAudit,
      totalGovernanceFailureReducerToolRuntimeCallsDuringAudit:
        input.governanceFailureReducerReview.summary.toolRuntimeCallsDuringAudit,
      totalGovernanceFailureReducerShellProcessCallsDuringAudit:
        input.governanceFailureReducerReview.summary.shellProcessCallsDuringAudit,
      totalGovernanceFailureReducerWorkspaceWriteCallsDuringAudit:
        input.governanceFailureReducerReview.summary.workspaceWriteCallsDuringAudit,
      totalGovernanceFailureReducerExternalWriteCallsDuringAudit:
        input.governanceFailureReducerReview.summary.externalWriteCallsDuringAudit,
      totalTaskGraphCallsDuringAudit:
        input.taskGraphReview.summary.taskGraphCallsDuringAudit,
      totalTaskGraphStoreWritesDuringAudit:
        input.taskGraphReview.summary.taskGraphStoreWritesDuringAudit,
      totalTaskGraphProviderExecuteCallsDuringAudit:
        input.taskGraphReview.summary.providerExecuteCallsDuringAudit,
      totalTaskGraphCodexCliCallsDuringAudit:
        input.taskGraphReview.summary.codexCliCallsDuringAudit,
      totalTaskGraphSubAgentRuntimeCallsDuringAudit:
        input.taskGraphReview.summary.subAgentRuntimeCallsDuringAudit,
      totalTaskGraphHostExecutorCallsDuringAudit:
        input.taskGraphReview.summary.hostExecutorCallsDuringAudit,
      totalTaskGraphHostDispatchCallsDuringAudit:
        input.taskGraphReview.summary.hostDispatchCallsDuringAudit,
      totalTaskGraphToolRuntimeCallsDuringAudit:
        input.taskGraphReview.summary.toolRuntimeCallsDuringAudit,
      totalTaskGraphShellProcessCallsDuringAudit:
        input.taskGraphReview.summary.shellProcessCallsDuringAudit,
      totalTaskGraphWorkspaceWriteCallsDuringAudit:
        input.taskGraphReview.summary.workspaceWriteCallsDuringAudit,
      totalTaskGraphExternalWriteCallsDuringAudit:
        input.taskGraphReview.summary.externalWriteCallsDuringAudit,
      totalSchedulerCallsDuringAudit:
        input.schedulerReview.summary.schedulerCallsDuringAudit,
      totalSchedulerLeaseAcquisitionsDuringAudit:
        input.schedulerReview.summary.schedulerLeaseAcquisitionsDuringAudit,
      totalSchedulerStateWritesDuringAudit:
        input.schedulerReview.summary.schedulerStateWritesDuringAudit,
      totalSchedulerProviderExecuteCallsDuringAudit:
        input.schedulerReview.summary.providerExecuteCallsDuringAudit,
      totalSchedulerCodexCliCallsDuringAudit:
        input.schedulerReview.summary.codexCliCallsDuringAudit,
      totalSchedulerSubAgentRuntimeCallsDuringAudit:
        input.schedulerReview.summary.subAgentRuntimeCallsDuringAudit,
      totalSchedulerHostExecutorCallsDuringAudit:
        input.schedulerReview.summary.hostExecutorCallsDuringAudit,
      totalSchedulerHostDispatchCallsDuringAudit:
        input.schedulerReview.summary.hostDispatchCallsDuringAudit,
      totalSchedulerToolRuntimeCallsDuringAudit:
        input.schedulerReview.summary.toolRuntimeCallsDuringAudit,
      totalSchedulerShellProcessCallsDuringAudit:
        input.schedulerReview.summary.shellProcessCallsDuringAudit,
      totalSchedulerWorkspaceWriteCallsDuringAudit:
        input.schedulerReview.summary.workspaceWriteCallsDuringAudit,
      totalSchedulerExternalWriteCallsDuringAudit:
        input.schedulerReview.summary.externalWriteCallsDuringAudit,
      totalExecutionPlannerCallsDuringAudit: 0,
      totalExecutionPlannerLocalPlanStoreWritesDuringAudit: 0,
      totalExecutionPlannerProviderPlanExecutionCallsDuringAudit: 0,
      totalExecutionPlannerProviderValidateExecutionPlanCallsDuringAudit: 0,
      totalExecutionPlannerProviderExecuteCallsDuringAudit: 0,
      totalExecutionPlannerCodexCliCallsDuringAudit: 0,
      totalExecutionPlannerSubAgentRuntimeCallsDuringAudit: 0,
      totalExecutionPlannerHostExecutorCallsDuringAudit: 0,
      totalExecutionPlannerHostDispatchCallsDuringAudit: 0,
      totalExecutionPlannerShellProcessCallsDuringAudit: 0,
      totalExecutionPlannerWorkspaceWriteCallsDuringAudit: 0,
      totalExecutionPlannerExternalWriteCallsDuringAudit: 0,
      totalProviderRegistryCallsDuringAudit: 0,
      totalProviderRegistrySelectionCallsDuringAudit: 0,
      totalProviderRegistryProviderExecuteCallsDuringAudit: 0,
      totalProviderRegistryCodexCliCallsDuringAudit: 0,
      totalProviderRegistrySubAgentRuntimeCallsDuringAudit: 0,
      totalProviderRegistryHostExecutorCallsDuringAudit: 0,
      totalProviderRegistryToolRuntimeCallsDuringAudit: 0,
      totalProviderRegistryShellProcessCallsDuringAudit: 0,
      totalProviderRegistryWorkspaceWriteCallsDuringAudit: 0,
      totalProviderRegistryExternalWriteCallsDuringAudit: 0,
      totalControlledProviderExecutionTaskbookProviderExecuteCallsDuringAudit:
        input.controlledProviderExecutionTaskbookReview.summary.providerExecuteCallsDuringAudit,
      totalControlledProviderExecutionTaskbookCodexCliCallsDuringAudit:
        input.controlledProviderExecutionTaskbookReview.summary.codexCliCallsDuringAudit,
      totalControlledProviderExecutionTaskbookWorkspaceWriteCallsDuringAudit:
        input.controlledProviderExecutionTaskbookReview.summary.workspaceWriteCallsDuringAudit,
      totalControlledProviderExecutionTaskbookHostExecutorCallsDuringAudit:
        input.controlledProviderExecutionTaskbookReview.summary.hostExecutorCallsDuringAudit,
      totalControlledProviderExecutionTaskbookSubAgentRuntimeCallsDuringAudit:
        input.controlledProviderExecutionTaskbookReview.summary.subAgentRuntimeCallsDuringAudit,
      totalControlledProviderExecutionTaskbookShellProcessCallsDuringAudit:
        input.controlledProviderExecutionTaskbookReview.summary.shellProcessCallsDuringAudit,
      totalControlledProviderExecutionTaskbookExternalWriteCallsDuringAudit:
        input.controlledProviderExecutionTaskbookReview.summary.externalWriteCallsDuringAudit,
      totalControlledProviderExecutionTaskbookEvidenceWritesDuringAudit:
        input.controlledProviderExecutionTaskbookReview.summary.evidenceWritesDuringAudit,
      totalControlledProviderExecutionTaskbookReviewBoundaryProviderExecuteCallsDuringAudit:
        input.controlledProviderExecutionTaskbookReviewBoundaryReview.summary.providerExecuteCallsDuringBoundaryAudit,
      totalControlledProviderExecutionTaskbookReviewBoundaryCodexCliCallsDuringAudit:
        input.controlledProviderExecutionTaskbookReviewBoundaryReview.summary.codexCliCallsDuringBoundaryAudit,
      totalControlledProviderExecutionTaskbookReviewBoundaryWorkspaceWriteCallsDuringAudit:
        input.controlledProviderExecutionTaskbookReviewBoundaryReview.summary.workspaceWriteCallsDuringBoundaryAudit,
      totalControlledProviderExecutionTaskbookReviewBoundaryHostExecutorCallsDuringAudit:
        input.controlledProviderExecutionTaskbookReviewBoundaryReview.summary.hostExecutorCallsDuringBoundaryAudit,
      totalControlledProviderExecutionTaskbookReviewBoundarySubAgentRuntimeCallsDuringAudit:
        input.controlledProviderExecutionTaskbookReviewBoundaryReview.summary.subAgentRuntimeCallsDuringBoundaryAudit,
      totalControlledProviderExecutionTaskbookReviewBoundaryShellProcessCallsDuringAudit:
        input.controlledProviderExecutionTaskbookReviewBoundaryReview.summary.shellProcessCallsDuringBoundaryAudit,
      totalControlledProviderExecutionTaskbookReviewBoundaryExternalWriteCallsDuringAudit:
        input.controlledProviderExecutionTaskbookReviewBoundaryReview.summary.externalWriteCallsDuringBoundaryAudit,
      totalControlledProviderExecutionTaskbookReviewBoundaryEvidenceWritesDuringAudit:
        input.controlledProviderExecutionTaskbookReviewBoundaryReview.summary.evidenceWritesDuringBoundaryAudit,
      totalControlledProviderExecutionDispatchPreflightProviderExecuteCallsDuringAudit:
        input.controlledProviderExecutionDispatchPreflightReview.summary.providerExecuteCallsDuringAudit,
      totalControlledProviderExecutionDispatchPreflightCodexCliCallsDuringAudit:
        input.controlledProviderExecutionDispatchPreflightReview.summary.codexCliCallsDuringAudit,
      totalControlledProviderExecutionDispatchPreflightWorkspaceWriteCallsDuringAudit:
        input.controlledProviderExecutionDispatchPreflightReview.summary.workspaceWriteCallsDuringAudit,
      totalControlledProviderExecutionDispatchPreflightHostExecutorCallsDuringAudit:
        input.controlledProviderExecutionDispatchPreflightReview.summary.hostExecutorCallsDuringAudit,
      totalControlledProviderExecutionDispatchPreflightSubAgentRuntimeCallsDuringAudit:
        input.controlledProviderExecutionDispatchPreflightReview.summary.subAgentRuntimeCallsDuringAudit,
      totalControlledProviderExecutionDispatchPreflightShellProcessCallsDuringAudit:
        input.controlledProviderExecutionDispatchPreflightReview.summary.shellProcessCallsDuringAudit,
      totalControlledProviderExecutionDispatchPreflightExternalWriteCallsDuringAudit:
        input.controlledProviderExecutionDispatchPreflightReview.summary.externalWriteCallsDuringAudit,
      totalControlledProviderExecutionDispatchPreflightEvidenceWritesDuringAudit:
        input.controlledProviderExecutionDispatchPreflightReview.summary.evidenceWritesDuringAudit,
      totalControlledProviderExecutionDispatcherRunnerInvocationsDuringAudit:
        input.controlledProviderExecutionDispatcherReview.summary.runnerInvocationsDuringAudit,
      totalControlledProviderExecutionDispatcherProviderExecuteCallsDuringAudit:
        input.controlledProviderExecutionDispatcherReview.summary.providerExecuteCallsDuringAudit,
      totalControlledProviderExecutionDispatcherRealCodexCliCallsDuringAudit:
        input.controlledProviderExecutionDispatcherReview.summary.realCodexCliCallsDuringAudit,
      totalControlledProviderExecutionDispatcherWorkspaceWriteCallsDuringAudit:
        input.controlledProviderExecutionDispatcherReview.summary.workspaceWriteCallsDuringAudit,
      totalControlledProviderExecutionDispatcherHostExecutorCallsDuringAudit:
        input.controlledProviderExecutionDispatcherReview.summary.hostExecutorCallsDuringAudit,
      totalControlledProviderExecutionDispatcherSubAgentRuntimeCallsDuringAudit:
        input.controlledProviderExecutionDispatcherReview.summary.subAgentRuntimeCallsDuringAudit,
      totalControlledProviderExecutionDispatcherShellProcessCallsDuringAudit:
        input.controlledProviderExecutionDispatcherReview.summary.shellProcessCallsDuringAudit,
      totalControlledProviderExecutionDispatcherExternalWriteCallsDuringAudit:
        input.controlledProviderExecutionDispatcherReview.summary.externalWriteCallsDuringAudit,
      totalProviderExecutionRunnerCallsDuringAudit: 0,
      totalProviderExecutionRunnerPlanExecutionCallsDuringAudit: 0,
      totalProviderExecutionRunnerValidateExecutionPlanCallsDuringAudit: 0,
      totalProviderExecutionRunnerExecuteCallsDuringAudit: 0,
      totalProviderCoreRuntimeCallsDuringAudit: 0,
      totalToolRegistryCallsDuringAudit: 0,
      totalToolInvocationPlansDuringAudit: 0,
      totalToolInvocationPlannerToolRuntimeCallsDuringAudit: 0,
      totalToolInvocationPlannerProviderExecuteCallsDuringAudit: 0,
      totalToolInvocationPlannerCodexCliCallsDuringAudit: 0,
      totalToolInvocationPlannerSubAgentRuntimeCallsDuringAudit: 0,
      totalToolInvocationPlannerHostExecutorCallsDuringAudit: 0,
      totalToolInvocationPlannerShellProcessCallsDuringAudit: 0,
      totalToolInvocationPlannerWorkspaceWriteCallsDuringAudit: 0,
      totalToolInvocationPlannerExternalWriteCallsDuringAudit: 0,
      totalDesktopAgentStrategyCallsDuringAudit:
        input.desktopAgentStrategyReview.summary.desktopAgentStrategyCallsDuringAudit,
      totalDesktopAgentStrategyProviderExecuteCallsDuringAudit:
        input.desktopAgentStrategyReview.summary.providerExecuteCallsDuringAudit,
      totalDesktopAgentStrategyCodexCliCallsDuringAudit:
        input.desktopAgentStrategyReview.summary.codexCliCallsDuringAudit,
      totalDesktopAgentStrategyDesktopPrimitiveCallsDuringAudit:
        input.desktopAgentStrategyReview.summary.desktopPrimitiveCallsDuringAudit,
      totalDesktopAgentStrategySubAgentRuntimeCallsDuringAudit:
        input.desktopAgentStrategyReview.summary.subAgentRuntimeCallsDuringAudit,
      totalDesktopAgentStrategyHostExecutorCallsDuringAudit:
        input.desktopAgentStrategyReview.summary.hostExecutorCallsDuringAudit,
      totalDesktopAgentStrategyHostDispatchCallsDuringAudit:
        input.desktopAgentStrategyReview.summary.hostDispatchCallsDuringAudit,
      totalDesktopAgentStrategyShellProcessCallsDuringAudit:
        input.desktopAgentStrategyReview.summary.shellProcessCallsDuringAudit,
      totalDesktopAgentStrategyWorkspaceWriteCallsDuringAudit:
        input.desktopAgentStrategyReview.summary.workspaceWriteCallsDuringAudit,
      totalDesktopAgentStrategyExternalWriteCallsDuringAudit:
        input.desktopAgentStrategyReview.summary.externalWriteCallsDuringAudit,
      totalDesktopDecisionRunnerCallsDuringAudit: 0,
      totalDesktopDecisionRunnerHostDispatchCallsDuringAudit: 0,
      totalDesktopDecisionRunnerProviderExecuteCallsDuringAudit: 0,
      totalFinalHostLocatorCallsDuringAudit: 0,
      totalFinalHostLocatorHostExecutorCallsDuringAudit: 0,
      totalFinalHostLocatorHostDispatchCallsDuringAudit: 0,
      totalFinalHostLocatorProviderExecuteCallsDuringAudit: 0,
      totalFinalHostLocatorCodexCliCallsDuringAudit: 0,
      totalFinalHostLocatorSubAgentRuntimeCallsDuringAudit: 0,
      totalFinalHostLocatorShellProcessCallsDuringAudit: 0,
      totalFinalHostLocatorWorkspaceWriteCallsDuringAudit: 0,
      totalFinalHostLocatorExternalWriteCallsDuringAudit: 0,
      totalRemoteAgentRuntimeCallsDuringAudit: 0,
      totalToolRuntimeCallsDuringAudit: 0,
      totalHostDispatcherProviderDispatchCallsDuringAudit: 0,
      totalCodexDesktopBridgeCallsDuringAudit: 0,
      totalCodexDesktopRuntimeToolCallsDuringAudit: 0,
      totalCodexDesktopLiveHostBundleCreationsDuringAudit: 0,
      totalCodexDesktopLiveHostRuntimeToolCallsDuringAudit: 0,
      totalCodexDesktopLiveHostMemoryToolCallsDuringAudit: 0,
      totalCodexDesktopLiveHostBridgeCallsDuringAudit: 0,
      totalCodexDesktopLiveHostClientRunCallsDuringAudit: 0,
      totalCodexDesktopLiveHostSmokeRunsDuringAudit: 0,
      totalCodexMemoryMcpClientMcpHttpCallsDuringAudit: 0,
      totalCodexMemoryMcpClientMemoryToolCallsDuringAudit: 0,
      totalCodexMemoryMcpClientHostExecutorInvocationsDuringAudit: 0,
      totalCodexMemoryMcpClientCodexCliCallsDuringAudit: 0,
      totalCodexMemoryMcpClientProviderExecuteCallsDuringAudit: 0,
      totalCodexMemoryMcpClientSubAgentRuntimeCallsDuringAudit: 0,
      totalCodexMemoryMcpClientShellProcessCallsDuringAudit: 0,
      totalCodexMemoryMcpClientWorkspaceWriteCallsDuringAudit: 0,
      totalCodexMemoryMcpClientExternalWriteCallsDuringAudit: 0,
      totalCodexMemoryHostClientCallsDuringAudit: 0,
      totalCodexMemoryHostClientMemoryOperationCallsDuringAudit: 0,
      totalCodexMemoryHostClientHostExecutorInvocationsDuringAudit: 0,
      totalCodexMemoryHostClientCodexCliCallsDuringAudit: 0,
      totalCodexMemoryHostClientProviderExecuteCallsDuringAudit: 0,
      totalCodexMemoryHostClientSubAgentRuntimeCallsDuringAudit: 0,
      totalCodexMemoryHostClientShellProcessCallsDuringAudit: 0,
      totalCodexMemoryHostClientWorkspaceWriteCallsDuringAudit: 0,
      totalCodexMemoryHostClientExternalWriteCallsDuringAudit: 0,
      totalDesktopHostClientCallsDuringAudit: 0,
      totalDesktopHostClientLiveAdapterCallsDuringAudit: 0,
      totalDesktopHostClientHostExecutorInvocationsDuringAudit: 0,
      totalDesktopHostClientDispatchToHostCallsDuringAudit: 0,
      totalDesktopLiveAdapterCallsDuringAudit: 0,
      totalDesktopLiveAdapterDispatchToHostCallsDuringAudit: 0,
      totalDesktopLiveAdapterBridgeCallsDuringAudit: 0,
      totalHostClientExampleCallsDuringAudit: 0,
      totalHostClientExampleLiveAdapterCallsDuringAudit: 0,
      totalHostClientExampleHostExecutorInvocationsDuringAudit: 0,
      totalTargetHostEmbeddingBundleCreationsDuringAudit: 0,
      totalTargetHostEmbeddingHostClientRunCallsDuringAudit: 0,
      totalTargetHostEmbeddingHostExecutorInvocationsDuringAudit: 0,
      totalTargetHostEmbeddingCodexCliCallsDuringAudit: 0,
      totalTargetHostEmbeddingProviderExecuteCallsDuringAudit: 0,
      totalTargetHostEmbeddingSubAgentRuntimeCallsDuringAudit: 0,
      totalTargetHostEmbeddingShellProcessCallsDuringAudit: 0,
      totalTargetHostEmbeddingWorkspaceWriteCallsDuringAudit: 0,
      totalTargetHostEmbeddingExternalWriteCallsDuringAudit: 0,
      totalHostExecutorInvocationsDuringAudit: 0,
      totalHostExecutorTaskbookDispatchCallsDuringAudit: 0,
      totalHostClientReviewBridgeCallsDuringAudit: 0,
      totalHostClientReviewDispatchCallsDuringAudit: 0,
      totalHostExecutorReceiptInvocationsDuringAudit: 0,
      totalAgentBackedSandboxExecutorInvocationsDuringAudit: 0,
      totalAgentExecutorAdapterTaskbookInvocationsDuringAudit: 0,
      totalAgentExecutorAdapterReviewInvocationsDuringAudit: 0,
      totalAgentExecutorAdapterInvocationsDuringAudit: 0,
      totalAgentTaskControlTaskbookInvocationsDuringAudit: 0,
      totalAgentTaskControlReviewInvocationsDuringAudit: 0,
      totalSubAgentRuntimeCallsDuringAudit: 0,
      totalShellProcessCallsDuringAudit: 0,
      totalWorkspaceWriteCallsDuringAudit: 0,
      totalExternalWriteCallsDuringAudit: 0,
      totalAdapterInvocationsDuringAudit: 0
    },
    reasons
  };
}

export function formatExecutionBoundaryCurrentSurfaceAuditResult(
  review: ExecutionBoundaryCurrentSurfaceAuditResult,
  format: ExecutionBoundaryCurrentSurfaceAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Execution boundary current surface audit",
    `status: ${review.status}`,
    `current audits: ${review.summary.currentAudits.join(",")}`,
    `execution authority lattice mode: ${review.summary.executionAuthorityLatticeMode}`,
    `Codex CLI host does not authorize host executor or sub-agent runtime: ${review.summary.codexCliHostDoesNotAuthorizeHostExecutorOrSubAgentRuntime}`,
    `sub-agent runtime does not invoke Codex CLI or provider execution: ${review.summary.subAgentRuntimeDoesNotInvokeCodexCliOrProviderExecution}`,
    `host executor does not execute provider or sub-agent runtime: ${review.summary.hostExecutorDoesNotExecuteProviderOrSubAgentRuntime}`,
    `strategy router mode: ${review.summary.strategyRouterMode}`,
    `execution profiles mode: ${review.summary.executionProfilesMode}`,
    `policy config mode: ${review.summary.policyConfigMode}`,
    `capability taxonomy mode: ${review.summary.capabilityTaxonomyMode}`,
    `routing engine mode: ${review.summary.routingEngineMode}`,
    `recovery control mode: ${review.summary.recoveryControlMode}`,
    `runtime control mode: ${review.summary.runtimeControlMode}`,
    `operator action executor gate mode: ${review.summary.operatorActionExecutorGateMode}`,
    `Codex CLI host mode: ${review.summary.codexCliHostMode}`,
    `public API mode: ${review.summary.publicApiMode}`,
    `Agent OS local runtime mode: ${review.summary.agentOsLocalRuntimeMode}`,
    `Agent OS MCP server manifest mode: ${review.summary.agentOsMcpServerManifestMode}`,
    `protocol MCP provider skeleton mode: ${review.summary.protocolMcpProviderSkeletonMode}`,
    `protocol A2A remote provider skeleton mode: ${review.summary.protocolA2aRemoteProviderSkeletonMode}`,
    `Agent OS SDK mode: ${review.summary.agentOsSdkMode}`,
    `Agent OS CLI mode: ${review.summary.agentOsCliMode}`,
    `Agent OS app-server mode: ${review.summary.agentOsAppServerMode}`,
    `Agent OS public surfaces mode: ${review.summary.agentOsPublicSurfacesMode}`,
    `Codex provider mode: ${review.summary.codexProviderMode}`,
    `preflight mode: ${review.summary.preflightMode}`,
    `approval permit mode: ${review.summary.approvalPermitMode}`,
    `approval gate mode: ${review.summary.approvalGateMode}`,
    `approval consumption dispatch matrix boundary mode: ${review.summary.approvalConsumptionDispatchMatrixBoundaryMode}`,
    `approval consumption dispatch mode: ${review.summary.approvalConsumptionDispatchMode}`,
    `read-only productization boundary mode: ${review.summary.readonlyProductizationBoundaryMode}`,
    `state-sync boundary mode: ${review.summary.stateSyncBoundaryMode}`,
    `workspace-write release gate mode: ${review.summary.workspaceWriteReleaseGateMode}`,
    `admission control mode: ${review.summary.admissionControlMode}`,
    `delegation policy mode: ${review.summary.delegationPolicyMode}`,
    `execution eligibility mode: ${review.summary.executionEligibilityMode}`,
    `execution observation mode: ${review.summary.executionObservationMode}`,
    `governance failure reducer mode: ${review.summary.governanceFailureReducerMode}`,
    `task graph mode: ${review.summary.taskGraphMode}`,
    `scheduler mode: ${review.summary.schedulerMode}`,
    `execution planner mode: ${review.summary.executionPlannerMode}`,
    `provider registry mode: ${review.summary.providerRegistryMode}`,
    `controlled provider execution taskbook mode: ${review.summary.controlledProviderExecutionTaskbookMode}`,
    `controlled provider execution taskbook review boundary mode: ${review.summary.controlledProviderExecutionTaskbookReviewBoundaryMode}`,
    `controlled provider execution dispatch preflight mode: ${review.summary.controlledProviderExecutionDispatchPreflightMode}`,
    `controlled provider execution dispatcher mode: ${review.summary.controlledProviderExecutionDispatcherMode}`,
    `provider execution runner mode: ${review.summary.providerExecutionRunnerMode}`,
    `provider-core primitive mode: ${review.summary.providerCorePrimitiveMode}`,
    `Tool invocation planner mode: ${review.summary.toolInvocationPlannerMode}`,
    `desktop agent strategy mode: ${review.summary.desktopAgentStrategyMode}`,
    `desktop decision runner mode: ${review.summary.desktopDecisionRunnerMode}`,
    `final host locator mode: ${review.summary.finalHostLocatorMode}`,
    `host dispatcher provider mode: ${review.summary.hostDispatcherProviderMode}`,
    `Codex desktop bridge mode: ${review.summary.codexDesktopBridgeMode}`,
    `Codex desktop live host mode: ${review.summary.codexDesktopLiveHostMode}`,
    `Codex memory MCP client mode: ${review.summary.codexMemoryMcpClientMode}`,
    `Codex memory host client mode: ${review.summary.codexMemoryHostClientMode}`,
    `desktop host client mode: ${review.summary.desktopHostClientMode}`,
    `desktop live adapter dispatch mode: ${review.summary.desktopLiveAdapterDispatchMode}`,
    `host client example mode: ${review.summary.hostClientExampleMode}`,
    `target host embedding mode: ${review.summary.targetHostEmbeddingMode}`,
    `strategy router execute action family is authorization: ${review.summary.strategyRouterExecuteActionFamilyIsAuthorization}`,
    `strategy router write execution predicate is authorization: ${review.summary.strategyRouterWriteExecutionPredicateIsAuthorization}`,
    `strategy router executor budget is runtime invocation: ${review.summary.strategyRouterExecutorBudgetIsRuntimeInvocation}`,
    `execution profiles profile stage is runtime step: ${review.summary.executionProfilesProfileStageIsRuntimeStep}`,
    `execution profiles default role is sub-agent runtime authorization: ${review.summary.executionProfilesDefaultRoleIsSubAgentRuntimeAuthorization}`,
    `execution profiles default tool access is tool runtime authorization: ${review.summary.executionProfilesDefaultToolAccessIsToolRuntimeAuthorization}`,
    `execution profiles engineering write tool access is workspace-write execution: ${review.summary.executionProfilesEngineeringWriteToolAccessIsWorkspaceWriteExecution}`,
    `execution profiles protected remote tool access is external write authorization: ${review.summary.executionProfilesProtectedRemoteToolAccessIsExternalWriteAuthorization}`,
    `execution profiles allowParallel is sub-agent runtime authorization: ${review.summary.executionProfilesAllowParallelIsSubAgentRuntimeAuthorization}`,
    `execution profiles maxParallelAgents is sub-agent spawn authorization: ${review.summary.executionProfilesMaxParallelAgentsIsSubAgentSpawnAuthorization}`,
    `execution profiles release-governance profile is protected remote authorization: ${review.summary.executionProfilesReleaseGovernanceProfileIsProtectedRemoteAuthorization}`,
    `execution profiles profile selection is provider execution authorization: ${review.summary.executionProfilesProfileSelectionIsProviderExecutionAuthorization}`,
    `policy config hostRoute is host dispatch authorization: ${review.summary.policyConfigHostRouteIsHostDispatchAuthorization}`,
    `policy config codex-cli host route is Codex CLI invocation: ${review.summary.policyConfigCodexCliHostRouteIsCodexCliInvocation}`,
    `policy config desktop host route is desktop runtime invocation: ${review.summary.policyConfigDesktopHostRouteIsDesktopRuntimeInvocation}`,
    `policy config toolPolicy is tool runtime authorization: ${review.summary.policyConfigToolPolicyIsToolRuntimeAuthorization}`,
    `policy config protected_remote tool policy is external-write authorization: ${review.summary.policyConfigProtectedRemoteToolPolicyIsExternalWriteAuthorization}`,
    `policy config approval rule is approval grant: ${review.summary.policyConfigApprovalRuleIsApprovalGrant}`,
    `policy config memory health block is runtime block execution: ${review.summary.policyConfigMemoryHealthBlockIsRuntimeBlockExecution}`,
    `policy config memory guidance is sub-agent runtime authorization: ${review.summary.policyConfigMemoryGuidanceIsSubAgentRuntimeAuthorization}`,
    `policy config telemetry threshold is runtime authorization: ${review.summary.policyConfigTelemetryThresholdIsRuntimeAuthorization}`,
    `policy config telemetry delivery window is host executor authorization: ${review.summary.policyConfigTelemetryDeliveryWindowIsHostExecutorAuthorization}`,
    `capability taxonomy bounded workspace-write canary is workspace-write authorization: ${review.summary.capabilityTaxonomyBoundedWorkspaceWriteCanaryIsWorkspaceWriteAuthorization}`,
    `capability taxonomy bounded workspace-write receipt is execution authorization: ${review.summary.capabilityTaxonomyBoundedWorkspaceWriteReceiptIsExecutionAuthorization}`,
    `capability taxonomy scoped workspace-write class is workspace-write execution: ${review.summary.capabilityTaxonomyScopedWorkspaceWriteClassIsWorkspaceWriteExecution}`,
    `capability taxonomy general workspace-write class is execution authorization: ${review.summary.capabilityTaxonomyGeneralWorkspaceWriteClassIsExecutionAuthorization}`,
    `capability taxonomy general provider execution class is provider execute authorization: ${review.summary.capabilityTaxonomyGeneralProviderExecutionClassIsProviderExecuteAuthorization}`,
    `capability taxonomy external_write class is external-write authorization: ${review.summary.capabilityTaxonomyExternalWriteClassIsExternalWriteAuthorization}`,
    `capability taxonomy release_or_deploy class is release authorization: ${review.summary.capabilityTaxonomyReleaseOrDeployClassIsReleaseAuthorization}`,
    `capability taxonomy secret_or_credential_change class is secret access authorization: ${review.summary.capabilityTaxonomySecretCredentialChangeClassIsSecretAccessAuthorization}`,
    `capability taxonomy escalation policy is runtime authorization: ${review.summary.capabilityTaxonomyEscalationPolicyIsRuntimeAuthorization}`,
    `capability taxonomy canary evidence baseline is execution authorization: ${review.summary.capabilityTaxonomyCanaryEvidenceBaselineIsExecutionAuthorization}`,
    `routing engine decision is execution authorization: ${review.summary.routingEngineDecisionIsExecutionAuthorization}`,
    `routing engine hostRoute is host dispatch authorization: ${review.summary.routingEngineHostRouteIsHostDispatchAuthorization}`,
    `routing engine providerGrant is provider execute authorization: ${review.summary.routingEngineProviderGrantIsProviderExecuteAuthorization}`,
    `routing engine codex-cli provider id is Codex CLI invocation: ${review.summary.routingEngineCodexCliProviderIdIsCodexCliInvocation}`,
    `routing engine desktop provider id is desktop runtime invocation: ${review.summary.routingEngineDesktopProviderIdIsDesktopRuntimeInvocation}`,
    `routing engine sandboxMode is workspace-write execution: ${review.summary.routingEngineSandboxModeIsWorkspaceWriteExecution}`,
    `routing engine toolAccess is tool runtime authorization: ${review.summary.routingEngineToolAccessIsToolRuntimeAuthorization}`,
    `routing engine approvalRequired is approval grant: ${review.summary.routingEngineApprovalRequiredIsApprovalGrant}`,
    `routing engine risk score is runtime authorization: ${review.summary.routingEngineRiskScoreIsRuntimeAuthorization}`,
    `routing engine parallelism allowed is sub-agent runtime authorization: ${review.summary.routingEngineParallelismAllowedIsSubAgentRuntimeAuthorization}`,
    `recovery control schema status is execution authorization: ${review.summary.recoveryControlSchemaStatusIsExecutionAuthorization}`,
    `recovery control execution plan is recovery execution authorization: ${review.summary.recoveryControlExecutionPlanIsRecoveryExecutionAuthorization}`,
    `recovery control execution gate is runtime authorization: ${review.summary.recoveryControlExecutionGateIsRuntimeAuthorization}`,
    `recovery control host executor review is host dispatch authorization: ${review.summary.recoveryControlHostExecutorReviewIsHostDispatchAuthorization}`,
    `recovery control dispatch authorization review is adapter invocation authorization: ${review.summary.recoveryControlDispatchAuthorizationReviewIsAdapterInvocationAuthorization}`,
    `recovery control task-control review is sub-agent runtime authorization: ${review.summary.recoveryControlTaskControlReviewIsSubAgentRuntimeAuthorization}`,
    `recovery control sandbox witness is production recovery execution: ${review.summary.recoveryControlSandboxWitnessIsProductionRecoveryExecution}`,
    `recovery control receipt status is completion authorization: ${review.summary.recoveryControlReceiptStatusIsCompletionAuthorization}`,
    `recovery control recovery recommendation is host executor authorization: ${review.summary.recoveryControlRecoveryRecommendationIsHostExecutorAuthorization}`,
    `runtime control runtime signal is execution authorization: ${review.summary.runtimeControlRuntimeSignalIsExecutionAuthorization}`,
    `runtime control escalation outcome is provider execution authorization: ${review.summary.runtimeControlEscalationOutcomeIsProviderExecutionAuthorization}`,
    `runtime control upgrade_model is model runtime invocation: ${review.summary.runtimeControlUpgradeModelIsModelRuntimeInvocation}`,
    `runtime control open_circuit is host dispatch authorization: ${review.summary.runtimeControlOpenCircuitIsHostDispatchAuthorization}`,
    `runtime control failure count is recovery execution authorization: ${review.summary.runtimeControlFailureCountIsRecoveryExecutionAuthorization}`,
    `runtime control context pressure is sub-agent runtime authorization: ${review.summary.runtimeControlContextPressureIsSubAgentRuntimeAuthorization}`,
    `runtime control high-risk signal is Codex CLI authorization: ${review.summary.runtimeControlHighRiskSignalIsCodexCliAuthorization}`,
    `operator action executor gate execution allowed: ${review.summary.operatorActionExecutorGateExecutionAllowed}`,
    `Codex CLI host workspace-write requires explicit allowance: ${review.summary.codexCliHostWorkspaceWriteRequiresExplicitAllowance}`,
    `Codex CLI host workspace-write requires confirmation: ${review.summary.codexCliHostWorkspaceWriteRequiresConfirmation}`,
    `Codex CLI host default real Codex CLI allowed by boundary audit: ${review.summary.codexCliHostDefaultRealCodexCliAllowedByBoundaryAudit}`,
    `Codex CLI host provider execution allowed by host boundary: ${review.summary.codexCliHostProviderExecutionAllowedByHostBoundary}`,
    `public API internal governance top-level exports allowed: ${review.summary.publicApiInternalGovernanceTopLevelExportsAllowed}`,
    `public API provider execute export allowed: ${review.summary.publicApiProviderExecuteExportAllowed}`,
    `public API Codex CLI host run export allowed: ${review.summary.publicApiCodexCliHostRunExportAllowed}`,
    `Agent OS local runtime provider plan can be stored: ${review.summary.agentOsLocalRuntimeProviderPlanCanBeStored}`,
    `Agent OS local runtime real provider execution allowed: ${review.summary.agentOsLocalRuntimeRealProviderExecutionAllowed}`,
    `Agent OS local runtime Codex CLI invocation allowed: ${review.summary.agentOsLocalRuntimeCodexCliInvocationAllowed}`,
    `Agent OS local runtime host executor invocation allowed: ${review.summary.agentOsLocalRuntimeHostExecutorInvocationAllowed}`,
    `Agent OS local runtime workspace-write execution allowed: ${review.summary.agentOsLocalRuntimeWorkspaceWriteExecutionAllowed}`,
    `Agent OS MCP server manifest runtimeImplemented means live server: ${review.summary.agentOsMcpServerManifestRuntimeImplementedMeansLiveServer}`,
    `Agent OS MCP server manifest tool manifest is tool runtime authorization: ${review.summary.agentOsMcpServerManifestToolManifestIsToolRuntimeAuthorization}`,
    `Agent OS MCP server manifest required capability is capability grant: ${review.summary.agentOsMcpServerManifestRequiredCapabilityIsCapabilityGrant}`,
    `Agent OS MCP server manifest approvalRequired is approval grant: ${review.summary.agentOsMcpServerManifestApprovalRequiredIsApprovalGrant}`,
    `Agent OS MCP server manifest local_write side effect is workspace-write execution: ${review.summary.agentOsMcpServerManifestLocalWriteSideEffectIsWorkspaceWriteExecution}`,
    `Agent OS MCP server manifest provider planning output is provider execution authorization: ${review.summary.agentOsMcpServerManifestProviderPlanningOutputIsProviderExecutionAuthorization}`,
    `Agent OS MCP server manifest approval permit output is provider execution authorization: ${review.summary.agentOsMcpServerManifestApprovalPermitOutputIsProviderExecutionAuthorization}`,
    `Agent OS MCP server manifest listed tool is MCP tool invocation: ${review.summary.agentOsMcpServerManifestListedToolIsMcpToolInvocation}`,
    `Agent OS MCP server manifest export is public execution surface: ${review.summary.agentOsMcpServerManifestExportIsPublicExecutionSurface}`,
    `protocol MCP serverRef is live server connection: ${review.summary.protocolMcpServerRefIsLiveServerConnection}`,
    `protocol MCP commandRef is shell command: ${review.summary.protocolMcpCommandRefIsShellCommand}`,
    `protocol MCP endpointRef is network call: ${review.summary.protocolMcpEndpointRefIsNetworkCall}`,
    `protocol MCP tool manifest is tool runtime authorization: ${review.summary.protocolMcpToolManifestIsToolRuntimeAuthorization}`,
    `protocol MCP invocation plan is tool execution authorization: ${review.summary.protocolMcpInvocationPlanIsToolExecutionAuthorization}`,
    `protocol MCP fake provider is live MCP server: ${review.summary.protocolMcpFakeProviderIsLiveMcpServer}`,
    `protocol MCP invoke method is enabled: ${review.summary.protocolMcpInvokeMethodIsEnabled}`,
    `protocol MCP unknown side effect is auto-approved: ${review.summary.protocolMcpUnknownSideEffectIsAutoApproved}`,
    `protocol MCP allowed tool is MCP invocation authorization: ${review.summary.protocolMcpAllowedToolIsMcpInvocationAuthorization}`,
    `protocol A2A endpoint ref is network call: ${review.summary.protocolA2aEndpointRefIsNetworkCall}`,
    `protocol A2A agent card is remote runtime authorization: ${review.summary.protocolA2aAgentCardIsRemoteRuntimeAuthorization}`,
    `protocol A2A task skeleton is remote execution authorization: ${review.summary.protocolA2aTaskSkeletonIsRemoteExecutionAuthorization}`,
    `protocol A2A artifact URI is fetched by skeleton: ${review.summary.protocolA2aArtifactUriIsFetchedBySkeleton}`,
    `protocol A2A remote provider is enabled: ${review.summary.protocolA2aRemoteProviderIsEnabled}`,
    `protocol A2A remote provider creates remote tasks: ${review.summary.protocolA2aRemoteProviderCreatesRemoteTasks}`,
    `protocol A2A fake transport is live network service: ${review.summary.protocolA2aFakeTransportIsLiveNetworkService}`,
    `protocol A2A fake transport submission is runtime authorization: ${review.summary.protocolA2aFakeTransportSubmissionIsRuntimeAuthorization}`,
    `protocol A2A anonymous remote invocation allowed: ${review.summary.protocolA2aAnonymousRemoteInvocationAllowed}`,
    `protocol A2A auth scheme is capability grant: ${review.summary.protocolA2aAuthSchemeIsCapabilityGrant}`,
    `protocol A2A remote-agent provider manifest is sub-agent runtime authorization: ${review.summary.protocolA2aRemoteAgentProviderManifestIsSubAgentRuntimeAuthorization}`,
    `Agent OS CLI grant flag is capability grant: ${review.summary.agentOsCliGrantFlagIsCapabilityGrant}`,
    `Agent OS CLI approve-tool flag is tool runtime authorization: ${review.summary.agentOsCliApproveToolFlagIsToolRuntimeAuthorization}`,
    `Agent OS CLI allow-local-mutation is workspace-write execution: ${review.summary.agentOsCliAllowLocalMutationIsWorkspaceWriteExecution}`,
    `Agent OS CLI preferred provider is Codex CLI invocation: ${review.summary.agentOsCliPreferredProviderIsCodexCliInvocation}`,
    `Agent OS CLI parsed command is provider execution authorization: ${review.summary.agentOsCliParsedCommandIsProviderExecutionAuthorization}`,
    `Agent OS CLI local runtime call is provider execution authorization: ${review.summary.agentOsCliLocalRuntimeCallIsProviderExecutionAuthorization}`,
    `Agent OS CLI approval permit issue is provider execution authorization: ${review.summary.agentOsCliApprovalPermitIssueIsProviderExecutionAuthorization}`,
    `Agent OS CLI approval permit consumption is provider execution authorization: ${review.summary.agentOsCliApprovalPermitConsumptionIsProviderExecutionAuthorization}`,
    `Agent OS CLI sanitized argv contains raw secrets: ${review.summary.agentOsCliSanitizedArgvContainsRawSecrets}`,
    `Agent OS app-server request envelope is capability grant: ${review.summary.agentOsAppServerRequestEnvelopeIsCapabilityGrant}`,
    `Agent OS app-server route is live network server: ${review.summary.agentOsAppServerRouteIsLiveNetworkServer}`,
    `Agent OS app-server status code is host executor receipt: ${review.summary.agentOsAppServerStatusCodeIsHostExecutorReceipt}`,
    `Agent OS app-server client gate fields are trusted: ${review.summary.agentOsAppServerClientGateFieldsAreTrusted}`,
    `Agent OS app-server server-side options are client controlled: ${review.summary.agentOsAppServerServerSideOptionsAreClientControlled}`,
    `Agent OS app-server local runtime call is provider execution authorization: ${review.summary.agentOsAppServerLocalRuntimeCallIsProviderExecutionAuthorization}`,
    `Agent OS SDK call is provider execution authorization: ${review.summary.agentOsSdkCallIsProviderExecutionAuthorization}`,
    `Agent OS SDK grant input is capability grant: ${review.summary.agentOsSdkGrantInputIsCapabilityGrant}`,
    `Agent OS SDK approve-tool input is tool runtime authorization: ${review.summary.agentOsSdkApproveToolInputIsToolRuntimeAuthorization}`,
    `Agent OS SDK allow-local-mutation is workspace-write execution: ${review.summary.agentOsSdkAllowLocalMutationIsWorkspaceWriteExecution}`,
    `Agent OS SDK preferred provider is Codex CLI invocation: ${review.summary.agentOsSdkPreferredProviderIsCodexCliInvocation}`,
    `Agent OS SDK local runtime call is provider execution authorization: ${review.summary.agentOsSdkLocalRuntimeCallIsProviderExecutionAuthorization}`,
    `Agent OS SDK approval permit issue is provider execution authorization: ${review.summary.agentOsSdkApprovalPermitIssueIsProviderExecutionAuthorization}`,
    `Agent OS SDK approval permit consumption is provider execution authorization: ${review.summary.agentOsSdkApprovalPermitConsumptionIsProviderExecutionAuthorization}`,
    `Agent OS SDK real provider execution invoked: ${review.summary.agentOsSdkRealProviderExecutionInvoked}`,
    `Agent OS app-server approval permit issue is provider execution authorization: ${review.summary.agentOsAppServerApprovalPermitIssueIsProviderExecutionAuthorization}`,
    `Agent OS app-server approval permit consumption is provider execution authorization: ${review.summary.agentOsAppServerApprovalPermitConsumptionIsProviderExecutionAuthorization}`,
    `Agent OS app-server live HTTP server started: ${review.summary.agentOsAppServerLiveHttpServerStarted}`,
    `Agent OS app-server network accessed: ${review.summary.agentOsAppServerNetworkAccessed}`,
    `Agent OS app-server real provider execution invoked: ${review.summary.agentOsAppServerRealProviderExecutionInvoked}`,
    `Agent OS public surfaces SDK call is provider execution authorization: ${review.summary.agentOsPublicSurfacesSdkCallIsProviderExecutionAuthorization}`,
    `Agent OS public surfaces CLI grant flag is provider execution authorization: ${review.summary.agentOsPublicSurfacesCliGrantFlagIsProviderExecutionAuthorization}`,
    `Agent OS public surfaces CLI approve-tool flag is tool runtime authorization: ${review.summary.agentOsPublicSurfacesCliApproveToolFlagIsToolRuntimeAuthorization}`,
    `Agent OS public surfaces CLI allow-local-mutation is workspace-write execution: ${review.summary.agentOsPublicSurfacesCliAllowLocalMutationIsWorkspaceWriteExecution}`,
    `Agent OS public surfaces preferred provider is Codex CLI invocation: ${review.summary.agentOsPublicSurfacesPreferredProviderIsCodexCliInvocation}`,
    `Agent OS public surfaces app-server request envelope is capability grant: ${review.summary.agentOsPublicSurfacesAppServerRequestEnvelopeIsCapabilityGrant}`,
    `Agent OS public surfaces app-server route is network server: ${review.summary.agentOsPublicSurfacesAppServerRouteIsNetworkServer}`,
    `Agent OS public surfaces app-server status code is execution receipt: ${review.summary.agentOsPublicSurfacesAppServerStatusCodeIsExecutionReceipt}`,
    `Agent OS public surfaces approval permit issue is provider execution authorization: ${review.summary.agentOsPublicSurfacesApprovalPermitIssueIsProviderExecutionAuthorization}`,
    `controlled read-only provider execution allowed: ${review.summary.controlledReadOnlyProviderExecutionAllowed}`,
    `preflight ok is execution authorization: ${review.summary.preflightOkIsExecutionAuthorization}`,
    `preflight missing tool check is tool runtime authorization: ${review.summary.preflightMissingToolCheckIsToolRuntimeAuthorization}`,
    `preflight auth available is provider execution authorization: ${review.summary.preflightAuthAvailableIsProviderExecutionAuthorization}`,
    `preflight workspace clean is workspace-write authorization: ${review.summary.preflightWorkspaceCleanIsWorkspaceWriteAuthorization}`,
    `preflight protected branch check is workspace-write execution: ${review.summary.preflightProtectedBranchCheckIsWorkspaceWriteExecution}`,
    `preflight memory overview is runtime authorization: ${review.summary.preflightMemoryOverviewIsRuntimeAuthorization}`,
    `preflight memory health status is sub-agent runtime authorization: ${review.summary.preflightMemoryHealthStatusIsSubAgentRuntimeAuthorization}`,
    `preflight memory warning is host executor authorization: ${review.summary.preflightMemoryWarningIsHostExecutorAuthorization}`,
    `preflight memory blocking issue is provider execution authorization: ${review.summary.preflightMemoryBlockingIssueIsProviderExecutionAuthorization}`,
    `Approval permit valid permit is provider execution authorization: ${review.summary.approvalPermitValidPermitIsProviderExecutionAuthorization}`,
    `Approval permit valid permit is Codex CLI authorization: ${review.summary.approvalPermitValidPermitIsCodexCliAuthorization}`,
    `Approval permit valid permit is sub-agent runtime authorization: ${review.summary.approvalPermitValidPermitIsSubAgentRuntimeAuthorization}`,
    `Approval permit valid permit is host executor authorization: ${review.summary.approvalPermitValidPermitIsHostExecutorAuthorization}`,
    `Approval permit valid permit is tool runtime authorization: ${review.summary.approvalPermitValidPermitIsToolRuntimeAuthorization}`,
    `Approval permit shell capability scope is shell execution: ${review.summary.approvalPermitShellCapabilityScopeIsShellExecution}`,
    `Approval permit external capability scope is external write execution: ${review.summary.approvalPermitExternalCapabilityScopeIsExternalWriteExecution}`,
    `Approval permit store persistence is workspace-write execution: ${review.summary.approvalPermitStorePersistenceIsWorkspaceWriteExecution}`,
    `Approval gate not_required status is execution authorization: ${review.summary.approvalGateNotRequiredStatusIsExecutionAuthorization}`,
    `Approval gate resolution is provider execution authorization: ${review.summary.approvalGateResolutionIsProviderExecutionAuthorization}`,
    `Approval gate resolution is Codex CLI authorization: ${review.summary.approvalGateResolutionIsCodexCliAuthorization}`,
    `Approval gate resolution is sub-agent runtime authorization: ${review.summary.approvalGateResolutionIsSubAgentRuntimeAuthorization}`,
    `Approval gate resolution is host executor authorization: ${review.summary.approvalGateResolutionIsHostExecutorAuthorization}`,
    `Approval gate resolution is tool runtime authorization: ${review.summary.approvalGateResolutionIsToolRuntimeAuthorization}`,
    `Approval gate pending status is runtime invocation: ${review.summary.approvalGatePendingStatusIsRuntimeInvocation}`,
    `Approval gate protected branch signal is workspace-write execution: ${review.summary.approvalGateProtectedBranchSignalIsWorkspaceWriteExecution}`,
    `Approval gate dirty workspace signal is workspace-write execution: ${review.summary.approvalGateDirtyWorkspaceSignalIsWorkspaceWriteExecution}`,
    `Approval gate protected keyword signal is external write execution: ${review.summary.approvalGateProtectedKeywordSignalIsExternalWriteExecution}`,
    `approval consumption dispatch matrix audit is provider execute authorization: ${review.summary.approvalConsumptionDispatchMatrixAuditIsProviderExecuteAuthorization}`,
    `approval consumption dispatch matrix audit is real Codex CLI authorization: ${review.summary.approvalConsumptionDispatchMatrixAuditIsRealCodexCliAuthorization}`,
    `approval consumption dispatch matrix audit is workspace-write authorization: ${review.summary.approvalConsumptionDispatchMatrixAuditIsWorkspaceWriteAuthorization}`,
    `approval consumption dispatch matrix audit is local command authorization: ${review.summary.approvalConsumptionDispatchMatrixAuditIsLocalCommandAuthorization}`,
    `approval consumption dispatch matrix audit is host executor authorization: ${review.summary.approvalConsumptionDispatchMatrixAuditIsHostExecutorAuthorization}`,
    `approval consumption dispatch matrix audit is sub-agent runtime authorization: ${review.summary.approvalConsumptionDispatchMatrixAuditIsSubAgentRuntimeAuthorization}`,
    `approval consumption dispatch matrix audit is tool runtime authorization: ${review.summary.approvalConsumptionDispatchMatrixAuditIsToolRuntimeAuthorization}`,
    `approval consumption dispatch matrix audit is external-write authorization: ${review.summary.approvalConsumptionDispatchMatrixAuditIsExternalWriteAuthorization}`,
    `approval consumption dispatch matrix audit is release authorization: ${review.summary.approvalConsumptionDispatchMatrixAuditIsReleaseAuthorization}`,
    `approval consumption dispatch matrix audit git state is execution authorization: ${review.summary.approvalConsumptionDispatchMatrixAuditGitStateIsExecutionAuthorization}`,
    `approval consumption dispatch matrix audit worktree clean is provider execution authorization: ${review.summary.approvalConsumptionDispatchMatrixAuditWorktreeCleanIsProviderExecutionAuthorization}`,
    `approval consumption dispatch matrix is provider execute authorization: ${review.summary.approvalConsumptionDispatchMatrixIsProviderExecuteAuthorization}`,
    `approval consumption dispatch matrix is real Codex CLI authorization: ${review.summary.approvalConsumptionDispatchMatrixIsRealCodexCliAuthorization}`,
    `approval consumption dispatch matrix is workspace-write authorization: ${review.summary.approvalConsumptionDispatchMatrixIsWorkspaceWriteAuthorization}`,
    `approval consumption dispatch matrix is local command authorization: ${review.summary.approvalConsumptionDispatchMatrixIsLocalCommandAuthorization}`,
    `approval consumption dispatch matrix is host executor authorization: ${review.summary.approvalConsumptionDispatchMatrixIsHostExecutorAuthorization}`,
    `approval consumption dispatch matrix is sub-agent runtime authorization: ${review.summary.approvalConsumptionDispatchMatrixIsSubAgentRuntimeAuthorization}`,
    `approval consumption dispatch matrix is external-write authorization: ${review.summary.approvalConsumptionDispatchMatrixIsExternalWriteAuthorization}`,
    `approval consumption dispatch matrix is release authorization: ${review.summary.approvalConsumptionDispatchMatrixIsReleaseAuthorization}`,
    `approval consumption dispatch approval permit consumption is provider execution authorization: ${review.summary.approvalConsumptionDispatchApprovalPermitConsumptionIsProviderExecutionAuthorization}`,
    `approval consumption dispatch host dispatcher precondition is provider execute authorization: ${review.summary.approvalConsumptionDispatchHostDispatcherPreconditionIsProviderExecuteAuthorization}`,
    `approval consumption dispatch redaction coverage is runtime authorization: ${review.summary.approvalConsumptionDispatchRedactionCoverageIsRuntimeAuthorization}`,
    `read-only productization is provider execute authorization: ${review.summary.readonlyProductizationIsProviderExecuteAuthorization}`,
    `read-only productization is real Codex CLI authorization: ${review.summary.readonlyProductizationIsRealCodexCliAuthorization}`,
    `read-only productization is workspace-write authorization: ${review.summary.readonlyProductizationIsWorkspaceWriteAuthorization}`,
    `read-only productization is local command authorization: ${review.summary.readonlyProductizationIsLocalCommandAuthorization}`,
    `read-only productization is host executor authorization: ${review.summary.readonlyProductizationIsHostExecutorAuthorization}`,
    `read-only productization is sub-agent runtime authorization: ${review.summary.readonlyProductizationIsSubAgentRuntimeAuthorization}`,
    `read-only productization is tool runtime authorization: ${review.summary.readonlyProductizationIsToolRuntimeAuthorization}`,
    `read-only productization is external write authorization: ${review.summary.readonlyProductizationIsExternalWriteAuthorization}`,
    `read-only productization is evidence refresh authorization: ${review.summary.readonlyProductizationIsEvidenceRefreshAuthorization}`,
    `read-only productization is release authorization: ${review.summary.readonlyProductizationIsReleaseAuthorization}`,
    `read-only productization git state is execution authorization: ${review.summary.readonlyProductizationGitStateIsExecutionAuthorization}`,
    `read-only productization worktree clean is provider execution authorization: ${review.summary.readonlyProductizationWorktreeCleanIsProviderExecutionAuthorization}`,
    `state-sync is provider execute authorization: ${review.summary.stateSyncIsProviderExecuteAuthorization}`,
    `state-sync is real Codex CLI authorization: ${review.summary.stateSyncIsRealCodexCliAuthorization}`,
    `state-sync is workspace-write authorization: ${review.summary.stateSyncIsWorkspaceWriteAuthorization}`,
    `state-sync is local command authorization: ${review.summary.stateSyncIsLocalCommandAuthorization}`,
    `state-sync is host executor authorization: ${review.summary.stateSyncIsHostExecutorAuthorization}`,
    `state-sync is sub-agent runtime authorization: ${review.summary.stateSyncIsSubAgentRuntimeAuthorization}`,
    `state-sync is tool runtime authorization: ${review.summary.stateSyncIsToolRuntimeAuthorization}`,
    `state-sync is external write authorization: ${review.summary.stateSyncIsExternalWriteAuthorization}`,
    `state-sync is evidence refresh authorization: ${review.summary.stateSyncIsEvidenceRefreshAuthorization}`,
    `state-sync is push authorization: ${review.summary.stateSyncIsPushAuthorization}`,
    `state-sync is release authorization: ${review.summary.stateSyncIsReleaseAuthorization}`,
    `state-sync git state is execution authorization: ${review.summary.stateSyncGitStateIsExecutionAuthorization}`,
    `state-sync clean worktree is provider execution authorization: ${review.summary.stateSyncCleanWorktreeIsProviderExecutionAuthorization}`,
    `state-sync policy v2 is execution authorization: ${review.summary.stateSyncPolicyV2IsExecutionAuthorization}`,
    `workspace-write release gate is workspace-write authorization: ${review.summary.workspaceWriteReleaseGateIsWorkspaceWriteAuthorization}`,
    `workspace-write release gate is real Codex CLI authorization: ${review.summary.workspaceWriteReleaseGateIsRealCodexCliAuthorization}`,
    `workspace-write release gate is provider execution authorization: ${review.summary.workspaceWriteReleaseGateIsProviderExecutionAuthorization}`,
    `workspace-write release gate is host executor authorization: ${review.summary.workspaceWriteReleaseGateIsHostExecutorAuthorization}`,
    `workspace-write release gate is sub-agent runtime authorization: ${review.summary.workspaceWriteReleaseGateIsSubAgentRuntimeAuthorization}`,
    `workspace-write release gate is external-write authorization: ${review.summary.workspaceWriteReleaseGateIsExternalWriteAuthorization}`,
    `workspace-write release gate is push authorization: ${review.summary.workspaceWriteReleaseGateIsPushAuthorization}`,
    `workspace-write release gate is release authorization: ${review.summary.workspaceWriteReleaseGateIsReleaseAuthorization}`,
    `Admission control accepted status is execution authorization: ${review.summary.admissionControlAcceptedStatusIsExecutionAuthorization}`,
    `Admission control needs_approval status is approval grant: ${review.summary.admissionControlNeedsApprovalStatusIsApprovalGrant}`,
    `Admission control rejected status is runtime block execution: ${review.summary.admissionControlRejectedStatusIsRuntimeBlockExecution}`,
    `Admission control capability match is runtime invocation: ${review.summary.admissionControlCapabilityMatchIsRuntimeInvocation}`,
    `Admission control required approval is provider execution authorization: ${review.summary.admissionControlRequiredApprovalIsProviderExecutionAuthorization}`,
    `Admission control required approval is Codex CLI authorization: ${review.summary.admissionControlRequiredApprovalIsCodexCliAuthorization}`,
    `Admission control required approval is sub-agent runtime authorization: ${review.summary.admissionControlRequiredApprovalIsSubAgentRuntimeAuthorization}`,
    `Admission control required approval is host executor authorization: ${review.summary.admissionControlRequiredApprovalIsHostExecutorAuthorization}`,
    `Admission control external capability is external write execution: ${review.summary.admissionControlExternalCapabilityIsExternalWriteExecution}`,
    `Admission control file write capability is workspace-write execution: ${review.summary.admissionControlFileWriteCapabilityIsWorkspaceWriteExecution}`,
    `Delegation policy full_delegation is execution authorization: ${review.summary.delegationPolicyFullDelegationIsExecutionAuthorization}`,
    `Delegation policy requiresApproval false is execution authorization: ${review.summary.delegationPolicyRequiresApprovalFalseIsExecutionAuthorization}`,
    `Delegation policy approved proposal is runtime authorization: ${review.summary.delegationPolicyApprovedProposalIsRuntimeAuthorization}`,
    `Delegation policy applied proposal is provider execution authorization: ${review.summary.delegationPolicyAppliedProposalIsProviderExecutionAuthorization}`,
    `Delegation policy filtered recovery action is host executor authorization: ${review.summary.delegationPolicyFilteredRecoveryActionIsHostExecutorAuthorization}`,
    `Delegation policy recovery action list is recovery execution: ${review.summary.delegationPolicyRecoveryActionListIsRecoveryExecution}`,
    `Delegation policy historical trust is runtime authorization: ${review.summary.delegationPolicyHistoricalTrustIsRuntimeAuthorization}`,
    `Delegation policy recorded resume is runtime invocation: ${review.summary.delegationPolicyRecordedResumeIsRuntimeInvocation}`,
    `Delegation policy file-store persistence is workspace-write execution: ${review.summary.delegationPolicyFileStorePersistenceIsWorkspaceWriteExecution}`,
    `execution eligibility eligible status is execution authorization: ${review.summary.executionEligibilityEligibleStatusIsExecutionAuthorization}`,
    `execution eligibility valid approval permit is provider execution authorization: ${review.summary.executionEligibilityValidApprovalPermitIsProviderExecutionAuthorization}`,
    `execution eligibility capability grant is runtime invocation: ${review.summary.executionEligibilityCapabilityGrantIsRuntimeInvocation}`,
    `execution eligibility permit store read is runtime invocation: ${review.summary.executionEligibilityPermitStoreReadIsRuntimeInvocation}`,
    `execution eligibility provider plan creation allowed: ${review.summary.executionEligibilityProviderPlanCreationAllowed}`,
    `execution eligibility provider execute allowed: ${review.summary.executionEligibilityProviderExecuteAllowed}`,
    `execution eligibility Codex CLI invocation allowed: ${review.summary.executionEligibilityCodexCliInvocationAllowed}`,
    `execution eligibility sub-agent runtime invocation allowed: ${review.summary.executionEligibilitySubAgentRuntimeInvocationAllowed}`,
    `execution eligibility host executor invocation allowed: ${review.summary.executionEligibilityHostExecutorInvocationAllowed}`,
    `execution eligibility host dispatch allowed: ${review.summary.executionEligibilityHostDispatchAllowed}`,
    `execution observation status is execution authorization: ${review.summary.executionObservationStatusIsExecutionAuthorization}`,
    `execution observation succeeded is completion authorization: ${review.summary.executionObservationSucceededIsCompletionAuthorization}`,
    `execution observation failed is recovery authorization: ${review.summary.executionObservationFailedIsRecoveryAuthorization}`,
    `execution observation evidence ref is runtime invocation: ${review.summary.executionObservationEvidenceRefIsRuntimeInvocation}`,
    `execution observation ref resolution is replay authorization: ${review.summary.executionObservationRefResolutionIsReplayAuthorization}`,
    `execution observation record write is workspace-write execution: ${review.summary.executionObservationRecordWriteIsWorkspaceWriteExecution}`,
    `execution observation file store persistence allowed: ${review.summary.executionObservationFileStorePersistenceAllowed}`,
    `execution observation provider execute allowed: ${review.summary.executionObservationProviderExecuteAllowed}`,
    `execution observation Codex CLI invocation allowed: ${review.summary.executionObservationCodexCliInvocationAllowed}`,
    `execution observation sub-agent runtime invocation allowed: ${review.summary.executionObservationSubAgentRuntimeInvocationAllowed}`,
    `execution observation host executor invocation allowed: ${review.summary.executionObservationHostExecutorInvocationAllowed}`,
    `execution observation host dispatch allowed: ${review.summary.executionObservationHostDispatchAllowed}`,
    `governance failure reducer execution failure is recovery authorization: ${review.summary.governanceFailureReducerExecutionFailureIsRecoveryAuthorization}`,
    `governance failure reducer strategy decision is runtime authorization: ${review.summary.governanceFailureReducerStrategyDecisionIsRuntimeAuthorization}`,
    `governance failure reducer arbitration packet is recovery execution: ${review.summary.governanceFailureReducerArbitrationPacketIsRecoveryExecution}`,
    `governance failure reducer recovery recommendation is host executor authorization: ${review.summary.governanceFailureReducerRecoveryRecommendationIsHostExecutorAuthorization}`,
    `governance failure reducer anomaly record is runtime invocation: ${review.summary.governanceFailureReducerAnomalyRecordIsRuntimeInvocation}`,
    `governance failure reducer evidence ref is replay authorization: ${review.summary.governanceFailureReducerEvidenceRefIsReplayAuthorization}`,
    `governance failure reducer risk score is provider execution authorization: ${review.summary.governanceFailureReducerRiskScoreIsProviderExecutionAuthorization}`,
    `governance failure reducer state update is workspace-write execution: ${review.summary.governanceFailureReducerStateUpdateIsWorkspaceWriteExecution}`,
    `task graph node status is execution authorization: ${review.summary.taskGraphNodeStatusIsExecutionAuthorization}`,
    `task graph completion is runtime completion: ${review.summary.taskGraphCompletionIsRuntimeCompletion}`,
    `task graph dependency edge is scheduler dispatch: ${review.summary.taskGraphDependencyEdgeIsSchedulerDispatch}`,
    `task graph conflict edge is runtime block execution: ${review.summary.taskGraphConflictEdgeIsRuntimeBlockExecution}`,
    `task graph checkpoint node is rollback execution: ${review.summary.taskGraphCheckpointNodeIsRollbackExecution}`,
    `task graph delta is workspace rollback authorization: ${review.summary.taskGraphDeltaIsWorkspaceRollbackAuthorization}`,
    `task graph rollbackToCheckpoint is host executor authorization: ${review.summary.taskGraphRollbackToCheckpointIsHostExecutorAuthorization}`,
    `task graph branch merge is git merge or workspace-write: ${review.summary.taskGraphBranchMergeIsGitMergeOrWorkspaceWrite}`,
    `task graph file-store persistence is workspace-write execution: ${review.summary.taskGraphFileStorePersistenceIsWorkspaceWriteExecution}`,
    `scheduler queued status is dispatch authorization: ${review.summary.schedulerQueuedStatusIsDispatchAuthorization}`,
    `scheduler leased status is execution authorization: ${review.summary.schedulerLeasedStatusIsExecutionAuthorization}`,
    `scheduler active lease is provider execute authorization: ${review.summary.schedulerActiveLeaseIsProviderExecuteAuthorization}`,
    `scheduler worker id is host or sub-agent authorization: ${review.summary.schedulerWorkerIdIsHostOrSubAgentAuthorization}`,
    `scheduler releaseLease is runtime completion proof: ${review.summary.schedulerReleaseLeaseIsRuntimeCompletionProof}`,
    `scheduler failLease is recovery execution: ${review.summary.schedulerFailLeaseIsRecoveryExecution}`,
    `scheduler expired lease is retry execution: ${review.summary.schedulerExpiredLeaseIsRetryExecution}`,
    `scheduler exhausted status is runtime block execution: ${review.summary.schedulerExhaustedStatusIsRuntimeBlockExecution}`,
    `scheduler file-state persistence is workspace-write execution: ${review.summary.schedulerFileStatePersistenceIsWorkspaceWriteExecution}`,
    `scheduler file lock is shell/process execution: ${review.summary.schedulerFileLockIsShellProcessExecution}`,
    `execution planner planned status is provider execution authorization: ${review.summary.executionPlannerPlannedStatusIsProviderExecutionAuthorization}`,
    `execution planner codex-cli provider selection is Codex CLI invocation: ${review.summary.executionPlannerCodexCliProviderSelectionIsCodexCliInvocation}`,
    `execution planner remote-agent provider selection is sub-agent runtime invocation: ${review.summary.executionPlannerRemoteAgentProviderSelectionIsSubAgentRuntimeInvocation}`,
    `execution planner workspace-write side effect class is workspace-write execution: ${review.summary.executionPlannerWorkspaceWriteSideEffectClassIsWorkspaceWriteExecution}`,
    `execution planner local plan store writes allowed: ${review.summary.executionPlannerLocalPlanStoreWritesAllowed}`,
    `execution planner provider planExecution allowed: ${review.summary.executionPlannerProviderPlanExecutionAllowed}`,
    `execution planner provider validateExecutionPlan allowed: ${review.summary.executionPlannerProviderValidateExecutionPlanAllowed}`,
    `execution planner provider execute allowed: ${review.summary.executionPlannerProviderExecuteAllowed}`,
    `execution planner Codex CLI invocation allowed: ${review.summary.executionPlannerCodexCliInvocationAllowed}`,
    `execution planner sub-agent runtime invocation allowed: ${review.summary.executionPlannerSubAgentRuntimeInvocationAllowed}`,
    `execution planner host executor invocation allowed: ${review.summary.executionPlannerHostExecutorInvocationAllowed}`,
    `execution planner host dispatch allowed: ${review.summary.executionPlannerHostDispatchAllowed}`,
    `execution planner workspace-write execution allowed: ${review.summary.executionPlannerWorkspaceWriteExecutionAllowed}`,
    `Provider registry selected provider is execution authorization: ${review.summary.providerRegistrySelectedProviderIsExecutionAuthorization}`,
    `Provider registry provider grant selection is provider execute authorization: ${review.summary.providerRegistryProviderGrantSelectionIsProviderExecuteAuthorization}`,
    `Provider registry routing decision selection is Codex CLI authorization: ${review.summary.providerRegistryRoutingDecisionSelectionIsCodexCliAuthorization}`,
    `Provider registry registered executor provider is runtime invocation: ${review.summary.providerRegistryRegisteredExecutorProviderIsRuntimeInvocation}`,
    `Provider registry registered tool provider is tool runtime invocation: ${review.summary.providerRegistryRegisteredToolProviderIsToolRuntimeInvocation}`,
    `Provider registry registered remote-agent provider is sub-agent runtime authorization: ${review.summary.providerRegistryRegisteredRemoteAgentProviderIsSubAgentRuntimeAuthorization}`,
    `Provider registry remote-agent auth schemes are runtime authorization: ${review.summary.providerRegistryRemoteAgentAuthSchemesAreRuntimeAuthorization}`,
    `Provider registry manifest-store persistence is workspace-write execution: ${review.summary.providerRegistryManifestStorePersistenceIsWorkspaceWriteExecution}`,
    `controlled provider execution taskbook is provider execute authorization: ${review.summary.controlledProviderExecutionTaskbookIsProviderExecuteAuthorization}`,
    `controlled provider execution taskbook is real Codex CLI authorization: ${review.summary.controlledProviderExecutionTaskbookIsRealCodexCliAuthorization}`,
    `controlled provider execution taskbook is workspace-write authorization: ${review.summary.controlledProviderExecutionTaskbookIsWorkspaceWriteAuthorization}`,
    `controlled provider execution taskbook is local command authorization: ${review.summary.controlledProviderExecutionTaskbookIsLocalCommandAuthorization}`,
    `controlled provider execution taskbook is protected remote authorization: ${review.summary.controlledProviderExecutionTaskbookIsProtectedRemoteAuthorization}`,
    `controlled provider execution taskbook is host executor authorization: ${review.summary.controlledProviderExecutionTaskbookIsHostExecutorAuthorization}`,
    `controlled provider execution taskbook is sub-agent runtime authorization: ${review.summary.controlledProviderExecutionTaskbookIsSubAgentRuntimeAuthorization}`,
    `controlled provider execution taskbook is external-write authorization: ${review.summary.controlledProviderExecutionTaskbookIsExternalWriteAuthorization}`,
    `controlled provider execution taskbook is release authorization: ${review.summary.controlledProviderExecutionTaskbookIsReleaseAuthorization}`,
    `controlled provider execution taskbook is secret change authorization: ${review.summary.controlledProviderExecutionTaskbookIsSecretChangeAuthorization}`,
    `controlled provider execution taskbook review audit is provider execute authorization: ${review.summary.controlledProviderExecutionTaskbookReviewAuditIsProviderExecuteAuthorization}`,
    `controlled provider execution taskbook review audit is real Codex CLI authorization: ${review.summary.controlledProviderExecutionTaskbookReviewAuditIsRealCodexCliAuthorization}`,
    `controlled provider execution taskbook review audit is workspace-write authorization: ${review.summary.controlledProviderExecutionTaskbookReviewAuditIsWorkspaceWriteAuthorization}`,
    `controlled provider execution taskbook review audit is local command authorization: ${review.summary.controlledProviderExecutionTaskbookReviewAuditIsLocalCommandAuthorization}`,
    `controlled provider execution taskbook review audit is host executor authorization: ${review.summary.controlledProviderExecutionTaskbookReviewAuditIsHostExecutorAuthorization}`,
    `controlled provider execution taskbook review audit is sub-agent runtime authorization: ${review.summary.controlledProviderExecutionTaskbookReviewAuditIsSubAgentRuntimeAuthorization}`,
    `controlled provider execution taskbook review audit is external-write authorization: ${review.summary.controlledProviderExecutionTaskbookReviewAuditIsExternalWriteAuthorization}`,
    `controlled provider execution taskbook review audit is release authorization: ${review.summary.controlledProviderExecutionTaskbookReviewAuditIsReleaseAuthorization}`,
    `controlled provider execution taskbook review audit git state is execution authorization: ${review.summary.controlledProviderExecutionTaskbookReviewAuditGitStateIsExecutionAuthorization}`,
    `controlled provider execution taskbook review audit worktree clean is provider execution authorization: ${review.summary.controlledProviderExecutionTaskbookReviewAuditWorktreeCleanIsProviderExecutionAuthorization}`,
    `controlled provider execution dispatch preflight is provider execute authorization: ${review.summary.controlledProviderExecutionDispatchPreflightIsProviderExecuteAuthorization}`,
    `controlled provider execution dispatch preflight is real Codex CLI authorization: ${review.summary.controlledProviderExecutionDispatchPreflightIsRealCodexCliAuthorization}`,
    `controlled provider execution dispatch preflight is workspace-write authorization: ${review.summary.controlledProviderExecutionDispatchPreflightIsWorkspaceWriteAuthorization}`,
    `controlled provider execution dispatch preflight is host executor authorization: ${review.summary.controlledProviderExecutionDispatchPreflightIsHostExecutorAuthorization}`,
    `controlled provider execution dispatch preflight is sub-agent runtime authorization: ${review.summary.controlledProviderExecutionDispatchPreflightIsSubAgentRuntimeAuthorization}`,
    `controlled provider execution dispatch preflight is shell/process authorization: ${review.summary.controlledProviderExecutionDispatchPreflightIsShellProcessAuthorization}`,
    `controlled provider execution dispatch preflight is external-write authorization: ${review.summary.controlledProviderExecutionDispatchPreflightIsExternalWriteAuthorization}`,
    `controlled provider execution dispatch preflight is release authorization: ${review.summary.controlledProviderExecutionDispatchPreflightIsReleaseAuthorization}`,
    `controlled provider execution dispatch preflight runner remains final provider execute gate: ${review.summary.controlledProviderExecutionDispatchPreflightRunnerRemainsFinalProviderExecuteGate}`,
    `controlled provider execution dispatch preflight dry-run default preserved: ${review.summary.controlledProviderExecutionDispatchPreflightDryRunDefaultPreserved}`,
    `controlled provider execution dispatcher calls provider execute directly: ${review.summary.controlledProviderExecutionDispatcherCallsProviderExecuteDirectly}`,
    `controlled provider execution dispatcher calls real Codex CLI directly: ${review.summary.controlledProviderExecutionDispatcherCallsRealCodexCliDirectly}`,
    `controlled provider execution dispatcher controlled workspace-write dispatch allowed: ${review.summary.controlledProviderExecutionDispatcherControlledWorkspaceWriteDispatchAllowed}`,
    `controlled provider execution dispatcher authorizes general workspace-write: ${review.summary.controlledProviderExecutionDispatcherAuthorizesGeneralWorkspaceWrite}`,
    `controlled provider execution dispatcher workspace-write provider execute allowed: ${review.summary.controlledProviderExecutionDispatcherWorkspaceWriteProviderExecuteAllowed}`,
    `controlled provider execution dispatcher authorizes host executor: ${review.summary.controlledProviderExecutionDispatcherAuthorizesHostExecutor}`,
    `controlled provider execution dispatcher authorizes sub-agent runtime: ${review.summary.controlledProviderExecutionDispatcherAuthorizesSubAgentRuntime}`,
    `controlled provider execution dispatcher calls runner boundary: ${review.summary.controlledProviderExecutionDispatcherCallsRunnerBoundary}`,
    `controlled provider execution dispatcher default dry-run preserved: ${review.summary.controlledProviderExecutionDispatcherDefaultDryRunPreserved}`,
    `provider execution runner workspace-write allowed: ${review.summary.providerExecutionRunnerWorkspaceWriteAllowed}`,
    `provider execution runner workspace-write provider execute allowed: ${review.summary.providerExecutionRunnerWorkspaceWriteProviderExecuteAllowed}`,
    `provider execution runner default real Codex CLI allowed: ${review.summary.providerExecutionRunnerDefaultRealCodexCliAllowed}`,
    `provider execution runner non-codex provider execution allowed: ${review.summary.providerExecutionRunnerNonCodexProviderExecutionAllowed}`,
    `provider-core primitives execution allowed: ${review.summary.providerCorePrimitivesExecutionAllowed}`,
    `Tool invocation planner planned status is runtime invocation: ${review.summary.toolInvocationPlannerPlannedStatusIsRuntimeInvocation}`,
    `Tool invocation planner remote.agent.invoke is sub-agent runtime authorization: ${review.summary.toolInvocationPlannerRemoteAgentToolManifestIsSubAgentRuntimeAuthorization}`,
    `Tool invocation planner external-write manifest is external-write authorization: ${review.summary.toolInvocationPlannerExternalWriteToolManifestIsExternalWriteAuthorization}`,
    `Tool invocation planner approval permit is tool runtime authorization: ${review.summary.toolInvocationPlannerApprovalPermitIsToolRuntimeAuthorization}`,
    `Tool invocation planner local-write plan is workspace-write execution: ${review.summary.toolInvocationPlannerLocalWriteToolPlanIsWorkspaceWriteExecution}`,
    `Tool invocation planner input preview stores raw secrets: ${review.summary.toolInvocationPlannerInputPreviewStoresRawSecrets}`,
    `Tool invocation planner default Codex CLI invocation allowed: ${review.summary.toolInvocationPlannerDefaultCodexCliInvocationAllowed}`,
    `Tool invocation planner provider execute allowed: ${review.summary.toolInvocationPlannerProviderExecuteAllowed}`,
    `Tool invocation planner sub-agent runtime invocation allowed: ${review.summary.toolInvocationPlannerSubAgentRuntimeInvocationAllowed}`,
    `Tool invocation planner host executor invocation allowed: ${review.summary.toolInvocationPlannerHostExecutorInvocationAllowed}`,
    `Tool invocation planner tool runtime invocation allowed: ${review.summary.toolInvocationPlannerToolRuntimeInvocationAllowed}`,
    `Tool invocation planner shell/process allowed by default: ${review.summary.toolInvocationPlannerShellProcessAllowedByDefault}`,
    `Tool invocation planner workspace-write allowed by default: ${review.summary.toolInvocationPlannerWorkspaceWriteAllowedByDefault}`,
    `Tool invocation planner external write allowed by default: ${review.summary.toolInvocationPlannerExternalWriteAllowedByDefault}`,
    `desktop agent strategy parallel plan is sub-agent runtime authorization: ${review.summary.desktopAgentStrategyParallelPlanIsSubAgentRuntimeAuthorization}`,
    `desktop agent strategy worker assignment is runtime invocation: ${review.summary.desktopAgentStrategyWorkerAssignmentIsRuntimeInvocation}`,
    `desktop agent strategy write mode is workspace-write execution: ${review.summary.desktopAgentStrategyWriteModeIsWorkspaceWriteExecution}`,
    `desktop agent strategy ownership target is workspace-write authorization: ${review.summary.desktopAgentStrategyOwnershipTargetIsWorkspaceWriteAuthorization}`,
    `desktop agent strategy maxAgents is sub-agent spawn authorization: ${review.summary.desktopAgentStrategyMaxAgentsIsSubAgentSpawnAuthorization}`,
    `desktop agent strategy read-only analyst is provider execution authorization: ${review.summary.desktopAgentStrategyReadOnlyAnalystIsProviderExecutionAuthorization}`,
    `desktop agent strategy reason is execution gate: ${review.summary.desktopAgentStrategyReasonIsExecutionGate}`,
    `desktop decision runner ready status is execution authorization: ${review.summary.desktopDecisionRunnerReadyStatusIsExecutionAuthorization}`,
    `desktop decision runner provider selection is provider execute: ${review.summary.desktopDecisionRunnerProviderSelectionIsProviderExecute}`,
    `desktop decision runner agent strategy is sub-agent runtime invocation: ${review.summary.desktopDecisionRunnerAgentStrategyIsSubAgentRuntimeInvocation}`,
    `desktop decision runner host dispatch allowed: ${review.summary.desktopDecisionRunnerHostDispatchAllowed}`,
    `desktop decision runner provider execute allowed: ${review.summary.desktopDecisionRunnerProviderExecuteAllowed}`,
    `desktop decision runner Codex CLI invocation allowed: ${review.summary.desktopDecisionRunnerCodexCliInvocationAllowed}`,
    `final host locator ready_for_mapping is host execution authorization: ${review.summary.finalHostLocatorReadyForMappingIsHostExecutionAuthorization}`,
    `final host locator host executor invocation allowed: ${review.summary.finalHostLocatorHostExecutorInvocationAllowed}`,
    `final host locator host dispatch allowed: ${review.summary.finalHostLocatorHostDispatchAllowed}`,
    `final host locator provider execute allowed: ${review.summary.finalHostLocatorProviderExecuteAllowed}`,
    `final host locator Codex CLI invocation allowed: ${review.summary.finalHostLocatorCodexCliInvocationAllowed}`,
    `final host locator sub-agent runtime invocation allowed: ${review.summary.finalHostLocatorSubAgentRuntimeInvocationAllowed}`,
    `Codex desktop runtime tool invocation allowed by default: ${review.summary.codexDesktopRuntimeToolInvocationAllowedByDefault}`,
    `Codex desktop live host default runtime tool invocation allowed: ${review.summary.codexDesktopLiveHostDefaultRuntimeToolInvocationAllowed}`,
    `Codex desktop live host Codex CLI invocation allowed: ${review.summary.codexDesktopLiveHostCodexCliInvocationAllowed}`,
    `Codex memory MCP client MCP HTTP calls are provider execution: ${review.summary.codexMemoryMcpClientMcpHttpCallsAreProviderExecution}`,
    `Codex memory MCP client MCP HTTP calls are host executor authorization: ${review.summary.codexMemoryMcpClientMcpHttpCallsAreHostExecutorAuthorization}`,
    `Codex memory MCP client recordMemory is workspace-write execution: ${review.summary.codexMemoryMcpClientRecordMemoryIsWorkspaceWriteExecution}`,
    `Codex memory MCP client searchMemory is sub-agent runtime invocation: ${review.summary.codexMemoryMcpClientSearchMemoryIsSubAgentRuntimeInvocation}`,
    `Codex memory MCP client memoryOverview is runtime authorization: ${review.summary.codexMemoryMcpClientMemoryOverviewIsRuntimeAuthorization}`,
    `Codex memory MCP client adapter checkpoint write is execution authorization: ${review.summary.codexMemoryMcpClientAdapterCheckpointWriteIsExecutionAuthorization}`,
    `Codex memory MCP client default endpoint lookup allowed: ${review.summary.codexMemoryMcpClientDefaultEndpointLookupAllowed}`,
    `Codex memory MCP client bearer token is execution authorization: ${review.summary.codexMemoryMcpClientBearerTokenIsExecutionAuthorization}`,
    `Codex memory MCP client default Codex CLI invocation allowed: ${review.summary.codexMemoryMcpClientDefaultCodexCliInvocationAllowed}`,
    `Codex memory MCP client provider execute allowed: ${review.summary.codexMemoryMcpClientProviderExecuteAllowed}`,
    `Codex memory MCP client sub-agent runtime invocation allowed: ${review.summary.codexMemoryMcpClientSubAgentRuntimeInvocationAllowed}`,
    `Codex memory MCP client shell/process allowed by default: ${review.summary.codexMemoryMcpClientShellProcessAllowedByDefault}`,
    `Codex memory MCP client workspace-write allowed by default: ${review.summary.codexMemoryMcpClientWorkspaceWriteAllowedByDefault}`,
    `Codex memory host client memory operation calls are host executor authorization: ${review.summary.codexMemoryHostClientMemoryOperationCallsAreHostExecutorAuthorization}`,
    `Codex memory host client recordMemory is workspace-write execution: ${review.summary.codexMemoryHostClientRecordMemoryIsWorkspaceWriteExecution}`,
    `Codex memory host client searchMemory is sub-agent runtime invocation: ${review.summary.codexMemoryHostClientSearchMemoryIsSubAgentRuntimeInvocation}`,
    `Codex memory host client memoryOverview is runtime authorization: ${review.summary.codexMemoryHostClientMemoryOverviewIsRuntimeAuthorization}`,
    `Codex memory host client adapter checkpoint write is execution authorization: ${review.summary.codexMemoryHostClientAdapterCheckpointWriteIsExecutionAuthorization}`,
    `Codex memory host client MCP tool-style adapter is default host lookup: ${review.summary.codexMemoryHostClientMcpToolStyleAdapterIsDefaultHostLookup}`,
    `Codex memory host client default real host execution allowed: ${review.summary.codexMemoryHostClientDefaultRealHostExecutionAllowed}`,
    `Codex memory host client default host executor lookup allowed: ${review.summary.codexMemoryHostClientDefaultHostExecutorLookupAllowed}`,
    `Codex memory host client default Codex CLI invocation allowed: ${review.summary.codexMemoryHostClientDefaultCodexCliInvocationAllowed}`,
    `Codex memory host client provider execute allowed: ${review.summary.codexMemoryHostClientProviderExecuteAllowed}`,
    `Codex memory host client sub-agent runtime invocation allowed: ${review.summary.codexMemoryHostClientSubAgentRuntimeInvocationAllowed}`,
    `Codex memory host client shell/process allowed by default: ${review.summary.codexMemoryHostClientShellProcessAllowedByDefault}`,
    `Codex memory host client workspace-write allowed by default: ${review.summary.codexMemoryHostClientWorkspaceWriteAllowedByDefault}`,
    `desktop host client default real execution allowed: ${review.summary.desktopHostClientDefaultRealExecutionAllowed}`,
    `desktop host client default host executor lookup allowed: ${review.summary.desktopHostClientDefaultHostExecutorLookupAllowed}`,
    `desktop host client direct dispatchToHost allowed: ${review.summary.desktopHostClientDirectDispatchToHostAllowed}`,
    `desktop host client execute-injected dispatch allowed: ${review.summary.desktopHostClientExecuteInjectedDispatchAllowed}`,
    `desktop host client controlled workspace-write dispatch allowed: ${review.summary.desktopHostClientControlledWorkspaceWriteDispatchAllowed}`,
    `desktop host client general workspace-write allowed: ${review.summary.desktopHostClientGeneralWorkspaceWriteAllowed}`,
    `desktop host client workspace-write provider execute allowed: ${review.summary.desktopHostClientWorkspaceWriteProviderExecuteAllowed}`,
    `desktop live adapter blocked decision execution allowed: ${review.summary.desktopLiveAdapterBlockedDecisionExecutionAllowed}`,
    `host client example real shell/process allowed: ${review.summary.hostClientExampleRealShellProcessAllowed}`,
    `host client example host executor dispatch surface present: ${review.summary.hostClientExampleHostExecutorDispatchSurfacePresent}`,
    `host client example workspace-write allowed: ${review.summary.hostClientExampleWorkspaceWriteAllowed}`,
    `target host embedding placeholder methods are real execution: ${review.summary.targetHostEmbeddingPlaceholderMethodsAreRealExecution}`,
    `target host embedding scaffold ready status is execution authorization: ${review.summary.targetHostEmbeddingScaffoldReadyStatusIsExecutionAuthorization}`,
    `target host embedding createBundle requires fully wired host: ${review.summary.targetHostEmbeddingCreateBundleRequiresFullyWiredHost}`,
    `target host embedding createBundle is host executor authorization: ${review.summary.targetHostEmbeddingCreateBundleIsHostExecutorAuthorization}`,
    `target host embedding directive builders are shell authorization: ${review.summary.targetHostEmbeddingDirectiveBuildersAreShellAuthorization}`,
    `target host embedding default real host execution allowed: ${review.summary.targetHostEmbeddingDefaultRealHostExecutionAllowed}`,
    `target host embedding default host executor lookup allowed: ${review.summary.targetHostEmbeddingDefaultHostExecutorLookupAllowed}`,
    `target host embedding default Codex CLI invocation allowed: ${review.summary.targetHostEmbeddingDefaultCodexCliInvocationAllowed}`,
    `target host embedding provider execute allowed: ${review.summary.targetHostEmbeddingProviderExecuteAllowed}`,
    `target host embedding sub-agent runtime invocation allowed: ${review.summary.targetHostEmbeddingSubAgentRuntimeInvocationAllowed}`,
    `target host embedding shell/process allowed by default: ${review.summary.targetHostEmbeddingShellProcessAllowedByDefault}`,
    `target host embedding workspace-write allowed by default: ${review.summary.targetHostEmbeddingWorkspaceWriteAllowedByDefault}`,
    `desktop live adapter bridge invocation allowed by codex-cli route: ${review.summary.desktopLiveAdapterBridgeInvocationAllowedByCodexCliRoute}`,
    `desktop live adapter provider invocation allowed: ${review.summary.desktopLiveAdapterProviderInvocationAllowed}`,
    `host dispatcher read-only provider dispatch allowed: ${review.summary.hostDispatcherReadOnlyProviderDispatchAllowed}`,
    `host dispatcher controlled workspace-write dispatch allowed: ${review.summary.hostDispatcherControlledWorkspaceWriteDispatchAllowed}`,
    `host dispatcher general provider execution allowed: ${review.summary.hostDispatcherGeneralProviderExecutionAllowed}`,
    `host dispatcher general workspace-write allowed: ${review.summary.hostDispatcherGeneralWorkspaceWriteAllowed}`,
    `host dispatcher workspace-write provider execute allowed: ${review.summary.hostDispatcherWorkspaceWriteProviderExecuteAllowed}`,
    `host executor default real execution allowed: ${review.summary.hostExecutorDefaultRealExecutionAllowed}`,
    `host executor taskbook execution allowed: ${review.summary.hostExecutorTaskbookExecutionAllowed}`,
    `host-client executor review dispatch allowed: ${review.summary.hostClientExecutorReviewDispatchAllowed}`,
    `host executor receipt dispatch means business recovery completed: ${review.summary.hostExecutorReceiptDispatchMeansBusinessRecoveryCompleted}`,
    `agent-backed recovery production execution allowed: ${review.summary.agentBackedRecoveryProductionExecutionAllowed}`,
    `agent executor adapter taskbook execution allowed: ${review.summary.agentExecutorAdapterTaskbookExecutionAllowed}`,
    `agent executor adapter review invocation allowed: ${review.summary.agentExecutorAdapterReviewInvocationAllowed}`,
    `agent executor adapter sandbox production execution allowed: ${review.summary.agentExecutorAdapterSandboxProductionExecutionAllowed}`,
    `task-control taskbook execution allowed: ${review.summary.taskControlTaskbookExecutionAllowed}`,
    `task-control review invocation allowed: ${review.summary.taskControlReviewInvocationAllowed}`,
    `sub-agent runtime execution allowed: ${review.summary.subAgentRuntimeExecutionAllowed}`,
    `task-control adapter kind: ${review.summary.taskControlAdapterKind}`,
    `strategy router calls during audit: ${review.summary.totalStrategyRouterCallsDuringAudit}`,
    `strategy router provider planExecution calls during audit: ${review.summary.totalStrategyRouterProviderPlanExecutionCallsDuringAudit}`,
    `strategy router provider validateExecutionPlan calls during audit: ${review.summary.totalStrategyRouterProviderValidateExecutionPlanCallsDuringAudit}`,
    `strategy router provider execute calls during audit: ${review.summary.totalStrategyRouterProviderExecuteCallsDuringAudit}`,
    `execution profile lookups during audit: ${review.summary.totalExecutionProfileLookupsDuringAudit}`,
    `execution profiles provider execute calls during audit: ${review.summary.totalExecutionProfilesProviderExecuteCallsDuringAudit}`,
    `execution profiles Codex CLI calls during audit: ${review.summary.totalExecutionProfilesCodexCliCallsDuringAudit}`,
    `execution profiles desktop primitive calls during audit: ${review.summary.totalExecutionProfilesDesktopPrimitiveCallsDuringAudit}`,
    `execution profiles sub-agent runtime calls during audit: ${review.summary.totalExecutionProfilesSubAgentRuntimeCallsDuringAudit}`,
    `execution profiles host executor calls during audit: ${review.summary.totalExecutionProfilesHostExecutorCallsDuringAudit}`,
    `execution profiles host dispatch calls during audit: ${review.summary.totalExecutionProfilesHostDispatchCallsDuringAudit}`,
    `execution profiles tool runtime calls during audit: ${review.summary.totalExecutionProfilesToolRuntimeCallsDuringAudit}`,
    `execution profiles shell/process calls during audit: ${review.summary.totalExecutionProfilesShellProcessCallsDuringAudit}`,
    `execution profiles workspace-write calls during audit: ${review.summary.totalExecutionProfilesWorkspaceWriteCallsDuringAudit}`,
    `execution profiles external write calls during audit: ${review.summary.totalExecutionProfilesExternalWriteCallsDuringAudit}`,
    `policy config load calls during audit: ${review.summary.totalPolicyConfigLoadCallsDuringAudit}`,
    `policy config provider execute calls during audit: ${review.summary.totalPolicyConfigProviderExecuteCallsDuringAudit}`,
    `policy config Codex CLI calls during audit: ${review.summary.totalPolicyConfigCodexCliCallsDuringAudit}`,
    `policy config desktop primitive calls during audit: ${review.summary.totalPolicyConfigDesktopPrimitiveCallsDuringAudit}`,
    `policy config sub-agent runtime calls during audit: ${review.summary.totalPolicyConfigSubAgentRuntimeCallsDuringAudit}`,
    `policy config host executor calls during audit: ${review.summary.totalPolicyConfigHostExecutorCallsDuringAudit}`,
    `policy config host dispatch calls during audit: ${review.summary.totalPolicyConfigHostDispatchCallsDuringAudit}`,
    `policy config tool runtime calls during audit: ${review.summary.totalPolicyConfigToolRuntimeCallsDuringAudit}`,
    `policy config shell/process calls during audit: ${review.summary.totalPolicyConfigShellProcessCallsDuringAudit}`,
    `policy config workspace-write calls during audit: ${review.summary.totalPolicyConfigWorkspaceWriteCallsDuringAudit}`,
    `policy config external write calls during audit: ${review.summary.totalPolicyConfigExternalWriteCallsDuringAudit}`,
    `capability taxonomy provider execute calls during audit: ${review.summary.totalCapabilityTaxonomyProviderExecuteCallsDuringAudit}`,
    `capability taxonomy Codex CLI calls during audit: ${review.summary.totalCapabilityTaxonomyCodexCliCallsDuringAudit}`,
    `capability taxonomy workspace-write calls during audit: ${review.summary.totalCapabilityTaxonomyWorkspaceWriteCallsDuringAudit}`,
    `capability taxonomy canary file write calls during audit: ${review.summary.totalCapabilityTaxonomyCanaryFileWriteCallsDuringAudit}`,
    `capability taxonomy general provider execution calls during audit: ${review.summary.totalCapabilityTaxonomyGeneralProviderExecutionCallsDuringAudit}`,
    `capability taxonomy external write calls during audit: ${review.summary.totalCapabilityTaxonomyExternalWriteCallsDuringAudit}`,
    `capability taxonomy release calls during audit: ${review.summary.totalCapabilityTaxonomyReleaseCallsDuringAudit}`,
    `capability taxonomy secret access calls during audit: ${review.summary.totalCapabilityTaxonomySecretAccessCallsDuringAudit}`,
    `capability taxonomy shell/process calls during audit: ${review.summary.totalCapabilityTaxonomyShellProcessCallsDuringAudit}`,
    `capability taxonomy escalation policy mode: ${review.summary.capabilityTaxonomyEscalationPolicyMode}`,
    `capability taxonomy escalation policy is provider execute authorization: ${review.summary.capabilityTaxonomyEscalationPolicyIsProviderExecuteAuthorization}`,
    `capability taxonomy escalation policy is Codex CLI authorization: ${review.summary.capabilityTaxonomyEscalationPolicyIsCodexCliAuthorization}`,
    `capability taxonomy escalation policy is workspace-write authorization: ${review.summary.capabilityTaxonomyEscalationPolicyIsWorkspaceWriteAuthorization}`,
    `capability taxonomy escalation policy is host executor authorization: ${review.summary.capabilityTaxonomyEscalationPolicyIsHostExecutorAuthorization}`,
    `capability taxonomy escalation policy is sub-agent runtime authorization: ${review.summary.capabilityTaxonomyEscalationPolicyIsSubAgentRuntimeAuthorization}`,
    `capability taxonomy escalation policy is tool runtime authorization: ${review.summary.capabilityTaxonomyEscalationPolicyIsToolRuntimeAuthorization}`,
    `capability taxonomy escalation policy is external-write authorization: ${review.summary.capabilityTaxonomyEscalationPolicyIsExternalWriteAuthorization}`,
    `capability taxonomy escalation policy is release authorization: ${review.summary.capabilityTaxonomyEscalationPolicyIsReleaseAuthorization}`,
    `capability taxonomy escalation policy is secret access authorization: ${review.summary.capabilityTaxonomyEscalationPolicyIsSecretAccessAuthorization}`,
    `capability taxonomy escalation policy blocked capability class is runtime block execution: ${review.summary.capabilityTaxonomyEscalationPolicyBlockedCapabilityClassIsRuntimeBlockExecution}`,
    `capability taxonomy escalation policy severity is runtime authorization: ${review.summary.capabilityTaxonomyEscalationPolicySeverityIsRuntimeAuthorization}`,
    `capability taxonomy escalation policy status is execution authorization: ${review.summary.capabilityTaxonomyEscalationPolicyStatusIsExecutionAuthorization}`,
    `capability taxonomy escalation policy provider execute calls during audit: ${review.summary.totalCapabilityTaxonomyEscalationPolicyProviderExecuteCallsDuringAudit}`,
    `capability taxonomy escalation policy Codex CLI calls during audit: ${review.summary.totalCapabilityTaxonomyEscalationPolicyCodexCliCallsDuringAudit}`,
    `capability taxonomy escalation policy workspace-write calls during audit: ${review.summary.totalCapabilityTaxonomyEscalationPolicyWorkspaceWriteCallsDuringAudit}`,
    `capability taxonomy escalation policy host executor calls during audit: ${review.summary.totalCapabilityTaxonomyEscalationPolicyHostExecutorCallsDuringAudit}`,
    `capability taxonomy escalation policy sub-agent runtime calls during audit: ${review.summary.totalCapabilityTaxonomyEscalationPolicySubAgentRuntimeCallsDuringAudit}`,
    `capability taxonomy escalation policy tool runtime calls during audit: ${review.summary.totalCapabilityTaxonomyEscalationPolicyToolRuntimeCallsDuringAudit}`,
    `capability taxonomy escalation policy shell/process calls during audit: ${review.summary.totalCapabilityTaxonomyEscalationPolicyShellProcessCallsDuringAudit}`,
    `capability taxonomy escalation policy external write calls during audit: ${review.summary.totalCapabilityTaxonomyEscalationPolicyExternalWriteCallsDuringAudit}`,
    `capability taxonomy escalation policy release calls during audit: ${review.summary.totalCapabilityTaxonomyEscalationPolicyReleaseCallsDuringAudit}`,
    `capability taxonomy escalation policy secret access calls during audit: ${review.summary.totalCapabilityTaxonomyEscalationPolicySecretAccessCallsDuringAudit}`,
    `routing engine calls during audit: ${review.summary.totalRoutingEngineCallsDuringAudit}`,
    `routing engine provider grant creations during audit: ${review.summary.totalRoutingEngineProviderGrantCreationsDuringAudit}`,
    `routing engine provider execute calls during audit: ${review.summary.totalRoutingEngineProviderExecuteCallsDuringAudit}`,
    `routing engine Codex CLI calls during audit: ${review.summary.totalRoutingEngineCodexCliCallsDuringAudit}`,
    `routing engine desktop runtime calls during audit: ${review.summary.totalRoutingEngineDesktopRuntimeCallsDuringAudit}`,
    `routing engine sub-agent runtime calls during audit: ${review.summary.totalRoutingEngineSubAgentRuntimeCallsDuringAudit}`,
    `routing engine host executor calls during audit: ${review.summary.totalRoutingEngineHostExecutorCallsDuringAudit}`,
    `routing engine host dispatch calls during audit: ${review.summary.totalRoutingEngineHostDispatchCallsDuringAudit}`,
    `routing engine tool runtime calls during audit: ${review.summary.totalRoutingEngineToolRuntimeCallsDuringAudit}`,
    `routing engine shell/process calls during audit: ${review.summary.totalRoutingEngineShellProcessCallsDuringAudit}`,
    `routing engine workspace-write calls during audit: ${review.summary.totalRoutingEngineWorkspaceWriteCallsDuringAudit}`,
    `routing engine external write calls during audit: ${review.summary.totalRoutingEngineExternalWriteCallsDuringAudit}`,
    `recovery control calls during audit: ${review.summary.totalRecoveryControlCallsDuringAudit}`,
    `recovery control host executor invocations during audit: ${review.summary.totalRecoveryControlHostExecutorInvocationsDuringAudit}`,
    `recovery control adapter invocations during audit: ${review.summary.totalRecoveryControlAdapterInvocationsDuringAudit}`,
    `recovery control Codex CLI calls during audit: ${review.summary.totalRecoveryControlCodexCliCallsDuringAudit}`,
    `recovery control provider execute calls during audit: ${review.summary.totalRecoveryControlProviderExecuteCallsDuringAudit}`,
    `recovery control sub-agent runtime calls during audit: ${review.summary.totalRecoveryControlSubAgentRuntimeCallsDuringAudit}`,
    `recovery control shell/process calls during audit: ${review.summary.totalRecoveryControlShellProcessCallsDuringAudit}`,
    `recovery control workspace-write calls during audit: ${review.summary.totalRecoveryControlWorkspaceWriteCallsDuringAudit}`,
    `recovery control external write calls during audit: ${review.summary.totalRecoveryControlExternalWriteCallsDuringAudit}`,
    `runtime control calls during audit: ${review.summary.totalRuntimeControlCallsDuringAudit}`,
    `runtime control provider execute calls during audit: ${review.summary.totalRuntimeControlProviderExecuteCallsDuringAudit}`,
    `runtime control Codex CLI calls during audit: ${review.summary.totalRuntimeControlCodexCliCallsDuringAudit}`,
    `runtime control sub-agent runtime calls during audit: ${review.summary.totalRuntimeControlSubAgentRuntimeCallsDuringAudit}`,
    `runtime control host executor calls during audit: ${review.summary.totalRuntimeControlHostExecutorCallsDuringAudit}`,
    `runtime control host dispatch calls during audit: ${review.summary.totalRuntimeControlHostDispatchCallsDuringAudit}`,
    `runtime control model runtime calls during audit: ${review.summary.totalRuntimeControlModelRuntimeCallsDuringAudit}`,
    `runtime control shell/process calls during audit: ${review.summary.totalRuntimeControlShellProcessCallsDuringAudit}`,
    `runtime control workspace-write calls during audit: ${review.summary.totalRuntimeControlWorkspaceWriteCallsDuringAudit}`,
    `runtime control external write calls during audit: ${review.summary.totalRuntimeControlExternalWriteCallsDuringAudit}`,
    `operator action executor gate invocations during audit: ${review.summary.totalOperatorActionExecutorGateInvocationsDuringAudit}`,
    `Codex CLI host process spawns during audit: ${review.summary.totalCodexCliHostProcessSpawnsDuringAudit}`,
    `public API calls during audit: ${review.summary.totalPublicApiCallsDuringAudit}`,
    `Agent OS local runtime calls during audit: ${review.summary.totalAgentOsLocalRuntimeCallsDuringAudit}`,
    `Agent OS MCP server manifest calls during audit: ${review.summary.totalAgentOsMcpServerManifestCallsDuringAudit}`,
    `Agent OS MCP server manifest live server starts during audit: ${review.summary.totalAgentOsMcpServerManifestLiveServerStartsDuringAudit}`,
    `Agent OS MCP server manifest local runtime calls during audit: ${review.summary.totalAgentOsMcpServerManifestLocalRuntimeCallsDuringAudit}`,
    `Agent OS MCP server manifest tool runtime calls during audit: ${review.summary.totalAgentOsMcpServerManifestToolRuntimeCallsDuringAudit}`,
    `Agent OS MCP server manifest provider execute calls during audit: ${review.summary.totalAgentOsMcpServerManifestProviderExecuteCallsDuringAudit}`,
    `Agent OS MCP server manifest Codex CLI calls during audit: ${review.summary.totalAgentOsMcpServerManifestCodexCliCallsDuringAudit}`,
    `Agent OS MCP server manifest desktop primitive calls during audit: ${review.summary.totalAgentOsMcpServerManifestDesktopPrimitiveCallsDuringAudit}`,
    `Agent OS MCP server manifest sub-agent runtime calls during audit: ${review.summary.totalAgentOsMcpServerManifestSubAgentRuntimeCallsDuringAudit}`,
    `Agent OS MCP server manifest host executor calls during audit: ${review.summary.totalAgentOsMcpServerManifestHostExecutorCallsDuringAudit}`,
    `Agent OS MCP server manifest host dispatch calls during audit: ${review.summary.totalAgentOsMcpServerManifestHostDispatchCallsDuringAudit}`,
    `Agent OS MCP server manifest shell/process calls during audit: ${review.summary.totalAgentOsMcpServerManifestShellProcessCallsDuringAudit}`,
    `Agent OS MCP server manifest network calls during audit: ${review.summary.totalAgentOsMcpServerManifestNetworkCallsDuringAudit}`,
    `Agent OS MCP server manifest workspace-write calls during audit: ${review.summary.totalAgentOsMcpServerManifestWorkspaceWriteCallsDuringAudit}`,
    `Agent OS MCP server manifest external write calls during audit: ${review.summary.totalAgentOsMcpServerManifestExternalWriteCallsDuringAudit}`,
    `protocol MCP calls during audit: ${review.summary.totalProtocolMcpCallsDuringAudit}`,
    `protocol MCP live server connections during audit: ${review.summary.totalProtocolMcpLiveServerConnectionsDuringAudit}`,
    `protocol MCP tool runtime calls during audit: ${review.summary.totalProtocolMcpToolRuntimeCallsDuringAudit}`,
    `protocol MCP provider execute calls during audit: ${review.summary.totalProtocolMcpProviderExecuteCallsDuringAudit}`,
    `protocol MCP Codex CLI calls during audit: ${review.summary.totalProtocolMcpCodexCliCallsDuringAudit}`,
    `protocol MCP desktop primitive calls during audit: ${review.summary.totalProtocolMcpDesktopPrimitiveCallsDuringAudit}`,
    `protocol MCP sub-agent runtime calls during audit: ${review.summary.totalProtocolMcpSubAgentRuntimeCallsDuringAudit}`,
    `protocol MCP host executor calls during audit: ${review.summary.totalProtocolMcpHostExecutorCallsDuringAudit}`,
    `protocol MCP host dispatch calls during audit: ${review.summary.totalProtocolMcpHostDispatchCallsDuringAudit}`,
    `protocol MCP shell/process calls during audit: ${review.summary.totalProtocolMcpShellProcessCallsDuringAudit}`,
    `protocol MCP network calls during audit: ${review.summary.totalProtocolMcpNetworkCallsDuringAudit}`,
    `protocol MCP workspace-write calls during audit: ${review.summary.totalProtocolMcpWorkspaceWriteCallsDuringAudit}`,
    `protocol MCP external write calls during audit: ${review.summary.totalProtocolMcpExternalWriteCallsDuringAudit}`,
    `protocol A2A calls during audit: ${review.summary.totalProtocolA2aCallsDuringAudit}`,
    `protocol A2A live network service starts during audit: ${review.summary.totalProtocolA2aLiveNetworkServiceStartsDuringAudit}`,
    `protocol A2A remote agent runtime calls during audit: ${review.summary.totalProtocolA2aRemoteAgentRuntimeCallsDuringAudit}`,
    `protocol A2A remote task creations during audit: ${review.summary.totalProtocolA2aRemoteTaskCreationsDuringAudit}`,
    `protocol A2A provider execute calls during audit: ${review.summary.totalProtocolA2aProviderExecuteCallsDuringAudit}`,
    `protocol A2A Codex CLI calls during audit: ${review.summary.totalProtocolA2aCodexCliCallsDuringAudit}`,
    `protocol A2A desktop primitive calls during audit: ${review.summary.totalProtocolA2aDesktopPrimitiveCallsDuringAudit}`,
    `protocol A2A sub-agent runtime calls during audit: ${review.summary.totalProtocolA2aSubAgentRuntimeCallsDuringAudit}`,
    `protocol A2A host executor calls during audit: ${review.summary.totalProtocolA2aHostExecutorCallsDuringAudit}`,
    `protocol A2A host dispatch calls during audit: ${review.summary.totalProtocolA2aHostDispatchCallsDuringAudit}`,
    `protocol A2A shell/process calls during audit: ${review.summary.totalProtocolA2aShellProcessCallsDuringAudit}`,
    `protocol A2A network calls during audit: ${review.summary.totalProtocolA2aNetworkCallsDuringAudit}`,
    `protocol A2A workspace-write calls during audit: ${review.summary.totalProtocolA2aWorkspaceWriteCallsDuringAudit}`,
    `protocol A2A external write calls during audit: ${review.summary.totalProtocolA2aExternalWriteCallsDuringAudit}`,
    `Agent OS SDK calls during audit: ${review.summary.totalAgentOsSdkCallsDuringAudit}`,
    `Agent OS SDK local runtime calls during audit: ${review.summary.totalAgentOsSdkLocalRuntimeCallsDuringAudit}`,
    `Agent OS SDK provider execute calls during audit: ${review.summary.totalAgentOsSdkProviderExecuteCallsDuringAudit}`,
    `Agent OS SDK Codex CLI calls during audit: ${review.summary.totalAgentOsSdkCodexCliCallsDuringAudit}`,
    `Agent OS SDK desktop primitive calls during audit: ${review.summary.totalAgentOsSdkDesktopPrimitiveCallsDuringAudit}`,
    `Agent OS SDK sub-agent runtime calls during audit: ${review.summary.totalAgentOsSdkSubAgentRuntimeCallsDuringAudit}`,
    `Agent OS SDK host executor calls during audit: ${review.summary.totalAgentOsSdkHostExecutorCallsDuringAudit}`,
    `Agent OS SDK host dispatch calls during audit: ${review.summary.totalAgentOsSdkHostDispatchCallsDuringAudit}`,
    `Agent OS SDK shell/process calls during audit: ${review.summary.totalAgentOsSdkShellProcessCallsDuringAudit}`,
    `Agent OS SDK network calls during audit: ${review.summary.totalAgentOsSdkNetworkCallsDuringAudit}`,
    `Agent OS SDK workspace-write calls during audit: ${review.summary.totalAgentOsSdkWorkspaceWriteCallsDuringAudit}`,
    `Agent OS SDK external write calls during audit: ${review.summary.totalAgentOsSdkExternalWriteCallsDuringAudit}`,
    `Agent OS CLI wrapper calls during audit: ${review.summary.totalAgentOsCliWrapperCallsDuringAudit}`,
    `Agent OS CLI local runtime calls during audit: ${review.summary.totalAgentOsCliLocalRuntimeCallsDuringAudit}`,
    `Agent OS CLI provider execute calls during audit: ${review.summary.totalAgentOsCliProviderExecuteCallsDuringAudit}`,
    `Agent OS CLI Codex CLI calls during audit: ${review.summary.totalAgentOsCliCodexCliCallsDuringAudit}`,
    `Agent OS CLI desktop primitive calls during audit: ${review.summary.totalAgentOsCliDesktopPrimitiveCallsDuringAudit}`,
    `Agent OS CLI sub-agent runtime calls during audit: ${review.summary.totalAgentOsCliSubAgentRuntimeCallsDuringAudit}`,
    `Agent OS CLI host executor calls during audit: ${review.summary.totalAgentOsCliHostExecutorCallsDuringAudit}`,
    `Agent OS CLI host dispatch calls during audit: ${review.summary.totalAgentOsCliHostDispatchCallsDuringAudit}`,
    `Agent OS CLI shell/process calls during audit: ${review.summary.totalAgentOsCliShellProcessCallsDuringAudit}`,
    `Agent OS CLI network calls during audit: ${review.summary.totalAgentOsCliNetworkCallsDuringAudit}`,
    `Agent OS CLI workspace-write calls during audit: ${review.summary.totalAgentOsCliWorkspaceWriteCallsDuringAudit}`,
    `Agent OS CLI external write calls during audit: ${review.summary.totalAgentOsCliExternalWriteCallsDuringAudit}`,
    `Agent OS app-server wrapper calls during audit: ${review.summary.totalAgentOsAppServerWrapperCallsDuringAudit}`,
    `Agent OS app-server local runtime calls during audit: ${review.summary.totalAgentOsAppServerLocalRuntimeCallsDuringAudit}`,
    `Agent OS app-server live HTTP server starts during audit: ${review.summary.totalAgentOsAppServerLiveHttpServerStartsDuringAudit}`,
    `Agent OS app-server network calls during audit: ${review.summary.totalAgentOsAppServerNetworkCallsDuringAudit}`,
    `Agent OS app-server provider execute calls during audit: ${review.summary.totalAgentOsAppServerProviderExecuteCallsDuringAudit}`,
    `Agent OS app-server Codex CLI calls during audit: ${review.summary.totalAgentOsAppServerCodexCliCallsDuringAudit}`,
    `Agent OS app-server desktop primitive calls during audit: ${review.summary.totalAgentOsAppServerDesktopPrimitiveCallsDuringAudit}`,
    `Agent OS app-server sub-agent runtime calls during audit: ${review.summary.totalAgentOsAppServerSubAgentRuntimeCallsDuringAudit}`,
    `Agent OS app-server host executor calls during audit: ${review.summary.totalAgentOsAppServerHostExecutorCallsDuringAudit}`,
    `Agent OS app-server host dispatch calls during audit: ${review.summary.totalAgentOsAppServerHostDispatchCallsDuringAudit}`,
    `Agent OS app-server shell/process calls during audit: ${review.summary.totalAgentOsAppServerShellProcessCallsDuringAudit}`,
    `Agent OS app-server workspace-write calls during audit: ${review.summary.totalAgentOsAppServerWorkspaceWriteCallsDuringAudit}`,
    `Agent OS app-server external write calls during audit: ${review.summary.totalAgentOsAppServerExternalWriteCallsDuringAudit}`,
    `Agent OS public surface calls during audit: ${review.summary.totalAgentOsPublicSurfaceCallsDuringAudit}`,
    `Agent OS public surface local runtime calls during audit: ${review.summary.totalAgentOsPublicSurfaceLocalRuntimeCallsDuringAudit}`,
    `Agent OS public surface provider execute calls during audit: ${review.summary.totalAgentOsPublicSurfaceProviderExecuteCallsDuringAudit}`,
    `Agent OS public surface Codex CLI calls during audit: ${review.summary.totalAgentOsPublicSurfaceCodexCliCallsDuringAudit}`,
    `Agent OS public surface desktop primitive calls during audit: ${review.summary.totalAgentOsPublicSurfaceDesktopPrimitiveCallsDuringAudit}`,
    `Agent OS public surface sub-agent runtime calls during audit: ${review.summary.totalAgentOsPublicSurfaceSubAgentRuntimeCallsDuringAudit}`,
    `Agent OS public surface host executor calls during audit: ${review.summary.totalAgentOsPublicSurfaceHostExecutorCallsDuringAudit}`,
    `Agent OS public surface host dispatch calls during audit: ${review.summary.totalAgentOsPublicSurfaceHostDispatchCallsDuringAudit}`,
    `Agent OS public surface shell/process calls during audit: ${review.summary.totalAgentOsPublicSurfaceShellProcessCallsDuringAudit}`,
    `Agent OS public surface network calls during audit: ${review.summary.totalAgentOsPublicSurfaceNetworkCallsDuringAudit}`,
    `Agent OS public surface workspace-write calls during audit: ${review.summary.totalAgentOsPublicSurfaceWorkspaceWriteCallsDuringAudit}`,
    `Agent OS public surface external write calls during audit: ${review.summary.totalAgentOsPublicSurfaceExternalWriteCallsDuringAudit}`,
    `provider execute calls during audit: ${review.summary.totalProviderExecuteCallsDuringAudit}`,
    `preflight calls during audit: ${review.summary.totalPreflightCallsDuringAudit}`,
    `preflight provider execute calls during audit: ${review.summary.totalPreflightProviderExecuteCallsDuringAudit}`,
    `preflight Codex CLI calls during audit: ${review.summary.totalPreflightCodexCliCallsDuringAudit}`,
    `preflight desktop primitive calls during audit: ${review.summary.totalPreflightDesktopPrimitiveCallsDuringAudit}`,
    `preflight sub-agent runtime calls during audit: ${review.summary.totalPreflightSubAgentRuntimeCallsDuringAudit}`,
    `preflight host executor calls during audit: ${review.summary.totalPreflightHostExecutorCallsDuringAudit}`,
    `preflight host dispatch calls during audit: ${review.summary.totalPreflightHostDispatchCallsDuringAudit}`,
    `preflight tool runtime calls during audit: ${review.summary.totalPreflightToolRuntimeCallsDuringAudit}`,
    `preflight shell/process calls during audit: ${review.summary.totalPreflightShellProcessCallsDuringAudit}`,
    `preflight network calls during audit: ${review.summary.totalPreflightNetworkCallsDuringAudit}`,
    `preflight workspace-write calls during audit: ${review.summary.totalPreflightWorkspaceWriteCallsDuringAudit}`,
    `preflight external write calls during audit: ${review.summary.totalPreflightExternalWriteCallsDuringAudit}`,
    `Approval permit calls during audit: ${review.summary.totalApprovalPermitCallsDuringAudit}`,
    `Approval permit validation calls during audit: ${review.summary.totalApprovalPermitValidationCallsDuringAudit}`,
    `Approval permit provider execute calls during audit: ${review.summary.totalApprovalPermitProviderExecuteCallsDuringAudit}`,
    `Approval permit Codex CLI calls during audit: ${review.summary.totalApprovalPermitCodexCliCallsDuringAudit}`,
    `Approval permit sub-agent runtime calls during audit: ${review.summary.totalApprovalPermitSubAgentRuntimeCallsDuringAudit}`,
    `Approval permit host executor calls during audit: ${review.summary.totalApprovalPermitHostExecutorCallsDuringAudit}`,
    `Approval permit tool runtime calls during audit: ${review.summary.totalApprovalPermitToolRuntimeCallsDuringAudit}`,
    `Approval permit shell/process calls during audit: ${review.summary.totalApprovalPermitShellProcessCallsDuringAudit}`,
    `Approval permit workspace-write calls during audit: ${review.summary.totalApprovalPermitWorkspaceWriteCallsDuringAudit}`,
    `Approval permit external write calls during audit: ${review.summary.totalApprovalPermitExternalWriteCallsDuringAudit}`,
    `Approval gate calls during audit: ${review.summary.totalApprovalGateCallsDuringAudit}`,
    `Approval gate resolution checks during audit: ${review.summary.totalApprovalGateResolutionChecksDuringAudit}`,
    `Approval gate provider execute calls during audit: ${review.summary.totalApprovalGateProviderExecuteCallsDuringAudit}`,
    `Approval gate Codex CLI calls during audit: ${review.summary.totalApprovalGateCodexCliCallsDuringAudit}`,
    `Approval gate sub-agent runtime calls during audit: ${review.summary.totalApprovalGateSubAgentRuntimeCallsDuringAudit}`,
    `Approval gate host executor calls during audit: ${review.summary.totalApprovalGateHostExecutorCallsDuringAudit}`,
    `Approval gate tool runtime calls during audit: ${review.summary.totalApprovalGateToolRuntimeCallsDuringAudit}`,
    `Approval gate shell/process calls during audit: ${review.summary.totalApprovalGateShellProcessCallsDuringAudit}`,
    `Approval gate workspace-write calls during audit: ${review.summary.totalApprovalGateWorkspaceWriteCallsDuringAudit}`,
    `Approval gate external write calls during audit: ${review.summary.totalApprovalGateExternalWriteCallsDuringAudit}`,
    `approval consumption dispatch matrix boundary provider execute calls during audit: ${review.summary.totalApprovalConsumptionDispatchMatrixBoundaryProviderExecuteCallsDuringAudit}`,
    `approval consumption dispatch matrix boundary Codex CLI calls during audit: ${review.summary.totalApprovalConsumptionDispatchMatrixBoundaryCodexCliCallsDuringAudit}`,
    `approval consumption dispatch matrix boundary workspace-write calls during audit: ${review.summary.totalApprovalConsumptionDispatchMatrixBoundaryWorkspaceWriteCallsDuringAudit}`,
    `approval consumption dispatch matrix boundary host executor calls during audit: ${review.summary.totalApprovalConsumptionDispatchMatrixBoundaryHostExecutorCallsDuringAudit}`,
    `approval consumption dispatch matrix boundary sub-agent runtime calls during audit: ${review.summary.totalApprovalConsumptionDispatchMatrixBoundarySubAgentRuntimeCallsDuringAudit}`,
    `approval consumption dispatch matrix boundary tool runtime calls during audit: ${review.summary.totalApprovalConsumptionDispatchMatrixBoundaryToolRuntimeCallsDuringAudit}`,
    `approval consumption dispatch matrix boundary shell/process calls during audit: ${review.summary.totalApprovalConsumptionDispatchMatrixBoundaryShellProcessCallsDuringAudit}`,
    `approval consumption dispatch matrix boundary external write calls during audit: ${review.summary.totalApprovalConsumptionDispatchMatrixBoundaryExternalWriteCallsDuringAudit}`,
    `approval consumption dispatch provider execute calls during audit: ${review.summary.totalApprovalConsumptionDispatchProviderExecuteCallsDuringAudit}`,
    `approval consumption dispatch Codex CLI calls during audit: ${review.summary.totalApprovalConsumptionDispatchCodexCliCallsDuringAudit}`,
    `approval consumption dispatch workspace-write calls during audit: ${review.summary.totalApprovalConsumptionDispatchWorkspaceWriteCallsDuringAudit}`,
    `approval consumption dispatch host executor calls during audit: ${review.summary.totalApprovalConsumptionDispatchHostExecutorCallsDuringAudit}`,
    `approval consumption dispatch sub-agent runtime calls during audit: ${review.summary.totalApprovalConsumptionDispatchSubAgentRuntimeCallsDuringAudit}`,
    `approval consumption dispatch shell/process calls during audit: ${review.summary.totalApprovalConsumptionDispatchShellProcessCallsDuringAudit}`,
    `approval consumption dispatch external write calls during audit: ${review.summary.totalApprovalConsumptionDispatchExternalWriteCallsDuringAudit}`,
    `read-only productization boundary provider execute calls during audit: ${review.summary.totalReadonlyProductizationBoundaryProviderExecuteCallsDuringAudit}`,
    `read-only productization boundary Codex CLI calls during audit: ${review.summary.totalReadonlyProductizationBoundaryCodexCliCallsDuringAudit}`,
    `read-only productization boundary workspace-write calls during audit: ${review.summary.totalReadonlyProductizationBoundaryWorkspaceWriteCallsDuringAudit}`,
    `read-only productization boundary host executor calls during audit: ${review.summary.totalReadonlyProductizationBoundaryHostExecutorCallsDuringAudit}`,
    `read-only productization boundary sub-agent runtime calls during audit: ${review.summary.totalReadonlyProductizationBoundarySubAgentRuntimeCallsDuringAudit}`,
    `read-only productization boundary tool runtime calls during audit: ${review.summary.totalReadonlyProductizationBoundaryToolRuntimeCallsDuringAudit}`,
    `read-only productization boundary shell/process calls during audit: ${review.summary.totalReadonlyProductizationBoundaryShellProcessCallsDuringAudit}`,
    `read-only productization boundary external write calls during audit: ${review.summary.totalReadonlyProductizationBoundaryExternalWriteCallsDuringAudit}`,
    `read-only productization boundary evidence writes during audit: ${review.summary.totalReadonlyProductizationBoundaryEvidenceWritesDuringAudit}`,
    `state-sync boundary provider execute calls during audit: ${review.summary.totalStateSyncBoundaryProviderExecuteCallsDuringAudit}`,
    `state-sync boundary Codex CLI calls during audit: ${review.summary.totalStateSyncBoundaryCodexCliCallsDuringAudit}`,
    `state-sync boundary workspace-write calls during audit: ${review.summary.totalStateSyncBoundaryWorkspaceWriteCallsDuringAudit}`,
    `state-sync boundary local command calls during audit: ${review.summary.totalStateSyncBoundaryLocalCommandCallsDuringAudit}`,
    `state-sync boundary host executor calls during audit: ${review.summary.totalStateSyncBoundaryHostExecutorCallsDuringAudit}`,
    `state-sync boundary sub-agent runtime calls during audit: ${review.summary.totalStateSyncBoundarySubAgentRuntimeCallsDuringAudit}`,
    `state-sync boundary tool runtime calls during audit: ${review.summary.totalStateSyncBoundaryToolRuntimeCallsDuringAudit}`,
    `state-sync boundary external write calls during audit: ${review.summary.totalStateSyncBoundaryExternalWriteCallsDuringAudit}`,
    `state-sync boundary state writes during audit: ${review.summary.totalStateSyncBoundaryStateWritesDuringAudit}`,
    `state-sync boundary remote writes during audit: ${review.summary.totalStateSyncBoundaryRemoteWritesDuringAudit}`,
    `workspace-write release gate provider execute calls during audit: ${review.summary.totalWorkspaceWriteReleaseGateProviderExecuteCallsDuringAudit}`,
    `workspace-write release gate Codex CLI calls during audit: ${review.summary.totalWorkspaceWriteReleaseGateCodexCliCallsDuringAudit}`,
    `workspace-write release gate workspace-write calls during audit: ${review.summary.totalWorkspaceWriteReleaseGateWorkspaceWriteCallsDuringAudit}`,
    `workspace-write release gate host executor calls during audit: ${review.summary.totalWorkspaceWriteReleaseGateHostExecutorCallsDuringAudit}`,
    `workspace-write release gate sub-agent runtime calls during audit: ${review.summary.totalWorkspaceWriteReleaseGateSubAgentRuntimeCallsDuringAudit}`,
    `workspace-write release gate external write calls during audit: ${review.summary.totalWorkspaceWriteReleaseGateExternalWriteCallsDuringAudit}`,
    `workspace-write release gate evidence writes during audit: ${review.summary.totalWorkspaceWriteReleaseGateEvidenceWritesDuringAudit}`,
    `Admission control calls during audit: ${review.summary.totalAdmissionControlCallsDuringAudit}`,
    `Admission control provider execute calls during audit: ${review.summary.totalAdmissionControlProviderExecuteCallsDuringAudit}`,
    `Admission control Codex CLI calls during audit: ${review.summary.totalAdmissionControlCodexCliCallsDuringAudit}`,
    `Admission control sub-agent runtime calls during audit: ${review.summary.totalAdmissionControlSubAgentRuntimeCallsDuringAudit}`,
    `Admission control host executor calls during audit: ${review.summary.totalAdmissionControlHostExecutorCallsDuringAudit}`,
    `Admission control tool runtime calls during audit: ${review.summary.totalAdmissionControlToolRuntimeCallsDuringAudit}`,
    `Admission control shell/process calls during audit: ${review.summary.totalAdmissionControlShellProcessCallsDuringAudit}`,
    `Admission control workspace-write calls during audit: ${review.summary.totalAdmissionControlWorkspaceWriteCallsDuringAudit}`,
    `Admission control external write calls during audit: ${review.summary.totalAdmissionControlExternalWriteCallsDuringAudit}`,
    `Delegation policy calls during audit: ${review.summary.totalDelegationPolicyCallsDuringAudit}`,
    `Delegation policy proposal lifecycle calls during audit: ${review.summary.totalDelegationPolicyProposalLifecycleCallsDuringAudit}`,
    `Delegation policy file-store writes during audit: ${review.summary.totalDelegationPolicyFileStoreWritesDuringAudit}`,
    `Delegation policy provider execute calls during audit: ${review.summary.totalDelegationPolicyProviderExecuteCallsDuringAudit}`,
    `Delegation policy Codex CLI calls during audit: ${review.summary.totalDelegationPolicyCodexCliCallsDuringAudit}`,
    `Delegation policy sub-agent runtime calls during audit: ${review.summary.totalDelegationPolicySubAgentRuntimeCallsDuringAudit}`,
    `Delegation policy host executor calls during audit: ${review.summary.totalDelegationPolicyHostExecutorCallsDuringAudit}`,
    `Delegation policy tool runtime calls during audit: ${review.summary.totalDelegationPolicyToolRuntimeCallsDuringAudit}`,
    `Delegation policy shell/process calls during audit: ${review.summary.totalDelegationPolicyShellProcessCallsDuringAudit}`,
    `Delegation policy workspace-write calls during audit: ${review.summary.totalDelegationPolicyWorkspaceWriteCallsDuringAudit}`,
    `Delegation policy external write calls during audit: ${review.summary.totalDelegationPolicyExternalWriteCallsDuringAudit}`,
    `execution eligibility calls during audit: ${review.summary.totalExecutionEligibilityCallsDuringAudit}`,
    `execution eligibility permit store reads during audit: ${review.summary.totalExecutionEligibilityPermitStoreReadsDuringAudit}`,
    `execution eligibility provider plan creation calls during audit: ${review.summary.totalExecutionEligibilityProviderPlanCreationCallsDuringAudit}`,
    `execution eligibility provider execute calls during audit: ${review.summary.totalExecutionEligibilityProviderExecuteCallsDuringAudit}`,
    `execution eligibility Codex CLI calls during audit: ${review.summary.totalExecutionEligibilityCodexCliCallsDuringAudit}`,
    `execution eligibility sub-agent runtime calls during audit: ${review.summary.totalExecutionEligibilitySubAgentRuntimeCallsDuringAudit}`,
    `execution eligibility host executor calls during audit: ${review.summary.totalExecutionEligibilityHostExecutorCallsDuringAudit}`,
    `execution eligibility host dispatch calls during audit: ${review.summary.totalExecutionEligibilityHostDispatchCallsDuringAudit}`,
    `execution eligibility shell/process calls during audit: ${review.summary.totalExecutionEligibilityShellProcessCallsDuringAudit}`,
    `execution eligibility workspace-write calls during audit: ${review.summary.totalExecutionEligibilityWorkspaceWriteCallsDuringAudit}`,
    `execution eligibility external write calls during audit: ${review.summary.totalExecutionEligibilityExternalWriteCallsDuringAudit}`,
    `execution observation bus emits during audit: ${review.summary.totalExecutionObservationBusEmitsDuringAudit}`,
    `execution observation store writes during audit: ${review.summary.totalExecutionObservationStoreWritesDuringAudit}`,
    `execution observation provider execute calls during audit: ${review.summary.totalExecutionObservationProviderExecuteCallsDuringAudit}`,
    `execution observation Codex CLI calls during audit: ${review.summary.totalExecutionObservationCodexCliCallsDuringAudit}`,
    `execution observation sub-agent runtime calls during audit: ${review.summary.totalExecutionObservationSubAgentRuntimeCallsDuringAudit}`,
    `execution observation host executor calls during audit: ${review.summary.totalExecutionObservationHostExecutorCallsDuringAudit}`,
    `execution observation host dispatch calls during audit: ${review.summary.totalExecutionObservationHostDispatchCallsDuringAudit}`,
    `execution observation shell/process calls during audit: ${review.summary.totalExecutionObservationShellProcessCallsDuringAudit}`,
    `execution observation workspace-write calls during audit: ${review.summary.totalExecutionObservationWorkspaceWriteCallsDuringAudit}`,
    `execution observation external write calls during audit: ${review.summary.totalExecutionObservationExternalWriteCallsDuringAudit}`,
    `governance failure reducer callback calls during audit: ${review.summary.totalGovernanceFailureReducerCallbackCallsDuringAudit}`,
    `governance failure reducer persistence writes during audit: ${review.summary.totalGovernanceFailureReducerPersistenceWritesDuringAudit}`,
    `governance failure reducer provider execute calls during audit: ${review.summary.totalGovernanceFailureReducerProviderExecuteCallsDuringAudit}`,
    `governance failure reducer Codex CLI calls during audit: ${review.summary.totalGovernanceFailureReducerCodexCliCallsDuringAudit}`,
    `governance failure reducer sub-agent runtime calls during audit: ${review.summary.totalGovernanceFailureReducerSubAgentRuntimeCallsDuringAudit}`,
    `governance failure reducer host executor calls during audit: ${review.summary.totalGovernanceFailureReducerHostExecutorCallsDuringAudit}`,
    `governance failure reducer host dispatch calls during audit: ${review.summary.totalGovernanceFailureReducerHostDispatchCallsDuringAudit}`,
    `governance failure reducer tool runtime calls during audit: ${review.summary.totalGovernanceFailureReducerToolRuntimeCallsDuringAudit}`,
    `governance failure reducer shell/process calls during audit: ${review.summary.totalGovernanceFailureReducerShellProcessCallsDuringAudit}`,
    `governance failure reducer workspace-write calls during audit: ${review.summary.totalGovernanceFailureReducerWorkspaceWriteCallsDuringAudit}`,
    `governance failure reducer external write calls during audit: ${review.summary.totalGovernanceFailureReducerExternalWriteCallsDuringAudit}`,
    `task graph calls during audit: ${review.summary.totalTaskGraphCallsDuringAudit}`,
    `task graph store writes during audit: ${review.summary.totalTaskGraphStoreWritesDuringAudit}`,
    `task graph provider execute calls during audit: ${review.summary.totalTaskGraphProviderExecuteCallsDuringAudit}`,
    `task graph Codex CLI calls during audit: ${review.summary.totalTaskGraphCodexCliCallsDuringAudit}`,
    `task graph sub-agent runtime calls during audit: ${review.summary.totalTaskGraphSubAgentRuntimeCallsDuringAudit}`,
    `task graph host executor calls during audit: ${review.summary.totalTaskGraphHostExecutorCallsDuringAudit}`,
    `task graph host dispatch calls during audit: ${review.summary.totalTaskGraphHostDispatchCallsDuringAudit}`,
    `task graph tool runtime calls during audit: ${review.summary.totalTaskGraphToolRuntimeCallsDuringAudit}`,
    `task graph shell/process calls during audit: ${review.summary.totalTaskGraphShellProcessCallsDuringAudit}`,
    `task graph workspace-write calls during audit: ${review.summary.totalTaskGraphWorkspaceWriteCallsDuringAudit}`,
    `task graph external write calls during audit: ${review.summary.totalTaskGraphExternalWriteCallsDuringAudit}`,
    `scheduler calls during audit: ${review.summary.totalSchedulerCallsDuringAudit}`,
    `scheduler lease acquisitions during audit: ${review.summary.totalSchedulerLeaseAcquisitionsDuringAudit}`,
    `scheduler state writes during audit: ${review.summary.totalSchedulerStateWritesDuringAudit}`,
    `scheduler provider execute calls during audit: ${review.summary.totalSchedulerProviderExecuteCallsDuringAudit}`,
    `scheduler Codex CLI calls during audit: ${review.summary.totalSchedulerCodexCliCallsDuringAudit}`,
    `scheduler sub-agent runtime calls during audit: ${review.summary.totalSchedulerSubAgentRuntimeCallsDuringAudit}`,
    `scheduler host executor calls during audit: ${review.summary.totalSchedulerHostExecutorCallsDuringAudit}`,
    `scheduler host dispatch calls during audit: ${review.summary.totalSchedulerHostDispatchCallsDuringAudit}`,
    `scheduler tool runtime calls during audit: ${review.summary.totalSchedulerToolRuntimeCallsDuringAudit}`,
    `scheduler shell/process calls during audit: ${review.summary.totalSchedulerShellProcessCallsDuringAudit}`,
    `scheduler workspace-write calls during audit: ${review.summary.totalSchedulerWorkspaceWriteCallsDuringAudit}`,
    `scheduler external write calls during audit: ${review.summary.totalSchedulerExternalWriteCallsDuringAudit}`,
    `execution planner calls during audit: ${review.summary.totalExecutionPlannerCallsDuringAudit}`,
    `execution planner local plan store writes during audit: ${review.summary.totalExecutionPlannerLocalPlanStoreWritesDuringAudit}`,
    `execution planner provider planExecution calls during audit: ${review.summary.totalExecutionPlannerProviderPlanExecutionCallsDuringAudit}`,
    `execution planner provider validateExecutionPlan calls during audit: ${review.summary.totalExecutionPlannerProviderValidateExecutionPlanCallsDuringAudit}`,
    `execution planner provider execute calls during audit: ${review.summary.totalExecutionPlannerProviderExecuteCallsDuringAudit}`,
    `execution planner Codex CLI calls during audit: ${review.summary.totalExecutionPlannerCodexCliCallsDuringAudit}`,
    `execution planner sub-agent runtime calls during audit: ${review.summary.totalExecutionPlannerSubAgentRuntimeCallsDuringAudit}`,
    `execution planner host executor calls during audit: ${review.summary.totalExecutionPlannerHostExecutorCallsDuringAudit}`,
    `execution planner host dispatch calls during audit: ${review.summary.totalExecutionPlannerHostDispatchCallsDuringAudit}`,
    `execution planner shell/process calls during audit: ${review.summary.totalExecutionPlannerShellProcessCallsDuringAudit}`,
    `execution planner workspace-write calls during audit: ${review.summary.totalExecutionPlannerWorkspaceWriteCallsDuringAudit}`,
    `execution planner external write calls during audit: ${review.summary.totalExecutionPlannerExternalWriteCallsDuringAudit}`,
    `Provider registry calls during audit: ${review.summary.totalProviderRegistryCallsDuringAudit}`,
    `Provider registry selection calls during audit: ${review.summary.totalProviderRegistrySelectionCallsDuringAudit}`,
    `Provider registry provider execute calls during audit: ${review.summary.totalProviderRegistryProviderExecuteCallsDuringAudit}`,
    `Provider registry Codex CLI calls during audit: ${review.summary.totalProviderRegistryCodexCliCallsDuringAudit}`,
    `Provider registry sub-agent runtime calls during audit: ${review.summary.totalProviderRegistrySubAgentRuntimeCallsDuringAudit}`,
    `Provider registry host executor calls during audit: ${review.summary.totalProviderRegistryHostExecutorCallsDuringAudit}`,
    `Provider registry tool runtime calls during audit: ${review.summary.totalProviderRegistryToolRuntimeCallsDuringAudit}`,
    `Provider registry shell/process calls during audit: ${review.summary.totalProviderRegistryShellProcessCallsDuringAudit}`,
    `Provider registry workspace-write calls during audit: ${review.summary.totalProviderRegistryWorkspaceWriteCallsDuringAudit}`,
    `Provider registry external write calls during audit: ${review.summary.totalProviderRegistryExternalWriteCallsDuringAudit}`,
    `controlled provider execution taskbook provider execute calls during audit: ${review.summary.totalControlledProviderExecutionTaskbookProviderExecuteCallsDuringAudit}`,
    `controlled provider execution taskbook Codex CLI calls during audit: ${review.summary.totalControlledProviderExecutionTaskbookCodexCliCallsDuringAudit}`,
    `controlled provider execution taskbook workspace-write calls during audit: ${review.summary.totalControlledProviderExecutionTaskbookWorkspaceWriteCallsDuringAudit}`,
    `controlled provider execution taskbook host executor calls during audit: ${review.summary.totalControlledProviderExecutionTaskbookHostExecutorCallsDuringAudit}`,
    `controlled provider execution taskbook sub-agent runtime calls during audit: ${review.summary.totalControlledProviderExecutionTaskbookSubAgentRuntimeCallsDuringAudit}`,
    `controlled provider execution taskbook shell/process calls during audit: ${review.summary.totalControlledProviderExecutionTaskbookShellProcessCallsDuringAudit}`,
    `controlled provider execution taskbook external write calls during audit: ${review.summary.totalControlledProviderExecutionTaskbookExternalWriteCallsDuringAudit}`,
    `controlled provider execution taskbook evidence writes during audit: ${review.summary.totalControlledProviderExecutionTaskbookEvidenceWritesDuringAudit}`,
    `controlled provider execution taskbook review boundary provider execute calls during audit: ${review.summary.totalControlledProviderExecutionTaskbookReviewBoundaryProviderExecuteCallsDuringAudit}`,
    `controlled provider execution taskbook review boundary Codex CLI calls during audit: ${review.summary.totalControlledProviderExecutionTaskbookReviewBoundaryCodexCliCallsDuringAudit}`,
    `controlled provider execution taskbook review boundary workspace-write calls during audit: ${review.summary.totalControlledProviderExecutionTaskbookReviewBoundaryWorkspaceWriteCallsDuringAudit}`,
    `controlled provider execution taskbook review boundary host executor calls during audit: ${review.summary.totalControlledProviderExecutionTaskbookReviewBoundaryHostExecutorCallsDuringAudit}`,
    `controlled provider execution taskbook review boundary sub-agent runtime calls during audit: ${review.summary.totalControlledProviderExecutionTaskbookReviewBoundarySubAgentRuntimeCallsDuringAudit}`,
    `controlled provider execution taskbook review boundary shell/process calls during audit: ${review.summary.totalControlledProviderExecutionTaskbookReviewBoundaryShellProcessCallsDuringAudit}`,
    `controlled provider execution taskbook review boundary external write calls during audit: ${review.summary.totalControlledProviderExecutionTaskbookReviewBoundaryExternalWriteCallsDuringAudit}`,
    `controlled provider execution taskbook review boundary evidence writes during audit: ${review.summary.totalControlledProviderExecutionTaskbookReviewBoundaryEvidenceWritesDuringAudit}`,
    `controlled provider execution dispatch preflight provider execute calls during audit: ${review.summary.totalControlledProviderExecutionDispatchPreflightProviderExecuteCallsDuringAudit}`,
    `controlled provider execution dispatch preflight Codex CLI calls during audit: ${review.summary.totalControlledProviderExecutionDispatchPreflightCodexCliCallsDuringAudit}`,
    `controlled provider execution dispatch preflight workspace-write calls during audit: ${review.summary.totalControlledProviderExecutionDispatchPreflightWorkspaceWriteCallsDuringAudit}`,
    `controlled provider execution dispatch preflight host executor calls during audit: ${review.summary.totalControlledProviderExecutionDispatchPreflightHostExecutorCallsDuringAudit}`,
    `controlled provider execution dispatch preflight sub-agent runtime calls during audit: ${review.summary.totalControlledProviderExecutionDispatchPreflightSubAgentRuntimeCallsDuringAudit}`,
    `controlled provider execution dispatch preflight shell/process calls during audit: ${review.summary.totalControlledProviderExecutionDispatchPreflightShellProcessCallsDuringAudit}`,
    `controlled provider execution dispatch preflight external write calls during audit: ${review.summary.totalControlledProviderExecutionDispatchPreflightExternalWriteCallsDuringAudit}`,
    `controlled provider execution dispatch preflight evidence writes during audit: ${review.summary.totalControlledProviderExecutionDispatchPreflightEvidenceWritesDuringAudit}`,
    `controlled provider execution dispatcher runner invocations during audit: ${review.summary.totalControlledProviderExecutionDispatcherRunnerInvocationsDuringAudit}`,
    `controlled provider execution dispatcher provider execute calls during audit: ${review.summary.totalControlledProviderExecutionDispatcherProviderExecuteCallsDuringAudit}`,
    `controlled provider execution dispatcher real Codex CLI calls during audit: ${review.summary.totalControlledProviderExecutionDispatcherRealCodexCliCallsDuringAudit}`,
    `controlled provider execution dispatcher workspace-write calls during audit: ${review.summary.totalControlledProviderExecutionDispatcherWorkspaceWriteCallsDuringAudit}`,
    `controlled provider execution dispatcher host executor calls during audit: ${review.summary.totalControlledProviderExecutionDispatcherHostExecutorCallsDuringAudit}`,
    `controlled provider execution dispatcher sub-agent runtime calls during audit: ${review.summary.totalControlledProviderExecutionDispatcherSubAgentRuntimeCallsDuringAudit}`,
    `controlled provider execution dispatcher shell/process calls during audit: ${review.summary.totalControlledProviderExecutionDispatcherShellProcessCallsDuringAudit}`,
    `controlled provider execution dispatcher external write calls during audit: ${review.summary.totalControlledProviderExecutionDispatcherExternalWriteCallsDuringAudit}`,
    `provider execution runner calls during audit: ${review.summary.totalProviderExecutionRunnerCallsDuringAudit}`,
    `provider execution runner planExecution calls during audit: ${review.summary.totalProviderExecutionRunnerPlanExecutionCallsDuringAudit}`,
    `provider execution runner validateExecutionPlan calls during audit: ${review.summary.totalProviderExecutionRunnerValidateExecutionPlanCallsDuringAudit}`,
    `provider execution runner execute calls during audit: ${review.summary.totalProviderExecutionRunnerExecuteCallsDuringAudit}`,
    `provider-core runtime calls during audit: ${review.summary.totalProviderCoreRuntimeCallsDuringAudit}`,
    `Tool invocation planner registry calls during audit: ${review.summary.totalToolRegistryCallsDuringAudit}`,
    `Tool invocation planner plans during audit: ${review.summary.totalToolInvocationPlansDuringAudit}`,
    `Tool invocation planner tool runtime calls during audit: ${review.summary.totalToolInvocationPlannerToolRuntimeCallsDuringAudit}`,
    `Tool invocation planner provider execute calls during audit: ${review.summary.totalToolInvocationPlannerProviderExecuteCallsDuringAudit}`,
    `Tool invocation planner Codex CLI calls during audit: ${review.summary.totalToolInvocationPlannerCodexCliCallsDuringAudit}`,
    `Tool invocation planner sub-agent runtime calls during audit: ${review.summary.totalToolInvocationPlannerSubAgentRuntimeCallsDuringAudit}`,
    `Tool invocation planner host executor calls during audit: ${review.summary.totalToolInvocationPlannerHostExecutorCallsDuringAudit}`,
    `Tool invocation planner shell/process calls during audit: ${review.summary.totalToolInvocationPlannerShellProcessCallsDuringAudit}`,
    `Tool invocation planner workspace-write calls during audit: ${review.summary.totalToolInvocationPlannerWorkspaceWriteCallsDuringAudit}`,
    `Tool invocation planner external write calls during audit: ${review.summary.totalToolInvocationPlannerExternalWriteCallsDuringAudit}`,
    `desktop agent strategy calls during audit: ${review.summary.totalDesktopAgentStrategyCallsDuringAudit}`,
    `desktop agent strategy provider execute calls during audit: ${review.summary.totalDesktopAgentStrategyProviderExecuteCallsDuringAudit}`,
    `desktop agent strategy Codex CLI calls during audit: ${review.summary.totalDesktopAgentStrategyCodexCliCallsDuringAudit}`,
    `desktop agent strategy desktop primitive calls during audit: ${review.summary.totalDesktopAgentStrategyDesktopPrimitiveCallsDuringAudit}`,
    `desktop agent strategy sub-agent runtime calls during audit: ${review.summary.totalDesktopAgentStrategySubAgentRuntimeCallsDuringAudit}`,
    `desktop agent strategy host executor calls during audit: ${review.summary.totalDesktopAgentStrategyHostExecutorCallsDuringAudit}`,
    `desktop agent strategy host dispatch calls during audit: ${review.summary.totalDesktopAgentStrategyHostDispatchCallsDuringAudit}`,
    `desktop agent strategy shell/process calls during audit: ${review.summary.totalDesktopAgentStrategyShellProcessCallsDuringAudit}`,
    `desktop agent strategy workspace-write calls during audit: ${review.summary.totalDesktopAgentStrategyWorkspaceWriteCallsDuringAudit}`,
    `desktop agent strategy external write calls during audit: ${review.summary.totalDesktopAgentStrategyExternalWriteCallsDuringAudit}`,
    `desktop decision runner calls during audit: ${review.summary.totalDesktopDecisionRunnerCallsDuringAudit}`,
    `desktop decision runner host dispatch calls during audit: ${review.summary.totalDesktopDecisionRunnerHostDispatchCallsDuringAudit}`,
    `desktop decision runner provider execute calls during audit: ${review.summary.totalDesktopDecisionRunnerProviderExecuteCallsDuringAudit}`,
    `final host locator calls during audit: ${review.summary.totalFinalHostLocatorCallsDuringAudit}`,
    `final host locator host executor calls during audit: ${review.summary.totalFinalHostLocatorHostExecutorCallsDuringAudit}`,
    `final host locator host dispatch calls during audit: ${review.summary.totalFinalHostLocatorHostDispatchCallsDuringAudit}`,
    `final host locator provider execute calls during audit: ${review.summary.totalFinalHostLocatorProviderExecuteCallsDuringAudit}`,
    `final host locator Codex CLI calls during audit: ${review.summary.totalFinalHostLocatorCodexCliCallsDuringAudit}`,
    `final host locator sub-agent runtime calls during audit: ${review.summary.totalFinalHostLocatorSubAgentRuntimeCallsDuringAudit}`,
    `final host locator shell/process calls during audit: ${review.summary.totalFinalHostLocatorShellProcessCallsDuringAudit}`,
    `final host locator workspace-write calls during audit: ${review.summary.totalFinalHostLocatorWorkspaceWriteCallsDuringAudit}`,
    `final host locator external write calls during audit: ${review.summary.totalFinalHostLocatorExternalWriteCallsDuringAudit}`,
    `remote agent runtime calls during audit: ${review.summary.totalRemoteAgentRuntimeCallsDuringAudit}`,
    `tool runtime calls during audit: ${review.summary.totalToolRuntimeCallsDuringAudit}`,
    `host dispatcher provider dispatch calls during audit: ${review.summary.totalHostDispatcherProviderDispatchCallsDuringAudit}`,
    `Codex desktop bridge calls during audit: ${review.summary.totalCodexDesktopBridgeCallsDuringAudit}`,
    `Codex desktop runtime tool calls during audit: ${review.summary.totalCodexDesktopRuntimeToolCallsDuringAudit}`,
    `Codex desktop live host bundle creations during audit: ${review.summary.totalCodexDesktopLiveHostBundleCreationsDuringAudit}`,
    `Codex desktop live host runtime tool calls during audit: ${review.summary.totalCodexDesktopLiveHostRuntimeToolCallsDuringAudit}`,
    `Codex desktop live host memory tool calls during audit: ${review.summary.totalCodexDesktopLiveHostMemoryToolCallsDuringAudit}`,
    `Codex desktop live host bridge calls during audit: ${review.summary.totalCodexDesktopLiveHostBridgeCallsDuringAudit}`,
    `Codex desktop live host client run calls during audit: ${review.summary.totalCodexDesktopLiveHostClientRunCallsDuringAudit}`,
    `Codex desktop live host smoke runs during audit: ${review.summary.totalCodexDesktopLiveHostSmokeRunsDuringAudit}`,
    `Codex memory MCP client MCP HTTP calls during audit: ${review.summary.totalCodexMemoryMcpClientMcpHttpCallsDuringAudit}`,
    `Codex memory MCP client memory tool calls during audit: ${review.summary.totalCodexMemoryMcpClientMemoryToolCallsDuringAudit}`,
    `Codex memory MCP client host executor invocations during audit: ${review.summary.totalCodexMemoryMcpClientHostExecutorInvocationsDuringAudit}`,
    `Codex memory MCP client Codex CLI calls during audit: ${review.summary.totalCodexMemoryMcpClientCodexCliCallsDuringAudit}`,
    `Codex memory MCP client provider execute calls during audit: ${review.summary.totalCodexMemoryMcpClientProviderExecuteCallsDuringAudit}`,
    `Codex memory MCP client sub-agent runtime calls during audit: ${review.summary.totalCodexMemoryMcpClientSubAgentRuntimeCallsDuringAudit}`,
    `Codex memory MCP client shell/process calls during audit: ${review.summary.totalCodexMemoryMcpClientShellProcessCallsDuringAudit}`,
    `Codex memory MCP client workspace-write calls during audit: ${review.summary.totalCodexMemoryMcpClientWorkspaceWriteCallsDuringAudit}`,
    `Codex memory MCP client external write calls during audit: ${review.summary.totalCodexMemoryMcpClientExternalWriteCallsDuringAudit}`,
    `Codex memory host client calls during audit: ${review.summary.totalCodexMemoryHostClientCallsDuringAudit}`,
    `Codex memory host client memory operation calls during audit: ${review.summary.totalCodexMemoryHostClientMemoryOperationCallsDuringAudit}`,
    `Codex memory host client host executor invocations during audit: ${review.summary.totalCodexMemoryHostClientHostExecutorInvocationsDuringAudit}`,
    `Codex memory host client Codex CLI calls during audit: ${review.summary.totalCodexMemoryHostClientCodexCliCallsDuringAudit}`,
    `Codex memory host client provider execute calls during audit: ${review.summary.totalCodexMemoryHostClientProviderExecuteCallsDuringAudit}`,
    `Codex memory host client sub-agent runtime calls during audit: ${review.summary.totalCodexMemoryHostClientSubAgentRuntimeCallsDuringAudit}`,
    `Codex memory host client shell/process calls during audit: ${review.summary.totalCodexMemoryHostClientShellProcessCallsDuringAudit}`,
    `Codex memory host client workspace-write calls during audit: ${review.summary.totalCodexMemoryHostClientWorkspaceWriteCallsDuringAudit}`,
    `Codex memory host client external write calls during audit: ${review.summary.totalCodexMemoryHostClientExternalWriteCallsDuringAudit}`,
    `desktop host client calls during audit: ${review.summary.totalDesktopHostClientCallsDuringAudit}`,
    `desktop host client live adapter calls during audit: ${review.summary.totalDesktopHostClientLiveAdapterCallsDuringAudit}`,
    `desktop host client host executor invocations during audit: ${review.summary.totalDesktopHostClientHostExecutorInvocationsDuringAudit}`,
    `desktop host client dispatchToHost calls during audit: ${review.summary.totalDesktopHostClientDispatchToHostCallsDuringAudit}`,
    `desktop live adapter calls during audit: ${review.summary.totalDesktopLiveAdapterCallsDuringAudit}`,
    `desktop live adapter dispatchToHost calls during audit: ${review.summary.totalDesktopLiveAdapterDispatchToHostCallsDuringAudit}`,
    `desktop live adapter bridge calls during audit: ${review.summary.totalDesktopLiveAdapterBridgeCallsDuringAudit}`,
    `host client example calls during audit: ${review.summary.totalHostClientExampleCallsDuringAudit}`,
    `host client example live adapter calls during audit: ${review.summary.totalHostClientExampleLiveAdapterCallsDuringAudit}`,
    `host client example host executor invocations during audit: ${review.summary.totalHostClientExampleHostExecutorInvocationsDuringAudit}`,
    `target host embedding bundle creations during audit: ${review.summary.totalTargetHostEmbeddingBundleCreationsDuringAudit}`,
    `target host embedding host client run calls during audit: ${review.summary.totalTargetHostEmbeddingHostClientRunCallsDuringAudit}`,
    `target host embedding host executor invocations during audit: ${review.summary.totalTargetHostEmbeddingHostExecutorInvocationsDuringAudit}`,
    `target host embedding Codex CLI calls during audit: ${review.summary.totalTargetHostEmbeddingCodexCliCallsDuringAudit}`,
    `target host embedding provider execute calls during audit: ${review.summary.totalTargetHostEmbeddingProviderExecuteCallsDuringAudit}`,
    `target host embedding sub-agent runtime calls during audit: ${review.summary.totalTargetHostEmbeddingSubAgentRuntimeCallsDuringAudit}`,
    `target host embedding shell/process calls during audit: ${review.summary.totalTargetHostEmbeddingShellProcessCallsDuringAudit}`,
    `target host embedding workspace-write calls during audit: ${review.summary.totalTargetHostEmbeddingWorkspaceWriteCallsDuringAudit}`,
    `target host embedding external write calls during audit: ${review.summary.totalTargetHostEmbeddingExternalWriteCallsDuringAudit}`,
    `host executor invocations during audit: ${review.summary.totalHostExecutorInvocationsDuringAudit}`,
    `host executor taskbook dispatch calls during audit: ${review.summary.totalHostExecutorTaskbookDispatchCallsDuringAudit}`,
    `host-client review bridge calls during audit: ${review.summary.totalHostClientReviewBridgeCallsDuringAudit}`,
    `host-client review dispatch calls during audit: ${review.summary.totalHostClientReviewDispatchCallsDuringAudit}`,
    `host executor receipt invocations during audit: ${review.summary.totalHostExecutorReceiptInvocationsDuringAudit}`,
    `agent-backed sandbox executor invocations during audit: ${review.summary.totalAgentBackedSandboxExecutorInvocationsDuringAudit}`,
    `agent executor adapter taskbook invocations during audit: ${review.summary.totalAgentExecutorAdapterTaskbookInvocationsDuringAudit}`,
    `agent executor adapter review invocations during audit: ${review.summary.totalAgentExecutorAdapterReviewInvocationsDuringAudit}`,
    `agent executor adapter invocations during audit: ${review.summary.totalAgentExecutorAdapterInvocationsDuringAudit}`,
    `agent task-control taskbook invocations during audit: ${review.summary.totalAgentTaskControlTaskbookInvocationsDuringAudit}`,
    `agent task-control review invocations during audit: ${review.summary.totalAgentTaskControlReviewInvocationsDuringAudit}`,
    `sub-agent runtime calls during audit: ${review.summary.totalSubAgentRuntimeCallsDuringAudit}`,
    `shell/process calls during audit: ${review.summary.totalShellProcessCallsDuringAudit}`,
    `workspace-write calls during audit: ${review.summary.totalWorkspaceWriteCallsDuringAudit}`,
    `external write calls during audit: ${review.summary.totalExternalWriteCallsDuringAudit}`,
    `adapter invocations during audit: ${review.summary.totalAdapterInvocationsDuringAudit}`,
    ...(review.reasons.length > 0 ? [`reasons: ${review.reasons.join(",")}`] : [])
  ].join("\n");
}

async function read(cwd: string, filePath: string): Promise<string> {
  return readFile(join(cwd, filePath), "utf8");
}

function allComponentAuditsPassed(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  return input.strategyRouterReview.status === "passed"
    && input.executionProfilesReview.status === "passed"
    && input.policyConfigReview.status === "passed"
    && input.capabilityTaxonomyReview.status === "passed"
    && input.capabilityTaxonomyEscalationPolicyReview.status === "passed"
    && input.routingEngineReview.status === "passed"
    && input.recoveryControlReview.status === "passed"
    && input.runtimeControlReview.status === "passed"
    && input.codexCliHostReview.status === "passed"
    && input.publicApiReview.status === "passed"
    && input.agentOsLocalRuntimeReview.status === "passed"
    && input.agentOsMcpServerManifestReview.status === "passed"
    && input.protocolMcpProviderSkeletonReview.status === "passed"
    && input.protocolA2aRemoteProviderSkeletonReview.status === "passed"
    && input.agentOsSdkReview.status === "passed"
    && input.agentOsCliReview.status === "passed"
    && input.agentOsAppServerReview.status === "passed"
    && input.agentOsPublicSurfacesReview.status === "passed"
    && input.codexProviderReview.status === "passed"
    && input.preflightReview.status === "passed"
    && input.approvalPermitReview.status === "passed"
    && input.approvalGateReview.status === "passed"
    && input.approvalConsumptionDispatchMatrixReview.status === "passed"
    && input.approvalConsumptionDispatchReview.status === "passed"
    && input.readonlyProductizationReview.status === "passed"
    && input.stateSyncReview.status === "passed"
    && input.workspaceWriteReleaseGateReview.status === "passed"
    && input.admissionControlReview.status === "passed"
    && input.delegationPolicyReview.status === "passed"
    && input.executionEligibilityReview.status === "passed"
    && input.executionObservationReview.status === "passed"
    && input.governanceFailureReducerReview.status === "passed"
    && input.taskGraphReview.status === "passed"
    && input.schedulerReview.status === "passed"
    && input.executionPlannerReview.status === "passed"
    && input.providerRegistryReview.status === "passed"
    && input.controlledProviderExecutionTaskbookReview.status === "passed"
    && input.controlledProviderExecutionTaskbookReviewBoundaryReview.status === "passed"
    && input.controlledProviderExecutionDispatchPreflightReview.status === "passed"
    && input.controlledProviderExecutionDispatcherReview.status === "passed"
    && input.providerExecutionRunnerReview.status === "passed"
    && input.providerCorePrimitivesReview.status === "passed"
    && input.toolInvocationPlannerReview.status === "passed"
    && input.desktopAgentStrategyReview.status === "passed"
    && input.desktopDecisionRunnerReview.status === "passed"
    && input.finalHostLocatorReview.status === "passed"
    && input.hostDispatcherProviderReview.status === "passed"
    && input.codexDesktopBridgeReview.status === "passed"
    && input.codexDesktopLiveHostReview.status === "passed"
    && input.codexMemoryMcpClientReview.status === "passed"
    && input.codexMemoryHostClientReview.status === "passed"
    && input.desktopHostClientReview.status === "passed"
    && input.desktopLiveAdapterDispatchReview.status === "passed"
    && input.hostClientExampleReview.status === "passed"
    && input.targetHostEmbeddingReview.status === "passed"
    && input.operatorActionExecutorGateReview.status === "passed"
    && input.hostExecutorReview.status === "passed"
    && input.hostExecutorTaskbookReview.status === "passed"
    && input.hostClientExecutorReviewReview.status === "passed"
    && input.hostExecutorReceiptReview.status === "passed"
    && input.agentBackedRecoveryExecutorReview.status === "passed"
    && input.agentExecutorAdapterTaskbookReview.status === "passed"
    && input.agentExecutorAdapterReviewReview.status === "passed"
    && input.agentExecutorAdapterSandboxReview.status === "passed"
    && input.agentTaskControlTaskbookReview.status === "passed"
    && input.agentTaskControlReviewReview.status === "passed"
    && input.subAgentRuntimeReview.status === "passed"
    && input.agentTaskControlReview.status === "passed";
}

function controlPlaneRecordsAllBoundaries(text: string): boolean {
  const normalizedText = normalizeDocTextForMarkerSearch(text);

  return text.includes("Controlled read-only real execution")
    && text.includes("Strategy router execution boundary")
    && text.includes("Execution profiles boundary")
    && text.includes("profile templates only")
    && text.includes("profile stages are not runtime steps")
    && text.includes("default roles are not sub-agent runtime authorization")
    && text.includes("defaultToolAccess is not tool runtime authorization")
    && text.includes("engineering_write is not workspace-write execution")
    && text.includes("protected_remote is not external-write authorization")
    && text.includes("allowParallel is not sub-agent runtime authorization")
    && text.includes("maxParallelAgents is not sub-agent spawn authorization")
    && text.includes("release-governance is not protected-remote authorization")
    && text.includes("profile selection is not provider execution authorization")
    && text.includes("Policy config boundary")
    && text.includes("policy schema and signal resolution only")
    && text.includes("hostRoutes are not host dispatch authorization")
    && text.includes("codex-cli host routes are not Codex CLI invocation")
    && text.includes("desktop host routes are not desktop runtime invocation")
    && text.includes("toolPolicies are not tool runtime authorization")
    && text.includes("protected_remote is not external-write authorization")
    && text.includes("approval rules are not approval grants")
    && text.includes("memory health block severity is not runtime block execution")
    && text.includes("memory guidance is not sub-agent runtime authorization")
    && text.includes("telemetry thresholds are not runtime authorization")
    && text.includes("telemetry delivery windows are not host executor authorization")
    && text.includes("Capability taxonomy boundary")
    && text.includes("capability classification and escalation policy only")
    && text.includes("bounded workspace-write canary is not workspace-write authorization")
    && text.includes("bounded workspace-write receipt is not execution authorization")
    && text.includes("scoped workspace-write class is not workspace-write execution")
    && text.includes("general workspace-write class is not execution authorization")
    && text.includes("general provider execution class is not provider execute authorization")
    && text.includes("external_write class is not external-write authorization")
    && text.includes("release_or_deploy class is not release authorization")
    && text.includes("secret_or_credential_change class is not secret access authorization")
    && text.includes("capability escalation policy is not runtime authorization")
    && text.includes("canary evidence baseline is not execution authorization")
    && text.includes("Capability taxonomy escalation policy boundary")
    && text.includes("capability escalation policy only")
    && text.includes("escalation policy is not provider execute authorization")
    && text.includes("escalation policy is not Codex CLI authorization")
    && text.includes("escalation policy is not workspace-write authorization")
    && text.includes("escalation policy is not host executor authorization")
    && text.includes("escalation policy is not sub-agent runtime authorization")
    && text.includes("escalation policy is not tool runtime authorization")
    && text.includes("escalation policy is not external-write authorization")
    && text.includes("escalation policy is not release authorization")
    && text.includes("escalation policy is not secret access authorization")
    && text.includes("Routing engine boundary")
    && text.includes("Recovery control orchestration boundary")
    && text.includes("Runtime control boundary")
    && text.includes("Codex CLI host boundary")
    && text.includes("Public API execution boundary")
    && text.includes("Agent OS local runtime boundary")
    && text.includes("Agent OS MCP server manifest boundary")
    && text.includes("manifest only; no runtime")
    && text.includes("tool manifests are not tool runtime authorization")
    && text.includes("Protocol MCP provider skeleton boundary")
    && text.includes("protocol mapping and disabled provider skeleton only")
    && text.includes("server refs are not live MCP server connections")
    && text.includes("commandRef is not a shell command")
    && text.includes("endpointRef is not a network call")
    && text.includes("invoke remains disabled")
    && text.includes("Protocol A2A remote provider skeleton boundary")
    && text.includes("agent card, task, artifact mapping and disabled remote provider skeleton only")
    && text.includes("endpoint refs are not network calls")
    && text.includes("agent cards are not remote runtime authorization")
    && text.includes("task skeletons are not remote execution authorization")
    && text.includes("artifact URIs are not fetched by the skeleton")
    && text.includes("remote providers remain disabled")
    && text.includes("fake transports are not live network services")
    && text.includes("anonymous remote invocation remains rejected")
    && text.includes("remote-agent provider manifests are not sub-agent runtime authorization")
    && text.includes("Agent OS SDK boundary")
    && text.includes("SDK method calls to local MCP runtime only")
    && text.includes("SDK call options are not capability grants")
    && text.includes("approved mutating tools are not tool runtime authorization")
    && text.includes("local runtime calls are not provider execution authorization")
    && text.includes("real provider execution remains uninvoked")
    && text.includes("Agent OS CLI boundary")
    && text.includes("argv parsing to local MCP runtime only")
    && text.includes("CLI grant flags are not capability grants")
    && text.includes("approve-tool flags are not tool runtime authorization")
    && text.includes("allow-local-mutation is not workspace-write execution")
    && text.includes("preferred provider is not Codex CLI invocation")
    && text.includes("parsed commands are not provider execution authorization")
    && text.includes("sanitized argv must not expose raw secrets")
    && text.includes("the CLI wrapper does not spawn Codex CLI")
    && text.includes("Agent OS app-server wrapper boundary")
    && text.includes("HTTP-like request routing to local MCP runtime only")
    && text.includes("HTTP-like routes are not live network servers")
    && text.includes("request envelopes are not capability grants")
    && text.includes("client-supplied gate fields remain ignored")
    && text.includes("status codes are not host executor receipts")
    && text.includes("approval permit issue and consumption are not provider execution")
    && text.includes("live HTTP servers remain unimplemented")
    && text.includes("network access remains absent")
    && text.includes("real provider execution remains uninvoked")
    && text.includes("Agent OS public surfaces boundary")
    && text.includes("public surface to local MCP runtime only")
    && text.includes("CLI grant and approve-tool flags are not provider, tool runtime, Codex CLI, or sub-agent runtime authorization")
    && text.includes("Preflight boundary")
    && text.includes("pre-execution signal evaluation only")
    && text.includes("preflight ok is not execution authorization")
    && text.includes("missing tool checks are not tool runtime authorization")
    && text.includes("auth availability is not provider execution authorization")
    && text.includes("workspace clean is not workspace-write authorization")
    && text.includes("protected branch checks are not workspace-write execution")
    && text.includes("memory overview is not runtime authorization")
    && text.includes("memory health status is not sub-agent runtime authorization")
    && text.includes("memory warnings are not host executor authorization")
    && text.includes("memory blocking issues are not provider execution authorization")
    && text.includes("Approval permit boundary")
    && text.includes("Approval gate boundary")
    && text.includes("Approval consumption dispatch matrix boundary")
    && text.includes("git-state and artifact matrix gate only")
    && text.includes("matrix audit is not provider execute authorization")
    && text.includes("matrix audit is not real Codex CLI authorization")
    && text.includes("matrix audit is not workspace-write authorization")
    && text.includes("matrix audit is not host executor authorization")
    && text.includes("matrix audit is not sub-agent runtime authorization")
    && text.includes("matrix audit is not tool runtime authorization")
    && text.includes("matrix audit git state is not execution authorization")
    && text.includes("worktree clean is not provider execution authorization")
    && text.includes("Approval consumption dispatch boundary")
    && text.includes("approval consumption dispatch matrix only")
    && text.includes("approval permit consumption is not provider execution authorization")
    && text.includes("host dispatcher precondition is not provider execute authorization")
    && text.includes("Read-only productization boundary")
    && text.includes("local read-only productization acceptance gate only")
    && text.includes("productization is not provider execute authorization")
    && text.includes("productization is not real Codex CLI authorization")
    && text.includes("productization is not workspace-write authorization")
    && text.includes("productization is not local command authorization")
    && text.includes("productization is not host executor authorization")
    && text.includes("productization is not sub-agent runtime authorization")
    && text.includes("productization is not tool runtime authorization")
    && text.includes("productization is not external-write authorization")
    && text.includes("productization is not evidence refresh authorization")
    && text.includes("productization is not release authorization")
    && text.includes("git state is not execution authorization")
    && text.includes("State-sync boundary")
    && text.includes("state consistency observation gate only")
    && text.includes("state-sync is not provider execute authorization")
    && text.includes("state-sync is not real Codex CLI authorization")
    && text.includes("state-sync is not workspace-write authorization")
    && text.includes("state-sync is not local command authorization")
    && text.includes("state-sync is not host executor authorization")
    && text.includes("state-sync is not sub-agent runtime authorization")
    && text.includes("state-sync is not tool runtime authorization")
    && text.includes("state-sync is not external-write authorization")
    && text.includes("state-sync is not evidence refresh authorization")
    && text.includes("state-sync is not push authorization")
    && text.includes("state-sync is not release authorization")
    && text.includes("state-sync git state is not execution authorization")
    && text.includes("state-sync policy v2 is not execution authorization")
    && text.includes("Execution authority lattice")
    && text.includes("narrow_readonly_provider_dispatch_without_boundary_inheritance")
    && text.includes("read-only provider dispatch does not inherit into host executor authorization")
    && text.includes("read-only provider dispatch does not inherit into sub-agent runtime authorization")
    && text.includes("read-only provider dispatch does not inherit into workspace-write authorization")
    && text.includes("read-only provider dispatch does not inherit into release authorization")
    && normalizedText.includes("Codex CLI host does not authorize host executor or sub-agent runtime")
    && normalizedText.includes("sub-agent runtime does not invoke Codex CLI or provider execution")
    && normalizedText.includes("host executor does not execute provider or sub-agent runtime")
    && text.includes("Admission control boundary")
    && text.includes("Delegation policy boundary")
    && text.includes("Execution eligibility boundary")
    && text.includes("Execution observation boundary")
    && text.includes("Governance failure reducer boundary")
    && text.includes("Task graph boundary")
    && text.includes("Scheduler boundary")
    && text.includes("Execution planner boundary")
    && text.includes("Provider registry boundary")
    && text.includes("Controlled provider execution taskbook boundary")
    && text.includes("local-only minimal provider execution taskbook")
    && text.includes("Controlled provider execution taskbook review boundary")
    && text.includes("git-state and artifact review gate only")
    && text.includes("review audit is not provider execute authorization")
    && text.includes("review audit git state is not execution authorization")
    && text.includes("worktree clean is not provider execution authorization")
    && text.includes("Provider execution runner boundary")
    && text.includes("Provider-core execution primitives")
    && text.includes("Desktop agent strategy boundary")
    && text.includes("Desktop decision runner boundary")
    && text.includes("Final host locator boundary")
    && text.includes("Host dispatcher provider boundary")
    && text.includes("Codex desktop bridge boundary")
    && text.includes("Codex desktop live host boundary")
    && text.includes("Codex memory MCP client boundary")
    && text.includes("Codex memory host client boundary")
    && text.includes("Desktop host client boundary")
    && text.includes("may delegate controlled workspace-write provider plans to the host dispatcher")
    && text.includes("workspace-write through `provider.execute`")
    && text.includes("Desktop live adapter dispatch boundary")
    && text.includes("Host client example boundary")
    && text.includes("Target host embedding boundary")
    && text.includes("Runtime operator action executor gate")
    && text.includes("Runtime operator action host executor boundary taskbook")
    && text.includes("Runtime operator action host-client executor review surface")
    && text.includes("Runtime operator action host executor dispatch taskbook")
    && text.includes("Runtime operator action host executor dispatch")
    && text.includes("Agent executor receipt contract")
    && text.includes("Agent-backed recovery executor boundary")
    && text.includes("Agent executor adapter authorization taskbook")
    && text.includes("Agent executor adapter dispatch authorization")
    && text.includes("Agent executor adapter dispatch sandbox dry-run taskbook")
    && text.includes("Agent executor adapter dispatch sandbox dry-run")
    && text.includes("Agent task control dispatch boundary taskbook")
    && text.includes("Agent task control dispatch authorization")
    && text.includes("Agent task control dispatch sandbox dry-run taskbook")
    && text.includes("Sub-agent runtime execution boundary")
    && text.includes("Agent task control dispatch sandbox dry-run")
    && text.includes("npm run governance -- audit execution-boundary-current-surface")
    && text.includes("Codex CLI, provider, sub-agent runtime")
    && text.includes("`execute`, `verify`, and executor budget signals are routing advice, not runtime authorization")
    && text.includes("routing decision and provider grant only")
    && text.includes("routing decisions are not execution authorization")
    && text.includes("hostRoute is not host dispatch authorization")
    && text.includes("providerGrant is not provider execute authorization")
    && text.includes("codex-cli provider ids are not Codex CLI invocation")
    && text.includes("desktop provider ids are not desktop runtime invocation")
    && text.includes("sandboxMode is not workspace-write execution")
    && text.includes("toolAccess is not tool runtime authorization")
    && text.includes("approvalRequired is not approval grant")
    && text.includes("risk scores are not runtime authorization")
    && text.includes("parallelism allowance is not sub-agent runtime authorization")
    && text.includes("schemas, packets, reviews, and explicit injected witnesses only")
    && text.includes("schema statuses are not execution authorization")
    && text.includes("execution plans are not recovery execution authorization")
    && text.includes("execution gates are not runtime authorization")
    && text.includes("host executor reviews are not host dispatch authorization")
    && text.includes("dispatch authorization reviews are not adapter invocation authorization")
    && text.includes("task-control reviews are not sub-agent runtime authorization")
    && text.includes("sandbox witnesses are not production recovery execution")
    && text.includes("receipt statuses are not completion authorization")
    && text.includes("recovery recommendations are not host executor authorization")
    && text.includes("runtime signal and escalation outcome only")
    && text.includes("runtime signals are not execution authorization")
    && text.includes("escalation outcomes are not provider execution authorization")
    && text.includes("upgrade_model is not model runtime invocation")
    && text.includes("open_circuit is not host dispatch authorization")
    && text.includes("failure counts are not recovery execution authorization")
    && text.includes("context pressure is not sub-agent runtime authorization")
    && text.includes("high-risk signals are not Codex CLI authorization")
    && text.includes("remote-agent, tool, and workspace-write primitives are not runtime authorization")
    && text.includes("permits only `codex-cli + read_only + read-only` controlled read-only execution")
    && text.includes("may delegate controlled workspace-write input preparation and dispatch to `governance-internal-controlled-provider-dispatcher`")
    && text.includes("controlled workspace-write requires permit v2, preflight artifact binding, declared operations, exact authorization id, and the local runner")
    && text.includes("explicit Codex CLI host execution surface")
    && text.includes("workspace-write smoke requires explicit allowance and confirmation")
    && text.includes("governance step-back blocks write sandbox before spawn")
    && text.includes("five named governance subpaths only")
    && text.includes("There is no root, SDK, host, support, MCP/A2A")
    && text.includes("local state and provider-plan runtime")
    && text.includes("does not authorize provider execute, Codex CLI")
    && text.includes("permit creation, validation, revocation, and store only")
    && text.includes("valid permits are not provider execution authorization")
    && text.includes("valid permits are not Codex CLI authorization")
    && text.includes("valid permits are not sub-agent runtime authorization")
    && text.includes("shell capability scopes are not shell execution")
    && text.includes("approval permit store persistence is not workspace-write execution")
    && text.includes("approval requirement evaluation only")
    && text.includes("approval not_required status is not execution authorization")
    && text.includes("approval resolution is not provider execution authorization")
    && text.includes("approval resolution is not Codex CLI authorization")
    && text.includes("approval resolution is not sub-agent runtime authorization")
    && text.includes("approval resolution is not host executor authorization")
    && text.includes("protected branch and dirty workspace signals are not workspace-write execution")
    && text.includes("admission status and requirement derivation only")
    && text.includes("accepted status is not execution authorization")
    && text.includes("needs_approval status is not approval grant")
    && text.includes("required approvals are not provider execution authorization")
    && text.includes("required approvals are not Codex CLI authorization")
    && text.includes("required approvals are not sub-agent runtime authorization")
    && text.includes("required approvals are not host executor authorization")
    && text.includes("external capabilities are not external-write execution")
    && text.includes("file write capabilities are not workspace-write execution")
    && text.includes("delegation level, approval requirement, and recovery action filtering only")
    && text.includes("full_delegation is not execution authorization")
    && text.includes("requiresApproval false is not execution authorization")
    && text.includes("approved proposals are not runtime authorization")
    && text.includes("applied proposals are not provider execution authorization")
    && text.includes("filtered recovery actions are not host executor authorization")
    && text.includes("recovery action lists are not recovery execution")
    && text.includes("historical trust is not runtime authorization")
    && text.includes("recorded resumes are not runtime invocation")
    && text.includes("delegation file-store persistence is not workspace-write execution")
    && text.includes("admission/capability/permit decision only")
    && text.includes("eligible status is not execution authorization")
    && text.includes("sanitized task-scoped observation records")
    && text.includes("observation status is not execution authorization")
    && text.includes("observation refs are not replay authorization")
    && text.includes("pure failure-to-governance-state reducer only")
    && text.includes("execution failures are not recovery authorization")
    && text.includes("strategy decisions are not runtime authorization")
    && text.includes("arbitration packets are not recovery execution")
    && text.includes("recovery recommendations are not host executor authorization")
    && text.includes("anomaly records are not runtime invocation")
    && text.includes("evidence refs are not replay authorization")
    && text.includes("risk scores are not provider execution authorization")
    && text.includes("reducer state updates are not workspace-write execution")
    && text.includes("structural task graph state only")
    && text.includes("node statuses are not execution authorization")
    && text.includes("graph completion is not runtime completion")
    && text.includes("dependency edges are not scheduler dispatch")
    && text.includes("conflict edges are not runtime block execution")
    && text.includes("checkpoint nodes are not rollback execution")
    && text.includes("graph deltas are not workspace rollback authorization")
    && text.includes("rollbackToCheckpoint is not host executor authorization")
    && text.includes("branch merges are not git merge or workspace-write")
    && text.includes("task graph file-store persistence is not workspace-write execution")
    && text.includes("queue and execution lease state machine only")
    && text.includes("queued status is not dispatch authorization")
    && text.includes("leased status is not execution authorization")
    && text.includes("active leases are not provider execute authorization")
    && text.includes("worker ids are not host executor or sub-agent identity authorization")
    && text.includes("releaseLease is not runtime completion proof")
    && text.includes("failLease is not recovery execution")
    && text.includes("expired leases are not retry execution")
    && text.includes("exhausted status is not runtime block execution")
    && text.includes("scheduler file-state persistence is not workspace-write execution")
    && text.includes("scheduler file locks are not shell/process execution")
    && text.includes("provider execution plan only")
    && text.includes("planned status is not provider execution authorization")
    && text.includes("catalog selection, attestation, and manifest store only")
    && text.includes("selected providers are not execution authorization")
    && text.includes("provider grant selection is not provider execute authorization")
    && text.includes("routing decision selection is not Codex CLI authorization")
    && text.includes("manifest-store persistence is not workspace-write execution")
    && text.includes("controlled read-only provider execute gate")
    && text.includes("Tool invocation planner boundary")
    && text.includes("tool manifest and invocation plan only")
    && text.includes("planned tool invocation status is not runtime invocation")
    && text.includes("remote.agent.invoke is not sub-agent runtime authorization")
    && text.includes("approval permits are not tool runtime authorization")
    && text.includes("agent assignment and ownership plan only")
    && text.includes("parallel plans are not sub-agent runtime authorization")
    && text.includes("worker assignments are not runtime invocation")
    && text.includes("write mode is not workspace-write execution")
    && text.includes("ownership targets are not workspace-write authorization")
    && text.includes("maxAgents is not sub-agent spawn authorization")
    && text.includes("read-only analyst assignments are not provider execution authorization")
    && text.includes("strategy reasons are not execution gates")
    && text.includes("decision package only")
    && text.includes("ready status, provider selection, provider grants, agent strategy")
    && text.includes("are not runtime authorization")
    && text.includes("source candidate and pre-mapping only")
    && text.includes("ready_for_mapping is not host execution authorization")
    && text.includes("runtime tool invocation is not default-authorized")
    && text.includes("requires a current host object with all runtime and required memory methods before bundle creation")
    && text.includes("explicit MCP HTTP memory transport only")
    && text.includes("MCP HTTP calls are not provider execution")
    && text.includes("MCP HTTP calls are not host executor authorization")
    && text.includes("bearer tokens are not execution authorization")
    && text.includes("explicit injected memory operations only")
    && text.includes("memory operation calls are not host executor authorization")
    && text.includes("recordMemory is not workspace-write execution")
    && text.includes("searchMemory is not sub-agent runtime invocation")
    && text.includes("MCP tool-style adapter is not default host lookup")
    && text.includes("delegates `run` and `resume` to the desktop live adapter")
    && text.includes("simulated desktop primitive envelopes")
    && text.includes("explicit target-host contract and starter only")
    && text.includes("placeholder host methods are not real execution")
    && text.includes("createBundle requires a fully wired explicit host")
    && text.includes("codex-cli routes do not invoke desktop bridge handlers")
    && text.includes("real `resume`, `rollback`, `abort`, or `fork` dispatch remains a separate authorization stop");
}

function entryDocsRecordExecutionAuthorityLattice(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  return entryDocRecordsExecutionAuthorityLattice(input.governanceReadmeText)
    && entryDocRecordsExecutionAuthorityLattice(input.governanceValidationTiersText);
}

function currentStateRecordsExecutionAuthorityLattice(text: string): boolean {
  return entryDocRecordsExecutionAuthorityLattice(text);
}

function entryDocRecordsExecutionAuthorityLattice(text: string): boolean {
  const normalizedText = normalizeDocTextForMarkerSearch(text);

  return normalizedText.includes("narrow_readonly_provider_dispatch_without_boundary_inheritance")
    && normalizedText.includes("read-only provider dispatch does not inherit into host executor authorization")
    && normalizedText.includes("read-only provider dispatch does not inherit into sub-agent runtime authorization")
    && normalizedText.includes("read-only provider dispatch does not inherit into workspace-write authorization")
    && normalizedText.includes("read-only provider dispatch does not inherit into release authorization")
    && normalizedText.includes("Codex CLI host does not authorize host executor or sub-agent runtime")
    && normalizedText.includes("sub-agent runtime does not invoke Codex CLI or provider execution")
    && normalizedText.includes("host executor does not execute provider or sub-agent runtime");
}

function normalizeDocTextForMarkerSearch(text: string): string {
  return text.replace(/\s+/g, " ");
}

function ciWorkflowRunsCurrentSurfaceGate(text: string): boolean {
  return text.includes("pull_request:")
    && text.includes("state-sync:")
    && text.includes("name: State Sync Audit")
    && text.includes("needs: test")
    && text.includes("npm run governance -- audit state-sync")
    && text.includes("execution-boundary:")
    && text.includes("name: Execution Boundary Audit")
    && text.includes("npm run governance -- audit execution-boundary-current-surface")
    && text.includes("needs: [canary, smoke-contract, state-sync, execution-boundary]");
}

function strategyRouterBoundaryConstrained(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const summary = input.strategyRouterReview.summary;

  return input.strategyRouterReview.status === "passed"
    && summary.strategyMode === "advisory_budget_signal_only"
    && summary.executeActionFamilyIsAuthorization === false
    && summary.writeExecutionPredicateIsAuthorization === false
    && summary.executorBudgetIsRuntimeInvocation === false
    && summary.stepBackExecutorBudget === 0
    && summary.simulateExecutorBudget === 0
    && summary.providerRunnerBlocksStrategyStopBeforeHooks === true
    && summary.providerRunnerBlocksSimulateBeforeHooks === true
    && summary.providerRunnerBlocksRecoveryPhaseBeforeHooks === true
    && summary.codexCliInvocationAllowedByStrategyRouter === false
    && summary.providerInvocationAllowedByStrategyRouter === false
    && summary.subAgentRuntimeInvocationAllowed === false
    && summary.hostExecutorInvocationAllowed === false
    && summary.strategyRouterCallsDuringAudit === 0
    && summary.providerPlanExecutionCallsDuringAudit === 0
    && summary.providerValidateExecutionPlanCallsDuringAudit === 0
    && summary.providerExecuteCallsDuringAudit === 0
    && summary.codexCliCallsDuringAudit === 0
    && summary.subAgentRuntimeCallsDuringAudit === 0
    && summary.hostExecutorCallsDuringAudit === 0
    && summary.shellProcessCallsDuringAudit === 0
    && summary.workspaceWriteCallsDuringAudit === 0
    && summary.externalWriteCallsDuringAudit === 0;
}

function routingEngineBoundaryConstrained(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const summary = input.routingEngineReview.summary;

  return input.routingEngineReview.status === "passed"
    && summary.routingEngineMode === "routing_decision_and_provider_grant_only"
    && summary.routingDecisionIsExecutionAuthorization === false
    && summary.hostRouteIsHostDispatchAuthorization === false
    && summary.providerGrantIsProviderExecuteAuthorization === false
    && summary.codexCliProviderIdIsCodexCliInvocation === false
    && summary.desktopProviderIdIsDesktopRuntimeInvocation === false
    && summary.sandboxModeIsWorkspaceWriteExecution === false
    && summary.toolAccessIsToolRuntimeAuthorization === false
    && summary.approvalRequiredIsApprovalGrant === false
    && summary.riskScoreIsRuntimeAuthorization === false
    && summary.parallelismAllowedIsSubAgentRuntimeAuthorization === false
    && summary.routingEngineCallsDuringAudit === 0
    && summary.providerGrantCreationsDuringAudit === 0
    && summary.providerExecuteCallsDuringAudit === 0
    && summary.codexCliCallsDuringAudit === 0
    && summary.desktopRuntimeCallsDuringAudit === 0
    && summary.subAgentRuntimeCallsDuringAudit === 0
    && summary.hostExecutorCallsDuringAudit === 0
    && summary.hostDispatchCallsDuringAudit === 0
    && summary.toolRuntimeCallsDuringAudit === 0
    && summary.shellProcessCallsDuringAudit === 0
    && summary.workspaceWriteCallsDuringAudit === 0
    && summary.externalWriteCallsDuringAudit === 0;
}

function recoveryControlBoundaryConstrained(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const summary = input.recoveryControlReview.summary;

  return input.recoveryControlReview.status === "passed"
    && summary.recoveryControlMode ===
      "schemas_packets_reviews_and_explicit_injected_witnesses_only"
    && summary.schemaStatusIsExecutionAuthorization === false
    && summary.executionPlanIsRecoveryExecutionAuthorization === false
    && summary.executionGateIsRuntimeAuthorization === false
    && summary.hostExecutorReviewIsHostDispatchAuthorization === false
    && summary.dispatchAuthorizationReviewIsAdapterInvocationAuthorization === false
    && summary.taskControlReviewIsSubAgentRuntimeAuthorization === false
    && summary.sandboxWitnessIsProductionRecoveryExecution === false
    && summary.receiptStatusIsCompletionAuthorization === false
    && summary.recoveryRecommendationIsHostExecutorAuthorization === false
    && summary.recoveryControlCallsDuringAudit === 0
    && summary.hostExecutorInvocationsDuringAudit === 0
    && summary.adapterInvocationsDuringAudit === 0
    && summary.codexCliCallsDuringAudit === 0
    && summary.providerExecuteCallsDuringAudit === 0
    && summary.subAgentRuntimeCallsDuringAudit === 0
    && summary.shellProcessCallsDuringAudit === 0
    && summary.workspaceWriteCallsDuringAudit === 0
    && summary.externalWriteCallsDuringAudit === 0;
}

function runtimeControlBoundaryConstrained(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const summary = input.runtimeControlReview.summary;

  return input.runtimeControlReview.status === "passed"
    && summary.runtimeControlMode === "runtime_signal_and_escalation_outcome_only"
    && summary.runtimeSignalIsExecutionAuthorization === false
    && summary.escalationOutcomeIsProviderExecutionAuthorization === false
    && summary.upgradeModelIsModelRuntimeInvocation === false
    && summary.openCircuitIsHostDispatchAuthorization === false
    && summary.failureCountIsRecoveryExecutionAuthorization === false
    && summary.contextPressureIsSubAgentRuntimeAuthorization === false
    && summary.highRiskSignalIsCodexCliAuthorization === false
    && summary.runtimeControlCallsDuringAudit === 0
    && summary.providerExecuteCallsDuringAudit === 0
    && summary.codexCliCallsDuringAudit === 0
    && summary.subAgentRuntimeCallsDuringAudit === 0
    && summary.hostExecutorCallsDuringAudit === 0
    && summary.hostDispatchCallsDuringAudit === 0
    && summary.modelRuntimeCallsDuringAudit === 0
    && summary.shellProcessCallsDuringAudit === 0
    && summary.workspaceWriteCallsDuringAudit === 0
    && summary.externalWriteCallsDuringAudit === 0;
}

function operatorActionExecutorGateBoundaryConstrained(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const summary = input.operatorActionExecutorGateReview.summary;

  return input.operatorActionExecutorGateReview.status === "passed"
    && summary.gateMode === "plan_only"
    && summary.gateStatusWhenAllowed === "planned"
    && summary.executionAuthorizedByGate === false
    && summary.hostExecutorInvocationAllowed === false
    && summary.recoveryActionExecutionAllowed === false
    && summary.codexCliInvocationAllowed === false
    && summary.providerExecutionAllowed === false
    && summary.subAgentRuntimeInvocationAllowed === false
    && summary.shellProcessAllowed === false
    && summary.workspaceWriteAllowed === false
    && summary.externalWriteAllowed === false
    && summary.hostExecutorInvocationsDuringAudit === 0
    && summary.recoveryActionExecutionsDuringAudit === 0
    && summary.codexCliCallsDuringAudit === 0
    && summary.providerExecuteCallsDuringAudit === 0
    && summary.subAgentRuntimeCallsDuringAudit === 0
    && summary.shellProcessCallsDuringAudit === 0
    && summary.workspaceWriteCallsDuringAudit === 0
    && summary.externalWriteCallsDuringAudit === 0;
}

function codexCliHostBoundaryConstrained(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const summary = input.codexCliHostReview.summary;

  return input.codexCliHostReview.status === "passed"
    && summary.hostMode === "explicit_codex_cli_host_execution_surface"
    && summary.readOnlySmokeSandbox === "read-only"
    && summary.readOnlySmokeApprovalPolicy === "never"
    && summary.workspaceWriteRequiresExplicitAllowance === true
    && summary.workspaceWriteRequiresConfirmation === true
    && summary.workspaceWriteRequiresCleanWorktree === true
    && summary.workspaceWriteRequiresRollbackBinding === true
    && summary.governanceStepBackBlocksWriteSandbox === true
    && summary.defaultRealCodexCliAllowedByBoundaryAudit === false
    && summary.shellFallbackAllowed === false
    && summary.subAgentRuntimeInvocationAllowed === false
    && summary.hostExecutorInvocationAllowed === false
    && summary.providerExecutionAllowedByHostBoundary === false
    && summary.codexCliProcessSpawnsDuringAudit === 0
    && summary.evidenceWritesDuringAudit === 0
    && summary.workspaceWriteCallsDuringAudit === 0
    && summary.externalWriteCallsDuringAudit === 0;
}

function publicApiBoundaryConstrained(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const summary = input.publicApiReview.summary;

  return input.publicApiReview.status === "passed"
    && summary.publicApiMode === "named_governance_subpaths_only"
    && summary.hostFacadeMode === "internal_not_exported"
    && summary.providerFacadeMode === "manifest_capability_security_spi_only"
    && summary.protocolFacadeMode === "kernel_governance_contracts_only"
    && summary.governedRollbackExportAllowed === true
    && summary.internalGovernanceTopLevelExportsAllowed === false
    && summary.directHostExecutorDispatchExportAllowed === false
    && summary.providerExecuteExportAllowed === false
    && summary.codexCliHostRunExportAllowed === false
    && summary.subAgentRuntimeExportAllowed === false
    && summary.workspaceWriteGuardExportAllowed === false
    && summary.publicApiCallsDuringAudit === 0
    && summary.hostExecutorInvocationsDuringAudit === 0
    && summary.providerExecuteCallsDuringAudit === 0
    && summary.codexCliCallsDuringAudit === 0
    && summary.subAgentRuntimeCallsDuringAudit === 0
    && summary.workspaceWriteCallsDuringAudit === 0
    && summary.externalWriteCallsDuringAudit === 0;
}

function agentOsLocalRuntimeBoundaryConstrained(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const summary = input.agentOsLocalRuntimeReview.summary;

  return input.agentOsLocalRuntimeReview.status === "passed"
    && summary.runtimeMode === "local_state_and_provider_plan_runtime"
    && summary.liveMcpServerConnectionAllowed === false
    && summary.liveHttpServerStartedAllowed === false
    && summary.networkAccessAllowed === false
    && summary.providerPlanCanBeStored === true
    && summary.realProviderExecutionAllowed === false
    && summary.codexCliInvocationAllowed === false
    && summary.subAgentRuntimeInvocationAllowed === false
    && summary.hostExecutorInvocationAllowed === false
    && summary.controlledWorkspaceWriteDispatchAllowed === true
    && summary.generalWorkspaceWriteExecutionAllowed === false
    && summary.workspaceWriteProviderExecuteAllowed === false
    && summary.localMutationRequiresApprovalAndAllowance === true
    && summary.localRuntimeCallsDuringAudit === 0
    && summary.providerExecuteCallsDuringAudit === 0
    && summary.codexCliCallsDuringAudit === 0
    && summary.subAgentRuntimeCallsDuringAudit === 0
    && summary.hostExecutorCallsDuringAudit === 0
    && summary.workspaceWriteCallsDuringAudit === 0
    && summary.externalWriteCallsDuringAudit === 0;
}

function agentOsMcpServerManifestBoundaryConstrained(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const summary = input.agentOsMcpServerManifestReview.summary;

  return input.agentOsMcpServerManifestReview.status === "passed"
    && summary.agentOsMcpServerManifestMode === "manifest_only_no_runtime"
    && summary.runtimeImplementedMeansLiveServer === false
    && summary.toolManifestIsToolRuntimeAuthorization === false
    && summary.requiredCapabilityIsCapabilityGrant === false
    && summary.approvalRequiredIsApprovalGrant === false
    && summary.localWriteSideEffectIsWorkspaceWriteExecution === false
    && summary.providerPlanningOutputIsProviderExecutionAuthorization === false
    && summary.approvalPermitOutputIsProviderExecutionAuthorization === false
    && summary.listedToolIsMcpToolInvocation === false
    && summary.manifestExportIsPublicExecutionSurface === false
    && summary.agentOsMcpServerManifestCallsDuringAudit === 0
    && summary.liveMcpServerStartsDuringAudit === 0
    && summary.localRuntimeCallsDuringAudit === 0
    && summary.toolRuntimeCallsDuringAudit === 0
    && summary.providerExecuteCallsDuringAudit === 0
    && summary.codexCliCallsDuringAudit === 0
    && summary.desktopPrimitiveCallsDuringAudit === 0
    && summary.subAgentRuntimeCallsDuringAudit === 0
    && summary.hostExecutorCallsDuringAudit === 0
    && summary.hostDispatchCallsDuringAudit === 0
    && summary.shellProcessCallsDuringAudit === 0
    && summary.networkCallsDuringAudit === 0
    && summary.workspaceWriteCallsDuringAudit === 0
    && summary.externalWriteCallsDuringAudit === 0;
}

function protocolMcpProviderSkeletonBoundaryConstrained(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const summary = input.protocolMcpProviderSkeletonReview.summary;

  return input.protocolMcpProviderSkeletonReview.status === "passed"
    && summary.protocolMcpProviderSkeletonMode ===
      "protocol_mapping_and_disabled_provider_skeleton_only"
    && summary.serverRefIsLiveServerConnection === false
    && summary.commandRefIsShellCommand === false
    && summary.endpointRefIsNetworkCall === false
    && summary.toolManifestIsToolRuntimeAuthorization === false
    && summary.invocationPlanIsToolExecutionAuthorization === false
    && summary.fakeProviderIsLiveMcpServer === false
    && summary.invokeMethodIsEnabled === false
    && summary.unknownSideEffectIsAutoApproved === false
    && summary.allowedToolIsMcpInvocationAuthorization === false
    && summary.protocolMcpCallsDuringAudit === 0
    && summary.liveMcpServerConnectionsDuringAudit === 0
    && summary.toolRuntimeCallsDuringAudit === 0
    && summary.providerExecuteCallsDuringAudit === 0
    && summary.codexCliCallsDuringAudit === 0
    && summary.desktopPrimitiveCallsDuringAudit === 0
    && summary.subAgentRuntimeCallsDuringAudit === 0
    && summary.hostExecutorCallsDuringAudit === 0
    && summary.hostDispatchCallsDuringAudit === 0
    && summary.shellProcessCallsDuringAudit === 0
    && summary.networkCallsDuringAudit === 0
    && summary.workspaceWriteCallsDuringAudit === 0
    && summary.externalWriteCallsDuringAudit === 0;
}

function protocolA2aRemoteProviderSkeletonBoundaryConstrained(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const summary = input.protocolA2aRemoteProviderSkeletonReview.summary;

  return input.protocolA2aRemoteProviderSkeletonReview.status === "passed"
    && summary.protocolA2aRemoteProviderSkeletonMode ===
      "agent_card_task_artifact_mapping_and_disabled_remote_provider_skeleton_only"
    && summary.endpointRefIsNetworkCall === false
    && summary.agentCardIsRemoteRuntimeAuthorization === false
    && summary.taskSkeletonIsRemoteExecutionAuthorization === false
    && summary.artifactUriIsFetchedBySkeleton === false
    && summary.remoteProviderIsEnabled === false
    && summary.remoteProviderCreatesRemoteTasks === false
    && summary.fakeTransportIsLiveNetworkService === false
    && summary.fakeTransportSubmissionIsRuntimeAuthorization === false
    && summary.anonymousRemoteInvocationAllowed === false
    && summary.authSchemeIsCapabilityGrant === false
    && summary.remoteAgentProviderManifestIsSubAgentRuntimeAuthorization === false
    && summary.protocolA2aCallsDuringAudit === 0
    && summary.liveNetworkServiceStartsDuringAudit === 0
    && summary.remoteAgentRuntimeCallsDuringAudit === 0
    && summary.remoteTaskCreationsDuringAudit === 0
    && summary.providerExecuteCallsDuringAudit === 0
    && summary.codexCliCallsDuringAudit === 0
    && summary.desktopPrimitiveCallsDuringAudit === 0
    && summary.subAgentRuntimeCallsDuringAudit === 0
    && summary.hostExecutorCallsDuringAudit === 0
    && summary.hostDispatchCallsDuringAudit === 0
    && summary.shellProcessCallsDuringAudit === 0
    && summary.networkCallsDuringAudit === 0
    && summary.workspaceWriteCallsDuringAudit === 0
    && summary.externalWriteCallsDuringAudit === 0;
}

function agentOsCliBoundaryConstrained(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const summary = input.agentOsCliReview.summary;

  return input.agentOsCliReview.status === "passed"
    && summary.agentOsCliMode === "argv_parsing_to_local_mcp_runtime_only"
    && summary.cliGrantFlagIsCapabilityGrant === false
    && summary.cliApproveToolFlagIsToolRuntimeAuthorization === false
    && summary.cliAllowLocalMutationIsWorkspaceWriteExecution === false
    && summary.preferredProviderIsCodexCliInvocation === false
    && summary.parsedCommandIsProviderExecutionAuthorization === false
    && summary.localRuntimeCallIsProviderExecutionAuthorization === false
    && summary.approvalPermitIssueIsProviderExecutionAuthorization === false
    && summary.approvalPermitConsumptionIsProviderExecutionAuthorization === false
    && summary.sanitizedArgvContainsRawSecrets === false
    && summary.cliWrapperCallsDuringAudit === 0
    && summary.localRuntimeCallsDuringAudit === 0
    && summary.providerExecuteCallsDuringAudit === 0
    && summary.codexCliCallsDuringAudit === 0
    && summary.desktopPrimitiveCallsDuringAudit === 0
    && summary.subAgentRuntimeCallsDuringAudit === 0
    && summary.hostExecutorCallsDuringAudit === 0
    && summary.hostDispatchCallsDuringAudit === 0
    && summary.shellProcessCallsDuringAudit === 0
    && summary.networkCallsDuringAudit === 0
    && summary.workspaceWriteCallsDuringAudit === 0
    && summary.externalWriteCallsDuringAudit === 0;
}

function agentOsSdkBoundaryConstrained(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const summary = input.agentOsSdkReview.summary;

  return input.agentOsSdkReview.status === "passed"
    && summary.agentOsSdkMode === "sdk_method_to_local_mcp_runtime_only"
    && summary.sdkCallIsProviderExecutionAuthorization === false
    && summary.sdkGrantInputIsCapabilityGrant === false
    && summary.sdkApproveToolInputIsToolRuntimeAuthorization === false
    && summary.sdkAllowLocalMutationIsWorkspaceWriteExecution === false
    && summary.preferredProviderIsCodexCliInvocation === false
    && summary.localRuntimeCallIsProviderExecutionAuthorization === false
    && summary.approvalPermitIssueIsProviderExecutionAuthorization === false
    && summary.approvalPermitConsumptionIsProviderExecutionAuthorization === false
    && summary.realProviderExecutionInvoked === false
    && summary.sdkCallsDuringAudit === 0
    && summary.localRuntimeCallsDuringAudit === 0
    && summary.providerExecuteCallsDuringAudit === 0
    && summary.codexCliCallsDuringAudit === 0
    && summary.desktopPrimitiveCallsDuringAudit === 0
    && summary.subAgentRuntimeCallsDuringAudit === 0
    && summary.hostExecutorCallsDuringAudit === 0
    && summary.hostDispatchCallsDuringAudit === 0
    && summary.shellProcessCallsDuringAudit === 0
    && summary.networkCallsDuringAudit === 0
    && summary.workspaceWriteCallsDuringAudit === 0
    && summary.externalWriteCallsDuringAudit === 0;
}

function agentOsAppServerBoundaryConstrained(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const summary = input.agentOsAppServerReview.summary;

  return input.agentOsAppServerReview.status === "passed"
    && summary.agentOsAppServerMode ===
      "http_like_request_routing_to_local_mcp_runtime_only"
    && summary.requestEnvelopeIsCapabilityGrant === false
    && summary.routeIsLiveNetworkServer === false
    && summary.statusCodeIsHostExecutorReceipt === false
    && summary.clientGateFieldsAreTrusted === false
    && summary.serverSideOptionsAreClientControlled === false
    && summary.localRuntimeCallIsProviderExecutionAuthorization === false
    && summary.approvalPermitIssueIsProviderExecutionAuthorization === false
    && summary.approvalPermitConsumptionIsProviderExecutionAuthorization === false
    && summary.liveHttpServerStarted === false
    && summary.networkAccessed === false
    && summary.realProviderExecutionInvoked === false
    && summary.appServerWrapperCallsDuringAudit === 0
    && summary.localRuntimeCallsDuringAudit === 0
    && summary.liveHttpServerStartsDuringAudit === 0
    && summary.networkCallsDuringAudit === 0
    && summary.providerExecuteCallsDuringAudit === 0
    && summary.codexCliCallsDuringAudit === 0
    && summary.desktopPrimitiveCallsDuringAudit === 0
    && summary.subAgentRuntimeCallsDuringAudit === 0
    && summary.hostExecutorCallsDuringAudit === 0
    && summary.hostDispatchCallsDuringAudit === 0
    && summary.shellProcessCallsDuringAudit === 0
    && summary.workspaceWriteCallsDuringAudit === 0
    && summary.externalWriteCallsDuringAudit === 0;
}

function agentOsPublicSurfacesBoundaryConstrained(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const summary = input.agentOsPublicSurfacesReview.summary;

  return input.agentOsPublicSurfacesReview.status === "passed"
    && summary.agentOsPublicSurfacesMode === "public_surface_to_local_mcp_runtime_only"
    && summary.sdkCallIsProviderExecutionAuthorization === false
    && summary.cliGrantFlagIsProviderExecutionAuthorization === false
    && summary.cliApproveToolFlagIsToolRuntimeAuthorization === false
    && summary.cliAllowLocalMutationIsWorkspaceWriteExecution === false
    && summary.preferredProviderIsCodexCliInvocation === false
    && summary.appServerRequestEnvelopeIsCapabilityGrant === false
    && summary.appServerRouteIsNetworkServer === false
    && summary.appServerStatusCodeIsExecutionReceipt === false
    && summary.approvalPermitIssueIsProviderExecutionAuthorization === false
    && summary.agentOsPublicSurfaceCallsDuringAudit === 0
    && summary.localRuntimeCallsDuringAudit === 0
    && summary.providerExecuteCallsDuringAudit === 0
    && summary.codexCliCallsDuringAudit === 0
    && summary.desktopPrimitiveCallsDuringAudit === 0
    && summary.subAgentRuntimeCallsDuringAudit === 0
    && summary.hostExecutorCallsDuringAudit === 0
    && summary.hostDispatchCallsDuringAudit === 0
    && summary.shellProcessCallsDuringAudit === 0
    && summary.networkCallsDuringAudit === 0
    && summary.workspaceWriteCallsDuringAudit === 0
    && summary.externalWriteCallsDuringAudit === 0;
}

function codexProviderBoundaryConstrained(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const summary = input.codexProviderReview.summary;

  return input.codexProviderReview.status === "passed"
    && summary.providerId === "codex-cli"
    && summary.permittedMode === "controlled-read-only"
    && summary.permittedSideEffectClass === "read_only"
    && summary.permittedSandbox === "read-only"
    && summary.permittedApprovalPolicy === "never"
    && summary.defaultRealCodexCliAllowed === false
    && summary.generalProviderExecutionAllowed === false
    && summary.workspaceWriteAllowedByThisBoundary === false;
}

function preflightBoundaryConstrained(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const summary = input.preflightReview.summary;

  return input.preflightReview.status === "passed"
    && summary.preflightMode === "pre_execution_signal_evaluation_only"
    && summary.preflightOkIsExecutionAuthorization === false
    && summary.missingToolCheckIsToolRuntimeAuthorization === false
    && summary.authAvailableIsProviderExecutionAuthorization === false
    && summary.workspaceCleanIsWorkspaceWriteAuthorization === false
    && summary.protectedBranchCheckIsWorkspaceWriteExecution === false
    && summary.memoryOverviewIsRuntimeAuthorization === false
    && summary.memoryHealthStatusIsSubAgentRuntimeAuthorization === false
    && summary.memoryWarningIsHostExecutorAuthorization === false
    && summary.memoryBlockingIssueIsProviderExecutionAuthorization === false
    && summary.preflightCallsDuringAudit === 0
    && summary.providerExecuteCallsDuringAudit === 0
    && summary.codexCliCallsDuringAudit === 0
    && summary.desktopPrimitiveCallsDuringAudit === 0
    && summary.subAgentRuntimeCallsDuringAudit === 0
    && summary.hostExecutorCallsDuringAudit === 0
    && summary.hostDispatchCallsDuringAudit === 0
    && summary.toolRuntimeCallsDuringAudit === 0
    && summary.shellProcessCallsDuringAudit === 0
    && summary.networkCallsDuringAudit === 0
    && summary.workspaceWriteCallsDuringAudit === 0
    && summary.externalWriteCallsDuringAudit === 0;
}

function approvalPermitBoundaryConstrained(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const summary = input.approvalPermitReview.summary;

  return input.approvalPermitReview.status === "passed"
    && summary.approvalPermitMode === "permit_creation_validation_revocation_and_store_only"
    && summary.validPermitIsProviderExecutionAuthorization === false
    && summary.validPermitIsCodexCliAuthorization === false
    && summary.validPermitIsSubAgentRuntimeAuthorization === false
    && summary.validPermitIsHostExecutorAuthorization === false
    && summary.validPermitIsToolRuntimeAuthorization === false
    && summary.shellCapabilityScopeIsShellExecution === false
    && summary.externalCapabilityScopeIsExternalWriteExecution === false
    && summary.storePersistenceIsWorkspaceWriteExecution === false
    && summary.approvalPermitCallsDuringAudit === 0
    && summary.permitValidationCallsDuringAudit === 0
    && summary.providerExecuteCallsDuringAudit === 0
    && summary.codexCliCallsDuringAudit === 0
    && summary.subAgentRuntimeCallsDuringAudit === 0
    && summary.hostExecutorCallsDuringAudit === 0
    && summary.toolRuntimeCallsDuringAudit === 0
    && summary.shellProcessCallsDuringAudit === 0
    && summary.workspaceWriteCallsDuringAudit === 0
    && summary.externalWriteCallsDuringAudit === 0;
}

function approvalGateBoundaryConstrained(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const summary = input.approvalGateReview.summary;

  return input.approvalGateReview.status === "passed"
    && summary.approvalGateMode === "approval_requirement_evaluation_only"
    && summary.approvalNotRequiredIsExecutionAuthorization === false
    && summary.approvalResolvedIsProviderExecutionAuthorization === false
    && summary.approvalResolvedIsCodexCliAuthorization === false
    && summary.approvalResolvedIsSubAgentRuntimeAuthorization === false
    && summary.approvalResolvedIsHostExecutorAuthorization === false
    && summary.approvalResolvedIsToolRuntimeAuthorization === false
    && summary.pendingGateIsRuntimeInvocation === false
    && summary.protectedBranchSignalIsWorkspaceWriteExecution === false
    && summary.dirtyWorkspaceSignalIsWorkspaceWriteExecution === false
    && summary.protectedKeywordSignalIsExternalWriteExecution === false
    && summary.approvalGateCallsDuringAudit === 0
    && summary.approvalResolutionChecksDuringAudit === 0
    && summary.providerExecuteCallsDuringAudit === 0
    && summary.codexCliCallsDuringAudit === 0
    && summary.subAgentRuntimeCallsDuringAudit === 0
    && summary.hostExecutorCallsDuringAudit === 0
    && summary.toolRuntimeCallsDuringAudit === 0
    && summary.shellProcessCallsDuringAudit === 0
    && summary.workspaceWriteCallsDuringAudit === 0
    && summary.externalWriteCallsDuringAudit === 0;
}

function approvalConsumptionDispatchMatrixBoundaryConstrained(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const summary = input.approvalConsumptionDispatchMatrixReview.summary;

  return input.approvalConsumptionDispatchMatrixReview.status === "passed"
    && summary.matrixBoundaryMode === "git_state_and_artifact_matrix_gate_only"
    && summary.matrixAuditIsProviderExecuteAuthorization === false
    && summary.matrixAuditIsRealCodexCliAuthorization === false
    && summary.matrixAuditIsWorkspaceWriteAuthorization === false
    && summary.matrixAuditIsLocalCommandAuthorization === false
    && summary.matrixAuditIsHostExecutorAuthorization === false
    && summary.matrixAuditIsSubAgentRuntimeAuthorization === false
    && summary.matrixAuditIsToolRuntimeAuthorization === false
    && summary.matrixAuditIsExternalWriteAuthorization === false
    && summary.matrixAuditIsReleaseAuthorization === false
    && summary.matrixAuditGitStateIsExecutionAuthorization === false
    && summary.matrixAuditWorktreeCleanIsProviderExecutionAuthorization === false
    && summary.providerExecuteCallsDuringBoundaryAudit === 0
    && summary.codexCliCallsDuringBoundaryAudit === 0
    && summary.workspaceWriteCallsDuringBoundaryAudit === 0
    && summary.hostExecutorCallsDuringBoundaryAudit === 0
    && summary.subAgentRuntimeCallsDuringBoundaryAudit === 0
    && summary.toolRuntimeCallsDuringBoundaryAudit === 0
    && summary.shellProcessCallsDuringBoundaryAudit === 0
    && summary.externalWriteCallsDuringBoundaryAudit === 0;
}

function approvalConsumptionDispatchBoundaryConstrained(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const summary = input.approvalConsumptionDispatchReview.summary;

  return input.approvalConsumptionDispatchReview.status === "passed"
    && summary.approvalConsumptionDispatchMode === "approval_consumption_dispatch_matrix_only"
    && summary.matrixIsProviderExecuteAuthorization === false
    && summary.matrixIsRealCodexCliAuthorization === false
    && summary.matrixIsWorkspaceWriteAuthorization === false
    && summary.matrixIsLocalCommandAuthorization === false
    && summary.matrixIsHostExecutorAuthorization === false
    && summary.matrixIsSubAgentRuntimeAuthorization === false
    && summary.matrixIsExternalWriteAuthorization === false
    && summary.matrixIsReleaseAuthorization === false
    && summary.approvalPermitConsumptionIsProviderExecutionAuthorization === false
    && summary.hostDispatcherPreconditionIsProviderExecuteAuthorization === false
    && summary.redactionCoverageIsRuntimeAuthorization === false
    && summary.providerExecuteCallsDuringAudit === 0
    && summary.codexCliCallsDuringAudit === 0
    && summary.workspaceWriteCallsDuringAudit === 0
    && summary.hostExecutorCallsDuringAudit === 0
    && summary.subAgentRuntimeCallsDuringAudit === 0
    && summary.shellProcessCallsDuringAudit === 0
    && summary.externalWriteCallsDuringAudit === 0;
}

function readonlyProductizationBoundaryConstrained(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const summary = input.readonlyProductizationReview.summary;

  return input.readonlyProductizationReview.status === "passed"
    && summary.readonlyProductizationBoundaryMode
      === "local_readonly_productization_acceptance_gate_only"
    && summary.readonlyProductizationIsProviderExecuteAuthorization === false
    && summary.readonlyProductizationIsRealCodexCliAuthorization === false
    && summary.readonlyProductizationIsWorkspaceWriteAuthorization === false
    && summary.readonlyProductizationIsLocalCommandAuthorization === false
    && summary.readonlyProductizationIsHostExecutorAuthorization === false
    && summary.readonlyProductizationIsSubAgentRuntimeAuthorization === false
    && summary.readonlyProductizationIsToolRuntimeAuthorization === false
    && summary.readonlyProductizationIsExternalWriteAuthorization === false
    && summary.readonlyProductizationIsEvidenceRefreshAuthorization === false
    && summary.readonlyProductizationIsReleaseAuthorization === false
    && summary.readonlyProductizationGitStateIsExecutionAuthorization === false
    && summary.readonlyProductizationWorktreeCleanIsProviderExecutionAuthorization === false
    && summary.providerExecuteCallsDuringBoundaryAudit === 0
    && summary.codexCliCallsDuringBoundaryAudit === 0
    && summary.workspaceWriteCallsDuringBoundaryAudit === 0
    && summary.hostExecutorCallsDuringBoundaryAudit === 0
    && summary.subAgentRuntimeCallsDuringBoundaryAudit === 0
    && summary.toolRuntimeCallsDuringBoundaryAudit === 0
    && summary.shellProcessCallsDuringBoundaryAudit === 0
    && summary.externalWriteCallsDuringBoundaryAudit === 0
    && summary.evidenceWritesDuringBoundaryAudit === 0;
}

function stateSyncBoundaryConstrained(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const summary = input.stateSyncReview.summary;

  return input.stateSyncReview.status === "passed"
    && summary.stateSyncBoundaryMode === "state_consistency_observation_gate_only"
    && summary.stateSyncIsProviderExecuteAuthorization === false
    && summary.stateSyncIsRealCodexCliAuthorization === false
    && summary.stateSyncIsWorkspaceWriteAuthorization === false
    && summary.stateSyncIsLocalCommandAuthorization === false
    && summary.stateSyncIsHostExecutorAuthorization === false
    && summary.stateSyncIsSubAgentRuntimeAuthorization === false
    && summary.stateSyncIsToolRuntimeAuthorization === false
    && summary.stateSyncIsExternalWriteAuthorization === false
    && summary.stateSyncIsEvidenceRefreshAuthorization === false
    && summary.stateSyncIsPushAuthorization === false
    && summary.stateSyncIsReleaseAuthorization === false
    && summary.stateSyncGitStateIsExecutionAuthorization === false
    && summary.stateSyncCleanWorktreeIsProviderExecutionAuthorization === false
    && summary.stateSyncPolicyV2IsExecutionAuthorization === false
    && summary.providerExecuteCallsDuringBoundaryAudit === 0
    && summary.codexCliCallsDuringBoundaryAudit === 0
    && summary.workspaceWriteCallsDuringBoundaryAudit === 0
    && summary.localCommandCallsDuringBoundaryAudit === 0
    && summary.hostExecutorCallsDuringBoundaryAudit === 0
    && summary.subAgentRuntimeCallsDuringBoundaryAudit === 0
    && summary.toolRuntimeCallsDuringBoundaryAudit === 0
    && summary.externalWriteCallsDuringBoundaryAudit === 0
    && summary.stateWritesDuringBoundaryAudit === 0
    && summary.remoteWritesDuringBoundaryAudit === 0;
}

function workspaceWriteReleaseGateBoundaryConstrained(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const summary = input.workspaceWriteReleaseGateReview.summary;

  return input.workspaceWriteReleaseGateReview.status === "passed"
    && summary.workspaceWriteReleaseGateMode === "promotion_review_gate_only"
    && summary.permitV2Status === "schema_validation_consumption_only"
    && summary.fakeCanaryStatus === "guarded_non_executing_validation_only"
    && summary.realWorkspaceWriteDefault === "blocked"
    && summary.generalWorkspaceWriteDefault === "blocked"
    && summary.workspaceWriteReleaseGateIsWorkspaceWriteAuthorization === false
    && summary.workspaceWriteReleaseGateIsRealCodexCliAuthorization === false
    && summary.workspaceWriteReleaseGateIsProviderExecutionAuthorization === false
    && summary.workspaceWriteReleaseGateIsHostExecutorAuthorization === false
    && summary.workspaceWriteReleaseGateIsSubAgentRuntimeAuthorization === false
    && summary.workspaceWriteReleaseGateIsExternalWriteAuthorization === false
    && summary.workspaceWriteReleaseGateIsPushAuthorization === false
    && summary.workspaceWriteReleaseGateIsReleaseAuthorization === false
    && summary.releaseValidationIncludesFakeCanary === true
    && summary.releaseValidationIncludesEvidenceCollection === true
    && summary.providerExecuteCallsDuringAudit === 0
    && summary.codexCliCallsDuringAudit === 0
    && summary.workspaceWriteCallsDuringAudit === 0
    && summary.hostExecutorCallsDuringAudit === 0
    && summary.subAgentRuntimeCallsDuringAudit === 0
    && summary.externalWriteCallsDuringAudit === 0
    && summary.evidenceWritesDuringAudit === 0;
}

function admissionControlBoundaryConstrained(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const summary = input.admissionControlReview.summary;

  return input.admissionControlReview.status === "passed"
    && summary.admissionControlMode === "admission_status_and_requirement_derivation_only"
    && summary.acceptedStatusIsExecutionAuthorization === false
    && summary.needsApprovalStatusIsApprovalGrant === false
    && summary.rejectedStatusIsRuntimeBlockExecution === false
    && summary.capabilityMatchIsRuntimeInvocation === false
    && summary.requiredApprovalIsProviderExecutionAuthorization === false
    && summary.requiredApprovalIsCodexCliAuthorization === false
    && summary.requiredApprovalIsSubAgentRuntimeAuthorization === false
    && summary.requiredApprovalIsHostExecutorAuthorization === false
    && summary.externalCapabilityIsExternalWriteExecution === false
    && summary.fileWriteCapabilityIsWorkspaceWriteExecution === false
    && summary.admissionControlCallsDuringAudit === 0
    && summary.providerExecuteCallsDuringAudit === 0
    && summary.codexCliCallsDuringAudit === 0
    && summary.subAgentRuntimeCallsDuringAudit === 0
    && summary.hostExecutorCallsDuringAudit === 0
    && summary.toolRuntimeCallsDuringAudit === 0
    && summary.shellProcessCallsDuringAudit === 0
    && summary.workspaceWriteCallsDuringAudit === 0
    && summary.externalWriteCallsDuringAudit === 0;
}

function delegationPolicyBoundaryConstrained(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const summary = input.delegationPolicyReview.summary;

  return input.delegationPolicyReview.status === "passed"
    && summary.delegationPolicyMode === "delegation_level_approval_requirement_and_recovery_filter_only"
    && summary.fullDelegationIsExecutionAuthorization === false
    && summary.requiresApprovalFalseIsExecutionAuthorization === false
    && summary.approvedProposalIsRuntimeAuthorization === false
    && summary.appliedProposalIsProviderExecutionAuthorization === false
    && summary.filteredRecoveryActionIsHostExecutorAuthorization === false
    && summary.recoveryActionListIsRecoveryExecution === false
    && summary.historicalTrustIsRuntimeAuthorization === false
    && summary.recordedResumeIsRuntimeInvocation === false
    && summary.fileStorePersistenceIsWorkspaceWriteExecution === false
    && summary.delegationPolicyCallsDuringAudit === 0
    && summary.proposalLifecycleCallsDuringAudit === 0
    && summary.fileStoreWritesDuringAudit === 0
    && summary.providerExecuteCallsDuringAudit === 0
    && summary.codexCliCallsDuringAudit === 0
    && summary.subAgentRuntimeCallsDuringAudit === 0
    && summary.hostExecutorCallsDuringAudit === 0
    && summary.toolRuntimeCallsDuringAudit === 0
    && summary.shellProcessCallsDuringAudit === 0
    && summary.workspaceWriteCallsDuringAudit === 0
    && summary.externalWriteCallsDuringAudit === 0;
}

function executionEligibilityBoundaryConstrained(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const summary = input.executionEligibilityReview.summary;

  return input.executionEligibilityReview.status === "passed"
    && summary.eligibilityMode === "admission_capability_permit_decision_only"
    && summary.eligibleStatusIsExecutionAuthorization === false
    && summary.validApprovalPermitIsProviderExecutionAuthorization === false
    && summary.capabilityGrantIsRuntimeInvocation === false
    && summary.permitStoreReadIsRuntimeInvocation === false
    && summary.providerPlanCreationAllowed === false
    && summary.providerExecuteAllowed === false
    && summary.codexCliInvocationAllowed === false
    && summary.subAgentRuntimeInvocationAllowed === false
    && summary.hostExecutorInvocationAllowed === false
    && summary.hostDispatchAllowed === false
    && summary.shellProcessAllowed === false
    && summary.workspaceWriteExecutionAllowed === false
    && summary.externalWriteAllowed === false
    && summary.executionEligibilityCallsDuringAudit === 0
    && summary.permitStoreReadsDuringAudit === 0
    && summary.providerPlanCreationCallsDuringAudit === 0
    && summary.providerExecuteCallsDuringAudit === 0
    && summary.codexCliCallsDuringAudit === 0
    && summary.subAgentRuntimeCallsDuringAudit === 0
    && summary.hostExecutorCallsDuringAudit === 0
    && summary.hostDispatchCallsDuringAudit === 0
    && summary.shellProcessCallsDuringAudit === 0
    && summary.workspaceWriteCallsDuringAudit === 0
    && summary.externalWriteCallsDuringAudit === 0;
}

function executionObservationBoundaryConstrained(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const summary = input.executionObservationReview.summary;

  return input.executionObservationReview.status === "passed"
    && summary.observationMode === "sanitized_task_scoped_observation_record_only"
    && summary.observationStatusIsExecutionAuthorization === false
    && summary.succeededObservationIsCompletionAuthorization === false
    && summary.failedObservationIsRecoveryAuthorization === false
    && summary.evidenceRefIsRuntimeInvocation === false
    && summary.observationRefResolutionIsReplayAuthorization === false
    && summary.observationRecordWriteIsWorkspaceWriteExecution === false
    && summary.fileStorePersistenceAllowed === true
    && summary.providerExecuteAllowed === false
    && summary.codexCliInvocationAllowed === false
    && summary.subAgentRuntimeInvocationAllowed === false
    && summary.hostExecutorInvocationAllowed === false
    && summary.hostDispatchAllowed === false
    && summary.shellProcessAllowed === false
    && summary.workspaceWriteExecutionAllowed === false
    && summary.externalWriteAllowed === false
    && summary.observationBusEmitsDuringAudit === 0
    && summary.observationStoreWritesDuringAudit === 0
    && summary.providerExecuteCallsDuringAudit === 0
    && summary.codexCliCallsDuringAudit === 0
    && summary.subAgentRuntimeCallsDuringAudit === 0
    && summary.hostExecutorCallsDuringAudit === 0
    && summary.hostDispatchCallsDuringAudit === 0
    && summary.shellProcessCallsDuringAudit === 0
    && summary.workspaceWriteCallsDuringAudit === 0
    && summary.externalWriteCallsDuringAudit === 0;
}

function governanceFailureReducerBoundaryConstrained(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const summary = input.governanceFailureReducerReview.summary;

  return input.governanceFailureReducerReview.status === "passed"
    && summary.failureReducerMode === "pure_failure_to_governance_state_reducer_only"
    && summary.executionFailureIsRecoveryAuthorization === false
    && summary.strategyDecisionIsRuntimeAuthorization === false
    && summary.arbitrationPacketIsRecoveryExecution === false
    && summary.recoveryRecommendationIsHostExecutorAuthorization === false
    && summary.anomalyRecordIsRuntimeInvocation === false
    && summary.evidenceRefIsReplayAuthorization === false
    && summary.riskScoreIsProviderExecutionAuthorization === false
    && summary.reducerStateUpdateIsWorkspaceWriteExecution === false
    && summary.reducerCallsCallbacksDuringAudit === 0
    && summary.reducerPersistenceWritesDuringAudit === 0
    && summary.providerExecuteCallsDuringAudit === 0
    && summary.codexCliCallsDuringAudit === 0
    && summary.subAgentRuntimeCallsDuringAudit === 0
    && summary.hostExecutorCallsDuringAudit === 0
    && summary.hostDispatchCallsDuringAudit === 0
    && summary.toolRuntimeCallsDuringAudit === 0
    && summary.shellProcessCallsDuringAudit === 0
    && summary.workspaceWriteCallsDuringAudit === 0
    && summary.externalWriteCallsDuringAudit === 0;
}

function taskGraphBoundaryConstrained(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const summary = input.taskGraphReview.summary;

  return input.taskGraphReview.status === "passed"
    && summary.taskGraphMode === "structural_task_graph_state_only"
    && summary.nodeStatusIsExecutionAuthorization === false
    && summary.graphCompletionIsRuntimeCompletion === false
    && summary.dependencyEdgeIsSchedulerDispatch === false
    && summary.conflictEdgeIsRuntimeBlockExecution === false
    && summary.checkpointNodeIsRollbackExecution === false
    && summary.graphDeltaIsWorkspaceRollbackAuthorization === false
    && summary.rollbackToCheckpointIsHostExecutorAuthorization === false
    && summary.branchMergeIsGitMergeOrWorkspaceWrite === false
    && summary.fileStorePersistenceIsWorkspaceWriteExecution === false
    && summary.taskGraphCallsDuringAudit === 0
    && summary.taskGraphStoreWritesDuringAudit === 0
    && summary.providerExecuteCallsDuringAudit === 0
    && summary.codexCliCallsDuringAudit === 0
    && summary.subAgentRuntimeCallsDuringAudit === 0
    && summary.hostExecutorCallsDuringAudit === 0
    && summary.hostDispatchCallsDuringAudit === 0
    && summary.toolRuntimeCallsDuringAudit === 0
    && summary.shellProcessCallsDuringAudit === 0
    && summary.workspaceWriteCallsDuringAudit === 0
    && summary.externalWriteCallsDuringAudit === 0;
}

function schedulerBoundaryConstrained(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const summary = input.schedulerReview.summary;

  return input.schedulerReview.status === "passed"
    && summary.schedulerMode === "queue_and_execution_lease_state_machine_only"
    && summary.queuedStatusIsDispatchAuthorization === false
    && summary.leasedStatusIsExecutionAuthorization === false
    && summary.activeLeaseIsProviderExecuteAuthorization === false
    && summary.workerIdIsHostOrSubAgentAuthorization === false
    && summary.releaseLeaseIsRuntimeCompletionProof === false
    && summary.failLeaseIsRecoveryExecution === false
    && summary.expiredLeaseIsRetryExecution === false
    && summary.exhaustedStatusIsRuntimeBlockExecution === false
    && summary.fileStatePersistenceIsWorkspaceWriteExecution === false
    && summary.fileLockIsShellProcessExecution === false
    && summary.schedulerCallsDuringAudit === 0
    && summary.schedulerLeaseAcquisitionsDuringAudit === 0
    && summary.schedulerStateWritesDuringAudit === 0
    && summary.providerExecuteCallsDuringAudit === 0
    && summary.codexCliCallsDuringAudit === 0
    && summary.subAgentRuntimeCallsDuringAudit === 0
    && summary.hostExecutorCallsDuringAudit === 0
    && summary.hostDispatchCallsDuringAudit === 0
    && summary.toolRuntimeCallsDuringAudit === 0
    && summary.shellProcessCallsDuringAudit === 0
    && summary.workspaceWriteCallsDuringAudit === 0
    && summary.externalWriteCallsDuringAudit === 0;
}

function executionPlannerBoundaryConstrained(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const summary = input.executionPlannerReview.summary;

  return input.executionPlannerReview.status === "passed"
    && summary.plannerMode === "provider_execution_plan_only"
    && summary.plannedStatusIsProviderExecutionAuthorization === false
    && summary.codexCliProviderSelectionIsCodexCliInvocation === false
    && summary.remoteAgentProviderSelectionIsSubAgentRuntimeInvocation === false
    && summary.workspaceWriteSideEffectClassIsWorkspaceWriteExecution === false
    && summary.localPlanStoreWritesAllowed === true
    && summary.planStoreWritesLimitedToPlanState === true
    && summary.providerPlanExecutionAllowed === false
    && summary.providerValidateExecutionPlanAllowed === false
    && summary.providerExecuteAllowed === false
    && summary.codexCliInvocationAllowed === false
    && summary.subAgentRuntimeInvocationAllowed === false
    && summary.hostExecutorInvocationAllowed === false
    && summary.hostDispatchAllowed === false
    && summary.shellProcessAllowed === false
    && summary.workspaceWriteExecutionAllowed === false
    && summary.externalWriteAllowed === false
    && summary.executionPlannerCallsDuringAudit === 0
    && summary.localPlanStoreWritesDuringAudit === 0
    && summary.providerPlanExecutionCallsDuringAudit === 0
    && summary.providerValidateExecutionPlanCallsDuringAudit === 0
    && summary.providerExecuteCallsDuringAudit === 0
    && summary.codexCliCallsDuringAudit === 0
    && summary.subAgentRuntimeCallsDuringAudit === 0
    && summary.hostExecutorCallsDuringAudit === 0
    && summary.hostDispatchCallsDuringAudit === 0
    && summary.shellProcessCallsDuringAudit === 0
    && summary.workspaceWriteCallsDuringAudit === 0
    && summary.externalWriteCallsDuringAudit === 0;
}

function providerRegistryBoundaryConstrained(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const summary = input.providerRegistryReview.summary;

  return input.providerRegistryReview.status === "passed"
    && summary.providerRegistryMode === "catalog_selection_attestation_and_manifest_store_only"
    && summary.selectedProviderIsExecutionAuthorization === false
    && summary.providerGrantSelectionIsProviderExecuteAuthorization === false
    && summary.routingDecisionSelectionIsCodexCliAuthorization === false
    && summary.registeredExecutorProviderIsRuntimeInvocation === false
    && summary.registeredToolProviderIsToolRuntimeInvocation === false
    && summary.registeredRemoteAgentProviderIsSubAgentRuntimeAuthorization === false
    && summary.remoteAgentAuthSchemesAreRuntimeAuthorization === false
    && summary.manifestStorePersistenceIsWorkspaceWriteExecution === false
    && summary.providerRegistryCallsDuringAudit === 0
    && summary.providerSelectionCallsDuringAudit === 0
    && summary.providerExecuteCallsDuringAudit === 0
    && summary.codexCliCallsDuringAudit === 0
    && summary.subAgentRuntimeCallsDuringAudit === 0
    && summary.hostExecutorCallsDuringAudit === 0
    && summary.toolRuntimeCallsDuringAudit === 0
    && summary.shellProcessCallsDuringAudit === 0
    && summary.workspaceWriteCallsDuringAudit === 0
    && summary.externalWriteCallsDuringAudit === 0;
}

function controlledProviderExecutionTaskbookBoundaryConstrained(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const summary = input.controlledProviderExecutionTaskbookReview.summary;

  return input.controlledProviderExecutionTaskbookReview.status === "passed"
    && summary.taskbookMode === "local_only_minimal_slice_taskbook"
    && summary.taskbookIsProviderExecuteAuthorization === false
    && summary.taskbookIsRealCodexCliAuthorization === false
    && summary.taskbookIsWorkspaceWriteAuthorization === false
    && summary.taskbookIsLocalCommandAuthorization === false
    && summary.taskbookIsProtectedRemoteAuthorization === false
    && summary.taskbookIsHostExecutorAuthorization === false
    && summary.taskbookIsSubAgentRuntimeAuthorization === false
    && summary.taskbookIsExternalWriteAuthorization === false
    && summary.taskbookIsReleaseAuthorization === false
    && summary.taskbookIsSecretChangeAuthorization === false
    && summary.providerExecuteCallsDuringAudit === 0
    && summary.codexCliCallsDuringAudit === 0
    && summary.workspaceWriteCallsDuringAudit === 0
    && summary.hostExecutorCallsDuringAudit === 0
    && summary.subAgentRuntimeCallsDuringAudit === 0
    && summary.shellProcessCallsDuringAudit === 0
    && summary.externalWriteCallsDuringAudit === 0
    && summary.evidenceWritesDuringAudit === 0;
}

function controlledProviderExecutionTaskbookReviewBoundaryConstrained(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const summary =
    input.controlledProviderExecutionTaskbookReviewBoundaryReview.summary;

  return input.controlledProviderExecutionTaskbookReviewBoundaryReview.status === "passed"
    && summary.reviewBoundaryMode === "git_state_and_artifact_review_gate_only"
    && summary.reviewAuditIsProviderExecuteAuthorization === false
    && summary.reviewAuditIsRealCodexCliAuthorization === false
    && summary.reviewAuditIsWorkspaceWriteAuthorization === false
    && summary.reviewAuditIsLocalCommandAuthorization === false
    && summary.reviewAuditIsHostExecutorAuthorization === false
    && summary.reviewAuditIsSubAgentRuntimeAuthorization === false
    && summary.reviewAuditIsExternalWriteAuthorization === false
    && summary.reviewAuditIsReleaseAuthorization === false
    && summary.reviewAuditGitStateIsExecutionAuthorization === false
    && summary.reviewAuditWorktreeCleanIsProviderExecutionAuthorization === false
    && summary.providerExecuteCallsDuringBoundaryAudit === 0
    && summary.codexCliCallsDuringBoundaryAudit === 0
    && summary.workspaceWriteCallsDuringBoundaryAudit === 0
    && summary.hostExecutorCallsDuringBoundaryAudit === 0
    && summary.subAgentRuntimeCallsDuringBoundaryAudit === 0
    && summary.shellProcessCallsDuringBoundaryAudit === 0
    && summary.externalWriteCallsDuringBoundaryAudit === 0
    && summary.evidenceWritesDuringBoundaryAudit === 0;
}

function controlledProviderExecutionDispatchPreflightBoundaryConstrained(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const summary =
    input.controlledProviderExecutionDispatchPreflightReview.summary;

  return input.controlledProviderExecutionDispatchPreflightReview.status === "passed"
    && summary.dispatchPreflightMode === "controlled_readonly_and_workspace_write_dispatch_preflight_matrix_only"
    && summary.dispatchPreflightIsProviderExecuteAuthorization === false
    && summary.dispatchPreflightIsRealCodexCliAuthorization === false
    && summary.dispatchPreflightIsWorkspaceWriteAuthorization === false
    && summary.dispatchPreflightIsHostExecutorAuthorization === false
    && summary.dispatchPreflightIsSubAgentRuntimeAuthorization === false
    && summary.dispatchPreflightIsShellProcessAuthorization === false
    && summary.dispatchPreflightIsExternalWriteAuthorization === false
    && summary.dispatchPreflightIsReleaseAuthorization === false
    && summary.runnerRemainsFinalProviderExecuteGate === true
    && summary.dryRunDefaultPreserved === true
    && summary.providerExecuteCallsDuringAudit === 0
    && summary.codexCliCallsDuringAudit === 0
    && summary.workspaceWriteCallsDuringAudit === 0
    && summary.hostExecutorCallsDuringAudit === 0
    && summary.subAgentRuntimeCallsDuringAudit === 0
    && summary.shellProcessCallsDuringAudit === 0
    && summary.externalWriteCallsDuringAudit === 0
    && summary.evidenceWritesDuringAudit === 0;
}

function controlledProviderExecutionDispatcherBoundaryConstrained(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const summary = input.controlledProviderExecutionDispatcherReview.summary;

  return input.controlledProviderExecutionDispatcherReview.status === "passed"
    && summary.dispatcherMode === "controlled_readonly_and_workspace_write_pre_runner_dispatcher"
    && summary.consumesDispatchPreflightSchema === true
    && summary.callsRunnerBoundary === true
    && summary.callsProviderExecuteDirectly === false
    && summary.callsRealCodexCliDirectly === false
    && summary.controlledWorkspaceWriteDispatchAllowed === true
    && summary.authorizesGeneralWorkspaceWrite === false
    && summary.workspaceWriteProviderExecuteAllowed === false
    && summary.authorizesHostExecutor === false
    && summary.authorizesSubAgentRuntime === false
    && summary.defaultDryRunPreserved === true
    && summary.providerExecutionPlanHashRequired === true
    && summary.providerRegistrySelectionRequired === true
    && summary.permitValidationRequired === true
    && summary.preflightArtifactBindingRequired === true
    && summary.governanceStrategyStopRequired === true
    && summary.runnerInvocationsDuringAudit === 0
    && summary.providerExecuteCallsDuringAudit === 0
    && summary.realCodexCliCallsDuringAudit === 0
    && summary.workspaceWriteCallsDuringAudit === 0
    && summary.hostExecutorCallsDuringAudit === 0
    && summary.subAgentRuntimeCallsDuringAudit === 0
    && summary.shellProcessCallsDuringAudit === 0
    && summary.externalWriteCallsDuringAudit === 0;
}

function providerExecutionRunnerBoundaryConstrained(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const summary = input.providerExecutionRunnerReview.summary;

  return input.providerExecutionRunnerReview.status === "passed"
    && summary.runnerMode === "controlled_readonly_and_workspace_write_gate"
    && summary.dryRunExecuteInvoked === false
    && summary.controlledReadOnlyExecuteAllowed === true
    && summary.controlledReadOnlyProviderId === "codex-cli"
    && summary.controlledReadOnlySideEffectClass === "read_only"
    && summary.controlledReadOnlySandbox === "read-only"
    && summary.permitRequired === true
    && summary.executorPlanRequired === true
    && summary.preflightArtifactBindingRequired === true
    && summary.realExecutionGuardRequired === true
    && summary.governanceStrategyStopBlocksBeforeProviderHooks === true
    && summary.simulateBlocksBeforeProviderHooks === true
    && summary.recoveryPhaseBlocksBeforeProviderHooks === true
    && summary.nonCodexProviderExecutionAllowed === false
    && summary.workspaceWriteAllowedByRunner === true
    && summary.workspaceWriteProviderExecuteAllowed === false
    && summary.defaultRealCodexCliAllowed === false
    && summary.subAgentRuntimeInvocationAllowed === false
    && summary.hostExecutorInvocationAllowed === false
    && summary.providerRunnerCallsDuringAudit === 0
    && summary.providerPlanExecutionCallsDuringAudit === 0
    && summary.providerValidateExecutionPlanCallsDuringAudit === 0
    && summary.providerExecuteCallsDuringAudit === 0
    && summary.realCodexCliCallsDuringAudit === 0
    && summary.subAgentRuntimeCallsDuringAudit === 0
    && summary.hostExecutorCallsDuringAudit === 0
    && summary.shellProcessCallsDuringAudit === 0
    && summary.workspaceWriteCallsDuringAudit === 0
    && summary.externalWriteCallsDuringAudit === 0;
}

function providerCorePrimitivesBoundaryConstrained(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const summary = input.providerCorePrimitivesReview.summary;

  return input.providerCorePrimitivesReview.status === "passed"
    && summary.providerCorePrimitiveMode === "manifest_permit_plan_only"
    && summary.remoteAgentExecutionAllowed === false
    && summary.toolRuntimeInvocationAllowed === false
    && summary.workspaceWriteExecutionAllowedByProviderCore === false
    && summary.generalProviderExecutionAllowed === false
    && summary.codexCliInvocationAllowed === false
    && summary.subAgentRuntimeInvocationAllowed === false
    && summary.hostExecutorInvocationAllowed === false
    && summary.providerCoreRuntimeCallsDuringAudit === 0
    && summary.remoteAgentRuntimeCallsDuringAudit === 0
    && summary.toolRuntimeCallsDuringAudit === 0
    && summary.workspaceWriteCallsDuringAudit === 0
    && summary.externalWriteCallsDuringAudit === 0;
}

function toolInvocationPlannerBoundaryConstrained(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const summary = input.toolInvocationPlannerReview.summary;

  return input.toolInvocationPlannerReview.status === "passed"
    && summary.toolInvocationPlannerMode === "tool_manifest_and_invocation_plan_only"
    && summary.plannedStatusIsRuntimeInvocation === false
    && summary.remoteAgentToolManifestIsSubAgentRuntimeAuthorization === false
    && summary.externalWriteToolManifestIsExternalWriteAuthorization === false
    && summary.approvalPermitIsToolRuntimeAuthorization === false
    && summary.localWriteToolPlanIsWorkspaceWriteExecution === false
    && summary.inputPreviewStoresRawSecrets === false
    && summary.defaultCodexCliInvocationAllowed === false
    && summary.providerExecuteAllowed === false
    && summary.subAgentRuntimeInvocationAllowed === false
    && summary.hostExecutorInvocationAllowed === false
    && summary.toolRuntimeInvocationAllowed === false
    && summary.shellProcessAllowedByDefault === false
    && summary.workspaceWriteAllowedByDefault === false
    && summary.externalWriteAllowedByDefault === false
    && summary.toolRegistryCallsDuringAudit === 0
    && summary.toolInvocationPlansDuringAudit === 0
    && summary.toolRuntimeCallsDuringAudit === 0
    && summary.providerExecuteCallsDuringAudit === 0
    && summary.codexCliCallsDuringAudit === 0
    && summary.subAgentRuntimeCallsDuringAudit === 0
    && summary.hostExecutorCallsDuringAudit === 0
    && summary.shellProcessCallsDuringAudit === 0
    && summary.workspaceWriteCallsDuringAudit === 0
    && summary.externalWriteCallsDuringAudit === 0;
}

function desktopAgentStrategyBoundaryConstrained(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const summary = input.desktopAgentStrategyReview.summary;

  return input.desktopAgentStrategyReview.status === "passed"
    && summary.desktopAgentStrategyMode === "agent_assignment_and_ownership_plan_only"
    && summary.parallelPlanIsSubAgentRuntimeAuthorization === false
    && summary.workerAssignmentIsRuntimeInvocation === false
    && summary.writeModeIsWorkspaceWriteExecution === false
    && summary.ownershipTargetIsWorkspaceWriteAuthorization === false
    && summary.maxAgentsIsSubAgentSpawnAuthorization === false
    && summary.readOnlyAnalystIsProviderExecutionAuthorization === false
    && summary.strategyReasonIsExecutionGate === false
    && summary.desktopAgentStrategyCallsDuringAudit === 0
    && summary.providerExecuteCallsDuringAudit === 0
    && summary.codexCliCallsDuringAudit === 0
    && summary.desktopPrimitiveCallsDuringAudit === 0
    && summary.subAgentRuntimeCallsDuringAudit === 0
    && summary.hostExecutorCallsDuringAudit === 0
    && summary.hostDispatchCallsDuringAudit === 0
    && summary.shellProcessCallsDuringAudit === 0
    && summary.workspaceWriteCallsDuringAudit === 0
    && summary.externalWriteCallsDuringAudit === 0;
}

function executionProfilesBoundaryConstrained(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const summary = input.executionProfilesReview.summary;

  return input.executionProfilesReview.status === "passed"
    && summary.executionProfilesMode === "profile_templates_only"
    && summary.profileStageIsRuntimeStep === false
    && summary.defaultRoleIsSubAgentRuntimeAuthorization === false
    && summary.defaultToolAccessIsToolRuntimeAuthorization === false
    && summary.engineeringWriteToolAccessIsWorkspaceWriteExecution === false
    && summary.protectedRemoteToolAccessIsExternalWriteAuthorization === false
    && summary.allowParallelIsSubAgentRuntimeAuthorization === false
    && summary.maxParallelAgentsIsSubAgentSpawnAuthorization === false
    && summary.releaseGovernanceProfileIsProtectedRemoteAuthorization === false
    && summary.profileSelectionIsProviderExecutionAuthorization === false
    && summary.executionProfileLookupsDuringAudit === 0
    && summary.providerExecuteCallsDuringAudit === 0
    && summary.codexCliCallsDuringAudit === 0
    && summary.desktopPrimitiveCallsDuringAudit === 0
    && summary.subAgentRuntimeCallsDuringAudit === 0
    && summary.hostExecutorCallsDuringAudit === 0
    && summary.hostDispatchCallsDuringAudit === 0
    && summary.toolRuntimeCallsDuringAudit === 0
    && summary.shellProcessCallsDuringAudit === 0
    && summary.workspaceWriteCallsDuringAudit === 0
    && summary.externalWriteCallsDuringAudit === 0;
}

function policyConfigBoundaryConstrained(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const summary = input.policyConfigReview.summary;

  return input.policyConfigReview.status === "passed"
    && summary.policyConfigMode === "policy_schema_and_signal_resolution_only"
    && summary.hostRouteIsHostDispatchAuthorization === false
    && summary.codexCliHostRouteIsCodexCliInvocation === false
    && summary.desktopHostRouteIsDesktopRuntimeInvocation === false
    && summary.toolPolicyIsToolRuntimeAuthorization === false
    && summary.protectedRemoteToolPolicyIsExternalWriteAuthorization === false
    && summary.approvalRuleIsApprovalGrant === false
    && summary.memoryHealthBlockIsRuntimeBlockExecution === false
    && summary.memoryGuidanceIsSubAgentRuntimeAuthorization === false
    && summary.telemetryThresholdIsRuntimeAuthorization === false
    && summary.telemetryDeliveryWindowIsHostExecutorAuthorization === false
    && summary.policyLoadCallsDuringAudit === 0
    && summary.providerExecuteCallsDuringAudit === 0
    && summary.codexCliCallsDuringAudit === 0
    && summary.desktopPrimitiveCallsDuringAudit === 0
    && summary.subAgentRuntimeCallsDuringAudit === 0
    && summary.hostExecutorCallsDuringAudit === 0
    && summary.hostDispatchCallsDuringAudit === 0
    && summary.toolRuntimeCallsDuringAudit === 0
    && summary.shellProcessCallsDuringAudit === 0
    && summary.workspaceWriteCallsDuringAudit === 0
    && summary.externalWriteCallsDuringAudit === 0;
}

function capabilityTaxonomyBoundaryConstrained(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const summary = input.capabilityTaxonomyReview.summary;

  return input.capabilityTaxonomyReview.status === "passed"
    && summary.capabilityTaxonomyMode
      === "capability_classification_and_escalation_policy_only"
    && summary.boundedWorkspaceWriteCanaryIsWorkspaceWriteAuthorization === false
    && summary.boundedWorkspaceWriteReceiptIsExecutionAuthorization === false
    && summary.scopedWorkspaceWriteClassIsWorkspaceWriteExecution === false
    && summary.generalWorkspaceWriteClassIsExecutionAuthorization === false
    && summary.generalProviderExecutionClassIsProviderExecuteAuthorization === false
    && summary.externalWriteClassIsExternalWriteAuthorization === false
    && summary.releaseOrDeployClassIsReleaseAuthorization === false
    && summary.secretCredentialChangeClassIsSecretAccessAuthorization === false
    && summary.capabilityEscalationPolicyIsRuntimeAuthorization === false
    && summary.canaryEvidenceBaselineIsExecutionAuthorization === false
    && summary.providerExecuteCallsDuringAudit === 0
    && summary.codexCliCallsDuringAudit === 0
    && summary.workspaceWriteCallsDuringAudit === 0
    && summary.canaryFileWriteCallsDuringAudit === 0
    && summary.generalProviderExecutionCallsDuringAudit === 0
    && summary.externalWriteCallsDuringAudit === 0
    && summary.releaseCallsDuringAudit === 0
    && summary.secretAccessCallsDuringAudit === 0
    && summary.shellProcessCallsDuringAudit === 0;
}

function capabilityTaxonomyEscalationPolicyBoundaryConstrained(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const summary = input.capabilityTaxonomyEscalationPolicyReview.summary;

  return input.capabilityTaxonomyEscalationPolicyReview.status === "passed"
    && summary.escalationPolicyMode === "capability_escalation_policy_only"
    && summary.escalationPolicyIsProviderExecuteAuthorization === false
    && summary.escalationPolicyIsCodexCliAuthorization === false
    && summary.escalationPolicyIsWorkspaceWriteAuthorization === false
    && summary.escalationPolicyIsHostExecutorAuthorization === false
    && summary.escalationPolicyIsSubAgentRuntimeAuthorization === false
    && summary.escalationPolicyIsToolRuntimeAuthorization === false
    && summary.escalationPolicyIsExternalWriteAuthorization === false
    && summary.escalationPolicyIsReleaseAuthorization === false
    && summary.escalationPolicyIsSecretAccessAuthorization === false
    && summary.blockedCapabilityClassIsRuntimeBlockExecution === false
    && summary.severityIsRuntimeAuthorization === false
    && summary.statusIsExecutionAuthorization === false
    && summary.providerExecuteCallsDuringAudit === 0
    && summary.codexCliCallsDuringAudit === 0
    && summary.workspaceWriteCallsDuringAudit === 0
    && summary.hostExecutorCallsDuringAudit === 0
    && summary.subAgentRuntimeCallsDuringAudit === 0
    && summary.toolRuntimeCallsDuringAudit === 0
    && summary.shellProcessCallsDuringAudit === 0
    && summary.externalWriteCallsDuringAudit === 0
    && summary.releaseCallsDuringAudit === 0
    && summary.secretAccessCallsDuringAudit === 0;
}

function desktopDecisionRunnerBoundaryConstrained(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const summary = input.desktopDecisionRunnerReview.summary;

  return input.desktopDecisionRunnerReview.status === "passed"
    && summary.runnerMode === "decision_package_only"
    && summary.readyStatusIsExecutionAuthorization === false
    && summary.desktopPlanAuthorizedFlagIsDispatch === false
    && summary.providerSelectionIsProviderExecute === false
    && summary.providerGrantIsProviderExecute === false
    && summary.agentStrategyIsSubAgentRuntimeInvocation === false
    && summary.governanceStrategyExecuteActionIsRuntimeInvocation === false
    && summary.persistenceWritesLimitedToDecisionArtifacts === true
    && summary.desktopPrimitiveInvocationAllowed === false
    && summary.hostDispatchAllowed === false
    && summary.providerExecuteAllowed === false
    && summary.codexCliInvocationAllowed === false
    && summary.subAgentRuntimeInvocationAllowed === false
    && summary.shellProcessAllowed === false
    && summary.workspaceWriteExecutionAllowed === false
    && summary.desktopDecisionRunnerCallsDuringAudit === 0
    && summary.desktopPrimitiveCallsDuringAudit === 0
    && summary.hostDispatchCallsDuringAudit === 0
    && summary.providerExecuteCallsDuringAudit === 0
    && summary.codexCliCallsDuringAudit === 0
    && summary.subAgentRuntimeCallsDuringAudit === 0
    && summary.shellProcessCallsDuringAudit === 0
    && summary.workspaceWriteCallsDuringAudit === 0
    && summary.externalWriteCallsDuringAudit === 0;
}

function finalHostLocatorBoundaryConstrained(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const summary = input.finalHostLocatorReview.summary;

  return input.finalHostLocatorReview.status === "passed"
    && summary.locatorMode === "source_candidate_pre_mapping_only"
    && summary.readyForMappingIsHostExecutionAuthorization === false
    && summary.packagedRuntimeCanBeFinalHostSource === false
    && summary.referenceHostCanBeFinalHostSource === false
    && summary.pathProbeWritesAllowed === false
    && summary.recursiveScanAllowed === false
    && summary.hostExecutorInvocationAllowed === false
    && summary.desktopHostClientCreationAllowed === false
    && summary.hostDispatchAllowed === false
    && summary.providerExecuteAllowed === false
    && summary.codexCliInvocationAllowed === false
    && summary.subAgentRuntimeInvocationAllowed === false
    && summary.shellProcessAllowed === false
    && summary.workspaceWriteExecutionAllowed === false
    && summary.finalHostLocatorCallsDuringAudit === 0
    && summary.pathProbeWritesDuringAudit === 0
    && summary.hostExecutorCallsDuringAudit === 0
    && summary.hostDispatchCallsDuringAudit === 0
    && summary.providerExecuteCallsDuringAudit === 0
    && summary.codexCliCallsDuringAudit === 0
    && summary.subAgentRuntimeCallsDuringAudit === 0
    && summary.shellProcessCallsDuringAudit === 0
    && summary.workspaceWriteCallsDuringAudit === 0
    && summary.externalWriteCallsDuringAudit === 0;
}

function hostDispatcherProviderBoundaryConstrained(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const summary = input.hostDispatcherProviderReview.summary;

  return input.hostDispatcherProviderReview.status === "passed"
    && summary.dispatchMode === "controlled_read_only_and_workspace_write_provider_dispatch"
    && summary.permittedProviderId === "codex-cli"
    && summary.permittedSideEffectClass === "read_only"
    && summary.permittedSandbox === "read-only"
    && summary.readOnlyProviderDispatchAllowed === true
    && summary.controlledWorkspaceWriteDispatchAllowed === true
    && summary.formalDispatchRequiresRegistry === true
    && summary.formalDispatchRequiresMetadata === true
    && summary.generalProviderExecutionAllowed === false
    && summary.generalWorkspaceWriteAllowedByHostDispatcher === false
    && summary.workspaceWriteProviderExecuteAllowed === false
    && summary.defaultRealCodexCliAllowed === false
    && summary.subAgentRuntimeInvocationAllowed === false
    && summary.hostExecutorInvocationAllowed === false
    && summary.dispatcherCallsDuringAudit === 0
    && summary.providerExecuteCallsDuringAudit === 0
    && summary.realCodexCliCallsDuringAudit === 0
    && summary.workspaceWriteCallsDuringAudit === 0
    && summary.externalWriteCallsDuringAudit === 0;
}

function codexDesktopBridgeBoundaryConstrained(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const summary = input.codexDesktopBridgeReview.summary;

  return input.codexDesktopBridgeReview.status === "passed"
    && summary.bridgeMode === "explicit_injected_desktop_host_bridge"
    && summary.runtimeToolInvocationAllowedByDefault === false
    && summary.explicitInjectedRuntimeRequired === true
    && summary.shellGovernancePolicySupported === true
    && summary.rawShellAllowedByDefault === false
    && summary.patchBodyStoredInResult === false
    && summary.secretRedactionRequired === true
    && summary.codexCliInvocationAllowed === false
    && summary.providerInvocationAllowed === false
    && summary.subAgentRuntimeInvocationAllowed === false
    && summary.hostExecutorInvocationAllowed === false
    && summary.bridgeCallsDuringAudit === 0
    && summary.runtimeToolCallsDuringAudit === 0
    && summary.shellCallsDuringAudit === 0
    && summary.applyPatchCallsDuringAudit === 0
    && summary.spawnAgentCallsDuringAudit === 0
    && summary.externalWriteCallsDuringAudit === 0;
}

function codexDesktopLiveHostBoundaryConstrained(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const summary = input.codexDesktopLiveHostReview.summary;

  return input.codexDesktopLiveHostReview.status === "passed"
    && summary.liveHostMode === "explicit_current_host_runtime_and_memory_bundle"
    && summary.bundleCreationRequiresReadyHost === true
    && summary.runtimeMethodsRequired === true
    && summary.memoryMethodsRequired === true
    && summary.bridgeCreatedFromInjectedRuntime === true
    && summary.desktopHostClientCreatedWithInjectedBridge === true
    && summary.smokeCreatesBundleOnlyAfterReadiness === true
    && summary.smokeEvidenceSummarized === true
    && summary.defaultRuntimeToolInvocationAllowed === false
    && summary.codexCliInvocationAllowedByLiveHostBoundary === false
    && summary.providerInvocationAllowed === false
    && summary.subAgentRuntimeInvocationAllowed === false
    && summary.hostExecutorInvocationAllowed === false
    && summary.liveHostBundleCreationsDuringAudit === 0
    && summary.runtimeToolCallsDuringAudit === 0
    && summary.memoryToolCallsDuringAudit === 0
    && summary.bridgeCallsDuringAudit === 0
    && summary.hostClientRunCallsDuringAudit === 0
    && summary.smokeRunsDuringAudit === 0
    && summary.providerCallsDuringAudit === 0
    && summary.subAgentRuntimeCallsDuringAudit === 0
    && summary.hostExecutorCallsDuringAudit === 0
    && summary.workspaceWriteCallsDuringAudit === 0
    && summary.externalWriteCallsDuringAudit === 0;
}

function codexMemoryMcpClientBoundaryConstrained(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const summary = input.codexMemoryMcpClientReview.summary;

  return input.codexMemoryMcpClientReview.status === "passed"
    && summary.codexMemoryMcpClientMode === "explicit_mcp_http_memory_transport_only"
    && summary.mcpHttpCallsAreProviderExecution === false
    && summary.mcpHttpCallsAreHostExecutorAuthorization === false
    && summary.recordMemoryIsWorkspaceWriteExecution === false
    && summary.searchMemoryIsSubAgentRuntimeInvocation === false
    && summary.memoryOverviewIsRuntimeAuthorization === false
    && summary.adapterCheckpointWriteIsExecutionAuthorization === false
    && summary.defaultEndpointLookupAllowed === false
    && summary.bearerTokenIsExecutionAuthorization === false
    && summary.defaultCodexCliInvocationAllowed === false
    && summary.providerExecuteAllowed === false
    && summary.subAgentRuntimeInvocationAllowed === false
    && summary.shellProcessAllowedByDefault === false
    && summary.workspaceWriteAllowedByDefault === false
    && summary.externalWriteAllowedByDefault === false
    && summary.mcpHttpCallsDuringAudit === 0
    && summary.memoryToolCallsDuringAudit === 0
    && summary.hostExecutorInvocationsDuringAudit === 0
    && summary.codexCliCallsDuringAudit === 0
    && summary.providerExecuteCallsDuringAudit === 0
    && summary.subAgentRuntimeCallsDuringAudit === 0
    && summary.shellProcessCallsDuringAudit === 0
    && summary.workspaceWriteCallsDuringAudit === 0
    && summary.externalWriteCallsDuringAudit === 0;
}

function codexMemoryHostClientBoundaryConstrained(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const summary = input.codexMemoryHostClientReview.summary;

  return input.codexMemoryHostClientReview.status === "passed"
    && summary.codexMemoryHostClientMode === "explicit_injected_memory_operations_only"
    && summary.memoryOperationCallsAreHostExecutorAuthorization === false
    && summary.recordMemoryIsWorkspaceWriteExecution === false
    && summary.searchMemoryIsSubAgentRuntimeInvocation === false
    && summary.memoryOverviewIsRuntimeAuthorization === false
    && summary.adapterCheckpointWriteIsExecutionAuthorization === false
    && summary.mcpToolStyleAdapterIsDefaultHostLookup === false
    && summary.defaultRealHostExecutionAllowed === false
    && summary.defaultHostExecutorLookupAllowed === false
    && summary.defaultCodexCliInvocationAllowed === false
    && summary.providerExecuteAllowed === false
    && summary.subAgentRuntimeInvocationAllowed === false
    && summary.shellProcessAllowedByDefault === false
    && summary.workspaceWriteAllowedByDefault === false
    && summary.externalWriteAllowed === false
    && summary.memoryHostClientCallsDuringAudit === 0
    && summary.memoryOperationCallsDuringAudit === 0
    && summary.hostExecutorInvocationsDuringAudit === 0
    && summary.codexCliCallsDuringAudit === 0
    && summary.providerExecuteCallsDuringAudit === 0
    && summary.subAgentRuntimeCallsDuringAudit === 0
    && summary.shellProcessCallsDuringAudit === 0
    && summary.workspaceWriteCallsDuringAudit === 0
    && summary.externalWriteCallsDuringAudit === 0;
}

function desktopHostClientBoundaryConstrained(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const summary = input.desktopHostClientReview.summary;

  return input.desktopHostClientReview.status === "passed"
    && summary.facadeMode === "desktop_host_client_facade"
    && summary.runResumeMode === "delegates_to_desktop_live_adapter"
    && summary.operatorActionDispatchMode === "review_or_explicit_injected_dispatch"
    && summary.bridgeOrBindingsRequired === true
    && summary.runDelegatesToLiveAdapter === true
    && summary.resumeDelegatesToLiveAdapter === true
    && summary.currentOperatorActionLifecycleCaptured === true
    && summary.reviewUsesCurrentLifecycleOnly === true
    && summary.dispatchDelegatesToRecoveryControl === true
    && summary.dryRunDispatchAllowed === true
    && summary.executeInjectedDispatchAllowed === true
    && summary.defaultRealExecutionAllowed === false
    && summary.defaultHostExecutorLookupAllowed === false
    && summary.directDispatchToHostAllowedByClient === false
    && summary.codexCliInvocationAllowedByClient === false
    && summary.providerInvocationAllowedByClient === false
    && summary.controlledWorkspaceWriteDispatchAllowedByClient === true
    && summary.generalWorkspaceWriteAllowedByClient === false
    && summary.workspaceWriteProviderExecuteAllowedByClient === false
    && summary.subAgentRuntimeInvocationAllowed === false
    && summary.shellProcessAllowed === false
    && summary.externalWriteAllowed === false
    && summary.clientCallsDuringAudit === 0
    && summary.liveAdapterCallsDuringAudit === 0
    && summary.hostExecutorInvocationsDuringAudit === 0
    && summary.dispatchToHostCallsDuringAudit === 0
    && summary.codexCliCallsDuringAudit === 0
    && summary.providerCallsDuringAudit === 0
    && summary.subAgentRuntimeCallsDuringAudit === 0
    && summary.shellProcessCallsDuringAudit === 0
    && summary.workspaceWriteCallsDuringAudit === 0
    && summary.externalWriteCallsDuringAudit === 0;
}

function desktopLiveAdapterDispatchBoundaryConstrained(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const summary = input.desktopLiveAdapterDispatchReview.summary;

  return input.desktopLiveAdapterDispatchReview.status === "passed"
    && summary.dispatchMode === "route_separated_host_dispatch_or_desktop_bridge"
    && summary.codexCliHostDispatchAllowedWhenReadyAndRouted === true
    && summary.desktopPrimitiveExecutionAllowedWhenDesktopRouted === true
    && summary.blockedDecisionExecutionAllowed === false
    && summary.handlersOrBridgeRequiredForDesktopRoute === true
    && summary.governanceStateTaskScopeRequiredBeforeExecution === true
    && summary.hostDispatchFailureCreatesExecutionObservation === true
    && summary.codexCliInvocationAllowedByDesktopRoute === false
    && summary.bridgeInvocationAllowedByCodexCliRoute === false
    && summary.providerInvocationAllowedByDesktopLiveAdapter === false
    && summary.subAgentRuntimeInvocationAllowed === false
    && summary.hostExecutorInvocationAllowed === false
    && summary.liveAdapterCallsDuringAudit === 0
    && summary.dispatchToHostCallsDuringAudit === 0
    && summary.bridgeCallsDuringAudit === 0
    && summary.handlerCallsDuringAudit === 0
    && summary.providerCallsDuringAudit === 0
    && summary.subAgentRuntimeCallsDuringAudit === 0
    && summary.hostExecutorCallsDuringAudit === 0
    && summary.workspaceWriteCallsDuringAudit === 0
    && summary.externalWriteCallsDuringAudit === 0;
}

function hostClientExampleBoundaryConstrained(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const summary = input.hostClientExampleReview.summary;

  return input.hostClientExampleReview.status === "passed"
    && summary.exampleMode === "example_host_client_facade"
    && summary.runResumeMode === "delegates_to_desktop_live_adapter"
    && summary.exampleBridgeMode === "simulated_desktop_primitive_envelopes"
    && summary.exampleOnly === true
    && summary.runDelegatesToLiveAdapter === true
    && summary.resumeDelegatesToLiveAdapter === true
    && summary.simulatedShellPrimitiveAllowed === true
    && summary.simulatedPatchPrimitiveAllowed === true
    && summary.realShellProcessAllowed === false
    && summary.realWorkspaceWriteAllowed === false
    && summary.hostExecutorDispatchSurfacePresent === false
    && summary.defaultRealExecutionAllowed === false
    && summary.directDispatchToHostAllowedByExample === false
    && summary.codexCliInvocationAllowedByExample === false
    && summary.providerInvocationAllowedByExample === false
    && summary.subAgentRuntimeInvocationAllowed === false
    && summary.externalWriteAllowed === false
    && summary.exampleClientCallsDuringAudit === 0
    && summary.liveAdapterCallsDuringAudit === 0
    && summary.hostExecutorInvocationsDuringAudit === 0
    && summary.dispatchToHostCallsDuringAudit === 0
    && summary.codexCliCallsDuringAudit === 0
    && summary.providerCallsDuringAudit === 0
    && summary.subAgentRuntimeCallsDuringAudit === 0
    && summary.shellProcessCallsDuringAudit === 0
    && summary.workspaceWriteCallsDuringAudit === 0
    && summary.externalWriteCallsDuringAudit === 0;
}

function targetHostEmbeddingBoundaryConstrained(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const summary = input.targetHostEmbeddingReview.summary;

  return input.targetHostEmbeddingReview.status === "passed"
    && summary.targetHostEmbeddingMode === "explicit_target_host_contract_and_starter_only"
    && summary.placeholderMethodsAreRealExecution === false
    && summary.scaffoldReadyStatusIsExecutionAuthorization === false
    && summary.createBundleRequiresFullyWiredHost === true
    && summary.createBundleIsHostExecutorAuthorization === false
    && summary.directiveBuildersAreShellAuthorization === false
    && summary.defaultRealHostExecutionAllowed === false
    && summary.defaultHostExecutorLookupAllowed === false
    && summary.defaultCodexCliInvocationAllowed === false
    && summary.providerExecuteAllowed === false
    && summary.subAgentRuntimeInvocationAllowed === false
    && summary.shellProcessAllowedByDefault === false
    && summary.workspaceWriteAllowedByDefault === false
    && summary.externalWriteAllowed === false
    && summary.bundleCreationsDuringAudit === 0
    && summary.hostClientRunCallsDuringAudit === 0
    && summary.hostExecutorInvocationsDuringAudit === 0
    && summary.codexCliCallsDuringAudit === 0
    && summary.providerExecuteCallsDuringAudit === 0
    && summary.subAgentRuntimeCallsDuringAudit === 0
    && summary.shellProcessCallsDuringAudit === 0
    && summary.workspaceWriteCallsDuringAudit === 0
    && summary.externalWriteCallsDuringAudit === 0;
}

function hostExecutorBoundaryConstrained(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const summary = input.hostExecutorReview.summary;

  return input.hostExecutorReview.status === "passed"
    && summary.reviewMode === "review_only"
    && summary.dispatchModes.includes("dry_run")
    && summary.dispatchModes.includes("execute_injected")
    && summary.defaultRealExecutionAllowed === false
    && summary.hostExecutorInvocationsDuringAudit === 0;
}

function hostExecutorTaskbookBoundaryConstrained(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const summary = input.hostExecutorTaskbookReview.summary;

  return input.hostExecutorTaskbookReview.status === "passed"
    && summary.phase11TaskbookMode === "non_executing_authorization_packet_design"
    && summary.phase13TaskbookMode === "authorization_stop"
    && summary.taskbookExecutionAuthorized === false
    && summary.hostExecutorInvocationsDuringAudit === 0
    && summary.recoveryActionDispatchCallsDuringAudit === 0
    && summary.realCodexCliCallsDuringAudit === 0
    && summary.providerCallsDuringAudit === 0
    && summary.subAgentRuntimeCallsDuringAudit === 0
    && summary.shellProcessCallsDuringAudit === 0
    && summary.workspaceWriteCallsDuringAudit === 0
    && summary.externalWriteCallsDuringAudit === 0;
}

function hostClientExecutorReviewBoundaryConstrained(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const summary = input.hostClientExecutorReviewReview.summary;

  return input.hostClientExecutorReviewReview.status === "passed"
    && summary.surface === "desktop_host_client_review"
    && summary.boundaryMode === "review_only"
    && summary.reviewResultStatus === "ready_for_host_executor_review"
    && summary.recoveryActionDispatchAllowed === false
    && summary.hostBridgeCallAllowedByReview === false
    && summary.dispatchToHostAllowedByReview === false
    && summary.codexCliInvocationAllowed === false
    && summary.providerInvocationAllowed === false
    && summary.subAgentRuntimeInvocationAllowed === false
    && summary.shellProcessAllowed === false
    && summary.workspaceWriteAllowed === false
    && summary.externalWriteAllowed === false
    && summary.hostBridgeCallsDuringAudit === 0
    && summary.hostExecutorInvocationsDuringAudit === 0
    && summary.dispatchToHostCallsDuringAudit === 0
    && summary.codexCliCallsDuringAudit === 0
    && summary.providerCallsDuringAudit === 0
    && summary.subAgentRuntimeCallsDuringAudit === 0
    && summary.shellProcessCallsDuringAudit === 0
    && summary.workspaceWriteCallsDuringAudit === 0
    && summary.externalWriteCallsDuringAudit === 0;
}

function hostExecutorReceiptBoundaryConstrained(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const summary = input.hostExecutorReceiptReview.summary;

  return input.hostExecutorReceiptReview.status === "passed"
    && summary.terminalStatusesRequireReasonCode === true
    && summary.dispatchResultMeansBusinessRecoveryCompleted === false
    && summary.defaultRealExecutionAllowed === false
    && summary.executorInvocationsDuringAudit === 0
    && summary.realCodexCliCallsDuringAudit === 0
    && summary.providerCallsDuringAudit === 0
    && summary.subAgentRuntimeCallsDuringAudit === 0
    && summary.shellProcessCallsDuringAudit === 0
    && summary.workspaceWriteCallsDuringAudit === 0
    && summary.externalWriteCallsDuringAudit === 0;
}

function agentBackedRecoveryExecutorBoundaryConstrained(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const summary = input.agentBackedRecoveryExecutorReview.summary;

  return input.agentBackedRecoveryExecutorReview.status === "passed"
    && summary.executorBoundary === "host_provided_agent_backed"
    && summary.sandboxReferenceKind === "sandbox_reference"
    && summary.productionRecoveryExecutionAllowed === false
    && summary.codexCliAdapterAllowed === false
    && summary.providerAdapterAllowed === false
    && summary.subAgentRuntimeInvocationAllowedByRouter === false
    && summary.shellProcessAllowed === false
    && summary.workspaceWriteAllowed === false
    && summary.externalWriteAllowed === false
    && summary.sandboxExecutorInvocationsDuringAudit === 0;
}

function agentExecutorAdapterTaskbookBoundaryConstrained(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const summary = input.agentExecutorAdapterTaskbookReview.summary;

  return input.agentExecutorAdapterTaskbookReview.status === "passed"
    && summary.taskbookExecutionAuthorized === false
    && summary.adapterAutoDiscoveryAllowed === false
    && summary.codexCliInvocationAllowed === false
    && summary.providerInvocationAllowed === false
    && summary.subAgentRuntimeInvocationAllowed === false
    && summary.shellProcessAllowed === false
    && summary.workspaceWriteAllowed === false
    && summary.externalWriteAllowed === false
    && summary.productionRecoveryAllowed === false
    && summary.realRecoveryActionExecutionAllowed === false
    && summary.adapterInvocationsDuringAudit === 0;
}

function agentExecutorAdapterReviewBoundaryConstrained(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const summary = input.agentExecutorAdapterReviewReview.summary;

  return input.agentExecutorAdapterReviewReview.status === "passed"
    && summary.adapterKind === "sub_agent_adapter"
    && summary.executionBoundary === "review_only"
    && summary.invocationSupported === false
    && summary.sideEffectBoundary === "none"
    && summary.dispatchClass === "review_only"
    && summary.dispatchSideEffectClass === "none"
    && summary.adapterInvocationAllowed === false
    && summary.subAgentRuntimeInvocationAllowed === false
    && summary.codexCliInvocationAllowed === false
    && summary.providerInvocationAllowed === false
    && summary.shellProcessAllowed === false
    && summary.workspaceWriteAllowed === false
    && summary.externalWriteAllowed === false
    && summary.adapterInvocationsDuringAudit === 0;
}

function agentExecutorAdapterSandboxBoundaryConstrained(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const summary = input.agentExecutorAdapterSandboxReview.summary;

  return input.agentExecutorAdapterSandboxReview.status === "passed"
    && summary.adapterKind === "sandbox_reference_adapter"
    && summary.sideEffectBoundary === "sandbox_only"
    && summary.dispatchClass === "sandbox_contract"
    && summary.productionRecoveryExecutionAllowed === false
    && summary.codexCliAdapterAllowed === false
    && summary.providerAdapterAllowed === false
    && summary.subAgentRuntimeAdapterAllowed === false
    && summary.shellProcessAllowed === false
    && summary.workspaceWriteAllowed === false
    && summary.externalWriteAllowed === false
    && summary.adapterInvocationsDuringAudit === 0;
}

function agentTaskControlTaskbookBoundaryConstrained(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const summary = input.agentTaskControlTaskbookReview.summary;

  return input.agentTaskControlTaskbookReview.status === "passed"
    && summary.dispatchClass === "agent_task_control"
    && summary.sideEffectClass === "agent_context_only"
    && summary.taskbookExecutionAuthorized === false
    && summary.adapterInvocationAllowed === false
    && summary.codexCliInvocationAllowed === false
    && summary.providerInvocationAllowed === false
    && summary.subAgentRuntimeInvocationAllowed === false
    && summary.shellProcessAllowed === false
    && summary.workspaceWriteAllowed === false
    && summary.externalWriteAllowed === false
    && summary.productionRecoveryAllowed === false
    && summary.realRecoveryActionExecutionAllowed === false
    && summary.adapterInvocationsDuringAudit === 0;
}

function agentTaskControlReviewBoundaryConstrained(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const summary = input.agentTaskControlReviewReview.summary;

  return input.agentTaskControlReviewReview.status === "passed"
    && summary.dispatchClass === "agent_task_control"
    && summary.sideEffectClass === "agent_context_only"
    && summary.boundaryMode === "review_only"
    && summary.adapterInvocationAllowed === false
    && summary.codexCliInvocationAllowed === false
    && summary.providerInvocationAllowed === false
    && summary.subAgentRuntimeInvocationAllowed === false
    && summary.shellProcessAllowed === false
    && summary.workspaceWriteAllowed === false
    && summary.externalWriteAllowed === false
    && summary.productionRecoveryAllowed === false
    && summary.recoveryActionExecutionAllowed === false
    && summary.adapterInvocationsDuringAudit === 0
    && summary.subAgentRuntimeCallsDuringAudit === 0
    && summary.codexCliCallsDuringAudit === 0
    && summary.providerCallsDuringAudit === 0
    && summary.shellProcessCallsDuringAudit === 0
    && summary.workspaceWriteCallsDuringAudit === 0
    && summary.externalWriteCallsDuringAudit === 0;
}

function subAgentRuntimeBoundaryConstrained(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const summary = input.subAgentRuntimeReview.summary;

  return input.subAgentRuntimeReview.status === "passed"
    && summary.reviewAdapterKind === "sub_agent_adapter"
    && summary.reviewExecutionBoundary === "review_only"
    && summary.reviewInvocationSupported === false
    && summary.subAgentRuntimeExecutionAllowed === false
    && summary.subAgentRuntimeCallsDuringAudit === 0;
}

function agentTaskControlBoundaryConstrained(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const summary = input.agentTaskControlReview.summary;

  return input.agentTaskControlReview.status === "passed"
    && summary.dispatchClass === "agent_task_control"
    && summary.sideEffectClass === "agent_context_only"
    && summary.adapterKind === "sandbox_task_control_adapter"
    && summary.adapterInvocationsDuringAudit === 0;
}

function noCrossBoundaryExecutionBroadening(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const text = [
    input.governanceControlPlaneText,
    input.governanceReadmeText,
    input.governanceRunnerText
  ].join("\n");

  return !text.includes("sub-agent runtime execution authorized")
    && !text.includes("strategy router execute action family is authorization: true")
    && !text.includes("strategy router write execution predicate is authorization: true")
    && !text.includes("strategy router executor budget is runtime invocation: true")
    && !text.includes("execution profiles profile stage is runtime step: true")
    && !text.includes("execution profiles default role is sub-agent runtime authorization: true")
    && !text.includes("execution profiles default tool access is tool runtime authorization: true")
    && !text.includes("execution profiles engineering write tool access is workspace-write execution: true")
    && !text.includes("execution profiles protected remote tool access is external write authorization: true")
    && !text.includes("execution profiles allowParallel is sub-agent runtime authorization: true")
    && !text.includes("execution profiles maxParallelAgents is sub-agent spawn authorization: true")
    && !text.includes("execution profiles release-governance profile is protected remote authorization: true")
    && !text.includes("execution profiles profile selection is provider execution authorization: true")
    && !text.includes("execution profile lookups during audit: 1")
    && !text.includes("execution profiles provider execute calls during audit: 1")
    && !text.includes("execution profiles Codex CLI calls during audit: 1")
    && !text.includes("execution profiles desktop primitive calls during audit: 1")
    && !text.includes("execution profiles sub-agent runtime calls during audit: 1")
    && !text.includes("execution profiles host executor calls during audit: 1")
    && !text.includes("execution profiles host dispatch calls during audit: 1")
    && !text.includes("execution profiles tool runtime calls during audit: 1")
    && !text.includes("execution profiles shell/process calls during audit: 1")
    && !text.includes("execution profiles workspace-write calls during audit: 1")
    && !text.includes("execution profiles external write calls during audit: 1")
    && !text.includes("policy config hostRoute is host dispatch authorization: true")
    && !text.includes("policy config codex-cli host route is Codex CLI invocation: true")
    && !text.includes("policy config desktop host route is desktop runtime invocation: true")
    && !text.includes("policy config toolPolicy is tool runtime authorization: true")
    && !text.includes("policy config protected_remote tool policy is external-write authorization: true")
    && !text.includes("policy config approval rule is approval grant: true")
    && !text.includes("policy config memory health block is runtime block execution: true")
    && !text.includes("policy config memory guidance is sub-agent runtime authorization: true")
    && !text.includes("policy config telemetry threshold is runtime authorization: true")
    && !text.includes("policy config telemetry delivery window is host executor authorization: true")
    && !text.includes("policy config load calls during audit: 1")
    && !text.includes("policy config provider execute calls during audit: 1")
    && !text.includes("policy config Codex CLI calls during audit: 1")
    && !text.includes("policy config desktop primitive calls during audit: 1")
    && !text.includes("policy config sub-agent runtime calls during audit: 1")
    && !text.includes("policy config host executor calls during audit: 1")
    && !text.includes("policy config host dispatch calls during audit: 1")
    && !text.includes("policy config tool runtime calls during audit: 1")
    && !text.includes("policy config shell/process calls during audit: 1")
    && !text.includes("policy config workspace-write calls during audit: 1")
    && !text.includes("policy config external write calls during audit: 1")
    && !text.includes("capability taxonomy bounded workspace-write canary is workspace-write authorization: true")
    && !text.includes("capability taxonomy bounded workspace-write receipt is execution authorization: true")
    && !text.includes("capability taxonomy scoped workspace-write class is workspace-write execution: true")
    && !text.includes("capability taxonomy general workspace-write class is execution authorization: true")
    && !text.includes("capability taxonomy general provider execution class is provider execute authorization: true")
    && !text.includes("capability taxonomy external_write class is external-write authorization: true")
    && !text.includes("capability taxonomy release_or_deploy class is release authorization: true")
    && !text.includes("capability taxonomy secret_or_credential_change class is secret access authorization: true")
    && !text.includes("capability taxonomy escalation policy is runtime authorization: true")
    && !text.includes("capability taxonomy canary evidence baseline is execution authorization: true")
    && !text.includes("capability taxonomy provider execute calls during audit: 1")
    && !text.includes("capability taxonomy Codex CLI calls during audit: 1")
    && !text.includes("capability taxonomy workspace-write calls during audit: 1")
    && !text.includes("capability taxonomy canary file write calls during audit: 1")
    && !text.includes("capability taxonomy general provider execution calls during audit: 1")
    && !text.includes("capability taxonomy external write calls during audit: 1")
    && !text.includes("capability taxonomy release calls during audit: 1")
    && !text.includes("capability taxonomy secret access calls during audit: 1")
    && !text.includes("capability taxonomy shell/process calls during audit: 1")
    && !text.includes("capability taxonomy escalation policy is provider execute authorization: true")
    && !text.includes("capability taxonomy escalation policy is Codex CLI authorization: true")
    && !text.includes("capability taxonomy escalation policy is workspace-write authorization: true")
    && !text.includes("capability taxonomy escalation policy is host executor authorization: true")
    && !text.includes("capability taxonomy escalation policy is sub-agent runtime authorization: true")
    && !text.includes("capability taxonomy escalation policy is tool runtime authorization: true")
    && !text.includes("capability taxonomy escalation policy is external-write authorization: true")
    && !text.includes("capability taxonomy escalation policy is release authorization: true")
    && !text.includes("capability taxonomy escalation policy is secret access authorization: true")
    && !text.includes("capability taxonomy escalation policy blocked capability class is runtime block execution: true")
    && !text.includes("capability taxonomy escalation policy severity is runtime authorization: true")
    && !text.includes("capability taxonomy escalation policy status is execution authorization: true")
    && !text.includes("capability taxonomy escalation policy provider execute calls during audit: 1")
    && !text.includes("capability taxonomy escalation policy Codex CLI calls during audit: 1")
    && !text.includes("capability taxonomy escalation policy workspace-write calls during audit: 1")
    && !text.includes("capability taxonomy escalation policy host executor calls during audit: 1")
    && !text.includes("capability taxonomy escalation policy sub-agent runtime calls during audit: 1")
    && !text.includes("capability taxonomy escalation policy tool runtime calls during audit: 1")
    && !text.includes("capability taxonomy escalation policy shell/process calls during audit: 1")
    && !text.includes("capability taxonomy escalation policy external write calls during audit: 1")
    && !text.includes("capability taxonomy escalation policy release calls during audit: 1")
    && !text.includes("capability taxonomy escalation policy secret access calls during audit: 1")
    && !text.includes("controlled provider execution taskbook is provider execute authorization: true")
    && !text.includes("controlled provider execution taskbook is real Codex CLI authorization: true")
    && !text.includes("controlled provider execution taskbook is workspace-write authorization: true")
    && !text.includes("controlled provider execution taskbook is local command authorization: true")
    && !text.includes("controlled provider execution taskbook is protected remote authorization: true")
    && !text.includes("controlled provider execution taskbook is host executor authorization: true")
    && !text.includes("controlled provider execution taskbook is sub-agent runtime authorization: true")
    && !text.includes("controlled provider execution taskbook is external-write authorization: true")
    && !text.includes("controlled provider execution taskbook is release authorization: true")
    && !text.includes("controlled provider execution taskbook is secret change authorization: true")
    && !text.includes("controlled provider execution taskbook provider execute calls during audit: 1")
    && !text.includes("controlled provider execution taskbook Codex CLI calls during audit: 1")
    && !text.includes("controlled provider execution taskbook workspace-write calls during audit: 1")
    && !text.includes("controlled provider execution taskbook host executor calls during audit: 1")
    && !text.includes("controlled provider execution taskbook sub-agent runtime calls during audit: 1")
    && !text.includes("controlled provider execution taskbook shell/process calls during audit: 1")
    && !text.includes("controlled provider execution taskbook external write calls during audit: 1")
    && !text.includes("controlled provider execution taskbook evidence writes during audit: 1")
    && !text.includes("controlled provider execution taskbook review audit is provider execute authorization: true")
    && !text.includes("controlled provider execution taskbook review audit is real Codex CLI authorization: true")
    && !text.includes("controlled provider execution taskbook review audit is workspace-write authorization: true")
    && !text.includes("controlled provider execution taskbook review audit is local command authorization: true")
    && !text.includes("controlled provider execution taskbook review audit is host executor authorization: true")
    && !text.includes("controlled provider execution taskbook review audit is sub-agent runtime authorization: true")
    && !text.includes("controlled provider execution taskbook review audit is external-write authorization: true")
    && !text.includes("controlled provider execution taskbook review audit is release authorization: true")
    && !text.includes("controlled provider execution taskbook review audit git state is execution authorization: true")
    && !text.includes("controlled provider execution taskbook review audit worktree clean is provider execution authorization: true")
    && !text.includes("controlled provider execution taskbook review boundary provider execute calls during audit: 1")
    && !text.includes("controlled provider execution taskbook review boundary Codex CLI calls during audit: 1")
    && !text.includes("controlled provider execution taskbook review boundary workspace-write calls during audit: 1")
    && !text.includes("controlled provider execution taskbook review boundary host executor calls during audit: 1")
    && !text.includes("controlled provider execution taskbook review boundary sub-agent runtime calls during audit: 1")
    && !text.includes("controlled provider execution taskbook review boundary shell/process calls during audit: 1")
    && !text.includes("controlled provider execution taskbook review boundary external write calls during audit: 1")
    && !text.includes("controlled provider execution taskbook review boundary evidence writes during audit: 1")
    && !text.includes("routing engine decision is execution authorization: true")
    && !text.includes("routing engine hostRoute is host dispatch authorization: true")
    && !text.includes("routing engine providerGrant is provider execute authorization: true")
    && !text.includes("routing engine codex-cli provider id is Codex CLI invocation: true")
    && !text.includes("routing engine desktop provider id is desktop runtime invocation: true")
    && !text.includes("routing engine sandboxMode is workspace-write execution: true")
    && !text.includes("routing engine toolAccess is tool runtime authorization: true")
    && !text.includes("routing engine approvalRequired is approval grant: true")
    && !text.includes("routing engine risk score is runtime authorization: true")
    && !text.includes("routing engine parallelism allowed is sub-agent runtime authorization: true")
    && !text.includes("routing engine calls during audit: 1")
    && !text.includes("routing engine provider grant creations during audit: 1")
    && !text.includes("routing engine provider execute calls during audit: 1")
    && !text.includes("routing engine Codex CLI calls during audit: 1")
    && !text.includes("routing engine desktop runtime calls during audit: 1")
    && !text.includes("routing engine sub-agent runtime calls during audit: 1")
    && !text.includes("routing engine host executor calls during audit: 1")
    && !text.includes("routing engine host dispatch calls during audit: 1")
    && !text.includes("routing engine tool runtime calls during audit: 1")
    && !text.includes("routing engine shell/process calls during audit: 1")
    && !text.includes("routing engine workspace-write calls during audit: 1")
    && !text.includes("routing engine external write calls during audit: 1")
    && !text.includes("recovery control schema status is execution authorization: true")
    && !text.includes("recovery control execution plan is recovery execution authorization: true")
    && !text.includes("recovery control execution gate is runtime authorization: true")
    && !text.includes("recovery control host executor review is host dispatch authorization: true")
    && !text.includes("recovery control dispatch authorization review is adapter invocation authorization: true")
    && !text.includes("recovery control task-control review is sub-agent runtime authorization: true")
    && !text.includes("recovery control sandbox witness is production recovery execution: true")
    && !text.includes("recovery control receipt status is completion authorization: true")
    && !text.includes("recovery control recovery recommendation is host executor authorization: true")
    && !text.includes("recovery control calls during audit: 1")
    && !text.includes("recovery control host executor invocations during audit: 1")
    && !text.includes("recovery control adapter invocations during audit: 1")
    && !text.includes("recovery control Codex CLI calls during audit: 1")
    && !text.includes("recovery control provider execute calls during audit: 1")
    && !text.includes("recovery control sub-agent runtime calls during audit: 1")
    && !text.includes("recovery control shell/process calls during audit: 1")
    && !text.includes("recovery control workspace-write calls during audit: 1")
    && !text.includes("recovery control external write calls during audit: 1")
    && !text.includes("runtime control runtime signal is execution authorization: true")
    && !text.includes("runtime control escalation outcome is provider execution authorization: true")
    && !text.includes("runtime control upgrade_model is model runtime invocation: true")
    && !text.includes("runtime control open_circuit is host dispatch authorization: true")
    && !text.includes("runtime control failure count is recovery execution authorization: true")
    && !text.includes("runtime control context pressure is sub-agent runtime authorization: true")
    && !text.includes("runtime control high-risk signal is Codex CLI authorization: true")
    && !text.includes("runtime control calls during audit: 1")
    && !text.includes("runtime control provider execute calls during audit: 1")
    && !text.includes("runtime control Codex CLI calls during audit: 1")
    && !text.includes("runtime control sub-agent runtime calls during audit: 1")
    && !text.includes("runtime control host executor calls during audit: 1")
    && !text.includes("runtime control host dispatch calls during audit: 1")
    && !text.includes("runtime control model runtime calls during audit: 1")
    && !text.includes("runtime control shell/process calls during audit: 1")
    && !text.includes("runtime control workspace-write calls during audit: 1")
    && !text.includes("runtime control external write calls during audit: 1")
    && !text.includes("workspace-write allowed by this boundary: true")
    && !text.includes("default real execution allowed: true")
    && !text.includes("general provider execution allowed: true")
    && !text.includes("Approval permit valid permit is provider execution authorization: true")
    && !text.includes("Approval permit valid permit is Codex CLI authorization: true")
    && !text.includes("Approval permit valid permit is sub-agent runtime authorization: true")
    && !text.includes("Approval permit valid permit is host executor authorization: true")
    && !text.includes("Approval permit valid permit is tool runtime authorization: true")
    && !text.includes("Approval permit shell capability scope is shell execution: true")
    && !text.includes("Approval permit external capability scope is external write execution: true")
    && !text.includes("Approval permit store persistence is workspace-write execution: true")
    && !text.includes("Approval permit provider execute calls during audit: 1")
    && !text.includes("Approval permit Codex CLI calls during audit: 1")
    && !text.includes("Approval permit sub-agent runtime calls during audit: 1")
    && !text.includes("Approval permit host executor calls during audit: 1")
    && !text.includes("Approval permit tool runtime calls during audit: 1")
    && !text.includes("Approval permit shell/process calls during audit: 1")
    && !text.includes("Approval permit workspace-write calls during audit: 1")
    && !text.includes("Approval permit external write calls during audit: 1")
    && !text.includes("Approval gate not_required status is execution authorization: true")
    && !text.includes("Approval gate resolution is provider execution authorization: true")
    && !text.includes("Approval gate resolution is Codex CLI authorization: true")
    && !text.includes("Approval gate resolution is sub-agent runtime authorization: true")
    && !text.includes("Approval gate resolution is host executor authorization: true")
    && !text.includes("Approval gate resolution is tool runtime authorization: true")
    && !text.includes("Approval gate pending status is runtime invocation: true")
    && !text.includes("Approval gate protected branch signal is workspace-write execution: true")
    && !text.includes("Approval gate dirty workspace signal is workspace-write execution: true")
    && !text.includes("Approval gate protected keyword signal is external write execution: true")
    && !text.includes("Approval gate calls during audit: 1")
    && !text.includes("Approval gate resolution checks during audit: 1")
    && !text.includes("Approval gate provider execute calls during audit: 1")
    && !text.includes("Approval gate Codex CLI calls during audit: 1")
    && !text.includes("Approval gate sub-agent runtime calls during audit: 1")
    && !text.includes("Approval gate host executor calls during audit: 1")
    && !text.includes("Approval gate tool runtime calls during audit: 1")
    && !text.includes("Approval gate shell/process calls during audit: 1")
    && !text.includes("Approval gate workspace-write calls during audit: 1")
    && !text.includes("Approval gate external write calls during audit: 1")
    && !text.includes("approval consumption dispatch matrix audit is provider execute authorization: true")
    && !text.includes("approval consumption dispatch matrix audit is real Codex CLI authorization: true")
    && !text.includes("approval consumption dispatch matrix audit is workspace-write authorization: true")
    && !text.includes("approval consumption dispatch matrix audit is local command authorization: true")
    && !text.includes("approval consumption dispatch matrix audit is host executor authorization: true")
    && !text.includes("approval consumption dispatch matrix audit is sub-agent runtime authorization: true")
    && !text.includes("approval consumption dispatch matrix audit is tool runtime authorization: true")
    && !text.includes("approval consumption dispatch matrix audit is external-write authorization: true")
    && !text.includes("approval consumption dispatch matrix audit is release authorization: true")
    && !text.includes("approval consumption dispatch matrix audit git state is execution authorization: true")
    && !text.includes("approval consumption dispatch matrix audit worktree clean is provider execution authorization: true")
    && !text.includes("approval consumption dispatch matrix boundary provider execute calls during audit: 1")
    && !text.includes("approval consumption dispatch matrix boundary Codex CLI calls during audit: 1")
    && !text.includes("approval consumption dispatch matrix boundary workspace-write calls during audit: 1")
    && !text.includes("approval consumption dispatch matrix boundary host executor calls during audit: 1")
    && !text.includes("approval consumption dispatch matrix boundary sub-agent runtime calls during audit: 1")
    && !text.includes("approval consumption dispatch matrix boundary tool runtime calls during audit: 1")
    && !text.includes("approval consumption dispatch matrix boundary shell/process calls during audit: 1")
    && !text.includes("approval consumption dispatch matrix boundary external write calls during audit: 1")
    && !text.includes("approval consumption dispatch matrix is provider execute authorization: true")
    && !text.includes("approval consumption dispatch matrix is real Codex CLI authorization: true")
    && !text.includes("approval consumption dispatch matrix is workspace-write authorization: true")
    && !text.includes("approval consumption dispatch matrix is local command authorization: true")
    && !text.includes("approval consumption dispatch matrix is host executor authorization: true")
    && !text.includes("approval consumption dispatch matrix is sub-agent runtime authorization: true")
    && !text.includes("approval consumption dispatch matrix is external-write authorization: true")
    && !text.includes("approval consumption dispatch matrix is release authorization: true")
    && !text.includes("approval consumption dispatch approval permit consumption is provider execution authorization: true")
    && !text.includes("approval consumption dispatch host dispatcher precondition is provider execute authorization: true")
    && !text.includes("approval consumption dispatch redaction coverage is runtime authorization: true")
    && !text.includes("approval consumption dispatch provider execute calls during audit: 1")
    && !text.includes("approval consumption dispatch Codex CLI calls during audit: 1")
    && !text.includes("approval consumption dispatch workspace-write calls during audit: 1")
    && !text.includes("approval consumption dispatch host executor calls during audit: 1")
    && !text.includes("approval consumption dispatch sub-agent runtime calls during audit: 1")
    && !text.includes("approval consumption dispatch shell/process calls during audit: 1")
    && !text.includes("approval consumption dispatch external write calls during audit: 1")
    && !text.includes("read-only productization is provider execute authorization: true")
    && !text.includes("read-only productization is real Codex CLI authorization: true")
    && !text.includes("read-only productization is workspace-write authorization: true")
    && !text.includes("read-only productization is local command authorization: true")
    && !text.includes("read-only productization is host executor authorization: true")
    && !text.includes("read-only productization is sub-agent runtime authorization: true")
    && !text.includes("read-only productization is tool runtime authorization: true")
    && !text.includes("read-only productization is external write authorization: true")
    && !text.includes("read-only productization is evidence refresh authorization: true")
    && !text.includes("read-only productization is release authorization: true")
    && !text.includes("read-only productization git state is execution authorization: true")
    && !text.includes("read-only productization worktree clean is provider execution authorization: true")
    && !text.includes("read-only productization boundary provider execute calls during audit: 1")
    && !text.includes("read-only productization boundary Codex CLI calls during audit: 1")
    && !text.includes("read-only productization boundary workspace-write calls during audit: 1")
    && !text.includes("read-only productization boundary host executor calls during audit: 1")
    && !text.includes("read-only productization boundary sub-agent runtime calls during audit: 1")
    && !text.includes("read-only productization boundary tool runtime calls during audit: 1")
    && !text.includes("read-only productization boundary shell/process calls during audit: 1")
    && !text.includes("read-only productization boundary external write calls during audit: 1")
    && !text.includes("read-only productization boundary evidence writes during audit: 1")
    && !text.includes("state-sync is provider execute authorization: true")
    && !text.includes("state-sync is real Codex CLI authorization: true")
    && !text.includes("state-sync is workspace-write authorization: true")
    && !text.includes("state-sync is local command authorization: true")
    && !text.includes("state-sync is host executor authorization: true")
    && !text.includes("state-sync is sub-agent runtime authorization: true")
    && !text.includes("state-sync is tool runtime authorization: true")
    && !text.includes("state-sync is external write authorization: true")
    && !text.includes("state-sync is evidence refresh authorization: true")
    && !text.includes("state-sync is push authorization: true")
    && !text.includes("state-sync is release authorization: true")
    && !text.includes("state-sync git state is execution authorization: true")
    && !text.includes("state-sync policy v2 is execution authorization: true")
    && !text.includes("state-sync boundary provider execute calls during audit: 1")
    && !text.includes("state-sync boundary Codex CLI calls during audit: 1")
    && !text.includes("state-sync boundary workspace-write calls during audit: 1")
    && !text.includes("state-sync boundary local command calls during audit: 1")
    && !text.includes("state-sync boundary host executor calls during audit: 1")
    && !text.includes("state-sync boundary sub-agent runtime calls during audit: 1")
    && !text.includes("state-sync boundary tool runtime calls during audit: 1")
    && !text.includes("state-sync boundary external write calls during audit: 1")
    && !text.includes("state-sync boundary state writes during audit: 1")
    && !text.includes("state-sync boundary remote writes during audit: 1")
    && !text.includes("Admission control accepted status is execution authorization: true")
    && !text.includes("Admission control needs_approval status is approval grant: true")
    && !text.includes("Admission control rejected status is runtime block execution: true")
    && !text.includes("Admission control capability match is runtime invocation: true")
    && !text.includes("Admission control required approval is provider execution authorization: true")
    && !text.includes("Admission control required approval is Codex CLI authorization: true")
    && !text.includes("Admission control required approval is sub-agent runtime authorization: true")
    && !text.includes("Admission control required approval is host executor authorization: true")
    && !text.includes("Admission control external capability is external write execution: true")
    && !text.includes("Admission control file write capability is workspace-write execution: true")
    && !text.includes("Admission control calls during audit: 1")
    && !text.includes("Admission control provider execute calls during audit: 1")
    && !text.includes("Admission control Codex CLI calls during audit: 1")
    && !text.includes("Admission control sub-agent runtime calls during audit: 1")
    && !text.includes("Admission control host executor calls during audit: 1")
    && !text.includes("Admission control tool runtime calls during audit: 1")
    && !text.includes("Admission control shell/process calls during audit: 1")
    && !text.includes("Admission control workspace-write calls during audit: 1")
    && !text.includes("Admission control external write calls during audit: 1")
    && !text.includes("Delegation policy full_delegation is execution authorization: true")
    && !text.includes("Delegation policy requiresApproval false is execution authorization: true")
    && !text.includes("Delegation policy approved proposal is runtime authorization: true")
    && !text.includes("Delegation policy applied proposal is provider execution authorization: true")
    && !text.includes("Delegation policy filtered recovery action is host executor authorization: true")
    && !text.includes("Delegation policy recovery action list is recovery execution: true")
    && !text.includes("Delegation policy historical trust is runtime authorization: true")
    && !text.includes("Delegation policy recorded resume is runtime invocation: true")
    && !text.includes("Delegation policy file-store persistence is workspace-write execution: true")
    && !text.includes("Delegation policy calls during audit: 1")
    && !text.includes("Delegation policy proposal lifecycle calls during audit: 1")
    && !text.includes("Delegation policy file-store writes during audit: 1")
    && !text.includes("Delegation policy provider execute calls during audit: 1")
    && !text.includes("Delegation policy Codex CLI calls during audit: 1")
    && !text.includes("Delegation policy sub-agent runtime calls during audit: 1")
    && !text.includes("Delegation policy host executor calls during audit: 1")
    && !text.includes("Delegation policy tool runtime calls during audit: 1")
    && !text.includes("Delegation policy shell/process calls during audit: 1")
    && !text.includes("Delegation policy workspace-write calls during audit: 1")
    && !text.includes("Delegation policy external write calls during audit: 1")
    && !text.includes("governance failure reducer execution failure is recovery authorization: true")
    && !text.includes("governance failure reducer strategy decision is runtime authorization: true")
    && !text.includes("governance failure reducer arbitration packet is recovery execution: true")
    && !text.includes("governance failure reducer recovery recommendation is host executor authorization: true")
    && !text.includes("governance failure reducer anomaly record is runtime invocation: true")
    && !text.includes("governance failure reducer evidence ref is replay authorization: true")
    && !text.includes("governance failure reducer risk score is provider execution authorization: true")
    && !text.includes("governance failure reducer state update is workspace-write execution: true")
    && !text.includes("governance failure reducer callback calls during audit: 1")
    && !text.includes("governance failure reducer persistence writes during audit: 1")
    && !text.includes("governance failure reducer provider execute calls during audit: 1")
    && !text.includes("governance failure reducer Codex CLI calls during audit: 1")
    && !text.includes("governance failure reducer sub-agent runtime calls during audit: 1")
    && !text.includes("governance failure reducer host executor calls during audit: 1")
    && !text.includes("governance failure reducer host dispatch calls during audit: 1")
    && !text.includes("governance failure reducer tool runtime calls during audit: 1")
    && !text.includes("governance failure reducer shell/process calls during audit: 1")
    && !text.includes("governance failure reducer workspace-write calls during audit: 1")
    && !text.includes("governance failure reducer external write calls during audit: 1")
    && !text.includes("task graph node status is execution authorization: true")
    && !text.includes("task graph completion is runtime completion: true")
    && !text.includes("task graph dependency edge is scheduler dispatch: true")
    && !text.includes("task graph conflict edge is runtime block execution: true")
    && !text.includes("task graph checkpoint node is rollback execution: true")
    && !text.includes("task graph delta is workspace rollback authorization: true")
    && !text.includes("task graph rollbackToCheckpoint is host executor authorization: true")
    && !text.includes("task graph branch merge is git merge or workspace-write: true")
    && !text.includes("task graph file-store persistence is workspace-write execution: true")
    && !text.includes("task graph calls during audit: 1")
    && !text.includes("task graph store writes during audit: 1")
    && !text.includes("task graph provider execute calls during audit: 1")
    && !text.includes("task graph Codex CLI calls during audit: 1")
    && !text.includes("task graph sub-agent runtime calls during audit: 1")
    && !text.includes("task graph host executor calls during audit: 1")
    && !text.includes("task graph host dispatch calls during audit: 1")
    && !text.includes("task graph tool runtime calls during audit: 1")
    && !text.includes("task graph shell/process calls during audit: 1")
    && !text.includes("task graph workspace-write calls during audit: 1")
    && !text.includes("task graph external write calls during audit: 1")
    && !text.includes("scheduler queued status is dispatch authorization: true")
    && !text.includes("scheduler leased status is execution authorization: true")
    && !text.includes("scheduler active lease is provider execute authorization: true")
    && !text.includes("scheduler worker id is host or sub-agent authorization: true")
    && !text.includes("scheduler releaseLease is runtime completion proof: true")
    && !text.includes("scheduler failLease is recovery execution: true")
    && !text.includes("scheduler expired lease is retry execution: true")
    && !text.includes("scheduler exhausted status is runtime block execution: true")
    && !text.includes("scheduler file-state persistence is workspace-write execution: true")
    && !text.includes("scheduler file lock is shell/process execution: true")
    && !text.includes("scheduler calls during audit: 1")
    && !text.includes("scheduler lease acquisitions during audit: 1")
    && !text.includes("scheduler state writes during audit: 1")
    && !text.includes("scheduler provider execute calls during audit: 1")
    && !text.includes("scheduler Codex CLI calls during audit: 1")
    && !text.includes("scheduler sub-agent runtime calls during audit: 1")
    && !text.includes("scheduler host executor calls during audit: 1")
    && !text.includes("scheduler host dispatch calls during audit: 1")
    && !text.includes("scheduler tool runtime calls during audit: 1")
    && !text.includes("scheduler shell/process calls during audit: 1")
    && !text.includes("scheduler workspace-write calls during audit: 1")
    && !text.includes("scheduler external write calls during audit: 1")
    && !text.includes("provider-core primitives execution allowed: true")
    && !text.includes("Tool invocation planner planned status is runtime invocation: true")
    && !text.includes("Tool invocation planner remote.agent.invoke is sub-agent runtime authorization: true")
    && !text.includes("Tool invocation planner external-write manifest is external-write authorization: true")
    && !text.includes("Tool invocation planner approval permit is tool runtime authorization: true")
    && !text.includes("Tool invocation planner local-write plan is workspace-write execution: true")
    && !text.includes("Tool invocation planner input preview stores raw secrets: true")
    && !text.includes("Tool invocation planner default Codex CLI invocation allowed: true")
    && !text.includes("Tool invocation planner provider execute allowed: true")
    && !text.includes("Tool invocation planner sub-agent runtime invocation allowed: true")
    && !text.includes("Tool invocation planner host executor invocation allowed: true")
    && !text.includes("Tool invocation planner tool runtime invocation allowed: true")
    && !text.includes("Tool invocation planner shell/process allowed by default: true")
    && !text.includes("Tool invocation planner workspace-write allowed by default: true")
    && !text.includes("Tool invocation planner external write allowed by default: true")
    && !text.includes("Tool invocation planner registry calls during audit: 1")
    && !text.includes("Tool invocation planner plans during audit: 1")
    && !text.includes("Tool invocation planner tool runtime calls during audit: 1")
    && !text.includes("Tool invocation planner provider execute calls during audit: 1")
    && !text.includes("Tool invocation planner sub-agent runtime calls during audit: 1")
    && !text.includes("Tool invocation planner host executor calls during audit: 1")
    && !text.includes("desktop agent strategy parallel plan is sub-agent runtime authorization: true")
    && !text.includes("desktop agent strategy worker assignment is runtime invocation: true")
    && !text.includes("desktop agent strategy write mode is workspace-write execution: true")
    && !text.includes("desktop agent strategy ownership target is workspace-write authorization: true")
    && !text.includes("desktop agent strategy maxAgents is sub-agent spawn authorization: true")
    && !text.includes("desktop agent strategy read-only analyst is provider execution authorization: true")
    && !text.includes("desktop agent strategy reason is execution gate: true")
    && !text.includes("desktop agent strategy calls during audit: 1")
    && !text.includes("desktop agent strategy provider execute calls during audit: 1")
    && !text.includes("desktop agent strategy Codex CLI calls during audit: 1")
    && !text.includes("desktop agent strategy desktop primitive calls during audit: 1")
    && !text.includes("desktop agent strategy sub-agent runtime calls during audit: 1")
    && !text.includes("desktop agent strategy host executor calls during audit: 1")
    && !text.includes("desktop agent strategy host dispatch calls during audit: 1")
    && !text.includes("desktop agent strategy shell/process calls during audit: 1")
    && !text.includes("desktop agent strategy workspace-write calls during audit: 1")
    && !text.includes("desktop agent strategy external write calls during audit: 1")
    && !text.includes("Provider registry selected provider is execution authorization: true")
    && !text.includes("Provider registry provider grant selection is provider execute authorization: true")
    && !text.includes("Provider registry routing decision selection is Codex CLI authorization: true")
    && !text.includes("Provider registry registered executor provider is runtime invocation: true")
    && !text.includes("Provider registry registered tool provider is tool runtime invocation: true")
    && !text.includes("Provider registry registered remote-agent provider is sub-agent runtime authorization: true")
    && !text.includes("Provider registry remote-agent auth schemes are runtime authorization: true")
    && !text.includes("Provider registry manifest-store persistence is workspace-write execution: true")
    && !text.includes("Provider registry provider execute calls during audit: 1")
    && !text.includes("Provider registry Codex CLI calls during audit: 1")
    && !text.includes("Provider registry sub-agent runtime calls during audit: 1")
    && !text.includes("Provider registry host executor calls during audit: 1")
    && !text.includes("Provider registry tool runtime calls during audit: 1")
    && !text.includes("Provider registry workspace-write calls during audit: 1")
    && !text.includes("provider execution runner workspace-write allowed: true")
    && !text.includes("provider execution runner default real Codex CLI allowed: true")
    && !text.includes("provider execution runner non-codex provider execution allowed: true")
    && !text.includes("provider execution runner execute calls during audit: 1")
    && !text.includes("desktop decision runner ready status is execution authorization: true")
    && !text.includes("desktop decision runner provider selection is provider execute: true")
    && !text.includes("desktop decision runner agent strategy is sub-agent runtime invocation: true")
    && !text.includes("desktop decision runner host dispatch allowed: true")
    && !text.includes("desktop decision runner provider execute allowed: true")
    && !text.includes("desktop decision runner Codex CLI invocation allowed: true")
    && !text.includes("desktop decision runner calls during audit: 1")
    && !text.includes("desktop decision runner provider execute calls during audit: 1")
    && !text.includes("final host locator ready_for_mapping is host execution authorization: true")
    && !text.includes("final host locator host executor invocation allowed: true")
    && !text.includes("final host locator host dispatch allowed: true")
    && !text.includes("final host locator provider execute allowed: true")
    && !text.includes("final host locator Codex CLI invocation allowed: true")
    && !text.includes("final host locator sub-agent runtime invocation allowed: true")
    && !text.includes("final host locator calls during audit: 1")
    && !text.includes("final host locator provider execute calls during audit: 1")
    && !text.includes("Codex CLI host default real Codex CLI allowed by boundary audit: true")
    && !text.includes("Codex CLI host provider execution allowed by host boundary: true")
    && !text.includes("Codex CLI process spawns during audit: 1")
    && !text.includes("public API internal governance top-level exports allowed: true")
    && !text.includes("public API provider execute export allowed: true")
    && !text.includes("public API Codex CLI host run export allowed: true")
    && !text.includes("public API calls during audit: 1")
    && !text.includes("Agent OS local runtime real provider execution allowed: true")
    && !text.includes("Agent OS local runtime Codex CLI invocation allowed: true")
    && !text.includes("Agent OS local runtime host executor invocation allowed: true")
    && !text.includes("Agent OS local runtime workspace-write execution allowed: true")
    && !text.includes("Agent OS local runtime calls during audit: 1")
    && !text.includes("Agent OS MCP server manifest runtimeImplemented means live server: true")
    && !text.includes("Agent OS MCP server manifest tool manifest is tool runtime authorization: true")
    && !text.includes("Agent OS MCP server manifest required capability is capability grant: true")
    && !text.includes("Agent OS MCP server manifest approvalRequired is approval grant: true")
    && !text.includes("Agent OS MCP server manifest local_write side effect is workspace-write execution: true")
    && !text.includes("Agent OS MCP server manifest provider planning output is provider execution authorization: true")
    && !text.includes("Agent OS MCP server manifest approval permit output is provider execution authorization: true")
    && !text.includes("Agent OS MCP server manifest listed tool is MCP tool invocation: true")
    && !text.includes("Agent OS MCP server manifest export is public execution surface: true")
    && !text.includes("Agent OS MCP server manifest calls during audit: 1")
    && !text.includes("Agent OS MCP server manifest live server starts during audit: 1")
    && !text.includes("Agent OS MCP server manifest local runtime calls during audit: 1")
    && !text.includes("Agent OS MCP server manifest tool runtime calls during audit: 1")
    && !text.includes("Agent OS MCP server manifest provider execute calls during audit: 1")
    && !text.includes("Agent OS MCP server manifest Codex CLI calls during audit: 1")
    && !text.includes("Agent OS MCP server manifest desktop primitive calls during audit: 1")
    && !text.includes("Agent OS MCP server manifest sub-agent runtime calls during audit: 1")
    && !text.includes("Agent OS MCP server manifest host executor calls during audit: 1")
    && !text.includes("Agent OS MCP server manifest host dispatch calls during audit: 1")
    && !text.includes("Agent OS MCP server manifest shell/process calls during audit: 1")
    && !text.includes("Agent OS MCP server manifest network calls during audit: 1")
    && !text.includes("Agent OS MCP server manifest workspace-write calls during audit: 1")
    && !text.includes("Agent OS MCP server manifest external write calls during audit: 1")
    && !text.includes("protocol MCP serverRef is live server connection: true")
    && !text.includes("protocol MCP commandRef is shell command: true")
    && !text.includes("protocol MCP endpointRef is network call: true")
    && !text.includes("protocol MCP tool manifest is tool runtime authorization: true")
    && !text.includes("protocol MCP invocation plan is tool execution authorization: true")
    && !text.includes("protocol MCP fake provider is live MCP server: true")
    && !text.includes("protocol MCP invoke method is enabled: true")
    && !text.includes("protocol MCP unknown side effect is auto-approved: true")
    && !text.includes("protocol MCP allowed tool is MCP invocation authorization: true")
    && !text.includes("protocol MCP calls during audit: 1")
    && !text.includes("protocol MCP live server connections during audit: 1")
    && !text.includes("protocol MCP tool runtime calls during audit: 1")
    && !text.includes("protocol MCP provider execute calls during audit: 1")
    && !text.includes("protocol MCP Codex CLI calls during audit: 1")
    && !text.includes("protocol MCP desktop primitive calls during audit: 1")
    && !text.includes("protocol MCP sub-agent runtime calls during audit: 1")
    && !text.includes("protocol MCP host executor calls during audit: 1")
    && !text.includes("protocol MCP host dispatch calls during audit: 1")
    && !text.includes("protocol MCP shell/process calls during audit: 1")
    && !text.includes("protocol MCP network calls during audit: 1")
    && !text.includes("protocol MCP workspace-write calls during audit: 1")
    && !text.includes("protocol MCP external write calls during audit: 1")
    && !text.includes("protocol A2A endpoint ref is network call: true")
    && !text.includes("protocol A2A agent card is remote runtime authorization: true")
    && !text.includes("protocol A2A task skeleton is remote execution authorization: true")
    && !text.includes("protocol A2A artifact URI is fetched by skeleton: true")
    && !text.includes("protocol A2A remote provider is enabled: true")
    && !text.includes("protocol A2A remote provider creates remote tasks: true")
    && !text.includes("protocol A2A fake transport is live network service: true")
    && !text.includes("protocol A2A fake transport submission is runtime authorization: true")
    && !text.includes("protocol A2A anonymous remote invocation allowed: true")
    && !text.includes("protocol A2A auth scheme is capability grant: true")
    && !text.includes("protocol A2A remote-agent provider manifest is sub-agent runtime authorization: true")
    && !text.includes("protocol A2A calls during audit: 1")
    && !text.includes("protocol A2A live network service starts during audit: 1")
    && !text.includes("protocol A2A remote agent runtime calls during audit: 1")
    && !text.includes("protocol A2A remote task creations during audit: 1")
    && !text.includes("protocol A2A provider execute calls during audit: 1")
    && !text.includes("protocol A2A Codex CLI calls during audit: 1")
    && !text.includes("protocol A2A desktop primitive calls during audit: 1")
    && !text.includes("protocol A2A sub-agent runtime calls during audit: 1")
    && !text.includes("protocol A2A host executor calls during audit: 1")
    && !text.includes("protocol A2A host dispatch calls during audit: 1")
    && !text.includes("protocol A2A shell/process calls during audit: 1")
    && !text.includes("protocol A2A network calls during audit: 1")
    && !text.includes("protocol A2A workspace-write calls during audit: 1")
    && !text.includes("protocol A2A external write calls during audit: 1")
    && !text.includes("Agent OS public surfaces SDK call is provider execution authorization: true")
    && !text.includes("Agent OS public surfaces CLI grant flag is provider execution authorization: true")
    && !text.includes("Agent OS public surfaces CLI approve-tool flag is tool runtime authorization: true")
    && !text.includes("Agent OS public surfaces CLI allow-local-mutation is workspace-write execution: true")
    && !text.includes("Agent OS public surfaces preferred provider is Codex CLI invocation: true")
    && !text.includes("Agent OS public surfaces app-server request envelope is capability grant: true")
    && !text.includes("Agent OS public surfaces app-server route is network server: true")
    && !text.includes("Agent OS public surfaces app-server status code is execution receipt: true")
    && !text.includes("Agent OS public surfaces approval permit issue is provider execution authorization: true")
    && !text.includes("Agent OS public surface calls during audit: 1")
    && !text.includes("Agent OS public surface local runtime calls during audit: 1")
    && !text.includes("Agent OS public surface provider execute calls during audit: 1")
    && !text.includes("Agent OS public surface Codex CLI calls during audit: 1")
    && !text.includes("Agent OS public surface desktop primitive calls during audit: 1")
    && !text.includes("Agent OS public surface sub-agent runtime calls during audit: 1")
    && !text.includes("Agent OS public surface host executor calls during audit: 1")
    && !text.includes("Agent OS public surface host dispatch calls during audit: 1")
    && !text.includes("Agent OS public surface shell/process calls during audit: 1")
    && !text.includes("Agent OS public surface network calls during audit: 1")
    && !text.includes("Agent OS public surface workspace-write calls during audit: 1")
    && !text.includes("Agent OS public surface external write calls during audit: 1")
    && !text.includes("preflight ok is execution authorization: true")
    && !text.includes("preflight missing tool check is tool runtime authorization: true")
    && !text.includes("preflight auth available is provider execution authorization: true")
    && !text.includes("preflight workspace clean is workspace-write authorization: true")
    && !text.includes("preflight protected branch check is workspace-write execution: true")
    && !text.includes("preflight memory overview is runtime authorization: true")
    && !text.includes("preflight memory health status is sub-agent runtime authorization: true")
    && !text.includes("preflight memory warning is host executor authorization: true")
    && !text.includes("preflight memory blocking issue is provider execution authorization: true")
    && !text.includes("preflight calls during audit: 1")
    && !text.includes("preflight provider execute calls during audit: 1")
    && !text.includes("preflight Codex CLI calls during audit: 1")
    && !text.includes("preflight desktop primitive calls during audit: 1")
    && !text.includes("preflight sub-agent runtime calls during audit: 1")
    && !text.includes("preflight host executor calls during audit: 1")
    && !text.includes("preflight host dispatch calls during audit: 1")
    && !text.includes("preflight tool runtime calls during audit: 1")
    && !text.includes("preflight shell/process calls during audit: 1")
    && !text.includes("preflight network calls during audit: 1")
    && !text.includes("preflight workspace-write calls during audit: 1")
    && !text.includes("preflight external write calls during audit: 1")
    && !text.includes("execution eligibility eligible status is execution authorization: true")
    && !text.includes("execution eligibility valid approval permit is provider execution authorization: true")
    && !text.includes("execution eligibility capability grant is runtime invocation: true")
    && !text.includes("execution eligibility permit store read is runtime invocation: true")
    && !text.includes("execution eligibility provider plan creation allowed: true")
    && !text.includes("execution eligibility provider execute allowed: true")
    && !text.includes("execution eligibility Codex CLI invocation allowed: true")
    && !text.includes("execution eligibility sub-agent runtime invocation allowed: true")
    && !text.includes("execution eligibility host executor invocation allowed: true")
    && !text.includes("execution eligibility calls during audit: 1")
    && !text.includes("execution eligibility provider execute calls during audit: 1")
    && !text.includes("execution observation status is execution authorization: true")
    && !text.includes("execution observation succeeded is completion authorization: true")
    && !text.includes("execution observation failed is recovery authorization: true")
    && !text.includes("execution observation evidence ref is runtime invocation: true")
    && !text.includes("execution observation ref resolution is replay authorization: true")
    && !text.includes("execution observation record write is workspace-write execution: true")
    && !text.includes("execution observation provider execute allowed: true")
    && !text.includes("execution observation Codex CLI invocation allowed: true")
    && !text.includes("execution observation sub-agent runtime invocation allowed: true")
    && !text.includes("execution observation host executor invocation allowed: true")
    && !text.includes("execution observation host dispatch allowed: true")
    && !text.includes("execution observation bus emits during audit: 1")
    && !text.includes("execution observation store writes during audit: 1")
    && !text.includes("execution observation provider execute calls during audit: 1")
    && !text.includes("execution planner planned status is provider execution authorization: true")
    && !text.includes("execution planner codex-cli provider selection is Codex CLI invocation: true")
    && !text.includes("execution planner remote-agent provider selection is sub-agent runtime invocation: true")
    && !text.includes("execution planner workspace-write side effect class is workspace-write execution: true")
    && !text.includes("execution planner provider planExecution allowed: true")
    && !text.includes("execution planner provider validateExecutionPlan allowed: true")
    && !text.includes("execution planner provider execute allowed: true")
    && !text.includes("execution planner Codex CLI invocation allowed: true")
    && !text.includes("execution planner sub-agent runtime invocation allowed: true")
    && !text.includes("execution planner host executor invocation allowed: true")
    && !text.includes("execution planner calls during audit: 1")
    && !text.includes("execution planner provider execute calls during audit: 1")
    && !text.includes("Codex desktop runtime tool invocation allowed by default: true")
    && !text.includes("Codex desktop live host default runtime tool invocation allowed: true")
    && !text.includes("Codex desktop live host Codex CLI invocation allowed: true")
    && !text.includes("Codex memory MCP client MCP HTTP calls are provider execution: true")
    && !text.includes("Codex memory MCP client MCP HTTP calls are host executor authorization: true")
    && !text.includes("Codex memory MCP client recordMemory is workspace-write execution: true")
    && !text.includes("Codex memory MCP client searchMemory is sub-agent runtime invocation: true")
    && !text.includes("Codex memory MCP client memoryOverview is runtime authorization: true")
    && !text.includes("Codex memory MCP client adapter checkpoint write is execution authorization: true")
    && !text.includes("Codex memory MCP client default endpoint lookup allowed: true")
    && !text.includes("Codex memory MCP client bearer token is execution authorization: true")
    && !text.includes("Codex memory MCP client default Codex CLI invocation allowed: true")
    && !text.includes("Codex memory MCP client provider execute allowed: true")
    && !text.includes("Codex memory MCP client sub-agent runtime invocation allowed: true")
    && !text.includes("Codex memory MCP client shell/process allowed by default: true")
    && !text.includes("Codex memory MCP client workspace-write allowed by default: true")
    && !text.includes("Codex memory MCP client MCP HTTP calls during audit: 1")
    && !text.includes("Codex memory MCP client memory tool calls during audit: 1")
    && !text.includes("Codex memory MCP client host executor invocations during audit: 1")
    && !text.includes("Codex memory MCP client provider execute calls during audit: 1")
    && !text.includes("Codex memory host client memory operation calls are host executor authorization: true")
    && !text.includes("Codex memory host client recordMemory is workspace-write execution: true")
    && !text.includes("Codex memory host client searchMemory is sub-agent runtime invocation: true")
    && !text.includes("Codex memory host client memoryOverview is runtime authorization: true")
    && !text.includes("Codex memory host client adapter checkpoint write is execution authorization: true")
    && !text.includes("Codex memory host client MCP tool-style adapter is default host lookup: true")
    && !text.includes("Codex memory host client default real host execution allowed: true")
    && !text.includes("Codex memory host client default host executor lookup allowed: true")
    && !text.includes("Codex memory host client default Codex CLI invocation allowed: true")
    && !text.includes("Codex memory host client provider execute allowed: true")
    && !text.includes("Codex memory host client sub-agent runtime invocation allowed: true")
    && !text.includes("Codex memory host client shell/process allowed by default: true")
    && !text.includes("Codex memory host client workspace-write allowed by default: true")
    && !text.includes("Codex memory host client calls during audit: 1")
    && !text.includes("Codex memory host client memory operation calls during audit: 1")
    && !text.includes("Codex memory host client host executor invocations during audit: 1")
    && !text.includes("Codex memory host client provider execute calls during audit: 1")
    && !text.includes("desktop host client default real execution allowed: true")
    && !text.includes("desktop host client default host executor lookup allowed: true")
    && !text.includes("desktop host client direct dispatchToHost allowed: true")
    && !text.includes("host client example default real execution allowed: true")
    && !text.includes("host client example real shell/process allowed: true")
    && !text.includes("host client example workspace-write allowed: true")
    && !text.includes("target host embedding placeholder methods are real execution: true")
    && !text.includes("target host embedding scaffold ready status is execution authorization: true")
    && !text.includes("target host embedding createBundle is host executor authorization: true")
    && !text.includes("target host embedding directive builders are shell authorization: true")
    && !text.includes("target host embedding default real host execution allowed: true")
    && !text.includes("target host embedding default host executor lookup allowed: true")
    && !text.includes("target host embedding default Codex CLI invocation allowed: true")
    && !text.includes("target host embedding provider execute allowed: true")
    && !text.includes("target host embedding sub-agent runtime invocation allowed: true")
    && !text.includes("target host embedding shell/process allowed by default: true")
    && !text.includes("target host embedding workspace-write allowed by default: true")
    && !text.includes("target host embedding bundle creations during audit: 1")
    && !text.includes("target host embedding host client run calls during audit: 1")
    && !text.includes("target host embedding host executor invocations during audit: 1")
    && !text.includes("target host embedding provider execute calls during audit: 1")
    && !text.includes("desktop live adapter blocked decision execution allowed: true")
    && !text.includes("desktop live adapter bridge invocation allowed by codex-cli route: true")
    && !text.includes("desktop live adapter provider invocation allowed: true")
    && !text.includes("host dispatcher general provider execution allowed: true")
    && !text.includes("host dispatcher general workspace-write allowed: true")
    && !text.includes("host dispatcher workspace-write provider execute allowed: true")
    && !text.includes("remote agent execution allowed: true")
    && !text.includes("tool runtime invocation allowed: true")
    && !text.includes("host executor default real execution allowed: true")
    && !text.includes("adapter invocations during audit: 1")
    && !text.includes("provider execute calls during audit: 1");
}

function auditItselfIsNonExecuting(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const strategyRouter = input.strategyRouterReview.summary;
  const executionProfiles = input.executionProfilesReview.summary;
  const policyConfig = input.policyConfigReview.summary;
  const capabilityTaxonomy = input.capabilityTaxonomyReview.summary;
  const capabilityTaxonomyEscalationPolicy =
    input.capabilityTaxonomyEscalationPolicyReview.summary;
  const routingEngine = input.routingEngineReview.summary;
  const recoveryControl = input.recoveryControlReview.summary;
  const runtimeControl = input.runtimeControlReview.summary;
  const gate = input.operatorActionExecutorGateReview.summary;
  const codexHost = input.codexCliHostReview.summary;
  const publicApi = input.publicApiReview.summary;
  const agentOsLocalRuntime = input.agentOsLocalRuntimeReview.summary;
  const agentOsMcpServerManifest = input.agentOsMcpServerManifestReview.summary;
  const protocolMcp = input.protocolMcpProviderSkeletonReview.summary;
  const protocolA2a = input.protocolA2aRemoteProviderSkeletonReview.summary;
  const agentOsSdk = input.agentOsSdkReview.summary;
  const agentOsCli = input.agentOsCliReview.summary;
  const agentOsAppServer = input.agentOsAppServerReview.summary;
  const agentOsPublicSurfaces = input.agentOsPublicSurfacesReview.summary;
  const codex = input.codexProviderReview.summary;
  const preflight = input.preflightReview.summary;
  const approvalPermit = input.approvalPermitReview.summary;
  const approvalGate = input.approvalGateReview.summary;
  const approvalConsumptionDispatchMatrix =
    input.approvalConsumptionDispatchMatrixReview.summary;
  const approvalConsumptionDispatch =
    input.approvalConsumptionDispatchReview.summary;
  const readonlyProductization = input.readonlyProductizationReview.summary;
  const stateSync = input.stateSyncReview.summary;
  const workspaceWriteReleaseGate = input.workspaceWriteReleaseGateReview.summary;
  const admissionControl = input.admissionControlReview.summary;
  const delegationPolicy = input.delegationPolicyReview.summary;
  const executionEligibility = input.executionEligibilityReview.summary;
  const executionObservation = input.executionObservationReview.summary;
  const governanceFailureReducer = input.governanceFailureReducerReview.summary;
  const taskGraph = input.taskGraphReview.summary;
  const scheduler = input.schedulerReview.summary;
  const executionPlanner = input.executionPlannerReview.summary;
  const providerRegistry = input.providerRegistryReview.summary;
  const controlledProviderTaskbook =
    input.controlledProviderExecutionTaskbookReview.summary;
  const controlledProviderTaskbookReviewBoundary =
    input.controlledProviderExecutionTaskbookReviewBoundaryReview.summary;
  const controlledProviderDispatchPreflight =
    input.controlledProviderExecutionDispatchPreflightReview.summary;
  const controlledProviderDispatcher =
    input.controlledProviderExecutionDispatcherReview.summary;
  const providerRunner = input.providerExecutionRunnerReview.summary;
  const providerCore = input.providerCorePrimitivesReview.summary;
  const toolInvocationPlanner = input.toolInvocationPlannerReview.summary;
  const desktopAgentStrategy = input.desktopAgentStrategyReview.summary;
  const desktopDecisionRunner = input.desktopDecisionRunnerReview.summary;
  const finalHostLocator = input.finalHostLocatorReview.summary;
  const hostDispatcherProvider = input.hostDispatcherProviderReview.summary;
  const codexDesktopBridge = input.codexDesktopBridgeReview.summary;
  const codexDesktopLiveHost = input.codexDesktopLiveHostReview.summary;
  const codexMemoryMcpClient = input.codexMemoryMcpClientReview.summary;
  const codexMemoryHostClient = input.codexMemoryHostClientReview.summary;
  const desktopHostClient = input.desktopHostClientReview.summary;
  const desktopLiveAdapterDispatch = input.desktopLiveAdapterDispatchReview.summary;
  const hostClientExample = input.hostClientExampleReview.summary;
  const targetHostEmbedding = input.targetHostEmbeddingReview.summary;
  const host = input.hostExecutorReview.summary;
  const hostTaskbook = input.hostExecutorTaskbookReview.summary;
  const hostClientReview = input.hostClientExecutorReviewReview.summary;
  const hostReceipt = input.hostExecutorReceiptReview.summary;
  const agentBacked = input.agentBackedRecoveryExecutorReview.summary;
  const adapterTaskbook = input.agentExecutorAdapterTaskbookReview.summary;
  const adapterReview = input.agentExecutorAdapterReviewReview.summary;
  const adapterSandbox = input.agentExecutorAdapterSandboxReview.summary;
  const taskControlTaskbook = input.agentTaskControlTaskbookReview.summary;
  const taskControlReview = input.agentTaskControlReviewReview.summary;
  const subAgent = input.subAgentRuntimeReview.summary;
  const taskControl = input.agentTaskControlReview.summary;

  return strategyRouter.strategyRouterCallsDuringAudit === 0
    && strategyRouter.providerPlanExecutionCallsDuringAudit === 0
    && strategyRouter.providerValidateExecutionPlanCallsDuringAudit === 0
    && strategyRouter.providerExecuteCallsDuringAudit === 0
    && strategyRouter.codexCliCallsDuringAudit === 0
    && strategyRouter.subAgentRuntimeCallsDuringAudit === 0
    && strategyRouter.hostExecutorCallsDuringAudit === 0
    && strategyRouter.shellProcessCallsDuringAudit === 0
    && strategyRouter.workspaceWriteCallsDuringAudit === 0
    && strategyRouter.externalWriteCallsDuringAudit === 0
    && strategyRouter.executeActionFamilyIsAuthorization === false
    && strategyRouter.writeExecutionPredicateIsAuthorization === false
    && strategyRouter.executorBudgetIsRuntimeInvocation === false
    && strategyRouter.codexCliInvocationAllowedByStrategyRouter === false
    && strategyRouter.providerInvocationAllowedByStrategyRouter === false
    && strategyRouter.subAgentRuntimeInvocationAllowed === false
    && strategyRouter.hostExecutorInvocationAllowed === false
    && executionProfiles.executionProfileLookupsDuringAudit === 0
    && executionProfiles.providerExecuteCallsDuringAudit === 0
    && executionProfiles.codexCliCallsDuringAudit === 0
    && executionProfiles.desktopPrimitiveCallsDuringAudit === 0
    && executionProfiles.subAgentRuntimeCallsDuringAudit === 0
    && executionProfiles.hostExecutorCallsDuringAudit === 0
    && executionProfiles.hostDispatchCallsDuringAudit === 0
    && executionProfiles.toolRuntimeCallsDuringAudit === 0
    && executionProfiles.shellProcessCallsDuringAudit === 0
    && executionProfiles.workspaceWriteCallsDuringAudit === 0
    && executionProfiles.externalWriteCallsDuringAudit === 0
    && executionProfiles.profileStageIsRuntimeStep === false
    && executionProfiles.defaultRoleIsSubAgentRuntimeAuthorization === false
    && executionProfiles.defaultToolAccessIsToolRuntimeAuthorization === false
    && executionProfiles.engineeringWriteToolAccessIsWorkspaceWriteExecution === false
    && executionProfiles.protectedRemoteToolAccessIsExternalWriteAuthorization === false
    && executionProfiles.allowParallelIsSubAgentRuntimeAuthorization === false
    && executionProfiles.maxParallelAgentsIsSubAgentSpawnAuthorization === false
    && executionProfiles.releaseGovernanceProfileIsProtectedRemoteAuthorization === false
    && executionProfiles.profileSelectionIsProviderExecutionAuthorization === false
    && policyConfig.policyLoadCallsDuringAudit === 0
    && policyConfig.providerExecuteCallsDuringAudit === 0
    && policyConfig.codexCliCallsDuringAudit === 0
    && policyConfig.desktopPrimitiveCallsDuringAudit === 0
    && policyConfig.subAgentRuntimeCallsDuringAudit === 0
    && policyConfig.hostExecutorCallsDuringAudit === 0
    && policyConfig.hostDispatchCallsDuringAudit === 0
    && policyConfig.toolRuntimeCallsDuringAudit === 0
    && policyConfig.shellProcessCallsDuringAudit === 0
    && policyConfig.workspaceWriteCallsDuringAudit === 0
    && policyConfig.externalWriteCallsDuringAudit === 0
    && policyConfig.hostRouteIsHostDispatchAuthorization === false
    && policyConfig.codexCliHostRouteIsCodexCliInvocation === false
    && policyConfig.desktopHostRouteIsDesktopRuntimeInvocation === false
    && policyConfig.toolPolicyIsToolRuntimeAuthorization === false
    && policyConfig.protectedRemoteToolPolicyIsExternalWriteAuthorization === false
    && policyConfig.approvalRuleIsApprovalGrant === false
    && policyConfig.memoryHealthBlockIsRuntimeBlockExecution === false
    && policyConfig.memoryGuidanceIsSubAgentRuntimeAuthorization === false
    && policyConfig.telemetryThresholdIsRuntimeAuthorization === false
    && policyConfig.telemetryDeliveryWindowIsHostExecutorAuthorization === false
    && capabilityTaxonomy.providerExecuteCallsDuringAudit === 0
    && capabilityTaxonomy.codexCliCallsDuringAudit === 0
    && capabilityTaxonomy.workspaceWriteCallsDuringAudit === 0
    && capabilityTaxonomy.canaryFileWriteCallsDuringAudit === 0
    && capabilityTaxonomy.generalProviderExecutionCallsDuringAudit === 0
    && capabilityTaxonomy.externalWriteCallsDuringAudit === 0
    && capabilityTaxonomy.releaseCallsDuringAudit === 0
    && capabilityTaxonomy.secretAccessCallsDuringAudit === 0
    && capabilityTaxonomy.shellProcessCallsDuringAudit === 0
    && capabilityTaxonomy.boundedWorkspaceWriteCanaryIsWorkspaceWriteAuthorization === false
    && capabilityTaxonomy.boundedWorkspaceWriteReceiptIsExecutionAuthorization === false
    && capabilityTaxonomy.scopedWorkspaceWriteClassIsWorkspaceWriteExecution === false
    && capabilityTaxonomy.generalWorkspaceWriteClassIsExecutionAuthorization === false
    && capabilityTaxonomy.generalProviderExecutionClassIsProviderExecuteAuthorization === false
    && capabilityTaxonomy.externalWriteClassIsExternalWriteAuthorization === false
    && capabilityTaxonomy.releaseOrDeployClassIsReleaseAuthorization === false
    && capabilityTaxonomy.secretCredentialChangeClassIsSecretAccessAuthorization === false
    && capabilityTaxonomy.capabilityEscalationPolicyIsRuntimeAuthorization === false
    && capabilityTaxonomy.canaryEvidenceBaselineIsExecutionAuthorization === false
    && capabilityTaxonomyEscalationPolicy.providerExecuteCallsDuringAudit === 0
    && capabilityTaxonomyEscalationPolicy.codexCliCallsDuringAudit === 0
    && capabilityTaxonomyEscalationPolicy.workspaceWriteCallsDuringAudit === 0
    && capabilityTaxonomyEscalationPolicy.hostExecutorCallsDuringAudit === 0
    && capabilityTaxonomyEscalationPolicy.subAgentRuntimeCallsDuringAudit === 0
    && capabilityTaxonomyEscalationPolicy.toolRuntimeCallsDuringAudit === 0
    && capabilityTaxonomyEscalationPolicy.shellProcessCallsDuringAudit === 0
    && capabilityTaxonomyEscalationPolicy.externalWriteCallsDuringAudit === 0
    && capabilityTaxonomyEscalationPolicy.releaseCallsDuringAudit === 0
    && capabilityTaxonomyEscalationPolicy.secretAccessCallsDuringAudit === 0
    && capabilityTaxonomyEscalationPolicy.escalationPolicyIsProviderExecuteAuthorization === false
    && capabilityTaxonomyEscalationPolicy.escalationPolicyIsCodexCliAuthorization === false
    && capabilityTaxonomyEscalationPolicy.escalationPolicyIsWorkspaceWriteAuthorization === false
    && capabilityTaxonomyEscalationPolicy.escalationPolicyIsHostExecutorAuthorization === false
    && capabilityTaxonomyEscalationPolicy.escalationPolicyIsSubAgentRuntimeAuthorization === false
    && capabilityTaxonomyEscalationPolicy.escalationPolicyIsToolRuntimeAuthorization === false
    && capabilityTaxonomyEscalationPolicy.escalationPolicyIsExternalWriteAuthorization === false
    && capabilityTaxonomyEscalationPolicy.escalationPolicyIsReleaseAuthorization === false
    && capabilityTaxonomyEscalationPolicy.escalationPolicyIsSecretAccessAuthorization === false
    && capabilityTaxonomyEscalationPolicy.blockedCapabilityClassIsRuntimeBlockExecution === false
    && capabilityTaxonomyEscalationPolicy.severityIsRuntimeAuthorization === false
    && capabilityTaxonomyEscalationPolicy.statusIsExecutionAuthorization === false
    && routingEngine.routingEngineCallsDuringAudit === 0
    && routingEngine.providerGrantCreationsDuringAudit === 0
    && routingEngine.providerExecuteCallsDuringAudit === 0
    && routingEngine.codexCliCallsDuringAudit === 0
    && routingEngine.desktopRuntimeCallsDuringAudit === 0
    && routingEngine.subAgentRuntimeCallsDuringAudit === 0
    && routingEngine.hostExecutorCallsDuringAudit === 0
    && routingEngine.hostDispatchCallsDuringAudit === 0
    && routingEngine.toolRuntimeCallsDuringAudit === 0
    && routingEngine.shellProcessCallsDuringAudit === 0
    && routingEngine.workspaceWriteCallsDuringAudit === 0
    && routingEngine.externalWriteCallsDuringAudit === 0
    && routingEngine.routingDecisionIsExecutionAuthorization === false
    && routingEngine.hostRouteIsHostDispatchAuthorization === false
    && routingEngine.providerGrantIsProviderExecuteAuthorization === false
    && routingEngine.codexCliProviderIdIsCodexCliInvocation === false
    && routingEngine.desktopProviderIdIsDesktopRuntimeInvocation === false
    && routingEngine.sandboxModeIsWorkspaceWriteExecution === false
    && routingEngine.toolAccessIsToolRuntimeAuthorization === false
    && routingEngine.approvalRequiredIsApprovalGrant === false
    && routingEngine.riskScoreIsRuntimeAuthorization === false
    && routingEngine.parallelismAllowedIsSubAgentRuntimeAuthorization === false
    && recoveryControl.recoveryControlCallsDuringAudit === 0
    && recoveryControl.hostExecutorInvocationsDuringAudit === 0
    && recoveryControl.adapterInvocationsDuringAudit === 0
    && recoveryControl.codexCliCallsDuringAudit === 0
    && recoveryControl.providerExecuteCallsDuringAudit === 0
    && recoveryControl.subAgentRuntimeCallsDuringAudit === 0
    && recoveryControl.shellProcessCallsDuringAudit === 0
    && recoveryControl.workspaceWriteCallsDuringAudit === 0
    && recoveryControl.externalWriteCallsDuringAudit === 0
    && recoveryControl.schemaStatusIsExecutionAuthorization === false
    && recoveryControl.executionPlanIsRecoveryExecutionAuthorization === false
    && recoveryControl.executionGateIsRuntimeAuthorization === false
    && recoveryControl.hostExecutorReviewIsHostDispatchAuthorization === false
    && recoveryControl.dispatchAuthorizationReviewIsAdapterInvocationAuthorization === false
    && recoveryControl.taskControlReviewIsSubAgentRuntimeAuthorization === false
    && recoveryControl.sandboxWitnessIsProductionRecoveryExecution === false
    && recoveryControl.receiptStatusIsCompletionAuthorization === false
    && recoveryControl.recoveryRecommendationIsHostExecutorAuthorization === false
    && runtimeControl.runtimeControlCallsDuringAudit === 0
    && runtimeControl.providerExecuteCallsDuringAudit === 0
    && runtimeControl.codexCliCallsDuringAudit === 0
    && runtimeControl.subAgentRuntimeCallsDuringAudit === 0
    && runtimeControl.hostExecutorCallsDuringAudit === 0
    && runtimeControl.hostDispatchCallsDuringAudit === 0
    && runtimeControl.modelRuntimeCallsDuringAudit === 0
    && runtimeControl.shellProcessCallsDuringAudit === 0
    && runtimeControl.workspaceWriteCallsDuringAudit === 0
    && runtimeControl.externalWriteCallsDuringAudit === 0
    && runtimeControl.runtimeSignalIsExecutionAuthorization === false
    && runtimeControl.escalationOutcomeIsProviderExecutionAuthorization === false
    && runtimeControl.upgradeModelIsModelRuntimeInvocation === false
    && runtimeControl.openCircuitIsHostDispatchAuthorization === false
    && runtimeControl.failureCountIsRecoveryExecutionAuthorization === false
    && runtimeControl.contextPressureIsSubAgentRuntimeAuthorization === false
    && runtimeControl.highRiskSignalIsCodexCliAuthorization === false
    && gate.hostExecutorInvocationsDuringAudit === 0
    && gate.recoveryActionExecutionsDuringAudit === 0
    && gate.codexCliCallsDuringAudit === 0
    && gate.providerExecuteCallsDuringAudit === 0
    && gate.subAgentRuntimeCallsDuringAudit === 0
    && gate.shellProcessCallsDuringAudit === 0
    && gate.workspaceWriteCallsDuringAudit === 0
    && gate.externalWriteCallsDuringAudit === 0
    && gate.executionAuthorizedByGate === false
    && gate.hostExecutorInvocationAllowed === false
    && gate.recoveryActionExecutionAllowed === false
    && gate.codexCliInvocationAllowed === false
    && gate.providerExecutionAllowed === false
    && gate.subAgentRuntimeInvocationAllowed === false
    && gate.shellProcessAllowed === false
    && gate.workspaceWriteAllowed === false
    && gate.externalWriteAllowed === false
    && codexHost.codexCliProcessSpawnsDuringAudit === 0
    && codexHost.evidenceWritesDuringAudit === 0
    && codexHost.workspaceWriteCallsDuringAudit === 0
    && codexHost.externalWriteCallsDuringAudit === 0
    && codexHost.defaultRealCodexCliAllowedByBoundaryAudit === false
    && codexHost.shellFallbackAllowed === false
    && codexHost.subAgentRuntimeInvocationAllowed === false
    && codexHost.hostExecutorInvocationAllowed === false
    && codexHost.providerExecutionAllowedByHostBoundary === false
    && publicApi.publicApiCallsDuringAudit === 0
    && publicApi.hostExecutorInvocationsDuringAudit === 0
    && publicApi.providerExecuteCallsDuringAudit === 0
    && publicApi.codexCliCallsDuringAudit === 0
    && publicApi.subAgentRuntimeCallsDuringAudit === 0
    && publicApi.workspaceWriteCallsDuringAudit === 0
    && publicApi.externalWriteCallsDuringAudit === 0
    && publicApi.internalGovernanceTopLevelExportsAllowed === false
    && publicApi.directHostExecutorDispatchExportAllowed === false
    && publicApi.providerExecuteExportAllowed === false
    && publicApi.codexCliHostRunExportAllowed === false
    && publicApi.subAgentRuntimeExportAllowed === false
    && publicApi.workspaceWriteGuardExportAllowed === false
    && agentOsLocalRuntime.localRuntimeCallsDuringAudit === 0
    && agentOsLocalRuntime.providerExecuteCallsDuringAudit === 0
    && agentOsLocalRuntime.codexCliCallsDuringAudit === 0
    && agentOsLocalRuntime.subAgentRuntimeCallsDuringAudit === 0
    && agentOsLocalRuntime.hostExecutorCallsDuringAudit === 0
    && agentOsLocalRuntime.workspaceWriteCallsDuringAudit === 0
    && agentOsLocalRuntime.externalWriteCallsDuringAudit === 0
    && agentOsLocalRuntime.realProviderExecutionAllowed === false
    && agentOsLocalRuntime.codexCliInvocationAllowed === false
    && agentOsLocalRuntime.subAgentRuntimeInvocationAllowed === false
    && agentOsLocalRuntime.hostExecutorInvocationAllowed === false
    && agentOsLocalRuntime.controlledWorkspaceWriteDispatchAllowed === true
    && agentOsLocalRuntime.generalWorkspaceWriteExecutionAllowed === false
    && agentOsLocalRuntime.workspaceWriteProviderExecuteAllowed === false
    && agentOsMcpServerManifest.agentOsMcpServerManifestCallsDuringAudit === 0
    && agentOsMcpServerManifest.liveMcpServerStartsDuringAudit === 0
    && agentOsMcpServerManifest.localRuntimeCallsDuringAudit === 0
    && agentOsMcpServerManifest.toolRuntimeCallsDuringAudit === 0
    && agentOsMcpServerManifest.providerExecuteCallsDuringAudit === 0
    && agentOsMcpServerManifest.codexCliCallsDuringAudit === 0
    && agentOsMcpServerManifest.desktopPrimitiveCallsDuringAudit === 0
    && agentOsMcpServerManifest.subAgentRuntimeCallsDuringAudit === 0
    && agentOsMcpServerManifest.hostExecutorCallsDuringAudit === 0
    && agentOsMcpServerManifest.hostDispatchCallsDuringAudit === 0
    && agentOsMcpServerManifest.shellProcessCallsDuringAudit === 0
    && agentOsMcpServerManifest.networkCallsDuringAudit === 0
    && agentOsMcpServerManifest.workspaceWriteCallsDuringAudit === 0
    && agentOsMcpServerManifest.externalWriteCallsDuringAudit === 0
    && agentOsMcpServerManifest.runtimeImplementedMeansLiveServer === false
    && agentOsMcpServerManifest.toolManifestIsToolRuntimeAuthorization === false
    && agentOsMcpServerManifest.requiredCapabilityIsCapabilityGrant === false
    && agentOsMcpServerManifest.approvalRequiredIsApprovalGrant === false
    && agentOsMcpServerManifest.localWriteSideEffectIsWorkspaceWriteExecution === false
    && agentOsMcpServerManifest.providerPlanningOutputIsProviderExecutionAuthorization === false
    && agentOsMcpServerManifest.approvalPermitOutputIsProviderExecutionAuthorization === false
    && agentOsMcpServerManifest.listedToolIsMcpToolInvocation === false
    && agentOsMcpServerManifest.manifestExportIsPublicExecutionSurface === false
    && protocolMcp.protocolMcpCallsDuringAudit === 0
    && protocolMcp.liveMcpServerConnectionsDuringAudit === 0
    && protocolMcp.toolRuntimeCallsDuringAudit === 0
    && protocolMcp.providerExecuteCallsDuringAudit === 0
    && protocolMcp.codexCliCallsDuringAudit === 0
    && protocolMcp.desktopPrimitiveCallsDuringAudit === 0
    && protocolMcp.subAgentRuntimeCallsDuringAudit === 0
    && protocolMcp.hostExecutorCallsDuringAudit === 0
    && protocolMcp.hostDispatchCallsDuringAudit === 0
    && protocolMcp.shellProcessCallsDuringAudit === 0
    && protocolMcp.networkCallsDuringAudit === 0
    && protocolMcp.workspaceWriteCallsDuringAudit === 0
    && protocolMcp.externalWriteCallsDuringAudit === 0
    && protocolMcp.serverRefIsLiveServerConnection === false
    && protocolMcp.commandRefIsShellCommand === false
    && protocolMcp.endpointRefIsNetworkCall === false
    && protocolMcp.toolManifestIsToolRuntimeAuthorization === false
    && protocolMcp.invocationPlanIsToolExecutionAuthorization === false
    && protocolMcp.fakeProviderIsLiveMcpServer === false
    && protocolMcp.invokeMethodIsEnabled === false
    && protocolMcp.unknownSideEffectIsAutoApproved === false
    && protocolMcp.allowedToolIsMcpInvocationAuthorization === false
    && protocolA2a.protocolA2aCallsDuringAudit === 0
    && protocolA2a.liveNetworkServiceStartsDuringAudit === 0
    && protocolA2a.remoteAgentRuntimeCallsDuringAudit === 0
    && protocolA2a.remoteTaskCreationsDuringAudit === 0
    && protocolA2a.providerExecuteCallsDuringAudit === 0
    && protocolA2a.codexCliCallsDuringAudit === 0
    && protocolA2a.desktopPrimitiveCallsDuringAudit === 0
    && protocolA2a.subAgentRuntimeCallsDuringAudit === 0
    && protocolA2a.hostExecutorCallsDuringAudit === 0
    && protocolA2a.hostDispatchCallsDuringAudit === 0
    && protocolA2a.shellProcessCallsDuringAudit === 0
    && protocolA2a.networkCallsDuringAudit === 0
    && protocolA2a.workspaceWriteCallsDuringAudit === 0
    && protocolA2a.externalWriteCallsDuringAudit === 0
    && protocolA2a.endpointRefIsNetworkCall === false
    && protocolA2a.agentCardIsRemoteRuntimeAuthorization === false
    && protocolA2a.taskSkeletonIsRemoteExecutionAuthorization === false
    && protocolA2a.artifactUriIsFetchedBySkeleton === false
    && protocolA2a.remoteProviderIsEnabled === false
    && protocolA2a.remoteProviderCreatesRemoteTasks === false
    && protocolA2a.fakeTransportIsLiveNetworkService === false
    && protocolA2a.fakeTransportSubmissionIsRuntimeAuthorization === false
    && protocolA2a.anonymousRemoteInvocationAllowed === false
    && protocolA2a.authSchemeIsCapabilityGrant === false
    && protocolA2a.remoteAgentProviderManifestIsSubAgentRuntimeAuthorization === false
    && agentOsSdk.sdkCallsDuringAudit === 0
    && agentOsSdk.localRuntimeCallsDuringAudit === 0
    && agentOsSdk.providerExecuteCallsDuringAudit === 0
    && agentOsSdk.codexCliCallsDuringAudit === 0
    && agentOsSdk.desktopPrimitiveCallsDuringAudit === 0
    && agentOsSdk.subAgentRuntimeCallsDuringAudit === 0
    && agentOsSdk.hostExecutorCallsDuringAudit === 0
    && agentOsSdk.hostDispatchCallsDuringAudit === 0
    && agentOsSdk.shellProcessCallsDuringAudit === 0
    && agentOsSdk.networkCallsDuringAudit === 0
    && agentOsSdk.workspaceWriteCallsDuringAudit === 0
    && agentOsSdk.externalWriteCallsDuringAudit === 0
    && agentOsSdk.sdkCallIsProviderExecutionAuthorization === false
    && agentOsSdk.sdkGrantInputIsCapabilityGrant === false
    && agentOsSdk.sdkApproveToolInputIsToolRuntimeAuthorization === false
    && agentOsSdk.sdkAllowLocalMutationIsWorkspaceWriteExecution === false
    && agentOsSdk.preferredProviderIsCodexCliInvocation === false
    && agentOsSdk.localRuntimeCallIsProviderExecutionAuthorization === false
    && agentOsSdk.approvalPermitIssueIsProviderExecutionAuthorization === false
    && agentOsSdk.approvalPermitConsumptionIsProviderExecutionAuthorization === false
    && agentOsSdk.realProviderExecutionInvoked === false
    && agentOsCli.cliWrapperCallsDuringAudit === 0
    && agentOsCli.localRuntimeCallsDuringAudit === 0
    && agentOsCli.providerExecuteCallsDuringAudit === 0
    && agentOsCli.codexCliCallsDuringAudit === 0
    && agentOsCli.desktopPrimitiveCallsDuringAudit === 0
    && agentOsCli.subAgentRuntimeCallsDuringAudit === 0
    && agentOsCli.hostExecutorCallsDuringAudit === 0
    && agentOsCli.hostDispatchCallsDuringAudit === 0
    && agentOsCli.shellProcessCallsDuringAudit === 0
    && agentOsCli.networkCallsDuringAudit === 0
    && agentOsCli.workspaceWriteCallsDuringAudit === 0
    && agentOsCli.externalWriteCallsDuringAudit === 0
    && agentOsCli.cliGrantFlagIsCapabilityGrant === false
    && agentOsCli.cliApproveToolFlagIsToolRuntimeAuthorization === false
    && agentOsCli.cliAllowLocalMutationIsWorkspaceWriteExecution === false
    && agentOsCli.preferredProviderIsCodexCliInvocation === false
    && agentOsCli.parsedCommandIsProviderExecutionAuthorization === false
    && agentOsCli.localRuntimeCallIsProviderExecutionAuthorization === false
    && agentOsCli.approvalPermitIssueIsProviderExecutionAuthorization === false
    && agentOsCli.approvalPermitConsumptionIsProviderExecutionAuthorization === false
    && agentOsCli.sanitizedArgvContainsRawSecrets === false
    && agentOsAppServer.appServerWrapperCallsDuringAudit === 0
    && agentOsAppServer.localRuntimeCallsDuringAudit === 0
    && agentOsAppServer.liveHttpServerStartsDuringAudit === 0
    && agentOsAppServer.networkCallsDuringAudit === 0
    && agentOsAppServer.providerExecuteCallsDuringAudit === 0
    && agentOsAppServer.codexCliCallsDuringAudit === 0
    && agentOsAppServer.desktopPrimitiveCallsDuringAudit === 0
    && agentOsAppServer.subAgentRuntimeCallsDuringAudit === 0
    && agentOsAppServer.hostExecutorCallsDuringAudit === 0
    && agentOsAppServer.hostDispatchCallsDuringAudit === 0
    && agentOsAppServer.shellProcessCallsDuringAudit === 0
    && agentOsAppServer.workspaceWriteCallsDuringAudit === 0
    && agentOsAppServer.externalWriteCallsDuringAudit === 0
    && agentOsAppServer.requestEnvelopeIsCapabilityGrant === false
    && agentOsAppServer.routeIsLiveNetworkServer === false
    && agentOsAppServer.statusCodeIsHostExecutorReceipt === false
    && agentOsAppServer.clientGateFieldsAreTrusted === false
    && agentOsAppServer.serverSideOptionsAreClientControlled === false
    && agentOsAppServer.localRuntimeCallIsProviderExecutionAuthorization === false
    && agentOsAppServer.approvalPermitIssueIsProviderExecutionAuthorization === false
    && agentOsAppServer.approvalPermitConsumptionIsProviderExecutionAuthorization === false
    && agentOsAppServer.liveHttpServerStarted === false
    && agentOsAppServer.networkAccessed === false
    && agentOsAppServer.realProviderExecutionInvoked === false
    && agentOsPublicSurfaces.agentOsPublicSurfaceCallsDuringAudit === 0
    && agentOsPublicSurfaces.localRuntimeCallsDuringAudit === 0
    && agentOsPublicSurfaces.providerExecuteCallsDuringAudit === 0
    && agentOsPublicSurfaces.codexCliCallsDuringAudit === 0
    && agentOsPublicSurfaces.desktopPrimitiveCallsDuringAudit === 0
    && agentOsPublicSurfaces.subAgentRuntimeCallsDuringAudit === 0
    && agentOsPublicSurfaces.hostExecutorCallsDuringAudit === 0
    && agentOsPublicSurfaces.hostDispatchCallsDuringAudit === 0
    && agentOsPublicSurfaces.shellProcessCallsDuringAudit === 0
    && agentOsPublicSurfaces.networkCallsDuringAudit === 0
    && agentOsPublicSurfaces.workspaceWriteCallsDuringAudit === 0
    && agentOsPublicSurfaces.externalWriteCallsDuringAudit === 0
    && agentOsPublicSurfaces.sdkCallIsProviderExecutionAuthorization === false
    && agentOsPublicSurfaces.cliGrantFlagIsProviderExecutionAuthorization === false
    && agentOsPublicSurfaces.cliApproveToolFlagIsToolRuntimeAuthorization === false
    && agentOsPublicSurfaces.cliAllowLocalMutationIsWorkspaceWriteExecution === false
    && agentOsPublicSurfaces.preferredProviderIsCodexCliInvocation === false
    && agentOsPublicSurfaces.appServerRequestEnvelopeIsCapabilityGrant === false
    && agentOsPublicSurfaces.appServerRouteIsNetworkServer === false
    && agentOsPublicSurfaces.appServerStatusCodeIsExecutionReceipt === false
    && agentOsPublicSurfaces.approvalPermitIssueIsProviderExecutionAuthorization === false
    && codex.providerExecuteCallsDuringAudit === 0
    && codex.realCodexCliCallsDuringAudit === 0
    && codex.workspaceWriteCallsDuringAudit === 0
    && codex.externalWriteCallsDuringAudit === 0
    && preflight.preflightCallsDuringAudit === 0
    && preflight.providerExecuteCallsDuringAudit === 0
    && preflight.codexCliCallsDuringAudit === 0
    && preflight.desktopPrimitiveCallsDuringAudit === 0
    && preflight.subAgentRuntimeCallsDuringAudit === 0
    && preflight.hostExecutorCallsDuringAudit === 0
    && preflight.hostDispatchCallsDuringAudit === 0
    && preflight.toolRuntimeCallsDuringAudit === 0
    && preflight.shellProcessCallsDuringAudit === 0
    && preflight.networkCallsDuringAudit === 0
    && preflight.workspaceWriteCallsDuringAudit === 0
    && preflight.externalWriteCallsDuringAudit === 0
    && preflight.preflightOkIsExecutionAuthorization === false
    && preflight.missingToolCheckIsToolRuntimeAuthorization === false
    && preflight.authAvailableIsProviderExecutionAuthorization === false
    && preflight.workspaceCleanIsWorkspaceWriteAuthorization === false
    && preflight.protectedBranchCheckIsWorkspaceWriteExecution === false
    && preflight.memoryOverviewIsRuntimeAuthorization === false
    && preflight.memoryHealthStatusIsSubAgentRuntimeAuthorization === false
    && preflight.memoryWarningIsHostExecutorAuthorization === false
    && preflight.memoryBlockingIssueIsProviderExecutionAuthorization === false
    && approvalPermit.approvalPermitCallsDuringAudit === 0
    && approvalPermit.permitValidationCallsDuringAudit === 0
    && approvalPermit.providerExecuteCallsDuringAudit === 0
    && approvalPermit.codexCliCallsDuringAudit === 0
    && approvalPermit.subAgentRuntimeCallsDuringAudit === 0
    && approvalPermit.hostExecutorCallsDuringAudit === 0
    && approvalPermit.toolRuntimeCallsDuringAudit === 0
    && approvalPermit.shellProcessCallsDuringAudit === 0
    && approvalPermit.workspaceWriteCallsDuringAudit === 0
    && approvalPermit.externalWriteCallsDuringAudit === 0
    && approvalPermit.validPermitIsProviderExecutionAuthorization === false
    && approvalPermit.validPermitIsCodexCliAuthorization === false
    && approvalPermit.validPermitIsSubAgentRuntimeAuthorization === false
    && approvalPermit.validPermitIsHostExecutorAuthorization === false
    && approvalPermit.validPermitIsToolRuntimeAuthorization === false
    && approvalPermit.shellCapabilityScopeIsShellExecution === false
    && approvalPermit.externalCapabilityScopeIsExternalWriteExecution === false
    && approvalPermit.storePersistenceIsWorkspaceWriteExecution === false
    && approvalGate.approvalGateCallsDuringAudit === 0
    && approvalGate.approvalResolutionChecksDuringAudit === 0
    && approvalGate.providerExecuteCallsDuringAudit === 0
    && approvalGate.codexCliCallsDuringAudit === 0
    && approvalGate.subAgentRuntimeCallsDuringAudit === 0
    && approvalGate.hostExecutorCallsDuringAudit === 0
    && approvalGate.toolRuntimeCallsDuringAudit === 0
    && approvalGate.shellProcessCallsDuringAudit === 0
    && approvalGate.workspaceWriteCallsDuringAudit === 0
    && approvalGate.externalWriteCallsDuringAudit === 0
    && approvalGate.approvalNotRequiredIsExecutionAuthorization === false
    && approvalGate.approvalResolvedIsProviderExecutionAuthorization === false
    && approvalGate.approvalResolvedIsCodexCliAuthorization === false
    && approvalGate.approvalResolvedIsSubAgentRuntimeAuthorization === false
    && approvalGate.approvalResolvedIsHostExecutorAuthorization === false
    && approvalGate.approvalResolvedIsToolRuntimeAuthorization === false
    && approvalGate.pendingGateIsRuntimeInvocation === false
    && approvalGate.protectedBranchSignalIsWorkspaceWriteExecution === false
    && approvalGate.dirtyWorkspaceSignalIsWorkspaceWriteExecution === false
    && approvalGate.protectedKeywordSignalIsExternalWriteExecution === false
    && approvalConsumptionDispatchMatrix.matrixAuditIsProviderExecuteAuthorization === false
    && approvalConsumptionDispatchMatrix.matrixAuditIsRealCodexCliAuthorization === false
    && approvalConsumptionDispatchMatrix.matrixAuditIsWorkspaceWriteAuthorization === false
    && approvalConsumptionDispatchMatrix.matrixAuditIsLocalCommandAuthorization === false
    && approvalConsumptionDispatchMatrix.matrixAuditIsHostExecutorAuthorization === false
    && approvalConsumptionDispatchMatrix.matrixAuditIsSubAgentRuntimeAuthorization === false
    && approvalConsumptionDispatchMatrix.matrixAuditIsToolRuntimeAuthorization === false
    && approvalConsumptionDispatchMatrix.matrixAuditIsExternalWriteAuthorization === false
    && approvalConsumptionDispatchMatrix.matrixAuditIsReleaseAuthorization === false
    && approvalConsumptionDispatchMatrix.matrixAuditGitStateIsExecutionAuthorization === false
    && approvalConsumptionDispatchMatrix.matrixAuditWorktreeCleanIsProviderExecutionAuthorization === false
    && approvalConsumptionDispatchMatrix.providerExecuteCallsDuringBoundaryAudit === 0
    && approvalConsumptionDispatchMatrix.codexCliCallsDuringBoundaryAudit === 0
    && approvalConsumptionDispatchMatrix.workspaceWriteCallsDuringBoundaryAudit === 0
    && approvalConsumptionDispatchMatrix.hostExecutorCallsDuringBoundaryAudit === 0
    && approvalConsumptionDispatchMatrix.subAgentRuntimeCallsDuringBoundaryAudit === 0
    && approvalConsumptionDispatchMatrix.toolRuntimeCallsDuringBoundaryAudit === 0
    && approvalConsumptionDispatchMatrix.shellProcessCallsDuringBoundaryAudit === 0
    && approvalConsumptionDispatchMatrix.externalWriteCallsDuringBoundaryAudit === 0
    && approvalConsumptionDispatch.matrixIsProviderExecuteAuthorization === false
    && approvalConsumptionDispatch.matrixIsRealCodexCliAuthorization === false
    && approvalConsumptionDispatch.matrixIsWorkspaceWriteAuthorization === false
    && approvalConsumptionDispatch.matrixIsLocalCommandAuthorization === false
    && approvalConsumptionDispatch.matrixIsHostExecutorAuthorization === false
    && approvalConsumptionDispatch.matrixIsSubAgentRuntimeAuthorization === false
    && approvalConsumptionDispatch.matrixIsExternalWriteAuthorization === false
    && approvalConsumptionDispatch.matrixIsReleaseAuthorization === false
    && approvalConsumptionDispatch.approvalPermitConsumptionIsProviderExecutionAuthorization === false
    && approvalConsumptionDispatch.hostDispatcherPreconditionIsProviderExecuteAuthorization === false
    && approvalConsumptionDispatch.redactionCoverageIsRuntimeAuthorization === false
    && approvalConsumptionDispatch.providerExecuteCallsDuringAudit === 0
    && approvalConsumptionDispatch.codexCliCallsDuringAudit === 0
    && approvalConsumptionDispatch.workspaceWriteCallsDuringAudit === 0
    && approvalConsumptionDispatch.hostExecutorCallsDuringAudit === 0
    && approvalConsumptionDispatch.subAgentRuntimeCallsDuringAudit === 0
    && approvalConsumptionDispatch.shellProcessCallsDuringAudit === 0
    && approvalConsumptionDispatch.externalWriteCallsDuringAudit === 0
    && readonlyProductization.readonlyProductizationIsProviderExecuteAuthorization === false
    && readonlyProductization.readonlyProductizationIsRealCodexCliAuthorization === false
    && readonlyProductization.readonlyProductizationIsWorkspaceWriteAuthorization === false
    && readonlyProductization.readonlyProductizationIsLocalCommandAuthorization === false
    && readonlyProductization.readonlyProductizationIsHostExecutorAuthorization === false
    && readonlyProductization.readonlyProductizationIsSubAgentRuntimeAuthorization === false
    && readonlyProductization.readonlyProductizationIsToolRuntimeAuthorization === false
    && readonlyProductization.readonlyProductizationIsExternalWriteAuthorization === false
    && readonlyProductization.readonlyProductizationIsEvidenceRefreshAuthorization === false
    && readonlyProductization.readonlyProductizationIsReleaseAuthorization === false
    && readonlyProductization.readonlyProductizationGitStateIsExecutionAuthorization === false
    && readonlyProductization.readonlyProductizationWorktreeCleanIsProviderExecutionAuthorization === false
    && readonlyProductization.providerExecuteCallsDuringBoundaryAudit === 0
    && readonlyProductization.codexCliCallsDuringBoundaryAudit === 0
    && readonlyProductization.workspaceWriteCallsDuringBoundaryAudit === 0
    && readonlyProductization.hostExecutorCallsDuringBoundaryAudit === 0
    && readonlyProductization.subAgentRuntimeCallsDuringBoundaryAudit === 0
    && readonlyProductization.toolRuntimeCallsDuringBoundaryAudit === 0
    && readonlyProductization.shellProcessCallsDuringBoundaryAudit === 0
    && readonlyProductization.externalWriteCallsDuringBoundaryAudit === 0
    && readonlyProductization.evidenceWritesDuringBoundaryAudit === 0
    && stateSync.stateSyncIsProviderExecuteAuthorization === false
    && stateSync.stateSyncIsRealCodexCliAuthorization === false
    && stateSync.stateSyncIsWorkspaceWriteAuthorization === false
    && stateSync.stateSyncIsLocalCommandAuthorization === false
    && stateSync.stateSyncIsHostExecutorAuthorization === false
    && stateSync.stateSyncIsSubAgentRuntimeAuthorization === false
    && stateSync.stateSyncIsToolRuntimeAuthorization === false
    && stateSync.stateSyncIsExternalWriteAuthorization === false
    && stateSync.stateSyncIsEvidenceRefreshAuthorization === false
    && stateSync.stateSyncIsPushAuthorization === false
    && stateSync.stateSyncIsReleaseAuthorization === false
    && stateSync.stateSyncGitStateIsExecutionAuthorization === false
    && stateSync.stateSyncCleanWorktreeIsProviderExecutionAuthorization === false
    && stateSync.stateSyncPolicyV2IsExecutionAuthorization === false
    && stateSync.providerExecuteCallsDuringBoundaryAudit === 0
    && stateSync.codexCliCallsDuringBoundaryAudit === 0
    && stateSync.workspaceWriteCallsDuringBoundaryAudit === 0
    && stateSync.localCommandCallsDuringBoundaryAudit === 0
    && stateSync.hostExecutorCallsDuringBoundaryAudit === 0
    && stateSync.subAgentRuntimeCallsDuringBoundaryAudit === 0
    && stateSync.toolRuntimeCallsDuringBoundaryAudit === 0
    && stateSync.externalWriteCallsDuringBoundaryAudit === 0
    && stateSync.stateWritesDuringBoundaryAudit === 0
    && stateSync.remoteWritesDuringBoundaryAudit === 0
    && workspaceWriteReleaseGate.workspaceWriteReleaseGateIsWorkspaceWriteAuthorization === false
    && workspaceWriteReleaseGate.workspaceWriteReleaseGateIsRealCodexCliAuthorization === false
    && workspaceWriteReleaseGate.workspaceWriteReleaseGateIsProviderExecutionAuthorization === false
    && workspaceWriteReleaseGate.workspaceWriteReleaseGateIsHostExecutorAuthorization === false
    && workspaceWriteReleaseGate.workspaceWriteReleaseGateIsSubAgentRuntimeAuthorization === false
    && workspaceWriteReleaseGate.workspaceWriteReleaseGateIsExternalWriteAuthorization === false
    && workspaceWriteReleaseGate.workspaceWriteReleaseGateIsPushAuthorization === false
    && workspaceWriteReleaseGate.workspaceWriteReleaseGateIsReleaseAuthorization === false
    && workspaceWriteReleaseGate.providerExecuteCallsDuringAudit === 0
    && workspaceWriteReleaseGate.codexCliCallsDuringAudit === 0
    && workspaceWriteReleaseGate.workspaceWriteCallsDuringAudit === 0
    && workspaceWriteReleaseGate.hostExecutorCallsDuringAudit === 0
    && workspaceWriteReleaseGate.subAgentRuntimeCallsDuringAudit === 0
    && workspaceWriteReleaseGate.externalWriteCallsDuringAudit === 0
    && workspaceWriteReleaseGate.evidenceWritesDuringAudit === 0
    && admissionControl.admissionControlCallsDuringAudit === 0
    && admissionControl.providerExecuteCallsDuringAudit === 0
    && admissionControl.codexCliCallsDuringAudit === 0
    && admissionControl.subAgentRuntimeCallsDuringAudit === 0
    && admissionControl.hostExecutorCallsDuringAudit === 0
    && admissionControl.toolRuntimeCallsDuringAudit === 0
    && admissionControl.shellProcessCallsDuringAudit === 0
    && admissionControl.workspaceWriteCallsDuringAudit === 0
    && admissionControl.externalWriteCallsDuringAudit === 0
    && admissionControl.acceptedStatusIsExecutionAuthorization === false
    && admissionControl.needsApprovalStatusIsApprovalGrant === false
    && admissionControl.rejectedStatusIsRuntimeBlockExecution === false
    && admissionControl.capabilityMatchIsRuntimeInvocation === false
    && admissionControl.requiredApprovalIsProviderExecutionAuthorization === false
    && admissionControl.requiredApprovalIsCodexCliAuthorization === false
    && admissionControl.requiredApprovalIsSubAgentRuntimeAuthorization === false
    && admissionControl.requiredApprovalIsHostExecutorAuthorization === false
    && admissionControl.externalCapabilityIsExternalWriteExecution === false
    && admissionControl.fileWriteCapabilityIsWorkspaceWriteExecution === false
    && delegationPolicy.delegationPolicyCallsDuringAudit === 0
    && delegationPolicy.proposalLifecycleCallsDuringAudit === 0
    && delegationPolicy.fileStoreWritesDuringAudit === 0
    && delegationPolicy.providerExecuteCallsDuringAudit === 0
    && delegationPolicy.codexCliCallsDuringAudit === 0
    && delegationPolicy.subAgentRuntimeCallsDuringAudit === 0
    && delegationPolicy.hostExecutorCallsDuringAudit === 0
    && delegationPolicy.toolRuntimeCallsDuringAudit === 0
    && delegationPolicy.shellProcessCallsDuringAudit === 0
    && delegationPolicy.workspaceWriteCallsDuringAudit === 0
    && delegationPolicy.externalWriteCallsDuringAudit === 0
    && delegationPolicy.fullDelegationIsExecutionAuthorization === false
    && delegationPolicy.requiresApprovalFalseIsExecutionAuthorization === false
    && delegationPolicy.approvedProposalIsRuntimeAuthorization === false
    && delegationPolicy.appliedProposalIsProviderExecutionAuthorization === false
    && delegationPolicy.filteredRecoveryActionIsHostExecutorAuthorization === false
    && delegationPolicy.recoveryActionListIsRecoveryExecution === false
    && delegationPolicy.historicalTrustIsRuntimeAuthorization === false
    && delegationPolicy.recordedResumeIsRuntimeInvocation === false
    && delegationPolicy.fileStorePersistenceIsWorkspaceWriteExecution === false
    && executionEligibility.executionEligibilityCallsDuringAudit === 0
    && executionEligibility.permitStoreReadsDuringAudit === 0
    && executionEligibility.providerPlanCreationCallsDuringAudit === 0
    && executionEligibility.providerExecuteCallsDuringAudit === 0
    && executionEligibility.codexCliCallsDuringAudit === 0
    && executionEligibility.subAgentRuntimeCallsDuringAudit === 0
    && executionEligibility.hostExecutorCallsDuringAudit === 0
    && executionEligibility.hostDispatchCallsDuringAudit === 0
    && executionEligibility.shellProcessCallsDuringAudit === 0
    && executionEligibility.workspaceWriteCallsDuringAudit === 0
    && executionEligibility.externalWriteCallsDuringAudit === 0
    && executionEligibility.eligibleStatusIsExecutionAuthorization === false
    && executionEligibility.validApprovalPermitIsProviderExecutionAuthorization === false
    && executionEligibility.capabilityGrantIsRuntimeInvocation === false
    && executionEligibility.permitStoreReadIsRuntimeInvocation === false
    && executionEligibility.providerPlanCreationAllowed === false
    && executionEligibility.providerExecuteAllowed === false
    && executionEligibility.codexCliInvocationAllowed === false
    && executionEligibility.subAgentRuntimeInvocationAllowed === false
    && executionEligibility.hostExecutorInvocationAllowed === false
    && executionEligibility.hostDispatchAllowed === false
    && executionEligibility.shellProcessAllowed === false
    && executionEligibility.workspaceWriteExecutionAllowed === false
    && executionEligibility.externalWriteAllowed === false
    && executionObservation.observationBusEmitsDuringAudit === 0
    && executionObservation.observationStoreWritesDuringAudit === 0
    && executionObservation.providerExecuteCallsDuringAudit === 0
    && executionObservation.codexCliCallsDuringAudit === 0
    && executionObservation.subAgentRuntimeCallsDuringAudit === 0
    && executionObservation.hostExecutorCallsDuringAudit === 0
    && executionObservation.hostDispatchCallsDuringAudit === 0
    && executionObservation.shellProcessCallsDuringAudit === 0
    && executionObservation.workspaceWriteCallsDuringAudit === 0
    && executionObservation.externalWriteCallsDuringAudit === 0
    && executionObservation.observationStatusIsExecutionAuthorization === false
    && executionObservation.succeededObservationIsCompletionAuthorization === false
    && executionObservation.failedObservationIsRecoveryAuthorization === false
    && executionObservation.evidenceRefIsRuntimeInvocation === false
    && executionObservation.observationRefResolutionIsReplayAuthorization === false
    && executionObservation.observationRecordWriteIsWorkspaceWriteExecution === false
    && executionObservation.providerExecuteAllowed === false
    && executionObservation.codexCliInvocationAllowed === false
    && executionObservation.subAgentRuntimeInvocationAllowed === false
    && executionObservation.hostExecutorInvocationAllowed === false
    && executionObservation.hostDispatchAllowed === false
    && executionObservation.shellProcessAllowed === false
    && executionObservation.workspaceWriteExecutionAllowed === false
    && executionObservation.externalWriteAllowed === false
    && governanceFailureReducer.reducerCallsCallbacksDuringAudit === 0
    && governanceFailureReducer.reducerPersistenceWritesDuringAudit === 0
    && governanceFailureReducer.providerExecuteCallsDuringAudit === 0
    && governanceFailureReducer.codexCliCallsDuringAudit === 0
    && governanceFailureReducer.subAgentRuntimeCallsDuringAudit === 0
    && governanceFailureReducer.hostExecutorCallsDuringAudit === 0
    && governanceFailureReducer.hostDispatchCallsDuringAudit === 0
    && governanceFailureReducer.toolRuntimeCallsDuringAudit === 0
    && governanceFailureReducer.shellProcessCallsDuringAudit === 0
    && governanceFailureReducer.workspaceWriteCallsDuringAudit === 0
    && governanceFailureReducer.externalWriteCallsDuringAudit === 0
    && governanceFailureReducer.executionFailureIsRecoveryAuthorization === false
    && governanceFailureReducer.strategyDecisionIsRuntimeAuthorization === false
    && governanceFailureReducer.arbitrationPacketIsRecoveryExecution === false
    && governanceFailureReducer.recoveryRecommendationIsHostExecutorAuthorization === false
    && governanceFailureReducer.anomalyRecordIsRuntimeInvocation === false
    && governanceFailureReducer.evidenceRefIsReplayAuthorization === false
    && governanceFailureReducer.riskScoreIsProviderExecutionAuthorization === false
    && governanceFailureReducer.reducerStateUpdateIsWorkspaceWriteExecution === false
    && taskGraph.taskGraphCallsDuringAudit === 0
    && taskGraph.taskGraphStoreWritesDuringAudit === 0
    && taskGraph.providerExecuteCallsDuringAudit === 0
    && taskGraph.codexCliCallsDuringAudit === 0
    && taskGraph.subAgentRuntimeCallsDuringAudit === 0
    && taskGraph.hostExecutorCallsDuringAudit === 0
    && taskGraph.hostDispatchCallsDuringAudit === 0
    && taskGraph.toolRuntimeCallsDuringAudit === 0
    && taskGraph.shellProcessCallsDuringAudit === 0
    && taskGraph.workspaceWriteCallsDuringAudit === 0
    && taskGraph.externalWriteCallsDuringAudit === 0
    && taskGraph.nodeStatusIsExecutionAuthorization === false
    && taskGraph.graphCompletionIsRuntimeCompletion === false
    && taskGraph.dependencyEdgeIsSchedulerDispatch === false
    && taskGraph.conflictEdgeIsRuntimeBlockExecution === false
    && taskGraph.checkpointNodeIsRollbackExecution === false
    && taskGraph.graphDeltaIsWorkspaceRollbackAuthorization === false
    && taskGraph.rollbackToCheckpointIsHostExecutorAuthorization === false
    && taskGraph.branchMergeIsGitMergeOrWorkspaceWrite === false
    && taskGraph.fileStorePersistenceIsWorkspaceWriteExecution === false
    && scheduler.schedulerCallsDuringAudit === 0
    && scheduler.schedulerLeaseAcquisitionsDuringAudit === 0
    && scheduler.schedulerStateWritesDuringAudit === 0
    && scheduler.providerExecuteCallsDuringAudit === 0
    && scheduler.codexCliCallsDuringAudit === 0
    && scheduler.subAgentRuntimeCallsDuringAudit === 0
    && scheduler.hostExecutorCallsDuringAudit === 0
    && scheduler.hostDispatchCallsDuringAudit === 0
    && scheduler.toolRuntimeCallsDuringAudit === 0
    && scheduler.shellProcessCallsDuringAudit === 0
    && scheduler.workspaceWriteCallsDuringAudit === 0
    && scheduler.externalWriteCallsDuringAudit === 0
    && scheduler.queuedStatusIsDispatchAuthorization === false
    && scheduler.leasedStatusIsExecutionAuthorization === false
    && scheduler.activeLeaseIsProviderExecuteAuthorization === false
    && scheduler.workerIdIsHostOrSubAgentAuthorization === false
    && scheduler.releaseLeaseIsRuntimeCompletionProof === false
    && scheduler.failLeaseIsRecoveryExecution === false
    && scheduler.expiredLeaseIsRetryExecution === false
    && scheduler.exhaustedStatusIsRuntimeBlockExecution === false
    && scheduler.fileStatePersistenceIsWorkspaceWriteExecution === false
    && scheduler.fileLockIsShellProcessExecution === false
    && executionPlanner.executionPlannerCallsDuringAudit === 0
    && executionPlanner.localPlanStoreWritesDuringAudit === 0
    && executionPlanner.providerPlanExecutionCallsDuringAudit === 0
    && executionPlanner.providerValidateExecutionPlanCallsDuringAudit === 0
    && executionPlanner.providerExecuteCallsDuringAudit === 0
    && executionPlanner.codexCliCallsDuringAudit === 0
    && executionPlanner.subAgentRuntimeCallsDuringAudit === 0
    && executionPlanner.hostExecutorCallsDuringAudit === 0
    && executionPlanner.hostDispatchCallsDuringAudit === 0
    && executionPlanner.shellProcessCallsDuringAudit === 0
    && executionPlanner.workspaceWriteCallsDuringAudit === 0
    && executionPlanner.externalWriteCallsDuringAudit === 0
    && executionPlanner.plannedStatusIsProviderExecutionAuthorization === false
    && executionPlanner.codexCliProviderSelectionIsCodexCliInvocation === false
    && executionPlanner.remoteAgentProviderSelectionIsSubAgentRuntimeInvocation === false
    && executionPlanner.workspaceWriteSideEffectClassIsWorkspaceWriteExecution === false
    && executionPlanner.providerPlanExecutionAllowed === false
    && executionPlanner.providerValidateExecutionPlanAllowed === false
    && executionPlanner.providerExecuteAllowed === false
    && executionPlanner.codexCliInvocationAllowed === false
    && executionPlanner.subAgentRuntimeInvocationAllowed === false
    && executionPlanner.hostExecutorInvocationAllowed === false
    && executionPlanner.hostDispatchAllowed === false
    && executionPlanner.shellProcessAllowed === false
    && executionPlanner.workspaceWriteExecutionAllowed === false
    && executionPlanner.externalWriteAllowed === false
    && providerRegistry.providerRegistryCallsDuringAudit === 0
    && providerRegistry.providerSelectionCallsDuringAudit === 0
    && providerRegistry.providerExecuteCallsDuringAudit === 0
    && providerRegistry.codexCliCallsDuringAudit === 0
    && providerRegistry.subAgentRuntimeCallsDuringAudit === 0
    && providerRegistry.hostExecutorCallsDuringAudit === 0
    && providerRegistry.toolRuntimeCallsDuringAudit === 0
    && providerRegistry.shellProcessCallsDuringAudit === 0
    && providerRegistry.workspaceWriteCallsDuringAudit === 0
    && providerRegistry.externalWriteCallsDuringAudit === 0
    && providerRegistry.selectedProviderIsExecutionAuthorization === false
    && providerRegistry.providerGrantSelectionIsProviderExecuteAuthorization === false
    && providerRegistry.routingDecisionSelectionIsCodexCliAuthorization === false
    && providerRegistry.registeredExecutorProviderIsRuntimeInvocation === false
    && providerRegistry.registeredToolProviderIsToolRuntimeInvocation === false
    && providerRegistry.registeredRemoteAgentProviderIsSubAgentRuntimeAuthorization === false
    && providerRegistry.remoteAgentAuthSchemesAreRuntimeAuthorization === false
    && providerRegistry.manifestStorePersistenceIsWorkspaceWriteExecution === false
    && controlledProviderTaskbook.taskbookIsProviderExecuteAuthorization === false
    && controlledProviderTaskbook.taskbookIsRealCodexCliAuthorization === false
    && controlledProviderTaskbook.taskbookIsWorkspaceWriteAuthorization === false
    && controlledProviderTaskbook.taskbookIsLocalCommandAuthorization === false
    && controlledProviderTaskbook.taskbookIsProtectedRemoteAuthorization === false
    && controlledProviderTaskbook.taskbookIsHostExecutorAuthorization === false
    && controlledProviderTaskbook.taskbookIsSubAgentRuntimeAuthorization === false
    && controlledProviderTaskbook.taskbookIsExternalWriteAuthorization === false
    && controlledProviderTaskbook.taskbookIsReleaseAuthorization === false
    && controlledProviderTaskbook.taskbookIsSecretChangeAuthorization === false
    && controlledProviderTaskbook.providerExecuteCallsDuringAudit === 0
    && controlledProviderTaskbook.codexCliCallsDuringAudit === 0
    && controlledProviderTaskbook.workspaceWriteCallsDuringAudit === 0
    && controlledProviderTaskbook.hostExecutorCallsDuringAudit === 0
    && controlledProviderTaskbook.subAgentRuntimeCallsDuringAudit === 0
    && controlledProviderTaskbook.shellProcessCallsDuringAudit === 0
    && controlledProviderTaskbook.externalWriteCallsDuringAudit === 0
    && controlledProviderTaskbook.evidenceWritesDuringAudit === 0
    && controlledProviderTaskbookReviewBoundary.reviewAuditIsProviderExecuteAuthorization === false
    && controlledProviderTaskbookReviewBoundary.reviewAuditIsRealCodexCliAuthorization === false
    && controlledProviderTaskbookReviewBoundary.reviewAuditIsWorkspaceWriteAuthorization === false
    && controlledProviderTaskbookReviewBoundary.reviewAuditIsLocalCommandAuthorization === false
    && controlledProviderTaskbookReviewBoundary.reviewAuditIsHostExecutorAuthorization === false
    && controlledProviderTaskbookReviewBoundary.reviewAuditIsSubAgentRuntimeAuthorization === false
    && controlledProviderTaskbookReviewBoundary.reviewAuditIsExternalWriteAuthorization === false
    && controlledProviderTaskbookReviewBoundary.reviewAuditIsReleaseAuthorization === false
    && controlledProviderTaskbookReviewBoundary.reviewAuditGitStateIsExecutionAuthorization === false
    && controlledProviderTaskbookReviewBoundary.reviewAuditWorktreeCleanIsProviderExecutionAuthorization === false
    && controlledProviderTaskbookReviewBoundary.providerExecuteCallsDuringBoundaryAudit === 0
    && controlledProviderTaskbookReviewBoundary.codexCliCallsDuringBoundaryAudit === 0
    && controlledProviderTaskbookReviewBoundary.workspaceWriteCallsDuringBoundaryAudit === 0
    && controlledProviderTaskbookReviewBoundary.hostExecutorCallsDuringBoundaryAudit === 0
    && controlledProviderTaskbookReviewBoundary.subAgentRuntimeCallsDuringBoundaryAudit === 0
    && controlledProviderTaskbookReviewBoundary.shellProcessCallsDuringBoundaryAudit === 0
    && controlledProviderTaskbookReviewBoundary.externalWriteCallsDuringBoundaryAudit === 0
    && controlledProviderTaskbookReviewBoundary.evidenceWritesDuringBoundaryAudit === 0
    && controlledProviderDispatchPreflight.providerExecuteCallsDuringAudit === 0
    && controlledProviderDispatchPreflight.codexCliCallsDuringAudit === 0
    && controlledProviderDispatchPreflight.workspaceWriteCallsDuringAudit === 0
    && controlledProviderDispatchPreflight.hostExecutorCallsDuringAudit === 0
    && controlledProviderDispatchPreflight.subAgentRuntimeCallsDuringAudit === 0
    && controlledProviderDispatchPreflight.shellProcessCallsDuringAudit === 0
    && controlledProviderDispatchPreflight.externalWriteCallsDuringAudit === 0
    && controlledProviderDispatchPreflight.evidenceWritesDuringAudit === 0
    && controlledProviderDispatchPreflight.dispatchPreflightIsProviderExecuteAuthorization === false
    && controlledProviderDispatchPreflight.dispatchPreflightIsRealCodexCliAuthorization === false
    && controlledProviderDispatchPreflight.dispatchPreflightIsWorkspaceWriteAuthorization === false
    && controlledProviderDispatchPreflight.dispatchPreflightIsHostExecutorAuthorization === false
    && controlledProviderDispatchPreflight.dispatchPreflightIsSubAgentRuntimeAuthorization === false
    && controlledProviderDispatchPreflight.dispatchPreflightIsShellProcessAuthorization === false
    && controlledProviderDispatchPreflight.dispatchPreflightIsExternalWriteAuthorization === false
    && controlledProviderDispatchPreflight.dispatchPreflightIsReleaseAuthorization === false
    && controlledProviderDispatcher.runnerInvocationsDuringAudit === 0
    && controlledProviderDispatcher.providerExecuteCallsDuringAudit === 0
    && controlledProviderDispatcher.realCodexCliCallsDuringAudit === 0
    && controlledProviderDispatcher.workspaceWriteCallsDuringAudit === 0
    && controlledProviderDispatcher.hostExecutorCallsDuringAudit === 0
    && controlledProviderDispatcher.subAgentRuntimeCallsDuringAudit === 0
    && controlledProviderDispatcher.shellProcessCallsDuringAudit === 0
    && controlledProviderDispatcher.externalWriteCallsDuringAudit === 0
    && controlledProviderDispatcher.callsProviderExecuteDirectly === false
    && controlledProviderDispatcher.callsRealCodexCliDirectly === false
    && controlledProviderDispatcher.controlledWorkspaceWriteDispatchAllowed === true
    && controlledProviderDispatcher.authorizesGeneralWorkspaceWrite === false
    && controlledProviderDispatcher.workspaceWriteProviderExecuteAllowed === false
    && controlledProviderDispatcher.authorizesHostExecutor === false
    && controlledProviderDispatcher.authorizesSubAgentRuntime === false
    && providerRunner.providerRunnerCallsDuringAudit === 0
    && providerRunner.providerPlanExecutionCallsDuringAudit === 0
    && providerRunner.providerValidateExecutionPlanCallsDuringAudit === 0
    && providerRunner.providerExecuteCallsDuringAudit === 0
    && providerRunner.realCodexCliCallsDuringAudit === 0
    && providerRunner.subAgentRuntimeCallsDuringAudit === 0
    && providerRunner.hostExecutorCallsDuringAudit === 0
    && providerRunner.shellProcessCallsDuringAudit === 0
    && providerRunner.workspaceWriteCallsDuringAudit === 0
    && providerRunner.externalWriteCallsDuringAudit === 0
    && providerRunner.nonCodexProviderExecutionAllowed === false
    && providerRunner.workspaceWriteAllowedByRunner === true
    && providerRunner.workspaceWriteProviderExecuteAllowed === false
    && providerRunner.defaultRealCodexCliAllowed === false
    && providerRunner.subAgentRuntimeInvocationAllowed === false
    && providerRunner.hostExecutorInvocationAllowed === false
    && providerCore.providerCoreRuntimeCallsDuringAudit === 0
    && providerCore.remoteAgentRuntimeCallsDuringAudit === 0
    && providerCore.toolRuntimeCallsDuringAudit === 0
    && providerCore.workspaceWriteCallsDuringAudit === 0
    && providerCore.externalWriteCallsDuringAudit === 0
    && providerCore.remoteAgentExecutionAllowed === false
    && providerCore.toolRuntimeInvocationAllowed === false
    && providerCore.workspaceWriteExecutionAllowedByProviderCore === false
    && providerCore.generalProviderExecutionAllowed === false
    && providerCore.codexCliInvocationAllowed === false
    && providerCore.subAgentRuntimeInvocationAllowed === false
    && providerCore.hostExecutorInvocationAllowed === false
    && toolInvocationPlanner.toolRegistryCallsDuringAudit === 0
    && toolInvocationPlanner.toolInvocationPlansDuringAudit === 0
    && toolInvocationPlanner.toolRuntimeCallsDuringAudit === 0
    && toolInvocationPlanner.providerExecuteCallsDuringAudit === 0
    && toolInvocationPlanner.codexCliCallsDuringAudit === 0
    && toolInvocationPlanner.subAgentRuntimeCallsDuringAudit === 0
    && toolInvocationPlanner.hostExecutorCallsDuringAudit === 0
    && toolInvocationPlanner.shellProcessCallsDuringAudit === 0
    && toolInvocationPlanner.workspaceWriteCallsDuringAudit === 0
    && toolInvocationPlanner.externalWriteCallsDuringAudit === 0
    && toolInvocationPlanner.plannedStatusIsRuntimeInvocation === false
    && toolInvocationPlanner.remoteAgentToolManifestIsSubAgentRuntimeAuthorization === false
    && toolInvocationPlanner.externalWriteToolManifestIsExternalWriteAuthorization === false
    && toolInvocationPlanner.approvalPermitIsToolRuntimeAuthorization === false
    && toolInvocationPlanner.localWriteToolPlanIsWorkspaceWriteExecution === false
    && toolInvocationPlanner.inputPreviewStoresRawSecrets === false
    && toolInvocationPlanner.defaultCodexCliInvocationAllowed === false
    && toolInvocationPlanner.providerExecuteAllowed === false
    && toolInvocationPlanner.subAgentRuntimeInvocationAllowed === false
    && toolInvocationPlanner.hostExecutorInvocationAllowed === false
    && toolInvocationPlanner.toolRuntimeInvocationAllowed === false
    && toolInvocationPlanner.shellProcessAllowedByDefault === false
    && toolInvocationPlanner.workspaceWriteAllowedByDefault === false
    && toolInvocationPlanner.externalWriteAllowedByDefault === false
    && desktopAgentStrategy.desktopAgentStrategyCallsDuringAudit === 0
    && desktopAgentStrategy.providerExecuteCallsDuringAudit === 0
    && desktopAgentStrategy.codexCliCallsDuringAudit === 0
    && desktopAgentStrategy.desktopPrimitiveCallsDuringAudit === 0
    && desktopAgentStrategy.subAgentRuntimeCallsDuringAudit === 0
    && desktopAgentStrategy.hostExecutorCallsDuringAudit === 0
    && desktopAgentStrategy.hostDispatchCallsDuringAudit === 0
    && desktopAgentStrategy.shellProcessCallsDuringAudit === 0
    && desktopAgentStrategy.workspaceWriteCallsDuringAudit === 0
    && desktopAgentStrategy.externalWriteCallsDuringAudit === 0
    && desktopAgentStrategy.parallelPlanIsSubAgentRuntimeAuthorization === false
    && desktopAgentStrategy.workerAssignmentIsRuntimeInvocation === false
    && desktopAgentStrategy.writeModeIsWorkspaceWriteExecution === false
    && desktopAgentStrategy.ownershipTargetIsWorkspaceWriteAuthorization === false
    && desktopAgentStrategy.maxAgentsIsSubAgentSpawnAuthorization === false
    && desktopAgentStrategy.readOnlyAnalystIsProviderExecutionAuthorization === false
    && desktopAgentStrategy.strategyReasonIsExecutionGate === false
    && desktopDecisionRunner.desktopDecisionRunnerCallsDuringAudit === 0
    && desktopDecisionRunner.desktopPrimitiveCallsDuringAudit === 0
    && desktopDecisionRunner.hostDispatchCallsDuringAudit === 0
    && desktopDecisionRunner.providerExecuteCallsDuringAudit === 0
    && desktopDecisionRunner.codexCliCallsDuringAudit === 0
    && desktopDecisionRunner.subAgentRuntimeCallsDuringAudit === 0
    && desktopDecisionRunner.shellProcessCallsDuringAudit === 0
    && desktopDecisionRunner.workspaceWriteCallsDuringAudit === 0
    && desktopDecisionRunner.externalWriteCallsDuringAudit === 0
    && desktopDecisionRunner.readyStatusIsExecutionAuthorization === false
    && desktopDecisionRunner.desktopPlanAuthorizedFlagIsDispatch === false
    && desktopDecisionRunner.providerSelectionIsProviderExecute === false
    && desktopDecisionRunner.providerGrantIsProviderExecute === false
    && desktopDecisionRunner.agentStrategyIsSubAgentRuntimeInvocation === false
    && desktopDecisionRunner.governanceStrategyExecuteActionIsRuntimeInvocation === false
    && desktopDecisionRunner.desktopPrimitiveInvocationAllowed === false
    && desktopDecisionRunner.hostDispatchAllowed === false
    && desktopDecisionRunner.providerExecuteAllowed === false
    && desktopDecisionRunner.codexCliInvocationAllowed === false
    && desktopDecisionRunner.subAgentRuntimeInvocationAllowed === false
    && desktopDecisionRunner.shellProcessAllowed === false
    && desktopDecisionRunner.workspaceWriteExecutionAllowed === false
    && finalHostLocator.finalHostLocatorCallsDuringAudit === 0
    && finalHostLocator.pathProbeWritesDuringAudit === 0
    && finalHostLocator.hostExecutorCallsDuringAudit === 0
    && finalHostLocator.hostDispatchCallsDuringAudit === 0
    && finalHostLocator.providerExecuteCallsDuringAudit === 0
    && finalHostLocator.codexCliCallsDuringAudit === 0
    && finalHostLocator.subAgentRuntimeCallsDuringAudit === 0
    && finalHostLocator.shellProcessCallsDuringAudit === 0
    && finalHostLocator.workspaceWriteCallsDuringAudit === 0
    && finalHostLocator.externalWriteCallsDuringAudit === 0
    && finalHostLocator.readyForMappingIsHostExecutionAuthorization === false
    && finalHostLocator.packagedRuntimeCanBeFinalHostSource === false
    && finalHostLocator.referenceHostCanBeFinalHostSource === false
    && finalHostLocator.pathProbeWritesAllowed === false
    && finalHostLocator.recursiveScanAllowed === false
    && finalHostLocator.hostExecutorInvocationAllowed === false
    && finalHostLocator.desktopHostClientCreationAllowed === false
    && finalHostLocator.hostDispatchAllowed === false
    && finalHostLocator.providerExecuteAllowed === false
    && finalHostLocator.codexCliInvocationAllowed === false
    && finalHostLocator.subAgentRuntimeInvocationAllowed === false
    && finalHostLocator.shellProcessAllowed === false
    && finalHostLocator.workspaceWriteExecutionAllowed === false
    && hostDispatcherProvider.dispatcherCallsDuringAudit === 0
    && hostDispatcherProvider.providerExecuteCallsDuringAudit === 0
    && hostDispatcherProvider.realCodexCliCallsDuringAudit === 0
    && hostDispatcherProvider.workspaceWriteCallsDuringAudit === 0
    && hostDispatcherProvider.externalWriteCallsDuringAudit === 0
    && hostDispatcherProvider.generalProviderExecutionAllowed === false
    && hostDispatcherProvider.controlledWorkspaceWriteDispatchAllowed === true
    && hostDispatcherProvider.generalWorkspaceWriteAllowedByHostDispatcher === false
    && hostDispatcherProvider.workspaceWriteProviderExecuteAllowed === false
    && hostDispatcherProvider.defaultRealCodexCliAllowed === false
    && hostDispatcherProvider.subAgentRuntimeInvocationAllowed === false
    && hostDispatcherProvider.hostExecutorInvocationAllowed === false
    && codexDesktopBridge.bridgeCallsDuringAudit === 0
    && codexDesktopBridge.runtimeToolCallsDuringAudit === 0
    && codexDesktopBridge.shellCallsDuringAudit === 0
    && codexDesktopBridge.applyPatchCallsDuringAudit === 0
    && codexDesktopBridge.spawnAgentCallsDuringAudit === 0
    && codexDesktopBridge.externalWriteCallsDuringAudit === 0
    && codexDesktopBridge.runtimeToolInvocationAllowedByDefault === false
    && codexDesktopBridge.codexCliInvocationAllowed === false
    && codexDesktopBridge.providerInvocationAllowed === false
    && codexDesktopBridge.subAgentRuntimeInvocationAllowed === false
    && codexDesktopBridge.hostExecutorInvocationAllowed === false
    && codexDesktopLiveHost.liveHostBundleCreationsDuringAudit === 0
    && codexDesktopLiveHost.runtimeToolCallsDuringAudit === 0
    && codexDesktopLiveHost.memoryToolCallsDuringAudit === 0
    && codexDesktopLiveHost.bridgeCallsDuringAudit === 0
    && codexDesktopLiveHost.hostClientRunCallsDuringAudit === 0
    && codexDesktopLiveHost.smokeRunsDuringAudit === 0
    && codexDesktopLiveHost.providerCallsDuringAudit === 0
    && codexDesktopLiveHost.subAgentRuntimeCallsDuringAudit === 0
    && codexDesktopLiveHost.hostExecutorCallsDuringAudit === 0
    && codexDesktopLiveHost.workspaceWriteCallsDuringAudit === 0
    && codexDesktopLiveHost.externalWriteCallsDuringAudit === 0
    && codexDesktopLiveHost.defaultRuntimeToolInvocationAllowed === false
    && codexDesktopLiveHost.codexCliInvocationAllowedByLiveHostBoundary === false
    && codexDesktopLiveHost.providerInvocationAllowed === false
    && codexDesktopLiveHost.subAgentRuntimeInvocationAllowed === false
    && codexDesktopLiveHost.hostExecutorInvocationAllowed === false
    && codexMemoryMcpClient.mcpHttpCallsDuringAudit === 0
    && codexMemoryMcpClient.memoryToolCallsDuringAudit === 0
    && codexMemoryMcpClient.hostExecutorInvocationsDuringAudit === 0
    && codexMemoryMcpClient.codexCliCallsDuringAudit === 0
    && codexMemoryMcpClient.providerExecuteCallsDuringAudit === 0
    && codexMemoryMcpClient.subAgentRuntimeCallsDuringAudit === 0
    && codexMemoryMcpClient.shellProcessCallsDuringAudit === 0
    && codexMemoryMcpClient.workspaceWriteCallsDuringAudit === 0
    && codexMemoryMcpClient.externalWriteCallsDuringAudit === 0
    && codexMemoryMcpClient.mcpHttpCallsAreProviderExecution === false
    && codexMemoryMcpClient.mcpHttpCallsAreHostExecutorAuthorization === false
    && codexMemoryMcpClient.recordMemoryIsWorkspaceWriteExecution === false
    && codexMemoryMcpClient.searchMemoryIsSubAgentRuntimeInvocation === false
    && codexMemoryMcpClient.memoryOverviewIsRuntimeAuthorization === false
    && codexMemoryMcpClient.adapterCheckpointWriteIsExecutionAuthorization === false
    && codexMemoryMcpClient.defaultEndpointLookupAllowed === false
    && codexMemoryMcpClient.bearerTokenIsExecutionAuthorization === false
    && codexMemoryMcpClient.defaultCodexCliInvocationAllowed === false
    && codexMemoryMcpClient.providerExecuteAllowed === false
    && codexMemoryMcpClient.subAgentRuntimeInvocationAllowed === false
    && codexMemoryMcpClient.shellProcessAllowedByDefault === false
    && codexMemoryMcpClient.workspaceWriteAllowedByDefault === false
    && codexMemoryMcpClient.externalWriteAllowedByDefault === false
    && codexMemoryHostClient.memoryHostClientCallsDuringAudit === 0
    && codexMemoryHostClient.memoryOperationCallsDuringAudit === 0
    && codexMemoryHostClient.hostExecutorInvocationsDuringAudit === 0
    && codexMemoryHostClient.codexCliCallsDuringAudit === 0
    && codexMemoryHostClient.providerExecuteCallsDuringAudit === 0
    && codexMemoryHostClient.subAgentRuntimeCallsDuringAudit === 0
    && codexMemoryHostClient.shellProcessCallsDuringAudit === 0
    && codexMemoryHostClient.workspaceWriteCallsDuringAudit === 0
    && codexMemoryHostClient.externalWriteCallsDuringAudit === 0
    && codexMemoryHostClient.memoryOperationCallsAreHostExecutorAuthorization === false
    && codexMemoryHostClient.recordMemoryIsWorkspaceWriteExecution === false
    && codexMemoryHostClient.searchMemoryIsSubAgentRuntimeInvocation === false
    && codexMemoryHostClient.memoryOverviewIsRuntimeAuthorization === false
    && codexMemoryHostClient.adapterCheckpointWriteIsExecutionAuthorization === false
    && codexMemoryHostClient.mcpToolStyleAdapterIsDefaultHostLookup === false
    && codexMemoryHostClient.defaultRealHostExecutionAllowed === false
    && codexMemoryHostClient.defaultHostExecutorLookupAllowed === false
    && codexMemoryHostClient.defaultCodexCliInvocationAllowed === false
    && codexMemoryHostClient.providerExecuteAllowed === false
    && codexMemoryHostClient.subAgentRuntimeInvocationAllowed === false
    && codexMemoryHostClient.shellProcessAllowedByDefault === false
    && codexMemoryHostClient.workspaceWriteAllowedByDefault === false
    && codexMemoryHostClient.externalWriteAllowed === false
    && desktopHostClient.clientCallsDuringAudit === 0
    && desktopHostClient.liveAdapterCallsDuringAudit === 0
    && desktopHostClient.hostExecutorInvocationsDuringAudit === 0
    && desktopHostClient.dispatchToHostCallsDuringAudit === 0
    && desktopHostClient.codexCliCallsDuringAudit === 0
    && desktopHostClient.providerCallsDuringAudit === 0
    && desktopHostClient.subAgentRuntimeCallsDuringAudit === 0
    && desktopHostClient.shellProcessCallsDuringAudit === 0
    && desktopHostClient.workspaceWriteCallsDuringAudit === 0
    && desktopHostClient.externalWriteCallsDuringAudit === 0
    && desktopHostClient.defaultRealExecutionAllowed === false
    && desktopHostClient.defaultHostExecutorLookupAllowed === false
    && desktopHostClient.directDispatchToHostAllowedByClient === false
    && desktopHostClient.codexCliInvocationAllowedByClient === false
    && desktopHostClient.providerInvocationAllowedByClient === false
    && desktopHostClient.controlledWorkspaceWriteDispatchAllowedByClient === true
    && desktopHostClient.generalWorkspaceWriteAllowedByClient === false
    && desktopHostClient.workspaceWriteProviderExecuteAllowedByClient === false
    && desktopHostClient.subAgentRuntimeInvocationAllowed === false
    && desktopHostClient.shellProcessAllowed === false
    && desktopHostClient.externalWriteAllowed === false
    && desktopLiveAdapterDispatch.liveAdapterCallsDuringAudit === 0
    && desktopLiveAdapterDispatch.dispatchToHostCallsDuringAudit === 0
    && desktopLiveAdapterDispatch.bridgeCallsDuringAudit === 0
    && desktopLiveAdapterDispatch.handlerCallsDuringAudit === 0
    && desktopLiveAdapterDispatch.providerCallsDuringAudit === 0
    && desktopLiveAdapterDispatch.subAgentRuntimeCallsDuringAudit === 0
    && desktopLiveAdapterDispatch.hostExecutorCallsDuringAudit === 0
    && desktopLiveAdapterDispatch.workspaceWriteCallsDuringAudit === 0
    && desktopLiveAdapterDispatch.externalWriteCallsDuringAudit === 0
    && desktopLiveAdapterDispatch.blockedDecisionExecutionAllowed === false
    && desktopLiveAdapterDispatch.codexCliInvocationAllowedByDesktopRoute === false
    && desktopLiveAdapterDispatch.bridgeInvocationAllowedByCodexCliRoute === false
    && desktopLiveAdapterDispatch.providerInvocationAllowedByDesktopLiveAdapter === false
    && desktopLiveAdapterDispatch.subAgentRuntimeInvocationAllowed === false
    && desktopLiveAdapterDispatch.hostExecutorInvocationAllowed === false
    && hostClientExample.exampleClientCallsDuringAudit === 0
    && hostClientExample.liveAdapterCallsDuringAudit === 0
    && hostClientExample.hostExecutorInvocationsDuringAudit === 0
    && hostClientExample.dispatchToHostCallsDuringAudit === 0
    && hostClientExample.codexCliCallsDuringAudit === 0
    && hostClientExample.providerCallsDuringAudit === 0
    && hostClientExample.subAgentRuntimeCallsDuringAudit === 0
    && hostClientExample.shellProcessCallsDuringAudit === 0
    && hostClientExample.workspaceWriteCallsDuringAudit === 0
    && hostClientExample.externalWriteCallsDuringAudit === 0
    && hostClientExample.realShellProcessAllowed === false
    && hostClientExample.realWorkspaceWriteAllowed === false
    && hostClientExample.hostExecutorDispatchSurfacePresent === false
    && hostClientExample.defaultRealExecutionAllowed === false
    && hostClientExample.directDispatchToHostAllowedByExample === false
    && hostClientExample.codexCliInvocationAllowedByExample === false
    && hostClientExample.providerInvocationAllowedByExample === false
    && hostClientExample.subAgentRuntimeInvocationAllowed === false
    && hostClientExample.externalWriteAllowed === false
    && targetHostEmbedding.bundleCreationsDuringAudit === 0
    && targetHostEmbedding.hostClientRunCallsDuringAudit === 0
    && targetHostEmbedding.hostExecutorInvocationsDuringAudit === 0
    && targetHostEmbedding.codexCliCallsDuringAudit === 0
    && targetHostEmbedding.providerExecuteCallsDuringAudit === 0
    && targetHostEmbedding.subAgentRuntimeCallsDuringAudit === 0
    && targetHostEmbedding.shellProcessCallsDuringAudit === 0
    && targetHostEmbedding.workspaceWriteCallsDuringAudit === 0
    && targetHostEmbedding.externalWriteCallsDuringAudit === 0
    && targetHostEmbedding.placeholderMethodsAreRealExecution === false
    && targetHostEmbedding.scaffoldReadyStatusIsExecutionAuthorization === false
    && targetHostEmbedding.createBundleRequiresFullyWiredHost === true
    && targetHostEmbedding.createBundleIsHostExecutorAuthorization === false
    && targetHostEmbedding.directiveBuildersAreShellAuthorization === false
    && targetHostEmbedding.defaultRealHostExecutionAllowed === false
    && targetHostEmbedding.defaultHostExecutorLookupAllowed === false
    && targetHostEmbedding.defaultCodexCliInvocationAllowed === false
    && targetHostEmbedding.providerExecuteAllowed === false
    && targetHostEmbedding.subAgentRuntimeInvocationAllowed === false
    && targetHostEmbedding.shellProcessAllowedByDefault === false
    && targetHostEmbedding.workspaceWriteAllowedByDefault === false
    && targetHostEmbedding.externalWriteAllowed === false
    && host.hostExecutorInvocationsDuringAudit === 0
    && host.subAgentRuntimeCallsDuringAudit === 0
    && host.shellProcessCallsDuringAudit === 0
    && host.workspaceWriteCallsDuringAudit === 0
    && host.externalWriteCallsDuringAudit === 0
    && hostTaskbook.taskbookExecutionAuthorized === false
    && hostTaskbook.hostExecutorInvocationsDuringAudit === 0
    && hostTaskbook.recoveryActionDispatchCallsDuringAudit === 0
    && hostTaskbook.realCodexCliCallsDuringAudit === 0
    && hostTaskbook.providerCallsDuringAudit === 0
    && hostTaskbook.subAgentRuntimeCallsDuringAudit === 0
    && hostTaskbook.shellProcessCallsDuringAudit === 0
    && hostTaskbook.workspaceWriteCallsDuringAudit === 0
    && hostTaskbook.externalWriteCallsDuringAudit === 0
    && hostClientReview.hostBridgeCallsDuringAudit === 0
    && hostClientReview.hostExecutorInvocationsDuringAudit === 0
    && hostClientReview.dispatchToHostCallsDuringAudit === 0
    && hostClientReview.codexCliCallsDuringAudit === 0
    && hostClientReview.providerCallsDuringAudit === 0
    && hostClientReview.subAgentRuntimeCallsDuringAudit === 0
    && hostClientReview.shellProcessCallsDuringAudit === 0
    && hostClientReview.workspaceWriteCallsDuringAudit === 0
    && hostClientReview.externalWriteCallsDuringAudit === 0
    && hostClientReview.recoveryActionDispatchAllowed === false
    && hostClientReview.hostBridgeCallAllowedByReview === false
    && hostClientReview.dispatchToHostAllowedByReview === false
    && hostClientReview.codexCliInvocationAllowed === false
    && hostClientReview.providerInvocationAllowed === false
    && hostClientReview.subAgentRuntimeInvocationAllowed === false
    && hostClientReview.shellProcessAllowed === false
    && hostClientReview.workspaceWriteAllowed === false
    && hostClientReview.externalWriteAllowed === false
    && hostReceipt.executorInvocationsDuringAudit === 0
    && hostReceipt.realCodexCliCallsDuringAudit === 0
    && hostReceipt.providerCallsDuringAudit === 0
    && hostReceipt.subAgentRuntimeCallsDuringAudit === 0
    && hostReceipt.shellProcessCallsDuringAudit === 0
    && hostReceipt.workspaceWriteCallsDuringAudit === 0
    && hostReceipt.externalWriteCallsDuringAudit === 0
    && agentBacked.sandboxExecutorInvocationsDuringAudit === 0
    && agentBacked.productionRecoveryExecutionAllowed === false
    && agentBacked.codexCliAdapterAllowed === false
    && agentBacked.providerAdapterAllowed === false
    && agentBacked.subAgentRuntimeInvocationAllowedByRouter === false
    && agentBacked.shellProcessAllowed === false
    && agentBacked.workspaceWriteAllowed === false
    && agentBacked.externalWriteAllowed === false
    && adapterReview.adapterInvocationsDuringAudit === 0
    && adapterTaskbook.taskbookExecutionAuthorized === false
    && adapterTaskbook.adapterAutoDiscoveryAllowed === false
    && adapterTaskbook.codexCliInvocationAllowed === false
    && adapterTaskbook.providerInvocationAllowed === false
    && adapterTaskbook.subAgentRuntimeInvocationAllowed === false
    && adapterTaskbook.shellProcessAllowed === false
    && adapterTaskbook.workspaceWriteAllowed === false
    && adapterTaskbook.externalWriteAllowed === false
    && adapterTaskbook.productionRecoveryAllowed === false
    && adapterTaskbook.realRecoveryActionExecutionAllowed === false
    && adapterTaskbook.adapterInvocationsDuringAudit === 0
    && adapterReview.adapterInvocationAllowed === false
    && adapterReview.subAgentRuntimeInvocationAllowed === false
    && adapterReview.codexCliInvocationAllowed === false
    && adapterReview.providerInvocationAllowed === false
    && adapterReview.shellProcessAllowed === false
    && adapterReview.workspaceWriteAllowed === false
    && adapterReview.externalWriteAllowed === false
    && adapterSandbox.adapterInvocationsDuringAudit === 0
    && adapterSandbox.productionRecoveryExecutionAllowed === false
    && adapterSandbox.codexCliAdapterAllowed === false
    && adapterSandbox.providerAdapterAllowed === false
    && adapterSandbox.subAgentRuntimeAdapterAllowed === false
    && adapterSandbox.shellProcessAllowed === false
    && adapterSandbox.workspaceWriteAllowed === false
    && adapterSandbox.externalWriteAllowed === false
    && taskControlTaskbook.taskbookExecutionAuthorized === false
    && taskControlTaskbook.adapterInvocationAllowed === false
    && taskControlTaskbook.codexCliInvocationAllowed === false
    && taskControlTaskbook.providerInvocationAllowed === false
    && taskControlTaskbook.subAgentRuntimeInvocationAllowed === false
    && taskControlTaskbook.shellProcessAllowed === false
    && taskControlTaskbook.workspaceWriteAllowed === false
    && taskControlTaskbook.externalWriteAllowed === false
    && taskControlTaskbook.productionRecoveryAllowed === false
    && taskControlTaskbook.realRecoveryActionExecutionAllowed === false
    && taskControlTaskbook.adapterInvocationsDuringAudit === 0
    && taskControlReview.adapterInvocationsDuringAudit === 0
    && taskControlReview.subAgentRuntimeCallsDuringAudit === 0
    && taskControlReview.codexCliCallsDuringAudit === 0
    && taskControlReview.providerCallsDuringAudit === 0
    && taskControlReview.shellProcessCallsDuringAudit === 0
    && taskControlReview.workspaceWriteCallsDuringAudit === 0
    && taskControlReview.externalWriteCallsDuringAudit === 0
    && taskControlReview.adapterInvocationAllowed === false
    && taskControlReview.subAgentRuntimeInvocationAllowed === false
    && taskControlReview.codexCliInvocationAllowed === false
    && taskControlReview.providerInvocationAllowed === false
    && taskControlReview.shellProcessAllowed === false
    && taskControlReview.workspaceWriteAllowed === false
    && taskControlReview.externalWriteAllowed === false
    && taskControlReview.productionRecoveryAllowed === false
    && taskControlReview.recoveryActionExecutionAllowed === false
    && subAgent.subAgentRuntimeCallsDuringAudit === 0
    && subAgent.codexCliCallsDuringAudit === 0
    && subAgent.providerCallsDuringAudit === 0
    && subAgent.shellProcessCallsDuringAudit === 0
    && subAgent.workspaceWriteCallsDuringAudit === 0
    && subAgent.externalWriteCallsDuringAudit === 0
    && subAgent.adapterInvocationsDuringAudit === 0
    && taskControl.adapterInvocationsDuringAudit === 0
    && taskControl.subAgentRuntimeCallsDuringAudit === 0
    && taskControl.shellProcessCallsDuringAudit === 0
    && taskControl.workspaceWriteCallsDuringAudit === 0
    && taskControl.externalWriteCallsDuringAudit === 0;
}

function executionAuthorityLatticeConstrained(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const dispatchPreflight =
    input.controlledProviderExecutionDispatchPreflightReview.summary;
  const dispatcher =
    input.controlledProviderExecutionDispatcherReview.summary;
  const providerRunner = input.providerExecutionRunnerReview.summary;
  const hostDispatcher = input.hostDispatcherProviderReview.summary;
  const toolPlanner = input.toolInvocationPlannerReview.summary;
  const desktopLiveAdapter = input.desktopLiveAdapterDispatchReview.summary;
  const host = input.hostExecutorReview.summary;
  const hostTaskbook = input.hostExecutorTaskbookReview.summary;
  const hostClientReview = input.hostClientExecutorReviewReview.summary;
  const hostReceipt = input.hostExecutorReceiptReview.summary;
  const agentBacked = input.agentBackedRecoveryExecutorReview.summary;
  const adapterTaskbook = input.agentExecutorAdapterTaskbookReview.summary;
  const adapterReview = input.agentExecutorAdapterReviewReview.summary;
  const adapterSandbox = input.agentExecutorAdapterSandboxReview.summary;
  const taskControlTaskbook = input.agentTaskControlTaskbookReview.summary;
  const taskControlReview = input.agentTaskControlReviewReview.summary;
  const subAgent = input.subAgentRuntimeReview.summary;

  return codexCliHostDoesNotAuthorizeHostExecutorOrSubAgentRuntime(input)
    && subAgentRuntimeDoesNotInvokeCodexCliOrProviderExecution(input)
    && hostExecutorDoesNotExecuteProviderOrSubAgentRuntime(input)
    && dispatchPreflight.dispatchPreflightMode === "controlled_readonly_and_workspace_write_dispatch_preflight_matrix_only"
    && dispatchPreflight.dispatchPreflightIsProviderExecuteAuthorization === false
    && dispatchPreflight.dispatchPreflightIsRealCodexCliAuthorization === false
    && dispatchPreflight.dispatchPreflightIsWorkspaceWriteAuthorization === false
    && dispatchPreflight.dispatchPreflightIsHostExecutorAuthorization === false
    && dispatchPreflight.dispatchPreflightIsSubAgentRuntimeAuthorization === false
    && dispatchPreflight.dispatchPreflightIsShellProcessAuthorization === false
    && dispatchPreflight.dispatchPreflightIsExternalWriteAuthorization === false
    && dispatchPreflight.dispatchPreflightIsReleaseAuthorization === false
    && dispatchPreflight.runnerRemainsFinalProviderExecuteGate === true
    && dispatchPreflight.dryRunDefaultPreserved === true
    && dispatcher.dispatcherMode === "controlled_readonly_and_workspace_write_pre_runner_dispatcher"
    && dispatcher.callsRunnerBoundary === true
    && dispatcher.callsProviderExecuteDirectly === false
    && dispatcher.callsRealCodexCliDirectly === false
    && dispatcher.controlledWorkspaceWriteDispatchAllowed === true
    && dispatcher.authorizesGeneralWorkspaceWrite === false
    && dispatcher.workspaceWriteProviderExecuteAllowed === false
    && dispatcher.authorizesHostExecutor === false
    && dispatcher.authorizesSubAgentRuntime === false
    && dispatcher.defaultDryRunPreserved === true
    && providerRunner.runnerMode === "controlled_readonly_and_workspace_write_gate"
    && providerRunner.controlledReadOnlyExecuteAllowed === true
    && providerRunner.controlledReadOnlyProviderId === "codex-cli"
    && providerRunner.controlledReadOnlySideEffectClass === "read_only"
    && providerRunner.controlledReadOnlySandbox === "read-only"
    && providerRunner.nonCodexProviderExecutionAllowed === false
    && providerRunner.workspaceWriteAllowedByRunner === true
    && providerRunner.workspaceWriteProviderExecuteAllowed === false
    && providerRunner.defaultRealCodexCliAllowed === false
    && providerRunner.hostExecutorInvocationAllowed === false
    && providerRunner.subAgentRuntimeInvocationAllowed === false
    && hostDispatcher.dispatchMode === "controlled_read_only_and_workspace_write_provider_dispatch"
    && hostDispatcher.readOnlyProviderDispatchAllowed === true
    && hostDispatcher.permittedProviderId === "codex-cli"
    && hostDispatcher.permittedSideEffectClass === "read_only"
    && hostDispatcher.permittedSandbox === "read-only"
    && hostDispatcher.generalProviderExecutionAllowed === false
    && hostDispatcher.controlledWorkspaceWriteDispatchAllowed === true
    && hostDispatcher.generalWorkspaceWriteAllowedByHostDispatcher === false
    && hostDispatcher.workspaceWriteProviderExecuteAllowed === false
    && hostDispatcher.defaultRealCodexCliAllowed === false
    && hostDispatcher.hostExecutorInvocationAllowed === false
    && hostDispatcher.subAgentRuntimeInvocationAllowed === false
    && toolPlanner.remoteAgentToolManifestIsSubAgentRuntimeAuthorization === false
    && toolPlanner.hostExecutorInvocationAllowed === false
    && toolPlanner.subAgentRuntimeInvocationAllowed === false
    && toolPlanner.toolRuntimeInvocationAllowed === false
    && toolPlanner.workspaceWriteAllowedByDefault === false
    && desktopLiveAdapter.codexCliHostDispatchAllowedWhenReadyAndRouted === true
    && desktopLiveAdapter.desktopPrimitiveExecutionAllowedWhenDesktopRouted === true
    && desktopLiveAdapter.blockedDecisionExecutionAllowed === false
    && desktopLiveAdapter.bridgeInvocationAllowedByCodexCliRoute === false
    && desktopLiveAdapter.providerInvocationAllowedByDesktopLiveAdapter === false
    && desktopLiveAdapter.hostExecutorInvocationAllowed === false
    && desktopLiveAdapter.subAgentRuntimeInvocationAllowed === false
    && host.defaultRealExecutionAllowed === false
    && host.hostExecutorInvocationsDuringAudit === 0
    && host.subAgentRuntimeCallsDuringAudit === 0
    && hostTaskbook.taskbookExecutionAuthorized === false
    && hostClientReview.recoveryActionDispatchAllowed === false
    && hostClientReview.dispatchToHostAllowedByReview === false
    && hostReceipt.dispatchResultMeansBusinessRecoveryCompleted === false
    && agentBacked.productionRecoveryExecutionAllowed === false
    && agentBacked.subAgentRuntimeInvocationAllowedByRouter === false
    && adapterTaskbook.taskbookExecutionAuthorized === false
    && adapterTaskbook.adapterAutoDiscoveryAllowed === false
    && adapterReview.adapterInvocationAllowed === false
    && adapterSandbox.productionRecoveryExecutionAllowed === false
    && adapterSandbox.subAgentRuntimeAdapterAllowed === false
    && taskControlTaskbook.taskbookExecutionAuthorized === false
    && taskControlReview.subAgentRuntimeInvocationAllowed === false
    && subAgent.subAgentRuntimeExecutionAllowed === false
    && subAgent.subAgentRuntimeCallsDuringAudit === 0
    && subAgent.providerCallsDuringAudit === 0
    && subAgent.codexCliCallsDuringAudit === 0
    && subAgent.workspaceWriteCallsDuringAudit === 0
    && subAgent.externalWriteCallsDuringAudit === 0;
}

function codexCliHostDoesNotAuthorizeHostExecutorOrSubAgentRuntime(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const codexHost = input.codexCliHostReview.summary;

  return codexHost.defaultRealCodexCliAllowedByBoundaryAudit === false
    && codexHost.providerExecutionAllowedByHostBoundary === false
    && codexHost.hostExecutorInvocationAllowed === false
    && codexHost.subAgentRuntimeInvocationAllowed === false;
}

function subAgentRuntimeDoesNotInvokeCodexCliOrProviderExecution(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const subAgent = input.subAgentRuntimeReview.summary;

  return subAgent.subAgentRuntimeExecutionAllowed === false
    && subAgent.subAgentRuntimeCallsDuringAudit === 0
    && subAgent.codexCliCallsDuringAudit === 0
    && subAgent.providerCallsDuringAudit === 0;
}

function hostExecutorDoesNotExecuteProviderOrSubAgentRuntime(
  input: ExecutionBoundaryCurrentSurfaceAuditInput
): boolean {
  const host = input.hostExecutorReview.summary;

  return host.defaultRealExecutionAllowed === false
    && host.hostExecutorInvocationsDuringAudit === 0
    && host.providerCallsDuringAudit === 0
    && host.subAgentRuntimeCallsDuringAudit === 0;
}

function outputSanitized(): boolean {
  const review: ExecutionBoundaryCurrentSurfaceAuditResult = {
    status: "passed",
    checks: {
      allComponentAuditsPassed: true,
      governanceRunnerRegistersAllCurrentAudits: true,
      governanceReadmeListsAllCurrentAudits: true,
      controlPlaneRecordsAllBoundaries: true,
      entryDocsRecordExecutionAuthorityLattice: true,
      currentStateRecordsExecutionAuthorityLattice: true,
      ciWorkflowRunsCurrentSurfaceGate: true,
      strategyRouterBoundaryConstrained: true,
      executionProfilesBoundaryConstrained: true,
      policyConfigBoundaryConstrained: true,
      capabilityTaxonomyBoundaryConstrained: true,
      capabilityTaxonomyEscalationPolicyBoundaryConstrained: true,
      routingEngineBoundaryConstrained: true,
      recoveryControlBoundaryConstrained: true,
      runtimeControlBoundaryConstrained: true,
      operatorActionExecutorGateBoundaryConstrained: true,
      codexCliHostBoundaryConstrained: true,
      publicApiBoundaryConstrained: true,
      agentOsLocalRuntimeBoundaryConstrained: true,
      agentOsMcpServerManifestBoundaryConstrained: true,
      protocolMcpProviderSkeletonBoundaryConstrained: true,
      protocolA2aRemoteProviderSkeletonBoundaryConstrained: true,
      agentOsSdkBoundaryConstrained: true,
      agentOsCliBoundaryConstrained: true,
      agentOsAppServerBoundaryConstrained: true,
      agentOsPublicSurfacesBoundaryConstrained: true,
      codexProviderBoundaryConstrained: true,
      preflightBoundaryConstrained: true,
      approvalPermitBoundaryConstrained: true,
      approvalGateBoundaryConstrained: true,
      approvalConsumptionDispatchMatrixBoundaryConstrained: true,
      approvalConsumptionDispatchBoundaryConstrained: true,
      readonlyProductizationBoundaryConstrained: true,
      stateSyncBoundaryConstrained: true,
      workspaceWriteReleaseGateBoundaryConstrained: true,
      admissionControlBoundaryConstrained: true,
      delegationPolicyBoundaryConstrained: true,
      executionEligibilityBoundaryConstrained: true,
      executionObservationBoundaryConstrained: true,
      governanceFailureReducerBoundaryConstrained: true,
      taskGraphBoundaryConstrained: true,
      schedulerBoundaryConstrained: true,
      executionPlannerBoundaryConstrained: true,
      providerRegistryBoundaryConstrained: true,
      controlledProviderExecutionTaskbookBoundaryConstrained: true,
      controlledProviderExecutionTaskbookReviewBoundaryConstrained: true,
      controlledProviderExecutionDispatchPreflightBoundaryConstrained: true,
      controlledProviderExecutionDispatcherBoundaryConstrained: true,
      providerExecutionRunnerBoundaryConstrained: true,
      providerCorePrimitivesBoundaryConstrained: true,
      toolInvocationPlannerBoundaryConstrained: true,
      desktopAgentStrategyBoundaryConstrained: true,
      desktopDecisionRunnerBoundaryConstrained: true,
      finalHostLocatorBoundaryConstrained: true,
      hostDispatcherProviderBoundaryConstrained: true,
      codexDesktopBridgeBoundaryConstrained: true,
      codexDesktopLiveHostBoundaryConstrained: true,
      codexMemoryMcpClientBoundaryConstrained: true,
      codexMemoryHostClientBoundaryConstrained: true,
      desktopHostClientBoundaryConstrained: true,
      desktopLiveAdapterDispatchBoundaryConstrained: true,
      hostClientExampleBoundaryConstrained: true,
      targetHostEmbeddingBoundaryConstrained: true,
      hostExecutorBoundaryConstrained: true,
      hostExecutorTaskbookBoundaryConstrained: true,
      hostClientExecutorReviewBoundaryConstrained: true,
      hostExecutorReceiptBoundaryConstrained: true,
      agentBackedRecoveryExecutorBoundaryConstrained: true,
      agentExecutorAdapterTaskbookBoundaryConstrained: true,
      agentExecutorAdapterReviewBoundaryConstrained: true,
      agentExecutorAdapterSandboxBoundaryConstrained: true,
      agentTaskControlTaskbookBoundaryConstrained: true,
      agentTaskControlReviewBoundaryConstrained: true,
      subAgentRuntimeBoundaryConstrained: true,
      agentTaskControlBoundaryConstrained: true,
      noCrossBoundaryExecutionBroadening: true,
      executionAuthorityLatticeConstrained: true,
      auditItselfIsNonExecuting: true,
      outputSanitized: true
    },
    summary: {
      currentAudits: REQUIRED_CURRENT_AUDITS,
      executionAuthorityLatticeMode:
        "narrow_readonly_provider_dispatch_without_boundary_inheritance",
      codexCliHostDoesNotAuthorizeHostExecutorOrSubAgentRuntime: true,
      subAgentRuntimeDoesNotInvokeCodexCliOrProviderExecution: true,
      hostExecutorDoesNotExecuteProviderOrSubAgentRuntime: true,
      strategyRouterMode: "advisory_budget_signal_only",
      executionProfilesMode: "profile_templates_only",
      policyConfigMode: "policy_schema_and_signal_resolution_only",
      capabilityTaxonomyMode:
        "capability_classification_and_escalation_policy_only",
      capabilityTaxonomyEscalationPolicyMode:
        "capability_escalation_policy_only",
      routingEngineMode: "routing_decision_and_provider_grant_only",
      recoveryControlMode:
        "schemas_packets_reviews_and_explicit_injected_witnesses_only",
      runtimeControlMode: "runtime_signal_and_escalation_outcome_only",
      operatorActionExecutorGateMode: "plan_only",
      codexCliHostMode: "explicit_codex_cli_host_execution_surface",
      publicApiMode: "named_governance_subpaths_only",
      agentOsLocalRuntimeMode: "local_state_and_provider_plan_runtime",
      agentOsMcpServerManifestMode: "manifest_only_no_runtime",
      protocolMcpProviderSkeletonMode:
        "protocol_mapping_and_disabled_provider_skeleton_only",
      protocolA2aRemoteProviderSkeletonMode:
        "agent_card_task_artifact_mapping_and_disabled_remote_provider_skeleton_only",
      agentOsSdkMode: "sdk_method_to_local_mcp_runtime_only",
      agentOsCliMode: "argv_parsing_to_local_mcp_runtime_only",
      agentOsAppServerMode:
        "http_like_request_routing_to_local_mcp_runtime_only",
      agentOsPublicSurfacesMode: "public_surface_to_local_mcp_runtime_only",
      codexProviderMode: "controlled-read-only",
      preflightMode: "pre_execution_signal_evaluation_only",
      approvalPermitMode: "permit_creation_validation_revocation_and_store_only",
      approvalGateMode: "approval_requirement_evaluation_only",
      approvalConsumptionDispatchMatrixBoundaryMode:
        "git_state_and_artifact_matrix_gate_only",
      approvalConsumptionDispatchMode:
        "approval_consumption_dispatch_matrix_only",
      readonlyProductizationBoundaryMode:
        "local_readonly_productization_acceptance_gate_only",
      stateSyncBoundaryMode: "state_consistency_observation_gate_only",
      workspaceWriteReleaseGateMode: "promotion_review_gate_only",
      admissionControlMode: "admission_status_and_requirement_derivation_only",
      delegationPolicyMode: "delegation_level_approval_requirement_and_recovery_filter_only",
      executionEligibilityMode: "admission_capability_permit_decision_only",
      executionObservationMode: "sanitized_task_scoped_observation_record_only",
      governanceFailureReducerMode: "pure_failure_to_governance_state_reducer_only",
      taskGraphMode: "structural_task_graph_state_only",
      schedulerMode: "queue_and_execution_lease_state_machine_only",
      executionPlannerMode: "provider_execution_plan_only",
      providerRegistryMode: "catalog_selection_attestation_and_manifest_store_only",
      controlledProviderExecutionTaskbookMode: "local_only_minimal_slice_taskbook",
      controlledProviderExecutionTaskbookReviewBoundaryMode:
        "git_state_and_artifact_review_gate_only",
      controlledProviderExecutionDispatchPreflightMode:
        "controlled_readonly_and_workspace_write_dispatch_preflight_matrix_only",
      controlledProviderExecutionDispatcherMode:
        "controlled_readonly_and_workspace_write_pre_runner_dispatcher",
      providerExecutionRunnerMode: "controlled_readonly_and_workspace_write_gate",
      providerCorePrimitiveMode: "manifest_permit_plan_only",
      toolInvocationPlannerMode: "tool_manifest_and_invocation_plan_only",
      desktopAgentStrategyMode: "agent_assignment_and_ownership_plan_only",
      desktopDecisionRunnerMode: "decision_package_only",
      finalHostLocatorMode: "source_candidate_pre_mapping_only",
      hostDispatcherProviderMode: "controlled_read_only_and_workspace_write_provider_dispatch",
      codexDesktopBridgeMode: "explicit_injected_desktop_host_bridge",
      codexDesktopLiveHostMode: "explicit_current_host_runtime_and_memory_bundle",
      codexMemoryMcpClientMode: "explicit_mcp_http_memory_transport_only",
      codexMemoryHostClientMode: "explicit_injected_memory_operations_only",
      desktopHostClientMode: "desktop_host_client_facade",
      desktopLiveAdapterDispatchMode: "route_separated_host_dispatch_or_desktop_bridge",
      hostClientExampleMode: "example_host_client_facade",
      targetHostEmbeddingMode: "explicit_target_host_contract_and_starter_only",
      strategyRouterExecuteActionFamilyIsAuthorization: false,
      strategyRouterWriteExecutionPredicateIsAuthorization: false,
      strategyRouterExecutorBudgetIsRuntimeInvocation: false,
      executionProfilesProfileStageIsRuntimeStep: false,
      executionProfilesDefaultRoleIsSubAgentRuntimeAuthorization: false,
      executionProfilesDefaultToolAccessIsToolRuntimeAuthorization: false,
      executionProfilesEngineeringWriteToolAccessIsWorkspaceWriteExecution: false,
      executionProfilesProtectedRemoteToolAccessIsExternalWriteAuthorization: false,
      executionProfilesAllowParallelIsSubAgentRuntimeAuthorization: false,
      executionProfilesMaxParallelAgentsIsSubAgentSpawnAuthorization: false,
      executionProfilesReleaseGovernanceProfileIsProtectedRemoteAuthorization: false,
      executionProfilesProfileSelectionIsProviderExecutionAuthorization: false,
      policyConfigHostRouteIsHostDispatchAuthorization: false,
      policyConfigCodexCliHostRouteIsCodexCliInvocation: false,
      policyConfigDesktopHostRouteIsDesktopRuntimeInvocation: false,
      policyConfigToolPolicyIsToolRuntimeAuthorization: false,
      policyConfigProtectedRemoteToolPolicyIsExternalWriteAuthorization: false,
      policyConfigApprovalRuleIsApprovalGrant: false,
      policyConfigMemoryHealthBlockIsRuntimeBlockExecution: false,
      policyConfigMemoryGuidanceIsSubAgentRuntimeAuthorization: false,
      policyConfigTelemetryThresholdIsRuntimeAuthorization: false,
      policyConfigTelemetryDeliveryWindowIsHostExecutorAuthorization: false,
      capabilityTaxonomyBoundedWorkspaceWriteCanaryIsWorkspaceWriteAuthorization: false,
      capabilityTaxonomyBoundedWorkspaceWriteReceiptIsExecutionAuthorization: false,
      capabilityTaxonomyScopedWorkspaceWriteClassIsWorkspaceWriteExecution: false,
      capabilityTaxonomyGeneralWorkspaceWriteClassIsExecutionAuthorization: false,
      capabilityTaxonomyGeneralProviderExecutionClassIsProviderExecuteAuthorization: false,
      capabilityTaxonomyExternalWriteClassIsExternalWriteAuthorization: false,
      capabilityTaxonomyReleaseOrDeployClassIsReleaseAuthorization: false,
      capabilityTaxonomySecretCredentialChangeClassIsSecretAccessAuthorization: false,
      capabilityTaxonomyEscalationPolicyIsRuntimeAuthorization: false,
      capabilityTaxonomyCanaryEvidenceBaselineIsExecutionAuthorization: false,
      capabilityTaxonomyEscalationPolicyIsProviderExecuteAuthorization: false,
      capabilityTaxonomyEscalationPolicyIsCodexCliAuthorization: false,
      capabilityTaxonomyEscalationPolicyIsWorkspaceWriteAuthorization: false,
      capabilityTaxonomyEscalationPolicyIsHostExecutorAuthorization: false,
      capabilityTaxonomyEscalationPolicyIsSubAgentRuntimeAuthorization: false,
      capabilityTaxonomyEscalationPolicyIsToolRuntimeAuthorization: false,
      capabilityTaxonomyEscalationPolicyIsExternalWriteAuthorization: false,
      capabilityTaxonomyEscalationPolicyIsReleaseAuthorization: false,
      capabilityTaxonomyEscalationPolicyIsSecretAccessAuthorization: false,
      capabilityTaxonomyEscalationPolicyBlockedCapabilityClassIsRuntimeBlockExecution:
        false,
      capabilityTaxonomyEscalationPolicySeverityIsRuntimeAuthorization: false,
      capabilityTaxonomyEscalationPolicyStatusIsExecutionAuthorization: false,
      routingEngineDecisionIsExecutionAuthorization: false,
      routingEngineHostRouteIsHostDispatchAuthorization: false,
      routingEngineProviderGrantIsProviderExecuteAuthorization: false,
      routingEngineCodexCliProviderIdIsCodexCliInvocation: false,
      routingEngineDesktopProviderIdIsDesktopRuntimeInvocation: false,
      routingEngineSandboxModeIsWorkspaceWriteExecution: false,
      routingEngineToolAccessIsToolRuntimeAuthorization: false,
      routingEngineApprovalRequiredIsApprovalGrant: false,
      routingEngineRiskScoreIsRuntimeAuthorization: false,
      routingEngineParallelismAllowedIsSubAgentRuntimeAuthorization: false,
      recoveryControlSchemaStatusIsExecutionAuthorization: false,
      recoveryControlExecutionPlanIsRecoveryExecutionAuthorization: false,
      recoveryControlExecutionGateIsRuntimeAuthorization: false,
      recoveryControlHostExecutorReviewIsHostDispatchAuthorization: false,
      recoveryControlDispatchAuthorizationReviewIsAdapterInvocationAuthorization: false,
      recoveryControlTaskControlReviewIsSubAgentRuntimeAuthorization: false,
      recoveryControlSandboxWitnessIsProductionRecoveryExecution: false,
      recoveryControlReceiptStatusIsCompletionAuthorization: false,
      recoveryControlRecoveryRecommendationIsHostExecutorAuthorization: false,
      runtimeControlRuntimeSignalIsExecutionAuthorization: false,
      runtimeControlEscalationOutcomeIsProviderExecutionAuthorization: false,
      runtimeControlUpgradeModelIsModelRuntimeInvocation: false,
      runtimeControlOpenCircuitIsHostDispatchAuthorization: false,
      runtimeControlFailureCountIsRecoveryExecutionAuthorization: false,
      runtimeControlContextPressureIsSubAgentRuntimeAuthorization: false,
      runtimeControlHighRiskSignalIsCodexCliAuthorization: false,
      operatorActionExecutorGateExecutionAllowed: false,
      codexCliHostWorkspaceWriteRequiresExplicitAllowance: true,
      codexCliHostWorkspaceWriteRequiresConfirmation: true,
      codexCliHostDefaultRealCodexCliAllowedByBoundaryAudit: false,
      codexCliHostProviderExecutionAllowedByHostBoundary: false,
      publicApiInternalGovernanceTopLevelExportsAllowed: false,
      publicApiProviderExecuteExportAllowed: false,
      publicApiCodexCliHostRunExportAllowed: false,
      agentOsLocalRuntimeProviderPlanCanBeStored: true,
      agentOsLocalRuntimeRealProviderExecutionAllowed: false,
      agentOsLocalRuntimeCodexCliInvocationAllowed: false,
      agentOsLocalRuntimeHostExecutorInvocationAllowed: false,
      agentOsLocalRuntimeWorkspaceWriteExecutionAllowed: false,
      agentOsMcpServerManifestRuntimeImplementedMeansLiveServer: false,
      agentOsMcpServerManifestToolManifestIsToolRuntimeAuthorization: false,
      agentOsMcpServerManifestRequiredCapabilityIsCapabilityGrant: false,
      agentOsMcpServerManifestApprovalRequiredIsApprovalGrant: false,
      agentOsMcpServerManifestLocalWriteSideEffectIsWorkspaceWriteExecution: false,
      agentOsMcpServerManifestProviderPlanningOutputIsProviderExecutionAuthorization: false,
      agentOsMcpServerManifestApprovalPermitOutputIsProviderExecutionAuthorization: false,
      agentOsMcpServerManifestListedToolIsMcpToolInvocation: false,
      agentOsMcpServerManifestExportIsPublicExecutionSurface: false,
      protocolMcpServerRefIsLiveServerConnection: false,
      protocolMcpCommandRefIsShellCommand: false,
      protocolMcpEndpointRefIsNetworkCall: false,
      protocolMcpToolManifestIsToolRuntimeAuthorization: false,
      protocolMcpInvocationPlanIsToolExecutionAuthorization: false,
      protocolMcpFakeProviderIsLiveMcpServer: false,
      protocolMcpInvokeMethodIsEnabled: false,
      protocolMcpUnknownSideEffectIsAutoApproved: false,
      protocolMcpAllowedToolIsMcpInvocationAuthorization: false,
      protocolA2aEndpointRefIsNetworkCall: false,
      protocolA2aAgentCardIsRemoteRuntimeAuthorization: false,
      protocolA2aTaskSkeletonIsRemoteExecutionAuthorization: false,
      protocolA2aArtifactUriIsFetchedBySkeleton: false,
      protocolA2aRemoteProviderIsEnabled: false,
      protocolA2aRemoteProviderCreatesRemoteTasks: false,
      protocolA2aFakeTransportIsLiveNetworkService: false,
      protocolA2aFakeTransportSubmissionIsRuntimeAuthorization: false,
      protocolA2aAnonymousRemoteInvocationAllowed: false,
      protocolA2aAuthSchemeIsCapabilityGrant: false,
      protocolA2aRemoteAgentProviderManifestIsSubAgentRuntimeAuthorization: false,
      agentOsSdkCallIsProviderExecutionAuthorization: false,
      agentOsSdkGrantInputIsCapabilityGrant: false,
      agentOsSdkApproveToolInputIsToolRuntimeAuthorization: false,
      agentOsSdkAllowLocalMutationIsWorkspaceWriteExecution: false,
      agentOsSdkPreferredProviderIsCodexCliInvocation: false,
      agentOsSdkLocalRuntimeCallIsProviderExecutionAuthorization: false,
      agentOsSdkApprovalPermitIssueIsProviderExecutionAuthorization: false,
      agentOsSdkApprovalPermitConsumptionIsProviderExecutionAuthorization: false,
      agentOsSdkRealProviderExecutionInvoked: false,
      agentOsCliGrantFlagIsCapabilityGrant: false,
      agentOsCliApproveToolFlagIsToolRuntimeAuthorization: false,
      agentOsCliAllowLocalMutationIsWorkspaceWriteExecution: false,
      agentOsCliPreferredProviderIsCodexCliInvocation: false,
      agentOsCliParsedCommandIsProviderExecutionAuthorization: false,
      agentOsCliLocalRuntimeCallIsProviderExecutionAuthorization: false,
      agentOsCliApprovalPermitIssueIsProviderExecutionAuthorization: false,
      agentOsCliApprovalPermitConsumptionIsProviderExecutionAuthorization: false,
      agentOsCliSanitizedArgvContainsRawSecrets: false,
      agentOsAppServerRequestEnvelopeIsCapabilityGrant: false,
      agentOsAppServerRouteIsLiveNetworkServer: false,
      agentOsAppServerStatusCodeIsHostExecutorReceipt: false,
      agentOsAppServerClientGateFieldsAreTrusted: false,
      agentOsAppServerServerSideOptionsAreClientControlled: false,
      agentOsAppServerLocalRuntimeCallIsProviderExecutionAuthorization: false,
      agentOsAppServerApprovalPermitIssueIsProviderExecutionAuthorization: false,
      agentOsAppServerApprovalPermitConsumptionIsProviderExecutionAuthorization: false,
      agentOsAppServerLiveHttpServerStarted: false,
      agentOsAppServerNetworkAccessed: false,
      agentOsAppServerRealProviderExecutionInvoked: false,
      agentOsPublicSurfacesSdkCallIsProviderExecutionAuthorization: false,
      agentOsPublicSurfacesCliGrantFlagIsProviderExecutionAuthorization: false,
      agentOsPublicSurfacesCliApproveToolFlagIsToolRuntimeAuthorization: false,
      agentOsPublicSurfacesCliAllowLocalMutationIsWorkspaceWriteExecution: false,
      agentOsPublicSurfacesPreferredProviderIsCodexCliInvocation: false,
      agentOsPublicSurfacesAppServerRequestEnvelopeIsCapabilityGrant: false,
      agentOsPublicSurfacesAppServerRouteIsNetworkServer: false,
      agentOsPublicSurfacesAppServerStatusCodeIsExecutionReceipt: false,
      agentOsPublicSurfacesApprovalPermitIssueIsProviderExecutionAuthorization: false,
      controlledReadOnlyProviderExecutionAllowed: true,
      preflightOkIsExecutionAuthorization: false,
      preflightMissingToolCheckIsToolRuntimeAuthorization: false,
      preflightAuthAvailableIsProviderExecutionAuthorization: false,
      preflightWorkspaceCleanIsWorkspaceWriteAuthorization: false,
      preflightProtectedBranchCheckIsWorkspaceWriteExecution: false,
      preflightMemoryOverviewIsRuntimeAuthorization: false,
      preflightMemoryHealthStatusIsSubAgentRuntimeAuthorization: false,
      preflightMemoryWarningIsHostExecutorAuthorization: false,
      preflightMemoryBlockingIssueIsProviderExecutionAuthorization: false,
      approvalPermitValidPermitIsProviderExecutionAuthorization: false,
      approvalPermitValidPermitIsCodexCliAuthorization: false,
      approvalPermitValidPermitIsSubAgentRuntimeAuthorization: false,
      approvalPermitValidPermitIsHostExecutorAuthorization: false,
      approvalPermitValidPermitIsToolRuntimeAuthorization: false,
      approvalPermitShellCapabilityScopeIsShellExecution: false,
      approvalPermitExternalCapabilityScopeIsExternalWriteExecution: false,
      approvalPermitStorePersistenceIsWorkspaceWriteExecution: false,
      approvalGateNotRequiredStatusIsExecutionAuthorization: false,
      approvalGateResolutionIsProviderExecutionAuthorization: false,
      approvalGateResolutionIsCodexCliAuthorization: false,
      approvalGateResolutionIsSubAgentRuntimeAuthorization: false,
      approvalGateResolutionIsHostExecutorAuthorization: false,
      approvalGateResolutionIsToolRuntimeAuthorization: false,
      approvalGatePendingStatusIsRuntimeInvocation: false,
      approvalGateProtectedBranchSignalIsWorkspaceWriteExecution: false,
      approvalGateDirtyWorkspaceSignalIsWorkspaceWriteExecution: false,
      approvalGateProtectedKeywordSignalIsExternalWriteExecution: false,
      approvalConsumptionDispatchMatrixAuditIsProviderExecuteAuthorization: false,
      approvalConsumptionDispatchMatrixAuditIsRealCodexCliAuthorization: false,
      approvalConsumptionDispatchMatrixAuditIsWorkspaceWriteAuthorization: false,
      approvalConsumptionDispatchMatrixAuditIsLocalCommandAuthorization: false,
      approvalConsumptionDispatchMatrixAuditIsHostExecutorAuthorization: false,
      approvalConsumptionDispatchMatrixAuditIsSubAgentRuntimeAuthorization: false,
      approvalConsumptionDispatchMatrixAuditIsToolRuntimeAuthorization: false,
      approvalConsumptionDispatchMatrixAuditIsExternalWriteAuthorization: false,
      approvalConsumptionDispatchMatrixAuditIsReleaseAuthorization: false,
      approvalConsumptionDispatchMatrixAuditGitStateIsExecutionAuthorization: false,
      approvalConsumptionDispatchMatrixAuditWorktreeCleanIsProviderExecutionAuthorization:
        false,
      approvalConsumptionDispatchMatrixIsProviderExecuteAuthorization: false,
      approvalConsumptionDispatchMatrixIsRealCodexCliAuthorization: false,
      approvalConsumptionDispatchMatrixIsWorkspaceWriteAuthorization: false,
      approvalConsumptionDispatchMatrixIsLocalCommandAuthorization: false,
      approvalConsumptionDispatchMatrixIsHostExecutorAuthorization: false,
      approvalConsumptionDispatchMatrixIsSubAgentRuntimeAuthorization: false,
      approvalConsumptionDispatchMatrixIsExternalWriteAuthorization: false,
      approvalConsumptionDispatchMatrixIsReleaseAuthorization: false,
      approvalConsumptionDispatchApprovalPermitConsumptionIsProviderExecutionAuthorization: false,
      approvalConsumptionDispatchHostDispatcherPreconditionIsProviderExecuteAuthorization: false,
      approvalConsumptionDispatchRedactionCoverageIsRuntimeAuthorization: false,
      readonlyProductizationIsProviderExecuteAuthorization: false,
      readonlyProductizationIsRealCodexCliAuthorization: false,
      readonlyProductizationIsWorkspaceWriteAuthorization: false,
      readonlyProductizationIsLocalCommandAuthorization: false,
      readonlyProductizationIsHostExecutorAuthorization: false,
      readonlyProductizationIsSubAgentRuntimeAuthorization: false,
      readonlyProductizationIsToolRuntimeAuthorization: false,
      readonlyProductizationIsExternalWriteAuthorization: false,
      readonlyProductizationIsEvidenceRefreshAuthorization: false,
      readonlyProductizationIsReleaseAuthorization: false,
      readonlyProductizationGitStateIsExecutionAuthorization: false,
      readonlyProductizationWorktreeCleanIsProviderExecutionAuthorization:
        false,
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
      workspaceWriteReleaseGateIsWorkspaceWriteAuthorization: false,
      workspaceWriteReleaseGateIsRealCodexCliAuthorization: false,
      workspaceWriteReleaseGateIsProviderExecutionAuthorization: false,
      workspaceWriteReleaseGateIsHostExecutorAuthorization: false,
      workspaceWriteReleaseGateIsSubAgentRuntimeAuthorization: false,
      workspaceWriteReleaseGateIsExternalWriteAuthorization: false,
      workspaceWriteReleaseGateIsPushAuthorization: false,
      workspaceWriteReleaseGateIsReleaseAuthorization: false,
      admissionControlAcceptedStatusIsExecutionAuthorization: false,
      admissionControlNeedsApprovalStatusIsApprovalGrant: false,
      admissionControlRejectedStatusIsRuntimeBlockExecution: false,
      admissionControlCapabilityMatchIsRuntimeInvocation: false,
      admissionControlRequiredApprovalIsProviderExecutionAuthorization: false,
      admissionControlRequiredApprovalIsCodexCliAuthorization: false,
      admissionControlRequiredApprovalIsSubAgentRuntimeAuthorization: false,
      admissionControlRequiredApprovalIsHostExecutorAuthorization: false,
      admissionControlExternalCapabilityIsExternalWriteExecution: false,
      admissionControlFileWriteCapabilityIsWorkspaceWriteExecution: false,
      delegationPolicyFullDelegationIsExecutionAuthorization: false,
      delegationPolicyRequiresApprovalFalseIsExecutionAuthorization: false,
      delegationPolicyApprovedProposalIsRuntimeAuthorization: false,
      delegationPolicyAppliedProposalIsProviderExecutionAuthorization: false,
      delegationPolicyFilteredRecoveryActionIsHostExecutorAuthorization: false,
      delegationPolicyRecoveryActionListIsRecoveryExecution: false,
      delegationPolicyHistoricalTrustIsRuntimeAuthorization: false,
      delegationPolicyRecordedResumeIsRuntimeInvocation: false,
      delegationPolicyFileStorePersistenceIsWorkspaceWriteExecution: false,
      executionEligibilityEligibleStatusIsExecutionAuthorization: false,
      executionEligibilityValidApprovalPermitIsProviderExecutionAuthorization: false,
      executionEligibilityCapabilityGrantIsRuntimeInvocation: false,
      executionEligibilityPermitStoreReadIsRuntimeInvocation: false,
      executionEligibilityProviderPlanCreationAllowed: false,
      executionEligibilityProviderExecuteAllowed: false,
      executionEligibilityCodexCliInvocationAllowed: false,
      executionEligibilitySubAgentRuntimeInvocationAllowed: false,
      executionEligibilityHostExecutorInvocationAllowed: false,
      executionEligibilityHostDispatchAllowed: false,
      executionObservationStatusIsExecutionAuthorization: false,
      executionObservationSucceededIsCompletionAuthorization: false,
      executionObservationFailedIsRecoveryAuthorization: false,
      executionObservationEvidenceRefIsRuntimeInvocation: false,
      executionObservationRefResolutionIsReplayAuthorization: false,
      executionObservationRecordWriteIsWorkspaceWriteExecution: false,
      executionObservationFileStorePersistenceAllowed: true,
      executionObservationProviderExecuteAllowed: false,
      executionObservationCodexCliInvocationAllowed: false,
      executionObservationSubAgentRuntimeInvocationAllowed: false,
      executionObservationHostExecutorInvocationAllowed: false,
      executionObservationHostDispatchAllowed: false,
      governanceFailureReducerExecutionFailureIsRecoveryAuthorization: false,
      governanceFailureReducerStrategyDecisionIsRuntimeAuthorization: false,
      governanceFailureReducerArbitrationPacketIsRecoveryExecution: false,
      governanceFailureReducerRecoveryRecommendationIsHostExecutorAuthorization: false,
      governanceFailureReducerAnomalyRecordIsRuntimeInvocation: false,
      governanceFailureReducerEvidenceRefIsReplayAuthorization: false,
      governanceFailureReducerRiskScoreIsProviderExecutionAuthorization: false,
      governanceFailureReducerStateUpdateIsWorkspaceWriteExecution: false,
      taskGraphNodeStatusIsExecutionAuthorization: false,
      taskGraphCompletionIsRuntimeCompletion: false,
      taskGraphDependencyEdgeIsSchedulerDispatch: false,
      taskGraphConflictEdgeIsRuntimeBlockExecution: false,
      taskGraphCheckpointNodeIsRollbackExecution: false,
      taskGraphDeltaIsWorkspaceRollbackAuthorization: false,
      taskGraphRollbackToCheckpointIsHostExecutorAuthorization: false,
      taskGraphBranchMergeIsGitMergeOrWorkspaceWrite: false,
      taskGraphFileStorePersistenceIsWorkspaceWriteExecution: false,
      schedulerQueuedStatusIsDispatchAuthorization: false,
      schedulerLeasedStatusIsExecutionAuthorization: false,
      schedulerActiveLeaseIsProviderExecuteAuthorization: false,
      schedulerWorkerIdIsHostOrSubAgentAuthorization: false,
      schedulerReleaseLeaseIsRuntimeCompletionProof: false,
      schedulerFailLeaseIsRecoveryExecution: false,
      schedulerExpiredLeaseIsRetryExecution: false,
      schedulerExhaustedStatusIsRuntimeBlockExecution: false,
      schedulerFileStatePersistenceIsWorkspaceWriteExecution: false,
      schedulerFileLockIsShellProcessExecution: false,
      executionPlannerPlannedStatusIsProviderExecutionAuthorization: false,
      executionPlannerCodexCliProviderSelectionIsCodexCliInvocation: false,
      executionPlannerRemoteAgentProviderSelectionIsSubAgentRuntimeInvocation: false,
      executionPlannerWorkspaceWriteSideEffectClassIsWorkspaceWriteExecution: false,
      executionPlannerLocalPlanStoreWritesAllowed: true,
      executionPlannerProviderPlanExecutionAllowed: false,
      executionPlannerProviderValidateExecutionPlanAllowed: false,
      executionPlannerProviderExecuteAllowed: false,
      executionPlannerCodexCliInvocationAllowed: false,
      executionPlannerSubAgentRuntimeInvocationAllowed: false,
      executionPlannerHostExecutorInvocationAllowed: false,
      executionPlannerHostDispatchAllowed: false,
      executionPlannerWorkspaceWriteExecutionAllowed: false,
      providerRegistrySelectedProviderIsExecutionAuthorization: false,
      providerRegistryProviderGrantSelectionIsProviderExecuteAuthorization: false,
      providerRegistryRoutingDecisionSelectionIsCodexCliAuthorization: false,
      providerRegistryRegisteredExecutorProviderIsRuntimeInvocation: false,
      providerRegistryRegisteredToolProviderIsToolRuntimeInvocation: false,
      providerRegistryRegisteredRemoteAgentProviderIsSubAgentRuntimeAuthorization: false,
      providerRegistryRemoteAgentAuthSchemesAreRuntimeAuthorization: false,
      providerRegistryManifestStorePersistenceIsWorkspaceWriteExecution: false,
      controlledProviderExecutionTaskbookIsProviderExecuteAuthorization: false,
      controlledProviderExecutionTaskbookIsRealCodexCliAuthorization: false,
      controlledProviderExecutionTaskbookIsWorkspaceWriteAuthorization: false,
      controlledProviderExecutionTaskbookIsLocalCommandAuthorization: false,
      controlledProviderExecutionTaskbookIsProtectedRemoteAuthorization: false,
      controlledProviderExecutionTaskbookIsHostExecutorAuthorization: false,
      controlledProviderExecutionTaskbookIsSubAgentRuntimeAuthorization: false,
      controlledProviderExecutionTaskbookIsExternalWriteAuthorization: false,
      controlledProviderExecutionTaskbookIsReleaseAuthorization: false,
      controlledProviderExecutionTaskbookIsSecretChangeAuthorization: false,
      controlledProviderExecutionTaskbookReviewAuditIsProviderExecuteAuthorization: false,
      controlledProviderExecutionTaskbookReviewAuditIsRealCodexCliAuthorization: false,
      controlledProviderExecutionTaskbookReviewAuditIsWorkspaceWriteAuthorization: false,
      controlledProviderExecutionTaskbookReviewAuditIsLocalCommandAuthorization: false,
      controlledProviderExecutionTaskbookReviewAuditIsHostExecutorAuthorization: false,
      controlledProviderExecutionTaskbookReviewAuditIsSubAgentRuntimeAuthorization: false,
      controlledProviderExecutionTaskbookReviewAuditIsExternalWriteAuthorization: false,
      controlledProviderExecutionTaskbookReviewAuditIsReleaseAuthorization: false,
      controlledProviderExecutionTaskbookReviewAuditGitStateIsExecutionAuthorization: false,
      controlledProviderExecutionTaskbookReviewAuditWorktreeCleanIsProviderExecutionAuthorization: false,
      controlledProviderExecutionDispatchPreflightIsProviderExecuteAuthorization: false,
      controlledProviderExecutionDispatchPreflightIsRealCodexCliAuthorization: false,
      controlledProviderExecutionDispatchPreflightIsWorkspaceWriteAuthorization: false,
      controlledProviderExecutionDispatchPreflightIsHostExecutorAuthorization: false,
      controlledProviderExecutionDispatchPreflightIsSubAgentRuntimeAuthorization: false,
      controlledProviderExecutionDispatchPreflightIsShellProcessAuthorization: false,
      controlledProviderExecutionDispatchPreflightIsExternalWriteAuthorization: false,
      controlledProviderExecutionDispatchPreflightIsReleaseAuthorization: false,
      controlledProviderExecutionDispatchPreflightRunnerRemainsFinalProviderExecuteGate: true,
      controlledProviderExecutionDispatchPreflightDryRunDefaultPreserved: true,
      controlledProviderExecutionDispatcherCallsProviderExecuteDirectly: false,
      controlledProviderExecutionDispatcherCallsRealCodexCliDirectly: false,
      controlledProviderExecutionDispatcherControlledWorkspaceWriteDispatchAllowed:
        true,
      controlledProviderExecutionDispatcherAuthorizesGeneralWorkspaceWrite: false,
      controlledProviderExecutionDispatcherWorkspaceWriteProviderExecuteAllowed:
        false,
      controlledProviderExecutionDispatcherAuthorizesHostExecutor: false,
      controlledProviderExecutionDispatcherAuthorizesSubAgentRuntime: false,
      controlledProviderExecutionDispatcherCallsRunnerBoundary: true,
      controlledProviderExecutionDispatcherDefaultDryRunPreserved: true,
      providerExecutionRunnerWorkspaceWriteAllowed: true,
      providerExecutionRunnerWorkspaceWriteProviderExecuteAllowed: false,
      providerExecutionRunnerDefaultRealCodexCliAllowed: false,
      providerExecutionRunnerNonCodexProviderExecutionAllowed: false,
      providerCorePrimitivesExecutionAllowed: false,
      toolInvocationPlannerPlannedStatusIsRuntimeInvocation: false,
      toolInvocationPlannerRemoteAgentToolManifestIsSubAgentRuntimeAuthorization: false,
      toolInvocationPlannerExternalWriteToolManifestIsExternalWriteAuthorization: false,
      toolInvocationPlannerApprovalPermitIsToolRuntimeAuthorization: false,
      toolInvocationPlannerLocalWriteToolPlanIsWorkspaceWriteExecution: false,
      toolInvocationPlannerInputPreviewStoresRawSecrets: false,
      toolInvocationPlannerDefaultCodexCliInvocationAllowed: false,
      toolInvocationPlannerProviderExecuteAllowed: false,
      toolInvocationPlannerSubAgentRuntimeInvocationAllowed: false,
      toolInvocationPlannerHostExecutorInvocationAllowed: false,
      toolInvocationPlannerToolRuntimeInvocationAllowed: false,
      toolInvocationPlannerShellProcessAllowedByDefault: false,
      toolInvocationPlannerWorkspaceWriteAllowedByDefault: false,
      toolInvocationPlannerExternalWriteAllowedByDefault: false,
      desktopAgentStrategyParallelPlanIsSubAgentRuntimeAuthorization: false,
      desktopAgentStrategyWorkerAssignmentIsRuntimeInvocation: false,
      desktopAgentStrategyWriteModeIsWorkspaceWriteExecution: false,
      desktopAgentStrategyOwnershipTargetIsWorkspaceWriteAuthorization: false,
      desktopAgentStrategyMaxAgentsIsSubAgentSpawnAuthorization: false,
      desktopAgentStrategyReadOnlyAnalystIsProviderExecutionAuthorization: false,
      desktopAgentStrategyReasonIsExecutionGate: false,
      desktopDecisionRunnerReadyStatusIsExecutionAuthorization: false,
      desktopDecisionRunnerProviderSelectionIsProviderExecute: false,
      desktopDecisionRunnerAgentStrategyIsSubAgentRuntimeInvocation: false,
      desktopDecisionRunnerHostDispatchAllowed: false,
      desktopDecisionRunnerProviderExecuteAllowed: false,
      desktopDecisionRunnerCodexCliInvocationAllowed: false,
      finalHostLocatorReadyForMappingIsHostExecutionAuthorization: false,
      finalHostLocatorHostExecutorInvocationAllowed: false,
      finalHostLocatorHostDispatchAllowed: false,
      finalHostLocatorProviderExecuteAllowed: false,
      finalHostLocatorCodexCliInvocationAllowed: false,
      finalHostLocatorSubAgentRuntimeInvocationAllowed: false,
      codexDesktopRuntimeToolInvocationAllowedByDefault: false,
      codexDesktopLiveHostDefaultRuntimeToolInvocationAllowed: false,
      codexDesktopLiveHostCodexCliInvocationAllowed: false,
      codexMemoryMcpClientMcpHttpCallsAreProviderExecution: false,
      codexMemoryMcpClientMcpHttpCallsAreHostExecutorAuthorization: false,
      codexMemoryMcpClientRecordMemoryIsWorkspaceWriteExecution: false,
      codexMemoryMcpClientSearchMemoryIsSubAgentRuntimeInvocation: false,
      codexMemoryMcpClientMemoryOverviewIsRuntimeAuthorization: false,
      codexMemoryMcpClientAdapterCheckpointWriteIsExecutionAuthorization: false,
      codexMemoryMcpClientDefaultEndpointLookupAllowed: false,
      codexMemoryMcpClientBearerTokenIsExecutionAuthorization: false,
      codexMemoryMcpClientDefaultCodexCliInvocationAllowed: false,
      codexMemoryMcpClientProviderExecuteAllowed: false,
      codexMemoryMcpClientSubAgentRuntimeInvocationAllowed: false,
      codexMemoryMcpClientShellProcessAllowedByDefault: false,
      codexMemoryMcpClientWorkspaceWriteAllowedByDefault: false,
      codexMemoryHostClientMemoryOperationCallsAreHostExecutorAuthorization: false,
      codexMemoryHostClientRecordMemoryIsWorkspaceWriteExecution: false,
      codexMemoryHostClientSearchMemoryIsSubAgentRuntimeInvocation: false,
      codexMemoryHostClientMemoryOverviewIsRuntimeAuthorization: false,
      codexMemoryHostClientAdapterCheckpointWriteIsExecutionAuthorization: false,
      codexMemoryHostClientMcpToolStyleAdapterIsDefaultHostLookup: false,
      codexMemoryHostClientDefaultRealHostExecutionAllowed: false,
      codexMemoryHostClientDefaultHostExecutorLookupAllowed: false,
      codexMemoryHostClientDefaultCodexCliInvocationAllowed: false,
      codexMemoryHostClientProviderExecuteAllowed: false,
      codexMemoryHostClientSubAgentRuntimeInvocationAllowed: false,
      codexMemoryHostClientShellProcessAllowedByDefault: false,
      codexMemoryHostClientWorkspaceWriteAllowedByDefault: false,
      desktopHostClientDefaultRealExecutionAllowed: false,
      desktopHostClientDefaultHostExecutorLookupAllowed: false,
      desktopHostClientDirectDispatchToHostAllowed: false,
      desktopHostClientExecuteInjectedDispatchAllowed: true,
      desktopHostClientControlledWorkspaceWriteDispatchAllowed: true,
      desktopHostClientGeneralWorkspaceWriteAllowed: false,
      desktopHostClientWorkspaceWriteProviderExecuteAllowed: false,
      desktopLiveAdapterBlockedDecisionExecutionAllowed: false,
      hostClientExampleRealShellProcessAllowed: false,
      hostClientExampleHostExecutorDispatchSurfacePresent: false,
      hostClientExampleWorkspaceWriteAllowed: false,
      targetHostEmbeddingPlaceholderMethodsAreRealExecution: false,
      targetHostEmbeddingScaffoldReadyStatusIsExecutionAuthorization: false,
      targetHostEmbeddingCreateBundleRequiresFullyWiredHost: true,
      targetHostEmbeddingCreateBundleIsHostExecutorAuthorization: false,
      targetHostEmbeddingDirectiveBuildersAreShellAuthorization: false,
      targetHostEmbeddingDefaultRealHostExecutionAllowed: false,
      targetHostEmbeddingDefaultHostExecutorLookupAllowed: false,
      targetHostEmbeddingDefaultCodexCliInvocationAllowed: false,
      targetHostEmbeddingProviderExecuteAllowed: false,
      targetHostEmbeddingSubAgentRuntimeInvocationAllowed: false,
      targetHostEmbeddingShellProcessAllowedByDefault: false,
      targetHostEmbeddingWorkspaceWriteAllowedByDefault: false,
      desktopLiveAdapterBridgeInvocationAllowedByCodexCliRoute: false,
      desktopLiveAdapterProviderInvocationAllowed: false,
      hostDispatcherReadOnlyProviderDispatchAllowed: true,
      hostDispatcherControlledWorkspaceWriteDispatchAllowed: true,
      hostDispatcherGeneralProviderExecutionAllowed: false,
      hostDispatcherGeneralWorkspaceWriteAllowed: false,
      hostDispatcherWorkspaceWriteProviderExecuteAllowed: false,
      hostExecutorDefaultRealExecutionAllowed: false,
      hostExecutorTaskbookExecutionAllowed: false,
      hostClientExecutorReviewDispatchAllowed: false,
      hostExecutorReceiptDispatchMeansBusinessRecoveryCompleted: false,
      agentBackedRecoveryProductionExecutionAllowed: false,
      agentExecutorAdapterTaskbookExecutionAllowed: false,
      agentExecutorAdapterReviewInvocationAllowed: false,
      agentExecutorAdapterSandboxProductionExecutionAllowed: false,
      taskControlTaskbookExecutionAllowed: false,
      taskControlReviewInvocationAllowed: false,
      subAgentRuntimeExecutionAllowed: false,
      taskControlAdapterKind: "sandbox_task_control_adapter",
      totalStrategyRouterCallsDuringAudit: 0,
      totalStrategyRouterProviderPlanExecutionCallsDuringAudit: 0,
      totalStrategyRouterProviderValidateExecutionPlanCallsDuringAudit: 0,
      totalStrategyRouterProviderExecuteCallsDuringAudit: 0,
      totalExecutionProfileLookupsDuringAudit: 0,
      totalExecutionProfilesProviderExecuteCallsDuringAudit: 0,
      totalExecutionProfilesCodexCliCallsDuringAudit: 0,
      totalExecutionProfilesDesktopPrimitiveCallsDuringAudit: 0,
      totalExecutionProfilesSubAgentRuntimeCallsDuringAudit: 0,
      totalExecutionProfilesHostExecutorCallsDuringAudit: 0,
      totalExecutionProfilesHostDispatchCallsDuringAudit: 0,
      totalExecutionProfilesToolRuntimeCallsDuringAudit: 0,
      totalExecutionProfilesShellProcessCallsDuringAudit: 0,
      totalExecutionProfilesWorkspaceWriteCallsDuringAudit: 0,
      totalExecutionProfilesExternalWriteCallsDuringAudit: 0,
      totalPolicyConfigLoadCallsDuringAudit: 0,
      totalPolicyConfigProviderExecuteCallsDuringAudit: 0,
      totalPolicyConfigCodexCliCallsDuringAudit: 0,
      totalPolicyConfigDesktopPrimitiveCallsDuringAudit: 0,
      totalPolicyConfigSubAgentRuntimeCallsDuringAudit: 0,
      totalPolicyConfigHostExecutorCallsDuringAudit: 0,
      totalPolicyConfigHostDispatchCallsDuringAudit: 0,
      totalPolicyConfigToolRuntimeCallsDuringAudit: 0,
      totalPolicyConfigShellProcessCallsDuringAudit: 0,
      totalPolicyConfigWorkspaceWriteCallsDuringAudit: 0,
      totalPolicyConfigExternalWriteCallsDuringAudit: 0,
      totalCapabilityTaxonomyProviderExecuteCallsDuringAudit: 0,
      totalCapabilityTaxonomyCodexCliCallsDuringAudit: 0,
      totalCapabilityTaxonomyWorkspaceWriteCallsDuringAudit: 0,
      totalCapabilityTaxonomyCanaryFileWriteCallsDuringAudit: 0,
      totalCapabilityTaxonomyGeneralProviderExecutionCallsDuringAudit: 0,
      totalCapabilityTaxonomyExternalWriteCallsDuringAudit: 0,
      totalCapabilityTaxonomyReleaseCallsDuringAudit: 0,
      totalCapabilityTaxonomySecretAccessCallsDuringAudit: 0,
      totalCapabilityTaxonomyShellProcessCallsDuringAudit: 0,
      totalCapabilityTaxonomyEscalationPolicyProviderExecuteCallsDuringAudit: 0,
      totalCapabilityTaxonomyEscalationPolicyCodexCliCallsDuringAudit: 0,
      totalCapabilityTaxonomyEscalationPolicyWorkspaceWriteCallsDuringAudit: 0,
      totalCapabilityTaxonomyEscalationPolicyHostExecutorCallsDuringAudit: 0,
      totalCapabilityTaxonomyEscalationPolicySubAgentRuntimeCallsDuringAudit: 0,
      totalCapabilityTaxonomyEscalationPolicyToolRuntimeCallsDuringAudit: 0,
      totalCapabilityTaxonomyEscalationPolicyShellProcessCallsDuringAudit: 0,
      totalCapabilityTaxonomyEscalationPolicyExternalWriteCallsDuringAudit: 0,
      totalCapabilityTaxonomyEscalationPolicyReleaseCallsDuringAudit: 0,
      totalCapabilityTaxonomyEscalationPolicySecretAccessCallsDuringAudit: 0,
      totalRoutingEngineCallsDuringAudit: 0,
      totalRoutingEngineProviderGrantCreationsDuringAudit: 0,
      totalRoutingEngineProviderExecuteCallsDuringAudit: 0,
      totalRoutingEngineCodexCliCallsDuringAudit: 0,
      totalRoutingEngineDesktopRuntimeCallsDuringAudit: 0,
      totalRoutingEngineSubAgentRuntimeCallsDuringAudit: 0,
      totalRoutingEngineHostExecutorCallsDuringAudit: 0,
      totalRoutingEngineHostDispatchCallsDuringAudit: 0,
      totalRoutingEngineToolRuntimeCallsDuringAudit: 0,
      totalRoutingEngineShellProcessCallsDuringAudit: 0,
      totalRoutingEngineWorkspaceWriteCallsDuringAudit: 0,
      totalRoutingEngineExternalWriteCallsDuringAudit: 0,
      totalRecoveryControlCallsDuringAudit: 0,
      totalRecoveryControlHostExecutorInvocationsDuringAudit: 0,
      totalRecoveryControlAdapterInvocationsDuringAudit: 0,
      totalRecoveryControlCodexCliCallsDuringAudit: 0,
      totalRecoveryControlProviderExecuteCallsDuringAudit: 0,
      totalRecoveryControlSubAgentRuntimeCallsDuringAudit: 0,
      totalRecoveryControlShellProcessCallsDuringAudit: 0,
      totalRecoveryControlWorkspaceWriteCallsDuringAudit: 0,
      totalRecoveryControlExternalWriteCallsDuringAudit: 0,
      totalRuntimeControlCallsDuringAudit: 0,
      totalRuntimeControlProviderExecuteCallsDuringAudit: 0,
      totalRuntimeControlCodexCliCallsDuringAudit: 0,
      totalRuntimeControlSubAgentRuntimeCallsDuringAudit: 0,
      totalRuntimeControlHostExecutorCallsDuringAudit: 0,
      totalRuntimeControlHostDispatchCallsDuringAudit: 0,
      totalRuntimeControlModelRuntimeCallsDuringAudit: 0,
      totalRuntimeControlShellProcessCallsDuringAudit: 0,
      totalRuntimeControlWorkspaceWriteCallsDuringAudit: 0,
      totalRuntimeControlExternalWriteCallsDuringAudit: 0,
      totalOperatorActionExecutorGateInvocationsDuringAudit: 0,
      totalCodexCliHostProcessSpawnsDuringAudit: 0,
      totalPublicApiCallsDuringAudit: 0,
      totalAgentOsLocalRuntimeCallsDuringAudit: 0,
      totalAgentOsMcpServerManifestCallsDuringAudit: 0,
      totalAgentOsMcpServerManifestLiveServerStartsDuringAudit: 0,
      totalAgentOsMcpServerManifestLocalRuntimeCallsDuringAudit: 0,
      totalAgentOsMcpServerManifestToolRuntimeCallsDuringAudit: 0,
      totalAgentOsMcpServerManifestProviderExecuteCallsDuringAudit: 0,
      totalAgentOsMcpServerManifestCodexCliCallsDuringAudit: 0,
      totalAgentOsMcpServerManifestDesktopPrimitiveCallsDuringAudit: 0,
      totalAgentOsMcpServerManifestSubAgentRuntimeCallsDuringAudit: 0,
      totalAgentOsMcpServerManifestHostExecutorCallsDuringAudit: 0,
      totalAgentOsMcpServerManifestHostDispatchCallsDuringAudit: 0,
      totalAgentOsMcpServerManifestShellProcessCallsDuringAudit: 0,
      totalAgentOsMcpServerManifestNetworkCallsDuringAudit: 0,
      totalAgentOsMcpServerManifestWorkspaceWriteCallsDuringAudit: 0,
      totalAgentOsMcpServerManifestExternalWriteCallsDuringAudit: 0,
      totalProtocolMcpCallsDuringAudit: 0,
      totalProtocolMcpLiveServerConnectionsDuringAudit: 0,
      totalProtocolMcpToolRuntimeCallsDuringAudit: 0,
      totalProtocolMcpProviderExecuteCallsDuringAudit: 0,
      totalProtocolMcpCodexCliCallsDuringAudit: 0,
      totalProtocolMcpDesktopPrimitiveCallsDuringAudit: 0,
      totalProtocolMcpSubAgentRuntimeCallsDuringAudit: 0,
      totalProtocolMcpHostExecutorCallsDuringAudit: 0,
      totalProtocolMcpHostDispatchCallsDuringAudit: 0,
      totalProtocolMcpShellProcessCallsDuringAudit: 0,
      totalProtocolMcpNetworkCallsDuringAudit: 0,
      totalProtocolMcpWorkspaceWriteCallsDuringAudit: 0,
      totalProtocolMcpExternalWriteCallsDuringAudit: 0,
      totalProtocolA2aCallsDuringAudit: 0,
      totalProtocolA2aLiveNetworkServiceStartsDuringAudit: 0,
      totalProtocolA2aRemoteAgentRuntimeCallsDuringAudit: 0,
      totalProtocolA2aRemoteTaskCreationsDuringAudit: 0,
      totalProtocolA2aProviderExecuteCallsDuringAudit: 0,
      totalProtocolA2aCodexCliCallsDuringAudit: 0,
      totalProtocolA2aDesktopPrimitiveCallsDuringAudit: 0,
      totalProtocolA2aSubAgentRuntimeCallsDuringAudit: 0,
      totalProtocolA2aHostExecutorCallsDuringAudit: 0,
      totalProtocolA2aHostDispatchCallsDuringAudit: 0,
      totalProtocolA2aShellProcessCallsDuringAudit: 0,
      totalProtocolA2aNetworkCallsDuringAudit: 0,
      totalProtocolA2aWorkspaceWriteCallsDuringAudit: 0,
      totalProtocolA2aExternalWriteCallsDuringAudit: 0,
      totalAgentOsSdkCallsDuringAudit: 0,
      totalAgentOsSdkLocalRuntimeCallsDuringAudit: 0,
      totalAgentOsSdkProviderExecuteCallsDuringAudit: 0,
      totalAgentOsSdkCodexCliCallsDuringAudit: 0,
      totalAgentOsSdkDesktopPrimitiveCallsDuringAudit: 0,
      totalAgentOsSdkSubAgentRuntimeCallsDuringAudit: 0,
      totalAgentOsSdkHostExecutorCallsDuringAudit: 0,
      totalAgentOsSdkHostDispatchCallsDuringAudit: 0,
      totalAgentOsSdkShellProcessCallsDuringAudit: 0,
      totalAgentOsSdkNetworkCallsDuringAudit: 0,
      totalAgentOsSdkWorkspaceWriteCallsDuringAudit: 0,
      totalAgentOsSdkExternalWriteCallsDuringAudit: 0,
      totalAgentOsCliWrapperCallsDuringAudit: 0,
      totalAgentOsCliLocalRuntimeCallsDuringAudit: 0,
      totalAgentOsCliProviderExecuteCallsDuringAudit: 0,
      totalAgentOsCliCodexCliCallsDuringAudit: 0,
      totalAgentOsCliDesktopPrimitiveCallsDuringAudit: 0,
      totalAgentOsCliSubAgentRuntimeCallsDuringAudit: 0,
      totalAgentOsCliHostExecutorCallsDuringAudit: 0,
      totalAgentOsCliHostDispatchCallsDuringAudit: 0,
      totalAgentOsCliShellProcessCallsDuringAudit: 0,
      totalAgentOsCliNetworkCallsDuringAudit: 0,
      totalAgentOsCliWorkspaceWriteCallsDuringAudit: 0,
      totalAgentOsCliExternalWriteCallsDuringAudit: 0,
      totalAgentOsAppServerWrapperCallsDuringAudit: 0,
      totalAgentOsAppServerLocalRuntimeCallsDuringAudit: 0,
      totalAgentOsAppServerLiveHttpServerStartsDuringAudit: 0,
      totalAgentOsAppServerNetworkCallsDuringAudit: 0,
      totalAgentOsAppServerProviderExecuteCallsDuringAudit: 0,
      totalAgentOsAppServerCodexCliCallsDuringAudit: 0,
      totalAgentOsAppServerDesktopPrimitiveCallsDuringAudit: 0,
      totalAgentOsAppServerSubAgentRuntimeCallsDuringAudit: 0,
      totalAgentOsAppServerHostExecutorCallsDuringAudit: 0,
      totalAgentOsAppServerHostDispatchCallsDuringAudit: 0,
      totalAgentOsAppServerShellProcessCallsDuringAudit: 0,
      totalAgentOsAppServerWorkspaceWriteCallsDuringAudit: 0,
      totalAgentOsAppServerExternalWriteCallsDuringAudit: 0,
      totalAgentOsPublicSurfaceCallsDuringAudit: 0,
      totalAgentOsPublicSurfaceLocalRuntimeCallsDuringAudit: 0,
      totalAgentOsPublicSurfaceProviderExecuteCallsDuringAudit: 0,
      totalAgentOsPublicSurfaceCodexCliCallsDuringAudit: 0,
      totalAgentOsPublicSurfaceDesktopPrimitiveCallsDuringAudit: 0,
      totalAgentOsPublicSurfaceSubAgentRuntimeCallsDuringAudit: 0,
      totalAgentOsPublicSurfaceHostExecutorCallsDuringAudit: 0,
      totalAgentOsPublicSurfaceHostDispatchCallsDuringAudit: 0,
      totalAgentOsPublicSurfaceShellProcessCallsDuringAudit: 0,
      totalAgentOsPublicSurfaceNetworkCallsDuringAudit: 0,
      totalAgentOsPublicSurfaceWorkspaceWriteCallsDuringAudit: 0,
      totalAgentOsPublicSurfaceExternalWriteCallsDuringAudit: 0,
      totalProviderExecuteCallsDuringAudit: 0,
      totalPreflightCallsDuringAudit: 0,
      totalPreflightProviderExecuteCallsDuringAudit: 0,
      totalPreflightCodexCliCallsDuringAudit: 0,
      totalPreflightDesktopPrimitiveCallsDuringAudit: 0,
      totalPreflightSubAgentRuntimeCallsDuringAudit: 0,
      totalPreflightHostExecutorCallsDuringAudit: 0,
      totalPreflightHostDispatchCallsDuringAudit: 0,
      totalPreflightToolRuntimeCallsDuringAudit: 0,
      totalPreflightShellProcessCallsDuringAudit: 0,
      totalPreflightNetworkCallsDuringAudit: 0,
      totalPreflightWorkspaceWriteCallsDuringAudit: 0,
      totalPreflightExternalWriteCallsDuringAudit: 0,
      totalApprovalPermitCallsDuringAudit: 0,
      totalApprovalPermitValidationCallsDuringAudit: 0,
      totalApprovalPermitProviderExecuteCallsDuringAudit: 0,
      totalApprovalPermitCodexCliCallsDuringAudit: 0,
      totalApprovalPermitSubAgentRuntimeCallsDuringAudit: 0,
      totalApprovalPermitHostExecutorCallsDuringAudit: 0,
      totalApprovalPermitToolRuntimeCallsDuringAudit: 0,
      totalApprovalPermitShellProcessCallsDuringAudit: 0,
      totalApprovalPermitWorkspaceWriteCallsDuringAudit: 0,
      totalApprovalPermitExternalWriteCallsDuringAudit: 0,
      totalApprovalGateCallsDuringAudit: 0,
      totalApprovalGateResolutionChecksDuringAudit: 0,
      totalApprovalGateProviderExecuteCallsDuringAudit: 0,
      totalApprovalGateCodexCliCallsDuringAudit: 0,
      totalApprovalGateSubAgentRuntimeCallsDuringAudit: 0,
      totalApprovalGateHostExecutorCallsDuringAudit: 0,
      totalApprovalGateToolRuntimeCallsDuringAudit: 0,
      totalApprovalGateShellProcessCallsDuringAudit: 0,
      totalApprovalGateWorkspaceWriteCallsDuringAudit: 0,
      totalApprovalGateExternalWriteCallsDuringAudit: 0,
      totalApprovalConsumptionDispatchMatrixBoundaryProviderExecuteCallsDuringAudit:
        0,
      totalApprovalConsumptionDispatchMatrixBoundaryCodexCliCallsDuringAudit: 0,
      totalApprovalConsumptionDispatchMatrixBoundaryWorkspaceWriteCallsDuringAudit:
        0,
      totalApprovalConsumptionDispatchMatrixBoundaryHostExecutorCallsDuringAudit: 0,
      totalApprovalConsumptionDispatchMatrixBoundarySubAgentRuntimeCallsDuringAudit:
        0,
      totalApprovalConsumptionDispatchMatrixBoundaryToolRuntimeCallsDuringAudit: 0,
      totalApprovalConsumptionDispatchMatrixBoundaryShellProcessCallsDuringAudit: 0,
      totalApprovalConsumptionDispatchMatrixBoundaryExternalWriteCallsDuringAudit:
        0,
      totalApprovalConsumptionDispatchProviderExecuteCallsDuringAudit: 0,
      totalApprovalConsumptionDispatchCodexCliCallsDuringAudit: 0,
      totalApprovalConsumptionDispatchWorkspaceWriteCallsDuringAudit: 0,
      totalApprovalConsumptionDispatchHostExecutorCallsDuringAudit: 0,
      totalApprovalConsumptionDispatchSubAgentRuntimeCallsDuringAudit: 0,
      totalApprovalConsumptionDispatchShellProcessCallsDuringAudit: 0,
      totalApprovalConsumptionDispatchExternalWriteCallsDuringAudit: 0,
      totalReadonlyProductizationBoundaryProviderExecuteCallsDuringAudit: 0,
      totalReadonlyProductizationBoundaryCodexCliCallsDuringAudit: 0,
      totalReadonlyProductizationBoundaryWorkspaceWriteCallsDuringAudit: 0,
      totalReadonlyProductizationBoundaryHostExecutorCallsDuringAudit: 0,
      totalReadonlyProductizationBoundarySubAgentRuntimeCallsDuringAudit: 0,
      totalReadonlyProductizationBoundaryToolRuntimeCallsDuringAudit: 0,
      totalReadonlyProductizationBoundaryShellProcessCallsDuringAudit: 0,
      totalReadonlyProductizationBoundaryExternalWriteCallsDuringAudit: 0,
      totalReadonlyProductizationBoundaryEvidenceWritesDuringAudit: 0,
      totalStateSyncBoundaryProviderExecuteCallsDuringAudit: 0,
      totalStateSyncBoundaryCodexCliCallsDuringAudit: 0,
      totalStateSyncBoundaryWorkspaceWriteCallsDuringAudit: 0,
      totalStateSyncBoundaryLocalCommandCallsDuringAudit: 0,
      totalStateSyncBoundaryHostExecutorCallsDuringAudit: 0,
      totalStateSyncBoundarySubAgentRuntimeCallsDuringAudit: 0,
      totalStateSyncBoundaryToolRuntimeCallsDuringAudit: 0,
      totalStateSyncBoundaryExternalWriteCallsDuringAudit: 0,
      totalStateSyncBoundaryStateWritesDuringAudit: 0,
      totalStateSyncBoundaryRemoteWritesDuringAudit: 0,
      totalWorkspaceWriteReleaseGateProviderExecuteCallsDuringAudit: 0,
      totalWorkspaceWriteReleaseGateCodexCliCallsDuringAudit: 0,
      totalWorkspaceWriteReleaseGateWorkspaceWriteCallsDuringAudit: 0,
      totalWorkspaceWriteReleaseGateHostExecutorCallsDuringAudit: 0,
      totalWorkspaceWriteReleaseGateSubAgentRuntimeCallsDuringAudit: 0,
      totalWorkspaceWriteReleaseGateExternalWriteCallsDuringAudit: 0,
      totalWorkspaceWriteReleaseGateEvidenceWritesDuringAudit: 0,
      totalAdmissionControlCallsDuringAudit: 0,
      totalAdmissionControlProviderExecuteCallsDuringAudit: 0,
      totalAdmissionControlCodexCliCallsDuringAudit: 0,
      totalAdmissionControlSubAgentRuntimeCallsDuringAudit: 0,
      totalAdmissionControlHostExecutorCallsDuringAudit: 0,
      totalAdmissionControlToolRuntimeCallsDuringAudit: 0,
      totalAdmissionControlShellProcessCallsDuringAudit: 0,
      totalAdmissionControlWorkspaceWriteCallsDuringAudit: 0,
      totalAdmissionControlExternalWriteCallsDuringAudit: 0,
      totalDelegationPolicyCallsDuringAudit: 0,
      totalDelegationPolicyProposalLifecycleCallsDuringAudit: 0,
      totalDelegationPolicyFileStoreWritesDuringAudit: 0,
      totalDelegationPolicyProviderExecuteCallsDuringAudit: 0,
      totalDelegationPolicyCodexCliCallsDuringAudit: 0,
      totalDelegationPolicySubAgentRuntimeCallsDuringAudit: 0,
      totalDelegationPolicyHostExecutorCallsDuringAudit: 0,
      totalDelegationPolicyToolRuntimeCallsDuringAudit: 0,
      totalDelegationPolicyShellProcessCallsDuringAudit: 0,
      totalDelegationPolicyWorkspaceWriteCallsDuringAudit: 0,
      totalDelegationPolicyExternalWriteCallsDuringAudit: 0,
      totalExecutionEligibilityCallsDuringAudit: 0,
      totalExecutionEligibilityPermitStoreReadsDuringAudit: 0,
      totalExecutionEligibilityProviderPlanCreationCallsDuringAudit: 0,
      totalExecutionEligibilityProviderExecuteCallsDuringAudit: 0,
      totalExecutionEligibilityCodexCliCallsDuringAudit: 0,
      totalExecutionEligibilitySubAgentRuntimeCallsDuringAudit: 0,
      totalExecutionEligibilityHostExecutorCallsDuringAudit: 0,
      totalExecutionEligibilityHostDispatchCallsDuringAudit: 0,
      totalExecutionEligibilityShellProcessCallsDuringAudit: 0,
      totalExecutionEligibilityWorkspaceWriteCallsDuringAudit: 0,
      totalExecutionEligibilityExternalWriteCallsDuringAudit: 0,
      totalExecutionObservationBusEmitsDuringAudit: 0,
      totalExecutionObservationStoreWritesDuringAudit: 0,
      totalExecutionObservationProviderExecuteCallsDuringAudit: 0,
      totalExecutionObservationCodexCliCallsDuringAudit: 0,
      totalExecutionObservationSubAgentRuntimeCallsDuringAudit: 0,
      totalExecutionObservationHostExecutorCallsDuringAudit: 0,
      totalExecutionObservationHostDispatchCallsDuringAudit: 0,
      totalExecutionObservationShellProcessCallsDuringAudit: 0,
      totalExecutionObservationWorkspaceWriteCallsDuringAudit: 0,
      totalExecutionObservationExternalWriteCallsDuringAudit: 0,
      totalGovernanceFailureReducerCallbackCallsDuringAudit: 0,
      totalGovernanceFailureReducerPersistenceWritesDuringAudit: 0,
      totalGovernanceFailureReducerProviderExecuteCallsDuringAudit: 0,
      totalGovernanceFailureReducerCodexCliCallsDuringAudit: 0,
      totalGovernanceFailureReducerSubAgentRuntimeCallsDuringAudit: 0,
      totalGovernanceFailureReducerHostExecutorCallsDuringAudit: 0,
      totalGovernanceFailureReducerHostDispatchCallsDuringAudit: 0,
      totalGovernanceFailureReducerToolRuntimeCallsDuringAudit: 0,
      totalGovernanceFailureReducerShellProcessCallsDuringAudit: 0,
      totalGovernanceFailureReducerWorkspaceWriteCallsDuringAudit: 0,
      totalGovernanceFailureReducerExternalWriteCallsDuringAudit: 0,
      totalTaskGraphCallsDuringAudit: 0,
      totalTaskGraphStoreWritesDuringAudit: 0,
      totalTaskGraphProviderExecuteCallsDuringAudit: 0,
      totalTaskGraphCodexCliCallsDuringAudit: 0,
      totalTaskGraphSubAgentRuntimeCallsDuringAudit: 0,
      totalTaskGraphHostExecutorCallsDuringAudit: 0,
      totalTaskGraphHostDispatchCallsDuringAudit: 0,
      totalTaskGraphToolRuntimeCallsDuringAudit: 0,
      totalTaskGraphShellProcessCallsDuringAudit: 0,
      totalTaskGraphWorkspaceWriteCallsDuringAudit: 0,
      totalTaskGraphExternalWriteCallsDuringAudit: 0,
      totalSchedulerCallsDuringAudit: 0,
      totalSchedulerLeaseAcquisitionsDuringAudit: 0,
      totalSchedulerStateWritesDuringAudit: 0,
      totalSchedulerProviderExecuteCallsDuringAudit: 0,
      totalSchedulerCodexCliCallsDuringAudit: 0,
      totalSchedulerSubAgentRuntimeCallsDuringAudit: 0,
      totalSchedulerHostExecutorCallsDuringAudit: 0,
      totalSchedulerHostDispatchCallsDuringAudit: 0,
      totalSchedulerToolRuntimeCallsDuringAudit: 0,
      totalSchedulerShellProcessCallsDuringAudit: 0,
      totalSchedulerWorkspaceWriteCallsDuringAudit: 0,
      totalSchedulerExternalWriteCallsDuringAudit: 0,
      totalExecutionPlannerCallsDuringAudit: 0,
      totalExecutionPlannerLocalPlanStoreWritesDuringAudit: 0,
      totalExecutionPlannerProviderPlanExecutionCallsDuringAudit: 0,
      totalExecutionPlannerProviderValidateExecutionPlanCallsDuringAudit: 0,
      totalExecutionPlannerProviderExecuteCallsDuringAudit: 0,
      totalExecutionPlannerCodexCliCallsDuringAudit: 0,
      totalExecutionPlannerSubAgentRuntimeCallsDuringAudit: 0,
      totalExecutionPlannerHostExecutorCallsDuringAudit: 0,
      totalExecutionPlannerHostDispatchCallsDuringAudit: 0,
      totalExecutionPlannerShellProcessCallsDuringAudit: 0,
      totalExecutionPlannerWorkspaceWriteCallsDuringAudit: 0,
      totalExecutionPlannerExternalWriteCallsDuringAudit: 0,
      totalProviderRegistryCallsDuringAudit: 0,
      totalProviderRegistrySelectionCallsDuringAudit: 0,
      totalProviderRegistryProviderExecuteCallsDuringAudit: 0,
      totalProviderRegistryCodexCliCallsDuringAudit: 0,
      totalProviderRegistrySubAgentRuntimeCallsDuringAudit: 0,
      totalProviderRegistryHostExecutorCallsDuringAudit: 0,
      totalProviderRegistryToolRuntimeCallsDuringAudit: 0,
      totalProviderRegistryShellProcessCallsDuringAudit: 0,
      totalProviderRegistryWorkspaceWriteCallsDuringAudit: 0,
      totalProviderRegistryExternalWriteCallsDuringAudit: 0,
      totalControlledProviderExecutionTaskbookProviderExecuteCallsDuringAudit: 0,
      totalControlledProviderExecutionTaskbookCodexCliCallsDuringAudit: 0,
      totalControlledProviderExecutionTaskbookWorkspaceWriteCallsDuringAudit: 0,
      totalControlledProviderExecutionTaskbookHostExecutorCallsDuringAudit: 0,
      totalControlledProviderExecutionTaskbookSubAgentRuntimeCallsDuringAudit: 0,
      totalControlledProviderExecutionTaskbookShellProcessCallsDuringAudit: 0,
      totalControlledProviderExecutionTaskbookExternalWriteCallsDuringAudit: 0,
      totalControlledProviderExecutionTaskbookEvidenceWritesDuringAudit: 0,
      totalControlledProviderExecutionTaskbookReviewBoundaryProviderExecuteCallsDuringAudit: 0,
      totalControlledProviderExecutionTaskbookReviewBoundaryCodexCliCallsDuringAudit: 0,
      totalControlledProviderExecutionTaskbookReviewBoundaryWorkspaceWriteCallsDuringAudit: 0,
      totalControlledProviderExecutionTaskbookReviewBoundaryHostExecutorCallsDuringAudit: 0,
      totalControlledProviderExecutionTaskbookReviewBoundarySubAgentRuntimeCallsDuringAudit: 0,
      totalControlledProviderExecutionTaskbookReviewBoundaryShellProcessCallsDuringAudit: 0,
      totalControlledProviderExecutionTaskbookReviewBoundaryExternalWriteCallsDuringAudit: 0,
      totalControlledProviderExecutionTaskbookReviewBoundaryEvidenceWritesDuringAudit: 0,
      totalControlledProviderExecutionDispatchPreflightProviderExecuteCallsDuringAudit: 0,
      totalControlledProviderExecutionDispatchPreflightCodexCliCallsDuringAudit: 0,
      totalControlledProviderExecutionDispatchPreflightWorkspaceWriteCallsDuringAudit: 0,
      totalControlledProviderExecutionDispatchPreflightHostExecutorCallsDuringAudit: 0,
      totalControlledProviderExecutionDispatchPreflightSubAgentRuntimeCallsDuringAudit: 0,
      totalControlledProviderExecutionDispatchPreflightShellProcessCallsDuringAudit: 0,
      totalControlledProviderExecutionDispatchPreflightExternalWriteCallsDuringAudit: 0,
      totalControlledProviderExecutionDispatchPreflightEvidenceWritesDuringAudit: 0,
      totalControlledProviderExecutionDispatcherRunnerInvocationsDuringAudit: 0,
      totalControlledProviderExecutionDispatcherProviderExecuteCallsDuringAudit: 0,
      totalControlledProviderExecutionDispatcherRealCodexCliCallsDuringAudit: 0,
      totalControlledProviderExecutionDispatcherWorkspaceWriteCallsDuringAudit: 0,
      totalControlledProviderExecutionDispatcherHostExecutorCallsDuringAudit: 0,
      totalControlledProviderExecutionDispatcherSubAgentRuntimeCallsDuringAudit: 0,
      totalControlledProviderExecutionDispatcherShellProcessCallsDuringAudit: 0,
      totalControlledProviderExecutionDispatcherExternalWriteCallsDuringAudit: 0,
      totalProviderExecutionRunnerCallsDuringAudit: 0,
      totalProviderExecutionRunnerPlanExecutionCallsDuringAudit: 0,
      totalProviderExecutionRunnerValidateExecutionPlanCallsDuringAudit: 0,
      totalProviderExecutionRunnerExecuteCallsDuringAudit: 0,
      totalProviderCoreRuntimeCallsDuringAudit: 0,
      totalToolRegistryCallsDuringAudit: 0,
      totalToolInvocationPlansDuringAudit: 0,
      totalToolInvocationPlannerToolRuntimeCallsDuringAudit: 0,
      totalToolInvocationPlannerProviderExecuteCallsDuringAudit: 0,
      totalToolInvocationPlannerCodexCliCallsDuringAudit: 0,
      totalToolInvocationPlannerSubAgentRuntimeCallsDuringAudit: 0,
      totalToolInvocationPlannerHostExecutorCallsDuringAudit: 0,
      totalToolInvocationPlannerShellProcessCallsDuringAudit: 0,
      totalToolInvocationPlannerWorkspaceWriteCallsDuringAudit: 0,
      totalToolInvocationPlannerExternalWriteCallsDuringAudit: 0,
      totalDesktopAgentStrategyCallsDuringAudit: 0,
      totalDesktopAgentStrategyProviderExecuteCallsDuringAudit: 0,
      totalDesktopAgentStrategyCodexCliCallsDuringAudit: 0,
      totalDesktopAgentStrategyDesktopPrimitiveCallsDuringAudit: 0,
      totalDesktopAgentStrategySubAgentRuntimeCallsDuringAudit: 0,
      totalDesktopAgentStrategyHostExecutorCallsDuringAudit: 0,
      totalDesktopAgentStrategyHostDispatchCallsDuringAudit: 0,
      totalDesktopAgentStrategyShellProcessCallsDuringAudit: 0,
      totalDesktopAgentStrategyWorkspaceWriteCallsDuringAudit: 0,
      totalDesktopAgentStrategyExternalWriteCallsDuringAudit: 0,
      totalDesktopDecisionRunnerCallsDuringAudit: 0,
      totalDesktopDecisionRunnerHostDispatchCallsDuringAudit: 0,
      totalDesktopDecisionRunnerProviderExecuteCallsDuringAudit: 0,
      totalFinalHostLocatorCallsDuringAudit: 0,
      totalFinalHostLocatorHostExecutorCallsDuringAudit: 0,
      totalFinalHostLocatorHostDispatchCallsDuringAudit: 0,
      totalFinalHostLocatorProviderExecuteCallsDuringAudit: 0,
      totalFinalHostLocatorCodexCliCallsDuringAudit: 0,
      totalFinalHostLocatorSubAgentRuntimeCallsDuringAudit: 0,
      totalFinalHostLocatorShellProcessCallsDuringAudit: 0,
      totalFinalHostLocatorWorkspaceWriteCallsDuringAudit: 0,
      totalFinalHostLocatorExternalWriteCallsDuringAudit: 0,
      totalRemoteAgentRuntimeCallsDuringAudit: 0,
      totalToolRuntimeCallsDuringAudit: 0,
      totalHostDispatcherProviderDispatchCallsDuringAudit: 0,
      totalCodexDesktopBridgeCallsDuringAudit: 0,
      totalCodexDesktopRuntimeToolCallsDuringAudit: 0,
      totalCodexDesktopLiveHostBundleCreationsDuringAudit: 0,
      totalCodexDesktopLiveHostRuntimeToolCallsDuringAudit: 0,
      totalCodexDesktopLiveHostMemoryToolCallsDuringAudit: 0,
      totalCodexDesktopLiveHostBridgeCallsDuringAudit: 0,
      totalCodexDesktopLiveHostClientRunCallsDuringAudit: 0,
      totalCodexDesktopLiveHostSmokeRunsDuringAudit: 0,
      totalCodexMemoryMcpClientMcpHttpCallsDuringAudit: 0,
      totalCodexMemoryMcpClientMemoryToolCallsDuringAudit: 0,
      totalCodexMemoryMcpClientHostExecutorInvocationsDuringAudit: 0,
      totalCodexMemoryMcpClientCodexCliCallsDuringAudit: 0,
      totalCodexMemoryMcpClientProviderExecuteCallsDuringAudit: 0,
      totalCodexMemoryMcpClientSubAgentRuntimeCallsDuringAudit: 0,
      totalCodexMemoryMcpClientShellProcessCallsDuringAudit: 0,
      totalCodexMemoryMcpClientWorkspaceWriteCallsDuringAudit: 0,
      totalCodexMemoryMcpClientExternalWriteCallsDuringAudit: 0,
      totalCodexMemoryHostClientCallsDuringAudit: 0,
      totalCodexMemoryHostClientMemoryOperationCallsDuringAudit: 0,
      totalCodexMemoryHostClientHostExecutorInvocationsDuringAudit: 0,
      totalCodexMemoryHostClientCodexCliCallsDuringAudit: 0,
      totalCodexMemoryHostClientProviderExecuteCallsDuringAudit: 0,
      totalCodexMemoryHostClientSubAgentRuntimeCallsDuringAudit: 0,
      totalCodexMemoryHostClientShellProcessCallsDuringAudit: 0,
      totalCodexMemoryHostClientWorkspaceWriteCallsDuringAudit: 0,
      totalCodexMemoryHostClientExternalWriteCallsDuringAudit: 0,
      totalDesktopHostClientCallsDuringAudit: 0,
      totalDesktopHostClientLiveAdapterCallsDuringAudit: 0,
      totalDesktopHostClientHostExecutorInvocationsDuringAudit: 0,
      totalDesktopHostClientDispatchToHostCallsDuringAudit: 0,
      totalDesktopLiveAdapterCallsDuringAudit: 0,
      totalDesktopLiveAdapterDispatchToHostCallsDuringAudit: 0,
      totalDesktopLiveAdapterBridgeCallsDuringAudit: 0,
      totalHostClientExampleCallsDuringAudit: 0,
      totalHostClientExampleLiveAdapterCallsDuringAudit: 0,
      totalHostClientExampleHostExecutorInvocationsDuringAudit: 0,
      totalTargetHostEmbeddingBundleCreationsDuringAudit: 0,
      totalTargetHostEmbeddingHostClientRunCallsDuringAudit: 0,
      totalTargetHostEmbeddingHostExecutorInvocationsDuringAudit: 0,
      totalTargetHostEmbeddingCodexCliCallsDuringAudit: 0,
      totalTargetHostEmbeddingProviderExecuteCallsDuringAudit: 0,
      totalTargetHostEmbeddingSubAgentRuntimeCallsDuringAudit: 0,
      totalTargetHostEmbeddingShellProcessCallsDuringAudit: 0,
      totalTargetHostEmbeddingWorkspaceWriteCallsDuringAudit: 0,
      totalTargetHostEmbeddingExternalWriteCallsDuringAudit: 0,
      totalHostExecutorInvocationsDuringAudit: 0,
      totalHostExecutorTaskbookDispatchCallsDuringAudit: 0,
      totalHostClientReviewBridgeCallsDuringAudit: 0,
      totalHostClientReviewDispatchCallsDuringAudit: 0,
      totalHostExecutorReceiptInvocationsDuringAudit: 0,
      totalAgentBackedSandboxExecutorInvocationsDuringAudit: 0,
      totalAgentExecutorAdapterTaskbookInvocationsDuringAudit: 0,
      totalAgentExecutorAdapterReviewInvocationsDuringAudit: 0,
      totalAgentExecutorAdapterInvocationsDuringAudit: 0,
      totalAgentTaskControlTaskbookInvocationsDuringAudit: 0,
      totalAgentTaskControlReviewInvocationsDuringAudit: 0,
      totalSubAgentRuntimeCallsDuringAudit: 0,
      totalShellProcessCallsDuringAudit: 0,
      totalWorkspaceWriteCallsDuringAudit: 0,
      totalExternalWriteCallsDuringAudit: 0,
      totalAdapterInvocationsDuringAudit: 0
    },
    reasons: []
  };
  const text = formatExecutionBoundaryCurrentSurfaceAuditResult(review);
  const json = formatExecutionBoundaryCurrentSurfaceAuditResult(review, "json");

  return FORBIDDEN_OUTPUT_MARKERS.every((marker) => !text.includes(marker))
    && FORBIDDEN_OUTPUT_MARKERS.every((marker) => !json.includes(marker));
}

function collectReasons(
  checks: ExecutionBoundaryCurrentSurfaceAuditResult["checks"]
): string[] {
  return Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => `execution_boundary_current_surface_${name}`);
}

async function main(): Promise<void> {
  const format = process.argv.includes("--json") ? "json" : "text";
  const input = await collectExecutionBoundaryCurrentSurfaceAuditInput();
  const review = reviewExecutionBoundaryCurrentSurfaceAudit(input);
  console.log(formatExecutionBoundaryCurrentSurfaceAuditResult(review, format));

  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

const isDirect = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirect) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
