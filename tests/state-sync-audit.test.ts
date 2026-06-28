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
  collectStateSyncAuditInput,
  gitFilteredTreeDigest
} from "../scripts/run-state-sync-audit.js";

const execFileAsync = promisify(execFile);
const TEST_SOURCE_TREE_DIGEST =
  "0000000000000000000000000000000000000000000000000000000000000000";
type StateSyncAuditInputOverrides =
  Omit<Partial<StateSyncAuditInput>, "stateSyncClaimText">
  & { stateSyncClaimText?: string | undefined };
type StateSyncClaimTextOverrides = {
  schemaVersion?: number;
  policyVersion?: string;
  branch?: string;
  upstream?: string;
  validatedSourceCommit?: string;
  latestValidatedCommit?: string;
  recordedAhead?: number;
  recordedBehind?: number;
  sourceTreeDigest?: string;
  sourceTreeDigestExcludedPaths?: string[];
  transitionKind?: string;
  allowedStatePaths?: string[];
};

test("state sync audit passes when clean HEAD matches a structured source claim", async () => {
  const review = reviewStateSyncAudit(await createInputFromWorkspace());

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.summary.claimSource, "structured");
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
  assert.equal(review.checks.evidenceDriftAbsent, true);
  assert.equal(review.summary.requiredValidationCommandCount, 4);
  assert.equal(review.summary.requiredBoundaryMarkerCount, 7);
  assert.equal(review.summary.stateWritesDuringAudit, 0);
  assert.equal(review.summary.remoteWritesDuringAudit, 0);
});

test("state sync audit blocks when the structured claim is missing", async () => {
  const review = reviewStateSyncAudit(await createInputFromWorkspace({
    stateSyncClaimText: undefined
  }));

  assert.equal(review.status, "blocked");
  assert.equal(review.summary.claimSource, "missing_structured");
  assert.equal(review.checks.structuredClaimValid, false);
  assert.ok(review.reasons.includes("state_sync_structuredClaimValid"));
});

test("state sync audit blocks structured claim evidence drift", async () => {
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

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("state_sync_evidenceDriftAbsent"));
  assert.equal(review.summary.claimSource, "structured");
  assert.equal(review.checks.currentBranchMatches, true);
  assert.equal(review.checks.validatedSourceHeadRecorded, true);
  assert.equal(review.checks.validatedSourceCommitRecorded, true);
  assert.equal(review.checks.validatedSourceDivergenceRecorded, true);
  assert.equal(review.checks.latestValidatedCommitRecorded, true);
  assert.equal(review.checks.structuredTransitionAllowed, true);
  assert.equal(review.checks.evidenceDriftAbsent, false);
  assert.ok(review.issues.some((issue) => (
    issue.code === "state_document_evidence_drift"
    && issue.field === "Validated source commit"
  )));
});

