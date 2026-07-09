import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { SandboxProfileSchema, type SandboxProfile } from "../packages/kernel-contracts/src/index.js";
import {
  InMemoryProviderExecutionPermitConsumptionStore,
  createApprovedWorkspaceWriteProviderExecutionPermitV2,
  ExecutorExecutionPlanSchema,
  hashProviderManifest,
  ProviderManifestSchema,
  type ExecutorExecutionPlan,
  type ProviderManifest,
  type WorkspaceWriteProviderExecutionPermitV2
} from "../packages/provider-core/src/index.js";
import {
  runWorkspaceWriteExecution,
  type WorkspaceWriteOperation
} from "../packages/governance-internal-workspace-write-executor/src/index.js";

const execFileAsync = promisify(execFile);
const now = "2026-07-10T00:00:00.000Z";
const authorizationId = "operator_auth_workspace_write_general_test";

test("workspace-write executor preflights generic multi-file writes without mutating", async () => {
  const cwd = await createGitRepo("workspace-write/general-preflight");
  const operations: WorkspaceWriteOperation[] = [
    { kind: "write", path: "tmp/general-a.txt", content: "alpha\n" },
    { kind: "write", path: "tmp/general-b.txt", content: "beta\n" }
  ];
  const fixture = await createWorkspaceWriteFixture(cwd, {
    targetFiles: ["tmp/general-a.txt", "tmp/general-b.txt"],
    maxChangedFiles: 2,
    maxDiffLines: 2
  });

  const result = await runWorkspaceWriteExecution({
    cwd,
    permit: fixture.permit,
    plan: fixture.plan,
    manifest: fixture.manifest,
    operations,
    executionAuthorizationId: authorizationId,
    now: clock()
  });

  assert.equal(result.status, "ready");
  assert.equal(result.checks.executeRequested, false);
  assert.equal(result.checks.executionAuthorizationMatched, true);
  assert.equal(result.checks.preExecutionPatchGuardPassed, true);
  assert.equal(result.checks.rollbackReady, true);
  assert.equal(result.counters.workspaceWriteExecuteCalls, 0);
  assert.equal(result.counters.fileWriteCalls, 0);
  assert.equal(existsSync(join(cwd, "tmp/general-a.txt")), false);
  assert.equal(existsSync(join(cwd, "tmp/general-b.txt")), false);
  assertSafeEvidence(result);
});

test("workspace-write executor executes multi-file writes and verifies rollback", async () => {
  const cwd = await createGitRepo("workspace-write/general-execute");
  const operations: WorkspaceWriteOperation[] = [
    { kind: "write", path: "tmp/general-a.txt", content: "alpha\n" },
    { kind: "write", path: "tmp/general-b.txt", content: "beta\n" }
  ];
  const fixture = await createWorkspaceWriteFixture(cwd, {
    targetFiles: ["tmp/general-a.txt", "tmp/general-b.txt"],
    maxChangedFiles: 2,
    maxDiffLines: 2
  });

  const result = await runWorkspaceWriteExecution({
    cwd,
    permit: fixture.permit,
    plan: fixture.plan,
    manifest: fixture.manifest,
    operations,
    executionAuthorizationId: authorizationId,
    execute: true,
    now: clock()
  });

  assert.equal(result.status, "passed");
  assert.equal(result.checks.permitConsumed, true);
  assert.equal(result.checks.wroteOnlyPermittedTargets, true);
  assert.equal(result.checks.postExecutionPatchGuardPassed, true);
  assert.equal(result.checks.rollbackAttempted, true);
  assert.equal(result.checks.rollbackVerified, true);
  assert.equal(result.counters.workspaceWriteExecuteCalls, 1);
  assert.equal(result.counters.fileWriteCalls, 2);
  assert.equal(result.counters.fileDeleteCalls, 0);
  assert.equal(result.summary.changedFileCount, 2);
  assert.equal(result.summary.diffLineCount, 2);
  assert.equal(existsSync(join(cwd, "tmp/general-a.txt")), false);
  assert.equal(existsSync(join(cwd, "tmp/general-b.txt")), false);
  assert.equal((await git(["status", "--short"], cwd)).trim(), "");
  assertSafeEvidence(result);
});

