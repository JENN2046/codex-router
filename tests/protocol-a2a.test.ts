import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import {
  A2AEndpointReferenceSchema,
  A2AAgentCardSkeletonSchema,
  a2aStatusToRunStatus,
  agentManifestToA2AAgentCard,
  artifactToA2AArtifactSkeleton,
  assertA2AAnonymousInvocationRejected,
  assertA2ARemoteInvocationAuthorized,
  createA2ARemoteAgentProviderSkeleton,
  runStatusToA2AStatus,
  taskToA2ATaskSkeleton,
  type A2AStatus
} from "../packages/protocol-a2a/src/index.js";
import {
  ArtifactSchema,
  RunSchema,
  TaskSchema,
  type RunStatus
} from "../packages/kernel-contracts/src/index.js";
import { validAgentManifest } from "../packages/kernel-contracts/test-fixtures/valid-agent-manifest.js";
import { validArtifact } from "../packages/kernel-contracts/test-fixtures/valid-artifact.js";
import { validRun } from "../packages/kernel-contracts/test-fixtures/valid-run.js";
import { validTask } from "../packages/kernel-contracts/test-fixtures/valid-task.js";

const now = "2026-06-04T01:00:00.000Z";

test("protocol-a2a maps AgentManifest to AgentCard skeleton", () => {
  const card = agentManifestToA2AAgentCard(validAgentManifest);
  const parsed = A2AAgentCardSkeletonSchema.parse(card);

  assert.equal(parsed.agentId, validAgentManifest.agentId);
  assert.equal(parsed.name, validAgentManifest.name);
  assert.equal(parsed.version, validAgentManifest.version);
  assert.equal(parsed.description, validAgentManifest.description);
  assert.ok(parsed.capabilities.includes("tool:execute:apply_patch"));
  assert.equal(parsed.skills.length, 1);
  assert.deepEqual(parsed.skills[0]?.requiredCapabilities, [
    "tool:execute:apply_patch"
  ]);
  assert.deepEqual(parsed.endpoints, []);
  assert.equal(parsed.authSchemes[0]?.type, "signed_request");
  assert.equal(parsed.metadata.allowAnonymousRemoteInvocation, false);
  assert.deepEqual(readA2AMetadata(parsed).endpointPolicy, "metadata_refs_only");
  assert.equal(readA2AMetadata(parsed).networkRuntimeImplemented, false);
});

test("protocol-a2a maps Task and Run to A2ATask skeleton", () => {
  const task = TaskSchema.parse({
    ...validTask,
    taskId: "task_protocol_a2a_001",
    requestedAction: "Map a local kernel task into an A2A task skeleton.",
    createdAt: now
  });
  const run = RunSchema.parse({
    ...validRun,
    runId: "run_protocol_a2a_001",
    taskId: task.taskId,
    status: "blocked",
    createdAt: now,
    updatedAt: now
  });
  const a2aTask = taskToA2ATaskSkeleton(task, run);

  assert.equal(a2aTask.remoteTaskId, "a2a.task.task_protocol_a2a_001");
  assert.equal(a2aTask.localRunId, run.runId);
  assert.equal(a2aTask.status, "waiting_approval");
  assert.equal(a2aTask.createdAt, run.createdAt);
  assert.equal(a2aTask.updatedAt, run.updatedAt);
  assert.equal(a2aTask.messages[0]?.role, "user");
  assert.equal(a2aTask.messages[0]?.parts[0]?.text, task.requestedAction);
  assert.deepEqual(a2aTask.artifacts, []);
  assert.equal(a2aTask.metadata.remoteExecutionStarted, false);
  assert.throws(
    () => taskToA2ATaskSkeleton(task, {
      ...run,
      taskId: "task_other"
    }),
    /a2a_task_run_mismatch:task_protocol_a2a_001:task_other/
  );
});

test("protocol-a2a maps Artifact to A2A artifact skeleton", () => {
  const artifact = ArtifactSchema.parse({
    ...validArtifact,
    artifactId: "artifact_protocol_a2a_001",
    taskId: "task_protocol_a2a_001",
    runId: "run_protocol_a2a_001",
    uri: "artifact-store:task_protocol_a2a_001/evidence.log",
    createdAt: now
  });
  const a2aArtifact = artifactToA2AArtifactSkeleton(artifact);

  assert.equal(a2aArtifact.artifactId, artifact.artifactId);
  assert.equal(a2aArtifact.taskId, artifact.taskId);
  assert.equal(a2aArtifact.runId, artifact.runId);
  assert.equal(a2aArtifact.kind, artifact.kind);
  assert.equal(a2aArtifact.uri, artifact.uri);
  assert.equal(a2aArtifact.sha256, artifact.sha256);
  assert.equal(a2aArtifact.sizeBytes, artifact.sizeBytes);
  assert.equal(readA2AMetadata(a2aArtifact).uriIsReference, true);
  assert.equal(readA2AMetadata(a2aArtifact).fetchedBySkeleton, false);
});

