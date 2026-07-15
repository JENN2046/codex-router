import { createHash } from "node:crypto";
import { isAbsolute, posix as pathPosix } from "node:path";
import { isProxy } from "node:util/types";
import { z } from "zod";
import {
  GovernedFileChangeSetSchema,
  type GovernedFileChangeSet
} from "../../kernel-contracts/src/index.js";

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const NONCE_PATTERN = /^[a-zA-Z0-9_-]{32,128}$/u;
const WINDOWS_RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/iu;
const UNSAFE_PATH_CHARACTERS = /[\u0000-\u001f\u007f<>:"|?*\[\]]/u;
const CapsuleTimestampSchema = z.string().datetime({ offset: true });

export const ContentDigestSchema = z.object({
  algorithm: z.literal("sha256"),
  hash: z.string().regex(SHA256_PATTERN),
  size: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
}).strict();

export type ContentDigest = z.infer<typeof ContentDigestSchema>;

export const CapsulePathSchema = z.string().min(1).superRefine((value, ctx) => {
  if (!isCanonicalCapsulePath(value)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "offline capsule path must be canonical and repository-relative"
    });
  }
});

const CanonicalTargetPathsSchema = z.array(CapsulePathSchema).min(1).superRefine(
  (paths, ctx) => addCanonicalPathSetIssues(paths, ctx)
);

export const CapsuleTaskContractSchema = z.object({
  schemaVersion: z.literal("offline-capsule-task.v1"),
  dataClassification: z.literal("synthetic_non_sensitive"),
  taskId: z.string().min(1).max(256),
  instruction: z.string().min(1).max(32_768),
  successCriteria: z.array(z.string().min(1).max(4096)).min(1).max(128),
  outOfScope: z.array(z.string().min(1).max(4096)).max(128),
  targetPaths: CanonicalTargetPathsSchema
}).strict();

export type CapsuleTaskContract = z.infer<typeof CapsuleTaskContractSchema>;

export const ContentTreeEntrySchema = z.object({
  path: CapsulePathSchema,
  nodeType: z.literal("regular_file"),
  mode: z.enum(["100644", "100755"]),
  blob: ContentDigestSchema
}).strict();

export type ContentTreeEntry = z.infer<typeof ContentTreeEntrySchema>;

const ContentTreeManifestFieldsSchema = z.object({
  schemaVersion: z.literal("content-tree-manifest.v1"),
  entries: z.array(ContentTreeEntrySchema),
  rootDigest: ContentDigestSchema
}).strict();

export const ContentTreeManifestSchema = ContentTreeManifestFieldsSchema.superRefine(
  (manifest, ctx) => {
    addCanonicalPathSetIssues(manifest.entries.map((entry) => entry.path), ctx, ["entries"]);
    const expected = digestCanonicalJson({
      schemaVersion: "content-tree-root.v1",
      entries: manifest.entries
    });
    if (!sameContentDigest(manifest.rootDigest, expected)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "content tree root digest mismatch",
        path: ["rootDigest"]
      });
    }
  }
);

export type ContentTreeManifest = z.infer<typeof ContentTreeManifestSchema>;

export const OfflineCapsuleRepositoryIdentitySchema = z.object({
  repositoryId: z.string().min(1).max(256),
  fullName: z.string().min(3).max(512).regex(/^[^/\s]+\/[^/\s]+$/u)
}).strict();

export type OfflineCapsuleRepositoryIdentity = z.infer<
  typeof OfflineCapsuleRepositoryIdentitySchema
>;

export const OfflineCapsuleCorrelationSchema = z.object({
  threadId: z.string().min(1).max(512),
  turnId: z.string().min(1).max(512),
  itemId: z.string().min(1).max(512)
}).strict();

export type OfflineCapsuleCorrelation = z.infer<typeof OfflineCapsuleCorrelationSchema>;

export const OfflineCapsuleRestrictionsSchema = z.object({
  networkAccess: z.literal("none"),
  credentialAccess: z.literal("none"),
  inheritEnvironment: z.literal(false),
  hostSocketAccess: z.literal(false),
  sourceWorkspaceMounted: z.literal(false),
  gitMetadataMounted: z.literal(false),
  inputTreeAccess: z.literal("immutable_content_tree_only"),
  outputForm: z.literal("complete_content_tree")
}).strict();

