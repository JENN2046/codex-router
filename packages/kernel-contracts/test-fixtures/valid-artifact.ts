import type { Artifact } from "../src/index.js";
import { validRun } from "./valid-run.js";
import { validTask } from "./valid-task.js";

export const validArtifact = {
  schemaVersion: "artifact.v1",
  artifactId: "artifact_phase_1_fixture_001",
  taskId: validTask.taskId,
  runId: validRun.runId,
  kind: "evidence",
  uri: "docs/agent-os-transformation/phase-1-baseline.md",
  sha256: "b".repeat(64),
  sizeBytes: 111,
  createdAt: "2026-06-04T00:09:00.000Z",
  metadata: {
    fixture: "phase_1"
  }
} as const satisfies Artifact;
