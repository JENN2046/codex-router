import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  symlink,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import {
  authorizeCapabilityFacts,
  deriveCapabilityFactsFromChangeSet
} from "../packages/authorization-kernel/src/index.js";
import {
  canonicalizeGovernedFileChangeSet
} from "../packages/file-change-preview/src/index.js";
import {
  PreviewReceiptSchema,
  hashKernelObject,
  type AuthorizationDecision,
  type GovernedFileChangeSet,
  type PreviewReceipt,
  type RetainPermit,
  type RetainReceipt
} from "../packages/kernel-contracts/src/index.js";
import {
  FilePendingApprovalJournalStore,
  FileRollbackPermitConsumptionStore,
  GitWorkspaceTargetRestorePrimitive,
  InMemoryPendingApprovalJournalStore,
  InMemoryRollbackPermitConsumptionStore,
  PendingApprovalJournalEntrySchema,
  createPendingApprovalJournalEntry,
  createTestOnlyGitWorkspaceTargetRestorePrimitive,
  createTestOnlyFileRollbackPermitConsumptionStore,
  createTestOnlyRollbackPermitConsumptionStore,
  issueRetainPermit,
  issueRollbackPermit,
  runGovernedRollback,
  runGovernedRollbackWithPrimitive,
  verifyRetainedChange
} from "../packages/retain-control/src/index.js";

const execFileAsync = promisify(execFile);
const issuedAt = "2026-07-11T00:00:00.000Z";
const expiresAt = "2026-07-11T00:10:00.000Z";
const retainedAt = "2026-07-11T00:01:00.000Z";

test("pending journal persists sanitized bindings before accept and enforces transitions", async (t) => {
  const fixture = await createRetainFixture();
  const entry = createPendingApprovalJournalEntry({
    journalId: "journal-1",
    requestId: "request-1",
    changeSet: fixture.changeSet,
    authorizationDecision: fixture.authorization,
    retainPermit: fixture.permit,
    previewReceipt: fixture.preview,
    now: issuedAt
  });

  const memory = new InMemoryPendingApprovalJournalStore();
  await memory.put(entry);
  assert.deepEqual(entry.targetHashes, fixture.changeSet.changes.map((change) => ({
    path: change.path,
    beforeHash: change.kind === "create" ? null : change.beforeHash,
    afterHash: change.afterHash
  })));
  assert.equal(JSON.stringify(entry).includes("retain-once"), false);
  await assert.rejects(() => memory.put(entry), /pending_journal_duplicate_entry/);
  const accepted = await memory.update(entry.journalId, (current) => ({
    ...current,
    state: "accepted",
    updatedAt: retainedAt
  }));
  assert.equal(accepted.state, "accepted");
  await assert.rejects(() => memory.update(entry.journalId, (current) => ({
    ...current,
    state: "post_checked",
    updatedAt: retainedAt
  })), /retained journal state requires a retain receipt|pending_journal_invalid_transition/);

  const baseDir = join(fixture.tempRoot, "journal");
  const fileStore = new FilePendingApprovalJournalStore({
    baseDir,
    requireDirectoryFsync: false
  });
  await fileStore.put(entry);
  await fileStore.update(entry.journalId, (current) => ({
    ...current,
    state: "accepted",
    updatedAt: retainedAt
  }));
  const reopened = new FilePendingApprovalJournalStore({
    baseDir,
    requireDirectoryFsync: false
  });
  if (process.platform === "win32") {
    t.diagnostic("directory fsync is an explicit unsupported live durability gate on Windows");
  }
  const persisted = await reopened.get(entry.journalId);
  assert.equal(persisted?.state, "accepted");
  assert.equal(persisted?.changeSetHash, fixture.changeSet.canonicalHash);
  await writeFile(join(baseDir, "ignored.txt"), "not a journal\n", "utf8");
  assert.equal((await reopened.list()).length, 1);
  const serialized = (await Promise.all(
    (await readdir(baseDir))
      .filter((name) => name.endsWith(".json"))
      .map((name) => readFile(join(baseDir, name), "utf8"))
  )).join("\n");
  assert.equal(serialized.includes("diff --git"), false);

  const durableDir = join(fixture.tempRoot, "journal-directory-fsync");
  const durable = new FilePendingApprovalJournalStore({ baseDir: durableDir });
  if (process.platform === "win32") {
    await assert.rejects(
      () => durable.put({ ...entry, journalId: "directory-fsync" }),
      /pending_journal_directory_fsync_unsupported/
    );
  } else {
    await durable.put({ ...entry, journalId: "directory-fsync" });
  }
  assert.equal(serialized.includes("+new"), false);
  await rm(fixture.tempRoot, { recursive: true, force: true });
});

test("journal stores fail closed on missing, identity drift, corruption, and lock contention", async (t) => {
  const fixture = await createRetainFixture();
  const entry = createPendingApprovalJournalEntry({
    journalId: "journal-hardening",
    requestId: "request-hardening",
    changeSet: fixture.changeSet,
    authorizationDecision: fixture.authorization,
    retainPermit: fixture.permit,
    previewReceipt: fixture.preview,
    now: issuedAt
  });
  const memory = new InMemoryPendingApprovalJournalStore();
  assert.equal(await memory.get("missing"), undefined);
  await assert.rejects(
    () => memory.update("missing", (current) => current),
    /pending_journal_entry_missing/
  );
  await memory.put(entry);
  await assert.rejects(() => memory.update(entry.journalId, (current) => ({
    ...current,
    requestId: "forged-request"
  })), /pending_journal_identity_drift:requestId/);
  await assert.rejects(() => memory.update(entry.journalId, (current) => ({
    ...current,
    targetFiles: [...current.targetFiles, "docs/outside.md"]
  })), /pending_journal_identity_drift:targetFiles/);
  await assert.rejects(() => memory.update(entry.journalId, (current) => ({
    ...current,
    retainPermit: { ...current.retainPermit, nonceHash: "0".repeat(64) }
  })), /pending_journal_identity_drift:retainPermit/);

  const baseDir = join(fixture.tempRoot, "file-journal-hardening");
  const fileStore = new FilePendingApprovalJournalStore({
    baseDir,
    requireDirectoryFsync: false
  });
  assert.equal(await fileStore.get("missing"), undefined);
  await assert.rejects(
    () => fileStore.update("missing", (current) => current),
    /pending_journal_entry_missing/
  );
  await fileStore.put(entry);
  await assert.rejects(() => fileStore.put(entry), /pending_journal_duplicate_entry/);
  await writeFile(join(baseDir, "corrupt.json"), "not-json", "utf8");
  await assert.rejects(() => fileStore.list(), /pending_journal_entry_corrupt/);
  await rm(join(baseDir, "corrupt.json"));
  const invalidId = "invalid-schema";
  await writeFile(
    join(baseDir, `${sha256(Buffer.from(invalidId))}.json`),
    "{}\n",
    "utf8"
  );
  await assert.rejects(() => fileStore.get(invalidId), /pending_journal_entry_corrupt/);
  await rm(join(baseDir, `${sha256(Buffer.from(invalidId))}.json`));
  await writeFile(join(baseDir, `${sha256(Buffer.from(entry.journalId))}.lock`), "locked", "utf8");
  await assert.rejects(
    () => fileStore.update(entry.journalId, (current) => current),
    /pending_journal_lock_unavailable/
  );
  await rm(join(baseDir, `${sha256(Buffer.from(entry.journalId))}.lock`));

  const actualDir = join(fixture.tempRoot, "actual-journal-dir");
  const aliasDir = join(fixture.tempRoot, "journal-alias");
  await mkdir(actualDir);
  try {
    await symlink(actualDir, aliasDir, "dir");
    const aliasStore = new FilePendingApprovalJournalStore({ baseDir: aliasDir });
    await assert.rejects(() => aliasStore.get("anything"), /pending_journal_base_directory_unsafe/);
  } catch (error) {
    const code = error instanceof Error && "code" in error
      ? String((error as NodeJS.ErrnoException).code)
      : "unknown";
    if (code !== "EPERM" && code !== "EACCES") {
      throw error;
    }
    t.diagnostic(`directory symlink capability unavailable:${code}`);
  }
  await rm(fixture.tempRoot, { recursive: true, force: true });
});

