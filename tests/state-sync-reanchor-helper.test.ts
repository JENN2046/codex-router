import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { prepareStateSyncReanchor } from "../scripts/prepare-state-sync-reanchor.js";
import { gitFilteredTreeDigest } from "../scripts/run-state-sync-audit.js";

const execFileAsync = promisify(execFile);

test("state-sync reanchor helper infers a new source commit without writing by default", async () => {
  const repo = await createReanchorFixture();
  await writeSource(repo.cwd, "new source content\n");
  await git(repo.cwd, ["add", "packages/example.txt"]);
  await git(repo.cwd, ["commit", "-m", "feat: new source"]);
  const newSource = await shortHead(repo.cwd);
  const originalRecord = await readRecord(repo.cwd);

  const result = await prepareStateSyncReanchor(repo.cwd);

  assert.equal(result.mode, "check");
  assert.equal(result.branch, "main");
  assert.equal(result.upstream, "refs/remotes/origin/main");
  assert.equal(result.validatedSourceCommit, newSource);
  assert.deepEqual(result.recordedDivergence, { ahead: 1, behind: 0 });
  assert.equal(result.stateCommitsAfterSourceBeforeWrite, 0);
  assert.deepEqual(result.changedPaths, ["docs/current/state-sync-record.json"]);
  assert.equal(await readRecord(repo.cwd), originalRecord);
});

test("state-sync reanchor helper writes only the structured record", async () => {
  const repo = await createReanchorFixture();
  await writeSource(repo.cwd, "new source content\n");
  await git(repo.cwd, ["add", "packages/example.txt"]);
  await git(repo.cwd, ["commit", "-m", "feat: new source"]);
  const newSource = await shortHead(repo.cwd);
  const expectedDigest = await gitFilteredTreeDigest(
    "HEAD",
    strictStateRecordPaths(),
    repo.cwd
  );

  const result = await prepareStateSyncReanchor(repo.cwd, { write: true });

  assert.equal(result.mode, "write");
  assert.equal(result.validatedSourceCommit, newSource);
  assert.equal(result.sourceTreeDigest, expectedDigest);
  assert.deepEqual(result.changedPaths, ["docs/current/state-sync-record.json"]);

  const claim = JSON.parse(await readRecord(repo.cwd));
  assert.equal(claim.subject.branch, "main");
  assert.equal(claim.subject.upstream, "refs/remotes/origin/main");
  assert.equal(claim.source.validatedSourceCommit, newSource);
  assert.equal(claim.source.latestValidatedCommit, newSource);
  assert.deepEqual(claim.source.recordedDivergence, { ahead: 1, behind: 0 });
  assert.equal(claim.source.sourceTreeDigest.value, expectedDigest);
  assert.equal(claim.transition.kind, "state_only_pushed");

  const currentState = await readFile(
    join(repo.cwd, "docs", "current", "CURRENT_STATE.md"),
    "utf8"
  );
  assert.doesNotMatch(currentState, new RegExp(`\\| Current head \\| \`${newSource}\` \\|`));
});

test("state-sync reanchor helper refuses to infer source from a state-only descendant", async () => {
  const repo = await createReanchorFixture();

  await assert.rejects(
    () => prepareStateSyncReanchor(repo.cwd),
    /HEAD appears to be a state-only descendant/
  );

  const result = await prepareStateSyncReanchor(repo.cwd, {
    source: repo.sourceCommit
  });

  assert.equal(result.validatedSourceCommit, repo.sourceCommit);
  assert.deepEqual(result.recordedDivergence, { ahead: 2, behind: 0 });
  assert.equal(result.stateCommitsAfterSourceBeforeWrite, 1);
});

test("state-sync reanchor helper infers HEAD after a squash merge", async () => {
  const repo = await createSquashMergeFixture();

  const result = await prepareStateSyncReanchor(repo.cwd);

  assert.equal(result.validatedSourceCommit, repo.squashCommit);
  assert.deepEqual(result.recordedDivergence, { ahead: 1, behind: 0 });
  assert.equal(result.stateCommitsAfterSourceBeforeWrite, 0);
});

