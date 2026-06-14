import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { PreflightResult } from "../../preflight/src/index.js";
import { createSafeAuditDetails } from "../../redaction/src/index.js";

export interface LogEvent {
  level: "info" | "warn" | "error";
  message: string;
  correlationId: string;
  context?: Record<string, unknown>;
}

export interface TelemetrySink {
  record(event: LogEvent): Promise<void> | void;
}

export interface RecordingTelemetrySink extends TelemetrySink {
  events: LogEvent[];
  loadAll(): Promise<LogEvent[]>;
}

export interface TelemetryDeliveryMetricsSnapshotTotals {
  events: number;
  targetedSinks: number;
  attempts: number;
  successes: number;
  failures: number;
  timeouts: number;
  retries: number;
}

export interface TelemetryDeliverySinkMetricsSnapshot {
  sinkIndex: number;
  sinkLabel?: string;
  targetedEvents: number;
  attempts: number;
  successes: number;
  failures: number;
  timeouts: number;
  retries: number;
  lastAttemptAt?: string;
  lastSuccessAt?: string;
  lastFailureAt?: string;
  lastError?: string;
}

export interface TelemetryDeliveryMetricsSnapshot {
  totals: TelemetryDeliveryMetricsSnapshotTotals;
  sinks: TelemetryDeliverySinkMetricsSnapshot[];
}

export interface TelemetryAlertDeliveryMetricsSnapshotTotals {
  events: number;
  targetedSinks: number;
  attempts: number;
  successes: number;
  failures: number;
  timeouts: number;
  retries: number;
}

export interface TelemetryAlertDeliverySinkMetricsSnapshot {
  sinkIndex: number;
  sinkLabel?: string;
  targetedEvents: number;
  attempts: number;
  successes: number;
  failures: number;
  timeouts: number;
  retries: number;
  lastAttemptAt?: string;
  lastSuccessAt?: string;
  lastFailureAt?: string;
  lastError?: string;
}

export interface TelemetryAlertDeliveryMetricsSnapshot {
  totals: TelemetryAlertDeliveryMetricsSnapshotTotals;
  sinks: TelemetryAlertDeliverySinkMetricsSnapshot[];
}

export type TelemetryDeliveryAlertMetric =
  | "failures"
  | "timeouts"
  | "retries"
  | "failureRate"
  | "timeoutRate";

export type TelemetryDeliveryAlertLevel = "warn" | "error";

export interface TelemetryDeliveryAlertThresholdValues {
  failures?: number;
  timeouts?: number;
  retries?: number;
  failureRate?: number;
  timeoutRate?: number;
}

export interface TelemetryDeliveryAlertThresholdScope {
  totals?: TelemetryDeliveryAlertThresholdValues;
  perSink?: TelemetryDeliveryAlertThresholdValues;
}

export interface TelemetryDeliveryAlertThresholds {
  warn?: TelemetryDeliveryAlertThresholdScope;
  error?: TelemetryDeliveryAlertThresholdScope;
}

export interface TelemetryDeliveryAlert {
  level: TelemetryDeliveryAlertLevel;
  scope: "totals" | "sink";
  metric: TelemetryDeliveryAlertMetric;
  message: string;
  observed: number;
  threshold: number;
  sinkIndex?: number;
  sinkLabel?: string;
}

export interface TelemetryAlertSink {
  record(alert: TelemetryDeliveryAlert): Promise<void> | void;
}

export interface RecordingTelemetryAlertSink extends TelemetryAlertSink {
  alerts: TelemetryDeliveryAlert[];
  loadAll(): Promise<TelemetryDeliveryAlert[]>;
}

export interface TelemetryDeliveryMetricsCollector {
  recordEventDispatch(context: { sinkCount: number }): Promise<void> | void;
  recordSinkAttempt(context: {
    sinkIndex: number;
    sinkLabel?: string;
    attempt: number;
  }): Promise<void> | void;
  recordSinkSuccess(context: {
    sinkIndex: number;
    sinkLabel?: string;
  }): Promise<void> | void;
  recordSinkFailure(context: {
    sinkIndex: number;
    sinkLabel?: string;
    timedOut: boolean;
    errorMessage: string;
  }): Promise<void> | void;
  loadSnapshot(): Promise<TelemetryDeliveryMetricsSnapshot>;
}

export interface TelemetryAlertDeliveryMetricsCollector {
  recordAlertDispatch(context: { sinkCount: number }): Promise<void> | void;
  recordSinkAttempt(context: {
    sinkIndex: number;
    sinkLabel?: string;
    attempt: number;
  }): Promise<void> | void;
  recordSinkSuccess(context: {
    sinkIndex: number;
    sinkLabel?: string;
  }): Promise<void> | void;
  recordSinkFailure(context: {
    sinkIndex: number;
    sinkLabel?: string;
    timedOut: boolean;
    errorMessage: string;
  }): Promise<void> | void;
  loadSnapshot(): Promise<TelemetryAlertDeliveryMetricsSnapshot>;
}

export interface TelemetryAlertDeliveryWindowPolicy {
  dedupeWindowMs?: number;
  cooldownWindowMs?: number;
}

export type TelemetryAlertDeliverySuppressionReason = "dedupe" | "cooldown";

export interface TelemetryAlertDeliverySuppression {
  reason: TelemetryAlertDeliverySuppressionReason;
  alert: TelemetryDeliveryAlert;
  suppressedAt: string;
  previousDeliveredAt: string;
  key: string;
}

export interface TelemetryAlertDeliveryWindowDecision {
  alert: TelemetryDeliveryAlert;
  shouldDeliver: boolean;
  suppression?: TelemetryAlertDeliverySuppression;
}

