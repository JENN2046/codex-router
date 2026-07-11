import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import {
  DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE,
  PR_12B_REAL_CANARY_AUTHORIZATION_PHRASE
} from "../packages/governance-internal-workspace-write-guard/src/index.js";
import {
  runWorkspaceWriteRealCanaryLocalExecution,
  writeWorkspaceWriteRealCanaryLocalExecutionEvidence
} from "../scripts/run-workspace-write-real-canary-local.js";

const execFileAsync = promisify(execFile);
const generatedAt = "2026-07-10T00:00:00.000Z";

test("workspace-write real canary local execution preflight is strong and non-writing", async () => {
  const cwd = await createGitRepo("canary/local-preflight");
  const evidence = await runWorkspaceWriteRealCanaryLocalExecution({
    cwd,
    generatedAt,
    authorizationPhrase: PR_12B_REAL_CANARY_AUTHORIZATION_PHRASE
  });

  assert.equal(evidence.status, "ready");
  assert.equal(evidence.checks.executeRequested, false);
  assert.equal(evidence.checks.exactAuthorizationMatched, true);
  assert.equal(evidence.checks.branchNonProtected, true);
  assert.equal(evidence.checks.worktreeCleanBefore, true);
  assert.equal(evidence.checks.preExecutionGateReady, true);
  assert.equal(evidence.counters.workspaceWriteExecuteCalls, 0);
  assert.equal(evidence.counters.canaryFileWrites, 0);
  assert.equal(existsSync(join(cwd, DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE)), false);
  assertSafeEvidence(evidence);
});

test("workspace-write real canary local execution writes exactly one target and rolls back", async () => {
  const cwd = await createGitRepo("canary/local-execute");
  const evidence = await runWorkspaceWriteRealCanaryLocalExecution({
    cwd,
    execute: true,
    generatedAt,
    authorizationPhrase: PR_12B_REAL_CANARY_AUTHORIZATION_PHRASE
  });
  const targetPath = join(cwd, DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE);
  const targetStatus = await git(["status", "--short", "--", DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE], cwd);

  assert.equal(evidence.status, "passed");
  assert.equal(evidence.checks.permitConsumed, true);
  assert.equal(evidence.checks.wroteOnlyCanaryTarget, true);
  assert.equal(evidence.checks.postWritePatchGuardPassed, true);
  assert.equal(evidence.checks.rollbackAttempted, true);
  assert.equal(evidence.checks.rollbackVerified, true);
  assert.equal(evidence.checks.targetAbsentAfterRollback, true);
  assert.equal(evidence.checks.targetWorktreeCleanAfterRollback, true);
  assert.equal(evidence.checks.noProviderExecute, true);
  assert.equal(evidence.checks.noRealCodexCli, true);
  assert.equal(evidence.checks.noRemoteWrite, true);
  assert.equal(evidence.counters.workspaceWriteExecuteCalls, 1);
  assert.equal(evidence.counters.canaryFileWrites, 1);
  assert.equal(evidence.summary.beforeCommit, evidence.summary.afterCommit);
  assert.equal(evidence.summary.targetFile, DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE);
  assert.equal(evidence.summary.changedFileCount, 1);
  assert.equal(evidence.summary.diffLineCount, 1);
  assert.match(evidence.summary.contentHash ?? "", /^[a-f0-9]{64}$/);
  assert.match(evidence.summary.postWritePatchHash ?? "", /^[a-f0-9]{64}$/);
  assert.equal(existsSync(targetPath), false);
  assert.equal(existsSync(join(cwd, "tmp")), false);
  assert.equal(targetStatus.trim(), "");
  assertSafeEvidence(evidence);
});

test("workspace-write real canary local execution blocks protected branches before writing", async () => {
  const cwd = await createGitRepo("main");
  const evidence = await runWorkspaceWriteRealCanaryLocalExecution({
    cwd,
    execute: true,
    generatedAt,
    authorizationPhrase: PR_12B_REAL_CANARY_AUTHORIZATION_PHRASE
  });

  assert.equal(evidence.status, "blocked");
  assert.equal(evidence.checks.branchNonProtected, false);
  assert.equal(evidence.counters.workspaceWriteExecuteCalls, 0);
  assert.equal(evidence.counters.canaryFileWrites, 0);
  assert.ok(evidence.reasons.includes("workspace_write_real_canary_non_protected_branch_required"));
  assert.equal(existsSync(join(cwd, DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE)), false);
  assertSafeEvidence(evidence);
});

