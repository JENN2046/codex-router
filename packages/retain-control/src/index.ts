import { createHash } from "node:crypto";
import { execFile, spawn } from "node:child_process";
import {
  lstat,
  mkdir,
  mkdtemp,
  open,
  readFile,
  readdir,
  realpath,
  rename,
  rm
} from "node:fs/promises";
import { tmpdir } from "node:os";
import {
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep
} from "node:path";
import { posix as pathPosix } from "node:path";
import { promisify } from "node:util";
import { z } from "zod";
import {
  AuthorizationDecisionSchema,
  GovernedFileChangeSetSchema,
  PreviewReceiptSchema,
  RetainPermitSchema,
  RetainReceiptSchema,
  RetainTargetHashSchema,
  RollbackPermitSchema,
  hashKernelObject,
  type AuthorizationDecision,
  type GovernedFileChangeSet,
  type PreviewReceipt,
  type RetainPermit,
  type RetainReceipt,
  type RollbackPermit
} from "../../kernel-contracts/src/index.js";

const execFileAsync = promisify(execFile);
const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const GitObjectIdSchema = z.string().regex(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/);
const WINDOWS_RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;
const UNSAFE_TARGET_PATH_CHARACTERS = /[\u0000-\u001f\u007f<>:"|?*\[\]]/;

export const PendingApprovalJournalStateSchema = z.enum([
  "pending_accept",
  "accepted",
  "retained",
  "post_checked",
  "blocked",
  "reconciliation_required"
]);

const PendingApprovalJournalEntryFieldsSchema = z.object({
  schemaVersion: z.literal("pending-approval-journal.v1").default(
    "pending-approval-journal.v1"
  ),
  journalId: z.string().min(1),
  threadId: z.string().min(1),
  turnId: z.string().min(1),
  itemId: z.string().min(1),
  requestId: z.string().min(1),
  changeSetHash: Sha256Schema,
  authorizationDecisionHash: Sha256Schema,
  previewReceiptHash: Sha256Schema.optional(),
  headCommit: z.string().min(1),
  targetFiles: z.array(z.string().min(1)).min(1),
  targetHashes: z.array(RetainTargetHashSchema).min(1),
  retainPermit: RetainPermitSchema,
  retainReceipt: RetainReceiptSchema.optional(),
  state: PendingApprovalJournalStateSchema,
  reasons: z.array(z.string().min(1)).default([]),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1)
}).strict();

export const PendingApprovalJournalEntrySchema = PendingApprovalJournalEntryFieldsSchema
  .superRefine((entry, ctx) => {
    const receiptRequired = entry.state === "retained" || entry.state === "post_checked";
    if (receiptRequired && entry.retainReceipt === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "retained journal state requires a retain receipt",
        path: ["retainReceipt"]
      });
    }
    if (entry.retainReceipt !== undefined) {
      if (
        entry.retainReceipt.permitId !== entry.retainPermit.permitId
        || entry.retainReceipt.changeSetHash !== entry.changeSetHash
        || hashKernelObject(entry.retainReceipt.targetHashes) !== hashKernelObject(entry.targetHashes)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "journal retain receipt binding mismatch",
          path: ["retainReceipt"]
        });
      }
      if (
        entry.state !== "retained"
        && entry.state !== "post_checked"
        && entry.state !== "reconciliation_required"
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "retain receipt is invalid before retained state",
          path: ["retainReceipt"]
        });
      }
    }
  });

export type PendingApprovalJournalState = z.infer<typeof PendingApprovalJournalStateSchema>;
export type PendingApprovalJournalEntry = z.infer<typeof PendingApprovalJournalEntrySchema>;

export interface PendingApprovalJournalStore {
  put(entry: PendingApprovalJournalEntry): Promise<void>;
  get(journalId: string): Promise<PendingApprovalJournalEntry | undefined>;
  update(
    journalId: string,
    update: (current: PendingApprovalJournalEntry) => PendingApprovalJournalEntry
  ): Promise<PendingApprovalJournalEntry>;
  list(): Promise<PendingApprovalJournalEntry[]>;
}

export class InMemoryPendingApprovalJournalStore implements PendingApprovalJournalStore {
  private readonly entries = new Map<string, PendingApprovalJournalEntry>();

  async put(entryInput: PendingApprovalJournalEntry): Promise<void> {
    const entry = PendingApprovalJournalEntrySchema.parse(entryInput);
    if (this.entries.has(entry.journalId)) {
      throw new Error("pending_journal_duplicate_entry");
    }
    this.entries.set(entry.journalId, cloneJournalEntry(entry));
  }

  async get(journalId: string): Promise<PendingApprovalJournalEntry | undefined> {
    const entry = this.entries.get(journalId);
    return entry === undefined ? undefined : cloneJournalEntry(entry);
  }

  async update(
    journalId: string,
    update: (current: PendingApprovalJournalEntry) => PendingApprovalJournalEntry
  ): Promise<PendingApprovalJournalEntry> {
    const current = this.entries.get(journalId);
    if (current === undefined) {
      throw new Error("pending_journal_entry_missing");
    }
    const next = PendingApprovalJournalEntrySchema.parse(update(cloneJournalEntry(current)));
    assertJournalIdentityStable(current, next);
    assertJournalTransition(current.state, next.state);
    this.entries.set(journalId, cloneJournalEntry(next));
    return cloneJournalEntry(next);
  }

  async list(): Promise<PendingApprovalJournalEntry[]> {
    return [...this.entries.values()]
      .map(cloneJournalEntry)
      .sort((left, right) => compareCodeUnits(left.journalId, right.journalId));
  }
}

export interface FilePendingApprovalJournalStoreOptions {
  baseDir: string;
  requireDirectoryFsync?: boolean;
}

export class FilePendingApprovalJournalStore implements PendingApprovalJournalStore {
  private readonly baseDir: string;
  private readonly requireDirectoryFsync: boolean;

  constructor(options: FilePendingApprovalJournalStoreOptions) {
    this.baseDir = resolve(options.baseDir);
    this.requireDirectoryFsync = options.requireDirectoryFsync ?? true;
  }

  async put(entryInput: PendingApprovalJournalEntry): Promise<void> {
    const entry = PendingApprovalJournalEntrySchema.parse(entryInput);
    await this.withLock(entry.journalId, async () => {
      const finalPath = this.entryPath(entry.journalId);
      if (await pathExists(finalPath)) {
        throw new Error("pending_journal_duplicate_entry");
      }
      await this.writeAtomic(finalPath, entry, false);
    });
  }

  async get(journalId: string): Promise<PendingApprovalJournalEntry | undefined> {
    await this.ensureBaseDirectory();
    const path = this.entryPath(journalId);
    try {
      return PendingApprovalJournalEntrySchema.parse(
        JSON.parse(await readFile(path, "utf8"))
      );
    } catch (error) {
      if (isErrorCode(error, "ENOENT")) {
        return undefined;
      }
      if (error instanceof z.ZodError || error instanceof SyntaxError) {
        throw new Error("pending_journal_entry_corrupt");
      }
      throw error;
    }
  }

  async update(
    journalId: string,
    update: (current: PendingApprovalJournalEntry) => PendingApprovalJournalEntry
  ): Promise<PendingApprovalJournalEntry> {
    return this.withLock(journalId, async () => {
      const current = await this.readRequired(journalId);
      const next = PendingApprovalJournalEntrySchema.parse(update(cloneJournalEntry(current)));
      assertJournalIdentityStable(current, next);
      assertJournalTransition(current.state, next.state);
      await this.writeAtomic(this.entryPath(journalId), next, true);
      return cloneJournalEntry(next);
    });
  }

  async list(): Promise<PendingApprovalJournalEntry[]> {
    await this.ensureBaseDirectory();
    const entries: PendingApprovalJournalEntry[] = [];
    for (const name of (await readdir(this.baseDir)).sort(compareCodeUnits)) {
      if (!name.endsWith(".json")) {
        continue;
      }
      try {
        entries.push(PendingApprovalJournalEntrySchema.parse(
          JSON.parse(await readFile(join(this.baseDir, name), "utf8"))
        ));
      } catch {
        throw new Error("pending_journal_entry_corrupt");
      }
    }
    return entries.sort((left, right) => compareCodeUnits(left.journalId, right.journalId));
  }

  private async readRequired(journalId: string): Promise<PendingApprovalJournalEntry> {
    const entry = await this.get(journalId);
    if (entry === undefined) {
      throw new Error("pending_journal_entry_missing");
    }
    return entry;
  }

