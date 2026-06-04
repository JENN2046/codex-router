import { z } from "zod";
import {
  AgentManifestSchema,
  ArtifactSchema,
  RunSchema,
  RunStatusSchema,
  TaskSchema,
  type AgentManifest,
  type Artifact,
  type Run,
  type RunStatus,
  type Task
} from "../../kernel-contracts/src/index.js";
import {
  parseProviderManifest,
  type ProviderManifest,
  type RemoteAgentProvider,
  type RemoteTask,
  type RemoteTaskInput,
  type RemoteTaskEvent
} from "../../provider-core/src/index.js";

export const A2A_REMOTE_AGENT_PROVIDER_DISABLED =
  "a2a_remote_agent_provider_disabled";
export const A2A_ANONYMOUS_REMOTE_INVOCATION_REJECTED =
  "a2a_anonymous_remote_invocation_rejected";

export const A2AStatusSchema = z.enum([
  "queued",
  "running",
  "waiting_approval",
  "succeeded",
  "failed",
  "cancelled"
]);

export const A2AEndpointReferenceSchema = z.object({
  endpointId: z.string().min(1),
  metadataRef: z.string().min(1),
  transport: z.enum(["http", "sse", "websocket", "unknown"]).default("unknown"),
  metadata: z.record(z.string(), z.unknown()).default({})
}).strict().superRefine((endpoint, ctx) => {
  if (!isSafeMetadataRef(endpoint.metadataRef)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "A2A endpoint must be a metadata reference, not a raw URL",
      path: ["metadataRef"]
    });
  }
});

export const A2AAuthSchemeSchema = z.object({
  schemeId: z.string().min(1),
  type: z.enum([
    "bearer_ref",
    "oauth2_ref",
    "signed_request",
    "mtls_ref"
  ]),
  metadataRef: z.string().min(1).optional(),
  required: z.boolean().default(true)
}).strict().superRefine((authScheme, ctx) => {
  if (authScheme.schemeId.toLowerCase() === "anonymous") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "anonymous A2A auth schemes are not allowed",
      path: ["schemeId"]
    });
  }

  if (
    authScheme.metadataRef !== undefined
    && !isSafeMetadataRef(authScheme.metadataRef)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "A2A auth metadataRef must be a metadata reference",
      path: ["metadataRef"]
    });
  }
});

export const A2ASkillSkeletonSchema = z.object({
  skillId: z.string().min(1),
  name: z.string().min(1),
  requiredCapabilities: z.array(z.string().min(1)).default([]),
  metadata: z.record(z.string(), z.unknown()).default({})
});

export const A2AAgentCardSkeletonSchema = z.object({
  schemaVersion: z.literal("a2a-agent-card-skeleton.v1").default("a2a-agent-card-skeleton.v1"),
  agentId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1).optional(),
  version: z.string().min(1),
  capabilities: z.array(z.string().min(1)).default([]),
  skills: z.array(A2ASkillSkeletonSchema).default([]),
  endpoints: z.array(A2AEndpointReferenceSchema).default([]),
  authSchemes: z.array(A2AAuthSchemeSchema).min(1),
  metadata: z.record(z.string(), z.unknown()).default({})
}).superRefine((agentCard, ctx) => {
  if (agentCard.metadata.allowAnonymousRemoteInvocation === true) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "anonymous A2A remote invocation is not allowed by default",
      path: ["metadata", "allowAnonymousRemoteInvocation"]
    });
  }
});

export const A2AMessagePartSkeletonSchema = z.object({
  kind: z.enum(["text", "data"]).default("text"),
  text: z.string().min(1).optional(),
  data: z.record(z.string(), z.unknown()).optional()
}).superRefine((part, ctx) => {
  if (part.kind === "text" && part.text === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "text A2A message parts require text",
      path: ["text"]
    });
  }

  if (part.kind === "data" && part.data === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "data A2A message parts require data",
      path: ["data"]
    });
  }
});

export const A2AMessageSkeletonSchema = z.object({
  messageId: z.string().min(1),
  role: z.enum(["user", "agent", "system"]),
  parts: z.array(A2AMessagePartSkeletonSchema).min(1),
  createdAt: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).default({})
});

