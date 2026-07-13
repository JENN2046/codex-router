import test from "node:test";
import assert from "node:assert/strict";
import fileChangeFlow from "./fixtures/codex-app-server/v2-wire/file-change-flow.json" with { type: "json" };
import threadSettingsUpdated from "./fixtures/codex-app-server/v2-wire/thread-settings-updated.json" with { type: "json" };
import {
  CodexAppServerNormalizedEventSchema,
  CodexAppServerV2WireAdapter,
  CodexAppServerV2WireMessageSchema,
  CodexAppServerV2WireNormalizer,
  CodexAppServerV2WireTransport,
  type CodexAppServerApprovalResponse
} from "../packages/codex-adapter/src/index.js";

const schemaProfileId = "codex-app-server-v2";
const baseHead = "a".repeat(40);
const beforeHash = "b".repeat(64);
const afterHash = "c".repeat(64);
const initializeRequestId = "initialize-v2-1";
const initializeResponse = {
  id: initializeRequestId,
  result: {
    codexHome: "/tmp/codex-home",
    platformFamily: "unix",
    platformOs: "linux",
    userAgent: "codex-test"
  }
};

function createNormalizer(
  evidence: () => { baseHead: string; changes: Array<{
    path: string;
    beforeHash: string | null;
    afterHash: string | null;
  }> } | undefined = () => ({
    baseHead,
    changes: [{ path: "docs/guide.md", beforeHash, afterHash }]
  })
): CodexAppServerV2WireNormalizer {
  const normalizer = new CodexAppServerV2WireNormalizer({
    initializeRequestId,
    schemaProfileId,
    fileChangeEvidence: evidence
  });
  assert.equal(normalizer.acceptInitializeResponse(initializeResponse).status, "initialize_response_accepted");
  assert.equal(
    normalizer.acceptInitializedNotification({ method: "initialized" }).status,
    "initialized"
  );
  return normalizer;
}

function createUninitializedNormalizer(
  evidence: () => { baseHead: string; changes: Array<{
    path: string;
    beforeHash: string | null;
    afterHash: string | null;
  }> } | undefined = () => ({
    baseHead,
    changes: [{ path: "docs/guide.md", beforeHash, afterHash }]
  })
): CodexAppServerV2WireNormalizer {
  return new CodexAppServerV2WireNormalizer({
    initializeRequestId,
    schemaProfileId,
    fileChangeEvidence: evidence
  });
}

function response(requestId: string, decision: "accept" | "decline"): CodexAppServerApprovalResponse {
  return {
    schemaVersion: "codex-app-server-normalized-response.v1",
    schemaProfileId,
    requestId,
    decision,
    reasonCode: "test"
  };
}

test("v2 wire normalizer binds item, approval, resolution, and completion", async () => {
  const normalizer = createNormalizer();
  const [started, approval, resolved, completed] = fileChangeFlow as unknown[];

  for (const message of [started, approval, resolved, completed]) {
    assert.equal(CodexAppServerV2WireMessageSchema.safeParse(message).success, true);
  }

  const startedResult = normalizer.normalize(started);
  assert.equal(startedResult.status, "normalized");
  if (startedResult.status !== "normalized") return;
  assert.equal(startedResult.event.eventType, "item_started");
  assert.equal(startedResult.event.sequence, 1);
  assert.equal(CodexAppServerNormalizedEventSchema.safeParse(startedResult.event).success, true);
  assert.equal(startedResult.event.item.baseHead, baseHead);
  assert.equal(startedResult.event.item.changes[0]?.beforeHash, beforeHash);
  assert.equal(startedResult.event.item.changes[0]?.afterHash, afterHash);

  const approvalResult = normalizer.normalize(approval);
  assert.equal(approvalResult.status, "normalized");
  if (approvalResult.status !== "normalized") return;
  assert.equal(approvalResult.event.eventType, "approval_requested");
  assert.equal(approvalResult.event.requestId, "request-v2-1");
  assert.equal(approvalResult.event.sequence, 2);

  const encoded = normalizer.encodeApprovalResponse(response("request-v2-1", "accept"));
  assert.deepEqual(encoded, {
    status: "encoded",
    message: {
      id: "request-v2-1",
      result: { decision: "accept" }
    }
  });

  const resolvedResult = normalizer.normalize(resolved);
  assert.equal(resolvedResult.status, "normalized");
  if (resolvedResult.status !== "normalized") return;
  assert.equal(resolvedResult.event.eventType, "request_resolved");
  assert.equal(resolvedResult.event.resolution, "accept");
  assert.equal(resolvedResult.event.sequence, 3);

  const completedResult = normalizer.normalize(completed);
  assert.equal(completedResult.status, "normalized");
  if (completedResult.status !== "normalized") return;
  assert.equal(completedResult.event.eventType, "item_completed");
  assert.equal(completedResult.event.outcome, "applied");
  assert.equal(completedResult.event.sequence, 4);
});

test("grantRoot file approvals remain manual-capable without quarantining the wire session", () => {
  const normalizer = createNormalizer();
  const [started, approval] = fileChangeFlow as unknown[];
  assert.equal(normalizer.normalize(started).status, "normalized");

  const grantRootApproval = structuredClone(approval) as {
    params: { grantRoot?: string };
  };
  grantRootApproval.params.grantRoot = "/tmp/codex-router-session-root";
  assert.equal(CodexAppServerV2WireMessageSchema.safeParse(grantRootApproval).success, true);

  const requested = normalizer.normalize(grantRootApproval);
  assert.equal(requested.status, "normalized");
  if (requested.status !== "normalized") return;
  assert.equal(requested.event.eventType, "approval_requested");
  if (requested.event.eventType !== "approval_requested") return;
  assert.deepEqual(requested.event.proposal, {
    kind: "file_change",
    grantRoot: "/tmp/codex-router-session-root"
  });
  assert.equal(CodexAppServerNormalizedEventSchema.safeParse(requested.event).success, true);

  assert.deepEqual(normalizer.encodeApprovalResponse(response("request-v2-1", "decline")), {
    status: "encoded",
    message: {
      id: "request-v2-1",
      result: { decision: "decline" }
    }
  });
  assert.equal(normalizer.normalize({
    id: "current-time-after-grant-root",
    method: "currentTime/read",
    params: { threadId: "thread-v2-1" }
  }).status, "passthrough");

  const emptyRootNormalizer = createNormalizer();
  assert.equal(emptyRootNormalizer.normalize(started).status, "normalized");
  const emptyRootApproval = structuredClone(approval) as {
    params: { grantRoot?: string };
  };
  emptyRootApproval.params.grantRoot = "";
  const emptyRoot = emptyRootNormalizer.normalize(emptyRootApproval);
  assert.equal(emptyRoot.status, "blocked");
  if (emptyRoot.status !== "blocked") return;
  assert.ok(emptyRoot.reasons.includes("v2_file_approval_schema_invalid"));
});

test("ordinary JSON-RPC responses and documented turn snapshots are ignored", () => {
  const normalizer = createNormalizer();
  const responses = [
    {
      id: "turn-start-response",
      result: { turn: { id: "turn-response" } }
    },
    {
      id: "turn-error-response",
      error: { code: -32000, message: "turn failed" }
    }
  ];
  for (const responseMessage of responses) {
    assert.equal(CodexAppServerV2WireMessageSchema.safeParse(responseMessage).success, true);
    assert.deepEqual(normalizer.normalize(responseMessage), {
      status: "ignored",
      method: "jsonrpc_response"
    });
  }

  for (const method of ["turn/started", "turn/completed"] as const) {
    const turnMessage = {
      method,
      params: { turn: { id: `turn-${method}` } }
    };
    assert.equal(CodexAppServerV2WireMessageSchema.safeParse(turnMessage).success, true);
    assert.deepEqual(normalizer.normalize(turnMessage), {
      status: "ignored",
      method
    });
  }

  for (const status of [
    { activeFlags: [], type: "active" as const },
    { type: "idle" as const },
    { type: "notLoaded" as const }
  ]) {
    const statusMessage = {
      method: "thread/status/changed",
      params: { status, threadId: "thread-status" }
    };
    assert.equal(CodexAppServerV2WireMessageSchema.safeParse(statusMessage).success, true);
    assert.deepEqual(normalizer.normalize(statusMessage), {
      status: "ignored",
      method: "thread/status/changed"
    });
  }

  const closedMessage = {
    method: "thread/closed",
    params: { threadId: "thread-status" }
  };
  assert.equal(CodexAppServerV2WireMessageSchema.safeParse(closedMessage).success, true);
  assert.deepEqual(normalizer.normalize(closedMessage), {
    status: "ignored",
    method: "thread/closed"
  });

  const [startedAfterUnload] = fileChangeFlow as unknown[];
  assert.equal(normalizer.normalize(startedAfterUnload).status, "normalized");

  const terminalStatus = createNormalizer().normalize({
    method: "thread/status/changed",
    params: {
      status: { type: "systemError" },
      threadId: "thread-status"
    }
  });
  assert.equal(terminalStatus.status, "blocked");
  if (terminalStatus.status !== "blocked") return;
  assert.ok(terminalStatus.reasons.includes("v2_thread_status_terminal"));

  const malformedClosed = createNormalizer().normalize({
    method: "thread/closed",
    params: { threadId: "thread-status", reason: "idle timeout" }
  });
  assert.equal(malformedClosed.status, "blocked");
  if (malformedClosed.status !== "blocked") return;
  assert.ok(malformedClosed.reasons.includes("v2_non_governance_notification_schema_invalid"));

  const malformedError = createNormalizer().normalize({
    id: "malformed-error-response",
    error: null
  });
  assert.equal(malformedError.status, "blocked");
  if (malformedError.status !== "blocked") return;
  assert.ok(malformedError.reasons.includes("v2_wire_envelope_invalid"));

  const malformedResponse = normalizer.normalize({ id: "missing-result-or-error" });
  assert.equal(malformedResponse.status, "blocked");
  if (malformedResponse.status !== "blocked") return;
  assert.ok(malformedResponse.reasons.includes("v2_wire_envelope_invalid"));
});

