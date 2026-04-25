import type {
  AgentRole,
  RoutingDecision
} from "../../contracts/src/index.js";
import { getExecutionProfile } from "../../execution-profiles/src/index.js";

export interface WorkerAssignment {
  role: AgentRole;
  mode: "read_only" | "write";
  ownership?: string[];
}

export interface AgentStrategyPlan {
  parallel: boolean;
  maxAgents: number;
  assignments: WorkerAssignment[];
  reasons: string[];
}

export function planAgentStrategy(
  decision: RoutingDecision,
  options: {
    availableAgents: number;
    explicitOwnership: boolean;
    fileTargets?: string[];
  }
): AgentStrategyPlan {
  const profile = getExecutionProfile(decision.execution.executionProfile);
  const fileTargets = options.fileTargets ?? [];
  const reasons: string[] = [];

  if (!decision.parallelism.allowed) {
    return {
      parallel: false,
      maxAgents: 1,
      assignments: [{ role: profile.defaultRole, mode: decision.execution.toolAccess === "read_only" ? "read_only" : "write" }],
      reasons: ["profile_disallows_parallel"]
    };
  }

  if (decision.parallelism.mode === "owned_write") {
    if (!options.explicitOwnership || fileTargets.length === 0) {
      return {
        parallel: false,
        maxAgents: 1,
        assignments: [{ role: "worker", mode: "write" }],
        reasons: ["write_scope_needs_explicit_ownership"]
      };
    }

    return {
      parallel: true,
      maxAgents: Math.min(options.availableAgents, fileTargets.length, decision.parallelism.maxAgents),
      assignments: fileTargets.slice(0, decision.parallelism.maxAgents).map((fileTarget) => ({
        role: "worker",
        mode: "write",
        ownership: [fileTarget]
      })),
      reasons: ["write_parallelism_allowed_with_ownership"]
    };
  }

  return {
    parallel: true,
    maxAgents: Math.min(options.availableAgents, decision.parallelism.maxAgents),
    assignments: Array.from({ length: Math.min(options.availableAgents, decision.parallelism.maxAgents) }, () => ({
      role: "analyst",
      mode: "read_only"
    })),
    reasons: ["read_only_parallelism_allowed"]
  };
}
