import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  formatFormalReadonlyDispatchBoundaryLocalCloseoutAuditResult,
  reviewFormalReadonlyDispatchBoundaryLocalCloseoutAudit,
  type FormalReadonlyDispatchBoundaryLocalCloseoutAuditInput
} from "../scripts/run-formal-readonly-dispatch-boundary-local-closeout-audit.js";

const forbiddenOutputMarkers = [
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
  "Bearer"
];

test("formal read-only dispatch boundary local closeout audit passes for PR-16A state", async () => {
  const review = reviewFormalReadonlyDispatchBoundaryLocalCloseoutAudit(
    await createInputFromWorkspace()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.deepEqual(review.checks, {
    worktreeClean: true,
    branchMain: true,
    packageScriptsPresent: true,
    formalWrapperPresent: true,
    formalWrapperRequiresRegistry: true,
    formalWrapperRequiresMetadata: true,
    pr16aBoundaryRecorded: true,
    pr16bCloseoutRecorded: true,
    boundaryEvidencePassed: true,
    registrySelectionProved: true,
    permitIssued: true,
    fakeSpawnerOnly: true,
    guardMismatchBlocked: true,
    writeAccessBlocked: true,
    noRealCodexCli: true,
    noWorkspaceWriteExecute: true,
    noLocalCommandExecute: true,
    noProtectedRemoteExecute: true,
    evidenceSanitized: true,
    closeoutNonAuthorizing: true
  });
  assert.equal(review.summary.packageScriptTargetCount, 1);
  assert.equal(review.summary.packageScriptMismatchCount, 0);
  assert.equal(review.summary.providerId, "codex-cli");
  assert.equal(review.summary.sideEffectClass, "read_only");
  assert.equal(review.summary.sandbox, "read-only");
  assert.equal(review.summary.status, "completed");
  assert.equal(review.summary.formalDispatchCalls, 1);
  assert.equal(review.summary.fakeSpawnerCalls, 1);
  assert.equal(review.summary.realCodexCliCalls, 0);
  assert.equal(review.summary.workspaceWriteExecuteCalls, 0);
  assert.equal(review.summary.localCommandExecuteCalls, 0);
  assert.equal(review.summary.protectedRemoteExecuteCalls, 0);
});

test("formal read-only dispatch boundary local closeout audit blocks stale or broadened state", async () => {
  const input = await createInputFromWorkspace();
  const evidence = JSON.parse(input.boundaryEvidenceText);
  evidence.checks.formalWrapperRequiresRegistry = false;
  evidence.checks.noRealCodexCli = false;
  evidence.counters.successSpawnCalls = 2;
  evidence.counters.realCodexCliCalls = 1;
  evidence.summary.realCodexCliCalls = 1;

  const review = reviewFormalReadonlyDispatchBoundaryLocalCloseoutAudit({
    ...input,
    gitStatusShort: " M package.json\n",
    branch: "feature",
    packageJsonText: JSON.stringify({ scripts: {} }),
    hostDispatcherSourceText: input.hostDispatcherSourceText.replace(
      "host_dispatcher_formal_read_only_provider_registry_required",
      "removed"
    ),
    boundaryEvidenceText: JSON.stringify(evidence)
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes(
    "formal_readonly_dispatch_boundary_local_closeout_worktreeClean"
  ));
  assert.ok(review.reasons.includes(
    "formal_readonly_dispatch_boundary_local_closeout_branchMain"
  ));
  assert.ok(review.reasons.includes(
    "formal_readonly_dispatch_boundary_local_closeout_packageScriptsPresent"
  ));
  assert.ok(review.reasons.includes(
    "formal_readonly_dispatch_boundary_local_closeout_formalWrapperRequiresRegistry"
  ));
  assert.ok(review.reasons.includes(
    "formal_readonly_dispatch_boundary_local_closeout_boundaryEvidencePassed"
  ));
  assert.ok(review.reasons.includes(
    "formal_readonly_dispatch_boundary_local_closeout_fakeSpawnerOnly"
  ));
  assert.ok(review.reasons.includes(
    "formal_readonly_dispatch_boundary_local_closeout_noRealCodexCli"
  ));
  assert.equal(review.summary.realCodexCliCalls, 1);
});

test("formal read-only dispatch boundary local closeout audit output stays summarized", async () => {
  const review = reviewFormalReadonlyDispatchBoundaryLocalCloseoutAudit(
    await createInputFromWorkspace()
  );
  const text = formatFormalReadonlyDispatchBoundaryLocalCloseoutAuditResult(review);
  const json = formatFormalReadonlyDispatchBoundaryLocalCloseoutAuditResult(
    review,
    "json"
  );
  const parsed = JSON.parse(json) as typeof review;

  assert.match(text, /status: passed/);
  assert.match(text, /fake spawner calls: 1/);
  assert.match(text, /real CLI calls: 0/);
  assert.equal(parsed.status, "passed");
  assert.equal(parsed.summary.fakeSpawnerCalls, 1);
  assert.equal(parsed.summary.realCodexCliCalls, 0);
  assert.equal(parsed.summary.workspaceWriteExecuteCalls, 0);

  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false, `text output must omit ${marker}`);
    assert.equal(json.includes(marker), false, `json output must omit ${marker}`);
  }
});

async function createInputFromWorkspace(
  overrides: Partial<FormalReadonlyDispatchBoundaryLocalCloseoutAuditInput> = {}
): Promise<FormalReadonlyDispatchBoundaryLocalCloseoutAuditInput> {
  const [
    packageJsonText,
    hostDispatcherSourceText,
    pr16aBoundaryText,
    boundaryEvidenceText
  ] = await Promise.all([
    readFile("package.json", "utf8"),
    readFile("packages/host-dispatcher/src/index.ts", "utf8"),
    readFile("docs/governance/PR_16A_FORMAL_READONLY_DISPATCH_BOUNDARY.md", "utf8"),
    readFile(
      "docs/evidence/codex-cli-formal-readonly-dispatch-boundary-acceptance.json",
      "utf8"
    )
  ]);

  return {
    gitStatusShort: "",
    branch: "main",
    packageJsonText,
    hostDispatcherSourceText,
    pr16aBoundaryText,
    pr16bCloseoutText: createCloseoutDocumentText(),
    boundaryEvidenceText,
    ...overrides
  };
}

function createCloseoutDocumentText(): string {
  return [
    "PR_16B_FORMAL_READONLY_DISPATCH_BOUNDARY_LOCAL_CLOSEOUT_COMPLETE",
    "npm run governance -- audit formal-readonly-dispatch-boundary-local",
    "npm run governance -- audit formal-readonly-dispatch-boundary-local -- --json",
    "docs/evidence/codex-cli-formal-readonly-dispatch-boundary-acceptance.json",
    "does not authorize real Codex CLI invocation",
    "does not authorize workspace-write",
    "does not authorize local command",
    "does not authorize protected remote",
    "does not authorize push, release, or tag"
  ].join("\n");
}
