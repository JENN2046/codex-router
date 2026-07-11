import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import sessionAttestationFixture from "./fixtures/codex-app-server/fake-v2/session-attestation.json" with { type: "json" };
import fileChangeFlowFixture from "./fixtures/codex-app-server/fake-v2/file-change-flow.json" with { type: "json" };
import {
  CodexAppServerAdapter,
  CodexSdkAdapter,
  type AppServerSessionAttestation,
  type CodexAppServerApprovalResponse,
  type CodexAppServerMessageTransport
} from "../packages/codex-adapter/src/index.js";
import {
  deriveCapabilityFacts
} from "../packages/authorization-kernel/src/index.js";
import {
  createTestOnlyLocalClonePreviewer
} from "../packages/file-change-preview/src/index.js";
import {
  InMemoryPendingApprovalJournalStore,
  type PendingApprovalJournalEntry,
  type PendingApprovalJournalStore
} from "../packages/retain-control/src/index.js";
import type {
  PreviewPolicy
} from "../packages/kernel-contracts/src/index.js";

const execFileAsync = promisify(execFile);
const now = "2026-07-11T00:00:00.000Z";

test("fake App Server flow previews, journals, accepts, and retains without a parallel runtime", async () => {
  const fixture = await createAdapterFixture();
  const events = hydrateFlow(fixture.head, fixture.beforeHash, fixture.afterHash);
  const proposed = await fixture.adapter.ingest(events[0]);
  assert.equal(proposed.status, "proposed");
  assert.equal(proposed.lifecycleState, "proposed");

  const accepted = await fixture.adapter.ingest(events[1]);
  assert.equal(accepted.status, "accepted");
  assert.equal(accepted.lifecycleState, "accepted_by_app_server");
  assert.equal(accepted.authorizationDecision?.approvalMode, "policy_auto");
  assert.equal(accepted.previewReceipt?.status, "preview_passed");
  assert.equal(fixture.transport.messages.length, 1);
  assert.equal(fixture.transport.messages[0]?.decision, "accept");
  const pending = await fixture.journal.list();
  assert.equal(pending.length, 1);
  assert.equal(pending[0]?.state, "accepted");
  assert.equal(JSON.stringify(pending).includes("diff --git"), false);
  assert.equal(await readFile(join(fixture.repoRoot, "docs/guide.md"), "utf8"), "new\n");

  const resolved = await fixture.adapter.ingest(events[2]);
  assert.equal(resolved.status, "accepted");
  const completed = await fixture.adapter.ingest(events[3]);
  assert.equal(completed.status, "retained");
  assert.equal(completed.lifecycleState, "post_checked");
  assert.equal(completed.retainReceipt?.changeSetHash, accepted.previewReceipt?.changeSetHash);
  const postCheckedJournal = (await fixture.journal.list())[0];
  assert.equal(postCheckedJournal?.state, "post_checked");
  assert.equal(
    postCheckedJournal?.retainReceipt?.receiptId,
    completed.retainReceipt?.receiptId
  );
  assert.deepEqual(
    postCheckedJournal?.targetHashes,
    completed.retainReceipt?.targetHashes
  );
  assert.equal(
    fixture.adapter.getItemSnapshot("thread-1", "turn-1", "item-1")?.state,
    "post_checked"
  );
  await rm(fixture.tempRoot, { recursive: true, force: true });
});

test("concurrent approval and resolution events are serialized before acceptance", async () => {
  const fixture = await createAdapterFixture();
  const events = hydrateFlow(fixture.head, fixture.beforeHash, fixture.afterHash);
  await fixture.adapter.ingest(events[0]);

  const [approved, resolved] = await Promise.all([
    fixture.adapter.ingest(events[1]),
    fixture.adapter.ingest(events[2])
  ]);

  assert.equal(approved.status, "accepted");
  assert.equal(resolved.status, "accepted");
  assert.equal(fixture.transport.messages.length, 1);
  assert.equal(fixture.transport.messages[0]?.decision, "accept");
  assert.equal((await fixture.journal.list())[0]?.state, "accepted");
  await rm(fixture.tempRoot, { recursive: true, force: true });
});

test("unproven sessions stay observe-only and cannot claim governed retain", async () => {
  const fixture = await createAdapterFixture({ allowTestProfiles: false });
  const events = hydrateFlow(fixture.head, fixture.beforeHash, fixture.afterHash);
  assert.equal(fixture.adapter.authorizationMode, "observe_only");
  await fixture.adapter.ingest(events[0]);
  const requested = await fixture.adapter.ingest(events[1]);
  assert.equal(requested.status, "manual_required");
  assert.ok(requested.reasons.includes("session_observe_only"));
  assert.equal(fixture.transport.messages.length, 0);

  const human = await fixture.adapter.resolveHumanApproval({
    requestId: "request-1",
    decision: "accept",
    operatorId: "operator-jenn"
  });
  assert.equal(human.status, "observed");
  assert.ok(human.reasons.includes("session_observe_only_no_governed_retain_claim"));
  await fixture.adapter.ingest(events[2]);
  const completed = await fixture.adapter.ingest(events[3]);
  assert.equal(completed.status, "observed");
  assert.equal((await fixture.journal.list()).length, 0);
  await rm(fixture.tempRoot, { recursive: true, force: true });
});

