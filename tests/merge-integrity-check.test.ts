import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import {
  collectMergeIntegrityInput,
  computeMergeLockDigest,
  evaluateMergeIntegrity,
  isMergeIntegrityEventName,
  isMergeLockProtectedPath,
  MERGE_INTEGRITY_STATUS_CONTEXT,
  MERGE_LOCK_PROTECTED_PATHS,
  publishMergeIntegrityStatus,
  resolvePullRequestEventFacts,
  runMergeIntegrityGate,
  type MergeAuthorization,
  type MergeIntegrityComment,
  type MergeIntegrityInput,
  type MergeLockMetadata
} from "../scripts/run-merge-integrity-check.js";
import { resolveGovernanceCheck } from "../scripts/run-governance-check.js";

const HEAD_SHA = "a".repeat(40);
const STALE_HEAD_SHA = "c".repeat(40);
const LOCK_ID = "r3a1-pr-191";
const APPROVED_AT = "2026-07-16T12:00:00.000Z";
const COMMENT_UPDATED_AT = "2026-07-16T12:01:00.000Z";
const PROTECTED_PATH = "scripts/run-merge-integrity-check.ts";

const PINNED_ACTIONS = {
  checkout: "actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5",
  setupNode: "actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020",
  uploadArtifact: "actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02",
  downloadArtifact: "actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093"
} as const;

test("protected merge-integrity paths are explicit and deterministic", () => {
  assert.deepEqual(MERGE_LOCK_PROTECTED_PATHS, [
    ".github/actions/**",
    ".github/workflows/**",
    "package-lock.json",
    "package.json",
    "scripts/run-governance-check.ts",
    "scripts/run-merge-integrity-check.ts",
    "tests/merge-integrity-check.test.ts",
    "docs/governance/MERGE_INTEGRITY.md",
    "docs/governance/RELEASE_GATE_MATRIX.md"
  ]);
  for (const path of [
    ".github/actions/status/action.yml",
    ".github/workflows/ci.yml",
    "package.json",
    "package-lock.json",
    "scripts/run-governance-check.ts",
    PROTECTED_PATH,
    "tests/merge-integrity-check.test.ts",
    "docs/governance/MERGE_INTEGRITY.md",
    "docs/governance/RELEASE_GATE_MATRIX.md"
  ]) {
    assert.equal(isMergeLockProtectedPath(path), true, path);
  }
  for (const path of [
    "README.md",
    "docs/current/CURRENT_STATE.md",
    "packages/policy/src/index.ts",
    ".github/CODEOWNERS"
  ]) {
    assert.equal(isMergeLockProtectedPath(path), false, path);
  }
});

test("merge lock digest binds every metadata field", () => {
  const original = mergeLock();
  const digest = computeMergeLockDigest(original);
  assert.match(digest, /^[0-9a-f]{64}$/u);

  const variants: MergeLockMetadata[] = [
    mergeLock({ lockId: "different-lock" }),
    mergeLock({ repository: "OTHER/repository" }),
    mergeLock({ pullRequest: 192 }),
    mergeLock({ baseRef: "release" }),
    mergeLock({ reason: "different_reason" })
  ];
  assert.ok(variants.every((variant) => computeMergeLockDigest(variant) !== digest));
});

test("merge integrity entrypoint runs only for trusted target and comment events", () => {
  assert.equal(isMergeIntegrityEventName("pull_request_target"), true);
  assert.equal(isMergeIntegrityEventName("issue_comment"), true);
  assert.equal(isMergeIntegrityEventName("pull_request"), false);
  assert.equal(isMergeIntegrityEventName("push"), false);
  assert.equal(isMergeIntegrityEventName(""), false);
});

test("ordinary non-protected PRs pass without metadata and ignore natural-language prose", () => {
  for (const body of [
    "Ready for review.",
    "Do not merge until the owner replies.",
    "当前不得合并。",
    "必须保持 Draft。"
  ]) {
    assert.deepEqual(evaluateMergeIntegrity(input({
      body,
      changedPaths: ["README.md"]
    })), {
      status: "passed",
      lockRequired: false,
      lockActive: false,
      reason: "no_merge_lock_required",
      protectedPaths: []
    });
  }
});

test("protected path changes require exactly one structured lock", () => {
  const result = evaluateMergeIntegrity(input({ body: "Ready for review." }));
  assert.deepEqual(result, {
    status: "blocked",
    lockRequired: true,
    lockActive: false,
    reason: "merge_lock_metadata_required",
    protectedPaths: [PROTECTED_PATH]
  });
});