test("thread unload diagnostics fail closed only when governance remains open", () => {
  const [started] = fileChangeFlow as unknown[];
  const statusNormalizer = createNormalizer();
  assert.equal(statusNormalizer.normalize(started).status, "normalized");
  assert.deepEqual(statusNormalizer.normalize({
    method: "thread/status/changed",
    params: { status: { type: "notLoaded" }, threadId: "unrelated-thread" }
  }), {
    status: "ignored",
    method: "thread/status/changed"
  });
  const openStatus = statusNormalizer.normalize({
    method: "thread/status/changed",
    params: { status: { type: "notLoaded" }, threadId: "thread-v2-1" }
  });
  assert.equal(openStatus.status, "blocked");
  if (openStatus.status !== "blocked") return;
  assert.ok(openStatus.reasons.includes("v2_thread_unloaded_with_open_governance"));

  const closeNormalizer = createNormalizer();
  assert.equal(closeNormalizer.normalize(started).status, "normalized");
  const openClose = closeNormalizer.normalize({
    method: "thread/closed",
    params: { threadId: "thread-v2-1" }
  });
  assert.equal(openClose.status, "blocked");
  if (openClose.status !== "blocked") return;
  assert.ok(openClose.reasons.includes("v2_thread_unloaded_with_open_governance"));
});

test("unanswered server request cleanup normalizes as cancellation", () => {
  const normalizer = createNormalizer();
  const [started, approval, resolved] = fileChangeFlow as unknown[];

  // Correlation is established, but no client response is sent before the
  // App Server clears the request.
  assert.equal(normalizer.normalize(started).status, "normalized");
  assert.equal(normalizer.normalize(approval).status, "normalized");
  const result = normalizer.normalize(resolved);
  assert.equal(result.status, "normalized");
  if (result.status !== "normalized") return;
  assert.equal(result.event.eventType, "request_resolved");
  assert.equal(result.event.resolution, "cancelled");
});

test("v2 wire normalizer requires the initialize response and initialized notification", () => {
  const normalizer = createUninitializedNormalizer();
  const [started] = fileChangeFlow as unknown[];

  const beforeHandshake = normalizer.normalize(started);
  assert.equal(beforeHandshake.status, "blocked");
  if (beforeHandshake.status !== "blocked") return;
  assert.ok(beforeHandshake.reasons.includes("v2_session_not_initialized"));

  const valid = createUninitializedNormalizer();
  assert.equal(
    valid.acceptInitializedNotification({ method: "initialized" }).status,
    "blocked"
  );
  assert.equal(valid.acceptInitializeResponse({ ...initializeResponse, id: "wrong" }).status, "blocked");

  const typeMismatch = createUninitializedNormalizer();
  assert.equal(typeMismatch.acceptInitializeResponse({ ...initializeResponse, id: 1 }).status, "blocked");

  const ready = createUninitializedNormalizer();
  assert.equal(ready.acceptInitializeResponse(initializeResponse).status, "initialize_response_accepted");
  assert.equal(ready.acceptInitializedNotification({ method: "initialized" }).status, "initialized");
  assert.equal(ready.normalize(started).status, "normalized");
});

test("missing trusted HEAD/hash evidence quarantines the v2 session", () => {
  const normalizer = createNormalizer(() => undefined);
  const [started, approval] = fileChangeFlow as unknown[];

  const blocked = normalizer.normalize(started);
  assert.equal(blocked.status, "blocked");
  if (blocked.status !== "blocked") return;
  assert.ok(blocked.reasons.includes("v2_file_change_evidence_missing"));
  assert.ok(blocked.reasons.includes("v2_session_quarantined"));

  const later = normalizer.normalize(approval);
  assert.equal(later.status, "blocked");
  if (later.status !== "blocked") return;
  assert.ok(later.reasons.includes("v2_session_quarantined"));
});

test("move_path is never guessed into a rename", () => {
  const normalizer = createNormalizer();
  const [started] = fileChangeFlow as unknown[];
  const moved = structuredClone(started) as {
    method: string;
    params: { item: { changes: Array<{ kind: { type: string; move_path?: string } }> } };
  };
  moved.params.item.changes[0]!.kind = { type: "update", move_path: "docs/new.md" };

  const result = normalizer.normalize(moved);
  assert.equal(result.status, "blocked");
  if (result.status !== "blocked") return;
  assert.ok(result.reasons.includes("v2_file_change_move_unsupported"));
});

test("extra wire fields, unknown methods, and command approvals fail closed", () => {
  const normalizer = createNormalizer();
  const [started] = fileChangeFlow as unknown[];
  const withExtra = structuredClone(started) as Record<string, unknown>;
  const params = withExtra.params as Record<string, unknown>;
  params.unexpected = true;

  const extraResult = normalizer.normalize(withExtra);
  assert.equal(extraResult.status, "blocked");
  if (extraResult.status !== "blocked") return;
  assert.ok(extraResult.reasons.includes("v2_item_started_schema_invalid"));

  const unknownResult = normalizer.normalize({
    method: "item/unknown",
    params: {}
  });
  assert.equal(unknownResult.status, "blocked");
  if (unknownResult.status !== "blocked") return;
  assert.ok(unknownResult.reasons.includes("v2_session_quarantined"));

  const commandResult = normalizer.normalize({
    id: "command-request",
    method: "item/commandExecution/requestApproval",
    params: {}
  });
  assert.equal(commandResult.status, "blocked");
  if (commandResult.status !== "blocked") return;
  assert.ok(commandResult.reasons.includes("v2_session_quarantined"));

  const envelopeDrift = createNormalizer().normalize({
    jsonrpc: "2.0",
    method: "turn/diff/updated",
    params: { diff: "", threadId: "thread-v2-1", turnId: "turn-v2-1" }
  });
  assert.equal(envelopeDrift.status, "blocked");
  const missingParams = createNormalizer().normalize({ method: "turn/diff/updated" });
  assert.equal(missingParams.status, "blocked");

  const unknownItem = createNormalizer().normalize({
    method: "item/started",
    params: {
      item: { id: "future-item", type: "futureItem" },
      startedAtMs: 1762732800100,
      threadId: "thread-future",
      turnId: "turn-future"
    }
  });
  assert.equal(unknownItem.status, "blocked");
  if (unknownItem.status !== "blocked") return;
  assert.ok(unknownItem.reasons.includes("v2_session_quarantined"));
});

