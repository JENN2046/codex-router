import type {
  CodexAdapterOutcome,
  CodexAppServerApprovalResponse,
  CodexAppServerV2HandshakeResult,
  CodexAppServerV2WireAdapterResult,
  CodexAppServerV2WireApprovalResponse
} from "../../packages/codex-adapter/src/index.js";
import {
  createSanitizedWireTranscriptEvidenceBinding,
  RecordedAppServerWireBoundary,
  type SanitizedWireTranscriptEntry
} from "./codex-app-server-wire-transcript.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const APPROVAL_REQUEST_METHODS = new Set([
  "item/commandExecution/requestApproval",
  "item/fileChange/requestApproval",
  "item/permissions/requestApproval"
]);

export interface OfflineApprovalInterceptionProof {
  schemaVersion: "codex-app-server-offline-interception-proof.v1";
  status: "passed" | "blocked";
  approvalRequestCount: number;
  declineResponseCount: number;
  harnessOrderingProven: boolean;
  appServerApplyTimingProven: false;
  liveSmokeEligible: false;
  transcriptSequenceHash: string;
  reasons: string[];
}

export interface OfflineDeclineOnlyHarnessTerminalOutcome {
  status: "completed" | "blocked";
  handshakeComplete: boolean;
  disconnectObserved: boolean;
  transcriptFinalSequence: number;
  transcriptSequenceHash: string;
  reasons: string[];
}

export function evaluateOfflineApprovalInterceptionProof(
  entries: readonly SanitizedWireTranscriptEntry[],
  terminalOutcome: OfflineDeclineOnlyHarnessTerminalOutcome | undefined
): OfflineApprovalInterceptionProof {
  const reasons = new Set<string>();
  const requests = new Map<string, SanitizedWireTranscriptEntry>();
  const responseAttempts = new Map<string, SanitizedWireTranscriptEntry>();
  const responses = new Map<string, SanitizedWireTranscriptEntry>();
  const outboundResponses: SanitizedWireTranscriptEntry[] = [];
  let previousSequence = 0;
  if (terminalOutcome === undefined) reasons.add("offline_harness_terminal_outcome_missing");
  else {
    if (terminalOutcome.status !== "completed") reasons.add("offline_harness_terminal_outcome_blocked");
    if (!terminalOutcome.handshakeComplete) reasons.add("offline_harness_handshake_incomplete");
    if (!terminalOutcome.disconnectObserved) reasons.add("offline_harness_disconnect_missing");
    if (terminalOutcome.reasons.length > 0) reasons.add("offline_harness_terminal_reasons_present");
    const transcriptBinding = createSanitizedWireTranscriptEvidenceBinding(entries);
    if (
      terminalOutcome.transcriptFinalSequence !== transcriptBinding.finalSequence
      || terminalOutcome.transcriptSequenceHash !== transcriptBinding.transcriptSequenceHash
    ) {
      reasons.add("offline_harness_transcript_binding_mismatch");
    }
  }
  for (const entry of entries) {
    if (entry.sequence !== previousSequence + 1) reasons.add("offline_transcript_sequence_invalid");
    previousSequence = entry.sequence;
    if (entry.direction === "outbound" && entry.approvalResponseDisposition === "unsafe") {
      reasons.add("offline_transcript_non_decline_response");
    }
    if (entry.direction === "outbound" && entry.envelope === "response") {
      outboundResponses.push(entry);
    }
    if (
      entry.direction === "inbound"
      && entry.envelope === "request"
      && entry.method !== undefined
      && APPROVAL_REQUEST_METHODS.has(entry.method)
    ) {
      if (entry.requestIdHash === undefined || requests.has(entry.requestIdHash)) {
        reasons.add("offline_approval_request_identity_invalid");
      } else {
        requests.set(entry.requestIdHash, entry);
      }
    }
    if (
      entry.direction === "outbound"
      && entry.envelope === "response"
      && (entry.approvalDecision === "decline" || entry.permissionGrantEmpty === true)
    ) {
      const target = entry.deliveryConfirmed === true ? responses : responseAttempts;
      if (entry.requestIdHash === undefined || target.has(entry.requestIdHash)) {
        reasons.add("offline_decline_response_identity_invalid");
      } else {
        target.set(entry.requestIdHash, entry);
      }
    }
  }
  if (requests.size === 0) reasons.add("offline_approval_request_missing");
  for (const response of outboundResponses) {
    const request = response.requestIdHash === undefined
      ? undefined
      : requests.get(response.requestIdHash);
    if (request === undefined) {
      reasons.add("offline_orphan_outbound_response");
      continue;
    }
    const expectedDisposition = request.method === "item/permissions/requestApproval"
      ? "permission_decline"
      : "decline";
    if (response.approvalResponseDisposition !== expectedDisposition) {
      reasons.add("offline_transcript_non_decline_response");
    }
  }
  for (const [requestIdHash, request] of requests) {
    const attempt = responseAttempts.get(requestIdHash);
    const response = responses.get(requestIdHash);
    if (attempt === undefined) reasons.add("offline_decline_attempt_missing");
    if (response === undefined) {
      reasons.add("offline_decline_response_missing");
      continue;
    }
    if (
      attempt === undefined
      || attempt.sequence <= request.sequence
      || response.sequence <= attempt.sequence
    ) {
      reasons.add("offline_decline_order_invalid");
    }
    const permissionRequest = request.method === "item/permissions/requestApproval";
    if (
      permissionRequest
      && (attempt?.permissionGrantEmpty !== true || response.permissionGrantEmpty !== true)
    ) {
      reasons.add("offline_permission_decline_invalid");
    }
    if (
      !permissionRequest
      && (attempt?.approvalDecision !== "decline" || response.approvalDecision !== "decline")
    ) {
      reasons.add("offline_approval_decline_invalid");
    }
  }
  for (const requestIdHash of responseAttempts.keys()) {
    if (!requests.has(requestIdHash)) reasons.add("offline_orphan_decline_attempt");
  }
  for (const requestIdHash of responses.keys()) {
    if (!requests.has(requestIdHash) || !responseAttempts.has(requestIdHash)) {
      reasons.add("offline_orphan_decline_response");
    }
  }
  const reasonList = [...reasons].sort();
  return {
    schemaVersion: "codex-app-server-offline-interception-proof.v1",
    status: reasonList.length === 0 ? "passed" : "blocked",
    approvalRequestCount: requests.size,
    declineResponseCount: responses.size,
    harnessOrderingProven: reasonList.length === 0,
    appServerApplyTimingProven: false,
    liveSmokeEligible: false,
    transcriptSequenceHash: createSanitizedWireTranscriptEvidenceBinding(entries).transcriptSequenceHash,
    reasons: reasonList
  };
}