export const OfflineCapsuleLimitsSchema = z.object({
  maxChangedFiles: z.number().int().positive().max(10_000),
  maxChangedBytes: z.number().int().positive().max(100 * 1024 * 1024),
  maxDiffBytes: z.number().int().positive().max(100 * 1024 * 1024)
}).strict();

const OfflineExecutionCapsuleManifestContentSchema = z.object({
  schemaVersion: z.literal("offline-execution-capsule.v1"),
  capsuleId: z.string().min(1).max(256),
  executionMode: z.literal("test_only_simulated"),
  taskDigest: ContentDigestSchema,
  inputRoot: ContentDigestSchema,
  repository: OfflineCapsuleRepositoryIdentitySchema,
  baseHead: z.string().min(1).max(512),
  correlation: OfflineCapsuleCorrelationSchema,
  allowedTargets: CanonicalTargetPathsSchema,
  restrictions: OfflineCapsuleRestrictionsSchema,
  limits: OfflineCapsuleLimitsSchema,
  nonce: z.string().regex(NONCE_PATTERN),
  issuedAt: CapsuleTimestampSchema,
  expiresAt: CapsuleTimestampSchema,
  policyVersion: z.literal("offline-execution-capsule-policy.v1")
}).strict();

export type OfflineExecutionCapsuleManifestContent = z.infer<
  typeof OfflineExecutionCapsuleManifestContentSchema
>;

const OfflineExecutionCapsuleManifestFieldsSchema =
  OfflineExecutionCapsuleManifestContentSchema.extend({
    manifestHash: z.string().regex(SHA256_PATTERN)
  }).strict();

export const OfflineExecutionCapsuleManifestSchema =
  OfflineExecutionCapsuleManifestFieldsSchema.superRefine((manifest, ctx) => {
    const { manifestHash: _manifestHash, ...content } = manifest;
    if (manifest.manifestHash !== hashCanonicalJson(content)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "offline capsule manifest hash mismatch",
        path: ["manifestHash"]
      });
    }
  });

export type OfflineExecutionCapsuleManifest = z.infer<
  typeof OfflineExecutionCapsuleManifestSchema
>;

export const OfflineSimulatedCheckResultSchema = z.object({
  checkId: z.string().min(1).max(256),
  status: z.literal("simulated"),
  summary: z.string().min(1).max(4096)
}).strict();

export const OfflineFakeWorkerIdentitySchema = z.object({
  workerId: z.literal("offline-test-only-fake-worker"),
  workerVersion: z.literal("1"),
  scope: z.literal("test_only")
}).strict();

const OfflineOutputTreeReceiptContentSchema = z.object({
  schemaVersion: z.literal("offline-output-tree-receipt.v1"),
  receiptId: z.string().min(1).max(512),
  capsuleId: z.string().min(1).max(256),
  executionMode: z.literal("test_only_simulated"),
  manifestHash: z.string().regex(SHA256_PATTERN),
  taskDigest: ContentDigestSchema,
  inputRoot: ContentDigestSchema,
  outputRoot: ContentDigestSchema,
  repository: OfflineCapsuleRepositoryIdentitySchema,
  baseHead: z.string().min(1).max(512),
  correlation: OfflineCapsuleCorrelationSchema,
  worker: OfflineFakeWorkerIdentitySchema,
  nonce: z.string().regex(NONCE_PATTERN),
  startedAt: CapsuleTimestampSchema,
  completedAt: CapsuleTimestampSchema,
  checks: z.array(OfflineSimulatedCheckResultSchema).min(1).max(128),
  cleanup: z.object({
    attempted: z.literal(true),
    status: z.enum(["succeeded", "failed"])
  }).strict()
}).strict();

export type OfflineOutputTreeReceiptContent = z.infer<
  typeof OfflineOutputTreeReceiptContentSchema
>;

const OfflineOutputTreeReceiptFieldsSchema = OfflineOutputTreeReceiptContentSchema.extend({
  receiptHash: z.string().regex(SHA256_PATTERN)
}).strict();

export const OfflineOutputTreeReceiptSchema =
  OfflineOutputTreeReceiptFieldsSchema.superRefine((receipt, ctx) => {
    const { receiptHash: _receiptHash, ...content } = receipt;
    if (receipt.receiptHash !== hashCanonicalJson(content)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "offline output receipt hash mismatch",
        path: ["receiptHash"]
      });
    }
  });

