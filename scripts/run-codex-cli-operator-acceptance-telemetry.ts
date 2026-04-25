import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { createRecordingTelemetrySink } from "../packages/observability/src/index.js";
import {
  CODEX_CLI_WORKSPACE_WRITE_SMOKE_CONFIRMATION,
  DEFAULT_CODEX_CLI_MODEL_PROBE_MODEL,
  clearCodexCliModelProbeCache,
  createCodexCliOperatorAcceptanceEvidence,
  runCodexCliOperatorAcceptance,
  type CodexCliExecPlanOptions,
  type CodexCliOperatorAcceptanceEvidence,
  type CodexCliOperatorAcceptanceResult
} from "../packages/codex-cli-host/src/index.js";
import type { TaskEnvelopeInput } from "../packages/contracts/src/index.js";

type AcceptanceMode = "read-only" | "workspace-write";

const mode = resolveMode(process.env.CODEX_CLI_OPERATOR_ACCEPTANCE_TELEMETRY_MODE);
const model = process.env.CODEX_CLI_OPERATOR_ACCEPTANCE_TELEMETRY_MODEL
  ?? DEFAULT_CODEX_CLI_MODEL_PROBE_MODEL;
const evidencePath = process.env.CODEX_CLI_OPERATOR_ACCEPTANCE_TELEMETRY_EVIDENCE_PATH
  ?? resolveDefaultEvidencePath(mode);
const modelProbeTimeoutMs = resolvePositiveInteger(
  process.env.CODEX_CLI_OPERATOR_ACCEPTANCE_TELEMETRY_MODEL_PROBE_TIMEOUT_MS,
  420_000
);
const allowWrite = process.env.CODEX_CLI_OPERATOR_ACCEPTANCE_TELEMETRY_ALLOW_WRITE === "true";
const confirmation = process.env.CODEX_CLI_OPERATOR_ACCEPTANCE_TELEMETRY_CONFIRMATION;

if (
  mode === "workspace-write"
  && (!allowWrite || confirmation !== CODEX_CLI_WORKSPACE_WRITE_SMOKE_CONFIRMATION)
) {
  console.error("Codex CLI operator acceptance telemetry workspace-write mode is gated.");
  console.error("Set both of these before running workspace-write telemetry acceptance:");
  console.error("  CODEX_CLI_OPERATOR_ACCEPTANCE_TELEMETRY_ALLOW_WRITE=true");
  console.error(`  CODEX_CLI_OPERATOR_ACCEPTANCE_TELEMETRY_CONFIRMATION=${CODEX_CLI_WORKSPACE_WRITE_SMOKE_CONFIRMATION}`);
  process.exitCode = 1;
} else {
  clearCodexCliModelProbeCache();

  try {
    const telemetryStore = createRecordingTelemetrySink();
    const first = await runCodexCliOperatorAcceptance({
      task: createTask(mode),
      planOptions: createPlanOptions(mode),
      telemetryStore,
      modelProbeTimeoutMs,
      ...(mode === "workspace-write" ? { allowWriteSandbox: true } : {})
    });
    const second = await runCodexCliOperatorAcceptance({
      task: createTask(mode),
      planOptions: createPlanOptions(mode),
      telemetryStore,
      modelProbeTimeoutMs,
      ...(mode === "workspace-write" ? { allowWriteSandbox: true } : {})
    });
    const telemetryEvents = await telemetryStore.loadAll();
    const telemetryMessages = telemetryEvents.map((event) => event.message);
    const firstEvidence = createCodexCliOperatorAcceptanceEvidence(first, {
      host: "Codex CLI operator acceptance telemetry",
      notes: ["run=first", `mode=${mode}`, `model=${model}`]
    });
    const secondEvidence = createCodexCliOperatorAcceptanceEvidence(second, {
      host: "Codex CLI operator acceptance telemetry",
      notes: ["run=second", `mode=${mode}`, `model=${model}`]
    });
    const evidence = {
      schemaVersion: "codex-cli-operator-acceptance-telemetry.v1",
      generatedAt: new Date().toISOString(),
      host: "Codex CLI operator acceptance telemetry",
      mode,
      model,
      summary: {
        firstRunStatus: first.status,
        secondRunStatus: second.status,
        passed: first.status === "passed"
          && second.status === "passed"
          && telemetryMessages.includes("codex cli model probe cache miss")
          && telemetryMessages.includes("codex cli model probe cache hit"),
        telemetryMessages
      },
      telemetry: telemetryEvents.map((event) => ({
        level: event.level,
        message: event.message,
        context: event.context ?? {}
      })),
      runs: [
        summarizeRun("first", first, firstEvidence),
        summarizeRun("second", second, secondEvidence)
      ]
    };

    await mkdir(dirname(evidencePath), { recursive: true });
    await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");

    console.log("Codex CLI operator acceptance telemetry");
    console.log(`mode: ${mode}`);
    console.log(`model: ${model}`);
    console.log(`first run: ${first.status}`);
    console.log(`second run: ${second.status}`);
    console.log(`telemetry events: ${telemetryMessages.join(", ") || "(none)"}`);
    console.log(`evidence: ${evidencePath}`);

    if (!evidence.summary.passed) {
      process.exitCode = 1;
    }
  } catch {
    console.error("Codex CLI operator acceptance telemetry failed");
    process.exitCode = 1;
  }
}

