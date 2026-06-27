import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import {
  formatStateSyncAuditResult,
  reviewStateSyncAudit,
  type StateSyncAuditInput
} from "../packages/state-sync-audit/src/index.js";
import {
  collectAllowedStateCommits,
  collectStateSyncAuditInput
} from "../scripts/run-state-sync-audit.js";

const execFileAsync = promisify(execFile);

test("state sync audit passes when clean HEAD equals validated source commit", async () => {
  const review = reviewStateSyncAudit(await createInputFromWorkspace());

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.summary.claimSource, "legacy_markdown");
  assert.equal(review.checks.currentStateRecorded, true);
  assert.equal(review.checks.currentBranchMatches, true);
  assert.equal(review.checks.validatedSourceHeadRecorded, true);
  assert.equal(review.checks.validatedSourceCommitRecorded, true);
  assert.equal(review.checks.validatedSourceDivergenceRecorded, true);
  assert.equal(review.checks.latestValidatedCommitRecorded, true);
  assert.equal(review.checks.dirtyWorktreeStateOnly, true);
  assert.equal(review.checks.agentBoardAligned, true);
  assert.equal(review.checks.staleMarkersAbsent, true);
  assert.equal(review.checks.structuredClaimValid, true);
  assert.equal(review.summary.requiredValidationCommandCount, 4);
  assert.equal(review.summary.requiredBoundaryMarkerCount, 7);
  assert.equal(review.summary.stateWritesDuringAudit, 0);
  assert.equal(review.summary.remoteWritesDuringAudit, 0);
});

test("state sync audit uses a valid structured claim for core facts", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewStateSyncAudit({
    ...input,
    stateSyncClaimText: stateSyncClaimTextFromInput(input),
    currentStateText: input.currentStateText
      .replace(/\| Current branch \| `[^`]+` \|/, "| Current branch | `stale-branch` |")
      .replace(/\| Current head \| `[^`]+` \|/, "| Current head | `1111111` |")
      .replace(/\| Validated source commit \| `[^`]+` \|/, "| Validated source commit | `2222222` |")
      .replace(/\| Upstream \| `[^`]+` \|/, "| Upstream | `origin/stale` |")
      .replace(/\| Upstream divergence \| `[^`]+` \|/, "| Upstream divergence | `ahead 999 / behind 999` |")
      .replace(/\| Latest validated commit \| `[^`]+` \|/, "| Latest validated commit | `3333333` |")
  });

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.summary.claimSource, "structured");
  assert.equal(review.checks.currentBranchMatches, true);
  assert.equal(review.checks.validatedSourceHeadRecorded, true);
  assert.equal(review.checks.validatedSourceCommitRecorded, true);
  assert.equal(review.checks.validatedSourceDivergenceRecorded, true);
  assert.equal(review.checks.latestValidatedCommitRecorded, true);
  assert.equal(review.checks.structuredTransitionAllowed, true);
  assert.ok(review.issues.some((issue) => (
    issue.code === "state_document_evidence_drift"
    && issue.field === "Validated source commit"
  )));
});

test("state sync audit blocks structured claims with stale subject branch", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewStateSyncAudit({
    ...input,
    stateSyncClaimText: stateSyncClaimTextFromInput(input, {
      branch: `${input.branch}-stale`
    })
  });

  assert.equal(review.status, "blocked");
  assert.equal(review.summary.claimSource, "structured");
  assert.equal(review.checks.currentBranchMatches, false);
  assert.ok(review.reasons.includes("state_sync_currentBranchMatches"));
});

test("state sync audit blocks structured claims with empty subject branch in detached checkouts", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewStateSyncAudit({
    ...input,
    branch: "",
    stateSyncClaimText: stateSyncClaimTextFromInput(input, {
      branch: ""
    })
  });

  assert.equal(review.status, "blocked");
  assert.equal(review.summary.claimSource, "invalid_structured");
  assert.equal(review.checks.structuredClaimValid, false);
  assert.equal(review.checks.currentBranchMatches, false);
  assert.ok(review.reasons.includes("state_sync_structuredClaimValid"));
  assert.ok(review.reasons.includes("state_sync_currentBranchMatches"));
});

test("state sync audit blocks structured claims with stale subject upstream", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewStateSyncAudit({
    ...input,
    stateSyncClaimText: stateSyncClaimTextFromInput(input, {
      upstream: `${input.upstream}-stale`
    })
  });

  assert.equal(review.status, "blocked");
  assert.equal(review.summary.claimSource, "structured");
  assert.equal(review.checks.upstreamRecorded, false);
  assert.ok(review.reasons.includes("state_sync_upstreamRecorded"));
});

test("state sync audit blocks structured claims with stale source commits", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewStateSyncAudit({
    ...input,
    stateSyncClaimText: stateSyncClaimTextFromInput(input, {
      validatedSourceCommit: "1111111",
      latestValidatedCommit: "1111111"
    })
  });

  assert.equal(review.status, "blocked");
  assert.equal(review.summary.claimSource, "structured");
  assert.equal(review.checks.validatedSourceHeadRecorded, false);
  assert.equal(review.checks.validatedSourceCommitRecorded, false);
  assert.equal(review.checks.latestValidatedCommitRecorded, false);
});

test("state sync audit blocks source_exact claims on state-only descendants", async () => {
  const input = await createInputFromWorkspace();
  const baseline = parseTestAheadBehind(input.validatedSourceAheadBehind);
  const review = reviewStateSyncAudit({
    ...input,
    head: "3333333",
    aheadBehind: `${baseline.ahead + 1}\t${baseline.behind}`,
    validatedSourceAncestorOfHead: true,
    committedPathsSinceValidatedSource: strictStateRecordPaths(),
    stateSyncClaimText: stateSyncClaimTextFromInput(input)
  });

  assert.equal(review.status, "blocked");
  assert.equal(review.summary.claimSource, "structured");
  assert.equal(review.checks.validatedSourceHeadRecorded, true);
  assert.equal(review.checks.structuredTransitionAllowed, false);
  assert.ok(review.reasons.includes("state_sync_structuredTransitionAllowed"));
});

test("state sync audit accepts structured state_only_pending_push transitions", async () => {
  const input = await createInputFromWorkspace();
  const baseline = parseTestAheadBehind(input.validatedSourceAheadBehind);
  const review = reviewStateSyncAudit({
    ...input,
    head: "3333333",
    aheadBehind: `${baseline.ahead + 1}\t${baseline.behind}`,
    validatedSourceAncestorOfHead: true,
    committedPathsSinceValidatedSource: strictStateRecordPaths(),
    stateSyncClaimText: stateSyncClaimTextFromInput(input, {
      transitionKind: "state_only_pending_push"
    })
  });

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.summary.claimSource, "structured");
  assert.equal(review.checks.structuredTransitionAllowed, true);
});

test("state sync audit accepts structured state_only_pushed transitions", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewStateSyncAudit({
    ...input,
    head: "3333333",
    aheadBehind: "0\t0",
    validatedSourceAheadBehind: "0\t1",
    validatedSourceAncestorOfHead: true,
    committedPathsSinceValidatedSource: strictStateRecordPaths(),
    stateSyncClaimText: stateSyncClaimTextFromInput(input, {
      transitionKind: "state_only_pushed",
      recordedAhead: 1,
      recordedBehind: 0
    })
  });

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.summary.claimSource, "structured");
  assert.equal(review.checks.validatedSourceDivergenceRecorded, true);
  assert.equal(review.checks.structuredTransitionAllowed, true);
});

test("state sync audit blocks structured claims with stale divergence", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewStateSyncAudit({
    ...input,
    stateSyncClaimText: stateSyncClaimTextFromInput(input, {
      recordedAhead: 999,
      recordedBehind: 999
    })
  });

  assert.equal(review.status, "blocked");
  assert.equal(review.summary.claimSource, "structured");
  assert.equal(review.checks.validatedSourceDivergenceRecorded, false);
  assert.ok(review.reasons.includes("state_sync_validatedSourceDivergenceRecorded"));
});

