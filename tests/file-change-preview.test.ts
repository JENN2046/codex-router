import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import {
  deriveCapabilityFactsFromChangeSet
} from "../packages/authorization-kernel/src/index.js";
import {
  LocalClonePreviewer,
  SpawnPreviewProcessRunner,
  canonicalizeGovernedFileChangeSet,
  createTestOnlyLocalClonePreviewer,
  evaluateAutoApprovalPolicy,
  getTrustedPreviewerAttestation
} from "../packages/file-change-preview/src/index.js";
import {
  GovernedFileChangeSetSchema,
  PreviewPolicySchema,
  type GovernedFileChangeSet,
  type PreviewPolicy
} from "../packages/kernel-contracts/src/index.js";

const execFileAsync = promisify(execFile);
const now = "2026-07-11T00:00:00.000Z";

test("canonical change hashing is order-stable and rejects path aliases", () => {
  const first = canonicalizeGovernedFileChangeSet({
    changeSetId: "set-1",
    threadId: "thread-1",
    turnId: "turn-1",
    itemId: "item-1",
    baseHead: "head-1",
    proposedAt: now,
    sourceSchemaProfile: "fake-v2",
    changes: [
      createChange("docs/b.md", "b\n"),
      createChange("docs/a.md", "a\n", "\r\n")
    ]
  });
  const second = canonicalizeGovernedFileChangeSet({
    changeSetId: "different-id",
    threadId: "different-thread",
    turnId: "different-turn",
    itemId: "different-item",
    baseHead: "head-1",
    proposedAt: "2027-01-01T00:00:00.000Z",
    sourceSchemaProfile: "fake-v2",
    changes: [
      createChange("docs/a.md", "a\n"),
      createChange("docs/b.md", "b\n")
    ]
  });

  assert.equal(first.canonicalHash, second.canonicalHash);
  assert.deepEqual(first.changes.map((change) => change.path), ["docs/a.md", "docs/b.md"]);
  assert.throws(() => canonicalizeGovernedFileChangeSet({
    changeSetId: "alias",
    threadId: "thread",
    turnId: "turn",
    itemId: "item",
    baseHead: "head",
    proposedAt: now,
    sourceSchemaProfile: "fake-v2",
    changes: [createChange("docs/A.md", "a\n"), createChange("docs/a.md", "b\n")]
  }), /governed_path_alias_collision/);
  assert.throws(() => canonicalizeGovernedFileChangeSet({
    changeSetId: "git-metadata",
    threadId: "thread",
    turnId: "turn",
    itemId: "item",
    baseHead: "head",
    proposedAt: now,
    sourceSchemaProfile: "fake-v2",
    changes: [createChange(".git/hooks/pre-commit", "blocked\n")]
  }), /governed_path_unsafe/);
});

test("canonicalization rejects non-canonical and cross-platform hazardous paths", () => {
  const invalidPaths = [
    "",
    ".",
    "..",
    "../outside.md",
    "/absolute.md",
    "C:\\absolute.md",
    "//server/share.md",
    "docs//double.md",
    "docs/./dot.md",
    "docs/.git/config",
    "docs/name:stream",
    "docs/trailing.",
    "docs/trailing ",
    "docs/con",
    "docs/null\0byte.md",
    "docs/new\nline.md",
    "docs/carriage\rreturn.md",
    "docs/e\u0301.md"
  ];

  for (const path of invalidPaths) {
    assert.throws(() => canonicalizeGovernedFileChangeSet({
      changeSetId: `invalid-${path.length}`,
      threadId: "thread",
      turnId: "turn",
      itemId: "item",
      baseHead: "head",
      proposedAt: now,
      sourceSchemaProfile: "fake-v2",
      changes: [createChange(path, "blocked\n")]
    }), /governed_(path|change_set)/, JSON.stringify(path));
  }

  const normalized = canonicalizeGovernedFileChangeSet({
    changeSetId: "windows-relative",
    threadId: "thread",
    turnId: "turn",
    itemId: "item",
    baseHead: "head",
    proposedAt: now,
    sourceSchemaProfile: "fake-v2",
    changes: [{
      ...createChange("docs\\guide.md", "ok\n"),
      unifiedDiff: createChange("docs/guide.md", "ok\n").unifiedDiff
    }]
  });
  assert.equal(normalized.changes[0]?.path, "docs/guide.md");
});

