export type ParsedCapabilityScope = {
  raw: string;
  family: string;
  action: string;
  resource: string;
  effect: "allow" | "deny";
};

export type CapabilityGrantLike = string | {
  scope?: string;
  scopes?: string[];
  principalId?: string;
  taskId?: string;
  runId?: string;
  expiresAt?: string;
  revokedAt?: string;
};

export type CapabilityCheckOptions = {
  principalId?: string;
  taskId?: string;
  runId?: string;
  now?: string;
};

export type CapabilityCheckResult = {
  allowed: boolean;
  requestedScope: string;
  reasons: string[];
  matchedAllowScopes: string[];
  matchedDenyScopes: string[];
  ignoredGrantReasons: string[];
};

const knownActions = new Set([
  "fs.read",
  "fs.write",
  "shell.exec",
  "network.egress",
  "mcp.call",
  "memory.read",
  "memory.write",
  "secret.read"
]);

export function parseCapabilityScope(scope: string): ParsedCapabilityScope {
  const trimmed = scope.trim();
  const separatorIndex = trimmed.indexOf(":");

  if (separatorIndex <= 0 || separatorIndex === trimmed.length - 1) {
    throw new Error(`invalid capability scope: ${scope}`);
  }

  const action = trimmed.slice(0, separatorIndex);
  const resource = trimmed.slice(separatorIndex + 1);
  const family = action.split(".")[0];

  if (!family || !action.includes(".")) {
    throw new Error(`invalid capability action: ${action}`);
  }

  if (!knownActions.has(action)) {
    throw new Error(`unknown capability action: ${action}`);
  }

  return {
    raw: trimmed,
    family,
    action,
    resource,
    effect: resource === "deny" ? "deny" : "allow"
  };
}

export function capabilityImplies(
  grantScope: string,
  requestedScope: string
): boolean {
  const grant = parseCapabilityScope(grantScope);
  const requested = parseCapabilityScope(requestedScope);

  return grant.action === requested.action
    && resourceImplies(grant.resource, requested.resource);
}

export function hasCapabilityGrant(
  grants: CapabilityGrantLike[],
  requestedScope: string,
  options: CapabilityCheckOptions = {}
): boolean {
  return explainCapabilityDecision(grants, requestedScope, options).allowed;
}

export function explainCapabilityDecision(
  grants: CapabilityGrantLike[],
  requestedScope: string,
  options: CapabilityCheckOptions = {}
): CapabilityCheckResult {
  const matchedAllowScopes: string[] = [];
  const matchedDenyScopes: string[] = [];
  const ignoredGrantReasons: string[] = [];
  let requested: ParsedCapabilityScope;

  try {
    requested = parseCapabilityScope(requestedScope);
  } catch (error) {
    return {
      allowed: false,
      requestedScope,
      reasons: [normalizeErrorMessage(error)],
      matchedAllowScopes,
      matchedDenyScopes,
      ignoredGrantReasons
    };
  }

  for (const grant of grants) {
    const availability = explainGrantAvailability(grant, options);

    if (!availability.usable) {
      ignoredGrantReasons.push(...availability.reasons);
      continue;
    }

    for (const scope of availability.scopes) {
      let parsedGrant: ParsedCapabilityScope;

      try {
        parsedGrant = parseCapabilityScope(scope);
      } catch (error) {
        ignoredGrantReasons.push(normalizeErrorMessage(error));
        continue;
      }

      if (
        parsedGrant.effect === "deny"
        && parsedGrant.action === requested.action
        && denyResourceMatches(parsedGrant.resource, requested.resource)
      ) {
        matchedDenyScopes.push(parsedGrant.raw);
        continue;
      }

      if (parsedGrant.effect === "allow" && capabilityImplies(parsedGrant.raw, requested.raw)) {
        matchedAllowScopes.push(parsedGrant.raw);
      }
    }
  }

  if (matchedDenyScopes.length > 0) {
    return {
      allowed: false,
      requestedScope,
      reasons: ["matched_deny_scope"],
      matchedAllowScopes: uniqueStrings(matchedAllowScopes),
      matchedDenyScopes: uniqueStrings(matchedDenyScopes),
      ignoredGrantReasons: uniqueStrings(ignoredGrantReasons)
    };
  }

  if (matchedAllowScopes.length > 0) {
    return {
      allowed: true,
      requestedScope,
      reasons: ["matched_allow_scope"],
      matchedAllowScopes: uniqueStrings(matchedAllowScopes),
      matchedDenyScopes: [],
      ignoredGrantReasons: uniqueStrings(ignoredGrantReasons)
    };
  }

  return {
    allowed: false,
    requestedScope,
    reasons: [`missing_capability:${requested.action}:${requested.resource}`],
    matchedAllowScopes: [],
    matchedDenyScopes: [],
    ignoredGrantReasons: uniqueStrings(ignoredGrantReasons)
  };
}