interface DeclineOnlyWireNormalizer {
  encodeApprovalResponse(response: CodexAppServerApprovalResponse):
    | { status: "encoded"; message: CodexAppServerV2WireApprovalResponse }
    | { status: "blocked"; reasons: string[] };
  markApprovalResponseDeliveryUncertain(requestId: string): void;
}

export class RecordedDeclineOnlyAppServerV2WireTransport {
  private readonly deliveredDeclines = new Set<string>();

  constructor(private readonly options: {
    normalizer: DeclineOnlyWireNormalizer;
    boundary: RecordedAppServerWireBoundary;
    send: (message: CodexAppServerV2WireApprovalResponse) => Promise<void>;
  }) {}

  async send(message: CodexAppServerApprovalResponse): Promise<void> {
    if (
      message.decision !== "decline"
      || message.permissionGrant !== undefined
      || (
        message.commandDecision !== undefined
        && message.commandDecision !== "decline"
      )
    ) {
      throw new Error("decline_only_transport_non_decline_forbidden");
    }
    const encoded = this.options.normalizer.encodeApprovalResponse(message);
    if (encoded.status === "blocked") throw new Error(encoded.reasons.join(","));
    const result = encoded.message.result;
    const safeDecline = "decision" in result
      ? result.decision === "decline"
      : Object.keys(result.permissions).length === 0 && result.scope === "turn";
    if (!safeDecline) throw new Error("decline_only_transport_wire_response_unsafe");
    try {
      await this.options.boundary.send(
        encoded.message,
        () => this.options.send(encoded.message)
      );
      this.deliveredDeclines.add(message.requestId);
    } catch (error) {
      this.options.normalizer.markApprovalResponseDeliveryUncertain(message.requestId);
      throw error;
    }
  }

  hasDeliveredDecline(requestId: string): boolean {
    return this.deliveredDeclines.has(requestId);
  }
}

interface DeclineOnlyWireAdapter {
  acceptInitializeResponse(input: unknown): Promise<CodexAppServerV2HandshakeResult>;
  acceptInitializedNotification(input: unknown): Promise<CodexAppServerV2HandshakeResult>;
  ingest(input: unknown): Promise<CodexAppServerV2WireAdapterResult>;
  disconnect(reason?: string): Promise<CodexAppServerV2WireAdapterResult>;
}

interface DeclineOnlyApprovalResolver {
  resolveHumanApproval(input: {
    requestId: string;
    decision: "decline";
    operatorId: string;
    commandDecision?: "decline";
  }): Promise<CodexAdapterOutcome>;
}

export type DeclineOnlyHarnessIngestResult =
  | {
      status: "processed" | "declined";
      wireResult: CodexAppServerV2WireAdapterResult;
      declineOutcome?: CodexAdapterOutcome;
    }
  | { status: "blocked"; reasons: string[] };