export interface TelemetryAlertDeliveryWindowStore {
  evaluate(
    alert: TelemetryDeliveryAlert,
    policy: TelemetryAlertDeliveryWindowPolicy,
    now?: string
  ): Promise<TelemetryAlertDeliveryWindowDecision> | TelemetryAlertDeliveryWindowDecision;
}

export interface RecordingTelemetryAlertDeliveryWindowStore extends TelemetryAlertDeliveryWindowStore {
  loadSuppressions(): Promise<TelemetryAlertDeliverySuppression[]>;
}

export interface TelemetryAlertDeliveryWindowState {
  version: number;
  exactDeliveries: Record<string, string>;
  cooldownDeliveries: Record<string, string>;
  suppressions: TelemetryAlertDeliverySuppression[];
}

export interface PersistedTelemetryAlertDeliveryWindowStoreOptions {
  path: string;
  initialState?: TelemetryAlertDeliveryWindowState;
  now?: () => string;
}

export interface LoggerTelemetryBackend {
  info(message: string, context?: Record<string, unknown>): Promise<void> | void;
  warn(message: string, context?: Record<string, unknown>): Promise<void> | void;
  error(message: string, context?: Record<string, unknown>): Promise<void> | void;
}

export interface TelemetryAlertTracingBackend {
  addEvent(
    name: string,
    attributes?: Record<string, unknown>
  ): Promise<void> | void;
}

export type TelemetryAlertMetricTagValue = string | number | boolean;

export interface TelemetryAlertMetricsBackend {
  increment(
    metricName: string,
    value?: number,
    tags?: Record<string, TelemetryAlertMetricTagValue>
  ): Promise<void> | void;
}

export interface LoggerTelemetryAlertSinkOptions {
  baseContext?: Record<string, unknown>;
}

export interface TracingTelemetryAlertSinkOptions {
  eventName?: string;
  baseAttributes?: Record<string, unknown>;
}

export interface MetricsTelemetryAlertSinkOptions {
  metricName?: string;
  baseTags?: Record<string, TelemetryAlertMetricTagValue>;
}

export type TelemetryFanoutFailurePolicy = "fail_fast" | "best_effort";

export interface FanoutTelemetrySinkEntry {
  sink: TelemetrySink;
  label?: string;
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
}

export interface FanoutTelemetrySinkErrorContext {
  sinkIndex: number;
  sinkLabel?: string;
  event: LogEvent;
  error: unknown;
  attempt: number;
  maxAttempts: number;
  timedOut: boolean;
  willRetry: boolean;
}

export interface FanoutTelemetrySinkOptions {
  failurePolicy?: TelemetryFanoutFailurePolicy;
  defaultTimeoutMs?: number;
  defaultRetries?: number;
  defaultRetryDelayMs?: number;
  metricsCollector?: TelemetryDeliveryMetricsCollector;
  onSinkError?: (
    context: FanoutTelemetrySinkErrorContext
  ) => Promise<void> | void;
}

export interface FanoutTelemetryAlertSinkEntry {
  sink: TelemetryAlertSink;
  label?: string;
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
}

export interface FanoutTelemetryAlertSinkErrorContext {
  sinkIndex: number;
  sinkLabel?: string;
  alert: TelemetryDeliveryAlert;
  error: unknown;
  attempt: number;
  maxAttempts: number;
  timedOut: boolean;
  willRetry: boolean;
}

export interface FanoutTelemetryAlertSinkOptions {
  failurePolicy?: TelemetryFanoutFailurePolicy;
  defaultTimeoutMs?: number;
  defaultRetries?: number;
  defaultRetryDelayMs?: number;
  metricsCollector?: TelemetryAlertDeliveryMetricsCollector;
  onSinkError?: (
    context: FanoutTelemetryAlertSinkErrorContext
  ) => Promise<void> | void;
}

export function createCorrelationId(): string {
  return randomUUID();
}

export function createLogEvent(
  level: LogEvent["level"],
  message: string,
  context?: Record<string, unknown>
): LogEvent {
  const event: LogEvent = {
    level,
    message,
    correlationId: createCorrelationId()
  };

  if (context) {
    event.context = createSafeAuditDetails(context);
  }

  return event;
}

export function sanitizeLogEvent(event: LogEvent): LogEvent {
  if (!event.context) {
    return { ...event };
  }

  return {
    ...event,
    context: createSafeAuditDetails(event.context)
  };
}

export function createPreflightLogEvent(
  result: PreflightResult,
  context?: Record<string, unknown>
): LogEvent {
  const level = result.ok
    ? result.memory.status === "degraded"
      ? "warn"
      : "info"
    : "error";

  const message = result.ok
    ? `preflight passed (memory=${result.memory.status})`
    : `preflight failed (memory=${result.memory.status})`;

  return createLogEvent(level, message, {
    ok: result.ok,
    errors: result.errors,
    warnings: result.warnings,
    memory: result.memory,
    ...context
  });
}

export function createMemoryPreflightLogEvent(
  result: PreflightResult["memory"],
  context?: Record<string, unknown>
): LogEvent {
  const level = result.status === "blocked"
    ? "error"
    : result.status === "degraded"
      ? "warn"
      : "info";

  return createLogEvent(level, `memory preflight ${result.status}`, {
    memory: result,
    ...context
  });
}

export function createRecordingTelemetrySink(
  initialEvents: LogEvent[] = []
): RecordingTelemetrySink {
  const events = initialEvents.map(sanitizeLogEvent);

  return {
    events,
    async record(event: LogEvent): Promise<void> {
      events.push(sanitizeLogEvent(event));
    },
    async loadAll(): Promise<LogEvent[]> {
      return [...events];
    }
  };
}