test("a valid structured lock is active even on an otherwise ordinary PR", () => {
  const lock = mergeLock();
  const result = evaluateMergeIntegrity(input({
    changedPaths: ["README.md"],
    body: lockBlock(lock)
  }));
  assert.equal(result.status, "blocked");
  assert.equal(result.lockRequired, false);
  assert.equal(result.lockActive, true);
  assert.equal(result.reason, "merge_lock_active");
  assert.deepEqual(result.lock, {
    lockId: LOCK_ID,
    lockDigest: computeMergeLockDigest(lock)
  });
});

test("duplicate, conflicting, malformed, and contradictory lock metadata fail closed", () => {
  const valid = mergeLock();
  const invalidLockedState = {
    ...valid,
    locked: false
  };
  const cases = [
    `${lockBlock(valid)}\n${lockBlock(valid)}`,
    `${lockBlock(valid)}\n${lockBlock(mergeLock({ lockId: "other-lock" }))}`,
    "<!-- codex-router-merge-lock:v1\n{not-json}\n-->",
    `<!-- codex-router-merge-lock:v1\n${JSON.stringify(invalidLockedState)}\n-->`,
    `<!-- codex-router-merge-lock:v1\n${JSON.stringify({ ...valid, extra: true })}\n-->`,
    "<!-- codex-router-merge-lock:v1"
  ];

  for (const body of cases) {
    const result = evaluateMergeIntegrity(input({ body }));
    assert.equal(result.status, "blocked");
    assert.equal(result.reason, "invalid_merge_lock_metadata");
    assert.equal(result.lockActive, true);
  }
});

test("lock metadata repository, PR, and base bindings fail closed", () => {
  for (const lock of [
    mergeLock({ repository: "OTHER/repository" }),
    mergeLock({ pullRequest: 190 }),
    mergeLock({ baseRef: "release" })
  ]) {
    const result = evaluateMergeIntegrity(input({ body: lockBlock(lock) }));
    assert.equal(result.status, "blocked");
    assert.equal(result.reason, "invalid_merge_lock_metadata");
  }
});

test("an owner comment unlocks only the exact lock, head, base, repository, and PR", () => {
  const lock = mergeLock();
  const claim = authorization(lock);
  const result = evaluateMergeIntegrity(input({
    body: lockBlock(lock),
    comments: [comment(claim)]
  }));

  assert.equal(result.status, "passed");
  assert.equal(result.reason, "merge_lock_authorized");
  assert.deepEqual(result.authorization, {
    source: "comment",
    sourceId: "comment-1",
    approver: "JENN2046",
    approvedAt: APPROVED_AT,
    commentUpdatedAt: COMMENT_UPDATED_AT,
    lockId: LOCK_ID,
    lockDigest: computeMergeLockDigest(lock),
    baseRef: "main",
    headSha: HEAD_SHA
  });
});

test("unlock fails closed for wrong lockId, stale head, wrong base, repository, or PR", () => {
  const lock = mergeLock();
  const variants: MergeAuthorization[] = [
    authorization(lock, { lockId: "wrong-lock" }),
    authorization(lock, { headSha: STALE_HEAD_SHA }),
    authorization(lock, { baseRef: "release" }),
    authorization(lock, { repository: "OTHER/repository" }),
    authorization(lock, { pullRequest: 190 })
  ];
  for (const claim of variants) {
    const result = evaluateMergeIntegrity(input({
      body: lockBlock(lock),
      comments: [comment(claim)]
    }));
    assert.equal(result.status, "blocked");
    assert.equal(result.reason, "invalid_unlock_claim");
  }
});

test("changing lock metadata invalidates an earlier unlock even when lockId is reused", () => {
  const oldLock = mergeLock();
  const changedLock = mergeLock({ reason: "security_review_reopened" });
  const result = evaluateMergeIntegrity(input({
    body: lockBlock(changedLock),
    comments: [comment(authorization(oldLock))]
  }));

  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "invalid_unlock_claim");
  assert.notEqual(
    computeMergeLockDigest(oldLock),
    computeMergeLockDigest(changedLock)
  );
});

