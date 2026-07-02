import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import {
  createOrUpdateStateSyncReanchorPr,
  stateSyncReanchorPrBody
} from "../scripts/create-state-sync-reanchor-pr.js";
import { gitFilteredTreeDigest } from "../scripts/run-state-sync-audit.js";
import {
  runStateSyncMainReanchor
} from "../scripts/run-state-sync-main-reanchor.js";
import { resolveStateSyncReanchorPrGate } from "../scripts/resolve-state-sync-reanchor-pr-gate.js";
import {
  verifyStateSyncReanchorDiff,
  verifyStateSyncReanchorRange
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

test("state-sync reanchor PR gate noops for policy v2 records", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "state-sync-reanchor-gate-v2-"));
  await writePolicyV2Claim(cwd);

  const result = await resolveStateSyncReanchorPrGate(cwd);

  assert.equal(result.runReanchor, false);
  assert.equal(result.reason, "policy_v2_no_reanchor");
  assert.equal(result.branch, "content-attestation");
  assert.equal(result.transition, "state-sync-policy.v2");
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

test("state-sync reanchor diff verifier blocks disallowed files and ignores stale prose", async () => {
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
  assert.deepEqual(result.disallowedPaths, [
    ".agent_board/TASK_QUEUE.md",
    "docs/current/CURRENT_STATE.md",
    "packages/source.ts"
  ]);
  assert.deepEqual(result.stalePhraseHits, []);
});

test("state-sync reanchor diff verifier accepts structured record changes", async () => {
  const cwd = await createGitFixture();
  await writeFile(
    join(cwd, "docs", "current", "state-sync-record.json"),
    "safe update\n",
    "utf8"
  );

  const result = await verifyStateSyncReanchorDiff(cwd);

  assert.equal(result.status, "passed");
  assert.deepEqual(result.changedPaths, ["docs/current/state-sync-record.json"]);
  assert.deepEqual(result.disallowedPaths, []);
  assert.deepEqual(result.stalePhraseHits, []);
});

test("state-sync reanchor range verifier blocks rename sources", async () => {
  const cwd = await createGitFixture();
  await mkdir(join(cwd, "packages"), { recursive: true });
  await writeFile(join(cwd, "packages", "source.ts"), "source\n", "utf8");
  await git(cwd, ["add", "packages/source.ts"]);
  await git(cwd, ["commit", "-m", "feat: source"]);
  const baseRef = (await git(cwd, ["rev-parse", "HEAD"])).trim();

  await git(cwd, [
    "mv",
    "-f",
    "packages/source.ts",
    ".agent_board/TASK_QUEUE.md"
  ]);
  await git(cwd, ["commit", "-m", "docs(state): rename source into state"]);

  const result = await verifyStateSyncReanchorRange(cwd, baseRef, "HEAD");

  assert.equal(result.status, "blocked");
  assert.ok(result.changedPaths.includes("packages/source.ts"));
  assert.ok(result.disallowedPaths.includes("packages/source.ts"));
});

test("state-sync reanchor range verifier preserves padded path names", async () => {
  const cwd = await createGitFixture();
  const baseRef = (await git(cwd, ["rev-parse", "HEAD"])).trim();

  await writeFile(
    join(cwd, "docs", "current", "CURRENT_STATE.md "),
    "padded path\n",
    "utf8"
  );
  await git(cwd, ["add", "docs/current/CURRENT_STATE.md "]);
  await git(cwd, ["commit", "-m", "docs(state): padded path"]);

  const result = await verifyStateSyncReanchorRange(cwd, baseRef, "HEAD");

  assert.equal(result.status, "blocked");
  assert.ok(result.changedPaths.includes("docs/current/CURRENT_STATE.md "));
  assert.ok(result.disallowedPaths.includes("docs/current/CURRENT_STATE.md "));
});

