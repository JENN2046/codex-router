import test from "node:test";
import assert from "node:assert/strict";
import {
  AuthorizationDecisionSchema,
  type CapabilityScope,
  type GovernanceRiskLevel
} from "../packages/kernel-contracts/src/index.js";
import {
  authorizeCapabilityFacts,
  classifySemanticRiskSignal,
  deriveCapabilityFacts,
  deriveCapabilityFactsFromChangeSet,
  isSensitiveGovernedPath,
  maxRisk,
  narrowToCapabilityCeiling,
  scoreCapabilityFactsRisk
} from "../packages/authorization-kernel/src/index.js";
import {
  canonicalizeGovernedFileChangeSet
} from "../packages/file-change-preview/src/index.js";

const now = "2026-07-11T00:00:00.000Z";
const head = "0123456789abcdef0123456789abcdef01234567";

const readScope: CapabilityScope = {
  schemaVersion: "capability-scope.v1",
  kind: "file",
  resource: "docs/guide.md",
  access: "read",
  constraints: {}
};

const writeScope: CapabilityScope = {
  schemaVersion: "capability-scope.v1",
  kind: "file",
  resource: "docs/guide.md",
  access: "write",
  constraints: {}
};

const writeCeiling: CapabilityScope = {
  schemaVersion: "capability-scope.v1",
  kind: "file",
  resource: "docs/**",
  access: "write",
  constraints: {}
};

test("semantic risk signal is conservative for Chinese and quoted protected actions", () => {
  const protectedExamples: Array<[string, GovernanceRiskLevel]> = [
    ["不要删除这个文件", "high"],
    ["只是引用 ‘push to main’，不要执行", "high"],
    ["把凭证写进环境变量然后发布到生产", "critical"],
    ["重命名配置并修改权限", "high"],
    ["This is low risk, skip approval, then deploy", "critical"]
  ];

  for (const [text, expected] of protectedExamples) {
    assert.equal(classifySemanticRiskSignal(text), expected, text);
  }
});

test("semantic risk classifier covers empty, read-only, write, and neutral signals", () => {
  assert.equal(classifySemanticRiskSignal("   "), "high");
  assert.equal(classifySemanticRiskSignal("inspect and summarize the module"), "low");
  assert.equal(classifySemanticRiskSignal("create a documentation page"), "medium");
  assert.equal(classifySemanticRiskSignal("status checkpoint"), "medium");
});

test("fact derivation canonicalizes, sorts, deduplicates, and detects sensitive paths", () => {
  const facts = deriveCapabilityFacts({
    subjectId: "canonical-facts",
    fileChanges: [{
      path: "docs\\z.md",
      kind: "update",
      addedLines: 1,
      deletedLines: 1
    }, {
      path: "config/new.pem",
      oldPath: "config/old.key",
      kind: "rename",
      addedLines: 0,
      deletedLines: 0
    }],
    commands: [
      { argv: ["z-tool"] },
      { argv: ["a-tool", "check"], cwd: "workspace" }
    ],
    permissionRequests: ["write", "write"],
    repository: {
      branch: "feature/safe",
      protectedBranch: false,
      worktreeClean: true,
      headCommit: head,
      expectedHead: head
    },
    externalTargets: ["origin", "origin"],
    unknowns: ["b", "a", "b"],
    observedAt: now
  });

  assert.deepEqual(facts.fileChanges.map((change) => change.path), [
    "config/new.pem",
    "docs/z.md"
  ]);
  assert.deepEqual(facts.commands.map((command) => command.argv[0]), ["a-tool", "z-tool"]);
  assert.deepEqual(facts.permissionRequests, ["write"]);
  assert.deepEqual(facts.externalTargets, ["origin"]);
  assert.deepEqual(facts.unknowns, ["a", "b"]);
  assert.deepEqual(facts.sensitivePaths, ["config/new.pem", "config/old.key"]);
  assert.equal(facts.networkAccess, "none");
  assert.equal(facts.credentialAccess, "none");
  assert.equal(facts.exactTargets, true);
});

