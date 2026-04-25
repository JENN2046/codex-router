import type {
  CheckpointRecallAdapter,
  MemoryAdapter
} from "../../audit-memory/src/index.js";
import type { CheckpointRef } from "../../contracts/src/index.js";

export type CodexMemoryTarget = "process" | "knowledge";
export type CodexMemorySearchTarget = "process" | "knowledge" | "both";

export interface CodexMemoryWriteInput {
  target: CodexMemoryTarget;
  title: string;
  content: string;
  evidence: string;
  reusable: boolean;
  sensitivity: string;
  tags?: string;
  validated: boolean;
}

export interface CodexMemoryWriteResponse {
  success: boolean;
  memoryId?: string | null;
  filePath?: string | null;
  reason?: string | null;
}

export interface CodexMemorySearchInput {
  query: string;
  target?: CodexMemorySearchTarget;
  includeContent?: boolean;
  limit?: number;
}

export interface CodexMemorySearchResult {
  target?: string;
  title: string;
  memoryId?: string;
  score?: number;
  sourceFile?: string;
  matchedTags?: string[];
  snippet?: string;
  content?: string;
  text?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CodexMemorySearchResponse {
  results: CodexMemorySearchResult[];
}

export interface CodexMemoryClient {
  recordMemory(input: CodexMemoryWriteInput): Promise<CodexMemoryWriteResponse>;
  searchMemory(input: CodexMemorySearchInput): Promise<CodexMemorySearchResponse>;
}

export interface CodexMemoryAdapterOptions {
  anchor: string;
  target?: CodexMemoryTarget;
  sensitivity?: string;
  reusable?: boolean;
  validated?: boolean;
  tags?: string[];
  verifyRecall?: boolean;
  requireRecallHit?: boolean;
  recallLimit?: number;
}

export interface CheckpointMemoryRecord {
  writeInput: CodexMemoryWriteInput;
  recallQuery: string;
}

export interface CodexMemoryCheckpointWriteResult {
  record: CheckpointMemoryRecord;
  write: CodexMemoryWriteResponse;
  recall?: CodexMemorySearchResult;
}

export interface RecallCheckpointInput {
  taskId: string;
  stage?: string;
  limit?: number;
  includeContent?: boolean;
}

interface NormalizedCodexMemoryAdapterOptions {
  anchor: string;
  target: CodexMemoryTarget;
  sensitivity: string;
  reusable: boolean;
  validated: boolean;
  verifyRecall: boolean;
  requireRecallHit: boolean;
  recallLimit: number;
  tags: string[];
}

export class CodexMemoryAdapter implements MemoryAdapter, CheckpointRecallAdapter {
  private readonly options: NormalizedCodexMemoryAdapterOptions;

  constructor(
    private readonly client: CodexMemoryClient,
    options: CodexMemoryAdapterOptions
  ) {
    this.options = {
      anchor: options.anchor,
      target: options.target ?? "process",
      sensitivity: options.sensitivity ?? "internal",
      reusable: options.reusable ?? true,
      validated: options.validated ?? true,
      verifyRecall: options.verifyRecall ?? true,
      requireRecallHit: options.requireRecallHit ?? false,
      recallLimit: options.recallLimit ?? 3,
      tags: options.tags ?? []
    };
  }

  async recordCheckpoint(checkpoint: CheckpointRef): Promise<void> {
    await this.recordCheckpointDetailed(checkpoint);
  }

  async recordCheckpointDetailed(
    checkpoint: CheckpointRef
  ): Promise<CodexMemoryCheckpointWriteResult> {
    const record = buildCheckpointMemoryRecord(checkpoint, this.options);
    const write = await this.client.recordMemory(record.writeInput);

    if (!write.success) {
      throw new Error(write.reason ?? "codex_memory_write_failed");
    }

    let recall: CodexMemorySearchResult | undefined;

    if (this.options.verifyRecall) {
      recall = await this.recallLatestCheckpoint({
        taskId: checkpoint.taskId,
        stage: checkpoint.stage,
        limit: this.options.recallLimit
      });

      if (!recall && this.options.requireRecallHit) {
        throw new Error("codex_memory_recall_miss");
      }
    }

    return {
      record,
      write,
      ...(recall !== undefined ? { recall } : {})
    };
  }

