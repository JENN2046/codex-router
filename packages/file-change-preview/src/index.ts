import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import {
  access,
  lstat,
  mkdtemp,
  readFile,
  realpath,
  rm
} from "node:fs/promises";
import { tmpdir } from "node:os";
import {
  isAbsolute,
  join,
  relative,
  resolve,
  sep
} from "node:path";
import { posix as pathPosix } from "node:path";
import { z } from "zod";
import {
  GovernedFileChangeSetSchema,
  PreviewPolicySchema,
  PreviewReceiptSchema,
  hashKernelObject,
  hashGovernedFileChangeSetContent,
  type AutoApprovalRule,
  type CapabilityFacts,
  type ExactArgvCommand,
  type GovernedFileChange,
  type GovernedFileChangeKind,
  type GovernedFileChangeSet,
  type PreviewCheckReceipt,
  type PreviewPolicy,
  type PreviewReceipt
} from "../../kernel-contracts/src/index.js";
import {
  isSensitiveGovernedPath
} from "../../authorization-kernel/src/index.js";

const PROTECTED_BRANCHES = new Set([
  "main",
  "master",
  "production",
  "release",
  "prod/stable"
]);

const WINDOWS_RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;

export interface GovernedFileChangeDraft {
  path: string;
  kind: GovernedFileChangeKind;
  oldPath?: string;
  unifiedDiff: string;
  beforeHash?: string | null;
  afterHash?: string | null;
}

export interface GovernedFileChangeSetDraft {
  changeSetId: string;
  threadId: string;
  turnId: string;
  itemId: string;
  baseHead: string;
  changes: GovernedFileChangeDraft[];
  proposedAt: string;
  sourceSchemaProfile: string;
}

export interface AutoApprovalEvaluation {
  eligible: boolean;
  rule?: AutoApprovalRule;
  reasons: string[];
}

export const PreviewIsolationAttestationSchema = z.object({
  networkIsolation: z.enum(["enforced_none", "unsupported"]),
  filesystemIsolation: z.enum(["clone_only_enforced", "unsupported"]),
  scope: z.enum(["test_only", "live"]),
  enforcerId: z.string().min(1)
}).strict();

export type PreviewIsolationAttestation = z.infer<typeof PreviewIsolationAttestationSchema>;

export interface FileChangePreviewInput {
  repoRoot: string;
  changeSet: GovernedFileChangeSet;
  facts: CapabilityFacts;
  policy: PreviewPolicy;
  isolation: PreviewIsolationAttestation;
  now: () => string;
}

export interface FileChangePreviewer {
  preview(input: FileChangePreviewInput): Promise<PreviewReceipt>;
}

export interface PreviewProcessInput {
  executable: string;
  argv: string[];
  cwd: string;
  stdin?: string;
  timeoutMs: number;
  env: NodeJS.ProcessEnv;
}

export interface PreviewProcessResult {
  status: "passed" | "failed" | "timed_out" | "spawn_failed";
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export interface PreviewProcessRunner {
  readonly isolationAttestation: PreviewIsolationAttestation;
  run(input: PreviewProcessInput): Promise<PreviewProcessResult>;
}

export interface LocalClonePreviewerOptions {
  runner?: PreviewProcessRunner;
  tempRoot?: string;
}

const trustedRunnerAttestations = new WeakMap<PreviewProcessRunner, PreviewIsolationAttestation>();
const trustedPreviewerAttestations = new WeakMap<FileChangePreviewer, PreviewIsolationAttestation>();

/**
 * Internal disposable-repository harness. This is intentionally absent from the
 * package public exports and must never be used as evidence of live isolation.
 */
export function createTestOnlyLocalClonePreviewer(options: {
  tempRoot?: string;
  runner?: PreviewProcessRunner;
} = {}): LocalClonePreviewer {
  const runner = options.runner ?? new SpawnPreviewProcessRunner();
  const attestation: PreviewIsolationAttestation = {
    networkIsolation: "enforced_none",
    filesystemIsolation: "clone_only_enforced",
    scope: "test_only",
    enforcerId: "disposable-test-harness"
  };
  trustedRunnerAttestations.set(runner, attestation);
  return new LocalClonePreviewer({
    ...(options.tempRoot === undefined ? {} : { tempRoot: options.tempRoot }),
    runner
  });
}

/** Internal trust query used by the adapter; not part of codex-router public exports. */
export function getTrustedPreviewerAttestation(
  previewer: FileChangePreviewer
): PreviewIsolationAttestation | undefined {
  const attestation = trustedPreviewerAttestations.get(previewer);
  return attestation === undefined ? undefined : { ...attestation };
}

export function canonicalizeGovernedFileChangeSet(
  draft: GovernedFileChangeSetDraft
): GovernedFileChangeSet {
  if (draft.changes.length === 0) {
    throw new Error("governed_change_set_empty");
  }

  const changes = draft.changes
    .map(canonicalizeChange)
    .sort(compareCanonicalChanges);
  assertNoPathAliases(changes);

  const canonicalHash = hashGovernedFileChangeSetContent({
    baseHead: draft.baseHead,
    changes
  });

  return GovernedFileChangeSetSchema.parse({
    changeSetId: draft.changeSetId,
    threadId: draft.threadId,
    turnId: draft.turnId,
    itemId: draft.itemId,
    baseHead: draft.baseHead,
    changes,
    canonicalHash,
    proposedAt: draft.proposedAt,
    sourceSchemaProfile: draft.sourceSchemaProfile
  });
}

export function evaluateAutoApprovalPolicy(
  changeSetInput: GovernedFileChangeSet,
  facts: CapabilityFacts,
  policyInput: PreviewPolicy
): AutoApprovalEvaluation {
  const changeSet = GovernedFileChangeSetSchema.parse(changeSetInput);
  const policy = PreviewPolicySchema.parse(policyInput);
  const hardBoundaryReasons = collectHardBoundaryReasons(changeSet, facts);
  if (hardBoundaryReasons.length > 0) {
    return { eligible: false, reasons: hardBoundaryReasons };
  }

  const ruleFailures: string[] = [];
  for (const rule of policy.autoApprovalRules) {
    const reasons = collectRuleReasons(changeSet, rule);
    if (reasons.length === 0) {
      return {
        eligible: true,
        rule,
        reasons: [`auto_approval_rule:${rule.ruleId}`]
      };
    }
    ruleFailures.push(...reasons.map((reason) => `${rule.ruleId}:${reason}`));
  }

  return {
    eligible: false,
    reasons: uniqueStrings([
      ...(policy.autoApprovalRules.length === 0 ? ["auto_approval_rule_missing"] : []),
      ...ruleFailures
    ])
  };
}

export class LocalClonePreviewer implements FileChangePreviewer {
  private readonly runner: PreviewProcessRunner;
  private readonly tempRoot: string;