test("state-sync reanchor helper refuses squash HEAD source digest drift", async () => {
  const repo = await createSquashMergeFixture({ sourceDrift: true });

  await assert.rejects(
    () => prepareStateSyncReanchor(repo.cwd),
    /source tree digest does not match/
  );

  const result = await prepareStateSyncReanchor(repo.cwd, { source: "HEAD" });
  assert.equal(result.validatedSourceCommit, repo.squashCommit);
  assert.deepEqual(result.recordedDivergence, { ahead: 1, behind: 0 });
});

test("state-sync reanchor helper refuses non-main branches", async () => {
  const repo = await createReanchorFixture();
  await git(repo.cwd, ["switch", "-c", "feature/reanchor"]);

  await assert.rejects(
    () => prepareStateSyncReanchor(repo.cwd),
    /only runs on main/
  );
});

test("state-sync reanchor helper refuses write mode with a dirty worktree", async () => {
  const repo = await createReanchorFixture();
  await writeSource(repo.cwd, "dirty source edit\n");

  await assert.rejects(
    () => prepareStateSyncReanchor(repo.cwd, {
      write: true,
      source: repo.sourceCommit
    }),
    /dirty worktree/
  );
});

async function createReanchorFixture(): Promise<{
  cwd: string;
  sourceCommit: string;
}> {
  const cwd = await mkdtemp(join(tmpdir(), "state-sync-reanchor-"));
  await git(cwd, ["init", "-b", "main"]);
  await git(cwd, ["config", "user.email", "state-sync@example.invalid"]);
  await git(cwd, ["config", "user.name", "State Sync Test"]);

  await writeStableDisplaySurfaces(cwd);
  await writeSource(cwd, "initial source\n");
  await git(cwd, ["add", "."]);
  await git(cwd, ["commit", "-m", "feat: initial source"]);
  const sourceCommit = await shortHead(cwd);
  const sourceDigest = await gitFilteredTreeDigest(
    "HEAD",
    strictStateRecordPaths(),
    cwd
  );
  assert.ok(sourceDigest);

  await writeStateSurfaces(cwd, {
    sourceCommit,
    sourceDigest,
    recordedAhead: 1
  });
  await git(cwd, ["add", "."]);
  await git(cwd, ["commit", "-m", "docs(state): record state"]);

  return { cwd, sourceCommit };
}

async function createSquashMergeFixture(options: {
  sourceDrift?: boolean;
} = {}): Promise<{
  cwd: string;
  squashCommit: string;
}> {
  const cwd = await mkdtemp(join(tmpdir(), "state-sync-reanchor-squash-"));
  await git(cwd, ["init", "-b", "main"]);
  await git(cwd, ["config", "user.email", "state-sync@example.invalid"]);
  await git(cwd, ["config", "user.name", "State Sync Test"]);

  await writeStableDisplaySurfaces(cwd);
  await writeSource(cwd, "initial source\n");
  await git(cwd, ["add", "."]);
  await git(cwd, ["commit", "-m", "feat: initial source"]);

  await git(cwd, ["switch", "-c", "feature/reanchor"]);
  await writeSource(cwd, "feature source\n");
  await git(cwd, ["add", "packages/example.txt"]);
  await git(cwd, ["commit", "-m", "feat: feature source"]);
  const featureSource = await shortHead(cwd);
  const featureDigest = await gitFilteredTreeDigest(
    "HEAD",
    strictStateRecordPaths(),
    cwd
  );
  assert.ok(featureDigest);

  await writeStateSurfaces(cwd, {
    branch: "feature/reanchor",
    sourceCommit: featureSource,
    sourceDigest: featureDigest,
    recordedAhead: 1,
    transitionKind: "state_only_pending_push"
  });
  await git(cwd, ["add", "."]);
  await git(cwd, ["commit", "-m", "docs(state): record feature state"]);

  await git(cwd, ["switch", "main"]);
  await git(cwd, ["merge", "--squash", "feature/reanchor"]);
  if (options.sourceDrift === true) {
    await writeSource(cwd, "tampered squash source\n");
    await git(cwd, ["add", "packages/example.txt"]);
  }
  await git(cwd, ["commit", "-m", "squash feature"]);

  return {
    cwd,
    squashCommit: await shortHead(cwd)
  };
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
    branch?: string;
    sourceCommit: string;
    sourceDigest: string;
    recordedAhead: number;
    transitionKind?: "state_only_pending_push" | "state_only_pushed";
  }
): Promise<void> {
  const branch = input.branch ?? "main";
  const transitionKind = input.transitionKind ?? "state_only_pushed";
  await mkdir(join(cwd, "docs", "current"), { recursive: true });
  await writeFile(
    join(cwd, "docs", "current", "state-sync-record.json"),
    `${JSON.stringify({
      schemaVersion: 1,
      policyVersion: "state-sync-policy.v1",
      subject: {
        branch,
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
        kind: transitionKind,
        allowedStatePaths: strictStateRecordPaths()
      },
      validation: {
        requiredCommands: [
          "git diff --check",
          "node --import tsx --test tests/state-sync-audit.test.ts",
          "node --import tsx --test tests/state-sync-display-sync.test.ts",
          "npm run typecheck",
          "npm run build",
          "node --import tsx scripts/run-state-sync-audit.ts --json"
        ]
      }
    }, null, 2)}\n`,
    "utf8"
  );
}

