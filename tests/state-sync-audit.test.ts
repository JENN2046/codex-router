import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import {
  collectStateSyncBlockingReasons,
  formatStateSyncAuditResult,
  parseStateSyncPolicyV2Claim,
  reviewStateSyncAudit,
  STATE_SYNC_AUTHORITY_CHECKS,
  STATE_SYNC_LEGACY_COMPATIBILITY_CHECKS,
  type StateSyncAuditChecks,
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
type StateSyncPolicyV2ClaimTextOverrides = {
  repositoryId?: string | null;
  repositoryFullName?: string;
  sourceTreeDigest?: string;
  sourceTreeDigestExcludedPaths?: string[];
  allowedContexts?: Array<{
    event: string;
    targetRef: string;
  }>;
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
  assert.equal(review.summary.requiredValidationCommandCount, 0);
  assert.equal(review.summary.requiredBoundaryMarkerCount, 0);
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

test("state sync audit ignores stale Markdown and agent board display mirrors", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewStateSyncAudit({
    ...withoutAgentBoardFiles(input),
    currentStateText: input.currentStateText
      .replace(/\| Current branch \| `[^`]+` \|/, "| Current branch | `stale-branch` |")
      .replace(/\| Current head \| `[^`]+` \|/, "| Current head | `1111111` |")
      .replace(/\| Validated source commit \| `[^`]+` \|/, "| Validated source commit | `2222222` |")
      .replace(/\| Upstream \| `[^`]+` \|/, "| Upstream | `origin/stale` |")
      .replace(/\| Upstream divergence \| `[^`]+` \|/, "| Upstream divergence | `ahead 999 / behind 999` |")
      .replace(/\| Latest validated commit \| `[^`]+` \|/, "| Latest validated commit | `3333333` |"),
    agentBoardText: input.agentBoardText
      .replace(/<!-- state-sync-display:start -->[\s\S]*?<!-- state-sync-display:end -->\n?/g, "")
      .replace(
        /Upstream baseline:\r?\n\r?\n- `[^`]*`/,
        "Upstream baseline:\n\n- `refs/remotes/origin/stale`"
      )
  });

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.agentBoardAligned, true);
  assert.equal(review.checks.evidenceDriftAbsent, true);
  assert.deepEqual(review.issues, []);
});

test("state sync audit ignores Markdown checklist and display-state fields", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewStateSyncAudit({
    ...input,
    currentStateText: input.currentStateText
      .replace("CURRENT_STATE_RECORDED", "")
      .replace(/\| Stale after commit \| `[^`]+` \|\n/, "")
      .replaceAll("`npx tsx --test tests\\codex-cli-host.test.ts`", "`retired-validation`")
      .replaceAll("`npm run typecheck`", "`retired-typecheck`")
      .replaceAll("`npm test`", "`retired-test`")
      .replaceAll("`npm run build`", "`retired-build`")
      .replaceAll("`general_provider_execution`", "`retired-provider-boundary`")
      .replaceAll("`general_workspace_write`", "`retired-workspace-boundary`")
      .replaceAll("`protected_remote_write`", "`retired-remote-boundary`")
      .replaceAll("`push_to_main`", "`retired-push-boundary`")
      .replaceAll("`release_tag_deploy`", "`retired-release-boundary`")
      .replaceAll("`secret_or_credential_change`", "`retired-secret-boundary`")
      .replaceAll("`external_service_write`", "`retired-external-boundary`")
  });

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.currentStateRecorded, true);
  assert.equal(review.checks.staleAfterCommitRecorded, true);
  assert.equal(review.checks.validationBaselineRecorded, true);
  assert.equal(review.checks.executionBoundaryRecorded, true);
  assert.equal(review.summary.requiredValidationCommandCount, 0);
  assert.equal(review.summary.requiredBoundaryMarkerCount, 0);
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
      allowedStatePaths: strictStateRecordPaths()
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
      allowedStatePaths: strictStateRecordPaths()
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

test("state sync policy v2 parser accepts content attestation records", () => {
  const result = parseStateSyncPolicyV2Claim(stateSyncPolicyV2ClaimText());

  assert.equal(result.status, "valid");
  if (result.status !== "valid") {
    return;
  }

  assert.equal(result.claim.schemaVersion, 2);
  assert.equal(result.claim.policyVersion, "state-sync-policy.v2");
  assert.deepEqual(result.claim.repository, {
    id: "123456",
    fullName: "JENN2046/codex-router"
  });
  assert.deepEqual(result.claim.source.sourceTreeDigest, {
    algorithm: "git-ls-tree-sha256",
    value: TEST_SOURCE_TREE_DIGEST,
    excludedPaths: policyV2SourceTreeDigestExcludedPaths()
  });
  assert.deepEqual(result.claim.allowedContexts, [
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
  ]);
});

test("state sync policy v2 parser fails closed on malformed records", async (t) => {
  const cases: Array<[
    string,
    (claim: Record<string, unknown>) => void,
    string
  ]> = [
    ["top-level unknown field", (claim) => {
      claim.extra = true;
    }, "unknown_claim_field"],
    ["unsupported schema", (claim) => {
      claim.schemaVersion = 1;
    }, "unsupported_schema_version"],
    ["unsupported policy", (claim) => {
      claim.policyVersion = "state-sync-policy.v1";
    }, "unsupported_policy_version"],
    ["repository unknown field", (claim) => {
      (claim.repository as Record<string, unknown>).extra = true;
    }, "repository_unknown_field"],
    ["repository malformed", (claim) => {
      (claim.repository as Record<string, unknown>).fullName = "codex-router";
    }, "repository_malformed"],
    ["source unknown field", (claim) => {
      (claim.source as Record<string, unknown>).extra = true;
    }, "source_unknown_field"],
    ["source tree digest unknown field", (claim) => {
      const source = claim.source as Record<string, unknown>;
      (source.sourceTreeDigest as Record<string, unknown>).extra = true;
    }, "source_tree_digest_unknown_field"],
    ["source tree digest unsupported path", (claim) => {
      const source = claim.source as Record<string, unknown>;
      const digest = source.sourceTreeDigest as Record<string, unknown>;
      digest.excludedPaths = [
        ...policyV2SourceTreeDigestExcludedPaths(),
        "docs/current/OTHER.md"
      ];
    }, "source_tree_digest_malformed"],
    ["source tree digest duplicate path missing required exclusion", (claim) => {
      const source = claim.source as Record<string, unknown>;
      const digest = source.sourceTreeDigest as Record<string, unknown>;
      digest.excludedPaths = [
        ...policyV2SourceTreeDigestExcludedPaths().filter(
          (path) => path !== ".agent_board/VALIDATION_LOG.md"
        ),
        "docs/current/state-sync-record.json"
      ];
    }, "source_tree_digest_malformed"],
    ["source tree digest malformed value", (claim) => {
      const source = claim.source as Record<string, unknown>;
      const digest = source.sourceTreeDigest as Record<string, unknown>;
      digest.value = "A".repeat(64);
    }, "source_tree_digest_malformed"],
    ["allowed contexts empty", (claim) => {
      claim.allowedContexts = [];
    }, "allowed_contexts_malformed"],
    ["allowed context unknown field", (claim) => {
      const [context] = claim.allowedContexts as Array<Record<string, unknown>>;
      context!.extra = true;
    }, "allowed_contexts_malformed"],
    ["allowed context unsupported event", (claim) => {
      const [context] = claim.allowedContexts as Array<Record<string, unknown>>;
      context!.event = "workflow_dispatch";
    }, "allowed_contexts_malformed"],
    ["allowed context unsupported target", (claim) => {
      const [context] = claim.allowedContexts as Array<Record<string, unknown>>;
      context!.targetRef = "refs/heads/release";
    }, "allowed_contexts_malformed"],
    ["allowed context duplicate", (claim) => {
      const contexts = claim.allowedContexts as Array<Record<string, unknown>>;
      claim.allowedContexts = [contexts[0]!, { ...contexts[0]! }];
    }, "allowed_contexts_malformed"]
  ];

  for (const [name, mutate, reason] of cases) {
    await t.test(name, () => {
      const claim = JSON.parse(stateSyncPolicyV2ClaimText()) as Record<string, unknown>;
      mutate(claim);

      assert.deepEqual(parseStateSyncPolicyV2Claim(JSON.stringify(claim)), {
        status: "invalid",
        reason
      });
    });
  }
});

test("state sync audit accepts policy v2 main push content attestations", async () => {
  const review = reviewStateSyncAudit(await createPolicyV2PushInput());

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.summary.claimSource, "structured");
  assert.equal(review.summary.transitionKind, "");
  assert.equal(review.summary.sourceTreeDigest, TEST_SOURCE_TREE_DIGEST);
  assert.equal(review.checks.currentBranchMatches, true);
  assert.equal(review.checks.validatedSourceHeadRecorded, true);
  assert.equal(review.checks.validatedSourceCommitRecorded, true);
  assert.equal(review.checks.upstreamRecorded, true);
  assert.equal(review.checks.validatedSourceDivergenceRecorded, true);
  assert.equal(review.checks.latestValidatedCommitRecorded, true);
  assert.equal(review.checks.dirtyWorktreeStateOnly, true);
  assert.equal(review.checks.structuredClaimValid, true);
  assert.equal(review.checks.structuredTransitionAllowed, true);
});

test("state sync audit accepts policy v2 local main content attestations", async () => {
  const review = reviewStateSyncAudit(await createPolicyV2LocalMainInput());

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.summary.claimSource, "structured");
  assert.equal(review.summary.observation.eventName, "local");
  assert.equal(review.summary.observation.targetRef, "refs/heads/main");
  assert.equal(review.checks.structuredTransitionAllowed, true);
});

