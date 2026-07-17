import { createHash } from "node:crypto";
import { posix as pathPosix } from "node:path";
import { z } from "zod";
import {
  SandboxProfileSchema,
  type SandboxProfile
} from "../../kernel-contracts/src/public.js";

export const ProviderKindSchema = z.enum([
  "model",
  "executor",
  "tool",
  "remote_agent"
]);

export const ProviderSideEffectClassSchema = z.enum([
  "none",
  "read",
  "read_only",
  "local_write",
  "workspace_write",
  "local_command",
  "external_write",
  "external_side_effects",
  "protected_remote",
  "destructive",
  "secret_access",
  "unknown"
]);

export const ProviderSecurityBoundarySchema = z.object({
  isolation: z.enum(["none", "process", "sandbox", "remote"]).default("none"),
  networkAccess: z.enum(["none", "restricted", "full"]).default("none"),
  filesystemAccess: z.enum(["none", "read", "workspace-write", "full"]).default("none"),
  secretAccess: z.enum(["none", "brokered", "direct"]).default("none"),
  notes: z.array(z.string().min(1)).default([])
});

export const ProviderRequiredConfigSchema = z.object({
  keys: z.array(z.string().min(1)).default([]),
  optionalKeys: z.array(z.string().min(1)).default([])
}).default({
  keys: [],
  optionalKeys: []
});

export const ProviderManifestSchema = z.object({
  schemaVersion: z.literal("provider-manifest.v1").default("provider-manifest.v1"),
  providerId: z.string().min(1),
  kind: ProviderKindSchema,
  displayName: z.string().min(1),
  version: z.string().min(1),
  capabilities: z.array(z.string().min(1)).default([]),
  requiredConfig: ProviderRequiredConfigSchema,
  securityBoundary: ProviderSecurityBoundarySchema,
  supportedSandboxProfiles: z.array(SandboxProfileSchema).default([]),
  supportedSideEffectClasses: z.array(ProviderSideEffectClassSchema).default([]),
  enabled: z.boolean().default(true),
  metadata: z.record(z.string(), z.unknown()).default({})
});

/**
 * Public governance-only provider SPI. It intentionally carries no execute,
 * invoke, remote-task, or model-runtime method.
 */
export interface GovernanceProvider {
  readonly manifest: ProviderManifest;
}
export type ProviderKind = z.infer<typeof ProviderKindSchema>;

export type ProviderSideEffectClass = z.infer<typeof ProviderSideEffectClassSchema>;

export type ProviderSecurityBoundary = z.infer<typeof ProviderSecurityBoundarySchema>;

export type ProviderRequiredConfig = z.infer<typeof ProviderRequiredConfigSchema>;

export type ProviderManifest = z.infer<typeof ProviderManifestSchema>;

export function parseProviderManifest(input: z.input<typeof ProviderManifestSchema>): ProviderManifest {
  return ProviderManifestSchema.parse(input);
}

export function hashProviderManifest(manifest: ProviderManifest): string {
  return createHash("sha256")
    .update(stableStringifyProviderObject(ProviderManifestSchema.parse(manifest)))
    .digest("hex");
}

export function providerSupportsSideEffectClass(
  manifest: ProviderManifest,
  sideEffectClass: ProviderSideEffectClass
): boolean {
  const parsed = ProviderManifestSchema.parse(manifest);
  ProviderSideEffectClassSchema.parse(sideEffectClass);
  return parsed.supportedSideEffectClasses.includes(sideEffectClass);
}

export function assertProviderSupportsSideEffectClass(
  manifest: ProviderManifest,
  sideEffectClass: ProviderSideEffectClass
): void {
  if (!providerSupportsSideEffectClass(manifest, sideEffectClass)) {
    throw new Error(`unsupported_side_effect_class:${manifest.providerId}:${sideEffectClass}`);
  }
}

export function providerSupportsSandboxProfile(
  manifest: ProviderManifest,
  sandboxProfile: SandboxProfile
): boolean {
  const parsed = ProviderManifestSchema.parse(manifest);
  const requested = SandboxProfileSchema.parse(sandboxProfile);

  return parsed.supportedSandboxProfiles.some((supported) => (
    supported.mode === requested.mode
    && networkAccessImplies(supported.networkAccess, requested.networkAccess)
    && writableRootsImply(supported.writableRoots, requested.writableRoots)
    && envPolicyImplies(supported.envPolicy, requested.envPolicy)
  ));
}

export function assertProviderSupportsSandboxProfile(
  manifest: ProviderManifest,
  sandboxProfile: SandboxProfile
): void {
  if (!providerSupportsSandboxProfile(manifest, sandboxProfile)) {
    throw new Error(`unsupported_sandbox_profile:${manifest.providerId}:${sandboxProfile.sandboxId}`);
  }
}

function networkAccessImplies(
  granted: SandboxProfile["networkAccess"],
  requested: SandboxProfile["networkAccess"]
): boolean {
  if (granted === requested) {
    return true;
  }

  if (granted === "full") {
    return true;
  }

  return granted === "restricted" && requested === "none";
}

function writableRootsImply(granted: string[], requested: string[]): boolean {
  if (requested.length === 0) {
    return true;
  }

  return requested.every((root) => (
    granted.some((grantedRoot) => writableRootImplies(grantedRoot, root))
  ));
}

function writableRootImplies(grantedRoot: string, requestedRoot: string): boolean {
  if (grantedRoot === "*") {
    return true;
  }

  const normalizedGrantedRoot = normalizeRootPattern(grantedRoot);
  const normalizedRequestedRoot = normalizeRootPattern(requestedRoot);

  if (normalizedGrantedRoot === normalizedRequestedRoot) {
    return true;
  }

  if (normalizedGrantedRoot.endsWith("/**")) {
    const prefix = normalizedGrantedRoot.slice(0, -3);
    return normalizedRequestedRoot === prefix || normalizedRequestedRoot.startsWith(`${prefix}/`);
  }

  return false;
}

function normalizeRootPattern(root: string): string {
  const slashRoot = root.replace(/\\/g, "/");
  const hasRecursiveWildcard = slashRoot.endsWith("/**");
  const rootBase = hasRecursiveWildcard ? slashRoot.slice(0, -3) : slashRoot;
  const normalizedBase = trimTrailingSlash(pathPosix.normalize(rootBase));

  return hasRecursiveWildcard ? `${normalizedBase}/**` : normalizedBase;
}

function trimTrailingSlash(root: string): string {
  if (root.length > 1 && root.endsWith("/")) {
    return root.slice(0, -1);
  }

  return root;
}

function envPolicyImplies(
  granted: SandboxProfile["envPolicy"],
  requested: SandboxProfile["envPolicy"]
): boolean {
  if (!granted.inheritProcessEnv && requested.inheritProcessEnv) {
    return false;
  }

  if (granted.inheritProcessEnv) {
    return true;
  }

  return requested.allowlist.every((key) => granted.allowlist.includes(key));
}

/** @internal */
export function stableStringifyProviderObject(input: unknown): string {
  if (input === undefined) {
    return "null";
  }

  if (input === null || typeof input !== "object") {
    return JSON.stringify(input) ?? "null";
  }

  if (Array.isArray(input)) {
    return `[${input.map((item) => stableStringifyProviderObject(item)).join(",")}]`;
  }

  const record = input as Record<string, unknown>;
  const keys = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort();

  return `{${keys.map((key) => (
    `${JSON.stringify(key)}:${stableStringifyProviderObject(record[key])}`
  )).join(",")}}`;
}
