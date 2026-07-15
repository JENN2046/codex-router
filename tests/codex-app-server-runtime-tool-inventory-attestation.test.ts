import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import fixture from "./fixtures/codex-app-server/runtime-tool-inventory/test-only-attestation-v1.json" with { type: "json" };
import {
  RuntimeToolInventoryAttestationSchema,
  canonicalRuntimeToolInventoryJson,
  createInMemoryRuntimeToolInventoryAttestationReplayStore,
  createTestOnlyRuntimeToolInventoryAttestor,
  evaluateRuntimeToolInventoryAttestation,
  type RuntimeToolInventoryAttestation,
  type RuntimeToolInventoryExpectedBinding
} from "../packages/codex-adapter/src/runtime-tool-inventory-attestation.js";

const issuerId = "test-only-runtime-attestor-v1";
const execFileAsync = promisify(execFile);

test("test-only runtime inventory attestation verifies offline while every live field stays false", async () => {
  const assessment = await evaluateFixture();
  assert.deepEqual(assessment, {
    schemaVersion: "codex-app-server-runtime-tool-inventory-assessment.v1",
    status: "verified_offline",
    disposition: "no_go",
    contractSatisfied: true,
    trustedAttestor: true,
    attestorScope: "test_only",
    runtimeOwnedIssuerMechanicallyBound: false,
    effectiveToolInventoryMechanicallyBound: false,
    exactRuntimeRequestMechanicallyBound: false,
    challengeFreshnessMechanicallyBound: false,
    durableReplayProtectionMechanicallyBound: false,
    liveExecutionAuthorized: false,
    liveSmokeEligible: false,
    realWorkspaceWriteAuthorized: false,
    evaluationSideEffects: {
      codexBinaryExecuted: false,
      appServerStarted: false,
      liveClientConnected: false,
      providerCalled: false,
      workspaceWriteAttempted: false
    },
    reasons: [
      "runtime_tool_inventory_test_only_fake_attestor",
      "test_only_static_challenge_not_freshness_proof",
      "test_only_replay_store_not_durable",
      "runtime_owned_live_issuer_unavailable",
      "effective_live_tool_inventory_unbound",
      "live_smoke_remains_prohibited"
    ]
  });
});

test("client-created attestors are rejected before their code can run", async () => {
  let calls = 0;
  const assessment = await evaluateRuntimeToolInventoryAttestation({
    attestor: {
      async attest() {
        calls += 1;
        return fixture;
      }
    },
    expected: expectedBinding(),
    replayStore: createInMemoryRuntimeToolInventoryAttestationReplayStore()
  });
  assert.equal(calls, 0);
  assert.deepEqual(assessment.reasons, ["runtime_tool_inventory_attestor_untrusted"]);
  assertLiveFieldsFalse(assessment);
});

test("schema drift, extra capabilities, and non-empty runtime state fail closed", async () => {
  const scenarios: Array<{
    name: string;
    mutate(value: Record<string, any>): void;
  }> = [
    { name: "schema drift", mutate: (value) => { value.schemaVersion = "v2"; } },
    { name: "missing tools", mutate: (value) => { delete value.tools; } },
    { name: "extra top-level field", mutate: (value) => { value.clientClaim = true; } },
    { name: "live scope", mutate: (value) => { value.issuer.scope = "live"; } },
    { name: "extra tool", mutate: (value) => { value.tools = [{ name: "apply_patch" }]; } },
    { name: "permission network", mutate: (value) => { value.resolvedPermissions.network = true; } },
    { name: "writable root", mutate: (value) => { value.resolvedPermissions.writableRoots = ["/tmp/write"]; } },
    { name: "hook", mutate: (value) => { value.hooks.permissionRequest = "present"; } },
    { name: "grant", mutate: (value) => { value.grants = [{ kind: "filesystem" }]; } },
    { name: "cached approval", mutate: (value) => { value.cachedApprovals = ["approval-1"]; } },
    { name: "non-empty approval store", mutate: (value) => { value.approvalStore.state = "populated"; } },
    { name: "dynamic tool", mutate: (value) => { value.effectiveConfig.securityProjection.dynamicTools = ["tool-1"]; } },
    { name: "environment", mutate: (value) => { value.effectiveConfig.securityProjection.environments = ["env-1"]; } },
    { name: "write sandbox", mutate: (value) => { value.effectiveConfig.securityProjection.sandboxPolicy = "workspace-write"; } }
  ];
  for (const scenario of scenarios) {
    const mutated = structuredClone(fixture) as unknown as Record<string, any>;
    scenario.mutate(mutated);
    const assessment = await evaluateFixture(mutated);
    assert.equal(assessment.status, "blocked", scenario.name);
    assert.deepEqual(
      assessment.reasons,
      ["runtime_tool_inventory_attestation_schema_invalid"],
      scenario.name
    );
    assertLiveFieldsFalse(assessment);
  }
});

