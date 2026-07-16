import {
  containsCredentialLikeDiffContent,
  isSensitiveGovernedPath
} from "../../authorization-kernel/src/index.js";
import type { CapsuleTaskContract } from "./contracts.js";
import type { OfflineContentTreeFile } from "./content-addressed-store.js";

const BINARY_CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;
const SENSITIVE_OFFLINE_FILE_TOKEN = /(?:^|[._-])(?:credential|credentials|secret|secrets)(?:[._-]|$)/u;
const RAW_CREDENTIAL_MATERIAL_PATTERNS = [
  /\bsk-(?:proj-)?[a-z0-9_-]{8,}\b/iu,
  /\bgh[pousr]_[a-z0-9_]{8,}\b/iu,
  /\bAKIA[0-9A-Z]{8,}\b/u,
  /\bxox[baprs]-[a-z0-9-]{8,}\b/iu,
  /\bnpm_[a-z0-9]{8,}\b/iu,
  /\bBearer\s+[^\s]+/iu,
  /-----BEGIN(?: [A-Z0-9]+)? PRIVATE KEY-----/u
] as const;

export function containsCredentialLikeTreeContent(
  files: readonly OfflineContentTreeFile[]
): boolean {
  return files.some((file) => {
    const bytePreservingText = new TextDecoder("latin1").decode(file.content);
    if (containsCredentialLikeText(bytePreservingText)) {
      return true;
    }
    const nullStrippedText = bytePreservingText.replaceAll("\u0000", "");
    if (
      nullStrippedText !== bytePreservingText
      && containsCredentialLikeText(nullStrippedText)
    ) {
      return true;
    }
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(file.content);
    } catch {
      return false;
    }
    if (BINARY_CONTROL_CHARACTERS.test(text)) {
      return false;
    }
    return containsCredentialLikeText(text);
  });
}

export function isSensitiveOfflineTreePath(path: string): boolean {
  if (isSensitiveGovernedPath(path)) {
    return true;
  }
  return path
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .split("/")
    .some((component) => SENSITIVE_OFFLINE_FILE_TOKEN.test(component));
}

export function containsCredentialLikeTaskContent(task: CapsuleTaskContract): boolean {
  return [
    task.taskId,
    task.instruction,
    ...task.successCriteria,
    ...task.outOfScope,
    ...task.targetPaths
  ].some(containsCredentialLikeText);
}

export function containsCredentialLikeStringValue(value: unknown): boolean {
  if (typeof value === "string") {
    return containsCredentialLikeText(value);
  }
  if (Array.isArray(value)) {
    return value.some(containsCredentialLikeStringValue);
  }
  if (value === null || typeof value !== "object") {
    return false;
  }
  return Object.values(value).some(containsCredentialLikeStringValue);
}

function containsCredentialLikeText(text: string): boolean {
  return containsCredentialLikeDiffContent(text) || containsRawCredentialMaterial(text);
}

function containsRawCredentialMaterial(text: string): boolean {
  return RAW_CREDENTIAL_MATERIAL_PATTERNS.some((pattern) => pattern.test(text));
}
