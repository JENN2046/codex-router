import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import {
  MCP_TOOL_PROVIDER_INVOKE_DISABLED,
  McpServerRefSchema,
  createFakeMcpToolProvider,
  createMcpToolProviderSkeleton,
  mcpToolToToolManifest,
  parseMcpServerRef,
  toolManifestToMcpToolDescriptor,
  type McpServerRef
} from "../packages/protocol-mcp/src/index.js";
import {
  planToolInvocation
} from "../packages/tool-invocation-planner/src/index.js";
import {
  PolicyDecisionSchema,
  RunSchema,
  SandboxProfileSchema,
  StepSchema,
  type PolicyDecision,
  type Run,
  type SandboxProfile,
  type Step
} from "../packages/kernel-contracts/src/index.js";
import { validPolicyDecision } from "../packages/kernel-contracts/test-fixtures/valid-policy-decision.js";
import { validPrincipal } from "../packages/kernel-contracts/test-fixtures/valid-principal.js";
import { validRun } from "../packages/kernel-contracts/test-fixtures/valid-run.js";
import { validStep } from "../packages/kernel-contracts/test-fixtures/valid-step.js";

const now = "2026-06-04T00:30:00.000Z";

test("protocol-mcp maps an MCP tool descriptor to a ToolManifest", () => {
  const serverRef = createServerRef({
    allowedTools: ["repo_search"]
  });
  const manifest = mcpToolToToolManifest({
    serverRef,
    tool: {
      name: "repo_search",
      title: "Repo Search",
      description: "Search local indexed repo docs.",
      inputSchema: {
        type: "object",
        required: ["query"],
        properties: {
          query: { type: "string" }
        }
      },
      outputSchema: {
        type: "object",
        properties: {
          matches: {
            type: "array",
            items: { type: "string" }
          }
        }
      },
      annotations: {
        sideEffectClass: "read"
      },
      metadata: {
        source: "fixture"
      }
    }
  });
  const descriptor = toolManifestToMcpToolDescriptor(manifest);

  assert.equal(manifest.toolId, "mcp.local-dev.repo_search");
  assert.equal(manifest.provider, "mcp");
  assert.equal(manifest.serverRef, "local-dev");
  assert.equal(manifest.sideEffectClass, "read");
  assert.deepEqual(manifest.inputSchema.required, ["query"]);
  assert.deepEqual(manifest.outputSchema.properties, {
    matches: {
      type: "array",
      items: { type: "string" }
    }
  });
  assert.deepEqual(manifest.requiredCapabilities, [
    "mcp.call:local-dev.repo_search"
  ]);
  assert.deepEqual(manifest.metadata.mcp, {
    serverId: "local-dev",
    transport: "stdio",
    commandRef: "mcp-command:local-dev",
    trustLevel: "untrusted",
    toolName: "repo_search",
    title: "Repo Search",
    description: "Search local indexed repo docs.",
    annotations: {
      sideEffectClass: "read"
    },
    metadata: {
      source: "fixture"
    },
    outputSchemaKnown: true,
    sideEffectClassSource: "manifest_annotation",
    approvalRequiredByDefault: false
  });
  assert.equal(descriptor.name, "repo_search");
  assert.deepEqual(descriptor.inputSchema, manifest.inputSchema);
  assert.deepEqual(descriptor.outputSchema, manifest.outputSchema);
});

test("protocol-mcp defaults missing sideEffectClass to unknown and requires approval", async () => {
  const serverRef = createServerRef({
    allowedTools: ["summarize"]
  });
  const manifest = mcpToolToToolManifest({
    serverRef,
    tool: {
      name: "summarize",
      inputSchema: {
        type: "object",
        properties: {
          text: { type: "string" }
        }
      }
    }
  });
  const provider = createMcpToolProviderSkeleton(serverRef);
  const invocationPlan = await provider.planInvocation(createToolInvocationInput({
    run: createRun(),
    toolManifest: manifest
  }));
  const plannerPlan = planToolInvocation({
    run: createRun(),
    step: createStep(),
    toolManifest: manifest,
    proposedInput: {
      text: "fixture"
    },
    principal: validPrincipal,
    capabilityGrants: [
      "mcp.call:local-dev.summarize"
    ],
    approvalPermits: [],
    policyDecision: createPolicyDecision(),
    planHash: "plan_hash_protocol_mcp_unknown_001",
    now
  });

  assert.equal(manifest.sideEffectClass, "unknown");
  assert.equal((manifest.metadata.mcp as Record<string, unknown>).approvalRequiredByDefault, true);
  assert.equal(invocationPlan.approvalRequired, true);
  assert.equal(invocationPlan.sideEffectClass, "unknown");
  assert.equal(plannerPlan.status, "waiting_approval");
  assert.equal(plannerPlan.approvalRequired, true);
  assert.ok(plannerPlan.reasons.includes("approval_required"));
});