function currentState(input: {
  branch: string;
  sourceCommit: string;
  sourceDigest: string;
  recordedAhead: number;
  transitionKind: "state_only_pending_push" | "state_only_pushed";
}): string {
  return [
    "# Current State",
    "",
    "CURRENT_STATE_RECORDED",
    "",
    "## Snapshot",
    "",
    "| Field | Value |",
    "| --- | --- |",
    "| Workspace | `codex-router/repo` |",
    `| Current branch | \`${input.branch}\` |`,
    `| Current head | \`${input.sourceCommit}\` |`,
    `| Validated source commit | \`${input.sourceCommit}\` |`,
    "| Upstream | `refs/remotes/origin/main` |",
    `| Upstream divergence | \`ahead ${input.recordedAhead} / behind 0\` |`,
    `| Latest validated commit | \`${input.sourceCommit}\` |`,
    "| State record mode | `state-only descendant allowed` |",
    "| Stale after commit | `true` |",
    "| Synthetic review checkout | `allowed` |",
    "",
    "## Structured Record",
    "",
    "The structured claim records:",
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
    ...strictStateRecordPaths().map((filePath) => `- \`${filePath}\``),
    "",
    "## Validation Baseline",
    "",
    `Validation recorded for source commit \`${input.sourceCommit}\`:`,
    "",
    "- `git diff --check`: PASS.",
    "",
    "## State Sync Expectations",
    "",
    `- branch: \`${input.branch}\``,
    "- upstream: `refs/remotes/origin/main`",
    `- validated source commit: \`${input.sourceCommit}\``,
    `- recorded divergence baseline: \`ahead ${input.recordedAhead} / behind 0\``,
    `- transition: \`${input.transitionKind}\``,
    "",
    "Git observation should compute the validated source divergence as "
      + `\`ahead 0 / behind ${input.recordedAhead}\` against `
      + "`refs/remotes/origin/main`.",
    ""
  ].join("\n");
}

function agentBoard(input: {
  branch: string;
  sourceCommit: string;
  recordedAhead: number;
  transitionKind: "state_only_pending_push" | "state_only_pushed";
}): string {
  return [
    "# Agent Board",
    "",
    "Branch:",
    "",
    `- \`${input.branch}\``,
    "",
    "Validated source commit:",
    "",
    `- \`${input.sourceCommit}\``,
    "",
    "Upstream divergence baseline:",
    "",
    `- \`ahead ${input.recordedAhead} / behind 0\``,
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

function strictStateRecordPaths(): string[] {
  return [
    "docs/current/state-sync-record.json"
  ];
}

async function readRecord(cwd: string): Promise<string> {
  return readFile(join(cwd, "docs", "current", "state-sync-record.json"), "utf8");
}

async function shortHead(cwd: string): Promise<string> {
  return (await git(cwd, ["rev-parse", "--short", "HEAD"])).trim();
}

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, {
    cwd,
    encoding: "utf8",
    windowsHide: true
  });
  return stdout;
}
