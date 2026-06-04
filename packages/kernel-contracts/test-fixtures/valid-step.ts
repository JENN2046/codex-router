import type { Step } from "../src/index.js";
import { validRun } from "./valid-run.js";
import { validTask } from "./valid-task.js";

export const validStep = {
  schemaVersion: "kernel-step.v1",
  stepId: "step_phase_1_fixture_001",
  runId: validRun.runId,
  taskId: validTask.taskId,
  kind: "tool",
  status: "pending",
  dependsOn: [],
  createdAt: "2026-06-04T00:04:00.000Z",
  updatedAt: "2026-06-04T00:04:00.000Z",
  input: {
    fixture: "kernel_contracts_public_api"
  }
} as const satisfies Step;
