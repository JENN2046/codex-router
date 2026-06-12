import test from "node:test";
import assert from "node:assert/strict";
import {
  AgentManifestSchema,
  ApprovalPermitSchema,
  ArtifactSchema,
  CapabilityGrantSchema,
  CapabilityScopeSchema,
  EventSchema,
  ExecutionLeaseSchema,
  PolicyDecisionSchema,
  PrincipalSchema,
  RunSchema,
  SandboxProfileSchema,
  StepSchema,
  TaskSchema,
  ToolInvocationSchema,
  ToolManifestSchema,
  hashKernelObject,
  parseCapabilityScope,
  parsePolicyDecision,
  parsePrincipal,
  parseTask
} from "../packages/kernel-contracts/src/index.js";

const now = "2026-06-04T00:00:00.000Z";

test("kernel contracts parse core principal and task payloads", () => {
  const principal = parsePrincipal({
    principalId: "user-1",
    kind: "user",
    displayName: "Operator",
    workspaceId: "workspace-1",
    createdAt: now
  });

  const task = parseTask({
    taskId: "task-1",
    title: "Inspect repository",
    requestedAction: "Review the current workspace",
    createdBy: principal,
    repo: { root: "A:/codex-router", branch: "main" },
    hints: {
      taskClass: "read_only",
      riskHints: ["low-risk"],
      tags: ["contract"],
      provenance: [{
        field: "taskClass",
        value: "read_only",
        source: "user",
        reason: "explicit operator hint",
        createdAt: now
      }]
    },
    createdAt: now
  });

  assert.equal(principal.schemaVersion, "principal.v1");
  assert.equal(task.schemaVersion, "kernel-task.v1");
  assert.equal(task.source, "desktop-thread");
  assert.deepEqual(task.successCriteria, []);
  assert.deepEqual(task.target.files, []);
  assert.equal(task.createdBy?.principalId, "user-1");
  assert.equal(task.hints.taskClass, "read_only");
  assert.deepEqual(task.hints.provenance, [{
    field: "taskClass",
    value: "read_only",
    source: "user",
    reason: "explicit operator hint",
    createdAt: now
  }]);
});

test("kernel contracts reject invalid core payloads", () => {
  assert.throws(
    () => parsePrincipal({
      principalId: "",
      kind: "user",
      createdAt: now
    }),
    /String must contain at least 1/
  );

  assert.throws(
    () => parseTask({
      taskId: "task-1",
      title: "",
      requestedAction: "Do work",
      createdAt: now
    }),
    /String must contain at least 1/
  );
});

test("capability scope validation blocks unsafe or malformed scopes", () => {
  const fileScope = parseCapabilityScope({
    kind: "file",
    resource: "workspace/src/**",
    access: "read"
  });

  assert.equal(fileScope.schemaVersion, "capability-scope.v1");
  assert.deepEqual(fileScope.constraints, {});

  assert.throws(
    () => parseCapabilityScope({
      kind: "secret",
      resource: "OPENAI_API_KEY",
      access: "write"
    }),
    /secret scopes only support read access/
  );

  assert.throws(
    () => parseCapabilityScope({
      kind: "external",
      resource: "github",
      access: "read"
    }),
    /external scopes must describe side-effectful access/
  );
});

test("sandbox profile defaults deny network and env inheritance", () => {
  const sandbox = SandboxProfileSchema.parse({
    sandboxId: "readonly",
    mode: "read-only"
  });

  assert.equal(sandbox.networkAccess, "none");
  assert.equal(sandbox.envPolicy.inheritProcessEnv, false);
  assert.deepEqual(sandbox.envPolicy.allowlist, []);

  assert.throws(
    () => SandboxProfileSchema.parse({
      sandboxId: "bad-readonly",
      mode: "read-only",
      writableRoots: ["workspace"]
    }),
    /read-only sandbox cannot declare writable roots/
  );
});

test("policy decision defaults parallelism and preserves capability scopes", () => {
  const decision = parsePolicyDecision({
    decisionId: "decision-1",
    taskId: "task-1",
    policyVersion: "test-policy",
    risk: { level: "low" },
    execution: {
      executor: "codex-cli",
      model: "gpt-5.4-mini",
      sandbox: {
        sandboxId: "readonly",
        mode: "read-only"
      }
    },
    capabilities: [
      {
        kind: "file",
        resource: "workspace/**",
        access: "read"
      }
    ],
    approval: { required: false },
    createdAt: now
  });

  assert.equal(decision.parallelism.allowed, false);
  assert.equal(decision.parallelism.maxAgents, 1);
  assert.equal(decision.capabilities[0]?.resource, "workspace/**");
  assert.deepEqual(decision.approval.reasons, []);
});

