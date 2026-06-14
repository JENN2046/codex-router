import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createFanoutTelemetryAlertSink,
  createRecordingTelemetryAlertDeliveryWindowStore,
  createRecordingTelemetryAlertDeliveryMetricsCollector,
  createLogEvent,
  createLoggerTelemetryAlertSink,
  createTelemetryDeliveryAlertLogEvents,
  createFanoutTelemetrySink,
  createLoggerTelemetrySink,
  createMetricsTelemetryAlertSink,
  createMemoryPreflightLogEvent,
  createPreflightLogEvent,
  createRecordingTelemetryAlertSink,
  createRecordingTelemetryDeliveryMetricsCollector,
  createRecordingTelemetrySink,
  createTracingTelemetryAlertSink,
  evaluateTelemetryAlertDeliveryAlerts,
  evaluateTelemetryDeliveryAlerts,
  emitTelemetryAlerts,
  emitTelemetryEvents,
  createPersistedTelemetryAlertDeliveryWindowStore,
  partitionTelemetryAlertsForDelivery
} from "../packages/observability/src/index.js";

function waitForever(): Promise<void> {
  return new Promise(() => undefined);
}

test("observability creates warn log events for degraded memory preflight state", () => {
  const event = createMemoryPreflightLogEvent({
    status: "degraded",
    policyPack: "engineering",
    guidance: {
      memoryRequired: false,
      resumeExpected: true,
      telemetryMandatory: true,
      checkpointFrequency: "stage"
    },
    required: false,
    available: true,
    issues: ["memory_recent_rejections:2"],
    blockingIssues: [],
    warningIssues: ["memory_recent_rejections:2"],
    signals: {
      rejectedWrites: 2,
      shadowReconcileCount: 0
    }
  }, {
    taskId: "obs-1"
  });

  assert.equal(event.level, "warn");
  assert.equal(event.message, "memory preflight degraded");
  assert.equal(event.context?.taskId, "obs-1");
});

test("observability includes explicit memory state in preflight log events", () => {
  const event = createPreflightLogEvent({
    ok: true,
    errors: [],
    warnings: ["memory_shadow_reconcile_pending:1"],
    memory: {
      status: "degraded",
      policyPack: "engineering",
      guidance: {
        memoryRequired: false,
        resumeExpected: true,
        telemetryMandatory: true,
        checkpointFrequency: "stage"
      },
      required: true,
      available: true,
      issues: ["memory_shadow_reconcile_pending:1"],
      blockingIssues: [],
      warningIssues: ["memory_shadow_reconcile_pending:1"],
      signals: {
        codexMcpStatus: "enabled",
        rejectedWrites: 0,
        shadowReconcileCount: 1,
        recallAvailable: true,
        recallStatus: "active"
      }
    }
  }, {
    taskId: "obs-2"
  });

  assert.equal(event.level, "warn");
  assert.equal(event.message, "preflight passed (memory=degraded)");
  assert.equal((event.context?.memory as { status?: string })?.status, "degraded");
});

test("observability redacts log event context", () => {
  const event = createLogEvent("info", "secret context", {
    apiKey: "raw-api-key",
    stdout: "x".repeat(5000),
    message: "provider returned sk-proj-123456789",
    nested: {
      authorization: "Bearer abc.def.ghi"
    }
  });

  assert.equal(event.context?.apiKey, "<REDACTED_SECRET>");
  assert.equal(event.context?.stdout, "<omitted:5000>");
  assert.equal(event.context?.message, "provider returned <REDACTED_SECRET>");
  assert.deepEqual(event.context?.nested, {
    authorization: "<REDACTED_SECRET>"
  });
  assert.equal(JSON.stringify(event).includes("raw-api-key"), false);
  assert.equal(JSON.stringify(event).includes("sk-proj-123456789"), false);
  assert.equal(JSON.stringify(event).includes("abc.def.ghi"), false);
});

