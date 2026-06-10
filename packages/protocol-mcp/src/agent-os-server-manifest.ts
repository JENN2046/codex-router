import { z } from "zod";
import {
  ToolAuditPolicySchema,
  ToolSideEffectClassSchema,
  type ToolAuditPolicy,
  type ToolSideEffectClass
} from "../../tool-registry/src/index.js";

export const AgentOsMcpToolNameSchema = z.enum([
  "agentos.create_task",
  "agentos.get_run",
  "agentos.list_runs",
  "agentos.cancel_run",
  "agentos.approve_run",
  "agentos.list_artifacts",
  "agentos.get_artifact",
  "agentos.search_events"
]);

const requiredCapabilitiesByToolName = {
  "agentos.create_task": ["task.create"],
  "agentos.get_run": ["run.read"],
  "agentos.list_runs": ["run.read"],
  "agentos.cancel_run": ["run.cancel"],
  "agentos.approve_run": ["approval.issue"],
  "agentos.list_artifacts": ["artifact.read"],
  "agentos.get_artifact": ["artifact.read"],
  "agentos.search_events": ["event.read"]
} satisfies Record<z.infer<typeof AgentOsMcpToolNameSchema>, string[]>;

export const AgentOsMcpJsonSchemaSchema = z.record(z.string(), z.unknown());

