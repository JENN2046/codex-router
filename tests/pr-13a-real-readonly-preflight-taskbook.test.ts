import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const taskbookPath = "docs/governance/PR_13A_READONLY_REAL_CLI_PREFLIGHT_TASKBOOK.md";
const realReadonlySmokeEvidencePath = "docs/evidence/codex-cli-real-readonly-smoke.json";

test("PR-13A real read-only preflight taskbook keeps the exact future authorization gate", async () => {
  const [taskbook, packageJsonText] = await Promise.all([
    readFile(taskbookPath, "utf8"),
    readFile("package.json", "utf8")
  ]);
  const packageJson = JSON.parse(packageJsonText) as {
    scripts?: Record<string, string>;
  };

  assert.match(taskbook, /APPROVE_REAL_CODEX_CLI_READONLY_SMOKE_PR_13A/);
  assert.match(
    taskbook,
    /ALLOW_REAL_CODEX_CLI_READONLY_SMOKE=1 npm run smoke:readonly:real/
  );
  assert.equal(
    packageJson.scripts?.["smoke:readonly:real"],
    "tsx scripts/run-codex-cli-real-readonly-smoke.ts"
  );
  assert.equal(
    packageJson.scripts?.["acceptance:real-readonly-smoke-auth"],
    "tsx scripts/run-real-readonly-smoke-authorization-acceptance.ts"
  );
});

test("PR-13A real read-only preflight taskbook remains non-authorizing and read-only", async () => {
  const taskbook = await readFile(taskbookPath, "utf8");

  for (const requiredText of [
    "This taskbook does not authorize:",
    "running `npm run smoke:readonly:real`",
    "setting `ALLOW_REAL_CODEX_CLI_READONLY_SMOKE=1`",
    "invoking the real Codex CLI",
    "opening workspace-write execute",
    "read-only sandbox only",
    "approval policy `never`",
    "no workspace-write",
    "no file writes",
    "no remote writes"
  ]) {
    assert.ok(
      taskbook.includes(requiredText),
      `expected PR-13A taskbook to include ${requiredText}`
    );
  }
});

test("PR-13A real read-only preflight taskbook preserves the required fresh local preflight", async () => {
  const taskbook = await readFile(taskbookPath, "utf8");

  for (const command of [
    "`git status --short`",
    "`git branch -vv`",
    "`git log --oneline -10`",
    "`npm run typecheck`",
    "`npx tsx --test tests\\codex-cli-real-readonly-smoke-script.test.ts`",
    "`npx tsx --test tests\\real-readonly-smoke-authorization-acceptance.test.ts`",
    "`npx tsx --test tests\\real-readonly-dispatch-acceptance.test.ts`",
    "`npx tsx --test tests\\host-dispatcher.test.ts`",
    "`npm run acceptance:real-readonly-smoke-auth`",
    "`npm run acceptance:real-readonly-dispatch`"
  ]) {
    assert.ok(taskbook.includes(command), `expected preflight command ${command}`);
  }

  for (const requiredResult of [
    "worktree clean",
    "branch `main`",
    "local branch not behind `origin/main`",
    "typecheck pass",
    "real-readonly smoke authorization acceptance pass",
    "no workspace-write gate opened",
    "no real Codex CLI call made during preflight"
  ]) {
    assert.ok(
      taskbook.includes(requiredResult),
      `expected preflight result ${requiredResult}`
    );
  }
});

test("PR-13A committed real read-only smoke evidence stays sanitized and read-only", async () => {
  const serialized = await readFile(realReadonlySmokeEvidencePath, "utf8");
  const evidence = JSON.parse(serialized) as {
    schemaVersion?: string;
    mode?: string;
    checks?: Record<string, unknown>;
    plan?: Record<string, unknown>;
    run?: Record<string, unknown>;
  };

  assert.equal(evidence.schemaVersion, "codex-cli-real-readonly-smoke-gate.v1");
  assert.equal(evidence.mode, "real-readonly-smoke");
  assert.equal(evidence.checks?.readOnlySandbox, true);
  assert.equal(evidence.checks?.approvalPolicyNever, true);
  assert.equal(evidence.checks?.noWorkspaceWrite, true);
  assert.equal(evidence.checks?.noFileWrite, true);
  assert.equal(evidence.checks?.timeoutConfigured, true);
  assert.equal(evidence.checks?.sanitizedEvidence, true);
  assert.equal(evidence.plan?.sandbox, "read-only");
  assert.equal(evidence.plan?.approvalPolicy, "never");
  assert.equal(evidence.plan?.usesJson, true);
  assert.equal(evidence.plan?.skipGitRepoCheck, true);
  assert.equal(evidence.plan?.ephemeral, true);
  assert.ok(Number.isInteger(evidence.run?.eventCount));
  assert.ok(Number.isInteger(evidence.run?.parseErrorCount));
  assert.ok(Number.isInteger(evidence.run?.warningCount));

  for (const forbidden of [
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
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
});