  private async ensureBaseDirectory(): Promise<void> {
    await mkdir(this.baseDir, { recursive: true, mode: 0o700 });
    const stats = await lstat(this.baseDir);
    if (!stats.isDirectory() || stats.isSymbolicLink()) {
      throw new Error("pending_journal_base_directory_unsafe");
    }
    const resolved = await realpath(this.baseDir);
    if (resolved !== this.baseDir) {
      throw new Error("pending_journal_base_directory_alias");
    }
  }

  private entryPath(journalId: string): string {
    return join(this.baseDir, `${sha256(journalId)}.json`);
  }

  private lockPath(journalId: string): string {
    return join(this.baseDir, `${sha256(journalId)}.lock`);
  }

  private async withLock<T>(journalId: string, operation: () => Promise<T>): Promise<T> {
    await this.ensureBaseDirectory();
    const lockPath = this.lockPath(journalId);
    let lock;
    try {
      lock = await open(lockPath, "wx", 0o600);
      await lock.sync();
    } catch {
      throw new Error("pending_journal_lock_unavailable");
    }

    try {
      return await operation();
    } finally {
      await lock.close().catch(() => undefined);
      await rm(lockPath, { force: true }).catch(() => undefined);
    }
  }

  private async writeAtomic(
    finalPath: string,
    entry: PendingApprovalJournalEntry,
    replace: boolean
  ): Promise<void> {
    const tempPath = `${finalPath}.tmp`;
    let handle;
    try {
      handle = await open(tempPath, "wx", 0o600);
      await handle.writeFile(`${JSON.stringify(entry)}\n`, "utf8");
      await handle.sync();
      await handle.close();
      handle = undefined;
      if (!replace && await pathExists(finalPath)) {
        throw new Error("pending_journal_duplicate_entry");
      }
      await rename(tempPath, finalPath);
      await this.syncDirectory();
    } catch (error) {
      await handle?.close().catch(() => undefined);
      await rm(tempPath, { force: true }).catch(() => undefined);
      if (error instanceof Error && error.message.startsWith("pending_journal_")) {
        throw error;
      }
      throw new Error("pending_journal_atomic_write_failed");
    }
  }

  private async syncDirectory(): Promise<void> {
    if (!this.requireDirectoryFsync) {
      return;
    }
    let directory;
    try {
      directory = await open(this.baseDir, "r");
      await directory.sync();
    } catch {
      throw new Error("pending_journal_directory_fsync_unsupported");
    } finally {
      await directory?.close().catch(() => undefined);
    }
  }
}

export interface IssueRetainPermitInput {
  changeSet: GovernedFileChangeSet;
  authorizationDecision: AuthorizationDecision;
  previewReceipt?: PreviewReceipt;
  issuedAt: string;
  expiresAt: string;
  nonce: string;
}

export function issueRetainPermit(input: IssueRetainPermitInput): RetainPermit {
  const changeSet = GovernedFileChangeSetSchema.parse(input.changeSet);
  const authorization = AuthorizationDecisionSchema.parse(input.authorizationDecision);
  const preview = input.previewReceipt === undefined
    ? undefined
    : PreviewReceiptSchema.parse(input.previewReceipt);
  if (authorization.subjectId !== changeSet.changeSetId) {
    throw new Error("retain_permit_authorization_subject_mismatch");
  }
  if (
    authorization.approvalMode !== "policy_auto"
    && authorization.approvalMode !== "human_required"
  ) {
    throw new Error("retain_permit_approval_mode_invalid");
  }
  if (authorization.disposition === "blocked") {
    throw new Error("retain_permit_authorization_blocked");
  }
  if (changeSet.changes.some((change) => (
    change.kind !== "create" && change.kind !== "update"
  ))) {
    throw new Error("retain_permit_change_kind_unsupported");
  }
  if (changeSet.changes.some((change) => (
    change.afterHash === undefined
    || change.afterHash === null
    || (change.kind === "update" && (change.beforeHash === undefined || change.beforeHash === null))
  ))) {
    throw new Error("retain_permit_expected_hash_missing");
  }
  for (const change of changeSet.changes) {
    if (!authorization.authorizedCapabilities.some((scope) => (
      scope.kind === "file"
      && scope.access === "write"
      && scope.resource === change.path
    ))) {
      throw new Error(`retain_permit_authorized_target_missing:${change.path}`);
    }
  }
  if (authorization.approvalMode === "policy_auto") {
    if (
      preview === undefined
      || preview.status !== "preview_passed"
      || preview.changeSetHash !== changeSet.canonicalHash
      || preview.headCommit !== changeSet.baseHead
    ) {
      throw new Error("retain_permit_preview_required");
    }
  }
  assertValidTimeWindow(input.issuedAt, input.expiresAt, "retain_permit");
  const authorizationDecisionHash = hashKernelObject(authorization);
  const previewReceiptHash = preview === undefined ? undefined : hashKernelObject(preview);
  const targetFiles = changeSet.changes.map((change) => change.path).sort(compareCodeUnits);

  return RetainPermitSchema.parse({
    permitId: `retain_${changeSet.canonicalHash.slice(0, 20)}_${sha256(input.nonce).slice(0, 8)}`,
    changeSetHash: changeSet.canonicalHash,
    authorizationDecisionHash,
    ...(previewReceiptHash === undefined ? {} : { previewReceiptHash }),
    approvalMode: authorization.approvalMode,
    headCommit: changeSet.baseHead,
    targetFiles,
    issuedAt: input.issuedAt,
    expiresAt: input.expiresAt,
    nonceHash: sha256(input.nonce)
  });
}

export function createPendingApprovalJournalEntry(input: {
  journalId: string;
  requestId: string;
  changeSet: GovernedFileChangeSet;
  authorizationDecision: AuthorizationDecision;
  retainPermit: RetainPermit;
  previewReceipt?: PreviewReceipt;
  now: string;
}): PendingApprovalJournalEntry {
  const changeSet = GovernedFileChangeSetSchema.parse(input.changeSet);
  const authorization = AuthorizationDecisionSchema.parse(input.authorizationDecision);
  const permit = RetainPermitSchema.parse(input.retainPermit);
  const previewHash = input.previewReceipt === undefined
    ? undefined
    : hashKernelObject(PreviewReceiptSchema.parse(input.previewReceipt));
  if (
    permit.changeSetHash !== changeSet.canonicalHash
    || permit.authorizationDecisionHash !== hashKernelObject(authorization)
    || permit.previewReceiptHash !== previewHash
  ) {
    throw new Error("pending_journal_binding_mismatch");
  }

  return PendingApprovalJournalEntrySchema.parse({
    journalId: input.journalId,
    threadId: changeSet.threadId,
    turnId: changeSet.turnId,
    itemId: changeSet.itemId,
    requestId: input.requestId,
    changeSetHash: changeSet.canonicalHash,
    authorizationDecisionHash: permit.authorizationDecisionHash,
    ...(previewHash === undefined ? {} : { previewReceiptHash: previewHash }),
    headCommit: changeSet.baseHead,
    targetFiles: permit.targetFiles,
    targetHashes: changeSet.changes.map((change) => ({
      path: change.path,
      beforeHash: change.kind === "create" ? null : change.beforeHash,
      afterHash: change.afterHash
    })),
    retainPermit: permit,
    state: "pending_accept",
    reasons: [],
    createdAt: input.now,
    updatedAt: input.now
  });
}

export type RetainVerificationResult =
  | { status: "retained"; receipt: RetainReceipt; reasons: [] }
  | { status: "reconciliation_required"; reasons: string[] };