test("state sync audit blocks empty structured claim mirror fields", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewStateSyncAudit({
    ...input,
    currentStateText: input.currentStateText.replace(
      /\| Current head \| `[^`]+` \|/,
      "| Current head | `` |"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("state_sync_evidenceDriftAbsent"));
  assert.equal(review.checks.evidenceDriftAbsent, false);
  assert.ok(review.issues.some((issue) => (
    issue.code === "state_document_evidence_drift"
    && issue.field === "Current head"
  )));
});

test("state sync audit blocks missing structured claim mirror fields", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewStateSyncAudit({
    ...input,
    currentStateText: input.currentStateText.replace(
      /\| Current head \| `[^`]+` \|\n/,
      ""
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("state_sync_evidenceDriftAbsent"));
  assert.equal(review.checks.evidenceDriftAbsent, false);
  assert.ok(review.issues.some((issue) => (
    issue.code === "state_document_evidence_drift"
    && issue.field === "Current head"
  )));
});

test("state sync audit blocks stale current state structured record mirrors", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewStateSyncAudit({
    ...input,
    currentStateText: input.currentStateText
      .replace(
        /- transition kind: `[^`]+`/,
        "- transition kind: `state_only_pushed`"
      )
      .replace(
        /- source tree digest: `git-ls-tree-sha256`\r?\n  `[^`]+`/,
        [
          "- source tree digest: `git-ls-tree-sha256`",
          "  `1111111111111111111111111111111111111111111111111111111111111111`"
        ].join("\n")
      )
      .replace(
        "- `.agent_board/VALIDATION_LOG.md`",
        "- `.agent_board/STALE.md`"
      )
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("state_sync_evidenceDriftAbsent"));
  assert.equal(review.checks.evidenceDriftAbsent, false);
  assert.ok(review.issues.some((issue) => (
    issue.code === "state_document_evidence_drift"
    && issue.path === "docs/current/CURRENT_STATE.md"
    && issue.field === "transition kind"
  )));
  assert.ok(review.issues.some((issue) => (
    issue.code === "state_document_evidence_drift"
    && issue.path === "docs/current/CURRENT_STATE.md"
    && issue.field === "source tree digest"
  )));
  assert.ok(review.issues.some((issue) => (
    issue.code === "state_document_evidence_drift"
    && issue.path === "docs/current/CURRENT_STATE.md"
    && issue.field === "Strict state record paths"
  )));
});

test("state sync audit blocks stale current state expectation mirrors", async () => {
  const input = await createInputFromWorkspace();
  let currentStateText = input.currentStateText;
  currentStateText = replaceCurrentStateValidationSourceCommit(
    currentStateText,
    "1111111"
  );
  currentStateText = replaceCurrentStateExpectation(
    currentStateText,
    "branch",
    "stale-branch"
  );
  currentStateText = replaceCurrentStateExpectation(
    currentStateText,
    "upstream",
    "refs/remotes/origin/stale"
  );
  currentStateText = replaceCurrentStateExpectation(
    currentStateText,
    "validated source commit",
    "2222222"
  );
  currentStateText = replaceCurrentStateExpectation(
    currentStateText,
    "recorded divergence baseline",
    "ahead 999 / behind 999"
  );
  currentStateText = replaceCurrentStateExpectation(
    currentStateText,
    "transition",
    "state_only_pushed"
  );
  currentStateText = replaceCurrentStateValidatedSourceDivergenceExpectation(
    currentStateText,
    [
      "For this `state_only_pushed` state-only record, Git observation should",
      "compute the validated source divergence as `ahead 999 / behind 999` against",
      "`refs/remotes/origin/main` after the state-only record is on upstream."
    ].join("\n")
  );
  const review = reviewStateSyncAudit({
    ...input,
    currentStateText
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("state_sync_evidenceDriftAbsent"));
  assert.equal(review.checks.evidenceDriftAbsent, false);
  for (const field of [
    "Validation recorded for source commit",
    "State Sync Expectations branch",
    "State Sync Expectations upstream",
    "State Sync Expectations validated source commit",
    "State Sync Expectations recorded divergence baseline",
    "State Sync Expectations transition",
    "State Sync Expectations validated source divergence expectation"
  ]) {
    assert.ok(review.issues.some((issue) => (
      issue.code === "state_document_evidence_drift"
      && issue.path === "docs/current/CURRENT_STATE.md"
      && issue.field === field
    )), `missing evidence drift issue for ${field}`);
  }
});

test("state sync audit blocks stale agent board generated mirror fields", async () => {
  const input = await createInputFromWorkspace();
  const aggregateInput = withoutAgentBoardFiles(input);
  const review = reviewStateSyncAudit({
    ...aggregateInput,
    agentBoardText: replaceLast(
      replaceLast(
        replaceLast(
          input.agentBoardText,
          /- upstream: `[^`]*`/g,
          "- upstream: `refs/remotes/origin/stale`"
        ),
        /- recorded divergence baseline: `[^`]*`/g,
        "- recorded divergence baseline: `ahead 999 / behind 999`"
      ),
      /- transition: `[^`]*`/g,
      "- transition: `state_only_pushed`"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("state_sync_evidenceDriftAbsent"));
  assert.equal(review.checks.agentBoardAligned, true);
  assert.equal(review.checks.evidenceDriftAbsent, false);
  assert.ok(review.issues.some((issue) => (
    issue.code === "state_document_evidence_drift"
    && issue.path === ".agent_board/*"
    && issue.field === "upstream"
  )));
  assert.ok(review.issues.some((issue) => (
    issue.code === "state_document_evidence_drift"
    && issue.path === ".agent_board/*"
    && issue.field === "recorded divergence baseline"
  )));
  assert.ok(review.issues.some((issue) => (
    issue.code === "state_document_evidence_drift"
    && issue.path === ".agent_board/*"
    && issue.field === "transition"
  )));
});

test("state sync audit blocks stale agent board heading mirror fields", async () => {
  const input = await createInputFromWorkspace();
  const aggregateInput = withoutAgentBoardFiles(input);
  const review = reviewStateSyncAudit({
    ...aggregateInput,
    agentBoardText: input.agentBoardText
      .replace(
        /Upstream baseline:\r?\n\r?\n- `[^`]*`/,
        "Upstream baseline:\n\n- `refs/remotes/origin/stale`"
      )
      .replace(
        /Recorded divergence baseline:\r?\n\r?\n- `[^`]*`/,
        "Recorded divergence baseline:\n\n- `ahead 999 / behind 999`"
      )
      .replace(
        /Current transition:\r?\n\r?\n- `[^`]*`/,
        "Current transition:\n\n- `state_only_pushed`"
      )
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("state_sync_evidenceDriftAbsent"));
  assert.equal(review.checks.agentBoardAligned, true);
  assert.equal(review.checks.evidenceDriftAbsent, false);
  assert.ok(review.issues.some((issue) => (
    issue.code === "state_document_evidence_drift"
    && issue.path === ".agent_board/*"
    && issue.field === "Upstream baseline:"
  )));
  assert.ok(review.issues.some((issue) => (
    issue.code === "state_document_evidence_drift"
    && issue.path === ".agent_board/*"
    && issue.field === "Recorded divergence baseline:"
  )));
  assert.ok(review.issues.some((issue) => (
    issue.code === "state_document_evidence_drift"
    && issue.path === ".agent_board/*"
    && issue.field === "Current transition:"
  )));
});

test("state sync audit blocks missing agent board generated mirror blocks", async () => {
  const input = await createInputFromWorkspace();
  const aggregateInput = withoutAgentBoardFiles(input);
  const review = reviewStateSyncAudit({
    ...aggregateInput,
    agentBoardText: input.agentBoardText.replace(
      /<!-- state-sync-display:start -->[\s\S]*?<!-- state-sync-display:end -->\n?/g,
      ""
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("state_sync_evidenceDriftAbsent"));
  assert.equal(review.checks.agentBoardAligned, true);
  assert.equal(review.checks.evidenceDriftAbsent, false);
  assert.ok(review.issues.some((issue) => (
    issue.code === "state_document_evidence_drift"
    && issue.path === ".agent_board/*"
    && issue.field === "state-sync-display block count"
  )));
});

test("state sync audit checks agent board generated blocks per file", async () => {
  const input = await createInputFromWorkspace();
  assert.ok(input.agentBoardFiles !== undefined);
  const displayBlock = input.agentBoardFiles
    .find((file) => file.path === ".agent_board/RUN_STATE.md")
    ?.text.match(/<!-- state-sync-display:start -->[\s\S]*?<!-- state-sync-display:end -->/)
    ?.[0];
  assert.ok(displayBlock !== undefined);

  const agentBoardFiles = input.agentBoardFiles.map((file) => {
    if (file.path === ".agent_board/HANDOFF.md") {
      return {
        path: file.path,
        text: file.text.replace(
          /<!-- state-sync-display:start -->[\s\S]*?<!-- state-sync-display:end -->\n?/,
          ""
        )
      };
    }

    if (file.path === ".agent_board/RUN_STATE.md") {
      return {
        path: file.path,
        text: `${file.text.trimEnd()}\n\n${displayBlock}\n`
      };
    }

    return file;
  });
  const review = reviewStateSyncAudit({
    ...input,
    agentBoardFiles,
    agentBoardText: agentBoardFiles.map((file) => file.text).join("\n")
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("state_sync_evidenceDriftAbsent"));
  assert.equal(review.checks.agentBoardAligned, true);
  assert.equal(review.checks.evidenceDriftAbsent, false);
  assert.ok(review.issues.some((issue) => (
    issue.code === "state_document_evidence_drift"
    && issue.path === ".agent_board/HANDOFF.md"
    && issue.field === "state-sync-display block count"
  )));
  assert.ok(review.issues.some((issue) => (
    issue.code === "state_document_evidence_drift"
    && issue.path === ".agent_board/RUN_STATE.md"
    && issue.field === "state-sync-display block count"
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
    ...withStateSyncClaim(input, {
      transitionKind: "state_only_pending_push"
    })
  });

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.summary.claimSource, "structured");
  assert.equal(review.checks.structuredTransitionAllowed, true);
});

test("state sync audit blocks pending-push records with mismatched source digests", async () => {
  const input = await createInputFromWorkspace();
  const baseline = parseTestAheadBehind(input.validatedSourceAheadBehind);
  const review = reviewStateSyncAudit({
    ...input,
    head: "3333333",
    aheadBehind: `${baseline.ahead + 1}\t${baseline.behind}`,
    validatedSourceAncestorOfHead: true,
    committedPathsSinceValidatedSource: strictStateRecordPaths(),
    stateSyncClaimText: stateSyncClaimTextFromInput(input, {
      sourceTreeDigest:
        "1111111111111111111111111111111111111111111111111111111111111111",
      transitionKind: "state_only_pending_push"
    })
  });

  assert.equal(review.status, "blocked");
  assert.equal(review.summary.claimSource, "structured");
  assert.equal(review.checks.structuredTransitionAllowed, false);
  assert.ok(review.reasons.includes("state_sync_structuredTransitionAllowed"));
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
    ...withStateSyncClaim(input, {
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

test("state sync audit accepts bounded reanchor PR candidates", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewStateSyncAudit({
    ...input,
    branch: "state-sync/reanchor-main",
    head: "3333333",
    aheadBehind: "1\t0",
    validatedSourceAheadBehind: "0\t0",
    validatedSourceAncestorOfHead: true,
    committedPathsSinceValidatedSource: strictStateRecordPaths(),
    ...withStateSyncClaim(input, {
      branch: "main",
      upstream: "refs/remotes/origin/main",
      transitionKind: "state_only_pushed",
      recordedAhead: 1,
      recordedBehind: 0
    })
  });

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.currentBranchMatches, true);
  assert.equal(review.checks.validatedSourceDivergenceRecorded, true);
  assert.equal(review.checks.structuredTransitionAllowed, true);
});

test("state sync audit blocks reanchor PR candidates outside the fixed branch", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewStateSyncAudit({
    ...input,
    branch: "state-sync/other-reanchor",
    head: "3333333",
    aheadBehind: "1\t0",
    validatedSourceAheadBehind: "0\t0",
    validatedSourceAncestorOfHead: true,
    committedPathsSinceValidatedSource: strictStateRecordPaths(),
    ...withStateSyncClaim(input, {
      branch: "main",
      upstream: "refs/remotes/origin/main",
      transitionKind: "state_only_pushed",
      recordedAhead: 1,
      recordedBehind: 0
    })
  });

  assert.equal(review.status, "blocked");
  assert.equal(review.checks.currentBranchMatches, false);
  assert.equal(review.checks.structuredTransitionAllowed, false);
});

test("state sync audit blocks multi-commit reanchor PR candidates", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewStateSyncAudit({
    ...input,
    branch: "state-sync/reanchor-main",
    head: "3333333",
    aheadBehind: "2\t0",
    validatedSourceAheadBehind: "0\t0",
    validatedSourceAncestorOfHead: true,
    committedPathsSinceValidatedSource: strictStateRecordPaths(),
    ...withStateSyncClaim(input, {
      branch: "main",
      upstream: "refs/remotes/origin/main",
      transitionKind: "state_only_pushed",
      recordedAhead: 2,
      recordedBehind: 0
    })
  });

  assert.equal(review.status, "blocked");
  assert.equal(review.checks.validatedSourceDivergenceRecorded, false);
  assert.equal(review.checks.structuredTransitionAllowed, false);
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

test("state sync audit fails closed on unknown structured claim fields", async (t) => {
  const input = await createInputFromWorkspace();
  const cases: Array<[
    string,
    (claim: Record<string, unknown>) => void
  ]> = [
    ["top-level", (claim) => {
      claim.extra = true;
    }],
    ["subject", (claim) => {
      (claim.subject as Record<string, unknown>).extra = true;
    }],
    ["source", (claim) => {
      (claim.source as Record<string, unknown>).extra = true;
    }],
    ["recorded divergence", (claim) => {
      const source = claim.source as Record<string, unknown>;
      (source.recordedDivergence as Record<string, unknown>).extra = true;
    }],
    ["source tree digest", (claim) => {
      const source = claim.source as Record<string, unknown>;
      (source.sourceTreeDigest as Record<string, unknown>).extra = true;
    }],
    ["transition", (claim) => {
      (claim.transition as Record<string, unknown>).extra = true;
    }],
    ["validation", (claim) => {
      (claim.validation as Record<string, unknown>).extra = true;
    }]
  ];

  for (const [name, mutate] of cases) {
    await t.test(name, () => {
      const claim = JSON.parse(
        stateSyncClaimTextFromInput(input)
      ) as Record<string, unknown>;
      mutate(claim);
      const review = reviewStateSyncAudit({
        ...input,
        stateSyncClaimText: JSON.stringify(claim)
      });

      assert.equal(review.status, "blocked");
      assert.equal(review.summary.claimSource, "invalid_structured");
      assert.equal(review.checks.structuredClaimValid, false);
      assert.ok(review.reasons.includes("state_sync_structuredClaimValid"));
    });
  }
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

test("state sync audit blocks unlisted agent board paths", async () => {
  const review = reviewStateSyncAudit(await createInputFromWorkspace({
    gitStatusShort: " M .agent_board/EXTRA.md"
  }));

  assert.equal(review.status, "blocked");
  assert.equal(review.checks.dirtyWorktreeStateOnly, false);
  assert.ok(review.reasons.includes("state_sync_dirtyWorktreeStateOnly"));
});

test("state sync audit keeps strict path checks when structured claim is missing", async () => {
  const review = reviewStateSyncAudit(await createInputFromWorkspace({
    gitStatusShort: " M .agent_board/EXTRA.md",
    stateSyncClaimText: undefined
  }));

  assert.equal(review.status, "blocked");
  assert.equal(review.summary.claimSource, "missing_structured");
  assert.equal(review.checks.structuredClaimValid, false);
  assert.equal(review.checks.dirtyWorktreeStateOnly, false);
  assert.ok(review.reasons.includes("state_sync_structuredClaimValid"));
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
    ],
    ...withStateSyncClaim(input, {
      transitionKind: "state_only_pending_push"
    })
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

test("state sync audit blocks stale structured latest validated commits", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewStateSyncAudit({
    ...input,
    stateSyncClaimText: stateSyncClaimTextFromInput(input, {
      latestValidatedCommit: "1111111"
    })
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("state_sync_latestValidatedCommitRecorded"));
  assert.ok(review.reasons.includes("state_sync_structuredTransitionAllowed"));
});

test("state sync audit blocks stale observed branch without using Markdown head fields", async () => {
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
  assert.equal(review.checks.validatedSourceHeadRecorded, true);
  assert.equal(review.checks.latestValidatedCommitRecorded, true);
});

test("state sync audit blocks Markdown current head evidence drift", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewStateSyncAudit({
    ...input,
    currentStateText: input.currentStateText
      .replace(/\| Current head \| `[^`]+` \|/, "| Current head | `deadbee` |")
      .replace(/\| Latest validated commit \| `[^`]+` \|/, "| Latest validated commit | `feed123` |")
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("state_sync_evidenceDriftAbsent"));
  assert.equal(review.checks.evidenceDriftAbsent, false);
  assert.ok(review.issues.some((issue) => (
    issue.code === "state_document_evidence_drift"
    && issue.field === "Current head"
  )));
  assert.ok(review.issues.some((issue) => (
    issue.code === "state_document_evidence_drift"
    && issue.field === "Latest validated commit"
  )));
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

test("state sync audit accepts structured detached review checkout without validated source evidence", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewStateSyncAudit(asDetachedSyntheticReviewInput(input, {
    ...withStateSyncClaim(input, {
      upstream: "",
      transitionKind: "detached_review_checkout"
    })
  }));

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
    committedPathsSinceValidatedSource: strictStateRecordPaths(),
    ...withStateSyncClaim(input, {
      transitionKind: "state_only_pending_push"
    })
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
    ],
    ...withStateSyncClaim(input, {
      upstream: "",
      transitionKind: "detached_review_checkout"
    })
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

test("state sync audit blocks mismatched structured validated source divergence", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewStateSyncAudit({
    ...input,
    stateSyncClaimText: stateSyncClaimTextFromInput(input, {
      recordedAhead: 999,
      recordedBehind: 999
    })
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
    committedPathsSinceValidatedSource: strictStateRecordPaths(),
    ...withStateSyncClaim(input, {
      transitionKind: "state_only_pending_push"
    })
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
    ...withStateSyncClaim(input, {
      transitionKind: "state_only_pushed",
      recordedAhead: 1,
      recordedBehind: 0
    })
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
    stateSyncClaimText: stateSyncClaimTextFromInput(input, {
      transitionKind: "state_only_pushed",
      recordedAhead: 999,
      recordedBehind: 999
    })
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
    ...withStateSyncClaim(input, {
      transitionKind: "state_only_pushed",
      recordedAhead: 1,
      recordedBehind: 0
    })
  });

  assert.equal(review.status, "blocked");
  assert.equal(review.checks.validatedSourceDivergenceRecorded, false);
  assert.ok(review.reasons.includes("state_sync_validatedSourceDivergenceRecorded"));
});

test("state sync audit ignores missing Markdown state record mode for pushed structured snapshots", async () => {
  const input = await createInputFromWorkspace();
  const claimOverrides = {
    transitionKind: "state_only_pushed",
    recordedAhead: 1,
    recordedBehind: 0
  };
  const review = reviewStateSyncAudit({
    ...input,
    head: "3333333",
    aheadBehind: "0\t0",
    validatedSourceAheadBehind: "0\t1",
    validatedSourceAncestorOfHead: true,
    committedPathsSinceValidatedSource: strictStateRecordPaths(),
    ...withStateSyncClaim(input, claimOverrides),
    currentStateText: withCurrentStateMirrors(input.currentStateText, input, claimOverrides)
      .replace(/\| State record mode \| `[^`]+` \|\n/, "")
  });

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.validatedSourceDivergenceRecorded, true);
  assert.equal(review.checks.structuredTransitionAllowed, true);
});

test("state sync audit ignores stale Markdown state record mode for pushed structured snapshots", async () => {
  const input = await createInputFromWorkspace();
  const claimOverrides = {
    transitionKind: "state_only_pushed",
    recordedAhead: 1,
    recordedBehind: 0
  };
  const review = reviewStateSyncAudit({
    ...input,
    head: "3333333",
    aheadBehind: "0\t0",
    validatedSourceAheadBehind: "0\t1",
    validatedSourceAncestorOfHead: true,
    committedPathsSinceValidatedSource: strictStateRecordPaths(),
    ...withStateSyncClaim(input, claimOverrides),
    currentStateText: withCurrentStateMirrors(input.currentStateText, input, claimOverrides)
      .replace(
        /\| State record mode \| `[^`]+` \|/,
        "| State record mode | `source-only` |"
      )
  });

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.validatedSourceDivergenceRecorded, true);
  assert.equal(review.checks.structuredTransitionAllowed, true);
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
    ],
    stateSyncClaimText: stateSyncClaimTextFromInput(input, {
      transitionKind: "state_only_pushed",
      recordedAhead: 1,
      recordedBehind: 0
    })
  });

  assert.equal(review.status, "blocked");
  assert.equal(review.checks.structuredTransitionAllowed, false);
  assert.equal(review.checks.validatedSourceDivergenceRecorded, false);
  assert.ok(review.reasons.includes("state_sync_structuredTransitionAllowed"));
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
    ],
    stateSyncClaimText: stateSyncClaimTextFromInput(input, {
      transitionKind: "state_only_pushed",
      recordedAhead: 1,
      recordedBehind: 0
    })
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
    ],
    stateSyncClaimText: stateSyncClaimTextFromInput(input, {
      transitionKind: "state_only_pushed",
      recordedAhead: 1,
      recordedBehind: 0
    })
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
    ...withStateSyncClaim(input, {
      recordedAhead: 0,
      recordedBehind: 1
    })
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
    stateSyncClaimText: JSON.stringify({
      schemaVersion: 1,
      policyVersion: "state-sync-policy.v1",
      subject: {
        branch: input.branch,
        upstream: input.upstream
      },
      source: {
        validatedSourceCommit: input.head,
        latestValidatedCommit: input.head,
        sourceTreeDigest: {
          algorithm: "git-ls-tree-sha256",
          value: TEST_SOURCE_TREE_DIGEST,
          excludedPaths: strictStateRecordPaths()
        }
      },
      transition: {
        kind: "source_exact",
        allowedStatePaths: strictStateRecordPaths()
      }
    })
  });

  assert.equal(review.status, "blocked");
  assert.equal(review.checks.structuredClaimValid, false);
  assert.equal(review.checks.validatedSourceDivergenceRecorded, false);
  assert.ok(review.reasons.includes("state_sync_structuredClaimValid"));
});

test("state sync audit blocks malformed recorded upstream divergence", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewStateSyncAudit({
    ...input,
    stateSyncClaimText: JSON.stringify({
      schemaVersion: 1,
      policyVersion: "state-sync-policy.v1",
      subject: {
        branch: input.branch,
        upstream: input.upstream
      },
      source: {
        validatedSourceCommit: input.head,
        latestValidatedCommit: input.head,
        recordedDivergence: {
          ahead: "many",
          behind: "none"
        },
        sourceTreeDigest: {
          algorithm: "git-ls-tree-sha256",
          value: TEST_SOURCE_TREE_DIGEST,
          excludedPaths: strictStateRecordPaths()
        }
      },
      transition: {
        kind: "source_exact",
        allowedStatePaths: strictStateRecordPaths()
      }
    })
  });

  assert.equal(review.status, "blocked");
  assert.equal(review.checks.structuredClaimValid, false);
  assert.equal(review.checks.validatedSourceDivergenceRecorded, false);
  assert.ok(review.reasons.includes("state_sync_structuredClaimValid"));
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
  assert.match(text, /claim source: structured/);
  assert.match(text, /remote writes during audit: 0/);
  assert.equal(parsed.status, "passed");
  assert.equal(parsed.summary.claimSource, "structured");

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
  await writeStateSyncClaim(cwd, {
    branch: "pr-checkout",
    upstream: "",
    validatedSourceCommit: unreachableValidatedSource.trim(),
    latestValidatedCommit: unreachableValidatedSource.trim(),
    recordedAhead: 0,
    recordedBehind: 0
  });

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

  await writeMinimalWorkspace(cwd, "structured-record", sourceCommit, {
    upstream: "refs/remotes/origin/main",
    upstreamDivergence: "ahead 1 / behind 0"
  });
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

  assert.equal(input.upstream, "refs/remotes/origin/main");
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

  await writeMinimalWorkspace(cwd, "structured-record", sourceCommit, {
    upstream: "refs/remotes/origin/main",
    upstreamDivergence: "ahead 1 / behind 0"
  });
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

  assert.equal(input.upstream, "refs/remotes/origin/main");
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

  await writeMinimalWorkspace(cwd, "structured-record", sourceCommit, {
    upstream: "refs/remotes/origin/main",
    upstreamDivergence: "ahead 1 / behind 0"
  });
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
  assert.equal(input.upstream, "refs/remotes/origin/main");
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

  await writeMinimalWorkspace(cwd, "structured-record", sourceCommit, {
    upstream: "refs/remotes/origin/main",
    upstreamDivergence: "ahead 1 / behind 0"
  });
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
  assert.equal(input.upstream, "refs/remotes/origin/main");
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

test("state sync audit accepts structured squash-equivalent state records", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "state-sync-structured-squash-"));
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

  await writeMinimalWorkspace(cwd, "structured-record", sourceCommit, {
    upstream: "refs/remotes/origin/main",
    upstreamDivergence: "ahead 1 / behind 0"
  });
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
  await git(cwd, ["merge", "--squash", "structured-record"]);
  await git(cwd, ["commit", "-m", "squash structured record"]);
  await git(cwd, ["checkout", "--detach", "HEAD"]);

  const input = await collectStateSyncAuditInput(cwd);
  const review = reviewStateSyncAudit(input);

  assert.equal(input.branch, "");
  assert.equal(input.upstream, "refs/remotes/origin/main");
  assert.equal(input.aheadBehind, "1\t0");
  assert.equal(input.validatedSourceAheadBehind, "1\t0");
  assert.equal(input.validatedSourceAncestorOfHead, false);
  assert.ok(input.committedPathsSinceValidatedSource?.includes("packages/source.ts"));
  assert.deepEqual(
    new Set(input.validatedSourceTreeDiffPaths),
    new Set(strictStateRecordPaths())
  );
  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.summary.claimSource, "structured");
  assert.equal(review.checks.validatedSourceHeadRecorded, true);
  assert.equal(review.checks.validatedSourceCommitRecorded, true);
  assert.equal(review.checks.latestValidatedCommitRecorded, true);
  assert.equal(review.checks.agentBoardAligned, true);
  assert.equal(review.checks.structuredTransitionAllowed, true);
});

test("state sync audit accepts structured squash-only records without source commit objects", async () => {
  const sourceRepo = await mkdtemp(join(tmpdir(), "state-sync-structured-squash-source-"));
  await git(sourceRepo, ["init"]);
  await git(sourceRepo, ["config", "user.email", "state-sync@example.invalid"]);
  await git(sourceRepo, ["config", "user.name", "State Sync Test"]);
  await git(sourceRepo, ["checkout", "-b", "main"]);

  await writeMinimalWorkspace(sourceRepo, "main", "0000000");
  await git(sourceRepo, ["add", "."]);
  await git(sourceRepo, ["commit", "-m", "base"]);

  await git(sourceRepo, ["checkout", "-b", "structured-record"]);
  await mkdir(join(sourceRepo, "packages"), { recursive: true });
  await writeFile(
    join(sourceRepo, "packages", "source.ts"),
    "export const source = true;\n"
  );
  await git(sourceRepo, ["add", "."]);
  await git(sourceRepo, ["commit", "-m", "source"]);
  const sourceCommit = (await git(sourceRepo, ["rev-parse", "--short", "HEAD"])).trim();
  const sourceDigest = await gitFilteredTreeDigest(
    sourceCommit,
    strictStateRecordPaths(),
    sourceRepo
  );
  assert.ok(sourceDigest !== undefined);

  await writeMinimalWorkspace(sourceRepo, "structured-record", sourceCommit, {
    upstream: "refs/remotes/origin/main",
    upstreamDivergence: "ahead 1 / behind 0"
  });
  await writeStateSyncClaim(sourceRepo, {
    branch: "structured-record",
    upstream: "origin/main",
    validatedSourceCommit: sourceCommit,
    latestValidatedCommit: sourceCommit,
    recordedAhead: 1,
    recordedBehind: 0,
    sourceTreeDigest: sourceDigest,
    transitionKind: "state_only_pending_push"
  });
  await git(sourceRepo, ["add", "."]);
  await git(sourceRepo, ["commit", "-m", "state record"]);

  const squashPatch = await git(sourceRepo, ["diff", "--binary", "main..structured-record"]);
  const cwd = await mkdtemp(join(tmpdir(), "state-sync-structured-squash-only-"));
  const patchDir = await mkdtemp(join(tmpdir(), "state-sync-squash-patch-"));
  const patchPath = join(patchDir, "squash.patch");
  await writeFile(patchPath, squashPatch);
  await git(cwd, ["init"]);
  await git(cwd, ["config", "user.email", "state-sync@example.invalid"]);
  await git(cwd, ["config", "user.name", "State Sync Test"]);
  await git(cwd, ["checkout", "-b", "main"]);
  await writeMinimalWorkspace(cwd, "main", "0000000");
  await git(cwd, ["add", "."]);
  await git(cwd, ["commit", "-m", "base"]);
  await git(cwd, ["update-ref", "refs/remotes/origin/main", "HEAD"]);
  await git(cwd, ["apply", patchPath]);
  await git(cwd, ["add", "."]);
  await git(cwd, ["commit", "-m", "squash structured record"]);
  await git(cwd, ["checkout", "--detach", "HEAD"]);

  await assert.rejects(() => git(cwd, ["cat-file", "-e", `${sourceCommit}^{commit}`]));

  const input = await collectStateSyncAuditInput(cwd);
  const review = reviewStateSyncAudit(input);

  assert.equal(input.branch, "");
  assert.equal(input.upstream, "refs/remotes/origin/main");
  assert.equal(input.aheadBehind, "1\t0");
  assert.equal(input.validatedSourceCommitAvailable, false);
  assert.equal(input.validatedSourceAheadBehind, "unknown\tunknown");
  assert.equal(input.validatedSourceAncestorOfHead, false);
  assert.equal(input.committedPathsSinceValidatedSource, undefined);
  assert.equal(input.validatedSourceTreeDiffPaths, undefined);
  assert.equal(input.headSourceTreeDigest, sourceDigest);
  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.summary.claimSource, "structured");
  assert.equal(review.checks.validatedSourceHeadRecorded, true);
  assert.equal(review.checks.validatedSourceCommitRecorded, true);
  assert.equal(review.checks.validatedSourceDivergenceRecorded, true);
  assert.equal(review.checks.latestValidatedCommitRecorded, true);
  assert.equal(review.checks.agentBoardAligned, true);
  assert.equal(review.checks.structuredTransitionAllowed, true);
});

test("state sync audit blocks structured squash records with non-state source drift", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "state-sync-structured-squash-drift-"));
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

  await writeFile(
    join(cwd, "packages", "unvalidated.ts"),
    "export const unvalidated = true;\n"
  );
  await writeMinimalWorkspace(cwd, "structured-record", sourceCommit, {
    upstream: "refs/remotes/origin/main",
    upstreamDivergence: "ahead 1 / behind 0"
  });
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
  await git(cwd, ["commit", "-m", "state record with source drift"]);

  await git(cwd, ["checkout", "main"]);
  await git(cwd, ["merge", "--squash", "structured-record"]);
  await git(cwd, ["commit", "-m", "squash structured record"]);
  await git(cwd, ["checkout", "--detach", "HEAD"]);

  const input = await collectStateSyncAuditInput(cwd);
  const review = reviewStateSyncAudit(input);

  assert.equal(input.validatedSourceAncestorOfHead, false);
  assert.ok(input.committedPathsSinceValidatedSource?.includes("packages/unvalidated.ts"));
  assert.ok(input.validatedSourceTreeDiffPaths?.includes("packages/unvalidated.ts"));
  assert.equal(review.status, "blocked");
  assert.equal(review.checks.validatedSourceHeadRecorded, false);
  assert.equal(review.checks.validatedSourceCommitRecorded, false);
  assert.equal(review.checks.latestValidatedCommitRecorded, false);
  assert.equal(review.checks.structuredTransitionAllowed, false);
});

