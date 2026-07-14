import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, realpath, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

import {
  APP_SERVER_FILE_CHANGE_INTERCEPTION_PROVEN,
  RecordedAppServerWireBoundary,
  SanitizedWireTranscriptRecorder,
  assertAppServerFileChangeInterceptionProven,
  captureAppServerSmokeWorkspace,
  createIndependentAppServerSmokeClone,
  createAppServerSmokeProcessEnv,
  disconnectAndWaitForAppServerSmokeQuiescence,
  waitForAppServerSmokeQuiescence,
  type WorkspaceSnapshot
} from "../scripts/lib/codex-app-server-live-smoke-safety.js";

const execFileAsync = promisify(execFile);

async function git(cwd: string, args: string[]): Promise<string> {
  return (await execFileAsync("git", args, { cwd, encoding: "utf8" })).stdout;
}

test("sanitized wire transcript preserves order and decline without raw payloads", async () => {
  const root = await mkdtemp(join(tmpdir(), "codex-router-wire-transcript-"));
  try {
    const transcriptPath = join(root, "wire.jsonl");
    const recorder = await SanitizedWireTranscriptRecorder.create(
      transcriptPath,
      () => new Date("2026-07-14T01:00:00.000Z")
    );
    const rawSecret = "sk-secret-must-not-survive";
    const rawPrompt = "replace private customer payload";
    await recorder.record("inbound", {
      id: "approval-request-sensitive-id",
      method: "item/fileChange/requestApproval",
      params: {
        threadId: "thread-private",
        turnId: "turn-private",
        reason: rawPrompt,
        token: rawSecret,
        diff: "+PASSWORD=raw-password"
      }
    });
    await recorder.record("outbound", {
      id: "approval-request-sensitive-id",
      result: { decision: "decline" }
    });
    await recorder.record("inbound", {
      method: "secretMethodPayloadMustNotSurvive",
      params: {}
    });
    await recorder.close();

    const transcript = await readFile(transcriptPath, "utf8");
    for (const forbidden of [
      rawSecret,
      rawPrompt,
      "raw-password",
      "approval-request-sensitive-id",
      "secretMethodPayloadMustNotSurvive"
    ]) {
      assert.equal(transcript.includes(forbidden), false);
    }
    const entries = transcript.trim().split("\n").map((line) => JSON.parse(line) as Record<string, unknown>);
    assert.deepEqual(entries.map((entry) => entry.sequence), [1, 2, 3]);
    assert.equal(entries[0]?.method, "item/fileChange/requestApproval");
    assert.equal(entries[1]?.approvalDecision, "decline");
    assert.equal(entries[2]?.method, undefined);
    assert.equal(typeof entries[2]?.methodHash, "string");
    if (process.platform !== "win32") {
      assert.equal((await stat(transcriptPath)).mode & 0o777, 0o600);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("recorded wire boundary persists before normalizer and transport side effects", async () => {
  const order: string[] = [];
  const boundary = new RecordedAppServerWireBoundary({
    async record(direction, message) {
      order.push(`record:${direction}`);
      return {
        schemaVersion: "codex-app-server-sanitized-wire-entry.v1",
        sequence: order.length,
        observedAt: "2026-07-14T01:00:00.000Z",
        direction,
        envelope: "notification",
        correlationHashes: {},
        payloadShapeHash: "a".repeat(64),
        stringCodeUnits: JSON.stringify(message).length,
        redactedScalarCount: 1
      };
    }
  });
  await boundary.ingest({ method: "turn/started" }, () => order.push("normalize"));
  await boundary.send({ id: 1, result: { decision: "decline" } }, () => order.push("send"));
  assert.deepEqual(order, ["record:inbound", "normalize", "record:outbound", "send"]);
});

test("recorded wire boundary blocks side effects when transcript persistence fails", async () => {
  let called = false;
  const boundary = new RecordedAppServerWireBoundary({
    async record() {
      throw new Error("durable_transcript_failed");
    }
  });
  await assert.rejects(
    boundary.ingest({ method: "turn/started" }, () => { called = true; }),
    /durable_transcript_failed/u
  );
  await assert.rejects(
    boundary.send({ id: 1, result: { decision: "decline" } }, () => { called = true; }),
    /durable_transcript_failed/u
  );
  assert.equal(called, false);
});

test("sanitized wire transcript serializes concurrent records and close", async () => {
  const writes: string[] = [];
  const events: string[] = [];
  let releaseFirstWrite!: () => void;
  const firstWriteBlocked = new Promise<void>((resolve) => { releaseFirstWrite = resolve; });
  let firstWriteStarted!: () => void;
  const firstWriteObserved = new Promise<void>((resolve) => { firstWriteStarted = resolve; });
  const recorder = SanitizedWireTranscriptRecorder.createTestOnly({
    async appendFile(data) {
      const sequence = (JSON.parse(data) as { sequence: number }).sequence;
      events.push(`append:${sequence}:start`);
      if (sequence === 1) {
        firstWriteStarted();
        await firstWriteBlocked;
      }
      writes.push(data);
      events.push(`append:${sequence}:end`);
    },
    async sync() { events.push("sync"); },
    async close() { events.push("close"); }
  }, () => new Date("2026-07-14T01:00:00.000Z"));

  const first = recorder.record("inbound", { method: "turn/started" });
  const second = recorder.record("inbound", { method: "turn/completed" });
  await firstWriteObserved;
  const closing = recorder.close();
  await Promise.resolve();
  assert.deepEqual(events, ["append:1:start"]);
  releaseFirstWrite();
  await Promise.all([first, second, closing]);

  assert.deepEqual(
    writes.map((line) => (JSON.parse(line) as { sequence: number }).sequence),
    [1, 2]
  );
  assert.deepEqual(events, [
    "append:1:start", "append:1:end", "sync",
    "append:2:start", "append:2:end", "sync", "sync", "close"
  ]);
  await assert.rejects(
    recorder.record("inbound", { method: "turn/started" }),
    /wire_transcript_closed/u
  );
});

test("sanitized wire transcript makes persistence failure terminal", async () => {
  let appends = 0;
  const recorder = SanitizedWireTranscriptRecorder.createTestOnly({
    async appendFile() {
      appends += 1;
      throw new Error("disk_failed");
    },
    async sync() {},
    async close() {}
  });
  const first = recorder.record("inbound", { method: "turn/started" });
  const second = recorder.record("inbound", { method: "turn/completed" });
  await assert.rejects(first, /disk_failed/u);
  await assert.rejects(second, /disk_failed/u);
  await assert.rejects(recorder.close(), /disk_failed/u);
  assert.equal(appends, 1);
});

test("sanitized wire transcript treats an undefined thrown value as terminal", async () => {
  let appends = 0;
  const recorder = SanitizedWireTranscriptRecorder.createTestOnly({
    async appendFile() {
      appends += 1;
      throw undefined;
    },
    async sync() {},
    async close() {}
  });
  const first = recorder.record("inbound", { method: "turn/started" });
  const second = recorder.record("inbound", { method: "turn/completed" });
  await assert.rejects(first);
  await assert.rejects(second);
  await assert.rejects(recorder.close());
  assert.equal(appends, 1);
});

test("independent App Server smoke clone has no remote or object alternates", async () => {
  const root = await mkdtemp(join(tmpdir(), "codex-router-live-smoke-clone-"));
  const source = join(root, "source");
  const clone = join(root, "clone");
  try {
    await mkdir(join(source, "docs"), { recursive: true });
    await git(root, ["init", source]);
    await git(source, ["config", "user.name", "codex-router test"]);
    await git(source, ["config", "user.email", "codex-router@example.invalid"]);
    await writeFile(join(source, "docs/guide.md"), "baseline\n", "utf8");
    await git(source, ["add", "docs/guide.md"]);
    await git(source, ["commit", "-m", "fixture"]);
    const head = (await git(source, ["rev-parse", "HEAD"])).trim();
    const result = await createIndependentAppServerSmokeClone({
      sourceRepo: source,
      destinationRepo: clone,
      expectedHead: head,
      targetPaths: ["docs/guide.md"]
    });
    assert.equal(result.head, head);
    assert.equal(result.appServerEnv.GIT_CONFIG_NOSYSTEM, "1");
    assert.equal(
      result.appServerEnv.GIT_CONFIG_GLOBAL,
      process.platform === "win32" ? "NUL" : "/dev/null"
    );
    assert.equal((await git(clone, ["remote"])).trim(), "");
    assert.equal((await git(clone, ["status", "--porcelain=v1"])).trim(), "");
    assert.equal(await readFile(join(clone, "docs/guide.md"), "utf8"), "baseline\n");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("independent smoke clone filters inherited Git config from the App Server environment", async () => {
  const root = await mkdtemp(join(tmpdir(), "codex-router-live-smoke-global-filter-"));
  const source = join(root, "source");
  const clone = join(root, "clone");
  const globalConfig = join(root, "host.gitconfig");
  const inheritedGlobalConfig = process.env.GIT_CONFIG_GLOBAL;
  try {
    await mkdir(join(source, "docs"), { recursive: true });
    await git(root, ["init", source]);
    await git(source, ["config", "user.name", "codex-router test"]);
    await git(source, ["config", "user.email", "codex-router@example.invalid"]);
    await writeFile(join(source, "docs/guide.md"), "baseline\n", "utf8");
    await git(source, ["add", "docs/guide.md"]);
    await git(source, ["commit", "-m", "fixture"]);
    await writeFile(globalConfig, "[filter \"host\"]\n\tsmudge = unsafe-host-command\n", "utf8");
    process.env.GIT_CONFIG_GLOBAL = globalConfig;

    const head = (await git(source, ["rev-parse", "HEAD"])).trim();
    const result = await createIndependentAppServerSmokeClone({
      sourceRepo: source,
      destinationRepo: clone,
      expectedHead: head,
      targetPaths: ["docs/guide.md"]
    });
    assert.deepEqual(result.appServerEnv, createAppServerSmokeProcessEnv(await realpath(root)));
    await assert.rejects(
      execFileAsync("git", ["config", "--get-regexp", "^filter\\."], {
        cwd: clone,
        encoding: "utf8",
        env: result.appServerEnv
      }),
      (error: unknown) => typeof error === "object" && error !== null && "code" in error && error.code === 1
    );
  } finally {
    if (inheritedGlobalConfig === undefined) delete process.env.GIT_CONFIG_GLOBAL;
    else process.env.GIT_CONFIG_GLOBAL = inheritedGlobalConfig;
    await rm(root, { recursive: true, force: true });
  }
});

test("independent smoke clone accepts canonical parent aliases but rejects a symlink source", async (context) => {
  if (process.platform === "win32") {
    context.skip("Windows symlink creation requires host-specific privileges");
    return;
  }
  const root = await mkdtemp(join(tmpdir(), "codex-router-live-smoke-source-link-"));
  const source = join(root, "source");
  const sourceLink = join(root, "source-link");
  try {
    await mkdir(join(source, "docs"), { recursive: true });
    await git(root, ["init", source]);
    await git(source, ["config", "user.name", "codex-router test"]);
    await git(source, ["config", "user.email", "codex-router@example.invalid"]);
    await writeFile(join(source, "docs/guide.md"), "baseline\n", "utf8");
    await git(source, ["add", "docs/guide.md"]);
    await git(source, ["commit", "-m", "fixture"]);
    await symlink(source, sourceLink, "dir");
    const head = (await git(source, ["rev-parse", "HEAD"])).trim();
    await assert.rejects(
      createIndependentAppServerSmokeClone({
        sourceRepo: sourceLink,
        destinationRepo: join(root, "clone"),
        expectedHead: head,
        targetPaths: ["docs/guide.md"]
      }),
      /live_smoke_source_topology_unsafe/u
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("independent smoke clone rejects tracked attributes and configured filters", async () => {
  const root = await mkdtemp(join(tmpdir(), "codex-router-live-smoke-filter-"));
  const source = join(root, "source");
  try {
    await mkdir(join(source, "docs"), { recursive: true });
    await git(root, ["init", source]);
    await git(source, ["config", "user.name", "codex-router test"]);
    await git(source, ["config", "user.email", "codex-router@example.invalid"]);
    await writeFile(join(source, "docs/guide.md"), "baseline\n", "utf8");
    await writeFile(join(source, ".gitattributes"), "docs/guide.md filter=unsafe\n", "utf8");
    await git(source, ["add", "docs/guide.md", ".gitattributes"]);
    await git(source, ["commit", "-m", "fixture"]);
    const head = (await git(source, ["rev-parse", "HEAD"])).trim();
    await assert.rejects(
      createIndependentAppServerSmokeClone({
        sourceRepo: source,
        destinationRepo: join(root, "attributes-clone"),
        expectedHead: head,
        targetPaths: ["docs/guide.md"]
      }),
      /live_smoke_git_attributes_forbidden/u
    );
    await git(source, ["rm", ".gitattributes"]);
    await git(source, ["commit", "-m", "remove attributes"]);
    await git(source, ["config", "filter.unsafe.smudge", "malicious-filter"]);
    const cleanHead = (await git(source, ["rev-parse", "HEAD"])).trim();
    await assert.rejects(
      createIndependentAppServerSmokeClone({
        sourceRepo: source,
        destinationRepo: join(root, "filter-clone"),
        expectedHead: cleanHead,
        targetPaths: ["docs/guide.md"]
      }),
      /live_smoke_git_filters_forbidden/u
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("quiescence gate observes the full quiet period and passes unchanged state", async () => {
  const expected: WorkspaceSnapshot = {
    head: "a".repeat(40),
    statusHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    statusEmpty: true,
    targetHashes: { "docs/guide.md": "b".repeat(64) },
    workspaceMetadataHash: "c".repeat(64)
  };
  const result = await waitForAppServerSmokeQuiescence({
    repoRoot: "/unused",
    targetPaths: ["docs/guide.md"],
    expectedHead: expected.head,
    expectedTargetHashes: expected.targetHashes,
    expectedWorkspaceMetadataHash: expected.workspaceMetadataHash,
    quietPeriodMs: 30,
    timeoutMs: 50,
    sampleIntervalMs: 10,
    capture: async () => expected,
    sleep: async () => {}
  });
  assert.equal(result.status, "unchanged");
  assert.equal(result.samples, 4);
});

test("quiescence sampling cannot start before disconnect completes", async () => {
  const order: string[] = [];
  const expected: WorkspaceSnapshot = {
    head: "a".repeat(40),
    statusHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    statusEmpty: true,
    targetHashes: { "docs/guide.md": "b".repeat(64) },
    workspaceMetadataHash: "c".repeat(64)
  };
  const result = await disconnectAndWaitForAppServerSmokeQuiescence({
    disconnect: async () => { order.push("disconnect"); },
    repoRoot: "/unused",
    targetPaths: ["docs/guide.md"],
    expectedHead: expected.head,
    expectedTargetHashes: expected.targetHashes,
    expectedWorkspaceMetadataHash: expected.workspaceMetadataHash,
    quietPeriodMs: 10,
    timeoutMs: 20,
    sampleIntervalMs: 10,
    capture: async () => { order.push("capture"); return expected; },
    sleep: async () => {}
  });
  assert.equal(result.status, "unchanged");
  assert.deepEqual(order.slice(0, 2), ["disconnect", "capture"]);
});

test("quiescence gate blocks a late write even when the workspace later reverts", async () => {
  const expected: WorkspaceSnapshot = {
    head: "a".repeat(40),
    statusHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    statusEmpty: true,
    targetHashes: { "docs/guide.md": "b".repeat(64) },
    workspaceMetadataHash: "c".repeat(64)
  };
  const changed: WorkspaceSnapshot = {
    ...expected,
    statusHash: "c".repeat(64),
    statusEmpty: false,
    targetHashes: { "docs/guide.md": "d".repeat(64) }
  };
  const snapshots = [expected, changed, expected, expected, expected, expected];
  let index = 0;
  const result = await waitForAppServerSmokeQuiescence({
    repoRoot: "/unused",
    targetPaths: ["docs/guide.md"],
    expectedHead: expected.head,
    expectedTargetHashes: expected.targetHashes,
    expectedWorkspaceMetadataHash: expected.workspaceMetadataHash,
    quietPeriodMs: 20,
    timeoutMs: 60,
    sampleIntervalMs: 10,
    capture: async () => snapshots[Math.min(index++, snapshots.length - 1)]!,
    sleep: async () => {}
  });
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "live_smoke_workspace_mutation_observed");
  assert.equal(result.mutationObserved, true);
});

test("quiescence gate blocks a reverted write preserved only in workspace metadata", async () => {
  const expected: WorkspaceSnapshot = {
    head: "a".repeat(40),
    statusHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    statusEmpty: true,
    targetHashes: { "docs/guide.md": "b".repeat(64) },
    workspaceMetadataHash: "c".repeat(64)
  };
  const reverted: WorkspaceSnapshot = {
    ...expected,
    workspaceMetadataHash: "d".repeat(64)
  };
  const result = await waitForAppServerSmokeQuiescence({
    repoRoot: "/unused",
    targetPaths: ["docs/guide.md"],
    expectedHead: expected.head,
    expectedTargetHashes: expected.targetHashes,
    expectedWorkspaceMetadataHash: expected.workspaceMetadataHash,
    quietPeriodMs: 20,
    timeoutMs: 40,
    sampleIntervalMs: 10,
    capture: async () => reverted,
    sleep: async () => {}
  });
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "live_smoke_workspace_mutation_observed");
  assert.equal(result.mutationObserved, true);
});

test("live file-change smoke remains blocked until interception is proven", () => {
  assert.equal(APP_SERVER_FILE_CHANGE_INTERCEPTION_PROVEN, false);
  assert.throws(() => assertAppServerFileChangeInterceptionProven(), /app_server_file_change_interception_unproven/u);
});

test("workspace capture hashes a clean fixed target", async () => {
  const root = await mkdtemp(join(tmpdir(), "codex-router-live-smoke-capture-"));
  try {
    await mkdir(join(root, "docs"), { recursive: true });
    await git(root, ["init"]);
    await git(root, ["config", "user.name", "codex-router test"]);
    await git(root, ["config", "user.email", "codex-router@example.invalid"]);
    await writeFile(join(root, "docs/guide.md"), "baseline\n", "utf8");
    await git(root, ["add", "docs/guide.md"]);
    await git(root, ["commit", "-m", "fixture"]);
    const before = await captureAppServerSmokeWorkspace(root, ["docs/guide.md"]);
    assert.equal(before.statusEmpty, true);
    assert.equal(before.targetHashes["docs/guide.md"]?.length, 64);
    const unchanged = await captureAppServerSmokeWorkspace(root, ["docs/guide.md"]);
    assert.equal(unchanged.workspaceMetadataHash, before.workspaceMetadataHash);
    await writeFile(join(root, "docs/guide.md"), "changed\n", "utf8");
    await writeFile(join(root, "docs/guide.md"), "baseline\n", "utf8");
    const afterRevert = await captureAppServerSmokeWorkspace(root, ["docs/guide.md"]);
    assert.equal(afterRevert.statusEmpty, true);
    assert.deepEqual(afterRevert.targetHashes, before.targetHashes);
    assert.notEqual(afterRevert.workspaceMetadataHash, before.workspaceMetadataHash);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