test("retain permit issuance enforces authorization, preview, binding, and time windows", async () => {
  const fixture = await createRetainFixture();
  const humanAuthorization: AuthorizationDecision = {
    ...fixture.authorization,
    approvalMode: "human_required",
    disposition: "approval_required",
    approvalRequired: true
  };
  const humanPermit = issueRetainPermit({
    changeSet: fixture.changeSet,
    authorizationDecision: humanAuthorization,
    issuedAt,
    expiresAt,
    nonce: "human-permit"
  });
  assert.equal(humanPermit.approvalMode, "human_required");
  assert.equal(humanPermit.previewReceiptHash, undefined);
  const humanEntry = createPendingApprovalJournalEntry({
    journalId: "human-journal",
    requestId: "human-request",
    changeSet: fixture.changeSet,
    authorizationDecision: humanAuthorization,
    retainPermit: humanPermit,
    now: issuedAt
  });
  assert.equal(humanEntry.previewReceiptHash, undefined);
  const extraScopes = [{
    schemaVersion: "capability-scope.v1" as const,
    kind: "tool" as const,
    resource: "test-runner",
    access: "execute" as const,
    constraints: {}
  }, {
    schemaVersion: "capability-scope.v1" as const,
    kind: "file" as const,
    resource: "docs/guide.md",
    access: "read" as const,
    constraints: {}
  }];
  assert.equal(issueRetainPermit({
    changeSet: fixture.changeSet,
    authorizationDecision: {
      ...humanAuthorization,
      requestedCapabilities: [...humanAuthorization.requestedCapabilities, ...extraScopes],
      authorizedCapabilities: [...extraScopes, ...humanAuthorization.authorizedCapabilities]
    },
    issuedAt,
    expiresAt,
    nonce: "unrelated-authorized-scopes"
  }).approvalMode, "human_required");
  const destructive = canonicalizeGovernedFileChangeSet({
    changeSetId: fixture.changeSet.changeSetId,
    threadId: fixture.changeSet.threadId,
    turnId: fixture.changeSet.turnId,
    itemId: fixture.changeSet.itemId,
    baseHead: fixture.changeSet.baseHead,
    proposedAt: fixture.changeSet.proposedAt,
    sourceSchemaProfile: fixture.changeSet.sourceSchemaProfile,
    changes: [{
      path: "docs/guide.md",
      kind: "delete",
      unifiedDiff: [
        "diff --git a/docs/guide.md b/docs/guide.md",
        "--- a/docs/guide.md",
        "+++ /dev/null",
        "@@ -1 +0,0 @@",
        "-old",
        ""
      ].join("\n"),
      beforeHash: sha256(Buffer.from("old\n")),
      afterHash: null
    }]
  });
  assert.throws(() => issueRetainPermit({
    changeSet: destructive,
    authorizationDecision: humanAuthorization,
    issuedAt,
    expiresAt,
    nonce: "destructive"
  }), /retain_permit_change_kind_unsupported/);

  const cases: Array<[string, () => unknown, RegExp]> = [
    ["subject", () => issueRetainPermit({
      changeSet: fixture.changeSet,
      authorizationDecision: { ...humanAuthorization, subjectId: "other" },
      issuedAt,
      expiresAt,
      nonce: "subject"
    }), /retain_permit_authorization_subject_mismatch/],
    ["not-required", () => issueRetainPermit({
      changeSet: fixture.changeSet,
      authorizationDecision: {
        ...fixture.authorization,
        approvalMode: "not_required",
        disposition: "authorized",
        approvalRequired: false
      },
      issuedAt,
      expiresAt,
      nonce: "not-required"
    }), /retain_permit_approval_mode_invalid/],
    ["blocked", () => issueRetainPermit({
      changeSet: fixture.changeSet,
      authorizationDecision: {
        ...humanAuthorization,
        disposition: "blocked"
      },
      issuedAt,
      expiresAt,
      nonce: "blocked"
    }), /retain_permit_authorization_blocked/],
    ["preview-missing", () => issueRetainPermit({
      changeSet: fixture.changeSet,
      authorizationDecision: fixture.authorization,
      issuedAt,
      expiresAt,
      nonce: "preview-missing"
    }), /retain_permit_preview_required/],
    ["preview-hash", () => issueRetainPermit({
      changeSet: fixture.changeSet,
      authorizationDecision: fixture.authorization,
      previewReceipt: { ...fixture.preview, changeSetHash: "0".repeat(64) },
      issuedAt,
      expiresAt,
      nonce: "preview-hash"
    }), /retain_permit_preview_required/],
    ["preview-blocked", () => issueRetainPermit({
      changeSet: fixture.changeSet,
      authorizationDecision: fixture.authorization,
      previewReceipt: {
        ...fixture.preview,
        status: "blocked",
        reasons: ["synthetic_block"]
      },
      issuedAt,
      expiresAt,
      nonce: "preview-blocked"
    }), /retain_permit_preview_required/],
    ["preview-head", () => issueRetainPermit({
      changeSet: fixture.changeSet,
      authorizationDecision: fixture.authorization,
      previewReceipt: { ...fixture.preview, headCommit: "wrong-head" },
      issuedAt,
      expiresAt,
      nonce: "preview-head"
    }), /retain_permit_preview_required/],
    ["time", () => issueRetainPermit({
      changeSet: fixture.changeSet,
      authorizationDecision: humanAuthorization,
      issuedAt: expiresAt,
      expiresAt: issuedAt,
      nonce: "time"
    }), /retain_permit_time_window_invalid/],
    ["target-authorization", () => issueRetainPermit({
      changeSet: fixture.changeSet,
      authorizationDecision: {
        ...humanAuthorization,
        authorizedCapabilities: humanAuthorization.authorizedCapabilities.filter((scope) => (
          scope.resource !== "docs/guide.md"
        ))
      },
      issuedAt,
      expiresAt,
      nonce: "target-authorization"
    }), /retain_permit_authorized_target_missing:docs\/guide.md/]
  ];
  for (const [label, operation, expected] of cases) {
    assert.throws(operation, expected, label);
  }

  assert.throws(() => createPendingApprovalJournalEntry({
    journalId: "mismatched-journal",
    requestId: "mismatched-request",
    changeSet: fixture.changeSet,
    authorizationDecision: humanAuthorization,
    retainPermit: { ...humanPermit, changeSetHash: "0".repeat(64) },
    now: issuedAt
  }), /pending_journal_binding_mismatch/);
  assert.throws(() => createPendingApprovalJournalEntry({
    journalId: "mismatched-authorization-journal",
    requestId: "mismatched-authorization-request",
    changeSet: fixture.changeSet,
    authorizationDecision: humanAuthorization,
    retainPermit: { ...humanPermit, authorizationDecisionHash: "0".repeat(64) },
    now: issuedAt
  }), /pending_journal_binding_mismatch/);
  assert.throws(() => createPendingApprovalJournalEntry({
    journalId: "mismatched-preview-journal",
    requestId: "mismatched-preview-request",
    changeSet: fixture.changeSet,
    authorizationDecision: fixture.authorization,
    retainPermit: { ...fixture.permit, previewReceiptHash: "0".repeat(64) },
    previewReceipt: fixture.preview,
    now: issuedAt
  }), /pending_journal_binding_mismatch/);
  await rm(fixture.tempRoot, { recursive: true, force: true });
});

