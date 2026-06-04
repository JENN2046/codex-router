import type { ToolInvocation } from "../src/index.js";
import { validToolExecuteScope } from "./valid-capability-scope.js";
import { validPrincipal } from "./valid-principal.js";
import { validRun } from "./valid-run.js";
import { validStep } from "./valid-step.js";
import { validTask } from "./valid-task.js";
import { validToolManifest } from "./valid-tool-manifest.js";

export const validToolInvocation = {
  schemaVersion: "tool-invocation.v1",
  invocationId: "invocation_phase_1_fixture_001",
  toolId: validToolManifest.toolId,
  taskId: validTask.taskId,
  runId: validRun.runId,
  stepId: validStep.stepId,
  principalId: validPrincipal.principalId,
  input: {
    patchId: "patch_phase_1_fixture_001"
  },
  requestedScopes: [validToolExecuteScope],
  createdAt: "2026-06-04T00:08:00.000Z"
} as const satisfies ToolInvocation;