function explainGrantAvailability(
  grant: CapabilityGrantLike,
  options: CapabilityCheckOptions
): {
  usable: boolean;
  scopes: string[];
  reasons: string[];
} {
  const normalized = normalizeGrant(grant);
  const reasons: string[] = [];

  if (normalized.scopes.length === 0) {
    reasons.push("grant_has_no_scopes");
  }

  if (normalized.revokedAt) {
    reasons.push(`grant_revoked:${normalized.revokedAt}`);
  }

  if (normalized.expiresAt && isExpired(normalized.expiresAt, options.now)) {
    reasons.push(`grant_expired:${normalized.expiresAt}`);
  }

  if (
    normalized.principalId
    && options.principalId
    && normalized.principalId !== options.principalId
  ) {
    reasons.push(`principal_mismatch:${normalized.principalId}`);
  }

  if (
    normalized.taskId
    && options.taskId
    && normalized.taskId !== options.taskId
  ) {
    reasons.push(`task_mismatch:${normalized.taskId}`);
  }

  if (
    normalized.runId
    && options.runId
    && normalized.runId !== options.runId
  ) {
    reasons.push(`run_mismatch:${normalized.runId}`);
  }

  if (normalized.principalId && !options.principalId) {
    reasons.push("missing_principal_context");
  }

  if (normalized.taskId && !options.taskId) {
    reasons.push("missing_task_context");
  }

  if (normalized.runId && !options.runId) {
    reasons.push("missing_run_context");
  }

  return {
    usable: reasons.length === 0,
    scopes: normalized.scopes,
    reasons
  };
}

function normalizeGrant(grant: CapabilityGrantLike): {
  scopes: string[];
  principalId?: string;
  taskId?: string;
  runId?: string;
  expiresAt?: string;
  revokedAt?: string;
} {
  if (typeof grant === "string") {
    return { scopes: [grant] };
  }

  const scopes = [
    ...(grant.scope ? [grant.scope] : []),
    ...(grant.scopes ?? [])
  ];

  return {
    scopes,
    ...(grant.principalId ? { principalId: grant.principalId } : {}),
    ...(grant.taskId ? { taskId: grant.taskId } : {}),
    ...(grant.runId ? { runId: grant.runId } : {}),
    ...(grant.expiresAt ? { expiresAt: grant.expiresAt } : {}),
    ...(grant.revokedAt ? { revokedAt: grant.revokedAt } : {})
  };
}

function isExpired(expiresAt: string, now?: string): boolean {
  const nowTime = now ? Date.parse(now) : Date.now();
  const expiresTime = Date.parse(expiresAt);

  if (Number.isNaN(expiresTime)) {
    return true;
  }

  return expiresTime <= nowTime;
}

function resourceImplies(grantResource: string, requestedResource: string): boolean {
  if (grantResource === "deny") {
    return false;
  }

  if (grantResource === requestedResource || grantResource === "*") {
    return true;
  }

  if (grantResource.endsWith("/**")) {
    const prefix = grantResource.slice(0, -3);
    return requestedResource === prefix || requestedResource.startsWith(`${prefix}/`);
  }

  return false;
}

function denyResourceMatches(denyResource: string, requestedResource: string): boolean {
  return denyResource === "deny" || resourceImplies(denyResource, requestedResource);
}

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "unknown_capability_error";
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}