test("state-sync reanchor PR body records validation and boundaries", () => {
  const body = stateSyncReanchorPrBody({
    triggeringSha: "abc1234",
    headBranch: "state-sync/reanchor-main",
    changedPaths: ["docs/current/state-sync-record.json"],
    validationCommands: ["node --import tsx scripts/run-state-sync-audit.ts --json"],
    workflowRunUrl: "https://github.example/actions/runs/1"
  });

  assert.match(body, /Manual legacy v1 compatibility state-sync reanchor PR/);
  assert.match(body, /Compatibility fallback for schema v1 state-only records/);
  assert.match(body, /manual `workflow_dispatch` fallback/);
  assert.match(body, /not from the normal `main` push path/);
  assert.match(
    body,
    /Policy v2 content attestations are the main path and do not require this post-squash reanchor/
  );
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

test("state-sync main reanchor runner noops when main is already reanchored", async () => {
  const fixture = await createAlreadyReanchoredMainFixture();

  const result = await runStateSyncMainReanchor(fixture.cwd, {
    validate: false
  });

  assert.equal(result.mode, "check");
  assert.equal(result.reanchorNeeded, false);
  assert.deepEqual(result.changedPaths, []);
  assert.equal(result.baseHead, result.remoteHeadBefore);
});

test("state-sync main reanchor runner refuses non-main branches", async () => {
  const fixture = await createAlreadyReanchoredMainFixture();
  await git(fixture.cwd, ["switch", "-c", "feature/not-main"]);

  await assert.rejects(
    () => runStateSyncMainReanchor(fixture.cwd, {
      validate: false
    }),
    /state_sync_main_reanchor_requires_main_branch:feature\/not-main/
  );
});

test("state-sync main reanchor runner refuses non-origin remotes", async () => {
  const fixture = await createAlreadyReanchoredMainFixture();

  await assert.rejects(
    () => runStateSyncMainReanchor(fixture.cwd, {
      remote: "upstream",
      validate: false
    }),
    /state_sync_main_reanchor_requires_origin_remote:upstream/
  );
});

test("state-sync main reanchor runner commits and pushes a bounded reanchor", async () => {
  const fixture = await createSquashMainReanchorFixture();

  const result = await runStateSyncMainReanchor(fixture.cwd, {
    push: true,
    validate: false
  });

  const remoteHead = await git(fixture.cwd, ["rev-parse", "refs/remotes/origin/main"]);
  const claim = JSON.parse(await readFile(
    join(fixture.cwd, "docs", "current", "state-sync-record.json"),
    "utf8"
  ));

  assert.equal(result.mode, "push");
  assert.equal(result.reanchorNeeded, true);
  assert.equal(result.committedHead, result.pushedHead);
  assert.equal(result.pushedHead, remoteHead.trim());
  assert.equal(claim.subject.branch, "main");
  assert.equal(claim.transition.kind, "state_only_pushed");
  assert.equal(claim.source.validatedSourceCommit, fixture.squashCommit);
  assert.deepEqual(claim.source.recordedDivergence, { ahead: 1, behind: 0 });
  assert.ok(result.changedPaths.includes("docs/current/state-sync-record.json"));
});

test("state-sync main reanchor runner resumes a commit-only reanchor push", async () => {
  const fixture = await createSquashMainReanchorFixture();

  const commitResult = await runStateSyncMainReanchor(fixture.cwd, {
    commit: true,
    validate: false
  });
  const divergenceBeforePush = await git(
    fixture.cwd,
    ["rev-list", "--left-right", "--count", "HEAD...refs/remotes/origin/main"]
  );

  const pushResult = await runStateSyncMainReanchor(fixture.cwd, {
    push: true,
    validate: false
  });
  const remoteHead = await git(fixture.cwd, ["rev-parse", "refs/remotes/origin/main"]);
  const claim = JSON.parse(await readFile(
    join(fixture.cwd, "docs", "current", "state-sync-record.json"),
    "utf8"
  ));

  assert.equal(commitResult.mode, "commit");
  assert.equal(divergenceBeforePush.trim(), "1\t0");
  assert.equal(pushResult.mode, "push");
  assert.equal(pushResult.committedHead, commitResult.committedHead);
  assert.equal(pushResult.pushedHead, remoteHead.trim());
  assert.equal(claim.subject.branch, "main");
  assert.equal(claim.transition.kind, "state_only_pushed");
  assert.deepEqual(pushResult.changedPaths.sort(), strictStateRecordPaths().sort());
});

test("state-sync main reanchor runner resumes explicit-source reanchor pushes", async () => {
  const fixture = await createStateOnlyAncestorMainReanchorFixture();

  const commitResult = await runStateSyncMainReanchor(fixture.cwd, {
    commit: true,
    source: fixture.sourceCommit,
    validate: false
  });

  const pushResult = await runStateSyncMainReanchor(fixture.cwd, {
    push: true,
    source: fixture.sourceCommit,
    validate: false
  });
  const remoteHead = await git(fixture.cwd, ["rev-parse", "refs/remotes/origin/main"]);
  const claim = JSON.parse(await readFile(
    join(fixture.cwd, "docs", "current", "state-sync-record.json"),
    "utf8"
  ));

  assert.equal(commitResult.mode, "commit");
  assert.equal(pushResult.mode, "push");
  assert.equal(pushResult.committedHead, commitResult.committedHead);
  assert.equal(pushResult.pushedHead, remoteHead.trim());
  assert.equal(claim.subject.branch, "main");
  assert.equal(claim.transition.kind, "state_only_pushed");
  assert.equal(claim.source.validatedSourceCommit, fixture.sourceCommit);
  assert.deepEqual(claim.source.recordedDivergence, { ahead: 2, behind: 0 });
});

test("state-sync main reanchor runner blocks contaminated commit-only resumes", async () => {
  const fixture = await createSquashMainReanchorFixture();

  await runStateSyncMainReanchor(fixture.cwd, {
    commit: true,
    validate: false
  });
  await writeFile(join(fixture.cwd, "packages", "extra.txt"), "non-state\n", "utf8");
  await git(fixture.cwd, ["add", "packages/extra.txt"]);
  await git(fixture.cwd, ["commit", "--amend", "--no-edit"]);

  await assert.rejects(
    () => runStateSyncMainReanchor(fixture.cwd, {
      push: true,
      validate: false
    }),
    /state_sync_main_reanchor_resume_diff_verification_failed/
  );
});

test("state-sync main reanchor runner blocks empty commit-only resumes", async () => {
  const fixture = await createAlreadyReanchoredMainFixture();

  await git(fixture.cwd, [
    "commit",
    "--allow-empty",
    "-m",
    "docs(state): reanchor main state-sync record"
  ]);

  await assert.rejects(
    () => runStateSyncMainReanchor(fixture.cwd, {
      push: true,
      validate: false
    }),
    /state_sync_main_reanchor_resume_requires_reanchor_delta/
  );
});

test("state-sync main reanchor runner blocks note-only commit resumes", async () => {
  const fixture = await createAlreadyReanchoredMainFixture();

  await mkdir(join(fixture.cwd, ".agent_board"), { recursive: true });
  await writeFile(
    join(fixture.cwd, ".agent_board", "TASK_QUEUE.md"),
    "Status: local note only.\n",
    "utf8"
  );
  await git(fixture.cwd, ["add", ".agent_board/TASK_QUEUE.md"]);
  await git(fixture.cwd, ["commit", "-m", "docs(state): local note"]);

  await assert.rejects(
    () => runStateSyncMainReanchor(fixture.cwd, {
      push: true,
      validate: false
    }),
    /state_sync_main_reanchor_resume_diff_verification_failed/
  );
});

test("state-sync main reanchor runner blocks tampered resume claims", async () => {
  const fixture = await createSquashMainReanchorFixture();

  await runStateSyncMainReanchor(fixture.cwd, {
    commit: true,
    validate: false
  });
  const claimPath = join(fixture.cwd, "docs", "current", "state-sync-record.json");
  const claim = JSON.parse(await readFile(claimPath, "utf8"));
  claim.source.recordedDivergence = { ahead: 99, behind: 0 };
  await writeFile(claimPath, `${JSON.stringify(claim, null, 2)}\n`, "utf8");
  await git(fixture.cwd, ["add", "docs/current/state-sync-record.json"]);
  await git(fixture.cwd, ["commit", "--amend", "--no-edit"]);

  await assert.rejects(
    () => runStateSyncMainReanchor(fixture.cwd, {
      push: true,
      validate: false
    }),
    /state_sync_main_reanchor_resume_claim_mismatch/
  );
});

test("state-sync main reanchor runner delays state-sync audit until after push", async () => {
  const fixture = await createSquashMainReanchorFixture();
  const validationLabels: string[] = [];
  let checkedBeforePush = false;

  const result = await runStateSyncMainReanchor(fixture.cwd, {
    push: true,
    validationRunner: async (command) => {
      validationLabels.push(command.label);
    },
    beforePush: async () => {
      checkedBeforePush = true;
      assert.ok(validationLabels.every(
        (label) => !label.includes("scripts/run-state-sync-audit.ts")
      ));
    }
  });

  assert.equal(checkedBeforePush, true);
  assert.equal(result.mode, "push");
  assert.deepEqual(
    validationLabels.filter((label) =>
      label.includes("scripts/run-state-sync-audit.ts")
    ),
    ["node --import tsx scripts/run-state-sync-audit.ts --json after push"]
  );
  assert.equal(
    result.validations.includes(
      "node --import tsx scripts/run-state-sync-audit.ts --json after commit"
    ),
    false
  );
});

test("state-sync main reanchor runner blocks stale pushes when origin main moved", async () => {
  const fixture = await createSquashMainReanchorFixture();

  await assert.rejects(
    () => runStateSyncMainReanchor(fixture.cwd, {
      push: true,
      validate: false,
      beforePush: async () => {
        await moveRemoteMain(fixture.remote);
      }
    }),
    /state_sync_main_reanchor_origin_main_moved/
  );
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

async function writePolicyV2Claim(cwd: string): Promise<void> {
  await mkdir(join(cwd, "docs", "current"), { recursive: true });
  await writeFile(
    join(cwd, "docs", "current", "state-sync-record.json"),
    `${JSON.stringify({
      schemaVersion: 2,
      policyVersion: "state-sync-policy.v2",
      repository: {
        fullName: "JENN2046/codex-router"
      },
      source: {
        sourceTreeDigest: {
          algorithm: "git-ls-tree-sha256",
          value: "0".repeat(64),
          excludedPaths: policyV2SourceTreeDigestExcludedPaths()
        }
      },
      allowedContexts: [
        {
          event: "local",
          targetRef: "refs/heads/main"
        },
        {
          event: "pull_request",
          targetRef: "refs/heads/main"
        },
        {
          event: "push",
          targetRef: "refs/heads/main"
        }
      ]
    }, null, 2)}\n`,
    "utf8"
  );
}

async function createAlreadyReanchoredMainFixture(): Promise<{
  cwd: string;
  remote: string;
}> {
  const fixture = await createRepoWithBareOrigin("state-sync-main-reanchor-noop-");
  await writeClaim(fixture.cwd, {
    branch: "main",
    transition: "state_only_pushed"
  });
  await git(fixture.cwd, ["add", "."]);
  await git(fixture.cwd, ["commit", "-m", "docs(state): reanchor main"]);
  await git(fixture.cwd, ["push", "-u", "origin", "main"]);
  return fixture;
}

async function createSquashMainReanchorFixture(): Promise<{
  cwd: string;
  remote: string;
  squashCommit: string;
}> {
  const fixture = await createRepoWithBareOrigin("state-sync-main-reanchor-");
  await writeStableDisplaySurfaces(fixture.cwd);
  await writeSource(fixture.cwd, "initial source\n");
  await git(fixture.cwd, ["add", "."]);
  await git(fixture.cwd, ["commit", "-m", "feat: initial"]);
  await git(fixture.cwd, ["push", "-u", "origin", "main"]);

  await git(fixture.cwd, ["switch", "-c", "feature/reanchor"]);
  await writeSource(fixture.cwd, "feature source\n");
  await git(fixture.cwd, ["add", "packages/example.txt"]);
  await git(fixture.cwd, ["commit", "-m", "feat: feature"]);
  const featureSource = await shortHead(fixture.cwd);
  const featureDigest = await gitFilteredTreeDigest(
    "HEAD",
    strictStateRecordPaths(),
    fixture.cwd
  );
  assert.ok(featureDigest);
  await writeStateSurfaces(fixture.cwd, {
    branch: "feature/reanchor",
    sourceCommit: featureSource,
    sourceDigest: featureDigest,
    recordedAhead: 1,
    transitionKind: "state_only_pending_push"
  });
  await git(fixture.cwd, ["add", "."]);
  await git(fixture.cwd, ["commit", "-m", "docs(state): record feature"]);

  await git(fixture.cwd, ["switch", "main"]);
  await git(fixture.cwd, ["merge", "--squash", "feature/reanchor"]);
  await git(fixture.cwd, ["commit", "-m", "squash feature"]);
  const squashCommit = await shortHead(fixture.cwd);
  await git(fixture.cwd, ["push", "origin", "main"]);
  await git(fixture.cwd, ["fetch", "origin", "main"]);

  return {
    ...fixture,
    squashCommit
  };
}

async function createStateOnlyAncestorMainReanchorFixture(): Promise<{
  cwd: string;
  remote: string;
  sourceCommit: string;
}> {
  const fixture = await createRepoWithBareOrigin("state-sync-main-reanchor-source-");
  await writeStableDisplaySurfaces(fixture.cwd);
  await writeSource(fixture.cwd, "source\n");
  await git(fixture.cwd, ["add", "."]);
  await git(fixture.cwd, ["commit", "-m", "feat: source"]);
  const sourceCommit = await shortHead(fixture.cwd);
  const sourceDigest = await gitFilteredTreeDigest(
    "HEAD",
    strictStateRecordPaths(),
    fixture.cwd
  );
  assert.ok(sourceDigest);
  await git(fixture.cwd, ["push", "-u", "origin", "main"]);

  await writeStateSurfaces(fixture.cwd, {
    branch: "feature/reanchor",
    sourceCommit,
    sourceDigest,
    recordedAhead: 1,
    transitionKind: "state_only_pending_push"
  });
  await git(fixture.cwd, ["add", "."]);
  await git(fixture.cwd, ["commit", "-m", "docs(state): record pending state"]);
  await git(fixture.cwd, ["push", "origin", "main"]);
  await git(fixture.cwd, ["fetch", "origin", "main"]);

  return {
    ...fixture,
    sourceCommit
  };
}

async function createRepoWithBareOrigin(prefix: string): Promise<{
  cwd: string;
  remote: string;
}> {
  const root = await mkdtemp(join(tmpdir(), prefix));
  const remote = join(root, "origin.git");
  const cwd = join(root, "repo");
  await git(root, ["init", "--bare", remote]);
  await git(root, ["init", "-b", "main", cwd]);
  await git(cwd, ["config", "user.email", "state-sync@example.invalid"]);
  await git(cwd, ["config", "user.name", "State Sync Test"]);
  await git(cwd, ["remote", "add", "origin", remote]);
  return { cwd, remote };
}

async function moveRemoteMain(remote: string): Promise<void> {
  const clone = await mkdtemp(join(tmpdir(), "state-sync-main-reanchor-move-"));
  await git(clone, ["clone", "--branch", "main", remote, "repo"]);
  const cwd = join(clone, "repo");
  await git(cwd, ["config", "user.email", "state-sync@example.invalid"]);
  await git(cwd, ["config", "user.name", "State Sync Test"]);
  await writeFile(join(cwd, "external.txt"), "external move\n", "utf8");
  await git(cwd, ["add", "external.txt"]);
  await git(cwd, ["commit", "-m", "external main move"]);
  await git(cwd, ["push", "origin", "main"]);
}

async function writeSource(cwd: string, value: string): Promise<void> {
  await mkdir(join(cwd, "packages"), { recursive: true });
  await writeFile(join(cwd, "packages", "example.txt"), value, "utf8");
}

async function writeStableDisplaySurfaces(cwd: string): Promise<void> {
  await mkdir(join(cwd, "docs", "current"), { recursive: true });
  await mkdir(join(cwd, ".agent_board"), { recursive: true });
  await writeFile(
    join(cwd, "docs", "current", "CURRENT_STATE.md"),
    "# Current State\n\nCURRENT_STATE_RECORDED\n",
    "utf8"
  );
  for (const filePath of [
    ".agent_board/CHECKPOINT.md",
    ".agent_board/HANDOFF.md",
    ".agent_board/RUN_STATE.md",
    ".agent_board/TASK_QUEUE.md",
    ".agent_board/VALIDATION_LOG.md"
  ]) {
    await writeFile(join(cwd, filePath), "# Agent Board\n", "utf8");
  }
}

async function writeStateSurfaces(
  cwd: string,
  input: {
    branch: string;
    sourceCommit: string;
    sourceDigest: string;
    recordedAhead: number;
    transitionKind: "state_only_pending_push" | "state_only_pushed";
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
        validatedSourceCommit: input.sourceCommit,
        latestValidatedCommit: input.sourceCommit,
        recordedDivergence: {
          ahead: input.recordedAhead,
          behind: 0
        },
        sourceTreeDigest: {
          algorithm: "git-ls-tree-sha256",
          value: input.sourceDigest,
          excludedPaths: strictStateRecordPaths()
        }
      },
      transition: {
        kind: input.transitionKind,
        allowedStatePaths: strictStateRecordPaths()
      },
      validation: {
        requiredCommands: [
          "git diff --check",
          "node --import tsx scripts/run-state-sync-audit.ts --json"
        ]
      }
    }, null, 2)}\n`,
    "utf8"
  );
}

function displaySurface(input: {
  branch: string;
  sourceCommit: string;
  sourceDigest: string;
  recordedAhead: number;
  transitionKind: "state_only_pending_push" | "state_only_pushed";
}): string {
  const strictPaths = strictStateRecordPaths();
  return [
    "# State Sync Display",
    "",
    "CURRENT_STATE_RECORDED",
    "",
    "## Snapshot",
    "",
    "| Field | Value |",
    "| --- | --- |",
    `| Current branch | \`${input.branch}\` |`,
    `| Current head | \`${input.sourceCommit}\` |`,
    `| Validated source commit | \`${input.sourceCommit}\` |`,
    "| Upstream | `refs/remotes/origin/main` |",
    `| Upstream divergence | \`ahead ${input.recordedAhead} / behind 0\` |`,
    `| Latest validated commit | \`${input.sourceCommit}\` |`,
    "| State record mode | `state-only descendant allowed` |",
    "| Stale after commit | `true` |",
    "",
    "## Structured Record",
    "",
    "- schema version: `1`",
    "- policy version: `state-sync-policy.v1`",
    `- transition kind: \`${input.transitionKind}\``,
    `- validated source commit: \`${input.sourceCommit}\``,
    `- latest validated commit: \`${input.sourceCommit}\``,
    "- upstream baseline: `refs/remotes/origin/main`",
    `- recorded divergence baseline: \`ahead ${input.recordedAhead} / behind 0\``,
    "- source tree digest: `git-ls-tree-sha256`",
    `  \`${input.sourceDigest}\``,
    "",
    "Strict state record paths:",
    "",
    ...strictPaths.map((filePath) => `- \`${filePath}\``),
    "",
    "## Validation Baseline",
    "",
    `Validation recorded for source commit \`${input.sourceCommit}\`:`,
    "",
    "- `git diff --check`: PASS.",
    "- `node --import tsx scripts/run-state-sync-audit.ts --json`: PASS.",
    "",
    "Current structured state-sync audit status:",
    "",
    `- structured claim: \`${input.branch}\` / \`${input.transitionKind}\` against`,
    "  `refs/remotes/origin/main`",
    `- validated source commit: \`${input.sourceCommit}\``,
    `- latest validated commit: \`${input.sourceCommit}\``,
    `- recorded divergence baseline: \`ahead ${input.recordedAhead} / behind 0\``,
    "- branch-head audit command:",
    "  `node --import tsx scripts/run-state-sync-audit.ts --json`",
    "- expected audit source: `claimSource: structured`",
    "- Git ancestry, divergence, source-tree digest, and strict state path",
    "  checks remain enforced by the state-sync audit.",
    "",
    "## Execution Boundary",
    "",
    "No real provider execution has occurred.",
    "",
    "## State Sync Expectations",
    "",
    "The structured claim records:",
    "",
    `- branch: \`${input.branch}\``,
    "- upstream: `refs/remotes/origin/main`",
    `- validated source commit: \`${input.sourceCommit}\``,
    `- recorded divergence baseline: \`ahead ${input.recordedAhead} / behind 0\``,
    `- transition: \`${input.transitionKind}\``,
    "",
    "For this state record, Git observation should compute the validated",
    `source divergence as \`ahead ${input.recordedAhead} / behind 0\` against`,
    "`refs/remotes/origin/main` at the validated source commit.",
    "",
    "<!-- state-sync-display:start -->",
    "Optional display generated from `docs/current/state-sync-record.json`.",
    "",
    `- branch: \`${input.branch}\``,
    "- upstream: `refs/remotes/origin/main`",
    `- validated source commit: \`${input.sourceCommit}\``,
    `- latest validated commit: \`${input.sourceCommit}\``,
    `- recorded divergence baseline: \`ahead ${input.recordedAhead} / behind 0\``,
    `- transition: \`${input.transitionKind}\``,
    "<!-- state-sync-display:end -->",
    ""
  ].join("\n");
}

async function shortHead(cwd: string): Promise<string> {
  return (await git(cwd, ["rev-parse", "--short", "HEAD"])).trim();
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
    "docs/current/state-sync-record.json"
  ];
}

function policyV2SourceTreeDigestExcludedPaths(): string[] {
  return [
    "docs/current/state-sync-record.json",
    "docs/current/CURRENT_STATE.md",
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
