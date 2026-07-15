import {
  containsCredentialLikeDiffContent,
  isSensitiveGovernedPath
} from "../../authorization-kernel/src/index.js";
import {
  GovernedFileChangeSetSchema,
  hashGovernedFileChangeSetContent,
  type GovernedFileChange
} from "../../kernel-contracts/src/index.js";
import {
  OfflineCapsuleAssessmentSchema,
  OfflineExecutionCapsuleManifestSchema,
  OfflineOutputTreeReceiptSchema,
  assertPassiveJsonValue,
  compareCodeUnits,
  sameCanonicalJson,
  sameContentDigest,
  type CapsuleTaskContract,
  type ContentDigest,
  type OfflineCapsuleAssessment,
  type OfflineExecutionCapsuleManifest,
  type OfflineOutputTreeReceipt
} from "./contracts.js";
import {
  loadCapsuleTask,
  loadContentTree,
  type ContentAddressedStore,
  type LoadedContentTreeFile
} from "./content-addressed-store.js";

const BINARY_CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;
const RAW_CREDENTIAL_MATERIAL_PATTERNS = [
  /\bsk-(?:proj-)?[a-z0-9_-]{8,}\b/iu,
  /\bgh[pousr]_[a-z0-9_]{8,}\b/iu,
  /\bAKIA[0-9A-Z]{8,}\b/u,
  /\bxox[baprs]-[a-z0-9-]{8,}\b/iu,
  /\bnpm_[a-z0-9]{8,}\b/iu,
  /\bBearer\s+[^\s]+/iu,
  /-----BEGIN(?: [A-Z0-9]+)? PRIVATE KEY-----/u
] as const;

export interface OfflineCapsuleReplayStore {
  consume(input: { nonce: string; receiptHash: string }): boolean;
}

export interface VerifyOfflineCapsuleInput {
  store: ContentAddressedStore;
  manifest: unknown;
  receipt: unknown;
  replayStore: OfflineCapsuleReplayStore;
  now: () => string;
}

class InMemoryOfflineCapsuleReplayStore implements OfflineCapsuleReplayStore {
  private readonly nonces = new Set<string>();
  private readonly receiptHashes = new Set<string>();

  consume(input: { nonce: string; receiptHash: string }): boolean {
    if (this.nonces.has(input.nonce) || this.receiptHashes.has(input.receiptHash)) {
      return false;
    }
    this.nonces.add(input.nonce);
    this.receiptHashes.add(input.receiptHash);
    return true;
  }
}

export function createInMemoryOfflineCapsuleReplayStore(): OfflineCapsuleReplayStore {
  return new InMemoryOfflineCapsuleReplayStore();
}

