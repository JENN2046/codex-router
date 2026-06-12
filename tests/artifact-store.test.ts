import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  FileSystemArtifactStore,
  InMemoryArtifactStore,
  hashArtifactPayload,
  redactArtifactMetadata,
  type ArtifactStore,
  type PutArtifactInput
} from "../packages/artifact-store/src/index.js";

test("artifact store puts and gets artifacts in memory", async () => {
  const store = new InMemoryArtifactStore({
    now: () => "2026-06-04T00:00:00.000Z"
  });

  const artifact = await store.putArtifact({
    artifactId: "artifact_memory_001",
    taskId: "task_artifact_store_001",
    runId: "run_artifact_store_001",
    type: "text",
    payload: "hello artifact",
    metadata: {
      title: "sample",
      token: "fixture-token-value"
    },
    provenance: {
      principalId: "principal_user_001",
      toolId: "tool_fixture_001"
    }
  });

  assert.equal(artifact.sha256, hashArtifactPayload("hello artifact", "text"));
  assert.equal(artifact.metadata.token, "<REDACTED_SECRET>");
  assert.equal(artifact.provenance.principalId, "principal_user_001");
  assert.deepEqual(await store.getArtifact("artifact_memory_001"), artifact);

  const verification = await store.verifyArtifact("artifact_memory_001");
  assert.equal(verification.ok, true);
  assert.equal(verification.actualSha256, artifact.sha256);
});

test("artifact store puts and gets artifacts on filesystem", async () => {
  await withTempArtifactStore(async ({ store, baseDir }) => {
    const artifact = await store.putArtifact({
      artifactId: "artifact_fs_001",
      taskId: "task_artifact_store_001",
      runId: "run_artifact_store_001",
      type: "json",
      payload: {
        ok: true
      },
      metadata: {
        apiKey: "fixture-api-key-value",
        safe: "visible"
      },
      alreadyRedacted: true
    });

    assert.equal(artifact.metadata.apiKey, "<REDACTED_SECRET>");
    assert.equal(artifact.alreadyRedacted, true);
    assert.deepEqual(await store.getArtifact("artifact_fs_001"), artifact);

    const rawMetadata = await readFile(
      join(baseDir, "artifact_fs_001", "metadata.json"),
      "utf8"
    );
    const rawPayload = await readFile(join(baseDir, "artifact_fs_001", "payload"), "utf8");

    assert.equal(rawMetadata.includes("fixture-api-key-value"), false);
    assert.equal(rawPayload.includes("\"ok\": true"), true);
  });
});

test("artifact store verifies filesystem sha256 and reports mismatch", async () => {
  await withTempArtifactStore(async ({ store, baseDir }) => {
    const artifact = await store.putArtifact({
      artifactId: "artifact_verify_001",
      taskId: "task_artifact_store_001",
      type: "report",
      payload: "stable report"
    });

    assert.equal((await store.verifyArtifact(artifact.artifactId)).ok, true);

    await writeFile(join(baseDir, artifact.artifactId, "payload"), "tampered", "utf8");
    const verification = await store.verifyArtifact(artifact.artifactId);

    assert.equal(verification.ok, false);
    assert.equal(verification.reason, "sha256_mismatch");
    assert.notEqual(verification.actualSha256, verification.expectedSha256);
  });
});

test("artifact store verification reports missing filesystem payloads", async () => {
  await withTempArtifactStore(async ({ store, baseDir }) => {
    const artifact = await store.putArtifact({
      artifactId: "artifact_missing_payload_001",
      taskId: "task_artifact_store_001",
      type: "report",
      payload: "payload that will be removed"
    });

    await rm(join(baseDir, artifact.artifactId, "payload"));
    const verification = await store.verifyArtifact(artifact.artifactId);

    assert.equal(verification.ok, false);
    assert.equal(verification.artifactId, artifact.artifactId);
    assert.equal(verification.expectedSha256, artifact.sha256);
    assert.equal(verification.actualSha256, undefined);
    assert.equal(verification.reason, "artifact_payload_not_found");
  });
});

test("artifact store rejects path traversal artifact ids", async () => {
  await withTempArtifactStore(async ({ store }) => {
    await assert.rejects(
      () => store.putArtifact({
        artifactId: "../outside",
        taskId: "task_artifact_store_001",
        type: "text",
        payload: "outside"
      }),
      /unsafe_artifact_id/
    );

    await assert.rejects(
      () => store.putArtifact({
        artifactId: "nested/artifact",
        taskId: "task_artifact_store_001",
        type: "text",
        payload: "nested"
      }),
      /unsafe_artifact_id/
    );
  });
});

