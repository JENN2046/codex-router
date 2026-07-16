import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import {
  collectMergeIntegrityInput,
  evaluateMergeIntegrity,
  findMergeLockMarkers,
  isMergeIntegrityEventName,
  type MergeAuthorization,
  type MergeIntegrityInput
} from "../scripts/run-merge-integrity-check.js";
import { resolveGovernanceCheck } from "../scripts/run-governance-check.js";

const HEAD_SHA = "a".repeat(40);
const APPROVED_AT = "2026-07-16T12:00:00.000Z";
const COMMENTED_AT = "2026-07-16T12:01:00.000Z";

const PINNED_ACTIONS = {
  checkout: "actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5",
  setupNode: "actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020",
  uploadArtifact: "actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02",
  downloadArtifact: "actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093"
} as const;

test("merge lock detector covers the prohibited instruction tokens", () => {
  const cases = [
    ["This PR must remain draft.", "must_remain_draft"],
    ["DO NOT MERGE until approval.", "do_not_merge"],
    ["Don't merge this yet.", "dont_merge"],
    ["必须保持 Draft。", "must_keep_draft_zh"],
    ["当前不得合并。", "do_not_merge_zh"],
    ["禁止合并。", "forbid_merge_zh"]
  ] as const;

  for (const [body, expected] of cases) {
    assert.ok(findMergeLockMarkers(body).includes(expected), body);
  }
});

test("merge integrity entrypoint runs only for the trusted target event", () => {
  assert.equal(isMergeIntegrityEventName("pull_request_target"), true);
  assert.equal(isMergeIntegrityEventName("pull_request"), false);
  assert.equal(isMergeIntegrityEventName("push"), false);
  assert.equal(isMergeIntegrityEventName(""), false);
});

test("merge integrity passes an ordinary PR without a lock", () => {
  const result = evaluateMergeIntegrity(input({ body: "Ready for review." }));

  assert.deepEqual(result, {
    status: "passed",
    lockActive: false,
    reason: "no_active_merge_lock",
    matchedMarkers: []
  });
});

test("merge integrity blocks a locked PR even when code checks passed", () => {
  const result = evaluateMergeIntegrity(input({
    body: "Must remain draft. All code checks passed."
  }));

  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "merge_lock_active");
  assert.equal(result.authorization, undefined);
});

test("a self-declared authorization in the PR body cannot unlock it", () => {
  const result = evaluateMergeIntegrity(input({
    body: `Must remain draft.\n\n${authorizationBlock(authorization({ headSha: HEAD_SHA }))}`
  }));

  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "merge_lock_active");
});

test("an owner comment can authorize the exact PR head and scope", () => {
  const claim = authorization({ headSha: HEAD_SHA });
  const result = evaluateMergeIntegrity(input({
    comments: [{
      id: "comment-1",
      body: authorizationBlock(claim),
      authorLogin: "JENN2046",
      authorAssociation: "OWNER",
      createdAt: COMMENTED_AT
    }]
  }));

  assert.equal(result.status, "passed");
  assert.equal(result.reason, "merge_lock_authorized");
  assert.deepEqual(result.authorization, {
    source: "comment",
    sourceId: "comment-1",
    approver: "JENN2046",
    approvedAt: APPROVED_AT,
    scope: { operation: "merge", baseRef: "main" },
    headSha: HEAD_SHA
  });
});

test("comment authorization fails closed on actor, association, head, time, and scope drift", () => {
  const variants = [
    {
      comment: { authorLogin: "someone-else" },
      claim: {},
      reason: "merge_lock_active"
    },
    {
      comment: { authorAssociation: "CONTRIBUTOR" },
      claim: {},
      reason: "merge_lock_active"
    },
    {
      comment: {},
      claim: { headSha: "c".repeat(40) },
      reason: "invalid_authorization_claim"
    },
    {
      comment: { createdAt: "2026-07-16T13:00:00.000Z" },
      claim: {},
      reason: "invalid_authorization_claim"
    },
    {
      comment: {},
      claim: { scope: { operation: "merge" as const, baseRef: "release" } },
      reason: "invalid_authorization_claim"
    }
  ] as const;

  for (const variant of variants) {
    const comment = {
      id: "comment-1",
      body: authorizationBlock(authorization({
        headSha: HEAD_SHA,
        ...variant.claim
      })),
      authorLogin: "JENN2046",
      authorAssociation: "OWNER",
      createdAt: COMMENTED_AT,
      ...variant.comment
    };
    const result = evaluateMergeIntegrity(input({ comments: [comment] }));
    assert.equal(result.status, "blocked");
    assert.equal(result.reason, variant.reason);
  }
});

test("malformed trusted authorization blocks fail closed without exposing text", () => {
  const result = evaluateMergeIntegrity(input({
    comments: [{
      id: "comment-secret-free-id",
      body: "<!-- codex-router-merge-authorization:v1\n{not-json}\n-->",
      authorLogin: "JENN2046",
      authorAssociation: "OWNER",
      createdAt: COMMENTED_AT
    }]
  }));

  assert.deepEqual(result, {
    status: "blocked",
    lockActive: true,
    reason: "invalid_authorization_claim",
    matchedMarkers: ["must_remain_draft"]
  });
});