export function createRecordingTelemetryAlertSink(
  initialAlerts: TelemetryDeliveryAlert[] = []
): RecordingTelemetryAlertSink {
  const alerts = [...initialAlerts];

  return {
    alerts,
    async record(alert: TelemetryDeliveryAlert): Promise<void> {
      alerts.push(alert);
    },
    async loadAll(): Promise<TelemetryDeliveryAlert[]> {
      return [...alerts];
    }
  };
}

export function createLoggerTelemetrySink(
  backend: LoggerTelemetryBackend
): TelemetrySink {
  return {
    async record(event: LogEvent): Promise<void> {
      const sanitized = sanitizeLogEvent(event);
      const context = sanitized.context;

      switch (sanitized.level) {
        case "warn":
          await backend.warn(sanitized.message, context);
          return;
        case "error":
          await backend.error(sanitized.message, context);
          return;
        case "info":
        default:
          await backend.info(sanitized.message, context);
      }
    }
  };
}

export function createLoggerTelemetryAlertSink(
  backend: LoggerTelemetryBackend,
  options: LoggerTelemetryAlertSinkOptions = {}
): TelemetryAlertSink {
  return {
    async record(alert: TelemetryDeliveryAlert): Promise<void> {
      const context = createTelemetryDeliveryAlertContext(
        alert,
        options.baseContext
      );

      if (alert.level === "error") {
        await backend.error(alert.message, context);
        return;
      }

      await backend.warn(alert.message, context);
    }
  };
}

export function createTracingTelemetryAlertSink(
  backend: TelemetryAlertTracingBackend,
  options: TracingTelemetryAlertSinkOptions = {}
): TelemetryAlertSink {
  const eventName = options.eventName ?? "telemetry_delivery_alert";

  return {
    async record(alert: TelemetryDeliveryAlert): Promise<void> {
      await backend.addEvent(
        eventName,
        createTelemetryDeliveryAlertContext(alert, options.baseAttributes)
      );
    }
  };
}

export function createMetricsTelemetryAlertSink(
  backend: TelemetryAlertMetricsBackend,
  options: MetricsTelemetryAlertSinkOptions = {}
): TelemetryAlertSink {
  const metricName = options.metricName ?? "codex_router.telemetry_delivery_alert";

  return {
    async record(alert: TelemetryDeliveryAlert): Promise<void> {
      await backend.increment(metricName, 1, sanitizeTelemetryAlertMetricTags({
        level: alert.level,
        scope: alert.scope,
        metric: alert.metric,
        ...(alert.sinkIndex !== undefined ? { sinkIndex: alert.sinkIndex } : {}),
        ...(alert.sinkLabel !== undefined ? { sinkLabel: alert.sinkLabel } : {}),
        ...(options.baseTags ?? {})
      }));
    }
  };
}

export function createRecordingTelemetryDeliveryMetricsCollector(): TelemetryDeliveryMetricsCollector {
  const totals: TelemetryDeliveryMetricsSnapshotTotals = {
    events: 0,
    targetedSinks: 0,
    attempts: 0,
    successes: 0,
    failures: 0,
    timeouts: 0,
    retries: 0
  };
  const sinks = new Map<number, TelemetryDeliverySinkMetricsSnapshot>();

  return {
    async recordEventDispatch({ sinkCount }): Promise<void> {
      totals.events += 1;
      totals.targetedSinks += sinkCount;
    },
    async recordSinkAttempt(context): Promise<void> {
      const sink = ensureSinkMetrics(sinks, context.sinkIndex, context.sinkLabel);
      sink.attempts += 1;
      sink.lastAttemptAt = new Date().toISOString();
      totals.attempts += 1;

      if (context.attempt === 1) {
        sink.targetedEvents += 1;
        return;
      }

      sink.retries += 1;
      totals.retries += 1;
    },
    async recordSinkSuccess(context): Promise<void> {
      const sink = ensureSinkMetrics(sinks, context.sinkIndex, context.sinkLabel);
      sink.successes += 1;
      sink.lastSuccessAt = new Date().toISOString();
      totals.successes += 1;
    },
    async recordSinkFailure(context): Promise<void> {
      const sink = ensureSinkMetrics(sinks, context.sinkIndex, context.sinkLabel);
      sink.failures += 1;
      sink.lastFailureAt = new Date().toISOString();
      sink.lastError = context.errorMessage;
      totals.failures += 1;

      if (context.timedOut) {
        sink.timeouts += 1;
        totals.timeouts += 1;
      }
    },
    async loadSnapshot(): Promise<TelemetryDeliveryMetricsSnapshot> {
      return {
        totals: { ...totals },
        sinks: [...sinks.values()]
          .sort((left, right) => left.sinkIndex - right.sinkIndex)
          .map((sink) => ({
            ...sink
          }))
      };
    }
  };
}

