import { z } from "zod";

export const EXACT_REVIEW_CODEX_VERSION = "0.144.1";
export const EXACT_REVIEW_CODEX_TARGET = "x86_64-unknown-linux-musl";
export const EXACT_REVIEW_RELEASE_TAG = "rust-v0.144.1";
export const EXACT_REVIEW_SOURCE_COMMIT =
  "44918ea10c0f99151c6710411b4322c2f5c96bea";
export const EXACT_REVIEW_INSTALLED_BINARY_SHA256 =
  "a96f944d1a596dbfb7fdd84f482be5c50e34b04bb371126840d873e4ebf26902";
export const EXACT_REVIEW_RELEASE_ARCHIVE_SHA256 =
  "84091ae20c65fcc7d4120db97d1bd57d7ff8df9c7609fb781c78c2ebbd4f5a28";

const SourceFilesSchema = z.object({
  "codex-rs/app-server/README.md": z.literal(
    "5eef644bb96cc1e07b142e3523036456f880700c703f5633414ad1c1b1dac336"
  ),
  "codex-rs/core/src/safety.rs": z.literal(
    "dd4d65e11b6aeee2cc6434b9b9090c646edeadc90b0c72e9da50f41c174d66b9"
  ),
  "codex-rs/core/src/apply_patch.rs": z.literal(
    "86d2894e5c0af015bb29109ecde33512e9091a30a7169dc3dbacd47472e3f139"
  ),
  "codex-rs/core/src/tools/handlers/apply_patch.rs": z.literal(
    "da6919735a77b8c4d44ee963bb434dae27e5d519b6184fa4b7577917984ed8a8"
  ),
  "codex-rs/core/src/tools/runtimes/apply_patch.rs": z.literal(
    "565061fd88acda43dfc5eea93aacf49fca06a9deca7c4918e14655f7d3139db1"
  ),
  "codex-rs/core/src/tools/orchestrator.rs": z.literal(
    "25d4963e7e5bdbfeb0f4283aa45f8d545d5a7d7af51fe76ffa55d7d05b509020"
  ),
  "codex-rs/app-server/src/bespoke_event_handling.rs": z.literal(
    "08cdd76278ad2985f34512229c948638e1a9aba66a4551d9226a3e6a6b6557aa"
  ),
  "codex-rs/core/src/session/mod.rs": z.literal(
    "0a1045a7c54655df6743f2bab9275001e772c5b3e695dc8e07d63d1fd9d39a14"
  ),
  "codex-rs/app-server/tests/suite/v2/turn_start.rs": z.literal(
    "61059a76ad85665e4b7241ab6d8e87921bd175dfa8da9e9aaaa6250d1a8599c2"
  ),
  "codex-rs/app-server-protocol/src/protocol/v2/item.rs": z.literal(
    "da4846f64b75a4eb352e1963db763d43b1ddcfdfe834f0b17be51fa81000af3f"
  ),
  "codex-rs/features/src/lib.rs": z.literal(
    "67438e073ef25f02ed2b526e79e4034092345d323dc13bd1dec0100ae47a628b"
  )
}).strict();