  constructor(options: LocalClonePreviewerOptions = {}) {
    this.runner = options.runner ?? new SpawnPreviewProcessRunner();
    this.tempRoot = options.tempRoot ?? tmpdir();
    const attestation = trustedRunnerAttestations.get(this.runner);
    if (attestation !== undefined) {
      trustedPreviewerAttestations.set(this, attestation);
    }
  }

  async preview(input: FileChangePreviewInput): Promise<PreviewReceipt> {
    const changeSet = GovernedFileChangeSetSchema.parse(input.changeSet);
    const createdAt = input.now();
    const parsedIsolation = PreviewIsolationAttestationSchema.safeParse(input.isolation);
    if (!parsedIsolation.success) {
      return blockedReceipt({
        changeSet,
        createdAt,
        isolation: {
          networkIsolation: "unsupported",
          filesystemIsolation: "unsupported",
          scope: "test_only",
          enforcerId: "invalid-isolation-attestation"
        },
        cleanupStatus: "not_created",
        reasons: ["preview_isolation_attestation_invalid"]
      });
    }
    const isolation = parsedIsolation.data;
    const evaluation = evaluateAutoApprovalPolicy(changeSet, input.facts, input.policy);
    if (!evaluation.eligible || evaluation.rule === undefined) {
      return blockedReceipt({
        changeSet,
        createdAt,
        isolation,
        cleanupStatus: "not_created",
        reasons: evaluation.reasons
      });
    }
    const runnerAttestation = trustedRunnerAttestations.get(this.runner);
    if (
      isolation.networkIsolation !== "enforced_none"
      || isolation.filesystemIsolation !== "clone_only_enforced"
      || isolation.enforcerId.trim() === ""
      || runnerAttestation?.networkIsolation !== "enforced_none"
      || runnerAttestation.filesystemIsolation !== "clone_only_enforced"
      || runnerAttestation.scope !== isolation.scope
      || runnerAttestation.enforcerId !== isolation.enforcerId
    ) {
      return blockedReceipt({
        changeSet,
        createdAt,
        isolation,
        cleanupStatus: "not_created",
        reasons: [
          ...(isolation.networkIsolation === "enforced_none"
            ? []
            : ["preview_network_isolation_unavailable"]),
          ...(isolation.filesystemIsolation === "clone_only_enforced"
            ? []
            : ["preview_filesystem_isolation_unavailable"]),
          ...(isolation.enforcerId.trim() === ""
            ? ["preview_isolation_enforcer_missing"]
            : []),
          ...(runnerAttestation?.networkIsolation === "enforced_none"
            ? []
            : ["preview_runner_network_isolation_unavailable"]),
          ...(runnerAttestation?.filesystemIsolation === "clone_only_enforced"
            ? []
            : ["preview_runner_filesystem_isolation_unavailable"]),
          ...(runnerAttestation?.scope === isolation.scope
            ? []
            : ["preview_isolation_scope_mismatch"]),
          ...(runnerAttestation?.enforcerId === isolation.enforcerId
            ? []
            : ["preview_isolation_attestation_mismatch"])
        ]
      });
    }

    let cloneRoot: string | undefined;
    let cleanupStatus: PreviewReceipt["cleanupStatus"] = "not_created";
    const checks: PreviewCheckReceipt[] = [];
    const reasons: string[] = [];
    let previewPassed = false;

    try {
      const sourceBefore = await inspectSourceRepository(
        input.repoRoot,
        this.runner,
        this.tempRoot
      );
      reasons.push(...validateSourceState(sourceBefore, changeSet, input.facts));
      if (reasons.length > 0) {
        return blockedReceipt({
          changeSet,
          createdAt,
          isolation,
          cleanupStatus,
          reasons
        });
      }

      cloneRoot = await mkdtemp(join(this.tempRoot, "codex-router-preview-"));
      cleanupStatus = "failed";
      const clonePath = join(cloneRoot, "repo");
      const gitEnv = createSanitizedEnv(cloneRoot);
      await requireProcessPass(this.runner, {
        executable: "git",
        argv: [
          "clone",
          "--no-hardlinks",
          "--no-checkout",
          "--config",
          `core.hooksPath=${process.platform === "win32" ? "NUL" : "/dev/null"}`,
          "--config",
          "submodule.recurse=false",
          "--",
          resolve(input.repoRoot),
          clonePath
        ],
        cwd: cloneRoot,
        timeoutMs: 2 * 60 * 1000,
        env: gitEnv
      }, "preview_clone_failed");
      await requireGit(this.runner, clonePath, ["remote", "remove", "origin"], gitEnv);
      const remotes = await runGit(this.runner, clonePath, ["remote"], gitEnv);
      if (remotes.stdout.trim() !== "") {
        reasons.push("preview_clone_remote_present");
      }
      if (await pathExists(join(clonePath, ".git", "objects", "info", "alternates"))) {
        reasons.push("preview_clone_alternates_present");
      }
      await requireGit(
        this.runner,
        clonePath,
        ["checkout", "--detach", "--no-recurse-submodules", changeSet.baseHead],
        gitEnv
      );
      const cloneHead = (await runGit(this.runner, clonePath, ["rev-parse", "HEAD"], gitEnv))
        .stdout.trim();
      if (cloneHead !== changeSet.baseHead) {
        reasons.push("preview_clone_head_mismatch");
      }
      const cloneStatus = await runGit(
        this.runner,
        clonePath,
        ["status", "--porcelain=v1", "-z"],
        gitEnv
      );
      if (cloneStatus.stdout !== "") {
        reasons.push("preview_clone_not_clean");
      }
      const cloneTopologyReasons = await collectTargetTopologyReasons(
        clonePath,
        changeSet.changes.map((change) => change.path),
        true
      );
      reasons.push(...cloneTopologyReasons);
      if (cloneTopologyReasons.length > 0) {
        throw new Error("preview_clone_preflight_failed");
      }
      reasons.push(...await verifyBeforeHashes(clonePath, changeSet));
      if (reasons.length > 0) {
        throw new Error("preview_clone_preflight_failed");
      }

      const patch = changeSet.changes.map((change) => change.unifiedDiff).join("\n");
      await requireProcessPass(this.runner, {
        executable: "git",
        argv: ["apply", "--whitespace=nowarn", "--recount", "-"],
        cwd: clonePath,
        stdin: patch,
        timeoutMs: 60 * 1000,
        env: gitEnv
      }, "preview_patch_apply_failed");
      const appliedTopologyReasons = await collectTargetTopologyReasons(
        clonePath,
        changeSet.changes.map((change) => change.path),
        false
      );
      reasons.push(...appliedTopologyReasons);
      if (appliedTopologyReasons.length > 0) {
        throw new Error("preview_applied_topology_failed");
      }
      reasons.push(...await verifyChangedTargetSet(clonePath, changeSet, this.runner, gitEnv));
      const expectedAfterHashes = await readTargetHashes(clonePath, changeSet);
      reasons.push(...verifyDeclaredAfterHashes(changeSet, expectedAfterHashes));

      if (reasons.length === 0) {
        for (const command of evaluation.rule.prepare) {
          const receipt = await runPolicyCommand(
            this.runner,
            clonePath,
            cloneRoot,
            command,
            "prepare"
          );
          checks.push(receipt);
          if (receipt.status !== "passed") {
            reasons.push("preview_prepare_failed");
            break;
          }
        }
      }
      if (reasons.length === 0) {
        for (const command of evaluation.rule.checks) {
          const receipt = await runPolicyCommand(
            this.runner,
            clonePath,
            cloneRoot,
            command,
            "check"
          );
          checks.push(receipt);
          if (receipt.status !== "passed") {
            reasons.push("preview_check_failed");
            break;
          }
        }
      }
      if (reasons.length === 0) {
        const checkedTopologyReasons = await collectTargetTopologyReasons(
          clonePath,
          changeSet.changes.map((change) => change.path),
          false
        );
        reasons.push(...checkedTopologyReasons);
        if (checkedTopologyReasons.length === 0) {
          reasons.push(...await verifyChangedTargetSet(clonePath, changeSet, this.runner, gitEnv));
          const hashesAfterChecks = await readTargetHashes(clonePath, changeSet);
          if (!sameHashMap(expectedAfterHashes, hashesAfterChecks)) {
            reasons.push("preview_checks_changed_proposed_targets");
          }
        }
      }

      const sourceAfter = await inspectSourceRepository(
        input.repoRoot,
        this.runner,
        this.tempRoot
      );
      if (
        sourceAfter.headCommit !== sourceBefore.headCommit
        || sourceAfter.branch !== sourceBefore.branch
        || sourceAfter.status !== sourceBefore.status
      ) {
        reasons.push("preview_source_repository_drifted");
      }
      previewPassed = reasons.length === 0;
    } catch (error) {
      reasons.push(normalizePreviewError(error));
    } finally {
      if (cloneRoot !== undefined) {
        try {
          await rm(cloneRoot, { recursive: true, force: true, maxRetries: 2 });
          cleanupStatus = "passed";
        } catch {
          cleanupStatus = "failed";
          reasons.push("preview_cleanup_failed");
        }
      }
    }

    const status = previewPassed && cleanupStatus === "passed" && reasons.length === 0
      ? "preview_passed"
      : "blocked";
    return PreviewReceiptSchema.parse({
      receiptId: `preview_${changeSet.canonicalHash.slice(0, 24)}`,
      changeSetHash: changeSet.canonicalHash,
      headCommit: changeSet.baseHead,
      ruleId: evaluation.rule.ruleId,
      status,
      networkIsolation: isolation.networkIsolation,
      filesystemIsolation: isolation.filesystemIsolation,
      isolationScope: isolation.scope,
      isolationEnforcerId: isolation.enforcerId,
      checks,
      cleanupStatus,
      reasons: status === "preview_passed" ? [] : uniqueStrings(reasons),
      createdAt
    });
  }
}

export class SpawnPreviewProcessRunner implements PreviewProcessRunner {
  readonly isolationAttestation: PreviewIsolationAttestation = {
    networkIsolation: "unsupported",
    filesystemIsolation: "unsupported",
    scope: "test_only",
    enforcerId: "spawn-process-runner-unisolated"
  };