test("known non-file lifecycle items are ignored without blocking file changes", () => {
  const normalizer = createNormalizer();
  const startedMessages = [
    {
      method: "item/started",
      params: {
        item: {
          id: "agent-message-1",
          text: "I will inspect the repository first.",
          type: "agentMessage"
        },
        startedAtMs: 1762732800100,
        threadId: "thread-non-file",
        turnId: "turn-non-file"
      }
    },
    {
      method: "item/started",
      params: {
        item: {
          command: "git status --short",
          commandActions: [],
          cwd: "/tmp/codex-router",
          id: "command-execution-1",
          status: "inProgress",
          type: "commandExecution"
        },
        startedAtMs: 1762732800101,
        threadId: "thread-non-file",
        turnId: "turn-non-file"
      }
    },
    {
      method: "item/started",
      params: {
        item: {
          content: [],
          id: "reasoning-1",
          summary: ["checking the workspace"],
          type: "reasoning"
        },
        startedAtMs: 1762732800102,
        threadId: "thread-non-file",
        turnId: "turn-non-file"
      }
    },
    {
      method: "item/started",
      params: {
        item: {
          id: "collab-tool-call-1",
          prompt: "Inspect the repository",
          status: "inProgress",
          type: "collabToolCall"
        },
        startedAtMs: 1762732800103,
        threadId: "thread-non-file",
        turnId: "turn-non-file"
      }
    }
  ];
  for (const message of startedMessages) {
    assert.equal(CodexAppServerV2WireMessageSchema.safeParse(message).success, true);
    assert.deepEqual(normalizer.normalize(message), {
      status: "ignored",
      method: "item/started"
    });
  }
  assert.deepEqual(normalizer.normalize(startedMessages[0]), {
    status: "ignored",
    method: "item/started"
  });

  const completed = {
    method: "item/completed",
    params: {
      item: {
        command: "git status --short",
        commandActions: [],
        cwd: "/tmp/codex-router",
        id: "command-execution-1",
        status: "completed",
        type: "commandExecution"
      },
      completedAtMs: 1762732800103,
      threadId: "thread-non-file",
      turnId: "turn-non-file"
    }
  };
  assert.equal(CodexAppServerV2WireMessageSchema.safeParse(completed).success, true);
  assert.deepEqual(normalizer.normalize(completed), {
    status: "ignored",
    method: "item/completed"
  });

  const collabCompleted = {
    method: "item/completed",
    params: {
      item: {
        id: "collab-tool-call-1",
        prompt: "Inspect the repository",
        status: "completed",
        type: "collabToolCall"
      },
      completedAtMs: 1762732800104,
      threadId: "thread-non-file",
      turnId: "turn-non-file"
    }
  };
  assert.equal(CodexAppServerV2WireMessageSchema.safeParse(collabCompleted).success, true);
  assert.deepEqual(normalizer.normalize(collabCompleted), {
    status: "ignored",
    method: "item/completed"
  });

  const [fileStarted] = fileChangeFlow as unknown[];
  assert.equal(normalizer.normalize(fileStarted).status, "normalized");
});

test("documented item progress notifications are ignored without quarantining", () => {
  const normalizer = createNormalizer();
  const messages = [
    {
      method: "item/agentMessage/delta",
      params: {
        delta: "working",
        itemId: "agent-message-1",
        threadId: "thread-progress",
        turnId: "turn-progress"
      }
    },
    {
      method: "item/plan/delta",
      params: {
        delta: "inspect repository",
        itemId: "plan-1",
        threadId: "thread-progress",
        turnId: "turn-progress"
      }
    },
    {
      method: "item/reasoning/summaryTextDelta",
      params: {
        delta: "checking",
        itemId: "reasoning-1",
        summaryIndex: 0,
        threadId: "thread-progress",
        turnId: "turn-progress"
      }
    },
    {
      method: "item/reasoning/summaryPartAdded",
      params: {
        itemId: "reasoning-1",
        summaryIndex: 1,
        threadId: "thread-progress",
        turnId: "turn-progress"
      }
    },
    {
      method: "item/reasoning/textDelta",
      params: {
        contentIndex: 0,
        delta: "detail",
        itemId: "reasoning-1",
        threadId: "thread-progress",
        turnId: "turn-progress"
      }
    },
    {
      method: "item/commandExecution/outputDelta",
      params: {
        delta: "stdout",
        itemId: "command-1",
        threadId: "thread-progress",
        turnId: "turn-progress"
      }
    },
    {
      method: "item/commandExecution/terminalInteraction",
      params: {
        itemId: "command-1",
        processId: "process-1",
        stdin: "continue\n",
        threadId: "thread-progress",
        turnId: "turn-progress"
      }
    },
    {
      method: "item/fileChange/outputDelta",
      params: {
        delta: "legacy patch output",
        itemId: "file-change-1",
        threadId: "thread-progress",
        turnId: "turn-progress"
      }
    },
    {
      method: "item/mcpToolCall/progress",
      params: {
        itemId: "mcp-tool-call-1",
        message: "connecting",
        threadId: "thread-progress",
        turnId: "turn-progress"
      }
    },
    {
      method: "item/autoApprovalReview/started",
      params: {
        action: {
          cwd: "/tmp/codex-router",
          files: ["/tmp/codex-router/docs/guide.md"],
          type: "applyPatch"
        },
        review: {
          rationale: null,
          riskLevel: "low",
          status: "inProgress",
          userAuthorization: "low"
        },
        reviewId: "review-1",
        startedAtMs: 1762732800200,
        targetItemId: "file-change-1",
        threadId: "thread-progress",
        turnId: "turn-progress"
      }
    },
    {
      method: "item/autoApprovalReview/completed",
      params: {
        action: {
          cwd: "/tmp/codex-router",
          files: ["/tmp/codex-router/docs/guide.md"],
          type: "applyPatch"
        },
        completedAtMs: 1762732800201,
        decisionSource: "agent",
        review: {
          rationale: "review complete",
          riskLevel: "low",
          status: "approved",
          userAuthorization: "low"
        },
        reviewId: "review-1",
        startedAtMs: 1762732800200,
        targetItemId: "file-change-1",
        threadId: "thread-progress",
        turnId: "turn-progress"
      }
    }
  ];

  for (const message of messages) {
    assert.equal(CodexAppServerV2WireMessageSchema.safeParse(message).success, true);
    assert.deepEqual(normalizer.normalize(message), {
      status: "ignored",
      method: message.method
    });
  }
  assert.deepEqual(normalizer.normalize(messages[0]), {
    status: "ignored",
    method: "item/agentMessage/delta"
  });

  const [fileStarted] = fileChangeFlow as unknown[];
  assert.equal(normalizer.normalize(fileStarted).status, "normalized");

  const negativeIndex = createNormalizer().normalize({
    method: "item/reasoning/summaryTextDelta",
    params: {
      delta: "invalid",
      itemId: "reasoning-negative",
      summaryIndex: -1,
      threadId: "thread-progress",
      turnId: "turn-progress"
    }
  });
  assert.equal(negativeIndex.status, "blocked");
  if (negativeIndex.status !== "blocked") return;
  assert.ok(negativeIndex.reasons.includes("v2_progress_notification_schema_invalid"));

  const malformed = normalizer.normalize({
    method: "item/agentMessage/delta",
    params: { delta: "missing correlation" }
  });
  assert.equal(malformed.status, "blocked");
  if (malformed.status !== "blocked") return;
  assert.ok(malformed.reasons.includes("v2_progress_notification_schema_invalid"));
  assert.ok(malformed.reasons.includes("v2_session_quarantined"));
});

test("file-change patch snapshots replace the governed proposal before approval", () => {
  const normalizer = createNormalizer();
  const [started, approval, resolved, completed] = fileChangeFlow as unknown[];
  assert.equal(normalizer.normalize(started).status, "normalized");

  const latestDiff = "diff --git a/docs/guide.md b/docs/guide.md\n"
    + "--- a/docs/guide.md\n"
    + "+++ b/docs/guide.md\n"
    + "@@ -1 +1 @@\n"
    + "-old\n"
    + "+latest\n";
  const patchUpdated = {
    method: "item/fileChange/patchUpdated",
    params: {
      changes: [{
        diff: latestDiff,
        kind: { type: "update" as const },
        path: "docs/guide.md"
      }],
      itemId: "item-v2-1",
      threadId: "thread-v2-1",
      turnId: "turn-v2-1"
    }
  };
  assert.equal(CodexAppServerV2WireMessageSchema.safeParse(patchUpdated).success, true);
  const updated = normalizer.normalize(patchUpdated);
  assert.equal(updated.status, "normalized");
  if (updated.status !== "normalized") return;
  assert.equal(updated.event.eventType, "item_updated");
  assert.equal(updated.event.sequence, 2);
  if (updated.event.eventType !== "item_updated") return;
  assert.equal(updated.event.item.changes[0]?.unifiedDiff, latestDiff);
  const equivalentCurrent = structuredClone(patchUpdated);
  equivalentCurrent.params.changes[0]!.diff = latestDiff.replaceAll("\n", "\r\n");
  assert.deepEqual(normalizer.normalize(equivalentCurrent), {
    status: "ignored",
    method: "item/fileChange/patchUpdated"
  });

  const requested = normalizer.normalize(approval);
  assert.equal(requested.status, "normalized");
  if (requested.status !== "normalized") return;
  assert.equal(requested.event.eventType, "approval_requested");
  if (requested.event.eventType !== "approval_requested") return;
  assert.equal(requested.event.sequence, 3);
  assert.equal(normalizer.encodeApprovalResponse(response("request-v2-1", "accept")).status, "encoded");
  assert.equal(normalizer.normalize(resolved).status, "normalized");

  const final = structuredClone(completed) as {
    params: { item: { changes: Array<{ diff: string }> } };
  };
  final.params.item.changes[0]!.diff = latestDiff.replaceAll("\n", "\r\n");
  const completion = normalizer.normalize(final);
  assert.equal(completion.status, "normalized");
  if (completion.status !== "normalized") return;
  assert.equal(completion.event.eventType, "item_completed");
  assert.equal(completion.event.sequence, 5);
});