test("issuer, process, request, config, and approval-store identity mismatches fail closed", async () => {
  const issuerMismatch = await evaluateFixture(fixture, {
    ...expectedBinding(),
    issuerId: "different-issuer"
  });
  assert.deepEqual(issuerMismatch.reasons, ["runtime_tool_inventory_issuer_identity_mismatch"]);

  const processMismatch = expectedBinding();
  processMismatch.runtime.processIdentity.pid += 1;
  assert.deepEqual((await evaluateFixture(fixture, processMismatch)).reasons, [
    "runtime_tool_inventory_runtime_identity_mismatch"
  ]);

  const requestMismatch = expectedBinding();
  requestMismatch.turnStartRequest = {
    ...(requestMismatch.turnStartRequest as Record<string, unknown>),
    id: "different-turn-request"
  };
  assert.deepEqual((await evaluateFixture(fixture, requestMismatch)).reasons, [
    "runtime_tool_inventory_request_binding_mismatch"
  ]);

  const challengeMismatch = expectedBinding();
  challengeMismatch.challengeNonce = "0".repeat(32);
  assert.deepEqual((await evaluateFixture(fixture, challengeMismatch)).reasons, [
    "runtime_tool_inventory_request_binding_mismatch"
  ]);

  const configMismatch = expectedBinding();
  configMismatch.effectiveConfig.model = "different-model";
  const configFixture = structuredClone(fixture) as RuntimeToolInventoryAttestation;
  configFixture.effectiveConfig.canonicalSha256 = "d".repeat(64);
  assert.deepEqual((await evaluateFixture(configFixture, configMismatch)).reasons, [
    "runtime_tool_inventory_effective_config_mismatch"
  ]);

  const generationMismatch = expectedBinding();
  generationMismatch.approvalStoreGeneration += 1;
  assert.deepEqual((await evaluateFixture(fixture, generationMismatch)).reasons, [
    "runtime_tool_inventory_approval_store_generation_mismatch"
  ]);

  const storeHashFixture = structuredClone(fixture) as RuntimeToolInventoryAttestation;
  storeHashFixture.approvalStore.canonicalSha256 = "e".repeat(64);
  assert.deepEqual((await evaluateFixture(storeHashFixture)).reasons, [
    "runtime_tool_inventory_approval_store_binding_mismatch"
  ]);
});

test("attestation ids are consumed once and replay stays NO-GO", async () => {
  const replayStore = createInMemoryRuntimeToolInventoryAttestationReplayStore();
  const first = await evaluateFixture(fixture, expectedBinding(), replayStore);
  assert.equal(first.status, "verified_offline");
  const second = await evaluateFixture(fixture, expectedBinding(), replayStore);
  assert.deepEqual(second.reasons, ["runtime_tool_inventory_attestation_replay"]);
  assertLiveFieldsFalse(second);
});

test("static fixture replay across independent in-memory stores is not claimed as durable protection", async () => {
  const first = await evaluateFixture(
    fixture,
    expectedBinding(),
    createInMemoryRuntimeToolInventoryAttestationReplayStore()
  );
  const second = await evaluateFixture(
    fixture,
    expectedBinding(),
    createInMemoryRuntimeToolInventoryAttestationReplayStore()
  );
  assert.equal(first.status, "verified_offline");
  assert.equal(second.status, "verified_offline");
  assert.equal(first.challengeFreshnessMechanicallyBound, false);
  assert.equal(first.durableReplayProtectionMechanicallyBound, false);
  assert.equal(second.challengeFreshnessMechanicallyBound, false);
  assert.equal(second.durableReplayProtectionMechanicallyBound, false);
});