export const A2AArtifactSkeletonSchema = z.object({
  schemaVersion: z.literal("a2a-artifact-skeleton.v1").default("a2a-artifact-skeleton.v1"),
  artifactId: z.string().min(1),
  taskId: z.string().min(1),
  runId: z.string().min(1).optional(),
  kind: z.string().min(1),
  uri: z.string().min(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  sizeBytes: z.number().int().nonnegative(),
  createdAt: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).default({})
});

export const A2ATaskSkeletonSchema = z.object({
  schemaVersion: z.literal("a2a-task-skeleton.v1").default("a2a-task-skeleton.v1"),
  remoteTaskId: z.string().min(1),
  localRunId: z.string().min(1),
  status: A2AStatusSchema,
  messages: z.array(A2AMessageSkeletonSchema).default([]),
  artifacts: z.array(A2AArtifactSkeletonSchema).default([]),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).default({})
});

export type A2AStatus = z.infer<typeof A2AStatusSchema>;
export type A2AEndpointReference = z.infer<typeof A2AEndpointReferenceSchema>;
export type A2AAuthScheme = z.infer<typeof A2AAuthSchemeSchema>;
export type A2ASkillSkeleton = z.infer<typeof A2ASkillSkeletonSchema>;
export type A2AAgentCardSkeleton = z.infer<typeof A2AAgentCardSkeletonSchema>;
export type A2AMessagePartSkeleton = z.infer<typeof A2AMessagePartSkeletonSchema>;
export type A2AMessageSkeleton = z.infer<typeof A2AMessageSkeletonSchema>;
export type A2AArtifactSkeleton = z.infer<typeof A2AArtifactSkeletonSchema>;
export type A2ATaskSkeleton = z.infer<typeof A2ATaskSkeletonSchema>;
export type A2AProviderAgentCard = Omit<A2AAgentCardSkeleton, "description"> & {
  description?: string;
};

export type A2ARemoteInvocationAuthorization = {
  authSchemeId?: string;
  authSchemeType?: A2AAuthScheme["type"] | "anonymous";
  principalId?: string;
};

export class A2ARemoteAgentProviderDisabledError extends Error {
  constructor() {
    super(A2A_REMOTE_AGENT_PROVIDER_DISABLED);
    this.name = "A2ARemoteAgentProviderDisabledError";
  }
}

export function agentManifestToA2AAgentCard(
  agentManifestInput: AgentManifest | z.input<typeof AgentManifestSchema>
): A2AAgentCardSkeleton {
  const agentManifest = AgentManifestSchema.parse(agentManifestInput);
  const capabilities = agentManifest.capabilities.map(capabilityToString);

  const card = {
    schemaVersion: "a2a-agent-card-skeleton.v1",
    agentId: agentManifest.agentId,
    name: agentManifest.name,
    ...(agentManifest.description ? { description: agentManifest.description } : {}),
    version: agentManifest.version,
    capabilities,
    skills: capabilities.map((capability, index) => ({
      skillId: `skill.${toSafeIdPart(agentManifest.agentId)}.${index + 1}`,
      name: capability,
      requiredCapabilities: [capability],
      metadata: {
        localCapability: agentManifest.capabilities[index]
      }
    })),
    endpoints: [],
    authSchemes: [
      {
        schemeId: "agent-os-signed-request",
        type: "signed_request",
        metadataRef: "metadata:a2a.auth.agent_os_signed_request",
        required: true
      }
    ],
    metadata: {
      a2a: {
        localAgentManifestId: agentManifest.agentId,
        endpointPolicy: "metadata_refs_only",
        networkRuntimeImplemented: false,
        remoteAgentProviderEnabled: false
      },
      allowAnonymousRemoteInvocation: false,
      sourceSchemaVersion: agentManifest.schemaVersion,
      createdAt: agentManifest.createdAt
    }
  };

  return A2AAgentCardSkeletonSchema.parse(card);
}