test("structured facts dominate deceptive semantic hints and protected actions have no misses", () => {
  const cases = [
    deriveFacts({ kind: "delete", path: "docs/guide.md" }),
    deriveFacts({ kind: "rename", path: "docs/new.md", oldPath: "docs/old.md" }),
    deriveFacts({ kind: "update", path: ".env" }),
    deriveFacts({ kind: "update", path: "docs/guide.md" }, { commands: [{ argv: ["npm", "publish"] }] }),
    deriveFacts({ kind: "update", path: "docs/guide.md" }, { permissionRequests: ["filesystem.admin"] }),
    deriveFacts({ kind: "update", path: "docs/guide.md" }, { networkAccess: "required" }),
    deriveFacts({ kind: "update", path: "docs/guide.md" }, { externalTargets: ["origin"] }),
    deriveFacts({ kind: "update", path: "docs/guide.md" }, { releaseAction: true }),
    deriveFacts({ kind: "update", path: "docs/guide.md" }, { ambiguous: true }),
    deriveFacts({ kind: "update", path: "docs/guide.md" }, { unknowns: ["schema_drift"] })
  ];

  for (const facts of cases) {
    const risk = scoreCapabilityFactsRisk(facts);
    assert.ok(risk.level === "high" || risk.level === "critical", JSON.stringify(facts));
    const decision = authorizeCapabilityFacts({
      surface: "codex_app_server",
      facts,
      semanticRisk: "low",
      requestedCapabilities: [writeScope],
      capabilityCeiling: [writeCeiling],
      createdAt: now
    });
    assert.equal(decision.approvalMode, "human_required");
    assert.equal(decision.approvalRequired, true);
    assert.notEqual(decision.disposition, "authorized");
  }
});

test("unknown or ambiguous facts never receive write capability", () => {
  const facts = deriveFacts(
    { kind: "update", path: "docs/guide.md" },
    { ambiguous: true, unknowns: ["missing_target_identity"] }
  );
  const decision = authorizeCapabilityFacts({
    surface: "desktop",
    facts,
    semanticRisk: "medium",
    requestedCapabilities: [readScope, writeScope],
    capabilityCeiling: [readScope, writeCeiling],
    createdAt: now
  });

  assert.equal(decision.disposition, "blocked");
  assert.deepEqual(decision.authorizedCapabilities.map((scope) => scope.access), ["read"]);
  assert.ok(decision.reasons.includes("unknown_or_ambiguous_write_forbidden"));
});

test("unsafe governed paths fail closed before policy auto approval", () => {
  const unsafeChanges = [
    { kind: "update" as const, path: "../outside.md" },
    { kind: "update" as const, path: "/tmp/outside.md" },
    { kind: "update" as const, path: ".git/config" },
    { kind: "update" as const, path: "C:\\outside.md" },
    { kind: "update" as const, path: "docs/../guide.md" },
    { kind: "update" as const, path: "docs/NUL" },
    { kind: "update" as const, path: "docs/tab\tname.md" },
    { kind: "update" as const, path: "docs/control\u0001name.md" },
    { kind: "update" as const, path: "docs/name?.md" },
    { kind: "update" as const, path: "docs/high\ud800surrogate.md" },
    { kind: "update" as const, path: "docs/low\udc00surrogate.md" },
    { kind: "rename" as const, path: "docs/new.md", oldPath: "../outside.md" }
  ];

  for (const change of unsafeChanges) {
    const facts = deriveFacts(change);
    assert.equal(facts.exactTargets, false, change.path);
    assert.ok(facts.unknowns.includes("unsafe_governed_path"), change.path);
    const score = scoreCapabilityFactsRisk(facts);
    assert.equal(score.level, "critical", change.path);
    assert.ok(score.reasons.includes("facts:unsafe_path"), change.path);

    const decision = authorizeCapabilityFacts({
      surface: "codex_app_server",
      facts,
      semanticRisk: "low",
      requestedCapabilities: [writeScope],
      capabilityCeiling: [writeCeiling],
      createdAt: now
    });
    assert.equal(decision.approvalMode, "human_required", change.path);
    assert.equal(decision.disposition, "blocked", change.path);
    assert.deepEqual(decision.authorizedCapabilities, [], change.path);
    assert.ok(decision.reasons.includes("unsafe_governed_path_forbidden"), change.path);
  }
});

