import { posix as pathPosix } from "node:path";
import {
  CapabilityScopeSchema,
  type CapabilityGrant,
  type CapabilityScope
} from "../../kernel-contracts/src/index.js";

export type ParsedCapabilityScope = {
  raw: string;
  family: string;
  action: string;
  resource: string;
  effect: "allow" | "deny";
};

export type CapabilityGrantLike = string | {
  scope?: string | CapabilityScope;
  scopes?: Array<string | CapabilityScope>;
  principalId?: string;
  taskId?: string;
  runId?: string;
  expiresAt?: string;
  revokedAt?: string;
} | CapabilityGrant;

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
  "secret.read",
  "external.write",
  "external.execute",
  "external.admin"
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
    && resourceImplies(grant.resource, requested.resource, grant.action);
}

export function capabilityScopeToCanonicalString(scopeInput: CapabilityScope): string {
  const scope = CapabilityScopeSchema.parse(scopeInput);
  const canonicalScope = getCanonicalScopeConstraint(scope);

  if (canonicalScope) {
    return canonicalScope;
  }

  return `${capabilityScopeToCanonicalAction(scope)}:${scope.resource}`;
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
        && denyResourceMatches(parsedGrant.resource, requested.resource, parsedGrant.action)
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
  const invalidNowReason = explainInvalidNow(options.now);

  if (normalized.scopes.length === 0) {
    reasons.push("grant_has_no_scopes");
  }

  if (invalidNowReason !== undefined) {
    reasons.push(invalidNowReason);
  }

  if (normalized.revokedAt) {
    reasons.push(`grant_revoked:${normalized.revokedAt}`);
  }

  if (
    normalized.expiresAt
    && invalidNowReason === undefined
    && isExpired(normalized.expiresAt, options.now)
  ) {
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

  const scope = "scope" in grant ? grant.scope : undefined;
  const scopes = [
    ...(scope ? [scope] : []),
    ...("scopes" in grant ? grant.scopes : [])
  ].map(normalizeGrantScope);

  return {
    scopes,
    ...(grant.principalId ? { principalId: grant.principalId } : {}),
    ...(grant.taskId ? { taskId: grant.taskId } : {}),
    ...(grant.runId ? { runId: grant.runId } : {}),
    ...(grant.expiresAt ? { expiresAt: grant.expiresAt } : {}),
    ...(grant.revokedAt ? { revokedAt: grant.revokedAt } : {})
  };
}

function normalizeGrantScope(scope: string | CapabilityScope): string {
  if (typeof scope === "string") {
    return scope;
  }

  return capabilityScopeToCanonicalString(scope);
}

function getCanonicalScopeConstraint(scope: CapabilityScope): string | undefined {
  const canonicalScope = scope.constraints.capabilityScope;

  if (typeof canonicalScope !== "string") {
    return undefined;
  }

  try {
    return canonicalScopeMatchesStructuredScope(scope, canonicalScope)
      ? canonicalScope
      : undefined;
  } catch {
    return undefined;
  }
}

function canonicalScopeMatchesStructuredScope(
  scope: CapabilityScope,
  canonicalScope: string
): boolean {
  const parsedCanonical = parseCapabilityScope(canonicalScope);
  const parsedStructured = parseCapabilityScope(
    `${capabilityScopeToCanonicalAction(scope)}:${scope.resource}`
  );

  return parsedCanonical.action === parsedStructured.action
    && resourcesAreEquivalent(
      parsedCanonical.resource,
      parsedStructured.resource,
      parsedStructured.action
    );
}

function resourcesAreEquivalent(
  leftResource: string,
  rightResource: string,
  action: string
): boolean {
  return resourceImplies(leftResource, rightResource, action)
    && resourceImplies(rightResource, leftResource, action);
}

function capabilityScopeToCanonicalAction(scope: CapabilityScope): string {
  const family = scope.constraints.family;

  if (scope.kind === "file" && scope.access === "read") {
    return "fs.read";
  }

  if (scope.kind === "file" && scope.access === "write") {
    return "fs.write";
  }

  if (scope.kind === "tool" && scope.access === "execute") {
    return family === "mcp" ? "mcp.call" : "shell.exec";
  }

  if (scope.kind === "network" && scope.access !== "read") {
    return "network.egress";
  }

  if (scope.kind === "secret" && scope.access === "read") {
    return "secret.read";
  }

  if (scope.kind === "process" && family === "memory" && scope.access === "read") {
    return "memory.read";
  }

  if (scope.kind === "process" && family === "memory" && scope.access === "write") {
    return "memory.write";
  }

  return `${scope.kind}.${scope.access}`;
}

function isExpired(expiresAt: string, now?: string): boolean {
  const nowTime = now ? Date.parse(now) : Date.now();
  const expiresTime = Date.parse(expiresAt);

  if (Number.isNaN(nowTime)) {
    return true;
  }

  if (Number.isNaN(expiresTime)) {
    return true;
  }

  return expiresTime <= nowTime;
}

function explainInvalidNow(now?: string): string | undefined {
  if (now === undefined) {
    return undefined;
  }

  return Number.isNaN(Date.parse(now))
    ? `invalid_capability_check_now:${now}`
    : undefined;
}

function resourceImplies(
  grantResource: string,
  requestedResource: string,
  action: string
): boolean {
  if (grantResource === "deny") {
    return false;
  }

  if (grantResource === "*") {
    return true;
  }

  const normalizedGrantResource = normalizeResourceForAction(grantResource, action);
  const normalizedRequestedResource = normalizeResourceForAction(requestedResource, action);

  if (normalizedGrantResource === normalizedRequestedResource) {
    return true;
  }

  if (normalizedGrantResource.endsWith("/**")) {
    const prefix = normalizedGrantResource.slice(0, -3);
    return normalizedRequestedResource === prefix
      || normalizedRequestedResource.startsWith(`${prefix}/`);
  }

  return false;
}

function denyResourceMatches(
  denyResource: string,
  requestedResource: string,
  action: string
): boolean {
  return denyResource === "deny" || resourceImplies(denyResource, requestedResource, action);
}

function normalizeResourceForAction(resource: string, action: string): string {
  return action.startsWith("fs.")
    ? normalizeFileResource(resource)
    : resource;
}

function normalizeFileResource(resource: string): string {
  const slashResource = resource.replace(/\\/g, "/");
  const hasRecursiveWildcard = slashResource.endsWith("/**");
  const resourceBase = hasRecursiveWildcard
    ? slashResource.slice(0, -3)
    : slashResource;
  const normalizedBase = trimTrailingSlash(pathPosix.normalize(resourceBase));

  return hasRecursiveWildcard
    ? `${normalizedBase}/**`
    : normalizedBase;
}

function trimTrailingSlash(resource: string): string {
  if (resource.length > 1 && resource.endsWith("/")) {
    return resource.slice(0, -1);
  }

  return resource;
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
