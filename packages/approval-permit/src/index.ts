import { createHash } from "node:crypto";
import {
  ApprovalPermitSchema,
  PrincipalSchema,
  type ApprovalPermit,
  type CapabilityScope,
  type Principal
} from "../../kernel-contracts/src/index.js";
import {
  capabilityImplies,
  parseCapabilityScope
} from "../../capability/src/index.js";

export type CreateApprovalPermitInput = {
  permitId: string;
  taskId: string;
  runId: string;
  principalId: string;
  approverId: string;
  policyDecisionHash: string;
  planHash: string;
  capabilityScopes: string[];
  createdAt: string;
  expiresAt: string;
  approver?: Principal;
  reason?: string;
  signature?: string;
};

export type ApprovalPermitValidationContext = {
  taskId: string;
  runId: string;
  principalId: string;
  policyDecisionHash: string;
  planHash: string;
  requestedCapabilityScopes: string[];
  now: string;
};

export type ApprovalPermitValidationResult = {
  valid: boolean;
  reasons: string[];
  missingCapabilityScopes: string[];
  matchedCapabilityScopes: string[];
};

export function createApprovalPermit(input: CreateApprovalPermitInput): ApprovalPermit {
  const approver = input.approver ?? PrincipalSchema.parse({
    principalId: input.approverId,
    kind: "user",
    createdAt: input.createdAt
  });

  return ApprovalPermitSchema.parse({
    schemaVersion: "approval-permit.v1",
    permitId: input.permitId,
    taskId: input.taskId,
    runId: input.runId,
    principalId: input.principalId,
    approverId: input.approverId,
    decisionHash: input.policyDecisionHash,
    policyDecisionHash: input.policyDecisionHash,
    planHash: input.planHash,
    approvedBy: approver,
    scopes: input.capabilityScopes.map(capabilityScopeToKernelScope),
    capabilityScopes: input.capabilityScopes,
    issuedAt: input.createdAt,
    createdAt: input.createdAt,
    expiresAt: input.expiresAt,
    ...(input.reason ? { reason: input.reason } : {}),
    ...(input.signature ? { signature: input.signature } : {})
  });
}

export function hashApprovalScope(input: unknown): string {
  return createHash("sha256")
    .update(stableStringify(input))
    .digest("hex");
}

export function validateApprovalPermit(
  permit: ApprovalPermit,
  context: ApprovalPermitValidationContext
): ApprovalPermitValidationResult {
  const reasons: string[] = [];
  const missingCapabilityScopes: string[] = [];
  const matchedCapabilityScopes: string[] = [];

  if (permit.taskId !== context.taskId) {
    reasons.push("task_id_mismatch");
  }

  if (permit.runId !== context.runId) {
    reasons.push("run_id_mismatch");
  }

  if (permit.principalId !== context.principalId) {
    reasons.push("principal_id_mismatch");
  }

  if (getPolicyDecisionHash(permit) !== context.policyDecisionHash) {
    reasons.push("policy_decision_hash_mismatch");
  }

  if (permit.planHash !== context.planHash) {
    reasons.push("plan_hash_mismatch");
  }

  if (Date.parse(permit.expiresAt) <= Date.parse(context.now)) {
    reasons.push("permit_expired");
  }

  if (permit.revokedAt) {
    reasons.push("permit_revoked");
  }

  const permittedScopes = getCapabilityScopes(permit);

  for (const requestedScope of context.requestedCapabilityScopes) {
    const matchedScope = permittedScopes.find((permitScope) => {
      try {
        return capabilityImplies(permitScope, requestedScope);
      } catch {
        return false;
      }
    });

    if (matchedScope) {
      matchedCapabilityScopes.push(requestedScope);
    } else {
      missingCapabilityScopes.push(requestedScope);
    }
  }

  if (missingCapabilityScopes.length > 0) {
    reasons.push("missing_capability_scope");
  }

  return {
    valid: reasons.length === 0,
    reasons: uniqueStrings(reasons),
    missingCapabilityScopes,
    matchedCapabilityScopes
  };
}

export function revokeApprovalPermit(
  permit: ApprovalPermit,
  revokedAt: string,
  reason: string
): ApprovalPermit {
  return ApprovalPermitSchema.parse({
    ...permit,
    revokedAt,
    revokedReason: reason
  });
}

function getPolicyDecisionHash(permit: ApprovalPermit): string {
  return permit.policyDecisionHash ?? permit.decisionHash;
}

function getCapabilityScopes(permit: ApprovalPermit): string[] {
  if (permit.capabilityScopes.length > 0) {
    return permit.capabilityScopes;
  }

  return permit.scopes.map((scope) => `${scope.kind}.${scope.access}:${scope.resource}`);
}

function capabilityScopeToKernelScope(scope: string): CapabilityScope {
  const parsed = parseCapabilityScope(scope);
  const [family, action] = parsed.action.split(".");

  if (!family || !action) {
    throw new Error(`invalid capability action: ${parsed.action}`);
  }

  if (family === "fs") {
    return {
      schemaVersion: "capability-scope.v1",
      kind: "file",
      resource: parsed.resource,
      access: action === "read" ? "read" : "write",
      constraints: {
        capabilityScope: scope
      }
    };
  }

  if (family === "shell" || family === "mcp") {
    return {
      schemaVersion: "capability-scope.v1",
      kind: "tool",
      resource: parsed.resource,
      access: "execute",
      constraints: {
        capabilityScope: scope,
        family
      }
    };
  }

  if (family === "network") {
    return {
      schemaVersion: "capability-scope.v1",
      kind: "network",
      resource: parsed.resource,
      access: "write",
      constraints: {
        capabilityScope: scope
      }
    };
  }

  if (family === "memory") {
    return {
      schemaVersion: "capability-scope.v1",
      kind: "process",
      resource: parsed.resource,
      access: action === "read" ? "read" : "write",
      constraints: {
        capabilityScope: scope,
        family
      }
    };
  }

  return {
    schemaVersion: "capability-scope.v1",
    kind: "secret",
    resource: parsed.resource,
    access: "read",
    constraints: {
      capabilityScope: scope
    }
  };
}

function stableStringify(input: unknown): string {
  if (input === null || typeof input !== "object") {
    return JSON.stringify(input);
  }

  if (Array.isArray(input)) {
    return `[${input.map((item) => stableStringify(item)).join(",")}]`;
  }

  const record = input as Record<string, unknown>;
  const keys = Object.keys(record).sort();

  return `{${keys.map((key) => (
    `${JSON.stringify(key)}:${stableStringify(record[key])}`
  )).join(",")}}`;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}
