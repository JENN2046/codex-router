#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  checkCodexCliEnvironmentPreflight
} from "../packages/codex-cli-host/src/index.js";

const DEFAULT_EVIDENCE_PATH = "docs/evidence/codex-cli-environment-preflight.json";
const ALLOW_REAL_PREFLIGHT_ENV = "ALLOW_REAL_CODEX_CLI_ENV_PREFLIGHT";

async function main(): Promise<void> {
  const evidencePath = process.env.CODEX_CLI_ENV_PREFLIGHT_EVIDENCE_PATH
    ?? DEFAULT_EVIDENCE_PATH;
  const allowRealCodexCli = process.env[ALLOW_REAL_PREFLIGHT_ENV] === "1";
  const result = await checkCodexCliEnvironmentPreflight({
    codexCommand: process.env.CODEX_CLI_ENV_PREFLIGHT_COMMAND ?? "codex",
    cwd: process.cwd(),
    timeoutMs: Number(process.env.CODEX_CLI_ENV_PREFLIGHT_TIMEOUT_MS ?? "10000"),
    allowRealCodexCli
  });

  await mkdir(dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify(result, null, 2)}\n`, "utf8");

  if (result.status !== "ready") {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