test("recording telemetry sink stores emitted events", async () => {
  const sink = createRecordingTelemetrySink();
  const events = [
    createMemoryPreflightLogEvent({
      status: "ok",
      required: false,
      available: true,
      issues: [],
      blockingIssues: [],
      warningIssues: [],
      signals: {
        rejectedWrites: 0,
        shadowReconcileCount: 0
      }
    }, {
      taskId: "obs-3"
    })
  ];

  await emitTelemetryEvents(sink, events);

  assert.equal(sink.events.length, 1);
  assert.equal(sink.events[0]?.context?.taskId, "obs-3");
});

test("recording telemetry sink sanitizes manually constructed events", async () => {
  const sink = createRecordingTelemetrySink([{
    level: "info",
    message: "initial",
    correlationId: "initial",
    context: {
      token: "initial-token"
    }
  }]);

  await sink.record({
    level: "error",
    message: "manual",
    correlationId: "manual",
    context: {
      stderr: "Authorization: Bearer abc.def.ghi",
      args: ["--password", "raw-password", "--safe", "ok"]
    }
  });

  assert.equal(sink.events[0]?.context?.token, "<REDACTED_SECRET>");
  assert.equal(sink.events[1]?.context?.stderr, "Authorization: <REDACTED_SECRET>");
  assert.deepEqual(sink.events[1]?.context?.args, ["--password", "<REDACTED_SECRET>", "--safe", "ok"]);
});

test("recording telemetry alert sink stores emitted alerts", async () => {
  const sink = createRecordingTelemetryAlertSink();
  const alerts = [
    {
      level: "warn" as const,
      scope: "totals" as const,
      metric: "timeouts" as const,
      message: "totals telemetry timeouts exceeded threshold (1 > 0)",
      observed: 1,
      threshold: 0
    }
  ];

  await emitTelemetryAlerts(sink, alerts);

  assert.equal(sink.alerts.length, 1);
  assert.equal(sink.alerts[0]?.metric, "timeouts");
});

test("logger telemetry sink maps log levels to backend methods", async () => {
  const calls: string[] = [];
  const sink = createLoggerTelemetrySink({
    info(message) {
      calls.push(`info:${message}`);
    },
    warn(message) {
      calls.push(`warn:${message}`);
    },
    error(message) {
      calls.push(`error:${message}`);
    }
  });

  await sink.record({
    level: "info",
    message: "info-event",
    correlationId: "c1"
  });
  await sink.record({
    level: "warn",
    message: "warn-event",
    correlationId: "c2"
  });
  await sink.record({
    level: "error",
    message: "error-event",
    correlationId: "c3"
  });

  assert.deepEqual(calls, [
    "info:info-event",
    "warn:warn-event",
    "error:error-event"
  ]);
});

test("logger telemetry sink receives sanitized context", async () => {
  const contexts: Array<Record<string, unknown> | undefined> = [];
  const sink = createLoggerTelemetrySink({
    info(_message, context) {
      contexts.push(context);
    },
    warn() {
      throw new Error("unexpected_warn");
    },
    error() {
      throw new Error("unexpected_error");
    }
  });

  await sink.record({
    level: "info",
    message: "manual",
    correlationId: "manual",
    context: {
      token: "raw-token",
      stdout: "x".repeat(5000)
    }
  });

  assert.equal(contexts[0]?.token, "<REDACTED_SECRET>");
  assert.equal(contexts[0]?.stdout, "<omitted:5000>");
});

test("logger telemetry alert sink maps alert levels to backend methods", async () => {
  const calls: string[] = [];
  const sink = createLoggerTelemetryAlertSink({
    info(message) {
      calls.push(`info:${message}`);
    },
    warn(message, context) {
      calls.push(`warn:${message}:${String(context?.scope)}`);
    },
    error(message, context) {
      calls.push(`error:${message}:${String(context?.sinkLabel)}`);
    }
  }, {
    baseContext: {
      taskId: "obs-alert-logger"
    }
  });

  await sink.record({
    level: "warn",
    scope: "totals",
    metric: "timeouts",
    message: "warn-alert",
    observed: 1,
    threshold: 0
  });
  await sink.record({
    level: "error",
    scope: "sink",
    metric: "failureRate",
    message: "error-alert",
    observed: 1,
    threshold: 0.2,
    sinkLabel: "external"
  });

  assert.deepEqual(calls, [
    "warn:warn-alert:totals",
    "error:error-alert:external"
  ]);
});

