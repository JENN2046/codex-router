export const REDACTED_SECRET = "<REDACTED_SECRET>";

export type RedactSecretLikeFieldsOptions = {
  additionalSecretKeys?: string[];
  redactArgvSecrets?: boolean;
  redactStrings?: boolean;
  stripUndefined?: boolean;
};

const DEFAULT_SECRET_KEY_PATTERN = "[A-Za-z0-9_.-]*(?:api[-_]?key|authorization|credential|password|secret|token)[A-Za-z0-9_.-]*";
const DEFAULT_CANONICAL_SECRET_OPTION_PATTERN = "api[-_]?key|authorization|credential|password|secret|token|access[-_]?token|client[-_]?secret|github[-_]?token|refresh[-_]?token";

export function redactSecretLikeFields(
  input: unknown,
  options: RedactSecretLikeFieldsOptions = {}
): unknown {
  const secretKeys = createSecretKeySet(options.additionalSecretKeys ?? []);
  return redactSecretLikeValue(input, "", {
    secretKeys,
    redactArgvSecrets: options.redactArgvSecrets ?? false,
    redactStrings: options.redactStrings ?? false,
    stripUndefined: options.stripUndefined ?? true
  });
}

export function redactSecretLikeText(input: string, additionalSecretKeys: string[] = []): string {
  return redactSecretLikeTextWithSet(input, createSecretKeySet(additionalSecretKeys));
}