/** Internal accept-adjacent guard; intentionally absent from public facades. */
export async function revalidateBaseCheckoutBeforeAcceptance(input: {
  cwd: string;
  changeSet: GovernedFileChangeSet;
}): Promise<string[]> {
  const parsed = GovernedFileChangeSetSchema.safeParse(input.changeSet);
  if (!parsed.success) {
    return ["accept_base_change_set_invalid"];
  }
  const changeSet = parsed.data;
  if (!GitObjectIdSchema.safeParse(changeSet.baseHead).success) {
    return ["accept_base_head_object_id_invalid"];
  }
  try {
    const filterReasons = await collectActiveConfiguredGitFilterReasons(input.cwd, "retain");
    if (filterReasons.length > 0) {
      return ["accept_source_filters_unsupported"];
    }
    const submoduleReasons = await collectTrackedSubmoduleReasons(input.cwd, "retain");
    if (submoduleReasons.length > 0) {
      return ["accept_source_submodules_unsupported"];
    }
    const partialCloneReasons = await collectPartialCloneReasons(input.cwd, "retain");
    if (partialCloneReasons.length > 0) {
      return ["accept_source_partial_clone_unsupported"];
    }
    const baseReasons: string[] = [];
    for (const change of changeSet.changes) {
      const basePathExists = await commitPathExists(
        input.cwd,
        changeSet.baseHead,
        change.path
      );
      if (change.kind === "create" && basePathExists) {
        baseReasons.push(`accept_base_create_target_present:${change.path}`);
      }
      if (change.kind === "update" && !basePathExists) {
        baseReasons.push(`accept_base_update_target_missing:${change.path}`);
      }
    }
    if (baseReasons.length > 0) {
      return uniqueStrings(baseReasons);
    }
    const updates = changeSet.changes.filter((change) => change.kind === "update");
    const restorableHashes = await readCommitWorktreeHashes(
      input.cwd,
      changeSet.baseHead,
      updates.map((change) => change.path)
    );
    return uniqueStrings(updates.flatMap((change) => (
      change.beforeHash !== undefined
      && change.beforeHash !== null
      && restorableHashes.get(change.path) === change.beforeHash
        ? []
        : [`accept_base_worktree_hash_mismatch:${change.path}`]
    )));
  } catch {
    return ["accept_base_worktree_snapshot_failed"];
  }
}

export async function verifyRetainedChange(input: {
  cwd: string;
  changeSet: GovernedFileChangeSet;
  permit: RetainPermit;
  now: string;
}): Promise<RetainVerificationResult> {
  const reasons: string[] = [];
  try {
    const changeSet = GovernedFileChangeSetSchema.parse(input.changeSet);
    const permit = RetainPermitSchema.parse(input.permit);
    reasons.push(...validateRetainPermit(changeSet, permit, input.now));
    if (!GitObjectIdSchema.safeParse(permit.headCommit).success) {
      reasons.push("retain_head_object_id_invalid");
      return { status: "reconciliation_required", reasons: uniqueStrings(reasons) };
    }
    const repositoryBoundaryReasons = [
      ...await collectActiveConfiguredGitFilterReasons(input.cwd, "retain", {
        paths: changeSet.changes.map((change) => change.path)
      }),
      ...await collectTrackedSubmoduleReasons(input.cwd, "retain"),
      ...await collectPartialCloneReasons(input.cwd, "retain")
    ];
    reasons.push(...repositoryBoundaryReasons);
    if (repositoryBoundaryReasons.length > 0) {
      return {
        status: "reconciliation_required",
        reasons: uniqueStrings(reasons)
      };
    }
    const repository = await inspectRepository(input.cwd, "retain", permit.targetFiles);
    if (repository.headCommit !== permit.headCommit) {
      reasons.push("retain_head_mismatch");
    }
    if (repository.indexChanged) {
      reasons.push("retain_index_changed");
    }
    if (!sameStringArrays(repository.changedPaths, permit.targetFiles)) {
      reasons.push("retain_outside_or_missing_target_changes");
    }
    const topologyReasons = await collectTargetTopologyReasons(input.cwd, permit.targetFiles);
    reasons.push(...topologyReasons);
    if (topologyReasons.length > 0) {
      return {
        status: "reconciliation_required",
        reasons: uniqueStrings(reasons)
      };
    }
    const basePathPresence = new Map<string, boolean>();
    for (const change of changeSet.changes) {
      basePathPresence.set(
        change.path,
        await commitPathExists(input.cwd, permit.headCommit, change.path)
      );
    }
    const baseWorktreeHashes = await readCommitWorktreeHashes(
      input.cwd,
      permit.headCommit,
      changeSet.changes
        .filter((change) => (
          change.kind === "update" && basePathPresence.get(change.path) === true
        ))
        .map((change) => change.path)
    );
    const targetHashes: RetainReceipt["targetHashes"] = [];
    for (const change of changeSet.changes) {
      const basePathExists = basePathPresence.get(change.path) === true;
      // Governed beforeHash values describe the bytes observed in the worktree
      // immediately before acceptance. Checkout conversions can legitimately
      // make those bytes differ from the normalized Git blob.
      const before = change.kind === "create" ? null : change.beforeHash ?? null;
      const after = await readWorkspacePathHash(input.cwd, change.path);
      if (change.kind === "create" && basePathExists) {
        reasons.push(`retain_create_before_present:${change.path}`);
      }
      if (change.kind === "update") {
        if (!basePathExists) {
          reasons.push(`retain_update_before_missing:${change.path}`);
        }
        const expectedBeforeHash = baseWorktreeHashes.get(change.path);
        if (
          change.beforeHash === undefined
          || change.beforeHash === null
          || expectedBeforeHash === undefined
          || change.beforeHash !== expectedBeforeHash
        ) {
          reasons.push(`retain_before_hash_mismatch:${change.path}`);
        }
      }
      if (after === null) {
        reasons.push(`retain_after_target_missing:${change.path}`);
        continue;
      }
      if (change.afterHash === undefined || change.afterHash === null) {
        reasons.push(`retain_after_hash_missing:${change.path}`);
      } else if (change.afterHash !== after) {
        reasons.push(`retain_after_hash_mismatch:${change.path}`);
      }
      targetHashes.push({ path: change.path, beforeHash: before, afterHash: after });
    }
    const uniqueReasons = uniqueStrings(reasons);
    if (uniqueReasons.length > 0) {
      return {
        status: "reconciliation_required",
        reasons: uniqueReasons
      };
    }

    const repositoryIdentityHash = repository.identityHash;
    const receipt = RetainReceiptSchema.parse({
      receiptId: `retained_${changeSet.canonicalHash.slice(0, 24)}`,
      permitId: permit.permitId,
      changeSetHash: changeSet.canonicalHash,
      ...(permit.previewReceiptHash === undefined
        ? {}
        : { previewReceiptHash: permit.previewReceiptHash }),
      headCommit: permit.headCommit,
      repositoryIdentityHash,
      targetHashes,
      noOutsideTargetChanges: true,
      retainedAt: input.now
    });
    return { status: "retained", receipt, reasons: [] };
  } catch (error) {
    return {
      status: "reconciliation_required",
      reasons: uniqueStrings([...reasons, normalizeRetainError(error)])
    };
  }
}

export interface RollbackPermitConsumptionStore {
  consume(key: string): boolean | Promise<boolean>;
}

type RollbackPermitConsumeOperation = (
  key: string
) => boolean | Promise<boolean>;

const trustedRollbackConsumptionOperations = new WeakMap<
  RollbackPermitConsumptionStore,
  RollbackPermitConsumeOperation
>();

export class InMemoryRollbackPermitConsumptionStore implements RollbackPermitConsumptionStore {
  private readonly consumeOperation: RollbackPermitConsumeOperation;

  constructor() {
    const consumed = new Set<string>();
    this.consumeOperation = (key) => {
      if (consumed.has(key)) {
        return false;
      }
      consumed.add(key);
      return true;
    };
    trustedRollbackConsumptionOperations.set(this, this.consumeOperation);
  }

  consume(key: string): boolean {
    return this.consumeOperation(key) as boolean;
  }
}

class FileRollbackPermitConsumptionStoreBase implements RollbackPermitConsumptionStore {
  private readonly consumeOperation: RollbackPermitConsumeOperation;

  constructor(
    baseDir: string,
    requireDirectoryFsync: boolean,
    registerTrusted: boolean
  ) {
    const resolvedBaseDir = resolve(baseDir);
    this.consumeOperation = (key) => consumeRollbackPermitMarker(
      resolvedBaseDir,
      requireDirectoryFsync,
      key
    );
    if (registerTrusted) {
      trustedRollbackConsumptionOperations.set(this, this.consumeOperation);
    }
  }

  async consume(key: string): Promise<boolean> {
    return this.consumeOperation(key) as Promise<boolean>;
  }
}

export class FileRollbackPermitConsumptionStore
  extends FileRollbackPermitConsumptionStoreBase {
  constructor(baseDir: string) {
    super(baseDir, true, true);
  }
}

/** Internal test seam; intentionally absent from the public evidence facade. */
export function createTestOnlyFileRollbackPermitConsumptionStore(
  baseDir: string
): RollbackPermitConsumptionStore {
  return new FileRollbackPermitConsumptionStoreBase(baseDir, false, true);
}

