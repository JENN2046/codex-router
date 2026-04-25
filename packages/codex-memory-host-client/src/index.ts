import { z } from "zod";
import {
  CodexMemoryAdapter,
  type CodexMemoryAdapterOptions,
  type CodexMemoryClient,
  type CodexMemorySearchInput,
  type CodexMemorySearchResponse,
  type CodexMemorySearchResult,
  type CodexMemoryWriteInput,
  type CodexMemoryWriteResponse
} from "../../codex-memory-adapter/src/index.js";

const RecordMemoryResponseSchema = z.object({
  success: z.boolean(),
  memoryId: z.string().nullable().optional(),
  filePath: z.string().nullable().optional(),
  reason: z.string().nullable().optional()
}).passthrough();

const SearchMemoryResultSchema = z.object({
  target: z.string().optional(),
  title: z.string(),
  memoryId: z.string().optional(),
  score: z.number().optional(),
  sourceFile: z.string().optional(),
  matchedTags: z.array(z.string()).optional(),
  snippet: z.string().optional(),
  content: z.string().optional(),
  text: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
}).passthrough();

const SearchMemoryResponseSchema = z.object({
  results: z.array(SearchMemoryResultSchema)
}).passthrough();

const MemoryOverviewInputSchema = z.object({
  auditWindow: z.number().int().positive().optional(),
  limit: z.number().int().positive().optional()
});

const MemoryOverviewResponseSchema = z.record(z.string(), z.unknown());

export type CodexMemoryOverviewInput = z.infer<typeof MemoryOverviewInputSchema>;
export type CodexMemoryOverviewResponse = z.infer<typeof MemoryOverviewResponseSchema>;

export interface CodexMemoryHostOperations {
  record_memory(input: CodexMemoryWriteInput): Promise<unknown> | unknown;
  search_memory(input: CodexMemorySearchInput): Promise<unknown> | unknown;
  memory_overview?(input?: CodexMemoryOverviewInput): Promise<unknown> | unknown;
}

export class CodexMemoryHostClient implements CodexMemoryClient {
  constructor(private readonly operations: CodexMemoryHostOperations) {}

  async recordMemory(input: CodexMemoryWriteInput): Promise<CodexMemoryWriteResponse> {
    const response = await this.operations.record_memory(input);
    return normalizeRecordMemoryResponse(RecordMemoryResponseSchema.parse(response));
  }

  async searchMemory(input: CodexMemorySearchInput): Promise<CodexMemorySearchResponse> {
    const response = await this.operations.search_memory(input);
    return normalizeSearchMemoryResponse(SearchMemoryResponseSchema.parse(response));
  }

  async memoryOverview(
    input: CodexMemoryOverviewInput = {}
  ): Promise<CodexMemoryOverviewResponse> {
    if (!this.operations.memory_overview) {
      throw new Error("codex_memory_host_client_memory_overview_unavailable");
    }

    const response = await this.operations.memory_overview(
      MemoryOverviewInputSchema.parse(input)
    );
    return MemoryOverviewResponseSchema.parse(response);
  }
}

export interface CodexMemoryHostAdapterBundle {
  client: CodexMemoryHostClient;
  adapter: CodexMemoryAdapter;
}

export function createCodexMemoryHostClient(
  operations: CodexMemoryHostOperations
): CodexMemoryHostClient {
  return new CodexMemoryHostClient(operations);
}

export function createCodexMemoryAdapterFromHost(
  operations: CodexMemoryHostOperations,
  options: CodexMemoryAdapterOptions
): CodexMemoryHostAdapterBundle {
  const client = createCodexMemoryHostClient(operations);
  const adapter = new CodexMemoryAdapter(client, options);

  return {
    client,
    adapter
  };
}

interface RecordingCodexMemoryHostOperations extends CodexMemoryHostOperations {
  calls: {
    record_memory: CodexMemoryWriteInput[];
    search_memory: CodexMemorySearchInput[];
    memory_overview: CodexMemoryOverviewInput[];
  };
}

function createRecordingCodexMemoryHostOperations(input?: {
  recordResponse?: CodexMemoryWriteResponse;
  searchResponse?: CodexMemorySearchResponse;
  overviewResponse?: CodexMemoryOverviewResponse;
}): RecordingCodexMemoryHostOperations {
  const calls = {
    record_memory: [] as CodexMemoryWriteInput[],
    search_memory: [] as CodexMemorySearchInput[],
    memory_overview: [] as CodexMemoryOverviewInput[]
  };

  return {
    calls,
    async record_memory(request) {
      calls.record_memory.push(request);
      return input?.recordResponse ?? {
        success: true,
        memoryId: "memory-host-recording",
        filePath: "memory://memory-host-recording"
      };
    },
    async search_memory(request) {
      calls.search_memory.push(request);
      return input?.searchResponse ?? {
        results: []
      };
    },
    async memory_overview(request = {}) {
      calls.memory_overview.push(request);
      return input?.overviewResponse ?? {
        adapterStatus: {
          codexMcp: "enabled"
        }
      };
    }
  };
}

export function createMcpToolStyleCodexMemoryOperations(input: {
  recordMemoryTool(input: CodexMemoryWriteInput): Promise<unknown> | unknown;
  searchMemoryTool(input: CodexMemorySearchInput): Promise<unknown> | unknown;
  memoryOverviewTool?(input?: CodexMemoryOverviewInput): Promise<unknown> | unknown;
}): CodexMemoryHostOperations {
  return {
    record_memory(request) {
      return input.recordMemoryTool(request);
    },
    search_memory(request) {
      return input.searchMemoryTool(request);
    },
    ...(input.memoryOverviewTool
      ? {
          memory_overview(request?: CodexMemoryOverviewInput) {
            return input.memoryOverviewTool?.(request);
          }
        }
      : {})
  };
}

export type {
  CodexMemoryClient,
  CodexMemorySearchInput,
  CodexMemorySearchResponse,
  CodexMemorySearchResult,
  CodexMemoryWriteInput,
  CodexMemoryWriteResponse
};

function normalizeRecordMemoryResponse(
  response: z.infer<typeof RecordMemoryResponseSchema>
): CodexMemoryWriteResponse {
  return {
    success: response.success,
    ...(response.memoryId !== undefined ? { memoryId: response.memoryId } : {}),
    ...(response.filePath !== undefined ? { filePath: response.filePath } : {}),
    ...(response.reason !== undefined ? { reason: response.reason } : {})
  };
}

function normalizeSearchMemoryResponse(
  response: z.infer<typeof SearchMemoryResponseSchema>
): CodexMemorySearchResponse {
  return {
    results: response.results.map((result) => ({
      title: result.title,
      ...(result.target !== undefined ? { target: result.target } : {}),
      ...(result.memoryId !== undefined ? { memoryId: result.memoryId } : {}),
      ...(result.score !== undefined ? { score: result.score } : {}),
      ...(result.sourceFile !== undefined ? { sourceFile: result.sourceFile } : {}),
      ...(result.matchedTags !== undefined ? { matchedTags: result.matchedTags } : {}),
      ...(result.snippet !== undefined ? { snippet: result.snippet } : {}),
      ...(result.content !== undefined ? { content: result.content } : {}),
      ...(result.text !== undefined ? { text: result.text } : {}),
      ...(result.createdAt !== undefined ? { createdAt: result.createdAt } : {}),
      ...(result.updatedAt !== undefined ? { updatedAt: result.updatedAt } : {})
    }))
  };
}