test("a previously superseded patch snapshot cannot roll approval evidence backward", () => {
  const [started, approval] = fileChangeFlow as unknown[];
  const snapshot = (replacement: string) => ({
    method: "item/fileChange/patchUpdated",
    params: {
      changes: [{
        diff: "diff --git a/docs/guide.md b/docs/guide.md\n"
          + "--- a/docs/guide.md\n"
          + "+++ b/docs/guide.md\n"
          + "@@ -1 +1 @@\n"
          + "-old\n"
          + `+${replacement}\n`,
        kind: { type: "update" as const },
        path: "docs/guide.md"
      }],
      itemId: "item-v2-1",
      threadId: "thread-v2-1",
      turnId: "turn-v2-1"
    }
  });
  const snapshotA = snapshot("snapshot-a");
  const snapshotB = snapshot("snapshot-b");
  const crlfA = structuredClone(snapshotA);
  crlfA.params.changes[0]!.diff = crlfA.params.changes[0]!.diff.replaceAll("\n", "\r\n");
  const explicitNullMoveA = {
    ...structuredClone(snapshotA),
    params: {
      ...structuredClone(snapshotA.params),
      changes: [{
        ...structuredClone(snapshotA.params.changes[0]!),
        kind: { type: "update" as const, move_path: null }
      }]
    }
  };

  for (const [caseId, historicalA] of [
    ["crlf", crlfA],
    ["explicit-null-move", explicitNullMoveA]
  ] as const) {
    const normalizer = createNormalizer();
    assert.equal(normalizer.normalize(started).status, "normalized", caseId);
    assert.equal(normalizer.normalize(snapshotA).status, "normalized", caseId);
    assert.equal(normalizer.normalize(snapshotB).status, "normalized", caseId);

    const rollback = normalizer.normalize(historicalA);
    assert.equal(rollback.status, "blocked", caseId);
    if (rollback.status !== "blocked") continue;
    assert.ok(
      rollback.reasons.includes("v2_file_change_patch_snapshot_rollback"),
      caseId
    );
    assert.equal(normalizer.normalize(approval).status, "blocked", caseId);
  }
});

test("patch snapshots fail closed when stale, late, unbound, or uncorrelated", () => {
  const [started, approval, , completed] = fileChangeFlow as unknown[];
  const patchUpdated = {
    method: "item/fileChange/patchUpdated",
    params: {
      changes: [{
        diff: "diff --git a/docs/guide.md b/docs/guide.md\n"
          + "--- a/docs/guide.md\n"
          + "+++ b/docs/guide.md\n"
          + "@@ -1 +1 @@\n"
          + "-old\n"
          + "+latest\n",
        kind: { type: "update" as const },
        path: "docs/guide.md"
      }],
      itemId: "item-v2-1",
      threadId: "thread-v2-1",
      turnId: "turn-v2-1"
    }
  };

  const staleCompletion = createNormalizer();
  assert.equal(staleCompletion.normalize(started).status, "normalized");
  assert.equal(staleCompletion.normalize(patchUpdated).status, "normalized");
  const stale = staleCompletion.normalize(completed);
  assert.equal(stale.status, "blocked");
  if (stale.status !== "blocked") return;
  assert.ok(stale.reasons.includes("v2_item_completed_correlation_failed"));

  const latePatch = createNormalizer();
  assert.equal(latePatch.normalize(started).status, "normalized");
  assert.equal(latePatch.normalize(approval).status, "normalized");
  const late = latePatch.normalize(patchUpdated);
  assert.equal(late.status, "blocked");
  if (late.status !== "blocked") return;
  assert.ok(late.reasons.includes("v2_file_change_patch_correlation_failed"));

  const unboundSnapshot = createNormalizer();
  assert.equal(unboundSnapshot.normalize(started).status, "normalized");
  assert.deepEqual(unboundSnapshot.normalize({
    ...patchUpdated,
    params: { ...patchUpdated.params, changes: [] }
  }), {
    status: "ignored",
    method: "item/fileChange/patchUpdated"
  });
  const unboundApproval = unboundSnapshot.normalize(approval);
  assert.equal(unboundApproval.status, "blocked");
  if (unboundApproval.status !== "blocked") return;
  assert.ok(unboundApproval.reasons.includes("v2_file_approval_snapshot_unbound"));

  const unknown = createNormalizer().normalize(patchUpdated);
  assert.equal(unknown.status, "blocked");
  if (unknown.status !== "blocked") return;
  assert.ok(unknown.reasons.includes("v2_file_change_patch_correlation_failed"));
});

test("patch snapshots reject evidence HEAD drift and unsafe target paths", () => {
  const [started] = fileChangeFlow as unknown[];
  let evidenceReads = 0;
  const headDrift = createNormalizer(() => ({
    baseHead: (++evidenceReads === 1 ? "a" : "d").repeat(40),
    changes: [{ path: "docs/guide.md", beforeHash, afterHash }]
  }));
  assert.equal(headDrift.normalize(started).status, "normalized");
  const patchUpdated = {
    method: "item/fileChange/patchUpdated",
    params: {
      changes: [{
        diff: "diff --git a/docs/guide.md b/docs/guide.md\n"
          + "--- a/docs/guide.md\n"
          + "+++ b/docs/guide.md\n"
          + "@@ -1 +1 @@\n"
          + "-old\n"
          + "+latest\n",
        kind: { type: "update" as const },
        path: "docs/guide.md"
      }],
      itemId: "item-v2-1",
      threadId: "thread-v2-1",
      turnId: "turn-v2-1"
    }
  };
  const drifted = headDrift.normalize(patchUpdated);
  assert.equal(drifted.status, "blocked");
  if (drifted.status !== "blocked") return;
  assert.ok(drifted.reasons.includes("v2_file_change_patch_base_head_mismatch"));

  let hashReads = 0;
  const hashDrift = createNormalizer(() => ({
    baseHead,
    changes: [{
      path: "docs/guide.md",
      beforeHash,
      afterHash: ++hashReads === 1 ? afterHash : "d".repeat(64)
    }]
  }));
  assert.equal(hashDrift.normalize(started).status, "normalized");
  const initialChanges = structuredClone((started as {
    params: { item: { changes: Array<{ diff: string; kind: { type: "update" }; path: string }> } };
  }).params.item.changes);
  initialChanges[0]!.diff = initialChanges[0]!.diff.replaceAll("\n", "\r\n");
  const driftedHash = hashDrift.normalize({
    method: "item/fileChange/patchUpdated",
    params: {
      changes: initialChanges,
      itemId: "item-v2-1",
      threadId: "thread-v2-1",
      turnId: "turn-v2-1"
    }
  });
  assert.equal(driftedHash.status, "blocked");
  if (driftedHash.status !== "blocked") return;
  assert.ok(driftedHash.reasons.includes("v2_file_change_patch_evidence_drift"));

  const unsafePath = createNormalizer();
  assert.equal(unsafePath.normalize(started).status, "normalized");
  const backslash = structuredClone(patchUpdated);
  backslash.params.changes[0]!.path = "docs" + String.fromCharCode(92) + "guide.md";
  const unsafe = unsafePath.normalize(backslash);
  assert.equal(unsafe.status, "blocked");
  if (unsafe.status !== "blocked") return;
  assert.ok(unsafe.reasons.includes("v2_file_change_path_encoding_unsupported"));
});

