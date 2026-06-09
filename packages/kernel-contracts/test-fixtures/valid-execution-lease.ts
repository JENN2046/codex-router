import type { ExecutionLease } from "../src/index.js";
import { validRun } from "./valid-run.js";

export const validExecutionLease = {
  schemaVersion: "execution-lease.v1",
  leaseId: "lease_phase_1_fixture_001",
  runId: validRun.runId,
  workerId: "worker_phase_1_fixture_001",
  acquiredAt: "2026-06-04T00:11:00.000Z",
  expiresAt: "2026-06-04T00:16:00.000Z",
  heartbeatAt: "2026-06-04T00:12:00.000Z"
} as const satisfies ExecutionLease;