test("non-owner and untrusted comments cannot unlock", () => {
  const lock = mergeLock();
  for (const override of [
    { authorLogin: "someone-else" },
    { authorAssociation: "CONTRIBUTOR" }
  ]) {
    const result = evaluateMergeIntegrity(input({
      body: lockBlock(lock),
      comments: [comment(authorization(lock), override)]
    }));
    assert.equal(result.status, "blocked");
    assert.equal(result.reason, "merge_lock_active");
  }
});

test("editing an authorization comment invalidates it even inside the timestamp window", () => {
  const lock = mergeLock();
  const result = evaluateMergeIntegrity(input({
    body: lockBlock(lock),
    comments: [comment(authorization(lock, {
      approvedAt: "2026-07-16T12:01:30.000Z"
    }), {
      createdAt: COMMENT_UPDATED_AT,
      updatedAt: "2026-07-16T12:02:00.000Z"
    })]
  }));

  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "invalid_unlock_claim");
});

test("deleting an authorization comment restores the active lock", () => {
  const result = evaluateMergeIntegrity(input({ comments: [] }));
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "merge_lock_active");
});

test("authorization time is a comment-update binding window, not wall-clock expiry", () => {
  const lock = mergeLock();
  const tooOld = evaluateMergeIntegrity(input({
    comments: [comment(authorization(lock, {
      approvedAt: "2026-07-16T11:45:59.000Z"
    }))]
  }));
  const future = evaluateMergeIntegrity(input({
    comments: [comment(authorization(lock, {
      approvedAt: "2026-07-16T12:02:01.000Z"
    }))]
  }));
  assert.equal(tooOld.reason, "invalid_unlock_claim");
  assert.equal(future.reason, "invalid_unlock_claim");

  const valid = evaluateMergeIntegrity(input({
    comments: [comment(authorization(lock))]
  }));
  assert.equal(valid.status, "passed");
});

test("malformed trusted unlock JSON blocks without exposing comment text", () => {
  const result = evaluateMergeIntegrity(input({
    comments: [comment(undefined, {
      body: "<!-- codex-router-merge-authorization:v1\n{not-json}\n-->"
    })]
  }));

  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "invalid_unlock_claim");
  assert.equal(JSON.stringify(result).includes("not-json"), false);
});

test("unlock comments reject extra prose and duplicate claims", () => {
  const lock = mergeLock();
  const block = authorizationBlock(authorization(lock));
  for (const body of [
    `approved\n${block}`,
    `${block}\n${block}`
  ]) {
    const result = evaluateMergeIntegrity(input({
      comments: [comment(undefined, { body })]
    }));
    assert.equal(result.status, "blocked");
    assert.equal(result.reason, "invalid_unlock_claim");
  }
});

test("merge integrity rejects invalid gate inputs and changed paths", () => {
  assert.equal(
    evaluateMergeIntegrity(input({ allowedApprovers: [] })).reason,
    "invalid_gate_input"
  );
  assert.equal(
    evaluateMergeIntegrity(input({ changedPaths: ["../workflow.yml"] })).reason,
    "invalid_gate_input"
  );
});

test("GitHub collection always reads changed files but skips comments without a lock", async () => {
  const calls: string[] = [];
  const collected = await collectMergeIntegrityInput(event("Ready for review."), {
    token: "token-for-test",
    allowedApprovers: ["JENN2046"],
    fetchImpl: (async (url) => {
      calls.push(String(url));
      return new Response(JSON.stringify([{ filename: "README.md" }]));
    }) as typeof fetch
  });

  assert.equal(calls.length, 1);
  assert.ok(calls[0]?.includes("/pulls/191/files?"));
  assert.deepEqual(collected.changedPaths, ["README.md"]);
  assert.deepEqual(collected.comments, []);
});

test("GitHub rename inventory preserves protected previous paths", async () => {
  const collected = await collectMergeIntegrityInput(event("Ready for review."), {
    token: "token-for-test",
    allowedApprovers: ["JENN2046"],
    fetchImpl: (async () => new Response(JSON.stringify([{
      filename: "archive/old-merge-check.ts",
      previous_filename: PROTECTED_PATH
    }]))) as typeof fetch
  });

  assert.deepEqual(collected.changedPaths, [
    "archive/old-merge-check.ts",
    PROTECTED_PATH
  ]);
  assert.equal(evaluateMergeIntegrity(collected).reason, "merge_lock_metadata_required");
});