test("state sync audit blocks squash-only records when source digest drifts", async () => {
  const sourceRepo = await mkdtemp(join(tmpdir(), "state-sync-structured-squash-drift-source-"));
  await git(sourceRepo, ["init"]);
  await git(sourceRepo, ["config", "user.email", "state-sync@example.invalid"]);
  await git(sourceRepo, ["config", "user.name", "State Sync Test"]);
  await git(sourceRepo, ["checkout", "-b", "main"]);

  await writeMinimalWorkspace(sourceRepo, "main", "0000000");
  await git(sourceRepo, ["add", "."]);
  await git(sourceRepo, ["commit", "-m", "base"]);

  await git(sourceRepo, ["checkout", "-b", "structured-record"]);
  await mkdir(join(sourceRepo, "packages"), { recursive: true });
  await writeFile(
    join(sourceRepo, "packages", "source.ts"),
    "export const source = true;\n"
  );
  await git(sourceRepo, ["add", "."]);
  await git(sourceRepo, ["commit", "-m", "source"]);
  const sourceCommit = (await git(sourceRepo, ["rev-parse", "--short", "HEAD"])).trim();
  const sourceDigest = await gitFilteredTreeDigest(
    sourceCommit,
    strictStateRecordPaths(),
    sourceRepo
  );
  assert.ok(sourceDigest !== undefined);

  await writeFile(
    join(sourceRepo, "packages", "unvalidated.ts"),
    "export const unvalidated = true;\n"
  );
  await writeMinimalWorkspace(sourceRepo, "structured-record", sourceCommit, {
    upstream: "refs/remotes/origin/main",
    upstreamDivergence: "ahead 1 / behind 0"
  });
  await writeStateSyncClaim(sourceRepo, {
    branch: "structured-record",
    upstream: "origin/main",
    validatedSourceCommit: sourceCommit,
    latestValidatedCommit: sourceCommit,
    recordedAhead: 1,
    recordedBehind: 0,
    sourceTreeDigest: sourceDigest,
    transitionKind: "state_only_pending_push"
  });
  await git(sourceRepo, ["add", "."]);
  await git(sourceRepo, ["commit", "-m", "state record with source drift"]);

  const squashPatch = await git(sourceRepo, ["diff", "--binary", "main..structured-record"]);
  const cwd = await mkdtemp(join(tmpdir(), "state-sync-structured-squash-only-drift-"));
  const patchDir = await mkdtemp(join(tmpdir(), "state-sync-squash-drift-patch-"));
  const patchPath = join(patchDir, "squash.patch");
  await writeFile(patchPath, squashPatch);
  await git(cwd, ["init"]);
  await git(cwd, ["config", "user.email", "state-sync@example.invalid"]);
  await git(cwd, ["config", "user.name", "State Sync Test"]);
  await git(cwd, ["checkout", "-b", "main"]);
  await writeMinimalWorkspace(cwd, "main", "0000000");
  await git(cwd, ["add", "."]);
  await git(cwd, ["commit", "-m", "base"]);
  await git(cwd, ["update-ref", "refs/remotes/origin/main", "HEAD"]);
  await git(cwd, ["apply", patchPath]);
  await git(cwd, ["add", "."]);
  await git(cwd, ["commit", "-m", "squash structured record"]);
  await git(cwd, ["checkout", "--detach", "HEAD"]);

  await assert.rejects(() => git(cwd, ["cat-file", "-e", `${sourceCommit}^{commit}`]));

  const input = await collectStateSyncAuditInput(cwd);
  const review = reviewStateSyncAudit(input);

  assert.equal(input.validatedSourceCommitAvailable, false);
  assert.notEqual(input.headSourceTreeDigest, sourceDigest);
  assert.equal(review.status, "blocked");
  assert.equal(review.checks.validatedSourceHeadRecorded, false);
  assert.equal(review.checks.validatedSourceCommitRecorded, false);
  assert.equal(review.checks.validatedSourceDivergenceRecorded, false);
  assert.equal(review.checks.latestValidatedCommitRecorded, false);
  assert.equal(review.checks.structuredTransitionAllowed, false);
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

  await writeMinimalWorkspace(cwd, "structured-record", sourceCommit, {
    upstream: "refs/remotes/origin/main",
    upstreamDivergence: "ahead 1 / behind 0"
  });
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

test("state sync audit collector normalizes claim upstream before git resolution", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "state-sync-claim-upstream-normalize-"));
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

  await writeMinimalWorkspace(cwd, "structured-record", sourceCommit, {
    upstream: "refs/remotes/origin/main",
    upstreamDivergence: "ahead 1 / behind 0"
  });
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
  await git(cwd, ["tag", "origin/main", "HEAD"]);

  const input = await collectStateSyncAuditInput(cwd);
  const review = reviewStateSyncAudit(input);

  assert.equal(input.upstream, "refs/remotes/origin/main");
  assert.equal(input.aheadBehind, "2\t0");
  assert.equal(input.validatedSourceAheadBehind, "1\t0");
  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.upstreamRecorded, true);
  assert.equal(review.checks.validatedSourceDivergenceRecorded, true);
  assert.equal(review.checks.structuredTransitionAllowed, true);
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