test("missing expected after hashes can neither receive a permit nor a retain receipt", async () => {
  const fixture = await createRetainFixture();
  const missingAfter = canonicalizeGovernedFileChangeSet({
    changeSetId: fixture.changeSet.changeSetId,
    threadId: fixture.changeSet.threadId,
    turnId: fixture.changeSet.turnId,
    itemId: fixture.changeSet.itemId,
    baseHead: fixture.changeSet.baseHead,
    proposedAt: fixture.changeSet.proposedAt,
    sourceSchemaProfile: fixture.changeSet.sourceSchemaProfile,
    changes: fixture.changeSet.changes.map((change, index) => ({
      path: change.path,
      kind: change.kind,
      ...(change.oldPath === undefined ? {} : { oldPath: change.oldPath }),
      unifiedDiff: change.unifiedDiff,
      ...(change.beforeHash === undefined ? {} : { beforeHash: change.beforeHash }),
      ...(index === 0 || change.afterHash === undefined
        ? {}
        : { afterHash: change.afterHash })
    }))
  });
  const humanAuthorization: AuthorizationDecision = {
    ...fixture.authorization,
    approvalMode: "human_required",
    disposition: "approval_required",
    approvalRequired: true
  };
  assert.throws(() => issueRetainPermit({
    changeSet: missingAfter,
    authorizationDecision: humanAuthorization,
    issuedAt,
    expiresAt,
    nonce: "missing-after"
  }), /retain_permit_expected_hash_missing/);
  const nullAfter = canonicalizeGovernedFileChangeSet({
    changeSetId: fixture.changeSet.changeSetId,
    threadId: fixture.changeSet.threadId,
    turnId: fixture.changeSet.turnId,
    itemId: fixture.changeSet.itemId,
    baseHead: fixture.changeSet.baseHead,
    proposedAt: fixture.changeSet.proposedAt,
    sourceSchemaProfile: fixture.changeSet.sourceSchemaProfile,
    changes: fixture.changeSet.changes.map((change, index) => ({
      path: change.path,
      kind: change.kind,
      unifiedDiff: change.unifiedDiff,
      ...(change.beforeHash === undefined ? {} : { beforeHash: change.beforeHash }),
      afterHash: index === 0 ? null : (change.afterHash ?? null)
    }))
  });
  assert.throws(() => issueRetainPermit({
    changeSet: nullAfter,
    authorizationDecision: humanAuthorization,
    issuedAt,
    expiresAt,
    nonce: "null-after"
  }), /retain_permit_expected_hash_missing/);

  await applyFakeAppServerChanges(fixture.repoRoot);
  const result = await verifyRetainedChange({
    cwd: fixture.repoRoot,
    changeSet: missingAfter,
    permit: {
      ...fixture.permit,
      changeSetHash: missingAfter.canonicalHash
    },
    now: retainedAt
  });
  assert.equal(result.status, "reconciliation_required");
  assert.ok(result.reasons.includes("retain_after_hash_missing:docs/guide.md"));
  const unknownThrow = await verifyRetainedChange({
    cwd: fixture.repoRoot,
    changeSet: new Proxy(fixture.changeSet, {
      get(): never {
        throw "non_error_change_set_failure";
      }
    }),
    permit: fixture.permit,
    now: retainedAt
  });
  assert.deepEqual(unknownThrow, {
    status: "reconciliation_required",
    reasons: ["retain_unknown_error"]
  });
  const namedThrow = await verifyRetainedChange({
    cwd: fixture.repoRoot,
    changeSet: new Proxy(fixture.changeSet, {
      get(): never {
        throw new Error("synthetic_retain_error");
      }
    }),
    permit: fixture.permit,
    now: retainedAt
  });
  assert.deepEqual(namedThrow, {
    status: "reconciliation_required",
    reasons: ["synthetic_retain_error"]
  });
  await rm(fixture.tempRoot, { recursive: true, force: true });
});

test("retain verifies App Server post-state and rollback restores exact targets once", async () => {
  const fixture = await createRetainFixture();
  await applyFakeAppServerChanges(fixture.repoRoot);
  const humanAuthorization: AuthorizationDecision = {
    ...fixture.authorization,
    approvalMode: "human_required",
    disposition: "approval_required",
    approvalRequired: true
  };
  const humanPermit = issueRetainPermit({
    changeSet: fixture.changeSet,
    authorizationDecision: humanAuthorization,
    issuedAt,
    expiresAt,
    nonce: "human-verification"
  });
  const humanRetained = await verifyRetainedChange({
    cwd: fixture.repoRoot,
    changeSet: fixture.changeSet,
    permit: humanPermit,
    now: retainedAt
  });
  assert.equal(humanRetained.status, "retained");
  if (humanRetained.status === "retained") {
    assert.equal(humanRetained.receipt.previewReceiptHash, undefined);
  }

  const retained = await verifyRetainedChange({
    cwd: fixture.repoRoot,
    changeSet: fixture.changeSet,
    permit: fixture.permit,
    now: retainedAt
  });
  if (retained.status !== "retained") {
    assert.fail(retained.reasons.join(","));
  }
  assert.equal(retained.status, "retained");
  const pendingJournal = createPendingApprovalJournalEntry({
    journalId: "retained-journal",
    requestId: "retained-request",
    changeSet: fixture.changeSet,
    authorizationDecision: fixture.authorization,
    retainPermit: fixture.permit,
    previewReceipt: fixture.preview,
    now: issuedAt
  });
  const retainedJournal = PendingApprovalJournalEntrySchema.parse({
    ...pendingJournal,
    state: "retained",
    retainReceipt: retained.receipt,
    updatedAt: retainedAt
  });
  assert.equal(retainedJournal.retainReceipt?.receiptId, retained.receipt.receiptId);
  assert.equal(PendingApprovalJournalEntrySchema.safeParse({
    ...retainedJournal,
    retainReceipt: { ...retained.receipt, permitId: "wrong-permit" }
  }).success, false);
  assert.equal(PendingApprovalJournalEntrySchema.safeParse({
    ...retainedJournal,
    retainReceipt: { ...retained.receipt, changeSetHash: "0".repeat(64) }
  }).success, false);
  assert.equal(PendingApprovalJournalEntrySchema.safeParse({
    ...retainedJournal,
    retainReceipt: {
      ...retained.receipt,
      targetHashes: retained.receipt.targetHashes.slice(0, 1)
    }
  }).success, false);
  assert.equal(PendingApprovalJournalEntrySchema.safeParse({
    ...pendingJournal,
    retainReceipt: retained.receipt
  }).success, false);
  assert.equal(retained.receipt.noOutsideTargetChanges, true);
  assert.deepEqual(
    retained.receipt.targetHashes.map((target) => target.path),
    ["docs/guide.md", "docs/new.md"]
  );
  assert.equal(retained.receipt.targetHashes[1]?.beforeHash, null);
  assert.throws(() => issueRollbackPermit({
    receipt: retained.receipt,
    operatorId: "operator-jenn",
    issuedAt: "2026-07-11T00:05:00.000Z",
    expiresAt: "2026-07-11T00:02:00.000Z",
    nonce: "rollback-invalid-window"
  }), /rollback_permit_time_window_invalid/);

  const rollbackPermit = issueRollbackPermit({
    receipt: retained.receipt,
    operatorId: "operator-jenn",
    issuedAt: "2026-07-11T00:02:00.000Z",
    expiresAt: "2026-07-11T00:05:00.000Z",
    nonce: "rollback-once"
  });
  const consumptionStore = new InMemoryRollbackPermitConsumptionStore();
  const result = await runGovernedRollback({
    cwd: fixture.repoRoot,
    receipt: retained.receipt,
    permit: rollbackPermit,
    consumptionStore,
    now: "2026-07-11T00:03:00.000Z"
  });
  assert.equal(result.status, "rolled_back");
  assert.equal(await readFile(join(fixture.repoRoot, "docs/guide.md"), "utf8"), "old\n");
  await assert.rejects(() => readFile(join(fixture.repoRoot, "docs/new.md"), "utf8"), {
    code: "ENOENT"
  });
  assert.equal((await git(["status", "--porcelain"], fixture.repoRoot)).trim(), "");

  const replay = await runGovernedRollback({
    cwd: fixture.repoRoot,
    receipt: retained.receipt,
    permit: rollbackPermit,
    consumptionStore,
    now: "2026-07-11T00:03:30.000Z"
  });
  assert.equal(replay.status, "blocked");
  assert.ok(
    replay.reasons.includes("rollback_outside_or_missing_target_drift")
    || replay.reasons.includes("rollback_after_hash_drift:docs/guide.md")
  );
  await rm(fixture.tempRoot, { recursive: true, force: true });
});

