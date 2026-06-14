import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  reviewFormalReadonlyCliIntegrationReadiness,
  writeFormalReadonlyCliIntegrationReadinessEvidence,
  type FormalReadonlyCliIntegrationReadinessEvidence,
  type FormalReadonlyCliIntegrationReadinessInput
} from "../scripts/run-formal-readonly-cli-integration-readiness.js";

const now = "2026-06-15T00:00:00.000Z";
const forbiddenMarkers = [
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

test("formal read-only CLI integration readiness passes with local preflight evidence", async () => {
  const evidence = reviewFormalReadonlyCliIntegrationReadiness(
    await createInputFromWorkspace(),
    { generatedAt: now }
  );

  assert.equal(
    evidence.schemaVersion,
    "codex-cli-formal-readonly-integration-readiness.v1"
  );
  assert.equal(evidence.generatedAt, now);
  assert.equal(evidence.mode, "formal-readonly-integration-readiness-local-only");
  assert.equal(evidence.status, "passed");
  assert.deepEqual(evidence.blockingReasons, []);
  assert.deepEqual(evidence.checks, {
    packageScriptsPresent: true,
    pr13aSmokePassed: true,
    pr13aAuthorizationLocalOnly: true,
    pr13bDispatchControlRecorded: true,
    dispatchEvidenceGuarded: true,
    providerRequiresInjectedSpawner: true,
    providerDefaultExecuteDisabled: true,
    pr14aPreflightRecorded: true,
    noProviderExecute: true,
    noRealCodexCli: true,
    noWorkspaceWriteExecute: true,
    evidenceSanitized: true
  });
  assert.equal(
    evidence.summary.readiness,
    "formal_readonly_integration_preflight_ready"
  );
  assert.equal(evidence.summary.injectedSpawnerRequired, true);
  assert.equal(evidence.summary.permitRequired, true);
  assert.equal(evidence.summary.registrySelectionRequired, true);
  assert.equal(evidence.summary.workspaceWriteAllowed, false);
  assert.equal(evidence.summary.formalIntegrationAuthorized, false);
  assert.equal(evidence.summary.providerExecuteCalls, 0);
  assert.equal(evidence.summary.realCodexCliCalls, 0);
  assert.equal(evidence.summary.workspaceWriteExecuteCalls, 0);
  assertSafeEvidence(evidence);
});

test("formal read-only CLI integration readiness blocks stale guard evidence", async () => {
  const input = await createInputFromWorkspace();
  const dispatchEvidence = JSON.parse(input.dispatchEvidenceText);
  dispatchEvidence.checks.injectedSpawnerGuarded = false;

  const evidence = reviewFormalReadonlyCliIntegrationReadiness({
    ...input,
    dispatchEvidenceText: JSON.stringify(dispatchEvidence)
  });

  assert.equal(evidence.status, "blocked");
  assert.equal(evidence.checks.dispatchEvidenceGuarded, false);
  assert.ok(evidence.blockingReasons.includes(
    "formal_readonly_integration_readiness_dispatchEvidenceGuarded"
  ));
  assert.equal(evidence.summary.realCodexCliCalls, 0);
  assert.equal(evidence.summary.workspaceWriteExecuteCalls, 0);
});

test("formal read-only CLI integration readiness blocks broadened provider source", async () => {
  const input = await createInputFromWorkspace();
  const evidence = reviewFormalReadonlyCliIntegrationReadiness({
    ...input,
    providerSourceText: input.providerSourceText.replace(
      "codex_cli_provider_real_execute_preflight_requires_injected_spawner",
      "codex_cli_provider_real_execute_preflight_guard_removed"
    )
  });

  assert.equal(evidence.status, "blocked");
  assert.equal(evidence.checks.providerRequiresInjectedSpawner, false);
  assert.ok(evidence.blockingReasons.includes(
    "formal_readonly_integration_readiness_providerRequiresInjectedSpawner"
  ));
  assertSafeEvidence(evidence);
});

test("formal read-only CLI integration readiness writer persists sanitized json", async () => {
  const dir = await mkdtemp(join(tmpdir(), "formal-readonly-integration-"));
  const evidencePath = join(dir, "evidence.json");
  const evidence = reviewFormalReadonlyCliIntegrationReadiness(
    await createInputFromWorkspace(),
    { generatedAt: now }
  );

  await writeFormalReadonlyCliIntegrationReadinessEvidence(evidence, evidencePath);

  const raw = await readFile(evidencePath, "utf8");
  const parsed = JSON.parse(raw) as FormalReadonlyCliIntegrationReadinessEvidence;

  assert.equal(parsed.status, "passed");
  assert.equal(parsed.checks.noRealCodexCli, true);
  assert.equal(parsed.checks.noWorkspaceWriteExecute, true);
  assert.equal(parsed.summary.formalIntegrationAuthorized, false);
  assertSafeEvidence(parsed);
});

async function createInputFromWorkspace(): Promise<FormalReadonlyCliIntegrationReadinessInput> {
  const [
    packageJsonText,
    providerSourceText,
    dispatchEvidenceText,
    smokeEvidenceText,
    smokeAuthorizationEvidenceText,
    pr13bCloseoutText,
    pr14aPreflightText
  ] = await Promise.all([
    readFile("package.json", "utf8"),
    readFile("packages/providers/codex-cli/src/index.ts", "utf8"),
    readFile("docs/evidence/codex-cli-real-readonly-dispatch-acceptance.json", "utf8"),
    readFile("docs/evidence/codex-cli-real-readonly-smoke.json", "utf8"),
    readFile(
      "docs/evidence/codex-cli-real-readonly-smoke-authorization-acceptance.json",
      "utf8"
    ),
    readFile("docs/governance/PR_13B_REAL_READONLY_DISPATCH_CONTROL_LOCAL_CLOSEOUT.md", "utf8"),
    readFile("docs/governance/PR_14A_FORMAL_READONLY_CLI_INTEGRATION_PREFLIGHT.md", "utf8")
  ]);

  return {
    packageJsonText,
    providerSourceText,
    dispatchEvidenceText,
    smokeEvidenceText,
    smokeAuthorizationEvidenceText,
    pr13bCloseoutText,
    pr14aPreflightText
  };
}

function assertSafeEvidence(
  evidence: FormalReadonlyCliIntegrationReadinessEvidence
): void {
  const serialized = JSON.stringify(evidence);

  for (const marker of forbiddenMarkers) {
    assert.equal(
      serialized.includes(marker),
      false,
      `evidence must omit ${marker}`
    );
  }
}