export function taskToA2ATaskSkeleton(
  taskInput: Task | z.input<typeof TaskSchema>,
  runInput: Run | z.input<typeof RunSchema>
): A2ATaskSkeleton {
  const task = TaskSchema.parse(taskInput);
  const run = RunSchema.parse(runInput);

  if (task.taskId !== run.taskId) {
    throw new Error(`a2a_task_run_mismatch:${task.taskId}:${run.taskId}`);
  }

  return A2ATaskSkeletonSchema.parse({
    schemaVersion: "a2a-task-skeleton.v1",
    remoteTaskId: createA2ARemoteTaskId(task.taskId),
    localRunId: run.runId,
    status: runStatusToA2AStatus(run.status),
    messages: [
      {
        messageId: `msg.${toSafeIdPart(task.taskId)}.request`,
        role: "user",
        parts: [
          {
            kind: "text",
            text: task.intent?.requestedAction ?? task.requestedAction
          }
        ],
        createdAt: task.createdAt,
        metadata: {
          localTaskId: task.taskId,
          title: task.title,
          successCriteria: [...task.successCriteria],
          outOfScope: [...task.outOfScope]
        }
      }
    ],
    artifacts: [],
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    metadata: {
      localTaskId: task.taskId,
      taskSource: task.source,
      networkRuntimeImplemented: false,
      remoteExecutionStarted: false
    }
  });
}

export function artifactToA2AArtifactSkeleton(
  artifactInput: Artifact | z.input<typeof ArtifactSchema>
): A2AArtifactSkeleton {
  const artifact = ArtifactSchema.parse(artifactInput);

  return A2AArtifactSkeletonSchema.parse({
    schemaVersion: "a2a-artifact-skeleton.v1",
    artifactId: artifact.artifactId,
    taskId: artifact.taskId,
    ...(artifact.runId ? { runId: artifact.runId } : {}),
    kind: artifact.kind,
    uri: artifact.uri,
    sha256: artifact.sha256,
    sizeBytes: artifact.sizeBytes,
    createdAt: artifact.createdAt,
    metadata: {
      ...artifact.metadata,
      a2a: {
        uriIsReference: true,
        fetchedBySkeleton: false,
        localArtifactId: artifact.artifactId
      }
    }
  });
}

export function a2aStatusToRunStatus(
  statusInput: A2AStatus | z.input<typeof A2AStatusSchema>
): RunStatus {
  const status = A2AStatusSchema.parse(statusInput);

  if (status === "waiting_approval") {
    return "blocked";
  }

  return RunStatusSchema.parse(status);
}

export function runStatusToA2AStatus(
  statusInput: RunStatus | z.input<typeof RunStatusSchema>
): A2AStatus {
  const status = RunStatusSchema.parse(statusInput);

  if (status === "blocked") {
    return "waiting_approval";
  }

  return A2AStatusSchema.parse(status);
}

export function assertA2ARemoteInvocationAuthorized(
  agentCardInput: A2AAgentCardSkeleton | z.input<typeof A2AAgentCardSkeletonSchema>,
  authorization: A2ARemoteInvocationAuthorization
): void {
  const agentCard = A2AAgentCardSkeletonSchema.parse(agentCardInput);
  const authSchemeId = authorization.authSchemeId?.toLowerCase();
  const authSchemeType = authorization.authSchemeType;

  if (
    authSchemeId === "anonymous"
    || authSchemeType === "anonymous"
    || authorization.principalId?.toLowerCase() === "anonymous"
  ) {
    throw new Error(A2A_ANONYMOUS_REMOTE_INVOCATION_REJECTED);
  }

  const declared = agentCard.authSchemes.some((authScheme) => (
    authScheme.schemeId === authorization.authSchemeId
    || authScheme.type === authorization.authSchemeType
  ));

  if (!declared) {
    throw new Error(
      `a2a_auth_scheme_not_declared:${authorization.authSchemeId ?? authorization.authSchemeType ?? "missing"}`
    );
  }
}

export function assertA2AAnonymousInvocationRejected(
  agentCardInput: A2AAgentCardSkeleton | z.input<typeof A2AAgentCardSkeletonSchema>
): void {
  try {
    assertA2ARemoteInvocationAuthorized(agentCardInput, {
      authSchemeType: "anonymous",
      principalId: "anonymous"
    });
  } catch (error) {
    if (error instanceof Error && error.message === A2A_ANONYMOUS_REMOTE_INVOCATION_REJECTED) {
      return;
    }

    throw error;
  }

  throw new Error("a2a_anonymous_remote_invocation_was_allowed");
}

