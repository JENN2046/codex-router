import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ALLOW_REAL_CODEX_CLI_READONLY_SMOKE_ENV,
  runRealCodexCliReadOnlySmokeScript
} from "../scripts/run-codex-cli-real-readonly-smoke.js";
import {
  CODEX_CLI_MODEL_PROBE_OK,
  CODEX_CLI_READONLY_SMOKE_OK,
  runCodexCliReadOnlySmoke,
  type CodexCliChildProcess,
  type CodexCliProcessSpawner
} from "../packages/codex-cli-host/src/index.js";

test("real read-only smoke script blocks without operator flag before runner invocation", async () => {
  const dir = await mkdtemp(join(tmpdir(), "codex-cli-real-smoke-gate-"));
  const evidencePath = join(dir, "blocked", "evidence.json");
  let runnerCalls = 0;

  const receipt = await runRealCodexCliReadOnlySmokeScript({
    generatedAt: "2026-06-14T00:00:00.000Z",
    evidencePath,
    env: {},
    runSmoke: async () => {
      runnerCalls += 1;
      throw new Error("runner_should_not_be_called");
    }
  });
  const written = JSON.parse(await readFile(evidencePath, "utf8")) as Record<string, unknown>;

  assert.equal(runnerCalls, 0);
  assert.equal(receipt.exitCode, 1);
  assert.equal(receipt.evidence.status, "blocked");
  assert.equal(receipt.evidence.checks.operatorFlagPresent, false);
  assert.equal(receipt.evidence.checks.runnerInvoked, false);
  assert.deepEqual(receipt.evidence.summary.blockingReasons, [
    "codex_cli_real_readonly_smoke_requires_operator_flag"
  ]);
  assert.equal(written.status, "blocked");
  assertRealReadonlySmokeEvidenceIsSanitized(JSON.stringify(written));
});

test("real read-only smoke script runs only with operator flag and keeps evidence sanitized", async () => {
  const dir = await mkdtemp(join(tmpdir(), "codex-cli-real-smoke-gate-"));
  const evidencePath = join(dir, "passed", "evidence.json");
  const spawnCalls: Array<{ command: string; args: string[]; cwd?: string }> = [];
  const spawn: CodexCliProcessSpawner = (command, args, options) => {
    spawnCalls.push({
      command,
      args,
      ...(options.cwd ? { cwd: options.cwd } : {})
    });

    return createFakeCodexCliChild({
      stdout: spawnCalls.length === 1
        ? `{"type":"agent_message","message":"${CODEX_CLI_MODEL_PROBE_OK}"}\n`
        : `{"type":"agent_message","message":"${CODEX_CLI_READONLY_SMOKE_OK}"}\n`,
      exitCode: 0
    });
  };
  let runnerTimeout: number | undefined;

  const receipt = await runRealCodexCliReadOnlySmokeScript({
    generatedAt: "2026-06-14T00:00:00.000Z",
    evidencePath,
    env: {
      [ALLOW_REAL_CODEX_CLI_READONLY_SMOKE_ENV]: "1",
      CODEX_CLI_REAL_READONLY_SMOKE_TIMEOUT_MS: "12345",
      CODEX_CLI_REAL_READONLY_SMOKE_CWD: "A:/codex-router",
      CODEX_CLI_REAL_READONLY_SMOKE_COMMAND: "codex-real-smoke-test",
      CODEX_CLI_REAL_READONLY_SMOKE_MODEL: "gpt-5.4-mini"
    },
    runSmoke: async (options) => {
      runnerTimeout = options.timeoutMs;
      return await runCodexCliReadOnlySmoke({
        ...options,
        spawn
      });
    }
  });
  const serialized = await readFile(evidencePath, "utf8");
  const written = JSON.parse(serialized) as Record<string, unknown>;

  assert.equal(receipt.exitCode, 0);
  assert.equal(receipt.evidence.status, "passed");
  assert.equal(receipt.evidence.checks.operatorFlagPresent, true);
  assert.equal(receipt.evidence.checks.runnerInvoked, true);
  assert.equal(receipt.evidence.checks.readOnlySandbox, true);
  assert.equal(receipt.evidence.checks.approvalPolicyNever, true);
  assert.equal(receipt.evidence.checks.noWorkspaceWrite, true);
  assert.equal(receipt.evidence.checks.noFileWrite, true);
  assert.equal(receipt.evidence.plan?.timeoutMs, 12345);
  assert.equal(runnerTimeout, 12345);
  assert.equal(spawnCalls.length, 2);
  assert.equal(spawnCalls[0]?.command, "codex-real-smoke-test");
  assert.equal(spawnCalls[1]?.command, "codex-real-smoke-test");
  for (const call of spawnCalls) {
    assert.equal(call.args.includes("workspace-write"), false);
    assert.equal(call.args.includes("--output"), false);
  }
  assert.equal(written.status, "passed");
  assertRealReadonlySmokeEvidenceIsSanitized(serialized);
});

function assertRealReadonlySmokeEvidenceIsSanitized(serialized: string): void {
  for (const forbidden of [
    "prompt",
    "args",
    "stdout",
    "stderr",
    "raw command",
    "OPENAI_API_KEY",
    "Bearer",
    "sk-"
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
}

class FakeCodexCliStream extends EventEmitter {
  setEncoding(_encoding: BufferEncoding): void {}
}

class FakeCodexCliWritableStream {
  end(): void {}

  destroy(): void {}
}

class FakeCodexCliChild extends EventEmitter implements CodexCliChildProcess {
  readonly stdin = new FakeCodexCliWritableStream();
  readonly stdout = new FakeCodexCliStream();
  readonly stderr = new FakeCodexCliStream();

  kill(_signal?: NodeJS.Signals | number): boolean {
    return true;
  }
}

function createFakeCodexCliChild(options: {
  stdout: string;
  stderr?: string;
  exitCode: number;
}): FakeCodexCliChild {
  const child = new FakeCodexCliChild();

  queueMicrotask(() => {
    if (options.stdout) {
      child.stdout.emit("data", options.stdout);
    }
    if (options.stderr) {
      child.stderr.emit("data", options.stderr);
    }
    child.emit("close", options.exitCode, null);
  });

  return child;
}