  async run(input: PreviewProcessInput): Promise<PreviewProcessResult> {
    const startedAt = Date.now();
    return new Promise((resolveResult) => {
      let stdout = "";
      let stderr = "";
      let settled = false;
      let timedOut = false;
      const child = spawn(input.executable, input.argv, {
        cwd: input.cwd,
        env: input.env,
        shell: false,
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"]
      });
      const finish = (
        status: PreviewProcessResult["status"],
        exitCode: number | null
      ): void => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        resolveResult({
          status,
          exitCode,
          stdout,
          stderr,
          durationMs: Math.max(0, Date.now() - startedAt)
        });
      };
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGKILL");
      }, input.timeoutMs);
      child.stdout?.on("data", (chunk: Buffer | string) => {
        stdout = appendBounded(stdout, chunk);
      });
      child.stderr?.on("data", (chunk: Buffer | string) => {
        stderr = appendBounded(stderr, chunk);
      });
      child.on("error", () => finish("spawn_failed", null));
      child.on("close", (code) => {
        finish(timedOut ? "timed_out" : code === 0 ? "passed" : "failed", code);
      });
      if (input.stdin === undefined) {
        child.stdin?.end();
      } else {
        child.stdin?.end(input.stdin, "utf8");
      }
    });
  }
}

