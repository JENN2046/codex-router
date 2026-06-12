import test from "node:test";
import assert from "node:assert/strict";
import {
  createApprovalPermit,
  hashApprovalScope
} from "../packages/approval-permit/src/index.js";
import {
  hashToolInvocationInput,
  planToolInvocation,
  redactToolInvocationInput
} from "../packages/tool-invocation-planner/src/index.js";
import {
  builtinApplyPatchToolManifest,
  builtinReadFileToolManifest,
  mcpGithubCreatePullRequestToolManifest,
  type ToolManifestInput
} from "../packages/tool-registry/src/index.js";
import {
  PolicyDecisionSchema,
  RunSchema,
  StepSchema,
  type ApprovalPermit,
  type PolicyDecision,
  type Run,
  type Step
} from "../packages/kernel-contracts/src/index.js";
import { validPolicyDecision } from "../packages/kernel-contracts/test-fixtures/valid-policy-decision.js";
import { validPrincipal } from "../packages/kernel-contracts/test-fixtures/valid-principal.js";
import { validRun } from "../packages/kernel-contracts/test-fixtures/valid-run.js";
import { validStep } from "../packages/kernel-contracts/test-fixtures/valid-step.js";

const now = "2026-06-04T00:10:00.000Z";
const planHash = "plan_hash_tool_invocation_001";

test("tool invocation planner plans read-only tools when capability is granted", () => {
  const plan = planToolInvocation(createInput({
    toolManifest: builtinReadFileToolManifest,
    proposedInput: {
      path: "/repo/README.md"
    },
    capabilityGrants: ["fs.read:/repo/**"]
  }));

  assert.equal(plan.status, "planned");
  assert.equal(plan.toolId, "builtin.read_file");
  assert.equal(plan.provider, "builtin");
  assert.equal(plan.sideEffectClass, "read");
  assert.equal(plan.approvalRequired, false);
  assert.deepEqual(plan.requiredCapabilities, ["fs.read:/repo/**"]);
  assert.equal(plan.sandboxProfile.mode, "read-only");
  assert.deepEqual(plan.reasons, ["capability_grants_satisfied"]);
});

test("tool invocation planner honors policy-required approval for read-only tools", () => {
  const policyDecision = createPolicyDecision({
    approval: {
      required: true,
      reasons: ["policy_high_risk_context"]
    }
  });
  const plan = planToolInvocation(createInput({
    policyDecision,
    toolManifest: builtinReadFileToolManifest,
    proposedInput: {
      path: "/repo/README.md"
    },
    capabilityGrants: ["fs.read:/repo/**"]
  }));

  assert.equal(plan.status, "waiting_approval");
  assert.equal(plan.approvalRequired, true);
  assert.equal(plan.sandboxProfile.mode, "read-only");
  assert.deepEqual(plan.reasons, [
    "approval_required",
    "policy_high_risk_context"
  ]);
});

test("tool invocation planner accepts read-only tools after policy approval permit", () => {
  const policyDecision = createPolicyDecision({
    approval: {
      required: true,
      reasons: ["policy_high_risk_context"]
    }
  });
  const permit = createPermit(policyDecision, {
    capabilityScopes: ["fs.read:/repo/**"]
  });
  const plan = planToolInvocation(createInput({
    policyDecision,
    toolManifest: builtinReadFileToolManifest,
    proposedInput: {
      path: "/repo/README.md"
    },
    capabilityGrants: ["fs.read:/repo/**"],
    approvalPermits: [permit]
  }));

  assert.equal(plan.status, "planned");
  assert.equal(plan.approvalRequired, true);
  assert.ok(plan.reasons.includes("valid_approval_permit"));
  assert.ok(plan.reasons.includes(`permit:${permit.permitId}`));
});

test("tool invocation planner waits for approval when capability is missing", () => {
  const plan = planToolInvocation(createInput({
    policyDecision: createWorkspaceWritePolicyDecision(),
    toolManifest: builtinApplyPatchToolManifest,
    proposedInput: {
      patch: "*** Begin Patch\n*** End Patch\n"
    },
    capabilityGrants: []
  }));

  assert.equal(plan.status, "waiting_approval");
  assert.equal(plan.approvalRequired, true);
  assert.ok(plan.reasons.includes("missing_capability"));
  assert.ok(plan.reasons.some((reason) => reason.includes("missing_capability:fs.write:/repo/**")));
});

