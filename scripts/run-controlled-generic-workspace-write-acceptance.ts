#!/usr/bin/env node

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";
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
const __dirname = fileURLToPath(new URL(".", import.meta.url));
const DEFAULT_EVIDENCE_PATH = join(
  __dirname,
  "..",
  "docs",
  "evidence",
  "controlled-generic-workspace-write-acceptance.json"
);
const DEFAULT_GENERATED_AT = "2026-07-10T00:00:00.000Z";
const AUTHORIZATION_ID = "operator_auth_controlled_generic_workspace_write_acceptance";
const TARGET_FILES = [
  "tmp/controlled-create.txt",
  "tmp/controlled-edit.txt",
  "tmp/controlled-delete.txt"
] as const;

export interface ControlledGenericWorkspaceWriteAcceptanceEvidence {
  schemaVersion: "controlled-generic-workspace-write-acceptance.v1";
  generatedAt: string;
  mode: "controlled-generic-workspace-write-local-runner";
  taskId: "controlled-generic-workspace-write-acceptance";
  checks: {
    preflightReadyWithoutMutation: boolean;
    executeSucceeded: boolean;
    createUpdateDeleteCovered: boolean;
    permitConsumedOnce: boolean;
    replayBlocked: boolean;
    patchGuardPassed: boolean;
    rollbackVerified: boolean;
    worktreeCleanAfterExecution: boolean;
    createdFileRolledBack: boolean;
    updatedFileRestored: boolean;
    deletedFileRestored: boolean;
    wroteOnlyPermittedTargets: boolean;
    noProviderExecute: boolean;
    noRealCodexCli: boolean;
    noExternalWrite: boolean;
    evidenceSanitized: boolean;
  };
  summary: {
    providerId: "local-workspace-write-executor";
    sideEffectClass: "workspace_write";
    sandbox: "workspace-write";
    targetFiles: string[];
    operationKinds: Array<"write" | "delete">;
    maxChangedFiles: number;
    maxDiffLines: number;
    changedFileCount: number;
    diffLineCount: number;
    preflightStatus: string;
    executionStatus: string;
    replayStatus: string;
    permitId: string;
    planId: string;
    manifestHash: string;
    expectedPatchHash?: string;
    actualPatchHash?: string;
  };
  counters: {
    preflightWorkspaceWriteExecuteCalls: number;
    executionWorkspaceWriteExecuteCalls: number;
    replayWorkspaceWriteExecuteCalls: number;
    fileWriteCalls: number;
    fileDeleteCalls: number;
    providerExecuteCalls: 0;
    realCodexCliCalls: 0;
    externalWriteCalls: 0;
  };
  blockingReasons: string[];
}

export interface ControlledGenericWorkspaceWriteAcceptanceOptions {
  generatedAt?: string;
}

export interface ControlledGenericWorkspaceWriteAcceptanceCliResult {
  evidence: ControlledGenericWorkspaceWriteAcceptanceEvidence;
  checkMode: boolean;
  evidencePath?: string;
}