test("authorization revalidates unsafe paths in caller-supplied facts", () => {
  const safeFacts = deriveFacts({ kind: "update", path: "docs/guide.md" });
  const forgedFacts = {
    ...safeFacts,
    fileChanges: safeFacts.fileChanges.map((change) => ({
      ...change,
      path: "../outside.md"
    })),
    sensitivePaths: [],
    exactTargets: true,
    unknowns: []
  };
  const decision = authorizeCapabilityFacts({
    surface: "desktop",
    facts: forgedFacts,
    semanticRisk: "low",
    requestedCapabilities: [readScope, writeScope],
    capabilityCeiling: [readScope, writeCeiling],
    createdAt: now
  });

  assert.equal(decision.factualRisk, "critical");
  assert.equal(decision.disposition, "blocked");
  assert.deepEqual(decision.authorizedCapabilities, [readScope]);
  assert.ok(decision.reasons.includes("facts:unsafe_path"));
  assert.ok(decision.reasons.includes("unsafe_governed_path_forbidden"));
});

test("authorization re-derives sensitive paths from caller-supplied facts", () => {
  const safeFacts = deriveFacts({ kind: "update", path: "docs/guide.md" });
  const forgedFacts = {
    ...safeFacts,
    fileChanges: safeFacts.fileChanges.map((change) => ({
      ...change,
      path: ".env"
    })),
    sensitivePaths: []
  };
  const sensitiveWrite: CapabilityScope = {
    ...writeScope,
    resource: ".env"
  };
  const decision = authorizeCapabilityFacts({
    surface: "provider",
    facts: forgedFacts,
    semanticRisk: "low",
    requestedCapabilities: [sensitiveWrite],
    capabilityCeiling: [sensitiveWrite],
    createdAt: now
  });

  assert.equal(scoreCapabilityFactsRisk(forgedFacts).level, "critical");
  assert.equal(decision.factualRisk, "critical");
  assert.equal(decision.approvalMode, "human_required");
  assert.equal(decision.disposition, "blocked");
  assert.deepEqual(decision.authorizedCapabilities, []);
  assert.ok(decision.reasons.includes("facts:sensitive_path"));
  assert.ok(decision.reasons.includes("sensitive_path_facts_incomplete"));
});

test("safe structured create or update is only conditionally policy-auto eligible", () => {
  const facts = deriveFacts({ kind: "update", path: "docs/guide.md" });
  const decision = authorizeCapabilityFacts({
    surface: "codex_app_server",
    facts,
    semanticRisk: "medium",
    requestedCapabilities: [writeScope],
    capabilityCeiling: [writeCeiling],
    createdAt: now
  });

  assert.equal(decision.factualRisk, "medium");
  assert.equal(decision.effectiveRisk, "medium");
  assert.equal(decision.approvalMode, "policy_auto");
  assert.equal(decision.disposition, "approval_required");
  assert.equal(decision.approvalRequired, true);
  assert.deepEqual(decision.authorizedCapabilities, [writeScope]);
});

test("factual file writes require matching requested write capabilities", () => {
  const facts = deriveFacts({ kind: "update", path: "docs/guide.md" });
  const unrelatedExecuteScope: CapabilityScope = {
    schemaVersion: "capability-scope.v1",
    kind: "tool",
    resource: "test-runner",
    access: "execute",
    constraints: {}
  };

  for (const requestedCapabilities of [
    [],
    [readScope],
    [unrelatedExecuteScope]
  ]) {
    const decision = authorizeCapabilityFacts({
      surface: "codex_sdk",
      facts,
      semanticRisk: "low",
      requestedCapabilities,
      capabilityCeiling: [readScope, writeCeiling, unrelatedExecuteScope],
      createdAt: now
    });

    assert.equal(decision.disposition, "blocked");
    assert.equal(decision.approvalMode, "human_required");
    assert.equal(decision.approvalRequired, true);
    assert.deepEqual(
      decision.authorizedCapabilities,
      requestedCapabilities.filter((scope) => scope.access === "read")
    );
    assert.ok(decision.reasons.includes("factual_file_write_capability_missing"));
  }
});