test("state sync audit accepts policy v2 local main content attestations without observed repository id", async () => {
  const review = reviewStateSyncAudit(await createPolicyV2LocalMainInput({
    repositoryId: "",
    stateSyncClaimText: stateSyncPolicyV2ClaimText({
      repositoryId: "123456"
    })
  }));

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.summary.claimSource, "structured");
  assert.equal(review.summary.observation.eventName, "local");
  assert.equal(review.summary.observation.repositoryId, "");
  assert.equal(review.checks.structuredTransitionAllowed, true);
});

test("state sync audit accepts policy v2 pull request head attestations", async () => {
  const review = reviewStateSyncAudit(await createPolicyV2PullRequestInput());

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.summary.claimSource, "structured");
  assert.equal(review.checks.structuredTransitionAllowed, true);
  assert.equal(review.summary.observation.checkoutSubject, "pull_request_head");
});

test("state sync audit accepts policy v2 pull request merge attestations", async () => {
  const mergeSha = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const review = reviewStateSyncAudit(await createPolicyV2PullRequestInput({
    head: mergeSha.slice(0, 7),
    headFull: mergeSha,
    githubSha: mergeSha,
    checkoutSubject: "pull_request_merge"
  }));

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.structuredTransitionAllowed, true);
  assert.equal(review.summary.observation.checkoutSubject, "pull_request_merge");
});

test("state sync audit blocks policy v2 source digest drift", async () => {
  const review = reviewStateSyncAudit(await createPolicyV2PushInput({
    headSourceTreeDigest:
      "1111111111111111111111111111111111111111111111111111111111111111"
  }));

  assert.equal(review.status, "blocked");
  assert.equal(review.checks.structuredClaimValid, true);
  assert.equal(review.checks.structuredTransitionAllowed, false);
  assert.ok(review.reasons.includes("state_sync_structuredTransitionAllowed"));
});

test("state sync audit blocks policy v2 wrong repository observations", async () => {
  const review = reviewStateSyncAudit(await createPolicyV2PushInput({
    repositoryFullName: "JENN2046/other-router"
  }));

  assert.equal(review.status, "blocked");
  assert.equal(review.checks.structuredTransitionAllowed, false);
  assert.ok(review.reasons.includes("state_sync_structuredTransitionAllowed"));
});

test("state sync audit blocks policy v2 missing observed repository ids", async () => {
  const review = reviewStateSyncAudit(await createPolicyV2PushInput({
    repositoryId: ""
  }));

  assert.equal(review.status, "blocked");
  assert.equal(review.checks.structuredTransitionAllowed, false);
  assert.ok(review.reasons.includes("state_sync_structuredTransitionAllowed"));
});

