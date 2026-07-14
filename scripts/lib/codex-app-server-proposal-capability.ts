import { z } from "zod";

export const CODEX_PROPOSAL_CAPABILITY_SOURCE_COMMIT =
  "5bed6447998c754d154dbd796517310b8f04d4ce";

const SOURCE_BASE = `https://github.com/openai/codex/blob/${CODEX_PROPOSAL_CAPABILITY_SOURCE_COMMIT}`;

const ExpectedSourceUrls = Object.freeze({
  appServerReadme: `${SOURCE_BASE}/codex-rs/app-server/README.md`,
  patchSafety: `${SOURCE_BASE}/codex-rs/core/src/safety.rs`,
  applyPatchDecision: `${SOURCE_BASE}/codex-rs/core/src/apply_patch.rs`,
  applyPatchHandler: `${SOURCE_BASE}/codex-rs/core/src/tools/handlers/apply_patch.rs`,
  applyPatchRuntime: `${SOURCE_BASE}/codex-rs/core/src/tools/runtimes/apply_patch.rs`,
  toolOrchestrator: `${SOURCE_BASE}/codex-rs/core/src/tools/orchestrator.rs`,
  approvalResolution: `${SOURCE_BASE}/codex-rs/core/src/tools/approvals.rs`,
  appServerV2Item: `${SOURCE_BASE}/codex-rs/app-server-protocol/src/protocol/v2/item.rs`,
  featureRegistry: `${SOURCE_BASE}/codex-rs/features/src/lib.rs`
});

const SourceUrlsSchema = z.object({
  appServerReadme: z.literal(ExpectedSourceUrls.appServerReadme),
  patchSafety: z.literal(ExpectedSourceUrls.patchSafety),
  applyPatchDecision: z.literal(ExpectedSourceUrls.applyPatchDecision),
  applyPatchHandler: z.literal(ExpectedSourceUrls.applyPatchHandler),
  applyPatchRuntime: z.literal(ExpectedSourceUrls.applyPatchRuntime),
  toolOrchestrator: z.literal(ExpectedSourceUrls.toolOrchestrator),
  approvalResolution: z.literal(ExpectedSourceUrls.approvalResolution),
  appServerV2Item: z.literal(ExpectedSourceUrls.appServerV2Item),
  featureRegistry: z.literal(ExpectedSourceUrls.featureRegistry)
}).strict();

const ProposalCapabilityFactsSchema = z.object({
  sandboxMode: z.enum(["read-only", "workspace-write", "danger-full-access"]),
  approvalPolicy: z.enum(["on-request", "untrusted", "never"]),
  approvalsReviewer: z.enum(["user", "auto-review"]),
  permissionProfileKind: z.enum(["managed", "disabled", "external"]),
  executionEnvironment: z.enum(["native-local", "remote", "unknown"]),
  writableRoots: z.enum(["none", "workspace", "unrestricted"]),
  targetPathsResolved: z.boolean(),
  effectivePatchPermissionsResolved: z.boolean(),
  patchSafetyDecision: z.enum(["ask-user", "auto-approve", "reject"]),
  itemStartedCarriesProposedChanges: z.boolean(),
  itemStartedPrecedesApprovalResolution: z.boolean(),
  approvalResolutionPrecedesRuntime: z.boolean(),
  declineStopsBeforeRuntime: z.boolean(),
  sessionOrTurnWriteGrantsPresent: z.boolean(),
  cachedPatchApprovalPresent: z.boolean(),
  permissionsPreapproved: z.boolean(),
  permissionRequestHooksConfigured: z.boolean(),
  allToolHooksDisabled: z.boolean(),
  strictAutoReviewEnabled: z.boolean(),
  freshIsolatedSessionAndThread: z.boolean(),
  approvalStoreEmpty: z.boolean(),
  exactEffectiveConfigurationBound: z.literal(false),
  sourceEvidenceMechanicallyVerified: z.literal(false),
  patchUpdatedParsedBeforeExecution: z.boolean(),
  patchUpdatedStage: z.enum(["under-development", "stable", "removed"]),
  patchUpdatedDefaultEnabled: z.boolean(),
  delayedApplyProtocolFieldPresent: z.boolean(),
  dedicatedReadOnlyProposalMethodPresent: z.boolean(),
  transportConstructed: z.boolean(),
  liveServerStarted: z.boolean(),
  liveClientConnected: z.boolean(),
  workspaceWriteAttempted: z.boolean(),
  commandActivityObserved: z.boolean(),
  networkActivityObserved: z.boolean(),
  externalToolActivityObserved: z.boolean()
}).strict();

