import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCheckpointMemoryRecord,
  buildCheckpointRecallQuery,
  CodexMemoryAdapter,
  parseCheckpointRefFromMemoryResult,
  type CodexMemoryClient,
  type CodexMemorySearchInput,
  type CodexMemorySearchResponse,
  type CodexMemoryWriteInput,
  type CodexMemoryWriteResponse
} from "../packages/codex-memory-adapter/src/index.js";

test("buildCheckpointMemoryRecord maps a checkpoint into codex-memory write input", () => {
  const record = buildCheckpointMemoryRecord(
    {
      checkpointId: "cp-1",
      taskId: "task-1",
      stage: "ready-for-desktop-execution",
      createdAt: "2026-04-23T12:00:00.000Z",
      summary: "runner produced a ready package"
    },
    {
      anchor: "codex-router@A:/codex-router",
      tags: ["desktop-first"]
    }
  );

  assert.match(record.writeInput.title, /checkpoint: codex-router@A:\/codex-router task-1 ready-for-desktop-execution/);
  assert.match(record.writeInput.content, /Stage conclusion: ready-for-desktop-execution/);
  assert.match(record.writeInput.evidence, /Checkpoint ID: cp-1/);
  assert.equal(record.writeInput.tags, "codex-router,checkpoint,ready-for-desktop-execution,task-1,desktop-first");
  assert.equal(
    record.recallQuery,
    "codex-router@A:/codex-router task-1 checkpoint ready-for-desktop-execution"
  );
});

test("CodexMemoryAdapter records a checkpoint and verifies recall", async () => {
  const writes: CodexMemoryWriteInput[] = [];
  const searches: CodexMemorySearchInput[] = [];

  const client: CodexMemoryClient = {
    async recordMemory(input: CodexMemoryWriteInput): Promise<CodexMemoryWriteResponse> {
      writes.push(input);
      return {
        success: true,
        memoryId: "memory-1",
        filePath: "A:/codex-memory/checkpoint.txt"
      };
    },
    async searchMemory(input: CodexMemorySearchInput): Promise<CodexMemorySearchResponse> {
      searches.push(input);
      return {
        results: [
          {
            title: "checkpoint: codex-router@A:/codex-router task-1 ready-for-desktop-execution",
            memoryId: "memory-1",
            content: "Checkpoint anchor: codex-router@A:/codex-router"
          }
        ]
      };
    }
  };

  const adapter = new CodexMemoryAdapter(client, {
    anchor: "codex-router@A:/codex-router"
  });
  const result = await adapter.recordCheckpointDetailed({
    checkpointId: "cp-1",
    taskId: "task-1",
    stage: "ready-for-desktop-execution",
    createdAt: "2026-04-23T12:00:00.000Z",
    summary: "runner produced a ready package"
  });

  assert.equal(writes.length, 1);
  assert.equal(searches.length, 1);
  assert.equal(result.write.memoryId, "memory-1");
  assert.equal(result.recall?.memoryId, "memory-1");
  assert.equal(searches[0]?.query, "codex-router@A:/codex-router task-1 checkpoint ready-for-desktop-execution");
});

test("CodexMemoryAdapter can recall the latest checkpoint without writing", async () => {
  const client: CodexMemoryClient = {
    async recordMemory(_input: CodexMemoryWriteInput): Promise<CodexMemoryWriteResponse> {
      throw new Error("should not write");
    },
    async searchMemory(input: CodexMemorySearchInput): Promise<CodexMemorySearchResponse> {
      assert.equal(input.query, "codex-router@A:/codex-router task-2 checkpoint approval-pending");
      return {
        results: [
          {
            title: "checkpoint: codex-router@A:/codex-router task-2 approval-pending",
            memoryId: "memory-2"
          }
        ]
      };
    }
  };

  const adapter = new CodexMemoryAdapter(client, {
    anchor: "codex-router@A:/codex-router",
    verifyRecall: false
  });
  const result = await adapter.recallLatestCheckpoint({
    taskId: "task-2",
    stage: "approval-pending"
  });

  assert.equal(result?.memoryId, "memory-2");
});

test("buildCheckpointRecallQuery omits stage when not provided", () => {
  assert.equal(
    buildCheckpointRecallQuery({
      anchor: "codex-router@A:/codex-router",
      taskId: "task-3"
    }),
    "codex-router@A:/codex-router task-3 checkpoint"
  );
});

test("parseCheckpointRefFromMemoryResult restores a CheckpointRef from memory content", () => {
  const checkpoint = parseCheckpointRefFromMemoryResult({
    title: "checkpoint: codex-router@A:/codex-router task-4 ready-for-desktop-execution",
    memoryId: "memory-4",
    content: [
      "Checkpoint ID: cp-4",
      "Checkpoint anchor: codex-router@A:/codex-router",
      "Task ID: task-4",
      "Stage conclusion: ready-for-desktop-execution",
      "Created at: 2026-04-23T12:00:00.000Z",
      "Summary: ready to continue"
    ].join("\n")
  });

  assert.deepEqual(checkpoint, {
    checkpointId: "cp-4",
    taskId: "task-4",
    stage: "ready-for-desktop-execution",
    createdAt: "2026-04-23T12:00:00.000Z",
    summary: "ready to continue"
  });
});