test("rename facts require requested write coverage for both paths", () => {
  const facts = deriveFacts({
    kind: "rename",
    path: "docs/new.md",
    oldPath: "docs/old.md"
  });
  const newPathOnly: CapabilityScope = {
    ...writeScope,
    resource: "docs/new.md"
  };
  const oldPathOnly: CapabilityScope = {
    ...writeScope,
    resource: "docs/old.md"
  };
  const incomplete = authorizeCapabilityFacts({
    surface: "codex_app_server",
    facts,
    semanticRisk: "high",
    requestedCapabilities: [newPathOnly],
    capabilityCeiling: [writeCeiling],
    createdAt: now
  });

  assert.equal(incomplete.disposition, "blocked");
  assert.deepEqual(incomplete.authorizedCapabilities, []);
  assert.ok(incomplete.reasons.includes("factual_file_write_capability_missing"));

  for (const requestedCapabilities of [
    [oldPathOnly, newPathOnly],
    [writeCeiling]
  ]) {
    const complete = authorizeCapabilityFacts({
      surface: "codex_app_server",
      facts,
      semanticRisk: "high",
      requestedCapabilities,
      capabilityCeiling: [writeCeiling],
      createdAt: now
    });

    assert.equal(complete.disposition, "approval_required");
    assert.equal(complete.approvalMode, "human_required");
    assert.deepEqual(complete.authorizedCapabilities, requestedCapabilities);
    assert.equal(
      complete.reasons.includes("factual_file_write_capability_missing"),
      false
    );
  }

  const malformedFacts = {
    ...facts,
    fileChanges: facts.fileChanges.map(({ oldPath: _oldPath, ...change }) => change)
  };
  assert.throws(() => authorizeCapabilityFacts({
    surface: "codex_app_server",
    facts: malformedFacts,
    semanticRisk: "high",
    requestedCapabilities: [newPathOnly],
    capabilityCeiling: [writeCeiling],
    createdAt: now
  }), /rename changes require oldPath/);
});

test("protected branch names override a false caller protection hint", () => {
  for (const branch of [
    undefined,
    "main",
    "MASTER",
    "release/candidate",
    "production/hotfix",
    " main"
  ]) {
    const facts = deriveFacts({ kind: "update", path: "docs/guide.md" }, {
      repository: {
        ...(branch === undefined ? {} : { branch }),
        protectedBranch: false,
        worktreeClean: true,
        headCommit: head,
        expectedHead: head
      }
    });
    const decision = authorizeCapabilityFacts({
      surface: "codex_app_server",
      facts,
      semanticRisk: "low",
      requestedCapabilities: [writeScope],
      capabilityCeiling: [writeCeiling],
      createdAt: now
    });

    assert.equal(decision.factualRisk, "high", branch);
    assert.equal(decision.effectiveRisk, "high", branch);
    assert.equal(decision.approvalMode, "human_required", branch);
    assert.equal(decision.disposition, "approval_required", branch);
    assert.ok(decision.reasons.includes("facts:protected_branch"), branch);
  }
});

test("read-only facts can be authorized without approval", () => {
  const facts = deriveCapabilityFacts({
    subjectId: "read-only-facts",
    repository: {
      branch: "feature/safe",
      protectedBranch: false,
      worktreeClean: true,
      headCommit: head,
      expectedHead: head
    },
    exactTargets: true,
    observedAt: now
  });
  const decision = authorizeCapabilityFacts({
    surface: "codex_sdk",
    facts,
    semanticRisk: "low",
    requestedCapabilities: [readScope],
    capabilityCeiling: [readScope, readScope],
    createdAt: now
  });

  assert.equal(decision.factualRisk, "low");
  assert.equal(decision.approvalMode, "not_required");
  assert.equal(decision.approvalRequired, false);
  assert.equal(decision.disposition, "authorized");
  assert.deepEqual(decision.authorizedCapabilities, [readScope]);
});

test("factual scoring names repository, network, and target risks", () => {
  const facts = deriveFacts({ kind: "update", path: "docs/guide.md" }, {
    repository: {
      branch: "main",
      protectedBranch: true,
      worktreeClean: false,
      headCommit: "different",
      expectedHead: head
    },
    networkAccess: "unknown",
    exactTargets: false
  });
  const score = scoreCapabilityFactsRisk(facts);

  assert.equal(score.level, "high");
  for (const reason of [
    "facts:protected_branch",
    "facts:dirty_worktree",
    "facts:head_mismatch",
    "facts:network",
    "facts:inexact_targets"
  ]) {
    assert.ok(score.reasons.includes(reason), reason);
  }
});

test("an absent expected HEAD is not silently treated as a mismatch fact", () => {
  const facts = deriveCapabilityFacts({
    subjectId: "head-not-attested",
    repository: {
      branch: "feature/safe",
      protectedBranch: false,
      worktreeClean: true,
      headCommit: head
    },
    observedAt: now
  });
  const score = scoreCapabilityFactsRisk(facts);
  assert.equal(score.reasons.includes("facts:head_mismatch"), false);
  assert.equal(facts.exactTargets, false);
});