test("logger telemetry alert sink receives sanitized base context", async () => {
  const contexts: Array<Record<string, unknown> | undefined> = [];
  const sink = createLoggerTelemetryAlertSink({
    info() {
      throw new Error("unexpected_info");
    },
    warn(_message, context) {
      contexts.push(context);
    },
    error() {
      throw new Error("unexpected_error");
    }
  }, {
    baseContext: {
      apiKey: "raw-api-key",
      stderr: "Authorization: Bearer abc.def.ghi"
    }
  });

  await sink.record({
    level: "warn",
    scope: "totals",
    metric: "timeouts",
    message: "warn-alert",
    observed: 1,
    threshold: 0
  });

  assert.equal(contexts[0]?.apiKey, "<REDACTED_SECRET>");
  assert.equal(contexts[0]?.stderr, "Authorization: <REDACTED_SECRET>");
  assert.equal(JSON.stringify(contexts[0]).includes("raw-api-key"), false);
  assert.equal(JSON.stringify(contexts[0]).includes("abc.def.ghi"), false);
});

test("tracing telemetry alert sink maps alerts into tracing events", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const sink = createTracingTelemetryAlertSink({
    addEvent(name, attributes) {
      calls.push({
        name,
        ...(attributes ? { attributes } : {})
      });
    }
  }, {
    eventName: "codex_router.alert",
    baseAttributes: {
      source: "test"
    }
  });

  await sink.record({
    level: "warn",
    scope: "sink",
    metric: "retries",
    message: "trace-alert",
    observed: 2,
    threshold: 1,
    sinkIndex: 1
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.name, "codex_router.alert");
  const attributes = calls[0]?.attributes as Record<string, unknown> | undefined;
  assert.equal(attributes?.source, "test");
  assert.equal(attributes?.metric, "retries");
  assert.equal(attributes?.sinkIndex, 1);
});

test("tracing telemetry alert sink receives sanitized base attributes", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const sink = createTracingTelemetryAlertSink({
    addEvent(name, attributes) {
      calls.push({
        name,
        ...(attributes ? { attributes } : {})
      });
    }
  }, {
    baseAttributes: {
      token: "raw-token",
      stdout: "x".repeat(5000)
    }
  });

  await sink.record({
    level: "warn",
    scope: "sink",
    metric: "retries",
    message: "trace-alert",
    observed: 2,
    threshold: 1,
    sinkIndex: 1
  });

  const attributes = calls[0]?.attributes as Record<string, unknown> | undefined;
  assert.equal(attributes?.token, "<REDACTED_SECRET>");
  assert.equal(attributes?.stdout, "<omitted:5000>");
  assert.equal(JSON.stringify(attributes).includes("raw-token"), false);
});

test("metrics telemetry alert sink maps alerts into counter increments", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const sink = createMetricsTelemetryAlertSink({
    increment(metricName, value, tags) {
      calls.push({
        metricName,
        ...(value !== undefined ? { value } : {}),
        ...(tags ? { tags } : {})
      });
    }
  }, {
    metricName: "codex_router_alert_total",
    baseTags: {
      env: "test"
    }
  });

  await sink.record({
    level: "error",
    scope: "sink",
    metric: "failureRate",
    message: "metric-alert",
    observed: 1,
    threshold: 0.1,
    sinkLabel: "logger"
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.metricName, "codex_router_alert_total");
  assert.equal(calls[0]?.value, 1);
  assert.deepEqual(calls[0]?.tags, {
    env: "test",
    level: "error",
    scope: "sink",
    metric: "failureRate",
    sinkLabel: "logger"
  });
});

