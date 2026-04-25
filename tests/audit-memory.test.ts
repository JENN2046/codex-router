import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
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