function canonicalizeChange(change: GovernedFileChangeDraft): GovernedFileChange {
  const path = normalizeAndAssertGovernedPath(change.path);
  const oldPath = change.oldPath === undefined
    ? undefined
    : normalizeAndAssertGovernedPath(change.oldPath);
  const unifiedDiff = normalizeUnifiedDiff(change.unifiedDiff);
  assertDiffBindsPath(unifiedDiff, path, change.kind, oldPath);
  const counts = countDiffLines(unifiedDiff);

  return {
    path,
    kind: change.kind,
    ...(oldPath === undefined ? {} : { oldPath }),
    unifiedDiff,
    ...(change.beforeHash === undefined ? {} : { beforeHash: change.beforeHash }),
    ...(change.afterHash === undefined ? {} : { afterHash: change.afterHash }),
    addedLines: counts.addedLines,
    deletedLines: counts.deletedLines
  };
}

function collectHardBoundaryReasons(
  changeSet: GovernedFileChangeSet,
  facts: CapabilityFacts
): string[] {
  const reasons: string[] = [];
  if (changeSet.changes.some((change) => change.kind === "delete")) {
    reasons.push("auto_approval_delete_forbidden");
  }
  if (changeSet.changes.some((change) => change.kind === "rename")) {
    reasons.push("auto_approval_rename_forbidden");
  }
  if (changeSet.changes.some((change) => isSensitiveGovernedPath(change.path))) {
    reasons.push("auto_approval_sensitive_path_forbidden");
  }
  if (changeSet.changes.some((change) => (
    change.kind === "update" && (change.beforeHash === undefined || change.beforeHash === null)
  ))) {
    reasons.push("auto_approval_update_before_hash_required");
  }
  if (changeSet.changes.some((change) => (
    (change.kind === "create" || change.kind === "update")
    && (change.afterHash === undefined || change.afterHash === null)
  ))) {
    reasons.push("auto_approval_after_hash_required");
  }
  if (facts.commands.length > 0) {
    reasons.push("auto_approval_command_forbidden");
  }
  if (facts.permissionRequests.length > 0) {
    reasons.push("auto_approval_permission_forbidden");
  }
  if (facts.repository.protectedBranch || isProtectedBranch(facts.repository.branch)) {
    reasons.push("auto_approval_protected_branch_forbidden");
  }
  if (!facts.repository.worktreeClean) {
    reasons.push("auto_approval_dirty_worktree_forbidden");
  }
  if (
    facts.repository.headCommit === undefined
    || facts.repository.expectedHead === undefined
    || facts.repository.headCommit !== facts.repository.expectedHead
    || facts.repository.headCommit !== changeSet.baseHead
  ) {
    reasons.push("auto_approval_head_mismatch");
  }
  if (facts.networkAccess !== "none") {
    reasons.push("auto_approval_network_forbidden");
  }
  if (facts.credentialAccess !== "none") {
    reasons.push("auto_approval_credential_forbidden");
  }
  if (facts.externalTargets.length > 0) {
    reasons.push("auto_approval_external_target_forbidden");
  }
  if (facts.releaseAction) {
    reasons.push("auto_approval_release_forbidden");
  }
  if (!facts.exactTargets || facts.ambiguous || facts.unknowns.length > 0) {
    reasons.push("auto_approval_ambiguous_or_unknown_forbidden");
  }
  if (!factsBindChangeSet(facts, changeSet)) {
    reasons.push("auto_approval_facts_change_set_mismatch");
  }
  return uniqueStrings(reasons);
}

