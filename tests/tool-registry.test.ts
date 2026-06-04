import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import {
  InMemoryToolRegistry,
  RegisteredToolManifestSchema,
  builtinApplyPatchToolManifest,
  builtinReadFileToolManifest,
  createDefaultToolRegistry,
  defaultToolManifests,
  mcpGithubCreatePullRequestToolManifest,
  remoteAgentInvokeToolManifest,
  type ToolManifestInput
} from "../packages/tool-registry/src/index.js";

test("tool registry registers, gets, and lists manifests", () => {
  const registry = createDefaultToolRegistry();

  assert.equal(registry.getTool("builtin.read_file")?.toolId, "builtin.read_file");
  assert.equal(registry.getTool("missing.tool"), undefined);

  assert.deepEqual(
    registry.listTools().map((tool) => tool.toolId),
    [
      "builtin.read_file",
      "builtin.apply_patch",
      "mcp.github.create_pull_request",
      "remote.agent.invoke"
    ]
  );
  assert.deepEqual(
    registry.listTools({ provider: "builtin" }).map((tool) => tool.toolId),
    ["builtin.read_file", "builtin.apply_patch"]
  );
  assert.deepEqual(
    registry.listTools({ sideEffectClass: "external_write" }).map((tool) => tool.toolId),
    ["mcp.github.create_pull_request", "remote.agent.invoke"]
  );
  assert.deepEqual(
    registry.listTools({ requiredCapability: "fs.write:/repo/**" }).map((tool) => tool.toolId),
    ["builtin.apply_patch"]
  );
});

test("tool registry rejects duplicate tool ids", () => {
  const registry = new InMemoryToolRegistry();
  registry.registerTool(builtinReadFileToolManifest);

  assert.throws(
    () => registry.registerTool(builtinReadFileToolManifest),
    /duplicate_tool_id:builtin\.read_file/
  );
});

test("tool registry rejects invalid manifests", () => {
  assert.throws(
    () => RegisteredToolManifestSchema.parse({
      ...builtinReadFileToolManifest,
      toolId: ""
    }),
    z.ZodError
  );

  assert.throws(
    () => new InMemoryToolRegistry().registerTool({
      ...builtinReadFileToolManifest,
      defaultTimeoutMs: 0
    }),
    z.ZodError
  );
});

test("tool registry rejects dangerous tools without capabilities", () => {
  const manifest: ToolManifestInput = {
    ...builtinApplyPatchToolManifest,
    toolId: "builtin.unsafe_patch",
    requiredCapabilities: []
  };

  assert.throws(
    () => new InMemoryToolRegistry().registerTool(manifest),
    z.ZodError
  );
});

test("tool registry requires mcp provider metadata", () => {
  const manifest: ToolManifestInput = {
    ...mcpGithubCreatePullRequestToolManifest,
    toolId: "mcp.github.missing_metadata",
    serverRef: undefined,
    metadata: {}
  };

  assert.throws(
    () => new InMemoryToolRegistry().registerTool(manifest),
    z.ZodError
  );
});

test("tool registry requires remote provider metadata", () => {
  const manifest: ToolManifestInput = {
    ...remoteAgentInvokeToolManifest,
    toolId: "remote.agent.missing_metadata",
    endpointRef: undefined,
    metadata: {}
  };

  assert.throws(
    () => new InMemoryToolRegistry().registerTool(manifest),
    z.ZodError
  );
});

test("tool registry unregisters manifests", () => {
  const registry = createDefaultToolRegistry();

  const removed = registry.unregisterTool("builtin.read_file");

  assert.equal(removed?.toolId, "builtin.read_file");
  assert.equal(registry.getTool("builtin.read_file"), undefined);
  assert.equal(registry.unregisterTool("builtin.read_file"), undefined);
});

test("tool registry default fixtures are protocol-valid", () => {
  for (const manifest of defaultToolManifests) {
    assert.equal(RegisteredToolManifestSchema.parse(manifest).toolId, manifest.toolId);
  }
});