test("protocol-a2a maps statuses in both directions", () => {
  const pairs: Array<[RunStatus, A2AStatus]> = [
    ["queued", "queued"],
    ["running", "running"],
    ["blocked", "waiting_approval"],
    ["succeeded", "succeeded"],
    ["failed", "failed"],
    ["cancelled", "cancelled"]
  ];

  for (const [runStatus, a2aStatus] of pairs) {
    assert.equal(runStatusToA2AStatus(runStatus), a2aStatus);
    assert.equal(a2aStatusToRunStatus(a2aStatus), runStatus);
  }
});

test("protocol-a2a rejects anonymous remote invocation by helper", () => {
  const card = agentManifestToA2AAgentCard(validAgentManifest);

  assert.doesNotThrow(() => assertA2AAnonymousInvocationRejected(card));
  assert.throws(
    () => assertA2ARemoteInvocationAuthorized(card, {
      authSchemeType: "anonymous",
      principalId: "anonymous"
    }),
    /a2a_anonymous_remote_invocation_rejected/
  );
  assert.throws(
    () => assertA2ARemoteInvocationAuthorized(card, {
      authSchemeId: "agent-os-signed-request",
      authSchemeType: "ANONYMOUS" as never,
      principalId: "principal_user_001"
    }),
    /a2a_anonymous_remote_invocation_rejected/
  );
  assert.throws(
    () => assertA2ARemoteInvocationAuthorized(card, {
      authSchemeId: "agent-os-signed-request",
      principalId: " Anonymous "
    }),
    /a2a_anonymous_remote_invocation_rejected/
  );
  assert.doesNotThrow(() => assertA2ARemoteInvocationAuthorized(card, {
    authSchemeId: "agent-os-signed-request"
  }));
  assert.doesNotThrow(() => assertA2ARemoteInvocationAuthorized(card, {
    authSchemeId: "agent-os-signed-request",
    authSchemeType: "signed_request"
  }));
  assert.doesNotThrow(() => assertA2ARemoteInvocationAuthorized(card, {
    authSchemeType: "signed_request"
  }));
  assert.throws(
    () => assertA2ARemoteInvocationAuthorized(card, {
      authSchemeId: "not-declared",
      authSchemeType: "signed_request"
    }),
    /a2a_auth_scheme_not_declared:not-declared/
  );
  assert.throws(
    () => assertA2ARemoteInvocationAuthorized(card, {
      authSchemeId: "agent-os-signed-request",
      authSchemeType: "bearer_ref"
    }),
    /a2a_auth_scheme_not_declared:agent-os-signed-request/
  );
  assert.throws(
    () => A2AAgentCardSkeletonSchema.parse({
      ...card,
      authSchemes: [
        {
          schemeId: " Anonymous ",
          type: "signed_request",
          required: true
        }
      ]
    }),
    z.ZodError
  );
});

test("protocol-a2a remote provider is disabled by default", async () => {
  const provider = createA2ARemoteAgentProviderSkeleton(validAgentManifest);
  const task = TaskSchema.parse({
    ...validTask,
    taskId: "task_protocol_a2a_remote_provider"
  });
  const run = RunSchema.parse({
    ...validRun,
    runId: "run_protocol_a2a_remote_provider",
    taskId: task.taskId
  });
  const card = await provider.getAgentCard();

  assert.equal(provider.manifest.kind, "remote_agent");
  assert.equal(provider.manifest.enabled, false);
  assert.equal(provider.manifest.securityBoundary.networkAccess, "none");
  assert.equal(card.agentId, validAgentManifest.agentId);
  assert.equal(provider.getRemoteTask("remote_task_missing"), undefined);
  await assert.rejects(
    async () => provider.createRemoteTask({
      task,
      run
    }),
    /a2a_remote_agent_provider_disabled/
  );
  await assert.rejects(
    async () => provider.cancelRemoteTask("remote_task_missing"),
    /a2a_remote_agent_provider_disabled/
  );
});

test("protocol-a2a endpoint refs reject raw URLs", () => {
  assert.throws(
    () => A2AEndpointReferenceSchema.parse({
      endpointId: "task-submit",
      metadataRef: "https://example.test/a2a/tasks",
      transport: "http"
    }),
    z.ZodError
  );

  assert.equal(
    A2AEndpointReferenceSchema.parse({
      endpointId: "task-submit",
      metadataRef: "metadata:a2a.endpoints.task_submit",
      transport: "http"
    }).metadataRef,
    "metadata:a2a.endpoints.task_submit"
  );
});

function readA2AMetadata(input: { metadata: Record<string, unknown> }): Record<string, unknown> {
  const metadata = input.metadata.a2a;
  assert.equal(typeof metadata, "object");
  assert.notEqual(metadata, null);
  return metadata as Record<string, unknown>;
}
