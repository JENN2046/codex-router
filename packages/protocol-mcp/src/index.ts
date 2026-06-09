import { createHash } from "node:crypto";
import { z } from "zod";
import {
  SandboxProfileSchema
} from "../../kernel-contracts/src/index.js";
import {
  assertProviderSupportsSandboxProfile,
  parseProviderManifest,
  parseToolProviderInvocationPlan,
  type ProviderManifest,
  type ProviderSideEffectClass,
  type ProviderToolInvocationContext,
  type ToolInvocationInput,
  type ToolInvocationResult,
  type ToolProvider
} from "../../provider-core/src/index.js";
import {
  RegisteredToolManifestSchema,
  type RegisteredToolManifest,
  type ToolManifestInput,
  type ToolSideEffectClass
} from "../../tool-registry/src/index.js";

export * from "./agent-os-server-manifest.js";

export type ToolManifest = RegisteredToolManifest;

export const MCP_TOOL_PROVIDER_INVOKE_DISABLED =
  "mcp_tool_provider_invoke_disabled";

export const McpTransportSchema = z.enum(["stdio", "http", "sse"]);
export const McpTrustLevelSchema = z.enum([
  "untrusted",
  "reviewed",
  "trusted"
]);

export const McpServerRefSchema = z.object({
  schemaVersion: z.literal("mcp-server-ref.v1").default("mcp-server-ref.v1"),
  serverId: z.string().min(1),
  transport: McpTransportSchema,
  commandRef: z.string().min(1).optional(),
  endpointRef: z.string().min(1).optional(),
  allowedTools: z.array(z.string().min(1)).default([]),
  disabledTools: z.array(z.string().min(1)).default([]),
  trustLevel: McpTrustLevelSchema.default("untrusted"),
  createdAt: z.string().min(1)
}).superRefine((serverRef, ctx) => {
  if (serverRef.transport === "stdio") {
    if (!serverRef.commandRef) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "stdio MCP server refs require commandRef",
        path: ["commandRef"]
      });
    } else if (!isSafeCommandRef(serverRef.commandRef)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "commandRef must be an opaque reference, not a shell command",
        path: ["commandRef"]
      });
    }
  }

  if (serverRef.transport === "http" || serverRef.transport === "sse") {
    if (!serverRef.endpointRef) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${serverRef.transport} MCP server refs require endpointRef`,
        path: ["endpointRef"]
      });
    } else if (!isSafeEndpointRef(serverRef.endpointRef)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "endpointRef must be an opaque reference, not a raw URL",
        path: ["endpointRef"]
      });
    }
  }
});

export const McpJsonSchemaSchema = z.record(z.string(), z.unknown());

export const McpToolDescriptorSchema = z.object({
  name: z.string().min(1),
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  inputSchema: McpJsonSchemaSchema,
  outputSchema: McpJsonSchemaSchema.optional(),
  annotations: z.record(z.string(), z.unknown()).optional(),
  metadata: z.record(z.string(), z.unknown()).default({})
}).passthrough();

export type McpTransport = z.infer<typeof McpTransportSchema>;
export type McpTrustLevel = z.infer<typeof McpTrustLevelSchema>;
export type McpServerRef = z.infer<typeof McpServerRefSchema>;
export type McpToolDescriptor = z.infer<typeof McpToolDescriptorSchema>;

export type McpToolToToolManifestInput = {
  serverRef: McpServerRef | z.input<typeof McpServerRefSchema>;
  tool: McpToolDescriptor | z.input<typeof McpToolDescriptorSchema>;
  sideEffectClass?: ToolSideEffectClass;
  defaultTimeoutMs?: number;
  requiredCapabilities?: string[];
};

export class McpToolProviderInvokeDisabledError extends Error {
  constructor() {
    super(MCP_TOOL_PROVIDER_INVOKE_DISABLED);
    this.name = "McpToolProviderInvokeDisabledError";
  }
}

export function parseMcpServerRef(
  input: z.input<typeof McpServerRefSchema>
): McpServerRef {
  return McpServerRefSchema.parse(input);
}

export function parseMcpToolDescriptor(
  input: z.input<typeof McpToolDescriptorSchema>
): McpToolDescriptor {
  return McpToolDescriptorSchema.parse(input);
}

export function mcpToolToToolManifest(
  input: McpToolToToolManifestInput
): ToolManifest {
  const serverRef = parseMcpServerRef(input.serverRef);
  const tool = parseMcpToolDescriptor(input.tool);
  const sideEffectClass = resolveToolSideEffectClass(input, tool);
  const toolName = tool.name;
  const toolId = createMcpToolId(serverRef.serverId, toolName);
  const requiredCapabilities = input.requiredCapabilities
    ?? [`mcp.call:${serverRef.serverId}.${toolName}`];
  const manifest: ToolManifestInput = {
    schemaVersion: "tool-registry-manifest.v1",
    toolId,
    provider: "mcp",
    inputSchema: tool.inputSchema,
    outputSchema: tool.outputSchema ?? {},
    sideEffectClass,
    requiredCapabilities,
    defaultTimeoutMs: input.defaultTimeoutMs ?? 30_000,
    auditPolicy: {
      recordInvocation: true,
      recordInput: sideEffectClass !== "read" && sideEffectClass !== "none",
      recordOutput: sideEffectClass !== "read" && sideEffectClass !== "none",
      retention: sideEffectClass === "unknown" ? "workspace" : "run"
    },
    redactionPolicy: {
      redactInput: true,
      redactOutput: true,
      secretKeys: ["apiKey", "authorization", "credential", "password", "secret", "token"]
    },
    serverRef: serverRef.serverId,
    metadata: {
      mcp: {
        serverId: serverRef.serverId,
        transport: serverRef.transport,
        ...(serverRef.commandRef ? { commandRef: serverRef.commandRef } : {}),
        ...(serverRef.endpointRef ? { endpointRef: serverRef.endpointRef } : {}),
        trustLevel: serverRef.trustLevel,
        toolName,
        ...(tool.title ? { title: tool.title } : {}),
        ...(tool.description ? { description: tool.description } : {}),
        annotations: cloneRecord(tool.annotations ?? {}),
        metadata: cloneRecord(tool.metadata),
        outputSchemaKnown: tool.outputSchema !== undefined,
        sideEffectClassSource: sideEffectClass === "unknown"
          ? "missing"
          : resolveSideEffectClassSource(input, tool),
        approvalRequiredByDefault: sideEffectClass === "unknown"
      }
    }
  };

  return RegisteredToolManifestSchema.parse(manifest);
}

export function toolManifestToMcpToolDescriptor(
  manifestInput: ToolManifest
): McpToolDescriptor {
  const manifest = RegisteredToolManifestSchema.parse(manifestInput);
  const mcpMetadata = readMcpMetadata(manifest);
  const descriptor = {
    name: getString(mcpMetadata.toolName) ?? deriveMcpToolName(manifest),
    ...(getString(mcpMetadata.title) ? { title: getString(mcpMetadata.title) } : {}),
    ...(getString(mcpMetadata.description)
      ? { description: getString(mcpMetadata.description) }
      : {}),
    inputSchema: cloneRecord(manifest.inputSchema),
    outputSchema: cloneRecord(manifest.outputSchema),
    annotations: cloneRecord(readRecord(mcpMetadata.annotations) ?? {}),
    metadata: cloneRecord(readRecord(mcpMetadata.metadata) ?? {})
  };

  return McpToolDescriptorSchema.parse(descriptor);
}

export function createMcpToolProviderSkeleton(
  serverRefInput: McpServerRef | z.input<typeof McpServerRefSchema>
): ToolProvider {
  const serverRef = parseMcpServerRef(serverRefInput);
  const providerManifest = createMcpToolProviderManifest(serverRef);

  return {
    manifest: providerManifest,

    listTools(): ToolManifest[] {
      return [];
    },

    getTool(_toolId: string): ToolManifest | undefined {
      return undefined;
    },

    planInvocation(input: ToolInvocationInput) {
      const toolManifest = RegisteredToolManifestSchema.parse(input.toolManifest);
      assertMcpToolAllowed(serverRef, toolManifest);
      const sideEffectClass = mapToolSideEffectClass(toolManifest.sideEffectClass);
      const sandboxProfile = SandboxProfileSchema.parse(input.sandboxProfile);
      assertProviderSupportsSandboxProfile(providerManifest, sandboxProfile);

      return parseToolProviderInvocationPlan({
        schemaVersion: "tool-provider-invocation-plan.v1",
        kind: "tool",
        planId: createMcpInvocationPlanId(input, toolManifest),
        runId: input.run.runId,
        stepId: input.stepId,
        providerId: providerManifest.providerId,
        toolId: toolManifest.toolId,
        inputHash: hashUnknown(input.proposedInput),
        requiredCapabilities: [...toolManifest.requiredCapabilities],
        approvalRequired: requiresApproval(toolManifest.sideEffectClass),
        sandboxProfile,
        sideEffectClass,
        createdAt: input.now,
        metadata: {
          mcp: {
            serverId: serverRef.serverId,
            transport: serverRef.transport,
            toolId: toolManifest.toolId,
            toolName: getMcpToolName(toolManifest),
            invokeDisabled: true,
            liveServerConnection: false
          }
        }
      });
    },

    invoke(
      _plan,
      _context: ProviderToolInvocationContext
    ): ToolInvocationResult {
      throw new McpToolProviderInvokeDisabledError();
    }
  };
}

function createMcpToolProviderManifest(serverRef: McpServerRef): ProviderManifest {
  return parseProviderManifest({
    schemaVersion: "provider-manifest.v1",
    providerId: `mcp.${serverRef.serverId}`,
    kind: "tool",
    displayName: `MCP Tool Provider (${serverRef.serverId})`,
    version: "0.1.0",
    capabilities: [
      "mcp.tool.manifest.map",
      "mcp.tool.plan"
    ],
    requiredConfig: {
      keys: [],
      optionalKeys: []
    },
    securityBoundary: {
      isolation: serverRef.transport === "stdio" ? "process" : "remote",
      networkAccess: serverRef.transport === "stdio" ? "none" : "restricted",
      filesystemAccess: "none",
      secretAccess: "brokered",
      notes: [
        "Skeleton only; does not connect to a live MCP server.",
        "Stdio commandRef is an opaque reference and is never executed here.",
        "allowedTools defaults to empty; tools must be explicitly allowlisted."
      ]
    },
    supportedSandboxProfiles: [
      SandboxProfileSchema.parse({
        schemaVersion: "sandbox-profile.v1",
        sandboxId: `sandbox_mcp_${serverRef.serverId}_read_only`,
        mode: "read-only",
        networkAccess: serverRef.transport === "stdio" ? "none" : "restricted",
        writableRoots: [],
        envPolicy: {
          inheritProcessEnv: false,
          allowlist: []
        }
      })
    ],
    supportedSideEffectClasses: [
      "none",
      "read",
      "local_write",
      "external_write",
      "destructive",
      "secret_access",
      "unknown"
    ],
    enabled: true,
    metadata: {
      mcp: {
        serverId: serverRef.serverId,
        transport: serverRef.transport,
        allowedTools: [...serverRef.allowedTools],
        disabledTools: [...serverRef.disabledTools],
        trustLevel: serverRef.trustLevel,
        invokeDefault: "disabled",
        liveServerConnection: false
      }
    }
  });
}

function assertMcpToolAllowed(
  serverRef: McpServerRef,
  manifest: ToolManifest
): void {
  if (manifest.provider !== "mcp") {
    throw new Error(`mcp_provider_requires_mcp_tool:${manifest.toolId}`);
  }

  if (manifest.serverRef !== serverRef.serverId) {
    throw new Error(
      `mcp_tool_server_ref_mismatch:${manifest.serverRef ?? "missing"}:${serverRef.serverId}`
    );
  }

  const toolName = getMcpToolName(manifest);

  if (serverRef.allowedTools.length === 0) {
    throw new Error(`mcp_tool_not_allowlisted:${serverRef.serverId}:${toolName}`);
  }

  if (!matchesToolList(serverRef.allowedTools, manifest, toolName)) {
    throw new Error(`mcp_tool_not_allowlisted:${serverRef.serverId}:${toolName}`);
  }

  if (matchesToolList(serverRef.disabledTools, manifest, toolName)) {
    throw new Error(`mcp_tool_disabled:${serverRef.serverId}:${toolName}`);
  }
}

function resolveToolSideEffectClass(
  input: McpToolToToolManifestInput,
  tool: McpToolDescriptor
): ToolSideEffectClass {
  const candidates = [
    input.sideEffectClass,
    readToolSideEffectAnnotation(tool)
  ];

  for (const candidate of candidates) {
    if (isToolSideEffectClass(candidate)) {
      return candidate;
    }
  }

  return "unknown";
}

function resolveSideEffectClassSource(
  input: McpToolToToolManifestInput,
  tool: McpToolDescriptor
): "policy_override" | "manifest_annotation" {
  if (input.sideEffectClass !== undefined) {
    return "policy_override";
  }

  if (readToolSideEffectAnnotation(tool) !== undefined) {
    return "manifest_annotation";
  }

  return "manifest_annotation";
}

function readToolSideEffectAnnotation(tool: McpToolDescriptor): unknown {
  return tool.annotations?.sideEffectClass
    ?? tool.annotations?.side_effect_class
    ?? tool.metadata.sideEffectClass
    ?? tool.metadata.side_effect_class;
}

function mapToolSideEffectClass(
  sideEffectClass: ToolSideEffectClass
): ProviderSideEffectClass {
  if (sideEffectClass === "read") {
    return "read";
  }

  return sideEffectClass;
}

function requiresApproval(sideEffectClass: ToolSideEffectClass): boolean {
  return sideEffectClass === "unknown"
    || sideEffectClass === "local_write"
    || sideEffectClass === "external_write"
    || sideEffectClass === "destructive"
    || sideEffectClass === "secret_access";
}

function createMcpToolId(serverId: string, toolName: string): string {
  return `mcp.${toSafeIdPart(serverId)}.${toSafeIdPart(toolName)}`;
}

function deriveMcpToolName(manifest: ToolManifest): string {
  const prefix = `mcp.${manifest.serverRef ?? ""}.`;

  if (manifest.toolId.startsWith(prefix)) {
    return manifest.toolId.slice(prefix.length);
  }

  return manifest.toolId.split(".").at(-1) ?? manifest.toolId;
}

function getMcpToolName(manifest: ToolManifest): string {
  const mcpMetadata = readMcpMetadata(manifest);
  return getString(mcpMetadata.toolName) ?? deriveMcpToolName(manifest);
}

function createMcpInvocationPlanId(
  input: ToolInvocationInput,
  manifest: ToolManifest
): string {
  return `plan_mcp_${toSafeIdPart(input.run.runId)}_${toSafeIdPart(input.stepId)}_${hashUnknown({
    toolId: manifest.toolId,
    proposedInput: input.proposedInput
  }).slice(0, 12)}`;
}

function matchesToolList(
  tools: string[],
  manifest: ToolManifest,
  toolName: string
): boolean {
  return tools.includes(toolName) || tools.includes(manifest.toolId);
}

function readMcpMetadata(manifest: ToolManifest): Record<string, unknown> {
  return readRecord(manifest.metadata.mcp) ?? {};
}

function hashUnknown(input: unknown): string {
  return createHash("sha256")
    .update(stableStringify(input))
    .digest("hex");
}

function stableStringify(input: unknown): string {
  if (input === undefined) {
    return "null";
  }

  if (input === null || typeof input !== "object") {
    return JSON.stringify(input) ?? "null";
  }

  if (Array.isArray(input)) {
    return `[${input.map((item) => stableStringify(item)).join(",")}]`;
  }

  const record = input as Record<string, unknown>;
  const keys = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort();

  return `{${keys.map((key) => (
    `${JSON.stringify(key)}:${stableStringify(record[key])}`
  )).join(",")}}`;
}

function isSafeCommandRef(commandRef: string): boolean {
  return /^mcp-command:[A-Za-z0-9_.:/-]+$/.test(commandRef)
    && !/[;&|`$<>\r\n\t ]/.test(commandRef);
}

function isSafeEndpointRef(endpointRef: string): boolean {
  return /^mcp-endpoint:[A-Za-z0-9_.:/-]+$/.test(endpointRef)
    && !/[;&|`$<>\r\n\t ]/.test(endpointRef);
}

function toSafeIdPart(value: string): string {
  const safe = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return safe || "unnamed";
}

function readRecord(input: unknown): Record<string, unknown> | undefined {
  return typeof input === "object" && input !== null && !Array.isArray(input)
    ? input as Record<string, unknown>
    : undefined;
}

function cloneRecord(input: Record<string, unknown>): Record<string, unknown> {
  return structuredClone(input) as Record<string, unknown>;
}

function getString(input: unknown): string | undefined {
  return typeof input === "string" && input.length > 0 ? input : undefined;
}

function isToolSideEffectClass(input: unknown): input is ToolSideEffectClass {
  return input === "none"
    || input === "read"
    || input === "local_write"
    || input === "external_write"
    || input === "destructive"
    || input === "secret_access"
    || input === "unknown";
}