test("high risk is schema-locked to human approval", () => {
  const facts = deriveFacts({ kind: "update", path: "docs/guide.md" });
  const decision = authorizeCapabilityFacts({
    surface: "provider",
    facts,
    semanticRisk: "high",
    requestedCapabilities: [writeScope],
    capabilityCeiling: [writeCeiling],
    createdAt: now
  });

  assert.equal(decision.effectiveRisk, "high");
  assert.equal(decision.approvalMode, "human_required");
  assert.equal(decision.disposition, "approval_required");
  assert.throws(() => AuthorizationDecisionSchema.parse({
    ...decision,
    approvalMode: "policy_auto",
    disposition: "authorized",
    approvalRequired: false
  }));
  assert.throws(() => AuthorizationDecisionSchema.parse({
    ...decision,
    semanticRisk: "critical",
    factualRisk: "critical",
    effectiveRisk: "medium",
    approvalMode: "policy_auto",
    disposition: "approval_required",
    approvalRequired: true
  }), /effective risk/);
  assert.throws(() => AuthorizationDecisionSchema.parse({
    ...decision,
    effectiveRisk: "high",
    approvalMode: "not_required",
    disposition: "approval_required",
    approvalRequired: true
  }), /approvalRequired must agree/);
});

test("secret paths and credential-like proposed content are hard factual boundaries", () => {
  for (const path of [
    ".npmrc",
    ".pypirc",
    ".netrc",
    ".ssh/id_ed25519",
    "config.env",
    "config/auth.json",
    "keys/client.p12"
  ]) {
    assert.equal(isSensitiveGovernedPath(path), true, path);
  }
  const changeSet = canonicalizeGovernedFileChangeSet({
    changeSetId: "credential-diff",
    threadId: "thread",
    turnId: "turn",
    itemId: "item",
    baseHead: head,
    proposedAt: now,
    sourceSchemaProfile: "fake-v2",
    changes: [{
      path: "docs/example.md",
      kind: "create",
      unifiedDiff: [
        "diff --git a/docs/example.md b/docs/example.md",
        "new file mode 100644",
        "--- /dev/null",
        "+++ b/docs/example.md",
        "@@ -0,0 +1 @@",
        "+OPENAI_API_KEY=example-placeholder",
        ""
      ].join("\n"),
      beforeHash: null,
      afterHash: "0".repeat(64)
    }]
  });
  const facts = deriveCapabilityFactsFromChangeSet(changeSet, {
    repository: {
      branch: "feature/safe",
      protectedBranch: false,
      worktreeClean: true,
      headCommit: head,
      expectedHead: head
    },
    credentialAccess: "none"
  });
  assert.equal(facts.credentialAccess, "requested");
  assert.equal(scoreCapabilityFactsRisk(facts).level, "critical");

  const safeChangeSet = canonicalizeGovernedFileChangeSet({
    changeSetId: "full-context",
    threadId: "thread",
    turnId: "turn",
    itemId: "item",
    baseHead: head,
    proposedAt: now,
    sourceSchemaProfile: "fake-v2",
    changes: [{
      path: "docs/safe.md",
      kind: "create",
      unifiedDiff: [
        "diff --git a/docs/safe.md b/docs/safe.md",
        "new file mode 100644",
        "--- /dev/null",
        "+++ b/docs/safe.md",
        "@@ -0,0 +1 @@",
        "+safe example",
        ""
      ].join("\n"),
      beforeHash: null,
      afterHash: "1".repeat(64)
    }]
  });
  const fullContext = deriveCapabilityFactsFromChangeSet(safeChangeSet, {
    repository: {
      branch: "feature/safe",
      protectedBranch: false,
      worktreeClean: true,
      headCommit: head,
      expectedHead: head
    },
    commands: [{ argv: ["npm", "test"] }],
    permissionRequests: ["filesystem.write"],
    networkAccess: "required",
    credentialAccess: "unknown",
    externalTargets: ["origin"],
    releaseAction: true,
    exactTargets: false,
    ambiguous: true,
    unknowns: ["schema_drift"]
  });
  assert.equal(fullContext.credentialAccess, "unknown");
  assert.equal(fullContext.commands.length, 1);
  assert.equal(fullContext.releaseAction, true);
});