test("state sync audit blocks policy v2 wrong event observations", async () => {
  const review = reviewStateSyncAudit(await createPolicyV2PushInput({
    eventName: "workflow_dispatch"
  }));

  assert.equal(review.status, "blocked");
  assert.equal(review.checks.structuredTransitionAllowed, false);
  assert.ok(review.reasons.includes("state_sync_structuredTransitionAllowed"));
});

test("state sync audit blocks policy v2 wrong target refs", async () => {
  const review = reviewStateSyncAudit(await createPolicyV2PushInput({
    ref: "refs/heads/release",
    targetRef: "refs/heads/release"
  }));

  assert.equal(review.status, "blocked");
  assert.equal(review.checks.structuredTransitionAllowed, false);
  assert.ok(review.reasons.includes("state_sync_structuredTransitionAllowed"));
});

test("state sync audit blocks policy v2 pull requests without origin main refs", async () => {
  const review = reviewStateSyncAudit(await createPolicyV2PullRequestInput({
    remoteTrackingRef: "",
    upstream: "",
    aheadBehind: "unknown\tunknown"
  }));

  assert.equal(review.status, "blocked");
  assert.equal(review.checks.structuredTransitionAllowed, false);
  assert.ok(review.reasons.includes("state_sync_structuredTransitionAllowed"));
});

test("state sync audit blocks policy v2 pull requests without origin main sha evidence", async () => {
  const review = reviewStateSyncAudit(await createPolicyV2PullRequestInput({
    originMainFull: ""
  }));

  assert.equal(review.status, "blocked");
  assert.equal(review.checks.structuredTransitionAllowed, false);
  assert.ok(review.reasons.includes("state_sync_structuredTransitionAllowed"));
});

test("state sync audit blocks policy v2 pull requests with unknown main divergence", async () => {
  const review = reviewStateSyncAudit(await createPolicyV2PullRequestInput({
    aheadBehind: "unknown\tunknown"
  }));

  assert.equal(review.status, "blocked");
  assert.equal(review.checks.structuredTransitionAllowed, false);
  assert.ok(review.reasons.includes("state_sync_structuredTransitionAllowed"));
});

test("state sync audit blocks policy v2 dirty worktrees", async () => {
  const review = reviewStateSyncAudit(await createPolicyV2PushInput({
    gitStatusShort: " M docs/current/state-sync-record.json"
  }));

  assert.equal(review.status, "blocked");
  assert.equal(review.checks.dirtyWorktreeStateOnly, false);
  assert.equal(review.checks.structuredTransitionAllowed, false);
  assert.ok(review.reasons.includes("state_sync_dirtyWorktreeStateOnly"));
  assert.ok(review.reasons.includes("state_sync_structuredTransitionAllowed"));
});

test("state sync audit blocks policy v2 moving main checkouts", async () => {
  const review = reviewStateSyncAudit(await createPolicyV2PushInput({
    originMainFull: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  }));

  assert.equal(review.status, "blocked");
  assert.equal(review.checks.structuredTransitionAllowed, false);
  assert.ok(review.reasons.includes("state_sync_structuredTransitionAllowed"));
});

test("state sync audit blocks policy v2 local branch checkouts", async () => {
  const review = reviewStateSyncAudit(await createPolicyV2LocalMainInput({
    branch: "feature/state-sync-v2",
    targetRef: "refs/heads/feature/state-sync-v2"
  }));

  assert.equal(review.status, "blocked");
  assert.equal(review.checks.structuredTransitionAllowed, false);
  assert.ok(review.reasons.includes("state_sync_structuredTransitionAllowed"));
});