test("protocol-mcp provider skeleton enforces allowedTools allowlist", async () => {
  const provider = createMcpToolProviderSkeleton(createServerRef({
    allowedTools: ["repo_search"]
  }));
  const allowedManifest = mcpToolToToolManifest({
    serverRef: createServerRef({
      allowedTools: ["repo_search"]
    }),
    tool: {
      name: "repo_search",
      inputSchema: { type: "object" },
      annotations: {
        sideEffectClass: "read"
      }
    }
  });
  const blockedManifest = mcpToolToToolManifest({
    serverRef: createServerRef({
      allowedTools: ["repo_search"]
    }),
    tool: {
      name: "repo_write",
      inputSchema: { type: "object" },
      annotations: {
        sideEffectClass: "local_write"
      }
    }
  });

  const plan = await provider.planInvocation(createToolInvocationInput({
    toolManifest: allowedManifest
  }));

  assert.equal(plan.toolId, "mcp.local-dev.repo_search");
  assert.equal(plan.approvalRequired, false);
  assert.throws(
    () => provider.planInvocation(createToolInvocationInput({
      toolManifest: blockedManifest
    })),
    /mcp_tool_not_allowlisted:local-dev:repo_write/
  );
});

test("protocol-mcp provider skeleton rejects unsupported invocation sandboxes", () => {
  const provider = createMcpToolProviderSkeleton(createServerRef({
    allowedTools: ["repo_search"]
  }));
  const manifest = mcpToolToToolManifest({
    serverRef: createServerRef({
      allowedTools: ["repo_search"]
    }),
    tool: {
      name: "repo_search",
      inputSchema: { type: "object" },
      annotations: {
        sideEffectClass: "read"
      }
    }
  });

  assert.throws(
    () => provider.planInvocation(createToolInvocationInput({
      toolManifest: manifest,
      sandboxProfile: SandboxProfileSchema.parse({
        schemaVersion: "sandbox-profile.v1",
        sandboxId: "sandbox_protocol_mcp_workspace_write",
        mode: "workspace-write",
        networkAccess: "none",
        writableRoots: ["workspace/**"],
        envPolicy: {
          inheritProcessEnv: false,
          allowlist: []
        }
      })
    })),
    /unsupported_sandbox_profile:mcp\.local-dev:sandbox_protocol_mcp_workspace_write/
  );
});

test("protocol-mcp provider hashes undefined proposed input deterministically", async () => {
  const provider = createMcpToolProviderSkeleton(createServerRef({
    allowedTools: ["repo_search"]
  }));
  const manifest = mcpToolToToolManifest({
    serverRef: createServerRef({
      allowedTools: ["repo_search"]
    }),
    tool: {
      name: "repo_search",
      inputSchema: { type: "object" },
      annotations: {
        sideEffectClass: "read"
      }
    }
  });
  const first = await provider.planInvocation(createToolInvocationInput({
    toolManifest: manifest,
    proposedInput: undefined
  }));
  const second = await provider.planInvocation(createToolInvocationInput({
    toolManifest: manifest,
    proposedInput: undefined
  }));

  assert.match(first.inputHash, /^[a-f0-9]{64}$/);
  assert.equal(first.inputHash, second.inputHash);
});

test("protocol-mcp provider skeleton enforces disabledTools blocklist", () => {
  const serverRef = createServerRef({
    allowedTools: ["repo_search"],
    disabledTools: ["repo_search"]
  });
  const provider = createMcpToolProviderSkeleton(serverRef);
  const manifest = mcpToolToToolManifest({
    serverRef,
    tool: {
      name: "repo_search",
      inputSchema: { type: "object" },
      annotations: {
        sideEffectClass: "read"
      }
    }
  });

  assert.throws(
    () => provider.planInvocation(createToolInvocationInput({
      toolManifest: manifest
    })),
    /mcp_tool_disabled:local-dev:repo_search/
  );
});

test("protocol-mcp rejects raw stdio commands and treats commandRef as a reference", () => {
  assert.throws(
    () => parseMcpServerRef({
      serverId: "unsafe",
      transport: "stdio",
      commandRef: "node ./server.js --flag value",
      allowedTools: ["safe_tool"],
      disabledTools: [],
      trustLevel: "untrusted",
      createdAt: now
    }),
    z.ZodError
  );

  const serverRef = parseMcpServerRef({
    serverId: "safe",
    transport: "stdio",
    commandRef: "mcp-command:safe-server",
    createdAt: now
  });
  const manifest = mcpToolToToolManifest({
    serverRef: {
      ...serverRef,
      allowedTools: ["safe_tool"]
    },
    tool: {
      name: "safe_tool",
      inputSchema: { type: "object" }
    }
  });

  assert.equal(serverRef.allowedTools.length, 0);
  assert.equal((manifest.metadata.mcp as Record<string, unknown>).commandRef, "mcp-command:safe-server");
  assert.equal(JSON.stringify(manifest).includes("node ./server.js"), false);
});