test("rollback rejects configured Git filters before permit consumption or command execution", async () => {
  for (const filterKind of ["clean", "smudge", "process"] as const) {
    const fixture = await createRetainFixture({
      gitattributes: "docs/guide.md filter=rollback-test\n"
    });
    await applyFakeAppServerChanges(fixture.repoRoot);
    const retained = await verifyRetainedChange({
      cwd: fixture.repoRoot,
      changeSet: fixture.changeSet,
      permit: fixture.permit,
      now: retainedAt
    });
    if (retained.status !== "retained") {
      assert.fail(retained.reasons.join(","));
    }
    const permit = issueRollbackPermit({
      receipt: retained.receipt,
      operatorId: "operator-jenn",
      issuedAt: "2026-07-11T00:02:00.000Z",
      expiresAt: "2026-07-11T00:05:00.000Z",
      nonce: `rollback-filter-${filterKind}`
    });
    const markerPath = await configureRollbackFilterCommand(
      fixture,
      filterKind,
      `configured-${filterKind}`
    );
    const consumptionStore = new InMemoryRollbackPermitConsumptionStore();

    const blocked = await runGovernedRollback({
      cwd: fixture.repoRoot,
      receipt: retained.receipt,
      permit,
      consumptionStore,
      now: "2026-07-11T00:03:00.000Z"
    });
    assert.deepEqual(blocked.reasons, ["rollback_git_filters_unsupported"]);
    await assert.rejects(() => readFile(markerPath, "utf8"), { code: "ENOENT" });

    await git(["config", "--unset-all", `filter.rollback-test.${filterKind}`], fixture.repoRoot);
    const retried = await runGovernedRollback({
      cwd: fixture.repoRoot,
      receipt: retained.receipt,
      permit,
      consumptionStore,
      now: "2026-07-11T00:03:30.000Z"
    });
    assert.equal(retried.status, "rolled_back");
    await assert.rejects(() => readFile(markerPath, "utf8"), { code: "ENOENT" });
    await rm(fixture.tempRoot, { recursive: true, force: true });
  }
});

test("create-only rollback rejects Git clean filters before status or permit consumption", async () => {
  const fixture = await createRetainFixture({
    changeMode: "create-only",
    gitattributes: "docs/new.md filter=rollback-test\n"
  });
  await writeFile(join(fixture.repoRoot, "docs/new.md"), "created\n", "utf8");
  const retained = await verifyRetainedChange({
    cwd: fixture.repoRoot,
    changeSet: fixture.changeSet,
    permit: fixture.permit,
    now: retainedAt
  });
  if (retained.status !== "retained") {
    assert.fail(retained.reasons.join(","));
  }
  const permit = issueRollbackPermit({
    receipt: retained.receipt,
    operatorId: "operator-jenn",
    issuedAt: "2026-07-11T00:02:00.000Z",
    expiresAt: "2026-07-11T00:05:00.000Z",
    nonce: "rollback-create-only-clean-filter"
  });
  const markerPath = await configureRollbackFilterCommand(
    fixture,
    "clean",
    "create-only-clean"
  );
  const consumptionStore = new InMemoryRollbackPermitConsumptionStore();

  const blocked = await runGovernedRollback({
    cwd: fixture.repoRoot,
    receipt: retained.receipt,
    permit,
    consumptionStore,
    now: "2026-07-11T00:03:00.000Z"
  });
  assert.deepEqual(blocked.reasons, ["rollback_git_filters_unsupported"]);
  await assert.rejects(() => readFile(markerPath, "utf8"), { code: "ENOENT" });

  await git(["config", "--unset-all", "filter.rollback-test.clean"], fixture.repoRoot);
  const retried = await runGovernedRollback({
    cwd: fixture.repoRoot,
    receipt: retained.receipt,
    permit,
    consumptionStore,
    now: "2026-07-11T00:03:30.000Z"
  });
  assert.equal(retried.status, "rolled_back");
  await assert.rejects(() => readFile(markerPath, "utf8"), { code: "ENOENT" });
  await rm(fixture.tempRoot, { recursive: true, force: true });
});

test("rollback rechecks Git filters immediately before Git restore", async () => {
  const fixture = await createRetainFixture({
    gitattributes: "docs/guide.md filter=rollback-test\n"
  });
  await applyFakeAppServerChanges(fixture.repoRoot);
  const retained = await verifyRetainedChange({
    cwd: fixture.repoRoot,
    changeSet: fixture.changeSet,
    permit: fixture.permit,
    now: retainedAt
  });
  if (retained.status !== "retained") {
    assert.fail(retained.reasons.join(","));
  }
  const permit = issueRollbackPermit({
    receipt: retained.receipt,
    operatorId: "operator-jenn",
    issuedAt: "2026-07-11T00:02:00.000Z",
    expiresAt: "2026-07-11T00:05:00.000Z",
    nonce: "rollback-filter-adjacent-recheck"
  });
  const consumptionStore = new InMemoryRollbackPermitConsumptionStore();
  let markerPath = "";
  const primitive = createTestOnlyGitWorkspaceTargetRestorePrimitive({
    async beforeFinalFilterCheck(): Promise<void> {
      markerPath = await configureRollbackFilterCommand(
        fixture,
        "smudge",
        "adjacent-smudge"
      );
    }
  });
  const result = await runGovernedRollbackWithPrimitive({
    cwd: fixture.repoRoot,
    receipt: retained.receipt,
    permit,
    consumptionStore,
    now: "2026-07-11T00:03:00.000Z",
    restorePrimitive: primitive
  });
  assert.deepEqual(result.reasons, ["rollback_restore_failed_or_partial"]);
  await assert.rejects(() => readFile(markerPath, "utf8"), { code: "ENOENT" });

  await git(["config", "--unset-all", "filter.rollback-test.smudge"], fixture.repoRoot);
  const replay = await runGovernedRollbackWithPrimitive({
    cwd: fixture.repoRoot,
    receipt: retained.receipt,
    permit,
    consumptionStore,
    now: "2026-07-11T00:03:30.000Z",
    restorePrimitive: primitive
  });
  assert.deepEqual(replay.reasons, ["rollback_permit_replay"]);
  await assert.rejects(() => readFile(markerPath, "utf8"), { code: "ENOENT" });
  await rm(fixture.tempRoot, { recursive: true, force: true });
});

test("rollback fails closed when Git filter configuration cannot be inspected", async () => {
  const fixture = await createRetainFixture();
  await applyFakeAppServerChanges(fixture.repoRoot);
  const retained = await verifyRetainedChange({
    cwd: fixture.repoRoot,
    changeSet: fixture.changeSet,
    permit: fixture.permit,
    now: retainedAt
  });
  if (retained.status !== "retained") {
    assert.fail(retained.reasons.join(","));
  }
  await writeFile(join(fixture.repoRoot, ".git/config"), "[invalid\n", "utf8");

  await assert.rejects(
    () => new GitWorkspaceTargetRestorePrimitive().restore({
      cwd: fixture.repoRoot,
      receipt: retained.receipt
    }),
    /rollback_restore_precondition_failed:rollback_git_filter_inspection_failed/
  );
  assert.equal(await readFile(join(fixture.repoRoot, "docs/guide.md"), "utf8"), "new\n");
  await rm(fixture.tempRoot, { recursive: true, force: true });
});

test("rollback permit is consumed before restore and replay is rejected", async () => {
  const fixture = await createRetainFixture();
  await applyFakeAppServerChanges(fixture.repoRoot);
  const retained = await verifyRetainedChange({
    cwd: fixture.repoRoot,
    changeSet: fixture.changeSet,
    permit: fixture.permit,
    now: retainedAt
  });
  if (retained.status !== "retained") {
    assert.fail(retained.reasons.join(","));
  }
  const permit = issueRollbackPermit({
    receipt: retained.receipt,
    operatorId: "operator-jenn",
    issuedAt: "2026-07-11T00:02:00.000Z",
    expiresAt: "2026-07-11T00:05:00.000Z",
    nonce: "replay-after-restore-failure"
  });
  const consumptionStore = new InMemoryRollbackPermitConsumptionStore();
  const restorePrimitive = {
    async restore(): Promise<void> {
      throw new Error("synthetic_restore_failure");
    }
  };
  const untrustedStore = await runGovernedRollback({
    cwd: fixture.repoRoot,
    receipt: retained.receipt,
    permit,
    consumptionStore: { consume: () => true },
    now: "2026-07-11T00:03:00.000Z"
  });
  assert.equal(untrustedStore.status, "blocked");
  assert.deepEqual(untrustedStore.reasons, ["rollback_consumption_store_untrusted"]);

  const first = await runGovernedRollbackWithPrimitive({
    cwd: fixture.repoRoot,
    receipt: retained.receipt,
    permit,
    consumptionStore,
    restorePrimitive,
    now: "2026-07-11T00:03:00.000Z"
  });
  assert.equal(first.status, "reconciliation_required");
  assert.deepEqual(first.reasons, ["rollback_restore_failed_or_partial"]);

  const replay = await runGovernedRollbackWithPrimitive({
    cwd: fixture.repoRoot,
    receipt: retained.receipt,
    permit,
    consumptionStore,
    restorePrimitive,
    now: "2026-07-11T00:03:30.000Z"
  });
  assert.equal(replay.status, "blocked");
  assert.deepEqual(replay.reasons, ["rollback_permit_replay"]);
  await rm(fixture.tempRoot, { recursive: true, force: true });
});