test("approval policy never remains observe-only even for an allowed fake profile", async () => {
  const fixture = await createAdapterFixture({ approvalPolicy: "never" });
  const events = hydrateFlow(fixture.head, fixture.beforeHash, fixture.afterHash);
  assert.equal(fixture.adapter.authorizationMode, "observe_only");
  await fixture.adapter.ingest(events[0]);
  const requested = await fixture.adapter.ingest(events[1]);
  assert.equal(requested.status, "manual_required");
  assert.ok(requested.reasons.includes("session_observe_only"));
  assert.equal(fixture.transport.messages.length, 0);
  await rm(fixture.tempRoot, { recursive: true, force: true });
});

test("command and permission approvals are always manual", async () => {
  const fixture = await createAdapterFixture();
  const command = {
    schemaVersion: "codex-app-server-normalized-event.v1",
    schemaProfileId: "fake-v2",
    eventId: "command-request",
    eventType: "approval_requested",
    sequence: 1,
    threadId: "thread-command",
    turnId: "turn-command",
    requestId: "request-command",
    itemId: "item-command",
    proposal: {
      kind: "command",
      argv: ["npm", "test"],
      cwd: "."
    }
  };
  const permission = {
    ...command,
    eventId: "permission-request",
    threadId: "thread-permission",
    turnId: "turn-permission",
    requestId: "request-permission",
    itemId: "item-permission",
    proposal: {
      kind: "permission",
      scope: "filesystem.write:docs/guide.md"
    }
  };

  const commandOutcome = await fixture.adapter.ingest(command);
  const permissionOutcome = await fixture.adapter.ingest(permission);
  assert.equal(commandOutcome.status, "manual_required");
  assert.equal(permissionOutcome.status, "manual_required");
  assert.equal(fixture.transport.messages.length, 0);

  const accepted = await fixture.adapter.resolveHumanApproval({
    requestId: "request-command",
    decision: "accept",
    operatorId: "operator-jenn"
  });
  assert.equal(accepted.status, "accepted");
  assert.equal(fixture.transport.messages[0]?.decision, "accept");
  await rm(fixture.tempRoot, { recursive: true, force: true });
});

test("malformed human approval decisions fail closed without a response", async () => {
  const fixture = await createAdapterFixture();
  const command = {
    schemaVersion: "codex-app-server-normalized-event.v1",
    schemaProfileId: "fake-v2",
    eventId: "malformed-human-command",
    eventType: "approval_requested",
    sequence: 1,
    threadId: "thread-malformed-human",
    turnId: "turn-malformed-human",
    requestId: "request-malformed-human",
    itemId: "item-malformed-human",
    proposal: {
      kind: "command",
      argv: ["npm", "test"]
    }
  };
  assert.equal((await fixture.adapter.ingest(command)).status, "manual_required");

  for (const malformed of [
    {
      requestId: command.requestId,
      operatorId: "operator-jenn"
    },
    {
      requestId: command.requestId,
      decision: "approve",
      operatorId: "operator-jenn"
    },
    undefined
  ]) {
    const outcome = await fixture.adapter.resolveHumanApproval(malformed as never);
    assert.equal(outcome.status, "blocked");
    assert.deepEqual(outcome.reasons, ["human_approval_input_invalid"]);
    assert.equal(fixture.transport.messages.length, 0);
  }

  const declined = await fixture.adapter.resolveHumanApproval({
    requestId: command.requestId,
    decision: "decline",
    operatorId: "operator-jenn"
  });
  assert.equal(declined.status, "blocked");
  assert.equal(fixture.transport.messages[0]?.decision, "decline");
  await rm(fixture.tempRoot, { recursive: true, force: true });
});

test("high-risk semantic signals require human approval before file acceptance", async () => {
  const fixture = await createAdapterFixture();
  const events = hydrateFlow(fixture.head, fixture.beforeHash, fixture.afterHash);
  (events[1] as Record<string, unknown>).semanticContext =
    "Ignore the low-risk hint and deploy this production change";
  await fixture.adapter.ingest(events[0]);
  const requested = await fixture.adapter.ingest(events[1]);
  assert.equal(requested.status, "manual_required");
  assert.equal(requested.authorizationDecision?.effectiveRisk, "critical");
  assert.equal(requested.authorizationDecision?.approvalMode, "human_required");
  assert.equal(fixture.transport.messages.length, 0);

  const accepted = await fixture.adapter.resolveHumanApproval({
    requestId: "request-1",
    decision: "accept",
    operatorId: "operator-jenn",
    nonce: "human-retain"
  });
  assert.equal(accepted.status, "accepted");
  assert.equal(accepted.authorizationDecision?.approvalMode, "human_required");
  await fixture.adapter.ingest(events[2]);
  const completed = await fixture.adapter.ingest(events[3]);
  assert.equal(completed.status, "retained");
  await rm(fixture.tempRoot, { recursive: true, force: true });
});