export class OfflineDeclineOnlyAppServerHarness {
  private stopped = false;
  private disconnectNotified = false;
  private initializeSent = false;
  private initializeResponseAccepted = false;
  private initializedSent = false;
  private terminalOutcomeValue: OfflineDeclineOnlyHarnessTerminalOutcome | undefined;
  private serialTail: Promise<void> = Promise.resolve();

  constructor(private readonly options: {
    boundary: RecordedAppServerWireBoundary;
    wireAdapter: DeclineOnlyWireAdapter;
    approvalResolver: DeclineOnlyApprovalResolver;
    transport: RecordedDeclineOnlyAppServerV2WireTransport;
    operatorId: string;
    sendControl: (message: unknown) => Promise<void>;
    stop: () => Promise<void>;
  }) {
    if (options.operatorId.trim() === "") throw new Error("decline_only_operator_id_invalid");
  }

  sendInitializeRequest(input: unknown): Promise<void> {
    return this.serialize(async () => {
      this.assertActive();
      if (
        this.initializeSent
        || !isRecord(input)
        || input.method !== "initialize"
        || (typeof input.id !== "string" && typeof input.id !== "number")
      ) {
        await this.stop("decline_only_initialize_request_invalid");
        throw new Error("decline_only_initialize_request_invalid");
      }
      try {
        await this.options.boundary.send(input, this.options.sendControl);
        this.initializeSent = true;
      } catch (error) {
        await this.stop("decline_only_initialize_send_failed");
        throw error;
      }
    });
  }

  acceptInitializeResponse(input: unknown): Promise<CodexAppServerV2HandshakeResult> {
    return this.serialize(async () => {
      this.assertActive();
      if (!this.initializeSent) {
        await this.stop("decline_only_initialize_request_missing");
        return { status: "blocked", reasons: ["decline_only_initialize_request_missing"] };
      }
      let result: CodexAppServerV2HandshakeResult;
      try {
        result = await this.options.boundary.ingest(
          input,
          () => this.options.wireAdapter.acceptInitializeResponse(input)
        );
      } catch (error) {
        await this.stop("decline_only_initialize_record_failed");
        throw error;
      }
      if (result.status === "blocked") await this.stop("decline_only_initialize_blocked");
      else this.initializeResponseAccepted = true;
      return result;
    });
  }

  sendInitializedNotification(input: unknown): Promise<CodexAppServerV2HandshakeResult> {
    return this.serialize(async () => {
      this.assertActive();
      if (!this.initializeResponseAccepted || this.initializedSent) {
        await this.stop("decline_only_initialized_notification_unexpected");
        return { status: "blocked", reasons: ["decline_only_initialized_notification_unexpected"] };
      }
      let result: CodexAppServerV2HandshakeResult;
      let blockedResult: CodexAppServerV2HandshakeResult | undefined;
      try {
        result = await this.options.boundary.send(
          input,
          async (message) => {
            const normalized = await this.options.wireAdapter.acceptInitializedNotification(message);
            if (normalized.status === "blocked") {
              blockedResult = normalized;
              throw new Error("decline_only_initialized_blocked");
            }
            await this.options.sendControl(message);
            return normalized;
          }
        );
      } catch (error) {
        if (blockedResult !== undefined) {
          await this.stop("decline_only_initialized_blocked");
          return blockedResult;
        }
        await this.stop("decline_only_initialized_record_failed");
        throw error;
      }
      this.initializedSent = true;
      return result;
    });
  }

  ingest(input: unknown): Promise<DeclineOnlyHarnessIngestResult> {
    return this.serialize(async () => {
      this.assertActive();
      let wireResult: CodexAppServerV2WireAdapterResult;
      try {
        wireResult = await this.options.boundary.ingest(
          input,
          () => this.options.wireAdapter.ingest(input)
        );
      } catch {
        return this.block("decline_only_ingest_failed");
      }
      if (wireResult.status === "passthrough") {
        return this.block("decline_only_passthrough_requires_owner");
      }
      if (wireResult.status === "blocked" || wireResult.status === "disconnected") {
        return this.block(...wireResult.reasons);
      }
      if (
        wireResult.status !== "normalized"
        || wireResult.normalization.event.eventType !== "approval_requested"
      ) {
        return { status: "processed", wireResult };
      }
      const requestId = wireResult.normalization.event.requestId;
      if (!this.options.transport.hasDeliveredDecline(requestId)) {
        if (wireResult.outcome.status !== "manual_required") {
          return this.block("decline_only_approval_not_manual_or_declined");
        }
        const proposal = wireResult.normalization.event.proposal;
        const commandDecision = proposal.kind === "command" || proposal.kind === "network"
          ? { commandDecision: "decline" as const }
          : {};
        let declineOutcome: CodexAdapterOutcome;
        try {
          declineOutcome = await this.options.approvalResolver.resolveHumanApproval({
            requestId,
            decision: "decline",
            operatorId: this.options.operatorId,
            ...commandDecision
          });
        } catch {
          return this.block("decline_only_resolution_failed");
        }
        if (
          declineOutcome.status !== "blocked"
          || !declineOutcome.reasons.includes("operator_declined")
          || !this.options.transport.hasDeliveredDecline(requestId)
        ) {
          if (declineOutcome.reasons.includes("human_command_decision_not_advertised")) {
            return this.block("decline_only_safe_decision_unavailable");
          }
          return this.block("decline_only_response_not_delivered");
        }
        return { status: "declined", wireResult, declineOutcome };
      }
      return { status: "declined", wireResult };
    });
  }