test("seeded path property cases preserve canonical hashes and reject traversal aliases", () => {
  let state = 0x2046_0711;
  const next = (): number => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state;
  };
  for (let index = 0; index < 96; index += 1) {
    const safePath = `docs/fuzz-${next().toString(16)}-${index}.md`;
    const draft = {
      changeSetId: `fuzz-${index}`,
      threadId: "thread",
      turnId: "turn",
      itemId: "item",
      baseHead: "head",
      proposedAt: now,
      sourceSchemaProfile: "fake-v2",
      changes: [createChange(safePath, `value-${next()}\n`)]
    };
    assert.equal(
      canonicalizeGovernedFileChangeSet(draft).canonicalHash,
      canonicalizeGovernedFileChangeSet(structuredClone(draft)).canonicalHash
    );
    const unsafePath = [
      `../${safePath}`,
      `.git/${safePath}`,
      `${safePath}:stream`,
      `docs/../${safePath}`,
      `docs/${index % 2 === 0 ? "CON" : "NUL"}`
    ][next() % 5]!;
    assert.throws(() => canonicalizeGovernedFileChangeSet({
      ...draft,
      changes: [createChange(unsafePath, "unsafe\n")]
    }));
  }
});

test("canonicalization rejects empty sets and diffs bound to another path", () => {
  assert.throws(() => canonicalizeGovernedFileChangeSet({
    changeSetId: "empty",
    threadId: "thread",
    turnId: "turn",
    itemId: "item",
    baseHead: "head",
    proposedAt: now,
    sourceSchemaProfile: "fake-v2",
    changes: []
  }), /governed_change_set_empty/);
  assert.throws(() => canonicalizeGovernedFileChangeSet({
    changeSetId: "diff-mismatch",
    threadId: "thread",
    turnId: "turn",
    itemId: "item",
    baseHead: "head",
    proposedAt: now,
    sourceSchemaProfile: "fake-v2",
    changes: [{
      ...createChange("docs/a.md", "a\n"),
      unifiedDiff: createChange("docs/b.md", "b\n").unifiedDiff
    }]
  }), /governed_change_diff_path_mismatch/);

  const valid = canonicalizeGovernedFileChangeSet({
    changeSetId: "tamper-check",
    threadId: "thread",
    turnId: "turn",
    itemId: "item",
    baseHead: "head",
    proposedAt: now,
    sourceSchemaProfile: "fake-v2",
    changes: [createChange("docs/a.md", "a\n")]
  });
  assert.equal(GovernedFileChangeSetSchema.safeParse({
    ...valid,
    changes: valid.changes.map((change) => ({ ...change, afterHash: "0".repeat(64) }))
  }).success, false);
});

test("hard auto-approval boundaries cannot be relaxed by policy", () => {
  const changeSet = canonicalizeGovernedFileChangeSet({
    changeSetId: "set-hard-boundary",
    threadId: "thread",
    turnId: "turn",
    itemId: "item",
    baseHead: "head",
    proposedAt: now,
    sourceSchemaProfile: "fake-v2",
    changes: [createChange(".env.example", "sensitive\n")]
  });
  const facts = deriveCapabilityFactsFromChangeSet(changeSet, {
    repository: {
      branch: "main",
      protectedBranch: true,
      worktreeClean: false,
      headCommit: "head",
      expectedHead: "head"
    },
    commands: [{ argv: ["npm", "publish"] }],
    permissionRequests: ["filesystem.write"],
    networkAccess: "required",
    credentialAccess: "requested",
    externalTargets: ["origin"],
    releaseAction: true,
    exactTargets: true
  });
  const result = evaluateAutoApprovalPolicy(changeSet, facts, policy(["**"]));

  assert.equal(result.eligible, false);
  for (const reason of [
    "auto_approval_sensitive_path_forbidden",
    "auto_approval_command_forbidden",
    "auto_approval_permission_forbidden",
    "auto_approval_protected_branch_forbidden",
    "auto_approval_dirty_worktree_forbidden",
    "auto_approval_network_forbidden",
    "auto_approval_credential_forbidden",
    "auto_approval_external_target_forbidden",
    "auto_approval_release_forbidden"
  ]) {
    assert.ok(result.reasons.includes(reason), reason);
  }
});