test("GitHub collection reads complete comment inventory for a valid lock", async () => {
  const lock = mergeLock();
  const calls: string[] = [];
  const collected = await collectMergeIntegrityInput(event(lockBlock(lock)), {
    token: "token-for-test",
    allowedApprovers: ["JENN2046"],
    fetchImpl: (async (url) => {
      calls.push(String(url));
      if (String(url).includes("/files?")) {
        return new Response(JSON.stringify([{ filename: PROTECTED_PATH }]));
      }
      return new Response(JSON.stringify([githubComment(authorization(lock))]));
    }) as typeof fetch
  });

  assert.equal(calls.length, 2);
  assert.deepEqual(collected.changedPaths, [PROTECTED_PATH]);
  assert.equal(collected.comments[0]?.id, "42");
  assert.equal(collected.comments[0]?.createdAt, COMMENT_UPDATED_AT);
  assert.equal(collected.comments[0]?.updatedAt, COMMENT_UPDATED_AT);
});

test("GitHub file or comment inventory failure fails closed", async () => {
  await assert.rejects(
    collectMergeIntegrityInput(event("Ready for review."), {
      token: "",
      allowedApprovers: ["JENN2046"]
    }),
    /github_token_missing_for_changed_file_inventory/
  );

  await assert.rejects(
    collectMergeIntegrityInput(event("Ready for review."), {
      token: "token-for-test",
      allowedApprovers: ["JENN2046"],
      fetchImpl: (async () => new Response("denied", { status: 403 })) as typeof fetch
    }),
    /github_inventory_failed_status_403/
  );

  const lock = mergeLock();
  let calls = 0;
  await assert.rejects(
    collectMergeIntegrityInput(event(lockBlock(lock)), {
      token: "token-for-test",
      allowedApprovers: ["JENN2046"],
      fetchImpl: (async () => {
        calls += 1;
        return calls === 1
          ? new Response(JSON.stringify([{ filename: PROTECTED_PATH }]))
          : new Response("denied", { status: 503 });
      }) as typeof fetch
    }),
    /github_inventory_failed_status_503/
  );
});

test("issue comment events refresh current PR facts before inventory evaluation", async () => {
  const calls: string[] = [];
  const facts = await resolvePullRequestEventFacts(issueCommentEvent(), {
    token: "token-for-test",
    apiUrl: "https://github.example/api/v3/",
    fetchImpl: (async (url) => {
      calls.push(String(url));
      return new Response(JSON.stringify({
        number: 191,
        body: lockBlock(mergeLock()),
        head: { sha: HEAD_SHA },
        base: { ref: "main" }
      }));
    }) as typeof fetch
  });

  assert.deepEqual(facts, {
    repository: "JENN2046/codex-router",
    pullRequest: 191,
    baseRef: "main",
    headSha: HEAD_SHA,
    body: lockBlock(mergeLock())
  });
  assert.deepEqual(calls, [
    "https://github.example/api/v3/repos/JENN2046/codex-router/pulls/191"
  ]);
});

test("merge integrity publishes a sanitized status to the exact PR head", async () => {
  let observedUrl = "";
  let observedInit: RequestInit | undefined;
  await publishMergeIntegrityStatus({
    repository: "JENN2046/codex-router",
    headSha: HEAD_SHA,
    state: "failure",
    description: "Merge authorization evaluation failed closed.",
    token: "token-for-test",
    fetchImpl: (async (url, init) => {
      observedUrl = String(url);
      observedInit = init;
      return new Response("{}", { status: 201 });
    }) as typeof fetch
  });

  assert.equal(
    observedUrl,
    `https://api.github.com/repos/JENN2046/codex-router/statuses/${HEAD_SHA}`
  );
  assert.equal(observedInit?.method, "POST");
  assert.deepEqual(JSON.parse(String(observedInit?.body)), {
    state: "failure",
    description: "Merge authorization evaluation failed closed.",
    context: MERGE_INTEGRITY_STATUS_CONTEXT
  });
});

