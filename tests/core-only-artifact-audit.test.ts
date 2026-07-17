import assert from "node:assert/strict";
import test from "node:test";
import {
  CORE_EXPORTS,
  CORE_METADATA_FILES,
  reviewCoreArtifactBoundary,
  type CoreArtifactBoundaryInput
} from "../scripts/run-core-only-artifact-audit.js";

const runtimeEntry = "dist/packages/public-api/src/protocol.js";
const runtimeDependency = "dist/packages/kernel-contracts/src/public.js";
const declarationEntry = "dist/packages/public-api/src/protocol.d.ts";
const declarationDependency = "dist/packages/kernel-contracts/src/public.d.ts";

function fixture(
  overrides: Partial<CoreArtifactBoundaryInput> = {}
): CoreArtifactBoundaryInput {
  const expectedRuntimeFiles = [runtimeDependency, runtimeEntry].sort();
  const expectedDeclarationFiles = [declarationDependency, declarationEntry].sort();
  const files: Record<string, string> = {
    [runtimeEntry]: 'export { value } from "../../kernel-contracts/src/public.js";\n',
    [runtimeDependency]: "export const value = 1;\n",
    [declarationEntry]: 'export { value } from "../../kernel-contracts/src/public.js";\n',
    [declarationDependency]: "export declare const value = 1;\n"
  };
  return {
    files,
    packFiles: [
      ...expectedRuntimeFiles,
      ...expectedDeclarationFiles,
      ...CORE_METADATA_FILES
    ].sort(),
    packageExports: [...CORE_EXPORTS],
    runtimeEntries: [runtimeEntry],
    declarationEntries: [declarationEntry],
    expectedRuntimeFiles,
    expectedDeclarationFiles,
    providerGovernancePublicSourceText: `
/** @internal */
export function stableStringifyProviderObject(): string { return "{}"; }
`,
    providerCoreInternalSourceText: `
import { stableStringifyProviderObject } from "./governance-public.js";
void stableStringifyProviderObject;
`,
    publicProviderFacadeSourceText: "export const ProviderManifestSchema = {};\n",
    legacyAdapterSourceText: 'import { TaskSchema } from "./public.js";\n',
    ...overrides
  };
}

test("core artifact fixture accepts the exact runtime, declaration, and metadata set", () => {
  const result = reviewCoreArtifactBoundary(fixture());
  assert.equal(result.status, "passed");
  assert.deepEqual(result.reasons, []);
});

test("core artifact fixture rejects a missing runtime dependency", () => {
  const input = fixture();
  delete (input.files as Record<string, string>)[runtimeDependency];
  const result = reviewCoreArtifactBoundary(input);
  assert.equal(result.status, "blocked");
  assert.ok(result.reasons.includes("runtime_closure_missing"));
});

test("core artifact fixture rejects a missing declaration dependency", () => {
  const input = fixture();
  delete (input.files as Record<string, string>)[declarationDependency];
  const result = reviewCoreArtifactBoundary(input);
  assert.equal(result.status, "blocked");
  assert.ok(result.reasons.includes("declaration_closure_missing"));
});

test("core artifact fixture rejects extra files and stale aliases", () => {
  const input = fixture({
    packageExports: [...CORE_EXPORTS, "./sdk"]
  });
  input.packFiles = [...input.packFiles, "dist/packages/public-api/src/sdk.js"].sort();
  const result = reviewCoreArtifactBoundary(input);
  assert.ok(result.reasons.includes("artifact_manifest_mismatch"));
  assert.ok(result.reasons.includes("stale_package_alias_present"));
});

test("core artifact fixture rejects provider execution contracts", () => {
  const input = fixture();
  (input.files as Record<string, string>)[declarationDependency] = `
export interface ExecutorProvider { execute(): void; }
`;
  const result = reviewCoreArtifactBoundary(input);
  assert.ok(result.reasons.includes("provider_execute_contract_present"));
});