export function createA2ARemoteAgentProviderSkeleton(
  agentManifestInput: AgentManifest | z.input<typeof AgentManifestSchema>
): RemoteAgentProvider {
  const agentManifest = AgentManifestSchema.parse(agentManifestInput);
  const agentCard = agentManifestToA2AAgentCard(agentManifest);
  const providerManifest = createA2AProviderManifest(agentManifest);

  return {
    manifest: providerManifest,

    getAgentCard(): A2AProviderAgentCard {
      return cloneA2AAgentCardForProvider(agentCard);
    },

    createRemoteTask(_input: RemoteTaskInput): RemoteTask {
      throw new A2ARemoteAgentProviderDisabledError();
    },

    getRemoteTask(_taskId: string): RemoteTask | undefined {
      return undefined;
    },

    cancelRemoteTask(_taskId: string): RemoteTask {
      throw new A2ARemoteAgentProviderDisabledError();
    },

    async *streamRemoteTaskEvents(_taskId: string): AsyncIterable<RemoteTaskEvent> {
      throw new A2ARemoteAgentProviderDisabledError();
    }
  };
}

function createA2AProviderManifest(agentManifest: AgentManifest): ProviderManifest {
  return parseProviderManifest({
    schemaVersion: "provider-manifest.v1",
    providerId: `a2a.${toSafeIdPart(agentManifest.agentId)}`,
    kind: "remote_agent",
    displayName: `A2A Remote Agent (${agentManifest.name})`,
    version: agentManifest.version,
    capabilities: [
      "a2a.agent_card.map",
      "a2a.task.map",
      "a2a.artifact.map"
    ],
    requiredConfig: {
      keys: [],
      optionalKeys: []
    },
    securityBoundary: {
      isolation: "remote",
      networkAccess: "none",
      filesystemAccess: "none",
      secretAccess: "brokered",
      notes: [
        "Skeleton only; does not listen on the network.",
        "Remote agent provider is disabled by default.",
        "Endpoints are metadata references, not raw URLs."
      ]
    },
    supportedSandboxProfiles: [
      {
        schemaVersion: "sandbox-profile.v1",
        sandboxId: `sandbox_a2a_${toSafeIdPart(agentManifest.agentId)}_readonly`,
        mode: "read-only",
        networkAccess: "none",
        writableRoots: [],
        envPolicy: {
          inheritProcessEnv: false,
          allowlist: []
        }
      }
    ],
    supportedSideEffectClasses: [
      "protected_remote",
      "unknown"
    ],
    enabled: false,
    metadata: {
      a2a: {
        localAgentManifestId: agentManifest.agentId,
        invokeDefault: "disabled",
        liveNetworkService: false,
        allowAnonymousRemoteInvocation: false
      },
      authSchemes: [
        {
          schemeId: "agent-os-signed-request",
          type: "signed_request"
        }
      ]
    }
  });
}

function cloneA2AAgentCardForProvider(
  agentCard: A2AAgentCardSkeleton
): A2AProviderAgentCard {
  const cloned = {
    schemaVersion: agentCard.schemaVersion,
    agentId: agentCard.agentId,
    name: agentCard.name,
    version: agentCard.version,
    capabilities: [...agentCard.capabilities],
    skills: structuredClone(agentCard.skills) as A2ASkillSkeleton[],
    endpoints: structuredClone(agentCard.endpoints) as A2AEndpointReference[],
    authSchemes: structuredClone(agentCard.authSchemes) as A2AAuthScheme[],
    metadata: structuredClone(agentCard.metadata) as Record<string, unknown>
  };

  if (agentCard.description !== undefined) {
    return {
      ...cloned,
      description: agentCard.description
    };
  }

  return cloned;
}

function createA2ARemoteTaskId(localTaskId: string): string {
  return `a2a.task.${toSafeIdPart(localTaskId)}`;
}

function capabilityToString(capability: AgentManifest["capabilities"][number]): string {
  return `${capability.kind}:${capability.access}:${capability.resource}`;
}

function isSafeMetadataRef(value: string): boolean {
  return /^metadata:[A-Za-z0-9_.:-]+$/.test(value)
    && !value.includes("://")
    && !/[;&|`$<>\r\n\t ]/.test(value);
}

function toSafeIdPart(value: string): string {
  const safe = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return safe || "unnamed";
}