test("tool invocation planner waits for approval when capability clock is invalid", () => {
  const plan = planToolInvocation(createInput({
    policyDecision: createWorkspaceWritePolicyDecision(),
    toolManifest: builtinApplyPatchToolManifest,
    proposedInput: {
      patch: "*** Begin Patch\n*** End Patch\n"
    },
    capabilityGrants: [{
      scope: "fs.write:/repo/**",
      expiresAt: "2026-06-04T01:00:00.000Z"
    }],
    now: "not-a-timestamp"
  }));

  assert.equal(plan.status, "waiting_approval");
  assert.equal(plan.approvalRequired, true);
  assert.ok(plan.reasons.includes("invalid_capability_check_now:not-a-timestamp"));
});

test("tool invocation planner blocks explicit deny capabilities", () => {
  const plan = planToolInvocation(createInput({
    policyDecision: createWorkspaceWritePolicyDecision(),
    toolManifest: builtinApplyPatchToolManifest,
    proposedInput: {
      patch: "*** Begin Patch\n*** End Patch\n"
    },
    capabilityGrants: [
      "fs.write:/repo/**",
      "fs.write:deny"
    ]
  }));

  assert.equal(plan.status, "blocked");
  assert.equal(plan.approvalRequired, true);
  assert.ok(plan.reasons.includes("capability_deny"));
  assert.ok(plan.reasons.includes("matched_deny_scope"));
});

test("tool invocation planner requires approval for dangerous side effects", () => {
  const plan = planToolInvocation(createInput({
    policyDecision: createWorkspaceWritePolicyDecision(),
    toolManifest: builtinApplyPatchToolManifest,
    proposedInput: {
      patch: "*** Begin Patch\n*** End Patch\n"
    },
    capabilityGrants: ["fs.write:/repo/**"]
  }));

  assert.equal(plan.status, "waiting_approval");
  assert.equal(plan.approvalRequired, true);
  assert.equal(plan.sandboxProfile.mode, "workspace-write");
  assert.ok(plan.reasons.includes("approval_required"));
});

test("tool invocation planner plans dangerous tools with a valid approval permit", () => {
  const policyDecision = createWorkspaceWritePolicyDecision();
  const permit = createPermit(policyDecision, {
    capabilityScopes: ["fs.write:/repo/**"]
  });
  const plan = planToolInvocation(createInput({
    policyDecision,
    toolManifest: builtinApplyPatchToolManifest,
    proposedInput: {
      patch: "*** Begin Patch\n*** End Patch\n"
    },
    capabilityGrants: ["fs.write:/repo/**"],
    approvalPermits: [permit]
  }));

  assert.equal(plan.status, "planned");
  assert.equal(plan.approvalRequired, true);
  assert.ok(plan.reasons.includes("valid_approval_permit"));
  assert.ok(plan.reasons.includes(`permit:${permit.permitId}`));
});

test("tool invocation planner blocks tool sandboxes that exceed policy", () => {
  const policyDecision = createPolicyDecision();
  const permit = createPermit(policyDecision, {
    capabilityScopes: ["fs.write:/repo/**"]
  });
  const plan = planToolInvocation(createInput({
    policyDecision,
    toolManifest: builtinApplyPatchToolManifest,
    proposedInput: {
      patch: "*** Begin Patch\n*** End Patch\n"
    },
    capabilityGrants: ["fs.write:/repo/**"],
    approvalPermits: [permit]
  }));

  assert.equal(plan.status, "blocked");
  assert.equal(plan.approvalRequired, true);
  assert.equal(plan.sandboxProfile.mode, "workspace-write");
  assert.deepEqual(plan.reasons, [
    "tool_invocation_sandbox_exceeds_policy:mode:sandbox_tool_local_write:sandbox_readonly_001"
  ]);
});

test("tool invocation planner blocks mismatched kernel objects before planning", () => {
  const run = RunSchema.parse({
    ...createRun(),
    policyDecisionId: "decision_stale_policy"
  });
  const step = StepSchema.parse({
    ...validStep,
    stepId: "step_tool_invocation_planner_001",
    runId: "run_other",
    taskId: "task_other",
    kind: "tool"
  });
  const policyDecision = createPolicyDecision({
    decisionId: "decision_current_policy",
    taskId: "task_policy_other"
  });
  const plan = planToolInvocation(createInput({
    run,
    step,
    policyDecision,
    toolManifest: builtinReadFileToolManifest,
    capabilityGrants: ["fs.read:/repo/**"]
  }));

  assert.equal(plan.status, "blocked");
  assert.deepEqual(plan.reasons, [
    "tool_invocation_step_run_mismatch:run_other:run_tool_invocation_planner_001",
    "tool_invocation_step_task_mismatch:task_other:task_tool_invocation_planner_001",
    "tool_invocation_policy_task_mismatch:task_policy_other:task_tool_invocation_planner_001",
    "tool_invocation_run_policy_decision_mismatch:decision_stale_policy:decision_current_policy"
  ]);
});

