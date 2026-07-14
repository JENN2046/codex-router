#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { evaluateCodexAppServerProposalCapabilityEvidence } from "./lib/codex-app-server-proposal-capability.js";

export const DEFAULT_PROPOSAL_CAPABILITY_FIXTURE =
  "tests/fixtures/codex-app-server/proposal-capability/read-only-on-request-5bed644.json";

export async function runCodexAppServerProposalCapabilityAudit(
  fixturePath = DEFAULT_PROPOSAL_CAPABILITY_FIXTURE,
  cwd = process.cwd()
) {
  const raw = JSON.parse(await readFile(resolve(cwd, fixturePath), "utf8")) as unknown;
  return evaluateCodexAppServerProposalCapabilityEvidence(raw);
}

async function main(): Promise<void> {
  const fixture = process.argv[2] ?? DEFAULT_PROPOSAL_CAPABILITY_FIXTURE;
  const assessment = await runCodexAppServerProposalCapabilityAudit(fixture);
  process.stdout.write(`${JSON.stringify(assessment, null, 2)}\n`);
  process.exitCode = assessment.sourceReviewConditionalPathIdentified ? 0 : 1;
}

const invokedPath = process.argv[1];
if (
  invokedPath !== undefined
  && pathToFileURL(resolve(invokedPath)).href === import.meta.url
) {
  await main();
}