/** Internal test seam; intentionally absent from the public evidence facade. */
export function createTestOnlyRollbackPermitConsumptionStore(
  consume: (key: string) => boolean | Promise<boolean>
): RollbackPermitConsumptionStore {
  const store: RollbackPermitConsumptionStore = { consume };
  trustedRollbackConsumptionOperations.set(store, consume);
  return store;
}

async function consumeRollbackPermitMarker(
  baseDir: string,
  requireDirectoryFsync: boolean,
  key: string
): Promise<boolean> {
  await mkdir(baseDir, { recursive: true, mode: 0o700 });
  const stats = await lstat(baseDir);
  if (!stats.isDirectory() || stats.isSymbolicLink()) {
    throw new Error("rollback_consumption_directory_unsafe");
  }
  if (await realpath(baseDir) !== baseDir) {
    throw new Error("rollback_consumption_directory_alias");
  }
  const path = join(baseDir, `${sha256(key)}.consumed`);
  let handle;
  try {
    handle = await open(path, "wx", 0o600);
    await handle.writeFile(`${sha256(key)}\n`, "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;
    if (requireDirectoryFsync) {
      await syncRollbackConsumptionDirectory(baseDir);
    }
    return true;
  } catch (error) {
    if (isErrorCode(error, "EEXIST")) {
      return false;
    }
    throw error;
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

async function syncRollbackConsumptionDirectory(baseDir: string): Promise<void> {
  let directory;
  try {
    directory = await open(baseDir, "r");
    await directory.sync();
  } catch {
    throw new Error("rollback_consumption_directory_fsync_unsupported");
  } finally {
    await directory?.close().catch(() => undefined);
  }
}

export function issueRollbackPermit(input: {
  receipt: RetainReceipt;
  operatorId: string;
  issuedAt: string;
  expiresAt: string;
  nonce: string;
}): RollbackPermit {
  const receipt = RetainReceiptSchema.parse(input.receipt);
  assertValidTimeWindow(input.issuedAt, input.expiresAt, "rollback_permit");
  return RollbackPermitSchema.parse({
    permitId: `rollback_${receipt.receiptId}_${sha256(input.nonce).slice(0, 8)}`,
    receiptId: receipt.receiptId,
    receiptHash: hashKernelObject(receipt),
    operatorId: input.operatorId,
    expectedHead: receipt.headCommit,
    targetFiles: receipt.targetHashes.map((target) => target.path).sort(compareCodeUnits),
    issuedAt: input.issuedAt,
    expiresAt: input.expiresAt,
    nonceHash: sha256(input.nonce)
  });
}

export interface WorkspaceTargetRestorePrimitive {
  restore(input: {
    cwd: string;
    receipt: RetainReceipt;
  }): Promise<void>;
}

const rollbackRestoreTestHooks = new WeakMap<
  GitWorkspaceTargetRestorePrimitive,
  {
    beforeFinalFilterCheck(): Promise<void>;
    beforeRestoreAfterFilterCheck(activeDrivers: readonly string[]): Promise<void>;
  }
>();

export class GitWorkspaceTargetRestorePrimitive implements WorkspaceTargetRestorePrimitive {
  async restore(input: {
    cwd: string;
    receipt: RetainReceipt;
  }): Promise<void> {
    const receipt = RetainReceiptSchema.parse(input.receipt);
    assertGitObjectId(receipt.headCommit, "rollback_head_object_id_invalid");
    const updatePaths = receipt.targetHashes
      .filter((target) => target.beforeHash !== null)
      .map((target) => target.path);
    const createPaths = receipt.targetHashes
      .filter((target) => target.beforeHash === null)
      .map((target) => target.path);
    const paths = [...updatePaths, ...createPaths].sort(compareCodeUnits);
    if (paths.length === 0 || new Set(paths).size !== paths.length) {
      throw new Error("rollback_restore_targets_invalid");
    }
    for (const path of paths) {
      assertSafeRelativePath(path);
    }
    const adjacentPreconditions = await validateRollbackWorkspaceState(input.cwd, receipt);
    if (adjacentPreconditions.length > 0) {
      throw new Error(`rollback_restore_precondition_failed:${adjacentPreconditions.join(",")}`);
    }
    if (updatePaths.length > 0) {
      await rollbackRestoreTestHooks.get(this)?.beforeFinalFilterCheck();
      const restoreIndexRoot = await mkdtemp(join(tmpdir(), "codex-router-rollback-index-"));
      const restoreEnvironment: NodeJS.ProcessEnv = {
        ...process.env,
        GIT_INDEX_FILE: join(restoreIndexRoot, "index"),
        GIT_WORK_TREE: input.cwd,
        GIT_OPTIONAL_LOCKS: "0",
        GIT_NO_LAZY_FETCH: "1",
        GIT_TERMINAL_PROMPT: "0"
      };
      try {
        await gitBufferWithEnv(input.cwd, [
          "-c",
          "core.splitIndex=false",
          "-c",
          "core.sparseCheckout=false",
          "-c",
          "core.sparseCheckoutCone=false",
          "read-tree",
          "--no-sparse-checkout",
          receipt.headCommit
        ], restoreEnvironment);
        const activeDrivers = new Set<string>();
        const worktreeFilterReasons = await collectActiveConfiguredGitFilterReasons(
          input.cwd,
          "rollback",
          {
            paths: updatePaths,
            includeTrackedPaths: false,
            activeDriverSink: activeDrivers
          }
        );
        const cachedFilterReasons = await collectActiveConfiguredGitFilterReasons(
          input.cwd,
          "rollback",
          {
            env: restoreEnvironment,
            paths: updatePaths,
            includeTrackedPaths: false,
            attributeViews: ["cached"],
            activeDriverSink: activeDrivers
          }
        );
        const filterReasons = uniqueStrings([
          ...worktreeFilterReasons,
          ...cachedFilterReasons
        ]);
        if (filterReasons.length > 0) {
          throw new Error(`rollback_restore_precondition_failed:${filterReasons.join(",")}`);
        }
        const sortedActiveDrivers = [...activeDrivers].sort(compareCodeUnits);
        await rollbackRestoreTestHooks.get(this)?.beforeRestoreAfterFilterCheck(
          sortedActiveDrivers
        );
        const restoreEnvironmentWithOverrides = appendGitConfigEnvironmentOverrides(
          restoreEnvironment,
          sortedActiveDrivers.flatMap((driver) => [
            [`filter.${driver}.clean`, ""] as const,
            [`filter.${driver}.smudge`, ""] as const,
            [`filter.${driver}.process`, ""] as const,
            [`filter.${driver}.required`, "false"] as const
          ])
        );
        await gitBufferWithEnv(input.cwd, [
          "-c",
          "core.splitIndex=false",
          "-c",
          "core.sparseCheckout=false",
          "-c",
          "core.sparseCheckoutCone=false",
          "--literal-pathspecs",
          "restore",
          "--worktree",
          `--source=${receipt.headCommit}`,
          "--",
          ...updatePaths
        ], restoreEnvironmentWithOverrides);
      } finally {
        await rm(restoreIndexRoot, { recursive: true, force: true });
      }
    }
    for (const path of createPaths) {
      await rm(join(input.cwd, ...path.split("/")), { force: false, recursive: false });
    }
  }
}

/** Internal deterministic seam; intentionally absent from the public evidence facade. */
export function createTestOnlyGitWorkspaceTargetRestorePrimitive(input: {
  beforeFinalFilterCheck(): Promise<void>;
  beforeRestoreAfterFilterCheck?(activeDrivers: readonly string[]): Promise<void>;
}): GitWorkspaceTargetRestorePrimitive {
  const primitive = new GitWorkspaceTargetRestorePrimitive();
  rollbackRestoreTestHooks.set(primitive, {
    beforeFinalFilterCheck: input.beforeFinalFilterCheck.bind(input),
    beforeRestoreAfterFilterCheck: input.beforeRestoreAfterFilterCheck?.bind(input)
      ?? (async () => undefined)
  });
  return primitive;
}

export type GovernedRollbackResult =
  | { status: "rolled_back"; reasons: []; permitId: string; receiptId: string }
  | { status: "blocked" | "reconciliation_required"; reasons: string[]; permitId: string; receiptId: string };

export async function runGovernedRollback(input: {
  cwd: string;
  receipt: RetainReceipt;
  permit: RollbackPermit;
  consumptionStore: RollbackPermitConsumptionStore;
  now: string;
}): Promise<GovernedRollbackResult> {
  return runGovernedRollbackWithPrimitive({
    ...input,
    restorePrimitive: new GitWorkspaceTargetRestorePrimitive()
  });
}

/** Internal deterministic seam; intentionally absent from the public evidence facade. */
export async function runGovernedRollbackWithPrimitive(input: {
  cwd: string;
  receipt: RetainReceipt;
  permit: RollbackPermit;
  consumptionStore: RollbackPermitConsumptionStore;
  now: string;
  restorePrimitive: WorkspaceTargetRestorePrimitive;
}): Promise<GovernedRollbackResult> {
  const receipt = RetainReceiptSchema.parse(input.receipt);
  const permit = RollbackPermitSchema.parse(input.permit);
  const base = { permitId: permit.permitId, receiptId: receipt.receiptId };
  const consumePermit = trustedRollbackConsumptionOperations.get(
    input.consumptionStore
  );
  if (consumePermit === undefined) {
    return {
      ...base,
      status: "blocked",
      reasons: ["rollback_consumption_store_untrusted"]
    };
  }
  const lock = await acquireRollbackLock(input.cwd).catch(() => undefined);
  if (lock === undefined) {
    return { ...base, status: "blocked", reasons: ["rollback_lock_unavailable"] };
  }
  try {
    const preflight = await validateRollbackPreflight(input.cwd, receipt, permit, input.now);
    if (preflight.length > 0) {
      return { ...base, status: "blocked", reasons: preflight };
    }
    const consumptionKey = hashKernelObject({
      schemaVersion: "rollback-consumption.v1",
      permitId: permit.permitId,
      receiptHash: permit.receiptHash,
      nonceHash: permit.nonceHash
    });
    let consumed: boolean;
    try {
      consumed = await consumePermit(consumptionKey);
    } catch {
      return {
        ...base,
        status: "reconciliation_required",
        reasons: ["rollback_consumption_store_failed"]
      };
    }
    if (!consumed) {
      return { ...base, status: "blocked", reasons: ["rollback_permit_replay"] };
    }
    const adjacentPreflight = await validateRollbackWorkspaceState(input.cwd, receipt);
    if (adjacentPreflight.length > 0) {
      return {
        ...base,
        status: "reconciliation_required",
        reasons: adjacentPreflight
      };
    }
    try {
      await input.restorePrimitive.restore({ cwd: input.cwd, receipt });
    } catch {
      return {
        ...base,
        status: "reconciliation_required",
        reasons: ["rollback_restore_failed_or_partial"]
      };
    }

    const verification = await verifyRollbackPostState(input.cwd, receipt);
    if (verification.length > 0) {
      return {
        ...base,
        status: "reconciliation_required",
        reasons: verification
      };
    }
    return { ...base, status: "rolled_back", reasons: [] };
  } finally {
    await lock.release();
  }
}

async function validateRollbackPreflight(
  cwd: string,
  receipt: RetainReceipt,
  permit: RollbackPermit,
  now: string
): Promise<string[]> {
  const reasons: string[] = [];
  if (!GitObjectIdSchema.safeParse(receipt.headCommit).success) {
    reasons.push("rollback_head_object_id_invalid");
    return reasons;
  }
  if (permit.receiptId !== receipt.receiptId || permit.receiptHash !== hashKernelObject(receipt)) {
    reasons.push("rollback_receipt_binding_mismatch");
  }
  if (permit.expectedHead !== receipt.headCommit) {
    reasons.push("rollback_permit_head_binding_mismatch");
  }
  const targetFiles = receipt.targetHashes.map((target) => target.path).sort(compareCodeUnits);
  if (!sameStringArrays(permit.targetFiles, targetFiles)) {
    reasons.push("rollback_permit_target_binding_mismatch");
  }
  if (isExpired(permit.expiresAt, now) || Date.parse(now) < Date.parse(permit.issuedAt)) {
    reasons.push("rollback_permit_expired_or_not_yet_valid");
  }
  reasons.push(...await validateRollbackWorkspaceState(cwd, receipt));
  return uniqueStrings(reasons);
}

async function validateRollbackWorkspaceState(
  cwd: string,
  receipt: RetainReceipt
): Promise<string[]> {
  const reasons: string[] = [];
  const targetFiles = receipt.targetHashes.map((target) => target.path).sort(compareCodeUnits);
  const repositoryBoundaryReasons = [
    ...await collectActiveConfiguredGitFilterReasons(cwd, "rollback", {
      paths: targetFiles,
      attributeViews: ["worktree", "cached"]
    }),
    ...await collectTrackedSubmoduleReasons(cwd, "rollback"),
    ...await collectPartialCloneReasons(cwd, "rollback")
  ];
  reasons.push(...repositoryBoundaryReasons);
  if (repositoryBoundaryReasons.length > 0) {
    return uniqueStrings(reasons);
  }
  try {
    const repository = await inspectRepository(cwd, "rollback", targetFiles);
    if (repository.headCommit !== receipt.headCommit) {
      reasons.push("rollback_head_drift");
    }
    if (repository.identityHash !== receipt.repositoryIdentityHash) {
      reasons.push("rollback_repository_identity_drift");
    }
    if (repository.indexChanged) {
      reasons.push("rollback_index_drift");
    }
    if (!sameStringArrays(repository.changedPaths, targetFiles)) {
      reasons.push("rollback_outside_or_missing_target_drift");
    }
    const topologyReasons = await collectTargetTopologyReasons(cwd, targetFiles);
    reasons.push(...topologyReasons);
    if (topologyReasons.length > 0) {
      return uniqueStrings(reasons);
    }
    const updateTargets = receipt.targetHashes.filter((target) => target.beforeHash !== null);
    let restorableBeforeHashes: Map<string, string>;
    try {
      restorableBeforeHashes = await readCommitWorktreeHashes(
        cwd,
        receipt.headCommit,
        updateTargets.map((target) => target.path)
      );
    } catch {
      reasons.push("rollback_base_worktree_snapshot_failed");
      return uniqueStrings(reasons);
    }
    for (const target of updateTargets) {
      if (restorableBeforeHashes.get(target.path) !== target.beforeHash) {
        reasons.push(`rollback_checkout_configuration_drift:${target.path}`);
      }
    }
    if (reasons.length > 0) {
      return uniqueStrings(reasons);
    }
    for (const target of receipt.targetHashes) {
      const current = await readWorkspacePathHash(cwd, target.path);
      if (current !== target.afterHash) {
        reasons.push(`rollback_after_hash_drift:${target.path}`);
      }
    }
  } catch {
    reasons.push("rollback_repository_inspection_failed");
  }
  return uniqueStrings(reasons);
}

async function collectActiveConfiguredGitFilterReasons(
  cwd: string,
  operation: "retain" | "rollback",
  options: {
    env?: NodeJS.ProcessEnv;
    paths?: string[];
    includeTrackedPaths?: boolean;
    attributeViews?: Array<"worktree" | "cached">;
    activeDriverSink?: Set<string>;
  } = {}
): Promise<string[]> {
  try {
    const env = options.env ?? safeGitEnvironment();
    const trackedPathInput = options.includeTrackedPaths === false
      ? Buffer.alloc(0)
      : await gitBufferWithEnv(cwd, ["ls-files", "-z"], env);
    const additionalPathInput = options.paths === undefined || options.paths.length === 0
      ? Buffer.alloc(0)
      : Buffer.from(`${options.paths.join("\0")}\0`);
    const pathInput = Buffer.concat([trackedPathInput, additionalPathInput]);
    if (pathInput.length === 0) {
      return [];
    }
    const activeDrivers = new Set<string>();
    for (const view of options.attributeViews ?? ["worktree"]) {
      const attributes = await gitBufferWithInput(
        cwd,
        ["check-attr", ...(view === "cached" ? ["--cached"] : []), "--stdin", "-z", "filter"],
        pathInput,
        env
      );
      const fields = splitNullTerminatedBufferFields(
        attributes,
        `${operation}_git_filter_inspection_failed`
      );
      if (fields.length % 3 !== 0) {
        return [`${operation}_git_filter_inspection_failed`];
      }
      for (let index = 2; index < fields.length; index += 3) {
        const pathField = fields[index - 2];
        const attributeField = fields[index - 1];
        const value = fields[index];
        if (pathField === undefined || attributeField === undefined || value === undefined) {
          return [`${operation}_git_filter_inspection_failed`];
        }
        if (
          decodeUtf8BufferField(pathField, `${operation}_git_filter_inspection_failed`) === ""
          || decodeUtf8BufferField(
            attributeField,
            `${operation}_git_filter_inspection_failed`
          ) !== "filter"
        ) {
          return [`${operation}_git_filter_inspection_failed`];
        }
        // Git renders both the special Unspecified/Unset states and literal
        // driver names "unspecified"/"unset" with the same strings. Keep the
        // values and let the configured-driver intersection fail closed.
        activeDrivers.add(decodeUtf8BufferField(
          value,
          `${operation}_git_filter_inspection_failed`
        ));
      }
    }
    for (const driver of activeDrivers) {
      options.activeDriverSink?.add(driver);
    }
    if (activeDrivers.size === 0) {
      return [];
    }
    try {
      const configuredFilterKeys = await gitBufferWithEnv(cwd, [
        "config",
        "--null",
        "--name-only",
        "--get-regexp",
        "^filter\\..*\\.(clean|smudge|process)$"
      ], env);
      const configuredDrivers = splitNullTerminatedBufferFields(
        configuredFilterKeys,
        `${operation}_git_filter_inspection_failed`
      )
        .map((key) => decodeUtf8BufferField(
          key,
          `${operation}_git_filter_inspection_failed`
        ))
        .flatMap((key) => {
          const match = /^filter\.(.*)\.(?:clean|smudge|process)$/u.exec(key);
          return match?.[1] === undefined
            ? []
            : [match[1]];
        });
      return configuredDrivers.some((driver) => activeDrivers.has(driver))
        ? [`${operation}_git_filters_unsupported`]
        : [];
    } catch (error) {
      return isProcessExitCode(error, 1)
        ? []
        : [`${operation}_git_filter_inspection_failed`];
    }
  } catch {
    return [`${operation}_git_filter_inspection_failed`];
  }
}

async function collectTrackedSubmoduleReasons(
  cwd: string,
  operation: "retain" | "rollback"
): Promise<string[]> {
  try {
    const entries = (await gitBuffer(cwd, ["ls-files", "--stage", "-z"]))
      .toString("utf8")
      .split("\0")
      .filter((entry) => entry !== "");
    return entries.some((entry) => (
      entry.startsWith("160000 ") || entry.endsWith("\t.gitmodules")
    ))
      ? [`${operation}_submodules_unsupported`]
      : [];
  } catch {
    return [`${operation}_submodule_inspection_failed`];
  }
}

async function collectPartialCloneReasons(
  cwd: string,
  operation: "retain" | "rollback"
): Promise<string[]> {
  try {
    const configuredKeys = await gitBuffer(cwd, [
      "config",
      "--null",
      "--name-only",
      "--get-regexp",
      "^(extensions\\.partialclone|remote\\..*\\.promisor)$"
    ]);
    return configuredKeys.length === 0
      ? []
      : [`${operation}_partial_clone_unsupported`];
  } catch (error) {
    return isProcessExitCode(error, 1)
      ? []
      : [`${operation}_partial_clone_inspection_failed`];
  }
}

async function acquireRollbackLock(cwd: string): Promise<{
  release(): Promise<void>;
}> {
  const commonDirRaw = (await gitText(cwd, ["rev-parse", "--git-common-dir"])).trim();
  const commonDir = await realpath(isAbsolute(commonDirRaw)
    ? commonDirRaw
    : resolve(cwd, commonDirRaw));
  const lockPath = join(commonDir, "codex-router-rollback.lock");
  const handle = await open(lockPath, "wx", 0o600);
  try {
    await handle.writeFile(`${process.pid}\n`, "utf8");
    await handle.sync();
  } catch (error) {
    await handle.close().catch(() => undefined);
    await rm(lockPath, { force: true }).catch(() => undefined);
    throw error;
  }
  let released = false;
  return {
    async release(): Promise<void> {
      if (released) {
        return;
      }
      released = true;
      await handle.close().catch(() => undefined);
      await rm(lockPath, { force: true }).catch(() => undefined);
    }
  };
}

/** Internal deterministic seam; intentionally absent from public package exports. */
export async function createTestOnlyRollbackLock(cwd: string): Promise<{
  release(): Promise<void>;
}> {
  return acquireRollbackLock(cwd);
}

async function verifyRollbackPostState(cwd: string, receipt: RetainReceipt): Promise<string[]> {
  const reasons: string[] = [];
  try {
    const repository = await inspectRepository(
      cwd,
      "rollback",
      receipt.targetHashes.map((target) => target.path)
    );
    if (repository.headCommit !== receipt.headCommit) {
      reasons.push("rollback_post_head_mismatch");
    }
    if (repository.changedPaths.length > 0 || repository.indexChanged) {
      reasons.push("rollback_post_worktree_not_clean");
    }
    const restoredTargetTopologyReasons = uniqueStrings([
      ...await collectTargetTopologyReasons(
        cwd,
        receipt.targetHashes
          .filter((target) => target.beforeHash !== null)
          .map((target) => target.path)
      ),
      ...await collectTargetTopologyReasons(
        cwd,
        receipt.targetHashes
          .filter((target) => target.beforeHash === null)
          .map((target) => target.path),
        true
      )
    ]);
    reasons.push(...restoredTargetTopologyReasons);
    if (restoredTargetTopologyReasons.length > 0) {
      return uniqueStrings(reasons);
    }
    for (const target of receipt.targetHashes) {
      const current = await readWorkspacePathHash(cwd, target.path);
      if (current !== target.beforeHash) {
        reasons.push(`rollback_post_hash_mismatch:${target.path}`);
      }
    }
  } catch {
    reasons.push("rollback_post_verification_failed");
  }
  return uniqueStrings(reasons);
}

type RepositoryInspection = {
  headCommit: string;
  identityHash: string;
  changedPaths: string[];
  indexChanged: boolean;
};

async function inspectRepository(
  cwdInput: string,
  filterOperation: "retain" | "rollback",
  filterPaths: string[] = []
): Promise<RepositoryInspection> {
  const cwd = resolve(cwdInput);
  const topLevel = resolve((await gitText(cwd, ["rev-parse", "--show-toplevel"])).trim());
  const topLevelReal = await realpath(topLevel);
  const cwdReal = await realpath(cwd);
  if (topLevelReal !== cwdReal) {
    throw new Error("repository_root_mismatch");
  }
  const commonDirRaw = (await gitText(cwd, ["rev-parse", "--git-common-dir"])).trim();
  const commonDir = await realpath(isAbsolute(commonDirRaw)
    ? commonDirRaw
    : resolve(cwd, commonDirRaw));
  const headCommit = (await gitText(cwd, ["rev-parse", "HEAD"])).trim();
  const filterReasons = await collectActiveConfiguredGitFilterReasons(cwd, filterOperation, {
    paths: filterPaths,
    ...(filterOperation === "rollback"
      ? { attributeViews: ["worktree", "cached"] as const }
      : {})
  });
  if (filterReasons.length > 0) {
    throw new Error(filterReasons[0]);
  }
  const submoduleReasons = await collectTrackedSubmoduleReasons(cwd, filterOperation);
  if (submoduleReasons.length > 0) {
    throw new Error(submoduleReasons[0]);
  }
  const partialCloneReasons = await collectPartialCloneReasons(cwd, filterOperation);
  if (partialCloneReasons.length > 0) {
    throw new Error(partialCloneReasons[0]);
  }
  const status = await gitText(cwd, [
    "-c",
    "core.fsmonitor=false",
    "status",
    "--porcelain=v2",
    "-z",
    "--untracked-files=all",
    "--ignore-submodules=all"
  ]);
  const parsed = parsePorcelainV2(status);
  return {
    headCommit,
    identityHash: hashKernelObject({
      schemaVersion: "repository-identity.v1",
      worktreeRoot: topLevelReal,
      gitCommonDir: commonDir
    }),
    changedPaths: parsed.paths,
    indexChanged: parsed.indexChanged
  };
}

function parsePorcelainV2(output: string): { paths: string[]; indexChanged: boolean } {
  const records = output.split("\0").filter((record) => record !== "");
  const paths: string[] = [];
  let indexChanged = false;
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (record === undefined) {
      continue;
    }
    if (record.startsWith("? ")) {
      paths.push(normalizeAndAssertPath(record.slice(2)));
      continue;
    }
    if (record.startsWith("1 ")) {
      const match = /^1 ([^ ]{2}) [^ ]+ [^ ]+ [^ ]+ [^ ]+ [^ ]+ [^ ]+ (.*)$/s.exec(record);
      if (match?.[1] === undefined || match[2] === undefined) {
        throw new Error("porcelain_v2_schema_drift");
      }
      if (match[1][0] !== ".") {
        indexChanged = true;
      }
      paths.push(normalizeAndAssertPath(match[2]));
      continue;
    }
    if (record.startsWith("2 ")) {
      const match = /^2 ([^ ]{2}) [^ ]+ [^ ]+ [^ ]+ [^ ]+ [^ ]+ [^ ]+ [^ ]+ (.*)$/s.exec(record);
      if (match?.[1] === undefined || match[2] === undefined || records[index + 1] === undefined) {
        throw new Error("porcelain_v2_schema_drift");
      }
      indexChanged = true;
      paths.push(normalizeAndAssertPath(match[2]));
      index += 1;
      continue;
    }
    throw new Error("porcelain_v2_schema_drift");
  }
  return { paths: uniqueStrings(paths), indexChanged };
}

async function commitPathExists(
  cwd: string,
  commit: string,
  path: string
): Promise<boolean> {
  assertGitObjectId(commit, "retain_head_object_id_invalid");
  assertSafeRelativePath(path);
  const listed = await gitBuffer(cwd, [
    "--literal-pathspecs",
    "ls-tree",
    "-z",
    "--name-only",
    commit,
    "--",
    path
  ]);
  const names = listed.toString("utf8").split("\0").filter((name) => name !== "");
  return names.includes(path);
}

async function readCommitWorktreeHashes(
  cwd: string,
  commit: string,
  paths: string[]
): Promise<Map<string, string>> {
  assertGitObjectId(commit, "retain_head_object_id_invalid");
  for (const path of paths) {
    assertSafeRelativePath(path);
  }
  const hashes = new Map<string, string>();
  if (paths.length === 0) {
    return hashes;
  }
  const tempRoot = await mkdtemp(join(tmpdir(), "codex-router-retain-base-"));
  const worktreeRoot = join(tempRoot, "worktree");
  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    GIT_INDEX_FILE: join(tempRoot, "index"),
    GIT_WORK_TREE: worktreeRoot,
    GIT_OPTIONAL_LOCKS: "0",
    GIT_NO_LAZY_FETCH: "1",
    GIT_TERMINAL_PROMPT: "0"
  };
  try {
    await mkdir(worktreeRoot, { recursive: true });
    await gitBufferWithEnv(cwd, [
      "-c",
      "core.splitIndex=false",
      "-c",
      "core.sparseCheckout=false",
      "-c",
      "core.sparseCheckoutCone=false",
      "read-tree",
      "--no-sparse-checkout",
      commit
    ], environment);
    const filterReasons = await collectActiveConfiguredGitFilterReasons(cwd, "retain", {
      env: environment,
      paths,
      attributeViews: ["cached"]
    });
    if (filterReasons.length > 0) {
      throw new Error(filterReasons[0]);
    }
    // checkout-index uses an alternate index/worktree, so Git performs the
    // exact built-in checkout conversions without touching the source index or
    // worktree. Configured external filters were rejected immediately above.
    await gitBufferWithEnv(cwd, [
      "-c",
      "core.splitIndex=false",
      "-c",
      "core.sparseCheckout=false",
      "-c",
      "core.sparseCheckoutCone=false",
      "--literal-pathspecs",
      "checkout-index",
      "--force",
      "--",
      ...paths
    ], environment);
    for (const path of paths) {
      const target = join(worktreeRoot, ...path.split("/"));
      const stat = await lstat(target);
      if (!stat.isFile() || stat.nlink !== 1) {
        throw new Error("retain_base_worktree_topology_unsupported");
      }
      hashes.set(path, sha256(await readFile(target)));
    }
    return hashes;
  } catch {
    throw new Error("retain_base_worktree_snapshot_failed");
  } finally {
    await rm(tempRoot, { recursive: true, force: true }).catch(() => {
      throw new Error("retain_base_worktree_cleanup_failed");
    });
  }
}

async function readWorkspacePathHash(cwd: string, path: string): Promise<string | null> {
  try {
    return sha256(await readFile(join(cwd, ...path.split("/"))));
  } catch (error) {
    if (isErrorCode(error, "ENOENT")) {
      return null;
    }
    throw error;
  }
}

async function collectTargetTopologyReasons(
  cwd: string,
  paths: string[],
  allowMissingFinal = false
): Promise<string[]> {
  const root = await realpath(cwd);
  const reasons: string[] = [];
  for (const path of paths) {
    try {
      assertSafeRelativePath(path);
    } catch {
      reasons.push(`target_path_unsafe:${path}`);
      continue;
    }
    let current = cwd;
    const parts = path.split("/");
    for (const [index, part] of parts.entries()) {
      current = join(current, part);
      const final = index === parts.length - 1;
      try {
        const stats = await lstat(current);
        if (stats.isSymbolicLink()) {
          reasons.push(`target_symlink_forbidden:${path}`);
          break;
        }
        if (final && (!stats.isFile() || stats.nlink > 1)) {
          reasons.push(`target_not_single_link_file:${path}`);
          break;
        }
        const resolved = await realpath(current);
        if (!isContained(root, resolved)) {
          reasons.push(`target_outside_workspace:${path}`);
          break;
        }
      } catch (error) {
        if (allowMissingFinal && final && isErrorCode(error, "ENOENT")) {
          break;
        }
        reasons.push(`target_topology_unreadable:${path}`);
        break;
      }
    }
  }
  return uniqueStrings(reasons);
}

function validateRetainPermit(
  changeSet: GovernedFileChangeSet,
  permit: RetainPermit,
  now: string
): string[] {
  const targets = changeSet.changes.map((change) => change.path).sort(compareCodeUnits);
  return uniqueStrings([
    ...(permit.changeSetHash === changeSet.canonicalHash ? [] : ["retain_change_set_hash_mismatch"]),
    ...(permit.headCommit === changeSet.baseHead ? [] : ["retain_permit_head_mismatch"]),
    ...(sameStringArrays(permit.targetFiles, targets) ? [] : ["retain_permit_targets_mismatch"]),
    ...(isExpired(permit.expiresAt, now) || Date.parse(now) < Date.parse(permit.issuedAt)
      ? ["retain_permit_expired_or_not_yet_valid"]
      : [])
  ]);
}

function assertJournalIdentityStable(
  current: PendingApprovalJournalEntry,
  next: PendingApprovalJournalEntry
): void {
  for (const field of [
    "journalId",
    "threadId",
    "turnId",
    "itemId",
    "requestId",
    "changeSetHash",
    "authorizationDecisionHash",
    "previewReceiptHash",
    "headCommit",
    "createdAt"
  ] as const) {
    if (current[field] !== next[field]) {
      throw new Error(`pending_journal_identity_drift:${field}`);
    }
  }
  if (!sameStringArrays(current.targetFiles, next.targetFiles)) {
    throw new Error("pending_journal_identity_drift:targetFiles");
  }
  if (hashKernelObject(current.targetHashes) !== hashKernelObject(next.targetHashes)) {
    throw new Error("pending_journal_identity_drift:targetHashes");
  }
  if (hashKernelObject(current.retainPermit) !== hashKernelObject(next.retainPermit)) {
    throw new Error("pending_journal_identity_drift:retainPermit");
  }
}

function assertJournalTransition(
  current: PendingApprovalJournalState,
  next: PendingApprovalJournalState
): void {
  const allowed: Record<PendingApprovalJournalState, PendingApprovalJournalState[]> = {
    pending_accept: ["accepted", "blocked", "reconciliation_required"],
    accepted: ["retained", "blocked", "reconciliation_required"],
    retained: ["post_checked", "reconciliation_required"],
    post_checked: ["reconciliation_required"],
    blocked: ["reconciliation_required"],
    reconciliation_required: []
  };
  if (current !== next && !allowed[current].includes(next)) {
    throw new Error(`pending_journal_invalid_transition:${current}:${next}`);
  }
}

function assertValidTimeWindow(issuedAt: string, expiresAt: string, prefix: string): void {
  const issued = Date.parse(issuedAt);
  const expires = Date.parse(expiresAt);
  if (Number.isNaN(issued) || Number.isNaN(expires) || expires <= issued) {
    throw new Error(`${prefix}_time_window_invalid`);
  }
}

function assertSafeRelativePath(path: string): void {
  const normalized = normalizeAndAssertPath(path);
  if (normalized !== path) {
    throw new Error("target_path_not_canonical");
  }
}

function assertGitObjectId(input: string, errorClass: string): void {
  if (!GitObjectIdSchema.safeParse(input).success) {
    throw new Error(errorClass);
  }
}

function normalizeAndAssertPath(input: string): string {
  const slashPath = input.replace(/\\/g, "/");
  const normalized = pathPosix.normalize(slashPath);
  if (
    input.normalize("NFC") !== input
    || hasUnpairedUtf16Surrogate(input)
    || input === ""
    || normalized === "."
    || normalized === ".."
    || normalized.startsWith("../")
    || pathPosix.isAbsolute(normalized)
    || isAbsolute(input)
    || /^[a-zA-Z]:/.test(input)
    || slashPath.startsWith("//")
    || input.includes("\0")
    || input.includes("\n")
    || input.includes("\r")
    || normalized.split("/").some((part) => UNSAFE_TARGET_PATH_CHARACTERS.test(part))
    || normalized.split("/").some((part) => part.endsWith(".") || part.endsWith(" "))
    || normalized.split("/").some((part) => WINDOWS_RESERVED_NAMES.test(part))
    || normalized.split("/").some((part) => part.toLocaleLowerCase("en-US") === ".git")
  ) {
    throw new Error("target_path_unsafe");
  }
  return normalized;
}

function hasUnpairedUtf16Surrogate(input: string): boolean {
  for (let index = 0; index < input.length; index += 1) {
    const codeUnit = input.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = input.charCodeAt(index + 1);
      if (next < 0xdc00 || next > 0xdfff) {
        return true;
      }
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      return true;
    }
  }
  return false;
}