test("state sync audit collector does not use Markdown anchor when claim is missing", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "state-sync-missing-claim-"));
  await git(cwd, ["init"]);
  await git(cwd, ["config", "user.email", "state-sync@example.invalid"]);
  await git(cwd, ["config", "user.name", "State Sync Test"]);

  await writeMinimalWorkspace(cwd, "main", "0000000");
  await git(cwd, ["add", "."]);
  await git(cwd, ["commit", "-m", "base"]);
  const sourceCommit = (await git(cwd, ["rev-parse", "--short", "HEAD"])).trim();

  await writeMinimalWorkspace(cwd, "main", sourceCommit);

  const input = await collectStateSyncAuditInput(cwd);
  const review = reviewStateSyncAudit(input);

  assert.equal(input.stateSyncClaimText, undefined);
  assert.equal(input.validatedSourceAheadBehind, undefined);
  assert.equal(input.validatedSourceAncestorOfHead, undefined);
  assert.equal(review.summary.claimSource, "missing_structured");
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
  overrides: StateSyncAuditInputOverrides = {}
): Promise<StateSyncAuditInput> {
  const currentStateText = await readFile("docs/current/CURRENT_STATE.md", "utf8");
  const agentBoardFiles = await Promise.all([
    ".agent_board/RUN_STATE.md",
    ".agent_board/TASK_QUEUE.md",
    ".agent_board/CHECKPOINT.md",
    ".agent_board/HANDOFF.md",
    ".agent_board/VALIDATION_LOG.md"
  ].map(async (path) => ({
    path,
    text: await readFile(path, "utf8")
  })));
  const agentBoardText = agentBoardFiles.map((file) => file.text).join("\n");
  const recordedHead = extractStateField(currentStateText, "Current head")
    ?? "UNKNOWN_HEAD";
  const recordedBranch = extractStateField(currentStateText, "Current branch")
    ?? "UNKNOWN_BRANCH";
  const recordedUpstream = normalizeTestUpstream(
    extractStateField(currentStateText, "Upstream") ?? ""
  );
  const recordedDivergence = extractStateDivergence(currentStateText)
    ?? "0\t0";

  const input: StateSyncAuditInput = {
    gitStatusShort: "",
    branch: recordedBranch,
    head: recordedHead,
    parentHead: recordedHead,
    upstream: recordedUpstream,
    aheadBehind: recordedDivergence,
    validatedSourceAheadBehind: recordedDivergence,
    validatedSourceCommitAvailable: true,
    validatedSourceTreeDigest: TEST_SOURCE_TREE_DIGEST,
    headSourceTreeDigest: TEST_SOURCE_TREE_DIGEST,
    packageJsonText: await readFile("package.json", "utf8"),
    currentStateText,
    agentBoardText,
    agentBoardFiles
  };
  const defaultStructuredClaim = withStateSyncClaim(input);

  const merged = {
    ...input,
    ...defaultStructuredClaim,
    ...overrides
  };

  if (merged.stateSyncClaimText === undefined) {
    const { stateSyncClaimText: _stateSyncClaimText, ...withoutClaim } = merged;
    return withoutClaim;
  }

  return {
    ...merged,
    stateSyncClaimText: merged.stateSyncClaimText
  };
}