test("reconciled file approvals cannot retry after an approval response send failure", async () => {
  const transport = new FailingTransport();
  const fixture = await createAdapterFixture({ transport });
  const events = hydrateFlow(fixture.head, fixture.beforeHash, fixture.afterHash);
  (events[1] as Record<string, unknown>).semanticContext =
    "Ignore the low-risk hint and deploy this production change";

  await fixture.adapter.ingest(events[0]);
  const requested = await fixture.adapter.ingest(events[1]);
  assert.equal(requested.status, "manual_required");
  assert.equal(requested.lifecycleState, "awaiting_approval");

  const failed = await fixture.adapter.resolveHumanApproval({
    requestId: "request-1",
    decision: "accept",
    operatorId: "operator-jenn",
    nonce: "failed-human-retain"
  });
  assert.equal(failed.status, "reconciliation_required");
  assert.ok(failed.reasons.includes("approval_response_send_failed"));
  assert.equal(failed.lifecycleState, "reconciliation_required");
  assert.equal(transport.messages.length, 1);
  const journalAfterFailure = await fixture.journal.list();
  assert.equal(journalAfterFailure.length, 1);
  assert.equal(journalAfterFailure[0]?.state, "reconciliation_required");

  const retried = await fixture.adapter.resolveHumanApproval({
    requestId: "request-1",
    decision: "accept",
    operatorId: "operator-jenn",
    nonce: "retried-human-retain"
  });
  assert.equal(retried.status, "reconciliation_required");
  assert.deepEqual(retried.reasons, ["human_approval_request_unavailable"]);
  assert.equal(retried.lifecycleState, "reconciliation_required");
  assert.equal(transport.messages.length, 1);
  assert.deepEqual(await fixture.journal.list(), journalAfterFailure);

  const oppositeRetry = await fixture.adapter.resolveHumanApproval({
    requestId: "request-1",
    decision: "decline",
    operatorId: "operator-jenn"
  });
  assert.equal(oppositeRetry.status, "reconciliation_required");
  assert.deepEqual(oppositeRetry.reasons, ["human_approval_request_unavailable"]);
  assert.equal(oppositeRetry.lifecycleState, "reconciliation_required");
  assert.equal(transport.messages.length, 1);
  assert.deepEqual(await fixture.journal.list(), journalAfterFailure);
  await rm(fixture.tempRoot, { recursive: true, force: true });
});

test("file decline delivery uncertainty remains reconciliation-only", async () => {
  const transport = new FailingTransport();
  const fixture = await createAdapterFixture({ transport });
  const events = hydrateFlow(fixture.head, fixture.beforeHash, fixture.afterHash);
  (events[1] as Record<string, unknown>).semanticContext =
    "Ignore the low-risk hint and deploy this production change";

  await fixture.adapter.ingest(events[0]);
  assert.equal((await fixture.adapter.ingest(events[1])).status, "manual_required");
  const failed = await fixture.adapter.resolveHumanApproval({
    requestId: "request-1",
    decision: "decline",
    operatorId: "operator-jenn"
  });
  assert.equal(failed.status, "reconciliation_required");
  assert.deepEqual(failed.reasons, ["approval_response_send_failed"]);
  assert.equal(failed.lifecycleState, "reconciliation_required");
  assert.equal(transport.messages.length, 1);
  assert.equal((await fixture.journal.list()).length, 0);

  const retried = await fixture.adapter.resolveHumanApproval({
    requestId: "request-1",
    decision: "accept",
    operatorId: "operator-jenn"
  });
  assert.equal(retried.status, "reconciliation_required");
  assert.deepEqual(retried.reasons, ["human_approval_request_unavailable"]);
  assert.equal(retried.lifecycleState, "reconciliation_required");
  assert.equal(transport.messages.length, 1);
  await rm(fixture.tempRoot, { recursive: true, force: true });
});

test("observe-only file delivery uncertainty cannot be retried", async () => {
  const transport = new FailingTransport();
  const fixture = await createAdapterFixture({
    allowTestProfiles: false,
    transport
  });
  const events = hydrateFlow(fixture.head, fixture.beforeHash, fixture.afterHash);

  await fixture.adapter.ingest(events[0]);
  assert.equal((await fixture.adapter.ingest(events[1])).status, "manual_required");
  const failed = await fixture.adapter.resolveHumanApproval({
    requestId: "request-1",
    decision: "accept",
    operatorId: "operator-jenn"
  });
  assert.equal(failed.status, "reconciliation_required");
  assert.ok(failed.reasons.includes("approval_response_send_failed"));
  assert.equal(failed.lifecycleState, "reconciliation_required");
  assert.equal(transport.messages.length, 1);
  assert.equal((await fixture.journal.list()).length, 0);

  const retried = await fixture.adapter.resolveHumanApproval({
    requestId: "request-1",
    decision: "decline",
    operatorId: "operator-jenn"
  });
  assert.equal(retried.status, "reconciliation_required");
  assert.deepEqual(retried.reasons, ["human_approval_request_unavailable"]);
  assert.equal(retried.lifecycleState, "reconciliation_required");
  assert.equal(transport.messages.length, 1);
  await rm(fixture.tempRoot, { recursive: true, force: true });
});

