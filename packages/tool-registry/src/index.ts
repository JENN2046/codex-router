import { z } from "zod";

export const ToolProviderSchema = z.enum(["builtin", "local", "mcp", "remote"]);

export const ToolSideEffectClassSchema = z.enum([
  "none",
  "read",
  "local_write",
  "external_write",
  "destructive",
  "secret_access",
  "unknown"
]);

export const ToolAuditPolicySchema = z.object({
  recordInvocation: z.boolean().default(true),
  recordInput: z.boolean().default(false),
  recordOutput: z.boolean().default(false),
  retention: z.enum(["none", "ephemeral", "run", "workspace"]).default("run")
});

export const ToolRedactionPolicySchema = z.object({
  redactInput: z.boolean().default(true),
  redactOutput: z.boolean().default(true),
  secretKeys: z.array(z.string().min(1)).default([])
});

export const RegisteredToolManifestSchema = z.object({
  schemaVersion: z.literal("tool-registry-manifest.v1").default("tool-registry-manifest.v1"),
  toolId: z.string().min(1),
  provider: ToolProviderSchema,
  inputSchema: z.record(z.string(), z.unknown()),
  outputSchema: z.record(z.string(), z.unknown()),
  sideEffectClass: ToolSideEffectClassSchema,
  requiredCapabilities: z.array(z.string().min(1)).default([]),
  defaultTimeoutMs: z.number().int().positive(),
  auditPolicy: ToolAuditPolicySchema,
  redactionPolicy: ToolRedactionPolicySchema,
  serverRef: z.string().min(1).optional(),
  endpointRef: z.string().min(1).optional(),
  metadata: z.record(z.string(), z.unknown()).default({})
}).superRefine((manifest, ctx) => {
  if (
    isDangerousSideEffectClass(manifest.sideEffectClass)
    && manifest.requiredCapabilities.length === 0
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "dangerous tools must declare requiredCapabilities",
      path: ["requiredCapabilities"]
    });
  }

  if (manifest.provider === "mcp" && !manifest.serverRef && !hasRecord(manifest.metadata.mcp)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "mcp provider requires serverRef or metadata.mcp",
      path: ["serverRef"]
    });
  }

  if (
    manifest.provider === "remote"
    && !manifest.endpointRef
    && !hasRecord(manifest.metadata.remote)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "remote provider requires endpointRef or metadata.remote",
      path: ["endpointRef"]
    });
  }
});

export type ToolProvider = z.infer<typeof ToolProviderSchema>;
export type ToolSideEffectClass = z.infer<typeof ToolSideEffectClassSchema>;
export type ToolAuditPolicy = z.infer<typeof ToolAuditPolicySchema>;
export type ToolRedactionPolicy = z.infer<typeof ToolRedactionPolicySchema>;
export type RegisteredToolManifest = z.infer<typeof RegisteredToolManifestSchema>;
export type ToolManifestInput = z.input<typeof RegisteredToolManifestSchema>;

export type ToolRegistryFilter = {
  provider?: ToolProvider;
  sideEffectClass?: ToolSideEffectClass;
  requiredCapability?: string;
};

export interface ToolRegistry {
  registerTool(manifest: ToolManifestInput): RegisteredToolManifest;
  getTool(toolId: string): RegisteredToolManifest | undefined;
  listTools(filter?: ToolRegistryFilter): RegisteredToolManifest[];
  unregisterTool(toolId: string): RegisteredToolManifest | undefined;
}

export class InMemoryToolRegistry implements ToolRegistry {
  private readonly tools = new Map<string, RegisteredToolManifest>();

  registerTool(manifest: ToolManifestInput): RegisteredToolManifest {
    const parsed = RegisteredToolManifestSchema.parse(manifest);

    if (this.tools.has(parsed.toolId)) {
      throw new Error(`duplicate_tool_id:${parsed.toolId}`);
    }

    this.tools.set(parsed.toolId, cloneManifest(parsed));
    return cloneManifest(parsed);
  }

  getTool(toolId: string): RegisteredToolManifest | undefined {
    const manifest = this.tools.get(toolId);
    return manifest ? cloneManifest(manifest) : undefined;
  }

  listTools(filter: ToolRegistryFilter = {}): RegisteredToolManifest[] {
    return [...this.tools.values()]
      .filter((manifest) => matchesToolFilter(manifest, filter))
      .map(cloneManifest);
  }

  unregisterTool(toolId: string): RegisteredToolManifest | undefined {
    const manifest = this.tools.get(toolId);

    if (!manifest) {
      return undefined;
    }

    this.tools.delete(toolId);
    return cloneManifest(manifest);
  }
}

export function createDefaultToolRegistry(
  manifests: readonly ToolManifestInput[] = defaultToolManifests
): ToolRegistry {
  const registry = new InMemoryToolRegistry();
  for (const manifest of manifests) {
    registry.registerTool(manifest);
  }
  return registry;
}