function withoutAgentBoardFiles(
  input: StateSyncAuditInput
): Omit<StateSyncAuditInput, "agentBoardFiles"> {
  const { agentBoardFiles: _agentBoardFiles, ...withoutFiles } = input;
  return withoutFiles;
}

function normalizeTestUpstream(value: string): string {
  return value.startsWith("origin/") ? `refs/remotes/${value}` : value;
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

function withCurrentStateDivergence(
  text: string,
  ahead: number,
  behind: number
): string {
  return text.replace(
    /\| Upstream divergence \| `[^`]*` \|/,
    `| Upstream divergence | \`ahead ${ahead} / behind ${behind}\` |`
  );
}

function withCurrentStateMirrors(
  text: string,
  input: StateSyncAuditInput,
  overrides: StateSyncClaimTextOverrides = {}
): string {
  const divergence = parseTestAheadBehind(input.validatedSourceAheadBehind);
  const recordedAhead = overrides.recordedAhead ?? divergence.ahead;
  const recordedBehind = overrides.recordedBehind ?? divergence.behind;
  const recordedDivergence = formatTestDivergence(recordedAhead, recordedBehind);
  const branch = overrides.branch ?? input.branch;
  const upstream = normalizeTestUpstream(overrides.upstream ?? input.upstream);
  const validatedSourceCommit = overrides.validatedSourceCommit ?? input.head;
  const latestValidatedCommit =
    overrides.latestValidatedCommit ?? validatedSourceCommit;
  const transition = overrides.transitionKind ?? "source_exact";
  const allowedStatePaths = overrides.allowedStatePaths ?? strictStateRecordPaths();
  const sourceTreeDigest = overrides.sourceTreeDigest ?? TEST_SOURCE_TREE_DIGEST;
  let updated = text;

  updated = replaceCurrentStateTableField(updated, "Current branch", branch);
  updated = replaceCurrentStateTableField(
    updated,
    "Current head",
    validatedSourceCommit
  );
  updated = replaceCurrentStateTableField(
    updated,
    "Validated source commit",
    validatedSourceCommit
  );
  updated = replaceCurrentStateTableField(updated, "Upstream", upstream);
  updated = replaceCurrentStateTableField(
    updated,
    "Upstream divergence",
    recordedDivergence
  );
  updated = replaceCurrentStateTableField(
    updated,
    "Latest validated commit",
    latestValidatedCommit
  );
  updated = replaceCurrentStateTableField(
    updated,
    "State record mode",
    stateRecordModeForTestTransition(transition)
  );
  updated = replaceCurrentStateBullet(
    updated,
    "schema version",
    String(overrides.schemaVersion ?? 1)
  );
  updated = replaceCurrentStateBullet(
    updated,
    "policy version",
    overrides.policyVersion ?? "state-sync-policy.v1"
  );
  updated = replaceCurrentStateBullet(updated, "transition kind", transition);
  updated = replaceCurrentStateBullet(
    updated,
    "validated source commit",
    validatedSourceCommit
  );
  updated = replaceCurrentStateBullet(
    updated,
    "latest validated commit",
    latestValidatedCommit
  );
  updated = replaceCurrentStateBullet(updated, "upstream baseline", upstream);
  updated = replaceCurrentStateBullet(
    updated,
    "recorded divergence baseline",
    recordedDivergence
  );
  updated = replaceCurrentStateSourceTreeDigest(updated, sourceTreeDigest);
  updated = replaceCurrentStateStrictStatePaths(updated, allowedStatePaths);
  updated = replaceCurrentStateValidationSourceCommit(
    updated,
    validatedSourceCommit
  );
  updated = replaceCurrentStateExpectation(updated, "branch", branch);
  updated = replaceCurrentStateExpectation(updated, "upstream", upstream);
  updated = replaceCurrentStateExpectation(
    updated,
    "validated source commit",
    validatedSourceCommit
  );
  updated = replaceCurrentStateExpectation(
    updated,
    "recorded divergence baseline",
    recordedDivergence
  );
  updated = replaceCurrentStateExpectation(updated, "transition", transition);
  updated = replaceCurrentStateValidatedSourceDivergenceExpectation(
    updated,
    testValidatedSourceDivergenceExpectation(
      transition,
      branch,
      upstream,
      recordedAhead,
      recordedBehind
    )
  );

  return updated;
}