test("merge integrity rejects missing approver configuration", () => {
  const result = evaluateMergeIntegrity(input({ allowedApprovers: [] }));

  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "invalid_gate_input");
});

test("GitHub collection skips API access without a lock", async () => {
  let calls = 0;
  const collected = await collectMergeIntegrityInput(event("Ready for review."), {
    token: "",
    allowedApprovers: ["JENN2046"],
    fetchImpl: (async () => {
      calls += 1;
      return new Response("[]");
    }) as typeof fetch
  });

  assert.equal(calls, 0);
  assert.equal(collected.comments.length, 0);
});

test("GitHub collection reads the comment inventory for a lock", async () => {
  const response = [{
    id: 42,
    body: authorizationBlock(authorization({ headSha: HEAD_SHA })),
    user: { login: "JENN2046" },
    author_association: "OWNER",
    created_at: COMMENTED_AT
  }];
  let call = 0;
  const collected = await collectMergeIntegrityInput(event("Must remain draft."), {
    token: "token-for-test",
    allowedApprovers: ["JENN2046"],
    fetchImpl: (async () => {
      call += 1;
      return new Response(JSON.stringify(response));
    }) as typeof fetch
  });

  assert.equal(call, 1);
  assert.equal(collected.comments[0]?.id, "42");
});

test("GitHub collection fails closed when the locked inventory cannot be read", async () => {
  await assert.rejects(
    collectMergeIntegrityInput(event("Must remain draft."), {
      token: "",
      allowedApprovers: ["JENN2046"]
    }),
    /github_token_missing_for_active_merge_lock/
  );
  await assert.rejects(
    collectMergeIntegrityInput(event("不得合并。"), {
      token: "token-for-test",
      allowedApprovers: ["JENN2046"],
      fetchImpl: (async () => new Response("denied", { status: 403 })) as typeof fetch
    }),
    /github_inventory_failed_status_403/
  );
});

test("CI hardening pins actions, narrows permissions, and names Canary risk", async () => {
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
  assert.deepEqual(ci.on.pull_request_target?.types, ci.on.pull_request?.types);
  const mergeIntegrity = ci.jobs["merge-integrity"];
  assert.ok(mergeIntegrity);
  assert.equal(
    mergeIntegrity?.name,
    "Merge Integrity (${{ github.event_name }})"
  );
  assert.equal(
    mergeIntegrity?.if,
    "github.event_name == 'pull_request_target'"
  );
  assert.deepEqual(mergeIntegrity?.permissions, {
    contents: "read",
    "pull-requests": "read"
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
    "${{ github.event.pull_request.base.sha }}"
  );
  assert.equal(trustedCheckout?.with?.["persist-credentials"], false);

  const ordinaryJobNames = Object.keys(ci.jobs).filter((name) =>
    name !== "merge-integrity" && name !== "evidence"
  );
  for (const name of ordinaryJobNames) {
    assert.equal(
      ci.jobs[name]?.if,
      "github.event_name != 'pull_request_target'",
      `${name} must not execute in the privileged event context`
    );
  }
  assert.equal(
    ci.jobs.evidence?.if,
    "${{ always() && github.event_name != 'pull_request_target' }}"
  );
  assert.equal(
    ci.jobs.canary?.name,
    "Canary (${{ matrix.risk }}, Node ${{ matrix.node }})"
  );
  assert.deepEqual(reanchor.permissions, {
    contents: "write",
    "pull-requests": "write"
  });

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
  return {
    repository: "JENN2046/codex-router",
    pullRequest: 189,
    baseRef: "main",
    headSha: HEAD_SHA,
    body: "Must remain draft.",
    allowedApprovers: ["JENN2046"],
    comments: [],
    ...overrides
  };
}

function authorization(
  overrides: Partial<MergeAuthorization> = {}
): MergeAuthorization {
  return {
    schemaVersion: 1,
    decision: "unlock",
    repository: "JENN2046/codex-router",
    pullRequest: 189,
    headSha: HEAD_SHA,
    approver: "JENN2046",
    approvedAt: APPROVED_AT,
    scope: { operation: "merge", baseRef: "main" },
    ...overrides
  };
}

function authorizationBlock(claim: MergeAuthorization): string {
  return `<!-- codex-router-merge-authorization:v1\n${JSON.stringify(claim)}\n-->`;
}

function event(body: string): Record<string, unknown> {
  return {
    repository: { full_name: "JENN2046/codex-router" },
    pull_request: {
      number: 189,
      body,
      head: { sha: HEAD_SHA },
      base: { ref: "main" }
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
  };
  permissions?: Record<string, string>;
  jobs: Record<string, WorkflowJob> & {
    canary?: WorkflowJob;
    evidence?: WorkflowJob;
  };
}