test("metrics telemetry alert sink receives sanitized base tags", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const sink = createMetricsTelemetryAlertSink({
    increment(metricName, value, tags) {
      calls.push({
        metricName,
        ...(value !== undefined ? { value } : {}),
        ...(tags ? { tags } : {})
      });
    }
  }, {
    baseTags: {
      token: "raw-token",
      command: "tool --password raw-password"
    }
  });

  await sink.record({
    level: "error",
    scope: "sink",
    metric: "failureRate",
    message: "metric-alert",
    observed: 1,
    threshold: 0.1,
    sinkLabel: "logger"
  });

  const tags = calls[0]?.tags as Record<string, unknown> | undefined;
  assert.equal(tags?.token, "<REDACTED_SECRET>");
  assert.equal(tags?.command, "tool --password <REDACTED_SECRET>");
  assert.equal(JSON.stringify(tags).includes("raw-token"), false);
  assert.equal(JSON.stringify(tags).includes("raw-password"), false);
});

test("fanout telemetry alert sink emits the same alert to every child sink", async () => {
  const first = createRecordingTelemetryAlertSink();
  const second = createRecordingTelemetryAlertSink();
  const sink = createFanoutTelemetryAlertSink([first, second]);
  const alert = {
    level: "warn" as const,
    scope: "totals" as const,
    metric: "timeouts" as const,
    message: "fanout-alert",
    observed: 1,
    threshold: 0
  };

  await sink.record(alert);

  assert.equal(first.alerts.length, 1);
  assert.equal(second.alerts.length, 1);
  assert.equal(first.alerts[0]?.message, second.alerts[0]?.message);
});

test("fanout telemetry alert sink fails fast by default when a child sink throws", async () => {
  const first = createRecordingTelemetryAlertSink();
  const sink = createFanoutTelemetryAlertSink([
    first,
    {
      async record(): Promise<void> {
        throw new Error("alert_fanout_failure");
      }
    }
  ]);

  await assert.rejects(
    async () => {
      await sink.record({
        level: "warn",
        scope: "totals",
        metric: "timeouts",
        message: "fanout-alert-fail-fast",
        observed: 1,
        threshold: 0
      });
    },
    /alert_fanout_failure/
  );

  assert.equal(first.alerts.length, 1);
});

test("fanout telemetry alert sink can continue in best_effort mode and report sink failures", async () => {
  const first = createRecordingTelemetryAlertSink();
  const second = createRecordingTelemetryAlertSink();
  const failures: string[] = [];
  const sink = createFanoutTelemetryAlertSink([
    first,
    {
      async record(): Promise<void> {
        throw new Error("best_effort_alert_failure");
      }
    },
    second
  ], {
    failurePolicy: "best_effort",
    onSinkError({ sinkIndex, error }) {
      failures.push(`${sinkIndex}:${error instanceof Error ? error.message : String(error)}`);
    }
  });

  await sink.record({
    level: "error",
    scope: "sink",
    metric: "failureRate",
    message: "fanout-alert-best-effort",
    observed: 1,
    threshold: 0.5,
    sinkLabel: "external"
  });

  assert.equal(first.alerts.length, 1);
  assert.equal(second.alerts.length, 1);
  assert.deepEqual(failures, ["1:best_effort_alert_failure"]);
});

test("fanout telemetry alert sink retries a sink before succeeding", async () => {
  let attempts = 0;
  const second = createRecordingTelemetryAlertSink();
  const sink = createFanoutTelemetryAlertSink([
    {
      label: "flaky-alert",
      retries: 1,
      sink: {
        async record(): Promise<void> {
          attempts += 1;

          if (attempts === 1) {
            throw new Error("retry_alert_once");
          }
        }
      }
    },
    second
  ]);

  await sink.record({
    level: "warn",
    scope: "totals",
    metric: "retries",
    message: "fanout-alert-retry",
    observed: 2,
    threshold: 1
  });

  assert.equal(attempts, 2);
  assert.equal(second.alerts.length, 1);
});