async function gitText(cwd: string, argv: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", argv, {
    cwd,
    encoding: "utf8",
    env: safeGitEnvironment(),
    windowsHide: true,
    maxBuffer: 20 * 1024 * 1024
  });
  return stdout;
}

async function gitBuffer(cwd: string, argv: string[]): Promise<Buffer> {
  const { stdout } = await execFileAsync("git", argv, {
    cwd,
    encoding: "buffer",
    env: safeGitEnvironment(),
    windowsHide: true,
    maxBuffer: 20 * 1024 * 1024
  });
  return stdout;
}

async function gitBufferWithEnv(
  cwd: string,
  argv: string[],
  env: NodeJS.ProcessEnv
): Promise<Buffer> {
  const { stdout } = await execFileAsync("git", argv, {
    cwd,
    encoding: "buffer",
    env: safeGitEnvironment(env),
    windowsHide: true,
    maxBuffer: 20 * 1024 * 1024
  });
  return stdout;
}

async function gitBufferWithInput(
  cwd: string,
  argv: string[],
  input: Buffer,
  env: NodeJS.ProcessEnv
): Promise<Buffer> {
  const maxBuffer = 20 * 1024 * 1024;
  if (input.length > maxBuffer) {
    throw new Error("git_input_buffer_exceeded");
  }
  return new Promise((resolveResult, rejectResult) => {
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let stdoutLength = 0;
    let stderrLength = 0;
    let settled = false;
    const child = spawn("git", argv, {
      cwd,
      env: safeGitEnvironment(env),
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"]
    });
    const rejectOnce = (error: Error): void => {
      if (settled) {
        return;
      }
      settled = true;
      child.kill();
      rejectResult(error);
    };
    child.stdout.on("data", (chunk: Buffer | string) => {
      const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      stdoutLength += value.length;
      if (stdoutLength > maxBuffer) {
        rejectOnce(new Error("git_output_buffer_exceeded"));
        return;
      }
      stdout.push(value);
    });
    child.stderr.on("data", (chunk: Buffer | string) => {
      const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      if (stderrLength < maxBuffer) {
        const remaining = maxBuffer - stderrLength;
        const bounded = value.subarray(0, remaining);
        stderr.push(bounded);
        stderrLength += bounded.length;
      }
    });
    child.on("error", (error) => rejectOnce(error));
    child.stdin.on("error", (error) => rejectOnce(error));
    child.on("close", (code) => {
      if (settled) {
        return;
      }
      settled = true;
      if (code === 0) {
        resolveResult(Buffer.concat(stdout));
        return;
      }
      const message = Buffer.concat(stderr).toString("utf8").trim();
      rejectResult(new Error(message === "" ? "git_command_failed" : message));
    });
    child.stdin.end(input);
  });
}