test("trusted replay store identity cannot be mutated, deleted, or re-prototyped", async () => {
  const replayStore = createInMemoryRuntimeToolInventoryAttestationReplayStore();
  let replacementCalls = 0;
  assert.equal(Reflect.set(replayStore, "consume", () => {
    replacementCalls += 1;
    return true;
  }), false);
  assert.equal(Reflect.deleteProperty(replayStore, "consume"), false);
  assert.equal(Reflect.setPrototypeOf(replayStore, { consume: () => true }), false);

  const first = await evaluateFixture(fixture, expectedBinding(), replayStore);
  const second = await evaluateFixture(fixture, expectedBinding(), replayStore);
  assert.equal(first.status, "verified_offline");
  assert.deepEqual(second.reasons, ["runtime_tool_inventory_attestation_replay"]);
  assert.equal(replacementCalls, 0);
  assertLiveFieldsFalse(first);
  assertLiveFieldsFalse(second);
});

test("canonical request binding is deterministic and rejects executable object shapes", async () => {
  assert.equal(
    canonicalRuntimeToolInventoryJson({ z: 1, a: { y: [], b: false } }),
    '{"a":{"b":false,"y":[]},"z":1}'
  );
  assert.throws(
    () => canonicalRuntimeToolInventoryJson({ value: undefined }),
    /runtime_tool_inventory_canonical_json_invalid/
  );
  const cycle: Record<string, unknown> = {};
  cycle.self = cycle;
  assert.throws(
    () => canonicalRuntimeToolInventoryJson(cycle),
    /runtime_tool_inventory_canonical_json_invalid/
  );

  let getterCalls = 0;
  const executable: Record<string, unknown> = {};
  Object.defineProperty(executable, "method", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return "turn/start";
    }
  });
  assert.throws(
    () => canonicalRuntimeToolInventoryJson(executable),
    /runtime_tool_inventory_canonical_json_invalid/
  );
  assert.equal(getterCalls, 0);

  let proxyCalls = 0;
  const proxy = new Proxy({}, {
    ownKeys() {
      proxyCalls += 1;
      return [];
    }
  });
  assert.throws(
    () => canonicalRuntimeToolInventoryJson(proxy),
    /runtime_tool_inventory_canonical_json_invalid/
  );
  assert.equal(proxyCalls, 0);

  const expected = expectedBinding();
  expected.turnStartRequest = executable;
  const assessment = await evaluateFixture(fixture, expected);
  assert.deepEqual(assessment.reasons, [
    "runtime_tool_inventory_expected_binding_not_plain_data"
  ]);
  assert.equal(getterCalls, 0);
});

test("expected thread and turn requests reject capability and shape drift before attestation", async () => {
  const scenarios: Array<{
    name: string;
    mutate(expected: RuntimeToolInventoryExpectedBinding): void;
  }> = [
    {
      name: "thread environment",
      mutate(expected) {
        (expected.threadStartRequest as any).params.environments = ["env-1"];
      }
    },
    {
      name: "thread dynamic tool",
      mutate(expected) {
        (expected.threadStartRequest as any).params.dynamicTools = [{ name: "tool-1" }];
      }
    },
    {
      name: "turn write permission",
      mutate(expected) {
        (expected.turnStartRequest as any).params.permissions = ":workspace-write";
      }
    },
    {
      name: "local image input",
      mutate(expected) {
        (expected.turnStartRequest as any).params.input = [{ type: "localImage", path: "/tmp/image" }];
      }
    },
    {
      name: "extra request field",
      mutate(expected) {
        (expected.turnStartRequest as any).params.clientClaim = true;
      }
    }
  ];
  for (const scenario of scenarios) {
    const expected = expectedBinding();
    scenario.mutate(expected);
    const assessment = await evaluateFixture(fixture, expected);
    assert.equal(assessment.status, "blocked", scenario.name);
    assert.deepEqual(
      assessment.reasons,
      ["runtime_tool_inventory_expected_request_schema_invalid"],
      scenario.name
    );
    assertLiveFieldsFalse(assessment);
  }
});