test("workspace-write real canary local execution blocks dirty worktrees and existing targets", async () => {
  const cwd = await createGitRepo("canary/local-dirty");
  const targetPath = join(cwd, DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE);
  await mkdir(join(cwd, "tmp"), { recursive: true });
  await writeFile(targetPath, "preexisting\n", "utf8");

  const evidence = await runWorkspaceWriteRealCanaryLocalExecution({
    cwd,
    execute: true,
    generatedAt,
    authorizationPhrase: PR_12B_REAL_CANARY_AUTHORIZATION_PHRASE
  });

  assert.equal(evidence.status, "blocked");
  assert.equal(evidence.checks.worktreeCleanBefore, false);
  assert.equal(evidence.checks.targetAbsentBefore, false);
  assert.equal(evidence.counters.workspaceWriteExecuteCalls, 0);
  assert.equal(evidence.counters.canaryFileWrites, 0);
  assert.ok(evidence.reasons.includes("workspace_write_real_canary_clean_worktree_required"));
  assert.ok(evidence.reasons.includes("workspace_write_real_canary_target_must_be_absent"));
  assert.equal(await readFile(targetPath, "utf8"), "preexisting\n");
  assertSafeEvidence(evidence);
});

test("workspace-write real canary local execution blocks symlinked parents before writing", async () => {
  const cwd = await createGitRepo("canary/local-symlink-parent");
  const outsideDir = await mkdtemp(join(tmpdir(), "workspace-write-real-canary-outside-"));
  await symlink(outsideDir, join(cwd, "tmp"), "dir");
  await git(["add", "tmp"], cwd);
  await git(["commit", "-m", "add symlinked canary parent"], cwd);
  assert.equal((await git(["status", "--short"], cwd)).trim(), "");

  const evidence = await runWorkspaceWriteRealCanaryLocalExecution({
    cwd,
    execute: true,
    generatedAt,
    authorizationPhrase: PR_12B_REAL_CANARY_AUTHORIZATION_PHRASE
  });

  assert.equal(evidence.status, "blocked");
  assert.equal(evidence.checks.permitConsumed, false);
  assert.equal(evidence.counters.workspaceWriteExecuteCalls, 0);
  assert.equal(evidence.counters.canaryFileWrites, 0);
  assert.ok(evidence.reasons.includes(
    `workspace_write_real_canary_symlink_target_forbidden:${DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE}`
  ));
  assert.equal(existsSync(join(outsideDir, "codex-cli-write-canary.txt")), false);
  assert.equal((await git(["status", "--short"], cwd)).trim(), "");
  assertSafeEvidence(evidence);
});

test("workspace-write real canary local execution writer persists sanitized evidence", async () => {
  const cwd = await createGitRepo("canary/local-evidence");
  const outDir = await mkdtemp(join(tmpdir(), "workspace-write-real-canary-evidence-"));
  const evidencePath = join(outDir, "evidence.json");
  const evidence = await runWorkspaceWriteRealCanaryLocalExecution({
    cwd,
    execute: true,
    generatedAt,
    authorizationPhrase: PR_12B_REAL_CANARY_AUTHORIZATION_PHRASE
  });

  await writeWorkspaceWriteRealCanaryLocalExecutionEvidence(evidence, evidencePath);
  const raw = await readFile(evidencePath, "utf8");
  const parsed = JSON.parse(raw) as typeof evidence;

  assert.equal(parsed.schemaVersion, "workspace-write-real-canary-local-execution.v1");
  assert.equal(parsed.status, "passed");
  assert.equal(parsed.checks.rollbackVerified, true);
  assertSafeEvidence(parsed);
});

async function createGitRepo(branch: string): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), "workspace-write-real-canary-local-"));
  await git(["init"], cwd);
  await git(["config", "user.email", "canary@example.invalid"], cwd);
  await git(["config", "user.name", "Canary Test"], cwd);
  await writeFile(join(cwd, "README.md"), "fixture\n", "utf8");
  await git(["add", "README.md"], cwd);
  await git(["commit", "-m", "initial"], cwd);
  await git(["branch", "-M", "main"], cwd);
  if (branch !== "main") {
    await git(["switch", "-c", branch], cwd);
  }
  return cwd;
}

async function git(args: string[], cwd: string): Promise<string> {
  const { stdout } = await execFileAsync("git", args, {
    cwd,
    encoding: "utf8",
    windowsHide: true
  });
  return stdout;
}

function assertSafeEvidence(value: unknown): void {
  const serialized = JSON.stringify(value);
  for (const marker of [
    PR_12B_REAL_CANARY_AUTHORIZATION_PHRASE,
    "canary=ready",
    "stdout",
    "stderr",
    "raw command",
    "raw env",
    "raw patch",
    "OPENAI_API_KEY",
    "sk-",
    "Bearer"
  ]) {
    assert.equal(serialized.includes(marker), false, `evidence must omit ${marker}`);
  }
}