function collectRuleReasons(
  changeSet: GovernedFileChangeSet,
  rule: AutoApprovalRule
): string[] {
  const reasons: string[] = [];
  if (changeSet.changes.length > rule.maxFiles) {
    reasons.push("file_limit_exceeded");
  }
  const diffLines = changeSet.changes.reduce(
    (total, change) => total + change.addedLines + change.deletedLines,
    0
  );
  if (diffLines > rule.maxDiffLines) {
    reasons.push("diff_limit_exceeded");
  }
  if (changeSet.changes.some((change) => !rule.operations.includes(change.kind as "create" | "update"))) {
    reasons.push("operation_not_allowed");
  }
  for (const change of changeSet.changes) {
    if (!rule.allowedPaths.some((pattern) => pathMatchesPattern(change.path, pattern))) {
      reasons.push(`path_not_allowed:${change.path}`);
    }
  }
  return uniqueStrings(reasons);
}

type SourceRepositoryState = {
  branch: string;
  headCommit: string;
  status: string;
  shallow: boolean;
  hasSubmodules: boolean;
  hasLocalFilters: boolean;
  hasCustomHooksPath: boolean;
};

async function inspectSourceRepository(
  repoRoot: string,
  runner: PreviewProcessRunner,
  tempRoot: string
): Promise<SourceRepositoryState> {
  const env = createSanitizedEnv(tempRoot);
  const branch = (await runGit(runner, repoRoot, ["branch", "--show-current"], env)).stdout.trim();
  const headCommit = (await runGit(runner, repoRoot, ["rev-parse", "HEAD"], env)).stdout.trim();
  const status = (await runGit(
    runner,
    repoRoot,
    ["status", "--porcelain=v1", "-z"],
    env
  )).stdout;
  const shallow = (await runGit(
    runner,
    repoRoot,
    ["rev-parse", "--is-shallow-repository"],
    env
  )).stdout.trim() !== "false";
  const submodules = await runGitAllowFailure(
    runner,
    repoRoot,
    ["ls-files", "--error-unmatch", ".gitmodules"],
    env
  );
  const filters = await runGitAllowFailure(
    runner,
    repoRoot,
    ["config", "--local", "--get-regexp", "^filter\\."],
    env
  );
  const hooks = await runGitAllowFailure(
    runner,
    repoRoot,
    ["config", "--local", "--get", "core.hooksPath"],
    env
  );

  return {
    branch,
    headCommit,
    status,
    shallow,
    hasSubmodules: submodules.status === "passed",
    hasLocalFilters: filters.status === "passed" && filters.stdout.trim() !== "",
    hasCustomHooksPath: hooks.status === "passed" && hooks.stdout.trim() !== ""
  };
}

function validateSourceState(
  state: SourceRepositoryState,
  changeSet: GovernedFileChangeSet,
  facts: CapabilityFacts
): string[] {
  return uniqueStrings([
    ...(state.headCommit === changeSet.baseHead ? [] : ["preview_source_head_mismatch"]),
    ...(state.status === "" ? [] : ["preview_source_worktree_not_clean"]),
    ...(state.branch === facts.repository.branch ? [] : ["preview_source_branch_mismatch"]),
    ...(isProtectedBranch(state.branch) ? ["preview_source_protected_branch"] : []),
    ...(state.shallow ? ["preview_source_shallow_repository"] : []),
    ...(state.hasSubmodules ? ["preview_source_submodules_unsupported"] : []),
    ...(state.hasLocalFilters ? ["preview_source_filters_unsupported"] : []),
    ...(state.hasCustomHooksPath ? ["preview_source_hooks_path_unsupported"] : [])
  ]);
}

