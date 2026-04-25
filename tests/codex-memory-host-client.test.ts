import test from "node:test";
import assert from "node:assert/strict";
import {
  createCodexMemoryAdapterFromHost,
  createCodexMemoryHostClient,
  createMcpToolStyleCodexMemoryOperations,
  type CodexMemoryHostOperations,
  type CodexMemoryOverviewInput,
  type CodexMemoryOverviewResponse,
  type CodexMemorySearchInput,
  type CodexMemorySearchResponse,
  type CodexMemoryWriteInput,
  type CodexMemoryWriteResponse
} from "../packages/codex-memory-host-client/src/index.js";

function createRecordingOperations(input?: {
  recordResponse?: CodexMemoryWriteResponse;
  searchResponse?: CodexMemorySearchResponse;
  overviewResponse?: CodexMemoryOverviewResponse;
}): CodexMemoryHostOperations & {
  calls: {
    record_memory: CodexMemoryWriteInput[];
    search_memory: CodexMemorySearchInput[];
    memory_overview: CodexMemoryOverviewInput[];
  };
} {
  const calls = {
    record_memory: [] as CodexMemoryWriteInput[],
    search_memory: [] as CodexMemorySearchInput[],
    memory_overview: [] as CodexMemoryOverviewInput[]
  };

  return {
    calls,
    async record_memory(request: CodexMemoryWriteInput) {
      calls.record_memory.push(request);
      return input?.recordResponse ?? {
        success: true,
        memoryId: "memory-host-recording",
        filePath: "memory://memory-host-recording"
      };
    },
    async search_memory(request: CodexMemorySearchInput) {
      calls.search_memory.push(request);
      return input?.searchResponse ?? {
        results: []
      };
    },
    async memory_overview(request: CodexMemoryOverviewInput = {}) {
      calls.memory_overview.push(request);
      return input?.overviewResponse ?? {
        adapterStatus: {
          codexMcp: "enabled"
        }
      };
    }
  };
}

test("CodexMemoryHostClient maps record_memory and search_memory operations", async () => {
  const operations = createRecordingOperations({
    recordResponse: {
      success: true,
      memoryId: "memory-1",
      filePath: "memory://memory-1"
    },
    searchResponse: {
      results: [
        {
          title: "checkpoint: codex-router task-1 ready",
          memoryId: "memory-1"
        }
      ]
    }
  });
  const client = createCodexMemoryHostClient(operations);

  const write = await client.recordMemory({
    target: "process",
    title: "checkpoint: codex-router task-1 ready",
    content: "content",
    evidence: "evidence",
    reusable: true,
    sensitivity: "internal",
    validated: true
  });
  const search = await client.searchMemory({
    query: "codex-router task-1 checkpoint",
    target: "process",
    includeContent: true,
    limit: 3
  });

  assert.equal(write.memoryId, "memory-1");
  assert.equal(search.results[0]?.memoryId, "memory-1");
  assert.equal(operations.calls.record_memory.length, 1);
  assert.equal(operations.calls.search_memory.length, 1);
});

test("CodexMemoryHostClient exposes memoryOverview when the host supports it", async () => {
  const operations = createRecordingOperations({
    overviewResponse: {
      adapterStatus: {
        codexMcp: "enabled"
      }
    }
  });
  const client = createCodexMemoryHostClient(operations);

  const overview = await client.memoryOverview({
    auditWindow: 7,
    limit: 3
  });

  assert.deepEqual(overview, {
    adapterStatus: {
      codexMcp: "enabled"
    }
  });
  assert.equal(operations.calls.memory_overview.length, 1);
});

test("createCodexMemoryAdapterFromHost wires a real host client into CodexMemoryAdapter", async () => {
  const operations = createRecordingOperations({
    recordResponse: {
      success: true,
      memoryId: "memory-2",
      filePath: "memory://memory-2"
    },
    searchResponse: {
      results: [
        {
          title: "checkpoint: codex-router@A:/codex-router task-2 ready-for-desktop-execution",
          memoryId: "memory-2",
          content: [
            "Checkpoint ID: cp-2",
            "Checkpoint anchor: codex-router@A:/codex-router",
            "Task ID: task-2",
            "Stage conclusion: ready-for-desktop-execution",
            "Created at: 2026-04-23T12:00:00.000Z",
            "Summary: ready to continue"
          ].join("\n")
        }
      ]
    }
  });

  const { adapter } = createCodexMemoryAdapterFromHost(operations, {
    anchor: "codex-router@A:/codex-router"
  });

  const result = await adapter.recordCheckpointDetailed({
    checkpointId: "cp-2",
    taskId: "task-2",
    stage: "ready-for-desktop-execution",
    createdAt: "2026-04-23T12:00:00.000Z",
    summary: "ready to continue"
  });

  assert.equal(result.write.memoryId, "memory-2");
  assert.equal(result.recall?.memoryId, "memory-2");
  assert.equal(operations.calls.record_memory.length, 1);
  assert.equal(operations.calls.search_memory.length, 1);
});

test("createMcpToolStyleCodexMemoryOperations adapts direct tool functions", async () => {
  const calls = {
    record: 0,
    search: 0,
    overview: 0
  };
  const operations = createMcpToolStyleCodexMemoryOperations({
    recordMemoryTool(input) {
      calls.record += 1;
      return {
        success: true,
        memoryId: `memory-${input.title}`
      };
    },
    searchMemoryTool(input) {
      calls.search += 1;
      return {
        results: [
          {
            title: input.query,
            memoryId: "memory-query"
          }
        ]
      };
    },
    memoryOverviewTool() {
      calls.overview += 1;
      return {
        adapterStatus: {
          codexMcp: "enabled"
        }
      };
    }
  });
  const client = createCodexMemoryHostClient(operations);

  const write = await client.recordMemory({
    target: "process",
    title: "task-3",
    content: "content",
    evidence: "evidence",
    reusable: true,
    sensitivity: "internal",
    validated: true
  });
  const search = await client.searchMemory({
    query: "task-3"
  });
  const overview = await client.memoryOverview();

  assert.equal(write.memoryId, "memory-task-3");
  assert.equal(search.results[0]?.memoryId, "memory-query");
  assert.deepEqual(overview, {
    adapterStatus: {
      codexMcp: "enabled"
    }
  });
  assert.deepEqual(calls, {
    record: 1,
    search: 1,
    overview: 1
  });
});

test("codex-memory-host-client keeps recording helpers out of the public surface", async () => {
  const moduleExports = await import("../packages/codex-memory-host-client/src/index.js");

  assert.equal("createRecordingCodexMemoryHostOperations" in moduleExports, false);
  assert.equal("RecordingCodexMemoryHostOperations" in moduleExports, false);
});
