import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  collectExecutionBoundaryCurrentSurfaceAuditInput,
  formatExecutionBoundaryCurrentSurfaceAuditResult,
  reviewExecutionBoundaryCurrentSurfaceAudit,
  type ExecutionBoundaryCurrentSurfaceAuditInput
} from "../scripts/run-execution-boundary-current-surface-audit.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
];

test("execution boundary audit predicates stay below compiler recursion limits", async () => {
  const source = await readFile(
    new URL(
      "../scripts/run-execution-boundary-current-surface-audit.ts",
      import.meta.url
    ),
    "utf8"
  );
  const longestConsecutiveAndRun = source.split("\n").reduce(
    (state, line) => {
      const current = line.startsWith("    && ") ? state.current + 1 : 0;
      return {
        current,
        longest: Math.max(state.longest, current)
      };
    },
    { current: 0, longest: 0 }
  ).longest;

  assert.ok(
    longestConsecutiveAndRun <= 128,
    `execution boundary audit contains ${longestConsecutiveAndRun} consecutive && predicates`
  );
});

test("execution boundary current surface audit passes for current evidence", async () => {
  const review = reviewExecutionBoundaryCurrentSurfaceAudit(
    await collectExecutionBoundaryCurrentSurfaceAuditInput()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.allComponentAuditsPassed, true);
  assert.equal(review.checks.governanceRunnerRegistersAllCurrentAudits, true);
  assert.equal(review.checks.governanceReadmeListsAllCurrentAudits, true);
  assert.equal(review.checks.controlPlaneRecordsAllBoundaries, true);
  assert.equal(review.checks.entryDocsRecordExecutionAuthorityLattice, true);
  assert.equal(review.checks.currentStateRecordsExecutionAuthorityLattice, true);
  assert.equal(review.checks.ciWorkflowRunsCurrentSurfaceGate, true);
  assert.equal(review.checks.strategyRouterBoundaryConstrained, true);
  assert.equal(review.checks.executionProfilesBoundaryConstrained, true);
  assert.equal(review.checks.policyConfigBoundaryConstrained, true);
  assert.equal(review.checks.capabilityTaxonomyBoundaryConstrained, true);
  assert.equal(
    review.checks.capabilityTaxonomyEscalationPolicyBoundaryConstrained,
    true
  );
  assert.equal(review.checks.routingEngineBoundaryConstrained, true);
  assert.equal(review.checks.recoveryControlBoundaryConstrained, true);
  assert.equal(review.checks.runtimeControlBoundaryConstrained, true);
  assert.equal(review.checks.operatorActionExecutorGateBoundaryConstrained, true);
  assert.equal(review.checks.codexCliHostBoundaryConstrained, true);
  assert.equal(review.checks.publicApiBoundaryConstrained, true);
  assert.equal(review.checks.agentOsLocalRuntimeBoundaryConstrained, true);
  assert.equal(review.checks.agentOsMcpServerManifestBoundaryConstrained, true);
  assert.equal(review.checks.protocolMcpProviderSkeletonBoundaryConstrained, true);
  assert.equal(
    review.checks.protocolA2aRemoteProviderSkeletonBoundaryConstrained,
    true
  );
  assert.equal(review.checks.agentOsSdkBoundaryConstrained, true);
  assert.equal(review.checks.agentOsCliBoundaryConstrained, true);
  assert.equal(review.checks.agentOsAppServerBoundaryConstrained, true);
  assert.equal(review.checks.agentOsPublicSurfacesBoundaryConstrained, true);
  assert.equal(review.checks.codexProviderBoundaryConstrained, true);
  assert.equal(review.checks.preflightBoundaryConstrained, true);
  assert.equal(review.checks.approvalPermitBoundaryConstrained, true);
  assert.equal(review.checks.approvalGateBoundaryConstrained, true);
  assert.equal(
    review.checks.approvalConsumptionDispatchMatrixBoundaryConstrained,
    true
  );
  assert.equal(review.checks.stateSyncBoundaryConstrained, true);
  assert.equal(review.checks.workspaceWriteReleaseGateBoundaryConstrained, true);
  assert.equal(review.checks.admissionControlBoundaryConstrained, true);
  assert.equal(review.checks.delegationPolicyBoundaryConstrained, true);
  assert.equal(review.checks.executionEligibilityBoundaryConstrained, true);
  assert.equal(review.checks.executionObservationBoundaryConstrained, true);
  assert.equal(review.checks.governanceFailureReducerBoundaryConstrained, true);
  assert.equal(review.checks.taskGraphBoundaryConstrained, true);
  assert.equal(review.checks.schedulerBoundaryConstrained, true);
  assert.equal(review.checks.executionPlannerBoundaryConstrained, true);
  assert.equal(review.checks.providerRegistryBoundaryConstrained, true);
  assert.equal(review.checks.providerExecutionRunnerBoundaryConstrained, true);
  assert.equal(review.checks.providerCorePrimitivesBoundaryConstrained, true);
  assert.equal(review.checks.toolInvocationPlannerBoundaryConstrained, true);
  assert.equal(review.checks.desktopAgentStrategyBoundaryConstrained, true);
  assert.equal(review.checks.desktopDecisionRunnerBoundaryConstrained, true);
  assert.equal(review.checks.finalHostLocatorBoundaryConstrained, true);
  assert.equal(review.checks.hostDispatcherProviderBoundaryConstrained, true);
  assert.equal(review.checks.codexDesktopBridgeBoundaryConstrained, true);
  assert.equal(review.checks.codexDesktopLiveHostBoundaryConstrained, true);
  assert.equal(review.checks.codexMemoryMcpClientBoundaryConstrained, true);
  assert.equal(review.checks.codexMemoryHostClientBoundaryConstrained, true);
  assert.equal(review.checks.desktopHostClientBoundaryConstrained, true);
  assert.equal(review.checks.desktopLiveAdapterDispatchBoundaryConstrained, true);
  assert.equal(review.checks.hostClientExampleBoundaryConstrained, true);
  assert.equal(review.checks.targetHostEmbeddingBoundaryConstrained, true);
  assert.equal(review.checks.hostExecutorBoundaryConstrained, true);
  assert.equal(review.checks.hostExecutorTaskbookBoundaryConstrained, true);
  assert.equal(review.checks.hostClientExecutorReviewBoundaryConstrained, true);
  assert.equal(review.checks.hostExecutorReceiptBoundaryConstrained, true);
  assert.equal(review.checks.agentBackedRecoveryExecutorBoundaryConstrained, true);
  assert.equal(review.checks.agentExecutorAdapterTaskbookBoundaryConstrained, true);
  assert.equal(review.checks.agentExecutorAdapterReviewBoundaryConstrained, true);
  assert.equal(review.checks.agentExecutorAdapterSandboxBoundaryConstrained, true);
  assert.equal(review.checks.agentTaskControlTaskbookBoundaryConstrained, true);
  assert.equal(review.checks.agentTaskControlReviewBoundaryConstrained, true);
  assert.equal(review.checks.subAgentRuntimeBoundaryConstrained, true);
  assert.equal(review.checks.agentTaskControlBoundaryConstrained, true);
  assert.equal(review.checks.executionAuthorityLatticeConstrained, true);
  assert.equal(review.checks.auditItselfIsNonExecuting, true);
  assert.equal(
    review.summary.executionAuthorityLatticeMode,
    "narrow_readonly_provider_dispatch_without_boundary_inheritance"
  );
  assert.equal(
    review.summary.codexCliHostDoesNotAuthorizeHostExecutorOrSubAgentRuntime,
    true
  );
  assert.equal(
    review.summary.subAgentRuntimeDoesNotInvokeCodexCliOrProviderExecution,
    true
  );
  assert.equal(
    review.summary.hostExecutorDoesNotExecuteProviderOrSubAgentRuntime,
    true
  );
  assert.equal(review.summary.strategyRouterMode, "advisory_budget_signal_only");
  assert.equal(review.summary.strategyRouterExecuteActionFamilyIsAuthorization, false);
  assert.equal(review.summary.strategyRouterWriteExecutionPredicateIsAuthorization, false);
  assert.equal(review.summary.strategyRouterExecutorBudgetIsRuntimeInvocation, false);
  assert.equal(review.summary.executionProfilesMode, "profile_templates_only");
  assert.equal(review.summary.executionProfilesProfileStageIsRuntimeStep, false);
  assert.equal(
    review.summary.executionProfilesDefaultRoleIsSubAgentRuntimeAuthorization,
    false
  );
  assert.equal(
    review.summary.executionProfilesDefaultToolAccessIsToolRuntimeAuthorization,
    false
  );
  assert.equal(
    review.summary.executionProfilesEngineeringWriteToolAccessIsWorkspaceWriteExecution,
    false
  );
  assert.equal(
    review.summary.executionProfilesProtectedRemoteToolAccessIsExternalWriteAuthorization,
    false
  );
  assert.equal(
    review.summary.executionProfilesAllowParallelIsSubAgentRuntimeAuthorization,
    false
  );
  assert.equal(
    review.summary.executionProfilesMaxParallelAgentsIsSubAgentSpawnAuthorization,
    false
  );
  assert.equal(
    review.summary.executionProfilesReleaseGovernanceProfileIsProtectedRemoteAuthorization,
    false
  );
  assert.equal(
    review.summary.executionProfilesProfileSelectionIsProviderExecutionAuthorization,
    false
  );
  assert.equal(review.summary.totalExecutionProfileLookupsDuringAudit, 0);
  assert.equal(review.summary.totalExecutionProfilesProviderExecuteCallsDuringAudit, 0);
  assert.equal(review.summary.totalExecutionProfilesSubAgentRuntimeCallsDuringAudit, 0);
  assert.equal(review.summary.totalExecutionProfilesHostExecutorCallsDuringAudit, 0);
  assert.equal(
    review.summary.policyConfigMode,
    "policy_schema_and_signal_resolution_only"
  );
  assert.equal(
    review.summary.policyConfigHostRouteIsHostDispatchAuthorization,
    false
  );
  assert.equal(
    review.summary.policyConfigCodexCliHostRouteIsCodexCliInvocation,
    false
  );
  assert.equal(
    review.summary.policyConfigDesktopHostRouteIsDesktopRuntimeInvocation,
    false
  );
  assert.equal(
    review.summary.policyConfigToolPolicyIsToolRuntimeAuthorization,
    false
  );
  assert.equal(
    review.summary.policyConfigProtectedRemoteToolPolicyIsExternalWriteAuthorization,
    false
  );
  assert.equal(review.summary.policyConfigApprovalRuleIsApprovalGrant, false);
  assert.equal(
    review.summary.policyConfigMemoryHealthBlockIsRuntimeBlockExecution,
    false
  );
  assert.equal(
    review.summary.policyConfigMemoryGuidanceIsSubAgentRuntimeAuthorization,
    false
  );
  assert.equal(
    review.summary.policyConfigTelemetryThresholdIsRuntimeAuthorization,
    false
  );
  assert.equal(
    review.summary.policyConfigTelemetryDeliveryWindowIsHostExecutorAuthorization,
    false
  );
  assert.equal(review.summary.totalPolicyConfigLoadCallsDuringAudit, 0);
  assert.equal(review.summary.totalPolicyConfigProviderExecuteCallsDuringAudit, 0);
  assert.equal(review.summary.totalPolicyConfigCodexCliCallsDuringAudit, 0);
  assert.equal(review.summary.totalPolicyConfigDesktopPrimitiveCallsDuringAudit, 0);
  assert.equal(review.summary.totalPolicyConfigSubAgentRuntimeCallsDuringAudit, 0);
  assert.equal(review.summary.totalPolicyConfigHostExecutorCallsDuringAudit, 0);
  assert.equal(review.summary.totalPolicyConfigHostDispatchCallsDuringAudit, 0);
  assert.equal(review.summary.totalPolicyConfigToolRuntimeCallsDuringAudit, 0);
  assert.equal(review.summary.totalPolicyConfigShellProcessCallsDuringAudit, 0);
  assert.equal(review.summary.totalPolicyConfigWorkspaceWriteCallsDuringAudit, 0);
  assert.equal(review.summary.totalPolicyConfigExternalWriteCallsDuringAudit, 0);
  assert.equal(
    review.summary.capabilityTaxonomyMode,
    "capability_classification_and_escalation_policy_only"
  );
  assert.equal(
    review.summary.capabilityTaxonomyBoundedWorkspaceWriteCanaryIsWorkspaceWriteAuthorization,
    false
  );
  assert.equal(
    review.summary.capabilityTaxonomyGeneralProviderExecutionClassIsProviderExecuteAuthorization,
    false
  );
  assert.equal(
    review.summary.capabilityTaxonomyEscalationPolicyIsRuntimeAuthorization,
    false
  );
  assert.equal(
    review.summary.capabilityTaxonomyCanaryEvidenceBaselineIsExecutionAuthorization,
    false
  );
  assert.equal(
    review.summary.capabilityTaxonomyEscalationPolicyMode,
    "capability_escalation_policy_only"
  );
  assert.equal(
    review.summary.capabilityTaxonomyEscalationPolicyIsProviderExecuteAuthorization,
    false
  );
  assert.equal(
    review.summary.capabilityTaxonomyEscalationPolicyIsHostExecutorAuthorization,
    false
  );
  assert.equal(
    review.summary.capabilityTaxonomyEscalationPolicyIsSubAgentRuntimeAuthorization,
    false
  );
  assert.equal(
    review.summary.capabilityTaxonomyEscalationPolicyStatusIsExecutionAuthorization,
    false
  );
  assert.equal(
    review.summary.totalCapabilityTaxonomyProviderExecuteCallsDuringAudit,
    0
  );
  assert.equal(review.summary.totalCapabilityTaxonomyCodexCliCallsDuringAudit, 0);
  assert.equal(
    review.summary.totalCapabilityTaxonomyWorkspaceWriteCallsDuringAudit,
    0
  );
  assert.equal(
    review.summary.totalCapabilityTaxonomyGeneralProviderExecutionCallsDuringAudit,
    0
  );
  assert.equal(review.summary.totalCapabilityTaxonomyExternalWriteCallsDuringAudit, 0);
  assert.equal(
    review.summary.totalCapabilityTaxonomyEscalationPolicyProviderExecuteCallsDuringAudit,
    0
  );
  assert.equal(
    review.summary.totalCapabilityTaxonomyEscalationPolicyHostExecutorCallsDuringAudit,
    0
  );
  assert.equal(
    review.summary.totalCapabilityTaxonomyEscalationPolicySubAgentRuntimeCallsDuringAudit,
    0
  );
  assert.equal(
    review.summary.routingEngineMode,
    "routing_decision_and_provider_grant_only"
  );
  assert.equal(review.summary.routingEngineDecisionIsExecutionAuthorization, false);
  assert.equal(
    review.summary.routingEngineHostRouteIsHostDispatchAuthorization,
    false
  );
  assert.equal(
    review.summary.routingEngineProviderGrantIsProviderExecuteAuthorization,
    false
  );
  assert.equal(
    review.summary.routingEngineSandboxModeIsWorkspaceWriteExecution,
    false
  );
  assert.equal(review.summary.routingEngineApprovalRequiredIsApprovalGrant, false);
  assert.equal(
    review.summary.routingEngineParallelismAllowedIsSubAgentRuntimeAuthorization,
    false
  );
  assert.equal(
    review.summary.recoveryControlMode,
    "schemas_packets_reviews_and_explicit_injected_witnesses_only"
  );
  assert.equal(review.summary.recoveryControlSchemaStatusIsExecutionAuthorization, false);
  assert.equal(
    review.summary.recoveryControlExecutionPlanIsRecoveryExecutionAuthorization,
    false
  );
  assert.equal(review.summary.recoveryControlExecutionGateIsRuntimeAuthorization, false);
  assert.equal(
    review.summary.recoveryControlHostExecutorReviewIsHostDispatchAuthorization,
    false
  );
  assert.equal(
    review.summary.recoveryControlDispatchAuthorizationReviewIsAdapterInvocationAuthorization,
    false
  );
  assert.equal(
    review.summary.recoveryControlTaskControlReviewIsSubAgentRuntimeAuthorization,
    false
  );
  assert.equal(
    review.summary.recoveryControlSandboxWitnessIsProductionRecoveryExecution,
    false
  );
  assert.equal(
    review.summary.runtimeControlMode,
    "runtime_signal_and_escalation_outcome_only"
  );
  assert.equal(
    review.summary.runtimeControlRuntimeSignalIsExecutionAuthorization,
    false
  );
  assert.equal(
    review.summary.runtimeControlEscalationOutcomeIsProviderExecutionAuthorization,
    false
  );
  assert.equal(
    review.summary.runtimeControlUpgradeModelIsModelRuntimeInvocation,
    false
  );
  assert.equal(
    review.summary.runtimeControlOpenCircuitIsHostDispatchAuthorization,
    false
  );
  assert.equal(
    review.summary.runtimeControlFailureCountIsRecoveryExecutionAuthorization,
    false
  );
  assert.equal(
    review.summary.runtimeControlContextPressureIsSubAgentRuntimeAuthorization,
    false
  );
  assert.equal(
    review.summary.runtimeControlHighRiskSignalIsCodexCliAuthorization,
    false
  );
  assert.equal(review.summary.operatorActionExecutorGateMode, "plan_only");
  assert.equal(review.summary.operatorActionExecutorGateExecutionAllowed, false);
  assert.equal(
    review.summary.codexCliHostMode,
    "explicit_codex_cli_host_execution_surface"
  );
  assert.equal(
    review.summary.codexCliHostWorkspaceWriteRequiresExplicitAllowance,
    true
  );
  assert.equal(review.summary.codexCliHostWorkspaceWriteRequiresConfirmation, true);
  assert.equal(
    review.summary.codexCliHostDefaultRealCodexCliAllowedByBoundaryAudit,
    false
  );
  assert.equal(
    review.summary.codexCliHostProviderExecutionAllowedByHostBoundary,
    false
  );
  assert.equal(review.summary.publicApiMode, "named_governance_subpaths_only");
  assert.equal(
    review.summary.publicApiInternalGovernanceTopLevelExportsAllowed,
    false
  );
  assert.equal(review.summary.publicApiProviderExecuteExportAllowed, false);
  assert.equal(review.summary.publicApiCodexCliHostRunExportAllowed, false);
  assert.equal(
    review.summary.agentOsLocalRuntimeMode,
    "local_state_and_provider_plan_runtime"
  );
  assert.equal(review.summary.agentOsLocalRuntimeProviderPlanCanBeStored, true);
  assert.equal(
    review.summary.agentOsLocalRuntimeRealProviderExecutionAllowed,
    false
  );
  assert.equal(review.summary.agentOsLocalRuntimeCodexCliInvocationAllowed, false);
  assert.equal(
    review.summary.agentOsLocalRuntimeHostExecutorInvocationAllowed,
    false
  );
  assert.equal(
    review.summary.agentOsLocalRuntimeWorkspaceWriteExecutionAllowed,
    false
  );
  assert.equal(
    review.summary.agentOsMcpServerManifestMode,
    "manifest_only_no_runtime"
  );
  assert.equal(
    review.summary.agentOsMcpServerManifestRuntimeImplementedMeansLiveServer,
    false
  );
  assert.equal(
    review.summary.agentOsMcpServerManifestToolManifestIsToolRuntimeAuthorization,
    false
  );
  assert.equal(
    review.summary.agentOsMcpServerManifestRequiredCapabilityIsCapabilityGrant,
    false
  );
  assert.equal(
    review.summary.agentOsMcpServerManifestLocalWriteSideEffectIsWorkspaceWriteExecution,
    false
  );
  assert.equal(
    review.summary.totalAgentOsMcpServerManifestToolRuntimeCallsDuringAudit,
    0
  );
  assert.equal(
    review.summary.totalAgentOsMcpServerManifestSubAgentRuntimeCallsDuringAudit,
    0
  );
  assert.equal(
    review.summary.totalAgentOsMcpServerManifestHostExecutorCallsDuringAudit,
    0
  );
  assert.equal(
    review.summary.protocolMcpProviderSkeletonMode,
    "protocol_mapping_and_disabled_provider_skeleton_only"
  );
  assert.equal(review.summary.protocolMcpServerRefIsLiveServerConnection, false);
  assert.equal(review.summary.protocolMcpCommandRefIsShellCommand, false);
  assert.equal(review.summary.protocolMcpEndpointRefIsNetworkCall, false);
  assert.equal(
    review.summary.protocolMcpToolManifestIsToolRuntimeAuthorization,
    false
  );
  assert.equal(
    review.summary.protocolMcpInvocationPlanIsToolExecutionAuthorization,
    false
  );
  assert.equal(review.summary.protocolMcpInvokeMethodIsEnabled, false);
  assert.equal(
    review.summary.protocolMcpAllowedToolIsMcpInvocationAuthorization,
    false
  );
  assert.equal(review.summary.totalProtocolMcpToolRuntimeCallsDuringAudit, 0);
  assert.equal(review.summary.totalProtocolMcpProviderExecuteCallsDuringAudit, 0);
  assert.equal(review.summary.totalProtocolMcpNetworkCallsDuringAudit, 0);
  assert.equal(
    review.summary.protocolA2aRemoteProviderSkeletonMode,
    "agent_card_task_artifact_mapping_and_disabled_remote_provider_skeleton_only"
  );
  assert.equal(review.summary.protocolA2aEndpointRefIsNetworkCall, false);
  assert.equal(
    review.summary.protocolA2aAgentCardIsRemoteRuntimeAuthorization,
    false
  );
  assert.equal(
    review.summary.protocolA2aTaskSkeletonIsRemoteExecutionAuthorization,
    false
  );
  assert.equal(review.summary.protocolA2aRemoteProviderIsEnabled, false);
  assert.equal(review.summary.protocolA2aFakeTransportIsLiveNetworkService, false);
  assert.equal(review.summary.protocolA2aAnonymousRemoteInvocationAllowed, false);
  assert.equal(
    review.summary.protocolA2aRemoteAgentProviderManifestIsSubAgentRuntimeAuthorization,
    false
  );
  assert.equal(review.summary.totalProtocolA2aRemoteAgentRuntimeCallsDuringAudit, 0);
  assert.equal(review.summary.totalProtocolA2aRemoteTaskCreationsDuringAudit, 0);
  assert.equal(review.summary.totalProtocolA2aNetworkCallsDuringAudit, 0);
  assert.equal(
    review.summary.agentOsSdkMode,
    "sdk_method_to_local_mcp_runtime_only"
  );
  assert.equal(review.summary.agentOsSdkCallIsProviderExecutionAuthorization, false);
  assert.equal(review.summary.agentOsSdkGrantInputIsCapabilityGrant, false);
  assert.equal(review.summary.agentOsSdkApproveToolInputIsToolRuntimeAuthorization, false);
  assert.equal(review.summary.agentOsSdkAllowLocalMutationIsWorkspaceWriteExecution, false);
  assert.equal(review.summary.agentOsSdkPreferredProviderIsCodexCliInvocation, false);
  assert.equal(review.summary.agentOsSdkLocalRuntimeCallIsProviderExecutionAuthorization, false);
  assert.equal(
    review.summary.agentOsSdkApprovalPermitConsumptionIsProviderExecutionAuthorization,
    false
  );
  assert.equal(review.summary.agentOsSdkRealProviderExecutionInvoked, false);
  assert.equal(review.summary.totalAgentOsSdkCodexCliCallsDuringAudit, 0);
  assert.equal(review.summary.totalAgentOsSdkProviderExecuteCallsDuringAudit, 0);
  assert.equal(review.summary.totalAgentOsSdkHostDispatchCallsDuringAudit, 0);
  assert.equal(
    review.summary.agentOsCliMode,
    "argv_parsing_to_local_mcp_runtime_only"
  );
  assert.equal(review.summary.agentOsCliGrantFlagIsCapabilityGrant, false);
  assert.equal(review.summary.agentOsCliApproveToolFlagIsToolRuntimeAuthorization, false);
  assert.equal(review.summary.agentOsCliAllowLocalMutationIsWorkspaceWriteExecution, false);
  assert.equal(review.summary.agentOsCliPreferredProviderIsCodexCliInvocation, false);
  assert.equal(
    review.summary.agentOsCliParsedCommandIsProviderExecutionAuthorization,
    false
  );
  assert.equal(review.summary.agentOsCliSanitizedArgvContainsRawSecrets, false);
  assert.equal(review.summary.totalAgentOsCliCodexCliCallsDuringAudit, 0);
  assert.equal(review.summary.totalAgentOsCliProviderExecuteCallsDuringAudit, 0);
  assert.equal(review.summary.totalAgentOsCliHostDispatchCallsDuringAudit, 0);
  assert.equal(
    review.summary.agentOsAppServerMode,
    "http_like_request_routing_to_local_mcp_runtime_only"
  );
  assert.equal(review.summary.agentOsAppServerRequestEnvelopeIsCapabilityGrant, false);
  assert.equal(review.summary.agentOsAppServerRouteIsLiveNetworkServer, false);
  assert.equal(review.summary.agentOsAppServerClientGateFieldsAreTrusted, false);
  assert.equal(
    review.summary.agentOsAppServerApprovalPermitConsumptionIsProviderExecutionAuthorization,
    false
  );
  assert.equal(review.summary.agentOsAppServerLiveHttpServerStarted, false);
  assert.equal(review.summary.agentOsAppServerNetworkAccessed, false);
  assert.equal(review.summary.agentOsAppServerRealProviderExecutionInvoked, false);
  assert.equal(review.summary.totalAgentOsAppServerLiveHttpServerStartsDuringAudit, 0);
  assert.equal(review.summary.totalAgentOsAppServerProviderExecuteCallsDuringAudit, 0);
  assert.equal(review.summary.totalAgentOsAppServerNetworkCallsDuringAudit, 0);
  assert.equal(
    review.summary.agentOsPublicSurfacesMode,
    "public_surface_to_local_mcp_runtime_only"
  );
  assert.equal(
    review.summary.agentOsPublicSurfacesSdkCallIsProviderExecutionAuthorization,
    false
  );
  assert.equal(
    review.summary.agentOsPublicSurfacesCliGrantFlagIsProviderExecutionAuthorization,
    false
  );
  assert.equal(
    review.summary.agentOsPublicSurfacesCliApproveToolFlagIsToolRuntimeAuthorization,
    false
  );
  assert.equal(
    review.summary.agentOsPublicSurfacesPreferredProviderIsCodexCliInvocation,
    false
  );
  assert.equal(review.summary.totalAgentOsPublicSurfaceProviderExecuteCallsDuringAudit, 0);
  assert.equal(review.summary.totalAgentOsPublicSurfaceSubAgentRuntimeCallsDuringAudit, 0);
  assert.equal(review.summary.totalAgentOsPublicSurfaceHostExecutorCallsDuringAudit, 0);
  assert.equal(review.summary.codexProviderMode, "controlled-read-only");
  assert.equal(review.summary.preflightMode, "pre_execution_signal_evaluation_only");
  assert.equal(review.summary.preflightOkIsExecutionAuthorization, false);
  assert.equal(review.summary.preflightMissingToolCheckIsToolRuntimeAuthorization, false);
  assert.equal(review.summary.preflightAuthAvailableIsProviderExecutionAuthorization, false);
  assert.equal(review.summary.preflightWorkspaceCleanIsWorkspaceWriteAuthorization, false);
  assert.equal(review.summary.preflightProtectedBranchCheckIsWorkspaceWriteExecution, false);
  assert.equal(review.summary.preflightMemoryOverviewIsRuntimeAuthorization, false);
  assert.equal(
    review.summary.preflightMemoryHealthStatusIsSubAgentRuntimeAuthorization,
    false
  );
  assert.equal(review.summary.preflightMemoryWarningIsHostExecutorAuthorization, false);
  assert.equal(
    review.summary.preflightMemoryBlockingIssueIsProviderExecutionAuthorization,
    false
  );
  assert.equal(review.summary.totalPreflightCallsDuringAudit, 0);
  assert.equal(review.summary.totalPreflightProviderExecuteCallsDuringAudit, 0);
  assert.equal(review.summary.totalPreflightCodexCliCallsDuringAudit, 0);
  assert.equal(review.summary.totalPreflightHostDispatchCallsDuringAudit, 0);
  assert.equal(
    review.summary.approvalPermitMode,
    "permit_creation_validation_revocation_and_store_only"
  );
  assert.equal(
    review.summary.approvalPermitValidPermitIsProviderExecutionAuthorization,
    false
  );
  assert.equal(review.summary.approvalPermitValidPermitIsCodexCliAuthorization, false);
  assert.equal(
    review.summary.approvalPermitValidPermitIsSubAgentRuntimeAuthorization,
    false
  );
  assert.equal(review.summary.approvalPermitValidPermitIsHostExecutorAuthorization, false);
  assert.equal(review.summary.approvalPermitShellCapabilityScopeIsShellExecution, false);
  assert.equal(
    review.summary.approvalPermitExternalCapabilityScopeIsExternalWriteExecution,
    false
  );
  assert.equal(
    review.summary.approvalPermitStorePersistenceIsWorkspaceWriteExecution,
    false
  );
  assert.equal(review.summary.totalApprovalPermitProviderExecuteCallsDuringAudit, 0);
  assert.equal(
    review.summary.approvalGateMode,
    "approval_requirement_evaluation_only"
  );
  assert.equal(
    review.summary.approvalGateNotRequiredStatusIsExecutionAuthorization,
    false
  );
  assert.equal(
    review.summary.approvalGateResolutionIsProviderExecutionAuthorization,
    false
  );
  assert.equal(review.summary.approvalGateResolutionIsCodexCliAuthorization, false);
  assert.equal(
    review.summary.approvalGateResolutionIsSubAgentRuntimeAuthorization,
    false
  );
  assert.equal(review.summary.approvalGateResolutionIsHostExecutorAuthorization, false);
  assert.equal(review.summary.approvalGatePendingStatusIsRuntimeInvocation, false);
  assert.equal(
    review.summary.approvalGateProtectedBranchSignalIsWorkspaceWriteExecution,
    false
  );
  assert.equal(
    review.summary.approvalGateDirtyWorkspaceSignalIsWorkspaceWriteExecution,
    false
  );
  assert.equal(review.summary.totalApprovalGateProviderExecuteCallsDuringAudit, 0);
  assert.equal(
    review.summary.approvalConsumptionDispatchMatrixBoundaryMode,
    "git_state_and_artifact_matrix_gate_only"
  );
  assert.equal(
    review.summary.approvalConsumptionDispatchMatrixAuditIsProviderExecuteAuthorization,
    false
  );
  assert.equal(
    review.summary.approvalConsumptionDispatchMatrixAuditIsWorkspaceWriteAuthorization,
    false
  );
  assert.equal(
    review.summary.approvalConsumptionDispatchMatrixAuditIsHostExecutorAuthorization,
    false
  );
  assert.equal(
    review.summary.approvalConsumptionDispatchMatrixAuditIsSubAgentRuntimeAuthorization,
    false
  );
  assert.equal(
    review.summary.approvalConsumptionDispatchMatrixAuditGitStateIsExecutionAuthorization,
    false
  );
  assert.equal(
    review.summary.totalApprovalConsumptionDispatchMatrixBoundaryProviderExecuteCallsDuringAudit,
    0
  );
  assert.equal(
    review.summary.totalApprovalConsumptionDispatchMatrixBoundaryHostExecutorCallsDuringAudit,
    0
  );
  assert.equal(
    review.summary.totalApprovalConsumptionDispatchMatrixBoundarySubAgentRuntimeCallsDuringAudit,
    0
  );
  assert.equal(
    review.summary.approvalConsumptionDispatchMode,
    "approval_consumption_dispatch_matrix_only"
  );
  assert.equal(
    review.summary.approvalConsumptionDispatchMatrixIsProviderExecuteAuthorization,
    false
  );
  assert.equal(
    review.summary.totalApprovalConsumptionDispatchProviderExecuteCallsDuringAudit,
    0
  );
  assert.equal(
    review.summary.stateSyncBoundaryMode,
    "state_consistency_observation_gate_only"
  );
  assert.equal(review.summary.stateSyncIsProviderExecuteAuthorization, false);
  assert.equal(review.summary.stateSyncIsRealCodexCliAuthorization, false);
  assert.equal(review.summary.stateSyncIsWorkspaceWriteAuthorization, false);
  assert.equal(review.summary.stateSyncIsHostExecutorAuthorization, false);
  assert.equal(review.summary.stateSyncIsSubAgentRuntimeAuthorization, false);
  assert.equal(review.summary.stateSyncIsEvidenceRefreshAuthorization, false);
  assert.equal(review.summary.stateSyncIsPushAuthorization, false);
  assert.equal(review.summary.stateSyncIsReleaseAuthorization, false);
  assert.equal(review.summary.stateSyncGitStateIsExecutionAuthorization, false);
  assert.equal(review.summary.stateSyncPolicyV2IsExecutionAuthorization, false);
  assert.equal(
    review.summary.totalStateSyncBoundaryProviderExecuteCallsDuringAudit,
    0
  );
  assert.equal(review.summary.totalStateSyncBoundaryStateWritesDuringAudit, 0);
  assert.equal(review.summary.totalStateSyncBoundaryRemoteWritesDuringAudit, 0);
  assert.ok(
    review.summary.currentAudits.includes("workspace-write-release-gate")
  );
  assert.equal(
    review.summary.workspaceWriteReleaseGateMode,
    "promotion_review_gate_only"
  );
  assert.equal(
    review.summary.workspaceWriteReleaseGateIsWorkspaceWriteAuthorization,
    false
  );
  assert.equal(
    review.summary.workspaceWriteReleaseGateIsProviderExecutionAuthorization,
    false
  );
  assert.equal(
    review.summary.workspaceWriteReleaseGateIsReleaseAuthorization,
    false
  );
  assert.equal(
    review.summary.totalWorkspaceWriteReleaseGateProviderExecuteCallsDuringAudit,
    0
  );
  assert.equal(
    review.summary.totalWorkspaceWriteReleaseGateWorkspaceWriteCallsDuringAudit,
    0
  );
  assert.equal(
    review.summary.totalWorkspaceWriteReleaseGateEvidenceWritesDuringAudit,
    0
  );
  assert.ok(
    review.summary.currentAudits.includes(
      "controlled-provider-execution-dispatch-preflight-boundary"
    )
  );
  assert.ok(
    review.summary.currentAudits.includes(
      "controlled-provider-execution-dispatcher-boundary"
    )
  );
  assert.equal(
    review.summary.controlledProviderExecutionDispatchPreflightMode,
    "controlled_readonly_and_workspace_write_dispatch_preflight_matrix_only"
  );
  assert.equal(
    review.summary.controlledProviderExecutionDispatcherMode,
    "controlled_readonly_and_workspace_write_pre_runner_dispatcher"
  );
  assert.equal(
    review.summary.controlledProviderExecutionDispatchPreflightIsProviderExecuteAuthorization,
    false
  );
  assert.equal(
    review.summary.controlledProviderExecutionDispatcherCallsProviderExecuteDirectly,
    false
  );
  assert.equal(
    review.summary.controlledProviderExecutionDispatcherControlledWorkspaceWriteDispatchAllowed,
    true
  );
  assert.equal(
    review.summary.controlledProviderExecutionDispatcherAuthorizesGeneralWorkspaceWrite,
    false
  );
  assert.equal(
    review.summary.controlledProviderExecutionDispatcherWorkspaceWriteProviderExecuteAllowed,
    false
  );
  assert.equal(
    review.summary.controlledProviderExecutionDispatcherCallsRunnerBoundary,
    true
  );
  assert.equal(
    review.summary.controlledProviderExecutionDispatchPreflightRunnerRemainsFinalProviderExecuteGate,
    true
  );
  assert.equal(
    review.summary.totalControlledProviderExecutionDispatchPreflightProviderExecuteCallsDuringAudit,
    0
  );
  assert.equal(
    review.summary.totalControlledProviderExecutionDispatcherProviderExecuteCallsDuringAudit,
    0
  );
  assert.equal(
    review.summary.admissionControlMode,
    "admission_status_and_requirement_derivation_only"
  );
  assert.equal(
    review.summary.admissionControlAcceptedStatusIsExecutionAuthorization,
    false
  );
  assert.equal(
    review.summary.admissionControlNeedsApprovalStatusIsApprovalGrant,
    false
  );
  assert.equal(
    review.summary.admissionControlCapabilityMatchIsRuntimeInvocation,
    false
  );
  assert.equal(
    review.summary.admissionControlRequiredApprovalIsProviderExecutionAuthorization,
    false
  );
  assert.equal(
    review.summary.admissionControlRequiredApprovalIsCodexCliAuthorization,
    false
  );
  assert.equal(
    review.summary.admissionControlExternalCapabilityIsExternalWriteExecution,
    false
  );
  assert.equal(
    review.summary.admissionControlFileWriteCapabilityIsWorkspaceWriteExecution,
    false
  );
  assert.equal(review.summary.totalAdmissionControlProviderExecuteCallsDuringAudit, 0);
  assert.equal(
    review.summary.delegationPolicyMode,
    "delegation_level_approval_requirement_and_recovery_filter_only"
  );
  assert.equal(
    review.summary.delegationPolicyFullDelegationIsExecutionAuthorization,
    false
  );
  assert.equal(
    review.summary.delegationPolicyRequiresApprovalFalseIsExecutionAuthorization,
    false
  );
  assert.equal(
    review.summary.delegationPolicyApprovedProposalIsRuntimeAuthorization,
    false
  );
  assert.equal(
    review.summary.delegationPolicyFilteredRecoveryActionIsHostExecutorAuthorization,
    false
  );
  assert.equal(
    review.summary.delegationPolicyRecoveryActionListIsRecoveryExecution,
    false
  );
  assert.equal(
    review.summary.delegationPolicyFileStorePersistenceIsWorkspaceWriteExecution,
    false
  );
  assert.equal(review.summary.totalDelegationPolicyProviderExecuteCallsDuringAudit, 0);
  assert.equal(
    review.summary.executionEligibilityMode,
    "admission_capability_permit_decision_only"
  );
  assert.equal(
    review.summary.executionEligibilityEligibleStatusIsExecutionAuthorization,
    false
  );
  assert.equal(
    review.summary.executionEligibilityValidApprovalPermitIsProviderExecutionAuthorization,
    false
  );
  assert.equal(review.summary.executionEligibilityCapabilityGrantIsRuntimeInvocation, false);
  assert.equal(review.summary.executionEligibilityPermitStoreReadIsRuntimeInvocation, false);
  assert.equal(review.summary.executionEligibilityProviderPlanCreationAllowed, false);
  assert.equal(review.summary.executionEligibilityProviderExecuteAllowed, false);
  assert.equal(review.summary.executionEligibilityCodexCliInvocationAllowed, false);
  assert.equal(
    review.summary.executionEligibilitySubAgentRuntimeInvocationAllowed,
    false
  );
  assert.equal(review.summary.executionEligibilityHostExecutorInvocationAllowed, false);
  assert.equal(review.summary.executionEligibilityHostDispatchAllowed, false);
  assert.equal(
    review.summary.executionObservationMode,
    "sanitized_task_scoped_observation_record_only"
  );
  assert.equal(
    review.summary.executionObservationStatusIsExecutionAuthorization,
    false
  );
  assert.equal(
    review.summary.executionObservationSucceededIsCompletionAuthorization,
    false
  );
  assert.equal(
    review.summary.executionObservationFailedIsRecoveryAuthorization,
    false
  );
  assert.equal(
    review.summary.executionObservationEvidenceRefIsRuntimeInvocation,
    false
  );
  assert.equal(
    review.summary.executionObservationRefResolutionIsReplayAuthorization,
    false
  );
  assert.equal(
    review.summary.executionObservationRecordWriteIsWorkspaceWriteExecution,
    false
  );
  assert.equal(review.summary.executionObservationFileStorePersistenceAllowed, true);
  assert.equal(review.summary.executionObservationProviderExecuteAllowed, false);
  assert.equal(review.summary.executionObservationCodexCliInvocationAllowed, false);
  assert.equal(
    review.summary.executionObservationSubAgentRuntimeInvocationAllowed,
    false
  );
  assert.equal(
    review.summary.executionObservationHostExecutorInvocationAllowed,
    false
  );
  assert.equal(review.summary.executionObservationHostDispatchAllowed, false);
  assert.equal(
    review.summary.governanceFailureReducerMode,
    "pure_failure_to_governance_state_reducer_only"
  );
  assert.equal(
    review.summary.governanceFailureReducerExecutionFailureIsRecoveryAuthorization,
    false
  );
  assert.equal(
    review.summary.governanceFailureReducerStrategyDecisionIsRuntimeAuthorization,
    false
  );
  assert.equal(
    review.summary.governanceFailureReducerArbitrationPacketIsRecoveryExecution,
    false
  );
  assert.equal(
    review.summary.governanceFailureReducerRecoveryRecommendationIsHostExecutorAuthorization,
    false
  );
  assert.equal(
    review.summary.governanceFailureReducerStateUpdateIsWorkspaceWriteExecution,
    false
  );
  assert.equal(review.summary.taskGraphMode, "structural_task_graph_state_only");
  assert.equal(review.summary.taskGraphNodeStatusIsExecutionAuthorization, false);
  assert.equal(review.summary.taskGraphCompletionIsRuntimeCompletion, false);
  assert.equal(review.summary.taskGraphCheckpointNodeIsRollbackExecution, false);
  assert.equal(
    review.summary.taskGraphRollbackToCheckpointIsHostExecutorAuthorization,
    false
  );
  assert.equal(
    review.summary.taskGraphFileStorePersistenceIsWorkspaceWriteExecution,
    false
  );
  assert.equal(review.summary.totalTaskGraphProviderExecuteCallsDuringAudit, 0);
  assert.equal(review.summary.totalTaskGraphWorkspaceWriteCallsDuringAudit, 0);
  assert.equal(
    review.summary.schedulerMode,
    "queue_and_execution_lease_state_machine_only"
  );
  assert.equal(review.summary.schedulerQueuedStatusIsDispatchAuthorization, false);
  assert.equal(review.summary.schedulerLeasedStatusIsExecutionAuthorization, false);
  assert.equal(review.summary.schedulerActiveLeaseIsProviderExecuteAuthorization, false);
  assert.equal(review.summary.schedulerReleaseLeaseIsRuntimeCompletionProof, false);
  assert.equal(review.summary.schedulerFailLeaseIsRecoveryExecution, false);
  assert.equal(review.summary.schedulerFileLockIsShellProcessExecution, false);
  assert.equal(review.summary.totalSchedulerProviderExecuteCallsDuringAudit, 0);
  assert.equal(review.summary.totalSchedulerWorkspaceWriteCallsDuringAudit, 0);
  assert.equal(review.summary.executionPlannerMode, "provider_execution_plan_only");
  assert.equal(
    review.summary.executionPlannerPlannedStatusIsProviderExecutionAuthorization,
    false
  );
  assert.equal(
    review.summary.executionPlannerCodexCliProviderSelectionIsCodexCliInvocation,
    false
  );
  assert.equal(
    review.summary.executionPlannerRemoteAgentProviderSelectionIsSubAgentRuntimeInvocation,
    false
  );
  assert.equal(
    review.summary.executionPlannerWorkspaceWriteSideEffectClassIsWorkspaceWriteExecution,
    false
  );
  assert.equal(review.summary.executionPlannerLocalPlanStoreWritesAllowed, true);
  assert.equal(review.summary.executionPlannerProviderPlanExecutionAllowed, false);
  assert.equal(
    review.summary.executionPlannerProviderValidateExecutionPlanAllowed,
    false
  );
  assert.equal(review.summary.executionPlannerProviderExecuteAllowed, false);
  assert.equal(review.summary.executionPlannerCodexCliInvocationAllowed, false);
  assert.equal(review.summary.executionPlannerSubAgentRuntimeInvocationAllowed, false);
  assert.equal(review.summary.executionPlannerHostExecutorInvocationAllowed, false);
  assert.equal(review.summary.executionPlannerHostDispatchAllowed, false);
  assert.equal(review.summary.executionPlannerWorkspaceWriteExecutionAllowed, false);
  assert.equal(
    review.summary.providerRegistryMode,
    "catalog_selection_attestation_and_manifest_store_only"
  );
  assert.equal(
    review.summary.providerRegistrySelectedProviderIsExecutionAuthorization,
    false
  );
  assert.equal(
    review.summary.providerRegistryProviderGrantSelectionIsProviderExecuteAuthorization,
    false
  );
  assert.equal(
    review.summary.providerRegistryRoutingDecisionSelectionIsCodexCliAuthorization,
    false
  );
  assert.equal(
    review.summary.providerRegistryRegisteredRemoteAgentProviderIsSubAgentRuntimeAuthorization,
    false
  );
  assert.equal(
    review.summary.providerRegistryManifestStorePersistenceIsWorkspaceWriteExecution,
    false
  );
  assert.equal(review.summary.totalProviderRegistryProviderExecuteCallsDuringAudit, 0);
  assert.equal(
    review.summary.providerExecutionRunnerMode,
    "controlled_readonly_and_workspace_write_gate"
  );
  assert.equal(review.summary.controlledReadOnlyProviderExecutionAllowed, true);
  assert.equal(review.summary.providerExecutionRunnerWorkspaceWriteAllowed, true);
  assert.equal(
    review.summary.providerExecutionRunnerWorkspaceWriteProviderExecuteAllowed,
    false
  );
  assert.equal(
    review.summary.providerExecutionRunnerDefaultRealCodexCliAllowed,
    false
  );
  assert.equal(
    review.summary.providerExecutionRunnerNonCodexProviderExecutionAllowed,
    false
  );
  assert.equal(review.summary.providerCorePrimitiveMode, "manifest_permit_plan_only");
  assert.equal(
    review.summary.toolInvocationPlannerMode,
    "tool_manifest_and_invocation_plan_only"
  );
  assert.equal(
    review.summary.toolInvocationPlannerPlannedStatusIsRuntimeInvocation,
    false
  );
  assert.equal(
    review.summary.toolInvocationPlannerRemoteAgentToolManifestIsSubAgentRuntimeAuthorization,
    false
  );
  assert.equal(
    review.summary.toolInvocationPlannerExternalWriteToolManifestIsExternalWriteAuthorization,
    false
  );
  assert.equal(
    review.summary.toolInvocationPlannerApprovalPermitIsToolRuntimeAuthorization,
    false
  );
  assert.equal(
    review.summary.toolInvocationPlannerLocalWriteToolPlanIsWorkspaceWriteExecution,
    false
  );
  assert.equal(review.summary.toolInvocationPlannerInputPreviewStoresRawSecrets, false);
  assert.equal(review.summary.toolInvocationPlannerProviderExecuteAllowed, false);
  assert.equal(
    review.summary.toolInvocationPlannerSubAgentRuntimeInvocationAllowed,
    false
  );
  assert.equal(review.summary.toolInvocationPlannerToolRuntimeInvocationAllowed, false);
  assert.equal(
    review.summary.desktopAgentStrategyMode,
    "agent_assignment_and_ownership_plan_only"
  );
  assert.equal(
    review.summary.desktopAgentStrategyParallelPlanIsSubAgentRuntimeAuthorization,
    false
  );
  assert.equal(
    review.summary.desktopAgentStrategyWorkerAssignmentIsRuntimeInvocation,
    false
  );
  assert.equal(
    review.summary.desktopAgentStrategyWriteModeIsWorkspaceWriteExecution,
    false
  );
  assert.equal(
    review.summary.desktopAgentStrategyOwnershipTargetIsWorkspaceWriteAuthorization,
    false
  );
  assert.equal(review.summary.desktopDecisionRunnerMode, "decision_package_only");
  assert.equal(review.summary.finalHostLocatorMode, "source_candidate_pre_mapping_only");
  assert.equal(
    review.summary.desktopDecisionRunnerReadyStatusIsExecutionAuthorization,
    false
  );
  assert.equal(
    review.summary.desktopDecisionRunnerProviderSelectionIsProviderExecute,
    false
  );
  assert.equal(
    review.summary.desktopDecisionRunnerAgentStrategyIsSubAgentRuntimeInvocation,
    false
  );
  assert.equal(review.summary.desktopDecisionRunnerHostDispatchAllowed, false);
  assert.equal(review.summary.desktopDecisionRunnerProviderExecuteAllowed, false);
  assert.equal(review.summary.desktopDecisionRunnerCodexCliInvocationAllowed, false);
  assert.equal(
    review.summary.finalHostLocatorReadyForMappingIsHostExecutionAuthorization,
    false
  );
  assert.equal(review.summary.finalHostLocatorHostExecutorInvocationAllowed, false);
  assert.equal(review.summary.finalHostLocatorHostDispatchAllowed, false);
  assert.equal(review.summary.finalHostLocatorProviderExecuteAllowed, false);
  assert.equal(review.summary.finalHostLocatorCodexCliInvocationAllowed, false);
  assert.equal(
    review.summary.finalHostLocatorSubAgentRuntimeInvocationAllowed,
    false
  );
  assert.equal(
    review.summary.hostDispatcherProviderMode,
    "controlled_read_only_and_workspace_write_provider_dispatch"
  );
  assert.equal(
    review.summary.codexDesktopBridgeMode,
    "explicit_injected_desktop_host_bridge"
  );
  assert.equal(
    review.summary.codexDesktopLiveHostMode,
    "explicit_current_host_runtime_and_memory_bundle"
  );
  assert.equal(
    review.summary.codexMemoryMcpClientMode,
    "explicit_mcp_http_memory_transport_only"
  );
  assert.equal(
    review.summary.codexMemoryHostClientMode,
    "explicit_injected_memory_operations_only"
  );
  assert.equal(
    review.summary.desktopLiveAdapterDispatchMode,
    "route_separated_host_dispatch_or_desktop_bridge"
  );
  assert.equal(review.summary.providerCorePrimitivesExecutionAllowed, false);
  assert.equal(review.summary.codexDesktopRuntimeToolInvocationAllowedByDefault, false);
  assert.equal(
    review.summary.codexDesktopLiveHostDefaultRuntimeToolInvocationAllowed,
    false
  );
  assert.equal(review.summary.codexDesktopLiveHostCodexCliInvocationAllowed, false);
  assert.equal(review.summary.codexMemoryMcpClientMcpHttpCallsAreProviderExecution, false);
  assert.equal(
    review.summary.codexMemoryMcpClientMcpHttpCallsAreHostExecutorAuthorization,
    false
  );
  assert.equal(
    review.summary.codexMemoryMcpClientRecordMemoryIsWorkspaceWriteExecution,
    false
  );
  assert.equal(
    review.summary.codexMemoryMcpClientSearchMemoryIsSubAgentRuntimeInvocation,
    false
  );
  assert.equal(
    review.summary.codexMemoryMcpClientMemoryOverviewIsRuntimeAuthorization,
    false
  );
  assert.equal(
    review.summary.codexMemoryMcpClientAdapterCheckpointWriteIsExecutionAuthorization,
    false
  );
  assert.equal(review.summary.codexMemoryMcpClientDefaultEndpointLookupAllowed, false);
  assert.equal(
    review.summary.codexMemoryMcpClientBearerTokenIsExecutionAuthorization,
    false
  );
  assert.equal(
    review.summary.codexMemoryMcpClientDefaultCodexCliInvocationAllowed,
    false
  );
  assert.equal(review.summary.codexMemoryMcpClientProviderExecuteAllowed, false);
  assert.equal(
    review.summary.codexMemoryMcpClientSubAgentRuntimeInvocationAllowed,
    false
  );
  assert.equal(review.summary.codexMemoryMcpClientShellProcessAllowedByDefault, false);
  assert.equal(
    review.summary.codexMemoryMcpClientWorkspaceWriteAllowedByDefault,
    false
  );
  assert.equal(
    review.summary.codexMemoryHostClientMemoryOperationCallsAreHostExecutorAuthorization,
    false
  );
  assert.equal(
    review.summary.codexMemoryHostClientRecordMemoryIsWorkspaceWriteExecution,
    false
  );
  assert.equal(
    review.summary.codexMemoryHostClientSearchMemoryIsSubAgentRuntimeInvocation,
    false
  );
  assert.equal(
    review.summary.codexMemoryHostClientMemoryOverviewIsRuntimeAuthorization,
    false
  );
  assert.equal(
    review.summary.codexMemoryHostClientAdapterCheckpointWriteIsExecutionAuthorization,
    false
  );
  assert.equal(
    review.summary.codexMemoryHostClientMcpToolStyleAdapterIsDefaultHostLookup,
    false
  );
  assert.equal(
    review.summary.codexMemoryHostClientDefaultRealHostExecutionAllowed,
    false
  );
  assert.equal(
    review.summary.codexMemoryHostClientDefaultHostExecutorLookupAllowed,
    false
  );
  assert.equal(
    review.summary.codexMemoryHostClientDefaultCodexCliInvocationAllowed,
    false
  );
  assert.equal(review.summary.codexMemoryHostClientProviderExecuteAllowed, false);
  assert.equal(
    review.summary.codexMemoryHostClientSubAgentRuntimeInvocationAllowed,
    false
  );
  assert.equal(
    review.summary.codexMemoryHostClientShellProcessAllowedByDefault,
    false
  );
  assert.equal(
    review.summary.codexMemoryHostClientWorkspaceWriteAllowedByDefault,
    false
  );
  assert.equal(review.summary.desktopHostClientMode, "desktop_host_client_facade");
  assert.equal(review.summary.desktopHostClientDefaultRealExecutionAllowed, false);
  assert.equal(
    review.summary.desktopHostClientDefaultHostExecutorLookupAllowed,
    false
  );
  assert.equal(review.summary.desktopHostClientDirectDispatchToHostAllowed, false);
  assert.equal(review.summary.desktopHostClientExecuteInjectedDispatchAllowed, true);
  assert.equal(review.summary.desktopLiveAdapterBlockedDecisionExecutionAllowed, false);
  assert.equal(review.summary.hostClientExampleMode, "example_host_client_facade");
  assert.equal(review.summary.hostClientExampleRealShellProcessAllowed, false);
  assert.equal(
    review.summary.hostClientExampleHostExecutorDispatchSurfacePresent,
    false
  );
  assert.equal(review.summary.hostClientExampleWorkspaceWriteAllowed, false);
  assert.equal(
    review.summary.targetHostEmbeddingMode,
    "explicit_target_host_contract_and_starter_only"
  );
  assert.equal(
    review.summary.targetHostEmbeddingPlaceholderMethodsAreRealExecution,
    false
  );
  assert.equal(
    review.summary.targetHostEmbeddingScaffoldReadyStatusIsExecutionAuthorization,
    false
  );
  assert.equal(
    review.summary.targetHostEmbeddingCreateBundleRequiresFullyWiredHost,
    true
  );
  assert.equal(
    review.summary.targetHostEmbeddingCreateBundleIsHostExecutorAuthorization,
    false
  );
  assert.equal(
    review.summary.targetHostEmbeddingDirectiveBuildersAreShellAuthorization,
    false
  );
  assert.equal(review.summary.targetHostEmbeddingDefaultRealHostExecutionAllowed, false);
  assert.equal(review.summary.targetHostEmbeddingDefaultHostExecutorLookupAllowed, false);
  assert.equal(review.summary.targetHostEmbeddingDefaultCodexCliInvocationAllowed, false);
  assert.equal(review.summary.targetHostEmbeddingProviderExecuteAllowed, false);
  assert.equal(
    review.summary.targetHostEmbeddingSubAgentRuntimeInvocationAllowed,
    false
  );
  assert.equal(review.summary.targetHostEmbeddingShellProcessAllowedByDefault, false);
  assert.equal(review.summary.targetHostEmbeddingWorkspaceWriteAllowedByDefault, false);
  assert.equal(
    review.summary.desktopLiveAdapterBridgeInvocationAllowedByCodexCliRoute,
    false
  );
  assert.equal(review.summary.desktopLiveAdapterProviderInvocationAllowed, false);
  assert.equal(review.summary.hostDispatcherReadOnlyProviderDispatchAllowed, true);
  assert.equal(
    review.summary.hostDispatcherControlledWorkspaceWriteDispatchAllowed,
    true
  );
  assert.equal(review.summary.hostDispatcherGeneralProviderExecutionAllowed, false);
  assert.equal(review.summary.hostDispatcherGeneralWorkspaceWriteAllowed, false);
  assert.equal(
    review.summary.hostDispatcherWorkspaceWriteProviderExecuteAllowed,
    false
  );
  assert.equal(review.summary.hostExecutorDefaultRealExecutionAllowed, false);
  assert.equal(review.summary.hostExecutorTaskbookExecutionAllowed, false);
  assert.equal(review.summary.hostClientExecutorReviewDispatchAllowed, false);
  assert.equal(
    review.summary.hostExecutorReceiptDispatchMeansBusinessRecoveryCompleted,
    false
  );
  assert.equal(review.summary.agentBackedRecoveryProductionExecutionAllowed, false);
  assert.equal(review.summary.agentExecutorAdapterTaskbookExecutionAllowed, false);
  assert.equal(review.summary.agentExecutorAdapterReviewInvocationAllowed, false);
  assert.equal(
    review.summary.agentExecutorAdapterSandboxProductionExecutionAllowed,
    false
  );
  assert.equal(review.summary.taskControlTaskbookExecutionAllowed, false);
  assert.equal(review.summary.taskControlReviewInvocationAllowed, false);
  assert.equal(review.summary.subAgentRuntimeExecutionAllowed, false);
  assert.equal(review.summary.taskControlAdapterKind, "sandbox_task_control_adapter");
  assert.equal(review.summary.totalStrategyRouterCallsDuringAudit, 0);
  assert.equal(review.summary.totalStrategyRouterProviderPlanExecutionCallsDuringAudit, 0);
  assert.equal(review.summary.totalStrategyRouterProviderValidateExecutionPlanCallsDuringAudit, 0);
  assert.equal(review.summary.totalStrategyRouterProviderExecuteCallsDuringAudit, 0);
  assert.equal(review.summary.totalRoutingEngineProviderExecuteCallsDuringAudit, 0);
  assert.equal(review.summary.totalRoutingEngineWorkspaceWriteCallsDuringAudit, 0);
  assert.equal(review.summary.totalRecoveryControlProviderExecuteCallsDuringAudit, 0);
  assert.equal(review.summary.totalRecoveryControlAdapterInvocationsDuringAudit, 0);
  assert.equal(review.summary.totalRuntimeControlProviderExecuteCallsDuringAudit, 0);
  assert.equal(review.summary.totalRuntimeControlModelRuntimeCallsDuringAudit, 0);
  assert.equal(
    review.summary.totalOperatorActionExecutorGateInvocationsDuringAudit,
    0
  );
  assert.equal(review.summary.totalCodexCliHostProcessSpawnsDuringAudit, 0);
  assert.equal(review.summary.totalPublicApiCallsDuringAudit, 0);
  assert.equal(review.summary.totalAgentOsLocalRuntimeCallsDuringAudit, 0);
  assert.equal(review.summary.totalExecutionEligibilityCallsDuringAudit, 0);
  assert.equal(review.summary.totalExecutionEligibilityPermitStoreReadsDuringAudit, 0);
  assert.equal(
    review.summary.totalExecutionEligibilityProviderPlanCreationCallsDuringAudit,
    0
  );
  assert.equal(
    review.summary.totalExecutionEligibilityProviderExecuteCallsDuringAudit,
    0
  );
  assert.equal(review.summary.totalExecutionEligibilityCodexCliCallsDuringAudit, 0);
  assert.equal(
    review.summary.totalExecutionEligibilitySubAgentRuntimeCallsDuringAudit,
    0
  );
  assert.equal(
    review.summary.totalExecutionEligibilityHostExecutorCallsDuringAudit,
    0
  );
  assert.equal(review.summary.totalExecutionEligibilityHostDispatchCallsDuringAudit, 0);
  assert.equal(
    review.summary.totalExecutionEligibilityShellProcessCallsDuringAudit,
    0
  );
  assert.equal(
    review.summary.totalExecutionEligibilityWorkspaceWriteCallsDuringAudit,
    0
  );
  assert.equal(review.summary.totalExecutionEligibilityExternalWriteCallsDuringAudit, 0);
  assert.equal(review.summary.totalExecutionObservationBusEmitsDuringAudit, 0);
  assert.equal(review.summary.totalExecutionObservationStoreWritesDuringAudit, 0);
  assert.equal(
    review.summary.totalExecutionObservationProviderExecuteCallsDuringAudit,
    0
  );
  assert.equal(review.summary.totalExecutionObservationCodexCliCallsDuringAudit, 0);
  assert.equal(
    review.summary.totalExecutionObservationSubAgentRuntimeCallsDuringAudit,
    0
  );
  assert.equal(
    review.summary.totalExecutionObservationHostExecutorCallsDuringAudit,
    0
  );
  assert.equal(review.summary.totalExecutionObservationHostDispatchCallsDuringAudit, 0);
  assert.equal(
    review.summary.totalExecutionObservationShellProcessCallsDuringAudit,
    0
  );
  assert.equal(
    review.summary.totalExecutionObservationWorkspaceWriteCallsDuringAudit,
    0
  );
  assert.equal(review.summary.totalExecutionObservationExternalWriteCallsDuringAudit, 0);
  assert.equal(review.summary.totalGovernanceFailureReducerCallbackCallsDuringAudit, 0);
  assert.equal(review.summary.totalGovernanceFailureReducerPersistenceWritesDuringAudit, 0);
  assert.equal(
    review.summary.totalGovernanceFailureReducerProviderExecuteCallsDuringAudit,
    0
  );
  assert.equal(review.summary.totalGovernanceFailureReducerCodexCliCallsDuringAudit, 0);
  assert.equal(
    review.summary.totalGovernanceFailureReducerSubAgentRuntimeCallsDuringAudit,
    0
  );
  assert.equal(review.summary.totalGovernanceFailureReducerHostExecutorCallsDuringAudit, 0);
  assert.equal(review.summary.totalGovernanceFailureReducerHostDispatchCallsDuringAudit, 0);
  assert.equal(review.summary.totalGovernanceFailureReducerToolRuntimeCallsDuringAudit, 0);
  assert.equal(review.summary.totalGovernanceFailureReducerShellProcessCallsDuringAudit, 0);
  assert.equal(review.summary.totalGovernanceFailureReducerWorkspaceWriteCallsDuringAudit, 0);
  assert.equal(review.summary.totalGovernanceFailureReducerExternalWriteCallsDuringAudit, 0);
  assert.equal(review.summary.totalExecutionPlannerCallsDuringAudit, 0);
  assert.equal(
    review.summary.totalExecutionPlannerLocalPlanStoreWritesDuringAudit,
    0
  );
  assert.equal(
    review.summary.totalExecutionPlannerProviderPlanExecutionCallsDuringAudit,
    0
  );
  assert.equal(
    review.summary.totalExecutionPlannerProviderValidateExecutionPlanCallsDuringAudit,
    0
  );
  assert.equal(
    review.summary.totalExecutionPlannerProviderExecuteCallsDuringAudit,
    0
  );
  assert.equal(review.summary.totalExecutionPlannerCodexCliCallsDuringAudit, 0);
  assert.equal(
    review.summary.totalExecutionPlannerSubAgentRuntimeCallsDuringAudit,
    0
  );
  assert.equal(review.summary.totalExecutionPlannerHostExecutorCallsDuringAudit, 0);
  assert.equal(review.summary.totalExecutionPlannerHostDispatchCallsDuringAudit, 0);
  assert.equal(review.summary.totalExecutionPlannerShellProcessCallsDuringAudit, 0);
  assert.equal(review.summary.totalExecutionPlannerWorkspaceWriteCallsDuringAudit, 0);
  assert.equal(review.summary.totalExecutionPlannerExternalWriteCallsDuringAudit, 0);
  assert.equal(review.summary.totalProviderExecutionRunnerCallsDuringAudit, 0);
  assert.equal(
    review.summary.totalProviderExecutionRunnerPlanExecutionCallsDuringAudit,
    0
  );
  assert.equal(
    review.summary.totalProviderExecutionRunnerValidateExecutionPlanCallsDuringAudit,
    0
  );
  assert.equal(review.summary.totalProviderExecutionRunnerExecuteCallsDuringAudit, 0);
  assert.equal(review.summary.totalProviderCoreRuntimeCallsDuringAudit, 0);
  assert.equal(review.summary.totalToolRegistryCallsDuringAudit, 0);
  assert.equal(review.summary.totalToolInvocationPlansDuringAudit, 0);
  assert.equal(review.summary.totalToolInvocationPlannerToolRuntimeCallsDuringAudit, 0);
  assert.equal(
    review.summary.totalToolInvocationPlannerProviderExecuteCallsDuringAudit,
    0
  );
  assert.equal(
    review.summary.totalToolInvocationPlannerSubAgentRuntimeCallsDuringAudit,
    0
  );
  assert.equal(
    review.summary.totalToolInvocationPlannerHostExecutorCallsDuringAudit,
    0
  );
  assert.equal(review.summary.totalDesktopDecisionRunnerCallsDuringAudit, 0);
  assert.equal(
    review.summary.totalDesktopDecisionRunnerHostDispatchCallsDuringAudit,
    0
  );
  assert.equal(
    review.summary.totalDesktopDecisionRunnerProviderExecuteCallsDuringAudit,
    0
  );
  assert.equal(review.summary.totalFinalHostLocatorCallsDuringAudit, 0);
  assert.equal(
    review.summary.totalFinalHostLocatorHostExecutorCallsDuringAudit,
    0
  );
  assert.equal(review.summary.totalFinalHostLocatorHostDispatchCallsDuringAudit, 0);
  assert.equal(
    review.summary.totalFinalHostLocatorProviderExecuteCallsDuringAudit,
    0
  );
  assert.equal(review.summary.totalFinalHostLocatorCodexCliCallsDuringAudit, 0);
  assert.equal(
    review.summary.totalFinalHostLocatorSubAgentRuntimeCallsDuringAudit,
    0
  );
  assert.equal(review.summary.totalFinalHostLocatorShellProcessCallsDuringAudit, 0);
  assert.equal(
    review.summary.totalFinalHostLocatorWorkspaceWriteCallsDuringAudit,
    0
  );
  assert.equal(review.summary.totalFinalHostLocatorExternalWriteCallsDuringAudit, 0);
  assert.equal(review.summary.totalRemoteAgentRuntimeCallsDuringAudit, 0);
  assert.equal(review.summary.totalToolRuntimeCallsDuringAudit, 0);
  assert.equal(review.summary.totalHostDispatcherProviderDispatchCallsDuringAudit, 0);
  assert.equal(review.summary.totalCodexDesktopBridgeCallsDuringAudit, 0);
  assert.equal(review.summary.totalCodexDesktopRuntimeToolCallsDuringAudit, 0);
  assert.equal(review.summary.totalCodexDesktopLiveHostBundleCreationsDuringAudit, 0);
  assert.equal(review.summary.totalCodexDesktopLiveHostRuntimeToolCallsDuringAudit, 0);
  assert.equal(review.summary.totalCodexDesktopLiveHostMemoryToolCallsDuringAudit, 0);
  assert.equal(review.summary.totalCodexDesktopLiveHostBridgeCallsDuringAudit, 0);
  assert.equal(review.summary.totalCodexDesktopLiveHostClientRunCallsDuringAudit, 0);
  assert.equal(review.summary.totalCodexDesktopLiveHostSmokeRunsDuringAudit, 0);
  assert.equal(review.summary.totalCodexMemoryMcpClientMcpHttpCallsDuringAudit, 0);
  assert.equal(review.summary.totalCodexMemoryMcpClientMemoryToolCallsDuringAudit, 0);
  assert.equal(
    review.summary.totalCodexMemoryMcpClientHostExecutorInvocationsDuringAudit,
    0
  );
  assert.equal(review.summary.totalCodexMemoryMcpClientCodexCliCallsDuringAudit, 0);
  assert.equal(
    review.summary.totalCodexMemoryMcpClientProviderExecuteCallsDuringAudit,
    0
  );
  assert.equal(
    review.summary.totalCodexMemoryMcpClientSubAgentRuntimeCallsDuringAudit,
    0
  );
  assert.equal(review.summary.totalCodexMemoryMcpClientShellProcessCallsDuringAudit, 0);
  assert.equal(
    review.summary.totalCodexMemoryMcpClientWorkspaceWriteCallsDuringAudit,
    0
  );
  assert.equal(review.summary.totalCodexMemoryMcpClientExternalWriteCallsDuringAudit, 0);
  assert.equal(review.summary.totalCodexMemoryHostClientCallsDuringAudit, 0);
  assert.equal(
    review.summary.totalCodexMemoryHostClientMemoryOperationCallsDuringAudit,
    0
  );
  assert.equal(
    review.summary.totalCodexMemoryHostClientHostExecutorInvocationsDuringAudit,
    0
  );
  assert.equal(review.summary.totalCodexMemoryHostClientCodexCliCallsDuringAudit, 0);
  assert.equal(
    review.summary.totalCodexMemoryHostClientProviderExecuteCallsDuringAudit,
    0
  );
  assert.equal(
    review.summary.totalCodexMemoryHostClientSubAgentRuntimeCallsDuringAudit,
    0
  );
  assert.equal(review.summary.totalCodexMemoryHostClientShellProcessCallsDuringAudit, 0);
  assert.equal(
    review.summary.totalCodexMemoryHostClientWorkspaceWriteCallsDuringAudit,
    0
  );
  assert.equal(review.summary.totalCodexMemoryHostClientExternalWriteCallsDuringAudit, 0);
  assert.equal(review.summary.totalDesktopHostClientCallsDuringAudit, 0);
  assert.equal(review.summary.totalDesktopHostClientLiveAdapterCallsDuringAudit, 0);
  assert.equal(
    review.summary.totalDesktopHostClientHostExecutorInvocationsDuringAudit,
    0
  );
  assert.equal(review.summary.totalDesktopHostClientDispatchToHostCallsDuringAudit, 0);
  assert.equal(review.summary.totalDesktopLiveAdapterCallsDuringAudit, 0);
  assert.equal(review.summary.totalDesktopLiveAdapterDispatchToHostCallsDuringAudit, 0);
  assert.equal(review.summary.totalDesktopLiveAdapterBridgeCallsDuringAudit, 0);
  assert.equal(review.summary.totalHostClientExampleCallsDuringAudit, 0);
  assert.equal(review.summary.totalHostClientExampleLiveAdapterCallsDuringAudit, 0);
  assert.equal(
    review.summary.totalHostClientExampleHostExecutorInvocationsDuringAudit,
    0
  );
  assert.equal(review.summary.totalTargetHostEmbeddingBundleCreationsDuringAudit, 0);
  assert.equal(review.summary.totalTargetHostEmbeddingHostClientRunCallsDuringAudit, 0);
  assert.equal(
    review.summary.totalTargetHostEmbeddingHostExecutorInvocationsDuringAudit,
    0
  );
  assert.equal(review.summary.totalTargetHostEmbeddingCodexCliCallsDuringAudit, 0);
  assert.equal(
    review.summary.totalTargetHostEmbeddingProviderExecuteCallsDuringAudit,
    0
  );
  assert.equal(
    review.summary.totalTargetHostEmbeddingSubAgentRuntimeCallsDuringAudit,
    0
  );
  assert.equal(review.summary.totalTargetHostEmbeddingShellProcessCallsDuringAudit, 0);
  assert.equal(review.summary.totalTargetHostEmbeddingWorkspaceWriteCallsDuringAudit, 0);
  assert.equal(review.summary.totalTargetHostEmbeddingExternalWriteCallsDuringAudit, 0);
  assert.equal(review.summary.totalHostExecutorTaskbookDispatchCallsDuringAudit, 0);
  assert.equal(review.summary.totalHostClientReviewBridgeCallsDuringAudit, 0);
  assert.equal(review.summary.totalHostClientReviewDispatchCallsDuringAudit, 0);
  assert.equal(review.summary.totalHostExecutorReceiptInvocationsDuringAudit, 0);
  assert.equal(
    review.summary.totalAgentBackedSandboxExecutorInvocationsDuringAudit,
    0
  );
  assert.equal(
    review.summary.totalAgentExecutorAdapterTaskbookInvocationsDuringAudit,
    0
  );
  assert.equal(
    review.summary.totalAgentExecutorAdapterReviewInvocationsDuringAudit,
    0
  );
  assert.equal(review.summary.totalAgentExecutorAdapterInvocationsDuringAudit, 0);
  assert.equal(
    review.summary.totalAgentTaskControlTaskbookInvocationsDuringAudit,
    0
  );
  assert.equal(review.summary.totalAgentTaskControlReviewInvocationsDuringAudit, 0);
  assert.equal(review.summary.totalSubAgentRuntimeCallsDuringAudit, 0);
  assert.equal(review.summary.totalAdapterInvocationsDuringAudit, 0);
});