test("command and permission delivery uncertainty blocks the turn and cannot be retried", async () => {
  for (const [caseId, kind, decision, resolution] of [
    ["command-match", "command", "accept", "accept"],
    ["permission-match", "permission", "decline", "decline"],
    ["command-opposite", "command", "accept", "decline"],
    ["permission-cancelled", "permission", "decline", "cancelled"]
  ] as const) {
    const transport = new FailingTransport();
    const fixture = await createAdapterFixture({ transport });
    const proposal = kind === "command"
      ? { kind, argv: ["npm", "test"], cwd: "." }
      : { kind, scope: "filesystem.write:docs/guide.md" };
    const requested = await fixture.adapter.ingest({
      schemaVersion: "codex-app-server-normalized-event.v1",
      schemaProfileId: "fake-v2",
      eventId: `${caseId}-uncertain`,
      eventType: "approval_requested",
      sequence: 1,
      threadId: `thread-${caseId}-uncertain`,
      turnId: `turn-${caseId}-uncertain`,
      requestId: `request-${caseId}-uncertain`,
      itemId: `item-${caseId}-uncertain`,
      proposal
    });
    assert.equal(requested.status, "manual_required");

    const failed = await fixture.adapter.resolveHumanApproval({
      requestId: `request-${caseId}-uncertain`,
      decision,
      operatorId: "operator-jenn"
    });
    assert.equal(failed.status, "reconciliation_required", caseId);
    assert.deepEqual(failed.reasons, ["approval_response_send_failed"], caseId);
    assert.equal(transport.messages.length, 1, caseId);

    const resolved = await fixture.adapter.ingest({
      schemaVersion: "codex-app-server-normalized-event.v1",
      schemaProfileId: "fake-v2",
      eventId: `${caseId}-uncertain-resolved`,
      eventType: "request_resolved",
      sequence: 2,
      threadId: `thread-${caseId}-uncertain`,
      turnId: `turn-${caseId}-uncertain`,
      requestId: `request-${caseId}-uncertain`,
      itemId: `item-${caseId}-uncertain`,
      resolution
    });
    assert.equal(resolved.status, "reconciliation_required", caseId);
    assert.deepEqual(
      resolved.reasons,
      ["approval_response_delivery_uncertain"],
      caseId
    );

    const retried = await fixture.adapter.resolveHumanApproval({
      requestId: `request-${caseId}-uncertain`,
      decision: decision === "accept" ? "decline" : "accept",
      operatorId: "operator-jenn"
    });
    assert.equal(retried.status, "reconciliation_required", caseId);
    assert.deepEqual(
      retried.reasons,
      ["human_approval_request_unavailable"],
      caseId
    );
    assert.equal(transport.messages.length, 1, caseId);
    await rm(fixture.tempRoot, { recursive: true, force: true });
  }
});

test("duplicate item starts reconcile an already accepted journal", async () => {
  const fixture = await createAdapterFixture();
  const events = hydrateFlow(fixture.head, fixture.beforeHash, fixture.afterHash);

  await fixture.adapter.ingest(events[0]);
  assert.equal((await fixture.adapter.ingest(events[1])).status, "accepted");
  assert.equal((await fixture.journal.list())[0]?.state, "accepted");
  assert.equal(fixture.transport.messages.length, 1);

  const duplicate = await fixture.adapter.ingest({
    ...(events[0] as Record<string, unknown>),
    eventId: "event-item-started-duplicate",
    sequence: 3
  });
  assert.equal(duplicate.status, "reconciliation_required");
  assert.deepEqual(duplicate.reasons, ["duplicate_item_started"]);
  assert.equal(
    fixture.adapter.getItemSnapshot("thread-1", "turn-1", "item-1")?.state,
    "reconciliation_required"
  );
  assert.equal((await fixture.journal.list())[0]?.state, "reconciliation_required");
  assert.equal(fixture.transport.messages.length, 1);
  await rm(fixture.tempRoot, { recursive: true, force: true });
});

test("canonicalization failures reconcile an already accepted journal", async () => {
  const fixture = await createAdapterFixture();
  const events = hydrateFlow(fixture.head, fixture.beforeHash, fixture.afterHash);

  await fixture.adapter.ingest(events[0]);
  assert.equal((await fixture.adapter.ingest(events[1])).status, "accepted");
  assert.equal((await fixture.journal.list())[0]?.state, "accepted");
  assert.equal(fixture.transport.messages.length, 1);

  const malformed = await fixture.adapter.ingest({
    ...(events[0] as Record<string, unknown>),
    eventId: "event-item-started-malformed",
    sequence: 3,
    item: {
      ...((events[0] as { item: Record<string, unknown> }).item),
      itemId: "item-malformed",
      changes: [{
        path: "../outside.md",
        kind: "create",
        unifiedDiff: "diff --git a/../outside.md b/../outside.md\n--- /dev/null\n+++ b/../outside.md\n@@ -0,0 +1 @@\n+unsafe\n",
        afterHash: sha256(Buffer.from("unsafe\n"))
      }]
    }
  });

  assert.equal(malformed.status, "reconciliation_required");
  assert.deepEqual(malformed.reasons, ["file_change_canonicalization_failed"]);
  assert.equal(
    fixture.adapter.getItemSnapshot("thread-1", "turn-1", "item-1")?.state,
    "reconciliation_required"
  );
  assert.equal((await fixture.journal.list())[0]?.state, "reconciliation_required");
  assert.equal(fixture.transport.messages.length, 1);
  await rm(fixture.tempRoot, { recursive: true, force: true });
});

test("duplicate approval request ids quarantine without consuming pending approval", async () => {
  const fixture = await createAdapterFixture();
  const events = hydrateFlow(fixture.head, fixture.beforeHash, fixture.afterHash);
  (events[1] as Record<string, unknown>).semanticContext =
    "Ignore the low-risk hint and deploy this production change";

  await fixture.adapter.ingest(events[0]);
  const pending = await fixture.adapter.ingest(events[1]);
  assert.equal(pending.status, "manual_required");
  assert.equal(pending.lifecycleState, "awaiting_approval");
  assert.equal(fixture.transport.messages.length, 0);

  const duplicate = await fixture.adapter.ingest({
    ...(events[1] as Record<string, unknown>),
    eventId: "event-approval-requested-duplicate-id",
    sequence: 1,
    threadId: "thread-duplicate",
    turnId: "turn-duplicate",
    itemId: "item-duplicate"
  });

  assert.equal(duplicate.status, "reconciliation_required");
  assert.ok(duplicate.reasons.includes("app_server_session_quarantined"));
  assert.ok(duplicate.reasons.includes("duplicate_approval_request_id"));
  assert.equal(fixture.transport.messages.length, 0);
  assert.equal(
    fixture.adapter.getItemSnapshot("thread-1", "turn-1", "item-1")?.state,
    "reconciliation_required"
  );

  const lateHuman = await fixture.adapter.resolveHumanApproval({
    requestId: "request-1",
    decision: "accept",
    operatorId: "operator-jenn"
  });
  assert.equal(lateHuman.status, "reconciliation_required");
  assert.ok(lateHuman.reasons.includes("duplicate_approval_request_id"));
  assert.equal(fixture.transport.messages.length, 0);
  await rm(fixture.tempRoot, { recursive: true, force: true });
});