test("delete, rename, missing hashes, and ambiguous facts never auto-approve", () => {
  const deleteSet = canonicalizeGovernedFileChangeSet({
    changeSetId: "delete-set",
    threadId: "thread",
    turnId: "turn",
    itemId: "item",
    baseHead: "head",
    proposedAt: now,
    sourceSchemaProfile: "fake-v2",
    changes: [{
      path: "docs/old.md",
      kind: "delete",
      unifiedDiff: deleteDiff("docs/old.md", "old"),
      beforeHash: sha256(Buffer.from("old\n")),
      afterHash: null
    }]
  });
  const renameSet = canonicalizeGovernedFileChangeSet({
    changeSetId: "rename-set",
    threadId: "thread",
    turnId: "turn",
    itemId: "item",
    baseHead: "head",
    proposedAt: now,
    sourceSchemaProfile: "fake-v2",
    changes: [{
      path: "docs/new.md",
      oldPath: "docs/old.md",
      kind: "rename",
      unifiedDiff: renameDiff("docs/old.md", "docs/new.md", "old"),
      beforeHash: sha256(Buffer.from("old\n")),
      afterHash: sha256(Buffer.from("old\n"))
    }]
  });
  const missingBeforeSet = canonicalizeGovernedFileChangeSet({
    changeSetId: "missing-before-set",
    threadId: "thread",
    turnId: "turn",
    itemId: "item",
    baseHead: "head",
    proposedAt: now,
    sourceSchemaProfile: "fake-v2",
    changes: [{
      path: "docs/guide.md",
      kind: "update",
      unifiedDiff: updateDiff("docs/guide.md", "old", "new"),
      afterHash: sha256(Buffer.from("new\n"))
    }]
  });
  const missingAfterSet = canonicalizeGovernedFileChangeSet({
    changeSetId: "missing-after-set",
    threadId: "thread",
    turnId: "turn",
    itemId: "item",
    baseHead: "head",
    proposedAt: now,
    sourceSchemaProfile: "fake-v2",
    changes: [{
      path: "docs/guide.md",
      kind: "update",
      unifiedDiff: updateDiff("docs/guide.md", "old", "new"),
      beforeHash: sha256(Buffer.from("old\n"))
    }]
  });

  for (const [changeSet, reason] of [
    [deleteSet, "auto_approval_delete_forbidden"],
    [renameSet, "auto_approval_rename_forbidden"],
    [missingBeforeSet, "auto_approval_update_before_hash_required"],
    [missingAfterSet, "auto_approval_after_hash_required"]
  ] as const) {
    const result = evaluateAutoApprovalPolicy(
      changeSet,
      safeFacts(changeSet, "feature/safe", "head"),
      policy(["docs/**"])
    );
    assert.equal(result.eligible, false);
    assert.ok(result.reasons.includes(reason));
  }

  const safeSet = canonicalizeGovernedFileChangeSet({
    changeSetId: "ambiguous-set",
    threadId: "thread",
    turnId: "turn",
    itemId: "item",
    baseHead: "head",
    proposedAt: now,
    sourceSchemaProfile: "fake-v2",
    changes: [createChange("docs/new.md", "new\n")]
  });
  for (const overrides of [
    { exactTargets: false },
    { ambiguous: true },
    { unknowns: ["schema_drift"] }
  ]) {
    const facts = deriveCapabilityFactsFromChangeSet(safeSet, {
      repository: {
        branch: "feature/safe",
        protectedBranch: false,
        worktreeClean: true,
        headCommit: "head",
        expectedHead: "head"
      },
      networkAccess: "none",
      credentialAccess: "none",
      exactTargets: true,
      ...overrides
    });
    const result = evaluateAutoApprovalPolicy(safeSet, facts, policy(["docs/**"]));
    assert.ok(result.reasons.includes("auto_approval_ambiguous_or_unknown_forbidden"));
  }
});

test("auto-approval treats implicit protected branches and incomplete HEAD facts as unsafe", () => {
  const changeSet = canonicalizeGovernedFileChangeSet({
    changeSetId: "implicit-protection",
    threadId: "thread",
    turnId: "turn",
    itemId: "item",
    baseHead: "head",
    proposedAt: now,
    sourceSchemaProfile: "fake-v2",
    changes: [createChange("docs/new.md", "new\n")]
  });
  for (const branch of [undefined, "release/candidate", "production/hotfix"]) {
    const facts = deriveCapabilityFactsFromChangeSet(changeSet, {
      repository: {
        ...(branch === undefined ? {} : { branch }),
        protectedBranch: false,
        worktreeClean: true,
        headCommit: "head",
        expectedHead: "head"
      },
      exactTargets: true
    });
    const result = evaluateAutoApprovalPolicy(changeSet, facts, policy(["docs/*"]));
    assert.ok(result.reasons.includes("auto_approval_protected_branch_forbidden"));
  }

  for (const repository of [{
    branch: "feature/safe",
    protectedBranch: false,
    worktreeClean: true
  }, {
    branch: "feature/safe",
    protectedBranch: false,
    worktreeClean: true,
    headCommit: "head"
  }, {
    branch: "feature/safe",
    protectedBranch: false,
    worktreeClean: true,
    headCommit: "other",
    expectedHead: "head"
  }]) {
    const facts = deriveCapabilityFactsFromChangeSet(changeSet, {
      repository,
      exactTargets: true
    });
    const result = evaluateAutoApprovalPolicy(changeSet, facts, policy(["docs/*"]));
    assert.ok(result.reasons.includes("auto_approval_head_mismatch"));
  }
});

