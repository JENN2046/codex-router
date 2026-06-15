#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_CODEX_CLI_MODEL_PROBE_MODEL,
  type CodexCliReadOnlySmokeResult,
  type CodexCliReadOnlySmokeRunOptions,
  runCodexCliReadOnlySmoke
} from "../packages/codex-cli-host/src/index.js";

export const ALLOW_REAL_CODEX_CLI_READONLY_SMOKE_ENV =
  "ALLOW_REAL_CODEX_CLI_READONLY_SMOKE";
export const DEFAULT_REAL_CODEX_CLI_READONLY_SMOKE_EVIDENCE_PATH =
  "docs/evidence/codex-cli-real-readonly-smoke.json";

export interface RealCodexCliReadOnlySmokeScriptOptions {
  env?: NodeJS.ProcessEnv;
  generatedAt?: string;
  evidencePath?: string;
  runSmoke?: (
    options: CodexCliReadOnlySmokeRunOptions
  ) => Promise<CodexCliReadOnlySmokeResult>;
}

export interface RealCodexCliReadOnlySmokeScriptReceipt {
  evidence: RealCodexCliReadOnlySmokeEvidence;
  write: {
    path: string;
    bytes: number;
  };
  exitCode: 0 | 1;
}

export interface RealCodexCliReadOnlySmokeEvidence {
  schemaVersion: "codex-cli-real-readonly-smoke-gate.v1";
  generatedAt: string;
  mode: "real-readonly-smoke";
  status: "passed" | "failed" | "blocked";
  taskId?: string;
  checks: {
    operatorFlagPresent: boolean;
    runnerInvoked: boolean;
    readOnlySandbox: boolean;
    approvalPolicyNever: boolean;
    noWorkspaceWrite: boolean;
    noFileWrite: boolean;
    timeoutConfigured: boolean;
    sanitizedEvidence: true;
  };
  plan?: {
    sandbox: "read-only";
    approvalPolicy: "never";
    usesJson: boolean;
    skipGitRepoCheck: boolean;
    ephemeral: boolean;
    timeoutMs: number;
    model?: string;
    workdir?: string;
  };
  run: {
    exitCode?: number;
    status?: string;
    eventCount: number;
    parseErrorCount: number;
    warningCount: number;
    blockingReasons: string[];
    timedOut?: boolean;
    killed?: boolean;
  };
  summary: {
    passed: boolean;
    blockingReasons: string[];
  };
}

export async function runRealCodexCliReadOnlySmokeScript(
  options: RealCodexCliReadOnlySmokeScriptOptions = {}
): Promise<RealCodexCliReadOnlySmokeScriptReceipt> {
  const env = options.env ?? process.env;
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const evidencePath = options.evidencePath
    ?? env.CODEX_CLI_REAL_READONLY_SMOKE_EVIDENCE_PATH
    ?? DEFAULT_REAL_CODEX_CLI_READONLY_SMOKE_EVIDENCE_PATH;
  const timeoutMs = parsePositiveInteger(
    env.CODEX_CLI_REAL_READONLY_SMOKE_TIMEOUT_MS,
    180_000
  );
  const operatorFlagPresent = env[ALLOW_REAL_CODEX_CLI_READONLY_SMOKE_ENV] === "1";

  if (!operatorFlagPresent) {
    const evidence = createBlockedRealCodexCliReadOnlySmokeEvidence({
      generatedAt,
      timeoutMs
    });
    const write = await writeRealCodexCliReadOnlySmokeEvidence(evidence, evidencePath);
    return {
      evidence,
      write,
      exitCode: 1
    };
  }

  const runSmoke = options.runSmoke ?? runCodexCliReadOnlySmoke;
  const result = await runSmoke({
    taskOptions: {
      taskId: env.CODEX_CLI_REAL_READONLY_SMOKE_TASK_ID
        ?? "codex-cli-real-readonly-smoke",
      repoRoot: env.CODEX_CLI_REAL_READONLY_SMOKE_CWD ?? process.cwd()
    },
    planOptions: {
      model: env.CODEX_CLI_REAL_READONLY_SMOKE_MODEL
        ?? DEFAULT_CODEX_CLI_MODEL_PROBE_MODEL,
      ephemeral: true,
      ...(env.CODEX_CLI_REAL_READONLY_SMOKE_COMMAND !== undefined
        ? { codexCommand: env.CODEX_CLI_REAL_READONLY_SMOKE_COMMAND }
        : {}),
      ...(env.CODEX_CLI_REAL_READONLY_SMOKE_CWD !== undefined
        ? { cwd: env.CODEX_CLI_REAL_READONLY_SMOKE_CWD }
        : {})
    },
    timeoutMs
  });
  const evidence = createRealCodexCliReadOnlySmokeEvidence({
    generatedAt,
    operatorFlagPresent,
    timeoutMs,
    result
  });
  const write = await writeRealCodexCliReadOnlySmokeEvidence(evidence, evidencePath);

  return {
    evidence,
    write,
    exitCode: evidence.status === "passed" ? 0 : 1
  };
}