test("state sync audit blocks policy v2 unknown fields", async () => {
  const claim = JSON.parse(stateSyncPolicyV2ClaimText()) as Record<string, unknown>;
  claim.extra = true;
  const review = reviewStateSyncAudit(await createPolicyV2PushInput({
    stateSyncClaimText: JSON.stringify(claim)
  }));

  assert.equal(review.status, "blocked");
  assert.equal(review.summary.claimSource, "invalid_structured");
  assert.equal(review.checks.structuredClaimValid, false);
  assert.ok(review.reasons.includes("state_sync_structuredClaimValid"));
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

test("state sync audit accepts dirty structured record files", async () => {
  const review = reviewStateSyncAudit(await createInputFromWorkspace({
    gitStatusShort: " M docs/current/state-sync-record.json"
  }));

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.dirtyWorktreeStateOnly, true);
  assert.equal(review.summary.gitStatusEntryCount, 1);
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
      "docs/current/state-sync-record.json"
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

test("state sync audit ignores Markdown current head evidence drift", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewStateSyncAudit({
    ...input,
    currentStateText: input.currentStateText
      .replace(/\| Current head \| `[^`]+` \|/, "| Current head | `deadbee` |")
      .replace(/\| Latest validated commit \| `[^`]+` \|/, "| Latest validated commit | `feed123` |")
  });

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.evidenceDriftAbsent, true);
  assert.deepEqual(review.issues, []);
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
  assert.equal(review.checks.validatedSourceDivergenceRecorded, false);
  assert.equal(review.checks.validatedSourceHeadRecorded, false);
  assert.equal(review.checks.validatedSourceCommitRecorded, false);
  assert.equal(review.checks.latestValidatedCommitRecorded, false);
  assert.ok(review.reasons.includes("state_sync_validatedSourceDivergenceRecorded"));
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
    head: input.head,
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

test("state sync audit accepts detached review claims with full source commit IDs", async () => {
  const input = await createInputFromWorkspace();
  const observedHead = (await git(process.cwd(), ["rev-parse", "--short", "HEAD"])).trim();
  const fullObservedHead = (await git(process.cwd(), ["rev-parse", "HEAD"])).trim();
  const observedInput = {
    ...input,
    head: observedHead,
    headFull: fullObservedHead,
    parentHead: observedHead
  };
  const review = reviewStateSyncAudit(asDetachedSyntheticReviewInput(observedInput, {
    head: observedHead,
    headFull: fullObservedHead,
    parentHead: observedHead,
    ...withStateSyncClaim(observedInput, {
      upstream: "",
      validatedSourceCommit: fullObservedHead,
      latestValidatedCommit: fullObservedHead,
      transitionKind: "detached_review_checkout"
    })
  }));

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.validatedSourceDivergenceRecorded, true);
  assert.equal(review.checks.structuredTransitionAllowed, true);
});

test("state sync audit blocks forged full detached claim IDs sharing the observed short prefix", async () => {
  const input = await createInputFromWorkspace();
  const observedHead = (await git(process.cwd(), ["rev-parse", "--short", "HEAD"])).trim();
  const fullObservedHead = (await git(process.cwd(), ["rev-parse", "HEAD"])).trim();
  const zeroPaddedCommit = `${observedHead}${"0".repeat(40 - observedHead.length)}`;
  const forgedCommit = zeroPaddedCommit === fullObservedHead
    ? `${observedHead}${"1".repeat(40 - observedHead.length)}`
    : zeroPaddedCommit;
  const observedInput = {
    ...input,
    head: observedHead,
    headFull: fullObservedHead,
    parentHead: observedHead
  };
  const review = reviewStateSyncAudit(asDetachedSyntheticReviewInput(observedInput, {
    head: observedHead,
    headFull: fullObservedHead,
    parentHead: observedHead,
    validatedSourceCommitAvailable: false,
    headSourceTreeDigest: TEST_SOURCE_TREE_DIGEST,
    ...withStateSyncClaim(observedInput, {
      upstream: "",
      validatedSourceCommit: forgedCommit,
      latestValidatedCommit: forgedCommit,
      transitionKind: "detached_review_checkout"
    })
  }));

  assert.equal(review.status, "blocked");
  assert.equal(review.checks.validatedSourceDivergenceRecorded, false);
  assert.equal(review.checks.structuredTransitionAllowed, false);
  assert.ok(review.reasons.includes("state_sync_validatedSourceDivergenceRecorded"));
  assert.ok(review.reasons.includes("state_sync_structuredTransitionAllowed"));
});

test("state sync audit blocks detached review claims that do not match observed head", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewStateSyncAudit(asDetachedSyntheticReviewInput(input, {
    head: "8a5c580",
    validatedSourceCommitAvailable: false,
    headSourceTreeDigest: TEST_SOURCE_TREE_DIGEST,
    validatedSourceAheadBehind: "unknown\tunknown",
    ...withStateSyncClaim(input, {
      upstream: "",
      transitionKind: "detached_review_checkout"
    })
  }));

  assert.equal(review.status, "blocked");
  assert.equal(review.checks.validatedSourceDivergenceRecorded, false);
  assert.equal(review.checks.structuredTransitionAllowed, false);
  assert.ok(review.reasons.includes("state_sync_validatedSourceDivergenceRecorded"));
  assert.ok(review.reasons.includes("state_sync_structuredTransitionAllowed"));
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

test("state sync audit accepts clean detached PR checkouts through structured transition", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewStateSyncAudit({
    ...input,
    gitStatusShort: "",
    branch: "",
    head: input.head,
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
    }),
    currentStateText: withCurrentStateMirrors(input.currentStateText, input, {
      upstream: "",
      transitionKind: "detached_review_checkout"
    })
      .replace(/\| Stale after commit \| `[^`]+` \|\n/, "")
      .replace(/\| Synthetic review checkout \| `allowed` \|\n/, "")
  });

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.currentBranchMatches, true);
  assert.equal(review.checks.validatedSourceHeadRecorded, true);
  assert.equal(review.checks.validatedSourceCommitRecorded, true);
  assert.equal(review.checks.validatedSourceDivergenceRecorded, true);
});

test("state sync audit blocks detached PR checkouts without detached review transition", async () => {
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
    ...withStateSyncClaim(input, {
      upstream: "",
      transitionKind: "state_only_pending_push"
    })
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("state_sync_validatedSourceHeadRecorded"));
  assert.ok(review.reasons.includes("state_sync_validatedSourceCommitRecorded"));
  assert.ok(review.reasons.includes("state_sync_latestValidatedCommitRecorded"));
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

test("state sync audit ignores obsolete stale agent board checklist markers", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewStateSyncAudit({
    ...input,
    agentBoardText: [
      input.agentBoardText,
      "main` and `origin/main` are aligned at `68320e3`"
    ].join("\n")
  });

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.staleMarkersAbsent, true);
  assert.equal(review.summary.staleMarkerHitCount, 0);
});

test("state sync audit ignores stale agent board commit facts", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewStateSyncAudit({
    ...input,
    agentBoardText: [
      input.agentBoardText,
      "Historical stale board head: `1687e61`"
    ].join("\n")
  });

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.agentBoardAligned, true);
});

test("state sync audit blocks missing governance script but ignores boundary checklist markers", async () => {
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
  assert.equal(review.checks.executionBoundaryRecorded, true);
  assert.ok(!review.reasons.includes("state_sync_executionBoundaryRecorded"));
});

test("state sync audit output stays summarized", async () => {
  const review = reviewStateSyncAudit(await createInputFromWorkspace());
  const text = formatStateSyncAuditResult(review);
  const json = formatStateSyncAuditResult(review, "json");
  const parsed = JSON.parse(json) as typeof review;

  assert.match(text, /status: passed/);
  assert.match(text, /claim source: structured/);
  assert.match(text, /claim transition: [a-z_]+/);
  assert.match(text, /validated source commit: [0-9a-f]{7,40}/);
  assert.match(text, /latest validated commit: [0-9a-f]{7,40}/);
  assert.match(text, /source tree digest: git-ls-tree-sha256:[0-9a-f]{64}/);
  assert.match(text, /state-only paths: docs\/current\/state-sync-record\.json/);
  assert.match(text, /authority checks: all passed/);
  assert.match(text, /remote writes during audit: 0/);
  assert.doesNotMatch(text, /validation commands:/);
  assert.doesNotMatch(text, /boundary markers:/);
  assert.doesNotMatch(text, /stale marker hits:/);
  assert.doesNotMatch(text, /agentBoardAligned/);
  assert.doesNotMatch(text, /currentStateRecorded/);
  assert.doesNotMatch(text, /evidenceDriftAbsent/);
  assert.equal(parsed.status, "passed");
  assert.equal(parsed.summary.claimSource, "structured");
  assert.deepEqual(parsed.checkCategories.authority, [...STATE_SYNC_AUTHORITY_CHECKS]);
  assert.deepEqual(
    parsed.checkCategories.legacyCompatibility,
    [...STATE_SYNC_LEGACY_COMPATIBILITY_CHECKS]
  );

  for (const marker of ["OPENAI_API_KEY", "sk-", "Bearer ", "raw token"]) {
    assert.equal(text.includes(marker), false, `text output must omit ${marker}`);
    assert.equal(json.includes(marker), false, `json output must omit ${marker}`);
  }
});

