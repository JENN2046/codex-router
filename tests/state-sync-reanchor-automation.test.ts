import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import {
  createOrUpdateStateSyncReanchorPr,
  stateSyncReanchorPrBody
} from "../scripts/create-state-sync-reanchor-pr.js";
import { resolveStateSyncReanchorPrGate } from "../scripts/resolve-state-sync-reanchor-pr-gate.js";
import {
  verifyStateSyncReanchorDiff
} from "../scripts/verify-state-sync-reanchor-diff.js";

const execFileAsync = promisify(execFile);

test("state-sync reanchor PR gate noops after main is reanchored", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "state-sync-reanchor-gate-"));
  await writeClaim(cwd, {
    branch: "main",
    transition: "state_only_pushed"
  });

  const result = await resolveStateSyncReanchorPrGate(cwd);

  assert.equal(result.runReanchor, false);
  assert.equal(result.reason, "already_reanchored");
});

test("state-sync reanchor PR gate runs for non-main pushed claims", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "state-sync-reanchor-gate-run-"));
  await writeClaim(cwd, {
    branch: "feature/state-sync",
    transition: "state_only_pending_push"
  });

  const result = await resolveStateSyncReanchorPrGate(cwd);

  assert.equal(result.runReanchor, true);
  assert.equal(result.reason, "needs_reanchor");
});

test("state-sync reanchor PR gate fails closed on invalid claims", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "state-sync-reanchor-gate-invalid-"));
  await mkdir(join(cwd, "docs", "current"), { recursive: true });
  await writeFile(
    join(cwd, "docs", "current", "state-sync-record.json"),
    "{",
    "utf8"
  );

  await assert.rejects(
    () => resolveStateSyncReanchorPrGate(cwd),
    /invalid claim/
  );
});

test("state-sync reanchor diff verifier blocks disallowed files and stale prose", async () => {
  const cwd = await createGitFixture();
  await writeFile(
    join(cwd, "docs", "current", "CURRENT_STATE.md"),
    "safe update\n",
    "utf8"
  );
  await writeFile(
    join(cwd, ".agent_board", "TASK_QUEUE.md"),
    "Todo:\n\n- push the post-PR main state/docs reanchor\n",
    "utf8"
  );
  await mkdir(join(cwd, "packages"), { recursive: true });
  await writeFile(join(cwd, "packages", "source.ts"), "export {};\n", "utf8");

  const result = await verifyStateSyncReanchorDiff(cwd);

  assert.equal(result.status, "blocked");
  assert.deepEqual(result.disallowedPaths, ["packages/source.ts"]);
  assert.ok(result.stalePhraseHits.some((hit) =>
    hit.path === ".agent_board/TASK_QUEUE.md"
    && hit.phrase === "push the post-PR"
  ));
});

test("state-sync reanchor diff verifier accepts strict state/docs changes", async () => {
  const cwd = await createGitFixture();
  await writeFile(
    join(cwd, "docs", "current", "CURRENT_STATE.md"),
    "safe update\n",
    "utf8"
  );

  const result = await verifyStateSyncReanchorDiff(cwd);

  assert.equal(result.status, "passed");
  assert.deepEqual(result.changedPaths, ["docs/current/CURRENT_STATE.md"]);
  assert.deepEqual(result.disallowedPaths, []);
  assert.deepEqual(result.stalePhraseHits, []);
});

test("state-sync reanchor PR body records validation and boundaries", () => {
  const body = stateSyncReanchorPrBody({
    triggeringSha: "abc1234",
    headBranch: "state-sync/reanchor-main",
    changedPaths: ["docs/current/state-sync-record.json"],
    validationCommands: ["node --import tsx scripts/run-state-sync-audit.ts --json"],
    workflowRunUrl: "https://github.example/actions/runs/1"
  });

  assert.match(body, /Automated post-merge state-sync reanchor PR/);
  assert.match(body, /main SHA: `abc1234`/);
  assert.match(body, /docs\/current\/state-sync-record\.json/);
  assert.match(body, /created or updated by a workflow using `GITHUB_TOKEN`/);
  assert.match(body, /approval-required state/);
  assert.match(body, /not as evidence that the reanchor PR failed to trigger CI/);
  assert.match(body, /No automatic merge/);
});