test("state sync audit applies structured claim allowed paths to dirty worktree checks", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewStateSyncAudit({
    ...input,
    gitStatusShort: " M .agent_board/RUN_STATE.md",
    stateSyncClaimText: stateSyncClaimTextFromInput(input, {
      allowedStatePaths: ["docs/current/CURRENT_STATE.md"]
    })
  });

  assert.equal(review.status, "blocked");
  assert.equal(review.summary.claimSource, "structured");
  assert.equal(review.checks.dirtyWorktreeStateOnly, false);
  assert.ok(review.reasons.includes("state_sync_dirtyWorktreeStateOnly"));
});

test("state sync audit applies structured claim allowed paths to state-only descendants", async () => {
  const input = await createInputFromWorkspace();
  const baseline = parseTestAheadBehind(input.validatedSourceAheadBehind);
  const review = reviewStateSyncAudit({
    ...input,
    head: "3333333",
    aheadBehind: `${baseline.ahead + 1}\t${baseline.behind}`,
    validatedSourceAncestorOfHead: true,
    committedPathsSinceValidatedSource: [".agent_board/RUN_STATE.md"],
    stateSyncClaimText: stateSyncClaimTextFromInput(input, {
      allowedStatePaths: ["docs/current/CURRENT_STATE.md"]
    })
  });

  assert.equal(review.status, "blocked");
  assert.equal(review.summary.claimSource, "structured");
  assert.equal(review.checks.validatedSourceHeadRecorded, false);
  assert.equal(review.checks.validatedSourceCommitRecorded, false);
  assert.equal(review.checks.latestValidatedCommitRecorded, false);
});

test("state sync audit fails closed on malformed structured claims", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewStateSyncAudit({
    ...input,
    stateSyncClaimText: "{"
  });

  assert.equal(review.status, "blocked");
  assert.equal(review.summary.claimSource, "invalid_structured");
  assert.equal(review.checks.structuredClaimValid, false);
  assert.ok(review.reasons.includes("state_sync_structuredClaimValid"));
  assert.equal(review.checks.validatedSourceHeadRecorded, false);
  assert.equal(review.checks.validatedSourceCommitRecorded, false);
  assert.equal(review.checks.latestValidatedCommitRecorded, false);
});

test("state sync audit fails closed on unknown structured claim schema", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewStateSyncAudit({
    ...input,
    stateSyncClaimText: stateSyncClaimTextFromInput(input, {
      schemaVersion: 999
    })
  });

  assert.equal(review.status, "blocked");
  assert.equal(review.summary.claimSource, "invalid_structured");
  assert.equal(review.checks.structuredClaimValid, false);
});

test("state sync audit fails closed on unknown structured claim policy", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewStateSyncAudit({
    ...input,
    stateSyncClaimText: stateSyncClaimTextFromInput(input, {
      policyVersion: "state-sync-policy.v999"
    })
  });

  assert.equal(review.status, "blocked");
  assert.equal(review.summary.claimSource, "invalid_structured");
  assert.equal(review.checks.structuredClaimValid, false);
});

test("state sync audit fails closed on invalid structured claim transition", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewStateSyncAudit({
    ...input,
    stateSyncClaimText: stateSyncClaimTextFromInput(input, {
      transitionKind: "merge_ref_checkout"
    })
  });

  assert.equal(review.status, "blocked");
  assert.equal(review.summary.claimSource, "invalid_structured");
  assert.equal(review.checks.structuredClaimValid, false);
});

test("state sync audit accepts dirty state-only files", async () => {
  const review = reviewStateSyncAudit(await createInputFromWorkspace({
    gitStatusShort: [
      " M .agent_board/RUN_STATE.md",
      " M docs/current/CURRENT_STATE.md"
    ].join("\n")
  }));

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.dirtyWorktreeStateOnly, true);
  assert.equal(review.summary.gitStatusEntryCount, 2);
});

test("state sync audit blocks dirty non-state files", async () => {
  const review = reviewStateSyncAudit(await createInputFromWorkspace({
    gitStatusShort: " M packages/state-sync-audit/src/index.ts"
  }));

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("state_sync_dirtyWorktreeStateOnly"));
});

test("state sync audit accepts committed state-only descendants", async () => {
  const input = await createInputFromWorkspace();
  const baseline = parseTestAheadBehind(input.validatedSourceAheadBehind);
  const review = reviewStateSyncAudit({
    ...input,
    head: "2222222",
    aheadBehind: `${baseline.ahead + 1}\t${baseline.behind}`,
    validatedSourceAncestorOfHead: true,
    committedPathsSinceValidatedSource: [
      ".agent_board/RUN_STATE.md",
      ".agent_board/HANDOFF.md",
      "docs/current/CURRENT_STATE.md"
    ]
  });

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.validatedSourceHeadRecorded, true);
  assert.equal(review.checks.validatedSourceCommitRecorded, true);
  assert.equal(review.checks.validatedSourceDivergenceRecorded, true);
  assert.equal(review.checks.latestValidatedCommitRecorded, true);
  assert.equal(review.summary.ahead, baseline.ahead + 1);
  assert.equal(review.summary.validatedSourceAhead, baseline.ahead);
});

test("state sync audit blocks non-state commits after validated source", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewStateSyncAudit({
    ...input,
    head: "2222222",
    validatedSourceAncestorOfHead: true,
    committedPathsSinceValidatedSource: [
      ".agent_board/RUN_STATE.md",
      "packages/state-sync-audit/src/index.ts",
      "scripts/run-state-sync-audit.ts",
      "tests/state-sync-audit.test.ts"
    ]
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("state_sync_validatedSourceHeadRecorded"));
  assert.ok(review.reasons.includes("state_sync_validatedSourceCommitRecorded"));
  assert.ok(review.reasons.includes("state_sync_latestValidatedCommitRecorded"));
});

test("state sync audit blocks unreachable validated source commits", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewStateSyncAudit({
    ...input,
    head: "2222222",
    validatedSourceAncestorOfHead: false,
    committedPathsSinceValidatedSource: [
      ".agent_board/RUN_STATE.md",
      "docs/current/CURRENT_STATE.md"
    ]
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("state_sync_validatedSourceHeadRecorded"));
  assert.ok(review.reasons.includes("state_sync_validatedSourceCommitRecorded"));
  assert.ok(review.reasons.includes("state_sync_latestValidatedCommitRecorded"));
});