test("state sync audit exposes explicit observation fields without changing authority", async () => {
  const input = await createInputFromWorkspace({
    eventName: "push",
    repositoryFullName: "JENN2046/codex-router",
    repositoryId: "123456",
    ref: "refs/heads/main",
    targetRef: "refs/heads/main",
    remoteTrackingRef: "refs/remotes/origin/main",
    githubSha: "0123456789abcdef0123456789abcdef01234567",
    checkoutSubject: "detached",
    headFull: "0123456789abcdef0123456789abcdef01234567",
    originMainFull: "0123456789abcdef0123456789abcdef01234567"
  });
  const review = reviewStateSyncAudit(input);
  const text = formatStateSyncAuditResult(review);
  const json = formatStateSyncAuditResult(review, "json");
  const parsed = JSON.parse(json) as typeof review;

  assert.equal(review.status, "passed");
  assert.equal(review.reasons.length, 0);
  assert.deepEqual(parsed.checkCategories.authority, [...STATE_SYNC_AUTHORITY_CHECKS]);
  assert.equal(parsed.summary.observation.eventName, "push");
  assert.equal(parsed.summary.observation.repositoryFullName, "JENN2046/codex-router");
  assert.equal(parsed.summary.observation.ref, "refs/heads/main");
  assert.equal(parsed.summary.observation.targetRef, "refs/heads/main");
  assert.equal(parsed.summary.observation.remoteTrackingRef, "refs/remotes/origin/main");
  assert.equal(parsed.summary.observation.githubSha, "0123456789abcdef0123456789abcdef01234567");
  assert.equal(parsed.summary.observation.checkoutSubject, "detached");
  assert.equal(parsed.summary.observation.worktreeIsClean, true);
  assert.match(text, /observed event: push/);
  assert.match(text, /observed ref: refs\/heads\/main/);
  assert.match(text, /observed checkout subject: detached/);
});

test("state sync audit categorizes retired checks as legacy compatibility", async () => {
  const review = reviewStateSyncAudit(await createInputFromWorkspace());
  const authority = new Set(review.checkCategories.authority);
  const legacy = new Set(review.checkCategories.legacyCompatibility);
  const categorized = new Set([
    ...review.checkCategories.authority,
    ...review.checkCategories.legacyCompatibility
  ]);

  for (const name of Object.keys(review.checks)) {
    assert.equal(categorized.has(name as keyof StateSyncAuditChecks), true, name);
  }
  for (const name of review.checkCategories.authority) {
    assert.equal(legacy.has(name), false, name);
  }
  for (const name of review.checkCategories.legacyCompatibility) {
    assert.equal(authority.has(name), false, name);
  }
  for (const name of [
    "currentStateRecorded",
    "staleAfterCommitRecorded",
    "validationBaselineRecorded",
    "executionBoundaryRecorded",
    "agentBoardAligned",
    "staleMarkersAbsent",
    "evidenceDriftAbsent"
  ] as const) {
    assert.equal(legacy.has(name), true, name);
  }
});

test("state sync audit blocking reasons ignore legacy compatibility checks", async () => {
  const review = reviewStateSyncAudit(await createInputFromWorkspace());
  const checks: StateSyncAuditChecks = {
    ...review.checks,
    currentStateRecorded: false,
    staleAfterCommitRecorded: false,
    validationBaselineRecorded: false,
    executionBoundaryRecorded: false,
    agentBoardAligned: false,
    staleMarkersAbsent: false,
    evidenceDriftAbsent: false
  };

  assert.deepEqual(collectStateSyncBlockingReasons(checks), []);
  assert.deepEqual(collectStateSyncBlockingReasons({
    ...checks,
    structuredClaimValid: false
  }), ["state_sync_structuredClaimValid"]);
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

test("state sync audit collector captures bounded GitHub pull request observations", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "state-sync-github-observation-"));
  await git(cwd, ["init"]);
  await git(cwd, ["config", "user.email", "state-sync@example.invalid"]);
  await git(cwd, ["config", "user.name", "State Sync Test"]);
  await git(cwd, ["checkout", "-b", "feature"]);

  await writeMinimalWorkspace(cwd, "feature", "0000000");
  await git(cwd, ["add", "."]);
  await git(cwd, ["commit", "-m", "source"]);
  const sourceCommit = (await git(cwd, ["rev-parse", "--short", "HEAD"])).trim();

  await writeMinimalWorkspace(cwd, "feature", sourceCommit);
  await writeStateSyncClaim(cwd, {
    branch: "feature",
    upstream: "",
    validatedSourceCommit: sourceCommit,
    latestValidatedCommit: sourceCommit,
    recordedAhead: 0,
    recordedBehind: 0
  });
  await git(cwd, ["add", "."]);
  await git(cwd, ["commit", "-m", "state record"]);
  const headFull = (await git(cwd, ["rev-parse", "HEAD"])).trim();
  const eventDir = await mkdtemp(join(tmpdir(), "state-sync-github-event-"));
  const eventPath = join(eventDir, "event.json");
  await writeFile(
    eventPath,
    JSON.stringify({
      pull_request: {
        head: {
          sha: headFull
        }
      }
    })
  );

  const restoredEnv = restoreEnvAfterTest([
    "GITHUB_EVENT_NAME",
    "GITHUB_REPOSITORY",
    "GITHUB_REPOSITORY_ID",
    "GITHUB_REF",
    "GITHUB_BASE_REF",
    "GITHUB_HEAD_REF",
    "GITHUB_SHA",
    "GITHUB_EVENT_PATH",
    "GITHUB_ACTIONS"
  ]);
  try {
    process.env.GITHUB_EVENT_NAME = "pull_request";
    process.env.GITHUB_REPOSITORY = "JENN2046/codex-router";
    process.env.GITHUB_REPOSITORY_ID = "123456";
    process.env.GITHUB_REF = "refs/pull/88/merge";
    process.env.GITHUB_BASE_REF = "main";
    process.env.GITHUB_HEAD_REF = "feature";
    process.env.GITHUB_SHA = "ffffffffffffffffffffffffffffffffffffffff";
    process.env.GITHUB_EVENT_PATH = eventPath;
    process.env.GITHUB_ACTIONS = "true";

    const input = await collectStateSyncAuditInput(cwd);
    const review = reviewStateSyncAudit(input);

    assert.equal(input.eventName, "pull_request");
    assert.equal(input.repositoryFullName, "JENN2046/codex-router");
    assert.equal(input.repositoryId, "123456");
    assert.equal(input.ref, "refs/pull/88/merge");
    assert.equal(input.baseRef, "refs/heads/main");
    assert.equal(input.headRef, "refs/heads/feature");
    assert.equal(input.targetRef, "refs/heads/main");
    assert.equal(input.pullRequestHeadSha, headFull);
    assert.equal(input.githubSha, "ffffffffffffffffffffffffffffffffffffffff");
    assert.equal(input.checkoutSubject, "pull_request_head");
    assert.equal(review.summary.observation.checkoutSubject, "pull_request_head");
    assert.equal(review.summary.observation.worktreeIsClean, true);
  } finally {
    restoredEnv();
  }
});

