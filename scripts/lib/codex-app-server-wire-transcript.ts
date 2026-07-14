import { createHash } from "node:crypto";
import { open } from "node:fs/promises";
import { isAbsolute } from "node:path";

const SAFE_WIRE_METHODS = new Set([
  "account/chatgptAuthTokens/refresh", "attestation/generate", "currentTime/read",
  "error", "initialize", "initialized", "item/agentMessage/delta",
  "item/autoApprovalReview/completed", "item/autoApprovalReview/started",
  "item/commandExecution/outputDelta", "item/commandExecution/requestApproval",
  "item/commandExecution/terminalInteraction", "item/completed",
  "item/fileChange/outputDelta", "item/fileChange/patchUpdated",
  "item/fileChange/requestApproval", "item/mcpToolCall/progress",
  "item/permissions/requestApproval", "item/plan/delta",
  "item/reasoning/summaryPartAdded", "item/reasoning/summaryTextDelta",
  "item/reasoning/textDelta", "item/started", "item/tool/call",
  "item/tool/requestUserInput", "mcpServer/elicitation/request",
  "mcpServer/startupStatus/updated", "model/rerouted",
  "model/safetyBuffering/updated", "model/verification", "openai/form",
  "remoteControl/status/changed", "serverRequest/resolved", "thread/closed",
  "thread/compacted", "thread/settings/updated", "thread/start",
  "thread/started", "thread/status/changed", "thread/tokenUsage/updated",
  "turn/completed", "turn/diff/updated", "turn/moderationMetadata",
  "turn/plan/updated", "turn/start", "turn/started", "warning"
]);
const SAFE_DECISIONS = new Set([
  "accept", "acceptForSession", "acceptWithExecpolicyAmendment",
  "applyNetworkPolicyAmendment", "cancel", "decline"
]);


export interface SanitizedWireTranscriptEntry {
  schemaVersion: "codex-app-server-sanitized-wire-entry.v1";
  sequence: number;
  observedAt: string;
  direction: "inbound" | "outbound";
  envelope: "notification" | "request" | "response" | "invalid";
  method?: string;
  methodHash?: string;
  requestIdHash?: string;
  correlationHashes: Record<string, string>;
  approvalDecision?: string;
  permissionGrantEmpty?: boolean;
  approvalResponseDisposition?: "decline" | "permission_decline" | "unsafe";
  deliveryConfirmed?: true;
  payloadShapeHash: string;
  stringCodeUnits: number;
  redactedScalarCount: number;
}

export interface SanitizedWireTranscriptEvidenceBinding {
  finalSequence: number;
  transcriptSequenceHash: string;
}

interface ShapeSummary {
  shape: unknown;
  stringCodeUnits: number;
  redactedScalarCount: number;
}