export function createRecordingTelemetryAlertDeliveryMetricsCollector(): TelemetryAlertDeliveryMetricsCollector {
  const totals: TelemetryAlertDeliveryMetricsSnapshotTotals = {
    events: 0,
    targetedSinks: 0,
    attempts: 0,
    successes: 0,
    failures: 0,
    timeouts: 0,
    retries: 0
  };
  const sinks = new Map<number, TelemetryAlertDeliverySinkMetricsSnapshot>();

  return {
    async recordAlertDispatch({ sinkCount }): Promise<void> {
      totals.events += 1;
      totals.targetedSinks += sinkCount;
    },
    async recordSinkAttempt(context): Promise<void> {
      const sink = ensureAlertSinkMetrics(sinks, context.sinkIndex, context.sinkLabel);
      sink.attempts += 1;
      sink.lastAttemptAt = new Date().toISOString();
      totals.attempts += 1;

      if (context.attempt === 1) {
        sink.targetedEvents += 1;
        return;
      }

      sink.retries += 1;
      totals.retries += 1;
    },
    async recordSinkSuccess(context): Promise<void> {
      const sink = ensureAlertSinkMetrics(sinks, context.sinkIndex, context.sinkLabel);
      sink.successes += 1;
      sink.lastSuccessAt = new Date().toISOString();
      totals.successes += 1;
    },
    async recordSinkFailure(context): Promise<void> {
      const sink = ensureAlertSinkMetrics(sinks, context.sinkIndex, context.sinkLabel);
      sink.failures += 1;
      sink.lastFailureAt = new Date().toISOString();
      sink.lastError = context.errorMessage;
      totals.failures += 1;

      if (context.timedOut) {
        sink.timeouts += 1;
        totals.timeouts += 1;
      }
    },
    async loadSnapshot(): Promise<TelemetryAlertDeliveryMetricsSnapshot> {
      return {
        totals: { ...totals },
        sinks: [...sinks.values()]
          .sort((left, right) => left.sinkIndex - right.sinkIndex)
          .map((sink) => ({
            ...sink
          }))
      };
    }
  };
}

const DEFAULT_TELEMETRY_ALERT_DELIVERY_WINDOW_STATE: TelemetryAlertDeliveryWindowState = {
  version: 1,
  exactDeliveries: {},
  cooldownDeliveries: {},
  suppressions: []
};

export function createRecordingTelemetryAlertDeliveryWindowStore(
  initialState?: TelemetryAlertDeliveryWindowState
): RecordingTelemetryAlertDeliveryWindowStore {
  const state = convertTelemetryAlertDeliveryWindowStateToMutable(
    initialState ?? DEFAULT_TELEMETRY_ALERT_DELIVERY_WINDOW_STATE
  );
  return createTelemetryAlertDeliveryWindowStoreState(state);
}

export function createPersistedTelemetryAlertDeliveryWindowStore(
  options: PersistedTelemetryAlertDeliveryWindowStoreOptions
): RecordingTelemetryAlertDeliveryWindowStore {
  const defaultState = options.initialState
    ?? DEFAULT_TELEMETRY_ALERT_DELIVERY_WINDOW_STATE;
  const mutableState = convertTelemetryAlertDeliveryWindowStateToMutable(defaultState);
  let loaded = false;
  let loadPromise: Promise<void> | null = null;

  async function ensureStateLoaded(): Promise<void> {
    if (loaded) {
      return;
    }

    if (!loadPromise) {
      loadPromise = loadTelemetryAlertDeliveryWindowStateFromFile(
        options.path,
        defaultState
      )
        .then((loadedState) => {
          setMutableWindowState(mutableState, loadedState);
          loaded = true;
        })
        .catch((error) => {
          loadPromise = null;
          throw error;
        });
    }

    await loadPromise;
  }

  return {
    ...createTelemetryAlertDeliveryWindowStoreState(mutableState),
    async evaluate(alert, policy, now): Promise<TelemetryAlertDeliveryWindowDecision> {
      await ensureStateLoaded();
      const decision = evaluateTelemetryAlertDeliveryWindow(
        mutableState,
        alert,
        policy,
        now ?? options.now?.()
      );
      await persistTelemetryAlertDeliveryWindowState(options.path, mutableState);
      return decision;
    },
    async loadSuppressions(): Promise<TelemetryAlertDeliverySuppression[]> {
      await ensureStateLoaded();
      return [...mutableState.suppressions];
    }
  };
}

function createTelemetryAlertDeliveryWindowStoreState(
  state: MutableTelemetryAlertDeliveryWindowState
): RecordingTelemetryAlertDeliveryWindowStore {
  return {
    async evaluate(
      alert: TelemetryDeliveryAlert,
      policy: TelemetryAlertDeliveryWindowPolicy,
      now?: string
    ): Promise<TelemetryAlertDeliveryWindowDecision> {
      return evaluateTelemetryAlertDeliveryWindow(state, alert, policy, now);
    },
    async loadSuppressions(): Promise<TelemetryAlertDeliverySuppression[]> {
      return [...state.suppressions];
    }
  };
}

interface MutableTelemetryAlertDeliveryWindowState {
  exactDeliveries: Map<string, string>;
  cooldownDeliveries: Map<string, string>;
  suppressions: TelemetryAlertDeliverySuppression[];
}

function convertTelemetryAlertDeliveryWindowStateToMutable(
  state: TelemetryAlertDeliveryWindowState
): MutableTelemetryAlertDeliveryWindowState {
  return {
    exactDeliveries: new Map<string, string>(Object.entries(state.exactDeliveries)),
    cooldownDeliveries: new Map<string, string>(Object.entries(state.cooldownDeliveries)),
    suppressions: [...state.suppressions]
  };
}

function setMutableWindowState(
  target: MutableTelemetryAlertDeliveryWindowState,
  state: TelemetryAlertDeliveryWindowState
): void {
  target.exactDeliveries = new Map<string, string>(Object.entries(state.exactDeliveries));
  target.cooldownDeliveries = new Map<string, string>(Object.entries(state.cooldownDeliveries));
  target.suppressions = [...state.suppressions];
}

