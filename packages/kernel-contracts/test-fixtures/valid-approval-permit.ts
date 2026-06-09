import type { ApprovalPermit } from "../src/index.js";
import { validCapabilityScope, validToolExecuteScope } from "./valid-capability-scope.js";
import { validPrincipal } from "./valid-principal.js";
import { validRun } from "./valid-run.js";
import { validTask } from "./valid-task.js";

export const validApprovalPermit = {
  schemaVersion: "approval-permit.v1",
  permitId: "permit_phase_1_fixture_001",
  taskId: validTask.taskId,
  runId: validRun.runId,
  decisionHash: "decision_hash_phase_1_fixture_001",
  planHash: "plan_hash_phase_1_fixture_001",
  approvedBy: validPrincipal,
  scopes: [validCapabilityScope, validToolExecuteScope],
  capabilityScopes: [
    "fs.read:workspace/packages/kernel-contracts/**",
    "shell.exec:apply_patch"
  ],
  issuedAt: "2026-06-04T00:07:00.000Z",
  expiresAt: "2026-06-04T01:07:00.000Z",
  reason: "phase_1_fixture"
} as const satisfies ApprovalPermit;
