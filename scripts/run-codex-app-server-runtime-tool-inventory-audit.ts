#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createInMemoryRuntimeToolInventoryAttestationReplayStore,
  createTestOnlyRuntimeToolInventoryAttestor,
  evaluateRuntimeToolInventoryAttestation,
  type RuntimeToolInventoryExpectedBinding
} from "../packages/codex-adapter/src/runtime-tool-inventory-attestation.js";

export const DEFAULT_RUNTIME_TOOL_INVENTORY_FIXTURE =
  "tests/fixtures/codex-app-server/runtime-tool-inventory/test-only-attestation-v1.json";
export const TEST_ONLY_RUNTIME_TOOL_INVENTORY_ISSUER = "test-only-runtime-attestor-v1";

export async function runCodexAppServerRuntimeToolInventoryAudit(
  fixturePath = DEFAULT_RUNTIME_TOOL_INVENTORY_FIXTURE,
  cwd = process.cwd()
) {
  const raw = JSON.parse(await readFile(resolve(cwd, fixturePath), "utf8")) as unknown;
  return evaluateRuntimeToolInventoryAttestation({
    attestor: createTestOnlyRuntimeToolInventoryAttestor({
      issuerId: TEST_ONLY_RUNTIME_TOOL_INVENTORY_ISSUER,
      attestation: raw
    }),
    expected: testOnlyExpectedBinding(),
    replayStore: createInMemoryRuntimeToolInventoryAttestationReplayStore()
  });
}

export function testOnlyExpectedBinding(): RuntimeToolInventoryExpectedBinding {
  return {
    issuerId: TEST_ONLY_RUNTIME_TOOL_INVENTORY_ISSUER,
    challengeNonce: "fedcba9876543210fedcba9876543210",
    runtime: {
      codexVersion: "0.144.1-test-fixture",
      protocolVersion: "app-server-v2-test-fixture",
      runtimeInstanceId: "runtime-instance-test-1",
      processIdentity: {
        pid: 4242,
        startNonce: "abcdef0123456789abcdef0123456789",
        executableSha256: "a".repeat(64),
        sourceCommit: "b".repeat(40),
        schemaBundleSha256: "c".repeat(64)
      }
    },
    threadStartRequest: {
      id: "thread-start-1",
      method: "thread/start",
      params: {
        approvalPolicy: "never",
        dynamicTools: [],
        environments: [],
        permissions: ":read-only"
      }
    },
    turnStartRequest: {
      id: "turn-start-1",
      method: "turn/start",
      params: {
        approvalPolicy: "never",
        environments: [],
        input: [{ type: "text", text: "offline proposal fixture" }],
        outputSchema: {
          additionalProperties: false,
          properties: { proposal: { type: "string" } },
          required: ["proposal"],
          type: "object"
        },
        permissions: ":read-only",
        threadId: "thread-offline"
      }
    },
    effectiveConfig: {
      approvalPolicy: "never",
      sandboxPolicy: "read-only",
      environments: [],
      dynamicTools: [],
      networkAccess: "none",
      model: "test-only-model",
      features: {}
    },
    approvalStoreGeneration: 7
  };
}

async function main(): Promise<void> {
  const assessment = await runCodexAppServerRuntimeToolInventoryAudit(process.argv[2]);
  process.stdout.write(`${JSON.stringify(assessment, null, 2)}\n`);
  process.exitCode = assessment.status === "verified_offline"
    && assessment.disposition === "no_go"
    && !assessment.liveSmokeEligible
    && !assessment.realWorkspaceWriteAuthorized
    ? 0
    : 1;
}

await main();