test("auto-approval rules report every restrictive mismatch", () => {
  const changeSet = canonicalizeGovernedFileChangeSet({
    changeSetId: "rule-mismatches",
    threadId: "thread",
    turnId: "turn",
    itemId: "item",
    baseHead: "head",
    proposedAt: now,
    sourceSchemaProfile: "fake-v2",
    changes: [
      createChange("docs/a.md", "one\n"),
      createChange("docs/b.md", "two\n")
    ]
  });
  const facts = safeFacts(changeSet, "feature/safe", "head");
  const result = evaluateAutoApprovalPolicy(changeSet, facts, {
    schemaVersion: "preview-policy.v1",
    autoApprovalRules: [{
      ruleId: "restrictive",
      allowedPaths: ["../unsafe/**"],
      operations: ["update"],
      maxFiles: 1,
      maxDiffLines: 1,
      prepare: [],
      checks: [{ argv: [process.execPath, "--version"], timeoutMs: 10_000 }]
    }]
  });

  assert.equal(result.eligible, false);
  for (const reason of [
    "restrictive:file_limit_exceeded",
    "restrictive:diff_limit_exceeded",
    "restrictive:operation_not_allowed",
    "restrictive:path_not_allowed:docs/a.md",
    "restrictive:path_not_allowed:docs/b.md"
  ]) {
    assert.ok(result.reasons.includes(reason), reason);
  }

  const missing = evaluateAutoApprovalPolicy(changeSet, facts, {
    schemaVersion: "preview-policy.v1",
    autoApprovalRules: []
  });
  assert.deepEqual(missing.reasons, ["auto_approval_rule_missing"]);

  const mismatchedFacts = structuredClone(facts);
  mismatchedFacts.fileChanges[0]!.path = "docs/other.md";
  const mismatched = evaluateAutoApprovalPolicy(changeSet, mismatchedFacts, policy(["docs/**"]));
  assert.ok(mismatched.reasons.includes("auto_approval_facts_change_set_mismatch"));
});

test("preview reports unsupported isolation without creating a clone", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "preview-unsupported-"));
  const changeSet = canonicalizeGovernedFileChangeSet({
    changeSetId: "set-unsupported",
    threadId: "thread",
    turnId: "turn",
    itemId: "item",
    baseHead: "head",
    proposedAt: now,
    sourceSchemaProfile: "fake-v2",
    changes: [createChange("docs/new.md", "new\n")]
  });
  const facts = safeFacts(changeSet, "feature/safe", "head");
  const previewer = new LocalClonePreviewer({ tempRoot });
  const receipt = await previewer.preview({
    repoRoot: tempRoot,
    changeSet,
    facts,
    policy: policy(["docs/**"]),
    isolation: {
      networkIsolation: "unsupported",
      filesystemIsolation: "unsupported",
      scope: "test_only",
      enforcerId: "none"
    },
    now: () => now
  });

  assert.equal(receipt.status, "blocked");
  assert.equal(receipt.cleanupStatus, "not_created");
  assert.ok(receipt.reasons.includes("preview_network_isolation_unavailable"));
  assert.ok(receipt.reasons.includes("preview_filesystem_isolation_unavailable"));
  assert.deepEqual(await readdir(tempRoot), []);
  await rm(tempRoot, { recursive: true, force: true });
});

test("auto-approval commands reject shell interpreters and control separators", () => {
  for (const argv of [
    ["sh", "-c", "npm test"],
    ["C:\\Windows\\System32\\cmd.exe", "/c", "npm test"],
    ["npm", "run", "test\nthen-publish"]
  ]) {
    assert.equal(PreviewPolicySchema.safeParse({
      autoApprovalRules: [{
        ruleId: "unsafe-command",
        allowedPaths: ["docs/**"],
        operations: ["update"],
        maxFiles: 1,
        maxDiffLines: 10,
        checks: [{ argv }]
      }]
    }).success, false, argv.join(" "));
  }
});

test("preview requires a named isolation enforcer before repository inspection", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "preview-unnamed-isolation-"));
  const changeSet = canonicalizeGovernedFileChangeSet({
    changeSetId: "set-unnamed-isolation",
    threadId: "thread",
    turnId: "turn",
    itemId: "item",
    baseHead: "head",
    proposedAt: now,
    sourceSchemaProfile: "fake-v2",
    changes: [createChange("docs/new.md", "new\n")]
  });
  const receipt = await new LocalClonePreviewer({ tempRoot }).preview({
    repoRoot: tempRoot,
    changeSet,
    facts: safeFacts(changeSet, "feature/safe", "head"),
    policy: policy(["docs/**"]),
    isolation: {
      networkIsolation: "enforced_none",
      filesystemIsolation: "clone_only_enforced",
      scope: "test_only",
      enforcerId: "   "
    },
    now: () => now
  });

  assert.equal(receipt.status, "blocked");
  assert.ok(receipt.reasons.includes("preview_isolation_enforcer_missing"));
  assert.deepEqual(await readdir(tempRoot), []);
  await rm(tempRoot, { recursive: true, force: true });
});