test("state sync audit blocks stale validated source commits", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewStateSyncAudit({
    ...input,
    currentStateText: input.currentStateText.replace(
      /\| Latest validated commit \| `[^`]+` \|/,
      "| Latest validated commit | `1111111` |"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("state_sync_validatedSourceHeadRecorded"));
  assert.ok(review.reasons.includes("state_sync_validatedSourceCommitRecorded"));
  assert.ok(review.reasons.includes("state_sync_latestValidatedCommitRecorded"));
});

test("state sync audit blocks stale current branch and missing head fields", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewStateSyncAudit({
    ...input,
    branch: `${input.branch}-stale`,
    currentStateText: input.currentStateText
      .replace(/\| Current head \| `[^`]+` \|/, "| Current head |  |")
      .replace(/\| Latest validated commit \| `[^`]+` \|/, "| Latest validated commit |  |")
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("state_sync_currentBranchMatches"));
  assert.ok(review.reasons.includes("state_sync_validatedSourceHeadRecorded"));
  assert.ok(review.reasons.includes("state_sync_latestValidatedCommitRecorded"));
});

test("state sync audit blocks mismatched current head hashes", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewStateSyncAudit({
    ...input,
    currentStateText: input.currentStateText
      .replace(/\| Current head \| `[^`]+` \|/, "| Current head | `deadbee` |")
      .replace(/\| Latest validated commit \| `[^`]+` \|/, "| Latest validated commit | `feed123` |")
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("state_sync_validatedSourceHeadRecorded"));
  assert.ok(review.reasons.includes("state_sync_latestValidatedCommitRecorded"));
});

test("state sync audit blocks stale state from merge checkout second-parent ancestry", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewStateSyncAudit({
    ...input,
    head: "83b8770",
    parentHead: "f37f174",
    allowedStateCommits: [input.head, input.parentHead ?? input.head]
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("state_sync_validatedSourceHeadRecorded"));
  assert.ok(review.reasons.includes("state_sync_validatedSourceCommitRecorded"));
  assert.ok(review.reasons.includes("state_sync_latestValidatedCommitRecorded"));
});

test("state sync audit blocks stale state from shallow merge second-parent parent", async () => {
  const input = await createInputFromWorkspace();
  const recordedHead = input.currentStateText.match(/\| Current head \| `([^`]+)` \|/)?.[1];

  assert.ok(recordedHead);

  const review = reviewStateSyncAudit({
    ...input,
    head: "78c110e",
    parentHead: "f37f174",
    allowedStateCommits: ["c1db64a", recordedHead]
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("state_sync_validatedSourceHeadRecorded"));
  assert.ok(review.reasons.includes("state_sync_validatedSourceCommitRecorded"));
  assert.ok(review.reasons.includes("state_sync_latestValidatedCommitRecorded"));
});

test("state sync audit blocks clean synthetic review checkouts with stale anchor", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewStateSyncAudit(asCleanSyntheticReviewInput(input));

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("state_sync_validatedSourceHeadRecorded"));
  assert.ok(review.reasons.includes("state_sync_validatedSourceCommitRecorded"));
  assert.ok(review.reasons.includes("state_sync_latestValidatedCommitRecorded"));
});

test("state sync audit blocks unreachable synthetic anchors with validated source evidence", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewStateSyncAudit(asDetachedSyntheticReviewInput(input, {
    validatedSourceAncestorOfHead: false,
    committedPathsSinceValidatedSource: [
      ".agent_board/RUN_STATE.md",
      "docs/current/CURRENT_STATE.md"
    ]
  }));

  assert.equal(review.status, "blocked");
  assert.equal(review.checks.validatedSourceDivergenceRecorded, true);
  assert.equal(review.checks.validatedSourceHeadRecorded, false);
  assert.equal(review.checks.validatedSourceCommitRecorded, false);
  assert.equal(review.checks.latestValidatedCommitRecorded, false);
  assert.ok(review.reasons.includes("state_sync_validatedSourceHeadRecorded"));
  assert.ok(review.reasons.includes("state_sync_validatedSourceCommitRecorded"));
  assert.ok(review.reasons.includes("state_sync_latestValidatedCommitRecorded"));
});

test("state sync audit blocks synthetic anchors when validated source paths are unknown", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewStateSyncAudit(asDetachedSyntheticReviewInput(input, {
    validatedSourceAncestorOfHead: true
  }));

  assert.equal(review.status, "blocked");
  assert.equal(review.checks.validatedSourceHeadRecorded, false);
  assert.equal(review.checks.validatedSourceCommitRecorded, false);
  assert.equal(review.checks.latestValidatedCommitRecorded, false);
  assert.ok(review.reasons.includes("state_sync_validatedSourceHeadRecorded"));
  assert.ok(review.reasons.includes("state_sync_validatedSourceCommitRecorded"));
  assert.ok(review.reasons.includes("state_sync_latestValidatedCommitRecorded"));
});

test("state sync audit preserves legacy synthetic fallback without validated source evidence", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewStateSyncAudit(asDetachedSyntheticReviewInput(input));

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.validatedSourceHeadRecorded, true);
  assert.equal(review.checks.validatedSourceCommitRecorded, true);
  assert.equal(review.checks.validatedSourceDivergenceRecorded, true);
  assert.equal(review.checks.latestValidatedCommitRecorded, true);
});

test("state sync audit still accepts valid state-only descendants after synthetic hardening", async () => {
  const input = await createInputFromWorkspace();
  const baseline = parseTestAheadBehind(input.validatedSourceAheadBehind);
  const review = reviewStateSyncAudit({
    ...input,
    head: "3333333",
    aheadBehind: `${baseline.ahead + 1}\t${baseline.behind}`,
    validatedSourceAncestorOfHead: true,
    committedPathsSinceValidatedSource: strictStateRecordPaths()
  });

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.validatedSourceHeadRecorded, true);
  assert.equal(review.checks.validatedSourceCommitRecorded, true);
  assert.equal(review.checks.latestValidatedCommitRecorded, true);
});

test("state sync audit accepts clean detached PR checkouts when explicitly allowed", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewStateSyncAudit({
    ...input,
    gitStatusShort: "",
    branch: "",
    head: "8a5c580",
    allowedStateCommits: [input.head],
    upstream: "",
    aheadBehind: "unknown\tunknown",
    validatedSourceAheadBehind: "unknown\tunknown",
    validatedSourceAncestorOfHead: false,
    committedPathsSinceValidatedSource: [
      "packages/kernel-store/src/jsonl-event-log.ts",
      "packages/state-sync-audit/src/index.ts",
      "scripts/run-state-sync-audit.ts",
      "tests/state-sync-audit.test.ts"
    ]
  });

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.currentBranchMatches, true);
  assert.equal(review.checks.validatedSourceHeadRecorded, true);
  assert.equal(review.checks.validatedSourceCommitRecorded, true);
  assert.equal(review.checks.validatedSourceDivergenceRecorded, true);
});

test("state sync audit blocks detached PR checkouts without explicit state marker", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewStateSyncAudit({
    ...input,
    gitStatusShort: "",
    branch: "",
    head: "8a5c580",
    allowedStateCommits: [],
    upstream: "",
    aheadBehind: "unknown\tunknown",
    validatedSourceAheadBehind: "unknown\tunknown",
    validatedSourceAncestorOfHead: false,
    committedPathsSinceValidatedSource: [
      "packages/state-sync-audit/src/index.ts"
    ],
    currentStateText: input.currentStateText.replace(
      /\| Synthetic review checkout \| `allowed` \|\n/,
      ""
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("state_sync_validatedSourceHeadRecorded"));
  assert.ok(review.reasons.includes("state_sync_validatedSourceCommitRecorded"));
  assert.ok(review.reasons.includes("state_sync_latestValidatedCommitRecorded"));
  assert.ok(review.reasons.includes("state_sync_agentBoardAligned"));
});

test("state sync audit blocks non-detached synthetic markers with stale anchors", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewStateSyncAudit({
    ...input,
    head: "8a5c580",
    validatedSourceAncestorOfHead: false,
    committedPathsSinceValidatedSource: [
      "packages/state-sync-audit/src/index.ts"
    ]
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("state_sync_validatedSourceHeadRecorded"));
  assert.ok(review.reasons.includes("state_sync_validatedSourceCommitRecorded"));
  assert.ok(review.reasons.includes("state_sync_latestValidatedCommitRecorded"));
});

test("state sync audit blocks stale state outside merge checkout ancestry", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewStateSyncAudit({
    ...input,
    head: "83b8770",
    parentHead: "f37f174",
    allowedStateCommits: ["abc1234"]
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("state_sync_validatedSourceHeadRecorded"));
  assert.ok(review.reasons.includes("state_sync_validatedSourceCommitRecorded"));
  assert.ok(review.reasons.includes("state_sync_latestValidatedCommitRecorded"));
  assert.ok(review.reasons.includes("state_sync_agentBoardAligned"));
});

test("state sync audit blocks merge base as state when merge ancestry is available", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewStateSyncAudit({
    ...input,
    head: "83b8770",
    parentHead: "f37f174",
    allowedStateCommits: ["c1db64a"],
    currentStateText: input.currentStateText
      .replace(/\| Current head \| `[^`]+` \|/, "| Current head | `f37f174` |")
      .replace(/\| Latest validated commit \| `[^`]+` \|/, "| Latest validated commit | `f37f174` |"),
    agentBoardText: input.agentBoardText.replace(/\b[0-9a-f]{7,40}\b/g, "f37f174")
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("state_sync_validatedSourceHeadRecorded"));
  assert.ok(review.reasons.includes("state_sync_validatedSourceCommitRecorded"));
  assert.ok(review.reasons.includes("state_sync_latestValidatedCommitRecorded"));
  assert.ok(review.reasons.includes("state_sync_agentBoardAligned"));
});

test("state sync audit collector excludes merge base from allowed commits", () => {
  const allowed = collectAllowedStateCommits({
    mergeBaseHead: "f37f174",
    mergeParentHead: "c1db64a",
    mergeParentParentHead: "f37f174",
    mergeParentDeclaredParents: [
      "f37f174aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "abc1234bbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
    ].join(" ")
  });

  assert.deepEqual(allowed, ["c1db64a", "abc1234"]);
});

test("state sync audit blocks mismatched validated source upstream divergence", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewStateSyncAudit({
    ...input,
    currentStateText: input.currentStateText.replace(
      /\| Upstream divergence \| `[^`]+` \|/,
      "| Upstream divergence | `ahead 999 / behind 999` |"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("state_sync_validatedSourceDivergenceRecorded"));
});

test("state sync audit ignores current ahead drift from state-only descendants", async () => {
  const input = await createInputFromWorkspace();
  const baseline = parseTestAheadBehind(input.validatedSourceAheadBehind);
  const review = reviewStateSyncAudit({
    ...input,
    head: "3333333",
    aheadBehind: `${baseline.ahead + 1}\t${baseline.behind}`,
    validatedSourceAncestorOfHead: true,
    committedPathsSinceValidatedSource: strictStateRecordPaths()
  });

  assert.equal(review.status, "passed");
  assert.equal(review.checks.validatedSourceDivergenceRecorded, true);
  assert.equal(review.summary.ahead, baseline.ahead + 1);
  assert.equal(review.summary.validatedSourceAhead, baseline.ahead);
});

test("state sync audit accepts pushed state-only divergence snapshots", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewStateSyncAudit({
    ...input,
    head: "3333333",
    aheadBehind: "0\t0",
    validatedSourceAheadBehind: "0\t1",
    validatedSourceAncestorOfHead: true,
    committedPathsSinceValidatedSource: strictStateRecordPaths(),
    currentStateText: input.currentStateText.replace(
      /\| Upstream divergence \| `[^`]+` \|/,
      "| Upstream divergence | `ahead 1 / behind 0` |"
    )
  });

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.validatedSourceDivergenceRecorded, true);
  assert.equal(review.summary.validatedSourceAhead, 0);
  assert.equal(review.summary.validatedSourceBehind, 1);
});