test("fanout telemetry alert sink can continue after a timed out sink in best_effort mode", async () => {
  const second = createRecordingTelemetryAlertSink();
  const failures: string[] = [];
  const sink = createFanoutTelemetryAlertSink([
    {
      label: "slow-alert",
      timeoutMs: 5,
      sink: {
        async record(): Promise<void> {
          await waitForever();
        }
      }
    },
    second
  ], {
    failurePolicy: "best_effort",
    onSinkError({ sinkLabel, timedOut, willRetry }) {
      failures.push(`${sinkLabel}:${timedOut}:${willRetry}`);
    }
  });

  await sink.record({
    level: "warn",
    scope: "totals",
    metric: "timeouts",
    message: "fanout-alert-timeout",
    observed: 1,
    threshold: 0
  });

  assert.equal(second.alerts.length, 1);
  assert.deepEqual(failures, ["slow-alert:true:false"]);
});

test("telemetry alert delivery metrics aggregate attempts, retries, failures, and timeouts", async () => {
  const metrics = createRecordingTelemetryAlertDeliveryMetricsCollector();
  const second = createRecordingTelemetryAlertSink();
  let flakyAttempts = 0;
  const sink = createFanoutTelemetryAlertSink([
    {
      label: "flaky-alert",
      retries: 1,
      sink: {
        async record(): Promise<void> {
          flakyAttempts += 1;

          if (flakyAttempts === 1) {
            throw new Error("retry_alert_once");
          }
        }
      }
    },
    {
      label: "slow-alert",
      timeoutMs: 5,
      sink: {
        async record(): Promise<void> {
          await waitForever();
        }
      }
    },
    second
  ], {
    failurePolicy: "best_effort",
    metricsCollector: metrics
  });

  await sink.record({
    level: "error",
    scope: "totals",
    metric: "failures",
    message: "fanout-alert-metrics",
    observed: 1,
    threshold: 0
  });

  const snapshot = await metrics.loadSnapshot();

  assert.equal(snapshot.totals.events, 1);
  assert.equal(snapshot.totals.targetedSinks, 3);
  assert.equal(snapshot.totals.attempts, 4);
  assert.equal(snapshot.totals.successes, 2);
  assert.equal(snapshot.totals.failures, 2);
  assert.equal(snapshot.totals.timeouts, 1);
  assert.equal(snapshot.totals.retries, 1);
  assert.equal(snapshot.sinks.length, 3);
  assert.equal(snapshot.sinks[0]?.sinkLabel, "flaky-alert");
  assert.equal(snapshot.sinks[0]?.attempts, 2);
  assert.equal(snapshot.sinks[1]?.sinkLabel, "slow-alert");
  assert.equal(snapshot.sinks[1]?.timeouts, 1);
  assert.match(snapshot.sinks[1]?.lastError ?? "", /^telemetry_alert_sink_timeout:/);
});

test("telemetry alert delivery helpers evaluate thresholds and emit alert log events", async () => {
  const metrics = createRecordingTelemetryAlertDeliveryMetricsCollector();
  const second = createRecordingTelemetryAlertSink();
  const sink = createFanoutTelemetryAlertSink([
    {
      label: "slow-alert",
      timeoutMs: 5,
      sink: {
        async record(): Promise<void> {
          await waitForever();
        }
      }
    },
    second
  ], {
    failurePolicy: "best_effort",
    metricsCollector: metrics
  });

  await sink.record({
    level: "warn",
    scope: "totals",
    metric: "timeouts",
    message: "fanout-alert-delivery-alerts",
    observed: 1,
    threshold: 0
  });

  const snapshot = await metrics.loadSnapshot();
  const alerts = evaluateTelemetryAlertDeliveryAlerts(snapshot, {
    error: {
      totals: {
        timeouts: 0
      }
    },
    warn: {
      perSink: {
        failureRate: 0.5
      }
    }
  });
  const alertEvents = createTelemetryDeliveryAlertLogEvents(alerts, {
    taskId: "obs-alert-delivery"
  });

  assert.equal(alerts.length, 2);
  assert.equal(alerts[0]?.level, "error");
  assert.match(alerts[0]?.message ?? "", /alert delivery/);
  assert.equal(alerts[1]?.sinkLabel, "slow-alert");
  assert.equal(alertEvents[0]?.context?.taskId, "obs-alert-delivery");
});