export async function runControlledGenericWorkspaceWriteAcceptance(
  options: ControlledGenericWorkspaceWriteAcceptanceOptions = {}
): Promise<ControlledGenericWorkspaceWriteAcceptanceEvidence> {
  const generatedAt = options.generatedAt ?? DEFAULT_GENERATED_AT;
  const cwd = await createGitRepo();
  const manifest = createProviderManifest();
  const plan = createExecutorPlan(manifest);
  const permit = await createPermit(cwd, plan, manifest, generatedAt);
  const operations = createOperations();
  const consumptionStore = new InMemoryProviderExecutionPermitConsumptionStore();

  const preflight = await runWorkspaceWriteExecution({
    cwd,
    permit,
    plan,
    manifest,
    operations,
    executionAuthorizationId: AUTHORIZATION_ID,
    now: () => generatedAt,
    consumptionStore
  });
  const preflightMutated =
    existsSync(join(cwd, TARGET_FILES[0]))
    || (await readFile(join(cwd, TARGET_FILES[1]), "utf8")) !== "initial edit value\n"
    || (await readFile(join(cwd, TARGET_FILES[2]), "utf8")) !== "initial delete value\n";

  const execution = await runWorkspaceWriteExecution({
    cwd,
    permit,
    plan,
    manifest,
    operations,
    executionAuthorizationId: AUTHORIZATION_ID,
    execute: true,
    now: () => generatedAt,
    consumptionStore
  });
  const replay = await runWorkspaceWriteExecution({
    cwd,
    permit,
    plan,
    manifest,
    operations,
    executionAuthorizationId: AUTHORIZATION_ID,
    execute: true,
    now: () => generatedAt,
    consumptionStore
  });

  const createdFileRolledBack = !existsSync(join(cwd, TARGET_FILES[0]));
  const updatedFileRestored =
    (await readFile(join(cwd, TARGET_FILES[1]), "utf8")) === "initial edit value\n";
  const deletedFileRestored =
    (await readFile(join(cwd, TARGET_FILES[2]), "utf8")) === "initial delete value\n";
  const worktreeCleanAfterExecution = (await git(["status", "--short"], cwd)).trim() === "";

  const evidenceWithoutSanitizedCheck: Omit<
    ControlledGenericWorkspaceWriteAcceptanceEvidence,
    "checks"
  > & {
    checks: Omit<
      ControlledGenericWorkspaceWriteAcceptanceEvidence["checks"],
      "evidenceSanitized"
    >;
  } = {
    schemaVersion: "controlled-generic-workspace-write-acceptance.v1",
    generatedAt,
    mode: "controlled-generic-workspace-write-local-runner",
    taskId: "controlled-generic-workspace-write-acceptance",
    checks: {
      preflightReadyWithoutMutation: preflight.status === "ready" && !preflightMutated,
      executeSucceeded: execution.status === "passed",
      createUpdateDeleteCovered:
        execution.summary.writeOperationCount === 2
        && execution.summary.deleteOperationCount === 1
        && new Set(execution.summary.targetFiles).size === TARGET_FILES.length,
      permitConsumedOnce: execution.checks.permitConsumed,
      replayBlocked:
        replay.status === "blocked"
        && replay.reasons.includes(
          "workspace_write_execution_permit_v2_already_consumed_by_store"
        ),
      patchGuardPassed:
        execution.checks.preExecutionPatchGuardPassed
        && execution.checks.postExecutionPatchGuardPassed
        && execution.summary.expectedPatchHash !== undefined
        && execution.summary.actualPatchHash !== undefined,
      rollbackVerified: execution.checks.rollbackVerified,
      worktreeCleanAfterExecution,
      createdFileRolledBack,
      updatedFileRestored,
      deletedFileRestored,
      wroteOnlyPermittedTargets: execution.checks.wroteOnlyPermittedTargets,
      noProviderExecute: execution.counters.providerExecuteCalls === 0,
      noRealCodexCli: execution.counters.realCodexCliCalls === 0,
      noExternalWrite: execution.counters.remoteWrites === 0
    },
    summary: {
      providerId: manifest.providerId as "local-workspace-write-executor",
      sideEffectClass: "workspace_write",
      sandbox: "workspace-write",
      targetFiles: [...TARGET_FILES],
      operationKinds: operations.map((operation) => operation.kind),
      maxChangedFiles: permit.maxChangedFiles,
      maxDiffLines: permit.maxDiffLines,
      changedFileCount: execution.summary.changedFileCount,
      diffLineCount: execution.summary.diffLineCount,
      preflightStatus: preflight.status,
      executionStatus: execution.status,
      replayStatus: replay.status,
      permitId: permit.permitId,
      planId: plan.planId,
      manifestHash: hashProviderManifest(manifest),
      ...(execution.summary.expectedPatchHash === undefined
        ? {}
        : { expectedPatchHash: execution.summary.expectedPatchHash }),
      ...(execution.summary.actualPatchHash === undefined
        ? {}
        : { actualPatchHash: execution.summary.actualPatchHash })
    },
    counters: {
      preflightWorkspaceWriteExecuteCalls: preflight.counters.workspaceWriteExecuteCalls,
      executionWorkspaceWriteExecuteCalls: execution.counters.workspaceWriteExecuteCalls,
      replayWorkspaceWriteExecuteCalls: replay.counters.workspaceWriteExecuteCalls,
      fileWriteCalls: execution.counters.fileWriteCalls,
      fileDeleteCalls: execution.counters.fileDeleteCalls,
      providerExecuteCalls: 0,
      realCodexCliCalls: 0,
      externalWriteCalls: 0
    },
    blockingReasons: uniqueStrings([
      ...preflight.reasons,
      ...execution.reasons,
      ...replay.reasons
    ])
  };

  return {
    ...evidenceWithoutSanitizedCheck,
    checks: {
      ...evidenceWithoutSanitizedCheck.checks,
      evidenceSanitized: !containsForbiddenMarkers(evidenceWithoutSanitizedCheck)
    }
  };
}

