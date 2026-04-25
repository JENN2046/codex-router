import { z } from "zod";
import {
  CodexMemoryAdapter,
  type CodexMemoryAdapterOptions,
  type CodexMemoryClient,
  type CodexMemorySearchInput,
  type CodexMemorySearchResponse,
  type CodexMemoryWriteInput,
  type CodexMemoryWriteResponse
} from "../../codex-memory-adapter/src/index.js";

const MCP_SESSION_HEADER = "Mcp-Session-Id";
const DEFAULT_MCP_PATH = "/mcp/codex-memory";
const DEFAULT_PROTOCOL_VERSION = "2025-06-18";
const DEFAULT_CLIENT_NAME = "codex-router";
const DEFAULT_CLIENT_VERSION = "0.1.0";
const EXPECTED_SERVER_NAME = "vcp_codex_memory";

const JsonRpcErrorSchema = z.object({
  code: z.number(),
  message: z.string(),
  data: z.unknown().optional()
});

const JsonRpcResponseSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string(), z.number(), z.null()]).optional(),
  result: z.unknown().optional(),
  error: JsonRpcErrorSchema.optional()
});

const InitializeResultSchema = z.object({
  protocolVersion: z.string(),
  capabilities: z.record(z.string(), z.unknown()),
  serverInfo: z.object({
    name: z.string(),
    version: z.string()
  })
});

const ToolEnvelopeSchema = z.object({
  structuredContent: z.unknown().optional(),
  content: z.array(z.object({
    type: z.string(),
    text: z.string().optional()
  }).passthrough()).optional(),
  isError: z.boolean().optional()
}).passthrough();

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

const MemoryOverviewResponseSchema = z.record(z.string(), z.unknown());

export interface CodexMemoryMcpHttpClientOptions {
  baseUrl: string;
  mcpPath?: string;
  bearerToken?: string;
  protocolVersion?: string;
  clientName?: string;
  clientVersion?: string;
  headers?: Record<string, string>;
  fetchImpl?: typeof fetch;
}

export interface CodexMemoryMcpInitializeResult {
  protocolVersion: string;
  capabilities: Record<string, unknown>;
  serverInfo: {
    name: string;
    version: string;
  };
}

export interface CodexMemoryMcpHttpAdapterBundle {
  client: CodexMemoryMcpHttpClient;
  adapter: CodexMemoryAdapter;
}

interface NormalizedCodexMemoryMcpHttpClientOptions {
  endpoint: URL;
  bearerToken?: string;
  protocolVersion: string;
  clientName: string;
  clientVersion: string;
  headers: Record<string, string>;
  fetchImpl: typeof fetch;
}

export class CodexMemoryMcpHttpClient implements CodexMemoryClient {
  private readonly options: NormalizedCodexMemoryMcpHttpClientOptions;
  private sessionId: string | undefined;
  private initializePromise: Promise<CodexMemoryMcpInitializeResult> | undefined;
  private requestCounter = 0;

  constructor(options: CodexMemoryMcpHttpClientOptions) {
    this.options = normalizeOptions(options);
  }

  async initialize(): Promise<CodexMemoryMcpInitializeResult> {
    if (!this.initializePromise) {
      this.initializePromise = this.initializeInternal().catch((error) => {
        this.initializePromise = undefined;
        throw error;
      });
    }

    return this.initializePromise;
  }

  isInitialized(): boolean {
    return Boolean(this.initializePromise);
  }

  getSessionId(): string | undefined {
    return this.sessionId;
  }

  async close(): Promise<void> {
    if (!this.sessionId) {
      return;
    }

    const headers = new Headers(this.buildBaseHeaders());
    headers.set(MCP_SESSION_HEADER, this.sessionId);

    const response = await this.options.fetchImpl(this.options.endpoint, {
      method: "DELETE",
      headers
    });

    if (!response.ok && response.status !== 204) {
      throw new CodexMemoryMcpClientError(
        `codex_memory_mcp_http_close_failed:${response.status}`
      );
    }

    this.sessionId = undefined;
    this.initializePromise = undefined;
  }

  async recordMemory(input: CodexMemoryWriteInput): Promise<CodexMemoryWriteResponse> {
    const payload = await this.callTool("record_memory", input);
    return normalizeRecordMemoryResponse(RecordMemoryResponseSchema.parse(payload));
  }

  async searchMemory(input: CodexMemorySearchInput): Promise<CodexMemorySearchResponse> {
    const payload = await this.callTool("search_memory", {
      query: input.query,
      ...(input.target !== undefined ? { target: input.target } : {}),
      ...(input.includeContent !== undefined ? { include_content: input.includeContent } : {}),
      ...(input.limit !== undefined ? { limit: input.limit } : {})
    });

    return normalizeSearchMemoryResponse(SearchMemoryResponseSchema.parse(payload));
  }