test("alert delivery window dedupes identical alerts within dedupe window", async () => {
  const store = createRecordingTelemetryAlertDeliveryWindowStore();
  const alert = {
    level: "error" as const,
    scope: "totals" as const,
    metric: "failures" as const,
    message: "delivery-window-dedupe",
    observed: 1,
    threshold: 0
  };

  const first = await partitionTelemetryAlertsForDelivery(
    [alert],
    store,
    { dedupeWindowMs: 60_000 },
    "2026-04-23T12:00:00.000Z"
  );
  const second = await partitionTelemetryAlertsForDelivery(
    [alert],
    store,
    { dedupeWindowMs: 60_000 },
    "2026-04-23T12:00:30.000Z"
  );

  assert.equal(first.deliverableAlerts.length, 1);
  assert.equal(second.deliverableAlerts.length, 0);
  assert.equal(second.suppressed.length, 1);
  assert.equal(second.suppressed[0]?.reason, "dedupe");
});

test("alert delivery window cools down changed alerts within cooldown window", async () => {
  const store = createRecordingTelemetryAlertDeliveryWindowStore();
  const firstAlert = {
    level: "error" as const,
    scope: "totals" as const,
    metric: "failures" as const,
    message: "delivery-window-cooldown",
    observed: 1,
    threshold: 0
  };
  const secondAlert = {
    ...firstAlert,
    observed: 2,
    message: "delivery-window-cooldown-updated"
  };

  const first = await partitionTelemetryAlertsForDelivery(
    [firstAlert],
    store,
    { cooldownWindowMs: 60_000 },
    "2026-04-23T12:00:00.000Z"
  );
  const second = await partitionTelemetryAlertsForDelivery(
    [secondAlert],
    store,
    { cooldownWindowMs: 60_000 },
    "2026-04-23T12:00:30.000Z"
  );

  assert.equal(first.deliverableAlerts.length, 1);
  assert.equal(second.deliverableAlerts.length, 0);
  assert.equal(second.suppressed[0]?.reason, "cooldown");
});

test("alert delivery window state persists across store instances for cross-session suppression", async () => {
  const root = await mkdtemp(join(tmpdir(), "codex-router-alert-window-state-"));
  const path = join(root, "window-state.json");
  const alert = {
    level: "error" as const,
    scope: "totals" as const,
    metric: "failures" as const,
    message: "delivery-window-persisted",
    observed: 1,
    threshold: 0
  };

  const firstStore = createPersistedTelemetryAlertDeliveryWindowStore({ path });
  const first = await partitionTelemetryAlertsForDelivery(
    [alert],
    firstStore,
    { cooldownWindowMs: 60_000 },
    "2026-04-23T12:00:00.000Z"
  );
  const secondStore = createPersistedTelemetryAlertDeliveryWindowStore({ path });
  const second = await partitionTelemetryAlertsForDelivery(
    [alert],
    secondStore,
    { cooldownWindowMs: 60_000 },
    "2026-04-23T12:00:30.000Z"
  );
  const suppressions = await secondStore.loadSuppressions();

  assert.equal(first.deliverableAlerts.length, 1);
  assert.equal(second.deliverableAlerts.length, 0);
  assert.equal(second.suppressed.length, 1);
  assert.equal(second.suppressed[0]?.reason, "cooldown");
  assert.equal(suppressions.length, 1);
});

