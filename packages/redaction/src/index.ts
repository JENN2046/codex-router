export const REDACTED_SECRET = "<REDACTED_SECRET>";

export type RedactSecretLikeFieldsOptions = {
  additionalSecretKeys?: string[];
  redactStrings?: boolean;
  stripUndefined?: boolean;
};

export function redactSecretLikeFields(
  input: unknown,
  options: RedactSecretLikeFieldsOptions = {}
): unknown {
  const secretKeys = createSecretKeySet(options.additionalSecretKeys ?? []);
  return redactSecretLikeValue(input, "", {
    secretKeys,
    redactStrings: options.redactStrings ?? false,
    stripUndefined: options.stripUndefined ?? true
  });
}

export function redactSecretLikeText(input: string): string {
  return input
    .replace(
      /(["'])(api[-_]?key|authorization|credential|password|secret|token)\1(\s*:\s*)(["'])(?:\\.|(?!\4)[^\\\r\n])*\4/gi,
      (_match, keyQuote: string, key: string, separator: string, valueQuote: string) =>
        `${keyQuote}${key}${keyQuote}${separator}${valueQuote}${REDACTED_SECRET}${valueQuote}`
    )
    .replace(
      /(["'])(api[-_]?key|authorization|credential|password|secret|token)\1(\s*:\s*)([^"',\s{}\[\]\r\n]+)/gi,
      (_match, keyQuote: string, key: string, separator: string) =>
        `${keyQuote}${key}${keyQuote}${separator}${REDACTED_SECRET}`
    )
    .replace(
      /(authorization)(\s*[:=]\s*)(["']?)[^\r\n]+/gi,
      `$1$2$3${REDACTED_SECRET}`
    )
    .replace(
      /(api[-_]?key|credential|password|secret|token)(\s*[:=]\s*)(["']?)[^\s"',;]+/gi,
      `$1$2$3${REDACTED_SECRET}`
    );
}

export function isSecretLikeKey(key: string, additionalSecretKeys: string[] = []): boolean {
  const normalizedKey = key.toLowerCase();
  if (additionalSecretKeys.some((secretKey) => secretKey.toLowerCase() === normalizedKey)) {
    return true;
  }

  return /api[-_]?key|authorization|credential|password|secret|token/i.test(key);
}

function redactSecretLikeValue(
  value: unknown,
  key: string,
  options: {
    secretKeys: Set<string>;
    redactStrings: boolean;
    stripUndefined: boolean;
  }
): unknown {
  if (isSecretLikeKeyFromSet(key, options.secretKeys)) {
    return REDACTED_SECRET;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactSecretLikeValue(item, "", options));
  }

  if (!isRecord(value)) {
    return typeof value === "string" && options.redactStrings
      ? redactSecretLikeText(value)
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

  return /api[-_]?key|authorization|credential|password|secret|token/i.test(key);
}

function createSecretKeySet(additionalSecretKeys: string[]): Set<string> {
  return new Set(additionalSecretKeys.map((key) => key.toLowerCase()));
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null;
}
