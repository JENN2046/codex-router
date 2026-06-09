import type { Event } from "../src/index.js";
import { validPrincipal } from "./valid-principal.js";
import { validRun } from "./valid-run.js";
import { validStep } from "./valid-step.js";
import { validTask } from "./valid-task.js";

export const validEvent = {
  schemaVersion: "kernel-event.v1",
  eventId: "event_phase_1_fixture_001",
  eventType: "kernel.fixture.created",
  taskId: validTask.taskId,
  runId: validRun.runId,
  stepId: validStep.stepId,
  principalId: validPrincipal.principalId,
  createdAt: "2026-06-04T00:10:00.000Z",
  payload: {
    fixture: "phase_1"
  }
} as const satisfies Event;