function resolveMode(input: string | undefined): AcceptanceMode {
  return input === "workspace-write" ? "workspace-write" : "read-only";
}

function resolveDefaultEvidencePath(modeValue: AcceptanceMode): string {
  return modeValue === "workspace-write"
    ? "docs/evidence/codex-cli-operator-acceptance-telemetry-workspace-write-latest.json"
    : "docs/evidence/codex-cli-operator-acceptance-telemetry-readonly-latest.json";
}

function resolvePositiveInteger(input: string | undefined, fallback: number): number {
  if (input === undefined) {
    return fallback;
  }

  const parsed = Number.parseInt(input, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function createTask(modeValue: AcceptanceMode): TaskEnvelopeInput {
  if (modeValue === "workspace-write") {
    return {
      taskId: "codex-cli-operator-acceptance-telemetry-workspace-write",
      source: "cli",
      intent: {
        summary: "perform a bounded operator telemetry acceptance write",
        requestedAction: "update the bounded acceptance evidence file and report the result",
        successCriteria: [
          "codex exec completes under workspace-write governance",
          "the second operator run reuses the successful model probe cache"
        ],
        outOfScope: [
          "external writes",
          "release actions",
          "broad repository edits"
        ]
      },
      repoContext: {
        repoRoot: "A:/codex-router",
        worktreeClean: true
      },
      target: {
        branches: [],
        files: ["docs/evidence/codex-cli-workspace-write-smoke.txt"],
        modules: ["codex-cli-host"]
      },
      constraints: {},
      hints: {
        taskClassHint: "engineering",
        riskHints: [],
        tags: ["codex-cli-host", "operator-acceptance", "telemetry", "workspace-write"]
      }
    };
  }

  return {
    taskId: "codex-cli-operator-acceptance-telemetry-readonly",
    source: "cli",
    intent: {
      summary: "perform a bounded operator telemetry acceptance inspection",
      requestedAction: "inspect codex router readiness without editing files",
      successCriteria: [
        "codex exec completes under read-only governance",
        "the second operator run reuses the successful model probe cache"
      ],
      outOfScope: [
        "file edits",
        "external writes",
        "release actions"
      ]
    },
    repoContext: {
      repoRoot: "A:/codex-router",
      worktreeClean: true
    },
    target: {
      branches: [],
      files: ["README.md"],
      modules: ["codex-cli-host"]
    },
    constraints: {},
    hints: {
      taskClassHint: "read_only",
      riskHints: [],
      tags: ["codex-cli-host", "operator-acceptance", "telemetry", "read-only"]
    }
  };
}

function createPlanOptions(modeValue: AcceptanceMode): CodexCliExecPlanOptions {
  return {
    model,
    skipGitRepoCheck: true,
    ephemeral: true,
    ...(modeValue === "workspace-write"
      ? { sandbox: "workspace-write" as const, approvalPolicy: "on-request" as const }
      : { sandbox: "read-only" as const, approvalPolicy: "never" as const }),
    ...(process.env.CODEX_CLI_OPERATOR_ACCEPTANCE_TELEMETRY_CODEX_COMMAND !== undefined
      ? { codexCommand: process.env.CODEX_CLI_OPERATOR_ACCEPTANCE_TELEMETRY_CODEX_COMMAND }
      : {}),
    ...(process.env.CODEX_CLI_OPERATOR_ACCEPTANCE_TELEMETRY_CWD !== undefined
      ? { cwd: process.env.CODEX_CLI_OPERATOR_ACCEPTANCE_TELEMETRY_CWD }
      : {})
  };
}

function summarizeRun(
  label: "first" | "second",
  result: CodexCliOperatorAcceptanceResult,
  evidence: CodexCliOperatorAcceptanceEvidence
): {
  label: "first" | "second";
  status: string;
  taskId: string;
  plan: CodexCliOperatorAcceptanceEvidence["plan"];
  run: CodexCliOperatorAcceptanceEvidence["run"];
  summary: CodexCliOperatorAcceptanceEvidence["summary"];
} {
  return {
    label,
    status: result.status,
    taskId: evidence.taskId,
    plan: evidence.plan,
    run: evidence.run,
    summary: evidence.summary
  };
}