test("alert delivery window allows alerts again after cooldown expires", async () => {
  const store = createRecordingTelemetryAlertDeliveryWindowStore();
  const alert = {
    level: "warn" as const,
    scope: "sink" as const,
    metric: "timeouts" as const,
    message: "delivery-window-expired",
    observed: 1,
    threshold: 0,
    sinkLabel: "external"
  };

  await partitionTelemetryAlertsForDelivery(
    [alert],
    store,
    { dedupeWindowMs: 60_000 },
    "2026-04-23T12:00:00.000Z"
  );
  const third = await partitionTelemetryAlertsForDelivery(
    [alert],
    store,
    { dedupeWindowMs: 60_000 },
    "2026-04-23T12:01:01.000Z"
  );

  assert.equal(third.deliverableAlerts.length, 1);
  assert.equal(third.suppressed.length, 0);
});

test("fanout telemetry sink emits the same event to every child sink", async () => {
  const first = createRecordingTelemetrySink();
  const second = createRecordingTelemetrySink();
  const sink = createFanoutTelemetrySink([first, second]);
  const event = createMemoryPreflightLogEvent({
    status: "ok",
    policyPack: "local_write",
    guidance: {
      memoryRequired: false,
      resumeExpected: true,
      telemetryMandatory: false,
      checkpointFrequency: "standard"
    },
    required: false,
    available: true,
    issues: [],
    blockingIssues: [],
    warningIssues: [],
    signals: {
      rejectedWrites: 0,
      shadowReconcileCount: 0
    }
  }, {
    taskId: "obs-4"
  });

  await sink.record(event);

  assert.equal(first.events.length, 1);
  assert.equal(second.events.length, 1);
  assert.equal(first.events[0]?.correlationId, second.events[0]?.correlationId);
});

test("fanout telemetry sink fails fast by default when a child sink throws", async () => {
  const first = createRecordingTelemetrySink();
  const sink = createFanoutTelemetrySink([
    first,
    {
      async record(): Promise<void> {
        throw new Error("fanout_failure");
      }
    }
  ]);

  await assert.rejects(
    async () => {
      await sink.record({
        level: "warn",
        message: "fanout-test",
        correlationId: "fanout-1"
      });
    },
    /fanout_failure/
  );

  assert.equal(first.events.length, 1);
});

test("fanout telemetry sink can continue in best_effort mode and report sink failures", async () => {
  const first = createRecordingTelemetrySink();
  const second = createRecordingTelemetrySink();
  const failures: string[] = [];
  const sink = createFanoutTelemetrySink([
    first,
    {
      async record(): Promise<void> {
        throw new Error("best_effort_failure");
      }
    },
    second
  ], {
    failurePolicy: "best_effort",
    onSinkError({ sinkIndex, error }) {
      failures.push(`${sinkIndex}:${error instanceof Error ? error.message : String(error)}`);
    }
  });

  await sink.record({
    level: "info",
    message: "fanout-best-effort",
    correlationId: "fanout-2"
  });

  assert.equal(first.events.length, 1);
  assert.equal(second.events.length, 1);
  assert.deepEqual(failures, ["1:best_effort_failure"]);
});

test("fanout telemetry sink retries a sink before succeeding", async () => {
  const attempts: number[] = [];
  const second = createRecordingTelemetrySink();
  const sink = createFanoutTelemetrySink([
    {
      label: "flaky",
      retries: 1,
      sink: {
        async record(): Promise<void> {
          attempts.push(Date.now());

          if (attempts.length === 1) {
            throw new Error("retry_once");
          }
        }
      }
    },
    second
  ]);

  await sink.record({
    level: "info",
    message: "fanout-retry",
    correlationId: "fanout-3"
  });

  assert.equal(attempts.length, 2);
  assert.equal(second.events.length, 1);
});

test("fanout telemetry sink can continue after a timed out sink in best_effort mode", async () => {
  const second = createRecordingTelemetrySink();
  const failures: string[] = [];
  const sink = createFanoutTelemetrySink([
    {
      label: "slow",
      timeoutMs: 5,
      sink: {
        async record(): Promise<void> {
          await waitForever();
        }
      }
    },
    second
  ], {
    failurePolicy: "best_effort",
    onSinkError({ sinkLabel, timedOut, willRetry }) {
      failures.push(`${sinkLabel}:${timedOut}:${willRetry}`);
    }
  });

  await sink.record({
    level: "warn",
    message: "fanout-timeout",
    correlationId: "fanout-4"
  });

  assert.equal(second.events.length, 1);
  assert.deepEqual(failures, ["slow:true:false"]);
});