test("artifact store accepts duplicate artifacts with the same hash", async () => {
  await assertDuplicateSameHashAccepted(new InMemoryArtifactStore({
    now: () => "2026-06-04T00:00:00.000Z"
  }));

  await withTempArtifactStore(async ({ store }) => {
    await assertDuplicateSameHashAccepted(store);
  });
});

test("artifact store rejects duplicate artifacts with a different hash", async () => {
  await assertDuplicateDifferentHashRejected(new InMemoryArtifactStore({
    now: () => "2026-06-04T00:00:00.000Z"
  }));

  await withTempArtifactStore(async ({ store }) => {
    await assertDuplicateDifferentHashRejected(store);
  });
});

test("artifact store lists artifacts by runId, taskId, and type", async () => {
  await withTempArtifactStore(async ({ store }) => {
    await store.putArtifact(createArtifactInput({
      artifactId: "artifact_list_001",
      taskId: "task_artifact_store_001",
      runId: "run_artifact_store_001",
      type: "text"
    }));
    await store.putArtifact(createArtifactInput({
      artifactId: "artifact_list_002",
      taskId: "task_artifact_store_001",
      runId: "run_artifact_store_002",
      type: "patch"
    }));
    await store.putArtifact(createArtifactInput({
      artifactId: "artifact_list_003",
      taskId: "task_artifact_store_002",
      runId: "run_artifact_store_002",
      type: "report"
    }));

    assert.deepEqual(
      (await store.listArtifacts({ taskId: "task_artifact_store_001" }))
        .map((artifact) => artifact.artifactId),
      ["artifact_list_001", "artifact_list_002"]
    );
    assert.deepEqual(
      (await store.listArtifacts({ runId: "run_artifact_store_002" }))
        .map((artifact) => artifact.artifactId),
      ["artifact_list_002", "artifact_list_003"]
    );
    assert.deepEqual(
      (await store.listArtifacts({ type: "patch" }))
        .map((artifact) => artifact.artifactId),
      ["artifact_list_002"]
    );
  });
});

test("artifact metadata redaction removes nested secret-like fields", () => {
  assert.deepEqual(
    redactArtifactMetadata({
      nested: {
        password: "fixture-password-value",
        safe: "visible"
      },
      command: "tool --token --github-token fixture-command-token --safe visible",
      args: ["--secret", "-fixture-argv-secret", "--safe", "visible"],
      list: [
        {
          authorization: "fixture-authorization-value"
        }
      ]
    }),
    {
      nested: {
        password: "<REDACTED_SECRET>",
        safe: "visible"
      },
      command: "tool --token --github-token <REDACTED_SECRET> --safe visible",
      args: ["--secret", "<REDACTED_SECRET>", "--safe", "visible"],
      list: [
        {
          authorization: "<REDACTED_SECRET>"
        }
      ]
    }
  );
});

async function assertDuplicateSameHashAccepted(store: ArtifactStore): Promise<void> {
  const input = createArtifactInput({
    artifactId: "artifact_duplicate_same_001",
    payload: "same payload"
  });

  const first = await store.putArtifact(input);
  const second = await store.putArtifact(input);

  assert.deepEqual(second, first);
}

async function assertDuplicateDifferentHashRejected(store: ArtifactStore): Promise<void> {
  const input = createArtifactInput({
    artifactId: "artifact_duplicate_different_001",
    payload: "first payload"
  });

  await store.putArtifact(input);
  await assert.rejects(
    () => store.putArtifact({
      ...input,
      payload: "second payload"
    }),
    /artifact_hash_mismatch/
  );
}

async function withTempArtifactStore(
  callback: (input: {
    store: FileSystemArtifactStore;
    baseDir: string;
  }) => Promise<void>
): Promise<void> {
  const baseDir = await mkdtemp(join(tmpdir(), "codex-router-artifact-store-"));
  try {
    await callback({
      store: new FileSystemArtifactStore({
        baseDir,
        now: () => "2026-06-04T00:00:00.000Z"
      }),
      baseDir
    });
  } finally {
    await rm(baseDir, { recursive: true, force: true });
  }
}

function createArtifactInput(overrides: Partial<PutArtifactInput> = {}): PutArtifactInput {
  return {
    artifactId: "artifact_fixture_001",
    taskId: "task_artifact_store_001",
    runId: "run_artifact_store_001",
    type: "text",
    payload: "fixture payload",
    createdAt: "2026-06-04T00:00:00.000Z",
    provenance: {
      principalId: "principal_user_001",
      agentId: "agent_coding_worker_001"
    },
    ...overrides
  };
}