test("core artifact fixture rejects provider execution calls", () => {
  const input = fixture();
  (input.files as Record<string, string>)[runtimeDependency] =
    "export const value = provider.execute(plan);\n";
  const result = reviewCoreArtifactBoundary(input);
  assert.ok(result.reasons.includes("provider_execute_call_present"));
});

for (const [name, path, reason] of [
  ["provider internal index", "dist/packages/provider-core/src/index.d.ts", "provider_core_internal_present"],
  ["workspace-write executor", "dist/packages/governance-internal-workspace-write-executor/src/index.js", "workspace_write_executor_present"],
  ["legacy adapter", "dist/packages/kernel-contracts/src/legacy-adapter.js", "legacy_compatibility_present"],
  ["old public facade", "dist/packages/public-api/src/sdk.js", "legacy_facade_present"],
  ["runtime family", "dist/packages/protocol-mcp/src/index.js", "runtime_family_present"],
  ["test fixture", "dist/packages/provider-core/test-fixtures/manifest.js", "test_fixture_present"]
] as const) {
  test(`core artifact fixture rejects ${name}`, () => {
    const input = fixture();
    input.packFiles = [...input.packFiles, path].sort();
    const result = reviewCoreArtifactBoundary(input);
    assert.ok(result.reasons.includes("artifact_file_not_allowlisted"));
    assert.ok(result.reasons.includes(reason));
  });
}

test("core artifact fixture rejects Node ambient declarations", () => {
  const input = fixture();
  (input.files as Record<string, string>)[declarationDependency] = `
export declare const env: NodeJS.ProcessEnv;
`;
  const result = reviewCoreArtifactBoundary(input);
  assert.ok(result.reasons.includes("declaration_node_ambient_present"));
});

test("core artifact fixture rejects legacy import edges", () => {
  const input = fixture();
  (input.files as Record<string, string>)[runtimeDependency] = `
export * from "./index.js";
`;
  const result = reviewCoreArtifactBoundary(input);
  assert.ok(result.reasons.includes("legacy_import_edge_present"));
});

test("core artifact fixture rejects dynamic and CommonJS edges", () => {
  const input = fixture();
  (input.files as Record<string, string>)[runtimeDependency] = `
export const value = import("./dynamic.js");
require("./legacy.cjs");
`;
  const result = reviewCoreArtifactBoundary(input);
  assert.ok(result.reasons.includes("artifact_dynamic_import_unverifiable"));
  assert.ok(result.reasons.includes("artifact_commonjs_edge_unverifiable"));
});

test("core artifact fixture rejects noncanonical paths", () => {
  const input = fixture();
  input.packFiles = [...input.packFiles, "dist\\packages\\escape.js"];
  const result = reviewCoreArtifactBoundary(input);
  assert.ok(result.reasons.includes("artifact_path_not_canonical"));
});

test("core artifact fixture rejects duplicated or facade-exported hash helpers", () => {
  const duplicate = reviewCoreArtifactBoundary(fixture({
    providerCoreInternalSourceText: `
import { stableStringifyProviderObject } from "./governance-public.js";
function stableStringifyProviderObject(): string { return "{}"; }
`
  }));
  assert.ok(duplicate.reasons.includes("provider_hash_helper_ownership_invalid"));
  assert.ok(duplicate.reasons.includes("provider_hash_helper_duplicated"));

  const exported = reviewCoreArtifactBoundary(fixture({
    publicProviderFacadeSourceText: "export { stableStringifyProviderObject };\n"
  }));
  assert.ok(exported.reasons.includes("provider_hash_helper_ownership_invalid"));
  assert.ok(exported.reasons.includes("provider_internal_helper_exported"));
});

test("core artifact fixture rejects the legacy index initialization cycle", () => {
  const result = reviewCoreArtifactBoundary(fixture({
    legacyAdapterSourceText: 'import { TaskSchema } from "./index.js";\n'
  }));
  assert.ok(result.reasons.includes("legacy_initialization_cycle_present"));
});
