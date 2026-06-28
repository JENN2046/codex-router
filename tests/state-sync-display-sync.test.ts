import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { syncStateSyncDisplay } from "../scripts/sync-state-sync-display.js";

const CLAIM_BRANCH = "docs/state-sync-display";
const CLAIM_UPSTREAM = "origin/main";
const CLAIM_SOURCE_COMMIT = "abc1234";
const CLAIM_DIGEST =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

test("state-sync display sync checks drift, writes generated fields, then becomes idempotent", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "state-sync-display-sync-"));
  await writeDisplayFixture(cwd, "state_only_pushed");

  const drift = await syncStateSyncDisplay(cwd);
  assert.equal(drift.mode, "check");
  assert.deepEqual(
    new Set(drift.changedPaths),
    new Set([
      "docs/current/CURRENT_STATE.md",
      ".agent_board/CHECKPOINT.md",
      ".agent_board/HANDOFF.md",
      ".agent_board/RUN_STATE.md",
      ".agent_board/TASK_QUEUE.md",
      ".agent_board/VALIDATION_LOG.md"
    ])
  );

  const staleCurrentState = await readFile(
    join(cwd, "docs", "current", "CURRENT_STATE.md"),
    "utf8"
  );
  assert.match(staleCurrentState, /\| Current branch \| `stale-branch` \|/);

  const written = await syncStateSyncDisplay(cwd, { write: true });
  assert.equal(written.mode, "write");
  assert.deepEqual(new Set(written.changedPaths), new Set(drift.changedPaths));

  const currentState = await readFile(
    join(cwd, "docs", "current", "CURRENT_STATE.md"),
    "utf8"
  );
  assert.match(currentState, /\| Current branch \| `docs\/state-sync-display` \|/);
  assert.match(currentState, /\| Current head \| `abc1234` \|/);
  assert.match(currentState, /\| Upstream \| `refs\/remotes\/origin\/main` \|/);
  assert.match(currentState, /\| Upstream divergence \| `ahead 2 \/ behind 0` \|/);
  assert.match(currentState, /- transition kind: `state_only_pushed`/);
  assert.match(currentState, /- branch: `docs\/state-sync-display`/);
  assert.match(
    currentState,
    /For this `state_only_pushed` state-only record, Git observation should\s+compute the validated source divergence as `ahead 0 \/ behind 2` against\s+`refs\/remotes\/origin\/main` after the state-only record is on upstream\./
  );

  const taskQueue = await readFile(
    join(cwd, ".agent_board", "TASK_QUEUE.md"),
    "utf8"
  );
  assert.match(taskQueue, /<!-- state-sync-display:start -->/);
  assert.match(taskQueue, /- branch: `docs\/state-sync-display`/);
  assert.match(taskQueue, /- validated source commit: `abc1234`/);
  assert.match(taskQueue, /- transition: `state_only_pushed`/);

  const clean = await syncStateSyncDisplay(cwd);
  assert.deepEqual(clean.changedPaths, []);
});

test("state-sync display sync preserves pending-push divergence baseline", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "state-sync-display-pending-"));
  await writeDisplayFixture(cwd, "state_only_pending_push");

  await syncStateSyncDisplay(cwd, { write: true });

  const currentState = await readFile(
    join(cwd, "docs", "current", "CURRENT_STATE.md"),
    "utf8"
  );
  assert.match(currentState, /- transition: `state_only_pending_push`/);
  assert.match(
    currentState,
    /For this `state_only_pending_push` record on branch `docs\/state-sync-display`,\s+Git observation should compute the validated source divergence as\s+`ahead 2 \/ behind 0` against `refs\/remotes\/origin\/main` before the state-only\s+record is pushed\./
  );
  assert.doesNotMatch(currentState, /pushed `main` state-only record/);

  const clean = await syncStateSyncDisplay(cwd);
  assert.deepEqual(clean.changedPaths, []);
});

test("state-sync display sync cleans volatile main pushed prose", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "state-sync-display-volatile-"));
  await writeDisplayFixture(cwd, "state_only_pushed", "main");
  await writeFile(
    join(cwd, ".agent_board", "RUN_STATE.md"),
    [
      "# Run State",
      "",
      "Status: Post-PR main state/docs reanchor is prepared for direct push.",
      "",
      "Branch:",
      "",
      "- `stale-branch`",
      ""
    ].join("\n")
  );
  await writeFile(
    join(cwd, ".agent_board", "TASK_QUEUE.md"),
    [
      "# Task Queue",
      "",
      "Current task:",
      "",
      "- Record the post-PR main state/docs reanchor.",
      "",
      "Done:",
      "",
      "- prior work",
      "",
      "Todo:",
      "",
      "- push the post-PR main state/docs reanchor",
      "- verify post-push state-sync audit and main-push CI",
      "",
      "Blocked until separately authorized:",
      "",
      "- release",
      ""
    ].join("\n")
  );

  await syncStateSyncDisplay(cwd, { write: true });

  const runState = await readFile(join(cwd, ".agent_board", "RUN_STATE.md"), "utf8");
  const taskQueue = await readFile(
    join(cwd, ".agent_board", "TASK_QUEUE.md"),
    "utf8"
  );
  assert.doesNotMatch(runState, /prepared for direct push/);
  assert.doesNotMatch(taskQueue, /push the post-PR/);
  assert.doesNotMatch(taskQueue, /verify post-push/);
  assert.match(runState, /Status: Main state-sync record is current and pushed\./);
  assert.match(taskQueue, /no post-merge\s+reanchor is pending/);
});