test("state-sync reanchor PR script updates an existing PR", async () => {
  const calls: Array<{ url: string; method: string; body?: unknown }> = [];
  const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({
      url: String(url),
      method: init?.method ?? "GET",
      body: init?.body === undefined ? undefined : JSON.parse(String(init.body))
    });
    if ((init?.method ?? "GET") === "GET") {
      return jsonResponse([{ number: 12, html_url: "https://github.example/pull/12" }]);
    }

    return jsonResponse({ number: 12, html_url: "https://github.example/pull/12" });
  };

  const result = await createOrUpdateStateSyncReanchorPr({
    token: "token",
    repository: "owner/repo",
    triggeringSha: "abc1234",
    workflowRunUrl: "https://github.example/actions/runs/1",
    changedPaths: ["docs/current/state-sync-record.json"],
    validationCommands: ["npm test"],
    fetchImpl: fetchImpl as typeof fetch
  });

  assert.equal(result.action, "updated");
  assert.equal(result.number, 12);
  assert.equal(calls[0]?.method, "GET");
  assert.match(calls[0]?.url ?? "", /head=owner%3Astate-sync%2Freanchor-main/);
  assert.equal(calls[1]?.method, "PATCH");
  assert.match(calls[1]?.url ?? "", /\/pulls\/12$/);
});

test("state-sync reanchor PR script creates a PR when none is open", async () => {
  const methods: string[] = [];
  const fetchImpl = async (_url: string | URL | Request, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    methods.push(method);
    if (method === "GET") {
      return jsonResponse([]);
    }

    return jsonResponse({ number: 34, html_url: "https://github.example/pull/34" });
  };

  const result = await createOrUpdateStateSyncReanchorPr({
    token: "token",
    repository: "owner/repo",
    triggeringSha: "abc1234",
    workflowRunUrl: "https://github.example/actions/runs/1",
    changedPaths: ["docs/current/state-sync-record.json"],
    validationCommands: ["npm test"],
    fetchImpl: fetchImpl as typeof fetch
  });

  assert.equal(result.action, "created");
  assert.equal(result.number, 34);
  assert.deepEqual(methods, ["GET", "POST"]);
});

async function writeClaim(
  cwd: string,
  input: {
    branch: string;
    transition: "state_only_pending_push" | "state_only_pushed";
  }
): Promise<void> {
  await mkdir(join(cwd, "docs", "current"), { recursive: true });
  await writeFile(
    join(cwd, "docs", "current", "state-sync-record.json"),
    `${JSON.stringify({
      schemaVersion: 1,
      policyVersion: "state-sync-policy.v1",
      subject: {
        branch: input.branch,
        upstream: "refs/remotes/origin/main"
      },
      source: {
        validatedSourceCommit: "abc1234",
        latestValidatedCommit: "abc1234",
        recordedDivergence: {
          ahead: 1,
          behind: 0
        },
        sourceTreeDigest: {
          algorithm: "git-ls-tree-sha256",
          value: "0".repeat(64),
          excludedPaths: strictStateRecordPaths()
        }
      },
      transition: {
        kind: input.transition,
        allowedStatePaths: strictStateRecordPaths()
      }
    }, null, 2)}\n`,
    "utf8"
  );
}

async function createGitFixture(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), "state-sync-reanchor-diff-"));
  await git(cwd, ["init", "-b", "main"]);
  await git(cwd, ["config", "user.email", "state-sync@example.invalid"]);
  await git(cwd, ["config", "user.name", "State Sync Test"]);
  await mkdir(join(cwd, "docs", "current"), { recursive: true });
  await mkdir(join(cwd, ".agent_board"), { recursive: true });
  for (const filePath of strictStateRecordPaths()) {
    await mkdir(join(cwd, filePath, ".."), { recursive: true });
    await writeFile(join(cwd, filePath), "baseline\n", "utf8");
  }
  await git(cwd, ["add", "."]);
  await git(cwd, ["commit", "-m", "baseline"]);
  return cwd;
}

function strictStateRecordPaths(): string[] {
  return [
    "docs/current/CURRENT_STATE.md",
    "docs/current/state-sync-record.json",
    ".agent_board/CHECKPOINT.md",
    ".agent_board/HANDOFF.md",
    ".agent_board/RUN_STATE.md",
    ".agent_board/TASK_QUEUE.md",
    ".agent_board/VALIDATION_LOG.md"
  ];
}

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, {
    cwd,
    encoding: "utf8",
    windowsHide: true
  });
  return stdout;
}