test("state sync audit collector computes policy v2 head digests", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "state-sync-v2-collector-"));
  await git(cwd, ["init"]);
  await git(cwd, ["config", "user.email", "state-sync@example.invalid"]);
  await git(cwd, ["config", "user.name", "State Sync Test"]);
  await git(cwd, ["checkout", "-b", "main"]);

  await writeMinimalWorkspace(cwd, "main", "0000000");
  await mkdir(join(cwd, "packages"), { recursive: true });
  await writeFile(join(cwd, "packages", "source.ts"), "export const source = true;\n");
  await git(cwd, ["add", "."]);
  await git(cwd, ["commit", "-m", "source"]);
  const sourceDigest = await gitFilteredTreeDigest(
    "HEAD",
    policyV2SourceTreeDigestExcludedPaths(),
    cwd
  );
  assert.ok(sourceDigest !== undefined);

  await writeStateSyncRecordText(cwd, stateSyncPolicyV2ClaimText({
    sourceTreeDigest: sourceDigest
  }));
  await git(cwd, ["add", "docs/current/state-sync-record.json"]);
  await git(cwd, ["commit", "-m", "policy v2 state record"]);
  await git(cwd, ["update-ref", "refs/remotes/origin/main", "HEAD"]);
  const headFull = (await git(cwd, ["rev-parse", "HEAD"])).trim();

  const restoredEnv = restoreEnvAfterTest([
    "GITHUB_EVENT_NAME",
    "GITHUB_REPOSITORY",
    "GITHUB_REPOSITORY_ID",
    "GITHUB_REF",
    "GITHUB_SHA"
  ]);
  try {
    process.env.GITHUB_EVENT_NAME = "push";
    process.env.GITHUB_REPOSITORY = "JENN2046/codex-router";
    process.env.GITHUB_REPOSITORY_ID = "123456";
    process.env.GITHUB_REF = "refs/heads/main";
    process.env.GITHUB_SHA = headFull;

    const input = await collectStateSyncAuditInput(cwd);
    const review = reviewStateSyncAudit(input);

    assert.equal(input.upstream, "refs/remotes/origin/main");
    assert.equal(input.remoteTrackingRef, "refs/remotes/origin/main");
    assert.equal(input.headSourceTreeDigest, sourceDigest);
    assert.equal(input.validatedSourceCommitAvailable, undefined);
    assert.equal(input.originMainFull, headFull);
    assert.equal(review.status, "passed");
    assert.deepEqual(review.reasons, []);
    assert.equal(review.summary.claimSource, "structured");
    assert.equal(review.checks.structuredTransitionAllowed, true);
  } finally {
    restoredEnv();
  }
});

test("state sync audit collector observes local policy v2 main context", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "state-sync-v2-local-collector-"));
  await git(cwd, ["init"]);
  await git(cwd, ["config", "user.email", "state-sync@example.invalid"]);
  await git(cwd, ["config", "user.name", "State Sync Test"]);
  await git(cwd, ["checkout", "-b", "main"]);
  await git(cwd, [
    "remote",
    "add",
    "origin",
    "git@github.com:JENN2046/codex-router.git"
  ]);

  await writeMinimalWorkspace(cwd, "main", "0000000");
  await mkdir(join(cwd, "packages"), { recursive: true });
  await writeFile(join(cwd, "packages", "source.ts"), "export const source = true;\n");
  await git(cwd, ["add", "."]);
  await git(cwd, ["commit", "-m", "source"]);
  const sourceDigest = await gitFilteredTreeDigest(
    "HEAD",
    policyV2SourceTreeDigestExcludedPaths(),
    cwd
  );
  assert.ok(sourceDigest !== undefined);

  await writeStateSyncRecordText(cwd, stateSyncPolicyV2ClaimText({
    repositoryId: null,
    sourceTreeDigest: sourceDigest
  }));
  await git(cwd, ["add", "docs/current/state-sync-record.json"]);
  await git(cwd, ["commit", "-m", "policy v2 state record"]);
  await git(cwd, ["update-ref", "refs/remotes/origin/main", "HEAD"]);

  const restoredEnv = restoreEnvAfterTest([
    "GITHUB_EVENT_NAME",
    "GITHUB_REPOSITORY",
    "GITHUB_REPOSITORY_ID",
    "GITHUB_REF",
    "GITHUB_SHA"
  ]);
  try {
    delete process.env.GITHUB_EVENT_NAME;
    delete process.env.GITHUB_REPOSITORY;
    delete process.env.GITHUB_REPOSITORY_ID;
    delete process.env.GITHUB_REF;
    delete process.env.GITHUB_SHA;

    const input = await collectStateSyncAuditInput(cwd);
    const review = reviewStateSyncAudit(input);

    assert.equal(input.eventName, "local");
    assert.equal(input.repositoryFullName, "JENN2046/codex-router");
    assert.equal(input.repositoryId, "");
    assert.equal(input.targetRef, "refs/heads/main");
    assert.equal(input.remoteTrackingRef, "refs/remotes/origin/main");
    assert.equal(input.headSourceTreeDigest, sourceDigest);
    assert.equal(review.status, "passed");
    assert.deepEqual(review.reasons, []);
  } finally {
    restoredEnv();
  }
});