  disconnect(reason = "decline_only_client_disconnected"): Promise<CodexAppServerV2WireAdapterResult> {
    return this.serialize(async () => {
      if (this.disconnectNotified) {
        throw new Error("decline_only_harness_stopped");
      }
      this.stopped = true;
      this.disconnectNotified = true;
      let disconnectObserved = false;
      let result: CodexAppServerV2WireAdapterResult | undefined;
      let disconnectError: unknown;
      try {
        result = await this.options.wireAdapter.disconnect(reason);
        disconnectObserved = result.status === "disconnected";
      } catch (error) {
        disconnectError = error;
      }
      let stopError: unknown;
      try {
        await this.options.stop();
      } catch (error) {
        stopError = error;
      }
      if (disconnectError !== undefined || stopError !== undefined || result === undefined) {
        const transcriptBinding = this.options.boundary.evidenceBinding();
        this.terminalOutcomeValue = {
          status: "blocked",
          handshakeComplete: this.initializeSent && this.initializeResponseAccepted && this.initializedSent,
          disconnectObserved,
          transcriptFinalSequence: transcriptBinding.finalSequence,
          transcriptSequenceHash: transcriptBinding.transcriptSequenceHash,
          reasons: [disconnectError !== undefined
            ? "decline_only_disconnect_failed"
            : "decline_only_stop_failed"]
        };
        throw disconnectError ?? stopError ?? new Error("decline_only_disconnect_failed");
      }
      if (result.status !== "disconnected") {
        const transcriptBinding = this.options.boundary.evidenceBinding();
        const resultReasons = "reasons" in result
          ? result.reasons
          : [`decline_only_disconnect_status_${result.status}`];
        this.terminalOutcomeValue = {
          status: "blocked",
          handshakeComplete: this.initializeSent && this.initializeResponseAccepted && this.initializedSent,
          disconnectObserved: false,
          transcriptFinalSequence: transcriptBinding.finalSequence,
          transcriptSequenceHash: transcriptBinding.transcriptSequenceHash,
          reasons: [...new Set(["decline_only_disconnect_blocked", ...resultReasons])]
        };
        return result;
      }
      const transcriptBinding = this.options.boundary.evidenceBinding();
      this.terminalOutcomeValue = {
        status: "completed",
        handshakeComplete: this.initializeSent && this.initializeResponseAccepted && this.initializedSent,
        disconnectObserved: true,
        transcriptFinalSequence: transcriptBinding.finalSequence,
        transcriptSequenceHash: transcriptBinding.transcriptSequenceHash,
        reasons: []
      };
      return result;
    });
  }

  terminalOutcome(): OfflineDeclineOnlyHarnessTerminalOutcome | undefined {
    return this.terminalOutcomeValue === undefined
      ? undefined
      : { ...this.terminalOutcomeValue, reasons: [...this.terminalOutcomeValue.reasons] };
  }

  private async block(...reasons: string[]): Promise<Extract<DeclineOnlyHarnessIngestResult, { status: "blocked" }>> {
    await this.stop(reasons[0] ?? "decline_only_blocked");
    return { status: "blocked", reasons: [...new Set(reasons)] };
  }

  private async stop(reason: string): Promise<void> {
    if (this.disconnectNotified) return;
    this.stopped = true;
    this.disconnectNotified = true;
    let disconnectObserved = false;
    try {
      const result = await this.options.wireAdapter.disconnect(reason);
      disconnectObserved = result.status === "disconnected";
    } finally {
      const transcriptBinding = this.options.boundary.evidenceBinding();
      this.terminalOutcomeValue = {
        status: "blocked",
        handshakeComplete: this.initializeSent && this.initializeResponseAccepted && this.initializedSent,
        disconnectObserved,
        transcriptFinalSequence: transcriptBinding.finalSequence,
        transcriptSequenceHash: transcriptBinding.transcriptSequenceHash,
        reasons: [reason]
      };
      await this.options.stop();
    }
  }

  private assertActive(): void {
    if (this.stopped) throw new Error("decline_only_harness_stopped");
  }

  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.serialTail.then(operation, operation);
    this.serialTail = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }
}