test("state sync audit blocks arbitrary syntactic divergence snapshots", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewStateSyncAudit({
    ...input,
    head: "3333333",
    aheadBehind: "0\t0",
    validatedSourceAheadBehind: "0\t1",
    validatedSourceAncestorOfHead: true,
    committedPathsSinceValidatedSource: strictStateRecordPaths(),
    currentStateText: input.currentStateText.replace(
      /\| Upstream divergence \| `[^`]+` \|/,
      "| Upstream divergence | `ahead 999 / behind 999` |"
    )
  });

  assert.equal(review.status, "blocked");
  assert.equal(review.checks.validatedSourceDivergenceRecorded, false);
  assert.ok(review.reasons.includes("state_sync_validatedSourceDivergenceRecorded"));
});

test("state sync audit blocks wrong inverse divergence snapshots", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewStateSyncAudit({
    ...input,
    head: "3333333",
    aheadBehind: "0\t0",
    validatedSourceAheadBehind: "0\t2",
    validatedSourceAncestorOfHead: true,
    committedPathsSinceValidatedSource: strictStateRecordPaths(),
    currentStateText: input.currentStateText.replace(
      /\| Upstream divergence \| `[^`]+` \|/,
      "| Upstream divergence | `ahead 1 / behind 0` |"
    )
  });

  assert.equal(review.status, "blocked");
  assert.equal(review.checks.validatedSourceDivergenceRecorded, false);
  assert.ok(review.reasons.includes("state_sync_validatedSourceDivergenceRecorded"));
});

test("state sync audit blocks pushed snapshots without state record mode", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewStateSyncAudit({
    ...input,
    head: "3333333",
    aheadBehind: "0\t0",
    validatedSourceAheadBehind: "0\t1",
    validatedSourceAncestorOfHead: true,
    committedPathsSinceValidatedSource: strictStateRecordPaths(),
    currentStateText: input.currentStateText.replace(
      /\| State record mode \| `[^`]+` \|\n/,
      ""
    )
  });

  assert.equal(review.status, "blocked");
  assert.equal(review.checks.validatedSourceDivergenceRecorded, false);
  assert.ok(review.reasons.includes("state_sync_validatedSourceDivergenceRecorded"));
});

test("state sync audit blocks pushed snapshots with wrong state record mode", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewStateSyncAudit({
    ...input,
    head: "3333333",
    aheadBehind: "0\t0",
    validatedSourceAheadBehind: "0\t1",
    validatedSourceAncestorOfHead: true,
    committedPathsSinceValidatedSource: strictStateRecordPaths(),
    currentStateText: input.currentStateText.replace(
      /\| State record mode \| `[^`]+` \|/,
      "| State record mode | `source-only` |"
    )
  });

  assert.equal(review.status, "blocked");
  assert.equal(review.checks.validatedSourceDivergenceRecorded, false);
  assert.ok(review.reasons.includes("state_sync_validatedSourceDivergenceRecorded"));
});

test("state sync audit blocks snapshot fallbacks with extra board paths", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewStateSyncAudit({
    ...input,
    head: "3333333",
    aheadBehind: "0\t0",
    validatedSourceAheadBehind: "0\t1",
    validatedSourceAncestorOfHead: true,
    committedPathsSinceValidatedSource: [
      ...strictStateRecordPaths(),
      ".agent_board/EXTRA.md"
    ]
  });

  assert.equal(review.status, "blocked");
  assert.equal(review.checks.validatedSourceHeadRecorded, true);
  assert.equal(review.checks.validatedSourceCommitRecorded, true);
  assert.equal(review.checks.validatedSourceDivergenceRecorded, false);
  assert.equal(review.checks.latestValidatedCommitRecorded, true);
  assert.ok(review.reasons.includes("state_sync_validatedSourceDivergenceRecorded"));
});

test("state sync audit blocks non-state descendants with stale divergence snapshots", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewStateSyncAudit({
    ...input,
    head: "3333333",
    aheadBehind: "0\t0",
    validatedSourceAheadBehind: "0\t1",
    validatedSourceAncestorOfHead: true,
    committedPathsSinceValidatedSource: [
      ".agent_board/RUN_STATE.md",
      "packages/state-sync-audit/src/index.ts",
      "tests/state-sync-audit.test.ts",
      "scripts/run-state-sync-audit.ts",
      ".github/workflows/ci.yml"
    ]
  });

  assert.equal(review.status, "blocked");
  assert.equal(review.checks.validatedSourceDivergenceRecorded, false);
  assert.ok(review.reasons.includes("state_sync_validatedSourceHeadRecorded"));
  assert.ok(review.reasons.includes("state_sync_validatedSourceCommitRecorded"));
  assert.ok(review.reasons.includes("state_sync_validatedSourceDivergenceRecorded"));
  assert.ok(review.reasons.includes("state_sync_latestValidatedCommitRecorded"));
});

test("state sync audit blocks unreachable anchors with stale divergence snapshots", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewStateSyncAudit({
    ...input,
    head: "3333333",
    aheadBehind: "0\t0",
    validatedSourceAheadBehind: "0\t1",
    validatedSourceAncestorOfHead: false,
    committedPathsSinceValidatedSource: [
      ".agent_board/RUN_STATE.md",
      "docs/current/CURRENT_STATE.md"
    ]
  });

  assert.equal(review.status, "blocked");
  assert.equal(review.checks.validatedSourceDivergenceRecorded, false);
  assert.ok(review.reasons.includes("state_sync_validatedSourceHeadRecorded"));
  assert.ok(review.reasons.includes("state_sync_validatedSourceCommitRecorded"));
  assert.ok(review.reasons.includes("state_sync_validatedSourceDivergenceRecorded"));
  assert.ok(review.reasons.includes("state_sync_latestValidatedCommitRecorded"));
});