  async memoryOverview(input: {
    auditWindow?: number;
    limit?: number;
  } = {}): Promise<Record<string, unknown>> {
    const payload = await this.callTool("memory_overview", {
      ...(input.auditWindow !== undefined ? { auditWindow: input.auditWindow } : {}),
      ...(input.limit !== undefined ? { limit: input.limit } : {})
    });

    return MemoryOverviewResponseSchema.parse(payload);
  }

  private async initializeInternal(): Promise<CodexMemoryMcpInitializeResult> {
    const result = await this.callJsonRpc("initialize", {
      protocolVersion: this.options.protocolVersion,
      clientInfo: {
        name: this.options.clientName,
        version: this.options.clientVersion
      },
      capabilities: {}
    });

    const parsed = InitializeResultSchema.parse(result);

    if (parsed.serverInfo.name !== EXPECTED_SERVER_NAME) {
      throw new CodexMemoryMcpClientError(
        `codex_memory_mcp_unexpected_server:${parsed.serverInfo.name}`
      );
    }

    return parsed;
  }

  private async callTool(name: string, args: unknown): Promise<unknown> {
    await this.initialize();
    const result = await this.callJsonRpc("tools/call", {
      name,
      arguments: args
    });

    return extractToolPayload(result);
  }

  private async callJsonRpc(method: string, params: unknown): Promise<unknown> {
    const headers = new Headers(this.buildBaseHeaders());
    if (this.sessionId) {
      headers.set(MCP_SESSION_HEADER, this.sessionId);
    }

    const response = await this.options.fetchImpl(this.options.endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: this.nextRequestId(),
        method,
        params
      })
    });

    const responseSessionId = response.headers.get(MCP_SESSION_HEADER);
    if (responseSessionId) {
      this.sessionId = responseSessionId;
    }

    const responseText = await response.text();
    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(responseText);
    } catch (error) {
      throw new CodexMemoryMcpClientError(
        `codex_memory_mcp_http_invalid_json:${(error as Error).message}`
      );
    }

    const parsed = JsonRpcResponseSchema.parse(parsedBody);

    if (parsed.error) {
      throw new CodexMemoryMcpClientError(
        `codex_memory_mcp_rpc_error:${parsed.error.code}:${parsed.error.message}`
      );
    }

    if (!response.ok) {
      throw new CodexMemoryMcpClientError(
        `codex_memory_mcp_http_error:${response.status}`
      );
    }

    return parsed.result;
  }

  private buildBaseHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json; charset=utf-8",
      Accept: "application/json",
      ...(this.options.bearerToken
        ? { Authorization: `Bearer ${this.options.bearerToken}` }
        : {}),
      ...this.options.headers
    };
  }

  private nextRequestId(): string {
    this.requestCounter += 1;
    return `codex-router-mcp-${this.requestCounter}`;
  }
}

export function createCodexMemoryMcpHttpClient(
  options: CodexMemoryMcpHttpClientOptions
): CodexMemoryMcpHttpClient {
  return new CodexMemoryMcpHttpClient(options);
}

export function createCodexMemoryAdapterFromMcpHttp(
  clientOptions: CodexMemoryMcpHttpClientOptions,
  adapterOptions: CodexMemoryAdapterOptions
): CodexMemoryMcpHttpAdapterBundle {
  const client = createCodexMemoryMcpHttpClient(clientOptions);
  const adapter = new CodexMemoryAdapter(client, adapterOptions);

  return {
    client,
    adapter
  };
}

export class CodexMemoryMcpClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CodexMemoryMcpClientError";
  }
}

function normalizeOptions(
  input: CodexMemoryMcpHttpClientOptions
): NormalizedCodexMemoryMcpHttpClientOptions {
  const endpoint = new URL(
    normalizeMcpPath(input.mcpPath ?? DEFAULT_MCP_PATH),
    ensureTrailingSlash(input.baseUrl)
  );

  return {
    endpoint,
    ...(input.bearerToken !== undefined ? { bearerToken: input.bearerToken } : {}),
    protocolVersion: input.protocolVersion ?? DEFAULT_PROTOCOL_VERSION,
    clientName: input.clientName ?? DEFAULT_CLIENT_NAME,
    clientVersion: input.clientVersion ?? DEFAULT_CLIENT_VERSION,
    headers: { ...(input.headers ?? {}) },
    fetchImpl: input.fetchImpl ?? fetch
  };
}

function normalizeMcpPath(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return DEFAULT_MCP_PATH;
  }

  const prefixed = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  if (prefixed.length > 1 && prefixed.endsWith("/")) {
    return prefixed.replace(/\/+$/, "");
  }

  return prefixed;
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function extractToolPayload(result: unknown): unknown {
  const envelope = ToolEnvelopeSchema.parse(result);

  if (envelope.structuredContent !== undefined) {
    return envelope.structuredContent;
  }

  const textPayload = envelope.content
    ?.map((part) => part.text)
    .find((value): value is string => typeof value === "string" && value.trim().length > 0);

  if (!textPayload) {
    return envelope;
  }

  try {
    return JSON.parse(textPayload);
  } catch {
    return {
      text: textPayload
    };
  }
}

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
