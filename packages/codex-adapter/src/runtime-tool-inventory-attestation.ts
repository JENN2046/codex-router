import { createHash } from "node:crypto";
import { types as utilTypes } from "node:util";
import { z } from "zod";

export const RUNTIME_TOOL_INVENTORY_ATTESTATION_SCHEMA_VERSION =
  "codex-app-server-runtime-tool-inventory-attestation.v1" as const;
export const RUNTIME_TOOL_INVENTORY_ASSESSMENT_SCHEMA_VERSION =
  "codex-app-server-runtime-tool-inventory-assessment.v1" as const;

const SHA256 = /^[a-f0-9]{64}$/u;
const SOURCE_COMMIT = /^[a-f0-9]{40}$/u;
const NONCE = /^[a-f0-9]{32,128}$/u;

const RuntimeIdentitySchema = z.object({
  codexVersion: z.string().min(1).max(128),
  protocolVersion: z.string().min(1).max(128),
  runtimeInstanceId: z.string().min(1).max(256),
  processIdentity: z.object({
    pid: z.number().int().positive(),
    startNonce: z.string().regex(NONCE),
    executableSha256: z.string().regex(SHA256),
    sourceCommit: z.string().regex(SOURCE_COMMIT),
    schemaBundleSha256: z.string().regex(SHA256)
  }).strict()
}).strict();

const EffectiveConfigSecurityProjectionSchema = z.object({
  approvalPolicy: z.literal("never"),
  sandboxPolicy: z.literal("read-only"),
  environments: z.tuple([]),
  dynamicTools: z.tuple([]),
  networkAccess: z.literal("none")
}).strict();

const FullEffectiveConfigSchema = EffectiveConfigSecurityProjectionSchema.extend({
  model: z.string().min(1).max(256),
  features: z.object({}).strict()
}).strict();

const ResolvedPermissionsSchema = z.object({
  filesystem: z.literal("read-only"),
  writableRoots: z.tuple([]),
  network: z.literal(false),
  externalAccess: z.literal(false),
  credentialAccess: z.literal(false)
}).strict();

const HookStateSchema = z.object({
  permissionRequest: z.literal("absent"),
  toolCall: z.literal("absent"),
  mcp: z.literal("absent"),
  provider: z.literal("absent")
}).strict();

const ThreadStartRequestSchema = z.object({
  id: z.string().min(1),
  method: z.literal("thread/start"),
  params: z.object({
    approvalPolicy: z.literal("never"),
    dynamicTools: z.tuple([]),
    environments: z.tuple([]),
    permissions: z.literal(":read-only")
  }).strict()
}).strict();

const TurnStartRequestSchema = z.object({
  id: z.string().min(1),
  method: z.literal("turn/start"),
  params: z.object({
    approvalPolicy: z.literal("never"),
    environments: z.tuple([]),
    input: z.tuple([
      z.object({
        type: z.literal("text"),
        text: z.string().min(1).max(512 * 1024)
      }).strict()
    ]),
    outputSchema: z.object({
      additionalProperties: z.literal(false),
      properties: z.object({
        proposal: z.object({ type: z.literal("string") }).strict()
      }).strict(),
      required: z.tuple([z.literal("proposal")]),
      type: z.literal("object")
    }).strict(),
    permissions: z.literal(":read-only"),
    threadId: z.string().min(1)
  }).strict()
}).strict();