test("documented non-governance server requests are validated and passed through", () => {
  const normalizer = createNormalizer();
  const requests = [
    {
      id: "user-input-1",
      method: "item/tool/requestUserInput",
      params: {
        autoResolutionMs: null,
        itemId: "tool-item-1",
        questions: [{
          header: "Mode",
          id: "mode",
          isOther: false,
          isSecret: false,
          options: [{ description: "Continue safely", label: "Safe" }],
          question: "Which mode should be used?"
        }],
        threadId: "thread-v2-1",
        turnId: "turn-v2-1"
      }
    },
    {
      id: "mcp-form-1",
      method: "mcpServer/elicitation/request",
      params: {
        meta: {
          codex_approval_kind: "mcp_tool_call",
          persist: ["session", "always"]
        },
        message: "Confirm the operation",
        mode: "form",
        requestedSchema: {
          $schema: "https://json-schema.org/draft/2020-12/schema",
          properties: {
            approved: {
              default: null,
              description: "Whether to continue",
              title: "Approved",
              type: "boolean"
            }
          },
          required: ["approved"],
          type: "object"
        },
        serverName: "fixture-mcp",
        threadId: "thread-v2-1",
        turnId: null
      }
    },
    {
      id: "mcp-openai-form-1",
      method: "mcpServer/elicitation/request",
      params: {
        _meta: { source: "generated-protocol" },
        message: "Collect structured input",
        mode: "openai/form",
        requestedSchema: {
          properties: { reason: { type: "string" } },
          type: "object"
        },
        serverName: "fixture-mcp",
        threadId: "thread-v2-1",
        turnId: "turn-v2-1"
      }
    },
    {
      id: "mcp-url-1",
      method: "mcpServer/elicitation/request",
      params: {
        elicitationId: "elicitation-1",
        message: "Complete the external flow",
        mode: "url",
        serverName: "fixture-mcp",
        threadId: "thread-v2-1",
        url: "https://example.test/elicitation"
      }
    },
    {
      id: "dynamic-tool-1",
      method: "item/tool/call",
      params: {
        arguments: {
          enabled: true,
          nested: ["docs/guide.md", null, 1]
        },
        callId: "call-1",
        namespace: null,
        threadId: "thread-v2-1",
        tool: "fixture_tool",
        turnId: "turn-v2-1"
      }
    },
    {
      id: "auth-refresh-1",
      method: "account/chatgptAuthTokens/refresh",
      params: { previousAccountId: null, reason: "unauthorized" }
    },
    {
      id: "attestation-1",
      method: "attestation/generate",
      params: {}
    },
    {
      id: 71,
      method: "currentTime/read",
      params: { threadId: "thread-v2-1" },
      trace: {
        traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"
      }
    }
  ];
  for (const request of requests) {
    assert.equal(CodexAppServerV2WireMessageSchema.safeParse(request).success, true);
    assert.deepEqual(normalizer.normalize(request), {
      status: "passthrough",
      request
    });
    if (
      request.method === "item/tool/requestUserInput"
      || request.method === "mcpServer/elicitation/request"
    ) {
      assert.deepEqual(normalizer.normalize({
        method: "serverRequest/resolved",
        params: { requestId: request.id, threadId: "thread-v2-1" }
      }), {
        status: "ignored",
        method: "serverRequest/resolved"
      });
    }
  }

  const [started] = fileChangeFlow as unknown[];
  assert.equal(normalizer.normalize(started).status, "normalized");

  const malformedRequests = [
    {
      request: {
        id: "attestation-malformed",
        method: "attestation/generate",
        params: { nonce: "unexpected" }
      },
      reason: "v2_passthrough_request_schema_invalid"
    },
    {
      request: {
        id: "auth-malformed",
        method: "account/chatgptAuthTokens/refresh",
        params: { reason: "expired" }
      },
      reason: "v2_passthrough_request_schema_invalid"
    },
    {
      request: {
        id: "tool-malformed",
        method: "item/tool/call",
        params: {
          arguments: {},
          threadId: "thread-v2-1",
          tool: "fixture_tool",
          turnId: "turn-v2-1"
        }
      },
      reason: "v2_passthrough_request_schema_invalid"
    },
    {
      request: {
        id: "user-input-malformed",
        method: "item/tool/requestUserInput",
        params: {
          autoResolutionMs: -1,
          itemId: "tool-item-1",
          questions: [{ header: "Mode", id: "mode", question: "Choose" }],
          threadId: "thread-v2-1",
          turnId: "turn-v2-1"
        }
      },
      reason: "v2_passthrough_request_schema_invalid"
    },
    {
      request: {
        id: "mcp-malformed",
        method: "mcpServer/elicitation/request",
        params: {
          message: "Choose",
          mode: "future-mode",
          serverName: "fixture-mcp",
          threadId: "thread-v2-1"
        }
      },
      reason: "v2_passthrough_request_schema_invalid"
    },
    {
      request: {
        id: "mcp-meta-misspelled",
        method: "mcpServer/elicitation/request",
        params: {
          message: "Choose",
          metadata: { codex_approval_kind: "mcp_tool_call" },
          mode: "form",
          requestedSchema: {
            properties: { approved: { type: "boolean" } },
            type: "object"
          },
          serverName: "fixture-mcp",
          threadId: "thread-v2-1"
        }
      },
      reason: "v2_passthrough_request_schema_invalid"
    },
    {
      request: {
        id: "mcp-meta-alias-conflict",
        method: "mcpServer/elicitation/request",
        params: {
          _meta: { source: "generated-protocol" },
          message: "Choose",
          meta: { codex_approval_kind: "mcp_tool_call" },
          mode: "form",
          requestedSchema: {
            properties: { approved: { type: "boolean" } },
            type: "object"
          },
          serverName: "fixture-mcp",
          threadId: "thread-v2-1"
        }
      },
      reason: "v2_passthrough_request_schema_invalid"
    },
    {
      request: {
        id: 72,
        method: "currentTime/read",
        params: { threadId: "thread-v2-1", currentTimeAt: 1781717655 }
      },
      reason: "v2_current_time_request_schema_invalid"
    }
  ];
  for (const { request, reason } of malformedRequests) {
    const malformed = createNormalizer().normalize(request);
    assert.equal(malformed.status, "blocked");
    if (malformed.status !== "blocked") continue;
    assert.ok(malformed.reasons.includes(reason));
  }

  for (const method of ["future/request", "applyPatchApproval", "execCommandApproval"]) {
    const unsupported = createNormalizer().normalize({
      id: `unsupported-${method}`,
      method,
      params: {}
    });
    assert.equal(unsupported.status, "blocked");
    if (unsupported.status !== "blocked") continue;
    assert.ok(unsupported.reasons.includes("v2_server_request_unsupported"));
  }
});

test("passthrough request replay, resolution correlation, and id collisions remain fail closed", () => {
  const request = {
    id: "user-input-replay",
    method: "item/tool/requestUserInput",
    params: {
      itemId: "tool-item-1",
      questions: [{ header: "Mode", id: "mode", question: "Choose" }],
      threadId: "thread-v2-1",
      turnId: "turn-v2-1"
    }
  };
  const replayNormalizer = createNormalizer();
  assert.equal(replayNormalizer.normalize(request).status, "passthrough");
  const replay = replayNormalizer.normalize(request);
  assert.equal(replay.status, "blocked");
  if (replay.status !== "blocked") return;
  assert.ok(replay.reasons.includes("v2_wire_event_replay"));

  const mismatchNormalizer = createNormalizer();
  assert.equal(mismatchNormalizer.normalize(request).status, "passthrough");
  const mismatch = mismatchNormalizer.normalize({
    method: "serverRequest/resolved",
    params: { requestId: request.id, threadId: "thread-other" }
  });
  assert.equal(mismatch.status, "blocked");
  if (mismatch.status !== "blocked") return;
  assert.ok(mismatch.reasons.includes("v2_request_resolved_correlation_failed"));

  const passthroughFirst = createNormalizer();
  assert.equal(passthroughFirst.normalize(request).status, "passthrough");
  const [started, approval] = fileChangeFlow as unknown[];
  assert.equal(passthroughFirst.normalize(started).status, "normalized");
  const collidingApproval = structuredClone(approval) as { id: string };
  collidingApproval.id = request.id;
  const approvalCollision = passthroughFirst.normalize(collidingApproval);
  assert.equal(approvalCollision.status, "blocked");
  if (approvalCollision.status !== "blocked") return;
  assert.ok(approvalCollision.reasons.includes("v2_request_id_collision"));

  const approvalFirst = createNormalizer();
  assert.equal(approvalFirst.normalize(started).status, "normalized");
  assert.equal(approvalFirst.normalize(approval).status, "normalized");
  const collidingPassthrough = structuredClone(request);
  collidingPassthrough.id = "request-v2-1";
  const passthroughCollision = approvalFirst.normalize(collidingPassthrough);
  assert.equal(passthroughCollision.status, "blocked");
  if (passthroughCollision.status !== "blocked") return;
  assert.ok(passthroughCollision.reasons.includes("v2_request_id_collision"));
});