test("state sync audit collector drops malformed GitHub observation env values", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "state-sync-github-observation-safe-"));
  await git(cwd, ["init"]);
  await git(cwd, ["config", "user.email", "state-sync@example.invalid"]);
  await git(cwd, ["config", "user.name", "State Sync Test"]);
  await git(cwd, ["checkout", "-b", "feature"]);

  await writeMinimalWorkspace(cwd, "feature", "0000000");
  await git(cwd, ["add", "."]);
  await git(cwd, ["commit", "-m", "source"]);
  const sourceCommit = (await git(cwd, ["rev-parse", "--short", "HEAD"])).trim();
  await writeStateSyncClaim(cwd, {
    branch: "feature",
    upstream: "",
    validatedSourceCommit: sourceCommit,
    latestValidatedCommit: sourceCommit,
    recordedAhead: 0,
    recordedBehind: 0
  });

  const restoredEnv = restoreEnvAfterTest([
    "GITHUB_EVENT_NAME",
    "GITHUB_REPOSITORY",
    "GITHUB_REPOSITORY_ID",
    "GITHUB_REF",
    "GITHUB_BASE_REF",
    "GITHUB_HEAD_REF",
    "GITHUB_SHA",
    "GITHUB_EVENT_PATH",
    "GITHUB_ACTIONS"
  ]);
  try {
    process.env.GITHUB_EVENT_NAME = "workflow_dispatch";
    process.env.GITHUB_REPOSITORY = "not a repo token";
    process.env.GITHUB_REPOSITORY_ID = "many";
    process.env.GITHUB_REF = "refs/heads/main;echo secret";
    process.env.GITHUB_BASE_REF = "../main";
    process.env.GITHUB_HEAD_REF = "feature lock.lock";
    process.env.GITHUB_SHA = "not-a-sha";
    process.env.GITHUB_EVENT_PATH = "/tmp/private.json";
    process.env.GITHUB_ACTIONS = "false";

    const input = await collectStateSyncAuditInput(cwd);
    const review = reviewStateSyncAudit(input);

    assert.equal(input.eventName, "");
    assert.equal(input.repositoryFullName, "");
    assert.equal(input.repositoryId, "");
    assert.equal(input.ref, "");
    assert.equal(input.baseRef, "");
    assert.equal(input.headRef, "");
    assert.equal(input.targetRef, "");
    assert.equal(input.githubSha, "");
    assert.equal(input.pullRequestHeadSha, "");
    assert.equal(review.summary.observation.repositoryFullName, "");
  } finally {
    restoredEnv();
  }
});

test("state sync audit collector does not require display or handoff surfaces", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "state-sync-json-only-"));
  await git(cwd, ["init"]);
  await git(cwd, ["config", "user.email", "state-sync@example.invalid"]);
  await git(cwd, ["config", "user.name", "State Sync Test"]);
  await git(cwd, ["checkout", "-b", "main"]);

  await writeFile(
    join(cwd, "package.json"),
    JSON.stringify({
      scripts: {
        governance: "node --import tsx scripts/run-governance-check.ts"
      }
    }, null, 2)
  );
  await git(cwd, ["add", "package.json"]);
  await git(cwd, ["commit", "-m", "source"]);
  const sourceCommit = (await git(cwd, ["rev-parse", "--short", "HEAD"])).trim();

  await writeStateSyncClaim(cwd, {
    branch: "main",
    upstream: "refs/remotes/origin/main",
    validatedSourceCommit: sourceCommit,
    latestValidatedCommit: sourceCommit,
    recordedAhead: 1,
    recordedBehind: 0,
    transitionKind: "state_only_pushed"
  });
  await git(cwd, ["add", "docs/current/state-sync-record.json"]);
  await git(cwd, ["commit", "-m", "state record"]);
  await git(cwd, ["update-ref", "refs/remotes/origin/main", "HEAD"]);

  const input = await collectStateSyncAuditInput(cwd);
  const review = reviewStateSyncAudit(input);

  assert.equal(input.currentStateText, "");
  assert.equal(input.agentBoardText, "");
  assert.equal(input.agentBoardFiles, undefined);
  assert.deepEqual(input.committedPathsSinceValidatedSource, strictStateRecordPaths());
  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.summary.claimSource, "structured");
  assert.equal(review.checks.currentStateRecorded, true);
  assert.equal(review.checks.agentBoardAligned, true);
  assert.equal(review.checks.outputSanitized, true);
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
  assert.match(input.headFull ?? "", /^[0-9a-f]{40}$/);
  assert.equal(input.headFull?.startsWith(input.head), true);
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

test("state sync audit ignores machine absolute paths in display surfaces", async () => {
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
      ),
      agentBoardText: [
        input.agentBoardText,
        `Operator handoff path: \`${machinePath}\``
      ].join("\n")
    });

    assert.equal(review.status, "passed", machinePath);
    assert.deepEqual(review.reasons, [], machinePath);
    assert.equal(review.checks.outputSanitized, true, machinePath);
    assert.deepEqual(review.issues, [], machinePath);
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

