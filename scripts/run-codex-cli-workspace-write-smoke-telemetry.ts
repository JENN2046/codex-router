import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { createRecordingTelemetrySink } from "../packages/observability/src/index.js";
import {
  CODEX_CLI_WORKSPACE_WRITE_SMOKE_CONFIRMATION,
  DEFAULT_CODEX_CLI_MODEL_PROBE_MODEL,
  clearCodexCliModelProbeCache,
  runCodexCliWorkspaceWriteSmoke
} from "../packages/codex-cli-host/src/index.js";

const evidencePath = process.env.CODEX_CLI_WORKSPACE_WRITE_SMOKE_TELEMETRY_EVIDENCE_PATH
  ?? "docs/evidence/codex-cli-workspace-write-smoke-telemetry-latest.json";
const model = process.env.CODEX_CLI_WORKSPACE_WRITE_SMOKE_TELEMETRY_MODEL
  ?? DEFAULT_CODEX_CLI_MODEL_PROBE_MODEL;
const confirmation = process.env.CODEX_CLI_WORKSPACE_WRITE_SMOKE_TELEMETRY_CONFIRMATION;
const allowWrite = process.env.CODEX_CLI_WORKSPACE_WRITE_SMOKE_TELEMETRY_ALLOW_WRITE === "true";
const timeoutMs = parsePositiveIntegerEnv(
  process.env.CODEX_CLI_WORKSPACE_WRITE_SMOKE_TELEMETRY_TIMEOUT_MS
);
const modelProbeTimeoutMs = parsePositiveIntegerEnv(
  process.env.CODEX_CLI_WORKSPACE_WRITE_SMOKE_TELEMETRY_MODEL_PROBE_TIMEOUT_MS
);
const terminationGraceMs = parsePositiveIntegerEnv(
  process.env.CODEX_CLI_WORKSPACE_WRITE_SMOKE_TELEMETRY_TERMINATION_GRACE_MS
);

if (!allowWrite || confirmation !== CODEX_CLI_WORKSPACE_WRITE_SMOKE_CONFIRMATION) {
  console.error("Codex CLI workspace-write smoke telemetry acceptance is gated.");
  console.error("Set both of these before running:");
  console.error("  CODEX_CLI_WORKSPACE_WRITE_SMOKE_TELEMETRY_ALLOW_WRITE=true");
  console.error(`  CODEX_CLI_WORKSPACE_WRITE_SMOKE_TELEMETRY_CONFIRMATION=${CODEX_CLI_WORKSPACE_WRITE_SMOKE_CONFIRMATION}`);
  process.exitCode = 1;
} else {
  clearCodexCliModelProbeCache();

  try {
    const telemetryStore = createRecordingTelemetrySink();
    const first = await runCodexCliWorkspaceWriteSmoke({
      telemetryStore,
      allowWriteSandbox: true,
      confirmation,
      planOptions: resolvePlanOptions(),
      ...(timeoutMs !== undefined ? { timeoutMs } : {}),
      ...(modelProbeTimeoutMs !== undefined ? { modelProbeTimeoutMs } : {}),
      ...(terminationGraceMs !== undefined ? { terminationGraceMs } : {})
    });
    const second = await runCodexCliWorkspaceWriteSmoke({
      telemetryStore,
      allowWriteSandbox: true,
      confirmation,
      planOptions: resolvePlanOptions(),
      ...(timeoutMs !== undefined ? { timeoutMs } : {}),
      ...(modelProbeTimeoutMs !== undefined ? { modelProbeTimeoutMs } : {}),
      ...(terminationGraceMs !== undefined ? { terminationGraceMs } : {})
    });
    const telemetryEvents = await telemetryStore.loadAll();
    const telemetryMessages = telemetryEvents.map((event) => event.message);
    const evidence = {
      schemaVersion: "codex-cli-workspace-write-smoke-telemetry-acceptance.v1",
      generatedAt: new Date().toISOString(),
      model,
      summary: {
        firstRunStatus: first.status,
        secondRunStatus: second.status,
        passed: first.status === "passed"
          && second.status === "passed"
          && telemetryMessages.includes("codex cli model probe cache miss")
          && telemetryMessages.includes("codex cli model probe cache hit")
      },
      telemetry: telemetryEvents.map((event) => ({
        level: event.level,
        message: event.message,
        context: event.context ?? {}
      })),
      runs: [
        summarizeRun("first", first),
        summarizeRun("second", second)
      ]
    };

    await mkdir(dirname(evidencePath), { recursive: true });
    await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");

    console.log("Codex CLI workspace-write smoke telemetry acceptance");
    console.log(`model: ${model}`);
    console.log(`first run: ${first.status}`);
    console.log(`second run: ${second.status}`);
    console.log(`telemetry events: ${telemetryMessages.join(", ") || "(none)"}`);
    console.log(`evidence: ${evidencePath}`);

    if (!evidence.summary.passed) {
      process.exitCode = 1;
    }
  } catch {
    console.error("Codex CLI workspace-write smoke telemetry acceptance failed");
    process.exitCode = 1;
  }
}