test("workspace-write executor supports update and delete operations with rollback", async () => {
  const cwd = await createGitRepo("workspace-write/general-update-delete", {
    "tmp/edit.txt": "old\n",
    "tmp/delete.txt": "remove\n"
  });
  const operations: WorkspaceWriteOperation[] = [
    { kind: "write", path: "tmp/edit.txt", content: "new\n" },
    { kind: "delete", path: "tmp/delete.txt" }
  ];
  const fixture = await createWorkspaceWriteFixture(cwd, {
    targetFiles: ["tmp/edit.txt", "tmp/delete.txt"],
    maxChangedFiles: 2,
    maxDiffLines: 3
  });

  const result = await runWorkspaceWriteExecution({
    cwd,
    permit: fixture.permit,
    plan: fixture.plan,
    manifest: fixture.manifest,
    operations,
    executionAuthorizationId: authorizationId,
    execute: true,
    now: clock()
  });

  assert.equal(result.status, "passed");
  assert.equal(result.counters.fileWriteCalls, 1);
  assert.equal(result.counters.fileDeleteCalls, 1);
  assert.equal(result.summary.changedFileCount, 2);
  assert.equal(result.summary.diffLineCount, 3);
  assert.equal(await readFile(join(cwd, "tmp/edit.txt"), "utf8"), "old\n");
  assert.equal(await readFile(join(cwd, "tmp/delete.txt"), "utf8"), "remove\n");
  assert.equal((await git(["status", "--short"], cwd)).trim(), "");
  assertSafeEvidence(result);
});

test("workspace-write executor blocks undeclared targets before writing", async () => {
  const cwd = await createGitRepo("workspace-write/general-undeclared");
  const fixture = await createWorkspaceWriteFixture(cwd, {
    targetFiles: ["tmp/allowed.txt"],
    maxChangedFiles: 1,
    maxDiffLines: 1
  });
  const result = await runWorkspaceWriteExecution({
    cwd,
    permit: fixture.permit,
    plan: fixture.plan,
    manifest: fixture.manifest,
    operations: [{ kind: "write", path: "tmp/not-allowed.txt", content: "denied-content\n" }],
    executionAuthorizationId: authorizationId,
    execute: true,
    now: clock()
  });

  assert.equal(result.status, "blocked");
  assert.equal(result.checks.operationTargetsDeclared, false);
  assert.equal(result.counters.workspaceWriteExecuteCalls, 0);
  assert.ok(result.reasons.includes("workspace_write_execution_operation_target_not_declared"));
  assert.equal(existsSync(join(cwd, "tmp/not-allowed.txt")), false);
  assertSafeEvidence(result);
});

test("workspace-write executor blocks missing authorization and dirty worktrees", async () => {
  const cwd = await createGitRepo("workspace-write/general-dirty");
  const fixture = await createWorkspaceWriteFixture(cwd, {
    targetFiles: ["tmp/allowed.txt"],
    maxChangedFiles: 1,
    maxDiffLines: 1
  });
  await writeFile(join(cwd, "README.md"), "dirty\n", "utf8");

  const result = await runWorkspaceWriteExecution({
    cwd,
    permit: fixture.permit,
    plan: fixture.plan,
    manifest: fixture.manifest,
    operations: [{ kind: "write", path: "tmp/allowed.txt", content: "dirty-content\n" }],
    execute: true,
    now: clock()
  });

  assert.equal(result.status, "blocked");
  assert.equal(result.checks.executionAuthorizationMatched, false);
  assert.equal(result.checks.worktreeCleanBefore, false);
  assert.equal(result.counters.workspaceWriteExecuteCalls, 0);
  assert.ok(result.reasons.includes("workspace_write_execution_authorization_id_required"));
  assert.ok(result.reasons.includes("workspace_write_execution_dirty_worktree_forbidden"));
  assert.equal(existsSync(join(cwd, "tmp/allowed.txt")), false);
  assertSafeEvidence(result);
});

test("workspace-write executor consumes permit once and blocks replay", async () => {
  const cwd = await createGitRepo("workspace-write/general-replay");
  const operations: WorkspaceWriteOperation[] = [
    { kind: "write", path: "tmp/replay.txt", content: "first\n" }
  ];
  const fixture = await createWorkspaceWriteFixture(cwd, {
    targetFiles: ["tmp/replay.txt"],
    maxChangedFiles: 1,
    maxDiffLines: 1
  });
  const consumptionStore = new InMemoryProviderExecutionPermitConsumptionStore();

  const first = await runWorkspaceWriteExecution({
    cwd,
    permit: fixture.permit,
    plan: fixture.plan,
    manifest: fixture.manifest,
    operations,
    executionAuthorizationId: authorizationId,
    execute: true,
    now: clock(),
    consumptionStore
  });
  const second = await runWorkspaceWriteExecution({
    cwd,
    permit: fixture.permit,
    plan: fixture.plan,
    manifest: fixture.manifest,
    operations,
    executionAuthorizationId: authorizationId,
    execute: true,
    now: clock(),
    consumptionStore
  });

  assert.equal(first.status, "passed");
  assert.equal(second.status, "blocked");
  assert.equal(second.checks.permitConsumed, false);
  assert.equal(second.counters.workspaceWriteExecuteCalls, 0);
  assert.ok(second.reasons.includes("workspace_write_execution_permit_v2_already_consumed_by_store"));
  assert.equal(existsSync(join(cwd, "tmp/replay.txt")), false);
  assertSafeEvidence(first);
  assertSafeEvidence(second);
});