export const CodexAppServerProposalCapabilityEvidenceSchema = z.object({
  schemaVersion: z.literal("codex-app-server-proposal-capability-evidence.v1"),
  observedAt: z.literal("2026-07-14"),
  source: z.object({
    repository: z.literal("openai/codex"),
    commit: z.literal(CODEX_PROPOSAL_CAPABILITY_SOURCE_COMMIT),
    urls: SourceUrlsSchema
  }).strict(),
  facts: ProposalCapabilityFactsSchema
}).strict();

export type CodexAppServerProposalCapabilityEvidence = z.infer<
  typeof CodexAppServerProposalCapabilityEvidenceSchema
>;

export interface CodexAppServerProposalCapabilityAssessment {
  schemaVersion: "codex-app-server-proposal-capability-assessment.v1";
  status: "blocked";
  disposition:
    | "source_review_conditional_path_only"
    | "no_go";
  sourceCommit: string | null;
  delayedApplyProtocolProven: false;
  sourceReviewConditionalPathIdentified: boolean;
  runtimeConfigurationBound: false;
  liveSmokeEligible: false;
  existingLiveSmokePreflightMayBeRelaxed: false;
  requiresIndependentSecurityReview: true;
  reasons: string[];
  evaluationSideEffects: {
    transportConstructed: false;
    liveServerStarted: false;
    liveClientConnected: false;
    workspaceWriteAttempted: false;
    commandActivityObserved: false;
    networkActivityObserved: false;
    externalToolActivityObserved: false;
  };
}

