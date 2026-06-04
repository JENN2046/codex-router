import type { AgentManifest } from "../src/index.js";
import { validToolExecuteScope } from "./valid-capability-scope.js";
import { validPrincipal } from "./valid-principal.js";
import { validSandboxProfile } from "./valid-sandbox-profile.js";

export const validAgentManifest = {
  schemaVersion: "agent-manifest.v1",
  agentId: "agent_coding_worker_001",
  name: "Phase 1 Coding Worker",
  version: "0.1.0",
  principal: validPrincipal,
  description: "Stable fixture agent manifest for kernel-contracts tests.",
  capabilities: [validToolExecuteScope],
  defaultSandbox: validSandboxProfile,
  maxConcurrentRuns: 1,
  createdAt: "2026-06-04T00:01:00.000Z"
} as const satisfies AgentManifest;
