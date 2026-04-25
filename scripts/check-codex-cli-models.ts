import {
  DEFAULT_CODEX_CLI_MODEL_PROBE_MODEL,
  runAndWriteCodexCliModelCheckEvidence,
  runAndWriteCodexCliModelCliProbeEvidence,
  type CodexCliModelCheckMode
} from "../packages/codex-cli-host/src/index.js";

type ModelCheckSource = "cli" | "catalog";

const source = resolveSource(process.env.CODEX_CLI_MODEL_CHECK_SOURCE);
const mode = resolveMode(process.env.CODEX_CLI_MODEL_CHECK_MODE);
const evidencePath = process.env.CODEX_CLI_MODEL_CHECK_EVIDENCE_PATH
  ?? "docs/evidence/codex-cli-model-check-latest.json";

try {
  if (source === "catalog") {
    const { evidence, write } = await runAndWriteCodexCliModelCheckEvidence({
      evidencePath,
      strict: mode === "strict",
      ...(process.env.OPENAI_API_KEY !== undefined
        ? { apiKey: process.env.OPENAI_API_KEY }
        : {}),
      ...(process.env.OPENAI_BASE_URL !== undefined
        ? { baseUrl: process.env.OPENAI_BASE_URL }
        : {})
    });

    printCatalogResult(evidence, write.path);
    if (evidence.status === "failed") {
      process.exitCode = 1;
    }
  } else {
    const { evidence, write } = await runAndWriteCodexCliModelCliProbeEvidence({
      evidencePath,
      strict: mode === "strict",
      ...(process.env.CODEX_CLI_MODEL_CHECK_MODEL !== undefined
        ? { model: process.env.CODEX_CLI_MODEL_CHECK_MODEL }
        : {}),
      ...(process.env.CODEX_CLI_MODEL_CHECK_CODEX_COMMAND !== undefined
        ? { codexCommand: process.env.CODEX_CLI_MODEL_CHECK_CODEX_COMMAND }
        : {}),
      ...(process.env.CODEX_CLI_MODEL_CHECK_CWD !== undefined
        ? { cwd: process.env.CODEX_CLI_MODEL_CHECK_CWD }
        : {}),
      ...(process.env.CODEX_CLI_MODEL_CHECK_TIMEOUT_MS !== undefined
        ? { timeoutMs: Number(process.env.CODEX_CLI_MODEL_CHECK_TIMEOUT_MS) }
        : {})
    });

    printCliResult(evidence, write.path);
    if (evidence.status === "failed") {
      process.exitCode = 1;
    }
  }
} catch {
  console.error("Codex CLI model check failed: evidence write failed");
  process.exitCode = 1;
}

function resolveSource(input: string | undefined): ModelCheckSource {
  return input?.toLowerCase() === "catalog" ? "catalog" : "cli";
}

function resolveMode(input: string | undefined): CodexCliModelCheckMode {
  return input?.toLowerCase() === "warn" ? "warn" : "strict";
}

function printCatalogResult(
  evidence: Awaited<ReturnType<typeof runAndWriteCodexCliModelCheckEvidence>>["evidence"],
  path: string
): void {
  console.log("Codex CLI model check");
  console.log("source: catalog");
  console.log(`status: ${evidence.status}`);
  console.log(`mode: ${evidence.mode}`);
  console.log(`evidence: ${path}`);
  console.log(
    `known models: ${evidence.summary.availableKnownModelCount}/${evidence.summary.knownModelCount}`
  );
  console.log(`official model count: ${evidence.summary.officialModelCount}`);
  console.log(`missing known models: ${evidence.summary.missingKnownModelCount}`);
  console.log(`untracked official models: ${evidence.summary.untrackedOfficialModelCount}`);

  if (evidence.blockingReasons.length > 0) {
    console.log(`blocking reasons: ${evidence.blockingReasons.join(", ")}`);
  }

  if (evidence.warnings.length > 0) {
    console.log(`warnings: ${evidence.warnings.join(", ")}`);
  }
}

function printCliResult(
  evidence: Awaited<ReturnType<typeof runAndWriteCodexCliModelCliProbeEvidence>>["evidence"],
  path: string
): void {
  console.log("Codex CLI model check");
  console.log("source: cli");
  console.log(`status: ${evidence.status}`);
  console.log(`mode: ${evidence.mode}`);
  console.log(`model: ${evidence.model || DEFAULT_CODEX_CLI_MODEL_PROBE_MODEL}`);
  console.log(`evidence: ${path}`);

  if (evidence.run) {
    console.log(`exit code: ${evidence.run.exitCode}`);
    console.log(`events: ${evidence.run.eventCount}`);
    console.log(`parse errors: ${evidence.run.parseErrorCount}`);
  }

  if (evidence.blockingReasons.length > 0) {
    console.log(`blocking reasons: ${evidence.blockingReasons.join(", ")}`);
  }

  if (evidence.warnings.length > 0) {
    console.log(`warnings: ${evidence.warnings.join(", ")}`);
  }
}