test("state sync audit sanitizes structured record issues without echoing sentinel paths", async () => {
  const input = await createInputFromWorkspace();
  const sentinelPath = "A:\\PRIVATE_SENTINEL\\user\\secret-repo";
  const claim = JSON.parse(input.stateSyncClaimText ?? "{}") as {
    validation?: { requiredCommands?: string[] };
  };
  claim.validation = {
    requiredCommands: [
      `node scripts/check.js --workspace ${sentinelPath}`,
      "echo OPENAI_API_KEY"
    ]
  };
  const review = reviewStateSyncAudit({
    ...input,
    stateSyncClaimText: JSON.stringify(claim, null, 2)
  });
  const text = formatStateSyncAuditResult(review);
  const json = formatStateSyncAuditResult(review, "json");

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("state_sync_outputSanitized"));
  assert.ok(review.issues.some((issue) => (
    issue.code === "state_document_windows_drive_path"
    && issue.path === "docs/current/state-sync-record.json"
    && issue.line > 0
  )));
  assert.ok(review.issues.some((issue) => (
    issue.code === "state_document_secret_marker"
    && issue.path === "docs/current/state-sync-record.json"
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
  const defaultBranch = "state-sync-audit-test";
  const defaultHead = "0123456";
  const defaultUpstream = "refs/remotes/origin/main";
  const currentStateText = minimalCurrentState(defaultBranch, defaultHead, {
    upstream: defaultUpstream,
    upstreamDivergence: "ahead 0 / behind 0",
    sourceTreeDigest: TEST_SOURCE_TREE_DIGEST,
    strictStatePaths: strictStateRecordPaths()
  });
  const agentBoardTextFixture = minimalAgentBoardText({
    branch: defaultBranch,
    upstream: defaultUpstream,
    validatedSourceCommit: defaultHead,
    latestValidatedCommit: defaultHead,
    recordedAhead: 0,
    recordedBehind: 0,
    transitionKind: "source_exact"
  });
  const agentBoardFiles = [
    ".agent_board/RUN_STATE.md",
    ".agent_board/TASK_QUEUE.md",
    ".agent_board/CHECKPOINT.md",
    ".agent_board/HANDOFF.md",
    ".agent_board/VALIDATION_LOG.md"
  ].map((path) => ({
    path,
    text: agentBoardTextFixture
  }));
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

async function createPolicyV2PushInput(
  overrides: StateSyncAuditInputOverrides = {}
): Promise<StateSyncAuditInput> {
  const headFull =
    overrides.headFull ?? "0123456789abcdef0123456789abcdef01234567";

  return createInputFromWorkspace({
    gitStatusShort: "",
    branch: "",
    head: overrides.head ?? headFull.slice(0, 7),
    headFull,
    upstream: "refs/remotes/origin/main",
    aheadBehind: "0\t0",
    eventName: "push",
    repositoryFullName: "JENN2046/codex-router",
    repositoryId: "123456",
    ref: "refs/heads/main",
    targetRef: "refs/heads/main",
    remoteTrackingRef: "refs/remotes/origin/main",
    githubSha: headFull,
    originMainFull: headFull,
    checkoutSubject: "detached",
    headSourceTreeDigest: TEST_SOURCE_TREE_DIGEST,
    stateSyncClaimText: stateSyncPolicyV2ClaimText(),
    ...overrides
  });
}

async function createPolicyV2LocalMainInput(
  overrides: StateSyncAuditInputOverrides = {}
): Promise<StateSyncAuditInput> {
  const headFull =
    overrides.headFull ?? "0123456789abcdef0123456789abcdef01234567";

  return createInputFromWorkspace({
    gitStatusShort: "",
    branch: "main",
    head: overrides.head ?? headFull.slice(0, 7),
    headFull,
    upstream: "refs/remotes/origin/main",
    aheadBehind: "0\t0",
    eventName: "local",
    repositoryFullName: "JENN2046/codex-router",
    ref: "",
    targetRef: "refs/heads/main",
    remoteTrackingRef: "refs/remotes/origin/main",
    originMainFull: headFull,
    checkoutSubject: "branch",
    headSourceTreeDigest: TEST_SOURCE_TREE_DIGEST,
    stateSyncClaimText: stateSyncPolicyV2ClaimText({
      repositoryId: null
    }),
    ...overrides
  });
}

async function createPolicyV2PullRequestInput(
  overrides: StateSyncAuditInputOverrides = {}
): Promise<StateSyncAuditInput> {
  const headFull =
    overrides.headFull ?? "0123456789abcdef0123456789abcdef01234567";
  const originMainFull =
    overrides.originMainFull ?? "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

  return createInputFromWorkspace({
    gitStatusShort: "",
    branch: "",
    head: overrides.head ?? headFull.slice(0, 7),
    headFull,
    upstream: "refs/remotes/origin/main",
    aheadBehind: "1\t0",
    eventName: "pull_request",
    repositoryFullName: "JENN2046/codex-router",
    repositoryId: "123456",
    ref: "refs/pull/90/merge",
    targetRef: "refs/heads/main",
    remoteTrackingRef: "refs/remotes/origin/main",
    baseRef: "refs/heads/main",
    headRef: "refs/heads/state-sync-policy-v2-verifier",
    githubSha: "ffffffffffffffffffffffffffffffffffffffff",
    pullRequestHeadSha: headFull,
    originMainFull,
    checkoutSubject: "pull_request_head",
    headSourceTreeDigest: TEST_SOURCE_TREE_DIGEST,
    stateSyncClaimText: stateSyncPolicyV2ClaimText(),
    ...overrides
  });
}

function stateSyncPolicyV2ClaimText(
  overrides: StateSyncPolicyV2ClaimTextOverrides = {}
): string {
  const repository: Record<string, string> = {
    fullName: overrides.repositoryFullName ?? "JENN2046/codex-router"
  };
  if (overrides.repositoryId !== null) {
    repository.id = overrides.repositoryId ?? "123456";
  }

  return JSON.stringify({
    schemaVersion: 2,
    policyVersion: "state-sync-policy.v2",
    repository,
    source: {
      sourceTreeDigest: {
        algorithm: "git-ls-tree-sha256",
        value: overrides.sourceTreeDigest ?? TEST_SOURCE_TREE_DIGEST,
        excludedPaths:
          overrides.sourceTreeDigestExcludedPaths
          ?? policyV2SourceTreeDigestExcludedPaths()
      }
    },
    allowedContexts: overrides.allowedContexts ?? [
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

function restoreEnvAfterTest(names: string[]): () => void {
  const previous = new Map<string, string | undefined>(
    names.map((name) => [name, process.env[name]])
  );

  return () => {
    for (const [name, value] of previous) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  };
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
        governance: "node --import tsx scripts/run-governance-check.ts"
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
    "Optional display generated from `docs/current/state-sync-record.json`.",
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