async function createGitRepo(
  branch: string,
  files: Record<string, string> = {}
): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), "workspace-write-executor-"));
  await git(["init"], cwd);
  await git(["config", "user.email", "workspace-write@example.invalid"], cwd);
  await git(["config", "user.name", "Workspace Write Test"], cwd);
  await writeFile(join(cwd, "README.md"), "fixture\n", "utf8");
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(join(cwd, path)), { recursive: true });
    await writeFile(join(cwd, path), content, "utf8");
  }
  await git(["add", "."], cwd);
  await git(["commit", "-m", "initial"], cwd);
  await git(["branch", "-M", "main"], cwd);
  if (branch !== "main") {
    await git(["switch", "-c", branch], cwd);
  }
  return cwd;
}

async function createWorkspaceWriteFixture(
  cwd: string,
  options: {
    targetFiles: string[];
    maxChangedFiles: number;
    maxDiffLines: number;
    worktreeClean?: boolean;
  }
): Promise<{
  manifest: ProviderManifest;
  plan: ExecutorExecutionPlan;
  permit: WorkspaceWriteProviderExecutionPermitV2;
}> {
  const branch = (await git(["branch", "--show-current"], cwd)).trim();
  const headCommit = (await git(["rev-parse", "HEAD"], cwd)).trim();
  const manifest = createProviderManifest();
  const plan = createExecutorPlan(manifest, options.targetFiles);
  const permit = createApprovedWorkspaceWriteProviderExecutionPermitV2({
    plan,
    manifest,
    approvalStatus: "approved",
    operatorAuthorizationId: authorizationId,
    targetFiles: options.targetFiles,
    maxChangedFiles: options.maxChangedFiles,
    maxDiffLines: options.maxDiffLines,
    rollbackRequired: true,
    rollback: {
      beforeCommit: headCommit
    },
    protectedBranchForbidden: true,
    dirtyWorktreeForbidden: true,
    repositoryState: {
      branch,
      protectedBranch: false,
      worktreeClean: options.worktreeClean ?? true,
      headCommit
    },
    issuedAt: now
  });

  return { manifest, plan, permit };
}

function createProviderManifest(): ProviderManifest {
  return ProviderManifestSchema.parse({
    schemaVersion: "provider-manifest.v1",
    providerId: "local-workspace-write-executor",
    kind: "executor",
    displayName: "Local Workspace Write Executor",
    version: "0.1.0",
    capabilities: ["execution.plan"],
    requiredConfig: {
      keys: [],
      optionalKeys: []
    },
    securityBoundary: {
      isolation: "process",
      networkAccess: "none",
      filesystemAccess: "workspace-write",
      secretAccess: "none",
      notes: ["test fixture"]
    },
    supportedSandboxProfiles: [createSandboxProfile(["tmp"])],
    supportedSideEffectClasses: ["workspace_write"],
    metadata: {}
  });
}

function createExecutorPlan(
  manifest: ProviderManifest,
  targetFiles: string[]
): ExecutorExecutionPlan {
  return ExecutorExecutionPlanSchema.parse({
    schemaVersion: "executor-execution-plan.v1",
    kind: "executor",
    planId: "plan_workspace_write_general_test",
    runId: "run_workspace_write_general_test",
    taskId: "workspace-write-general-test",
    providerId: manifest.providerId,
    inputHash: "a".repeat(64),
    providerExecutionPlanHash: "b".repeat(64),
    providerManifestHash: hashProviderManifest(manifest),
    policyDecisionHash: "policy_hash_workspace_write_general_test",
    principalId: "principal_workspace_write_general_test",
    principalHash: "c".repeat(64),
    requiredCapabilities: targetFiles.map((path) => `fs.write:${path}`),
    approvalRequired: true,
    sandboxProfile: createSandboxProfile(["tmp"]),
    sideEffectClass: "workspace_write",
    createdAt: now,
    metadata: {
      localOnly: true
    }
  });
}

function createSandboxProfile(writableRoots: string[]): SandboxProfile {
  return SandboxProfileSchema.parse({
    schemaVersion: "sandbox-profile.v1",
    sandboxId: "sandbox_workspace_write_general_test",
    mode: "workspace-write",
    networkAccess: "none",
    writableRoots,
    envPolicy: {
      inheritProcessEnv: false,
      allowlist: []
    }
  });
}

async function git(args: string[], cwd: string): Promise<string> {
  const { stdout } = await execFileAsync("git", args, {
    cwd,
    encoding: "utf8",
    windowsHide: true
  });
  return stdout;
}

function clock(): () => string {
  return () => now;
}

function assertSafeEvidence(value: unknown): void {
  const serialized = JSON.stringify(value);
  for (const marker of [
    "alpha",
    "beta",
    "new",
    "remove",
    "denied-content",
    "dirty-content",
    "first",
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