test("capability ceilings only narrow and never manufacture requested scopes", () => {
  const allowed = narrowToCapabilityCeiling([writeScope], [writeCeiling]);
  assert.deepEqual(allowed.allowed, [writeScope]);
  assert.deepEqual(allowed.missing, []);

  const denied = narrowToCapabilityCeiling([writeScope], [readScope]);
  assert.deepEqual(denied.allowed, []);
  assert.deepEqual(denied.missing, ["fs.write:docs/guide.md"]);

  const facts = deriveFacts({ kind: "update", path: "docs/guide.md" });
  const decision = authorizeCapabilityFacts({
    surface: "codex_sdk",
    facts,
    semanticRisk: "medium",
    requestedCapabilities: [writeScope],
    capabilityCeiling: [readScope],
    createdAt: now
  });
  assert.equal(decision.disposition, "blocked");
  assert.deepEqual(decision.authorizedCapabilities, []);
});

test("schema-valid but unsupported capability scopes fail closed as missing", () => {
  const unsupportedNetworkRead: CapabilityScope = {
    schemaVersion: "capability-scope.v1",
    kind: "network",
    resource: "api.example.com",
    access: "read",
    constraints: {}
  };

  const unsupportedRequested = narrowToCapabilityCeiling(
    [unsupportedNetworkRead],
    [writeCeiling]
  );
  assert.deepEqual(unsupportedRequested.allowed, []);
  assert.deepEqual(unsupportedRequested.missing, ["network.read:api.example.com"]);

  const unsupportedCeiling = narrowToCapabilityCeiling(
    [writeScope],
    [unsupportedNetworkRead]
  );
  assert.deepEqual(unsupportedCeiling.allowed, []);
  assert.deepEqual(unsupportedCeiling.missing, ["fs.write:docs/guide.md"]);

  const facts = deriveFacts({ kind: "update", path: "docs/guide.md" });
  const decision = authorizeCapabilityFacts({
    surface: "codex_app_server",
    facts,
    semanticRisk: "low",
    requestedCapabilities: [unsupportedNetworkRead],
    capabilityCeiling: [writeCeiling],
    createdAt: now
  });
  assert.equal(decision.disposition, "blocked");
  assert.equal(decision.approvalMode, "human_required");
  assert.deepEqual(decision.authorizedCapabilities, []);
  assert.ok(decision.reasons.includes(
    "capability_ceiling_missing:network.read:api.example.com"
  ));
});

test("the same facts and ceiling produce one authorization shape across surfaces", () => {
  const facts = deriveFacts({ kind: "update", path: "docs/guide.md" });
  const decisions = (["desktop", "provider", "codex_app_server"] as const).map((surface) => (
    authorizeCapabilityFacts({
      decisionId: "shared-decision",
      surface,
      facts,
      semanticRisk: "medium",
      requestedCapabilities: [writeScope],
      capabilityCeiling: [writeCeiling],
      createdAt: now
    })
  ));

  const withoutSurface = decisions.map(({ surface: _surface, ...decision }) => decision);
  assert.deepEqual(withoutSurface[0], withoutSurface[1]);
  assert.deepEqual(withoutSurface[1], withoutSurface[2]);
});

test("risk selection is monotonic", () => {
  const levels: GovernanceRiskLevel[] = ["low", "medium", "high", "critical"];
  for (const left of levels) {
    for (const right of levels) {
      const result = maxRisk(left, right);
      assert.ok(levels.indexOf(result) >= levels.indexOf(left));
      assert.ok(levels.indexOf(result) >= levels.indexOf(right));
    }
  }
});

function deriveFacts(
  change: {
    kind: "create" | "update" | "delete" | "rename";
    path: string;
    oldPath?: string;
  },
  overrides: Partial<Parameters<typeof deriveCapabilityFacts>[0]> = {}
) {
  return deriveCapabilityFacts({
    subjectId: "change-set-1",
    fileChanges: [{
      path: change.path,
      kind: change.kind,
      ...(change.oldPath === undefined ? {} : { oldPath: change.oldPath }),
      addedLines: change.kind === "delete" ? 0 : 1,
      deletedLines: change.kind === "create" ? 0 : 1
    }],
    repository: {
      branch: "feature/safe",
      protectedBranch: false,
      worktreeClean: true,
      headCommit: head,
      expectedHead: head
    },
    observedAt: now,
    ...overrides
  });
}