function replaceCurrentStateTableField(
  text: string,
  field: string,
  value: string
): string {
  return text.replace(
    new RegExp(`(\\| ${escapeTestRegExp(field)} \\| \`)[^\\\`\\r\\n]*(\` \\|)`),
    `$1${value}$2`
  );
}

function replaceCurrentStateBullet(
  text: string,
  field: string,
  value: string
): string {
  return text.replace(
    new RegExp(`(- ${escapeTestRegExp(field)}: \`)[^\\\`\\r\\n]*(\`)`),
    `$1${value}$2`
  );
}

function replaceCurrentStateSourceTreeDigest(
  text: string,
  value: string
): string {
  return text.replace(
    /(- source tree digest: `git-ls-tree-sha256`\r?\n  `)[^`\r\n]*(\`)/,
    `$1${value}$2`
  );
}

function replaceCurrentStateStrictStatePaths(
  text: string,
  paths: string[]
): string {
  return text.replace(
    /(Strict state record paths:\r?\n\r?\n)(?:- `[^`\r\n]*`\r?\n)+/,
    `$1${paths.map((path) => `- \`${path}\``).join("\n")}\n`
  );
}

function replaceCurrentStateValidationSourceCommit(
  text: string,
  value: string
): string {
  return text.replace(
    /(Validation recorded for source commit `)[^`\r\n]*(\`:)/,
    `$1${value}$2`
  );
}

function replaceCurrentStateExpectation(
  text: string,
  field: string,
  value: string
): string {
  return replaceCurrentStateExpectationSection(
    text,
    new RegExp(`(- ${escapeTestRegExp(field)}: \`)[^\\\`\\r\\n]*(\`)`),
    `$1${value}$2`
  );
}