test("fake attestor snapshots reject accessor and proxy attestations without invoking them", async () => {
  let getterCalls = 0;
  const accessorFixture = structuredClone(fixture) as Record<string, unknown>;
  Object.defineProperty(accessorFixture, "tools", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return [];
    }
  });
  const accessor = await evaluateFixture(accessorFixture);
  assert.deepEqual(accessor.reasons, ["runtime_tool_inventory_attestation_schema_invalid"]);
  assert.equal(getterCalls, 0);

  let proxyCalls = 0;
  const proxy = new Proxy(structuredClone(fixture), {
    ownKeys(target) {
      proxyCalls += 1;
      return Reflect.ownKeys(target);
    }
  });
  const proxied = await evaluateFixture(proxy);
  assert.deepEqual(proxied.reasons, ["runtime_tool_inventory_attestation_schema_invalid"]);
  assert.equal(proxyCalls, 0);
});

test("fake attestor factory rejects wrapper accessors without invoking them", async () => {
  let getterCalls = 0;
  const wrapper: Record<string, unknown> = { issuerId };
  Object.defineProperty(wrapper, "attestation", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return fixture;
    }
  });
  const attestor = createTestOnlyRuntimeToolInventoryAttestor(wrapper as any);
  const assessment = await evaluateRuntimeToolInventoryAttestation({
    attestor,
    expected: expectedBinding(),
    replayStore: createInMemoryRuntimeToolInventoryAttestationReplayStore()
  });
  assert.deepEqual(assessment.reasons, ["runtime_tool_inventory_attestation_schema_invalid"]);
  assert.equal(getterCalls, 0);
  assertLiveFieldsFalse(assessment);
});

test("evaluation wrapper accessors and proxies fail before invoking user code", async () => {
  let getterCalls = 0;
  const wrapper: Record<string, unknown> = {
    attestor: createTestOnlyRuntimeToolInventoryAttestor({ issuerId, attestation: fixture }),
    replayStore: createInMemoryRuntimeToolInventoryAttestationReplayStore()
  };
  Object.defineProperty(wrapper, "expected", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return expectedBinding();
    }
  });
  const accessorAssessment = await evaluateRuntimeToolInventoryAttestation(wrapper as any);
  assert.deepEqual(accessorAssessment.reasons, ["runtime_tool_inventory_evaluation_input_invalid"]);
  assert.equal(getterCalls, 0);

  let proxyCalls = 0;
  const proxy = new Proxy({
    attestor: createTestOnlyRuntimeToolInventoryAttestor({ issuerId, attestation: fixture }),
    expected: expectedBinding(),
    replayStore: createInMemoryRuntimeToolInventoryAttestationReplayStore()
  }, {
    ownKeys(target) {
      proxyCalls += 1;
      return Reflect.ownKeys(target);
    }
  });
  const proxyAssessment = await evaluateRuntimeToolInventoryAttestation(proxy);
  assert.deepEqual(proxyAssessment.reasons, ["runtime_tool_inventory_evaluation_input_invalid"]);
  assert.equal(proxyCalls, 0);
});

test("unsafe full effective config and client replay stores fail closed", async () => {
  const unsafeConfig = expectedBinding();
  unsafeConfig.effectiveConfig = {
    ...unsafeConfig.effectiveConfig,
    approvalPolicy: "on-request",
    sandboxPolicy: "workspace-write",
    networkAccess: "full"
  } as any;
  const configAssessment = await evaluateFixture(fixture, unsafeConfig);
  assert.deepEqual(configAssessment.reasons, ["runtime_tool_inventory_expected_binding_invalid"]);

  let consumeCalls = 0;
  const replayAssessment = await evaluateRuntimeToolInventoryAttestation({
    attestor: createTestOnlyRuntimeToolInventoryAttestor({ issuerId, attestation: fixture }),
    expected: expectedBinding(),
    replayStore: {
      consume() {
        consumeCalls += 1;
        return true;
      }
    }
  });
  assert.deepEqual(replayAssessment.reasons, ["runtime_tool_inventory_replay_store_untrusted"]);
  assert.equal(consumeCalls, 0);
  assertLiveFieldsFalse(replayAssessment);
});

test("fixture itself is strict-schema valid", () => {
  assert.equal(RuntimeToolInventoryAttestationSchema.safeParse(fixture).success, true);
});