function splitNullTerminatedBufferFields(input: Buffer, errorClass: string): Buffer[] {
  if (input.length === 0) {
    return [];
  }
  if (input[input.length - 1] !== 0) {
    throw new Error(errorClass);
  }
  const fields: Buffer[] = [];
  let start = 0;
  for (let index = 0; index < input.length; index += 1) {
    if (input[index] === 0) {
      fields.push(input.subarray(start, index));
      start = index + 1;
    }
  }
  return fields;
}

function decodeUtf8BufferField(input: Buffer, errorClass: string): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(input);
  } catch {
    throw new Error(errorClass);
  }
}

/** Internal deterministic seam; intentionally absent from public package exports. */
export function createTestOnlyDecodeNullTerminatedGitFields(
  input: Uint8Array
): string[] {
  return splitNullTerminatedBufferFields(
    Buffer.from(input),
    "test_git_field_schema_drift"
  ).map((field) => decodeUtf8BufferField(field, "test_git_field_encoding_unsupported"));
}

function appendGitConfigEnvironmentOverrides(
  base: NodeJS.ProcessEnv,
  entries: ReadonlyArray<readonly [string, string]>
): NodeJS.ProcessEnv {
  const countText = base.GIT_CONFIG_COUNT?.trim() ?? "";
  if (countText !== "" && !/^(?:0|[1-9]\d*)$/u.test(countText)) {
    throw new Error("rollback_filter_override_environment_invalid");
  }
  const count = countText === "" ? 0 : Number.parseInt(countText, 10);
  if (!Number.isSafeInteger(count) || count > 10_000) {
    throw new Error("rollback_filter_override_environment_invalid");
  }
  const environment: NodeJS.ProcessEnv = { ...base };
  for (const [offset, [key, value]] of entries.entries()) {
    const index = count + offset;
    environment[`GIT_CONFIG_KEY_${index}`] = key;
    environment[`GIT_CONFIG_VALUE_${index}`] = value;
  }
  environment.GIT_CONFIG_COUNT = String(count + entries.length);
  return environment;
}