async function runPolicyCommand(
  runner: PreviewProcessRunner,
  clonePath: string,
  tempRoot: string,
  command: ExactArgvCommand,
  phase: PreviewCheckReceipt["phase"]
): Promise<PreviewCheckReceipt> {
  const [executable, ...argv] = command.argv;
  if (executable === undefined || executable.trim() === "") {
    return {
      phase,
      argvHash: hashKernelObject(command.argv),
      status: "spawn_failed",
      exitCode: null,
      durationMs: 0
    };
  }
  const result = await runner.run({
    executable,
    argv,
    cwd: clonePath,
    timeoutMs: command.timeoutMs,
    env: createSanitizedEnv(tempRoot)
  });
  return {
    phase,
    argvHash: hashKernelObject(command.argv),
    status: result.status,
    exitCode: result.exitCode,
    durationMs: result.durationMs
  };
}

async function verifyBeforeHashes(
  clonePath: string,
  changeSet: GovernedFileChangeSet
): Promise<string[]> {
  const reasons: string[] = [];
  for (const change of changeSet.changes) {
    const target = join(clonePath, ...change.path.split("/"));
    if (change.kind === "create") {
      if (await pathExists(target)) {
        reasons.push(`preview_create_target_exists:${change.path}`);
      }
      continue;
    }
    if (change.beforeHash === undefined || change.beforeHash === null) {
      reasons.push(`preview_before_hash_missing:${change.path}`);
      continue;
    }
    try {
      const actual = sha256(await readFile(target));
      if (actual !== change.beforeHash) {
        reasons.push(`preview_before_hash_mismatch:${change.path}`);
      }
    } catch {
      reasons.push(`preview_before_target_unreadable:${change.path}`);
    }
  }
  return uniqueStrings(reasons);
}

async function readTargetHashes(
  clonePath: string,
  changeSet: GovernedFileChangeSet
): Promise<Map<string, string>> {
  const hashes = new Map<string, string>();
  for (const change of changeSet.changes) {
    hashes.set(change.path, sha256(await readFile(join(clonePath, ...change.path.split("/")))));
  }
  return hashes;
}

function verifyDeclaredAfterHashes(
  changeSet: GovernedFileChangeSet,
  hashes: Map<string, string>
): string[] {
  return changeSet.changes.flatMap((change) => (
    change.afterHash !== undefined
    && change.afterHash !== null
    && hashes.get(change.path) !== change.afterHash
      ? [`preview_after_hash_mismatch:${change.path}`]
      : []
  ));
}

async function verifyChangedTargetSet(
  clonePath: string,
  changeSet: GovernedFileChangeSet,
  runner: PreviewProcessRunner,
  env: NodeJS.ProcessEnv
): Promise<string[]> {
  const status = await runGit(
    runner,
    clonePath,
    ["status", "--porcelain=v1", "-z", "--untracked-files=all"],
    env
  );
  const actual = parsePorcelainPaths(status.stdout);
  const expected = changeSet.changes.map((change) => change.path).sort(compareCodeUnits);
  return sameStringArrays(actual, expected) ? [] : ["preview_changed_target_set_mismatch"];
}

async function collectTargetTopologyReasons(
  root: string,
  targets: string[],
  allowMissingFinal: boolean
): Promise<string[]> {
  const rootReal = await realpath(root);
  const reasons: string[] = [];
  for (const target of targets) {
    const parts = target.split("/");
    let current = root;
    for (const [index, part] of parts.entries()) {
      current = join(current, part);
      try {
        const stats = await lstat(current);
        const final = index === parts.length - 1;
        if (stats.isSymbolicLink()) {
          reasons.push(`preview_symlink_target_forbidden:${target}`);
          break;
        }
        if (final && stats.isDirectory()) {
          reasons.push(`preview_directory_target_forbidden:${target}`);
          break;
        }
        if (stats.isFile() && stats.nlink > 1) {
          reasons.push(`preview_hardlink_target_forbidden:${target}`);
          break;
        }
        const resolved = await realpath(current);
        if (!isContained(rootReal, resolved)) {
          reasons.push(`preview_target_outside_clone:${target}`);
          break;
        }
      } catch (error) {
        if (isErrorCode(error, "ENOENT")) {
          if (!allowMissingFinal) {
            reasons.push(`preview_target_missing:${target}`);
          }
          break;
        }
        reasons.push(`preview_target_topology_check_failed:${target}`);
        break;
      }
    }
  }
  return uniqueStrings(reasons);
}

function factsBindChangeSet(facts: CapabilityFacts, changeSet: GovernedFileChangeSet): boolean {
  const factChanges = facts.fileChanges.map((change) => (
    `${change.kind}\0${change.oldPath ?? ""}\0${change.path}\0${change.addedLines}\0${change.deletedLines}`
  )).sort(compareCodeUnits);
  const proposedChanges = changeSet.changes.map((change) => (
    `${change.kind}\0${change.oldPath ?? ""}\0${change.path}\0${change.addedLines}\0${change.deletedLines}`
  )).sort(compareCodeUnits);
  return sameStringArrays(factChanges, proposedChanges);
}