export const RuntimeToolInventoryAttestationSchema = z.object({
  schemaVersion: z.literal(RUNTIME_TOOL_INVENTORY_ATTESTATION_SCHEMA_VERSION),
  attestationId: z.string().regex(NONCE),
  issuer: z.object({
    interfaceKind: z.literal("runtime_owned"),
    issuerId: z.string().min(1).max(256),
    scope: z.literal("test_only"),
    evidenceSource: z.literal("fake_fixture")
  }).strict(),
  runtime: RuntimeIdentitySchema,
  requestBinding: z.object({
    challengeNonce: z.string().regex(NONCE),
    threadStartCanonicalSha256: z.string().regex(SHA256),
    turnStartCanonicalSha256: z.string().regex(SHA256)
  }).strict(),
  effectiveConfig: z.object({
    canonicalSha256: z.string().regex(SHA256),
    securityProjection: EffectiveConfigSecurityProjectionSchema
  }).strict(),
  resolvedPermissions: ResolvedPermissionsSchema,
  tools: z.tuple([]),
  hooks: HookStateSchema,
  grants: z.tuple([]),
  cachedApprovals: z.tuple([]),
  approvalStore: z.object({
    state: z.literal("empty"),
    generation: z.number().int().nonnegative(),
    canonicalSha256: z.string().regex(SHA256)
  }).strict(),
  issuedAt: z.string().datetime({ offset: true })
}).strict();

export type RuntimeToolInventoryAttestation = z.infer<
  typeof RuntimeToolInventoryAttestationSchema
>;

export interface RuntimeToolInventoryAttestor {
  attest(): Promise<unknown>;
}

export interface RuntimeToolInventoryAttestationReplayStore {
  consume(attestationId: string): boolean;
}

export interface RuntimeToolInventoryExpectedBinding {
  issuerId: string;
  challengeNonce: string;
  runtime: z.input<typeof RuntimeIdentitySchema>;
  threadStartRequest: unknown;
  turnStartRequest: unknown;
  effectiveConfig: z.input<typeof FullEffectiveConfigSchema>;
  approvalStoreGeneration: number;
}

export interface RuntimeToolInventoryAssessment {
  schemaVersion: typeof RUNTIME_TOOL_INVENTORY_ASSESSMENT_SCHEMA_VERSION;
  status: "verified_offline" | "blocked";
  disposition: "no_go";
  contractSatisfied: boolean;
  trustedAttestor: boolean;
  attestorScope: "test_only" | "none";
  runtimeOwnedIssuerMechanicallyBound: false;
  effectiveToolInventoryMechanicallyBound: false;
  exactRuntimeRequestMechanicallyBound: false;
  challengeFreshnessMechanicallyBound: false;
  durableReplayProtectionMechanicallyBound: false;
  liveExecutionAuthorized: false;
  liveSmokeEligible: false;
  realWorkspaceWriteAuthorized: false;
  evaluationSideEffects: {
    codexBinaryExecuted: false;
    appServerStarted: false;
    liveClientConnected: false;
    providerCalled: false;
    workspaceWriteAttempted: false;
  };
  reasons: string[];
}

type TrustedAttestorRegistration = {
  issuerId: string;
  scope: "test_only";
};

const trustedAttestors = new WeakMap<RuntimeToolInventoryAttestor, TrustedAttestorRegistration>();
const trustedReplayStores = new WeakSet<RuntimeToolInventoryAttestationReplayStore>();

export function createInMemoryRuntimeToolInventoryAttestationReplayStore(): RuntimeToolInventoryAttestationReplayStore {
  const consumed = new Set<string>();
  const store: RuntimeToolInventoryAttestationReplayStore = Object.freeze({
    consume(attestationId: string): boolean {
      if (consumed.has(attestationId)) return false;
      consumed.add(attestationId);
      return true;
    }
  });
  trustedReplayStores.add(store);
  return store;
}

export function createTestOnlyRuntimeToolInventoryAttestor(input: {
  issuerId: string;
  attestation: unknown;
}): RuntimeToolInventoryAttestor {
  const prepared = readTestAttestorInput(input);
  const snapshot = prepared === undefined
    ? { ok: false } as const
    : snapshotPlainJson(prepared.attestation);
  const attestor: RuntimeToolInventoryAttestor = Object.freeze({
    async attest(): Promise<unknown> {
      return snapshot.ok ? structuredClone(snapshot.value) : null;
    }
  });
  trustedAttestors.set(attestor, {
    issuerId: prepared?.issuerId ?? "invalid-test-only-issuer",
    scope: "test_only"
  });
  return attestor;
}