test("duplicate approval ids retry durable journal reconciliation failures", async () => {
  const journal = new OneShotFailingJournalStore();
  const fixture = await createAdapterFixture({ journal });
  const events = hydrateFlow(fixture.head, fixture.beforeHash, fixture.afterHash);

  await fixture.adapter.ingest(events[0]);
  const accepted = await fixture.adapter.ingest(events[1]);
  assert.equal(accepted.status, "accepted");
  assert.equal((await journal.list())[0]?.state, "accepted");
  assert.equal(fixture.transport.messages.length, 1);

  journal.failNextUpdate();
  const duplicate = await fixture.adapter.ingest({
    ...(events[1] as Record<string, unknown>),
    eventId: "event-approval-requested-duplicate-journal",
    sequence: 1,
    threadId: "thread-duplicate-journal",
    turnId: "turn-duplicate-journal",
    itemId: "item-duplicate-journal"
  });
  assert.equal(duplicate.status, "reconciliation_required");
  assert.ok(duplicate.reasons.includes("duplicate_approval_request_id"));
  assert.ok(duplicate.reasons.includes("pending_journal_reconciliation_update_failed"));
  assert.equal((await journal.list())[0]?.state, "accepted");
  assert.equal(
    fixture.adapter.getItemSnapshot("thread-1", "turn-1", "item-1")?.state,
    "reconciliation_required"
  );

  const retried = await fixture.adapter.resolveHumanApproval({
    requestId: "request-1",
    decision: "accept",
    operatorId: "operator-jenn"
  });
  assert.equal(retried.status, "reconciliation_required");
  assert.equal(
    retried.reasons.includes("pending_journal_reconciliation_update_failed"),
    false
  );
  assert.equal((await journal.list())[0]?.state, "reconciliation_required");
  assert.equal(fixture.transport.messages.length, 1);
  await rm(fixture.tempRoot, { recursive: true, force: true });
});

test("event gaps, replay, disconnect, and schema drift never auto-approve", async () => {
  {
    const fixture = await createAdapterFixture();
    const events = hydrateFlow(fixture.head, fixture.beforeHash, fixture.afterHash);
    const gap = await fixture.adapter.ingest(events[1]);
    assert.equal(gap.status, "reconciliation_required");
    assert.ok(gap.reasons.includes("app_server_event_gap"));
    assert.equal(fixture.transport.messages.length, 0);
    await rm(fixture.tempRoot, { recursive: true, force: true });
  }
  {
    const fixture = await createAdapterFixture();
    const events = hydrateFlow(fixture.head, fixture.beforeHash, fixture.afterHash);
    await fixture.adapter.ingest(events[0]);
    const accepted = await fixture.adapter.ingest(events[1]);
    assert.equal(accepted.status, "accepted");
    const replay = await fixture.adapter.ingest(events[1]);
    assert.equal(replay.status, "reconciliation_required");
    assert.ok(replay.reasons.includes("app_server_event_replay"));
    assert.equal((await fixture.journal.list())[0]?.state, "reconciliation_required");
    await rm(fixture.tempRoot, { recursive: true, force: true });
  }
  {
    const fixture = await createAdapterFixture();
    const events = hydrateFlow(fixture.head, fixture.beforeHash, fixture.afterHash);
    await fixture.adapter.ingest(events[0]);
    await fixture.adapter.ingest(events[1]);
    const disconnected = await fixture.adapter.ingest({
      schemaVersion: "codex-app-server-normalized-event.v1",
      schemaProfileId: "fake-v2",
      eventId: "disconnect-1",
      eventType: "transport_disconnected"
    });
    assert.equal(disconnected.status, "reconciliation_required");
    assert.equal((await fixture.journal.list())[0]?.state, "reconciliation_required");
    await rm(fixture.tempRoot, { recursive: true, force: true });
  }
  {
    const fixture = await createAdapterFixture();
    const drift = await fixture.adapter.ingest({
      schemaVersion: "unknown-schema",
      eventType: "approval_requested",
      requestId: "unsafe"
    });
    assert.equal(drift.status, "reconciliation_required");
    assert.ok(drift.reasons.includes("app_server_schema_drift"));
    assert.equal(fixture.transport.messages.length, 0);
    await rm(fixture.tempRoot, { recursive: true, force: true });
  }
});