function evaluateTelemetryAlertDeliveryWindow(
  state: MutableTelemetryAlertDeliveryWindowState,
  alert: TelemetryDeliveryAlert,
  policy: TelemetryAlertDeliveryWindowPolicy,
  now?: string
): TelemetryAlertDeliveryWindowDecision {
  const timestamp = normalizeTelemetryTimestamp(now);
  const dedupeWindowMs = policy.dedupeWindowMs ?? 0;
  const cooldownWindowMs = policy.cooldownWindowMs ?? 0;
  const exactKey = createTelemetryAlertExactKey(alert);
  const cooldownKey = createTelemetryAlertCooldownKey(alert);

  if (dedupeWindowMs > 0) {
    const previousDeliveredAt = state.exactDeliveries.get(exactKey);

    if (previousDeliveredAt && isWithinTelemetryWindow(previousDeliveredAt, timestamp, dedupeWindowMs)) {
      const suppression = createTelemetryAlertDeliverySuppression(
        "dedupe",
        alert,
        timestamp,
        previousDeliveredAt,
        exactKey
      );
      state.suppressions.push(suppression);
      return {
        alert,
        shouldDeliver: false,
        suppression
      };
    }
  }

  if (cooldownWindowMs > 0) {
    const previousDeliveredAt = state.cooldownDeliveries.get(cooldownKey);

    if (previousDeliveredAt && isWithinTelemetryWindow(previousDeliveredAt, timestamp, cooldownWindowMs)) {
      const suppression = createTelemetryAlertDeliverySuppression(
        "cooldown",
        alert,
        timestamp,
        previousDeliveredAt,
        cooldownKey
      );
      state.suppressions.push(suppression);
      return {
        alert,
        shouldDeliver: false,
        suppression
      };
    }
  }

  state.exactDeliveries.set(exactKey, timestamp);
  state.cooldownDeliveries.set(cooldownKey, timestamp);

  return {
    alert,
    shouldDeliver: true
  };
}

function loadTelemetryAlertDeliveryWindowStateFromFile(
  path: string,
  fallback: TelemetryAlertDeliveryWindowState
): Promise<TelemetryAlertDeliveryWindowState> {
  return readTelemetryAlertDeliveryWindowState(path, fallback);
}

async function persistTelemetryAlertDeliveryWindowState(
  path: string,
  state: MutableTelemetryAlertDeliveryWindowState
): Promise<void> {
  const serializableState = serializeTelemetryAlertDeliveryWindowState(state);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(serializableState, null, 2), "utf8");
}

async function readTelemetryAlertDeliveryWindowState(
  path: string,
  fallback: TelemetryAlertDeliveryWindowState
): Promise<TelemetryAlertDeliveryWindowState> {
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw);
    return normalizeTelemetryAlertDeliveryWindowState(parsed, fallback);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return fallback;
    }

    throw error;
  }
}

function normalizeTelemetryAlertDeliveryWindowState(
  state: Partial<TelemetryAlertDeliveryWindowState>,
  fallback: TelemetryAlertDeliveryWindowState
): TelemetryAlertDeliveryWindowState {
  if (!state || typeof state !== "object") {
    return { ...fallback };
  }

  return {
    version: state.version ?? fallback.version,
    exactDeliveries: safeRecordStrings(state.exactDeliveries),
    cooldownDeliveries: safeRecordStrings(state.cooldownDeliveries),
    suppressions: Array.isArray(state.suppressions)
      ? state.suppressions
      : [...fallback.suppressions]
  };
}

function serializeTelemetryAlertDeliveryWindowState(
  state: MutableTelemetryAlertDeliveryWindowState
): TelemetryAlertDeliveryWindowState {
  return {
    version: 1,
    exactDeliveries: Object.fromEntries(state.exactDeliveries),
    cooldownDeliveries: Object.fromEntries(state.cooldownDeliveries),
    suppressions: [...state.suppressions]
  };
}

function safeRecordStrings(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") {
    return {};
  }

  const entries = Object.entries(value as Record<string, unknown>);

  return entries.reduce<Record<string, string>>((accumulator, [key, candidate]) => {
    if (typeof candidate === "string") {
      accumulator[key] = candidate;
    }

    return accumulator;
  }, {});
}

export function evaluateTelemetryDeliveryAlerts(
  snapshot: TelemetryDeliveryMetricsSnapshot,
  thresholds: TelemetryDeliveryAlertThresholds
): TelemetryDeliveryAlert[] {
  return evaluateDeliveryAlerts(snapshot, thresholds, "telemetry");
}

export function evaluateTelemetryAlertDeliveryAlerts(
  snapshot: TelemetryAlertDeliveryMetricsSnapshot,
  thresholds: TelemetryDeliveryAlertThresholds
): TelemetryDeliveryAlert[] {
  return evaluateDeliveryAlerts(snapshot, thresholds, "alert delivery");
}

function evaluateDeliveryAlerts(
  snapshot: {
    totals: TelemetryDeliveryMetricsSnapshotTotals | TelemetryAlertDeliveryMetricsSnapshotTotals;
    sinks: Array<TelemetryDeliverySinkMetricsSnapshot | TelemetryAlertDeliverySinkMetricsSnapshot>;
  },
  thresholds: TelemetryDeliveryAlertThresholds,
  subjectLabel: string
): TelemetryDeliveryAlert[] {
  const alerts: TelemetryDeliveryAlert[] = [];

  const totalAlerts = evaluateAlertScope(
    snapshot.totals,
    thresholds,
    "totals",
    subjectLabel
  );
  alerts.push(...totalAlerts);

  for (const sink of snapshot.sinks) {
    const sinkAlerts = evaluateAlertScope(
      sink,
      thresholds,
      "sink",
      subjectLabel
    ).map((alert) => ({
      ...alert,
      sinkIndex: sink.sinkIndex,
      ...(sink.sinkLabel !== undefined ? { sinkLabel: sink.sinkLabel } : {}),
      message: sink.sinkLabel
        ? `${alert.message} [sink=${sink.sinkLabel}]`
        : `${alert.message} [sinkIndex=${sink.sinkIndex}]`
    }));
    alerts.push(...sinkAlerts);
  }

  return alerts;
}

