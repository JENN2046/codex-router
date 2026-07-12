import test from "node:test";
import assert from "node:assert/strict";
import fileChangeFlow from "./fixtures/codex-app-server/v2-wire/file-change-flow.json" with { type: "json" };
import {
  CodexAppServerNormalizedEventSchema,
  CodexAppServerV2WireMessageSchema,
  CodexAppServerV2WireNormalizer,
  CodexAppServerV2WireTransport,
  type CodexAppServerApprovalResponse
} from "../packages/codex-adapter/src/index.js";

const schemaProfileId = "codex-app-server-v2";
const baseHead = "a".repeat(40);
const beforeHash = "b".repeat(64);
const afterHash = "c".repeat(64);

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
  return new CodexAppServerV2WireNormalizer({
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