test("rollback refuses target, outside-file, and HEAD drift", async () => {
  for (const drift of ["target", "outside", "head"] as const) {
    const fixture = await createRetainFixture();
    await applyFakeAppServerChanges(fixture.repoRoot);
    const retained = await verifyRetainedChange({
      cwd: fixture.repoRoot,
      changeSet: fixture.changeSet,
      permit: fixture.permit,
      now: retainedAt
    });
    if (retained.status !== "retained") {
      assert.fail(retained.reasons.join(","));
    }
    assert.equal(retained.status, "retained");
    if (drift === "target") {
      await writeFile(join(fixture.repoRoot, "docs/guide.md"), "human follow-up\n", "utf8");
    } else if (drift === "outside") {
      await writeFile(join(fixture.repoRoot, "outside.txt"), "outside drift\n", "utf8");
    } else {
      await git(["add", "docs/guide.md", "docs/new.md"], fixture.repoRoot);
      await git(["commit", "-m", "head drift"], fixture.repoRoot);
    }
    const permit = issueRollbackPermit({
      receipt: retained.receipt,
      operatorId: "operator-jenn",
      issuedAt: "2026-07-11T00:02:00.000Z",
      expiresAt: "2026-07-11T00:05:00.000Z",
      nonce: `drift-${drift}`
    });
    const result = await runGovernedRollback({
      cwd: fixture.repoRoot,
      receipt: retained.receipt,
      permit,
      consumptionStore: new InMemoryRollbackPermitConsumptionStore(),
      now: "2026-07-11T00:03:00.000Z"
    });
    assert.equal(result.status, "blocked", drift);
    if (drift === "target") {
      assert.ok(result.reasons.includes("rollback_after_hash_drift:docs/guide.md"));
    } else if (drift === "outside") {
      assert.ok(result.reasons.includes("rollback_outside_or_missing_target_drift"));
    } else {
      assert.ok(result.reasons.includes("rollback_head_drift"));
    }
    await rm(fixture.tempRoot, { recursive: true, force: true });
  }
});

test("rollback preflight stops before content reads when topology is unsafe", async (t) => {
  const fixture = await createRetainFixture();
  await applyFakeAppServerChanges(fixture.repoRoot);
  const retained = await verifyRetainedChange({
    cwd: fixture.repoRoot,
    changeSet: fixture.changeSet,
    permit: fixture.permit,
    now: retainedAt
  });
  if (retained.status !== "retained") {
    assert.fail(retained.reasons.join(","));
  }
  const permit = issueRollbackPermit({
    receipt: retained.receipt,
    operatorId: "operator-jenn",
    issuedAt: "2026-07-11T00:02:00.000Z",
    expiresAt: "2026-07-11T00:05:00.000Z",
    nonce: "rollback-topology-preflight"
  });
  const target = join(fixture.repoRoot, "docs/guide.md");
  await rm(target);
  try {
    await symlink(join(fixture.tempRoot, "missing-private-target.md"), target, "file");
  } catch (error) {
    const code = error instanceof Error && "code" in error
      ? String((error as NodeJS.ErrnoException).code)
      : "unknown";
    if (code !== "EPERM" && code !== "EACCES") {
      throw error;
    }
    t.diagnostic(`file symlink capability unavailable:${code}`);
    await rm(fixture.tempRoot, { recursive: true, force: true });
    return;
  }

  const result = await runGovernedRollback({
    cwd: fixture.repoRoot,
    receipt: retained.receipt,
    permit,
    consumptionStore: new InMemoryRollbackPermitConsumptionStore(),
    now: "2026-07-11T00:03:00.000Z"
  });
  assert.equal(result.status, "blocked");
  assert.ok(result.reasons.includes("target_symlink_forbidden:docs/guide.md"));
  assert.equal(result.reasons.includes("rollback_after_hash_drift:docs/guide.md"), false);
  await rm(fixture.tempRoot, { recursive: true, force: true });
});

test("retain enters reconciliation on partial or outside App Server state", async () => {
  const fixture = await createRetainFixture();
  await writeFile(join(fixture.repoRoot, "docs/guide.md"), "new\n", "utf8");
  await writeFile(join(fixture.repoRoot, "outside.txt"), "unexpected\n", "utf8");

  const result = await verifyRetainedChange({
    cwd: fixture.repoRoot,
    changeSet: fixture.changeSet,
    permit: fixture.permit,
    now: retainedAt
  });
  assert.equal(result.status, "reconciliation_required");
  if (result.status !== "reconciliation_required") {
    assert.fail("expected reconciliation");
  }
  assert.ok(result.reasons.includes("retain_outside_or_missing_target_changes"));
  assert.ok(result.reasons.includes("target_topology_unreadable:docs/new.md"));
  assert.equal(result.reasons.includes("retain_after_target_missing:docs/new.md"), false);
  await rm(fixture.tempRoot, { recursive: true, force: true });
});

test("retain stops before target content reads when topology is unsafe", async (t) => {
  const fixture = await createRetainFixture();
  await applyFakeAppServerChanges(fixture.repoRoot);
  const target = join(fixture.repoRoot, "docs/guide.md");
  await rm(target);
  try {
    await symlink(join(fixture.tempRoot, "missing-private-target.md"), target, "file");
  } catch (error) {
    const code = error instanceof Error && "code" in error
      ? String((error as NodeJS.ErrnoException).code)
      : "unknown";
    if (code !== "EPERM" && code !== "EACCES") {
      throw error;
    }
    t.diagnostic(`file symlink capability unavailable:${code}`);
    await rm(fixture.tempRoot, { recursive: true, force: true });
    return;
  }

  const result = await verifyRetainedChange({
    cwd: fixture.repoRoot,
    changeSet: fixture.changeSet,
    permit: fixture.permit,
    now: retainedAt
  });
  assert.equal(result.status, "reconciliation_required");
  if (result.status !== "reconciliation_required") {
    assert.fail("expected reconciliation");
  }
  assert.ok(result.reasons.includes("target_symlink_forbidden:docs/guide.md"));
  assert.equal(result.reasons.includes("retain_after_target_missing:docs/guide.md"), false);
  await rm(fixture.tempRoot, { recursive: true, force: true });
});

test("retain rejects index, hashes, permit bindings, time, and repository drift", async () => {
  for (const mode of [
    "index",
    "after_hash",
    "change_set",
    "head",
    "targets",
    "expired",
    "not_yet_valid",
    "invalid_repo"
  ] as const) {
    const fixture = await createRetainFixture();
    await applyFakeAppServerChanges(fixture.repoRoot);
    let permit = fixture.permit;
    let cwd = fixture.repoRoot;
    let verificationNow = retainedAt;
    if (mode === "index") {
      await git(["add", "docs/guide.md", "docs/new.md"], fixture.repoRoot);
    } else if (mode === "after_hash") {
      await writeFile(join(fixture.repoRoot, "docs/guide.md"), "drifted\n", "utf8");
    } else if (mode === "change_set") {
      permit = { ...permit, changeSetHash: "0".repeat(64) };
    } else if (mode === "head") {
      permit = { ...permit, headCommit: "wrong-head" };
    } else if (mode === "targets") {
      permit = { ...permit, targetFiles: ["docs/guide.md"] };
    } else if (mode === "expired") {
      verificationNow = "2026-07-11T00:11:00.000Z";
    } else if (mode === "not_yet_valid") {
      verificationNow = "2026-07-10T23:59:00.000Z";
    } else {
      cwd = join(fixture.tempRoot, "missing-repository");
    }
    const result = await verifyRetainedChange({
      cwd,
      changeSet: fixture.changeSet,
      permit,
      now: verificationNow
    });
    assert.equal(result.status, "reconciliation_required", mode);
    if (result.status !== "reconciliation_required") {
      assert.fail(mode);
    }
    const expected = {
      index: "retain_index_changed",
      after_hash: "retain_after_hash_mismatch:docs/guide.md",
      change_set: "retain_change_set_hash_mismatch",
      head: "retain_permit_head_mismatch",
      targets: "retain_permit_targets_mismatch",
      expired: "retain_permit_expired_or_not_yet_valid",
      not_yet_valid: "retain_permit_expired_or_not_yet_valid",
      invalid_repo: "retain_unknown_error"
    }[mode];
    assert.ok(result.reasons.includes(expected), `${mode}:${result.reasons.join(",")}`);
    await rm(fixture.tempRoot, { recursive: true, force: true });
  }
});

