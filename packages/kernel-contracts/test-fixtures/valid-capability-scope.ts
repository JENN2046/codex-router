import type { CapabilityScope } from "../src/index.js";

export const validCapabilityScope = {
  schemaVersion: "capability-scope.v1",
  kind: "file",
  resource: "workspace/packages/kernel-contracts/**",
  access: "read",
  constraints: {
    reason: "phase_1_fixture"
  }
} as const satisfies CapabilityScope;

export const validToolExecuteScope = {
  schemaVersion: "capability-scope.v1",
  kind: "tool",
  resource: "apply_patch",
  access: "execute",
  constraints: {
    reason: "phase_1_fixture"
  }
} as const satisfies CapabilityScope;
