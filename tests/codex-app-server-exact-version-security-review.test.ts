import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  evaluateCodexAppServerExactVersionSecurityEvidence
} from "../scripts/lib/codex-app-server-exact-version-security-review.js";

const EVIDENCE = new URL(
  "../docs/evidence/app-server-exact-version-security-review-0.144.1.json",
  import.meta.url
);

async function evidence(): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(EVIDENCE, "utf8")) as Record<string, unknown>;
}

function assertInvalid(input: unknown, label?: string): void {
  const result = evaluateCodexAppServerExactVersionSecurityEvidence(input);
  assert.equal(result.status, "blocked", label);
  assert.equal(result.disposition, "no_go", label);
  assert.equal(result.reviewComplete, false, label);
  assert.equal(result.receiptMatchesExpectedLiterals, false, label);
  assert.equal(result.installedArtifactBound, false, label);
  assert.equal(result.sourceCommitBound, false, label);
  assert.equal(result.generatedSchemaBound, false, label);
  assert.equal(result.liveSmokeEligible, false, label);
  assert.equal(result.existingLiveSmokePreflightMayBeRelaxed, false, label);
  assert.equal(result.realWorkspaceWriteSmokeAuthorized, false, label);
  assert.deepEqual(result.reasons, ["exact_version_security_evidence_invalid"], label);
}

test("exact installed-version review completes with a permanent no-go disposition", async () => {
  const result = evaluateCodexAppServerExactVersionSecurityEvidence(await evidence());

  assert.equal(result.status, "blocked");
  assert.equal(result.disposition, "no_go");
  assert.equal(result.reviewComplete, true);
  assert.equal(result.receiptMatchesExpectedLiterals, true);
  assert.equal(result.installedArtifactBound, false);
  assert.equal(result.sourceCommitBound, false);
  assert.equal(result.generatedSchemaBound, false);
  assert.equal(result.exactEffectiveConfigurationBound, false);
  assert.equal(result.proposalBeforeApplyRuntimeOrderProven, false);
  assert.equal(result.liveSmokeEligible, false);
  assert.equal(result.existingLiveSmokePreflightMayBeRelaxed, false);
  assert.equal(result.realWorkspaceWriteSmokeAuthorized, false);
  assert.ok(result.reasons.includes("no_client_controlled_delayed_apply_contract"));
  assert.ok(result.reasons.includes("current_installed_artifact_not_reverified_by_receipt_checker"));
  assert.ok(result.reasons.includes("permission_resolution_not_observed"));
  assert.ok(result.reasons.includes("hook_runtime_state_not_bound"));
  assert.ok(result.reasons.includes("live_workspace_write_smoke_remains_prohibited"));
  assert.deepEqual(result.evaluationSideEffects, {
    codexBinaryExecuted: false,
    appServerStarted: false,
    liveClientConnected: false,
    providerCalled: false,
    workspaceWriteAttempted: false
  });
});

test("artifact, source, schema, runtime, and side-effect claim drift fails closed", async () => {
  for (const mutate of [
    (input: Record<string, unknown>) => {
      (input.installedArtifact as Record<string, unknown>).packageVersion = "0.144.2";
    },
    (input: Record<string, unknown>) => {
      (input.installedArtifact as Record<string, unknown>).binarySha256 = "0".repeat(64);
    },
    (input: Record<string, unknown>) => {
      (input.installedArtifact as Record<string, unknown>).installedBinaryMatchObserved = false;
    },
    (input: Record<string, unknown>) => {
      (input.source as Record<string, unknown>).commit = "0".repeat(40);
    },
    (input: Record<string, unknown>) => {
      const source = input.source as Record<string, unknown>;
      (source.files as Record<string, unknown>)["codex-rs/core/src/safety.rs"] = "0".repeat(64);
    },
    (input: Record<string, unknown>) => {
      const schema = input.generatedSchema as Record<string, unknown>;
      (schema.semanticSha256 as Record<string, unknown>).v2Bundle = "0".repeat(64);
    },
    (input: Record<string, unknown>) => {
      (input.runtimeBinding as Record<string, unknown>).exactEffectiveConfigurationBound = true;
    },
    (input: Record<string, unknown>) => {
      (input.evaluationSideEffects as Record<string, unknown>).appServerStarted = true;
    }
  ]) {
    const input = await evidence();
    mutate(input);
    assertInvalid(input);
  }
});

test("extra keys, accessors, arrays, cycles, and hostile proxies fail closed", async () => {
  const extra = await evidence();
  extra.untrusted = true;
  assertInvalid(extra, "extra key");
  assertInvalid([], "array");

  let getterRead = false;
  const accessor = Object.defineProperty({}, "schemaVersion", {
    enumerable: true,
    get() {
      getterRead = true;
      return "codex-app-server-exact-version-security-evidence.v1";
    }
  });
  assertInvalid(accessor, "accessor");
  assert.equal(getterRead, false);

  const cycle: Record<string, unknown> = {};
  cycle.self = cycle;
  assertInvalid(cycle, "cycle");

  const proxy = new Proxy({}, {
    ownKeys() {
      throw new Error("no reflection");
    }
  });
  assert.doesNotThrow(() => evaluateCodexAppServerExactVersionSecurityEvidence(proxy));
  assertInvalid(proxy, "proxy");
});

test("exact-version audit succeeds only by reporting the reviewed environment as blocked", () => {
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", "scripts/run-codex-app-server-exact-version-security-review.ts"],
    { cwd: process.cwd(), encoding: "utf8" }
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  const output = JSON.parse(result.stdout) as {
    status: string;
    disposition: string;
    reviewComplete: boolean;
    liveSmokeEligible: boolean;
    realWorkspaceWriteSmokeAuthorized: boolean;
  };
  assert.equal(output.status, "blocked");
  assert.equal(output.disposition, "no_go");
  assert.equal(output.reviewComplete, true);
  assert.equal(output.liveSmokeEligible, false);
  assert.equal(output.realWorkspaceWriteSmokeAuthorized, false);
});

test("exact-version audit exits non-zero for a tampered evidence receipt", async () => {
  const input = await evidence();
  (input.source as Record<string, unknown>).tag = "rust-v0.144.2";
  const directory = await mkdtemp(join(tmpdir(), "codex-router-exact-review-"));
  const path = join(directory, "tampered.json");
  try {
    await writeFile(path, JSON.stringify(input), { mode: 0o600 });
    const result = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "scripts/run-codex-app-server-exact-version-security-review.ts",
        path
      ],
      { cwd: process.cwd(), encoding: "utf8" }
    );

    assert.equal(result.status, 1, result.stderr);
    assert.equal(result.stderr, "");
    const output = JSON.parse(result.stdout) as {
      reviewComplete: boolean;
      liveSmokeEligible: boolean;
      reasons: string[];
    };
    assert.equal(output.reviewComplete, false);
    assert.equal(output.liveSmokeEligible, false);
    assert.deepEqual(output.reasons, ["exact_version_security_evidence_invalid"]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
