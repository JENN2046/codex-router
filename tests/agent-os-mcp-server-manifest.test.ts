import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import {
  AgentOsMcpServerManifestSchema,
  AgentOsMcpToolManifestSchema,
  agentOsApproveRunMcpToolManifest,
  agentOsCreateTaskMcpToolManifest,
  agentOsDispatchWorkspaceWriteMcpToolManifest,
  agentOsMcpServerManifest,
  agentOsMcpToolManifests,
  listAgentOsMcpToolManifests
} from "../packages/protocol-mcp/src/agent-os-server-manifest.js";
import {
  McpToolDescriptorSchema
} from "../packages/protocol-mcp/src/index.js";

const expectedToolNames = [
  "agentos.create_task",
  "agentos.get_run",
  "agentos.list_runs",
  "agentos.cancel_run",
  "agentos.approve_run",
  "agentos.dispatch_workspace_write",
  "agentos.list_artifacts",
  "agentos.get_artifact",
  "agentos.search_events"
];

test("Agent OS MCP server manifest declares all tools and no runtime", () => {
  const manifest = AgentOsMcpServerManifestSchema.parse(agentOsMcpServerManifest);

  assert.equal(manifest.serverId, "agent-os");
  assert.equal(manifest.runtimeImplemented, false);
  assert.deepEqual(
    manifest.tools.map((tool) => tool.name),
    expectedToolNames
  );

  for (const tool of manifest.tools) {
    assert.equal(AgentOsMcpToolManifestSchema.parse(tool).name, tool.name);
    assert.equal(McpToolDescriptorSchema.parse(tool).name, tool.name);
    assert.equal(typeof tool.description, "string");
    assert.ok(tool.description.length > 0);
    assert.equal(typeof tool.inputSchema, "object");
    assert.equal(typeof tool.outputSchema, "object");
    assert.equal(typeof tool.approvalRequired, "boolean");
    assert.equal(tool.auditPolicy.recordInvocation, true);
  }
});

test("Agent OS MCP mutating tools have required capabilities and approval gates", () => {
  const mutatingTools = agentOsMcpToolManifests.filter((tool) => (
    tool.name === "agentos.create_task"
    || tool.name === "agentos.cancel_run"
    || tool.name === "agentos.approve_run"
    || tool.name === "agentos.dispatch_workspace_write"
  ));

  assert.deepEqual(
    mutatingTools.map((tool) => tool.name),
    [
      "agentos.create_task",
      "agentos.cancel_run",
      "agentos.approve_run",
      "agentos.dispatch_workspace_write"
    ]
  );

  for (const tool of mutatingTools) {
    assert.notEqual(tool.sideEffectClass, "read");
    assert.ok(tool.requiredCapabilities.length > 0);
    assert.equal(tool.approvalRequired, true);
    assert.equal(tool.metadata.policyGated, true);
    assert.equal(tool.auditPolicy.recordInput, true);
    assert.equal(tool.auditPolicy.recordOutput, true);
  }

  assert.ok(getTool("agentos.create_task").requiredCapabilities.includes("task.create"));
  assert.ok(getTool("agentos.cancel_run").requiredCapabilities.includes("run.cancel"));
  assert.ok(getTool("agentos.approve_run").requiredCapabilities.includes("approval.issue"));
  assert.ok(
    getTool("agentos.dispatch_workspace_write").requiredCapabilities.includes(
      "workspace_write.dispatch"
    )
  );
});

test("Agent OS MCP create_task output schema declares provider planning fields", () => {
  const outputSchema = agentOsCreateTaskMcpToolManifest.outputSchema as {
    additionalProperties?: unknown;
    properties?: Record<string, unknown>;
  };
  const properties = outputSchema.properties ?? {};

  assert.equal(outputSchema.additionalProperties, false);
  for (const outputKey of [
    "taskId",
    "runId",
    "status",
    "createdAt",
    "providerPlanId",
    "providerPlanStatus",
    "providerPlanningReasons"
  ]) {
    assert.ok(outputKey in properties, `missing create_task output property ${outputKey}`);
  }
  assert.deepEqual(properties.providerPlanStatus, {
    type: "string",
    enum: ["planned", "blocked", "waiting_approval"]
  });
  assert.deepEqual(properties.providerPlanningReasons, {
    type: "array",
    items: { type: "string" }
  });
});