function createBlockedRealCodexCliReadOnlySmokeEvidence(input: {
  generatedAt: string;
  timeoutMs: number;
}): RealCodexCliReadOnlySmokeEvidence {
  const blockingReasons = ["codex_cli_real_readonly_smoke_requires_operator_flag"];
  return {
    schemaVersion: "codex-cli-real-readonly-smoke-gate.v1",
    generatedAt: input.generatedAt,
    mode: "real-readonly-smoke",
    status: "blocked",
    checks: {
      operatorFlagPresent: false,
      runnerInvoked: false,
      readOnlySandbox: false,
      approvalPolicyNever: false,
      noWorkspaceWrite: true,
      noFileWrite: true,
      timeoutConfigured: input.timeoutMs > 0,
      sanitizedEvidence: true
    },
    run: {
      eventCount: 0,
      parseErrorCount: 0,
      warningCount: 0,
      blockingReasons
    },
    summary: {
      passed: false,
      blockingReasons
    }
  };
}

function createRealCodexCliReadOnlySmokeEvidence(input: {
  generatedAt: string;
  operatorFlagPresent: boolean;
  timeoutMs: number;
  result: CodexCliReadOnlySmokeResult;
}): RealCodexCliReadOnlySmokeEvidence {
  const inspection = input.result.run?.inspection;
  const blockingReasons = uniqueStrings([
    ...input.result.validationBlockers,
    ...(inspection?.blockingReasons ?? []),
    ...(input.result.error ? [`codex_cli_process_error:${input.result.error}`] : [])
  ]);
  const readOnlySandbox = input.result.plan.sandbox === "read-only";
  const approvalPolicyNever = input.result.plan.approvalPolicy === "never";

  return {
    schemaVersion: "codex-cli-real-readonly-smoke-gate.v1",
    generatedAt: input.generatedAt,
    mode: "real-readonly-smoke",
    status: input.result.status,
    taskId: input.result.task.taskId,
    checks: {
      operatorFlagPresent: input.operatorFlagPresent,
      runnerInvoked: true,
      readOnlySandbox,
      approvalPolicyNever,
      noWorkspaceWrite: readOnlySandbox,
      noFileWrite: readOnlySandbox,
      timeoutConfigured: input.timeoutMs > 0,
      sanitizedEvidence: true
    },
    plan: {
      sandbox: "read-only",
      approvalPolicy: "never",
      usesJson: input.result.plan.args.includes("--json"),
      skipGitRepoCheck: input.result.plan.args.includes("--skip-git-repo-check"),
      ephemeral: input.result.plan.args.includes("--ephemeral"),
      timeoutMs: input.timeoutMs,
      ...(input.result.plan.model !== undefined ? { model: input.result.plan.model } : {}),
      ...(input.result.plan.workdir !== undefined ? { workdir: input.result.plan.workdir } : {})
    },
    run: {
      ...(input.result.run?.output.exitCode !== undefined
        ? { exitCode: input.result.run.output.exitCode }
        : {}),
      ...(inspection?.status !== undefined ? { status: inspection.status } : {}),
      eventCount: inspection?.events.length ?? 0,
      parseErrorCount: inspection?.parseErrors.length ?? 0,
      warningCount: inspection?.warnings.length ?? 0,
      blockingReasons,
      ...(input.result.run?.timedOut !== undefined ? { timedOut: input.result.run.timedOut } : {}),
      ...(input.result.run?.killed !== undefined ? { killed: input.result.run.killed } : {})
    },
    summary: {
      passed: input.result.status === "passed",
      blockingReasons
    }
  };
}

async function writeRealCodexCliReadOnlySmokeEvidence(
  evidence: RealCodexCliReadOnlySmokeEvidence,
  path: string
): Promise<{ path: string; bytes: number }> {
  const content = `${JSON.stringify(evidence, null, 2)}\n`;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");

  return {
    path,
    bytes: Buffer.byteLength(content, "utf8")
  };
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runRealCodexCliReadOnlySmokeScript()
    .then((receipt) => {
      console.log(`Codex CLI real read-only smoke: ${receipt.evidence.status}`);
      console.log(`evidence: ${receipt.write.path}`);
      process.exitCode = receipt.exitCode;
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