export const builtinReadFileToolManifest = {
  schemaVersion: "tool-registry-manifest.v1",
  toolId: "builtin.read_file",
  provider: "builtin",
  inputSchema: {
    type: "object",
    required: ["path"],
    properties: {
      path: { type: "string" }
    }
  },
  outputSchema: {
    type: "object",
    properties: {
      content: { type: "string" }
    }
  },
  sideEffectClass: "read",
  requiredCapabilities: ["fs.read:/repo/**"],
  defaultTimeoutMs: 10_000,
  auditPolicy: {
    recordInvocation: true,
    recordInput: false,
    recordOutput: false,
    retention: "run"
  },
  redactionPolicy: {
    redactInput: true,
    redactOutput: true,
    secretKeys: ["token", "password", "secret", "apiKey"]
  },
  metadata: {
    fixture: true
  }
} satisfies ToolManifestInput;

export const builtinApplyPatchToolManifest = {
  schemaVersion: "tool-registry-manifest.v1",
  toolId: "builtin.apply_patch",
  provider: "builtin",
  inputSchema: {
    type: "object",
    required: ["patch"],
    properties: {
      patch: { type: "string" }
    }
  },
  outputSchema: {
    type: "object",
    properties: {
      applied: { type: "boolean" }
    }
  },
  sideEffectClass: "local_write",
  requiredCapabilities: ["fs.write:/repo/**"],
  defaultTimeoutMs: 10_000,
  auditPolicy: {
    recordInvocation: true,
    recordInput: false,
    recordOutput: true,
    retention: "run"
  },
  redactionPolicy: {
    redactInput: true,
    redactOutput: true,
    secretKeys: ["token", "password", "secret", "apiKey"]
  },
  metadata: {
    fixture: true
  }
} satisfies ToolManifestInput;

export const mcpGithubCreatePullRequestToolManifest = {
  schemaVersion: "tool-registry-manifest.v1",
  toolId: "mcp.github.create_pull_request",
  provider: "mcp",
  inputSchema: {
    type: "object",
    required: ["title", "head", "base"],
    properties: {
      title: { type: "string" },
      head: { type: "string" },
      base: { type: "string" }
    }
  },
  outputSchema: {
    type: "object",
    properties: {
      pullRequestRef: { type: "string" }
    }
  },
  sideEffectClass: "external_write",
  requiredCapabilities: ["mcp.call:github.create_pull_request"],
  defaultTimeoutMs: 30_000,
  auditPolicy: {
    recordInvocation: true,
    recordInput: true,
    recordOutput: true,
    retention: "workspace"
  },
  redactionPolicy: {
    redactInput: true,
    redactOutput: true,
    secretKeys: ["token", "authorization", "secret"]
  },
  serverRef: "github",
  metadata: {
    mcp: {
      server: "github",
      method: "create_pull_request"
    },
    fixture: true
  }
} satisfies ToolManifestInput;

export const remoteAgentInvokeToolManifest = {
  schemaVersion: "tool-registry-manifest.v1",
  toolId: "remote.agent.invoke",
  provider: "remote",
  inputSchema: {
    type: "object",
    required: ["agentRef", "task"],
    properties: {
      agentRef: { type: "string" },
      task: { type: "object" }
    }
  },
  outputSchema: {
    type: "object",
    properties: {
      runRef: { type: "string" }
    }
  },
  sideEffectClass: "external_write",
  requiredCapabilities: ["network.egress:agent-runtime", "tool.invoke:remote.agent"],
  defaultTimeoutMs: 60_000,
  auditPolicy: {
    recordInvocation: true,
    recordInput: true,
    recordOutput: true,
    retention: "workspace"
  },
  redactionPolicy: {
    redactInput: true,
    redactOutput: true,
    secretKeys: ["token", "authorization", "secret"]
  },
  endpointRef: "agent-runtime",
  metadata: {
    remote: {
      endpointRef: "agent-runtime"
    },
    fixture: true
  }
} satisfies ToolManifestInput;

export const defaultToolManifests = [
  builtinReadFileToolManifest,
  builtinApplyPatchToolManifest,
  mcpGithubCreatePullRequestToolManifest,
  remoteAgentInvokeToolManifest
] as const;

function isDangerousSideEffectClass(sideEffectClass: ToolSideEffectClass): boolean {
  return sideEffectClass === "local_write"
    || sideEffectClass === "external_write"
    || sideEffectClass === "destructive"
    || sideEffectClass === "secret_access"
    || sideEffectClass === "unknown";
}

function matchesToolFilter(
  manifest: RegisteredToolManifest,
  filter: ToolRegistryFilter
): boolean {
  return matchesOptional(filter.provider, manifest.provider)
    && matchesOptional(filter.sideEffectClass, manifest.sideEffectClass)
    && (
      filter.requiredCapability === undefined
      || manifest.requiredCapabilities.includes(filter.requiredCapability)
    );
}

function matchesOptional<T>(expected: T | undefined, actual: T): boolean {
  return expected === undefined || expected === actual;
}

function hasRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}

function cloneManifest(manifest: RegisteredToolManifest): RegisteredToolManifest {
  return RegisteredToolManifestSchema.parse(structuredClone(manifest));
}