test("tool invocation planner blocks terminal runs and steps before planning", () => {
  for (const status of ["succeeded", "failed", "cancelled"] as const) {
    const run = RunSchema.parse({
      ...createRun(),
      status,
      completedAt: "2026-06-04T00:05:00.000Z"
    });
    const plan = planToolInvocation(createInput({
      run,
      step: createStep(run),
      toolManifest: builtinReadFileToolManifest,
      capabilityGrants: ["fs.read:/repo/**"]
    }));

    assert.equal(plan.status, "blocked");
    assert.deepEqual(plan.reasons, [`tool_invocation_run_terminal:${status}`]);
  }

  for (const status of ["succeeded", "failed", "skipped", "cancelled"] as const) {
    const run = createRun();
    const step = StepSchema.parse({
      ...createStep(run),
      status
    });
    const plan = planToolInvocation(createInput({
      run,
      step,
      toolManifest: builtinReadFileToolManifest,
      capabilityGrants: ["fs.read:/repo/**"]
    }));

    assert.equal(plan.status, "blocked");
    assert.deepEqual(plan.reasons, [`tool_invocation_step_terminal:${status}`]);
  }
});

test("tool invocation planner uses a stable input hash without storing raw input", () => {
  const first = planToolInvocation(createInput({
    toolManifest: builtinReadFileToolManifest,
    proposedInput: {
      path: "/repo/README.md",
      options: {
        encoding: "utf8",
        preview: true
      }
    },
    capabilityGrants: ["fs.read:/repo/**"]
  }));
  const second = planToolInvocation(createInput({
    toolManifest: builtinReadFileToolManifest,
    proposedInput: {
      options: {
        preview: true,
        encoding: "utf8"
      },
      path: "/repo/README.md"
    },
    capabilityGrants: ["fs.read:/repo/**"]
  }));

  assert.equal(first.inputHash, second.inputHash);
  assert.equal(first.inputHash, hashToolInvocationInput({
    path: "/repo/README.md",
    options: {
      encoding: "utf8",
      preview: true
    }
  }));
});

test("tool invocation planner hashes undefined proposed input deterministically", () => {
  const directHash = hashToolInvocationInput(undefined);
  const roundTrippedHash = hashToolInvocationInput(JSON.parse(JSON.stringify({
    omitted: undefined
  })));
  const plan = planToolInvocation(createInput({
    toolManifest: noInputToolManifest,
    proposedInput: undefined
  }));

  assert.match(directHash, /^[a-f0-9]{64}$/);
  assert.equal(hashToolInvocationInput({ omitted: undefined }), roundTrippedHash);
  assert.equal(plan.status, "planned");
  assert.equal(plan.inputHash, directHash);
  assert.equal(plan.inputPreview, undefined);
});

test("tool invocation planner redacts proposed input preview", () => {
  const plan = planToolInvocation(createInput({
    toolManifest: mcpGithubCreatePullRequestToolManifest,
    proposedInput: {
      title: "Open PR",
      head: "feature/test",
      base: "main",
      command: "gh pr create --token --github-token fixture-command-token --safe visible",
      args: ["--password", "-fixture-argv-password", "--safe", "visible"],
      token: "fixture-token-value",
      nested: {
        authorization: "fixture-authorization-value"
      }
    },
    capabilityGrants: ["mcp.call:github.create_pull_request"],
    approvalPermits: [
      createPermit(createPolicyDecision(), {
        capabilityScopes: ["mcp.call:github.create_pull_request"]
      })
    ]
  }));

  assert.deepEqual(plan.inputPreview, {
    title: "Open PR",
    head: "feature/test",
    base: "main",
    command: "gh pr create --token --github-token <REDACTED_SECRET> --safe visible",
    args: ["--password", "<REDACTED_SECRET>", "--safe", "visible"],
    token: "<REDACTED_SECRET>",
    nested: {
      authorization: "<REDACTED_SECRET>"
    }
  });
  assert.equal(JSON.stringify(plan).includes("fixture-token-value"), false);
  assert.equal(JSON.stringify(plan).includes("fixture-authorization-value"), false);
  assert.equal(JSON.stringify(plan).includes("fixture-command-token"), false);
  assert.equal(JSON.stringify(plan).includes("fixture-argv-password"), false);
  assert.equal(JSON.stringify(plan).includes("-fixture-argv-password"), false);

  assert.deepEqual(
    redactToolInvocationInput({
      apiKey: "fixture-api-key-value"
    }),
    {
      apiKey: "<REDACTED_SECRET>"
    }
  );
  const customKeyPreview = redactToolInvocationInput({
    command: "tool --session fixture\\ session\\ value",
    args: ["--session", "--password", "fixture-session-argv-value"]
  }, ["session"]);
  assert.deepEqual(customKeyPreview, {
    command: "tool --session <REDACTED_SECRET>",
    args: ["--session", "--password", "<REDACTED_SECRET>"]
  });
  assert.equal(JSON.stringify(customKeyPreview).includes("fixture"), false);
  assert.equal(JSON.stringify(customKeyPreview).includes("session\\ value"), false);
  assert.equal(JSON.stringify(customKeyPreview).includes("fixture-session-argv-value"), false);
});