export async function writeControlledGenericWorkspaceWriteAcceptanceEvidence(
  evidence: ControlledGenericWorkspaceWriteAcceptanceEvidence,
  evidencePath = DEFAULT_EVIDENCE_PATH
): Promise<{
  path: string;
  evidence: ControlledGenericWorkspaceWriteAcceptanceEvidence;
}> {
  await mkdir(dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  return {
    path: evidencePath,
    evidence
  };
}

export async function runControlledGenericWorkspaceWriteAcceptanceCli(
  args: readonly string[] = process.argv.slice(2)
): Promise<ControlledGenericWorkspaceWriteAcceptanceCliResult> {
  const checkMode = args.includes("--check") || args.includes("--no-write");
  const outputPath = optionValue(args, "--output") ?? DEFAULT_EVIDENCE_PATH;
  const evidence = await runControlledGenericWorkspaceWriteAcceptance();

  if (checkMode) {
    return {
      evidence,
      checkMode
    };
  }

  const write = await writeControlledGenericWorkspaceWriteAcceptanceEvidence(
    evidence,
    outputPath
  );

  return {
    evidence,
    checkMode,
    evidencePath: write.path
  };
}

async function createGitRepo(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), "controlled-generic-workspace-write-"));
  await git(["init"], cwd);
  await git(["config", "user.email", "workspace-write@example.invalid"], cwd);
  await git(["config", "user.name", "Workspace Write Acceptance"], cwd);
  await git(["config", "core.autocrlf", "false"], cwd);
  await writeFile(join(cwd, "README.md"), "fixture\n", "utf8");
  await mkdir(join(cwd, "tmp"), { recursive: true });
  await writeFile(join(cwd, TARGET_FILES[1]), "initial edit value\n", "utf8");
  await writeFile(join(cwd, TARGET_FILES[2]), "initial delete value\n", "utf8");
  await git(["add", "."], cwd);
  await git(["commit", "-m", "initial"], cwd);
  await git(["branch", "-M", "main"], cwd);
  await git(["switch", "-c", "acceptance/controlled-generic-workspace-write"], cwd);
  return cwd;
}

async function createPermit(
  cwd: string,
  plan: ExecutorExecutionPlan,
  manifest: ProviderManifest,
  issuedAt: string
): Promise<WorkspaceWriteProviderExecutionPermitV2> {
  const branch = (await git(["branch", "--show-current"], cwd)).trim();
  const headCommit = (await git(["rev-parse", "HEAD"], cwd)).trim();

  return createApprovedWorkspaceWriteProviderExecutionPermitV2({
    plan,
    manifest,
    approvalStatus: "approved",
    operatorAuthorizationId: AUTHORIZATION_ID,
    targetFiles: [...TARGET_FILES],
    maxChangedFiles: TARGET_FILES.length,
    maxDiffLines: 8,
    rollbackRequired: true,
    rollback: {
      beforeCommit: headCommit
    },
    protectedBranchForbidden: true,
    dirtyWorktreeForbidden: true,
    repositoryState: {
      branch,
      protectedBranch: false,
      worktreeClean: true,
      headCommit
    },
    issuedAt
  });
}

