# codex-router Protocol v1

## TaskEnvelope

`TaskEnvelope` is the normalized task input contract for the Desktop-first policy SDK.

```ts
type TaskEnvelope = {
  schemaVersion: "task-envelope.v1";
  taskId: string;
  source: "desktop-thread" | "desktop-automation" | "cli" | "api";
  intent: {
    summary: string;
    requestedAction: string;
    successCriteria: string[];
    outOfScope: string[];
  };
  repoContext: {
    repoRoot?: string;
    branch?: string;
    worktreeClean?: boolean;
    protectedBranch?: boolean;
  };
  target: {
    branches: string[];
    files: string[];
    modules: string[];
  };
  constraints: {
    requiresNetwork?: boolean;
    explicitOwnership?: boolean;
    allowBackgroundAutomation?: boolean;
  };
  hints: {
    taskClassHint?: "read_only" | "small_edit" | "engineering" | "high_risk" | "release_external_action";
    riskHints: string[];
    tags: string[];
  };
};
```

Why it is shaped this way:

- `intent` isolates what the user wants from repo facts
- `target` isolates the intended surface from generic hints
- `constraints` keeps execution requirements out of free text
- `hints` remains advisory rather than authoritative

## RoutingDecision

`RoutingDecision` is the normalized routing output contract.

```ts
type RoutingDecision = {
  schemaVersion: "routing-decision.v1";
  decisionId: string;
  taskId: string;
  policyVersion: string;
  classification: {
    taskClass: "read_only" | "small_edit" | "engineering" | "high_risk" | "release_external_action";
    riskLevel: "low" | "medium" | "high";
    ambiguityScore: number;
    clarificationRequired: boolean;
    riskFactors: string[];
  };
  execution: {
    selectedModel: "gpt-5.4-mini" | "gpt-5.4" | "gpt-5.3-codex-spark" | "gpt-5.3-codex" | "gpt-5.1-codex-max";
    toolAccess: "read_only" | "local_write" | "engineering_write" | "protected_remote";
    executionProfile: "recon-only" | "clarify-then-plan" | "engineering" | "high-risk-change" | "release-governance";
    reasoningEffort: "low" | "medium" | "high";
  };
  approval: {
    required: boolean;
    reasons: string[];
  };
  parallelism: {
    allowed: boolean;
    maxAgents: number;
    mode: "disabled" | "read_only" | "owned_write";
  };
};
```

Why it is shaped this way:

- `classification` and `execution` are separated so downstream consumers do not need to reverse-engineer policy intent
- `approval` is explicit and structurally separate from execution
- `parallelism.mode` allows `desktop-agent-strategy` to distinguish read-only fan-out from ownership-bound write fan-out

## Caller Guidance

- Call `parseTaskEnvelope()` before storing or reusing incoming task data.
- Call `parseRoutingDecision()` if a decision is loaded from a file, queue, or external adapter.
- Avoid constructing protocol objects by hand across package boundaries when a parser helper is available.