function redactSecretLikeTextWithSet(input: string, secretKeys: Set<string>): string {
  const secretKeyPattern = createSecretTextKeyPattern(secretKeys);
  const canonicalSecretKeyPattern = createCanonicalSecretTextKeyPattern(secretKeys);
  return input
    .replace(
      new RegExp(`(["'])(${secretKeyPattern})\\1(\\s*:\\s*)(["'])(?:\\\\.|(?!\\4)[^\\\\\\r\\n])*\\4`, "gi"),
      (_match, keyQuote: string, key: string, separator: string, valueQuote: string) =>
        `${keyQuote}${key}${keyQuote}${separator}${valueQuote}${REDACTED_SECRET}${valueQuote}`
    )
    .replace(
      new RegExp(`(["'])(${secretKeyPattern})\\1(\\s*:\\s*)([^"',\\s{}\\[\\]\\r\\n]+)`, "gi"),
      (_match, keyQuote: string, key: string, separator: string) =>
        `${keyQuote}${key}${keyQuote}${separator}${REDACTED_SECRET}`
    )
    .replace(
      new RegExp(`(${secretKeyPattern})(\\s*[:=]\\s*)(["'])(?:\\\\.|(?!\\3)[^\\\\\\r\\n])*\\3`, "gi"),
      (_match, key: string, separator: string, valueQuote: string) =>
        `${key}${separator}${valueQuote}${REDACTED_SECRET}${valueQuote}`
    )
    .replace(
      /(authorization)(\s*[:=]\s*)(?!["'])[^\r\n]+/gi,
      `$1$2${REDACTED_SECRET}`
    )
    .replace(
      new RegExp(`(^|[\\s;&|])(-+(${secretKeyPattern}))(\\s*[:=]\\s*)(?!["'])(?:\\\\.|[^\\s"';])+`, "gi"),
      (_match, prefix: string, flag: string, _key: string, separator: string) =>
        `${prefix}${flag}${separator}${REDACTED_SECRET}`
    )
    .replace(
      new RegExp(`(${secretKeyPattern})(\\s*[:=]\\s*)(["']?)(?:\\\\.|[^\\s"',;])+`, "gi"),
      `$1$2$3${REDACTED_SECRET}`
    )
    .replace(
      new RegExp(`(^|[\\s;&|])(-+(${secretKeyPattern}))(\\s+)(["'])(?:\\\\.|(?!\\5)[^\\\\\\r\\n])*\\5`, "gi"),
      (_match, prefix: string, flag: string, _key: string, spacing: string, valueQuote: string) =>
        `${prefix}${flag}${spacing}${valueQuote}${REDACTED_SECRET}${valueQuote}`
    )
    .replace(
      new RegExp(
        `(^|[\\s;&|])(-+(${secretKeyPattern}))(\\s+)(--+(${canonicalSecretKeyPattern}))(\\s+)((?!--)(?:\\\\.|[^\\s"',;])+)`,
        "gi"
      ),
      (
        match,
        prefix: string,
        previousFlag: string,
        _previousKey: string,
        previousSpacing: string,
        boundaryFlag: string,
        _boundaryKey: string,
        valueSpacing: string
      ) =>
        isCanonicalSplitSecretArgvFlag(boundaryFlag, secretKeys)
          ? `${prefix}${previousFlag}${previousSpacing}${boundaryFlag}${valueSpacing}${REDACTED_SECRET}`
          : match
    )
    .replace(
      new RegExp(
        `(^|[\\s;&|])(-+(${secretKeyPattern}))(\\s+)(--+(${canonicalSecretKeyPattern}))(\\s+)(-+(?:\\\\.|[^\\s"',;])+)(?=$|[\\s;&|]-)`,
        "gi"
      ),
      (
        match,
        prefix: string,
        previousFlag: string,
        _previousKey: string,
        previousSpacing: string,
        boundaryFlag: string,
        _boundaryKey: string,
        valueSpacing: string
      ) =>
        isCanonicalSplitSecretArgvFlag(boundaryFlag, secretKeys)
          ? `${prefix}${previousFlag}${previousSpacing}${boundaryFlag}${valueSpacing}${REDACTED_SECRET}`
          : match
    )
    .replace(
      new RegExp(
        `(^|[\\s;&|])(-+(${secretKeyPattern}))(\\s+)(?!-+(?:${canonicalSecretKeyPattern})\\s+(?!--))(-+(?:\\\\.|[^\\s"',;])+)`,
        "gi"
      ),
      (_match, prefix: string, flag: string, _key: string, spacing: string) =>
        `${prefix}${flag}${spacing}${REDACTED_SECRET}`
    )
    .replace(
      new RegExp(`(^|[\\s;&|])(-+(${secretKeyPattern}))(\\s+)(?!-)((?:\\\\.|[^\\s"',;])+)`, "gi"),
      (_match, prefix: string, flag: string, _key: string, spacing: string) =>
        `${prefix}${flag}${spacing}${REDACTED_SECRET}`
    );
}

export function isSecretLikeKey(key: string, additionalSecretKeys: string[] = []): boolean {
  const normalizedKey = key.toLowerCase();
  if (additionalSecretKeys.some((secretKey) => secretKey.toLowerCase() === normalizedKey)) {
    return true;
  }

  return new RegExp(DEFAULT_SECRET_KEY_PATTERN, "i").test(key);
}

export function redactSecretLikeArgv(
  args: string[],
  additionalSecretKeys: string[] = []
): string[] {
  const secretKeys = createSecretKeySet(additionalSecretKeys);
  let redactNext = false;
  const redactedArgs: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] ?? "";
    if (redactNext && !isSplitSecretArgvBoundaryAt(args, index, secretKeys)) {
      redactNext = false;
      redactedArgs.push(REDACTED_SECRET);
      continue;
    }

    if (redactNext) {
      redactNext = false;
    }

    const redactedArg = redactInlineSecretArgvValue(redactSecretLikeTextWithSet(arg, secretKeys), secretKeys);
    redactedArgs.push(redactedArg);
    if (isSplitSecretArgvFlag(arg, secretKeys)) {
      redactNext = true;
    }
  }

  return redactedArgs;
}

function redactSecretLikeValue(
  value: unknown,
  key: string,
  options: {
    secretKeys: Set<string>;
    redactArgvSecrets: boolean;
    redactStrings: boolean;
    stripUndefined: boolean;
  }
): unknown {
  if (isSecretLikeKeyFromSet(key, options.secretKeys)) {
    return REDACTED_SECRET;
  }

  if (Array.isArray(value)) {
    const redactedItems = value.map((item) => redactSecretLikeValue(item, "", options));
    return options.redactArgvSecrets && redactedItems.every((item): item is string => typeof item === "string")
      ? redactSecretLikeArgv(redactedItems, [...options.secretKeys])
      : redactedItems;
  }

  if (!isRecord(value)) {
    return typeof value === "string" && options.redactStrings
      ? redactSecretLikeTextWithSet(value, options.secretKeys)
      : value;
  }

  const output: Record<string, unknown> = {};
  for (const [entryKey, entryValue] of Object.entries(value)) {
    if (entryValue === undefined && options.stripUndefined) {
      continue;
    }

    output[entryKey] = redactSecretLikeValue(entryValue, entryKey, options);
  }

  return output;
}