const GeneratedSchemaSchema = z.object({
  source: z.literal("previously-authorized-installed-cli-output"),
  rawSha256: z.object({
    fileChangeRequestApprovalParams: z.literal(
      "7b465f7c5671adffdc5c339f50799860950307456e2a2b52c5ce1d3018f4babd"
    ),
    fileChangeRequestApprovalResponse: z.literal(
      "7ccbd29e5f8840c7c8aa96c5c3b6d52bc71ec5c5d7e1ad05ab958afd44c0c94c"
    ),
    threadStartParams: z.literal(
      "8f5db1d50208255f4746f32f583c68df544e9ac62abf34d97ecb9800700917fb"
    ),
    v2Bundle: z.literal(
      "5d483645db5309cff913516ce6f5dc16ca4797a59711fb610563b8b8164b581e"
    )
  }).strict(),
  semanticSha256: z.object({
    fileChangeRequestApprovalParams: z.literal(
      "1683d378ee81b2d4d2aeab348d4aa8236a8070c6ee44a1548a8d206ee947411d"
    ),
    fileChangeRequestApprovalResponse: z.literal(
      "f522e127a6160afd094932f6b0a58b736a171ebfb767d58b3d70c0bd7ff7ab97"
    ),
    threadStartParams: z.literal(
      "d960450fe2d0c1bf65f5aad42b070faefd59973ea9645d021b011ebdf23b5c03"
    ),
    v2Bundle: z.literal(
      "f76d741a299026cf4a1c75847b41562078d54c6f0aab9faae8781831e73d97d4"
    )
  }).strict(),
  semanticMatchObserved: z.literal(true)
}).strict();

export const CodexAppServerExactVersionSecurityEvidenceSchema = z.object({
  schemaVersion: z.literal("codex-app-server-exact-version-security-evidence.v1"),
  observedAt: z.literal("2026-07-14"),
  installedArtifact: z.object({
    packageVersion: z.literal(EXACT_REVIEW_CODEX_VERSION),
    target: z.literal(EXACT_REVIEW_CODEX_TARGET),
    variant: z.literal("codex"),
    binarySha256: z.literal(EXACT_REVIEW_INSTALLED_BINARY_SHA256),
    officialReleaseArchive: z.literal("codex-x86_64-unknown-linux-musl.tar.gz"),
    officialReleaseArchiveSha256: z.literal(EXACT_REVIEW_RELEASE_ARCHIVE_SHA256),
    releaseArchiveDigestObserved: z.literal(true),
    installedBinaryMatchObserved: z.literal(true)
  }).strict(),
  source: z.object({
    repository: z.literal("openai/codex"),
    tag: z.literal(EXACT_REVIEW_RELEASE_TAG),
    tagObject: z.literal("db75c19352d29ef29c17dbcf73a7244f1b1a8d10"),
    commit: z.literal(EXACT_REVIEW_SOURCE_COMMIT),
    checkedOutCommitMatchObserved: z.literal(true),
    files: SourceFilesSchema
  }).strict(),
  generatedSchema: GeneratedSchemaSchema,
  sourceReview: z.object({
    noDelayedApplyFieldOrMethod: z.literal(true),
    readOnlyManagedNoWritableRootsRequiresApproval: z.literal(true),
    itemStartedPrecedesApprovalRequestInPinnedTests: z.literal(true),
    declineReturnsBeforePatchRuntimeInPinnedSource: z.literal(true),
    permissionResolutionFailureCanUseUnrestrictedFallback: z.literal(true),
    cachedOrPreapprovedPatchCanSkipClientApproval: z.literal(true),
    permissionRequestHookCanDecideBeforeClient: z.literal(true),
    applyPatchStreamingEventsUnderDevelopmentAndDisabledByDefault: z.literal(true)
  }).strict(),
  runtimeBinding: z.object({
    exactEffectiveConfigurationBound: z.literal(false),
    managedReadOnlyWithNoWritableRootsBound: z.literal(false),
    onRequestUserReviewerBound: z.literal(false),
    strictAutoReviewDisabledBound: z.literal(false),
    noSessionOrTurnWriteGrantBound: z.literal(false),
    noCachedApprovalOrPreapprovalBound: z.literal(false),
    nativeLocalPathResolutionBound: z.literal(false),
    allHooksDisabledBound: z.literal(false),
    freshSessionAndEmptyApprovalStoreBound: z.literal(false),
    terminalDeclineOnlyClientBoundToRuntime: z.literal(false),
    proposalBeforeApplyObserved: z.literal(false),
    finalWorkspaceHashReceiptPresent: z.literal(false)
  }).strict(),
  evaluationSideEffects: z.object({
    codexBinaryExecuted: z.literal(false),
    appServerStarted: z.literal(false),
    liveClientConnected: z.literal(false),
    providerCalled: z.literal(false),
    workspaceWriteAttempted: z.literal(false)
  }).strict()
}).strict();

