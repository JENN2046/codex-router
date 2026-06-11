import { readFile } from "node:fs/promises";
import YAML from "yaml";
import { z } from "zod";
import {
  ExecutionProfileNameSchema,
  HostRouteSchema,
  RolloutModeSchema,
  TaskClassSchema,
  ToolAccessLevelSchema,
  ModelIdSchema
} from "../../contracts/src/index.js";

const REQUIRED_TASK_CLASSES = [
  "read_only",
  "small_edit",
  "engineering",
  "high_risk",
  "release_external_action"
] as const;

const MemoryHealthSeveritySchema = z.enum([
  "ignore",
  "warn",
  "block"
]);

const MemoryHealthPolicyPackNameSchema = z.enum([
  "read_only",
  "local_write",
  "engineering",
  "release"
]);

const MemoryCheckpointFrequencySchema = z.enum([
  "minimal",
  "standard",
  "stage",
  "dense"
]);

const TelemetryAlertMetricThresholdValuesSchema = z.object({
  failures: z.number().nonnegative().optional(),
  timeouts: z.number().nonnegative().optional(),
  retries: z.number().nonnegative().optional(),
  failureRate: z.number().min(0).max(1).optional(),
  timeoutRate: z.number().min(0).max(1).optional()
});

const TelemetryAlertThresholdScopeSchema = z.object({
  totals: TelemetryAlertMetricThresholdValuesSchema.optional(),
  perSink: TelemetryAlertMetricThresholdValuesSchema.optional()
});

const TelemetryAlertThresholdsSchema = z.object({
  warn: TelemetryAlertThresholdScopeSchema.optional(),
  error: TelemetryAlertThresholdScopeSchema.optional()
});

const TelemetryAlertThresholdPresetNameSchema = z.enum([
  "read_only",
  "local_write",
  "engineering",
  "release"
]);

const TelemetryAlertDeliveryWindowPresetNameSchema = TelemetryAlertThresholdPresetNameSchema;

const TelemetryAlertDeliveryWindowPolicySchema = z.object({
  dedupeWindowMs: z.number().nonnegative().int().optional(),
  cooldownWindowMs: z.number().nonnegative().int().optional()
});

const MemoryHealthPolicySchema = z.object({
  overviewUnavailableSeverity: MemoryHealthSeveritySchema,
  codexMcpUnavailableSeverity: MemoryHealthSeveritySchema,
  maxRejectedWrites: z.number().int().nonnegative(),
  rejectedWritesSeverity: MemoryHealthSeveritySchema,
  maxShadowReconcileCount: z.number().int().nonnegative(),
  shadowReconcileSeverity: MemoryHealthSeveritySchema,
  recallUnavailableSeverity: MemoryHealthSeveritySchema,
  nonActiveRecallSeverity: MemoryHealthSeveritySchema
});

const MemoryExecutionGuidanceSchema = z.object({
  memoryRequired: z.boolean(),
  resumeExpected: z.boolean(),
  telemetryMandatory: z.boolean(),
  checkpointFrequency: MemoryCheckpointFrequencySchema
});

const MemoryHealthPolicyPackSchema = z.object({
  health: MemoryHealthPolicySchema,
  guidance: MemoryExecutionGuidanceSchema
});

