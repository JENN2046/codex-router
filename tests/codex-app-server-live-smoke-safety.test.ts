import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, realpath, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

import sessionAttestationFixture from "./fixtures/codex-app-server/fake-v2/session-attestation.json" with { type: "json" };
import v2WireFileChangeFlowFixture from "./fixtures/codex-app-server/v2-wire/file-change-flow.json" with { type: "json" };

import {
  CodexAppServerAdapter,
  CodexAppServerV2WireAdapter,
  CodexAppServerV2WireNormalizer,
  type AppServerSessionAttestation
} from "../packages/codex-adapter/src/index.js";
import type { PreviewPolicy } from "../packages/kernel-contracts/src/index.js";
import { InMemoryPendingApprovalJournalStore } from "../packages/retain-control/src/index.js";

import {
  APP_SERVER_FILE_CHANGE_INTERCEPTION_PROVEN,
  OfflineDeclineOnlyAppServerHarness,
  RecordedAppServerWireBoundary,
  RecordedDeclineOnlyAppServerV2WireTransport,
  SanitizedWireTranscriptRecorder,
  assertAppServerFileChangeInterceptionProven,
  assertAppServerFileChangeInterceptionPreConnection,
  captureAppServerSmokeWorkspace,
  createIndependentAppServerSmokeClone,
  createAppServerSmokeProcessEnv,
  createSanitizedWireTranscriptEvidenceBinding,
  disconnectAndWaitForAppServerSmokeQuiescence,
  evaluateAppServerFileChangeInterceptionPreflight,
  evaluateOfflineApprovalInterceptionProof,
  sanitizeWireTranscriptEntry,
  waitForAppServerSmokeQuiescence,
  type SanitizedWireTranscriptEntry,
  type WorkspaceSnapshot
} from "../scripts/lib/codex-app-server-live-smoke-safety.js";

const execFileAsync = promisify(execFile);
function completedOfflineHarnessOutcome(entries: readonly SanitizedWireTranscriptEntry[]) {
  const binding = createSanitizedWireTranscriptEvidenceBinding(entries);
  return {
    status: "completed" as const,
    handshakeComplete: true,
    disconnectObserved: true,
    transcriptFinalSequence: binding.finalSequence,
    transcriptSequenceHash: binding.transcriptSequenceHash,
    reasons: []
  };
}

async function git(cwd: string, args: string[]): Promise<string> {
  return (await execFileAsync("git", args, { cwd, encoding: "utf8" })).stdout;
}