export function canonicalRuntimeToolInventoryJson(input: unknown): string {
  const snapshot = snapshotPlainJson(input);
  if (!snapshot.ok) throw new Error("runtime_tool_inventory_canonical_json_invalid");
  return stableJson(snapshot.value);
}

export async function evaluateRuntimeToolInventoryAttestation(input: {
  attestor: RuntimeToolInventoryAttestor;
  expected: RuntimeToolInventoryExpectedBinding;
  replayStore: RuntimeToolInventoryAttestationReplayStore;
}): Promise<RuntimeToolInventoryAssessment> {
  const evaluationInput = readEvaluationInput(input);
  if (evaluationInput === undefined) {
    return blocked(["runtime_tool_inventory_evaluation_input_invalid"]);
  }
  const registration = trustedAttestors.get(evaluationInput.attestor);
  if (registration === undefined) {
    return blocked(["runtime_tool_inventory_attestor_untrusted"]);
  }
  if (!trustedReplayStores.has(evaluationInput.replayStore)) {
    return blocked(["runtime_tool_inventory_replay_store_untrusted"], true);
  }

  const expectedSnapshot = snapshotPlainJson(evaluationInput.expected);
  if (!expectedSnapshot.ok) {
    return blocked(["runtime_tool_inventory_expected_binding_not_plain_data"], true);
  }
  const expected = parseExpectedBinding(
    expectedSnapshot.value as RuntimeToolInventoryExpectedBinding
  );
  if (!expected.ok) {
    return blocked([expected.reason], true);
  }

  let raw: unknown;
  try {
    raw = await evaluationInput.attestor.attest();
  } catch {
    return blocked(["runtime_tool_inventory_attestor_failed"], true);
  }
  const snapshot = snapshotPlainJson(raw);
  if (!snapshot.ok) {
    return blocked(["runtime_tool_inventory_attestation_not_plain_data"], true);
  }
  const parsed = RuntimeToolInventoryAttestationSchema.safeParse(snapshot.value);
  if (!parsed.success) {
    return blocked(["runtime_tool_inventory_attestation_schema_invalid"], true);
  }
  const attestation = parsed.data;
  if (
    attestation.issuer.issuerId !== registration.issuerId
    || attestation.issuer.issuerId !== expected.value.issuerId
  ) {
    return blocked(["runtime_tool_inventory_issuer_identity_mismatch"], true);
  }
  if (!runtimeIdentityEquals(attestation.runtime, expected.value.runtime)) {
    return blocked(["runtime_tool_inventory_runtime_identity_mismatch"], true);
  }
  if (
    attestation.requestBinding.challengeNonce !== expected.value.challengeNonce
    ||
    attestation.requestBinding.threadStartCanonicalSha256
      !== expected.value.threadStartCanonicalSha256
    || attestation.requestBinding.turnStartCanonicalSha256
      !== expected.value.turnStartCanonicalSha256
  ) {
    return blocked(["runtime_tool_inventory_request_binding_mismatch"], true);
  }
  if (
    attestation.effectiveConfig.canonicalSha256 !== expected.value.effectiveConfigCanonicalSha256
    || !effectiveConfigEquals(
      attestation.effectiveConfig.securityProjection,
      projectEffectiveConfig(expected.value.effectiveConfig)
    )
  ) {
    return blocked(["runtime_tool_inventory_effective_config_mismatch"], true);
  }
  if (attestation.approvalStore.generation !== expected.value.approvalStoreGeneration) {
    return blocked(["runtime_tool_inventory_approval_store_generation_mismatch"], true);
  }
  const expectedStoreHash = sha256(canonicalRuntimeToolInventoryJson({
    state: "empty",
    generation: expected.value.approvalStoreGeneration
  }));
  if (attestation.approvalStore.canonicalSha256 !== expectedStoreHash) {
    return blocked(["runtime_tool_inventory_approval_store_binding_mismatch"], true);
  }
  if (!evaluationInput.replayStore.consume(attestation.attestationId)) {
    return blocked(["runtime_tool_inventory_attestation_replay"], true);
  }

  return {
    schemaVersion: RUNTIME_TOOL_INVENTORY_ASSESSMENT_SCHEMA_VERSION,
    status: "verified_offline",
    disposition: "no_go",
    contractSatisfied: true,
    trustedAttestor: true,
    attestorScope: registration.scope,
    runtimeOwnedIssuerMechanicallyBound: false,
    effectiveToolInventoryMechanicallyBound: false,
    exactRuntimeRequestMechanicallyBound: false,
    challengeFreshnessMechanicallyBound: false,
    durableReplayProtectionMechanicallyBound: false,
    liveExecutionAuthorized: false,
    liveSmokeEligible: false,
    realWorkspaceWriteAuthorized: false,
    evaluationSideEffects: sideEffects(),
    reasons: [
      "runtime_tool_inventory_test_only_fake_attestor",
      "test_only_static_challenge_not_freshness_proof",
      "test_only_replay_store_not_durable",
      "runtime_owned_live_issuer_unavailable",
      "effective_live_tool_inventory_unbound",
      "live_smoke_remains_prohibited"
    ]
  };
}