function normalizeAndAssertGovernedPath(input: string): string {
  if (input.normalize("NFC") !== input) {
    throw new Error("governed_path_unicode_not_nfc");
  }
  const slashPath = input.replace(/\\/g, "/");
  const normalized = pathPosix.normalize(slashPath);
  const parts = normalized.split("/");
  if (
    input === ""
    || normalized === "."
    || normalized === ".."
    || normalized.startsWith("../")
    || pathPosix.isAbsolute(normalized)
    || isAbsolute(input)
    || /^[a-zA-Z]:/.test(input)
    || slashPath.startsWith("//")
    || normalized !== slashPath
    || input.includes("\0")
    || input.includes("\n")
    || input.includes("\r")
    || parts.some((part) => part === "" || part === "." || part === "..")
    || parts.some((part) => part.toLocaleLowerCase("en-US") === ".git")
    || parts.some((part) => part.includes(":"))
    || parts.some((part) => part.endsWith(".") || part.endsWith(" "))
    || parts.some((part) => WINDOWS_RESERVED_NAMES.test(part))
  ) {
    throw new Error("governed_path_unsafe");
  }
  return normalized;
}

function assertNoPathAliases(changes: GovernedFileChange[]): void {
  const seen = new Set<string>();
  for (const path of changes.flatMap((change) => [
    change.path,
    ...(change.oldPath === undefined ? [] : [change.oldPath])
  ])) {
    const alias = path.normalize("NFC").toLocaleLowerCase("en-US");
    if (seen.has(alias)) {
      throw new Error("governed_path_alias_collision");
    }
    seen.add(alias);
  }
}

function assertDiffBindsPath(
  diff: string,
  path: string,
  kind: GovernedFileChangeKind,
  oldPath?: string
): void {
  const expectedDiff = `diff --git a/${oldPath ?? path} b/${path}`;
  const expectedOld = kind === "create" ? "--- /dev/null" : `--- a/${oldPath ?? path}`;
  const expectedNew = kind === "delete" ? "+++ /dev/null" : `+++ b/${path}`;
  const lines = diff.split("\n");
  const firstHunkIndex = lines.findIndex((line) => line.startsWith("@@ "));
  const diffHeaderIndexes = lines.flatMap((line, index) => (
    line.startsWith("diff --git ") ? [index] : []
  ));
  const headerLines = firstHunkIndex < 0 ? [] : lines.slice(0, firstHunkIndex);
  const oldHeaderIndexes = headerLines.flatMap((line, index) => (
    line.startsWith("--- ") ? [index] : []
  ));
  const newHeaderIndexes = headerLines.flatMap((line, index) => (
    line.startsWith("+++ ") ? [index] : []
  ));
  const diffHeaderIndex = diffHeaderIndexes[0];
  const oldHeaderIndex = oldHeaderIndexes[0];
  const newHeaderIndex = newHeaderIndexes[0];
  if (
    firstHunkIndex < 0
    || diffHeaderIndexes.length !== 1
    || oldHeaderIndexes.length !== 1
    || newHeaderIndexes.length !== 1
    || diffHeaderIndex === undefined
    || oldHeaderIndex === undefined
    || newHeaderIndex === undefined
    || diffHeaderIndex >= oldHeaderIndex
    || newHeaderIndex !== oldHeaderIndex + 1
    || lines[diffHeaderIndex] !== expectedDiff
    || headerLines[oldHeaderIndex] !== expectedOld
    || headerLines[newHeaderIndex] !== expectedNew
  ) {
    throw new Error("governed_change_diff_path_mismatch");
  }
  assertSupportedFileModeHeaders(headerLines, kind);
}

function assertSupportedFileModeHeaders(
  headerLines: string[],
  kind: GovernedFileChangeKind
): void {
  const modeHeaders = headerLines.filter((line) => (
    /^(?:old mode|new mode|new file mode|deleted file mode)\s/u.test(line)
  ));
  const supported = modeHeaders.length === 0
    || (
      kind === "create"
      && modeHeaders.length === 1
      && modeHeaders[0] === "new file mode 100644"
    )
    || (
      kind === "delete"
      && modeHeaders.length === 1
      && modeHeaders[0] === "deleted file mode 100644"
    );
  if (!supported) {
    throw new Error("governed_change_file_mode_unsupported");
  }
}

function normalizeUnifiedDiff(diff: string): string {
  const normalized = diff.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return normalized.endsWith("\n") ? normalized : `${normalized}\n`;
}

function countDiffLines(diff: string): { addedLines: number; deletedLines: number } {
  let addedLines = 0;
  let deletedLines = 0;
  for (const line of diff.split("\n")) {
    if (line.startsWith("+") && !line.startsWith("+++")) {
      addedLines += 1;
    }
    if (line.startsWith("-") && !line.startsWith("---")) {
      deletedLines += 1;
    }
  }
  return { addedLines, deletedLines };
}

function pathMatchesPattern(path: string, patternInput: string): boolean {
  let pattern: string;
  try {
    pattern = normalizeAndAssertPattern(patternInput);
  } catch {
    return false;
  }
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  const withDoubleStar = escaped.replace(/\*\*/g, "\0");
  const withSingleStar = withDoubleStar.replace(/\*/g, "[^/]*");
  const expression = withSingleStar.replace(/\0/g, ".*");
  return new RegExp(`^${expression}$`, "u").test(path);
}