/** Internal deterministic seam; intentionally absent from public package exports. */
export function createTestOnlyGitConfigEnvironmentOverrides(input: {
  base: NodeJS.ProcessEnv;
  entries: ReadonlyArray<readonly [string, string]>;
}): NodeJS.ProcessEnv {
  return appendGitConfigEnvironmentOverrides(input.base, input.entries);
}

function safeGitEnvironment(base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {
    ...base,
    GIT_NO_LAZY_FETCH: "1",
    GIT_OPTIONAL_LOCKS: "0",
    GIT_TERMINAL_PROMPT: "0"
  };
  // GIT_CONFIG changes only `git config`; status/check-attr/restore ignore it.
  // Remove it so configuration inspection observes the same sources they do.
  delete environment.GIT_CONFIG;
  return environment;
}

function cloneJournalEntry(entry: PendingApprovalJournalEntry): PendingApprovalJournalEntry {
  return structuredClone(entry) as PendingApprovalJournalEntry;
}

function normalizeRetainError(error: unknown): string {
  if (error instanceof Error && /^[a-z0-9_:.-]+$/.test(error.message)) {
    return error.message;
  }
  return "retain_unknown_error";
}

function isExpired(expiresAt: string, now: string): boolean {
  const expires = Date.parse(expiresAt);
  const current = Date.parse(now);
  return Number.isNaN(expires) || Number.isNaN(current) || expires <= current;
}

function isContained(root: string, candidate: string): boolean {
  const value = relative(root, candidate);
  return value === ""
    || (!value.startsWith(`..${sep}`) && value !== ".." && !isAbsolute(value));
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch {
    return false;
  }
}

function sameStringArrays(left: string[], right: string[]): boolean {
  const leftSorted = [...left].sort(compareCodeUnits);
  const rightSorted = [...right].sort(compareCodeUnits);
  return leftSorted.length === rightSorted.length
    && leftSorted.every((value, index) => value === rightSorted[index]);
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)].sort(compareCodeUnits);
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function isErrorCode(error: unknown, code: string): boolean {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && (error as { code?: unknown }).code === code;
}

function isProcessExitCode(error: unknown, code: number): boolean {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && String((error as { code?: unknown }).code) === String(code);
}