test("rollback preflight rejects binding, expiry, index, identity, and inspection drift", async () => {
  {
    const fixture = await createRetainFixture();
    await applyFakeAppServerChanges(fixture.repoRoot);
    const retained = await verifyRetainedChange({
      cwd: fixture.repoRoot,
      changeSet: fixture.changeSet,
      permit: fixture.permit,
      now: retainedAt
    });
    if (retained.status !== "retained") {
      assert.fail(retained.reasons.join(","));
    }
    const permit = issueRollbackPermit({
      receipt: retained.receipt,
      operatorId: "operator-jenn",
      issuedAt: "2026-07-11T00:02:00.000Z",
      expiresAt: "2026-07-11T00:05:00.000Z",
      nonce: "bad-bindings"
    });
    const result = await runGovernedRollback({
      cwd: fixture.repoRoot,
      receipt: retained.receipt,
      permit: {
        ...permit,
        receiptId: "other-receipt",
        expectedHead: "other-head",
        targetFiles: ["docs/other.md"]
      },
      consumptionStore: new InMemoryRollbackPermitConsumptionStore(),
      now: "2026-07-11T00:06:00.000Z"
    });
    assert.equal(result.status, "blocked");
    for (const reason of [
      "rollback_receipt_binding_mismatch",
      "rollback_permit_head_binding_mismatch",
      "rollback_permit_target_binding_mismatch",
      "rollback_permit_expired_or_not_yet_valid"
    ]) {
      assert.ok(result.reasons.includes(reason), reason);
    }
    await rm(fixture.tempRoot, { recursive: true, force: true });
  }
  {
    const fixture = await createRetainFixture();
    await applyFakeAppServerChanges(fixture.repoRoot);
    const retained = await verifyRetainedChange({
      cwd: fixture.repoRoot,
      changeSet: fixture.changeSet,
      permit: fixture.permit,
      now: retainedAt
    });
    if (retained.status !== "retained") {
      assert.fail(retained.reasons.join(","));
    }
    const permit = issueRollbackPermit({
      receipt: retained.receipt,
      operatorId: "operator-jenn",
      issuedAt: "2026-07-11T00:02:00.000Z",
      expiresAt: "2026-07-11T00:05:00.000Z",
      nonce: "index-drift"
    });
    await git(["add", "docs/guide.md", "docs/new.md"], fixture.repoRoot);
    const result = await runGovernedRollback({
      cwd: fixture.repoRoot,
      receipt: retained.receipt,
      permit,
      consumptionStore: new InMemoryRollbackPermitConsumptionStore(),
      now: "2026-07-11T00:03:00.000Z"
    });
    assert.equal(result.status, "blocked");
    assert.ok(result.reasons.includes("rollback_index_drift"));
    await rm(fixture.tempRoot, { recursive: true, force: true });
  }
  {
    const fixture = await createRetainFixture();
    await applyFakeAppServerChanges(fixture.repoRoot);
    const retained = await verifyRetainedChange({
      cwd: fixture.repoRoot,
      changeSet: fixture.changeSet,
      permit: fixture.permit,
      now: retainedAt
    });
    if (retained.status !== "retained") {
      assert.fail(retained.reasons.join(","));
    }
    const permit = issueRollbackPermit({
      receipt: retained.receipt,
      operatorId: "operator-jenn",
      issuedAt: "2026-07-11T00:02:00.000Z",
      expiresAt: "2026-07-11T00:05:00.000Z",
      nonce: "inspection-failure"
    });
    const result = await runGovernedRollback({
      cwd: join(fixture.tempRoot, "missing-repository"),
      receipt: retained.receipt,
      permit,
      consumptionStore: new InMemoryRollbackPermitConsumptionStore(),
      now: "2026-07-11T00:03:00.000Z"
    });
    assert.equal(result.status, "blocked");
    assert.ok(result.reasons.includes("rollback_lock_unavailable"));
    await rm(fixture.tempRoot, { recursive: true, force: true });
  }
});

test("rollback post-check catches a no-op or outside-target restore primitive", async () => {
  for (const mode of ["noop", "outside"] as const) {
    const fixture = await createRetainFixture();
    await applyFakeAppServerChanges(fixture.repoRoot);
    const retained = await verifyRetainedChange({
      cwd: fixture.repoRoot,
      changeSet: fixture.changeSet,
      permit: fixture.permit,
      now: retainedAt
    });
    if (retained.status !== "retained") {
      assert.fail(retained.reasons.join(","));
    }
    const permit = issueRollbackPermit({
      receipt: retained.receipt,
      operatorId: "operator-jenn",
      issuedAt: "2026-07-11T00:02:00.000Z",
      expiresAt: "2026-07-11T00:05:00.000Z",
      nonce: `post-check-${mode}`
    });
    const result = await runGovernedRollbackWithPrimitive({
      cwd: fixture.repoRoot,
      receipt: retained.receipt,
      permit,
      consumptionStore: new InMemoryRollbackPermitConsumptionStore(),
      restorePrimitive: {
        async restore(): Promise<void> {
          if (mode === "outside") {
            await writeFile(join(fixture.repoRoot, "outside.txt"), "outside\n", "utf8");
          }
        }
      },
      now: "2026-07-11T00:03:00.000Z"
    });
    assert.equal(result.status, "reconciliation_required");
    assert.ok(result.reasons.some((reason) => (
      reason === "rollback_post_worktree_not_clean"
      || reason.startsWith("rollback_post_hash_mismatch:")
    )));
    await rm(fixture.tempRoot, { recursive: true, force: true });
  }
});

test("rollback post-check stops before content reads when restore topology is unsafe", async (t) => {
  const fixture = await createRetainFixture();
  await applyFakeAppServerChanges(fixture.repoRoot);
  const retained = await verifyRetainedChange({
    cwd: fixture.repoRoot,
    changeSet: fixture.changeSet,
    permit: fixture.permit,
    now: retainedAt
  });
  if (retained.status !== "retained") {
    assert.fail(retained.reasons.join(","));
  }
  const permit = issueRollbackPermit({
    receipt: retained.receipt,
    operatorId: "operator-jenn",
    issuedAt: "2026-07-11T00:02:00.000Z",
    expiresAt: "2026-07-11T00:05:00.000Z",
    nonce: "rollback-topology-post-check"
  });
  let symlinkUnavailable: string | undefined;
  const result = await runGovernedRollbackWithPrimitive({
    cwd: fixture.repoRoot,
    receipt: retained.receipt,
    permit,
    consumptionStore: new InMemoryRollbackPermitConsumptionStore(),
    restorePrimitive: {
      async restore(): Promise<void> {
        const target = join(fixture.repoRoot, "docs/guide.md");
        await rm(target);
        try {
          await symlink(join(fixture.tempRoot, "missing-private-target.md"), target, "file");
        } catch (error) {
          const code = error instanceof Error && "code" in error
            ? String((error as NodeJS.ErrnoException).code)
            : "unknown";
          if (code !== "EPERM" && code !== "EACCES") {
            throw error;
          }
          symlinkUnavailable = code;
          throw error;
        }
      }
    },
    now: "2026-07-11T00:03:00.000Z"
  });
  if (symlinkUnavailable !== undefined) {
    t.diagnostic(`file symlink capability unavailable:${symlinkUnavailable}`);
    await rm(fixture.tempRoot, { recursive: true, force: true });
    return;
  }
  assert.equal(result.status, "reconciliation_required");
  assert.ok(result.reasons.includes("target_symlink_forbidden:docs/guide.md"));
  assert.equal(result.reasons.includes("rollback_post_hash_mismatch:docs/guide.md"), false);
  await rm(fixture.tempRoot, { recursive: true, force: true });
});