function isSecretLikeKeyFromSet(key: string, secretKeys: Set<string>): boolean {
  if (key.length === 0) {
    return false;
  }

  if (secretKeys.has(key.toLowerCase())) {
    return true;
  }

  return new RegExp(DEFAULT_SECRET_KEY_PATTERN, "i").test(key);
}

function createSecretKeySet(additionalSecretKeys: string[]): Set<string> {
  return new Set(additionalSecretKeys.map((key) => key.toLowerCase()));
}

function createSecretTextKeyPattern(secretKeys: Set<string>): string {
  const additionalKeyPatterns = [...secretKeys]
    .filter((key) => key.length > 0)
    .sort((left, right) => right.length - left.length)
    .map(escapeRegExp);
  return [DEFAULT_SECRET_KEY_PATTERN, ...additionalKeyPatterns].join("|");
}

function createCanonicalSecretTextKeyPattern(secretKeys: Set<string>): string {
  const additionalKeyPatterns = [...secretKeys]
    .filter((key) => key.length > 0)
    .sort((left, right) => right.length - left.length)
    .map(escapeRegExp);
  return [DEFAULT_CANONICAL_SECRET_OPTION_PATTERN, ...additionalKeyPatterns].join("|");
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isSplitSecretArgvFlag(arg: string, secretKeys: Set<string>): boolean {
  if (!arg.startsWith("-") || arg.includes("=") || arg.includes(":")) {
    return false;
  }

  const key = arg.replace(/^-+/, "");
  return isSecretLikeKeyFromSet(key, secretKeys);
}

function isCanonicalSplitSecretArgvFlag(arg: string, secretKeys: Set<string>): boolean {
  if (!isSplitSecretArgvFlag(arg, secretKeys)) {
    return false;
  }

  if (!arg.startsWith("--")) {
    return false;
  }

  const key = arg.replace(/^-+/, "").toLowerCase();
  return isCanonicalSecretOptionKey(key, secretKeys);
}

function isSplitSecretArgvBoundaryAt(args: string[], index: number, secretKeys: Set<string>): boolean {
  const arg = args[index];
  if (arg === undefined || !isSplitSecretArgvFlag(arg, secretKeys)) {
    return false;
  }

  if (!arg.startsWith("--")) {
    return false;
  }

  if (!isCanonicalSplitSecretArgvFlag(arg, secretKeys)) {
    return false;
  }

  const nextArg = args[index + 1];
  if (nextArg === undefined) {
    return false;
  }

  if (!nextArg.startsWith("--")) {
    return true;
  }

  if (isSplitSecretArgvFlag(nextArg, secretKeys)) {
    return true;
  }

  const followingArg = args[index + 2];
  return followingArg === undefined || followingArg.startsWith("--");
}

function isCanonicalSecretOptionKey(key: string, secretKeys: Set<string>): boolean {
  if (secretKeys.has(key)) {
    return true;
  }

  return new RegExp(`^(?:${DEFAULT_CANONICAL_SECRET_OPTION_PATTERN})$`).test(key);
}

function redactInlineSecretArgvValue(arg: string, secretKeys: Set<string>): string {
  if (!arg.startsWith("-")) {
    return arg;
  }

  const match = /^(-+)([^=:]+)([=:])(.*)$/.exec(arg);
  if (!match) {
    return arg;
  }

  const prefix = match[1];
  const key = match[2];
  const separator = match[3];
  if (prefix === undefined || key === undefined || separator === undefined) {
    return arg;
  }

  return isSecretLikeKeyFromSet(key, secretKeys)
    ? `${prefix}${key}${separator}${REDACTED_SECRET}`
    : arg;
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null;
}
