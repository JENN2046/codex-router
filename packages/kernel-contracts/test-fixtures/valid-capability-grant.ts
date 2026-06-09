import type { CapabilityGrant } from "../src/index.js";
import { validCapabilityScope, validToolExecuteScope } from "./valid-capability-scope.js";
import { validPrincipal } from "./valid-principal.js";
import { validRun } from "./valid-run.js";
import { validTask } from "./valid-task.js";

export const validCapabilityGrant = {
  schemaVersion: "capability-grant.v1",
  grantId: "grant_phase_1_fixture_001",
  principalId: validPrincipal.principalId,
  taskId: validTask.taskId,
  runId: validRun.runId,
  scopes: [validCapabilityScope, validToolExecuteScope],
  issuedAt: "2026-06-04T00:06:00.000Z",
  expiresAt: "2026-06-04T01:06:00.000Z",
  reason: "phase_1_fixture"
} as const satisfies CapabilityGrant;
