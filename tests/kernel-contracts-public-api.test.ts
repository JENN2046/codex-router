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
  type AgentManifest,
  type ApprovalPermit,
  type Artifact,
  type CapabilityGrant,
  type CapabilityScope,
  type Event,
  type ExecutionLease,
  type PolicyDecision,
  type Principal,
  type Run,
  type SandboxProfile,
  type Step,
  type Task,
  type ToolInvocation,
  type ToolManifest
} from "../packages/kernel-contracts/src/index.js";
import { validAgentManifest } from "../packages/kernel-contracts/test-fixtures/valid-agent-manifest.js";
import { validApprovalPermit } from "../packages/kernel-contracts/test-fixtures/valid-approval-permit.js";
import { validArtifact } from "../packages/kernel-contracts/test-fixtures/valid-artifact.js";
import { validCapabilityGrant } from "../packages/kernel-contracts/test-fixtures/valid-capability-grant.js";
import {
  validCapabilityScope,
  validToolExecuteScope
} from "../packages/kernel-contracts/test-fixtures/valid-capability-scope.js";
import { validEvent } from "../packages/kernel-contracts/test-fixtures/valid-event.js";
import { validExecutionLease } from "../packages/kernel-contracts/test-fixtures/valid-execution-lease.js";
import { validPolicyDecision } from "../packages/kernel-contracts/test-fixtures/valid-policy-decision.js";
import { validPrincipal } from "../packages/kernel-contracts/test-fixtures/valid-principal.js";
import { validRun } from "../packages/kernel-contracts/test-fixtures/valid-run.js";
import { validSandboxProfile } from "../packages/kernel-contracts/test-fixtures/valid-sandbox-profile.js";
import { validStep } from "../packages/kernel-contracts/test-fixtures/valid-step.js";
import { validTask } from "../packages/kernel-contracts/test-fixtures/valid-task.js";
import { validToolInvocation } from "../packages/kernel-contracts/test-fixtures/valid-tool-invocation.js";
import { validToolManifest } from "../packages/kernel-contracts/test-fixtures/valid-tool-manifest.js";

test("kernel-contracts public schemas parse stable valid fixtures", () => {
  const principal = PrincipalSchema.parse(validPrincipal);
  const scope = CapabilityScopeSchema.parse(validCapabilityScope);
  const toolScope = CapabilityScopeSchema.parse(validToolExecuteScope);
  const sandbox = SandboxProfileSchema.parse(validSandboxProfile);
  const agent = AgentManifestSchema.parse(validAgentManifest);
  const task = TaskSchema.parse(validTask);
  const run = RunSchema.parse(validRun);
  const step = StepSchema.parse(validStep);
  const decision = PolicyDecisionSchema.parse(validPolicyDecision);
  const grant = CapabilityGrantSchema.parse(validCapabilityGrant);
  const permit = ApprovalPermitSchema.parse(validApprovalPermit);
  const tool = ToolManifestSchema.parse(validToolManifest);
  const invocation = ToolInvocationSchema.parse(validToolInvocation);
  const artifact = ArtifactSchema.parse(validArtifact);
  const event = EventSchema.parse(validEvent);
  const lease = ExecutionLeaseSchema.parse(validExecutionLease);

  assert.equal(principal.principalId, "principal_user_001");
  assert.equal(scope.schemaVersion, "capability-scope.v1");
  assert.equal(toolScope.access, "execute");
  assert.equal(sandbox.sandboxId, "sandbox_readonly_001");
  assert.equal(agent.agentId, "agent_coding_worker_001");
  assert.equal(task.taskId, "task_phase_1_fixture_001");
  assert.equal(run.runId, "run_phase_1_fixture_001");
  assert.equal(step.stepId, "step_phase_1_fixture_001");
  assert.equal(decision.decisionId, "decision_phase_1_fixture_001");
  assert.equal(grant.grantId, "grant_phase_1_fixture_001");
  assert.equal(permit.permitId, "permit_phase_1_fixture_001");
  assert.equal(tool.toolId, "tool_apply_patch_001");
  assert.equal(invocation.invocationId, "invocation_phase_1_fixture_001");
  assert.equal(artifact.artifactId, "artifact_phase_1_fixture_001");
  assert.equal(event.eventId, "event_phase_1_fixture_001");
  assert.equal(lease.leaseId, "lease_phase_1_fixture_001");
});

test("kernel-contracts public types can be referenced by TypeScript", () => {
  const typedObjects: {
    principal: Principal;
    agent: AgentManifest;
    task: Task;
    run: Run;
    step: Step;
    decision: PolicyDecision;
    scope: CapabilityScope;
    grant: CapabilityGrant;
    permit: ApprovalPermit;
    tool: ToolManifest;
    invocation: ToolInvocation;
    artifact: Artifact;
    event: Event;
    sandbox: SandboxProfile;
    lease: ExecutionLease;
  } = {
    principal: validPrincipal,
    agent: validAgentManifest,
    task: validTask,
    run: validRun,
    step: validStep,
    decision: validPolicyDecision,
    scope: validCapabilityScope,
    grant: validCapabilityGrant,
    permit: validApprovalPermit,
    tool: validToolManifest,
    invocation: validToolInvocation,
    artifact: validArtifact,
    event: validEvent,
    sandbox: validSandboxProfile,
    lease: validExecutionLease
  };

  assert.equal(typedObjects.principal.principalId, "principal_user_001");
  assert.equal(typedObjects.agent.principal.principalId, "principal_user_001");
  assert.equal(typedObjects.decision.execution.sandbox.mode, "read-only");
  assert.equal(typedObjects.lease.workerId, "worker_phase_1_fixture_001");
});

test("kernel-contracts public schemas reject invalid ids, statuses, and capability scopes", () => {
  assert.throws(() => PrincipalSchema.parse({
    ...validPrincipal,
    principalId: ""
  }));

  assert.throws(() => RunSchema.parse({
    ...validRun,
    status: "waiting"
  }));

  assert.throws(() => CapabilityScopeSchema.parse({
    ...validCapabilityScope,
    kind: "secret",
    access: "write"
  }));
});