function parsePositiveIntegerEnv(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function resolvePlanOptions(): {
  model: string;
  codexCommand?: string;
  cwd?: string;
  skipGitRepoCheck: true;
  ephemeral: true;
} {
  return {
    model,
    skipGitRepoCheck: true,
    ephemeral: true,
    ...(process.env.CODEX_CLI_WORKSPACE_WRITE_SMOKE_TELEMETRY_CODEX_COMMAND !== undefined
      ? { codexCommand: process.env.CODEX_CLI_WORKSPACE_WRITE_SMOKE_TELEMETRY_CODEX_COMMAND }
      : {}),
    ...(process.env.CODEX_CLI_WORKSPACE_WRITE_SMOKE_TELEMETRY_CWD !== undefined
      ? { cwd: process.env.CODEX_CLI_WORKSPACE_WRITE_SMOKE_TELEMETRY_CWD }
      : {})
  };
}

function summarizeRun(
  label: "first" | "second",
  result: Awaited<ReturnType<typeof runCodexCliWorkspaceWriteSmoke>>
): {
  label: "first" | "second";
  status: string;
  executionStatus?: string;
  exitCode?: number;
  stdinClosed?: boolean;
  stdinDestroyed?: boolean;
  closeReceived?: boolean;
  forcedSettled?: boolean;
  stdioDestroyed?: boolean;
  unrefCalled?: boolean;
  terminationGraceMs?: number;
  terminationEscalated?: boolean;
  blockingReasons: string[];
} {
  return {
    label,
    status: result.status,
    ...(result.run?.inspection?.status !== undefined
      ? { executionStatus: result.run.inspection.status }
      : {}),
    ...(result.run?.output?.exitCode !== undefined
      ? { exitCode: result.run.output.exitCode }
      : {}),
    ...(result.run !== undefined
      ? {
          stdinClosed: result.run.lifecycle.stdin.closed,
          stdinDestroyed: result.run.lifecycle.stdin.destroyed,
          closeReceived: result.run.lifecycle.termination.closeReceived,
          forcedSettled: result.run.lifecycle.termination.forcedSettled,
          stdioDestroyed: result.run.lifecycle.termination.stdioDestroyed,
          unrefCalled: result.run.lifecycle.termination.unrefCalled,
          ...(result.run.lifecycle.termination.graceMs !== undefined
            ? { terminationGraceMs: result.run.lifecycle.termination.graceMs }
            : {}),
          terminationEscalated: result.run.lifecycle.termination.escalated
        }
      : {}),
    blockingReasons: [
      ...result.validationBlockers,
      ...(result.run?.inspection.blockingReasons ?? []),
      ...(result.error ? [`codex_cli_process_error:${result.error}`] : [])
    ]
  };
}