export interface CodexAppServerExactVersionSecurityAssessment {
  schemaVersion: "codex-app-server-exact-version-security-assessment.v1";
  status: "blocked";
  disposition: "no_go";
  reviewComplete: boolean;
  receiptMatchesExpectedLiterals: boolean;
  installedArtifactBound: false;
  sourceCommitBound: false;
  generatedSchemaBound: false;
  exactEffectiveConfigurationBound: false;
  proposalBeforeApplyRuntimeOrderProven: false;
  liveSmokeEligible: false;
  existingLiveSmokePreflightMayBeRelaxed: false;
  realWorkspaceWriteSmokeAuthorized: false;
  reasons: string[];
  evaluationSideEffects: {
    codexBinaryExecuted: false;
    appServerStarted: false;
    liveClientConnected: false;
    providerCalled: false;
    workspaceWriteAttempted: false;
  };
}

const SIDE_EFFECTS = Object.freeze({
  codexBinaryExecuted: false,
  appServerStarted: false,
  liveClientConnected: false,
  providerCalled: false,
  workspaceWriteAttempted: false
});

export function evaluateCodexAppServerExactVersionSecurityEvidence(
  input: unknown
): CodexAppServerExactVersionSecurityAssessment {
  try {
    if (!isPlainData(input)) return invalidAssessment();
    const parsed = CodexAppServerExactVersionSecurityEvidenceSchema.safeParse(input);
    if (!parsed.success) return invalidAssessment();
  } catch {
    return invalidAssessment();
  }

  return {
    schemaVersion: "codex-app-server-exact-version-security-assessment.v1",
    status: "blocked",
    disposition: "no_go",
    reviewComplete: true,
    receiptMatchesExpectedLiterals: true,
    installedArtifactBound: false,
    sourceCommitBound: false,
    generatedSchemaBound: false,
    exactEffectiveConfigurationBound: false,
    proposalBeforeApplyRuntimeOrderProven: false,
    liveSmokeEligible: false,
    existingLiveSmokePreflightMayBeRelaxed: false,
    realWorkspaceWriteSmokeAuthorized: false,
    reasons: [
      "no_client_controlled_delayed_apply_contract",
      "current_installed_artifact_not_reverified_by_receipt_checker",
      "current_source_checkout_not_reverified_by_receipt_checker",
      "current_generated_schema_not_reverified_by_receipt_checker",
      "effective_runtime_configuration_not_bound",
      "session_and_turn_grant_state_not_bound",
      "cached_approval_state_not_bound",
      "permission_resolution_not_observed",
      "hook_runtime_state_not_bound",
      "approval_store_state_not_bound",
      "proposal_before_apply_runtime_order_not_observed",
      "independent_clone_final_hash_receipt_absent",
      "live_workspace_write_smoke_remains_prohibited"
    ],
    evaluationSideEffects: { ...SIDE_EFFECTS }
  };
}

function invalidAssessment(): CodexAppServerExactVersionSecurityAssessment {
  return {
    schemaVersion: "codex-app-server-exact-version-security-assessment.v1",
    status: "blocked",
    disposition: "no_go",
    reviewComplete: false,
    receiptMatchesExpectedLiterals: false,
    installedArtifactBound: false,
    sourceCommitBound: false,
    generatedSchemaBound: false,
    exactEffectiveConfigurationBound: false,
    proposalBeforeApplyRuntimeOrderProven: false,
    liveSmokeEligible: false,
    existingLiveSmokePreflightMayBeRelaxed: false,
    realWorkspaceWriteSmokeAuthorized: false,
    reasons: ["exact_version_security_evidence_invalid"],
    evaluationSideEffects: { ...SIDE_EFFECTS }
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