  async recallLatestCheckpoint(
    input: RecallCheckpointInput
  ): Promise<CodexMemorySearchResult | undefined> {
    const query = buildCheckpointRecallQuery({
      anchor: this.options.anchor,
      taskId: input.taskId,
      ...(input.stage !== undefined ? { stage: input.stage } : {})
    });
    const response = await this.client.searchMemory({
      query,
      target: this.options.target,
      includeContent: input.includeContent ?? true,
      limit: input.limit ?? this.options.recallLimit
    });

    return response.results[0];
  }

  async recallLatestCheckpointRef(
    input: RecallCheckpointInput
  ): Promise<CheckpointRef | undefined> {
    const result = await this.recallLatestCheckpoint(input);
    if (!result) {
      return undefined;
    }

    return parseCheckpointRefFromMemoryResult(result);
  }
}

export function buildCheckpointMemoryRecord(
  checkpoint: CheckpointRef,
  options: CodexMemoryAdapterOptions
): CheckpointMemoryRecord {
  const target = options.target ?? "process";
  const sensitivity = options.sensitivity ?? "internal";
  const reusable = options.reusable ?? true;
  const validated = options.validated ?? true;
  const tags = serializeTags([
    "codex-router",
    "checkpoint",
    checkpoint.stage,
    checkpoint.taskId,
    ...(options.tags ?? [])
  ]);
  const title = `checkpoint: ${options.anchor} ${checkpoint.taskId} ${checkpoint.stage}`;
  const content = [
    `Checkpoint ID: ${checkpoint.checkpointId}`,
    `Checkpoint anchor: ${options.anchor}`,
    `Task ID: ${checkpoint.taskId}`,
    `Stage conclusion: ${checkpoint.stage}`,
    `Created at: ${checkpoint.createdAt}`,
    `Summary: ${checkpoint.summary}`,
    "Todo/Next: continue from this checkpoint or resolve any blocking gate before new execution."
  ].join("\n");
  const evidence = [
    `Checkpoint ID: ${checkpoint.checkpointId}`,
    `Anchor: ${options.anchor}`,
    `Stage: ${checkpoint.stage}`,
    `Task ID: ${checkpoint.taskId}`,
    `Created at: ${checkpoint.createdAt}`
  ].join("\n");

  return {
    writeInput: {
      target,
      title,
      content,
      evidence,
      reusable,
      sensitivity,
      ...(tags.length > 0 ? { tags } : {}),
      validated
    },
    recallQuery: buildCheckpointRecallQuery({
      anchor: options.anchor,
      taskId: checkpoint.taskId,
      stage: checkpoint.stage
    })
  };
}

export function buildCheckpointRecallQuery(input: {
  anchor: string;
  taskId: string;
  stage?: string;
}): string {
  return [
    input.anchor,
    input.taskId,
    "checkpoint",
    ...(input.stage !== undefined ? [input.stage] : [])
  ].join(" ");
}

export function parseCheckpointRefFromMemoryResult(
  result: CodexMemorySearchResult
): CheckpointRef | undefined {
  const sourceText = [result.content, result.text, result.snippet]
    .filter((value): value is string => Boolean(value))
    .join("\n");

  const taskId = matchField(sourceText, "Task ID");
  const stage = matchField(sourceText, "Stage conclusion");
  const createdAt = matchField(sourceText, "Created at");
  const summary = matchField(sourceText, "Summary");

  if (!taskId || !stage || !createdAt || !summary) {
    return undefined;
  }

  const checkpointId = (
    matchField(sourceText, "Checkpoint ID")
    ?? result.memoryId
    ?? `${taskId}:${stage}:memory`
  );

  return {
    checkpointId,
    taskId,
    stage,
    createdAt,
    summary
  };
}

function serializeTags(tags: string[]): string {
  return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))].join(",");
}

function matchField(text: string, label: string): string | undefined {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = text.match(new RegExp(`^${escapedLabel}:\\s*(.+)$`, "m"));
  return match?.[1]?.trim();
}