test("caller isolation claims cannot make the unisolated spawn runner auto-approve", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "preview-forged-isolation-"));
  const marker = join(tempRoot, "source-marker.txt");
  const changeSet = canonicalizeGovernedFileChangeSet({
    changeSetId: "forged-isolation",
    threadId: "thread",
    turnId: "turn",
    itemId: "item",
    baseHead: "head",
    proposedAt: now,
    sourceSchemaProfile: "fake-v2",
    changes: [createChange("docs/new.md", "new\n")]
  });
  const configured = policy(["docs/**"], [{
    argv: [
      process.execPath,
      "-e",
      `require('node:fs').writeFileSync(${JSON.stringify(marker)},'escaped')`
    ],
    timeoutMs: 10_000
  }]);
  const receipt = await new LocalClonePreviewer({ tempRoot }).preview({
    repoRoot: tempRoot,
    changeSet,
    facts: safeFacts(changeSet, "feature/safe", "head"),
    policy: configured,
    isolation: testIsolation(),
    now: () => now
  });

  assert.equal(receipt.status, "blocked");
  assert.ok(receipt.reasons.includes("preview_runner_network_isolation_unavailable"));
  assert.ok(receipt.reasons.includes("preview_runner_filesystem_isolation_unavailable"));
  await assert.rejects(() => readFile(marker), { code: "ENOENT" });
  await rm(tempRoot, { recursive: true, force: true });
});

test("only the internal test factory is trusted and its scope cannot be promoted to live", async () => {
  const untrusted = new LocalClonePreviewer();
  assert.equal(getTrustedPreviewerAttestation(untrusted), undefined);
  const trustedWithDefaults = createTestOnlyLocalClonePreviewer();
  assert.deepEqual(getTrustedPreviewerAttestation(trustedWithDefaults), testIsolation());

  const tempRoot = await mkdtemp(join(tmpdir(), "preview-scope-binding-"));
  const changeSet = canonicalizeGovernedFileChangeSet({
    changeSetId: "scope-binding",
    threadId: "thread",
    turnId: "turn",
    itemId: "item",
    baseHead: "head",
    proposedAt: now,
    sourceSchemaProfile: "fake-v2",
    changes: [createChange("docs/new.md", "new\n")]
  });
  const trusted = createTestPreviewer(tempRoot);
  const promoted = await trusted.preview({
    repoRoot: tempRoot,
    changeSet,
    facts: safeFacts(changeSet, "feature/safe", "head"),
    policy: policy(["docs/**"]),
    isolation: { ...testIsolation(), scope: "live" },
    now: () => now
  });
  assert.equal(promoted.status, "blocked");
  assert.ok(promoted.reasons.includes("preview_isolation_scope_mismatch"));

  const malformed = await trusted.preview({
    repoRoot: tempRoot,
    changeSet,
    facts: safeFacts(changeSet, "feature/safe", "head"),
    policy: policy(["docs/**"]),
    isolation: {
      ...testIsolation(),
      unexpected: true
    } as never,
    now: () => now
  });
  assert.equal(malformed.status, "blocked");
  assert.ok(malformed.reasons.includes("preview_isolation_attestation_invalid"));
  assert.deepEqual(await readdir(tempRoot), []);
  await rm(tempRoot, { recursive: true, force: true });
});

test("isolated clone preview applies and checks an update without touching the source", async () => {
  const fixture = await createRepositoryFixture();
  const before = await readFile(join(fixture.repoRoot, "docs/guide.md"));
  const after = Buffer.from("new\n", "utf8");
  const changeSet = canonicalizeGovernedFileChangeSet({
    changeSetId: "set-update",
    threadId: "thread",
    turnId: "turn",
    itemId: "item",
    baseHead: fixture.head,
    proposedAt: now,
    sourceSchemaProfile: "fake-v2",
    changes: [{
      path: "docs/guide.md",
      kind: "update",
      unifiedDiff: updateDiff("docs/guide.md", "old", "new"),
      beforeHash: sha256(before),
      afterHash: sha256(after)
    }]
  });
  const previewer = createTestPreviewer(fixture.tempRoot);
  const receipt = await previewer.preview({
    repoRoot: fixture.repoRoot,
    changeSet,
    facts: safeFacts(changeSet, "feature/safe", fixture.head),
    policy: policy(["docs/**"], [{
      argv: [
        process.execPath,
        "-e",
        "const fs=require('node:fs');process.exit(fs.readFileSync('docs/guide.md','utf8')==='new\\n'?0:1)"
      ],
      timeoutMs: 10_000
    }]),
    isolation: testIsolation(),
    now: () => now
  });

  assert.equal(receipt.status, "preview_passed");
  assert.equal(receipt.cleanupStatus, "passed");
  assert.equal(receipt.checks.length, 1);
  assert.equal(receipt.checks[0]?.status, "passed");
  assert.equal(await readFile(join(fixture.repoRoot, "docs/guide.md"), "utf8"), "old\n");
  assert.equal((await git(["status", "--porcelain"], fixture.repoRoot)).trim(), "");
  assert.deepEqual(await readdir(fixture.tempRoot), ["source"]);
  await rm(fixture.tempRoot, { recursive: true, force: true });
});