export function createTelemetryDeliveryAlertLogEvents(
  alerts: TelemetryDeliveryAlert[],
  context?: Record<string, unknown>
): LogEvent[] {
  return alerts.map((alert) => createLogEvent(
    alert.level,
    alert.message,
    createTelemetryDeliveryAlertContext(alert, context)
  ));
}

export async function partitionTelemetryAlertsForDelivery(
  alerts: TelemetryDeliveryAlert[],
  store: TelemetryAlertDeliveryWindowStore,
  policy: TelemetryAlertDeliveryWindowPolicy,
  now?: string
): Promise<{
  deliverableAlerts: TelemetryDeliveryAlert[];
  suppressed: TelemetryAlertDeliverySuppression[];
}> {
  const deliverableAlerts: TelemetryDeliveryAlert[] = [];
  const suppressed: TelemetryAlertDeliverySuppression[] = [];

  for (const alert of alerts) {
    const decision = await store.evaluate(alert, policy, now);

    if (decision.shouldDeliver) {
      deliverableAlerts.push(alert);
      continue;
    }

    if (decision.suppression) {
      suppressed.push(decision.suppression);
    }
  }

  return {
    deliverableAlerts,
    suppressed
  };
}

export function createFanoutTelemetrySink(
  sinks: Array<TelemetrySink | FanoutTelemetrySinkEntry | undefined | null>,
  options: FanoutTelemetrySinkOptions = {}
): TelemetrySink {
  const activeSinks = sinks
    .filter((sink): sink is TelemetrySink | FanoutTelemetrySinkEntry => Boolean(sink))
    .map((sink) => normalizeFanoutSinkEntry(sink));
  const failurePolicy = options.failurePolicy ?? "fail_fast";

  return {
    async record(event: LogEvent): Promise<void> {
      const sanitized = sanitizeLogEvent(event);
      await options.metricsCollector?.recordEventDispatch({
        sinkCount: activeSinks.length
      });

      for (const [sinkIndex, sinkEntry] of activeSinks.entries()) {
        try {
          await recordTelemetryWithPolicy(sinkEntry, sanitized, options, sinkIndex);
        } catch (error) {
          if (failurePolicy === "best_effort") {
            continue;
          }

          throw error;
        }
      }
    }
  };
}

export function createFanoutTelemetryAlertSink(
  sinks: Array<TelemetryAlertSink | FanoutTelemetryAlertSinkEntry | undefined | null>,
  options: FanoutTelemetryAlertSinkOptions = {}
): TelemetryAlertSink {
  const activeSinks = sinks
    .filter((sink): sink is TelemetryAlertSink | FanoutTelemetryAlertSinkEntry => Boolean(sink))
    .map((sink) => normalizeFanoutTelemetryAlertSinkEntry(sink));
  const failurePolicy = options.failurePolicy ?? "fail_fast";

  return {
    async record(alert: TelemetryDeliveryAlert): Promise<void> {
      await options.metricsCollector?.recordAlertDispatch({
        sinkCount: activeSinks.length
      });

      for (const [sinkIndex, sinkEntry] of activeSinks.entries()) {
        try {
          await recordTelemetryAlertWithPolicy(sinkEntry, alert, options, sinkIndex);
        } catch (error) {
          if (failurePolicy === "best_effort") {
            continue;
          }

          throw error;
        }
      }
    }
  };
}

function normalizeFanoutSinkEntry(
  sink: TelemetrySink | FanoutTelemetrySinkEntry
): FanoutTelemetrySinkEntry {
  if ("sink" in sink) {
    return sink;
  }

  return { sink };
}

function normalizeFanoutTelemetryAlertSinkEntry(
  sink: TelemetryAlertSink | FanoutTelemetryAlertSinkEntry
): FanoutTelemetryAlertSinkEntry {
  if ("sink" in sink) {
    return sink;
  }

  return { sink };
}

async function recordTelemetryWithPolicy(
  sinkEntry: FanoutTelemetrySinkEntry,
  event: LogEvent,
  options: FanoutTelemetrySinkOptions,
  sinkIndex: number
): Promise<void> {
  const maxAttempts = Math.max(1, (sinkEntry.retries ?? options.defaultRetries ?? 0) + 1);
  const timeoutMs = sinkEntry.timeoutMs ?? options.defaultTimeoutMs;
  const retryDelayMs = sinkEntry.retryDelayMs ?? options.defaultRetryDelayMs ?? 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    await options.metricsCollector?.recordSinkAttempt({
      sinkIndex,
      attempt,
      ...(sinkEntry.label !== undefined ? { sinkLabel: sinkEntry.label } : {})
    });

    try {
      await recordTelemetryWithOptionalTimeout(sinkEntry.sink, event, timeoutMs, sinkEntry.label);
      await options.metricsCollector?.recordSinkSuccess({
        sinkIndex,
        ...(sinkEntry.label !== undefined ? { sinkLabel: sinkEntry.label } : {})
      });
      return;
    } catch (error) {
      const timedOut = isTelemetryTimeoutError(error);
      const willRetry = attempt < maxAttempts;
      const errorMessage = formatTelemetryErrorMessage(error);

      await options.metricsCollector?.recordSinkFailure({
        sinkIndex,
        timedOut,
        errorMessage,
        ...(sinkEntry.label !== undefined ? { sinkLabel: sinkEntry.label } : {})
      });

      await options.onSinkError?.({
        sinkIndex,
        event,
        error,
        attempt,
        maxAttempts,
        timedOut,
        willRetry,
        ...(sinkEntry.label !== undefined ? { sinkLabel: sinkEntry.label } : {})
      });

      if (!willRetry) {
        throw error;
      }

      if (retryDelayMs > 0) {
        await delay(retryDelayMs);
      }
    }
  }
}

