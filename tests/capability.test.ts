import test from "node:test";
import assert from "node:assert/strict";
import {
  capabilityImplies,
  explainCapabilityDecision,
  hasCapabilityGrant,
  parseCapabilityScope
} from "../packages/capability/src/index.js";

const now = "2026-06-04T00:00:00.000Z";

test("capability matcher parses scope strings", () => {
  assert.deepEqual(parseCapabilityScope("fs.read:/repo/**"), {
    raw: "fs.read:/repo/**",
    family: "fs",
    action: "fs.read",
    resource: "/repo/**",
    effect: "allow"
  });

  assert.deepEqual(parseCapabilityScope("secret.read:deny"), {
    raw: "secret.read:deny",
    family: "secret",
    action: "secret.read",
    resource: "deny",
    effect: "deny"
  });
});

test("capability matcher allows exact scope matches", () => {
  const result = explainCapabilityDecision(
    ["shell.exec:pytest"],
    "shell.exec:pytest"
  );

  assert.equal(result.allowed, true);
  assert.deepEqual(result.reasons, ["matched_allow_scope"]);
  assert.deepEqual(result.matchedAllowScopes, ["shell.exec:pytest"]);
  assert.equal(hasCapabilityGrant(["shell.exec:pytest"], "shell.exec:pytest"), true);
});

test("capability matcher allows path wildcard matches", () => {
  assert.equal(
    capabilityImplies("fs.read:/repo/**", "fs.read:/repo/docs/plan.md"),
    true
  );
  assert.equal(
    hasCapabilityGrant(["fs.write:/repo/docs/**"], "fs.write:/repo/docs/phase-1.md"),
    true
  );
  assert.equal(
    hasCapabilityGrant(["fs.write:/repo/docs/**"], "fs.write:/repo/src/index.ts"),
    false
  );
});

test("capability matcher gives deny scopes priority over allow scopes", () => {
  const result = explainCapabilityDecision(
    [
      "fs.write:/repo/docs/**",
      "fs.write:/repo/docs/private/**"
    ],
    "fs.write:/repo/docs/private/secret.md"
  );

  assert.equal(result.allowed, true);

  const denied = explainCapabilityDecision(
    [
      "fs.write:/repo/docs/**",
      "fs.write:/repo/docs/private/**",
      "fs.write:deny"
    ],
    "fs.write:/repo/docs/private/secret.md"
  );

  assert.equal(denied.allowed, false);
  assert.deepEqual(denied.reasons, ["matched_deny_scope"]);
  assert.deepEqual(denied.matchedDenyScopes, ["fs.write:deny"]);
});

test("capability matcher rejects expired grants", () => {
  const result = explainCapabilityDecision(
    [{
      scope: "network.egress:api.github.com",
      expiresAt: "2026-06-03T00:00:00.000Z"
    }],
    "network.egress:api.github.com",
    { now }
  );

  assert.equal(result.allowed, false);
  assert.ok(result.ignoredGrantReasons.includes(
    "grant_expired:2026-06-03T00:00:00.000Z"
  ));
});

test("capability matcher rejects revoked grants", () => {
  const result = explainCapabilityDecision(
    [{
      scope: "mcp.call:github.create_pull_request",
      revokedAt: "2026-06-04T00:00:00.000Z"
    }],
    "mcp.call:github.create_pull_request",
    { now }
  );

  assert.equal(result.allowed, false);
  assert.ok(result.ignoredGrantReasons.includes(
    "grant_revoked:2026-06-04T00:00:00.000Z"
  ));
});

test("capability matcher rejects principal mismatches", () => {
  const result = explainCapabilityDecision(
    [{
      scope: "memory.read:project",
      principalId: "principal_user_001"
    }],
    "memory.read:project",
    {
      principalId: "principal_user_002",
      now
    }
  );

  assert.equal(result.allowed, false);
  assert.ok(result.ignoredGrantReasons.includes("principal_mismatch:principal_user_001"));
});

test("capability matcher enforces task and run scoped grants", () => {
  const grants = [{
    scope: "memory.write:project",
    principalId: "principal_user_001",
    taskId: "task_001",
    runId: "run_001"
  }];

  assert.equal(hasCapabilityGrant(grants, "memory.write:project", {
    principalId: "principal_user_001",
    taskId: "task_001",
    runId: "run_001",
    now
  }), true);

  const taskMismatch = explainCapabilityDecision(grants, "memory.write:project", {
    principalId: "principal_user_001",
    taskId: "task_002",
    runId: "run_001",
    now
  });

  assert.equal(taskMismatch.allowed, false);
  assert.ok(taskMismatch.ignoredGrantReasons.includes("task_mismatch:task_001"));

  const runMismatch = explainCapabilityDecision(grants, "memory.write:project", {
    principalId: "principal_user_001",
    taskId: "task_001",
    runId: "run_002",
    now
  });

  assert.equal(runMismatch.allowed, false);
  assert.ok(runMismatch.ignoredGrantReasons.includes("run_mismatch:run_001"));
});

test("capability matcher rejects unknown scope actions by default", () => {
  const result = explainCapabilityDecision(
    ["unknown.action:anything"],
    "unknown.action:anything",
    { now }
  );

  assert.equal(result.allowed, false);
  assert.deepEqual(result.reasons, ["unknown capability action: unknown.action"]);
});

test("capability matcher does not imply fs.read from fs.write", () => {
  assert.equal(capabilityImplies(
    "fs.write:/repo/docs/**",
    "fs.read:/repo/docs/phase-1.md"
  ), false);

  assert.equal(hasCapabilityGrant(
    ["fs.write:/repo/docs/**"],
    "fs.read:/repo/docs/phase-1.md"
  ), false);
});
