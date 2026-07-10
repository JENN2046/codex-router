import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { chmod, mkdtemp, mkdir, readFile, stat, symlink, writeFile } from "node:fs/promises";
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
  const consumptionStore = new InMemoryProviderExecutionPermitConsumptionStore();

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
    consumptionStore: new InMemoryProviderExecutionPermitConsumptionStore(),
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

test("workspace-write executor removes parent directories created during rollback", async () => {
  const cwd = await createGitRepo("workspace-write/general-created-parent");
  const fixture = await createWorkspaceWriteFixture(cwd, {
    targetFiles: ["tmp/created-parent/file.txt"],
    maxChangedFiles: 1,
    maxDiffLines: 1
  });

  const result = await runWorkspaceWriteExecution({
    cwd,
    permit: fixture.permit,
    plan: fixture.plan,
    manifest: fixture.manifest,
    operations: [{
      kind: "write",
      path: "tmp/created-parent/file.txt",
      content: "parent directory content\n"
    }],
    executionAuthorizationId: authorizationId,
    consumptionStore: new InMemoryProviderExecutionPermitConsumptionStore(),
    execute: true,
    now: clock()
  });

  assert.equal(result.status, "passed");
  assert.equal(result.checks.rollbackVerified, true);
  assert.equal(result.counters.fileWriteCalls, 1);
  assert.equal(existsSync(join(cwd, "tmp/created-parent/file.txt")), false);
  assert.equal(existsSync(join(cwd, "tmp/created-parent")), false);
  assert.equal(existsSync(join(cwd, "tmp")), false);
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
  const consumptionStore = new InMemoryProviderExecutionPermitConsumptionStore();

  const result = await runWorkspaceWriteExecution({
    cwd,
    permit: fixture.permit,
    plan: fixture.plan,
    manifest: fixture.manifest,
    operations,
    executionAuthorizationId: authorizationId,
    consumptionStore,
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

test("workspace-write executor restores tracked executable metadata during rollback", async () => {
  const cwd = await createGitRepo("workspace-write/general-executable");
  const executablePath = join(cwd, "tmp/executable.sh");
  await mkdir(dirname(executablePath), { recursive: true });
  await writeFile(executablePath, "#!/bin/sh\necho executable\n", "utf8");
  await chmod(executablePath, 0o755);
  await git(["add", "tmp/executable.sh"], cwd);
  await git(["commit", "-m", "add executable"], cwd);
  const fixture = await createWorkspaceWriteFixture(cwd, {
    targetFiles: ["tmp/executable.sh"],
    maxChangedFiles: 1,
    maxDiffLines: 3
  });

  const result = await runWorkspaceWriteExecution({
    cwd,
    permit: fixture.permit,
    plan: fixture.plan,
    manifest: fixture.manifest,
    operations: [{ kind: "delete", path: "tmp/executable.sh" }],
    executionAuthorizationId: authorizationId,
    consumptionStore: new InMemoryProviderExecutionPermitConsumptionStore(),
    execute: true,
    now: clock()
  });

  assert.equal(result.status, "passed");
  assert.equal(await readFile(executablePath, "utf8"), "#!/bin/sh\necho executable\n");
  assert.equal((await stat(executablePath)).mode & 0o111, 0o111);
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

test("workspace-write executor blocks targets outside sandbox writable roots before writing", async () => {
  const cwd = await createGitRepo("workspace-write/general-sandbox-root");
  const fixture = await createWorkspaceWriteFixture(cwd, {
    targetFiles: ["README.md"],
    maxChangedFiles: 1,
    maxDiffLines: 2,
    writableRoots: ["tmp"]
  });

  const result = await runWorkspaceWriteExecution({
    cwd,
    permit: fixture.permit,
    plan: fixture.plan,
    manifest: fixture.manifest,
    operations: [{ kind: "write", path: "README.md", content: "outside sandbox\n" }],
    executionAuthorizationId: authorizationId,
    consumptionStore: new InMemoryProviderExecutionPermitConsumptionStore(),
    execute: true,
    now: clock()
  });

  assert.equal(result.status, "blocked");
  assert.equal(result.checks.permitConsumed, false);
  assert.equal(result.counters.workspaceWriteExecuteCalls, 0);
  assert.equal(result.counters.fileWriteCalls, 0);
  assert.ok(result.reasons.includes(
    "workspace_write_execution_target_outside_writable_roots:README.md"
  ));
  assert.equal(await readFile(join(cwd, "README.md"), "utf8"), "fixture\n");
  assert.equal((await git(["status", "--short"], cwd)).trim(), "");
  assertSafeEvidence(result);
});

test("workspace-write executor blocks existing ignored targets before writing", async () => {
  const cwd = await createGitRepo("workspace-write/general-ignored-target");
  await writeFile(join(cwd, ".gitignore"), "tmp/ignored.txt\n", "utf8");
  await git(["add", ".gitignore"], cwd);
  await git(["commit", "-m", "ignore local target"], cwd);
  await mkdir(join(cwd, "tmp"), { recursive: true });
  await writeFile(join(cwd, "tmp/ignored.txt"), "local ignored data\n", "utf8");
  assert.equal((await git(["status", "--short"], cwd)).trim(), "");
  const fixture = await createWorkspaceWriteFixture(cwd, {
    targetFiles: ["tmp/ignored.txt"],
    maxChangedFiles: 1,
    maxDiffLines: 1
  });

  const result = await runWorkspaceWriteExecution({
    cwd,
    permit: fixture.permit,
    plan: fixture.plan,
    manifest: fixture.manifest,
    operations: [{ kind: "write", path: "tmp/ignored.txt", content: "overwrite\n" }],
    executionAuthorizationId: authorizationId,
    consumptionStore: new InMemoryProviderExecutionPermitConsumptionStore(),
    execute: true,
    now: clock()
  });

  assert.equal(result.status, "blocked");
  assert.equal(result.checks.permitConsumed, false);
  assert.equal(result.counters.workspaceWriteExecuteCalls, 0);
  assert.equal(result.counters.fileWriteCalls, 0);
  assert.ok(result.reasons.includes(
    "workspace_write_execution_existing_commit_absent_target_forbidden:tmp/ignored.txt"
  ));
  assert.equal(await readFile(join(cwd, "tmp/ignored.txt"), "utf8"), "local ignored data\n");
  assert.equal((await git(["status", "--short"], cwd)).trim(), "");
  assertSafeEvidence(result);
});

test("workspace-write executor returns blocked evidence for git probe failures", async () => {
  const fixtureCwd = await createGitRepo("workspace-write/general-git-probe-fixture");
  const nonGitCwd = await mkdtemp(join(tmpdir(), "workspace-write-executor-non-git-"));
  const fixture = await createWorkspaceWriteFixture(fixtureCwd, {
    targetFiles: ["tmp/git-probe.txt"],
    maxChangedFiles: 1,
    maxDiffLines: 1
  });

  const result = await runWorkspaceWriteExecution({
    cwd: nonGitCwd,
    permit: fixture.permit,
    plan: fixture.plan,
    manifest: fixture.manifest,
    operations: [{ kind: "write", path: "tmp/git-probe.txt", content: "blocked\n" }],
    executionAuthorizationId: authorizationId,
    consumptionStore: new InMemoryProviderExecutionPermitConsumptionStore(),
    execute: true,
    now: clock()
  });

  assert.equal(result.status, "blocked");
  assert.equal(result.checks.permitConsumed, false);
  assert.equal(result.checks.worktreeCleanBefore, false);
  assert.equal(result.counters.workspaceWriteExecuteCalls, 0);
  assert.equal(result.counters.fileWriteCalls, 0);
  assert.equal(result.summary.branch, "unknown");
  assert.equal(result.summary.beforeCommit, "unknown");
  assert.ok(result.reasons.includes("workspace_write_execution_git_probe_failed"));
  assert.equal(existsSync(join(nonGitCwd, "tmp/git-probe.txt")), false);
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

test("workspace-write executor requires shared consumption store before execution", async () => {
  const cwd = await createGitRepo("workspace-write/general-consumption-store-required");
  const operations: WorkspaceWriteOperation[] = [
    { kind: "write", path: "tmp/store-required.txt", content: "store-required\n" }
  ];
  const fixture = await createWorkspaceWriteFixture(cwd, {
    targetFiles: ["tmp/store-required.txt"],
    maxChangedFiles: 1,
    maxDiffLines: 1
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

  assert.equal(result.status, "blocked");
  assert.equal(result.checks.permitConsumed, false);
  assert.equal(result.counters.workspaceWriteExecuteCalls, 0);
  assert.equal(result.counters.fileWriteCalls, 0);
  assert.ok(result.reasons.includes("workspace_write_execution_consumption_store_required"));
  assert.equal(existsSync(join(cwd, "tmp/store-required.txt")), false);
  assertSafeEvidence(result);
});

test("workspace-write executor blocks symlink targets before mutating outside workspace", async () => {
  const cwd = await createGitRepo("workspace-write/general-symlink-target");
  const outsideDir = await mkdtemp(join(tmpdir(), "workspace-write-executor-outside-"));
  const outsideFile = join(outsideDir, "outside.txt");
  const symlinkPath = join(cwd, "tmp/link.txt");
  await writeFile(outsideFile, "outside-original\n", "utf8");
  await mkdir(dirname(symlinkPath), { recursive: true });
  await symlink(outsideFile, symlinkPath);
  await git(["add", "tmp/link.txt"], cwd);
  await git(["commit", "-m", "add symlink target"], cwd);

  const fixture = await createWorkspaceWriteFixture(cwd, {
    targetFiles: ["tmp/link.txt"],
    maxChangedFiles: 1,
    maxDiffLines: 2
  });

  const result = await runWorkspaceWriteExecution({
    cwd,
    permit: fixture.permit,
    plan: fixture.plan,
    manifest: fixture.manifest,
    operations: [
      { kind: "write", path: "tmp/link.txt", content: "outside-mutated\n" }
    ],
    executionAuthorizationId: authorizationId,
    execute: true,
    now: clock()
  });

  assert.equal(result.status, "blocked");
  assert.equal(result.checks.permitConsumed, false);
  assert.equal(result.counters.workspaceWriteExecuteCalls, 0);
  assert.equal(result.counters.fileWriteCalls, 0);
  assert.ok(result.reasons.includes(
    "workspace_write_execution_symlink_target_forbidden:tmp/link.txt"
  ));
  assert.equal(await readFile(outsideFile, "utf8"), "outside-original\n");
  assert.equal((await git(["status", "--short"], cwd)).trim(), "");
  assertSafeEvidence(result);
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
    writableRoots?: string[];
  }
): Promise<{
  manifest: ProviderManifest;
  plan: ExecutorExecutionPlan;
  permit: WorkspaceWriteProviderExecutionPermitV2;
}> {
  const branch = (await git(["branch", "--show-current"], cwd)).trim();
  const headCommit = (await git(["rev-parse", "HEAD"], cwd)).trim();
  const writableRoots = options.writableRoots ?? ["tmp"];
  const manifest = createProviderManifest(writableRoots);
  const plan = createExecutorPlan(manifest, options.targetFiles, writableRoots);
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

function createProviderManifest(writableRoots: string[] = ["tmp"]): ProviderManifest {
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
    supportedSandboxProfiles: [createSandboxProfile(writableRoots)],
    supportedSideEffectClasses: ["workspace_write"],
    metadata: {}
  });
}

function createExecutorPlan(
  manifest: ProviderManifest,
  targetFiles: string[],
  writableRoots: string[] = ["tmp"]
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
    sandboxProfile: createSandboxProfile(writableRoots),
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
    "outside-mutated",
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
