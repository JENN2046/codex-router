import test from "node:test";
import assert from "node:assert/strict";
import {
  capabilityImplies,
  capabilityScopeToCanonicalString,
  explainCapabilityDecision,
  hasCapabilityGrant,
  parseCapabilityScope
} from "../packages/capability/src/index.js";
import {
  CapabilityGrantSchema
} from "../packages/kernel-contracts/src/index.js";

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

  assert.deepEqual(parseCapabilityScope("external.write:protected_remote"), {
    raw: "external.write:protected_remote",
    family: "external",
    action: "external.write",
    resource: "protected_remote",
    effect: "allow"
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

test("capability matcher normalizes file paths before wildcard matches", () => {
  assert.equal(
    hasCapabilityGrant(["fs.write:/repo/**"], "fs.write:/repo/../outside"),
    false
  );
  assert.equal(
    hasCapabilityGrant(["fs.write:/repo/**"], "fs.write:/repo/docs/../src/index.ts"),
    true
  );
  assert.equal(
    hasCapabilityGrant(["fs.write:/repo/docs/**"], "fs.write:/repo/docs/../src/index.ts"),
    false
  );
  assert.equal(
    capabilityImplies("fs.read:/repo/docs/../src/**", "fs.read:/repo/src/file.md"),
    true
  );
});

test("capability matcher accepts typed kernel capability grants", () => {
  const grant = CapabilityGrantSchema.parse({
    schemaVersion: "capability-grant.v1",
    grantId: "grant_capability_typed_001",
    principalId: "principal_user_001",
    taskId: "task_capability_001",
    runId: "run_capability_001",
    scopes: [
      {
        schemaVersion: "capability-scope.v1",
        kind: "file",
        resource: "/repo/docs/**",
        access: "read",
        constraints: {}
      },
      {
        schemaVersion: "capability-scope.v1",
        kind: "tool",
        resource: "pytest",
        access: "execute",
        constraints: {}
      }
    ],
    issuedAt: "2026-06-04T00:00:00.000Z",
    expiresAt: "2026-06-05T00:00:00.000Z"
  });

  const fileDecision = explainCapabilityDecision(
    [grant],
    "fs.read:/repo/docs/plan.md",
    {
      principalId: "principal_user_001",
      taskId: "task_capability_001",
      runId: "run_capability_001",
      now
    }
  );
  const toolDecision = explainCapabilityDecision(
    [grant],
    "shell.exec:pytest",
    {
      principalId: "principal_user_001",
      taskId: "task_capability_001",
      runId: "run_capability_001",
      now
    }
  );

  assert.equal(fileDecision.allowed, true);
  assert.deepEqual(fileDecision.matchedAllowScopes, ["fs.read:/repo/docs/**"]);
  assert.equal(toolDecision.allowed, true);
  assert.deepEqual(toolDecision.matchedAllowScopes, ["shell.exec:pytest"]);
});

test("capability matcher supports external write scopes", () => {
  assert.equal(
    capabilityScopeToCanonicalString({
      schemaVersion: "capability-scope.v1",
      kind: "external",
      resource: "protected_remote",
      access: "write",
      constraints: {}
    }),
    "external.write:protected_remote"
  );
  assert.equal(
    hasCapabilityGrant(["external.write:*"], "external.write:protected_remote"),
    true
  );
  assert.equal(
    hasCapabilityGrant(["external.write:protected_remote"], "external.write:external_side_effect"),
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

test("capability matcher rejects invalid capability-check clocks", () => {
  const result = explainCapabilityDecision(
    [{
      scope: "network.egress:api.github.com",
      expiresAt: "2026-06-05T00:00:00.000Z"
    }],
    "network.egress:api.github.com",
    { now: "not-a-timestamp" }
  );

  assert.equal(result.allowed, false);
  assert.ok(result.ignoredGrantReasons.includes(
    "invalid_capability_check_now:not-a-timestamp"
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