test("comment deletion re-evaluates current PR, file, and empty comment inventories", async () => {
  const lock = mergeLock();
  const requests: Array<{ url: string; method: string; body?: unknown }> = [];
  const run = await runMergeIntegrityGate(issueCommentEvent(), {
    eventName: "issue_comment",
    token: "token-for-test",
    allowedApprovers: ["JENN2046"],
    fetchImpl: (async (url, init) => {
      const method = init?.method ?? "GET";
      requests.push({
        url: String(url),
        method,
        ...(init?.body === undefined
          ? {}
          : { body: JSON.parse(String(init.body)) as unknown })
      });
      if (String(url).endsWith("/pulls/191")) {
        return new Response(JSON.stringify({
          number: 191,
          body: lockBlock(lock),
          head: { sha: HEAD_SHA },
          base: { ref: "main" }
        }));
      }
      if (String(url).includes("/pulls/191/files")) {
        return new Response(JSON.stringify([{ filename: PROTECTED_PATH }]));
      }
      if (String(url).includes("/issues/191/comments")) {
        return new Response("[]");
      }
      return new Response("{}", { status: 201 });
    }) as typeof fetch
  });

  assert.equal(run.mode, "evaluated");
  assert.equal(run.mode === "evaluated" && run.result.reason, "merge_lock_active");
  assert.deepEqual(
    requests.filter((request) => request.method === "POST").map((request) => request.body),
    [
      {
        state: "pending",
        description: "Merge authorization evaluation in progress.",
        context: MERGE_INTEGRITY_STATUS_CONTEXT
      },
      {
        state: "failure",
        description: "Merge authorization blocked: merge_lock_active.",
        context: MERGE_INTEGRITY_STATUS_CONTEXT
      }
    ]
  );
});

test("inventory errors replace pending with a fail-closed status", async () => {
  const states: string[] = [];
  await assert.rejects(
    runMergeIntegrityGate(event("Ready for review."), {
      eventName: "pull_request_target",
      token: "token-for-test",
      allowedApprovers: ["JENN2046"],
      fetchImpl: (async (_url, init) => {
        if ((init?.method ?? "GET") === "POST") {
          states.push((JSON.parse(String(init?.body)) as { state: string }).state);
          return new Response("{}", { status: 201 });
        }
        return new Response("denied", { status: 403 });
      }) as typeof fetch
    }),
    /github_inventory_failed_status_403/
  );
  assert.deepEqual(states, ["pending", "failure"]);
});

