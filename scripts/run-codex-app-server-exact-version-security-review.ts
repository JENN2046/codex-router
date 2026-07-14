#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { evaluateCodexAppServerExactVersionSecurityEvidence } from "./lib/codex-app-server-exact-version-security-review.js";

export const DEFAULT_EXACT_VERSION_SECURITY_EVIDENCE =
  "docs/evidence/app-server-exact-version-security-review-0.144.1.json";

export async function runCodexAppServerExactVersionSecurityReview(
  evidencePath = DEFAULT_EXACT_VERSION_SECURITY_EVIDENCE,
  cwd = process.cwd()
) {
  const raw = JSON.parse(await readFile(resolve(cwd, evidencePath), "utf8")) as unknown;
  return evaluateCodexAppServerExactVersionSecurityEvidence(raw);
}

async function main(): Promise<void> {
  const evidencePath = process.argv[2] ?? DEFAULT_EXACT_VERSION_SECURITY_EVIDENCE;
  const assessment = await runCodexAppServerExactVersionSecurityReview(evidencePath);
  process.stdout.write(`${JSON.stringify(assessment, null, 2)}\n`);
  process.exitCode = assessment.reviewComplete && !assessment.liveSmokeEligible ? 0 : 1;
}

const invokedPath = process.argv[1];
if (
  invokedPath !== undefined
  && pathToFileURL(resolve(invokedPath)).href === import.meta.url
) {
  await main();
}