test("preview isolation mismatch downgrades the whole session to observe-only", async () => {
  const fixture = await createAdapterFixture({
    isolation: {
      networkIsolation: "unsupported",
      filesystemIsolation: "unsupported",
      scope: "test_only",
      enforcerId: "none"
    }
  });
  const events = hydrateFlow(fixture.head, fixture.beforeHash, fixture.afterHash);
  await fixture.adapter.ingest(events[0]);
  const requested = await fixture.adapter.ingest(events[1]);
  assert.equal(requested.status, "manual_required");
  assert.equal(requested.previewReceipt, undefined);
  assert.ok(requested.reasons.includes("session_observe_only"));
  assert.equal(fixture.transport.messages.length, 0);
  assert.equal(await readFile(join(fixture.repoRoot, "docs/guide.md"), "utf8"), "old\n");
  await rm(fixture.tempRoot, { recursive: true, force: true });
});

test("replay or disconnect permanently quarantines the attested session", async () => {
  {
    const fixture = await createAdapterFixture();
    const events = hydrateFlow(fixture.head, fixture.beforeHash, fixture.afterHash);
    await fixture.adapter.ingest(events[0]);
    const replay = await fixture.adapter.ingest(events[0]);
    assert.equal(replay.status, "reconciliation_required");
    const lateApproval = await fixture.adapter.ingest(events[1]);
    assert.equal(lateApproval.status, "reconciliation_required");
    assert.ok(lateApproval.reasons.includes("app_server_session_quarantined"));
    assert.equal(fixture.transport.messages.length, 0);
    await rm(fixture.tempRoot, { recursive: true, force: true });
  }
  {
    const fixture = await createAdapterFixture();
    const disconnected = await fixture.adapter.ingest({
      schemaVersion: "codex-app-server-normalized-event.v1",
      schemaProfileId: "fake-v2",
      eventId: "disconnect-before-turn",
      eventType: "transport_disconnected"
    });
    assert.equal(disconnected.status, "reconciliation_required");
    const events = hydrateFlow(fixture.head, fixture.beforeHash, fixture.afterHash);
    const newTurn = await fixture.adapter.ingest(events[0]);
    assert.equal(newTurn.status, "reconciliation_required");
    assert.equal(fixture.transport.messages.length, 0);
    await rm(fixture.tempRoot, { recursive: true, force: true });
  }
});

test("normalized events reject unknown fields and quarantine later valid input", async () => {
  const fixture = await createAdapterFixture();
  const events = hydrateFlow(fixture.head, fixture.beforeHash, fixture.afterHash);
  const drift = await fixture.adapter.ingest({
    ...(events[0] as Record<string, unknown>),
    unexpectedExecutionPayload: { command: ["npm", "publish"] }
  });
  assert.equal(drift.status, "reconciliation_required");
  assert.ok(drift.reasons.includes("app_server_schema_drift"));
  const later = await fixture.adapter.ingest(events[0]);
  assert.equal(later.status, "reconciliation_required");
  assert.equal(fixture.transport.messages.length, 0);
  await rm(fixture.tempRoot, { recursive: true, force: true });
});

test("cancelled command approval cannot be accepted by a late operator action", async () => {
  const fixture = await createAdapterFixture();
  const command = {
    schemaVersion: "codex-app-server-normalized-event.v1",
    schemaProfileId: "fake-v2",
    eventId: "command-request-cancelled",
    eventType: "approval_requested",
    sequence: 1,
    threadId: "thread-command-cancelled",
    turnId: "turn-command-cancelled",
    requestId: "request-command-cancelled",
    itemId: "item-command-cancelled",
    proposal: {
      kind: "command",
      argv: ["npm", "test"],
      cwd: "."
    }
  };
  const requested = await fixture.adapter.ingest(command);
  assert.equal(requested.status, "manual_required");
  assert.deepEqual(requested.approvalProposal, command.proposal);
  const cancelled = await fixture.adapter.ingest({
    schemaVersion: "codex-app-server-normalized-event.v1",
    schemaProfileId: "fake-v2",
    eventId: "command-cancelled",
    eventType: "request_resolved",
    sequence: 2,
    threadId: command.threadId,
    turnId: command.turnId,
    requestId: command.requestId,
    itemId: command.itemId,
    resolution: "cancelled"
  });
  assert.equal(cancelled.status, "blocked");
  const late = await fixture.adapter.resolveHumanApproval({
    requestId: command.requestId,
    decision: "accept",
    operatorId: "operator-jenn"
  });
  assert.equal(late.status, "blocked");
  assert.equal(fixture.transport.messages.length, 0);
  await rm(fixture.tempRoot, { recursive: true, force: true });
});

test("operator acceptance and inbound cancellation share one serial queue", async () => {
  const transport = new BlockingTransport();
  const fixture = await createAdapterFixture({ transport });
  const command = {
    schemaVersion: "codex-app-server-normalized-event.v1",
    schemaProfileId: "fake-v2",
    eventId: "command-request-concurrent",
    eventType: "approval_requested",
    sequence: 1,
    threadId: "thread-command-concurrent",
    turnId: "turn-command-concurrent",
    requestId: "request-command-concurrent",
    itemId: "item-command-concurrent",
    proposal: {
      kind: "command",
      argv: ["npm", "test"],
      cwd: "."
    }
  };
  assert.equal((await fixture.adapter.ingest(command)).status, "manual_required");

  const operator = fixture.adapter.resolveHumanApproval({
    requestId: command.requestId,
    decision: "accept",
    operatorId: "operator-jenn"
  });
  await transport.waitUntilSendStarted();
  let cancellationSettled = false;
  const cancellation = fixture.adapter.ingest({
    schemaVersion: "codex-app-server-normalized-event.v1",
    schemaProfileId: "fake-v2",
    eventId: "command-cancelled-concurrent",
    eventType: "request_resolved",
    sequence: 2,
    threadId: command.threadId,
    turnId: command.turnId,
    requestId: command.requestId,
    itemId: command.itemId,
    resolution: "cancelled"
  }).then((outcome) => {
    cancellationSettled = true;
    return outcome;
  });
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(cancellationSettled, false);

  transport.releaseSend();
  assert.equal((await operator).status, "accepted");
  const cancelled = await cancellation;
  assert.equal(cancelled.status, "reconciliation_required");
  assert.equal(fixture.transport.messages.length, 1);
  await rm(fixture.tempRoot, { recursive: true, force: true });
});