test("CI hardening remains pinned and the trusted gate permissions stay minimal", async () => {
  const ci = parse(
    await readFile(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8")
  ) as Workflow;
  const reanchor = parse(
    await readFile(
      new URL("../.github/workflows/state-sync-reanchor-pr.yml", import.meta.url),
      "utf8"
    )
  ) as Workflow;

  assert.deepEqual(ci.permissions, { contents: "read" });
  assert.deepEqual(ci.on.pull_request?.types, [
    "opened",
    "synchronize",
    "reopened",
    "edited",
    "ready_for_review"
  ]);
  assert.equal(ci.on.pull_request_target, undefined);
  assert.deepEqual(
    reanchor.on.pull_request_target?.types,
    ci.on.pull_request?.types
  );
  assert.deepEqual(reanchor.on.issue_comment?.types, [
    "created",
    "edited",
    "deleted"
  ]);
  const mergeIntegrity = reanchor.jobs["merge-integrity"];
  assert.ok(mergeIntegrity);
  assert.equal(mergeIntegrity?.name, "Merge Integrity Evaluation");
  assert.equal(
    mergeIntegrity?.if,
    "github.event_name == 'pull_request_target' || github.event.issue.pull_request"
  );
  assert.deepEqual(mergeIntegrity?.permissions, {
    contents: "read",
    "pull-requests": "read",
    statuses: "write"
  });
  assert.ok(mergeIntegrity?.steps.some((step) =>
    step.run === "npm run governance -- audit merge-integrity"
    && step.env?.MERGE_INTEGRITY_ALLOWED_APPROVERS === "${{ github.repository_owner }}"
    && step.env?.GITHUB_TOKEN === "${{ github.token }}"
  ));
  const trustedCheckout = mergeIntegrity?.steps.find((step) =>
    step.name === "Check out trusted base revision"
  );
  assert.equal(trustedCheckout?.uses, PINNED_ACTIONS.checkout);
  assert.equal(
    trustedCheckout?.with?.ref,
    "${{ github.event.pull_request.base.sha || github.sha }}"
  );
  assert.equal(trustedCheckout?.with?.["persist-credentials"], false);
  assert.equal(ci.jobs["merge-integrity"], undefined);
  assert.equal(
    ci.jobs.canary?.name,
    "Canary (${{ matrix.risk }}, Node ${{ matrix.node }})"
  );

  const actionUses = [ci, reanchor]
    .flatMap((workflow) => Object.values(workflow.jobs))
    .flatMap((job) => job.steps)
    .map((step) => step.uses)
    .filter((uses): uses is string => uses !== undefined && uses.startsWith("actions/"));
  assert.ok(actionUses.length > 0);
  assert.ok(actionUses.every((uses) => Object.values(PINNED_ACTIONS).includes(
    uses as (typeof PINNED_ACTIONS)[keyof typeof PINNED_ACTIONS]
  )));
  assert.ok(actionUses.every((uses) => /@[0-9a-f]{40}$/u.test(uses)));
});

test("merge integrity is registered on the consolidated governance runner", () => {
  assert.deepEqual(resolveGovernanceCheck("audit", "merge-integrity"), {
    id: "governance-audit-merge-integrity",
    command: process.execPath,
    args: ["--import", "tsx", "scripts/run-merge-integrity-check.ts"],
    description: "Run audit merge-integrity"
  });
});

function input(overrides: Partial<MergeIntegrityInput> = {}): MergeIntegrityInput {
  const lock = mergeLock();
  return {
    repository: "JENN2046/codex-router",
    pullRequest: 191,
    baseRef: "main",
    headSha: HEAD_SHA,
    body: lockBlock(lock),
    changedPaths: [PROTECTED_PATH],
    allowedApprovers: ["JENN2046"],
    comments: [],
    ...overrides
  };
}

function mergeLock(
  overrides: Partial<MergeLockMetadata> = {}
): MergeLockMetadata {
  return {
    schemaVersion: 1,
    lockId: LOCK_ID,
    repository: "JENN2046/codex-router",
    pullRequest: 191,
    baseRef: "main",
    reason: "awaiting_owner_authorization",
    locked: true,
    ...overrides
  };
}

function authorization(
  lock: MergeLockMetadata,
  overrides: Partial<MergeAuthorization> = {}
): MergeAuthorization {
  return {
    schemaVersion: 1,
    decision: "unlock",
    lockId: lock.lockId,
    lockDigest: computeMergeLockDigest(lock),
    repository: "JENN2046/codex-router",
    pullRequest: 191,
    baseRef: "main",
    headSha: HEAD_SHA,
    approver: "JENN2046",
    approvedAt: APPROVED_AT,
    ...overrides
  };
}

function comment(
  claim: MergeAuthorization | undefined,
  overrides: Partial<MergeIntegrityComment> = {}
): MergeIntegrityComment {
  return {
    id: "comment-1",
    body: claim === undefined ? "" : authorizationBlock(claim),
    authorLogin: "JENN2046",
    authorAssociation: "OWNER",
    createdAt: COMMENT_UPDATED_AT,
    updatedAt: COMMENT_UPDATED_AT,
    ...overrides
  };
}

function lockBlock(lock: MergeLockMetadata): string {
  return `<!-- codex-router-merge-lock:v1\n${JSON.stringify(lock)}\n-->`;
}

function authorizationBlock(claim: MergeAuthorization): string {
  return `<!-- codex-router-merge-authorization:v1\n${JSON.stringify(claim)}\n-->`;
}

function githubComment(claim: MergeAuthorization): Record<string, unknown> {
  return {
    id: 42,
    body: authorizationBlock(claim),
    user: { login: "JENN2046" },
    author_association: "OWNER",
    created_at: COMMENT_UPDATED_AT,
    updated_at: COMMENT_UPDATED_AT
  };
}

function event(body: string): Record<string, unknown> {
  return {
    repository: { full_name: "JENN2046/codex-router" },
    pull_request: {
      number: 191,
      body,
      head: { sha: HEAD_SHA },
      base: { ref: "main" }
    }
  };
}

function issueCommentEvent(): Record<string, unknown> {
  return {
    repository: { full_name: "JENN2046/codex-router" },
    issue: {
      number: 191,
      pull_request: {
        url: "https://api.github.com/repos/JENN2046/codex-router/pulls/191"
      }
    }
  };
}

interface WorkflowStep {
  name?: string;
  uses?: string;
  run?: string;
  env?: Record<string, string>;
  with?: Record<string, string | number | boolean>;
}

interface WorkflowJob {
  name?: string;
  if?: string;
  permissions?: Record<string, string>;
  steps: WorkflowStep[];
}

interface Workflow {
  on: {
    pull_request?: {
      branches: string[];
      types?: string[];
    };
    pull_request_target?: {
      branches: string[];
      types?: string[];
    };
    issue_comment?: {
      types?: string[];
    };
  };
  permissions?: Record<string, string>;
  jobs: Record<string, WorkflowJob> & {
    canary?: WorkflowJob;
  };
}