test("state-sync display sync fails closed when the structured claim is invalid", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "state-sync-display-invalid-"));
  await mkdir(join(cwd, "docs", "current"), { recursive: true });
  await writeFile(
    join(cwd, "docs", "current", "state-sync-record.json"),
    JSON.stringify({ schemaVersion: 1 }, null, 2)
  );

  await assert.rejects(
    () => syncStateSyncDisplay(cwd),
    /Cannot sync state-sync display from invalid claim/
  );
});

async function writeDisplayFixture(
  cwd: string,
  transitionKind: "state_only_pending_push" | "state_only_pushed",
  branch = CLAIM_BRANCH
): Promise<void> {
  await mkdir(join(cwd, "docs", "current"), { recursive: true });
  await mkdir(join(cwd, ".agent_board"), { recursive: true });
  await writeFile(
    join(cwd, "docs", "current", "state-sync-record.json"),
    JSON.stringify({
      schemaVersion: 1,
      policyVersion: "state-sync-policy.v1",
      subject: {
        branch,
        upstream: CLAIM_UPSTREAM
      },
      source: {
        validatedSourceCommit: CLAIM_SOURCE_COMMIT,
        latestValidatedCommit: CLAIM_SOURCE_COMMIT,
        recordedDivergence: {
          ahead: 2,
          behind: 0
        },
        sourceTreeDigest: {
          algorithm: "git-ls-tree-sha256",
          value: CLAIM_DIGEST,
          excludedPaths: strictStateRecordPaths()
        }
      },
      transition: {
        kind: transitionKind,
        allowedStatePaths: strictStateRecordPaths()
      }
    }, null, 2)
  );
  await writeFile(
    join(cwd, "docs", "current", "CURRENT_STATE.md"),
    staleCurrentState()
  );

  await writeFile(
    join(cwd, ".agent_board", "RUN_STATE.md"),
    staleAgentBoard([
      ["Branch:", "stale-branch"],
      ["Current head:", "1111111"],
      ["Validated source commit:", "1111111"],
      ["Latest validated commit:", "1111111"],
      ["Upstream baseline:", "origin/stale"],
      ["Upstream divergence baseline:", "ahead 999 / behind 999"],
      ["Transition:", "source_exact"]
    ])
  );
  await writeFile(
    join(cwd, ".agent_board", "CHECKPOINT.md"),
    staleAgentBoard([
      ["Branch:", "stale-branch"],
      ["Validated source commit:", "1111111"],
      ["Latest validated commit:", "1111111"],
      ["Upstream baseline:", "origin/stale"],
      ["Upstream divergence baseline:", "ahead 999 / behind 999"]
    ])
  );
  await writeFile(
    join(cwd, ".agent_board", "HANDOFF.md"),
    staleAgentBoard([
      ["Current branch:", "stale-branch"],
      ["Current validated source:", "1111111"],
      ["Current transition:", "source_exact"],
      ["Upstream baseline:", "origin/stale"],
      ["Recorded divergence baseline:", "ahead 999 / behind 999"]
    ])
  );
  await writeFile(
    join(cwd, ".agent_board", "TASK_QUEUE.md"),
    "# Task Queue\n\nCurrent task:\n\n- stale display work\n"
  );
  await writeFile(
    join(cwd, ".agent_board", "VALIDATION_LOG.md"),
    staleAgentBoard([
      ["Current branch:", "stale-branch"],
      ["Validated source commit:", "1111111"],
      ["Latest validated commit:", "1111111"],
      ["Upstream baseline:", "origin/stale"],
      ["Upstream divergence baseline:", "ahead 999 / behind 999"]
    ])
  );
}

function staleCurrentState(): string {
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
    "| Current branch | `stale-branch` |",
    "| Current head | `1111111` |",
    "| Validated source commit | `1111111` |",
    "| Upstream | `origin/stale` |",
    "| Upstream divergence | `ahead 999 / behind 999` |",
    "| Latest validated commit | `1111111` |",
    "| State record mode | `source exact` |",
    "| Stale after commit | `true` |",
    "",
    "## Structured Record",
    "",
    "The structured claim records:",
    "",
    "- schema version: `0`",
    "- policy version: `old-policy`",
    "- transition kind: `source_exact`",
    "- validated source commit: `1111111`",
    "- latest validated commit: `1111111`",
    "- upstream baseline: `origin/stale`",
    "- recorded divergence baseline: `ahead 999 / behind 999`",
    "- source tree digest: `old-digest`",
    "  `ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff`",
    "",
    "Strict state record paths:",
    "",
    "- `old/path.md`",
    "",
    "## Validation Baseline",
    "",
    "Validation recorded for source commit `1111111`:",
    "",
    "- `npm run typecheck`: PASS.",
    "",
    "## State Sync Expectations",
    "",
    "- branch: `stale-branch`",
    "- upstream: `origin/stale`",
    "- validated source commit: `1111111`",
    "- recorded divergence baseline: `ahead 999 / behind 999`",
    "- transition: `source_exact`",
    "",
    "For this pushed `main` state-only record, Git observation should compute the",
    "validated source divergence as `ahead 999 / behind 999` against",
    "`origin/stale` after the reanchor commit is on upstream.",
    ""
  ].join("\n");
}

function staleAgentBoard(entries: Array<[string, string]>): string {
  return [
    "# Agent Board",
    "",
    "Current truth source: `docs/current/CURRENT_STATE.md`",
    "",
    ...entries.flatMap(([label, value]) => [
      label,
      "",
      `- \`${value}\``,
      ""
    ])
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