export type OfflineOutputTreeReceipt = z.infer<typeof OfflineOutputTreeReceiptSchema>;

const OfflineCapsuleAssessmentFieldsSchema = z.object({
  schemaVersion: z.literal("offline-capsule-assessment.v1"),
  status: z.enum(["verified_offline", "blocked"]),
  executionMode: z.literal("test_only_simulated"),
  contractSatisfied: z.boolean(),
  reasons: z.array(z.string().min(1)),
  manifestHash: z.string().regex(SHA256_PATTERN).optional(),
  outputRoot: ContentDigestSchema.optional(),
  changeSet: GovernedFileChangeSetSchema.optional(),
  runtimeExecutionVerified: z.literal(false),
  workerFidelityMechanicallyProven: z.literal(false),
  realIsolationMechanicallyProven: z.literal(false),
  filesystemTopologyMechanicallyProven: z.literal(false),
  durableReplayProtectionMechanicallyProven: z.literal(false),
  injectedTransformSideEffectsMechanicallyExcluded: z.literal(false),
  liveExecutionAuthorized: z.literal(false),
  autoApprovalEligible: z.literal(false),
  retainEligible: z.literal(false),
  applyEligible: z.literal(false),
  outputRetentionAuthorized: z.literal(false),
  workspaceWriteEligible: z.literal(false)
}).strict();

export const OfflineCapsuleAssessmentSchema =
  OfflineCapsuleAssessmentFieldsSchema.superRefine((assessment, ctx) => {
    if (assessment.status === "verified_offline") {
      if (!assessment.contractSatisfied || assessment.changeSet === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "verified offline assessment requires a canonical change set"
        });
      }
    } else if (assessment.contractSatisfied || assessment.changeSet !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "blocked offline assessment cannot satisfy the contract"
      });
    }
  });

export type OfflineCapsuleAssessment = z.infer<typeof OfflineCapsuleAssessmentSchema>;

export function createOfflineExecutionCapsuleManifest(
  input: OfflineExecutionCapsuleManifestContent
): OfflineExecutionCapsuleManifest {
  assertPassiveJsonValue(input);
  const content = OfflineExecutionCapsuleManifestContentSchema.parse(input);
  return OfflineExecutionCapsuleManifestSchema.parse({
    ...content,
    manifestHash: hashCanonicalJson(content)
  });
}

export function createOfflineOutputTreeReceipt(
  input: OfflineOutputTreeReceiptContent
): OfflineOutputTreeReceipt {
  assertPassiveJsonValue(input);
  const content = OfflineOutputTreeReceiptContentSchema.parse(input);
  return OfflineOutputTreeReceiptSchema.parse({
    ...content,
    receiptHash: hashCanonicalJson(content)
  });
}

export function createContentTreeManifest(
  entriesInput: ContentTreeEntry[]
): ContentTreeManifest {
  assertPassiveJsonValue(entriesInput);
  const entries = entriesInput
    .map((entry) => ContentTreeEntrySchema.parse(entry))
    .sort((left, right) => compareCodeUnits(left.path, right.path));
  const rootDigest = digestCanonicalJson({
    schemaVersion: "content-tree-root.v1",
    entries
  });
  return ContentTreeManifestSchema.parse({
    schemaVersion: "content-tree-manifest.v1",
    entries,
    rootDigest
  });
}

export function canonicalJsonBytes(input: unknown): Uint8Array {
  assertPassiveJsonValue(input);
  return new TextEncoder().encode(stableJson(input));
}

export function digestBytes(input: Uint8Array): ContentDigest {
  const bytes = new Uint8Array(input);
  return {
    algorithm: "sha256",
    hash: createHash("sha256").update(bytes).digest("hex"),
    size: bytes.byteLength
  };
}

export function digestCanonicalJson(input: unknown): ContentDigest {
  return digestBytes(canonicalJsonBytes(input));
}

export function hashCanonicalJson(input: unknown): string {
  return digestCanonicalJson(input).hash;
}

export function sameContentDigest(left: ContentDigest, right: ContentDigest): boolean {
  return left.algorithm === right.algorithm
    && left.hash === right.hash
    && left.size === right.size;
}

export function sameCanonicalJson(left: unknown, right: unknown): boolean {
  return stableJson(left) === stableJson(right);
}