function createInput(overrides: Partial<{
  run: Run;
  step: Step;
  toolManifest: Parameters<typeof planToolInvocation>[0]["toolManifest"];
  proposedInput: unknown;
  capabilityGrants: Parameters<typeof planToolInvocation>[0]["capabilityGrants"];
  approvalPermits: ApprovalPermit[];
  policyDecision: PolicyDecision;
  now: string;
}> = {}): Parameters<typeof planToolInvocation>[0] {
  const run = overrides.run ?? createRun();
  const step = overrides.step ?? createStep(run);

  return {
    run,
    step,
    toolManifest: overrides.toolManifest ?? builtinReadFileToolManifest,
    proposedInput: "proposedInput" in overrides
      ? overrides.proposedInput
      : { path: "/repo/README.md" },
    principal: validPrincipal,
    capabilityGrants: overrides.capabilityGrants ?? [],
    approvalPermits: overrides.approvalPermits ?? [],
    policyDecision: overrides.policyDecision ?? createPolicyDecision(),
    planHash,
    now: overrides.now ?? now
  };
}

function createRun(): Run {
  return RunSchema.parse({
    ...validRun,
    runId: "run_tool_invocation_planner_001",
    taskId: "task_tool_invocation_planner_001"
  });
}

function createStep(run: Run): Step {
  return StepSchema.parse({
    ...validStep,
    stepId: "step_tool_invocation_planner_001",
    runId: run.runId,
    taskId: run.taskId,
    kind: "tool"
  });
}

function createPolicyDecision(overrides: Partial<PolicyDecision> = {}): PolicyDecision {
  return PolicyDecisionSchema.parse({
    ...validPolicyDecision,
    taskId: "task_tool_invocation_planner_001",
    capabilities: [],
    approval: {
      required: false,
      reasons: []
    },
    risk: {
      level: "low",
      factors: [],
      ambiguityScore: 0,
      clarificationRequired: false
    },
    ...overrides
  });
}

function createWorkspaceWritePolicyDecision(): PolicyDecision {
  return createPolicyDecision({
    execution: {
      ...validPolicyDecision.execution,
      sandbox: {
        schemaVersion: "sandbox-profile.v1",
        sandboxId: "sandbox_tool_invocation_workspace_write_001",
        mode: "workspace-write",
        networkAccess: "none",
        writableRoots: ["workspace"],
        envPolicy: {
          inheritProcessEnv: false,
          allowlist: []
        }
      }
    }
  });
}

const noInputToolManifest = {
  schemaVersion: "tool-registry-manifest.v1",
  toolId: "builtin.no_input",
  provider: "builtin",
  inputSchema: {
    type: "object",
    properties: {}
  },
  outputSchema: {
    type: "object",
    properties: {}
  },
  sideEffectClass: "none",
  requiredCapabilities: [],
  defaultTimeoutMs: 1_000,
  auditPolicy: {
    recordInvocation: true,
    recordInput: false,
    recordOutput: false,
    retention: "run"
  },
  redactionPolicy: {
    redactInput: true,
    redactOutput: true,
    secretKeys: []
  },
  metadata: {
    fixture: true
  }
} satisfies ToolManifestInput;

function createPermit(
  policyDecision: PolicyDecision,
  overrides: Partial<{
    capabilityScopes: string[];
    expiresAt: string;
  }> = {}
): ApprovalPermit {
  return createApprovalPermit({
    permitId: "permit_tool_invocation_planner_001",
    taskId: "task_tool_invocation_planner_001",
    runId: "run_tool_invocation_planner_001",
    principalId: validPrincipal.principalId,
    approverId: "principal_approver_001",
    policyDecisionHash: hashApprovalScope(policyDecision),
    planHash,
    capabilityScopes: overrides.capabilityScopes ?? ["fs.write:/repo/**"],
    createdAt: "2026-06-04T00:00:00.000Z",
    expiresAt: overrides.expiresAt ?? "2026-06-04T01:00:00.000Z"
  });
}