function blocked(reasons: string[], trustedAttestor = false): RuntimeToolInventoryAssessment {
  return {
    schemaVersion: RUNTIME_TOOL_INVENTORY_ASSESSMENT_SCHEMA_VERSION,
    status: "blocked",
    disposition: "no_go",
    contractSatisfied: false,
    trustedAttestor,
    attestorScope: trustedAttestor ? "test_only" : "none",
    runtimeOwnedIssuerMechanicallyBound: false,
    effectiveToolInventoryMechanicallyBound: false,
    exactRuntimeRequestMechanicallyBound: false,
    challengeFreshnessMechanicallyBound: false,
    durableReplayProtectionMechanicallyBound: false,
    liveExecutionAuthorized: false,
    liveSmokeEligible: false,
    realWorkspaceWriteAuthorized: false,
    evaluationSideEffects: sideEffects(),
    reasons
  };
}

function sideEffects(): RuntimeToolInventoryAssessment["evaluationSideEffects"] {
  return {
    codexBinaryExecuted: false,
    appServerStarted: false,
    liveClientConnected: false,
    providerCalled: false,
    workspaceWriteAttempted: false
  };
}

function parseExpectedBinding(input: RuntimeToolInventoryExpectedBinding):
  | { ok: true; value: {
    issuerId: string;
    challengeNonce: string;
    runtime: z.infer<typeof RuntimeIdentitySchema>;
    threadStartCanonicalSha256: string;
    turnStartCanonicalSha256: string;
    effectiveConfig: z.infer<typeof FullEffectiveConfigSchema>;
    effectiveConfigCanonicalSha256: string;
    approvalStoreGeneration: number;
  } }
  | { ok: false; reason: string } {
  const base = z.object({
    issuerId: z.string().min(1).max(256),
    challengeNonce: z.string().regex(NONCE),
    runtime: RuntimeIdentitySchema,
    effectiveConfig: FullEffectiveConfigSchema,
    approvalStoreGeneration: z.number().int().nonnegative()
  }).strict().safeParse({
    issuerId: input.issuerId,
    challengeNonce: input.challengeNonce,
    runtime: input.runtime,
    effectiveConfig: input.effectiveConfig,
    approvalStoreGeneration: input.approvalStoreGeneration
  });
  if (!base.success) return { ok: false, reason: "runtime_tool_inventory_expected_binding_invalid" };
  try {
    const threadSnapshot = snapshotPlainJson(input.threadStartRequest);
    const turnSnapshot = snapshotPlainJson(input.turnStartRequest);
    if (!threadSnapshot.ok || !turnSnapshot.ok) {
      return { ok: false, reason: "runtime_tool_inventory_expected_request_not_canonicalizable" };
    }
    const threadRequest = ThreadStartRequestSchema.safeParse(threadSnapshot.value);
    const turnRequest = TurnStartRequestSchema.safeParse(turnSnapshot.value);
    if (!threadRequest.success || !turnRequest.success) {
      return { ok: false, reason: "runtime_tool_inventory_expected_request_schema_invalid" };
    }
    const threadStart = canonicalRuntimeToolInventoryJson(threadRequest.data);
    const turnStart = canonicalRuntimeToolInventoryJson(turnRequest.data);
    const effectiveConfig = canonicalRuntimeToolInventoryJson(base.data.effectiveConfig);
    return {
      ok: true,
      value: {
        ...base.data,
        threadStartCanonicalSha256: sha256(threadStart),
        turnStartCanonicalSha256: sha256(turnStart),
        effectiveConfigCanonicalSha256: sha256(effectiveConfig)
      }
    };
  } catch {
    return { ok: false, reason: "runtime_tool_inventory_expected_request_not_canonicalizable" };
  }
}