function normalizeAndAssertPattern(pattern: string): string {
  const normalized = pattern.replace(/\\/g, "/");
  const withoutGlob = normalized.replace(/\*/g, "x");
  normalizeAndAssertGovernedPath(withoutGlob);
  return normalized;
}

async function runGit(
  runner: PreviewProcessRunner,
  cwd: string,
  argv: string[],
  env: NodeJS.ProcessEnv
): Promise<PreviewProcessResult> {
  const result = await runner.run({
    executable: "git",
    argv,
    cwd,
    timeoutMs: 60 * 1000,
    env
  });
  if (result.status !== "passed") {
    throw new Error("preview_git_command_failed");
  }
  return result;
}

async function runGitAllowFailure(
  runner: PreviewProcessRunner,
  cwd: string,
  argv: string[],
  env: NodeJS.ProcessEnv
): Promise<PreviewProcessResult> {
  return runner.run({
    executable: "git",
    argv,
    cwd,
    timeoutMs: 60 * 1000,
    env
  });
}

async function requireGit(
  runner: PreviewProcessRunner,
  cwd: string,
  argv: string[],
  env: NodeJS.ProcessEnv
): Promise<void> {
  await runGit(runner, cwd, argv, env);
}

async function requireProcessPass(
  runner: PreviewProcessRunner,
  input: PreviewProcessInput,
  errorClass: string
): Promise<void> {
  const result = await runner.run(input);
  if (result.status !== "passed") {
    throw new Error(errorClass);
  }
}

function createSanitizedEnv(tempRoot: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    CI: "true",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null",
    GIT_TERMINAL_PROMPT: "0",
    HOME: tempRoot,
    TMPDIR: tempRoot,
    TEMP: tempRoot,
    TMP: tempRoot
  };
  for (const key of ["PATH", "SystemRoot", "COMSPEC", "PATHEXT", "WINDIR"] as const) {
    const value = process.env[key];
    if (value !== undefined) {
      env[key] = value;
    }
  }
  return env;
}

function blockedReceipt(input: {
  changeSet: GovernedFileChangeSet;
  createdAt: string;
  isolation: PreviewIsolationAttestation;
  cleanupStatus: PreviewReceipt["cleanupStatus"];
  reasons: string[];
}): PreviewReceipt {
  return PreviewReceiptSchema.parse({
    receiptId: `preview_${input.changeSet.canonicalHash.slice(0, 24)}`,
    changeSetHash: input.changeSet.canonicalHash,
    headCommit: input.changeSet.baseHead,
    status: "blocked",
    networkIsolation: input.isolation.networkIsolation,
    filesystemIsolation: input.isolation.filesystemIsolation,
    isolationScope: input.isolation.scope,
    isolationEnforcerId: input.isolation.enforcerId,
    checks: [],
    cleanupStatus: input.cleanupStatus,
    reasons: uniqueStrings(input.reasons),
    createdAt: input.createdAt
  });
}

function parsePorcelainPaths(output: string): string[] {
  const records = output.split("\0").filter((record) => record !== "");
  const paths: string[] = [];
  for (const record of records) {
    if (record.length < 4 || record[2] !== " ") {
      throw new Error("preview_git_status_schema_drift");
    }
    const path = record.slice(3).replace(/\\/g, "/");
    paths.push(normalizeAndAssertGovernedPath(path));
  }
  return uniqueStrings(paths);
}

function compareCanonicalChanges(left: GovernedFileChange, right: GovernedFileChange): number {
  return compareCodeUnits(
    `${left.path}\0${left.kind}\0${left.oldPath ?? ""}`,
    `${right.path}\0${right.kind}\0${right.oldPath ?? ""}`
  );
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sameStringArrays(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sameHashMap(left: Map<string, string>, right: Map<string, string>): boolean {
  if (left.size !== right.size) {
    return false;
  }
  for (const [path, hash] of left) {
    if (right.get(path) !== hash) {
      return false;
    }
  }
  return true;
}

function isProtectedBranch(branch?: string): boolean {
  if (branch === undefined) {
    return true;
  }
  const normalized = branch.toLocaleLowerCase("en-US");
  return PROTECTED_BRANCHES.has(normalized)
    || normalized.startsWith("release/")
    || normalized.startsWith("production/");
}

function isContained(root: string, candidate: string): boolean {
  const pathRelative = relative(root, candidate);
  return pathRelative === ""
    || (!pathRelative.startsWith(`..${sep}`) && pathRelative !== ".." && !isAbsolute(pathRelative));
}

function sha256(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalizePreviewError(error: unknown): string {
  if (error instanceof Error && /^preview_[a-z0-9_]+$/.test(error.message)) {
    return error.message;
  }
  return "preview_unknown_error";
}

function isErrorCode(error: unknown, code: string): boolean {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && (error as { code?: unknown }).code === code;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function appendBounded(current: string, chunk: Buffer | string): string {
  const next = current + chunk.toString();
  return next.length > 1024 * 1024 ? next.slice(0, 1024 * 1024) : next;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)].sort(compareCodeUnits);
}