test("destructive changes and missing expected hashes are declined before App Server apply", async () => {
  for (const mode of ["delete", "missing_after"] as const) {
    const fixture = await createAdapterFixture();
    const events = hydrateFlow(fixture.head, fixture.beforeHash, fixture.afterHash);
    const started = events[0] as {
      item: { changes: Array<Record<string, unknown>> };
    };
    if (mode === "delete") {
      started.item.changes = [{
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
        beforeHash: fixture.beforeHash,
        afterHash: null
      }];
    } else {
      delete started.item.changes[0]?.afterHash;
    }
    const proposed = await fixture.adapter.ingest(events[0]);
    assert.equal(proposed.status, "proposed");
    const declined = await fixture.adapter.ingest(events[1]);
    assert.equal(declined.status, "blocked");
    assert.ok(declined.reasons.includes(
      mode === "delete"
        ? "destructive_file_change_unsupported"
        : "file_change_expected_hash_missing"
    ));
    assert.equal(fixture.transport.messages.length, 1);
    assert.equal(fixture.transport.messages[0]?.decision, "decline");
    assert.equal(await readFile(join(fixture.repoRoot, "docs/guide.md"), "utf8"), "old\n");
    await rm(fixture.tempRoot, { recursive: true, force: true });
  }
});

test("a restarted adapter quarantines unresolved durable journal state", async () => {
  const first = await createAdapterFixture();
  const firstEvents = hydrateFlow(first.head, first.beforeHash, first.afterHash);
  await first.adapter.ingest(firstEvents[0]);
  assert.equal((await first.adapter.ingest(firstEvents[1])).status, "accepted");
  assert.equal((await first.journal.list())[0]?.state, "accepted");

  const restarted = await createAdapterFixture({ journal: first.journal });
  const restartedEvents = hydrateFlow(
    restarted.head,
    restarted.beforeHash,
    restarted.afterHash
  );
  const result = await restarted.adapter.ingest(restartedEvents[0]);
  assert.equal(result.status, "reconciliation_required");
  assert.ok(result.reasons.includes("adapter_restart_with_unresolved_journal"));
  assert.equal(restarted.transport.messages.length, 0);
  await rm(first.tempRoot, { recursive: true, force: true });
  await rm(restarted.tempRoot, { recursive: true, force: true });
});

test("seeded event-order property never approves a turn whose first sequence is not one", async () => {
  const fixture = await createAdapterFixture();
  const [template] = hydrateFlow(fixture.head, fixture.beforeHash, fixture.afterHash) as Array<
    Record<string, unknown>
  >;
  let state = 0x2046_0711;
  for (let index = 0; index < 32; index += 1) {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    const result = await fixture.adapter.ingest({
      ...structuredClone(template),
      eventId: `fuzz-order-${index}-${state}`,
      threadId: `thread-fuzz-${index}`,
      turnId: `turn-fuzz-${index}`,
      sequence: 2 + (state % 100)
    });
    assert.equal(result.status, "reconciliation_required");
    assert.ok(result.reasons.includes("app_server_event_gap"));
  }
  assert.equal(fixture.transport.messages.length, 0);
  await rm(fixture.tempRoot, { recursive: true, force: true });
});

test("SDK adapter exposes read-only authorization only", () => {
  const readScope = {
    schemaVersion: "capability-scope.v1" as const,
    kind: "file" as const,
    resource: "docs/guide.md",
    access: "read" as const,
    constraints: {}
  };
  const writeScope = { ...readScope, access: "write" as const };
  const facts = deriveCapabilityFacts({
    subjectId: "sdk-read",
    repository: {
      branch: "feature/safe",
      protectedBranch: false,
      worktreeClean: true,
      headCommit: "head",
      expectedHead: "head"
    },
    exactTargets: true,
    observedAt: now
  });
  const adapter = new CodexSdkAdapter({
    capabilityCeiling: [readScope, writeScope],
    now: () => now
  });
  const read = adapter.authorizeReadOnly({
    facts,
    semanticContext: "review the file",
    requestedCapabilities: [readScope]
  });
  const write = adapter.authorizeReadOnly({
    facts,
    semanticContext: "write the file",
    requestedCapabilities: [writeScope]
  });
  assert.equal(read.disposition, "authorized");
  assert.deepEqual(read.authorizedCapabilities, [readScope]);
  assert.equal(write.disposition, "blocked");
  assert.deepEqual(write.authorizedCapabilities, []);
});

class FakeTransport implements CodexAppServerMessageTransport {
  readonly messages: CodexAppServerApprovalResponse[] = [];

  constructor(private readonly onAccept?: () => Promise<void>) {}

  async send(message: CodexAppServerApprovalResponse): Promise<void> {
    this.messages.push(structuredClone(message));
    if (message.decision === "accept") {
      await this.onAccept?.();
    }
  }
}

