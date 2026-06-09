import type { Run } from "../src/index.js";
import { validTask } from "./valid-task.js";

export const validRun = {
  schemaVersion: "kernel-run.v1",
  runId: "run_phase_1_fixture_001",
  taskId: validTask.taskId,
  status: "queued",
  policyDecisionId: "decision_phase_1_fixture_001",
  createdAt: "2026-06-04T00:03:00.000Z",
  updatedAt: "2026-06-04T00:03:00.000Z"
} as const satisfies Run;