test("deep, oversized, and non-JSON passthrough payloads fail closed without throwing", () => {
  let deeplyNested: unknown = null;
  for (let depth = 0; depth < 10_000; depth += 1) {
    deeplyNested = { nested: deeplyNested };
  }
  const deepRequest = {
    id: "dynamic-tool-deep",
    method: "item/tool/call",
    params: {
      arguments: deeplyNested,
      callId: "call-deep",
      threadId: "thread-v2-1",
      tool: "fixture_tool",
      turnId: "turn-v2-1"
    }
  };
  assert.equal(CodexAppServerV2WireMessageSchema.safeParse(deepRequest).success, false);
  const deep = createNormalizer().normalize(deepRequest);
  assert.equal(deep.status, "blocked");
  if (deep.status !== "blocked") return;
  assert.ok(deep.reasons.includes("v2_wire_payload_depth_exceeded"));

  const oversized = createNormalizer().normalize({
    id: "dynamic-tool-oversized",
    method: "item/tool/call",
    params: {
      arguments: "x".repeat(9 * 1024 * 1024),
      callId: "call-oversized",
      threadId: "thread-v2-1",
      tool: "fixture_tool",
      turnId: "turn-v2-1"
    }
  });
  assert.equal(oversized.status, "blocked");
  if (oversized.status !== "blocked") return;
  assert.ok(oversized.reasons.includes("v2_wire_payload_text_limit_exceeded"));

  const cyclicArguments: { self?: unknown } = {};
  cyclicArguments.self = cyclicArguments;
  const cyclic = createNormalizer().normalize({
    id: "dynamic-tool-cyclic",
    method: "item/tool/call",
    params: {
      arguments: cyclicArguments,
      callId: "call-cyclic",
      threadId: "thread-v2-1",
      tool: "fixture_tool",
      turnId: "turn-v2-1"
    }
  });
  assert.equal(cyclic.status, "blocked");
  if (cyclic.status !== "blocked") return;
  assert.ok(cyclic.reasons.includes("v2_wire_payload_not_json"));

  let getterReads = 0;
  const accessorArray: unknown[] = [];
  Object.defineProperty(accessorArray, "0", {
    enumerable: true,
    get() {
      getterReads += 1;
      return { changing: getterReads };
    }
  });
  const accessorRequest = {
    id: "dynamic-tool-accessor",
    method: "item/tool/call",
    params: {
      arguments: accessorArray,
      callId: "call-accessor",
      threadId: "thread-v2-1",
      tool: "fixture_tool",
      turnId: "turn-v2-1"
    }
  };
  assert.equal(CodexAppServerV2WireMessageSchema.safeParse(accessorRequest).success, false);
  const accessor = createNormalizer().normalize(accessorRequest);
  assert.equal(accessor.status, "blocked");
  if (accessor.status !== "blocked") return;
  assert.ok(accessor.reasons.includes("v2_wire_payload_not_json"));
  assert.equal(getterReads, 0);

  const wide = createNormalizer().normalize({
    id: "dynamic-tool-wide",
    method: "item/tool/call",
    params: {
      arguments: Array.from({ length: 50_001 }, () => null),
      callId: "call-wide",
      threadId: "thread-v2-1",
      tool: "fixture_tool",
      turnId: "turn-v2-1"
    }
  });
  assert.equal(wide.status, "blocked");
  if (wide.status !== "blocked") return;
  assert.ok(wide.reasons.includes("v2_wire_payload_node_limit_exceeded"));
});

test("documented non-governance notifications are ignored without quarantining", () => {
  const normalizer = createNormalizer();
  const messages = [
    threadSettingsUpdated,
    {
      method: "turn/plan/updated",
      params: {
        explanation: null,
        plan: [{ status: "inProgress", step: "inspect repository" }],
        turnId: "turn-non-governance"
      }
    },
    {
      method: "model/safetyBuffering/updated",
      params: {
        fasterModel: null,
        model: "gpt-test",
        reasons: ["safety review"],
        showBufferingUi: true,
        threadId: "thread-non-governance",
        turnId: "turn-non-governance",
        useCases: ["analysis"]
      }
    },
    {
      method: "model/rerouted",
      params: {
        fromModel: "gpt-test",
        reason: "highRiskCyberActivity",
        threadId: "thread-non-governance",
        toModel: "gpt-safe-test",
        turnId: "turn-non-governance"
      }
    },
    {
      method: "thread/tokenUsage/updated",
      params: {
        threadId: "thread-non-governance",
        tokenUsage: { totalTokens: 1 },
        turnId: "turn-non-governance"
      }
    },
    {
      method: "model/verification",
      params: {
        threadId: "thread-non-governance",
        turnId: "turn-non-governance",
        verifications: [{ type: "trustedAccessForCyber" }]
      }
    },
    {
      method: "turn/moderationMetadata",
      params: {
        metadata: { source: "test" },
        threadId: "thread-non-governance",
        turnId: "turn-non-governance"
      }
    },
    {
      method: "error",
      params: {
        error: { message: "upstream quota limit" }
      }
    },
    {
      method: "error",
      params: {
        error: { message: "upstream retry" },
        threadId: "thread-non-governance",
        turnId: "turn-non-governance",
        willRetry: true
      }
    },
    {
      method: "warning",
      params: { message: "configuration warning" }
    },
    {
      method: "guardianWarning",
      params: {
        message: "guardian warning",
        threadId: "thread-non-governance"
      }
    },
    {
      method: "deprecationNotice",
      params: { summary: "deprecated setting" }
    },
    {
      method: "configWarning",
      params: { summary: "invalid optional config" }
    },
    {
      method: "mcpServer/startupStatus/updated",
      params: {
        error: null,
        failureReason: null,
        name: "filesystem",
        status: "ready",
        threadId: "thread-non-governance"
      }
    },
    {
      method: "thread/compacted",
      params: {
        threadId: "thread-non-governance",
        turnId: "turn-non-governance"
      }
    }
  ];

  for (const message of messages) {
    assert.equal(CodexAppServerV2WireMessageSchema.safeParse(message).success, true);
    assert.deepEqual(normalizer.normalize(message), {
      status: "ignored",
      method: message.method
    });
  }
  assert.deepEqual(normalizer.normalize(messages[1]), {
    status: "ignored",
    method: "turn/plan/updated"
  });

  const malformed = normalizer.normalize({
    method: "turn/plan/updated",
    params: {
      plan: [],
      turnId: "turn-non-governance",
      unexpected: true
    }
  });
  assert.equal(malformed.status, "blocked");
  if (malformed.status !== "blocked") return;
  assert.ok(malformed.reasons.includes("v2_non_governance_notification_schema_invalid"));
  assert.ok(malformed.reasons.includes("v2_session_quarantined"));
});

test("thread settings updates are validated and ignored before file approvals", () => {
  const normalizer = createNormalizer();
  assert.equal(
    CodexAppServerV2WireMessageSchema.safeParse(threadSettingsUpdated).success,
    true
  );
  assert.deepEqual(normalizer.normalize(threadSettingsUpdated), {
    status: "ignored",
    method: "thread/settings/updated"
  });

  const [started, approval] = fileChangeFlow as unknown[];
  assert.equal(normalizer.normalize(started).status, "normalized");
  const approvalResult = normalizer.normalize(approval);
  assert.equal(approvalResult.status, "normalized");
  if (approvalResult.status !== "normalized") return;
  assert.equal(approvalResult.event.eventType, "approval_requested");

  type MutableThreadSettingsNotification = {
    params: {
      threadId?: string;
      threadSettings: {
        model?: string;
        sandboxPolicy: { type: string };
        unexpected?: boolean;
      };
    };
  };
  const mutations: Array<(message: MutableThreadSettingsNotification) => void> = [
    (message) => {
      delete message.params.threadId;
    },
    (message) => {
      delete message.params.threadSettings.model;
    },
    (message) => {
      message.params.threadSettings.sandboxPolicy.type = "futureSandbox";
    },
    (message) => {
      message.params.threadSettings.unexpected = true;
    }
  ];
  for (const mutate of mutations) {
    const malformed = structuredClone(
      threadSettingsUpdated
    ) as MutableThreadSettingsNotification;
    mutate(malformed);
    assert.equal(CodexAppServerV2WireMessageSchema.safeParse(malformed).success, false);
    const result = createNormalizer().normalize(malformed);
    assert.equal(result.status, "blocked");
    if (result.status !== "blocked") continue;
    assert.ok(result.reasons.includes("v2_non_governance_notification_schema_invalid"));
    assert.ok(result.reasons.includes("v2_session_quarantined"));
  }
});