test("state sync audit accepts exact validated source divergence matches", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewStateSyncAudit({
    ...input,
    validatedSourceAheadBehind: "0\t1",
    currentStateText: input.currentStateText.replace(
      /\| Upstream divergence \| `[^`]+` \|/,
      "| Upstream divergence | `ahead 0 / behind 1` |"
    )
  });

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.validatedSourceDivergenceRecorded, true);
});

test("state sync audit blocks unknown divergence exact matches", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewStateSyncAudit({
    ...input,
    validatedSourceAheadBehind: "unknown\tunknown",
    currentStateText: input.currentStateText.replace(
      /\| Upstream divergence \| `[^`]+` \|/,
      "| Upstream divergence | `ahead -1 / behind -1` |"
    )
  });

  assert.equal(review.status, "blocked");
  assert.equal(review.checks.validatedSourceDivergenceRecorded, false);
  assert.ok(review.reasons.includes("state_sync_validatedSourceDivergenceRecorded"));
  assert.equal(review.summary.validatedSourceAhead, -1);
  assert.equal(review.summary.validatedSourceBehind, -1);
});

test("state sync audit blocks when upstream behind changes from baseline", async () => {
  const input = await createInputFromWorkspace();
  const baseline = parseTestAheadBehind(input.validatedSourceAheadBehind);
  const review = reviewStateSyncAudit({
    ...input,
    validatedSourceAheadBehind: `${baseline.ahead}\t${baseline.behind + 1}`
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("state_sync_validatedSourceDivergenceRecorded"));
  assert.equal(review.summary.validatedSourceBehind, baseline.behind + 1);
});

test("state sync audit fails closed when validated source divergence is unknown", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewStateSyncAudit({
    ...input,
    validatedSourceAheadBehind: "unknown\tunknown",
    currentStateText: input.currentStateText.replace(
      /\| Upstream divergence \| `[^`]+` \|/,
      "| Upstream divergence | `ahead 0 / behind 0` |"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("state_sync_validatedSourceDivergenceRecorded"));
  assert.equal(review.summary.validatedSourceAhead, -1);
  assert.equal(review.summary.validatedSourceBehind, -1);
});

test("state sync audit blocks missing recorded upstream divergence", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewStateSyncAudit({
    ...input,
    currentStateText: input.currentStateText.replace(
      /\| Upstream divergence \| `[^`]+` \|\n/,
      ""
    )
  });

  assert.equal(review.status, "blocked");
  assert.equal(review.checks.validatedSourceDivergenceRecorded, false);
  assert.ok(review.reasons.includes("state_sync_validatedSourceDivergenceRecorded"));
});

test("state sync audit blocks malformed recorded upstream divergence", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewStateSyncAudit({
    ...input,
    currentStateText: input.currentStateText.replace(
      /\| Upstream divergence \| `[^`]+` \|/,
      "| Upstream divergence | `ahead many / behind none` |"
    )
  });

  assert.equal(review.status, "blocked");
  assert.equal(review.checks.validatedSourceDivergenceRecorded, false);
  assert.ok(review.reasons.includes("state_sync_validatedSourceDivergenceRecorded"));
});

test("state sync audit blocks stale agent board facts", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewStateSyncAudit({
    ...input,
    agentBoardText: [
      input.agentBoardText,
      "main` and `origin/main` are aligned at `68320e3`"
    ].join("\n")
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("state_sync_staleMarkersAbsent"));
});

test("state sync audit blocks stale agent board commit facts", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewStateSyncAudit({
    ...input,
    agentBoardText: [
      input.agentBoardText,
      "Historical stale board head: `1687e61`"
    ].join("\n")
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("state_sync_agentBoardAligned"));
});

test("state sync audit blocks missing script and boundary markers", async () => {
  const input = await createInputFromWorkspace();
  const packageJson = JSON.parse(input.packageJsonText) as {
    scripts: Record<string, string>;
  };
  delete packageJson.scripts.governance;
  const review = reviewStateSyncAudit({
    ...input,
    packageJsonText: JSON.stringify(packageJson),
    currentStateText: input.currentStateText.replaceAll(
      "general_provider_execution",
      "provider_execution_open"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("state_sync_packageScriptPresent"));
  assert.ok(review.reasons.includes("state_sync_executionBoundaryRecorded"));
});

test("state sync audit output stays summarized", async () => {
  const review = reviewStateSyncAudit(await createInputFromWorkspace());
  const text = formatStateSyncAuditResult(review);
  const json = formatStateSyncAuditResult(review, "json");
  const parsed = JSON.parse(json) as typeof review;

  assert.match(text, /status: passed/);
  assert.match(text, /claim source: legacy_markdown/);
  assert.match(text, /remote writes during audit: 0/);
  assert.equal(parsed.status, "passed");
  assert.equal(parsed.summary.claimSource, "legacy_markdown");

  for (const marker of ["OPENAI_API_KEY", "sk-", "Bearer ", "raw token"]) {
    assert.equal(text.includes(marker), false, `text output must omit ${marker}`);
    assert.equal(json.includes(marker), false, `json output must omit ${marker}`);
  }
});

test("state sync audit blocked output never emits a PASS badge", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewStateSyncAudit({
    ...input,
    head: "2222222",
    validatedSourceAncestorOfHead: false,
    committedPathsSinceValidatedSource: [
      "packages/state-sync-audit/src/index.ts"
    ]
  });
  const text = formatStateSyncAuditResult(review);
  const json = formatStateSyncAuditResult(review, "json");

  assert.equal(review.status, "blocked");
  assert.doesNotMatch(text, /status: passed/);
  assert.doesNotMatch(json, /"status": "passed"/);
  assert.doesNotMatch(text, /\bPASS\b/);
  assert.doesNotMatch(json, /\bPASS\b/);
});

test("state sync audit collector rejects unreachable validated source anchors", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "state-sync-unreachable-"));
  await git(cwd, ["init"]);
  await git(cwd, ["config", "user.email", "state-sync@example.invalid"]);
  await git(cwd, ["config", "user.name", "State Sync Test"]);

  await writeMinimalWorkspace(cwd, "main", "0000000");
  await git(cwd, ["add", "."]);
  await git(cwd, ["commit", "-m", "base"]);
  const baseCommit = await git(cwd, ["rev-parse", "--short", "HEAD"]);

  await git(cwd, ["checkout", "-b", "old-source"]);
  await mkdir(join(cwd, "packages"), { recursive: true });
  await writeFile(join(cwd, "packages", "old-source.ts"), "export const oldSource = true;\n");
  await git(cwd, ["add", "."]);
  await git(cwd, ["commit", "-m", "old source"]);
  const unreachableValidatedSource = await git(cwd, ["rev-parse", "--short", "HEAD"]);

  await git(cwd, ["checkout", "-b", "pr-checkout", baseCommit.trim()]);
  await mkdir(join(cwd, "scripts"), { recursive: true });
  await writeFile(join(cwd, "scripts", "pr-change.ts"), "export const prChange = true;\n");
  await git(cwd, ["add", "."]);
  await git(cwd, ["commit", "-m", "pr change"]);

  await writeMinimalWorkspace(cwd, "pr-checkout", unreachableValidatedSource.trim());

  const input = await collectStateSyncAuditInput(cwd);
  const review = reviewStateSyncAudit(input);

  assert.equal(input.validatedSourceAncestorOfHead, false);
  assert.ok(input.committedPathsSinceValidatedSource?.includes("scripts/pr-change.ts"));
  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("state_sync_validatedSourceHeadRecorded"));
  assert.ok(review.reasons.includes("state_sync_validatedSourceCommitRecorded"));
  assert.ok(review.reasons.includes("state_sync_latestValidatedCommitRecorded"));
});

test("state sync audit collector uses structured claim for validated source anchor", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "state-sync-claim-anchor-"));
  await git(cwd, ["init"]);
  await git(cwd, ["config", "user.email", "state-sync@example.invalid"]);
  await git(cwd, ["config", "user.name", "State Sync Test"]);

  await writeMinimalWorkspace(cwd, "main", "0000000");
  await git(cwd, ["add", "."]);
  await git(cwd, ["commit", "-m", "base"]);

  await mkdir(join(cwd, "packages"), { recursive: true });
  await writeFile(join(cwd, "packages", "source.ts"), "export const source = true;\n");
  await git(cwd, ["add", "."]);
  await git(cwd, ["commit", "-m", "source"]);
  const sourceCommit = (await git(cwd, ["rev-parse", "--short", "HEAD"])).trim();

  await writeMinimalWorkspace(cwd, "main", "deadbee");
  await writeStateSyncClaim(cwd, {
    branch: "main",
    upstream: "",
    validatedSourceCommit: sourceCommit,
    latestValidatedCommit: sourceCommit,
    recordedAhead: 0,
    recordedBehind: 0
  });

  const input = await collectStateSyncAuditInput(cwd);

  assert.equal(input.stateSyncClaimText !== undefined, true);
  assert.equal(input.validatedSourceAncestorOfHead, true);
  assert.deepEqual(input.committedPathsSinceValidatedSource, []);
});