test("failed checks block acceptance and still clean the isolated clone", async () => {
  const fixture = await createRepositoryFixture();
  const before = await readFile(join(fixture.repoRoot, "docs/guide.md"));
  const changeSet = canonicalizeGovernedFileChangeSet({
    changeSetId: "set-failed-check",
    threadId: "thread",
    turnId: "turn",
    itemId: "item",
    baseHead: fixture.head,
    proposedAt: now,
    sourceSchemaProfile: "fake-v2",
    changes: [{
      path: "docs/guide.md",
      kind: "update",
      unifiedDiff: updateDiff("docs/guide.md", "old", "new"),
      beforeHash: sha256(before),
      afterHash: sha256(Buffer.from("new\n"))
    }]
  });
  const receipt = await createTestPreviewer(fixture.tempRoot).preview({
    repoRoot: fixture.repoRoot,
    changeSet,
    facts: safeFacts(changeSet, "feature/safe", fixture.head),
    policy: policy(["docs/**"], [{
      argv: [process.execPath, "-e", "process.exit(7)"],
      timeoutMs: 10_000
    }]),
    isolation: testIsolation(),
    now: () => now
  });

  assert.equal(receipt.status, "blocked");
  assert.equal(receipt.cleanupStatus, "passed");
  assert.ok(receipt.reasons.includes("preview_check_failed"));
  assert.equal(await readFile(join(fixture.repoRoot, "docs/guide.md"), "utf8"), "old\n");
  assert.equal((await git(["status", "--porcelain"], fixture.repoRoot)).trim(), "");
  assert.deepEqual(await readdir(fixture.tempRoot), ["source"]);
  await rm(fixture.tempRoot, { recursive: true, force: true });
});

test("failed prepare and check-side mutation both block preview", async () => {
  {
    const fixture = await createRepositoryFixture();
    const changeSet = updateFixtureChangeSet(fixture.head);
    const configured = policy(["docs/**"]);
    configured.autoApprovalRules[0]!.prepare = [{
      argv: [process.execPath, "-e", "process.exit(9)"],
      timeoutMs: 10_000
    }];
    const receipt = await createTestPreviewer(fixture.tempRoot).preview({
      repoRoot: fixture.repoRoot,
      changeSet,
      facts: safeFacts(changeSet, "feature/safe", fixture.head),
      policy: configured,
      isolation: testIsolation(),
      now: () => now
    });
    assert.equal(receipt.status, "blocked");
    assert.ok(receipt.reasons.includes("preview_prepare_failed"));
    await rm(fixture.tempRoot, { recursive: true, force: true });
  }
  {
    const fixture = await createRepositoryFixture();
    const changeSet = updateFixtureChangeSet(fixture.head);
    const receipt = await createTestPreviewer(fixture.tempRoot).preview({
      repoRoot: fixture.repoRoot,
      changeSet,
      facts: safeFacts(changeSet, "feature/safe", fixture.head),
      policy: policy(["docs/**"], [{
        argv: [
          process.execPath,
          "-e",
          "require('node:fs').writeFileSync('docs/guide.md','mutated\\n')"
        ],
        timeoutMs: 10_000
      }]),
      isolation: testIsolation(),
      now: () => now
    });
    assert.equal(receipt.status, "blocked");
    assert.ok(
      receipt.reasons.includes("preview_checks_changed_proposed_targets")
      || receipt.reasons.includes("preview_changed_target_set_mismatch")
    );
    assert.equal(await readFile(join(fixture.repoRoot, "docs/guide.md"), "utf8"), "old\n");
    await rm(fixture.tempRoot, { recursive: true, force: true });
  }
});

test("source repository drift signals block before cloning", async () => {
  for (const mode of ["dirty", "branch", "hooks", "filters"] as const) {
    const fixture = await createRepositoryFixture();
    const changeSet = updateFixtureChangeSet(fixture.head);
    let factsBranch = "feature/safe";
    if (mode === "dirty") {
      await writeFile(join(fixture.repoRoot, "outside.txt"), "dirty\n", "utf8");
    } else if (mode === "branch") {
      await git(["branch", "-m", "main"], fixture.repoRoot);
      factsBranch = "feature/safe";
    } else if (mode === "hooks") {
      await git(["config", "core.hooksPath", "custom-hooks"], fixture.repoRoot);
    } else {
      await git(["config", "filter.demo.clean", "node --version"], fixture.repoRoot);
    }
    const receipt = await createTestPreviewer(fixture.tempRoot).preview({
      repoRoot: fixture.repoRoot,
      changeSet,
      facts: safeFacts(changeSet, factsBranch, fixture.head),
      policy: policy(["docs/**"]),
      isolation: testIsolation(),
      now: () => now
    });
    assert.equal(receipt.status, "blocked", mode);
    const expected = {
      dirty: "preview_source_worktree_not_clean",
      branch: "preview_source_branch_mismatch",
      hooks: "preview_source_hooks_path_unsupported",
      filters: "preview_source_filters_unsupported"
    }[mode];
    assert.ok(receipt.reasons.includes(expected), `${mode}:${receipt.reasons.join(",")}`);
    await rm(fixture.tempRoot, { recursive: true, force: true });
  }
});

