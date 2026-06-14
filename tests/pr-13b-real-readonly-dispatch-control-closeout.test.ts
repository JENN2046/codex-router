import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const closeoutPath = "docs/governance/PR_13B_REAL_READONLY_DISPATCH_CONTROL_LOCAL_CLOSEOUT.md";
const evidencePath = "docs/evidence/codex-cli-real-readonly-dispatch-acceptance.json";

test("PR-13B real read-only dispatch control closeout records the injected spawner gate", async () => {
  const [closeout, evidenceRaw] = await Promise.all([
    readFile(closeoutPath, "utf8"),
    readFile(evidencePath, "utf8")
  ]);
  const evidence = JSON.parse(evidenceRaw) as {
    checks: Record<string, unknown>;
    counters: Record<string, unknown>;
  };

  assert.match(closeout, /PR_13B_REAL_READONLY_DISPATCH_CONTROL_LOCAL_CLOSEOUT_COMPLETE/);
  assert.match(closeout, /environmentPreflight\.checks\.injectedSpawner === true/);
  assert.match(closeout, /codex_cli_provider_real_execute_preflight_requires_injected_spawner/);
  assert.equal(evidence.checks.injectedSpawnerGuarded, true);
  assert.equal(evidence.checks.noRealCodexCli, true);
  assert.equal(evidence.counters.successSpawnCalls, 1);
});

test("PR-13B real read-only dispatch control closeout remains non-authorizing", async () => {
  const closeout = await readFile(closeoutPath, "utf8");
  const normalized = closeout.replace(/\s+/g, " ");

  for (const phrase of [
    "not a push receipt",
    "workspace-write approval",
    "authorization to invoke a real Codex CLI process",
    "does not authorize that stage"
  ]) {
    assert.match(normalized, new RegExp(escapeRegExp(phrase)));
  }
});

test("PR-13B real read-only dispatch control evidence omits raw execution surfaces", async () => {
  const evidenceRaw = await readFile(evidencePath, "utf8");
  const evidence = JSON.parse(evidenceRaw);
  const serializedEvidence = JSON.stringify(evidence);

  for (const marker of [
    "requestedAction",
    "args",
    "stdout",
    "stderr",
    "raw command",
    "raw task envelope",
    "raw environment",
    "raw token",
    "raw patch",
    "OPENAI_API_KEY",
    "sk-",
    "Bearer"
  ]) {
    assert.equal(serializedEvidence.includes(marker), false, marker);
  }
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