test("state sync audit collector observes structured claim upstream ref without local upstream", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "state-sync-claim-upstream-"));
  await git(cwd, ["init"]);
  await git(cwd, ["config", "user.email", "state-sync@example.invalid"]);
  await git(cwd, ["config", "user.name", "State Sync Test"]);
  await git(cwd, ["checkout", "-b", "main"]);

  await writeMinimalWorkspace(cwd, "main", "0000000");
  await git(cwd, ["add", "."]);
  await git(cwd, ["commit", "-m", "base"]);
  await git(cwd, ["update-ref", "refs/remotes/origin/main", "HEAD"]);

  await git(cwd, ["checkout", "-b", "structured-record"]);
  await mkdir(join(cwd, "packages"), { recursive: true });
  await writeFile(join(cwd, "packages", "source.ts"), "export const source = true;\n");
  await git(cwd, ["add", "."]);
  await git(cwd, ["commit", "-m", "source"]);
  const sourceCommit = (await git(cwd, ["rev-parse", "--short", "HEAD"])).trim();

  await writeMinimalWorkspace(cwd, "structured-record", sourceCommit);
  await writeStateSyncClaim(cwd, {
    branch: "structured-record",
    upstream: "origin/main",
    validatedSourceCommit: sourceCommit,
    latestValidatedCommit: sourceCommit,
    recordedAhead: 1,
    recordedBehind: 0,
    transitionKind: "state_only_pending_push"
  });
  await git(cwd, ["add", "."]);
  await git(cwd, ["commit", "-m", "state record"]);

  const input = await collectStateSyncAuditInput(cwd);
  const review = reviewStateSyncAudit(input);

  assert.equal(input.upstream, "origin/main");
  assert.equal(input.aheadBehind, "2\t0");
  assert.equal(input.validatedSourceAheadBehind, "1\t0");
  assert.equal(input.validatedSourceAncestorOfHead, true);
  assert.deepEqual(
    new Set(input.committedPathsSinceValidatedSource),
    new Set(strictStateRecordPaths())
  );
  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.summary.claimSource, "structured");
  assert.equal(review.checks.structuredTransitionAllowed, true);
});

test("state sync audit collector prefers structured claim upstream over local upstream", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "state-sync-claim-upstream-authority-"));
  await git(cwd, ["init"]);
  await git(cwd, ["config", "user.email", "state-sync@example.invalid"]);
  await git(cwd, ["config", "user.name", "State Sync Test"]);
  await git(cwd, ["remote", "add", "origin", "https://example.invalid/state-sync.git"]);
  await git(cwd, ["checkout", "-b", "main"]);

  await writeMinimalWorkspace(cwd, "main", "0000000");
  await git(cwd, ["add", "."]);
  await git(cwd, ["commit", "-m", "base"]);
  await git(cwd, ["update-ref", "refs/remotes/origin/main", "HEAD"]);

  await git(cwd, ["checkout", "-b", "structured-record"]);
  await mkdir(join(cwd, "packages"), { recursive: true });
  await writeFile(join(cwd, "packages", "source.ts"), "export const source = true;\n");
  await git(cwd, ["add", "."]);
  await git(cwd, ["commit", "-m", "source"]);
  const sourceCommit = (await git(cwd, ["rev-parse", "--short", "HEAD"])).trim();

  await writeMinimalWorkspace(cwd, "structured-record", sourceCommit);
  await writeStateSyncClaim(cwd, {
    branch: "structured-record",
    upstream: "origin/main",
    validatedSourceCommit: sourceCommit,
    latestValidatedCommit: sourceCommit,
    recordedAhead: 1,
    recordedBehind: 0,
    transitionKind: "state_only_pending_push"
  });
  await git(cwd, ["add", "."]);
  await git(cwd, ["commit", "-m", "state record"]);
  await git(cwd, ["update-ref", "refs/remotes/origin/structured-record", "HEAD"]);
  await git(cwd, ["branch", "--set-upstream-to=origin/structured-record", "structured-record"]);

  const input = await collectStateSyncAuditInput(cwd);
  const review = reviewStateSyncAudit(input);

  assert.equal(input.upstream, "origin/main");
  assert.equal(input.aheadBehind, "2\t0");
  assert.equal(input.validatedSourceAheadBehind, "1\t0");
  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.summary.claimSource, "structured");
  assert.equal(review.checks.upstreamRecorded, true);
  assert.equal(review.checks.structuredTransitionAllowed, true);
});

test("state sync audit accepts structured detached branch-head checkouts", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "state-sync-structured-detached-head-"));
  await git(cwd, ["init"]);
  await git(cwd, ["config", "user.email", "state-sync@example.invalid"]);
  await git(cwd, ["config", "user.name", "State Sync Test"]);
  await git(cwd, ["checkout", "-b", "main"]);

  await writeMinimalWorkspace(cwd, "main", "0000000");
  await git(cwd, ["add", "."]);
  await git(cwd, ["commit", "-m", "base"]);
  await git(cwd, ["update-ref", "refs/remotes/origin/main", "HEAD"]);

  await git(cwd, ["checkout", "-b", "structured-record"]);
  await mkdir(join(cwd, "packages"), { recursive: true });
  await writeFile(join(cwd, "packages", "source.ts"), "export const source = true;\n");
  await git(cwd, ["add", "."]);
  await git(cwd, ["commit", "-m", "source"]);
  const sourceCommit = (await git(cwd, ["rev-parse", "--short", "HEAD"])).trim();

  await writeMinimalWorkspace(cwd, "structured-record", sourceCommit);
  await writeStateSyncClaim(cwd, {
    branch: "structured-record",
    upstream: "origin/main",
    validatedSourceCommit: sourceCommit,
    latestValidatedCommit: sourceCommit,
    recordedAhead: 1,
    recordedBehind: 0,
    transitionKind: "state_only_pending_push"
  });
  await git(cwd, ["add", "."]);
  await git(cwd, ["commit", "-m", "state record"]);
  await git(cwd, ["checkout", "--detach", "HEAD"]);

  const input = await collectStateSyncAuditInput(cwd);
  const review = reviewStateSyncAudit(input);

  assert.equal(input.branch, "");
  assert.equal(input.upstream, "origin/main");
  assert.equal(input.aheadBehind, "2\t0");
  assert.equal(input.validatedSourceAheadBehind, "1\t0");
  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.summary.claimSource, "structured");
  assert.equal(review.checks.currentBranchMatches, true);
  assert.equal(review.checks.structuredTransitionAllowed, true);
});

test("state sync audit accepts structured detached PR merge-ref checkouts", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "state-sync-structured-merge-ref-"));
  await git(cwd, ["init"]);
  await git(cwd, ["config", "user.email", "state-sync@example.invalid"]);
  await git(cwd, ["config", "user.name", "State Sync Test"]);
  await git(cwd, ["checkout", "-b", "main"]);

  await writeMinimalWorkspace(cwd, "main", "0000000");
  await git(cwd, ["add", "."]);
  await git(cwd, ["commit", "-m", "base"]);
  await git(cwd, ["update-ref", "refs/remotes/origin/main", "HEAD"]);

  await git(cwd, ["checkout", "-b", "structured-record"]);
  await mkdir(join(cwd, "packages"), { recursive: true });
  await writeFile(join(cwd, "packages", "source.ts"), "export const source = true;\n");
  await git(cwd, ["add", "."]);
  await git(cwd, ["commit", "-m", "source"]);
  const sourceCommit = (await git(cwd, ["rev-parse", "--short", "HEAD"])).trim();

  await writeMinimalWorkspace(cwd, "structured-record", sourceCommit);
  await writeStateSyncClaim(cwd, {
    branch: "structured-record",
    upstream: "origin/main",
    validatedSourceCommit: sourceCommit,
    latestValidatedCommit: sourceCommit,
    recordedAhead: 1,
    recordedBehind: 0,
    transitionKind: "state_only_pending_push"
  });
  await git(cwd, ["add", "."]);
  await git(cwd, ["commit", "-m", "state record"]);

  await git(cwd, ["checkout", "main"]);
  await git(cwd, ["merge", "--no-ff", "structured-record", "-m", "merge structured record"]);
  await git(cwd, ["checkout", "--detach", "HEAD"]);

  const input = await collectStateSyncAuditInput(cwd);
  const review = reviewStateSyncAudit(input);

  assert.equal(input.branch, "");
  assert.equal(input.upstream, "origin/main");
  assert.equal(input.aheadBehind, "3\t0");
  assert.equal(input.validatedSourceAheadBehind, "1\t0");
  assert.equal(input.validatedSourceAncestorOfHead, true);
  assert.deepEqual(
    new Set(input.committedPathsSinceValidatedSource),
    new Set(strictStateRecordPaths())
  );
  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.summary.claimSource, "structured");
  assert.equal(review.checks.currentBranchMatches, true);
  assert.equal(review.checks.structuredTransitionAllowed, true);
});

