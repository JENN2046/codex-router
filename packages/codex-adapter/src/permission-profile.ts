import { z } from "zod";

const FileSystemSpecialPathSchema = z.union([
  z.object({ kind: z.literal("root") }).strict(),
  z.object({ kind: z.literal("minimal") }).strict(),
  z.object({
    kind: z.literal("project_roots"),
    subpath: z.string().nullable().optional()
  }).strict(),
  z.object({ kind: z.literal("tmpdir") }).strict(),
  z.object({ kind: z.literal("slash_tmp") }).strict(),
  z.object({
    kind: z.literal("unknown"),
    path: z.string(),
    subpath: z.string().nullable().optional()
  }).strict()
]);

const FileSystemPathSchema = z.union([
  z.object({ path: z.string(), type: z.literal("path") }).strict(),
  z.object({ pattern: z.string(), type: z.literal("glob_pattern") }).strict(),
  z.object({
    type: z.literal("special"),
    value: FileSystemSpecialPathSchema
  }).strict()
]);

const FileSystemSandboxEntrySchema = z.object({
  // Older App Server builds can serialize a no-access entry as "none".
  // It remains a restriction marker, never an independently inferred grant.
  access: z.enum(["read", "write", "deny", "none"]),
  path: FileSystemPathSchema
}).strict();

const AdditionalFileSystemPermissionsSchema = z.object({
  // Rust Option fields accept an omitted key on input even though generated
  // TypeScript serializes them explicitly as null. The README uses the
  // omitted form, so both representations are accepted as no grant.
  read: z.array(z.string()).nullable().optional(),
  write: z.array(z.string()).nullable().optional(),
  globScanMaxDepth: z.number().int().min(1).optional(),
  entries: z.array(FileSystemSandboxEntrySchema).optional()
}).strict();

const AdditionalNetworkPermissionsSchema = z.object({
  enabled: z.boolean().nullable().optional()
}).strict();

/** App Server request-side permission profile, including compatibility nulls. */
export const CodexAppServerPermissionProfileSchema = z.object({
  network: AdditionalNetworkPermissionsSchema.nullable().optional(),
  fileSystem: AdditionalFileSystemPermissionsSchema.nullable().optional()
}).strict();

/**
 * App Server response-side granted profile. Top-level omissions deny that
 * permission family, so null is intentionally not accepted as a grant.
 */
export const CodexAppServerPermissionGrantSchema = z.object({
  fileSystem: AdditionalFileSystemPermissionsSchema.optional(),
  network: AdditionalNetworkPermissionsSchema.optional()
}).strict();

export type CodexAppServerPermissionProfile = z.infer<
  typeof CodexAppServerPermissionProfileSchema
>;
export type CodexAppServerPermissionGrant = z.infer<
  typeof CodexAppServerPermissionGrantSchema
>;

/**
 * Return true only when the selected profile is a permission-monotone subset
 * of the request. Write grants may be narrowed; read grants may be narrowed
 * only when the selected profile contains no write access. Any selected write
 * must preserve every requested read carve-out. Deny/no-access entries and
 * glob constraints are always retained for a file-system grant.
 */
export function isPermissionGrantSubset(
  requested: unknown,
  granted: unknown
): boolean {
  const parsedRequested = CodexAppServerPermissionProfileSchema.safeParse(requested);
  const parsedGranted = CodexAppServerPermissionGrantSchema.safeParse(granted);
  if (!parsedRequested.success || !parsedGranted.success) {
    return false;
  }
  if (
    parsedGranted.data.network !== undefined
    && !isNetworkGrantSubset(
      parsedRequested.data.network,
      parsedGranted.data.network
    )
  ) {
    return false;
  }
  return parsedGranted.data.fileSystem === undefined
    || isFileSystemGrantSubset(
      parsedRequested.data.fileSystem,
      parsedGranted.data.fileSystem
    );
}

function isNetworkGrantSubset(
  requested: z.infer<typeof AdditionalNetworkPermissionsSchema> | null | undefined,
  granted: z.infer<typeof AdditionalNetworkPermissionsSchema>
): boolean {
  return requested != null && Object.is(granted.enabled, requested.enabled);
}

function isFileSystemGrantSubset(
  requested: z.infer<typeof AdditionalFileSystemPermissionsSchema> | null | undefined,
  granted: z.infer<typeof AdditionalFileSystemPermissionsSchema>
): boolean {
  if (requested == null) {
    return false;
  }
  if (!Object.is(granted.globScanMaxDepth, requested.globScanMaxDepth)) {
    return false;
  }
  const grantedRead = granted.read ?? [];
  const grantedWrite = granted.write ?? [];
  const requestedRead = requested.read ?? [];
  if (
    !isArraySubset(grantedRead, requestedRead)
    || !isArraySubset(grantedWrite, requested.write ?? [])
  ) {
    return false;
  }

  const requestedEntries = requested.entries ?? [];
  const grantedEntries = granted.entries ?? [];
  if (!isArraySubset(grantedEntries, requestedEntries)) {
    return false;
  }

  const grantsWriteAccess = grantedWrite.length > 0
    || grantedEntries.some((entry) => entry.access === "write");
  if (grantsWriteAccess && !isArraySubset(requestedRead, grantedRead)) {
    return false;
  }

  // A more-specific read entry can carve a read-only subtree out of any
  // selected write entry. Without selected writes, read entries are ordinary
  // positive grants and may be narrowed. Deny/no-access entries always carve
  // restrictions out of either read or write grants.
  const requiredRestrictions = requestedEntries.filter(
    (entry) => entry.access === "deny"
      || entry.access === "none"
      || (grantsWriteAccess && entry.access === "read")
  );
  return isArraySubset(requiredRestrictions, grantedEntries);
}

function isArraySubset(selected: unknown[], requested: unknown[]): boolean {
  return selected.every((selectedValue) => (
    requested.some((requestedValue) => isStructurallyEqual(
      selectedValue,
      requestedValue
    ))
  ));
}

function isStructurallyEqual(left: unknown, right: unknown): boolean {
  if (
    left === null
    || right === null
    || typeof left !== "object"
    || typeof right !== "object"
  ) {
    return Object.is(left, right);
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left)
      && Array.isArray(right)
      && left.length === right.length
      && left.every((value, index) => isStructurallyEqual(value, right[index]));
  }
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord).sort();
  const rightKeys = Object.keys(rightRecord).sort();
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key, index) => (
      key === rightKeys[index]
      && isStructurallyEqual(leftRecord[key], rightRecord[key])
    ));
}