export function evaluateCodexAppServerProposalCapabilityEvidence(
  input: unknown
): CodexAppServerProposalCapabilityAssessment {
  let parsed: CodexAppServerProposalCapabilityEvidence;
  try {
    if (!isPlainData(input)) return blocked("proposal_capability_evidence_invalid");
    const result = CodexAppServerProposalCapabilityEvidenceSchema.safeParse(input);
    if (!result.success) return blocked("proposal_capability_evidence_invalid");
    parsed = result.data;
  } catch {
    return blocked("proposal_capability_evidence_invalid");
  }

  const facts = parsed.facts;
  const reasons: string[] = [];

  if (facts.delayedApplyProtocolFieldPresent) {
    reasons.push("delayed_apply_protocol_not_supported_by_pinned_evidence_model");
  } else {
    reasons.push("delayed_apply_protocol_not_proven");
  }
  if (facts.dedicatedReadOnlyProposalMethodPresent) {
    reasons.push("dedicated_read_only_proposal_method_not_supported_by_pinned_evidence_model");
  }
  if (facts.sandboxMode !== "read-only") reasons.push("sandbox_mode_not_read_only");
  if (facts.approvalPolicy !== "on-request") reasons.push("approval_policy_not_on_request");
  if (facts.approvalsReviewer !== "user") reasons.push("approval_reviewer_not_user");
  if (facts.permissionProfileKind !== "managed") reasons.push("permission_profile_not_managed");
  if (facts.executionEnvironment !== "native-local") reasons.push("execution_environment_not_native_local");
  if (facts.writableRoots !== "none") reasons.push("writable_roots_not_empty");
  if (!facts.targetPathsResolved) reasons.push("target_paths_not_resolved");
  if (!facts.effectivePatchPermissionsResolved) reasons.push("effective_patch_permissions_not_resolved");
  if (facts.patchSafetyDecision !== "ask-user") reasons.push("patch_safety_does_not_require_user");
  if (!facts.itemStartedCarriesProposedChanges) reasons.push("proposed_changes_not_available_before_approval");
  if (!facts.itemStartedPrecedesApprovalResolution) reasons.push("item_start_order_not_proven");
  if (!facts.approvalResolutionPrecedesRuntime) reasons.push("approval_before_runtime_not_proven");
  if (!facts.declineStopsBeforeRuntime) reasons.push("decline_before_runtime_not_proven");
  if (facts.sessionOrTurnWriteGrantsPresent) reasons.push("preexisting_write_grants_present");
  if (facts.cachedPatchApprovalPresent) reasons.push("cached_patch_approval_present");
  if (facts.permissionsPreapproved) reasons.push("patch_permissions_preapproved");
  if (facts.permissionRequestHooksConfigured) reasons.push("permission_hook_may_bypass_client_decline");
  if (!facts.allToolHooksDisabled) reasons.push("tool_hooks_may_mutate_or_add_side_effects");
  if (facts.strictAutoReviewEnabled) reasons.push("automatic_approval_reviewer_enabled");
  if (!facts.freshIsolatedSessionAndThread) reasons.push("session_or_thread_not_fresh_and_isolated");
  if (!facts.approvalStoreEmpty) reasons.push("approval_store_not_empty");
  if (!facts.exactEffectiveConfigurationBound) reasons.push("runtime_configuration_not_bound");
  if (!facts.sourceEvidenceMechanicallyVerified) reasons.push("source_evidence_is_review_claims_only");
  if (facts.patchUpdatedStage !== "under-development" || facts.patchUpdatedDefaultEnabled) {
    reasons.push("patch_updated_stability_claim_drifted");
  }
  if (!facts.patchUpdatedParsedBeforeExecution) reasons.push("patch_updated_order_not_documented");
  if (
    facts.transportConstructed
    || facts.liveServerStarted
    || facts.liveClientConnected
    || facts.workspaceWriteAttempted
    || facts.commandActivityObserved
    || facts.networkActivityObserved
    || facts.externalToolActivityObserved
  ) {
    reasons.push("offline_evidence_contains_live_side_effects");
  }

  const sourcePathBlockingReasons = reasons.filter((reason) =>
    reason !== "delayed_apply_protocol_not_proven"
    && reason !== "runtime_configuration_not_bound"
    && reason !== "source_evidence_is_review_claims_only"
  );
  const sourceReviewConditionalPathIdentified = sourcePathBlockingReasons.length === 0;
  if (sourceReviewConditionalPathIdentified) reasons.push("independent_security_review_required");

  return {
    schemaVersion: "codex-app-server-proposal-capability-assessment.v1",
    status: "blocked",
    disposition: sourceReviewConditionalPathIdentified
      ? "source_review_conditional_path_only"
      : "no_go",
    sourceCommit: parsed.source.commit,
    delayedApplyProtocolProven: false,
    sourceReviewConditionalPathIdentified,
    runtimeConfigurationBound: false,
    liveSmokeEligible: false,
    existingLiveSmokePreflightMayBeRelaxed: false,
    requiresIndependentSecurityReview: true,
    reasons: [...new Set(reasons)],
    evaluationSideEffects: {
      transportConstructed: false,
      liveServerStarted: false,
      liveClientConnected: false,
      workspaceWriteAttempted: false,
      commandActivityObserved: false,
      networkActivityObserved: false,
      externalToolActivityObserved: false
    }
  };
}

function isPlainData(input: unknown, seen = new Set<object>()): boolean {
  if (
    input === null
    || typeof input === "string"
    || typeof input === "boolean"
    || (typeof input === "number" && Number.isFinite(input))
  ) return true;
  if (typeof input !== "object" || Array.isArray(input)) return false;
  try {
    if (Object.getPrototypeOf(input) !== Object.prototype || seen.has(input)) return false;
    seen.add(input);
    for (const key of Reflect.ownKeys(input)) {
      if (typeof key !== "string") return false;
      const descriptor = Object.getOwnPropertyDescriptor(input, key);
      if (descriptor === undefined || !("value" in descriptor)) return false;
      if (!isPlainData(descriptor.value, seen)) return false;
    }
    seen.delete(input);
    return true;
  } catch {
    return false;
  }
}

function blocked(reason: string): CodexAppServerProposalCapabilityAssessment {
  return {
    schemaVersion: "codex-app-server-proposal-capability-assessment.v1",
    status: "blocked",
    disposition: "no_go",
    sourceCommit: null,
    delayedApplyProtocolProven: false,
    sourceReviewConditionalPathIdentified: false,
    runtimeConfigurationBound: false,
    liveSmokeEligible: false,
    existingLiveSmokePreflightMayBeRelaxed: false,
    requiresIndependentSecurityReview: true,
    reasons: [reason],
    evaluationSideEffects: {
      transportConstructed: false,
      liveServerStarted: false,
      liveClientConnected: false,
      workspaceWriteAttempted: false,
      commandActivityObserved: false,
      networkActivityObserved: false,
      externalToolActivityObserved: false
    }
  };
}