test("execution boundary current surface audit blocks failed component audit", async () => {
  const input = await collectExecutionBoundaryCurrentSurfaceAuditInput();
  const review = reviewExecutionBoundaryCurrentSurfaceAudit({
    ...input,
    strategyRouterReview: {
      ...input.strategyRouterReview,
      status: "blocked",
      reasons: ["synthetic_strategy_router_boundary_failure"]
    }
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_allComponentAuditsPassed"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_strategyRouterBoundaryConstrained"
    )
  );
});

test("execution boundary current surface audit blocks missing runner and README registration", async () => {
  const input = await collectExecutionBoundaryCurrentSurfaceAuditInput();
  const review = reviewExecutionBoundaryCurrentSurfaceAudit({
    ...input,
    governanceRunnerText: input.governanceRunnerText.replaceAll(
      "auditCheck(\"host-executor-boundary\"",
      "auditCheck(\"archived-host-executor-review\""
    ),
    governanceReadmeText: input.governanceReadmeText.replaceAll(
      "npm run governance -- audit host-executor-boundary",
      "npm run governance -- audit archived-host-executor-review"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_governanceRunnerRegistersAllCurrentAudits"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_governanceReadmeListsAllCurrentAudits"
    )
  );
});

test("execution boundary current surface audit blocks missing control-plane verification marker", async () => {
  const input = await collectExecutionBoundaryCurrentSurfaceAuditInput();
  const review = reviewExecutionBoundaryCurrentSurfaceAudit({
    ...input,
    governanceControlPlaneText: input.governanceControlPlaneText.replaceAll(
      "npm run governance -- audit execution-boundary-current-surface",
      "npm run governance -- audit archived-execution-boundary"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_controlPlaneRecordsAllBoundaries"
    )
  );
});

test("execution boundary current surface audit blocks missing control-plane authority inheritance markers", async () => {
  const input = await collectExecutionBoundaryCurrentSurfaceAuditInput();
  const review = reviewExecutionBoundaryCurrentSurfaceAudit({
    ...input,
    governanceControlPlaneText: input.governanceControlPlaneText.replaceAll(
      "Codex CLI host does not authorize host executor or sub-agent runtime",
      "Codex CLI host inheritance is summarized elsewhere"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_controlPlaneRecordsAllBoundaries"
    )
  );
});

test("execution boundary current surface audit blocks missing entry-doc lattice markers", async () => {
  const input = await collectExecutionBoundaryCurrentSurfaceAuditInput();
  const review = reviewExecutionBoundaryCurrentSurfaceAudit({
    ...input,
    governanceReadmeText: input.governanceReadmeText.replaceAll(
      "narrow_readonly_provider_dispatch_without_boundary_inheritance",
      "legacy_readonly_dispatch_boundary"
    ),
    governanceValidationTiersText: input.governanceValidationTiersText.replaceAll(
      "read-only provider dispatch does not inherit into sub-agent runtime authorization",
      "read-only provider dispatch is summarized elsewhere"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_entryDocsRecordExecutionAuthorityLattice"
    )
  );
});

test("execution boundary current surface audit blocks missing current-state authority inheritance markers", async () => {
  const input = await collectExecutionBoundaryCurrentSurfaceAuditInput();
  const review = reviewExecutionBoundaryCurrentSurfaceAudit({
    ...input,
    currentStateText: input.currentStateText.replaceAll(
      "narrow_readonly_provider_dispatch_without_boundary_inheritance",
      "legacy_readonly_dispatch_boundary"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_currentStateRecordsExecutionAuthorityLattice"
    )
  );
});

test("execution boundary current surface audit blocks missing CI gate", async () => {
  const input = await collectExecutionBoundaryCurrentSurfaceAuditInput();
  const review = reviewExecutionBoundaryCurrentSurfaceAudit({
    ...input,
    ciWorkflowText: input.ciWorkflowText
      .replaceAll(
        "npm run governance -- audit execution-boundary-current-surface",
        "npm run governance -- audit archived-execution-boundary"
      )
      .replaceAll(
        "needs: [canary, smoke-contract, state-sync, execution-boundary]",
        "needs: [canary, smoke-contract, state-sync]"
      )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_ciWorkflowRunsCurrentSurfaceGate"
    )
  );
});

test("execution boundary current surface audit blocks broadened execution summaries", async () => {
  const input = await collectExecutionBoundaryCurrentSurfaceAuditInput();
  const review = reviewExecutionBoundaryCurrentSurfaceAudit({
    ...input,
    strategyRouterReview: {
      ...input.strategyRouterReview,
      summary: {
        ...input.strategyRouterReview.summary,
        executeActionFamilyIsAuthorization: true as false
      }
    },
    executionProfilesReview: {
      ...input.executionProfilesReview,
      summary: {
        ...input.executionProfilesReview.summary,
        profileSelectionIsProviderExecutionAuthorization: true as false
      }
    },
    policyConfigReview: {
      ...input.policyConfigReview,
      summary: {
        ...input.policyConfigReview.summary,
        hostRouteIsHostDispatchAuthorization: true as false,
        providerExecuteCallsDuringAudit: 1 as 0
      }
    },
    capabilityTaxonomyReview: {
      ...input.capabilityTaxonomyReview,
      summary: {
        ...input.capabilityTaxonomyReview.summary,
        generalProviderExecutionClassIsProviderExecuteAuthorization: true as false,
        providerExecuteCallsDuringAudit: 1 as 0
      }
    },
    capabilityTaxonomyEscalationPolicyReview: {
      ...input.capabilityTaxonomyEscalationPolicyReview,
      summary: {
        ...input.capabilityTaxonomyEscalationPolicyReview.summary,
        escalationPolicyIsProviderExecuteAuthorization: true as false,
        providerExecuteCallsDuringAudit: 1 as 0
      }
    },
    routingEngineReview: {
      ...input.routingEngineReview,
      summary: {
        ...input.routingEngineReview.summary,
        providerGrantIsProviderExecuteAuthorization: true as false
      }
    },
    recoveryControlReview: {
      ...input.recoveryControlReview,
      summary: {
        ...input.recoveryControlReview.summary,
        executionGateIsRuntimeAuthorization: true as false
      }
    },
    runtimeControlReview: {
      ...input.runtimeControlReview,
      summary: {
        ...input.runtimeControlReview.summary,
        upgradeModelIsModelRuntimeInvocation: true as false
      }
    },
    codexProviderReview: {
      ...input.codexProviderReview,
      summary: {
        ...input.codexProviderReview.summary,
        generalProviderExecutionAllowed: true as false
      }
    },
    approvalPermitReview: {
      ...input.approvalPermitReview,
      summary: {
        ...input.approvalPermitReview.summary,
        validPermitIsProviderExecutionAuthorization: true as false
      }
    },
    approvalGateReview: {
      ...input.approvalGateReview,
      summary: {
        ...input.approvalGateReview.summary,
        approvalResolvedIsProviderExecutionAuthorization: true as false
      }
    },
    approvalConsumptionDispatchMatrixReview: {
      ...input.approvalConsumptionDispatchMatrixReview,
      summary: {
        ...input.approvalConsumptionDispatchMatrixReview.summary,
        matrixAuditIsProviderExecuteAuthorization: true as false,
        providerExecuteCallsDuringBoundaryAudit: 1 as 0
      }
    },
    stateSyncReview: {
      ...input.stateSyncReview,
      summary: {
        ...input.stateSyncReview.summary,
        stateSyncIsProviderExecuteAuthorization: true as false,
        stateWritesDuringBoundaryAudit: 1 as 0
      }
    },
    admissionControlReview: {
      ...input.admissionControlReview,
      summary: {
        ...input.admissionControlReview.summary,
        acceptedStatusIsExecutionAuthorization: true as false
      }
    },
    delegationPolicyReview: {
      ...input.delegationPolicyReview,
      summary: {
        ...input.delegationPolicyReview.summary,
        fullDelegationIsExecutionAuthorization: true as false
      }
    },
    executionEligibilityReview: {
      ...input.executionEligibilityReview,
      summary: {
        ...input.executionEligibilityReview.summary,
        eligibleStatusIsExecutionAuthorization: true as false
      }
    },
    executionObservationReview: {
      ...input.executionObservationReview,
      summary: {
        ...input.executionObservationReview.summary,
        observationStatusIsExecutionAuthorization: true as false
      }
    },
    governanceFailureReducerReview: {
      ...input.governanceFailureReducerReview,
      summary: {
        ...input.governanceFailureReducerReview.summary,
        executionFailureIsRecoveryAuthorization: true as false
      }
    },
    taskGraphReview: {
      ...input.taskGraphReview,
      summary: {
        ...input.taskGraphReview.summary,
        nodeStatusIsExecutionAuthorization: true as false
      }
    },
    schedulerReview: {
      ...input.schedulerReview,
      summary: {
        ...input.schedulerReview.summary,
        queuedStatusIsDispatchAuthorization: true as false
      }
    },
    executionPlannerReview: {
      ...input.executionPlannerReview,
      summary: {
        ...input.executionPlannerReview.summary,
        plannedStatusIsProviderExecutionAuthorization: true as false
      }
    },
    providerRegistryReview: {
      ...input.providerRegistryReview,
      summary: {
        ...input.providerRegistryReview.summary,
        selectedProviderIsExecutionAuthorization: true as false
      }
    },
    providerExecutionRunnerReview: {
      ...input.providerExecutionRunnerReview,
      summary: {
        ...input.providerExecutionRunnerReview.summary,
        workspaceWriteProviderExecuteAllowed: true as false
      }
    },
    providerCorePrimitivesReview: {
      ...input.providerCorePrimitivesReview,
      summary: {
        ...input.providerCorePrimitivesReview.summary,
        remoteAgentExecutionAllowed: true as false
      }
    },
    toolInvocationPlannerReview: {
      ...input.toolInvocationPlannerReview,
      summary: {
        ...input.toolInvocationPlannerReview.summary,
        plannedStatusIsRuntimeInvocation: true as false
      }
    },
    desktopAgentStrategyReview: {
      ...input.desktopAgentStrategyReview,
      summary: {
        ...input.desktopAgentStrategyReview.summary,
        parallelPlanIsSubAgentRuntimeAuthorization: true as false
      }
    },
    desktopDecisionRunnerReview: {
      ...input.desktopDecisionRunnerReview,
      summary: {
        ...input.desktopDecisionRunnerReview.summary,
        providerSelectionIsProviderExecute: true as false
      }
    },
    finalHostLocatorReview: {
      ...input.finalHostLocatorReview,
      summary: {
        ...input.finalHostLocatorReview.summary,
        readyForMappingIsHostExecutionAuthorization: true as false
      }
    },
    hostDispatcherProviderReview: {
      ...input.hostDispatcherProviderReview,
      summary: {
        ...input.hostDispatcherProviderReview.summary,
        generalProviderExecutionAllowed: true as false
      }
    },
    codexDesktopBridgeReview: {
      ...input.codexDesktopBridgeReview,
      summary: {
        ...input.codexDesktopBridgeReview.summary,
        runtimeToolInvocationAllowedByDefault: true as false
      }
    },
    codexDesktopLiveHostReview: {
      ...input.codexDesktopLiveHostReview,
      summary: {
        ...input.codexDesktopLiveHostReview.summary,
        defaultRuntimeToolInvocationAllowed: true as false
      }
    },
    codexMemoryMcpClientReview: {
      ...input.codexMemoryMcpClientReview,
      summary: {
        ...input.codexMemoryMcpClientReview.summary,
        mcpHttpCallsAreProviderExecution: true as false
      }
    },
    codexMemoryHostClientReview: {
      ...input.codexMemoryHostClientReview,
      summary: {
        ...input.codexMemoryHostClientReview.summary,
        memoryOperationCallsAreHostExecutorAuthorization: true as false
      }
    },
    desktopHostClientReview: {
      ...input.desktopHostClientReview,
      summary: {
        ...input.desktopHostClientReview.summary,
        defaultHostExecutorLookupAllowed: true as false,
        workspaceWriteProviderExecuteAllowedByClient: true as false
      }
    },
    desktopLiveAdapterDispatchReview: {
      ...input.desktopLiveAdapterDispatchReview,
      summary: {
        ...input.desktopLiveAdapterDispatchReview.summary,
        bridgeInvocationAllowedByCodexCliRoute: true as false
      }
    },
    hostClientExampleReview: {
      ...input.hostClientExampleReview,
      summary: {
        ...input.hostClientExampleReview.summary,
        realShellProcessAllowed: true as false
      }
    },
    targetHostEmbeddingReview: {
      ...input.targetHostEmbeddingReview,
      summary: {
        ...input.targetHostEmbeddingReview.summary,
        createBundleIsHostExecutorAuthorization: true as false
      }
    },
    operatorActionExecutorGateReview: {
      ...input.operatorActionExecutorGateReview,
      summary: {
        ...input.operatorActionExecutorGateReview.summary,
        executionAuthorizedByGate: true as false
      }
    },
    codexCliHostReview: {
      ...input.codexCliHostReview,
      summary: {
        ...input.codexCliHostReview.summary,
        providerExecutionAllowedByHostBoundary: true as false
      }
    },
    publicApiReview: {
      ...input.publicApiReview,
      summary: {
        ...input.publicApiReview.summary,
        providerExecuteExportAllowed: true as false
      }
    },
    agentOsLocalRuntimeReview: {
      ...input.agentOsLocalRuntimeReview,
      summary: {
        ...input.agentOsLocalRuntimeReview.summary,
        realProviderExecutionAllowed: true as false
      }
    },
    protocolMcpProviderSkeletonReview: {
      ...input.protocolMcpProviderSkeletonReview,
      summary: {
        ...input.protocolMcpProviderSkeletonReview.summary,
        invokeMethodIsEnabled: true as false
      }
    },
    protocolA2aRemoteProviderSkeletonReview: {
      ...input.protocolA2aRemoteProviderSkeletonReview,
      summary: {
        ...input.protocolA2aRemoteProviderSkeletonReview.summary,
        remoteProviderIsEnabled: true as false
      }
    },
    agentOsSdkReview: {
      ...input.agentOsSdkReview,
      summary: {
        ...input.agentOsSdkReview.summary,
        preferredProviderIsCodexCliInvocation: true as false
      }
    },
    agentOsCliReview: {
      ...input.agentOsCliReview,
      summary: {
        ...input.agentOsCliReview.summary,
        preferredProviderIsCodexCliInvocation: true as false
      }
    },
    agentOsAppServerReview: {
      ...input.agentOsAppServerReview,
      summary: {
        ...input.agentOsAppServerReview.summary,
        liveHttpServerStarted: true as false
      }
    },
    preflightReview: {
      ...input.preflightReview,
      summary: {
        ...input.preflightReview.summary,
        preflightOkIsExecutionAuthorization: true as false
      }
    },
    hostExecutorReceiptReview: {
      ...input.hostExecutorReceiptReview,
      summary: {
        ...input.hostExecutorReceiptReview.summary,
        dispatchResultMeansBusinessRecoveryCompleted: true as false
      }
    },
    hostExecutorTaskbookReview: {
      ...input.hostExecutorTaskbookReview,
      summary: {
        ...input.hostExecutorTaskbookReview.summary,
        taskbookExecutionAuthorized: true as false
      }
    },
    hostClientExecutorReviewReview: {
      ...input.hostClientExecutorReviewReview,
      summary: {
        ...input.hostClientExecutorReviewReview.summary,
        recoveryActionDispatchAllowed: true as false
      }
    },
    agentBackedRecoveryExecutorReview: {
      ...input.agentBackedRecoveryExecutorReview,
      summary: {
        ...input.agentBackedRecoveryExecutorReview.summary,
        productionRecoveryExecutionAllowed: true as false
      }
    },
    agentExecutorAdapterTaskbookReview: {
      ...input.agentExecutorAdapterTaskbookReview,
      summary: {
        ...input.agentExecutorAdapterTaskbookReview.summary,
        taskbookExecutionAuthorized: true as false
      }
    },
    agentExecutorAdapterReviewReview: {
      ...input.agentExecutorAdapterReviewReview,
      summary: {
        ...input.agentExecutorAdapterReviewReview.summary,
        adapterInvocationAllowed: true as false
      }
    },
    agentExecutorAdapterSandboxReview: {
      ...input.agentExecutorAdapterSandboxReview,
      summary: {
        ...input.agentExecutorAdapterSandboxReview.summary,
        productionRecoveryExecutionAllowed: true as false
      }
    },
    agentTaskControlTaskbookReview: {
      ...input.agentTaskControlTaskbookReview,
      summary: {
        ...input.agentTaskControlTaskbookReview.summary,
        taskbookExecutionAuthorized: true as false
      }
    },
    agentTaskControlReviewReview: {
      ...input.agentTaskControlReviewReview,
      summary: {
        ...input.agentTaskControlReviewReview.summary,
        subAgentRuntimeInvocationAllowed: true as false
      }
    },
    subAgentRuntimeReview: {
      ...input.subAgentRuntimeReview,
      summary: {
        ...input.subAgentRuntimeReview.summary,
        subAgentRuntimeExecutionAllowed: true as false
      }
    }
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_strategyRouterBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_executionProfilesBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_policyConfigBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_capabilityTaxonomyBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_capabilityTaxonomyEscalationPolicyBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_routingEngineBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_recoveryControlBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_runtimeControlBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_codexProviderBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_approvalPermitBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_approvalGateBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_approvalConsumptionDispatchMatrixBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_stateSyncBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_admissionControlBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_delegationPolicyBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_executionEligibilityBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_executionObservationBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_governanceFailureReducerBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_taskGraphBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_schedulerBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_executionPlannerBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_providerRegistryBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_providerExecutionRunnerBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_providerCorePrimitivesBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_toolInvocationPlannerBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_desktopAgentStrategyBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_desktopDecisionRunnerBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_finalHostLocatorBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_hostDispatcherProviderBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_codexDesktopBridgeBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_codexDesktopLiveHostBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_codexMemoryMcpClientBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_codexMemoryHostClientBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_desktopHostClientBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_desktopLiveAdapterDispatchBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_hostClientExampleBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_targetHostEmbeddingBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_operatorActionExecutorGateBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_codexCliHostBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_publicApiBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_agentOsLocalRuntimeBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_protocolMcpProviderSkeletonBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_protocolA2aRemoteProviderSkeletonBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_agentOsSdkBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_agentOsCliBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_agentOsAppServerBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_preflightBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_providerExecutionRunnerBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_hostExecutorReceiptBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_hostExecutorTaskbookBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_hostClientExecutorReviewBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_agentBackedRecoveryExecutorBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_agentExecutorAdapterTaskbookBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_agentExecutorAdapterReviewBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_agentExecutorAdapterSandboxBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_agentTaskControlTaskbookBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_agentTaskControlReviewBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_subAgentRuntimeBoundaryConstrained"
    )
  );
});

test("execution boundary current surface audit blocks authority lattice broadening", async () => {
  const input = await collectExecutionBoundaryCurrentSurfaceAuditInput();
  const review = reviewExecutionBoundaryCurrentSurfaceAudit({
    ...input,
    hostDispatcherProviderReview: {
      ...input.hostDispatcherProviderReview,
      summary: {
        ...input.hostDispatcherProviderReview.summary,
        hostExecutorInvocationAllowed: true as false
      }
    },
    desktopLiveAdapterDispatchReview: {
      ...input.desktopLiveAdapterDispatchReview,
      summary: {
        ...input.desktopLiveAdapterDispatchReview.summary,
        hostExecutorInvocationAllowed: true as false
      }
    },
    subAgentRuntimeReview: {
      ...input.subAgentRuntimeReview,
      summary: {
        ...input.subAgentRuntimeReview.summary,
        subAgentRuntimeExecutionAllowed: true as false
      }
    }
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_executionAuthorityLatticeConstrained"
    )
  );
});

test("execution boundary current surface audit blocks Codex sub-agent host executor authority inheritance", async () => {
  const input = await collectExecutionBoundaryCurrentSurfaceAuditInput();
  const review = reviewExecutionBoundaryCurrentSurfaceAudit({
    ...input,
    codexCliHostReview: {
      ...input.codexCliHostReview,
      summary: {
        ...input.codexCliHostReview.summary,
        subAgentRuntimeInvocationAllowed: true as false
      }
    },
    subAgentRuntimeReview: {
      ...input.subAgentRuntimeReview,
      summary: {
        ...input.subAgentRuntimeReview.summary,
        codexCliCallsDuringAudit: 1 as 0
      }
    },
    hostExecutorReview: {
      ...input.hostExecutorReview,
      summary: {
        ...input.hostExecutorReview.summary,
        providerCallsDuringAudit: 1 as 0
      }
    }
  });

  assert.equal(review.status, "blocked");
  assert.equal(
    review.summary.codexCliHostDoesNotAuthorizeHostExecutorOrSubAgentRuntime,
    false
  );
  assert.equal(
    review.summary.subAgentRuntimeDoesNotInvokeCodexCliOrProviderExecution,
    false
  );
  assert.equal(
    review.summary.hostExecutorDoesNotExecuteProviderOrSubAgentRuntime,
    false
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_executionAuthorityLatticeConstrained"
    )
  );
});

test("execution boundary current surface audit blocks executing audit counters", async () => {
  const input = await collectExecutionBoundaryCurrentSurfaceAuditInput();
  const review = reviewExecutionBoundaryCurrentSurfaceAudit({
    ...input,
    strategyRouterReview: {
      ...input.strategyRouterReview,
      summary: {
        ...input.strategyRouterReview.summary,
        providerExecuteCallsDuringAudit: 1 as 0
      }
    },
    routingEngineReview: {
      ...input.routingEngineReview,
      summary: {
        ...input.routingEngineReview.summary,
        providerExecuteCallsDuringAudit: 1 as 0
      }
    },
    recoveryControlReview: {
      ...input.recoveryControlReview,
      summary: {
        ...input.recoveryControlReview.summary,
        adapterInvocationsDuringAudit: 1 as 0
      }
    },
    runtimeControlReview: {
      ...input.runtimeControlReview,
      summary: {
        ...input.runtimeControlReview.summary,
        modelRuntimeCallsDuringAudit: 1 as 0
      }
    },
    hostExecutorReview: {
      ...input.hostExecutorReview,
      summary: {
        ...input.hostExecutorReview.summary,
        hostExecutorInvocationsDuringAudit: 1 as 0
      }
    },
    operatorActionExecutorGateReview: {
      ...input.operatorActionExecutorGateReview,
      summary: {
        ...input.operatorActionExecutorGateReview.summary,
        providerExecuteCallsDuringAudit: 1 as 0
      }
    },
    providerExecutionRunnerReview: {
      ...input.providerExecutionRunnerReview,
      summary: {
        ...input.providerExecutionRunnerReview.summary,
        providerExecuteCallsDuringAudit: 1 as 0
      }
    },
    codexCliHostReview: {
      ...input.codexCliHostReview,
      summary: {
        ...input.codexCliHostReview.summary,
        codexCliProcessSpawnsDuringAudit: 1 as 0
      }
    },
    publicApiReview: {
      ...input.publicApiReview,
      summary: {
        ...input.publicApiReview.summary,
        publicApiCallsDuringAudit: 1 as 0
      }
    },
    agentOsLocalRuntimeReview: {
      ...input.agentOsLocalRuntimeReview,
      summary: {
        ...input.agentOsLocalRuntimeReview.summary,
        localRuntimeCallsDuringAudit: 1 as 0
      }
    },
    approvalPermitReview: {
      ...input.approvalPermitReview,
      summary: {
        ...input.approvalPermitReview.summary,
        providerExecuteCallsDuringAudit: 1 as 0
      }
    },
    approvalGateReview: {
      ...input.approvalGateReview,
      summary: {
        ...input.approvalGateReview.summary,
        providerExecuteCallsDuringAudit: 1 as 0
      }
    },
    admissionControlReview: {
      ...input.admissionControlReview,
      summary: {
        ...input.admissionControlReview.summary,
        providerExecuteCallsDuringAudit: 1 as 0
      }
    },
    delegationPolicyReview: {
      ...input.delegationPolicyReview,
      summary: {
        ...input.delegationPolicyReview.summary,
        providerExecuteCallsDuringAudit: 1 as 0
      }
    },
    executionEligibilityReview: {
      ...input.executionEligibilityReview,
      summary: {
        ...input.executionEligibilityReview.summary,
        providerExecuteCallsDuringAudit: 1 as 0
      }
    },
    executionObservationReview: {
      ...input.executionObservationReview,
      summary: {
        ...input.executionObservationReview.summary,
        providerExecuteCallsDuringAudit: 1 as 0
      }
    },
    governanceFailureReducerReview: {
      ...input.governanceFailureReducerReview,
      summary: {
        ...input.governanceFailureReducerReview.summary,
        providerExecuteCallsDuringAudit: 1 as 0
      }
    },
    taskGraphReview: {
      ...input.taskGraphReview,
      summary: {
        ...input.taskGraphReview.summary,
        providerExecuteCallsDuringAudit: 1 as 0
      }
    },
    schedulerReview: {
      ...input.schedulerReview,
      summary: {
        ...input.schedulerReview.summary,
        providerExecuteCallsDuringAudit: 1 as 0
      }
    },
    executionPlannerReview: {
      ...input.executionPlannerReview,
      summary: {
        ...input.executionPlannerReview.summary,
        providerExecuteCallsDuringAudit: 1 as 0
      }
    },
    providerRegistryReview: {
      ...input.providerRegistryReview,
      summary: {
        ...input.providerRegistryReview.summary,
        providerExecuteCallsDuringAudit: 1 as 0
      }
    },
    providerCorePrimitivesReview: {
      ...input.providerCorePrimitivesReview,
      summary: {
        ...input.providerCorePrimitivesReview.summary,
        providerCoreRuntimeCallsDuringAudit: 1 as 0
      }
    },
    toolInvocationPlannerReview: {
      ...input.toolInvocationPlannerReview,
      summary: {
        ...input.toolInvocationPlannerReview.summary,
        toolRuntimeCallsDuringAudit: 1 as 0
      }
    },
    desktopAgentStrategyReview: {
      ...input.desktopAgentStrategyReview,
      summary: {
        ...input.desktopAgentStrategyReview.summary,
        subAgentRuntimeCallsDuringAudit: 1 as 0
      }
    },
    desktopDecisionRunnerReview: {
      ...input.desktopDecisionRunnerReview,
      summary: {
        ...input.desktopDecisionRunnerReview.summary,
        providerExecuteCallsDuringAudit: 1 as 0
      }
    },
    finalHostLocatorReview: {
      ...input.finalHostLocatorReview,
      summary: {
        ...input.finalHostLocatorReview.summary,
        hostExecutorCallsDuringAudit: 1 as 0
      }
    },
    hostDispatcherProviderReview: {
      ...input.hostDispatcherProviderReview,
      summary: {
        ...input.hostDispatcherProviderReview.summary,
        providerExecuteCallsDuringAudit: 1 as 0
      }
    },
    codexDesktopBridgeReview: {
      ...input.codexDesktopBridgeReview,
      summary: {
        ...input.codexDesktopBridgeReview.summary,
        runtimeToolCallsDuringAudit: 1 as 0
      }
    },
    codexDesktopLiveHostReview: {
      ...input.codexDesktopLiveHostReview,
      summary: {
        ...input.codexDesktopLiveHostReview.summary,
        hostClientRunCallsDuringAudit: 1 as 0
      }
    },
    codexMemoryMcpClientReview: {
      ...input.codexMemoryMcpClientReview,
      summary: {
        ...input.codexMemoryMcpClientReview.summary,
        mcpHttpCallsDuringAudit: 1 as 0
      }
    },
    codexMemoryHostClientReview: {
      ...input.codexMemoryHostClientReview,
      summary: {
        ...input.codexMemoryHostClientReview.summary,
        memoryOperationCallsDuringAudit: 1 as 0
      }
    },
    desktopHostClientReview: {
      ...input.desktopHostClientReview,
      summary: {
        ...input.desktopHostClientReview.summary,
        hostExecutorInvocationsDuringAudit: 1 as 0
      }
    },
    desktopLiveAdapterDispatchReview: {
      ...input.desktopLiveAdapterDispatchReview,
      summary: {
        ...input.desktopLiveAdapterDispatchReview.summary,
        dispatchToHostCallsDuringAudit: 1 as 0
      }
    },
    hostClientExampleReview: {
      ...input.hostClientExampleReview,
      summary: {
        ...input.hostClientExampleReview.summary,
        exampleClientCallsDuringAudit: 1 as 0
      }
    },
    targetHostEmbeddingReview: {
      ...input.targetHostEmbeddingReview,
      summary: {
        ...input.targetHostEmbeddingReview.summary,
        hostClientRunCallsDuringAudit: 1 as 0
      }
    },
    hostExecutorReceiptReview: {
      ...input.hostExecutorReceiptReview,
      summary: {
        ...input.hostExecutorReceiptReview.summary,
        executorInvocationsDuringAudit: 1 as 0
      }
    },
    hostExecutorTaskbookReview: {
      ...input.hostExecutorTaskbookReview,
      summary: {
        ...input.hostExecutorTaskbookReview.summary,
        recoveryActionDispatchCallsDuringAudit: 1 as 0
      }
    },
    hostClientExecutorReviewReview: {
      ...input.hostClientExecutorReviewReview,
      summary: {
        ...input.hostClientExecutorReviewReview.summary,
        hostBridgeCallsDuringAudit: 1 as 0
      }
    },
    agentBackedRecoveryExecutorReview: {
      ...input.agentBackedRecoveryExecutorReview,
      summary: {
        ...input.agentBackedRecoveryExecutorReview.summary,
        sandboxExecutorInvocationsDuringAudit: 1 as 0
      }
    },
    agentExecutorAdapterTaskbookReview: {
      ...input.agentExecutorAdapterTaskbookReview,
      summary: {
        ...input.agentExecutorAdapterTaskbookReview.summary,
        adapterInvocationsDuringAudit: 1 as 0
      }
    },
    agentExecutorAdapterReviewReview: {
      ...input.agentExecutorAdapterReviewReview,
      summary: {
        ...input.agentExecutorAdapterReviewReview.summary,
        adapterInvocationsDuringAudit: 1 as 0
      }
    },
    agentExecutorAdapterSandboxReview: {
      ...input.agentExecutorAdapterSandboxReview,
      summary: {
        ...input.agentExecutorAdapterSandboxReview.summary,
        adapterInvocationsDuringAudit: 1 as 0
      }
    },
    agentTaskControlTaskbookReview: {
      ...input.agentTaskControlTaskbookReview,
      summary: {
        ...input.agentTaskControlTaskbookReview.summary,
        adapterInvocationsDuringAudit: 1 as 0
      }
    },
    agentTaskControlReviewReview: {
      ...input.agentTaskControlReviewReview,
      summary: {
        ...input.agentTaskControlReviewReview.summary,
        adapterInvocationsDuringAudit: 1 as 0
      }
    },
    agentTaskControlReview: {
      ...input.agentTaskControlReview,
      summary: {
        ...input.agentTaskControlReview.summary,
        adapterInvocationsDuringAudit: 1 as 0
      }
    }
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_strategyRouterBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_routingEngineBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_recoveryControlBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_runtimeControlBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_hostExecutorBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_operatorActionExecutorGateBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_codexCliHostBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_publicApiBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_approvalPermitBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_approvalGateBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_admissionControlBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_delegationPolicyBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_executionEligibilityBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_executionObservationBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_governanceFailureReducerBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_taskGraphBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_schedulerBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_executionPlannerBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_providerRegistryBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_providerCorePrimitivesBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_desktopAgentStrategyBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_finalHostLocatorBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_hostDispatcherProviderBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_codexDesktopBridgeBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_codexDesktopLiveHostBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_codexMemoryMcpClientBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_codexMemoryHostClientBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_desktopHostClientBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_desktopLiveAdapterDispatchBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_hostClientExampleBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_targetHostEmbeddingBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_hostExecutorReceiptBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_hostExecutorTaskbookBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_hostClientExecutorReviewBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_agentBackedRecoveryExecutorBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_agentExecutorAdapterTaskbookBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_agentExecutorAdapterReviewBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_agentExecutorAdapterSandboxBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_agentTaskControlTaskbookBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_agentTaskControlReviewBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_agentTaskControlBoundaryConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "execution_boundary_current_surface_auditItselfIsNonExecuting"
    )
  );
});

test("execution boundary current surface audit output stays summarized", async () => {
  const review = reviewExecutionBoundaryCurrentSurfaceAudit(
    await collectExecutionBoundaryCurrentSurfaceAuditInput()
  );
  const text = formatExecutionBoundaryCurrentSurfaceAuditResult(review);
  const json = formatExecutionBoundaryCurrentSurfaceAuditResult(review, "json");
  const parsed = JSON.parse(json) as ExecutionBoundaryCurrentSurfaceAuditInput;

  assert.match(text, /status: passed/);
  assert.match(
    text,
    /execution authority lattice mode: narrow_readonly_provider_dispatch_without_boundary_inheritance/
  );
  assert.match(
    text,
    /Codex CLI host does not authorize host executor or sub-agent runtime: true/
  );
  assert.match(
    text,
    /sub-agent runtime does not invoke Codex CLI or provider execution: true/
  );
  assert.match(
    text,
    /host executor does not execute provider or sub-agent runtime: true/
  );
  assert.match(text, /policy config mode: policy_schema_and_signal_resolution_only/);
  assert.match(text, /policy config hostRoute is host dispatch authorization: false/);
  assert.match(text, /policy config provider execute calls during audit: 0/);
  assert.match(
    text,
    /capability taxonomy mode: capability_classification_and_escalation_policy_only/
  );
  assert.match(
    text,
    /capability taxonomy general provider execution class is provider execute authorization: false/
  );
  assert.match(text, /capability taxonomy provider execute calls during audit: 0/);
  assert.match(
    text,
    /capability taxonomy escalation policy mode: capability_escalation_policy_only/
  );
  assert.match(
    text,
    /capability taxonomy escalation policy is provider execute authorization: false/
  );
  assert.match(
    text,
    /capability taxonomy escalation policy provider execute calls during audit: 0/
  );
  assert.match(text, /routing engine provider execute calls during audit: 0/);
  assert.match(text, /recovery control adapter invocations during audit: 0/);
  assert.match(text, /runtime control model runtime calls during audit: 0/);
  assert.match(text, /operator action executor gate invocations during audit: 0/);
  assert.match(text, /Codex CLI host process spawns during audit: 0/);
  assert.match(text, /public API calls during audit: 0/);
  assert.match(
    text,
    /desktop host client controlled workspace-write dispatch allowed: true/
  );
  assert.match(
    text,
    /desktop host client general workspace-write allowed: false/
  );
  assert.match(
    text,
    /desktop host client workspace-write provider execute allowed: false/
  );
  assert.match(text, /protocol MCP tool runtime calls during audit: 0/);
  assert.match(text, /protocol A2A remote agent runtime calls during audit: 0/);
  assert.match(text, /Agent OS SDK Codex CLI calls during audit: 0/);
  assert.match(text, /Agent OS CLI Codex CLI calls during audit: 0/);
  assert.match(text, /Agent OS app-server live HTTP server starts during audit: 0/);
  assert.match(text, /preflight provider execute calls during audit: 0/);
  assert.match(text, /Approval permit provider execute calls during audit: 0/);
  assert.match(text, /Approval gate provider execute calls during audit: 0/);
  assert.match(
    text,
    /approval consumption dispatch matrix boundary mode: git_state_and_artifact_matrix_gate_only/
  );
  assert.match(
    text,
    /approval consumption dispatch matrix audit is provider execute authorization: false/
  );
  assert.match(
    text,
    /approval consumption dispatch matrix boundary provider execute calls during audit: 0/
  );
  assert.match(
    text,
    /state-sync boundary mode: state_consistency_observation_gate_only/
  );
  assert.match(text, /state-sync is provider execute authorization: false/);
  assert.match(text, /state-sync is release authorization: false/);
  assert.match(text, /state-sync boundary state writes during audit: 0/);
  assert.match(text, /state-sync boundary remote writes during audit: 0/);
  assert.match(text, /workspace-write release gate mode: promotion_review_gate_only/);
  assert.match(
    text,
    /workspace-write release gate is workspace-write authorization: false/
  );
  assert.match(
    text,
    /workspace-write release gate provider execute calls during audit: 0/
  );
  assert.match(
    text,
    /workspace-write release gate workspace-write calls during audit: 0/
  );
  assert.match(text, /Admission control provider execute calls during audit: 0/);
  assert.match(text, /Delegation policy provider execute calls during audit: 0/);
  assert.match(text, /execution eligibility calls during audit: 0/);
  assert.match(text, /execution observation bus emits during audit: 0/);
  assert.match(text, /governance failure reducer provider execute calls during audit: 0/);
  assert.match(text, /task graph provider execute calls during audit: 0/);
  assert.match(text, /scheduler provider execute calls during audit: 0/);
  assert.match(text, /execution planner calls during audit: 0/);
  assert.match(text, /Provider registry provider execute calls during audit: 0/);
  assert.match(text, /provider-core runtime calls during audit: 0/);
  assert.match(text, /Tool invocation planner tool runtime calls during audit: 0/);
  assert.match(text, /desktop agent strategy sub-agent runtime calls during audit: 0/);
  assert.match(text, /final host locator calls during audit: 0/);
  assert.match(text, /host dispatcher provider dispatch calls during audit: 0/);
  assert.match(text, /Codex desktop runtime tool calls during audit: 0/);
  assert.match(text, /Codex memory MCP client MCP HTTP calls during audit: 0/);
  assert.match(text, /Codex memory host client memory operation calls during audit: 0/);
  assert.match(text, /desktop live adapter dispatchToHost calls during audit: 0/);
  assert.match(text, /target host embedding host client run calls during audit: 0/);
  assert.match(text, /host-client review bridge calls during audit: 0/);
  assert.match(text, /agent executor adapter review invocations during audit: 0/);
  assert.match(text, /agent task-control review invocations during audit: 0/);
  assert.match(text, /sub-agent runtime calls during audit: 0/);
  assert.equal((parsed as unknown as { status: string }).status, "passed");

  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false, `text output must omit ${marker}`);
    assert.equal(json.includes(marker), false, `json output must omit ${marker}`);
  }
});
