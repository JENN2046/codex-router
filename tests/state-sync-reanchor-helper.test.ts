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

test("state-sync reanchor helper writes the record and generated displays", async () => {
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
  assert.ok(result.changedPaths.includes("docs/current/state-sync-record.json"));
  assert.ok(result.changedPaths.includes("docs/current/CURRENT_STATE.md"));

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
  assert.match(currentState, new RegExp(`\\| Current head \\| \`${newSource}\` \\|`));
  assert.match(currentState, /\| Upstream divergence \| `ahead 1 \/ behind 0` \|/);
  assert.match(currentState, /source divergence as `ahead 0 \/ behind 1`/);
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

async function createReanchorFixture(): Promise<{
  cwd: string;
  sourceCommit: string;
}> {
  const cwd = await mkdtemp(join(tmpdir(), "state-sync-reanchor-"));
  await git(cwd, ["init", "-b", "main"]);
  await git(cwd, ["config", "user.email", "state-sync@example.invalid"]);
  await git(cwd, ["config", "user.name", "State Sync Test"]);

  await writeSource(cwd, "initial source\n");
  await git(cwd, ["add", "packages/example.txt"]);
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

async function writeSource(cwd: string, value: string): Promise<void> {
  await mkdir(join(cwd, "packages"), { recursive: true });
  await writeFile(join(cwd, "packages", "example.txt"), value, "utf8");
}

async function writeStateSurfaces(
  cwd: string,
  input: {
    sourceCommit: string;
    sourceDigest: string;
    recordedAhead: number;
  }
): Promise<void> {
  await mkdir(join(cwd, "docs", "current"), { recursive: true });
  await mkdir(join(cwd, ".agent_board"), { recursive: true });
  await writeFile(
    join(cwd, "docs", "current", "state-sync-record.json"),
    `${JSON.stringify({
      schemaVersion: 1,
      policyVersion: "state-sync-policy.v1",
      subject: {
        branch: "main",
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
        kind: "state_only_pushed",
        allowedStatePaths: strictStateRecordPaths()
      },
      validation: {
        requiredCommands: [
          "git diff --check",
          "node --import tsx --test tests/state-sync-audit.test.ts",
          "node --import tsx --test tests/state-sync-display-sync.test.ts",
          "npm run typecheck",
          "npm run build",
          "node --import tsx scripts/sync-state-sync-display.ts --check",
          "node --import tsx scripts/run-state-sync-audit.ts --json"
        ]
      }
    }, null, 2)}\n`,
    "utf8"
  );
  await writeFile(
    join(cwd, "docs", "current", "CURRENT_STATE.md"),
    currentState(input),
    "utf8"
  );
  for (const filePath of [
    ".agent_board/CHECKPOINT.md",
    ".agent_board/HANDOFF.md",
    ".agent_board/RUN_STATE.md",
    ".agent_board/TASK_QUEUE.md",
    ".agent_board/VALIDATION_LOG.md"
  ]) {
    await writeFile(join(cwd, filePath), agentBoard(input), "utf8");
  }
}

function currentState(input: {
  sourceCommit: string;
  sourceDigest: string;
  recordedAhead: number;
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
    "| Current branch | `main` |",
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
    "- transition kind: `state_only_pushed`",
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
    "- branch: `main`",
    "- upstream: `refs/remotes/origin/main`",
    `- validated source commit: \`${input.sourceCommit}\``,
    `- recorded divergence baseline: \`ahead ${input.recordedAhead} / behind 0\``,
    "- transition: `state_only_pushed`",
    "",
    "Git observation should compute the validated source divergence as "
      + `\`ahead 0 / behind ${input.recordedAhead}\` against `
      + "`refs/remotes/origin/main`.",
    ""
  ].join("\n");
}

function agentBoard(input: {
  sourceCommit: string;
  recordedAhead: number;
}): string {
  return [
    "# Agent Board",
    "",
    "Branch:",
    "",
    "- `main`",
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
    "Generated from `docs/current/state-sync-record.json`.",
    "",
    "- branch: `main`",
    "- upstream: `refs/remotes/origin/main`",
    `- validated source commit: \`${input.sourceCommit}\``,
    `- latest validated commit: \`${input.sourceCommit}\``,
    `- recorded divergence baseline: \`ahead ${input.recordedAhead} / behind 0\``,
    "- transition: `state_only_pushed`",
    "<!-- state-sync-display:end -->",
    ""
  ].join("\n");
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