test("state sync audit collector rejects claim upstream refs outside remote tracking refs", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "state-sync-claim-unsafe-upstream-"));
  await git(cwd, ["init"]);
  await git(cwd, ["config", "user.email", "state-sync@example.invalid"]);
  await git(cwd, ["config", "user.name", "State Sync Test"]);
  await git(cwd, ["checkout", "-b", "main"]);

  await writeMinimalWorkspace(cwd, "main", "0000000");
  await git(cwd, ["add", "."]);
  await git(cwd, ["commit", "-m", "base"]);
  await git(cwd, ["update-ref", "refs/remotes/origin/main", "HEAD"]);

  await git(cwd, ["checkout", "-b", "structured-record"]);
  await mkdir(join(cwd, "packages"), { recursive: true });
  await writeFile(join(cwd, "packages", "source.ts"), "export const source = true;\n");
  await git(cwd, ["add", "."]);
  await git(cwd, ["commit", "-m", "source"]);
  const sourceCommit = (await git(cwd, ["rev-parse", "--short", "HEAD"])).trim();

  await writeMinimalWorkspace(cwd, "structured-record", sourceCommit);
  await writeStateSyncClaim(cwd, {
    branch: "structured-record",
    upstream: "HEAD",
    validatedSourceCommit: sourceCommit,
    latestValidatedCommit: sourceCommit,
    recordedAhead: 1,
    recordedBehind: 0,
    transitionKind: "state_only_pending_push"
  });
  await git(cwd, ["add", "."]);
  await git(cwd, ["commit", "-m", "state record"]);

  const input = await collectStateSyncAuditInput(cwd);
  const review = reviewStateSyncAudit(input);

  assert.equal(input.upstream, "");
  assert.equal(input.aheadBehind, "unknown\tunknown");
  assert.equal(input.validatedSourceAheadBehind, "unknown\tunknown");
  assert.equal(review.status, "blocked");
  assert.equal(review.summary.claimSource, "structured");
  assert.equal(review.checks.upstreamRecorded, false);
  assert.equal(review.checks.validatedSourceDivergenceRecorded, false);
  assert.equal(review.checks.structuredTransitionAllowed, false);
});

test("state sync audit collector does not use Markdown anchor when claim is invalid", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "state-sync-invalid-claim-"));
  await git(cwd, ["init"]);
  await git(cwd, ["config", "user.email", "state-sync@example.invalid"]);
  await git(cwd, ["config", "user.name", "State Sync Test"]);

  await writeMinimalWorkspace(cwd, "main", "0000000");
  await git(cwd, ["add", "."]);
  await git(cwd, ["commit", "-m", "base"]);
  const sourceCommit = (await git(cwd, ["rev-parse", "--short", "HEAD"])).trim();

  await writeMinimalWorkspace(cwd, "main", sourceCommit);
  await writeStateSyncRecordText(cwd, "{");

  const input = await collectStateSyncAuditInput(cwd);
  const review = reviewStateSyncAudit(input);

  assert.equal(input.stateSyncClaimText, "{");
  assert.equal(input.validatedSourceAheadBehind, undefined);
  assert.equal(input.validatedSourceAncestorOfHead, undefined);
  assert.equal(review.summary.claimSource, "invalid_structured");
  assert.equal(review.checks.structuredClaimValid, false);
  assert.ok(review.reasons.includes("state_sync_structuredClaimValid"));
});

test("state sync audit blocks machine absolute paths in state surfaces", async () => {
  const input = await createInputFromWorkspace();
  for (const machinePath of [
    "A:\\AGENTS_OS_Workspace\\governance\\codex-router\\repo",
    "Z:\\build\\workspace\\repo",
    "C:/Users/example/repo",
    "D:/work/project",
    "\\\\server\\share\\repo",
    "\\\\build-host\\workspace\\codex-router",
    "//server/share/repo",
    "\\\\?\\C:\\workspace\\repo",
    "\\\\?\\UNC\\server\\share\\repo",
    "/mnt/datadisk0/apps/AGENTS_OS_Workspace/governance/codex-router",
    "/home/ubuntu/apps/codex-router",
    "/Users/alice/src/codex-router",
    "/workspace/codex-router",
    "/workspaces/codex-router",
    "C:\\Users\\alice\\codex-router"
  ]) {
    const review = reviewStateSyncAudit({
      ...input,
      currentStateText: input.currentStateText.replace(
        /\| Workspace \| `[^`]+` \|/,
        `| Workspace | \`${machinePath}\` |`
      )
    });

    assert.equal(review.status, "blocked", machinePath);
    assert.ok(review.reasons.includes("state_sync_outputSanitized"), machinePath);
    assert.ok(
      review.issues.some((issue) => issue.risk === "machine_path_disclosure"),
      machinePath
    );
  }
});

test("state sync audit allows governance markers, urls, and repository-relative paths", async () => {
  const input = await createInputFromWorkspace();
  const allowedFixtures = [
    "packages/state-sync-audit/src/index.ts",
    "tests/state-sync-audit.test.ts",
    "PR_22A",
    "PR-23A-S1",
    "exec-json-stdin-prompt.v1",
    "https://example.com/path",
    "http://localhost/resource",
    "C:",
    "普通 Markdown 标题: value"
  ];
  const review = reviewStateSyncAudit({
    ...input,
    currentStateText: [
      input.currentStateText,
      ...allowedFixtures.map((fixture) => `Allowed fixture: ${fixture}`)
    ].join("\n")
  });

  assert.equal(review.status, "passed");
  assert.equal(review.checks.outputSanitized, true);
});

test("state sync audit reports machine paths without echoing sentinel paths", async () => {
  const input = await createInputFromWorkspace();
  const sentinelPath = "A:\\PRIVATE_SENTINEL\\user\\secret-repo";
  const review = reviewStateSyncAudit({
    ...input,
    currentStateText: input.currentStateText.replace(
      /\| Workspace \| `[^`]+` \|/,
      `| Workspace | \`${sentinelPath}\` |`
    )
  });
  const text = formatStateSyncAuditResult(review);
  const json = formatStateSyncAuditResult(review, "json");

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("state_sync_outputSanitized"));
  assert.ok(review.issues.some((issue) => (
    issue.code === "state_document_windows_drive_path"
    && issue.path === "docs/current/CURRENT_STATE.md"
    && issue.line > 0
  )));
  assert.equal(text.includes("PRIVATE_SENTINEL"), false);
  assert.equal(json.includes("PRIVATE_SENTINEL"), false);
  assert.equal(text.includes(sentinelPath), false);
  assert.equal(json.includes(sentinelPath), false);
});