function replaceCurrentStateValidatedSourceDivergenceExpectation(
  text: string,
  value: string
): string {
  return replaceCurrentStateExpectationSection(
    text,
    /(?:For this|When this PR branch state record is committed and pushed, Git observation should|After the state record is pushed, Git observation should compute|Git observation should compute)[\s\S]*?source divergence as\s*`[^`\r\n]+`\s*against\s*`[^`\r\n]*`[\s\S]*?\./,
    value
  );
}

function replaceCurrentStateExpectationSection(
  text: string,
  pattern: RegExp,
  replacement: string
): string {
  const sectionStart = text.indexOf("## State Sync Expectations");
  if (sectionStart < 0) {
    return text;
  }

  return text.slice(0, sectionStart)
    + text.slice(sectionStart).replace(pattern, replacement);
}

function testValidatedSourceDivergenceExpectation(
  transition: string,
  branch: string,
  upstream: string,
  ahead: number,
  behind: number
): string {
  if (transition === "state_only_pushed") {
    return [
      "For this `state_only_pushed` state-only record, Git observation should",
      `compute the validated source divergence as \`${formatTestDivergence(behind, ahead)}\` against`,
      `\`${upstream}\` after the state-only record is on upstream.`
    ].join("\n");
  }

  const recordedDivergence = formatTestDivergence(ahead, behind);
  if (transition === "state_only_pending_push") {
    return [
      `For this \`state_only_pending_push\` record on branch \`${branch}\`,`,
      "Git observation should compute the validated source divergence as",
      `\`${recordedDivergence}\` against \`${upstream}\` before the state-only`,
      "record is pushed."
    ].join("\n");
  }

  return [
    `For this \`${transition}\` record, Git observation should compute`,
    `the validated source divergence as \`${recordedDivergence}\` against`,
    `\`${upstream}\` at the validated source commit.`
  ].join("\n");
}

function stateRecordModeForTestTransition(transition: string): string {
  if (transition === "state_only_pending_push" || transition === "state_only_pushed") {
    return "state-only descendant allowed";
  }

  return transition;
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
  overrides: StateSyncClaimTextOverrides = {}
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
      },
      sourceTreeDigest: {
        algorithm: "git-ls-tree-sha256",
        value: overrides.sourceTreeDigest ?? TEST_SOURCE_TREE_DIGEST,
        excludedPaths:
          overrides.sourceTreeDigestExcludedPaths
          ?? overrides.allowedStatePaths
          ?? strictStateRecordPaths()
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

function withStateSyncClaim(
  input: StateSyncAuditInput,
  overrides: StateSyncClaimTextOverrides = {}
): Pick<
  StateSyncAuditInput,
  "agentBoardFiles" | "agentBoardText" | "currentStateText" | "stateSyncClaimText"
> {
  const agentBoardFiles = input.agentBoardFiles?.map((file) => ({
    path: file.path,
    text: withAgentBoardMirrors(file.text, input, overrides)
  }));
  const result = {
    agentBoardText: agentBoardFiles === undefined
      ? withAgentBoardMirrors(input.agentBoardText, input, overrides)
      : agentBoardFiles.map((file) => file.text).join("\n"),
    currentStateText: withCurrentStateMirrors(input.currentStateText, input, overrides),
    stateSyncClaimText: stateSyncClaimTextFromInput(input, overrides)
  };

  return agentBoardFiles === undefined ? result : { ...result, agentBoardFiles };
}

function withAgentBoardMirrors(
  text: string,
  input: StateSyncAuditInput,
  overrides: StateSyncClaimTextOverrides = {}
): string {
  const fields = testDisplayFieldsFromInput(input, overrides);
  let updated = text;
  for (const [field, value] of Object.entries(fields.generated)) {
    updated = replaceAgentBoardGeneratedField(updated, field, value);
  }
  for (const [heading, value] of Object.entries(fields.headings)) {
    updated = replaceAgentBoardHeadingIfPresent(updated, heading, value);
  }

  return updated;
}

function testDisplayFieldsFromInput(
  input: StateSyncAuditInput,
  overrides: StateSyncClaimTextOverrides = {}
): {
  generated: Record<string, string>;
  headings: Record<string, string>;
} {
  const divergence = parseTestAheadBehind(input.validatedSourceAheadBehind);
  const recordedDivergence =
    `ahead ${overrides.recordedAhead ?? divergence.ahead}`
    + ` / behind ${overrides.recordedBehind ?? divergence.behind}`;
  const branch = overrides.branch ?? input.branch;
  const upstream = normalizeTestUpstream(overrides.upstream ?? input.upstream);
  const validatedSourceCommit = overrides.validatedSourceCommit ?? input.head;
  const latestValidatedCommit =
    overrides.latestValidatedCommit ?? validatedSourceCommit;
  const transition = overrides.transitionKind ?? "source_exact";

  return {
    generated: {
      branch,
      upstream,
      "validated source commit": validatedSourceCommit,
      "latest validated commit": latestValidatedCommit,
      "recorded divergence baseline": recordedDivergence,
      transition
    },
    headings: {
      "Branch:": branch,
      "Current branch:": branch,
      "Current head:": validatedSourceCommit,
      "Validated source commit:": validatedSourceCommit,
      "Current validated source:": validatedSourceCommit,
      "Latest validated commit:": latestValidatedCommit,
      "Upstream baseline:": upstream,
      "Upstream divergence baseline:": recordedDivergence,
      "Recorded divergence baseline:": recordedDivergence,
      "Transition:": transition,
      "Current transition:": transition
    }
  };
}

function replaceAgentBoardGeneratedField(
  text: string,
  field: string,
  value: string
): string {
  return text.replace(
    new RegExp(`(- ${escapeTestRegExp(field)}: \`)[^\\\`\\r\\n]*(\`)`, "g"),
    `$1${value}$2`
  );
}

function replaceAgentBoardHeadingIfPresent(
  text: string,
  heading: string,
  value: string
): string {
  return text.replace(
    new RegExp(
      `(${escapeTestRegExp(heading)}\\r?\\n\\r?\\n- \`)[^\\\`\\r\\n]*(\`)`,
      "g"
    ),
    `$1${value}$2`
  );
}

function escapeTestRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
  validatedSourceCommit: string,
  options: {
    upstream?: string;
    upstreamDivergence?: string;
  } = {}
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
    minimalCurrentState(branch, validatedSourceCommit, options)
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
    sourceTreeDigest?: string;
    transitionKind?: string;
  }
): Promise<void> {
  const sourceTreeDigest =
    input.sourceTreeDigest
    ?? await gitFilteredTreeDigest(
      input.validatedSourceCommit,
      strictStateRecordPaths(),
      cwd
    )
    ?? TEST_SOURCE_TREE_DIGEST;

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
        },
        sourceTreeDigest: {
          algorithm: "git-ls-tree-sha256",
          value: sourceTreeDigest,
          excludedPaths: strictStateRecordPaths()
        }
      },
      transition: {
        kind: input.transitionKind ?? "source_exact",
        allowedStatePaths: strictStateRecordPaths()
      }
    }, null, 2)
  );
  await writeMinimalStateSurfacesForClaim(cwd, {
    ...input,
    sourceTreeDigest
  });
}