test("sanitized wire transcript preserves order and decline without raw payloads", async () => {
  const root = await mkdtemp(join(tmpdir(), "codex-router-wire-transcript-"));
  try {
    const transcriptPath = join(root, "wire.jsonl");
    const recorder = await SanitizedWireTranscriptRecorder.create(
      transcriptPath,
      () => new Date("2026-07-14T01:00:00.000Z")
    );
    const rawSecret = "sk-secret-must-not-survive";
    const rawPrompt = "replace private customer payload";
    await recorder.record("inbound", {
      id: "approval-request-sensitive-id",
      method: "item/fileChange/requestApproval",
      params: {
        threadId: "thread-private",
        turnId: "turn-private",
        reason: rawPrompt,
        token: rawSecret,
        diff: "+PASSWORD=raw-password"
      }
    });
    await recorder.record("outbound", {
      id: "approval-request-sensitive-id",
      result: { decision: "decline" }
    });
    await recorder.record("inbound", {
      method: "secretMethodPayloadMustNotSurvive",
      params: {}
    });
    await recorder.close();

    const transcript = await readFile(transcriptPath, "utf8");
    for (const forbidden of [
      rawSecret,
      rawPrompt,
      "raw-password",
      "approval-request-sensitive-id",
      "secretMethodPayloadMustNotSurvive"
    ]) {
      assert.equal(transcript.includes(forbidden), false);
    }
    const entries = transcript.trim().split("\n").map((line) => JSON.parse(line) as Record<string, unknown>);
    assert.deepEqual(entries.map((entry) => entry.sequence), [1, 2, 3]);
    assert.equal(entries[0]?.method, "item/fileChange/requestApproval");
    assert.equal(entries[1]?.approvalDecision, "decline");
    assert.equal(entries[2]?.method, undefined);
    assert.equal(typeof entries[2]?.methodHash, "string");
    if (process.platform !== "win32") {
      assert.equal((await stat(transcriptPath)).mode & 0o777, 0o600);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("recorded wire boundary persists before normalizer and transport side effects", async () => {
  const order: string[] = [];
  const boundary = new RecordedAppServerWireBoundary({
    async record(direction, message) {
      order.push(`record:${direction}`);
      return {
        schemaVersion: "codex-app-server-sanitized-wire-entry.v1",
        sequence: order.length,
        observedAt: "2026-07-14T01:00:00.000Z",
        direction,
        envelope: "notification",
        correlationHashes: {},
        payloadShapeHash: "a".repeat(64),
        stringCodeUnits: JSON.stringify(message).length,
        redactedScalarCount: 1
      };
    },
    async recordDelivery(message) {
      order.push("record:delivery");
      return {
        schemaVersion: "codex-app-server-sanitized-wire-entry.v1",
        sequence: order.length,
        observedAt: "2026-07-14T01:00:00.000Z",
        direction: "outbound",
        envelope: "response",
        correlationHashes: {},
        deliveryConfirmed: true,
        payloadShapeHash: "a".repeat(64),
        stringCodeUnits: JSON.stringify(message).length,
        redactedScalarCount: 1
      };
    }
  });
  await boundary.ingest({ method: "turn/started" }, () => order.push("normalize"));
  await boundary.send({ id: 1, result: { decision: "decline" } }, () => order.push("send"));
  assert.deepEqual(order, [
    "record:inbound", "normalize", "record:outbound", "send", "record:delivery"
  ]);
});

test("recorded wire boundary blocks side effects when transcript persistence fails", async () => {
  let called = false;
  const boundary = new RecordedAppServerWireBoundary({
    async record() {
      throw new Error("durable_transcript_failed");
    },
    async recordDelivery() {
      throw new Error("durable_transcript_failed");
    }
  });
  await assert.rejects(
    boundary.ingest({ method: "turn/started" }, () => { called = true; }),
    /durable_transcript_failed/u
  );
  await assert.rejects(
    boundary.send({ id: 1, result: { decision: "decline" } }, () => { called = true; }),
    /durable_transcript_failed/u
  );
  assert.equal(called, false);
});

test("offline interception proof binds each approval request to a later decline", () => {
  const observedAt = "2026-07-14T01:00:00.000Z";
  const messages: Array<{
    direction: "inbound" | "outbound";
    message: unknown;
    deliveryConfirmed?: true;
  }> = [
    {
      direction: "inbound",
      message: {
        id: "file-request",
        method: "item/fileChange/requestApproval",
        params: { itemId: "item-file", threadId: "thread", turnId: "turn-file" }
      }
    },
    {
      direction: "outbound",
      message: { id: "file-request", result: { decision: "decline" } }
    },
    {
      direction: "outbound",
      message: { id: "file-request", result: { decision: "decline" } },
      deliveryConfirmed: true
    },
    {
      direction: "inbound",
      message: {
        id: "permission-request",
        method: "item/permissions/requestApproval",
        params: { itemId: "item-permission", threadId: "thread", turnId: "turn-permission" }
      }
    },
    {
      direction: "outbound",
      message: { id: "permission-request", result: { permissions: {}, scope: "turn" } }
    },
    {
      direction: "outbound",
      message: { id: "permission-request", result: { permissions: {}, scope: "turn" } },
      deliveryConfirmed: true
    }
  ];
  const entries = messages.map((message, index) => sanitizeWireTranscriptEntry({
    sequence: index + 1,
    observedAt,
    ...message
  }));
  const proof = evaluateOfflineApprovalInterceptionProof(entries, completedOfflineHarnessOutcome(entries));
  assert.deepEqual(proof, {
    schemaVersion: "codex-app-server-offline-interception-proof.v1",
    status: "passed",
    approvalRequestCount: 2,
    declineResponseCount: 2,
    harnessOrderingProven: true,
    appServerApplyTimingProven: false,
    liveSmokeEligible: false,
    transcriptSequenceHash: proof.transcriptSequenceHash,
    reasons: []
  });
  assert.match(proof.transcriptSequenceHash, /^[a-f0-9]{64}$/u);
});

test("offline interception proof fails closed on accept, gaps, or orphan responses", () => {
  const observedAt = "2026-07-14T01:00:00.000Z";
  const entries = [
    sanitizeWireTranscriptEntry({
      sequence: 1,
      observedAt,
      direction: "outbound",
      message: { id: "orphan", result: { decision: "decline" } }
    }),
    sanitizeWireTranscriptEntry({
      sequence: 3,
      observedAt,
      direction: "inbound",
      message: {
        id: "approval",
        method: "item/commandExecution/requestApproval",
        params: { itemId: "item", threadId: "thread", turnId: "turn" }
      }
    }),
    sanitizeWireTranscriptEntry({
      sequence: 4,
      observedAt,
      direction: "outbound",
      message: { id: "approval", result: { decision: "accept" } }
    }),
    sanitizeWireTranscriptEntry({
      sequence: 5,
      observedAt,
      direction: "outbound",
      message: { id: "approval", result: { decision: "accept" } },
      deliveryConfirmed: true
    }),
    sanitizeWireTranscriptEntry({
      sequence: 6,
      observedAt,
      direction: "outbound",
      message: { id: "approval", result: { approved: true } },
      deliveryConfirmed: true
    })
  ];
  const proof = evaluateOfflineApprovalInterceptionProof(entries, completedOfflineHarnessOutcome(entries));
  assert.equal(proof.status, "blocked");
  assert.equal(proof.harnessOrderingProven, false);
  assert.equal(proof.appServerApplyTimingProven, false);
  assert.equal(proof.liveSmokeEligible, false);
  assert.deepEqual(proof.reasons, [
    "offline_decline_attempt_missing",
    "offline_decline_response_missing",
    "offline_orphan_decline_attempt",
    "offline_orphan_outbound_response",
    "offline_transcript_non_decline_response",
    "offline_transcript_sequence_invalid"
  ]);
});

test("offline interception proof requires a completed harness terminal outcome", () => {
  const observedAt = "2026-07-14T01:00:00.000Z";
  const rawEntries = [
    { direction: "inbound" as const, message: {
      id: "approval",
      method: "item/fileChange/requestApproval",
      params: { itemId: "item", threadId: "thread", turnId: "turn" }
    } },
    { direction: "outbound" as const, message: { id: "approval", result: { decision: "decline" } } },
    {
      direction: "outbound" as const,
      message: { id: "approval", result: { decision: "decline" } },
      deliveryConfirmed: true as const
    }
  ];
  const entries = rawEntries.map((entry, index) => sanitizeWireTranscriptEntry({
    sequence: index + 1,
    observedAt,
    ...entry
  }));
  const incomplete = evaluateOfflineApprovalInterceptionProof(entries, undefined);
  assert.equal(incomplete.status, "blocked");
  assert.deepEqual(incomplete.reasons, ["offline_harness_terminal_outcome_missing"]);
  const mismatched = evaluateOfflineApprovalInterceptionProof(entries, {
    ...completedOfflineHarnessOutcome(entries),
    transcriptSequenceHash: "0".repeat(64)
  });
  assert.equal(mismatched.status, "blocked");
  assert.deepEqual(mismatched.reasons, ["offline_harness_transcript_binding_mismatch"]);
  const trailingBlocked = evaluateOfflineApprovalInterceptionProof(entries, {
    status: "blocked",
    handshakeComplete: true,
    disconnectObserved: true,
    transcriptFinalSequence: createSanitizedWireTranscriptEvidenceBinding(entries).finalSequence,
    transcriptSequenceHash: createSanitizedWireTranscriptEvidenceBinding(entries).transcriptSequenceHash,
    reasons: ["decline_only_passthrough_requires_owner"]
  });
  assert.equal(trailingBlocked.status, "blocked");
  assert.deepEqual(trailingBlocked.reasons, [
    "offline_harness_terminal_outcome_blocked",
    "offline_harness_terminal_reasons_present"
  ]);
});

test("blocked initialized notification is not acknowledged as delivered", async () => {
  const entries: SanitizedWireTranscriptEntry[] = [];
  let sequence = 0;
  let controlSends = 0;
  let disconnects = 0;
  const boundary = new RecordedAppServerWireBoundary({
    async record(direction, message) {
      const entry = sanitizeWireTranscriptEntry({
        sequence: ++sequence,
        observedAt: "2026-07-14T01:00:00.000Z",
        direction,
        message
      });
      entries.push(entry);
      return entry;
    },
    async recordDelivery(message) {
      const entry = sanitizeWireTranscriptEntry({
        sequence: ++sequence,
        observedAt: "2026-07-14T01:00:00.000Z",
        direction: "outbound",
        message,
        deliveryConfirmed: true
      });
      entries.push(entry);
      return entry;
    }
  });
  const transport = new RecordedDeclineOnlyAppServerV2WireTransport({
    normalizer: {
      encodeApprovalResponse() { return { status: "blocked", reasons: ["unused"] }; },
      markApprovalResponseDeliveryUncertain() {}
    },
    boundary,
    async send() {}
  });
  const harness = new OfflineDeclineOnlyAppServerHarness({
    boundary,
    wireAdapter: {
      async acceptInitializeResponse() { return { status: "initialize_response_accepted" as const }; },
      async acceptInitializedNotification() {
        return { status: "blocked" as const, reasons: ["fixture_initialized_blocked"] };
      },
      async ingest() {
        return {
          status: "blocked" as const,
          normalization: { status: "blocked" as const, reasons: ["unused"] },
          reasons: ["unused"]
        };
      },
      async disconnect() {
        disconnects += 1;
        return {
          status: "blocked" as const,
          normalization: { status: "blocked" as const, reasons: ["disconnected"] },
          reasons: ["disconnected"]
        };
      }
    },
    approvalResolver: { async resolveHumanApproval() { throw new Error("unused"); } },
    transport,
    operatorId: "offline",
    async sendControl() { controlSends += 1; },
    async stop() {}
  });
  await harness.sendInitializeRequest({ id: "initialize", method: "initialize", params: {} });
  await harness.acceptInitializeResponse({ id: "initialize", result: {} });
  const result = await harness.sendInitializedNotification({ method: "initialized" });
  assert.equal(result.status, "blocked");
  assert.equal(controlSends, 1);
  assert.equal(disconnects, 1);
  assert.equal(
    entries.filter((entry) => entry.method === "initialized" && entry.deliveryConfirmed === true).length,
    0
  );
});

test("decline-only transport rejects accept before encoding, recording, or sending", async () => {
  let encoded = false;
  let recorded = false;
  let sent = false;
  const transport = new RecordedDeclineOnlyAppServerV2WireTransport({
    normalizer: {
      encodeApprovalResponse() {
        encoded = true;
        return { status: "blocked", reasons: ["must_not_encode"] };
      },
      markApprovalResponseDeliveryUncertain() {}
    },
    boundary: new RecordedAppServerWireBoundary({
      async record() {
        recorded = true;
        throw new Error("must_not_record");
      },
      async recordDelivery() {
        recorded = true;
        throw new Error("must_not_record");
      }
    }),
    async send() { sent = true; }
  });
  await assert.rejects(transport.send({
    schemaVersion: "codex-app-server-normalized-response.v1",
    schemaProfileId: "fake-v2",
    requestId: "request",
    decision: "accept",
    reasonCode: "forbidden"
  }), /decline_only_transport_non_decline_forbidden/u);
  assert.equal(encoded, false);
  assert.equal(recorded, false);
  assert.equal(sent, false);
});

test("offline decline-only harness routes raw approvals through normalizer and adapter", async () => {
  const root = await mkdtemp(join(tmpdir(), "codex-router-offline-decline-harness-"));
  const repoRoot = join(root, "repo");
  try {
    await mkdir(join(repoRoot, "docs"), { recursive: true });
    await git(root, ["init", repoRoot]);
    await git(repoRoot, ["config", "user.name", "codex-router test"]);
    await git(repoRoot, ["config", "user.email", "codex-router@example.invalid"]);
    await writeFile(join(repoRoot, "docs/guide.md"), "old\n", "utf8");
    await git(repoRoot, ["add", "docs/guide.md"]);
    await git(repoRoot, ["commit", "-m", "fixture"]);
    const head = (await git(repoRoot, ["rev-parse", "HEAD"])).trim();
    const beforeHash = createHash("sha256").update("old\n").digest("hex");
    const afterHash = createHash("sha256").update("new\n").digest("hex");
    const entries: SanitizedWireTranscriptEntry[] = [];
    const rawControlMessages: unknown[] = [];
    const wireResponses: unknown[] = [];
    let sequence = 0;
    let stops = 0;
    let previewCalls = 0;
    let contextCalls = 0;
    const boundary = new RecordedAppServerWireBoundary({
      async record(direction, message) {
        const entry = sanitizeWireTranscriptEntry({
          sequence: ++sequence,
          observedAt: "2026-07-14T01:00:00.000Z",
          direction,
          message
        });
        entries.push(entry);
        return entry;
      },
      async recordDelivery(message) {
        const entry = sanitizeWireTranscriptEntry({
          sequence: ++sequence,
          observedAt: "2026-07-14T01:00:00.000Z",
          direction: "outbound",
          message,
          deliveryConfirmed: true
        });
        entries.push(entry);
        return entry;
      }
    });
    const normalizer = new CodexAppServerV2WireNormalizer({
      initializeRequestId: "initialize-offline-1",
      schemaProfileId: "fake-v2",
      fileChangeEvidence: ({ changes }) => ({
        baseHead: head,
        changes: changes.map((change) => ({
          path: change.path,
          beforeHash: change.kind === "add" ? null : beforeHash,
          afterHash: change.kind === "delete" ? null : afterHash
        }))
      })
    });
    const transport = new RecordedDeclineOnlyAppServerV2WireTransport({
      normalizer,
      boundary,
      async send(message) { wireResponses.push(structuredClone(message)); }
    });
    const previewPolicy: PreviewPolicy = {
      schemaVersion: "preview-policy.v1",
      autoApprovalRules: []
    };
    const adapter = new CodexAppServerAdapter({
      sessionAttestation: structuredClone(sessionAttestationFixture) as AppServerSessionAttestation,
      transport,
      journalStore: new InMemoryPendingApprovalJournalStore(),
      previewer: {
        async preview() {
          previewCalls += 1;
          throw new Error("offline_harness_preview_forbidden");
        }
      },
      previewPolicy,
      previewIsolation: {
        networkIsolation: "unsupported",
        filesystemIsolation: "unsupported",
        scope: "test_only",
        enforcerId: "offline-decline-only"
      },
      workspaceContextProvider: {
        async getContext() {
          contextCalls += 1;
          throw new Error("offline_harness_workspace_context_forbidden");
        }
      },
      capabilityCeiling: [],
      now: () => "2026-07-14T01:00:00.000Z"
    });
    assert.equal(adapter.authorizationMode, "observe_only");
    const wireAdapter = new CodexAppServerV2WireAdapter({ adapter, normalizer });
    const harness = new OfflineDeclineOnlyAppServerHarness({
      boundary,
      wireAdapter,
      approvalResolver: adapter,
      transport,
      operatorId: "offline-decline-only",
      async sendControl(message) { rawControlMessages.push(structuredClone(message)); },
      async stop() { stops += 1; }
    });

    await harness.sendInitializeRequest({
      id: "initialize-offline-1",
      method: "initialize",
      params: {
        clientInfo: { name: "codex-router-offline", version: "0.1.0" },
        capabilities: {}
      }
    });
    assert.equal((await harness.acceptInitializeResponse({
      id: "initialize-offline-1",
      result: {
        codexHome: "/tmp/offline-codex-home",
        platformFamily: "unix",
        platformOs: "linux",
        userAgent: "codex-router-offline"
      }
    })).status, "initialize_response_accepted");
    assert.equal((await harness.sendInitializedNotification({ method: "initialized" })).status, "initialized");

    const [fileStarted, fileApproval] = v2WireFileChangeFlowFixture as unknown[];
    assert.equal((await harness.ingest(fileStarted)).status, "processed");
    assert.equal((await harness.ingest(fileApproval)).status, "declined");

    const command = await harness.ingest({
      id: "command-request",
      method: "item/commandExecution/requestApproval",
      params: {
        availableDecisions: ["accept", "decline"],
        command: "npm test",
        cwd: "/tmp/offline",
        environmentId: "local",
        itemId: "command-item",
        reason: "offline fixture",
        threadId: "command-thread",
        turnId: "command-turn"
      }
    });
    assert.equal(command.status, "declined");

    const network = await harness.ingest({
      id: "network-request",
      method: "item/commandExecution/requestApproval",
      params: {
        additionalPermissions: { fileSystem: null, network: { enabled: true } },
        availableDecisions: ["accept", "decline"],
        environmentId: "local",
        itemId: "network-item",
        networkApprovalContext: { host: "api.example.invalid", protocol: "https" },
        reason: "offline fixture",
        threadId: "network-thread",
        turnId: "network-turn"
      }
    });
    assert.equal(network.status, "declined");

    const permission = await harness.ingest({
      id: "permission-request",
      method: "item/permissions/requestApproval",
      params: {
        cwd: "/tmp/offline",
        itemId: "permission-item",
        permissions: { fileSystem: null, network: { enabled: true } },
        reason: "offline fixture",
        threadId: "permission-thread",
        turnId: "permission-turn"
      }
    });
    assert.equal(permission.status, "declined");

    assert.equal(stops, 0);
    assert.equal(previewCalls, 0);
    assert.equal(contextCalls, 0);
    assert.equal(await readFile(join(repoRoot, "docs/guide.md"), "utf8"), "old\n");
    assert.deepEqual(rawControlMessages, [
      {
        id: "initialize-offline-1",
        method: "initialize",
        params: {
          clientInfo: { name: "codex-router-offline", version: "0.1.0" },
          capabilities: {}
        }
      },
      { method: "initialized" }
    ]);
    assert.equal(wireResponses.length, 4);
    assert.equal(JSON.stringify(wireResponses).includes("accept"), false);
    assert.deepEqual(wireResponses.at(-1), {
      id: "permission-request",
      result: { permissions: {}, scope: "turn" }
    });
    await harness.disconnect("offline_fixture_completed");
    const proof = evaluateOfflineApprovalInterceptionProof(entries, harness.terminalOutcome());
    assert.equal(proof.status, "passed", proof.reasons.join(","));
    assert.equal(proof.approvalRequestCount, 4);
    assert.equal(proof.declineResponseCount, 4);
    assert.equal(proof.appServerApplyTimingProven, false);
    assert.equal(proof.liveSmokeEligible, false);

    assert.equal(wireResponses.length, 4);
    assert.equal(stops, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("offline harness stops when an approval is not manual or already declined", async () => {
  let disconnects = 0;
  let stops = 0;
  let sends = 0;
  const boundary = new RecordedAppServerWireBoundary({
    async record(direction, message) {
      return sanitizeWireTranscriptEntry({
        sequence: 1,
        observedAt: "2026-07-14T01:00:00.000Z",
        direction,
        message
      });
    },
    async recordDelivery(message) {
      return sanitizeWireTranscriptEntry({
        sequence: 2,
        observedAt: "2026-07-14T01:00:00.000Z",
        direction: "outbound",
        message,
        deliveryConfirmed: true
      });
    }
  });
  const transport = new RecordedDeclineOnlyAppServerV2WireTransport({
    normalizer: {
      encodeApprovalResponse() {
        return { status: "blocked", reasons: ["unexpected"] };
      },
      markApprovalResponseDeliveryUncertain() {}
    },
    boundary,
    async send() { sends += 1; }
  });
  const wireAdapter = {
    async acceptInitializeResponse() {
      return { status: "initialize_response_accepted" as const };
    },
    async acceptInitializedNotification() {
      return { status: "initialized" as const };
    },
    async ingest() {
      return {
        status: "normalized" as const,
        normalization: {
          status: "normalized" as const,
          event: {
            schemaVersion: "codex-app-server-normalized-event.v1" as const,
            schemaProfileId: "fake-v2",
            eventId: "event-approval",
            eventType: "approval_requested" as const,
            sequence: 1,
            threadId: "thread",
            turnId: "turn",
            requestId: "request",
            itemId: "item",
            proposal: { kind: "file_change" as const }
          }
        },
        outcome: {
          status: "accepted" as const,
          mode: "observe_only" as const,
          reasons: [],
          requestId: "request",
          itemId: "item"
        }
      };
    },
    async disconnect() {
      disconnects += 1;
      return {
        status: "blocked" as const,
        normalization: { status: "blocked" as const, reasons: ["disconnected"] },
        reasons: ["disconnected"]
      };
    }
  };
  const harness = new OfflineDeclineOnlyAppServerHarness({
    boundary,
    wireAdapter,
    approvalResolver: {
      async resolveHumanApproval() {
        throw new Error("must_not_resolve_accepted_approval");
      }
    },
    transport,
    operatorId: "offline",
    async sendControl() {},
    async stop() { stops += 1; }
  });
  await harness.sendInitializeRequest({ id: "initialize", method: "initialize", params: {} });
  await harness.acceptInitializeResponse({ id: "initialize", result: {} });
  await harness.sendInitializedNotification({ method: "initialized" });
  const result = await harness.ingest({ method: "approval" });
  assert.equal(result.status, "blocked");
  if (result.status === "blocked") {
    assert.deepEqual(result.reasons, ["decline_only_approval_not_manual_or_declined"]);
  }
  assert.equal(sends, 0);
  assert.equal(disconnects, 1);
  assert.equal(stops, 1);
  await assert.rejects(
    harness.disconnect("duplicate_disconnect"),
    /decline_only_harness_stopped/
  );
  assert.equal(disconnects, 1);
  assert.equal(stops, 1);
});

test("offline harness serializes raw intake through immediate handling", async () => {
  const order: string[] = [];
  let releaseFirst!: () => void;
  const firstBlocked = new Promise<void>((resolve) => { releaseFirst = resolve; });
  let firstStarted!: () => void;
  const firstObserved = new Promise<void>((resolve) => { firstStarted = resolve; });
  let sequence = 0;
  const boundary = new RecordedAppServerWireBoundary({
    async record(direction, message) {
      const label = typeof message === "object" && message !== null && "id" in message
        ? String(message.id)
        : "control";
      order.push(`record:${direction}:${label}`);
      return sanitizeWireTranscriptEntry({
        sequence: ++sequence,
        observedAt: "2026-07-14T01:00:00.000Z",
        direction,
        message
      });
    },
    async recordDelivery(message) {
      return sanitizeWireTranscriptEntry({
        sequence: ++sequence,
        observedAt: "2026-07-14T01:00:00.000Z",
        direction: "outbound",
        message,
        deliveryConfirmed: true
      });
    }
  });
  const transport = new RecordedDeclineOnlyAppServerV2WireTransport({
    normalizer: {
      encodeApprovalResponse() { return { status: "blocked", reasons: ["unused"] }; },
      markApprovalResponseDeliveryUncertain() {}
    },
    boundary,
    async send() {}
  });
  const wireAdapter = {
    async acceptInitializeResponse() { return { status: "initialize_response_accepted" as const }; },
    async acceptInitializedNotification() { return { status: "initialized" as const }; },
    async ingest(input: unknown) {
      const id = typeof input === "object" && input !== null && "id" in input
        ? String(input.id)
        : "unknown";
      order.push(`ingest:${id}:start`);
      if (id === "first") {
        firstStarted();
        await firstBlocked;
      }
      order.push(`ingest:${id}:end`);
      return {
        status: "ignored" as const,
        normalization: { status: "ignored" as const, method: "jsonrpc_response" }
      };
    },
    async disconnect() {
      return {
        status: "blocked" as const,
        normalization: { status: "blocked" as const, reasons: ["disconnected"] },
        reasons: ["disconnected"]
      };
    }
  };
  const harness = new OfflineDeclineOnlyAppServerHarness({
    boundary,
    wireAdapter,
    approvalResolver: {
      async resolveHumanApproval() { throw new Error("unused"); }
    },
    transport,
    operatorId: "offline",
    async sendControl() {},
    async stop() {}
  });
  await harness.sendInitializeRequest({ id: "initialize", method: "initialize", params: {} });
  await harness.acceptInitializeResponse({ id: "initialize", result: {} });
  await harness.sendInitializedNotification({ method: "initialized" });
  order.length = 0;
  const first = harness.ingest({ id: "first", result: {} });
  await firstObserved;
  const second = harness.ingest({ id: "second", result: {} });
  await Promise.resolve();
  assert.deepEqual(order, ["record:inbound:first", "ingest:first:start"]);
  releaseFirst();
  await Promise.all([first, second]);
  assert.deepEqual(order, [
    "record:inbound:first",
    "ingest:first:start",
    "ingest:first:end",
    "record:inbound:second",
    "ingest:second:start",
    "ingest:second:end"
  ]);
  const disconnectResult = await harness.disconnect("offline_fixture_completed");
  assert.equal(disconnectResult.status, "blocked");
  const transcriptBinding = boundary.evidenceBinding();
  assert.deepEqual(harness.terminalOutcome(), {
    status: "blocked",
    handshakeComplete: true,
    disconnectObserved: false,
    transcriptFinalSequence: transcriptBinding.finalSequence,
    transcriptSequenceHash: transcriptBinding.transcriptSequenceHash,
    reasons: ["decline_only_disconnect_blocked", "disconnected"]
  });
});

test("decline-only transport records before send and marks failed delivery uncertain", async () => {
  const order: string[] = [];
  let uncertainRequest: string | undefined;
  const transport = new RecordedDeclineOnlyAppServerV2WireTransport({
    normalizer: {
      encodeApprovalResponse() {
        return {
          status: "encoded" as const,
          message: { id: "wire-request", result: { decision: "decline" as const } }
        };
      },
      markApprovalResponseDeliveryUncertain(requestId) {
        uncertainRequest = requestId;
      }
    },
    boundary: new RecordedAppServerWireBoundary({
      async record() {
        order.push("record");
        return sanitizeWireTranscriptEntry({
          sequence: 1,
          observedAt: "2026-07-14T01:00:00.000Z",
          direction: "outbound",
          message: { id: "wire-request", result: { decision: "decline" } }
        });
      },
      async recordDelivery() {
        throw new Error("delivery_ack_must_not_run_after_send_failure");
      }
    }),
    async send() {
      order.push("send");
      throw new Error("loopback_send_failed");
    }
  });
  await assert.rejects(transport.send({
    schemaVersion: "codex-app-server-normalized-response.v1",
    schemaProfileId: "fake-v2",
    requestId: "normalized-request",
    decision: "decline",
    reasonCode: "operator_declined"
  }), /loopback_send_failed/u);
  assert.deepEqual(order, ["record", "send"]);
  assert.equal(uncertainRequest, "normalized-request");
  assert.equal(transport.hasDeliveredDecline("normalized-request"), false);
});

test("decline-only transport treats delivery-ack persistence failure as uncertain", async () => {
  const order: string[] = [];
  let uncertainRequest: string | undefined;
  const transport = new RecordedDeclineOnlyAppServerV2WireTransport({
    normalizer: {
      encodeApprovalResponse() {
        return {
          status: "encoded" as const,
          message: { id: "wire-request", result: { decision: "decline" as const } }
        };
      },
      markApprovalResponseDeliveryUncertain(requestId) {
        uncertainRequest = requestId;
      }
    },
    boundary: new RecordedAppServerWireBoundary({
      async record(direction, message) {
        order.push("record");
        return sanitizeWireTranscriptEntry({
          sequence: 1,
          observedAt: "2026-07-14T01:00:00.000Z",
          direction,
          message
        });
      },
      async recordDelivery() {
        order.push("delivery-ack");
        throw new Error("delivery_ack_persistence_failed");
      }
    }),
    async send() { order.push("send"); }
  });
  await assert.rejects(transport.send({
    schemaVersion: "codex-app-server-normalized-response.v1",
    schemaProfileId: "fake-v2",
    requestId: "normalized-request",
    decision: "decline",
    reasonCode: "operator_declined"
  }), /delivery_ack_persistence_failed/u);
  assert.deepEqual(order, ["record", "send", "delivery-ack"]);
  assert.equal(uncertainRequest, "normalized-request");
  assert.equal(transport.hasDeliveredDecline("normalized-request"), false);
});

test("sanitized wire transcript serializes concurrent records and close", async () => {
  const writes: string[] = [];
  const events: string[] = [];
  let releaseFirstWrite!: () => void;
  const firstWriteBlocked = new Promise<void>((resolve) => { releaseFirstWrite = resolve; });
  let firstWriteStarted!: () => void;
  const firstWriteObserved = new Promise<void>((resolve) => { firstWriteStarted = resolve; });
  const recorder = SanitizedWireTranscriptRecorder.createTestOnly({
    async appendFile(data) {
      const sequence = (JSON.parse(data) as { sequence: number }).sequence;
      events.push(`append:${sequence}:start`);
      if (sequence === 1) {
        firstWriteStarted();
        await firstWriteBlocked;
      }
      writes.push(data);
      events.push(`append:${sequence}:end`);
    },
    async sync() { events.push("sync"); },
    async close() { events.push("close"); }
  }, () => new Date("2026-07-14T01:00:00.000Z"));

  const first = recorder.record("inbound", { method: "turn/started" });
  const second = recorder.record("inbound", { method: "turn/completed" });
  await firstWriteObserved;
  const closing = recorder.close();
  await Promise.resolve();
  assert.deepEqual(events, ["append:1:start"]);
  releaseFirstWrite();
  await Promise.all([first, second, closing]);

  assert.deepEqual(
    writes.map((line) => (JSON.parse(line) as { sequence: number }).sequence),
    [1, 2]
  );
  assert.deepEqual(events, [
    "append:1:start", "append:1:end", "sync",
    "append:2:start", "append:2:end", "sync", "sync", "close"
  ]);
  await assert.rejects(
    recorder.record("inbound", { method: "turn/started" }),
    /wire_transcript_closed/u
  );
});

test("sanitized wire transcript makes persistence failure terminal", async () => {
  let appends = 0;
  const recorder = SanitizedWireTranscriptRecorder.createTestOnly({
    async appendFile() {
      appends += 1;
      throw new Error("disk_failed");
    },
    async sync() {},
    async close() {}
  });
  const first = recorder.record("inbound", { method: "turn/started" });
  const second = recorder.record("inbound", { method: "turn/completed" });
  await assert.rejects(first, /disk_failed/u);
  await assert.rejects(second, /disk_failed/u);
  await assert.rejects(recorder.close(), /disk_failed/u);
  assert.equal(appends, 1);
});

test("sanitized wire transcript treats an undefined thrown value as terminal", async () => {
  let appends = 0;
  const recorder = SanitizedWireTranscriptRecorder.createTestOnly({
    async appendFile() {
      appends += 1;
      throw undefined;
    },
    async sync() {},
    async close() {}
  });
  const first = recorder.record("inbound", { method: "turn/started" });
  const second = recorder.record("inbound", { method: "turn/completed" });
  await assert.rejects(first);
  await assert.rejects(second);
  await assert.rejects(recorder.close());
  assert.equal(appends, 1);
});

test("independent App Server smoke clone has no remote or object alternates", async () => {
  const root = await mkdtemp(join(tmpdir(), "codex-router-live-smoke-clone-"));
  const source = join(root, "source");
  const clone = join(root, "clone");
  try {
    await mkdir(join(source, "docs"), { recursive: true });
    await git(root, ["init", source]);
    await git(source, ["config", "user.name", "codex-router test"]);
    await git(source, ["config", "user.email", "codex-router@example.invalid"]);
    await writeFile(join(source, "docs/guide.md"), "baseline\n", "utf8");
    await git(source, ["add", "docs/guide.md"]);
    await git(source, ["commit", "-m", "fixture"]);
    const head = (await git(source, ["rev-parse", "HEAD"])).trim();
    const result = await createIndependentAppServerSmokeClone({
      sourceRepo: source,
      destinationRepo: clone,
      expectedHead: head,
      targetPaths: ["docs/guide.md"]
    });
    assert.equal(result.head, head);
    assert.equal(result.appServerEnv.GIT_CONFIG_NOSYSTEM, "1");
    assert.equal(
      result.appServerEnv.GIT_CONFIG_GLOBAL,
      process.platform === "win32" ? "NUL" : "/dev/null"
    );
    assert.equal((await git(clone, ["remote"])).trim(), "");
    assert.equal((await git(clone, ["status", "--porcelain=v1"])).trim(), "");
    assert.equal(await readFile(join(clone, "docs/guide.md"), "utf8"), "baseline\n");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("independent smoke clone filters inherited Git config from the App Server environment", async () => {
  const root = await mkdtemp(join(tmpdir(), "codex-router-live-smoke-global-filter-"));
  const source = join(root, "source");
  const clone = join(root, "clone");
  const globalConfig = join(root, "host.gitconfig");
  const inheritedGlobalConfig = process.env.GIT_CONFIG_GLOBAL;
  try {
    await mkdir(join(source, "docs"), { recursive: true });
    await git(root, ["init", source]);
    await git(source, ["config", "user.name", "codex-router test"]);
    await git(source, ["config", "user.email", "codex-router@example.invalid"]);
    await writeFile(join(source, "docs/guide.md"), "baseline\n", "utf8");
    await git(source, ["add", "docs/guide.md"]);
    await git(source, ["commit", "-m", "fixture"]);
    await writeFile(globalConfig, "[filter \"host\"]\n\tsmudge = unsafe-host-command\n", "utf8");
    process.env.GIT_CONFIG_GLOBAL = globalConfig;

    const head = (await git(source, ["rev-parse", "HEAD"])).trim();
    const result = await createIndependentAppServerSmokeClone({
      sourceRepo: source,
      destinationRepo: clone,
      expectedHead: head,
      targetPaths: ["docs/guide.md"]
    });
    assert.deepEqual(result.appServerEnv, createAppServerSmokeProcessEnv(await realpath(root)));
    await assert.rejects(
      execFileAsync("git", ["config", "--get-regexp", "^filter\\."], {
        cwd: clone,
        encoding: "utf8",
        env: result.appServerEnv
      }),
      (error: unknown) => typeof error === "object" && error !== null && "code" in error && error.code === 1
    );
  } finally {
    if (inheritedGlobalConfig === undefined) delete process.env.GIT_CONFIG_GLOBAL;
    else process.env.GIT_CONFIG_GLOBAL = inheritedGlobalConfig;
    await rm(root, { recursive: true, force: true });
  }
});

test("independent smoke clone accepts canonical parent aliases but rejects a symlink source", async (context) => {
  if (process.platform === "win32") {
    context.skip("Windows symlink creation requires host-specific privileges");
    return;
  }
  const root = await mkdtemp(join(tmpdir(), "codex-router-live-smoke-source-link-"));
  const source = join(root, "source");
  const sourceLink = join(root, "source-link");
  try {
    await mkdir(join(source, "docs"), { recursive: true });
    await git(root, ["init", source]);
    await git(source, ["config", "user.name", "codex-router test"]);
    await git(source, ["config", "user.email", "codex-router@example.invalid"]);
    await writeFile(join(source, "docs/guide.md"), "baseline\n", "utf8");
    await git(source, ["add", "docs/guide.md"]);
    await git(source, ["commit", "-m", "fixture"]);
    await symlink(source, sourceLink, "dir");
    const head = (await git(source, ["rev-parse", "HEAD"])).trim();
    await assert.rejects(
      createIndependentAppServerSmokeClone({
        sourceRepo: sourceLink,
        destinationRepo: join(root, "clone"),
        expectedHead: head,
        targetPaths: ["docs/guide.md"]
      }),
      /live_smoke_source_topology_unsafe/u
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("independent smoke clone rejects tracked attributes and configured filters", async () => {
  const root = await mkdtemp(join(tmpdir(), "codex-router-live-smoke-filter-"));
  const source = join(root, "source");
  try {
    await mkdir(join(source, "docs"), { recursive: true });
    await git(root, ["init", source]);
    await git(source, ["config", "user.name", "codex-router test"]);
    await git(source, ["config", "user.email", "codex-router@example.invalid"]);
    await writeFile(join(source, "docs/guide.md"), "baseline\n", "utf8");
    await writeFile(join(source, ".gitattributes"), "docs/guide.md filter=unsafe\n", "utf8");
    await git(source, ["add", "docs/guide.md", ".gitattributes"]);
    await git(source, ["commit", "-m", "fixture"]);
    const head = (await git(source, ["rev-parse", "HEAD"])).trim();
    await assert.rejects(
      createIndependentAppServerSmokeClone({
        sourceRepo: source,
        destinationRepo: join(root, "attributes-clone"),
        expectedHead: head,
        targetPaths: ["docs/guide.md"]
      }),
      /live_smoke_git_attributes_forbidden/u
    );
    await git(source, ["rm", ".gitattributes"]);
    await git(source, ["commit", "-m", "remove attributes"]);
    await git(source, ["config", "filter.unsafe.smudge", "malicious-filter"]);
    const cleanHead = (await git(source, ["rev-parse", "HEAD"])).trim();
    await assert.rejects(
      createIndependentAppServerSmokeClone({
        sourceRepo: source,
        destinationRepo: join(root, "filter-clone"),
        expectedHead: cleanHead,
        targetPaths: ["docs/guide.md"]
      }),
      /live_smoke_git_filters_forbidden/u
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("quiescence gate observes the full quiet period and passes unchanged state", async () => {
  const expected: WorkspaceSnapshot = {
    head: "a".repeat(40),
    statusHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    statusEmpty: true,
    targetHashes: { "docs/guide.md": "b".repeat(64) },
    workspaceMetadataHash: "c".repeat(64)
  };
  const result = await waitForAppServerSmokeQuiescence({
    repoRoot: "/unused",
    targetPaths: ["docs/guide.md"],
    expectedHead: expected.head,
    expectedTargetHashes: expected.targetHashes,
    expectedWorkspaceMetadataHash: expected.workspaceMetadataHash,
    quietPeriodMs: 30,
    timeoutMs: 50,
    sampleIntervalMs: 10,
    capture: async () => expected,
    sleep: async () => {}
  });
  assert.equal(result.status, "unchanged");
  assert.equal(result.samples, 4);
});

test("quiescence sampling cannot start before disconnect completes", async () => {
  const order: string[] = [];
  const expected: WorkspaceSnapshot = {
    head: "a".repeat(40),
    statusHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    statusEmpty: true,
    targetHashes: { "docs/guide.md": "b".repeat(64) },
    workspaceMetadataHash: "c".repeat(64)
  };
  const result = await disconnectAndWaitForAppServerSmokeQuiescence({
    disconnect: async () => { order.push("disconnect"); },
    repoRoot: "/unused",
    targetPaths: ["docs/guide.md"],
    expectedHead: expected.head,
    expectedTargetHashes: expected.targetHashes,
    expectedWorkspaceMetadataHash: expected.workspaceMetadataHash,
    quietPeriodMs: 10,
    timeoutMs: 20,
    sampleIntervalMs: 10,
    capture: async () => { order.push("capture"); return expected; },
    sleep: async () => {}
  });
  assert.equal(result.status, "unchanged");
  assert.deepEqual(order.slice(0, 2), ["disconnect", "capture"]);
});

test("quiescence sampling still runs when disconnect fails", async () => {
  const order: string[] = [];
  const expected: WorkspaceSnapshot = {
    head: "a".repeat(40),
    statusHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    statusEmpty: true,
    targetHashes: { "docs/guide.md": "b".repeat(64) },
    workspaceMetadataHash: "c".repeat(64)
  };
  const result = await disconnectAndWaitForAppServerSmokeQuiescence({
    disconnect: async () => {
      order.push("disconnect");
      throw new Error("socket_close_failed");
    },
    repoRoot: "/unused",
    targetPaths: ["docs/guide.md"],
    expectedHead: expected.head,
    expectedTargetHashes: expected.targetHashes,
    expectedWorkspaceMetadataHash: expected.workspaceMetadataHash,
    quietPeriodMs: 10,
    timeoutMs: 20,
    sampleIntervalMs: 10,
    capture: async () => { order.push("capture"); return expected; },
    sleep: async () => {}
  });
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "live_smoke_disconnect_failed");
  assert.deepEqual(order.slice(0, 2), ["disconnect", "capture"]);
});

test("quiescence gate blocks a late write even when the workspace later reverts", async () => {
  const expected: WorkspaceSnapshot = {
    head: "a".repeat(40),
    statusHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    statusEmpty: true,
    targetHashes: { "docs/guide.md": "b".repeat(64) },
    workspaceMetadataHash: "c".repeat(64)
  };
  const changed: WorkspaceSnapshot = {
    ...expected,
    statusHash: "c".repeat(64),
    statusEmpty: false,
    targetHashes: { "docs/guide.md": "d".repeat(64) }
  };
  const snapshots = [expected, changed, expected, expected, expected, expected];
  let index = 0;
  const result = await waitForAppServerSmokeQuiescence({
    repoRoot: "/unused",
    targetPaths: ["docs/guide.md"],
    expectedHead: expected.head,
    expectedTargetHashes: expected.targetHashes,
    expectedWorkspaceMetadataHash: expected.workspaceMetadataHash,
    quietPeriodMs: 20,
    timeoutMs: 60,
    sampleIntervalMs: 10,
    capture: async () => snapshots[Math.min(index++, snapshots.length - 1)]!,
    sleep: async () => {}
  });
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "live_smoke_workspace_mutation_observed");
  assert.equal(result.mutationObserved, true);
});

test("quiescence gate blocks a reverted write preserved only in workspace metadata", async () => {
  const expected: WorkspaceSnapshot = {
    head: "a".repeat(40),
    statusHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    statusEmpty: true,
    targetHashes: { "docs/guide.md": "b".repeat(64) },
    workspaceMetadataHash: "c".repeat(64)
  };
  const reverted: WorkspaceSnapshot = {
    ...expected,
    workspaceMetadataHash: "d".repeat(64)
  };
  const result = await waitForAppServerSmokeQuiescence({
    repoRoot: "/unused",
    targetPaths: ["docs/guide.md"],
    expectedHead: expected.head,
    expectedTargetHashes: expected.targetHashes,
    expectedWorkspaceMetadataHash: expected.workspaceMetadataHash,
    quietPeriodMs: 20,
    timeoutMs: 40,
    sampleIntervalMs: 10,
    capture: async () => reverted,
    sleep: async () => {}
  });
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "live_smoke_workspace_mutation_observed");
  assert.equal(result.mutationObserved, true);
});

test("quiescence gate rejects an inconsistent clean-status claim", async () => {
  const expected: WorkspaceSnapshot = {
    head: "a".repeat(40),
    statusHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    statusEmpty: true,
    targetHashes: { "docs/guide.md": "b".repeat(64) },
    workspaceMetadataHash: "c".repeat(64)
  };
  const inconsistent = { ...expected, statusEmpty: false };
  const result = await waitForAppServerSmokeQuiescence({
    repoRoot: "/unused",
    targetPaths: ["docs/guide.md"],
    expectedHead: expected.head,
    expectedTargetHashes: expected.targetHashes,
    expectedWorkspaceMetadataHash: expected.workspaceMetadataHash,
    quietPeriodMs: 10,
    timeoutMs: 20,
    sampleIntervalMs: 10,
    capture: async () => inconsistent,
    sleep: async () => {}
  });
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "live_smoke_workspace_mutation_observed");
});

test("live file-change smoke remains blocked until interception is proven", () => {
  assert.equal(APP_SERVER_FILE_CHANGE_INTERCEPTION_PROVEN, false);
  assert.throws(() => assertAppServerFileChangeInterceptionProven(), /app_server_file_change_interception_unproven/u);
});

test("pre-connection gate rejects workspace-write on-request as interception evidence", () => {
  for (const proposalMode of ["approval-request", "deferred-patch", "read-only-proposal"] as const) {
    const preflight = evaluateAppServerFileChangeInterceptionPreflight({
      sandboxPolicy: "workspace-write",
      approvalPolicy: "on-request",
      proposalMode
    });
    assert.deepEqual(preflight, {
      schemaVersion: "app-server-file-change-interception-preflight.v1",
      status: "blocked",
      reason: "workspace_write_on_request_cannot_prove_file_change_interception",
      connectionAllowed: false,
      interceptionProven: false,
      plan: {
        sandboxPolicy: "workspace-write",
        approvalPolicy: "on-request",
        proposalMode
      }
    });
    assert.throws(
      () => assertAppServerFileChangeInterceptionPreConnection(preflight.plan),
      /workspace_write_on_request_cannot_prove_file_change_interception/u
    );
  }
});

test("pre-connection gate requires a deferred patch or a genuinely read-only proposal", () => {
  assert.equal(evaluateAppServerFileChangeInterceptionPreflight({
    sandboxPolicy: "read-only",
    approvalPolicy: "on-request",
    proposalMode: "approval-request"
  }).reason, "app_server_pre_apply_proposal_mechanism_required");
  assert.equal(evaluateAppServerFileChangeInterceptionPreflight({
    sandboxPolicy: "workspace-write",
    approvalPolicy: "never",
    proposalMode: "read-only-proposal"
  }).reason, "app_server_read_only_proposal_requires_read_only_sandbox");
  for (const plan of [
    {
      sandboxPolicy: "read-only",
      approvalPolicy: "on-request",
      proposalMode: "read-only-proposal"
    },
    {
      sandboxPolicy: "read-only",
      approvalPolicy: "never",
      proposalMode: "deferred-patch"
    }
  ] as const) {
    const preflight = evaluateAppServerFileChangeInterceptionPreflight(plan);
    assert.equal(preflight.status, "blocked");
    assert.equal(preflight.connectionAllowed, false);
    assert.equal(preflight.reason, "app_server_file_change_interception_unproven");
  }
});

test("pre-connection gate fails closed on unsupported runtime values", () => {
  const inherited = Object.create({
    sandboxPolicy: "workspace-write",
    approvalPolicy: "on-request",
    proposalMode: "deferred-patch"
  }) as Record<string, unknown>;
  const accessor = {
    approvalPolicy: "on-request",
    proposalMode: "deferred-patch",
    get sandboxPolicy() { return "workspace-write"; }
  };
  const boxed = {
    sandboxPolicy: new String("workspace-write"),
    approvalPolicy: "on-request",
    proposalMode: "deferred-patch"
  };
  const unexpectedSymbol = Symbol("unexpected");
  const symbolBearing = {
    sandboxPolicy: "read-only",
    approvalPolicy: "on-request",
    proposalMode: "read-only-proposal",
    [unexpectedSymbol]: true
  };
  const throwingProxy = new Proxy({}, {
    getPrototypeOf() { throw new Error("must_not_escape"); }
  });
  for (const input of [null, {}, inherited, accessor, boxed, symbolBearing, throwingProxy, {
    sandboxPolicy: "future-sandbox",
    approvalPolicy: "future-policy",
    proposalMode: "future-proposal"
  }, {
    sandboxPolicy: "read-only",
    approvalPolicy: "on-request",
    proposalMode: "read-only-proposal",
    unexpected: true
  }]) {
    const preflight = evaluateAppServerFileChangeInterceptionPreflight(input);
    assert.equal(preflight.status, "blocked");
    assert.equal(preflight.connectionAllowed, false);
    assert.equal(preflight.reason, "app_server_file_change_preflight_configuration_invalid");
    assert.equal(preflight.plan, null);
  }
});

test("file-change smoke CLI reports the pre-connection hard block without side effects", async () => {
  await assert.rejects(
    execFileAsync(process.execPath, [
      "--import",
      "tsx",
      "scripts/run-codex-app-server-file-change-smoke.ts"
    ], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: { ...process.env }
    }),
    (error: unknown) => {
      const failure = error as { code?: number; stdout?: string; stderr?: string };
      assert.equal(failure.code, 1);
      assert.equal(failure.stdout, "");
      const output = JSON.parse(failure.stderr ?? "") as Record<string, unknown>;
      assert.equal(output.status, "blocked");
      assert.equal(output.connectionAllowed, false);
      assert.equal(output.reason, "workspace_write_on_request_cannot_prove_file_change_interception");
      assert.equal(output.realAppServerStarted, false);
      assert.equal(output.clientConnected, false);
      assert.equal(output.workspaceWriteAttempted, false);
      return true;
    }
  );
});

test("workspace capture hashes a clean fixed target", async () => {
  const root = await mkdtemp(join(tmpdir(), "codex-router-live-smoke-capture-"));
  try {
    await mkdir(join(root, "docs"), { recursive: true });
    await git(root, ["init"]);
    await git(root, ["config", "user.name", "codex-router test"]);
    await git(root, ["config", "user.email", "codex-router@example.invalid"]);
    await writeFile(join(root, "docs/guide.md"), "baseline\n", "utf8");
    await git(root, ["add", "docs/guide.md"]);
    await git(root, ["commit", "-m", "fixture"]);
    const before = await captureAppServerSmokeWorkspace(root, ["docs/guide.md"]);
    assert.equal(before.statusEmpty, true);
    assert.equal(before.targetHashes["docs/guide.md"]?.length, 64);
    const unchanged = await captureAppServerSmokeWorkspace(root, ["docs/guide.md"]);
    assert.equal(unchanged.workspaceMetadataHash, before.workspaceMetadataHash);
    await writeFile(join(root, "docs/guide.md"), "changed\n", "utf8");
    await writeFile(join(root, "docs/guide.md"), "baseline\n", "utf8");
    const afterRevert = await captureAppServerSmokeWorkspace(root, ["docs/guide.md"]);
    assert.equal(afterRevert.statusEmpty, true);
    assert.deepEqual(afterRevert.targetHashes, before.targetHashes);
    assert.notEqual(afterRevert.workspaceMetadataHash, before.workspaceMetadataHash);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
