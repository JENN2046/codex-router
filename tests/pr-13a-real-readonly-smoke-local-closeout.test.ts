import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const closeoutPath = "docs/governance/PR_13A_REAL_READONLY_SMOKE_LOCAL_CLOSEOUT.md";
const receiptPath = "docs/governance/PR_13A_REAL_READONLY_SMOKE_RECEIPT.md";
const evidencePath = "docs/evidence/codex-cli-real-readonly-smoke.json";

test("PR-13A real read-only smoke local closeout records the default evidence path and passed receipt", async () => {
  const [closeout, receipt, evidenceText] = await Promise.all([
    readFile(closeoutPath, "utf8"),
    readFile(receiptPath, "utf8"),
    readFile(evidencePath, "utf8")
  ]);
  const evidence = JSON.parse(evidenceText) as {
    schemaVersion?: string;
    mode?: string;
    status?: string;
    checks?: Record<string, unknown>;
    plan?: Record<string, unknown>;
    run?: Record<string, unknown>;
  };

  assert.match(closeout, /PR_13A_REAL_READONLY_SMOKE_LOCAL_CLOSEOUT_COMPLETE/);
  assert.match(closeout, /docs\/evidence\/codex-cli-real-readonly-smoke\.json/);
  assert.match(closeout, /PR_13A_REAL_READONLY_SMOKE_PASSED/);
  assert.match(receipt, /Operator selected evidence path:\s+- `default`/);
  assert.match(receipt, /PR_13A_REAL_READONLY_SMOKE_PASSED/);
  assert.equal(evidence.schemaVersion, "codex-cli-real-readonly-smoke-gate.v1");
  assert.equal(evidence.mode, "real-readonly-smoke");
  assert.equal(evidence.status, "passed");
  assert.equal(evidence.checks?.operatorFlagPresent, true);
  assert.equal(evidence.checks?.runnerInvoked, true);
  assert.equal(evidence.checks?.readOnlySandbox, true);
  assert.equal(evidence.checks?.approvalPolicyNever, true);
  assert.equal(evidence.checks?.noWorkspaceWrite, true);
  assert.equal(evidence.checks?.noFileWrite, true);
  assert.equal(evidence.checks?.sanitizedEvidence, true);
  assert.equal(evidence.plan?.sandbox, "read-only");
  assert.equal(evidence.plan?.approvalPolicy, "never");
  assert.equal(evidence.run?.exitCode, 0);
  assert.equal(evidence.run?.status, "completed");
  assert.equal(evidence.run?.timedOut, false);
  assert.equal(evidence.run?.killed, false);
});

test("PR-13A real read-only smoke local closeout remains non-authorizing", async () => {
  const closeout = await readFile(closeoutPath, "utf8");

  assert.match(closeout, /workspace-write\s+approval/);
  assert.match(closeout, /authorization for broader real\s+provider execution/);

  for (const requiredText of [
    "It is not a push-readiness receipt",
    "workspace-write execute",
    "workspace-write canary write",
    "local command enablement",
    "protected remote enablement",
    "broad real provider execution",
    "push",
    "release",
    "tag",
    "publish",
    "WORKSPACE_WRITE_READY: no",
    "RELEASE_READY: no",
    "PUSH_READY: not evaluated by this closeout"
  ]) {
    assert.ok(
      closeout.includes(requiredText),
      `expected closeout to include ${requiredText}`
    );
  }
});

test("PR-13A real read-only smoke local closeout and evidence omit raw execution surfaces", async () => {
  const [closeout, receipt, evidenceText] = await Promise.all([
    readFile(closeoutPath, "utf8"),
    readFile(receiptPath, "utf8"),
    readFile(evidencePath, "utf8")
  ]);

  for (const marker of [
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
  ]) {
    assert.equal(evidenceText.includes(marker), false, marker);
  }

  assert.match(closeout, /The default smoke evidence and the smoke receipt must remain summarized and\s+sanitized\./);
  assert.match(receipt, /Sensitive marker search over the real smoke evidence returned no hits/);
});