export function verifyOfflineCapsuleCandidate(
  input: VerifyOfflineCapsuleInput
): OfflineCapsuleAssessment {
  const manifestResult = parsePassiveManifest(input.manifest);
  if (manifestResult === undefined) {
    return blockedAssessment(["offline_capsule_manifest_invalid"]);
  }
  const manifest = manifestResult;
  const receiptResult = parsePassiveReceipt(input.receipt);
  if (receiptResult === undefined) {
    return blockedAssessment(["offline_capsule_receipt_invalid"], manifest);
  }
  const receipt = receiptResult;

  let verifiedAt: string;
  try {
    verifiedAt = input.now();
  } catch {
    return blockedAssessment(
      ["offline_capsule_verification_clock_failed"],
      manifest,
      receipt.outputRoot
    );
  }
  const bindingReasons = collectBindingReasons(manifest, receipt, verifiedAt);
  if (bindingReasons.length > 0) {
    return blockedAssessment(bindingReasons, manifest, receipt.outputRoot);
  }

  try {
    const task = loadCapsuleTask(input.store, manifest.taskDigest, "verification_task");
    if (
      task.taskId !== manifest.capsuleId
      || !sameCanonicalJson(task.targetPaths, manifest.allowedTargets)
    ) {
      return blockedAssessment(
        ["offline_capsule_task_binding_mismatch"],
        manifest,
        receipt.outputRoot
      );
    }
    if (containsCredentialLikeTaskContent(task)) {
      return blockedAssessment(
        ["offline_capsule_credential_like_content_forbidden"],
        manifest,
        receipt.outputRoot
      );
    }

    const inputTree = loadContentTree(
      input.store,
      manifest.inputRoot,
      "verification_input"
    );
    const outputTree = loadContentTree(
      input.store,
      receipt.outputRoot,
      "verification_output"
    );
    if (
      inputTree.files.some((file) => isSensitiveGovernedPath(file.path))
      || outputTree.files.some((file) => isSensitiveGovernedPath(file.path))
    ) {
      return blockedAssessment(
        ["offline_capsule_sensitive_path_forbidden"],
        manifest,
        receipt.outputRoot
      );
    }
    if (
      containsCredentialLikeTreeContent(inputTree.files)
      || containsCredentialLikeTreeContent(outputTree.files)
    ) {
      return blockedAssessment(
        ["offline_capsule_credential_like_content_forbidden"],
        manifest,
        receipt.outputRoot
      );
    }
    const comparison = compareCompleteTrees(
      inputTree.files,
      outputTree.files,
      manifest.allowedTargets
    );
    if (comparison.reasons.length > 0) {
      return blockedAssessment(comparison.reasons, manifest, receipt.outputRoot);
    }
    if (comparison.changes.length === 0) {
      return blockedAssessment(
        ["offline_capsule_no_change"],
        manifest,
        receipt.outputRoot
      );
    }
    if (comparison.changes.length > manifest.limits.maxChangedFiles) {
      return blockedAssessment(
        ["offline_capsule_changed_file_limit_exceeded"],
        manifest,
        receipt.outputRoot
      );
    }
    const changedBytes = comparison.changes.reduce(
      (total, change) => total + change.after.content.byteLength,
      0
    );
    if (changedBytes > manifest.limits.maxChangedBytes) {
      return blockedAssessment(
        ["offline_capsule_changed_byte_limit_exceeded"],
        manifest,
        receipt.outputRoot
      );
    }

    const governedChanges: GovernedFileChange[] = [];
    for (const change of comparison.changes) {
      const afterText = decodeChangedText(change.after.content);
      const beforeText = change.before === undefined
        ? undefined
        : decodeChangedText(change.before.content);
      governedChanges.push(toGovernedChange(change.before, change.after, beforeText, afterText));
    }

    const diffBytes = governedChanges.reduce(
      (total, change) => total + new TextEncoder().encode(change.unifiedDiff).byteLength,
      0
    );
    if (diffBytes > manifest.limits.maxDiffBytes) {
      return blockedAssessment(
        ["offline_capsule_diff_limit_exceeded"],
        manifest,
        receipt.outputRoot
      );
    }

    const changes = governedChanges.sort((left, right) => compareCodeUnits(left.path, right.path));
    const changeSet = GovernedFileChangeSetSchema.parse({
      schemaVersion: "governed-file-change-set.v1",
      changeSetId: manifest.capsuleId,
      threadId: manifest.correlation.threadId,
      turnId: manifest.correlation.turnId,
      itemId: manifest.correlation.itemId,
      baseHead: manifest.baseHead,
      changes,
      canonicalHash: hashGovernedFileChangeSetContent({
        baseHead: manifest.baseHead,
        changes
      }),
      proposedAt: receipt.completedAt,
      sourceSchemaProfile: "offline-execution-capsule.v1"
    });

    let consumed: boolean;
    try {
      consumed = input.replayStore.consume({
        nonce: manifest.nonce,
        receiptHash: receipt.receiptHash
      });
    } catch {
      return blockedAssessment(
        ["offline_capsule_replay_store_failed"],
        manifest,
        receipt.outputRoot
      );
    }
    if (!consumed) {
      return blockedAssessment(
        ["offline_capsule_receipt_or_nonce_replay"],
        manifest,
        receipt.outputRoot
      );
    }

    return OfflineCapsuleAssessmentSchema.parse({
      schemaVersion: "offline-capsule-assessment.v1",
      status: "verified_offline",
      executionMode: "test_only_simulated",
      contractSatisfied: true,
      reasons: [
        "offline_capsule_contract_verified",
        "fake_worker_receipt_is_simulated_contract_evidence_only",
        "content_identity_does_not_prove_worker_fidelity",
        "live_promotion_remains_unauthorized"
      ],
      manifestHash: manifest.manifestHash,
      outputRoot: receipt.outputRoot,
      changeSet,
      ...fixedFalseAssessmentFields()
    });
  } catch (error: unknown) {
    return blockedAssessment(
      [normalizeVerificationFailure(error)],
      manifest,
      receipt.outputRoot
    );
  }
}

