import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  evaluateCodexAppServerProposalCapabilityEvidence
} from "../scripts/lib/codex-app-server-proposal-capability.js";

const READ_ONLY_FIXTURE = new URL(
  "./fixtures/codex-app-server/proposal-capability/read-only-on-request-5bed644.json",
  import.meta.url
);
const WORKSPACE_WRITE_FIXTURE = new URL(
  "./fixtures/codex-app-server/proposal-capability/workspace-write-on-request-5bed644.json",
  import.meta.url
);

async function fixture(url = READ_ONLY_FIXTURE): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(url, "utf8")) as Record<string, unknown>;
}

test("pinned source-review claims identify only a blocked conditional path", async () => {
  const result = evaluateCodexAppServerProposalCapabilityEvidence(await fixture());

  assert.equal(result.status, "blocked");
  assert.equal(result.disposition, "source_review_conditional_path_only");
  assert.equal(result.sourceReviewConditionalPathIdentified, true);
  assert.equal(result.runtimeConfigurationBound, false);
  assert.equal(result.delayedApplyProtocolProven, false);
  assert.equal(result.liveSmokeEligible, false);
  assert.equal(result.existingLiveSmokePreflightMayBeRelaxed, false);
  assert.deepEqual(result.reasons, [
    "delayed_apply_protocol_not_proven",
    "runtime_configuration_not_bound",
    "source_evidence_is_review_claims_only",
    "independent_security_review_required"
  ]);
  assert.deepEqual(result.evaluationSideEffects, {
    transportConstructed: false,
    liveServerStarted: false,
    liveClientConnected: false,
    workspaceWriteAttempted: false,
    commandActivityObserved: false,
    networkActivityObserved: false,
    externalToolActivityObserved: false
  });
});

test("workspace-write on-request evidence remains no-go", async () => {
  const result = evaluateCodexAppServerProposalCapabilityEvidence(
    await fixture(WORKSPACE_WRITE_FIXTURE)
  );

  assert.equal(result.status, "blocked");
  assert.equal(result.disposition, "no_go");
  assert.equal(result.sourceReviewConditionalPathIdentified, false);
  assert.equal(result.liveSmokeEligible, false);
  assert.ok(result.reasons.includes("sandbox_mode_not_read_only"));
  assert.ok(result.reasons.includes("writable_roots_not_empty"));
  assert.ok(result.reasons.includes("patch_safety_does_not_require_user"));
  assert.ok(result.reasons.includes("approval_before_runtime_not_proven"));
});

test("source-review path blocks every known approval bypass", async () => {
  for (const [field, value, reason] of [
    ["approvalsReviewer", "auto-review", "approval_reviewer_not_user"],
    ["permissionProfileKind", "external", "permission_profile_not_managed"],
    ["sessionOrTurnWriteGrantsPresent", true, "preexisting_write_grants_present"],
    ["cachedPatchApprovalPresent", true, "cached_patch_approval_present"],
    ["permissionsPreapproved", true, "patch_permissions_preapproved"],
    ["permissionRequestHooksConfigured", true, "permission_hook_may_bypass_client_decline"],
    ["allToolHooksDisabled", false, "tool_hooks_may_mutate_or_add_side_effects"],
    ["strictAutoReviewEnabled", true, "automatic_approval_reviewer_enabled"],
    ["approvalStoreEmpty", false, "approval_store_not_empty"],
    ["freshIsolatedSessionAndThread", false, "session_or_thread_not_fresh_and_isolated"],
    ["targetPathsResolved", false, "target_paths_not_resolved"],
    ["effectivePatchPermissionsResolved", false, "effective_patch_permissions_not_resolved"],
    ["executionEnvironment", "remote", "execution_environment_not_native_local"],
    ["declineStopsBeforeRuntime", false, "decline_before_runtime_not_proven"]
  ] as const) {
    const input = await fixture();
    const facts = input.facts as Record<string, unknown>;
    facts[field] = value;
    const result = evaluateCodexAppServerProposalCapabilityEvidence(input);
    assert.equal(result.disposition, "no_go", field);
    assert.ok(result.reasons.includes(reason), field);
  }
});

test("evidence cannot claim live actions or relax the existing preflight", async () => {
  for (const field of [
    "transportConstructed",
    "liveServerStarted",
    "liveClientConnected",
    "workspaceWriteAttempted",
    "commandActivityObserved",
    "networkActivityObserved",
    "externalToolActivityObserved"
  ]) {
    const input = await fixture();
    const facts = input.facts as Record<string, unknown>;
    facts[field] = true;
    const result = evaluateCodexAppServerProposalCapabilityEvidence(input);
    assert.equal(result.status, "blocked", field);
    assert.equal(result.liveSmokeEligible, false);
    assert.equal(result.existingLiveSmokePreflightMayBeRelaxed, false);
    assert.ok(result.reasons.includes("offline_evidence_contains_live_side_effects"));
  }
});

test("schema drift, source drift, extra keys, accessors, and proxies fail closed", async () => {
  const extra = await fixture();
  extra.untrusted = true;
  assert.equal(evaluateCodexAppServerProposalCapabilityEvidence(extra).status, "blocked");

  const sourceDrift = await fixture();
  (sourceDrift.source as Record<string, unknown>).commit = "0".repeat(40);
  assert.equal(evaluateCodexAppServerProposalCapabilityEvidence(sourceDrift).status, "blocked");

  for (const field of ["exactEffectiveConfigurationBound", "sourceEvidenceMechanicallyVerified"]) {
    const unsupportedProofClaim = await fixture();
    (unsupportedProofClaim.facts as Record<string, unknown>)[field] = true;
    const result = evaluateCodexAppServerProposalCapabilityEvidence(unsupportedProofClaim);
    assert.equal(result.disposition, "no_go", field);
    assert.ok(result.reasons.includes("proposal_capability_evidence_invalid"), field);
  }

  let getterRead = false;
  const accessor = Object.defineProperty({}, "schemaVersion", {
    enumerable: true,
    get() {
      getterRead = true;
      return "codex-app-server-proposal-capability-evidence.v1";
    }
  });
  assert.equal(evaluateCodexAppServerProposalCapabilityEvidence(accessor).status, "blocked");
  assert.equal(getterRead, false);

  const proxy = new Proxy({}, {
    ownKeys() {
      throw new Error("no reflection");
    }
  });
  assert.doesNotThrow(() => evaluateCodexAppServerProposalCapabilityEvidence(proxy));
  assert.equal(evaluateCodexAppServerProposalCapabilityEvidence(proxy).status, "blocked");
});

test("offline audit command reports blocked conditional path without constructing a transport", () => {
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", "scripts/run-codex-app-server-proposal-capability-audit.ts"],
    { cwd: process.cwd(), encoding: "utf8" }
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  const output = JSON.parse(result.stdout) as {
    status: string;
    liveSmokeEligible: boolean;
    evaluationSideEffects: Record<string, boolean>;
  };
  assert.equal(output.status, "blocked");
  assert.equal(output.liveSmokeEligible, false);
  assert.deepEqual(output.evaluationSideEffects, {
    transportConstructed: false,
    liveServerStarted: false,
    liveClientConnected: false,
    workspaceWriteAttempted: false,
    commandActivityObserved: false,
    networkActivityObserved: false,
    externalToolActivityObserved: false
  });
});