async function createInputFromWorkspace(
  overrides: Partial<StateSyncAuditInput> = {}
): Promise<StateSyncAuditInput> {
  const currentStateText = await readFile("docs/current/CURRENT_STATE.md", "utf8");
  const agentBoardText = await Promise.all([
    readFile(".agent_board/RUN_STATE.md", "utf8"),
    readFile(".agent_board/TASK_QUEUE.md", "utf8"),
    readFile(".agent_board/CHECKPOINT.md", "utf8"),
    readFile(".agent_board/HANDOFF.md", "utf8"),
    readFile(".agent_board/VALIDATION_LOG.md", "utf8")
  ]).then((texts) => texts.join("\n"));
  const recordedHead = extractStateField(currentStateText, "Current head")
    ?? "UNKNOWN_HEAD";
  const recordedBranch = extractStateField(currentStateText, "Current branch")
    ?? "UNKNOWN_BRANCH";
  const recordedUpstream = extractStateField(currentStateText, "Upstream")
    ?? "";
  const recordedDivergence = extractStateDivergence(currentStateText)
    ?? "0\t0";

  return {
    gitStatusShort: "",
    branch: recordedBranch,
    head: recordedHead,
    parentHead: recordedHead,
    upstream: recordedUpstream,
    aheadBehind: recordedDivergence,
    validatedSourceAheadBehind: recordedDivergence,
    packageJsonText: await readFile("package.json", "utf8"),
    currentStateText,
    agentBoardText,
    ...overrides
  };
}

function extractStateField(text: string, field: string): string | undefined {
  return new RegExp(`\\| ${field} \\| \`([^\\\`]+)\` \\|`).exec(text)?.[1];
}

function extractStateDivergence(text: string): string | undefined {
  const value = extractStateField(text, "Upstream divergence");
  const match = /^ahead (-?\d+) \/ behind (-?\d+)$/.exec(value ?? "");
  if (match === null) {
    return undefined;
  }

  return `${match[1]}\t${match[2]}`;
}

function parseTestAheadBehind(
  value: string | undefined
): { ahead: number; behind: number } {
  const [aheadText, behindText] = (value ?? "0\t0").split(/\s+/);
  return {
    ahead: Number.parseInt(aheadText ?? "0", 10),
    behind: Number.parseInt(behindText ?? "0", 10)
  };
}

function stateSyncClaimTextFromInput(
  input: StateSyncAuditInput,
  overrides: {
    schemaVersion?: number;
    policyVersion?: string;
    branch?: string;
    upstream?: string;
    validatedSourceCommit?: string;
    latestValidatedCommit?: string;
    recordedAhead?: number;
    recordedBehind?: number;
    transitionKind?: string;
    allowedStatePaths?: string[];
  } = {}
): string {
  const divergence = parseTestAheadBehind(input.validatedSourceAheadBehind);

  return JSON.stringify({
    schemaVersion: overrides.schemaVersion ?? 1,
    policyVersion: overrides.policyVersion ?? "state-sync-policy.v1",
    subject: {
      branch: overrides.branch ?? input.branch,
      upstream: overrides.upstream ?? input.upstream
    },
    source: {
      validatedSourceCommit: overrides.validatedSourceCommit ?? input.head,
      latestValidatedCommit: overrides.latestValidatedCommit ?? input.head,
      recordedDivergence: {
        ahead: overrides.recordedAhead ?? divergence.ahead,
        behind: overrides.recordedBehind ?? divergence.behind
      }
    },
    transition: {
      kind: overrides.transitionKind ?? "source_exact",
      allowedStatePaths: overrides.allowedStatePaths ?? strictStateRecordPaths()
    },
    validation: {
      requiredCommands: [
        "git diff --check",
        "node --import tsx --test tests/state-sync-audit.test.ts",
        "npm run typecheck",
        "npm run build",
        "node --import tsx scripts/run-state-sync-audit.ts --json"
      ]
    }
  }, null, 2);
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

function asCleanSyntheticReviewInput(
  input: StateSyncAuditInput
): StateSyncAuditInput {
  return {
    ...input,
    gitStatusShort: "",
    head: "8c05119",
    parentHead: "f37f174",
    allowedStateCommits: [],
    aheadBehind: "0\t0",
    validatedSourceAheadBehind: "0\t0",
    currentStateText: input.currentStateText.replace(
      /\| Upstream divergence \| `[^`]+` \|/,
      "| Upstream divergence | `ahead 0 / behind 0` |"
    )
  };
}

function asDetachedSyntheticReviewInput(
  input: StateSyncAuditInput,
  overrides: Partial<StateSyncAuditInput> = {}
): StateSyncAuditInput {
  return {
    ...input,
    gitStatusShort: "",
    branch: "",
    head: "8a5c580",
    parentHead: "f37f174",
    allowedStateCommits: [],
    upstream: "",
    aheadBehind: "unknown\tunknown",
    validatedSourceAheadBehind: "unknown\tunknown",
    ...overrides
  };
}

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, {
    cwd,
    encoding: "utf8",
    windowsHide: true
  });

  return stdout;
}

async function writeMinimalWorkspace(
  cwd: string,
  branch: string,
  validatedSourceCommit: string
): Promise<void> {
  await mkdir(join(cwd, "docs", "current"), { recursive: true });
  await mkdir(join(cwd, ".agent_board"), { recursive: true });
  await writeFile(
    join(cwd, "package.json"),
    JSON.stringify({
      scripts: {
        governance: "tsx scripts/run-governance-check.ts"
      }
    }, null, 2)
  );
  await writeFile(
    join(cwd, "docs", "current", "CURRENT_STATE.md"),
    minimalCurrentState(branch, validatedSourceCommit)
  );

  const boardText = [
    "# State Board",
    "",
    `Branch: \`${branch}\``,
    "Current truth source: `docs/current/CURRENT_STATE.md`",
    `Validated source commit: \`${validatedSourceCommit}\``,
    `Latest validated commit: \`${validatedSourceCommit}\``,
    ""
  ].join("\n");

  for (const fileName of [
    "RUN_STATE.md",
    "TASK_QUEUE.md",
    "CHECKPOINT.md",
    "HANDOFF.md",
    "VALIDATION_LOG.md"
  ]) {
    await writeFile(join(cwd, ".agent_board", fileName), boardText);
  }
}

async function writeStateSyncClaim(
  cwd: string,
  input: {
    branch: string;
    upstream: string;
    validatedSourceCommit: string;
    latestValidatedCommit: string;
    recordedAhead: number;
    recordedBehind: number;
    transitionKind?: string;
  }
): Promise<void> {
  await writeStateSyncRecordText(
    cwd,
    JSON.stringify({
      schemaVersion: 1,
      policyVersion: "state-sync-policy.v1",
      subject: {
        branch: input.branch,
        upstream: input.upstream
      },
      source: {
        validatedSourceCommit: input.validatedSourceCommit,
        latestValidatedCommit: input.latestValidatedCommit,
        recordedDivergence: {
          ahead: input.recordedAhead,
          behind: input.recordedBehind
        }
      },
      transition: {
        kind: input.transitionKind ?? "source_exact",
        allowedStatePaths: strictStateRecordPaths()
      }
    }, null, 2)
  );
}

async function writeStateSyncRecordText(
  cwd: string,
  text: string
): Promise<void> {
  await mkdir(join(cwd, "docs", "current"), { recursive: true });
  await writeFile(join(cwd, "docs", "current", "state-sync-record.json"), text);
}

function minimalCurrentState(branch: string, validatedSourceCommit: string): string {
  return [
    "# Current State",
    "",
    "CURRENT_STATE_RECORDED",
    "",
    "| Field | Value |",
    "| --- | --- |",
    "| Workspace | `codex-router/repo` |",
    `| Current branch | \`${branch}\` |`,
    `| Current head | \`${validatedSourceCommit}\` |`,
    `| Validated source commit | \`${validatedSourceCommit}\` |`,
    "| Upstream | `none` |",
    "| Upstream divergence | `ahead -1 / behind -1` |",
    `| Latest validated commit | \`${validatedSourceCommit}\` |`,
    "| State record mode | `state-only descendant allowed` |",
    "| Stale after commit | `true` |",
    "",
    "Validation baseline:",
    "",
    "- `npx tsx --test tests\\codex-cli-host.test.ts`",
    "- `npm run typecheck`",
    "- `npm test`",
    "- `npm run build`",
    "",
    "Execution boundary:",
    "",
    "- `general_workspace_write`",
    "- `general_provider_execution`",
    "- `protected_remote_write`",
    "- `push_to_main`",
    "- `release_tag_deploy`",
    "- `secret_or_credential_change`",
    "- `external_service_write`",
    ""
  ].join("\n");
}