function runtimeIdentityEquals(
  actual: RuntimeToolInventoryAttestation["runtime"],
  expected: z.infer<typeof RuntimeIdentitySchema>
): boolean {
  return canonicalRuntimeToolInventoryJson(actual) === canonicalRuntimeToolInventoryJson(expected);
}

function effectiveConfigEquals(
  actual: RuntimeToolInventoryAttestation["effectiveConfig"]["securityProjection"],
  expected: z.infer<typeof EffectiveConfigSecurityProjectionSchema>
): boolean {
  return canonicalRuntimeToolInventoryJson(actual) === canonicalRuntimeToolInventoryJson(expected);
}

function projectEffectiveConfig(
  config: z.infer<typeof FullEffectiveConfigSchema>
): z.infer<typeof EffectiveConfigSecurityProjectionSchema> {
  return {
    approvalPolicy: config.approvalPolicy,
    sandboxPolicy: config.sandboxPolicy,
    environments: config.environments,
    dynamicTools: config.dynamicTools,
    networkAccess: config.networkAccess
  };
}

function readEvaluationInput(input: unknown): {
  attestor: RuntimeToolInventoryAttestor;
  expected: RuntimeToolInventoryExpectedBinding;
  replayStore: RuntimeToolInventoryAttestationReplayStore;
} | undefined {
  if (!isExactDataRecord(input, ["attestor", "expected", "replayStore"])) return undefined;
  const descriptors = Object.getOwnPropertyDescriptors(input);
  const attestor = dataDescriptorValue(descriptors.attestor);
  const expected = dataDescriptorValue(descriptors.expected);
  const replayStore = dataDescriptorValue(descriptors.replayStore);
  if (
    typeof attestor !== "object" || attestor === null
    || typeof expected !== "object" || expected === null
    || typeof replayStore !== "object" || replayStore === null
  ) return undefined;
  return {
    attestor: attestor as RuntimeToolInventoryAttestor,
    expected: expected as RuntimeToolInventoryExpectedBinding,
    replayStore: replayStore as RuntimeToolInventoryAttestationReplayStore
  };
}

function readTestAttestorInput(input: unknown): {
  issuerId: string;
  attestation: unknown;
} | undefined {
  if (!isExactDataRecord(input, ["attestation", "issuerId"])) return undefined;
  const descriptors = Object.getOwnPropertyDescriptors(input);
  const issuerId = dataDescriptorValue(descriptors.issuerId);
  const attestation = dataDescriptorValue(descriptors.attestation);
  return typeof issuerId === "string" ? { issuerId, attestation } : undefined;
}