test("error diagnostics accept only the documented minimal or complete correlated payload", () => {
  for (const message of [
    {
      method: "error",
      params: {
        error: {
          additionalDetails: null,
          codexErrorInfo: "usageLimitExceeded",
          message: "quota exceeded"
        }
      }
    },
    {
      method: "error",
      params: {
        error: { message: "upstream retry" },
        threadId: "thread-error",
        turnId: "turn-error",
        willRetry: true
      }
    }
  ]) {
    const normalizer = createNormalizer();
    assert.equal(CodexAppServerV2WireMessageSchema.safeParse(message).success, true);
    assert.deepEqual(normalizer.normalize(message), {
      status: "ignored",
      method: "error"
    });

    const [started] = fileChangeFlow as unknown[];
    assert.equal(normalizer.normalize(started).status, "normalized");
  }

  for (const params of [
    {
      error: { message: "partial correlation" },
      threadId: "thread-error"
    },
    {
      error: { message: "partial correlation" },
      turnId: "turn-error"
    },
    {
      error: { message: "partial correlation" },
      willRetry: true
    },
    {
      error: { message: "partial correlation" },
      threadId: "thread-error",
      turnId: "turn-error"
    },
    {
      error: { message: "partial correlation" },
      threadId: "thread-error",
      willRetry: true
    },
    {
      error: { message: "partial correlation" },
      turnId: "turn-error",
      willRetry: true
    },
    {
      error: { message: "" }
    },
    {
      error: { message: "nested unknown field", unexpected: true }
    },
    {
      error: { message: "unknown field" },
      unexpected: true
    }
  ]) {
    const normalizer = createNormalizer();
    const message = { method: "error", params };
    assert.equal(CodexAppServerV2WireMessageSchema.safeParse(message).success, false);
    const result = normalizer.normalize(message);
    assert.equal(result.status, "blocked");
    if (result.status !== "blocked") continue;
    assert.ok(result.reasons.includes("v2_non_governance_notification_schema_invalid"));
    assert.ok(result.reasons.includes("v2_session_quarantined"));

    const [started] = fileChangeFlow as unknown[];
    const afterQuarantine = normalizer.normalize(started);
    assert.equal(afterQuarantine.status, "blocked");
    if (afterQuarantine.status !== "blocked") continue;
    assert.ok(afterQuarantine.reasons.includes("v2_session_quarantined"));
  }
});

test("MCP startup and auto-review notifications validate every documented variant", () => {
  const normalizer = createNormalizer();
  for (const message of [
    {
      method: "mcpServer/startupStatus/updated",
      params: { name: "filesystem", status: "starting" }
    },
    {
      method: "mcpServer/startupStatus/updated",
      params: {
        error: "stored OAuth credentials expired",
        failureReason: "reauthenticationRequired",
        name: "remote-docs",
        status: "failed",
        threadId: null
      }
    }
  ]) {
    assert.equal(CodexAppServerV2WireMessageSchema.safeParse(message).success, true);
    assert.equal(normalizer.normalize(message).status, "ignored");
  }

  const actions = [
    {
      command: "npm test",
      cwd: "/tmp/codex-router",
      source: "shell",
      type: "command"
    },
    {
      argv: ["npm", "test"],
      cwd: "/tmp/codex-router",
      program: "npm",
      source: "unifiedExec",
      type: "execve"
    },
    {
      cwd: "/tmp/codex-router",
      files: ["/tmp/codex-router/docs/guide.md"],
      type: "applyPatch"
    },
    {
      host: "example.test",
      port: 443,
      protocol: "https",
      target: "https://example.test",
      type: "networkAccess"
    },
    {
      connectorId: null,
      connectorName: null,
      server: "filesystem",
      toolName: "read_file",
      toolTitle: null,
      type: "mcpToolCall"
    },
    {
      permissions: {
        fileSystem: { read: ["/tmp/codex-router/docs"] },
        network: null
      },
      reason: "read documentation",
      type: "requestPermissions"
    }
  ];
  for (const [index, action] of actions.entries()) {
    const message = {
      method: "item/autoApprovalReview/started",
      params: {
        action,
        review: { status: "inProgress" },
        reviewId: `review-variant-${index}`,
        startedAtMs: 1762732800300 + index,
        targetItemId: null,
        threadId: "thread-review-variants",
        turnId: "turn-review-variants"
      }
    };
    assert.equal(CodexAppServerV2WireMessageSchema.safeParse(message).success, true);
    assert.equal(normalizer.normalize(message).status, "ignored");
  }

  const invalidMcp = createNormalizer().normalize({
    method: "mcpServer/startupStatus/updated",
    params: { name: "filesystem", status: "unknown" }
  });
  assert.equal(invalidMcp.status, "blocked");
  if (invalidMcp.status !== "blocked") return;
  assert.ok(invalidMcp.reasons.includes("v2_non_governance_notification_schema_invalid"));

  const invalidReview = createNormalizer().normalize({
    method: "item/autoApprovalReview/completed",
    params: {
      action: { type: "futureAction" },
      completedAtMs: 1762732800301,
      decisionSource: "agent",
      review: { status: "approved" },
      reviewId: "review-invalid",
      startedAtMs: 1762732800300,
      threadId: "thread-review-invalid",
      turnId: "turn-review-invalid"
    }
  });
  assert.equal(invalidReview.status, "blocked");
  if (invalidReview.status !== "blocked") return;
  assert.ok(invalidReview.reasons.includes("v2_progress_notification_schema_invalid"));
});

test("command and permission wire approvals become manual-only normalized events", () => {
  const normalizer = createNormalizer();
  const command = normalizer.normalize({
    id: "command-request",
    method: "item/commandExecution/requestApproval",
    params: {
      command: "npm test",
      cwd: "/tmp/codex-router",
      additionalPermissions: {
        fileSystem: {
          entries: [{
            access: "none",
            path: { path: "/tmp/codex-router/private", type: "path" }
          }],
          read: ["/tmp/codex-router/docs"],
          write: null
        },
        network: { enabled: true }
      },
      availableDecisions: ["accept", "decline"],
      environmentId: "local",
      itemId: "item-command",
      reason: "operator review",
      startedAtMs: 1762732800100,
      threadId: "thread-command",
      turnId: "turn-command"
    }
  });
  assert.equal(command.status, "normalized");
  if (command.status !== "normalized" || command.event.eventType !== "approval_requested") return;
  assert.deepEqual(command.event.proposal, {
    kind: "command",
    argv: ["npm test"],
    cwd: "/tmp/codex-router",
    environmentId: "local",
    requestedPermissionScope: "{\"fileSystem\":{\"entries\":[{\"access\":\"none\",\"path\":{\"path\":\"/tmp/codex-router/private\",\"type\":\"path\"}}],\"read\":[\"/tmp/codex-router/docs\"],\"write\":null},\"network\":{\"enabled\":true}}"
  });
  assert.equal(normalizer.encodeApprovalResponse(response("command-request", "accept")).status, "encoded");

  const permission = normalizer.normalize({
    id: "permission-request",
    method: "item/permissions/requestApproval",
    params: {
      cwd: "/tmp/codex-router",
      itemId: "item-permission",
      permissions: {
        fileSystem: {
          entries: [{
            access: "none",
            path: { path: "/tmp/codex-router/private", type: "path" }
          }],
          write: ["/tmp/codex-router/docs"]
        },
        network: { enabled: null }
      },
      reason: "permission review",
      startedAtMs: 1762732800100,
      threadId: "thread-permission",
      turnId: "turn-permission"
    }
  });
  assert.equal(permission.status, "normalized");
  if (permission.status !== "normalized" || permission.event.eventType !== "approval_requested") return;
  assert.equal(permission.event.proposal.kind, "permission");
  const encodedPermission = normalizer.encodeApprovalResponse(response("permission-request", "accept"));
  assert.deepEqual(encodedPermission, {
    status: "encoded",
    message: {
      id: "permission-request",
      result: {
        permissions: {
          fileSystem: {
            entries: [{
              access: "none",
              path: { path: "/tmp/codex-router/private", type: "path" }
            }],
            write: ["/tmp/codex-router/docs"]
          },
          network: { enabled: null }
        },
        scope: "turn"
      }
    }
  });
});

test("approval requests accept documented payloads without lifecycle timestamps", () => {
  const normalizer = createNormalizer();
  const [started, approval] = fileChangeFlow as unknown[];
  assert.equal(normalizer.normalize(started).status, "normalized");

  const timestamplessFileApproval = structuredClone(approval) as {
    params: Record<string, unknown>;
  };
  delete timestamplessFileApproval.params.startedAtMs;
  assert.equal(
    CodexAppServerV2WireMessageSchema.safeParse(timestamplessFileApproval).success,
    true
  );
  const fileResult = normalizer.normalize(timestamplessFileApproval);
  assert.equal(fileResult.status, "normalized");
  if (fileResult.status !== "normalized") return;
  assert.equal(fileResult.event.eventType, "approval_requested");

  const command = {
    id: "timestampless-command-request",
    method: "item/commandExecution/requestApproval",
    params: {
      command: "npm test",
      cwd: "/tmp/codex-router",
      itemId: "timestampless-command-item",
      threadId: "timestampless-command-thread",
      turnId: "timestampless-command-turn"
    },
    trace: {
      traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
      tracestate: "vendor=test"
    }
  };
  assert.equal(CodexAppServerV2WireMessageSchema.safeParse(command).success, true);
  const commandResult = normalizer.normalize(command);
  assert.equal(commandResult.status, "normalized");
  if (commandResult.status !== "normalized") return;
  assert.equal(commandResult.event.eventType, "approval_requested");

  const permission = {
    id: "timestampless-permission-request",
    method: "item/permissions/requestApproval",
    params: {
      cwd: "/tmp/codex-router",
      itemId: "timestampless-permission-item",
      permissions: {
        fileSystem: { write: ["/tmp/codex-router/docs"] },
        network: { enabled: null }
      },
      threadId: "timestampless-permission-thread",
      turnId: "timestampless-permission-turn"
    }
  };
  assert.equal(CodexAppServerV2WireMessageSchema.safeParse(permission).success, true);
  const permissionResult = normalizer.normalize(permission);
  assert.equal(permissionResult.status, "normalized");
  if (permissionResult.status !== "normalized") return;
  assert.equal(permissionResult.event.eventType, "approval_requested");
});

