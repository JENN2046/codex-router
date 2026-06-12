import type { Task } from "../src/index.js";
import { validPrincipal } from "./valid-principal.js";

export const validTask = {
  schemaVersion: "kernel-task.v1",
  taskId: "task_phase_1_fixture_001",
  source: "cli",
  title: "Phase 1 fixture task",
  requestedAction: "Parse stable kernel contract fixtures.",
  successCriteria: [
    "principal parses",
    "policy decision parses",
    "approval permit parses"
  ],
  outOfScope: [
    "runtime execution",
    "remote writes"
  ],
  createdBy: validPrincipal,
  repo: {
    root: "A:/codex-router",
    branch: "codex/agent-os-kernel-phase-0-1",
    worktreeClean: true,
    protectedBranch: false
  },
  target: {
    branches: [],
    files: ["packages/kernel-contracts/src/index.ts"],
    modules: ["kernel-contracts"]
  },
  hints: {
    taskClass: "engineering",
    riskHints: ["local_contracts"],
    tags: ["phase_1", "fixture"],
    provenance: []
  },
  constraints: {
    requiresNetwork: false
  },
  createdAt: "2026-06-04T00:02:00.000Z"
} as const satisfies Task;
