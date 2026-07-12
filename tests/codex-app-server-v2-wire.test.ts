import test from "node:test";
import assert from "node:assert/strict";
import fileChangeFlow from "./fixtures/codex-app-server/v2-wire/file-change-flow.json" with { type: "json" };
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

  const malformedResponse = normalizer.normalize({ id: "missing-result-or-error" });
  assert.equal(malformedResponse.status, "blocked");
  if (malformedResponse.status !== "blocked") return;
  assert.ok(malformedResponse.reasons.includes("v2_wire_envelope_invalid"));
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
    }
  ];
  for (const message of startedMessages) {
    assert.equal(CodexAppServerV2WireMessageSchema.safeParse(message).success, true);
    assert.deepEqual(normalizer.normalize(message), {
      status: "ignored",
      method: "item/started"
    });
  }

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

  const [fileStarted] = fileChangeFlow as unknown[];
  assert.equal(normalizer.normalize(fileStarted).status, "normalized");
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
        fileSystem: { read: ["/tmp/codex-router/docs"], write: null },
        network: { enabled: true }
      },
      availableDecisions: ["accept", "decline"],
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
    cwd: "/tmp/codex-router"
  });
  assert.equal(normalizer.encodeApprovalResponse(response("command-request", "accept")).status, "encoded");

  const permission = normalizer.normalize({
    id: "permission-request",
    method: "item/permissions/requestApproval",
    params: {
      cwd: "/tmp/codex-router",
      itemId: "item-permission",
      permissions: {
        fileSystem: { write: ["/tmp/codex-router/docs"] },
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
          fileSystem: { write: ["/tmp/codex-router/docs"] },
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
    protocol: "https"
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
