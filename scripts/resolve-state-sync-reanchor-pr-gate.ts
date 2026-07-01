#!/usr/bin/env node

import { appendFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  parseStateSyncClaim,
  parseStateSyncPolicyV2Claim
} from "../packages/state-sync-audit/src/index.js";

const STATE_SYNC_RECORD_DOC = "docs/current/state-sync-record.json";

export interface StateSyncReanchorPrGateResult {
  runReanchor: boolean;
  reason: "already_reanchored" | "needs_reanchor" | "policy_v2_no_reanchor";
  branch: string;
  upstream: string;
  transition: string;
}

export async function resolveStateSyncReanchorPrGate(
  cwd = process.cwd()
): Promise<StateSyncReanchorPrGateResult> {
  const claimText = await readFile(
    join(cwd, STATE_SYNC_RECORD_DOC),
    "utf8"
  ).catch(() => undefined);
  const parsed = parseStateSyncClaim(claimText);
  if (parsed.status !== "valid") {
    const parsedPolicyV2 = parseStateSyncPolicyV2Claim(claimText);
    if (parsedPolicyV2.status === "valid") {
      return {
        runReanchor: false,
        reason: "policy_v2_no_reanchor",
        branch: "content-attestation",
        upstream: "refs/remotes/origin/main",
        transition: parsedPolicyV2.claim.policyVersion
      };
    }

    throw new Error(
      `Cannot resolve state-sync reanchor gate from ${parsed.status} claim`
    );
  }

  const alreadyReanchored =
    parsed.claim.subject.branch === "main"
    && parsed.claim.subject.upstream === "refs/remotes/origin/main"
    && parsed.claim.transition.kind === "state_only_pushed";

  return {
    runReanchor: !alreadyReanchored,
    reason: alreadyReanchored ? "already_reanchored" : "needs_reanchor",
    branch: parsed.claim.subject.branch,
    upstream: parsed.claim.subject.upstream,
    transition: parsed.claim.transition.kind
  };
}

function writeGitHubOutput(result: StateSyncReanchorPrGateResult): void {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (outputPath === undefined || outputPath.trim() === "") {
    return;
  }

  appendFileSync(
    outputPath,
    [
      `run_reanchor=${result.runReanchor ? "true" : "false"}`,
      `reason=${result.reason}`,
      ""
    ].join("\n")
  );
}

async function main(): Promise<void> {
  const result = await resolveStateSyncReanchorPrGate();
  console.log(JSON.stringify(result, null, 2));
  writeGitHubOutput(result);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      "State-sync reanchor PR gate failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
