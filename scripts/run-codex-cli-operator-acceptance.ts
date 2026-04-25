import {
  CODEX_CLI_WORKSPACE_WRITE_SMOKE_CONFIRMATION,
  DEFAULT_CODEX_CLI_MODEL_PROBE_MODEL,
  runAndWriteCodexCliOperatorAcceptanceEvidence,
  type CodexCliExecPlanOptions
} from "../packages/codex-cli-host/src/index.js";
import type { TaskEnvelopeInput } from "../packages/contracts/src/index.js";

type AcceptanceMode = "read-only" | "workspace-write";

const mode = resolveMode(process.env.CODEX_CLI_OPERATOR_ACCEPTANCE_MODE);
const model = process.env.CODEX_CLI_OPERATOR_ACCEPTANCE_MODEL
  ?? DEFAULT_CODEX_CLI_MODEL_PROBE_MODEL;
const evidencePath = process.env.CODEX_CLI_OPERATOR_ACCEPTANCE_EVIDENCE_PATH
  ?? resolveDefaultEvidencePath(mode);
const modelProbeTimeoutMs = resolvePositiveInteger(
  process.env.CODEX_CLI_OPERATOR_ACCEPTANCE_MODEL_PROBE_TIMEOUT_MS,
  420_000
);
const allowWrite = process.env.CODEX_CLI_OPERATOR_ACCEPTANCE_ALLOW_WRITE === "true";
const confirmation = process.env.CODEX_CLI_OPERATOR_ACCEPTANCE_CONFIRMATION;

if (
  mode === "workspace-write"
  && (!allowWrite || confirmation !== CODEX_CLI_WORKSPACE_WRITE_SMOKE_CONFIRMATION)
) {
  console.error("Codex CLI operator acceptance workspace-write mode is gated.");
  console.error("Set both of these before running workspace-write acceptance:");
  console.error("  CODEX_CLI_OPERATOR_ACCEPTANCE_ALLOW_WRITE=true");
  console.error(`  CODEX_CLI_OPERATOR_ACCEPTANCE_CONFIRMATION=${CODEX_CLI_WORKSPACE_WRITE_SMOKE_CONFIRMATION}`);
  process.exitCode = 1;
} else {
  try {
    const { evidence, write } = await runAndWriteCodexCliOperatorAcceptanceEvidence({
      evidencePath,
      task: createTask(mode),
      planOptions: createPlanOptions(mode),
      modelProbeTimeoutMs,
      ...(mode === "workspace-write" ? { allowWriteSandbox: true } : {}),
      evidenceOptions: {
        host: "Codex CLI operator acceptance",
        notes: [
          `mode=${mode}`,
          `model=${model}`
        ]
      }
    });

    console.log("Codex CLI operator acceptance");
    console.log(`mode: ${mode}`);
    console.log(`status: ${evidence.status}`);
    console.log(`model: ${evidence.plan.model ?? model}`);
    console.log(`telemetry: ${evidence.summary.telemetryMessages.join(", ") || "(none)"}`);
    console.log(`evidence: ${write.path}`);

    if (evidence.status !== "passed") {
      process.exitCode = 1;
    }
  } catch {
    console.error("Codex CLI operator acceptance failed");
    process.exitCode = 1;
  }
}

function resolveMode(input: string | undefined): AcceptanceMode {
  return input === "workspace-write" ? "workspace-write" : "read-only";
}

function resolveDefaultEvidencePath(modeValue: AcceptanceMode): string {
  return modeValue === "workspace-write"
    ? "docs/evidence/codex-cli-operator-acceptance-workspace-write-latest.json"
    : "docs/evidence/codex-cli-operator-acceptance-readonly-latest.json";
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
      taskId: "codex-cli-operator-acceptance-workspace-write",
      source: "cli",
      intent: {
        summary: "perform a bounded operator acceptance write",
        requestedAction: "update the bounded acceptance evidence file and report the result",
        successCriteria: [
          "codex exec completes under workspace-write governance",
          "the bounded target file is the only write target"
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
        tags: ["codex-cli-host", "operator-acceptance", "workspace-write"]
      }
    };
  }

  return {
    taskId: "codex-cli-operator-acceptance-readonly",
    source: "cli",
    intent: {
      summary: "perform a bounded operator acceptance inspection",
      requestedAction: "inspect codex router readiness without editing files",
      successCriteria: [
        "codex exec completes under read-only governance",
        "stdout is captured as structured JSONL evidence"
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
      tags: ["codex-cli-host", "operator-acceptance", "read-only"]
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
    ...(process.env.CODEX_CLI_OPERATOR_ACCEPTANCE_CODEX_COMMAND !== undefined
      ? { codexCommand: process.env.CODEX_CLI_OPERATOR_ACCEPTANCE_CODEX_COMMAND }
      : {}),
    ...(process.env.CODEX_CLI_OPERATOR_ACCEPTANCE_CWD !== undefined
      ? { cwd: process.env.CODEX_CLI_OPERATOR_ACCEPTANCE_CWD }
      : {})
  };
}