function createOperations(): WorkspaceWriteOperation[] {
  return [
    {
      kind: "write",
      path: TARGET_FILES[0],
      content: "created controlled generic workspace write\n"
    },
    {
      kind: "write",
      path: TARGET_FILES[1],
      content: "updated controlled generic workspace write\n"
    },
    {
      kind: "delete",
      path: TARGET_FILES[2]
    }
  ];
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
      notes: ["controlled generic workspace-write acceptance fixture"]
    },
    supportedSandboxProfiles: [createSandboxProfile()],
    supportedSideEffectClasses: ["workspace_write"],
    metadata: {}
  });
}

function createExecutorPlan(manifest: ProviderManifest): ExecutorExecutionPlan {
  return ExecutorExecutionPlanSchema.parse({
    schemaVersion: "executor-execution-plan.v1",
    kind: "executor",
    planId: "plan_controlled_generic_workspace_write_acceptance",
    runId: "run_controlled_generic_workspace_write_acceptance",
    taskId: "controlled-generic-workspace-write-acceptance",
    providerId: manifest.providerId,
    inputHash: "a".repeat(64),
    providerExecutionPlanHash: "b".repeat(64),
    providerManifestHash: hashProviderManifest(manifest),
    policyDecisionHash: "policy_hash_controlled_generic_workspace_write_acceptance",
    principalId: "principal_controlled_generic_workspace_write_acceptance",
    principalHash: "c".repeat(64),
    requiredCapabilities: TARGET_FILES.map((path) => `fs.write:${path}`),
    approvalRequired: true,
    sandboxProfile: createSandboxProfile(),
    sideEffectClass: "workspace_write",
    createdAt: DEFAULT_GENERATED_AT,
    metadata: {
      localOnly: true,
      acceptance: "controlled-generic-workspace-write"
    }
  });
}

function createSandboxProfile(): SandboxProfile {
  return SandboxProfileSchema.parse({
    schemaVersion: "sandbox-profile.v1",
    sandboxId: "sandbox_controlled_generic_workspace_write_acceptance",
    mode: "workspace-write",
    networkAccess: "none",
    writableRoots: ["tmp"],
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

function containsForbiddenMarkers(value: unknown): boolean {
  const serialized = JSON.stringify(value);
  return [
    "created controlled generic workspace write",
    "updated controlled generic workspace write",
    "initial edit value",
    "initial delete value",
    "stdout",
    "stderr",
    "raw command",
    "raw env",
    "raw patch",
    "OPENAI_API_KEY",
    "sk-",
    "Bearer"
  ].some((marker) => serialized.includes(marker));
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function optionValue(args: readonly string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index < 0) {
    return undefined;
  }

  const value = args[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`${name} requires a value`);
  }

  return value;
}

async function main(): Promise<void> {
  const result = await runControlledGenericWorkspaceWriteAcceptanceCli();
  const { evidence } = result;

  console.log("Controlled generic workspace-write acceptance");
  console.log(`preflight ready without mutation: ${evidence.checks.preflightReadyWithoutMutation}`);
  console.log(`execute succeeded: ${evidence.checks.executeSucceeded}`);
  console.log(`create/update/delete covered: ${evidence.checks.createUpdateDeleteCovered}`);
  console.log(`rollback verified: ${evidence.checks.rollbackVerified}`);
  console.log(`replay blocked: ${evidence.checks.replayBlocked}`);
  console.log(`provider execute calls: ${evidence.counters.providerExecuteCalls}`);
  console.log(`real Codex CLI calls: ${evidence.counters.realCodexCliCalls}`);
  console.log(`external write calls: ${evidence.counters.externalWriteCalls}`);
  console.log(`evidence sanitized: ${evidence.checks.evidenceSanitized}`);
  console.log(
    result.checkMode
      ? "evidence: not written (--check)"
      : `evidence: ${result.evidencePath}`
  );

  if (!Object.values(evidence.checks).every(Boolean)) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      "Controlled generic workspace-write acceptance failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
