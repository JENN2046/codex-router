import type {
  AgentRole,
  ExecutionProfileName,
  ToolAccessLevel
} from "../../contracts/src/index.js";

export interface ExecutionProfile {
  name: ExecutionProfileName;
  stages: string[];
  defaultRole: AgentRole;
  defaultToolAccess: ToolAccessLevel;
  allowParallel: boolean;
  maxParallelAgents: number;
}

export const EXECUTION_PROFILES: Record<ExecutionProfileName, ExecutionProfile> = {
  "recon-only": {
    name: "recon-only",
    stages: ["recon", "summarize"],
    defaultRole: "analyst",
    defaultToolAccess: "read_only",
    allowParallel: true,
    maxParallelAgents: 3
  },
  "clarify-then-plan": {
    name: "clarify-then-plan",
    stages: ["clarify", "plan"],
    defaultRole: "architect",
    defaultToolAccess: "read_only",
    allowParallel: false,
    maxParallelAgents: 1
  },
  "engineering": {
    name: "engineering",
    stages: ["recon", "plan", "build", "validate"],
    defaultRole: "worker",
    defaultToolAccess: "engineering_write",
    allowParallel: true,
    maxParallelAgents: 2
  },
  "high-risk-change": {
    name: "high-risk-change",
    stages: ["recon", "impact-review", "approval", "build", "validate"],
    defaultRole: "reviewer",
    defaultToolAccess: "engineering_write",
    allowParallel: false,
    maxParallelAgents: 1
  },
  "release-governance": {
    name: "release-governance",
    stages: ["recon", "impact-review", "approval", "verify", "handoff"],
    defaultRole: "reviewer",
    defaultToolAccess: "protected_remote",
    allowParallel: false,
    maxParallelAgents: 1
  }
};

export function getExecutionProfile(name: ExecutionProfileName): ExecutionProfile {
  return EXECUTION_PROFILES[name];
}