export function assertPassiveJsonValue(input: unknown): void {
  const seen = new Set<object>();
  visitPassiveJsonValue(input, seen);
}

export function isCanonicalCapsulePath(input: string): boolean {
  if (input.normalize("NFC") !== input || hasUnpairedUtf16Surrogate(input)) {
    return false;
  }
  const slashPath = input.replace(/\\/gu, "/");
  const normalized = pathPosix.normalize(slashPath);
  const parts = normalized.split("/");
  return !(
    input === ""
    || normalized === "."
    || normalized === ".."
    || normalized.startsWith("../")
    || pathPosix.isAbsolute(normalized)
    || isAbsolute(input)
    || /^[a-zA-Z]:/u.test(input)
    || slashPath.startsWith("//")
    || input !== slashPath
    || normalized !== slashPath
    || parts.some((part) => part === "" || part === "." || part === "..")
    || parts.some((part) => part.toLocaleLowerCase("en-US") === ".git")
    || parts.some((part) => UNSAFE_PATH_CHARACTERS.test(part))
    || parts.some((part) => part.endsWith(".") || part.endsWith(" "))
    || parts.some((part) => WINDOWS_RESERVED_NAMES.test(part))
  );
}

export function canonicalPathAlias(path: string): string {
  return path.normalize("NFC").toLocaleLowerCase("en-US");
}

export function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export type { GovernedFileChangeSet };

function addCanonicalPathSetIssues(
  paths: string[],
  ctx: z.RefinementCtx,
  pathPrefix: Array<string | number> = []
): void {
  const aliases = new Set<string>();
  let previous: string | undefined;
  for (let index = 0; index < paths.length; index += 1) {
    const path = paths[index];
    if (path === undefined) {
      continue;
    }
    if (previous !== undefined && compareCodeUnits(previous, path) >= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "offline capsule paths must be unique and code-unit sorted",
        path: [...pathPrefix, index]
      });
    }
    const alias = canonicalPathAlias(path);
    if (aliases.has(alias)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "offline capsule path alias collision",
        path: [...pathPrefix, index]
      });
    }
    aliases.add(alias);
    previous = path;
  }
}

function visitPassiveJsonValue(input: unknown, seen: Set<object>): void {
  if (
    input === null
    || typeof input === "string"
    || typeof input === "boolean"
    || (typeof input === "number" && Number.isFinite(input))
  ) {
    return;
  }
  if (typeof input !== "object" || isProxy(input)) {
    throw new Error("offline_capsule_executable_or_non_json_input");
  }
  if (seen.has(input)) {
    throw new Error("offline_capsule_cyclic_input");
  }
  const prototype = Object.getPrototypeOf(input) as unknown;
  if (prototype !== Object.prototype && prototype !== Array.prototype) {
    throw new Error("offline_capsule_non_plain_input");
  }
  seen.add(input);
  for (const key of Reflect.ownKeys(input)) {
    if (typeof key === "symbol") {
      throw new Error("offline_capsule_symbol_key_input");
    }
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (descriptor === undefined) {
      throw new Error("offline_capsule_descriptor_input_invalid");
    }
    if (descriptor.get !== undefined || descriptor.set !== undefined) {
      throw new Error("offline_capsule_accessor_input");
    }
    visitPassiveJsonValue(descriptor.value, seen);
  }
  seen.delete(input);
}

function stableJson(input: unknown): string {
  if (input === null || typeof input !== "object") {
    const encoded = JSON.stringify(input);
    if (encoded === undefined) {
      throw new Error("offline_capsule_json_value_unsupported");
    }
    return encoded;
  }
  if (Array.isArray(input)) {
    return `[${input.map((item) => stableJson(item)).join(",")}]`;
  }
  const record = input as Record<string, unknown>;
  return `{${Object.keys(record).sort(compareCodeUnits).map((key) => (
    `${JSON.stringify(key)}:${stableJson(record[key])}`
  )).join(",")}}`;
}

function hasUnpairedUtf16Surrogate(input: string): boolean {
  for (let index = 0; index < input.length; index += 1) {
    const codeUnit = input.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = input.charCodeAt(index + 1);
      if (next < 0xdc00 || next > 0xdfff) {
        return true;
      }
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      return true;
    }
  }
  return false;
}