export const AgentOsMcpToolManifestSchema = z.object({
  schemaVersion: z.literal("agent-os-mcp-tool-manifest.v1").default("agent-os-mcp-tool-manifest.v1"),
  toolId: z.string().min(1),
  name: AgentOsMcpToolNameSchema,
  description: z.string().min(1),
  inputSchema: AgentOsMcpJsonSchemaSchema,
  outputSchema: AgentOsMcpJsonSchemaSchema,
  sideEffectClass: ToolSideEffectClassSchema,
  requiredCapabilities: z.array(z.string().min(1)).min(1),
  approvalRequired: z.boolean(),
  auditPolicy: ToolAuditPolicySchema,
  metadata: z.record(z.string(), z.unknown()).default({})
}).superRefine((tool, ctx) => {
  if (tool.toolId !== tool.name) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Agent OS MCP toolId must match tool name",
      path: ["toolId"]
    });
  }

  const requiredCapabilities = requiredCapabilitiesByToolName[tool.name];
  for (const capability of requiredCapabilities) {
    if (!tool.requiredCapabilities.includes(capability)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Agent OS MCP tool requires capability:${capability}`,
        path: ["requiredCapabilities"]
      });
    }
  }

  if (isReadOnlyAgentOsTool(tool.name) && tool.sideEffectClass !== "read") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Agent OS list/get/search tools must be read side effect",
      path: ["sideEffectClass"]
    });
  }

  if (isMutatingAgentOsTool(tool.name) && tool.sideEffectClass === "read") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Agent OS mutating tools must not be read side effect",
      path: ["sideEffectClass"]
    });
  }

  if (isMutatingAgentOsTool(tool.name) && !tool.approvalRequired && !tool.metadata.policyGated) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Agent OS mutating tools require approvalRequired or policyGated metadata",
      path: ["approvalRequired"]
    });
  }
});

export const AgentOsMcpServerManifestSchema = z.object({
  schemaVersion: z.literal("agent-os-mcp-server-manifest.v1").default("agent-os-mcp-server-manifest.v1"),
  serverId: z.literal("agent-os"),
  description: z.string().min(1),
  runtimeImplemented: z.literal(false),
  tools: z.array(AgentOsMcpToolManifestSchema).length(8)
}).superRefine((manifest, ctx) => {
  const toolIds = manifest.tools.map((tool) => tool.toolId);
  const duplicateToolIds = findDuplicates(toolIds);

  for (const duplicate of duplicateToolIds) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `duplicate Agent OS MCP toolId:${duplicate}`,
      path: ["tools"]
    });
  }

  const names = new Set(manifest.tools.map((tool) => tool.name));
  for (const expectedName of AgentOsMcpToolNameSchema.options) {
    if (!names.has(expectedName)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `missing Agent OS MCP tool:${expectedName}`,
        path: ["tools"]
      });
    }
  }
});

export type AgentOsMcpToolName = z.infer<typeof AgentOsMcpToolNameSchema>;
export type AgentOsMcpToolManifest = z.infer<typeof AgentOsMcpToolManifestSchema>;
export type AgentOsMcpServerManifest = z.infer<typeof AgentOsMcpServerManifestSchema>;

export const agentOsCreateTaskMcpToolManifest = defineAgentOsMcpTool({
  toolId: "agentos.create_task",
  name: "agentos.create_task",
  description: "Create a governed Agent OS task record and optional initial run seed. No task handler is executed by this MCP manifest.",
  inputSchema: {
    type: "object",
    required: ["title", "requestedAction"],
    additionalProperties: false,
    properties: {
      title: { type: "string", minLength: 1 },
      requestedAction: { type: "string", minLength: 1 },
      successCriteria: {
        type: "array",
        items: { type: "string" },
        default: []
      },
      outOfScope: {
        type: "array",
        items: { type: "string" },
        default: []
      },
      repoRoot: { type: "string" },
      branch: { type: "string" },
      targetFiles: {
        type: "array",
        items: { type: "string" },
        default: []
      },
      metadata: { type: "object" }
    }
  },
  outputSchema: {
    type: "object",
    required: ["taskId", "status"],
    additionalProperties: false,
    properties: {
      taskId: { type: "string" },
      runId: { type: "string" },
      status: {
        type: "string",
        enum: ["queued", "blocked"]
      },
      createdAt: { type: "string" },
      providerPlanId: { type: "string" },
      providerPlanStatus: {
        type: "string",
        enum: ["planned", "blocked", "waiting_approval"]
      },
      providerPlanningReasons: {
        type: "array",
        items: { type: "string" }
      }
    }
  },
  sideEffectClass: "local_write",
  requiredCapabilities: ["task.create"],
  approvalRequired: true,
  auditPolicy: writeAuditPolicy(),
  metadata: {
    policyGated: true,
    runtimeImplemented: false
  }
});

export const agentOsGetRunMcpToolManifest = defineAgentOsMcpTool({
  toolId: "agentos.get_run",
  name: "agentos.get_run",
  description: "Read a single Agent OS run by runId.",
  inputSchema: {
    type: "object",
    required: ["runId"],
    additionalProperties: false,
    properties: {
      runId: { type: "string", minLength: 1 }
    }
  },
  outputSchema: {
    type: "object",
    required: ["run"],
    additionalProperties: false,
    properties: {
      run: { type: "object" }
    }
  },
  sideEffectClass: "read",
  requiredCapabilities: ["run.read"],
  approvalRequired: false,
  auditPolicy: readAuditPolicy(),
  metadata: {
    runtimeImplemented: false
  }
});

export const agentOsListRunsMcpToolManifest = defineAgentOsMcpTool({
  toolId: "agentos.list_runs",
  name: "agentos.list_runs",
  description: "List Agent OS runs using bounded filters.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      taskId: { type: "string" },
      status: {
        type: "string",
        enum: ["queued", "running", "blocked", "succeeded", "failed", "cancelled"]
      },
      limit: {
        type: "integer",
        minimum: 1,
        maximum: 100,
        default: 50
      },
      cursor: { type: "string" }
    }
  },
  outputSchema: {
    type: "object",
    required: ["runs"],
    additionalProperties: false,
    properties: {
      runs: {
        type: "array",
        items: { type: "object" }
      },
      nextCursor: { type: "string" }
    }
  },
  sideEffectClass: "read",
  requiredCapabilities: ["run.read"],
  approvalRequired: false,
  auditPolicy: readAuditPolicy(),
  metadata: {
    runtimeImplemented: false
  }
});

export const agentOsCancelRunMcpToolManifest = defineAgentOsMcpTool({
  toolId: "agentos.cancel_run",
  name: "agentos.cancel_run",
  description: "Cancel a queued or running Agent OS run. This manifest only describes the future tool; no handler is implemented.",
  inputSchema: {
    type: "object",
    required: ["runId", "reason"],
    additionalProperties: false,
    properties: {
      runId: { type: "string", minLength: 1 },
      reason: { type: "string", minLength: 1 }
    }
  },
  outputSchema: {
    type: "object",
    required: ["runId", "status"],
    additionalProperties: false,
    properties: {
      runId: { type: "string" },
      status: {
        type: "string",
        enum: ["cancelled", "blocked"]
      },
      eventId: { type: "string" }
    }
  },
  sideEffectClass: "local_write",
  requiredCapabilities: ["run.cancel"],
  approvalRequired: true,
  auditPolicy: writeAuditPolicy(),
  metadata: {
    policyGated: true,
    runtimeImplemented: false
  }
});

export const agentOsApproveRunMcpToolManifest = defineAgentOsMcpTool({
  toolId: "agentos.approve_run",
  name: "agentos.approve_run",
  description: "Issue an approval permit for a governed run scope. This is a manifest-only declaration.",
  inputSchema: {
    type: "object",
    required: ["runId", "capabilityScopes", "reason"],
    additionalProperties: false,
    properties: {
      runId: { type: "string", minLength: 1 },
      capabilityScopes: {
        type: "array",
        minItems: 1,
        items: { type: "string" }
      },
      expiresAt: { type: "string" },
      reason: { type: "string", minLength: 1 }
    }
  },
  outputSchema: {
    type: "object",
    oneOf: [
      {
        type: "object",
        required: ["permitId", "runId", "expiresAt"],
        additionalProperties: false,
        properties: {
          permitId: { type: "string" },
          runId: { type: "string" },
          expiresAt: { type: "string" }
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
    ]
  },
  sideEffectClass: "local_write",
  requiredCapabilities: ["approval.issue"],
  approvalRequired: true,
  auditPolicy: writeAuditPolicy(),
  metadata: {
    policyGated: true,
    runtimeImplemented: false
  }
});

export const agentOsListArtifactsMcpToolManifest = defineAgentOsMcpTool({
  toolId: "agentos.list_artifacts",
  name: "agentos.list_artifacts",
  description: "List Agent OS artifacts using bounded filters.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      taskId: { type: "string" },
      runId: { type: "string" },
      kind: {
        type: "string",
        enum: ["file", "log", "patch", "evidence", "checkpoint", "other"]
      },
      limit: {
        type: "integer",
        minimum: 1,
        maximum: 100,
        default: 50
      },
      cursor: { type: "string" }
    }
  },
  outputSchema: {
    type: "object",
    required: ["artifacts"],
    additionalProperties: false,
    properties: {
      artifacts: {
        type: "array",
        items: { type: "object" }
      },
      nextCursor: { type: "string" }
    }
  },
  sideEffectClass: "read",
  requiredCapabilities: ["artifact.read"],
  approvalRequired: false,
  auditPolicy: readAuditPolicy(),
  metadata: {
    runtimeImplemented: false
  }
});

export const agentOsGetArtifactMcpToolManifest = defineAgentOsMcpTool({
  toolId: "agentos.get_artifact",
  name: "agentos.get_artifact",
  description: "Read a single Agent OS artifact by artifactId.",
  inputSchema: {
    type: "object",
    required: ["artifactId"],
    additionalProperties: false,
    properties: {
      artifactId: { type: "string", minLength: 1 }
    }
  },
  outputSchema: {
    type: "object",
    required: ["artifact"],
    additionalProperties: false,
    properties: {
      artifact: { type: "object" }
    }
  },
  sideEffectClass: "read",
  requiredCapabilities: ["artifact.read"],
  approvalRequired: false,
  auditPolicy: readAuditPolicy(),
  metadata: {
    runtimeImplemented: false
  }
});

export const agentOsSearchEventsMcpToolManifest = defineAgentOsMcpTool({
  toolId: "agentos.search_events",
  name: "agentos.search_events",
  description: "Search Agent OS event records using bounded filters.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      query: { type: "string" },
      taskId: { type: "string" },
      runId: { type: "string" },
      eventTypes: {
        type: "array",
        items: { type: "string" }
      },
      limit: {
        type: "integer",
        minimum: 1,
        maximum: 100,
        default: 50
      },
      cursor: { type: "string" }
    }
  },
  outputSchema: {
    type: "object",
    required: ["events"],
    additionalProperties: false,
    properties: {
      events: {
        type: "array",
        items: { type: "object" }
      },
      nextCursor: { type: "string" }
    }
  },
  sideEffectClass: "read",
  requiredCapabilities: ["event.read"],
  approvalRequired: false,
  auditPolicy: readAuditPolicy(),
  metadata: {
    runtimeImplemented: false
  }
});

export const agentOsMcpToolManifests = [
  agentOsCreateTaskMcpToolManifest,
  agentOsGetRunMcpToolManifest,
  agentOsListRunsMcpToolManifest,
  agentOsCancelRunMcpToolManifest,
  agentOsApproveRunMcpToolManifest,
  agentOsListArtifactsMcpToolManifest,
  agentOsGetArtifactMcpToolManifest,
  agentOsSearchEventsMcpToolManifest
] as const;

export const agentOsMcpServerManifest = AgentOsMcpServerManifestSchema.parse({
  schemaVersion: "agent-os-mcp-server-manifest.v1",
  serverId: "agent-os",
  description: "Manifest-only declaration for exposing Agent OS governance capabilities through MCP. No server runtime or handlers are implemented in Phase 3.",
  runtimeImplemented: false,
  tools: agentOsMcpToolManifests
});

export function parseAgentOsMcpToolManifest(input: unknown): AgentOsMcpToolManifest {
  return AgentOsMcpToolManifestSchema.parse(input);
}

export function listAgentOsMcpToolManifests(): AgentOsMcpToolManifest[] {
  return agentOsMcpToolManifests.map((tool) => cloneToolManifest(tool));
}

function defineAgentOsMcpTool(
  input: z.input<typeof AgentOsMcpToolManifestSchema>
): AgentOsMcpToolManifest {
  return AgentOsMcpToolManifestSchema.parse(input);
}

function readAuditPolicy(): ToolAuditPolicy {
  return {
    recordInvocation: true,
    recordInput: false,
    recordOutput: false,
    retention: "run"
  };
}

function writeAuditPolicy(): ToolAuditPolicy {
  return {
    recordInvocation: true,
    recordInput: true,
    recordOutput: true,
    retention: "workspace"
  };
}

function isReadOnlyAgentOsTool(name: AgentOsMcpToolName): boolean {
  return name === "agentos.get_run"
    || name === "agentos.list_runs"
    || name === "agentos.list_artifacts"
    || name === "agentos.get_artifact"
    || name === "agentos.search_events";
}

function isMutatingAgentOsTool(name: AgentOsMcpToolName): boolean {
  return name === "agentos.create_task"
    || name === "agentos.cancel_run"
    || name === "agentos.approve_run";
}

function findDuplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }
    seen.add(value);
  }

  return [...duplicates];
}

function cloneToolManifest(tool: AgentOsMcpToolManifest): AgentOsMcpToolManifest {
  return AgentOsMcpToolManifestSchema.parse(structuredClone(tool));
}
