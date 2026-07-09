#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  ProviderGrantSchema,
  type ProviderGrant
} from "../packages/contracts/src/index.js";
import {
  SandboxProfileSchema,
  type SandboxProfile
} from "../packages/kernel-contracts/src/index.js";
import {
  createProviderRegistry,
  selectProviderForGrant
} from "../packages/provider-registry/src/index.js";
import {
  hashProviderManifest
} from "../packages/provider-core/src/index.js";
import {
  codexCliProviderManifest
} from "../packages/providers/codex-cli/src/index.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const DEFAULT_EVIDENCE_PATH = join(
  __dirname,
  "..",
  "docs",
  "evidence",
  "provider-registry-selection-acceptance.json"
);
const DEFAULT_GENERATED_AT = "2026-06-14T00:00:00.000Z";

export interface ProviderRegistrySelectionAcceptanceEvidence {
  schemaVersion: "provider-registry-selection-acceptance.v1";
  generatedAt: string;
  mode: "read-only-registry-selection";
  providerCount: number;
  enabledProviderCount: number;
  checks: {
    codexCliRegistered: boolean;
    attestationHashRecorded: boolean;
    snapshotGenerated: boolean;
    selectByProviderIdOk: boolean;
    selectByGrantOk: boolean;
    missingProviderBlocked: boolean;
    disabledProviderBlockedByDefault: boolean;
    manifestMismatchBlocked: boolean;
    missingCapabilityBlocked: boolean;
    unsupportedSandboxBlocked: boolean;
    unsupportedSideEffectBlocked: boolean;
    leakCheckPassed: boolean;
    noRunPath: boolean;
  };
  summary: {
    providerId: string;
    kind: string;
    manifestHash: string;
    capabilityCount: number;
    sandboxProfileCount: number;
    sideEffectClassCount: number;
  };
  blockingReasons: string[];
}

export interface ProviderRegistrySelectionAcceptanceOptions {
  generatedAt?: string;
}

export async function runProviderRegistrySelectionAcceptance(
  options: ProviderRegistrySelectionAcceptanceOptions = {}
): Promise<ProviderRegistrySelectionAcceptanceEvidence> {
  const generatedAt = options.generatedAt ?? DEFAULT_GENERATED_AT;
  const registry = createProviderRegistry();
  const codexEntry = registry.register(codexCliProviderManifest, {
    registeredAt: generatedAt
  });
  const disabledEntry = registry.register({
    ...codexCliProviderManifest,
    providerId: "codex-cli-disabled",
    displayName: "Codex CLI Disabled",
    enabled: false
  }, {
    registeredAt: generatedAt
  });
  const snapshot = registry.snapshot({
    generatedAt
  });
  const expectedHash = hashProviderManifest(codexCliProviderManifest);
  const readOnlySandbox = codexCliProviderManifest.supportedSandboxProfiles.find(
    (sandbox) => sandbox.mode === "read-only"
  );
  if (readOnlySandbox === undefined) {
    throw new Error("provider_registry_selection_acceptance_missing_read_only_sandbox");
  }
  const selectByProviderId = registry.select({
    providerId: "codex-cli",
    kind: "executor",
    expectedManifestHash: expectedHash,
    requiredCapabilities: ["fs.read:workspace/**"],
    requiredSandboxProfile: readOnlySandbox,
    requiredSideEffectClass: "read_only"
  });
  const selectByGrant = selectProviderForGrant(
    registry,
    createCodexReadOnlyProviderGrant()
  );
  const missingProvider = registry.select({
    providerId: "missing-provider"
  });
  const disabledProvider = registry.select({
    providerId: disabledEntry.providerId
  });
  const manifestMismatch = registry.select({
    providerId: "codex-cli",
    expectedManifestHash: "0".repeat(64)
  });
  const missingCapability = registry.select({
    providerId: "codex-cli",
    requiredCapabilities: ["missing.capability"]
  });
  const unsupportedSandbox = registry.select({
    providerId: "codex-cli",
    requiredSandboxProfile: createUnsupportedSandboxProfile()
  });
  const unsupportedSideEffect = registry.select({
    providerId: "codex-cli",
    requiredSideEffectClass: "protected_remote"
  });
  const grantManifestMismatchInput: ProviderGrant & { manifestHash: string } = {
    ...createCodexReadOnlyProviderGrant(),
    manifestHash: "0".repeat(64)
  };
  const grantManifestMismatch = selectProviderForGrant(
    registry,
    grantManifestMismatchInput
  );

  const evidenceWithoutLeakCheck: Omit<
    ProviderRegistrySelectionAcceptanceEvidence,
    "checks"
  > & {
    checks: Omit<
      ProviderRegistrySelectionAcceptanceEvidence["checks"],
      "leakCheckPassed"
    >;
  } = {
    schemaVersion: "provider-registry-selection-acceptance.v1",
    generatedAt,
    mode: "read-only-registry-selection",
    providerCount: snapshot.providerCount,
    enabledProviderCount: snapshot.enabledProviderCount,
    checks: {
      codexCliRegistered: codexEntry.providerId === "codex-cli",
      attestationHashRecorded: codexEntry.manifestHash === codexEntry.attestation.manifestHash
        && codexEntry.manifestHash === expectedHash,
      snapshotGenerated: snapshot.schemaVersion === "provider-registry-snapshot.v1"
        && snapshot.providerCount === 2
        && snapshot.enabledProviderCount === 1,
      selectByProviderIdOk: selectByProviderId.selected === true
        && selectByProviderId.provider?.providerId === "codex-cli",
      selectByGrantOk: selectByGrant.selected === true
        && selectByGrant.provider?.providerId === "codex-cli",
      missingProviderBlocked: missingProvider.selected === false
        && missingProvider.reasons.includes(
          "provider_selection_provider_missing:missing-provider"
        ),
      disabledProviderBlockedByDefault: disabledProvider.selected === false
        && disabledProvider.reasons.includes(
          "provider_selection_provider_disabled:codex-cli-disabled"
        ),
      manifestMismatchBlocked: manifestMismatch.selected === false
        && manifestMismatch.reasons.includes("provider_selection_manifest_hash_mismatch")
        && grantManifestMismatch.selected === false
        && grantManifestMismatch.reasons.includes("provider_selection_manifest_hash_mismatch"),
      missingCapabilityBlocked: missingCapability.selected === false
        && missingCapability.reasons.includes(
          "provider_selection_missing_capability:missing.capability"
        ),
      unsupportedSandboxBlocked: unsupportedSandbox.selected === false
        && unsupportedSandbox.reasons.includes(
          "provider_selection_unsupported_sandbox:sandbox_provider_registry_selection_full_network"
        ),
      unsupportedSideEffectBlocked: unsupportedSideEffect.selected === false
        && unsupportedSideEffect.reasons.includes(
          "provider_selection_unsupported_side_effect:protected_remote"
        ),
      noRunPath: true
    },
    summary: {
      providerId: codexEntry.providerId,
      kind: codexEntry.kind,
      manifestHash: codexEntry.manifestHash,
      capabilityCount: codexEntry.capabilities.length,
      sandboxProfileCount: codexEntry.supportedSandboxProfiles.length,
      sideEffectClassCount: codexEntry.supportedSideEffectClasses.length
    },
    blockingReasons: [
      ...missingProvider.reasons,
      ...disabledProvider.reasons,
      ...manifestMismatch.reasons,
      ...missingCapability.reasons,
      ...unsupportedSandbox.reasons,
      ...unsupportedSideEffect.reasons,
      ...grantManifestMismatch.reasons
    ]
  };
  const leakCheckPassed = !containsForbiddenMarkers(evidenceWithoutLeakCheck);

  return {
    ...evidenceWithoutLeakCheck,
    checks: {
      ...evidenceWithoutLeakCheck.checks,
      leakCheckPassed
    }
  };
}