function isExactDataRecord(input: unknown, expectedKeys: string[]): input is Record<string, unknown> {
  if (typeof input !== "object" || input === null || utilTypes.isProxy(input)) return false;
  try {
    if (Object.getPrototypeOf(input) !== Object.prototype) return false;
    const descriptors = Object.getOwnPropertyDescriptors(input);
    const keys = Reflect.ownKeys(descriptors);
    return keys.length === expectedKeys.length
      && keys.every((key) => typeof key === "string" && expectedKeys.includes(key))
      && keys.every((key) => {
        const descriptor = descriptors[String(key)];
        return descriptor !== undefined && "value" in descriptor;
      });
  } catch {
    return false;
  }
}

function dataDescriptorValue(descriptor: PropertyDescriptor | undefined): unknown {
  return descriptor !== undefined && "value" in descriptor ? descriptor.value : undefined;
}

type JsonSnapshot = { ok: true; value: unknown } | { ok: false };

function snapshotPlainJson(input: unknown): JsonSnapshot {
  const active = new WeakSet<object>();
  let nodes = 0;

  const visit = (value: unknown, depth: number): JsonSnapshot => {
    if (
      value === null
      || typeof value === "string"
      || typeof value === "boolean"
      || (typeof value === "number" && Number.isFinite(value))
    ) return { ok: true, value };
    if (typeof value !== "object" || utilTypes.isProxy(value) || depth > 64 || nodes >= 10_000) {
      return { ok: false };
    }
    nodes += 1;
    if (active.has(value)) return { ok: false };
    active.add(value);
    try {
      const prototype = Object.getPrototypeOf(value);
      if (Array.isArray(value)) {
        if (prototype !== Array.prototype) return { ok: false };
        const descriptors = Object.getOwnPropertyDescriptors(value);
        const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
        const length = lengthDescriptor !== undefined && "value" in lengthDescriptor
          ? lengthDescriptor.value
          : undefined;
        if (typeof length !== "number" || !Number.isSafeInteger(length) || length < 0) {
          return { ok: false };
        }
        const keys = Reflect.ownKeys(descriptors);
        if (keys.length !== length + 1 || keys.some((key) => {
          if (key === "length") return false;
          if (typeof key !== "string" || !/^(?:0|[1-9][0-9]*)$/u.test(key)) return true;
          const index = Number(key);
          return !Number.isSafeInteger(index) || index < 0 || index >= length || String(index) !== key;
        })) return { ok: false };
        const copy: unknown[] = [];
        for (let index = 0; index < length; index += 1) {
          const descriptor = descriptors[String(index)];
          if (descriptor === undefined || !("value" in descriptor)) return { ok: false };
          const child = visit(descriptor.value, depth + 1);
          if (!child.ok) return child;
          copy.push(child.value);
        }
        return { ok: true, value: copy };
      }
      if (prototype !== Object.prototype && prototype !== null) return { ok: false };
      const descriptors = Object.getOwnPropertyDescriptors(value);
      if (Reflect.ownKeys(descriptors).some((key) => typeof key === "symbol")) return { ok: false };
      const copy: Record<string, unknown> = {};
      for (const key of Object.keys(descriptors).sort()) {
        const descriptor = descriptors[key];
        if (descriptor === undefined || !("value" in descriptor)) return { ok: false };
        const child = visit(descriptor.value, depth + 1);
        if (!child.ok) return child;
        Object.defineProperty(copy, key, {
          value: child.value,
          enumerable: true,
          configurable: true,
          writable: true
        });
      }
      return { ok: true, value: copy };
    } catch {
      return { ok: false };
    } finally {
      active.delete(value);
    }
  };

  return visit(input, 0);
}

function stableJson(input: unknown): string {
  if (input === null || typeof input !== "object") return JSON.stringify(input);
  if (Array.isArray(input)) return `[${input.map(stableJson).join(",")}]`;
  return `{${Object.entries(input as Record<string, unknown>)
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([key, value]) => `${JSON.stringify(key)}:${stableJson(value)}`)
    .join(",")}}`;
}

function sha256(input: string | Uint8Array): string {
  return createHash("sha256").update(input).digest("hex");
}