test("rollback rechecks hashes immediately inside the Git primitive and preserves a racing human edit", async () => {
  const fixture = await createRetainFixture();
  await applyFakeAppServerChanges(fixture.repoRoot);
  const retained = await verifyRetainedChange({
    cwd: fixture.repoRoot,
    changeSet: fixture.changeSet,
    permit: fixture.permit,
    now: retainedAt
  });
  if (retained.status !== "retained") {
    assert.fail(retained.reasons.join(","));
  }
  const permit = issueRollbackPermit({
    receipt: retained.receipt,
    operatorId: "operator-jenn",
    issuedAt: "2026-07-11T00:02:00.000Z",
    expiresAt: "2026-07-11T00:05:00.000Z",
    nonce: "rollback-race"
  });
  const gitPrimitive = new GitWorkspaceTargetRestorePrimitive();
  const result = await runGovernedRollbackWithPrimitive({
    cwd: fixture.repoRoot,
    receipt: retained.receipt,
    permit,
    consumptionStore: new InMemoryRollbackPermitConsumptionStore(),
    restorePrimitive: {
      async restore(input): Promise<void> {
        await writeFile(join(fixture.repoRoot, "docs/guide.md"), "human follow-up\n", "utf8");
        await gitPrimitive.restore(input);
      }
    },
    now: "2026-07-11T00:03:00.000Z"
  });
  assert.equal(result.status, "reconciliation_required");
  assert.deepEqual(result.reasons, ["rollback_restore_failed_or_partial"]);
  assert.equal(
    await readFile(join(fixture.repoRoot, "docs/guide.md"), "utf8"),
    "human follow-up\n"
  );
  await rm(fixture.tempRoot, { recursive: true, force: true });
});

test("rollback fails closed when consumption storage fails or workspace drifts during consumption", async () => {
  for (const mode of ["store_error", "drift"] as const) {
    const fixture = await createRetainFixture();
    await applyFakeAppServerChanges(fixture.repoRoot);
    const retained = await verifyRetainedChange({
      cwd: fixture.repoRoot,
      changeSet: fixture.changeSet,
      permit: fixture.permit,
      now: retainedAt
    });
    if (retained.status !== "retained") {
      assert.fail(retained.reasons.join(","));
    }
    const permit = issueRollbackPermit({
      receipt: retained.receipt,
      operatorId: "operator-jenn",
      issuedAt: "2026-07-11T00:02:00.000Z",
      expiresAt: "2026-07-11T00:05:00.000Z",
      nonce: `consumption-${mode}`
    });
    const result = await runGovernedRollback({
      cwd: fixture.repoRoot,
      receipt: retained.receipt,
      permit,
      consumptionStore: createTestOnlyRollbackPermitConsumptionStore(
        async (): Promise<boolean> => {
          if (mode === "store_error") {
            throw new Error("store unavailable");
          }
          await writeFile(join(fixture.repoRoot, "docs/guide.md"), "human follow-up\n", "utf8");
          return true;
        }
      ),
      now: "2026-07-11T00:03:00.000Z"
    });
    assert.equal(result.status, "reconciliation_required");
    assert.ok(result.reasons.includes(
      mode === "store_error"
        ? "rollback_consumption_store_failed"
        : "rollback_after_hash_drift:docs/guide.md"
    ));
    assert.equal(
      await readFile(join(fixture.repoRoot, "docs/guide.md"), "utf8"),
      mode === "store_error" ? "new\n" : "human follow-up\n"
    );
    await rm(fixture.tempRoot, { recursive: true, force: true });
  }
});

test("rollback receipt is bound to repository identity even when HEAD and targets match", async () => {
  const fixture = await createRetainFixture();
  await applyFakeAppServerChanges(fixture.repoRoot);
  const retained = await verifyRetainedChange({
    cwd: fixture.repoRoot,
    changeSet: fixture.changeSet,
    permit: fixture.permit,
    now: retainedAt
  });
  if (retained.status !== "retained") {
    assert.fail(retained.reasons.join(","));
  }
  const cloneRoot = join(fixture.tempRoot, "identity-clone");
  await git(["clone", "--no-hardlinks", fixture.repoRoot, cloneRoot], fixture.tempRoot);
  await applyFakeAppServerChanges(cloneRoot);
  const permit = issueRollbackPermit({
    receipt: retained.receipt,
    operatorId: "operator-jenn",
    issuedAt: "2026-07-11T00:02:00.000Z",
    expiresAt: "2026-07-11T00:05:00.000Z",
    nonce: "repository-identity"
  });
  const result = await runGovernedRollback({
    cwd: cloneRoot,
    receipt: retained.receipt,
    permit,
    consumptionStore: new InMemoryRollbackPermitConsumptionStore(),
    now: "2026-07-11T00:03:00.000Z"
  });
  assert.equal(result.status, "blocked");
  assert.ok(result.reasons.includes("rollback_repository_identity_drift"));
  await rm(fixture.tempRoot, { recursive: true, force: true });
});

test("durable rollback permit consumption rejects replay and unsafe directories", async (t) => {
  const baseDir = await createCanonicalTempDirectory("rollback-consumption-");
  const createStore = () => process.platform === "win32"
    ? createTestOnlyFileRollbackPermitConsumptionStore(baseDir)
    : new FileRollbackPermitConsumptionStore(baseDir);
  if (process.platform === "win32") {
    t.diagnostic("directory fsync is an explicit unsupported live rollback gate on Windows");
  }
  const first = createStore();
  assert.equal(await first.consume("permit-key"), true);
  assert.equal(await first.consume("permit-key"), false);
  const restarted = createStore();
  assert.equal(await restarted.consume("permit-key"), false);
  assert.equal(await restarted.consume("other-key"), true);
  assert.equal(
    await createTestOnlyFileRollbackPermitConsumptionStore(baseDir).consume("non-live-key"),
    true
  );
  const unsafeFile = join(baseDir, "not-a-directory");
  await writeFile(unsafeFile, "file\n", "utf8");
  await assert.rejects(
    () => new FileRollbackPermitConsumptionStore(unsafeFile).consume("key"),
    /rollback_consumption_directory_unsafe|EEXIST/
  );
  const actual = join(baseDir, "actual");
  const alias = join(baseDir, "alias");
  await mkdir(actual);
  try {
    await symlink(actual, alias, "dir");
    await assert.rejects(
      () => new FileRollbackPermitConsumptionStore(alias).consume("key"),
      /rollback_consumption_directory_unsafe|rollback_consumption_directory_alias/
    );
  } catch (error) {
    const code = error instanceof Error && "code" in error
      ? String((error as NodeJS.ErrnoException).code)
      : "unknown";
    if (code !== "EPERM" && code !== "EACCES") {
      throw error;
    }
    t.diagnostic(`directory symlink capability unavailable:${code}`);
  }
  await rm(baseDir, { recursive: true, force: true });
});

test("governed rollback uses the registered durable consume closure, not an overridable method", async () => {
  const fixture = await createRetainFixture();
  await applyFakeAppServerChanges(fixture.repoRoot);
  const retained = await verifyRetainedChange({
    cwd: fixture.repoRoot,
    changeSet: fixture.changeSet,
    permit: fixture.permit,
    now: retainedAt
  });
  if (retained.status !== "retained") {
    assert.fail(retained.reasons.join(","));
  }
  const permit = issueRollbackPermit({
    receipt: retained.receipt,
    operatorId: "operator-jenn",
    issuedAt: "2026-07-11T00:02:00.000Z",
    expiresAt: "2026-07-11T00:05:00.000Z",
    nonce: "overridden-consume"
  });
  const consumeDir = join(fixture.tempRoot, "overridden-consume-store");
  const store = new FileRollbackPermitConsumptionStore(consumeDir);
  store.consume = async () => true;
  const result = await runGovernedRollbackWithPrimitive({
    cwd: fixture.repoRoot,
    receipt: retained.receipt,
    permit,
    consumptionStore: store,
    now: "2026-07-11T00:03:00.000Z",
    restorePrimitive: {
      async restore() {
        throw new Error("deterministic_restore_failure");
      }
    }
  });
  assert.equal(result.status, "reconciliation_required");
  assert.equal((await readdir(consumeDir)).filter((name) => name.endsWith(".consumed")).length, 1);
  const replay = await runGovernedRollbackWithPrimitive({
    cwd: fixture.repoRoot,
    receipt: retained.receipt,
    permit,
    consumptionStore: store,
    now: "2026-07-11T00:03:30.000Z",
    restorePrimitive: {
      async restore() {}
    }
  });
  assert.deepEqual(replay.reasons, ["rollback_permit_replay"]);
  await rm(fixture.tempRoot, { recursive: true, force: true });
});