test("source metadata, target topology, and hash drift fail closed", async () => {
  for (const mode of [
    "head",
    "submodule",
    "create_exists",
    "before_hash",
    "after_hash",
    "symlink"
  ] as const) {
    const fixture = await createRepositoryFixture();
    let head = fixture.head;
    let changeSet: GovernedFileChangeSet;
    let factsHead = head;
    if (mode === "head") {
      factsHead = "f".repeat(40);
      changeSet = updateFixtureChangeSet(factsHead);
    } else if (mode === "submodule") {
      await writeFile(join(fixture.repoRoot, ".gitmodules"), "[submodule \"x\"]\n", "utf8");
      await git(["add", ".gitmodules"], fixture.repoRoot);
      await git(["commit", "-m", "add submodule marker"], fixture.repoRoot);
      head = (await git(["rev-parse", "HEAD"], fixture.repoRoot)).trim();
      factsHead = head;
      changeSet = updateFixtureChangeSet(head);
    } else if (mode === "create_exists") {
      changeSet = canonicalizeGovernedFileChangeSet({
        changeSetId: "create-existing",
        threadId: "thread",
        turnId: "turn",
        itemId: "item",
        baseHead: head,
        proposedAt: now,
        sourceSchemaProfile: "fake-v2",
        changes: [createChange("docs/guide.md", "new\n")]
      });
    } else if (mode === "before_hash") {
      changeSet = updateFixtureChangeSet(head, { beforeHash: "0".repeat(64) });
    } else if (mode === "after_hash") {
      changeSet = updateFixtureChangeSet(head, { afterHash: "0".repeat(64) });
    } else {
      await symlink("guide.md", join(fixture.repoRoot, "docs/link.md"));
      await git(["add", "docs/link.md"], fixture.repoRoot);
      await git(["commit", "-m", "add symlink"], fixture.repoRoot);
      head = (await git(["rev-parse", "HEAD"], fixture.repoRoot)).trim();
      factsHead = head;
      changeSet = canonicalizeGovernedFileChangeSet({
        changeSetId: "symlink-target",
        threadId: "thread",
        turnId: "turn",
        itemId: "item",
        baseHead: head,
        proposedAt: now,
        sourceSchemaProfile: "fake-v2",
        changes: [{
          path: "docs/link.md",
          kind: "update",
          unifiedDiff: updateDiff("docs/link.md", "guide.md", "other.md"),
          beforeHash: sha256(Buffer.from("old\n")),
          afterHash: sha256(Buffer.from("other.md\n"))
        }]
      });
    }
    const receipt = await createTestPreviewer(fixture.tempRoot).preview({
      repoRoot: fixture.repoRoot,
      changeSet,
      facts: safeFacts(changeSet, "feature/safe", factsHead),
      policy: policy(["docs/**"]),
      isolation: testIsolation(),
      now: () => now
    });
    assert.equal(receipt.status, "blocked", mode);
    const marker = {
      head: "preview_source_head_mismatch",
      submodule: "preview_source_submodules_unsupported",
      create_exists: "preview_create_target_exists:docs/guide.md",
      before_hash: "preview_before_hash_mismatch:docs/guide.md",
      after_hash: "preview_after_hash_mismatch:docs/guide.md",
      symlink: "preview_symlink_target_forbidden:docs/link.md"
    }[mode];
    assert.ok(receipt.reasons.includes(marker), `${mode}:${receipt.reasons.join(",")}`);
    await rm(fixture.tempRoot, { recursive: true, force: true });
  }
});

test("spawn preview process runner reports pass, failure, timeout, and spawn errors", async () => {
  const runner = new SpawnPreviewProcessRunner();
  const base = {
    cwd: process.cwd(),
    env: { PATH: process.env.PATH },
    timeoutMs: 5_000
  };
  const passed = await runner.run({
    ...base,
    executable: process.execPath,
    argv: ["-e", "process.stdout.write('ok')"],
    stdin: ""
  });
  assert.equal(passed.status, "passed");

  const failed = await runner.run({
    ...base,
    executable: process.execPath,
    argv: ["-e", "process.stderr.write('no');process.exit(2)"]
  });
  assert.equal(failed.status, "failed");

  const timedOut = await runner.run({
    ...base,
    executable: process.execPath,
    argv: ["-e", "setTimeout(() => {}, 10_000)"],
    timeoutMs: 25
  });
  assert.equal(timedOut.status, "timed_out");

  const spawnFailed = await runner.run({
    ...base,
    executable: "codex-router-command-that-does-not-exist",
    argv: []
  });
  assert.equal(spawnFailed.status, "spawn_failed");
});