const PolicySnapshotSchema = z.object({
  policyVersion: z.string().min(1),
  rolloutMode: RolloutModeSchema,
  models: z.record(TaskClassSchema, ModelIdSchema),
  toolPolicies: z.record(TaskClassSchema, ToolAccessLevelSchema),
  executionProfiles: z.record(TaskClassSchema, ExecutionProfileNameSchema),
  hostRoutes: z.record(TaskClassSchema, HostRouteSchema),
  approvalRules: z.object({
    protectedBranches: z.array(z.string().min(1)),
    protectedKeywords: z.array(z.string().min(1)),
    protectedToolAccess: z.array(ToolAccessLevelSchema)
  }),
  escalationRules: z.object({
    failureThreshold: z.number().int().positive(),
    contextPressureThreshold: z.number().min(0).max(1),
    highRiskSticky: z.boolean()
  }),
  memoryHealth: z.object({
    defaultPack: MemoryHealthPolicyPackNameSchema,
    packByToolAccess: z.record(ToolAccessLevelSchema, MemoryHealthPolicyPackNameSchema),
    packs: z.record(MemoryHealthPolicyPackNameSchema, MemoryHealthPolicyPackSchema)
  }),
  telemetryAlerts: z.object({
    defaultPreset: TelemetryAlertThresholdPresetNameSchema,
    presetByToolAccess: z.record(ToolAccessLevelSchema, TelemetryAlertThresholdPresetNameSchema),
    presets: z.record(TelemetryAlertThresholdPresetNameSchema, TelemetryAlertThresholdsSchema)
  }),
  telemetryAlertDeliveryAlerts: z.object({
    defaultPreset: TelemetryAlertThresholdPresetNameSchema,
    presetByToolAccess: z.record(ToolAccessLevelSchema, TelemetryAlertThresholdPresetNameSchema),
    presets: z.record(TelemetryAlertThresholdPresetNameSchema, TelemetryAlertThresholdsSchema)
  }),
  telemetryAlertDeliveryWindow: z.object({
    defaultPreset: TelemetryAlertDeliveryWindowPresetNameSchema,
    presetByToolAccess: z.record(ToolAccessLevelSchema, TelemetryAlertDeliveryWindowPresetNameSchema),
    presets: z.record(TelemetryAlertDeliveryWindowPresetNameSchema, TelemetryAlertDeliveryWindowPolicySchema)
  })
}).superRefine((policy, ctx) => {
  for (const taskClass of REQUIRED_TASK_CLASSES) {
    if (policy.hostRoutes[taskClass] === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Missing host route for task class: ${taskClass}`,
        path: ["hostRoutes", taskClass]
      });
    }
  }
});

export type PolicySnapshot = z.infer<typeof PolicySnapshotSchema>;
export type MemoryHealthPolicy = z.infer<typeof MemoryHealthPolicySchema>;
export type MemoryHealthPolicyPackName = z.infer<typeof MemoryHealthPolicyPackNameSchema>;
export type MemoryCheckpointFrequency = z.infer<typeof MemoryCheckpointFrequencySchema>;
export type MemoryExecutionGuidance = z.infer<typeof MemoryExecutionGuidanceSchema>;
export type MemoryHealthPolicyPack = z.infer<typeof MemoryHealthPolicyPackSchema>;
export type TelemetryAlertThresholds = z.infer<typeof TelemetryAlertThresholdsSchema>;
export type TelemetryAlertThresholdPresetName = z.infer<typeof TelemetryAlertThresholdPresetNameSchema>;
export type TelemetryAlertDeliveryWindowPolicy = z.infer<typeof TelemetryAlertDeliveryWindowPolicySchema>;
export type TelemetryAlertDeliveryWindowPresetName = z.infer<typeof TelemetryAlertDeliveryWindowPresetNameSchema>;

export async function loadPolicyFromFile(path: string): Promise<PolicySnapshot> {
  const content = await readFile(path, "utf8");
  return loadPolicyFromString(content);
}

export function loadPolicyFromString(content: string): PolicySnapshot {
  const parsed = YAML.parse(content);
  return PolicySnapshotSchema.parse(parsed);
}

export function resolveMemoryHealthPolicyPack(
  policy: PolicySnapshot,
  toolAccess: z.infer<typeof ToolAccessLevelSchema>,
  overridePack?: MemoryHealthPolicyPackName
): {
  packName: MemoryHealthPolicyPackName;
  healthPolicy: MemoryHealthPolicy;
  guidance: MemoryExecutionGuidance;
} {
  const packName = overridePack
    ?? policy.memoryHealth.packByToolAccess[toolAccess]
    ?? policy.memoryHealth.defaultPack;
  const pack = policy.memoryHealth.packs[packName];

  if (!pack) {
    throw new Error(`missing memory health policy pack: ${packName}`);
  }

  return {
    packName,
    healthPolicy: pack.health,
    guidance: pack.guidance
  };
}

export function getMemoryHealthPolicyPack(
  policy: PolicySnapshot,
  packName: MemoryHealthPolicyPackName
): MemoryHealthPolicyPack {
  const pack = policy.memoryHealth.packs[packName];

  if (!pack) {
    throw new Error(`missing memory health policy pack: ${packName}`);
  }

  return pack;
}

export function resolveTelemetryAlertThresholdPreset(
  policy: PolicySnapshot,
  toolAccess: z.infer<typeof ToolAccessLevelSchema>,
  overridePreset?: TelemetryAlertThresholdPresetName
): {
  presetName: TelemetryAlertThresholdPresetName;
  thresholds: TelemetryAlertThresholds;
} {
  const presetName = overridePreset
    ?? policy.telemetryAlerts.presetByToolAccess[toolAccess]
    ?? policy.telemetryAlerts.defaultPreset;
  const thresholds = policy.telemetryAlerts.presets[presetName];

  if (!thresholds) {
    throw new Error(`missing telemetry alert threshold preset: ${presetName}`);
  }

  return {
    presetName,
    thresholds
  };
}

export function getTelemetryAlertThresholdPreset(
  policy: PolicySnapshot,
  presetName: TelemetryAlertThresholdPresetName
): TelemetryAlertThresholds {
  const thresholds = policy.telemetryAlerts.presets[presetName];

  if (!thresholds) {
    throw new Error(`missing telemetry alert threshold preset: ${presetName}`);
  }

  return thresholds;
}

export function resolveTelemetryAlertDeliveryThresholdPreset(
  policy: PolicySnapshot,
  toolAccess: z.infer<typeof ToolAccessLevelSchema>,
  overridePreset?: TelemetryAlertThresholdPresetName
): {
  presetName: TelemetryAlertThresholdPresetName;
  thresholds: TelemetryAlertThresholds;
} {
  const presetName = overridePreset
    ?? policy.telemetryAlertDeliveryAlerts.presetByToolAccess[toolAccess]
    ?? policy.telemetryAlertDeliveryAlerts.defaultPreset;
  const thresholds = policy.telemetryAlertDeliveryAlerts.presets[presetName];

  if (!thresholds) {
    throw new Error(`missing telemetry alert delivery threshold preset: ${presetName}`);
  }

  return {
    presetName,
    thresholds
  };
}

export function getTelemetryAlertDeliveryThresholdPreset(
  policy: PolicySnapshot,
  presetName: TelemetryAlertThresholdPresetName
): TelemetryAlertThresholds {
  const thresholds = policy.telemetryAlertDeliveryAlerts.presets[presetName];

  if (!thresholds) {
    throw new Error(`missing telemetry alert delivery threshold preset: ${presetName}`);
  }

  return thresholds;
}

export function resolveTelemetryAlertDeliveryWindowPolicy(
  policy: PolicySnapshot,
  toolAccess: z.infer<typeof ToolAccessLevelSchema>,
  overridePreset?: TelemetryAlertDeliveryWindowPresetName
): {
  presetName: TelemetryAlertDeliveryWindowPresetName;
  policy: TelemetryAlertDeliveryWindowPolicy;
} {
  const presetName = overridePreset
    ?? policy.telemetryAlertDeliveryWindow.presetByToolAccess[toolAccess]
    ?? policy.telemetryAlertDeliveryWindow.defaultPreset;
  const deliveryWindowPolicy = policy.telemetryAlertDeliveryWindow.presets[presetName];

  if (!deliveryWindowPolicy) {
    throw new Error(`missing telemetry alert delivery window policy: ${presetName}`);
  }

  return {
    presetName,
    policy: deliveryWindowPolicy
  };
}

export function getTelemetryAlertDeliveryWindowPolicy(
  policy: PolicySnapshot,
  presetName: TelemetryAlertDeliveryWindowPresetName
): TelemetryAlertDeliveryWindowPolicy {
  const deliveryWindowPolicy = policy.telemetryAlertDeliveryWindow.presets[presetName];

  if (!deliveryWindowPolicy) {
    throw new Error(`missing telemetry alert delivery window policy: ${presetName}`);
  }

  return deliveryWindowPolicy;
}

export {
  HostRouteSchema,
  MemoryCheckpointFrequencySchema,
  MemoryExecutionGuidanceSchema,
  MemoryHealthPolicySchema,
  MemoryHealthPolicyPackSchema,
  MemoryHealthPolicyPackNameSchema,
  MemoryHealthSeveritySchema,
  PolicySnapshotSchema,
  TelemetryAlertMetricThresholdValuesSchema,
  TelemetryAlertDeliveryWindowPresetNameSchema,
  TelemetryAlertDeliveryWindowPolicySchema,
  TelemetryAlertThresholdPresetNameSchema,
  TelemetryAlertThresholdScopeSchema,
  TelemetryAlertThresholdsSchema
};