test("seeded permit replay property consumes every logical permit at most once", () => {
  const store = new InMemoryRollbackPermitConsumptionStore();
  let state = 0x2046_0711;
  for (let index = 0; index < 256; index += 1) {
    state = (Math.imul(state, 1_103_515_245) + 12_345) >>> 0;
    const key = `permit-${index}-${state.toString(16)}`;
    assert.equal(store.consume(key), true);
    assert.equal(store.consume(key), false);
  }
});

test("Git rollback primitive rejects empty, duplicate, unsafe, and wrong-HEAD targets", async () => {
  const fixture = await createRetainFixture();
  await applyFakeAppServerChanges(fixture.repoRoot);
  const retained = await verifyRetainedChange({
    cwd: fixture.repoRoot,
    changeSet: fixture.changeSet,
    permit: fixture.permit,
    now: retainedAt
  });
  if (retained.status !== "retained") {
    assert.fail(retained.reasons.join(","));
  }
  const receipt = retained.receipt;
  const primitive = new GitWorkspaceTargetRestorePrimitive();
  await assert.rejects(() => primitive.restore({
    cwd: fixture.repoRoot,
    receipt: { ...receipt, targetHashes: [] }
  }), /too_small/);
  await assert.rejects(() => primitive.restore({
    cwd: fixture.repoRoot,
    receipt: {
      ...receipt,
      targetHashes: [receipt.targetHashes[0]!, receipt.targetHashes[0]!]
    }
  }), /rollback_restore_targets_invalid/);
  await assert.rejects(() => primitive.restore({
    cwd: fixture.repoRoot,
    receipt: {
      ...receipt,
      targetHashes: [{
        ...receipt.targetHashes[0]!,
        path: "../outside.md"
      }]
    }
  }), /target_path_unsafe/);
  await assert.rejects(() => primitive.restore({
    cwd: fixture.repoRoot,
    receipt: { ...receipt, headCommit: "wrong-head" }
  }), /rollback_restore_precondition_failed/);
  await rm(fixture.tempRoot, { recursive: true, force: true });
});

async function createRetainFixture(options: {
  changeMode?: "mixed" | "create-only";
  gitattributes?: string;
} = {}): Promise<{
  tempRoot: string;
  repoRoot: string;
  head: string;
  changeSet: GovernedFileChangeSet;
  authorization: AuthorizationDecision;
  preview: PreviewReceipt;
  permit: RetainPermit;
}> {
  const tempRoot = await createCanonicalTempDirectory("retain-control-");
  const repoRoot = join(tempRoot, "repo");
  await mkdir(join(repoRoot, "docs"), { recursive: true });
  await git(["init"], repoRoot);
  await git(["config", "user.email", "retain@example.invalid"], repoRoot);
  await git(["config", "user.name", "Retain Fixture"], repoRoot);
  await writeFile(join(repoRoot, "docs/guide.md"), "old\n", "utf8");
  if (options.gitattributes !== undefined) {
    await writeFile(join(repoRoot, ".gitattributes"), options.gitattributes, "utf8");
  }
  await git(["add", "."], repoRoot);
  await git(["commit", "-m", "initial"], repoRoot);
  await git(["switch", "-c", "feature/safe"], repoRoot);
  const head = (await git(["rev-parse", "HEAD"], repoRoot)).trim();
  const before = await readFile(join(repoRoot, "docs/guide.md"));
  const changes = options.changeMode === "create-only"
    ? [{
        path: "docs/new.md",
        kind: "create" as const,
        unifiedDiff: createDiff("docs/new.md", "created"),
        beforeHash: null,
        afterHash: sha256(Buffer.from("created\n"))
      }]
    : [{
        path: "docs/guide.md",
        kind: "update" as const,
        unifiedDiff: updateDiff("docs/guide.md", "old", "new"),
        beforeHash: sha256(before),
        afterHash: sha256(Buffer.from("new\n"))
      }, {
        path: "docs/new.md",
        kind: "create" as const,
        unifiedDiff: createDiff("docs/new.md", "created"),
        beforeHash: null,
        afterHash: sha256(Buffer.from("created\n"))
      }];
  const changeSet = canonicalizeGovernedFileChangeSet({
    changeSetId: "retain-change-set",
    threadId: "thread-1",
    turnId: "turn-1",
    itemId: "item-1",
    baseHead: head,
    proposedAt: issuedAt,
    sourceSchemaProfile: "fake-v2",
    changes
  });
  const facts = deriveCapabilityFactsFromChangeSet(changeSet, {
    repository: {
      branch: "feature/safe",
      protectedBranch: false,
      worktreeClean: true,
      headCommit: head,
      expectedHead: head
    },
    networkAccess: "none",
    credentialAccess: "none",
    exactTargets: true
  });
  const requestedCapabilities = changeSet.changes.map((change) => ({
    schemaVersion: "capability-scope.v1" as const,
    kind: "file" as const,
    resource: change.path,
    access: "write" as const,
    constraints: {}
  }));
  const authorization = authorizeCapabilityFacts({
    surface: "codex_app_server",
    facts,
    semanticRisk: "medium",
    requestedCapabilities,
    capabilityCeiling: [{
      schemaVersion: "capability-scope.v1",
      kind: "file",
      resource: "docs/**",
      access: "write",
      constraints: {}
    }],
    createdAt: issuedAt
  });
  assert.equal(authorization.approvalMode, "policy_auto");
  const preview = PreviewReceiptSchema.parse({
    receiptId: "preview-retain",
    changeSetHash: changeSet.canonicalHash,
    headCommit: head,
    ruleId: "safe-docs",
    status: "preview_passed",
    networkIsolation: "enforced_none",
    filesystemIsolation: "clone_only_enforced",
    isolationScope: "test_only",
    isolationEnforcerId: "disposable-test-harness",
    checks: [{
      phase: "check",
      argvHash: hashKernelObject([process.execPath, "--test"]),
      status: "passed",
      exitCode: 0,
      durationMs: 1
    }],
    cleanupStatus: "passed",
    reasons: [],
    createdAt: issuedAt
  });
  const permit = issueRetainPermit({
    changeSet,
    authorizationDecision: authorization,
    previewReceipt: preview,
    issuedAt,
    expiresAt,
    nonce: "retain-once"
  });
  return { tempRoot, repoRoot, head, changeSet, authorization, preview, permit };
}

async function createCanonicalTempDirectory(prefix: string): Promise<string> {
  return realpath(await mkdtemp(join(tmpdir(), prefix)));
}

async function configureRollbackFilterCommand(
  fixture: { tempRoot: string; repoRoot: string },
  filterKind: "clean" | "smudge" | "process",
  name: string
): Promise<string> {
  const scriptPath = join(fixture.tempRoot, `${name}.cjs`);
  const markerPath = join(fixture.tempRoot, `${name}.marker`);
  await writeFile(
    scriptPath,
    [
      "const fs = require('node:fs');",
      "fs.writeFileSync(process.argv[2], 'executed\\n');",
      "process.stdin.pipe(process.stdout);",
      ""
    ].join("\n"),
    "utf8"
  );
  const command = [process.execPath, scriptPath, markerPath]
    .map(quoteGitFilterCommandArgument)
    .join(" ");
  await git(["config", `filter.rollback-test.${filterKind}`, command], fixture.repoRoot);
  return markerPath;
}

function quoteGitFilterCommandArgument(value: string): string {
  return `'${value.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`;
}

async function applyFakeAppServerChanges(repoRoot: string): Promise<void> {
  await writeFile(join(repoRoot, "docs/guide.md"), "new\n", "utf8");
  await writeFile(join(repoRoot, "docs/new.md"), "created\n", "utf8");
}

function updateDiff(path: string, before: string, after: string): string {
  return [
    `diff --git a/${path} b/${path}`,
    `--- a/${path}`,
    `+++ b/${path}`,
    "@@ -1 +1 @@",
    `-${before}`,
    `+${after}`,
    ""
  ].join("\n");
}

function createDiff(path: string, content: string): string {
  return [
    `diff --git a/${path} b/${path}`,
    "new file mode 100644",
    "--- /dev/null",
    `+++ b/${path}`,
    "@@ -0,0 +1 @@",
    `+${content}`,
    ""
  ].join("\n");
}

async function git(argv: string[], cwd: string): Promise<string> {
  const { stdout } = await execFileAsync("git", argv, {
    cwd,
    encoding: "utf8",
    windowsHide: true
  });
  return stdout;
}

function sha256(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}