function policy(
  allowedPaths: string[],
  checks: PreviewPolicy["autoApprovalRules"][number]["checks"] = [{
    argv: [process.execPath, "-e", "process.exit(0)"],
    timeoutMs: 10_000
  }]
): PreviewPolicy {
  return {
    schemaVersion: "preview-policy.v1",
    autoApprovalRules: [{
      ruleId: "safe-docs",
      allowedPaths,
      operations: ["create", "update"],
      maxFiles: 3,
      maxDiffLines: 20,
      prepare: [],
      checks
    }]
  };
}

function safeFacts(changeSet: GovernedFileChangeSet, branch: string, head: string) {
  return deriveCapabilityFactsFromChangeSet(changeSet, {
    repository: {
      branch,
      protectedBranch: false,
      worktreeClean: true,
      headCommit: head,
      expectedHead: head
    },
    networkAccess: "none",
    credentialAccess: "none",
    exactTargets: true
  });
}

function updateFixtureChangeSet(
  head: string,
  hashes: { beforeHash?: string; afterHash?: string } = {}
): GovernedFileChangeSet {
  return canonicalizeGovernedFileChangeSet({
    changeSetId: `fixture-update-${head.slice(0, 8)}`,
    threadId: "thread",
    turnId: "turn",
    itemId: "item",
    baseHead: head,
    proposedAt: now,
    sourceSchemaProfile: "fake-v2",
    changes: [{
      path: "docs/guide.md",
      kind: "update",
      unifiedDiff: updateDiff("docs/guide.md", "old", "new"),
      beforeHash: hashes.beforeHash ?? sha256(Buffer.from("old\n")),
      afterHash: hashes.afterHash ?? sha256(Buffer.from("new\n"))
    }]
  });
}

function testIsolation() {
  return {
    networkIsolation: "enforced_none" as const,
    filesystemIsolation: "clone_only_enforced" as const,
    scope: "test_only" as const,
    enforcerId: "disposable-test-harness"
  };
}

function createTestPreviewer(tempRoot: string): LocalClonePreviewer {
  return createTestOnlyLocalClonePreviewer({ tempRoot });
}

function createChange(path: string, content: string, newline = "\n") {
  const lines = [
    `diff --git a/${path} b/${path}`,
    "new file mode 100644",
    "--- /dev/null",
    `+++ b/${path}`,
    "@@ -0,0 +1 @@",
    `+${content.replace(/\n$/, "")}`,
    ""
  ];
  return {
    path,
    kind: "create" as const,
    unifiedDiff: lines.join(newline),
    beforeHash: null,
    afterHash: sha256(Buffer.from(content, "utf8"))
  };
}

function updateDiff(path: string, before: string, after: string): string {
  return [
    `diff --git a/${path} b/${path}`,
    `--- a/${path}`,
    `+++ b/${path}`,
    "@@ -1 +1 @@",
    `-${before}`,
    `+${after}`,
    ""
  ].join("\n");
}

function deleteDiff(path: string, content: string): string {
  return [
    `diff --git a/${path} b/${path}`,
    `--- a/${path}`,
    "+++ /dev/null",
    "@@ -1 +0,0 @@",
    `-${content}`,
    ""
  ].join("\n");
}

function renameDiff(oldPath: string, newPath: string, content: string): string {
  return [
    `diff --git a/${oldPath} b/${newPath}`,
    `--- a/${oldPath}`,
    `+++ b/${newPath}`,
    "@@ -1 +1 @@",
    `-${content}`,
    `+${content}`,
    ""
  ].join("\n");
}

async function createRepositoryFixture() {
  const tempRoot = await mkdtemp(join(tmpdir(), "preview-fixture-"));
  const repoRoot = join(tempRoot, "source");
  await mkdir(join(repoRoot, "docs"), { recursive: true });
  await git(["init"], repoRoot);
  await git(["config", "user.email", "preview@example.invalid"], repoRoot);
  await git(["config", "user.name", "Preview Fixture"], repoRoot);
  await writeFile(join(repoRoot, "docs/guide.md"), "old\n", "utf8");
  await git(["add", "."], repoRoot);
  await git(["commit", "-m", "initial"], repoRoot);
  await git(["switch", "-c", "feature/safe"], repoRoot);
  const head = (await git(["rev-parse", "HEAD"], repoRoot)).trim();
  return { tempRoot, repoRoot, head };
}

async function git(argv: string[], cwd: string): Promise<string> {
  await mkdir(dirname(cwd), { recursive: true });
  const { stdout } = await execFileAsync("git", argv, {
    cwd,
    encoding: "utf8",
    windowsHide: true
  });
  return stdout;
}

function sha256(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}