test("protocol-mcp provider skeleton invoke is disabled", async () => {
  const serverRef = createServerRef({
    allowedTools: ["repo_search"]
  });
  const provider = createMcpToolProviderSkeleton(serverRef);
  const manifest = mcpToolToToolManifest({
    serverRef,
    tool: {
      name: "repo_search",
      inputSchema: { type: "object" }
    }
  });
  const plan = await provider.planInvocation(createToolInvocationInput({
    toolManifest: manifest
  }));

  assert.deepEqual(await provider.listTools(), []);
  assert.equal(await provider.getTool(manifest.toolId), undefined);
  await assert.rejects(
    async () => provider.invoke(plan, {}),
    new RegExp(MCP_TOOL_PROVIDER_INVOKE_DISABLED)
  );
});

test("protocol-mcp fake server exposes descriptors for local integration without invocation", async () => {
  const serverRef = createServerRef({
    allowedTools: ["repo_search", "repo_summary"]
  });
  const provider = createFakeMcpToolProvider({
    serverRef,
    tools: [
      {
        name: "repo_search",
        title: "Repo Search",
        inputSchema: {
          type: "object",
          required: ["query"],
          properties: {
            query: { type: "string" }
          }
        }
      },
      {
        name: "repo_summary",
        inputSchema: {
          type: "object"
        }
      }
    ],
    sideEffectClasses: {
      repo_search: "read",
      repo_summary: "read"
    }
  });
  const tools = await provider.listTools();
  const searchTool = await provider.getTool("mcp.local-dev.repo_search");

  assert.equal(provider.fakeServer.liveServerConnection, false);
  assert.equal(provider.fakeServer.toolCount, 2);
  assert.deepEqual(
    tools.map((tool) => tool.toolId),
    ["mcp.local-dev.repo_search", "mcp.local-dev.repo_summary"]
  );
  assert.ok(searchTool);
  assert.equal(searchTool?.metadata.mcp !== undefined, true);

  const plan = await provider.planInvocation(createToolInvocationInput({
    toolManifest: searchTool,
    proposedInput: {
      query: "ProviderExecutionPlan"
    }
  }));

  assert.equal(plan.providerId, "mcp.local-dev");
  assert.equal(plan.toolId, "mcp.local-dev.repo_search");
  assert.equal(plan.approvalRequired, false);
  assert.equal((plan.metadata.mcp as Record<string, unknown>).liveServerConnection, false);
  await assert.rejects(
    async () => provider.invoke(plan, { dryRun: true }),
    new RegExp(MCP_TOOL_PROVIDER_INVOKE_DISABLED)
  );
});

function createServerRef(overrides: Partial<McpServerRef> = {}): McpServerRef {
  return McpServerRefSchema.parse({
    schemaVersion: "mcp-server-ref.v1",
    serverId: "local-dev",
    transport: "stdio",
    commandRef: "mcp-command:local-dev",
    allowedTools: [],
    disabledTools: [],
    trustLevel: "untrusted",
    createdAt: now,
    ...overrides
  });
}

function createToolInvocationInput(overrides: Partial<{
  run: Run;
  stepId: string;
  toolManifest: Parameters<ReturnType<typeof createMcpToolProviderSkeleton>["planInvocation"]>[0]["toolManifest"];
  proposedInput: unknown;
  sandboxProfile: SandboxProfile;
}>): Parameters<ReturnType<typeof createMcpToolProviderSkeleton>["planInvocation"]>[0] {
  return {
    run: overrides.run ?? createRun(),
    stepId: overrides.stepId ?? "step_protocol_mcp_001",
    toolManifest: overrides.toolManifest ?? mcpToolToToolManifest({
      serverRef: createServerRef({
        allowedTools: ["repo_search"]
      }),
      tool: {
        name: "repo_search",
        inputSchema: { type: "object" }
      }
    }),
    proposedInput: "proposedInput" in overrides ? overrides.proposedInput : {},
    sandboxProfile: overrides.sandboxProfile ?? createSandboxProfile(),
    now
  };
}

function createRun(): Run {
  return RunSchema.parse({
    ...validRun,
    runId: "run_protocol_mcp_001",
    taskId: "task_protocol_mcp_001"
  });
}

function createStep(): Step {
  return StepSchema.parse({
    ...validStep,
    stepId: "step_protocol_mcp_001",
    runId: "run_protocol_mcp_001",
    taskId: "task_protocol_mcp_001",
    kind: "tool"
  });
}

function createSandboxProfile(): SandboxProfile {
  return SandboxProfileSchema.parse({
    schemaVersion: "sandbox-profile.v1",
    sandboxId: "sandbox_protocol_mcp_readonly",
    mode: "read-only",
    networkAccess: "none",
    writableRoots: [],
    envPolicy: {
      inheritProcessEnv: false,
      allowlist: []
    }
  });
}

function createPolicyDecision(): PolicyDecision {
  return PolicyDecisionSchema.parse({
    ...validPolicyDecision,
    taskId: "task_protocol_mcp_001",
    capabilities: [],
    approval: {
      required: false,
      reasons: []
    },
    risk: {
      level: "low",
      factors: [],
      ambiguityScore: 0,
      clarificationRequired: false
    }
  });
}