test("telemetry delivery metrics aggregate attempts, retries, failures, and timeouts", async () => {
  const metrics = createRecordingTelemetryDeliveryMetricsCollector();
  const second = createRecordingTelemetrySink();
  let flakyAttempts = 0;
  const sink = createFanoutTelemetrySink([
    {
      label: "flaky",
      retries: 1,
      sink: {
        async record(): Promise<void> {
          flakyAttempts += 1;

          if (flakyAttempts === 1) {
            throw new Error("retry_once");
          }
        }
      }
    },
    {
      label: "slow",
      timeoutMs: 5,
      sink: {
        async record(): Promise<void> {
          await waitForever();
        }
      }
    },
    second
  ], {
    failurePolicy: "best_effort",
    metricsCollector: metrics
  });

  await sink.record({
    level: "warn",
    message: "fanout-metrics",
    correlationId: "fanout-5"
  });

  const snapshot = await metrics.loadSnapshot();

  assert.equal(snapshot.totals.events, 1);
  assert.equal(snapshot.totals.targetedSinks, 3);
  assert.equal(snapshot.totals.attempts, 4);
  assert.equal(snapshot.totals.successes, 2);
  assert.equal(snapshot.totals.failures, 2);
  assert.equal(snapshot.totals.timeouts, 1);
  assert.equal(snapshot.totals.retries, 1);
  assert.equal(snapshot.sinks.length, 3);
  assert.equal(snapshot.sinks[0]?.sinkLabel, "flaky");
  assert.equal(snapshot.sinks[0]?.attempts, 2);
  assert.equal(snapshot.sinks[0]?.retries, 1);
  assert.equal(snapshot.sinks[1]?.sinkLabel, "slow");
  assert.equal(snapshot.sinks[1]?.timeouts, 1);
  assert.match(snapshot.sinks[1]?.lastError ?? "", /^telemetry_sink_timeout:/);
  assert.equal(snapshot.sinks[2]?.sinkLabel, undefined);
  assert.equal(snapshot.sinks[2]?.successes, 1);
});

test("telemetry delivery alert helpers evaluate thresholds and emit alert log events", async () => {
  const metrics = createRecordingTelemetryDeliveryMetricsCollector();
  const second = createRecordingTelemetrySink();
  const sink = createFanoutTelemetrySink([
    {
      label: "slow",
      timeoutMs: 5,
      sink: {
        async record(): Promise<void> {
          await waitForever();
        }
      }
    },
    second
  ], {
    failurePolicy: "best_effort",
    metricsCollector: metrics
  });

  await sink.record({
    level: "warn",
    message: "fanout-alerts",
    correlationId: "fanout-6"
  });

  const snapshot = await metrics.loadSnapshot();
  const alerts = evaluateTelemetryDeliveryAlerts(snapshot, {
    error: {
      totals: {
        timeouts: 0
      }
    },
    warn: {
      perSink: {
        failureRate: 0.5
      }
    }
  });
  const alertEvents = createTelemetryDeliveryAlertLogEvents(alerts, {
    taskId: "obs-alerts"
  });

  assert.equal(alerts.length, 2);
  assert.equal(alerts[0]?.level, "error");
  assert.equal(alerts[0]?.scope, "totals");
  assert.equal(alerts[0]?.metric, "timeouts");
  assert.equal(alerts[1]?.level, "warn");
  assert.equal(alerts[1]?.scope, "sink");
  assert.equal(alerts[1]?.sinkLabel, "slow");
  assert.equal(alertEvents.length, 2);
  assert.equal(alertEvents[0]?.level, "error");
  assert.equal(alertEvents[0]?.context?.taskId, "obs-alerts");
});