test("offline audit CLI reports NO-GO and rejects a tampered fixture", async () => {
  const script = join(process.cwd(), "scripts/run-codex-app-server-runtime-tool-inventory-audit.ts");
  const imported = await execFileAsync(process.execPath, [
    "--import",
    "tsx",
    "--input-type=module",
    "--eval",
    `await import(${JSON.stringify(pathToFileURL(script).href)}); process.stdout.write("imported\\n");`
  ], {
    cwd: process.cwd(),
    env: isolatedCliEnvironment()
  });
  assert.equal(imported.stdout, "imported\n");
  assert.equal(imported.stderr, "");

  const success = await execFileAsync(process.execPath, ["--import", "tsx", script], {
    cwd: process.cwd(),
    env: isolatedCliEnvironment()
  });
  const output = JSON.parse(success.stdout) as {
    status?: unknown;
    disposition?: unknown;
    liveSmokeEligible?: unknown;
    evaluationSideEffects?: unknown;
  };
  assert.equal(output.status, "verified_offline");
  assert.equal(output.disposition, "no_go");
  assert.equal(output.liveSmokeEligible, false);
  assert.deepEqual(output.evaluationSideEffects, {
    codexBinaryExecuted: false,
    appServerStarted: false,
    liveClientConnected: false,
    providerCalled: false,
    workspaceWriteAttempted: false
  });

  const tempRoot = await mkdtemp(join(tmpdir(), "runtime-tool-inventory-cli-"));
  try {
    const tamperedPath = join(tempRoot, "tampered.json");
    const tampered = structuredClone(fixture) as unknown as Record<string, any>;
    tampered.tools = [{ name: "shell", capability: "execute" }];
    await writeFile(tamperedPath, JSON.stringify(tampered), "utf8");
    await assert.rejects(
      () => execFileAsync(process.execPath, ["--import", "tsx", script, tamperedPath], {
        cwd: process.cwd(),
        env: isolatedCliEnvironment()
      }),
      (error: unknown) => {
        const candidate = error as { code?: unknown; stdout?: unknown };
        assert.equal(candidate.code, 1);
        const blocked = JSON.parse(String(candidate.stdout)) as {
          status?: unknown;
          reasons?: unknown;
          liveSmokeEligible?: unknown;
        };
        assert.equal(blocked.status, "blocked");
        assert.deepEqual(blocked.reasons, ["runtime_tool_inventory_attestation_schema_invalid"]);
        assert.equal(blocked.liveSmokeEligible, false);
        return true;
      }
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

function isolatedCliEnvironment(): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = { NO_COLOR: "1" };
  for (const name of [
    "PATH",
    "Path",
    "PATHEXT",
    "SystemRoot",
    "SYSTEMROOT",
    "WINDIR",
    "TEMP",
    "TMP",
    "TMPDIR",
    "HOME",
    "USERPROFILE"
  ]) {
    const value = process.env[name];
    if (value !== undefined) environment[name] = value;
  }
  return environment;
}

async function evaluateFixture(
  attestation: unknown = fixture,
  expected = expectedBinding(),
  replayStore = createInMemoryRuntimeToolInventoryAttestationReplayStore()
) {
  return evaluateRuntimeToolInventoryAttestation({
    attestor: createTestOnlyRuntimeToolInventoryAttestor({ issuerId, attestation }),
    expected,
    replayStore
  });
}

function expectedBinding(): RuntimeToolInventoryExpectedBinding {
  return {
    issuerId,
    challengeNonce: "fedcba9876543210fedcba9876543210",
    runtime: structuredClone(fixture.runtime),
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

function assertLiveFieldsFalse(assessment: Awaited<ReturnType<typeof evaluateFixture>>): void {
  assert.equal(assessment.disposition, "no_go");
  assert.equal(assessment.runtimeOwnedIssuerMechanicallyBound, false);
  assert.equal(assessment.effectiveToolInventoryMechanicallyBound, false);
  assert.equal(assessment.exactRuntimeRequestMechanicallyBound, false);
  assert.equal(assessment.challengeFreshnessMechanicallyBound, false);
  assert.equal(assessment.durableReplayProtectionMechanicallyBound, false);
  assert.equal(assessment.liveExecutionAuthorized, false);
  assert.equal(assessment.liveSmokeEligible, false);
  assert.equal(assessment.realWorkspaceWriteAuthorized, false);
  assert.deepEqual(assessment.evaluationSideEffects, {
    codexBinaryExecuted: false,
    appServerStarted: false,
    liveClientConnected: false,
    providerCalled: false,
    workspaceWriteAttempted: false
  });
}
