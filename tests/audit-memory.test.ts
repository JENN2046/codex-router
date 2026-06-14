import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { FileAuditStore, NoopMemoryAdapter, checkpointAndAudit } from "../packages/audit-memory/src/index.js";

test("audit memory records checkpoint resume events", async () => {
  const dir = await mkdtemp(join(tmpdir(), "codex-router-audit-"));
  const store = new FileAuditStore(join(dir, "audit.json"));

  await checkpointAndAudit(
    {
      checkpointId: "cp-1",
      taskId: "task-1",
      stage: "validate",
      createdAt: "2026-04-23T12:00:00.000Z",
      summary: "ready to resume"
    },
    new NoopMemoryAdapter(),
    store
  );

  const events = await store.loadAll();
  assert.equal(events.length, 1);
  assert.equal(events[0]?.type, "task_resumed");
  assert.equal(events[0]?.details.stage, "validate");
});

test("file audit store writes sanitized JSON", async () => {
  const dir = await mkdtemp(join(tmpdir(), "codex-router-audit-"));
  const auditPath = join(dir, "audit.json");
  const store = new FileAuditStore(auditPath);

  await store.record({
    type: "primitive_failed",
    taskId: "task-secret",
    timestamp: "2026-04-23T12:00:00.000Z",
    details: {
      apiKey: "raw-api-key",
      stdout: "x".repeat(5000),
      stderr: "Authorization: Bearer abc.def.ghi",
      message: "model returned sk-proj-123456789",
      args: ["--token", "raw-token", "--safe", "ok"],
      nested: {
        password: "raw-password"
      }
    }
  });

  const raw = await readFile(auditPath, "utf8");
  assert.equal(raw.includes("raw-api-key"), false);
  assert.equal(raw.includes("abc.def.ghi"), false);
  assert.equal(raw.includes("sk-proj-123456789"), false);
  assert.equal(raw.includes("raw-token"), false);
  assert.equal(raw.includes("raw-password"), false);

  const events = await store.loadAll();
  assert.equal(events.length, 1);
  assert.equal(events[0]?.details.apiKey, "<REDACTED_SECRET>");
  assert.equal(events[0]?.details.stdout, "<omitted:5000>");
  assert.equal(events[0]?.details.stderr, "Authorization: <REDACTED_SECRET>");
  assert.equal(events[0]?.details.message, "model returned <REDACTED_SECRET>");
  assert.deepEqual(events[0]?.details.args, ["--token", "<REDACTED_SECRET>", "--safe", "ok"]);
  assert.deepEqual(events[0]?.details.nested, {
    password: "<REDACTED_SECRET>"
  });
});
