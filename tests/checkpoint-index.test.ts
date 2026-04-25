import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { FileCheckpointIndex } from "../packages/checkpoint-index/src/index.js";

test("checkpoint index restores latest checkpoint for a task", async () => {
  const dir = await mkdtemp(join(tmpdir(), "codex-router-checkpoint-"));
  const index = new FileCheckpointIndex(join(dir, "checkpoints.json"));

  await index.record({
    checkpointId: "cp-1",
    taskId: "task-1",
    stage: "plan",
    createdAt: "2026-04-23T11:00:00.000Z",
    summary: "planning complete"
  });

  await index.record({
    checkpointId: "cp-2",
    taskId: "task-1",
    stage: "validate",
    createdAt: "2026-04-23T12:00:00.000Z",
    summary: "validation ready"
  });

  const latest = await index.findLatestForTask("task-1");
  assert.equal(latest?.checkpointId, "cp-2");
  assert.equal(latest?.stage, "validate");
});