test("kernel contracts parse remaining Phase 1 domain models", () => {
  const principal = PrincipalSchema.parse({
    principalId: "agent-principal",
    kind: "agent",
    createdAt: now
  });
  const scope = CapabilityScopeSchema.parse({
    kind: "tool",
    resource: "shell_command",
    access: "execute"
  });

  const agent = AgentManifestSchema.parse({
    agentId: "agent-1",
    name: "Local Worker",
    version: "0.1.0",
    principal,
    capabilities: [scope],
    createdAt: now
  });
  const grant = CapabilityGrantSchema.parse({
    grantId: "grant-1",
    principalId: principal.principalId,
    scopes: [scope],
    issuedAt: now
  });
  const run = RunSchema.parse({
    runId: "run-1",
    taskId: "task-1",
    createdAt: now,
    updatedAt: now
  });
  const step = StepSchema.parse({
    stepId: "step-1",
    runId: run.runId,
    taskId: run.taskId,
    kind: "tool",
    createdAt: now,
    updatedAt: now
  });
  const permit = ApprovalPermitSchema.parse({
    permitId: "permit-1",
    taskId: run.taskId,
    runId: run.runId,
    decisionHash: "decision-hash",
    planHash: "plan-hash",
    approvedBy: principal,
    scopes: [scope],
    issuedAt: now,
    expiresAt: "2026-06-05T00:00:00.000Z"
  });
  const tool = ToolManifestSchema.parse({
    toolId: "shell_command",
    name: "Shell Command",
    version: "1.0.0",
    requiredScopes: [scope],
    sideEffectLevel: "local"
  });
  const invocation = ToolInvocationSchema.parse({
    invocationId: "invoke-1",
    toolId: tool.toolId,
    taskId: run.taskId,
    runId: run.runId,
    stepId: step.stepId,
    principalId: principal.principalId,
    requestedScopes: [scope],
    createdAt: now
  });
  const artifact = ArtifactSchema.parse({
    artifactId: "artifact-1",
    taskId: run.taskId,
    runId: run.runId,
    kind: "evidence",
    uri: "docs/evidence/example.json",
    sha256: "a".repeat(64),
    sizeBytes: 42,
    createdAt: now
  });
  const event = EventSchema.parse({
    eventId: "event-1",
    eventType: "run.started",
    taskId: run.taskId,
    runId: run.runId,
    createdAt: now
  });
  const lease = ExecutionLeaseSchema.parse({
    leaseId: "lease-1",
    runId: run.runId,
    workerId: "worker-1",
    acquiredAt: now,
    expiresAt: "2026-06-04T00:05:00.000Z"
  });

  assert.equal(agent.maxConcurrentRuns, 1);
  assert.equal(grant.revokedAt, undefined);
  assert.equal(run.status, "queued");
  assert.equal(step.status, "pending");
  assert.equal(permit.scopes.length, 1);
  assert.deepEqual(tool.inputSchema, {});
  assert.equal(invocation.principalId, principal.principalId);
  assert.equal(artifact.sizeBytes, 42);
  assert.deepEqual(event.payload, {});
  assert.equal(lease.workerId, "worker-1");
});

test("hashKernelObject returns stable sha256 strings", () => {
  const hash = hashKernelObject({ taskId: "task-1", value: 1 });

  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.equal(hash, hashKernelObject({ taskId: "task-1", value: 1 }));
});

test("hashKernelObject canonicalizes object key order and undefined fields", () => {
  const first = hashKernelObject({
    taskId: "task-1",
    value: 1,
    omitted: undefined,
    nested: {
      z: 2,
      a: 1,
      ignored: undefined
    },
    list: [
      {
        b: 2,
        a: 1,
        ignored: undefined
      }
    ]
  });
  const second = hashKernelObject({
    list: [
      {
        a: 1,
        b: 2
      }
    ],
    nested: {
      a: 1,
      z: 2
    },
    value: 1,
    taskId: "task-1"
  });

  assert.equal(first, second);
  assert.notEqual(first, hashKernelObject({ taskId: "task-1", value: 2 }));
});
