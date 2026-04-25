import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { createRecordingTelemetrySink } from "../packages/observability/src/index.js";
import {
  DEFAULT_CODEX_CLI_MODEL_PROBE_MODEL,
  clearCodexCliModelProbeCache,
  runCodexCliReadOnlySmoke
} from "../packages/codex-cli-host/src/index.js";

const evidencePath = process.env.CODEX_CLI_SMOKE_TELEMETRY_EVIDENCE_PATH
  ?? "docs/evidence/codex-cli-readonly-smoke-telemetry-latest.json";
const model = process.env.CODEX_CLI_SMOKE_TELEMETRY_MODEL
  ?? DEFAULT_CODEX_CLI_MODEL_PROBE_MODEL;

clearCodexCliModelProbeCache();

try {
  const telemetryStore = createRecordingTelemetrySink();
  const first = await runCodexCliReadOnlySmoke({
    telemetryStore,
    planOptions: resolvePlanOptions()
  });
  const second = await runCodexCliReadOnlySmoke({
    telemetryStore,
    planOptions: resolvePlanOptions()
  });
  const telemetryEvents = await telemetryStore.loadAll();
  const telemetryMessages = telemetryEvents.map((event) => event.message);
  const evidence = {
    schemaVersion: "codex-cli-readonly-smoke-telemetry-acceptance.v1",
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
  await writeFile(`${evidencePath}`, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");

  console.log("Codex CLI read-only smoke telemetry acceptance");
  console.log(`model: ${model}`);
  console.log(`first run: ${first.status}`);
  console.log(`second run: ${second.status}`);
  console.log(`telemetry events: ${telemetryMessages.join(", ") || "(none)"}`);
  console.log(`evidence: ${evidencePath}`);

  if (!evidence.summary.passed) {
    process.exitCode = 1;
  }
} catch {
  console.error("Codex CLI read-only smoke telemetry acceptance failed");
  process.exitCode = 1;
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
    ...(process.env.CODEX_CLI_SMOKE_TELEMETRY_CODEX_COMMAND !== undefined
      ? { codexCommand: process.env.CODEX_CLI_SMOKE_TELEMETRY_CODEX_COMMAND }
      : {}),
    ...(process.env.CODEX_CLI_SMOKE_TELEMETRY_CWD !== undefined
      ? { cwd: process.env.CODEX_CLI_SMOKE_TELEMETRY_CWD }
      : {})
  };
}

function summarizeRun(
  label: "first" | "second",
  result: Awaited<ReturnType<typeof runCodexCliReadOnlySmoke>>
): {
  label: "first" | "second";
  status: string;
  executionStatus?: string;
  exitCode?: number;
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
    blockingReasons: [
      ...result.validationBlockers,
      ...(result.run?.inspection.blockingReasons ?? []),
      ...(result.error ? [`codex_cli_process_error:${result.error}`] : [])
    ]
  };
}