async function writeMinimalStateSurfacesForClaim(
  cwd: string,
  input: {
    branch: string;
    upstream: string;
    validatedSourceCommit: string;
    latestValidatedCommit: string;
    recordedAhead: number;
    recordedBehind: number;
    sourceTreeDigest: string;
    transitionKind?: string;
  }
): Promise<void> {
  const upstreamDivergence = formatTestDivergence(
    input.recordedAhead,
    input.recordedBehind
  );
  await writeFile(
    join(cwd, "docs", "current", "CURRENT_STATE.md"),
    minimalCurrentState(input.branch, input.validatedSourceCommit, {
      upstream: normalizeTestUpstream(input.upstream),
      upstreamDivergence,
      latestValidatedCommit: input.latestValidatedCommit,
      sourceTreeDigest: input.sourceTreeDigest,
      transitionKind: input.transitionKind ?? "source_exact",
      strictStatePaths: strictStateRecordPaths()
    })
  );

  const boardText = minimalAgentBoardText(input);
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

function minimalAgentBoardText(input: {
  branch: string;
  upstream: string;
  validatedSourceCommit: string;
  latestValidatedCommit: string;
  recordedAhead: number;
  recordedBehind: number;
  transitionKind?: string;
}): string {
  return [
    "# State Board",
    "",
    `Branch: \`${input.branch}\``,
    "Current truth source: `docs/current/CURRENT_STATE.md`",
    `Validated source commit: \`${input.validatedSourceCommit}\``,
    `Latest validated commit: \`${input.latestValidatedCommit}\``,
    "",
    renderTestGeneratedDisplayBlock(input),
    ""
  ].join("\n");
}

function renderTestGeneratedDisplayBlock(input: {
  branch: string;
  upstream: string;
  validatedSourceCommit: string;
  latestValidatedCommit: string;
  recordedAhead: number;
  recordedBehind: number;
  transitionKind?: string;
}): string {
  return [
    "<!-- state-sync-display:start -->",
    "Generated from `docs/current/state-sync-record.json`.",
    "",
    `- branch: \`${input.branch}\``,
    `- upstream: \`${normalizeTestUpstream(input.upstream)}\``,
    `- validated source commit: \`${input.validatedSourceCommit}\``,
    `- latest validated commit: \`${input.latestValidatedCommit}\``,
    `- recorded divergence baseline: \`${
      formatTestDivergence(input.recordedAhead, input.recordedBehind)
    }\``,
    `- transition: \`${input.transitionKind ?? "source_exact"}\``,
    "<!-- state-sync-display:end -->"
  ].join("\n");
}

function formatTestDivergence(ahead: number, behind: number): string {
  return `ahead ${ahead} / behind ${behind}`;
}

async function writeStateSyncRecordText(
  cwd: string,
  text: string
): Promise<void> {
  await mkdir(join(cwd, "docs", "current"), { recursive: true });
  await writeFile(join(cwd, "docs", "current", "state-sync-record.json"), text);
}

function minimalCurrentState(
  branch: string,
  validatedSourceCommit: string,
  options: {
    upstream?: string;
    upstreamDivergence?: string;
    latestValidatedCommit?: string;
    sourceTreeDigest?: string;
    strictStatePaths?: string[];
    transitionKind?: string;
  } = {}
): string {
  const upstream = options.upstream ?? "";
  const upstreamDivergence =
    options.upstreamDivergence ?? "ahead 0 / behind 0";
  const latestValidatedCommit =
    options.latestValidatedCommit ?? validatedSourceCommit;
  const sourceTreeDigest = options.sourceTreeDigest ?? TEST_SOURCE_TREE_DIGEST;
  const strictStatePaths = options.strictStatePaths ?? strictStateRecordPaths();
  const transitionKind = options.transitionKind ?? "source_exact";
  const divergence = parseTestDivergenceText(upstreamDivergence);

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
    `| Upstream | \`${upstream}\` |`,
    `| Upstream divergence | \`${upstreamDivergence}\` |`,
    `| Latest validated commit | \`${latestValidatedCommit}\` |`,
    `| State record mode | \`${stateRecordModeForTestTransition(transitionKind)}\` |`,
    "| Stale after commit | `true` |",
    "",
    "## Structured Record",
    "",
    "The structured claim records:",
    "",
    "- schema version: `1`",
    "- policy version: `state-sync-policy.v1`",
    `- transition kind: \`${transitionKind}\``,
    `- validated source commit: \`${validatedSourceCommit}\``,
    `- latest validated commit: \`${latestValidatedCommit}\``,
    `- upstream baseline: \`${upstream}\``,
    `- recorded divergence baseline: \`${upstreamDivergence}\``,
    "- source tree digest: `git-ls-tree-sha256`",
    `  \`${sourceTreeDigest}\``,
    "",
    "Strict state record paths:",
    "",
    ...strictStatePaths.map((path) => `- \`${path}\``),
    "",
    "## Current Entrypoints",
    "",
    "- Current docs map: `docs/README.md`",
    "",
    "Validation baseline:",
    "",
    `Validation recorded for source commit \`${validatedSourceCommit}\`:`,
    "",
    "- `npx tsx --test tests\\codex-cli-host.test.ts`",
    "- `npm run typecheck`",
    "- `npm test`",
    "- `npm run build`",
    "",
    "## State Sync Expectations",
    "",
    "The structured claim records:",
    "",
    `- branch: \`${branch}\``,
    `- upstream: \`${upstream}\``,
    `- validated source commit: \`${validatedSourceCommit}\``,
    `- recorded divergence baseline: \`${upstreamDivergence}\``,
    `- transition: \`${transitionKind}\``,
    "",
    testValidatedSourceDivergenceExpectation(
      transitionKind,
      branch,
      upstream,
      divergence.ahead,
      divergence.behind
    ),
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

function parseTestDivergenceText(value: string): { ahead: number; behind: number } {
  const match = /^ahead (-?\d+) \/ behind (-?\d+)$/.exec(value);
  if (match === null) {
    return { ahead: 0, behind: 0 };
  }

  return {
    ahead: Number.parseInt(match[1] ?? "0", 10),
    behind: Number.parseInt(match[2] ?? "0", 10)
  };
}

function replaceLast(text: string, pattern: RegExp, replacement: string): string {
  const matches = [...text.matchAll(pattern)];
  const last = matches.at(-1);
  if (last?.index === undefined) {
    return text;
  }

  return `${text.slice(0, last.index)}${replacement}${text.slice(
    last.index + last[0].length
  )}`;
}