export async function writeProviderRegistrySelectionAcceptanceEvidence(
  evidence: ProviderRegistrySelectionAcceptanceEvidence,
  evidencePath = DEFAULT_EVIDENCE_PATH
): Promise<{
  path: string;
  evidence: ProviderRegistrySelectionAcceptanceEvidence;
}> {
  await mkdir(dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  return {
    path: evidencePath,
    evidence
  };
}

function createCodexReadOnlyProviderGrant() {
  return ProviderGrantSchema.parse({
    schemaVersion: "provider-grant.v1",
    grantId: "grant_provider_registry_selection_acceptance_readonly",
    providerId: "codex-cli",
    providerKind: "executor",
    sideEffectClass: "read_only",
    toolAccess: "read_only",
    sandboxMode: "read-only",
    approvalRequired: false,
    requiredApprovals: [],
    reasons: ["acceptance"]
  });
}

function createUnsupportedSandboxProfile(): SandboxProfile {
  return SandboxProfileSchema.parse({
    schemaVersion: "sandbox-profile.v1",
    sandboxId: "sandbox_provider_registry_selection_full_network",
    mode: "read-only",
    networkAccess: "full",
    writableRoots: [],
    envPolicy: {
      inheritProcessEnv: false,
      allowlist: []
    }
  });
}

function containsForbiddenMarkers(value: unknown): boolean {
  const serialized = JSON.stringify(value);
  return [
    "execute",
    "invoke",
    "function",
    "secret",
    "token",
    "OPENAI_API_KEY",
    "sk-",
    "Bearer",
    "raw env",
    "raw command",
    "prompt",
    "args",
    "stdout",
    "stderr"
  ].some((marker) => serialized.includes(marker));
}

async function main(): Promise<void> {
  const outputIdx = process.argv.indexOf("--output");
  const outputPath = outputIdx >= 0
    ? process.argv[outputIdx + 1]!
    : DEFAULT_EVIDENCE_PATH;
  const evidence = await runProviderRegistrySelectionAcceptance();
  const write = await writeProviderRegistrySelectionAcceptanceEvidence(
    evidence,
    outputPath
  );

  console.log("Provider registry selection acceptance");
  console.log(`select by provider id: ${evidence.checks.selectByProviderIdOk}`);
  console.log(`select by grant: ${evidence.checks.selectByGrantOk}`);
  console.log(`fail closed checks: ${[
    evidence.checks.missingProviderBlocked,
    evidence.checks.disabledProviderBlockedByDefault,
    evidence.checks.manifestMismatchBlocked,
    evidence.checks.missingCapabilityBlocked,
    evidence.checks.unsupportedSandboxBlocked,
    evidence.checks.unsupportedSideEffectBlocked
  ].every(Boolean)}`);
  console.log(`leak check: ${evidence.checks.leakCheckPassed}`);
  console.log(`evidence: ${write.path}`);

  if (!Object.values(evidence.checks).every(Boolean)) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      "Provider registry selection acceptance failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