async function recordTelemetryAlertWithPolicy(
  sinkEntry: FanoutTelemetryAlertSinkEntry,
  alert: TelemetryDeliveryAlert,
  options: FanoutTelemetryAlertSinkOptions,
  sinkIndex: number
): Promise<void> {
  const maxAttempts = Math.max(1, (sinkEntry.retries ?? options.defaultRetries ?? 0) + 1);
  const timeoutMs = sinkEntry.timeoutMs ?? options.defaultTimeoutMs;
  const retryDelayMs = sinkEntry.retryDelayMs ?? options.defaultRetryDelayMs ?? 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    await options.metricsCollector?.recordSinkAttempt({
      sinkIndex,
      attempt,
      ...(sinkEntry.label !== undefined ? { sinkLabel: sinkEntry.label } : {})
    });

    try {
      await recordTelemetryAlertWithOptionalTimeout(
        sinkEntry.sink,
        alert,
        timeoutMs,
        sinkEntry.label
      );
      await options.metricsCollector?.recordSinkSuccess({
        sinkIndex,
        ...(sinkEntry.label !== undefined ? { sinkLabel: sinkEntry.label } : {})
      });
      return;
    } catch (error) {
      const timedOut = isTelemetryAlertTimeoutError(error);
      const willRetry = attempt < maxAttempts;
      const errorMessage = formatTelemetryErrorMessage(error);

      await options.metricsCollector?.recordSinkFailure({
        sinkIndex,
        timedOut,
        errorMessage,
        ...(sinkEntry.label !== undefined ? { sinkLabel: sinkEntry.label } : {})
      });

      await options.onSinkError?.({
        sinkIndex,
        alert,
        error,
        attempt,
        maxAttempts,
        timedOut,
        willRetry,
        ...(sinkEntry.label !== undefined ? { sinkLabel: sinkEntry.label } : {})
      });

      if (!willRetry) {
        throw error;
      }

      if (retryDelayMs > 0) {
        await delay(retryDelayMs);
      }
    }
  }
}

async function recordTelemetryWithOptionalTimeout(
  sink: TelemetrySink,
  event: LogEvent,
  timeoutMs: number | undefined,
  sinkLabel?: string
): Promise<void> {
  if (!timeoutMs || timeoutMs <= 0) {
    await Promise.resolve(sink.record(event));
    return;
  }

  let timeoutHandle: NodeJS.Timeout | undefined;

  try {
    await Promise.race([
      Promise.resolve(sink.record(event)),
      new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new Error(
            sinkLabel
              ? `telemetry_sink_timeout:${sinkLabel}:${timeoutMs}`
              : `telemetry_sink_timeout:${timeoutMs}`
          ));
        }, timeoutMs);
      })
    ]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

async function recordTelemetryAlertWithOptionalTimeout(
  sink: TelemetryAlertSink,
  alert: TelemetryDeliveryAlert,
  timeoutMs: number | undefined,
  sinkLabel?: string
): Promise<void> {
  if (!timeoutMs || timeoutMs <= 0) {
    await Promise.resolve(sink.record(alert));
    return;
  }

  let timeoutHandle: NodeJS.Timeout | undefined;

  try {
    await Promise.race([
      Promise.resolve(sink.record(alert)),
      new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new Error(
            sinkLabel
              ? `telemetry_alert_sink_timeout:${sinkLabel}:${timeoutMs}`
              : `telemetry_alert_sink_timeout:${timeoutMs}`
          ));
        }, timeoutMs);
      })
    ]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

function isTelemetryTimeoutError(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith("telemetry_sink_timeout:");
}

function isTelemetryAlertTimeoutError(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith("telemetry_alert_sink_timeout:");
}

function formatTelemetryErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function ensureSinkMetrics(
  sinks: Map<number, TelemetryDeliverySinkMetricsSnapshot>,
  sinkIndex: number,
  sinkLabel?: string
): TelemetryDeliverySinkMetricsSnapshot {
  const existing = sinks.get(sinkIndex);

  if (existing) {
    if (sinkLabel !== undefined && existing.sinkLabel === undefined) {
      existing.sinkLabel = sinkLabel;
    }

    return existing;
  }

  const created: TelemetryDeliverySinkMetricsSnapshot = {
    sinkIndex,
    targetedEvents: 0,
    attempts: 0,
    successes: 0,
    failures: 0,
    timeouts: 0,
    retries: 0,
    ...(sinkLabel !== undefined ? { sinkLabel } : {})
  };

  sinks.set(sinkIndex, created);
  return created;
}

function ensureAlertSinkMetrics(
  sinks: Map<number, TelemetryAlertDeliverySinkMetricsSnapshot>,
  sinkIndex: number,
  sinkLabel?: string
): TelemetryAlertDeliverySinkMetricsSnapshot {
  const existing = sinks.get(sinkIndex);

  if (existing) {
    if (sinkLabel !== undefined && existing.sinkLabel === undefined) {
      existing.sinkLabel = sinkLabel;
    }

    return existing;
  }

  const created: TelemetryAlertDeliverySinkMetricsSnapshot = {
    sinkIndex,
    targetedEvents: 0,
    attempts: 0,
    successes: 0,
    failures: 0,
    timeouts: 0,
    retries: 0,
    ...(sinkLabel !== undefined ? { sinkLabel } : {})
  };

  sinks.set(sinkIndex, created);
  return created;
}

