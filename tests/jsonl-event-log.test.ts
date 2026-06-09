import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  JsonlEventLog,
  JsonlEventLogReadError,
  redactEventSecrets
} from "../packages/kernel-store/src/jsonl-event-log.js";
import {
  EventSchema,
  type Event
} from "../packages/kernel-contracts/src/index.js";
import { validEvent } from "../packages/kernel-contracts/test-fixtures/valid-event.js";

test("jsonl event log appends and reads events without undefined fields", async () => {
  await withTempLog(async ({ log, path }) => {
    const first = createEvent({
      eventId: "event_jsonl_append_001",
      eventType: "kernel.run.created",
      createdAt: "2026-06-04T00:00:00.000Z"
    });
    const second = createEvent({
      eventId: "event_jsonl_append_002",
      eventType: "kernel.step.started",
      createdAt: "2026-06-04T00:01:00.000Z",
      stepId: undefined,
      principalId: undefined
    });

    const appendedFirst = await log.append(first);
    const appendedSecond = await log.append(second);

    assert.equal(appendedFirst.eventId, first.eventId);
    assert.equal(appendedSecond.eventId, second.eventId);

    const events = await log.readAll();
    assert.deepEqual(events.map((event) => event.eventId), [
      first.eventId,
      second.eventId
    ]);

    const lines = (await readFile(path, "utf8")).trim().split("\n");
    assert.equal(lines.length, 2);
    assert.equal(lines[1]?.includes("stepId"), false);
    assert.equal(lines[1]?.includes("principalId"), false);
  });
});

test("jsonl event log filters events by runId", async () => {
  await withTempLog(async ({ log }) => {
    await log.append(createEvent({
      eventId: "event_jsonl_run_001",
      runId: "run_jsonl_001"
    }));
    await log.append(createEvent({
      eventId: "event_jsonl_run_002",
      runId: "run_jsonl_002"
    }));

    assert.deepEqual(
      (await log.readByRunId("run_jsonl_001")).map((event) => event.eventId),
      ["event_jsonl_run_001"]
    );
  });
});

test("jsonl event log filters events by taskId", async () => {
  await withTempLog(async ({ log }) => {
    await log.append(createEvent({
      eventId: "event_jsonl_task_001",
      taskId: "task_jsonl_001"
    }));
    await log.append(createEvent({
      eventId: "event_jsonl_task_002",
      taskId: "task_jsonl_002"
    }));

    assert.deepEqual(
      (await log.readByTaskId("task_jsonl_002")).map((event) => event.eventId),
      ["event_jsonl_task_002"]
    );
  });
});

test("jsonl event log returns an empty list when the file is missing", async () => {
  await withTempLog(async ({ log }) => {
    assert.deepEqual(await log.readAll(), []);
  });
});

test("jsonl event log reports invalid JSON lines as structured errors", async () => {
  await withTempLog(async ({ log, path }) => {
    await writeFile(path, "{\"eventId\":\"event_ok\"\n", "utf8");

    await assert.rejects(
      () => log.readAll(),
      (error: unknown) => {
        assert.ok(error instanceof JsonlEventLogReadError);
        assert.equal(error.errors.length, 1);
        assert.equal(error.errors[0]?.lineNumber, 1);
        assert.equal(error.errors[0]?.code, "invalid_json");
        assert.match(error.errors[0]?.message ?? "", /Expected/);
        return true;
      }
    );
  });
});

test("jsonl event log verifies append order by createdAt", async () => {
  await withTempLog(async ({ log }) => {
    await log.append(createEvent({
      eventId: "event_jsonl_order_001",
      createdAt: "2026-06-04T00:02:00.000Z"
    }));
    await log.append(createEvent({
      eventId: "event_jsonl_order_002",
      createdAt: "2026-06-04T00:01:00.000Z"
    }));

    const result = await log.verifyOrder();

    assert.equal(result.ok, false);
    assert.equal(result.issues.length, 1);
    assert.equal(result.issues[0]?.previousEventId, "event_jsonl_order_001");
    assert.equal(result.issues[0]?.currentEventId, "event_jsonl_order_002");
  });
});

test("jsonl event log redacts secret-like event payload fields before writing", async () => {
  await withTempLog(async ({ log, path }) => {
    const event = createEvent({
      eventId: "event_jsonl_redaction_001",
      payload: {
        apiKey: "secret-api-key-value",
        nested: {
          token: "secret-token-value",
          safe: "visible"
        }
      }
    });

    const redacted = redactEventSecrets(event);
    assert.equal(redacted.payload.apiKey, "<REDACTED_SECRET>");
    assert.deepEqual(redacted.payload.nested, {
      token: "<REDACTED_SECRET>",
      safe: "visible"
    });

    await log.append(event);
    const raw = await readFile(path, "utf8");

    assert.equal(raw.includes("secret-api-key-value"), false);
    assert.equal(raw.includes("secret-token-value"), false);
    assert.equal(raw.includes("<REDACTED_SECRET>"), true);
  });
});

async function withTempLog(
  callback: (input: { log: JsonlEventLog; path: string }) => Promise<void>
): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "codex-router-jsonl-event-log-"));
  const path = join(dir, "events.jsonl");
  try {
    await callback({
      log: new JsonlEventLog({ path }),
      path
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function createEvent(overrides: Record<string, unknown> = {}): Event {
  return EventSchema.parse({
    ...validEvent,
    eventId: "event_jsonl_fixture_001",
    eventType: "kernel.jsonl.fixture",
    taskId: "task_jsonl_001",
    runId: "run_jsonl_001",
    stepId: undefined,
    principalId: undefined,
    createdAt: "2026-06-04T00:00:00.000Z",
    payload: {},
    ...overrides
  });
}