class FailingTransport extends FakeTransport {
  override async send(message: CodexAppServerApprovalResponse): Promise<void> {
    this.messages.push(structuredClone(message));
    throw new Error("injected_approval_response_send_failure");
  }
}

class BlockingTransport extends FakeTransport {
  private readonly sendStarted: Promise<void>;
  private markSendStarted!: () => void;
  private readonly sendReleased: Promise<void>;
  private markSendReleased!: () => void;

  constructor() {
    super();
    this.sendStarted = new Promise((resolve) => {
      this.markSendStarted = resolve;
    });
    this.sendReleased = new Promise((resolve) => {
      this.markSendReleased = resolve;
    });
  }

  override async send(message: CodexAppServerApprovalResponse): Promise<void> {
    this.markSendStarted();
    await this.sendReleased;
    await super.send(message);
  }

  waitUntilSendStarted(): Promise<void> {
    return this.sendStarted;
  }

  releaseSend(): void {
    this.markSendReleased();
  }
}

class OneShotFailingJournalStore extends InMemoryPendingApprovalJournalStore {
  private updateFailuresRemaining = 0;

  failNextUpdate(): void {
    this.updateFailuresRemaining += 1;
  }

  override async update(
    journalId: string,
    update: (current: PendingApprovalJournalEntry) => PendingApprovalJournalEntry
  ): Promise<PendingApprovalJournalEntry> {
    if (this.updateFailuresRemaining > 0) {
      this.updateFailuresRemaining -= 1;
      throw new Error("injected_pending_journal_update_failure");
    }
    return super.update(journalId, update);
  }
}

async function createAdapterFixture(options: {
  allowTestProfiles?: boolean;
  approvalPolicy?: AppServerSessionAttestation["effectiveApprovalPolicy"];
  isolation?: {
    networkIsolation: "enforced_none" | "unsupported";
    filesystemIsolation: "clone_only_enforced" | "unsupported";
    scope: "test_only" | "live";
    enforcerId: string;
  };
  journal?: PendingApprovalJournalStore;
  transport?: FakeTransport;
} = {}) {
  const tempRoot = await mkdtemp(join(tmpdir(), "codex-adapter-"));
  const repoRoot = join(tempRoot, "repo");
  await mkdir(join(repoRoot, "docs"), { recursive: true });
  await git(["init"], repoRoot);
  await git(["config", "user.email", "adapter@example.invalid"], repoRoot);
  await git(["config", "user.name", "Adapter Fixture"], repoRoot);
  await writeFile(join(repoRoot, "docs/guide.md"), "old\n", "utf8");
  await git(["add", "."], repoRoot);
  await git(["commit", "-m", "initial"], repoRoot);
  await git(["switch", "-c", "feature/safe"], repoRoot);
  const head = (await git(["rev-parse", "HEAD"], repoRoot)).trim();
  const beforeHash = sha256(Buffer.from("old\n"));
  const afterHash = sha256(Buffer.from("new\n"));
  const transport = options.transport ?? new FakeTransport(async () => {
    await writeFile(join(repoRoot, "docs/guide.md"), "new\n", "utf8");
  });
  const journal = options.journal ?? new InMemoryPendingApprovalJournalStore();
  const previewPolicy: PreviewPolicy = {
    schemaVersion: "preview-policy.v1",
    autoApprovalRules: [{
      ruleId: "safe-docs",
      allowedPaths: ["docs/**"],
      operations: ["update"],
      maxFiles: 2,
      maxDiffLines: 20,
      prepare: [],
      checks: [{
        argv: [process.execPath, "-e", "process.exit(0)"],
        timeoutMs: 10_000
      }]
    }]
  };
  const attestation = structuredClone(sessionAttestationFixture) as AppServerSessionAttestation;
  if (options.approvalPolicy !== undefined) {
    attestation.effectiveApprovalPolicy = options.approvalPolicy;
  }
  const adapter = new CodexAppServerAdapter({
    sessionAttestation: attestation,
    transport,
    journalStore: journal,
    previewer: createTestOnlyLocalClonePreviewer({ tempRoot }),
    previewPolicy,
    previewIsolation: options.isolation ?? {
      networkIsolation: "enforced_none",
      filesystemIsolation: "clone_only_enforced",
      scope: "test_only",
      enforcerId: "disposable-test-harness"
    },
    workspaceContextProvider: {
      async getContext(changeSet) {
        return {
          repoRoot,
          repository: {
            branch: "feature/safe",
            protectedBranch: false,
            worktreeClean: true,
            headCommit: head,
            expectedHead: changeSet.baseHead
          },
          networkAccess: "none",
          credentialAccess: "none",
          exactTargets: true
        };
      }
    },
    capabilityCeiling: [{
      schemaVersion: "capability-scope.v1",
      kind: "file",
      resource: "docs/**",
      access: "write",
      constraints: {}
    }],
    allowTestProfiles: options.allowTestProfiles ?? true,
    now: () => now,
    nonce: (requestId) => `nonce-${requestId}`
  });
  return {
    tempRoot,
    repoRoot,
    head,
    beforeHash,
    afterHash,
    transport,
    journal,
    adapter
  };
}

function hydrateFlow(head: string, beforeHash: string, afterHash: string): unknown[] {
  return JSON.parse(
    JSON.stringify(fileChangeFlowFixture)
      .replaceAll("$HEAD", head)
      .replaceAll("$BEFORE_HASH", beforeHash)
      .replaceAll("$AFTER_HASH", afterHash)
  ) as unknown[];
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