test("Agent OS MCP approve_run cannot be declared without approval.issue", () => {
  assert.throws(
    () => AgentOsMcpToolManifestSchema.parse({
      ...agentOsApproveRunMcpToolManifest,
      requiredCapabilities: []
    }),
    z.ZodError
  );

  assert.throws(
    () => AgentOsMcpToolManifestSchema.parse({
      ...agentOsApproveRunMcpToolManifest,
      requiredCapabilities: ["run.read"]
    }),
    /Agent OS MCP tool requires capability:approval\.issue/
  );
});

test("Agent OS MCP approve_run output schema declares permit and blocked result shapes", () => {
  const outputSchema = agentOsApproveRunMcpToolManifest.outputSchema as {
    type?: unknown;
    oneOf?: unknown;
  };

  assert.equal(outputSchema.type, "object");
  assert.deepEqual(outputSchema.oneOf, [
    {
      type: "object",
      required: ["permitId", "runId", "expiresAt"],
      additionalProperties: false,
      properties: {
        permitId: { type: "string" },
        runId: { type: "string" },
        expiresAt: { type: "string" },
        consumedProviderPlanId: { type: "string" },
        approvalConsumptionReasons: {
          type: "array",
          items: { type: "string" }
        }
      }
    },
    {
      type: "object",
      required: ["status"],
      additionalProperties: false,
      properties: {
        status: {
          type: "string",
          enum: ["blocked"]
        }
      }
    }
  ]);
});

test("Agent OS MCP dispatch_workspace_write declares controlled dispatch only", () => {
  const inputSchema = agentOsDispatchWorkspaceWriteMcpToolManifest.inputSchema as {
    additionalProperties?: unknown;
    properties?: Record<string, unknown>;
  };
  const outputSchema = agentOsDispatchWorkspaceWriteMcpToolManifest.outputSchema as {
    additionalProperties?: unknown;
    properties?: Record<string, unknown>;
  };

  assert.equal(inputSchema.additionalProperties, false);
  assert.ok("dispatchInput" in (inputSchema.properties ?? {}));
  assert.ok("prepare" in (inputSchema.properties ?? {}));
  assert.equal(outputSchema.additionalProperties, false);
  assert.ok("preparedDispatch" in (outputSchema.properties ?? {}));
  assert.ok("dispatchResult" in (outputSchema.properties ?? {}));
  assert.equal(
    agentOsDispatchWorkspaceWriteMcpToolManifest.metadata.controlledWorkspaceWritePrepare,
    true
  );
  assert.equal(
    agentOsDispatchWorkspaceWriteMcpToolManifest.metadata.controlledWorkspaceWriteDispatch,
    true
  );
  assert.equal(
    agentOsDispatchWorkspaceWriteMcpToolManifest.metadata.preflightArtifactBindingRequired,
    true
  );
  assert.equal(
    agentOsDispatchWorkspaceWriteMcpToolManifest.metadata.providerExecuteForbidden,
    true
  );
  assert.equal(
    agentOsDispatchWorkspaceWriteMcpToolManifest.metadata.generalWorkspaceWriteForbidden,
    true
  );
});

test("Agent OS MCP list, get, and search tools are read side effect", () => {
  const readTools = [
    "agentos.get_run",
    "agentos.list_runs",
    "agentos.list_artifacts",
    "agentos.get_artifact",
    "agentos.search_events"
  ];

  for (const toolName of readTools) {
    const tool = getTool(toolName);
    assert.equal(tool.sideEffectClass, "read");
    assert.equal(tool.approvalRequired, false);
    assert.equal(tool.auditPolicy.recordInput, false);
    assert.equal(tool.auditPolicy.recordOutput, false);
  }

  assert.ok(getTool("agentos.get_artifact").requiredCapabilities.includes("artifact.read"));
  assert.ok(getTool("agentos.search_events").requiredCapabilities.includes("event.read"));
});

test("Agent OS MCP toolIds are unique and stable", () => {
  const listedTools = listAgentOsMcpToolManifests();
  const toolIds = listedTools.map((tool) => tool.toolId);

  assert.deepEqual(toolIds, expectedToolNames);
  assert.equal(new Set(toolIds).size, toolIds.length);
  assert.notEqual(listedTools[0], agentOsMcpToolManifests[0]);
});

function getTool(toolName: string) {
  const tool = agentOsMcpToolManifests.find((candidate) => candidate.name === toolName);
  assert.ok(tool, `missing tool ${toolName}`);
  return tool;
}