function evaluateAlertScope(
  metrics:
    | TelemetryDeliveryMetricsSnapshotTotals
    | TelemetryDeliverySinkMetricsSnapshot
    | TelemetryAlertDeliveryMetricsSnapshotTotals
    | TelemetryAlertDeliverySinkMetricsSnapshot,
  thresholds: TelemetryDeliveryAlertThresholds,
  scope: "totals" | "sink",
  subjectLabel: string
): TelemetryDeliveryAlert[] {
  const alerts: TelemetryDeliveryAlert[] = [];
  const thresholdValues = scope === "totals"
    ? {
      error: thresholds.error?.totals,
      warn: thresholds.warn?.totals
    }
    : {
      error: thresholds.error?.perSink,
      warn: thresholds.warn?.perSink
    };

  for (const metric of ALERT_METRICS) {
    const observed = readAlertMetric(metrics, metric);
    const errorThreshold = thresholdValues.error?.[metric];

    if (errorThreshold !== undefined && observed > errorThreshold) {
      alerts.push(createTelemetryDeliveryAlert("error", subjectLabel, scope, metric, observed, errorThreshold));
      continue;
    }

    const warnThreshold = thresholdValues.warn?.[metric];

    if (warnThreshold !== undefined && observed > warnThreshold) {
      alerts.push(createTelemetryDeliveryAlert("warn", subjectLabel, scope, metric, observed, warnThreshold));
    }
  }

  return alerts;
}

const ALERT_METRICS: TelemetryDeliveryAlertMetric[] = [
  "failures",
  "timeouts",
  "retries",
  "failureRate",
  "timeoutRate"
];

function createTelemetryDeliveryAlert(
  level: TelemetryDeliveryAlertLevel,
  subjectLabel: string,
  scope: "totals" | "sink",
  metric: TelemetryDeliveryAlertMetric,
  observed: number,
  threshold: number
): TelemetryDeliveryAlert {
  return {
    level,
    scope,
    metric,
    observed,
    threshold,
    message: `${scope} ${subjectLabel} ${metric} exceeded threshold (${formatMetricValue(metric, observed)} > ${formatMetricValue(metric, threshold)})`
  };
}

function readAlertMetric(
  metrics:
    | TelemetryDeliveryMetricsSnapshotTotals
    | TelemetryDeliverySinkMetricsSnapshot
    | TelemetryAlertDeliveryMetricsSnapshotTotals
    | TelemetryAlertDeliverySinkMetricsSnapshot,
  metric: TelemetryDeliveryAlertMetric
): number {
  switch (metric) {
    case "failureRate":
      return computeRate(metrics.failures, metrics.attempts);
    case "timeoutRate":
      return computeRate(metrics.timeouts, metrics.attempts);
    case "failures":
      return metrics.failures;
    case "timeouts":
      return metrics.timeouts;
    case "retries":
      return metrics.retries;
    default:
      return 0;
  }
}

function computeRate(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }

  return numerator / denominator;
}

function formatMetricValue(
  metric: TelemetryDeliveryAlertMetric,
  value: number
): string {
  if (metric === "failureRate" || metric === "timeoutRate") {
    return value.toFixed(3);
  }

  return String(value);
}

function createTelemetryDeliveryAlertContext(
  alert: TelemetryDeliveryAlert,
  context?: Record<string, unknown>
): Record<string, unknown> {
  return createSafeAuditDetails({
    level: alert.level,
    scope: alert.scope,
    metric: alert.metric,
    observed: alert.observed,
    threshold: alert.threshold,
    ...(alert.sinkIndex !== undefined ? { sinkIndex: alert.sinkIndex } : {}),
    ...(alert.sinkLabel !== undefined ? { sinkLabel: alert.sinkLabel } : {}),
    ...context
  });
}

function sanitizeTelemetryAlertMetricTags(
  tags: Record<string, TelemetryAlertMetricTagValue>
): Record<string, TelemetryAlertMetricTagValue> {
  const sanitized = createSafeAuditDetails(tags);
  const output: Record<string, TelemetryAlertMetricTagValue> = {};

  for (const [key, value] of Object.entries(sanitized)) {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      output[key] = value;
    }
  }

  return output;
}

function createTelemetryAlertExactKey(alert: TelemetryDeliveryAlert): string {
  return [
    alert.level,
    alert.scope,
    alert.metric,
    String(alert.observed),
    String(alert.threshold),
    alert.sinkLabel ?? "",
    alert.sinkIndex ?? ""
  ].join("|");
}

function createTelemetryAlertCooldownKey(alert: TelemetryDeliveryAlert): string {
  return [
    alert.level,
    alert.scope,
    alert.metric,
    alert.sinkLabel ?? "",
    alert.sinkIndex ?? ""
  ].join("|");
}

function createTelemetryAlertDeliverySuppression(
  reason: TelemetryAlertDeliverySuppressionReason,
  alert: TelemetryDeliveryAlert,
  suppressedAt: string,
  previousDeliveredAt: string,
  key: string
): TelemetryAlertDeliverySuppression {
  return {
    reason,
    alert,
    suppressedAt,
    previousDeliveredAt,
    key
  };
}

function normalizeTelemetryTimestamp(now?: string): string {
  if (!now) {
    return new Date().toISOString();
  }

  const parsed = new Date(now);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`invalid_telemetry_timestamp:${now}`);
  }

  return parsed.toISOString();
}

function isWithinTelemetryWindow(
  previousTimestamp: string,
  currentTimestamp: string,
  windowMs: number
): boolean {
  const previous = new Date(previousTimestamp).getTime();
  const current = new Date(currentTimestamp).getTime();

  if (Number.isNaN(previous) || Number.isNaN(current)) {
    return false;
  }

  return current - previous < windowMs;
}

export async function emitTelemetryEvents(
  sink: TelemetrySink,
  events: LogEvent[]
): Promise<void> {
  for (const event of events) {
    await sink.record(event);
  }
}

export async function emitTelemetryAlerts(
  sink: TelemetryAlertSink,
  alerts: TelemetryDeliveryAlert[]
): Promise<void> {
  for (const alert of alerts) {
    await sink.record(alert);
  }
}