test("network-only command approvals remain manual and preserve the network target", () => {
  const normalizer = createNormalizer();
  const network = normalizer.normalize({
    id: "network-request",
    method: "item/commandExecution/requestApproval",
    params: {
      additionalPermissions: {
        fileSystem: null,
        network: { enabled: true }
      },
      availableDecisions: ["accept", "decline"],
      environmentId: "local",
      itemId: "item-network",
      networkApprovalContext: {
        host: "api.example.test",
        protocol: "https"
      },
      reason: "network access required",
      startedAtMs: 1762732800100,
      threadId: "thread-network",
      turnId: "turn-network"
    }
  });
  assert.equal(network.status, "normalized");
  if (network.status !== "normalized" || network.event.eventType !== "approval_requested") return;
  assert.deepEqual(network.event.proposal, {
    kind: "network",
    host: "api.example.test",
    protocol: "https",
    environmentId: "local",
    requestedPermissionScope: "{\"fileSystem\":null,\"network\":{\"enabled\":true}}"
  });
  assert.equal(normalizer.encodeApprovalResponse(response("network-request", "decline")).status, "encoded");
});

test("remote-control activity and literal backslash paths quarantine the session", () => {
  const disabled = createNormalizer();
  const disabledSnapshot = {
    method: "remoteControl/status/changed",
    params: {
      environmentId: null,
      serverName: "remote",
      status: "disabled"
    }
  };
  assert.equal(CodexAppServerV2WireMessageSchema.safeParse(disabledSnapshot).success, true);
  assert.deepEqual(disabled.normalize(disabledSnapshot), {
    status: "ignored",
    method: "remoteControl/status/changed"
  });

  const remote = createNormalizer();
  const remoteResult = remote.normalize({
    method: "remoteControl/status/changed",
    params: {
      installationId: "installation-1",
      serverName: "remote",
      status: "connected"
    }
  });
  assert.equal(remoteResult.status, "blocked");
  if (remoteResult.status !== "blocked") return;
  assert.ok(remoteResult.reasons.includes("v2_remote_control_active"));

  const pathNormalizer = createNormalizer();
  const [started] = fileChangeFlow as unknown[];
  const backslash = structuredClone(started) as {
    params: { item: { changes: Array<{ path: string }> } };
  };
  backslash.params.item.changes[0]!.path = "docs" + String.fromCharCode(92) + "guide.md";
  const pathResult = pathNormalizer.normalize(backslash);
  assert.equal(pathResult.status, "blocked");
  if (pathResult.status !== "blocked") return;
  assert.ok(pathResult.reasons.includes("v2_file_change_path_encoding_unsupported"));
});

test("out-of-order approval and completion messages quarantine before adapter dispatch", () => {
  const approvalFirst = createNormalizer();
  const [, approval] = fileChangeFlow as unknown[];
  const first = approvalFirst.normalize(approval);
  assert.equal(first.status, "blocked");
  if (first.status !== "blocked") return;
  assert.ok(first.reasons.includes("v2_file_approval_correlation_failed"));

  const completionFirst = createNormalizer();
  const [started, , , completed] = fileChangeFlow as unknown[];
  assert.equal(completionFirst.normalize(started).status, "normalized");
  assert.equal(completionFirst.normalize(completed).status, "normalized");
  const lateApproval = completionFirst.normalize(approval);
  assert.equal(lateApproval.status, "blocked");
  if (lateApproval.status !== "blocked") return;
  assert.ok(lateApproval.reasons.includes("v2_file_approval_correlation_failed"));
});

test("request ids cannot be rebound to a different file approval", () => {
  const normalizer = createNormalizer();
  const [started, approval] = fileChangeFlow as unknown[];
  assert.equal(normalizer.normalize(started).status, "normalized");
  assert.equal(normalizer.normalize(approval).status, "normalized");

  const other = structuredClone(started) as {
    params: { item: { id: string }; turnId: string };
  };
  other.params.item.id = "item-v2-2";
  other.params.turnId = "turn-v2-2";
  assert.equal(normalizer.normalize(other).status, "normalized");

  const rebound = structuredClone(approval) as {
    params: { itemId: string; turnId: string };
  };
  rebound.params.itemId = "item-v2-2";
  rebound.params.turnId = "turn-v2-2";
  const result = normalizer.normalize(rebound);
  assert.equal(result.status, "blocked");
  if (result.status !== "blocked") return;
  assert.ok(result.reasons.includes("v2_request_id_collision"));
});

test("replayed wire messages and mismatched completion changes quarantine", () => {
  const normalizer = createNormalizer();
  const [started, , , completed] = fileChangeFlow as unknown[];
  assert.equal(normalizer.normalize(started).status, "normalized");

  const replay = normalizer.normalize(started);
  assert.equal(replay.status, "blocked");
  if (replay.status !== "blocked") return;
  assert.ok(replay.reasons.includes("v2_wire_event_replay"));

  const separate = createNormalizer();
  assert.equal(separate.normalize(started).status, "normalized");
  const changed = structuredClone(completed) as {
    params: { item: { changes: Array<{ diff: string }> } };
  };
  changed.params.item.changes[0]!.diff += "\n+drift";
  const mismatch = separate.normalize(changed);
  assert.equal(mismatch.status, "blocked");
  if (mismatch.status !== "blocked") return;
  assert.ok(mismatch.reasons.includes("v2_item_completed_correlation_failed"));

  const invalidStatus = structuredClone(completed) as {
    params: { item: { status: string } };
  };
  invalidStatus.params.item.status = "inProgress";
  const invalidCompletion = createNormalizer();
  assert.equal(invalidCompletion.normalize(started).status, "normalized");
  const invalidStatusOutcome = invalidCompletion.normalize(invalidStatus);
  assert.equal(invalidStatusOutcome.status, "blocked");
  if (invalidStatusOutcome.status !== "blocked") return;
  assert.ok(invalidStatusOutcome.reasons.includes("v2_item_completed_status_invalid"));
});

test("wire response ids preserve numeric JSON-RPC ids and response replay is blocked", () => {
  const normalizer = createNormalizer();
  const [started, approval] = fileChangeFlow as unknown[];
  assert.equal(normalizer.normalize(started).status, "normalized");
  const numericApproval = structuredClone(approval) as {
    id: string | number;
  };
  numericApproval.id = 7;
  const requested = normalizer.normalize(numericApproval);
  assert.equal(requested.status, "normalized");
  if (requested.status !== "normalized" || requested.event.eventType !== "approval_requested") return;
  assert.equal(requested.event.requestId, "7");

  const encoded = normalizer.encodeApprovalResponse(response("7", "decline"));
  assert.deepEqual(encoded, {
    status: "encoded",
    message: { id: 7, result: { decision: "decline" } }
  });
  assert.equal(
    normalizer.encodeApprovalResponse(response("7", "decline")).status,
    "blocked"
  );
  const unsupported = normalizer.encodeApprovalResponse({
    ...response("7", "accept"),
    decision: "acceptForSession"
  } as never);
  assert.equal(unsupported.status, "blocked");
});

test("wire transport sends only the normalized accept/decline response", async () => {
  const normalizer = createNormalizer();
  const [started, approval] = fileChangeFlow as unknown[];
  assert.equal(normalizer.normalize(started).status, "normalized");
  assert.equal(normalizer.normalize(approval).status, "normalized");
  const messages: unknown[] = [];
  const transport = new CodexAppServerV2WireTransport({
    normalizer,
    async send(message) {
      messages.push(message);
    }
  });

  await transport.send(response("request-v2-1", "decline"));
  assert.deepEqual(messages, [{
    id: "request-v2-1",
    result: { decision: "decline" }
  }]);
});