export interface SanitizedWireTranscriptHandle {
  appendFile(data: string, encoding: "utf8"): Promise<unknown>;
  sync(): Promise<unknown>;
  close(): Promise<unknown>;
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

const EMPTY_TRANSCRIPT_SEQUENCE_HASH = sha256("codex-app-server-sanitized-wire-sequence.v1");

function extendTranscriptSequenceHash(
  previousHash: string,
  entry: SanitizedWireTranscriptEntry
): string {
  return sha256(`${previousHash}\n${JSON.stringify(entry)}`);
}

export function createSanitizedWireTranscriptEvidenceBinding(
  entries: readonly SanitizedWireTranscriptEntry[]
): SanitizedWireTranscriptEvidenceBinding {
  let transcriptSequenceHash = EMPTY_TRANSCRIPT_SEQUENCE_HASH;
  for (const entry of entries) {
    transcriptSequenceHash = extendTranscriptSequenceHash(transcriptSequenceHash, entry);
  }
  return {
    finalSequence: entries.at(-1)?.sequence ?? 0,
    transcriptSequenceHash
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function summarizeShape(value: unknown): ShapeSummary {
  let stringCodeUnits = 0;
  let redactedScalarCount = 0;
  let values = 0;
  const seen = new Set<object>();
  const visit = (candidate: unknown, depth: number): unknown => {
    values += 1;
    if (values > 50_000 || depth > 64) throw new Error("wire_transcript_shape_limit_exceeded");
    if (candidate === null) return "null";
    if (typeof candidate === "string") {
      stringCodeUnits += candidate.length;
      redactedScalarCount += 1;
      return "string";
    }
    if (typeof candidate === "number") {
      if (!Number.isFinite(candidate)) throw new Error("wire_transcript_non_json_value");
      redactedScalarCount += 1;
      return "number";
    }
    if (typeof candidate === "boolean") {
      redactedScalarCount += 1;
      return "boolean";
    }
    if (Array.isArray(candidate)) {
      if (seen.has(candidate)) throw new Error("wire_transcript_cycle");
      seen.add(candidate);
      const result = candidate.map((entry) => visit(entry, depth + 1));
      seen.delete(candidate);
      return result;
    }
    if (isRecord(candidate)) {
      if (seen.has(candidate)) throw new Error("wire_transcript_cycle");
      seen.add(candidate);
      const result: Record<string, unknown> = {};
      for (const key of Object.keys(candidate).sort()) {
        const descriptor = Object.getOwnPropertyDescriptor(candidate, key);
        if (descriptor?.get !== undefined || descriptor?.set !== undefined) {
          throw new Error("wire_transcript_accessor_forbidden");
        }
        stringCodeUnits += key.length;
        result[sha256(key).slice(0, 16)] = visit(candidate[key], depth + 1);
      }
      seen.delete(candidate);
      return result;
    }
    throw new Error("wire_transcript_non_json_value");
  };
  return { shape: visit(value, 0), stringCodeUnits, redactedScalarCount };
}

function hashScalar(value: unknown): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  return sha256(String(value));
}

function correlationHashes(message: Record<string, unknown>): Record<string, string> {
  const params = isRecord(message.params) ? message.params : undefined;
  const item = params !== undefined && isRecord(params.item) ? params.item : undefined;
  const output: Record<string, string> = {};
  for (const [name, value] of [
    ["threadId", params?.threadId],
    ["turnId", params?.turnId],
    ["itemId", params?.itemId ?? item?.id]
  ] as const) {
    const hashed = hashScalar(value);
    if (hashed !== undefined) output[name] = hashed;
  }
  return output;
}

export function sanitizeWireTranscriptEntry(input: {
  sequence: number;
  observedAt: string;
  direction: "inbound" | "outbound";
  message: unknown;
  deliveryConfirmed?: true;
}): SanitizedWireTranscriptEntry {
  const summary = summarizeShape(input.message);
  const message = isRecord(input.message) ? input.message : undefined;
  const rawMethod = typeof message?.method === "string" ? message.method : undefined;
  const method = rawMethod !== undefined && SAFE_WIRE_METHODS.has(rawMethod)
    ? rawMethod
    : undefined;
  const methodHash = rawMethod === undefined ? undefined : sha256(rawMethod);
  const idHash = message === undefined ? undefined : hashScalar(message.id);
  const hasResult = message !== undefined && Object.hasOwn(message, "result");
  const hasError = message !== undefined && Object.hasOwn(message, "error");
  const envelope = message === undefined
    ? "invalid"
    : rawMethod !== undefined && idHash !== undefined
      ? "request"
      : rawMethod !== undefined
        ? "notification"
        : idHash !== undefined && (hasResult || hasError)
          ? "response"
          : "invalid";
  const result = message !== undefined && isRecord(message.result) ? message.result : undefined;
  const resultKeys = result === undefined ? [] : Object.keys(result).sort();
  const decision = resultKeys.length === 1
    && resultKeys[0] === "decision"
    && typeof result?.decision === "string"
    && SAFE_DECISIONS.has(result.decision)
    ? result.decision
    : undefined;
  const permissionGrantEmpty = result !== undefined
    && resultKeys.length === 2
    && resultKeys[0] === "permissions"
    && resultKeys[1] === "scope"
    && isRecord(result.permissions)
    && Object.keys(result.permissions).length === 0
    && result.scope === "turn";
  const approvalResponseDisposition = result !== undefined && Object.hasOwn(result, "decision")
    ? decision === "decline" ? "decline" : "unsafe"
    : result !== undefined && (Object.hasOwn(result, "permissions") || Object.hasOwn(result, "scope"))
      ? permissionGrantEmpty ? "permission_decline" : "unsafe"
      : undefined;
  return {
    schemaVersion: "codex-app-server-sanitized-wire-entry.v1",
    sequence: input.sequence,
    observedAt: input.observedAt,
    direction: input.direction,
    envelope,
    ...(method === undefined ? {} : { method }),
    ...(methodHash === undefined ? {} : { methodHash }),
    ...(idHash === undefined ? {} : { requestIdHash: idHash }),
    correlationHashes: message === undefined ? {} : correlationHashes(message),
    ...(decision === undefined ? {} : { approvalDecision: decision }),
    ...(permissionGrantEmpty ? { permissionGrantEmpty: true } : {}),
    ...(approvalResponseDisposition === undefined ? {} : { approvalResponseDisposition }),
    ...(input.deliveryConfirmed === true ? { deliveryConfirmed: true } : {}),
    payloadShapeHash: sha256(JSON.stringify(summary.shape)),
    stringCodeUnits: summary.stringCodeUnits,
    redactedScalarCount: summary.redactedScalarCount
  };
}

export class SanitizedWireTranscriptRecorder {
  private sequence = 0;
  private closed = false;
  private pending: Promise<void> = Promise.resolve();
  private persistenceFailed = false;
  private persistenceFailure: unknown;
  private constructor(
    private readonly handle: SanitizedWireTranscriptHandle,
    private readonly clock: () => Date
  ) {}

  static async create(path: string, clock: () => Date = () => new Date()): Promise<SanitizedWireTranscriptRecorder> {
    if (!isAbsolute(path)) throw new Error("wire_transcript_path_must_be_absolute");
    return new SanitizedWireTranscriptRecorder(await open(path, "wx", 0o600), clock);
  }

  static createTestOnly(
    handle: SanitizedWireTranscriptHandle,
    clock: () => Date = () => new Date()
  ): SanitizedWireTranscriptRecorder {
    return new SanitizedWireTranscriptRecorder(handle, clock);
  }

  async record(direction: "inbound" | "outbound", message: unknown): Promise<SanitizedWireTranscriptEntry> {
    return this.enqueue(direction, message, false);
  }

  async recordDelivery(message: unknown): Promise<SanitizedWireTranscriptEntry> {
    return this.enqueue("outbound", message, true);
  }

  private async enqueue(
    direction: "inbound" | "outbound",
    message: unknown,
    deliveryConfirmed: boolean
  ): Promise<SanitizedWireTranscriptEntry> {
    if (this.closed) throw new Error("wire_transcript_closed");
    const entry = sanitizeWireTranscriptEntry({
      sequence: ++this.sequence,
      observedAt: this.clock().toISOString(),
      direction,
      message,
      ...(deliveryConfirmed ? { deliveryConfirmed: true } : {})
    });
    const operation = this.pending.then(async () => {
      if (this.persistenceFailed) throw this.persistenceFailure;
      try {
        await this.handle.appendFile(`${JSON.stringify(entry)}\n`, "utf8");
        await this.handle.sync();
      } catch (error) {
        this.persistenceFailed = true;
        this.persistenceFailure = error;
        throw error;
      }
    });
    this.pending = operation.then(
      () => undefined,
      () => undefined
    );
    await operation;
    return entry;
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    try {
      await this.pending;
      if (this.persistenceFailed) throw this.persistenceFailure;
      await this.handle.sync();
    } finally {
      await this.handle.close();
    }
  }
}

export interface AppServerWireTranscriptSink {
  record(
    direction: "inbound" | "outbound",
    message: unknown
  ): Promise<SanitizedWireTranscriptEntry>;
  recordDelivery(message: unknown): Promise<SanitizedWireTranscriptEntry>;
}

export class RecordedAppServerWireBoundary {
  private transcriptSequenceHash = EMPTY_TRANSCRIPT_SEQUENCE_HASH;
  private finalSequence = 0;

  constructor(private readonly transcript: AppServerWireTranscriptSink) {}

  private retain(entry: SanitizedWireTranscriptEntry): void {
    this.transcriptSequenceHash = extendTranscriptSequenceHash(this.transcriptSequenceHash, entry);
    this.finalSequence = entry.sequence;
  }

  evidenceBinding(): SanitizedWireTranscriptEvidenceBinding {
    return {
      finalSequence: this.finalSequence,
      transcriptSequenceHash: this.transcriptSequenceHash
    };
  }

  async ingest<T>(message: unknown, normalize: (message: unknown) => Promise<T> | T): Promise<T> {
    this.retain(await this.transcript.record("inbound", message));
    return normalize(message);
  }

  async send<T>(message: unknown, transportSend: (message: unknown) => Promise<T> | T): Promise<T> {
    this.retain(await this.transcript.record("outbound", message));
    const result = await transportSend(message);
    this.retain(await this.transcript.recordDelivery(message));
    return result;
  }
}