function parsePassiveManifest(input: unknown): OfflineExecutionCapsuleManifest | undefined {
  try {
    assertPassiveJsonValue(input);
    const parsed = OfflineExecutionCapsuleManifestSchema.safeParse(input);
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

function parsePassiveReceipt(input: unknown): OfflineOutputTreeReceipt | undefined {
  try {
    assertPassiveJsonValue(input);
    const parsed = OfflineOutputTreeReceiptSchema.safeParse(input);
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

function collectBindingReasons(
  manifest: OfflineExecutionCapsuleManifest,
  receipt: OfflineOutputTreeReceipt,
  now: string
): string[] {
  const reasons: string[] = [];
  if (receipt.capsuleId !== manifest.capsuleId) {
    reasons.push("offline_capsule_identity_mismatch");
  }
  if (receipt.manifestHash !== manifest.manifestHash) {
    reasons.push("offline_capsule_manifest_binding_mismatch");
  }
  if (!sameContentDigest(receipt.taskDigest, manifest.taskDigest)) {
    reasons.push("offline_capsule_task_digest_mismatch");
  }
  if (!sameContentDigest(receipt.inputRoot, manifest.inputRoot)) {
    reasons.push("offline_capsule_input_root_mismatch");
  }
  if (!sameCanonicalJson(receipt.repository, manifest.repository)) {
    reasons.push("offline_capsule_repository_identity_mismatch");
  }
  if (receipt.baseHead !== manifest.baseHead) {
    reasons.push("offline_capsule_base_head_mismatch");
  }
  if (!sameCanonicalJson(receipt.correlation, manifest.correlation)) {
    reasons.push("offline_capsule_correlation_mismatch");
  }
  if (receipt.nonce !== manifest.nonce) {
    reasons.push("offline_capsule_nonce_mismatch");
  }
  if (receipt.cleanup.status !== "succeeded") {
    reasons.push("offline_capsule_cleanup_failed");
  }
  const issuedAt = Date.parse(manifest.issuedAt);
  const expiresAt = Date.parse(manifest.expiresAt);
  const startedAt = Date.parse(receipt.startedAt);
  const completedAt = Date.parse(receipt.completedAt);
  const verifiedAt = Date.parse(now);
  if (
    !Number.isFinite(issuedAt)
    || !Number.isFinite(expiresAt)
    || !Number.isFinite(startedAt)
    || !Number.isFinite(completedAt)
    || !Number.isFinite(verifiedAt)
    || issuedAt >= expiresAt
    || startedAt < issuedAt
    || completedAt < startedAt
    || completedAt > expiresAt
    || verifiedAt < completedAt
  ) {
    reasons.push("offline_capsule_timestamp_binding_invalid");
  } else if (verifiedAt > expiresAt || verifiedAt < issuedAt) {
    reasons.push("offline_capsule_manifest_expired_or_not_yet_valid");
  }
  return uniqueStrings(reasons);
}

interface CandidateChange {
  before?: LoadedContentTreeFile;
  after: LoadedContentTreeFile;
}

function compareCompleteTrees(
  inputFiles: LoadedContentTreeFile[],
  outputFiles: LoadedContentTreeFile[],
  allowedTargets: string[]
): { changes: CandidateChange[]; reasons: string[] } {
  const inputByPath = new Map(inputFiles.map((file) => [file.path, file] as const));
  const outputByPath = new Map(outputFiles.map((file) => [file.path, file] as const));
  const allowed = new Set(allowedTargets);
  const reasons: string[] = [];
  const changes: CandidateChange[] = [];
  const deletedFiles = inputFiles.filter((file) => !outputByPath.has(file.path));
  const createdFiles = outputFiles.filter((file) => !inputByPath.has(file.path));

  for (const inputFile of deletedFiles) {
    const renamedTo = createdFiles.find((file) => (
      file.mode === inputFile.mode && sameContentDigest(file.digest, inputFile.digest)
    ));
    if (renamedTo === undefined) {
      reasons.push(`offline_capsule_delete_forbidden:${inputFile.path}`);
    } else {
      reasons.push(`offline_capsule_rename_forbidden:${inputFile.path}:${renamedTo.path}`);
    }
  }
  for (const outputFile of outputFiles) {
    const inputFile = inputByPath.get(outputFile.path);
    if (inputFile === undefined) {
      if (!allowed.has(outputFile.path)) {
        reasons.push(`offline_capsule_target_outside_allowlist:${outputFile.path}`);
      }
      if (outputFile.mode !== "100644") {
        reasons.push(`offline_capsule_create_mode_forbidden:${outputFile.path}`);
      }
      changes.push({ after: outputFile });
      continue;
    }
    if (inputFile.mode !== outputFile.mode) {
      reasons.push(`offline_capsule_mode_drift_forbidden:${outputFile.path}`);
    }
    if (!sameContentDigest(inputFile.digest, outputFile.digest)) {
      if (!allowed.has(outputFile.path)) {
        reasons.push(`offline_capsule_target_outside_allowlist:${outputFile.path}`);
      }
      changes.push({ before: inputFile, after: outputFile });
    }
  }
  return { changes, reasons: uniqueStrings(reasons) };
}

function decodeChangedText(bytes: Uint8Array): string {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("offline_capsule_changed_binary_forbidden");
  }
  if (BINARY_CONTROL_CHARACTERS.test(text)) {
    throw new Error("offline_capsule_changed_binary_forbidden");
  }
  return text;
}

function containsCredentialLikeTreeContent(files: LoadedContentTreeFile[]): boolean {
  return files.some((file) => {
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(file.content);
    } catch {
      return false;
    }
    if (BINARY_CONTROL_CHARACTERS.test(text)) {
      return false;
    }
    return containsCredentialLikeDiffContent(text) || containsRawCredentialMaterial(text);
  });
}

function containsCredentialLikeTaskContent(task: CapsuleTaskContract): boolean {
  return [
    task.taskId,
    task.instruction,
    ...task.successCriteria,
    ...task.outOfScope,
    ...task.targetPaths
  ].some((text) => (
    containsCredentialLikeDiffContent(text) || containsRawCredentialMaterial(text)
  ));
}

function toGovernedChange(
  before: LoadedContentTreeFile | undefined,
  after: LoadedContentTreeFile,
  beforeText: string | undefined,
  afterText: string
): GovernedFileChange {
  const unifiedDiff = createCanonicalUnifiedDiff(after.path, beforeText, afterText);
  const beforeLines = beforeText === undefined ? [] : splitTextLines(beforeText).lines;
  const afterLines = splitTextLines(afterText).lines;
  return {
    path: after.path,
    kind: before === undefined ? "create" : "update",
    unifiedDiff,
    beforeHash: before === undefined ? null : before.digest.hash,
    afterHash: after.digest.hash,
    addedLines: afterLines.length,
    deletedLines: beforeLines.length
  };
}

export function createCanonicalUnifiedDiff(
  path: string,
  before: string | undefined,
  after: string
): string {
  const beforeParts = before === undefined
    ? { lines: [] as string[], finalNewline: true }
    : splitTextLines(before);
  const afterParts = splitTextLines(after);
  const create = before === undefined;
  if (create && afterParts.lines.length === 0) {
    return [
      `diff --git a/${path} b/${path}`,
      "new file mode 100644",
      "index e69de29..e69de29",
      ""
    ].join("\n");
  }
  const lines = [
    `diff --git a/${path} b/${path}`,
    ...(create ? ["new file mode 100644"] : []),
    create ? "--- /dev/null" : `--- a/${path}`,
    `+++ b/${path}`,
    `@@ -${create ? "0,0" : formatUnifiedRange(beforeParts.lines.length)} +${formatUnifiedRange(afterParts.lines.length)} @@`
  ];
  for (const line of beforeParts.lines) {
    lines.push(`-${line}`);
  }
  if (!create && beforeParts.lines.length > 0 && !beforeParts.finalNewline) {
    lines.push("\\ No newline at end of file");
  }
  for (const line of afterParts.lines) {
    lines.push(`+${line}`);
  }
  if (afterParts.lines.length > 0 && !afterParts.finalNewline) {
    lines.push("\\ No newline at end of file");
  }
  return `${lines.join("\n")}\n`;
}

function splitTextLines(text: string): { lines: string[]; finalNewline: boolean } {
  if (text === "") {
    return { lines: [], finalNewline: false };
  }
  const finalNewline = text.endsWith("\n");
  const lines = text.split("\n");
  if (finalNewline) {
    lines.pop();
  }
  return { lines, finalNewline };
}

function formatUnifiedRange(count: number): string {
  if (count === 0) {
    return "0,0";
  }
  return count === 1 ? "1" : `1,${count}`;
}

function blockedAssessment(
  reasons: string[],
  manifest?: OfflineExecutionCapsuleManifest,
  outputRoot?: ContentDigest
): OfflineCapsuleAssessment {
  return OfflineCapsuleAssessmentSchema.parse({
    schemaVersion: "offline-capsule-assessment.v1",
    status: "blocked",
    executionMode: "test_only_simulated",
    contractSatisfied: false,
    reasons: uniqueStrings(reasons),
    ...(manifest === undefined ? {} : { manifestHash: manifest.manifestHash }),
    ...(outputRoot === undefined ? {} : { outputRoot }),
    ...fixedFalseAssessmentFields()
  });
}

function fixedFalseAssessmentFields() {
  return {
    runtimeExecutionVerified: false as const,
    workerFidelityMechanicallyProven: false as const,
    realIsolationMechanicallyProven: false as const,
    filesystemTopologyMechanicallyProven: false as const,
    durableReplayProtectionMechanicallyProven: false as const,
    injectedTransformSideEffectsMechanicallyExcluded: false as const,
    liveExecutionAuthorized: false as const,
    autoApprovalEligible: false as const,
    retainEligible: false as const,
    applyEligible: false as const,
    outputRetentionAuthorized: false as const,
    workspaceWriteEligible: false as const
  };
}

function normalizeVerificationFailure(error: unknown): string {
  if (error instanceof Error && /^offline_[a-z0-9_:.-]+$/u.test(error.message)) {
    return error.message;
  }
  return "offline_capsule_verification_failed";
}

function containsRawCredentialMaterial(text: string): boolean {
  return RAW_CREDENTIAL_MATERIAL_PATTERNS.some((pattern) => pattern.test(text));
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}
