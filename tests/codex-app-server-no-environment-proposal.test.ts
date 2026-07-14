import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import {
  NO_ENVIRONMENT_PROPOSAL_CONTRACT_VERSION,
  NO_ENVIRONMENT_PROPOSAL_SCHEMA_VERSION,
  NoEnvironmentProposedPatchSchema,
  NoEnvironmentProposalContractSchema,
  NoEnvironmentProposalEventGate,
  createInMemoryNoEnvironmentProposalReplayStore,
  createNoEnvironmentProposalContract,
  verifyNoEnvironmentProposalInIndependentClone,
  type NoEnvironmentProposedPatch
} from "../packages/codex-adapter/src/no-environment-proposal.js";

const execFileAsync = promisify(execFile);
const TRANSCRIPT_NONCE = "0123456789abcdef0123456789abcdef";
const eventSequences = new WeakMap<NoEnvironmentProposalEventGate, number>();

test("no-environment contract fixes empty environments, text-only input, output schema, and tool prohibitions", () => {
  const contract = contractFor("hello\n");
  assert.equal(contract.schemaVersion, NO_ENVIRONMENT_PROPOSAL_CONTRACT_VERSION);
  assert.deepEqual(contract.threadStart.params.environments, []);
  assert.deepEqual(contract.threadStart.params.dynamicTools, []);
  assert.equal(contract.threadStart.params.sandbox, "readOnly");
  assert.equal(contract.threadStart.params.approvalPolicy, "never");
  assert.deepEqual(contract.turnStart.params.environments, []);
  assert.equal(contract.turnStart.params.permissions, ":read-only");
  assert.equal(contract.turnStart.params.input.length, 1);
  assert.equal(contract.turnStart.params.input[0].type, "text");
  assert.equal(contract.turnStart.params.outputSchema.properties.schemaVersion.const,
    NO_ENVIRONMENT_PROPOSAL_SCHEMA_VERSION);
  assert.deepEqual(Object.values(contract.prohibitedToolSurfaces), Array(8).fill(true));
  assert.deepEqual(contract.runtimeBinding, {
    effectiveToolInventoryMechanicallyBound: false,
    liveExecutionAuthorized: false,
    realWorkspaceWriteAuthorized: false
  });
});

test("no-environment contract rejects environment inheritance, alternate inputs, tools, and prompt drift", () => {
  const base = contractFor("hello\n");
  const cases: unknown[] = [
    { ...base, threadStart: { ...base.threadStart, params: {
      ...base.threadStart.params, environments: undefined
    } } },
    { ...base, turnStart: { ...base.turnStart, params: {
      ...base.turnStart.params, environments: [{ environmentId: "local", cwd: "/tmp" }]
    } } },
    { ...base, turnStart: { ...base.turnStart, params: {
      ...base.turnStart.params,
      input: [{ type: "localImage", path: "/tmp/image.png" }]
    } } },
    { ...base, turnStart: { ...base.turnStart, params: {
      ...base.turnStart.params,
      input: [{ type: "skill", name: "unsafe", path: "/tmp/SKILL.md" }]
    } } },
    { ...base, threadStart: { ...base.threadStart, params: {
      ...base.threadStart.params,
      dynamicTools: [{ name: "write", description: "write", inputSchema: {} }]
    } } },
    { ...base, prohibitedToolSurfaces: { ...base.prohibitedToolSurfaces, mcp: false } },
    { ...base, runtimeBinding: { ...base.runtimeBinding, liveExecutionAuthorized: true } },
    { ...base, turnStart: { ...base.turnStart, params: {
      ...base.turnStart.params,
      input: [{ type: "text", text: "{}" }]
    } } }
  ];
  for (const candidate of cases) {
    assert.equal(NoEnvironmentProposalContractSchema.safeParse(candidate).success, false);
  }
});

test("no-environment contract binds the complete canonical prompt bytes to its target", () => {
  const base = contractFor("hello\n");
  const canonicalText = base.turnStart.params.input[0].text;
  const payload = JSON.parse(canonicalText) as Record<string, unknown>;
  const driftedTexts = [
    JSON.stringify({ ...payload, task: "Return a different task." }),
    JSON.stringify({ ...payload, schemaVersion: "different-schema.v1" }),
    JSON.stringify({ ...payload, baseContentBase64: Buffer.from("different\n").toString("base64") }),
    JSON.stringify({ ...payload, extra: true }),
    JSON.stringify(payload, null, 2)
  ];

  for (const text of driftedTexts) {
    const candidate = {
      ...base,
      turnStart: {
        ...base.turnStart,
        params: {
          ...base.turnStart.params,
          input: [{ type: "text", text }]
        }
      }
    };
    assert.equal(NoEnvironmentProposalContractSchema.safeParse(candidate).success, false, text);
  }
  assert.equal(NoEnvironmentProposalContractSchema.safeParse(base).success, true);
});

test("no-environment contract rejects sensitive source content and credential-like proposed diffs", () => {
  for (const content of [
    "PASSWORD=hunter2\n",
    "access_token: abc123\n",
    "client_secret = private\n",
    "TOKEN=abc123\n",
    "REFRESH_TOKEN=abc123\n",
    "SECRET=abc123\n",
    "PRIVATE_KEY=abc123\n",
    "-----BEGIN PRIVATE KEY-----\n"
  ]) {
    assert.throws(() => contractFor(content), /no_environment_proposal_source_content_sensitive/u);
  }
  assert.equal(NoEnvironmentProposedPatchSchema.safeParse({
    ...proposalFor("hello\n", "SECRET_KEY=abc123\n"),
    unifiedDiff: diff("docs/guide.md", "hello", "SECRET_KEY=abc123")
  }).success, false);
  for (const targetPath of [".GIT/config", "docs/guide.md.", "docs/guide.md "]) {
    assert.equal(NoEnvironmentProposedPatchSchema.safeParse({
      ...proposalFor("hello\n", "hello governed\n"),
      targetPath
    }).success, false, targetPath);
  }
});

test("event gate accepts only agent-message lifecycle and binds the final proposal", () => {
  const source = "hello\n";
  const contract = contractFor(source);
  const proposal = proposalFor(source, "hello governed\n");
  const gate = gateFor(contract);
  assert.equal(observe(gate, {
    method: "turn/started",
    params: { threadId: "thread-no-environment", turn: exactTurn("turn", "inProgress") }
  }).status, "pending");
  assert.equal(observe(gate, {
    method: "item/started",
    params: {
      threadId: "thread-no-environment",
      turnId: "turn",
      item: exactAgentMessage("message", ""),
      startedAtMs: 1
    }
  }).status, "pending");
  assert.equal(observe(gate, {
    method: "item/agentMessage/delta",
    params: { threadId: "thread-no-environment", turnId: "turn", itemId: "message", delta: "{" }
  }).status, "pending");
  assert.equal(observe(gate, {
    method: "item/completed",
    params: {
      threadId: "thread-no-environment",
      turnId: "turn",
      item: exactAgentMessage("message", JSON.stringify(proposal)),
      completedAtMs: 2
    }
  }).status, "pending");
  const outcome = observe(gate, {
    method: "turn/completed",
    params: {
      threadId: "thread-no-environment",
      turn: exactTurn("turn", "completed")
    }
  });
  assert.equal(outcome.status, "proposal_complete");
  assert.deepEqual(outcome.proposal, proposal);
  assert.equal(outcome.liveSmokeEligible, false);
  assert.equal(outcome.realWorkspaceWriteAuthorized, false);
});

test("event gate fails closed on every tool, approval, file, command, and external event family", () => {
  const methods = [
    "item/fileChange/requestApproval",
    "item/fileChange/patchUpdated",
    "item/commandExecution/requestApproval",
    "item/permissions/requestApproval",
    "mcpServer/elicitation/request",
    "item/mcpToolCall/progress",
    "web/search",
    "item/tool/call",
    "collabToolCall/started",
    "provider/request",
    "process/spawn",
    "thread/shellCommand"
  ];
  for (const method of methods) {
    const gate = gateFor(contractFor("hello\n"));
    const outcome = observe(gate, { method, params: {} });
    assert.equal(outcome.status, "blocked", method);
    assert.deepEqual(outcome.reasons, ["no_environment_prohibited_event_observed"], method);
  }
});

test("event gate rejects non-agent items, malformed or rebound proposals, duplicates, and failed turns", () => {
  const source = "hello\n";
  const rejected = [
    { method: "item/started", params: { item: { type: "reasoning", id: "r" } } },
    { method: "item/completed", params: { item: { type: "agentMessage", id: "m", text: "not-json" } } },
    { method: "item/completed", params: { item: { type: "agentMessage", id: "m", text: JSON.stringify({
      ...proposalFor(source, "next\n"), targetPath: "docs/other.md"
    }) } } },
    { method: "turn/completed", params: { turn: { status: "failed" } } }
  ];
  for (const event of rejected) {
    const rejectedGate = gateFor(contractFor(source));
    assert.equal(observe(rejectedGate, event).status, "blocked");
  }
  const gate = gateFor(contractFor(source));
  assert.equal(observe(gate, {
    method: "turn/started",
    params: { threadId: "thread-no-environment", turn: exactTurn("turn", "inProgress") }
  }).status, "pending");
  assert.equal(observe(gate, {
    method: "item/started",
    params: {
      threadId: "thread-no-environment",
      turnId: "turn",
      item: exactAgentMessage("m", ""),
      startedAtMs: 1
    }
  }).status, "pending");
  const completed = {
    method: "item/completed",
    params: {
      threadId: "thread-no-environment",
      turnId: "turn",
      item: exactAgentMessage("m", JSON.stringify(proposalFor(source, "next\n"))),
      completedAtMs: 2
    }
  };
  assert.equal(observe(gate, completed).status, "pending");
  assert.deepEqual(observe(gate, completed).reasons, ["no_environment_duplicate_final_agent_message"]);
});

test("event gate rejects thread, turn, item, and lifecycle correlation drift", () => {
  const contract = contractFor("hello\n");
  const wrongThread = gateFor(contract);
  assert.deepEqual(observe(wrongThread, {
    method: "turn/started",
    params: { threadId: "other", turn: exactTurn("turn", "inProgress") }
  }).reasons, ["no_environment_turn_start_correlation_failed"]);

  const wrongTurn = gateFor(contract);
  assert.equal(observe(wrongTurn, {
    method: "turn/started",
    params: { threadId: "thread-no-environment", turn: exactTurn("turn", "inProgress") }
  }).status, "pending");
  assert.deepEqual(observe(wrongTurn, {
    method: "item/started",
    params: {
      threadId: "thread-no-environment",
      turnId: "other",
      item: exactAgentMessage("message", ""),
      startedAtMs: 1
    }
  }).reasons, ["no_environment_event_correlation_failed"]);

  const missingStart = gateFor(contract);
  assert.deepEqual(observe(missingStart, {
    method: "item/completed",
    params: {
      threadId: "thread-no-environment",
      turnId: "turn",
      item: { type: "agentMessage", id: "message", text: "{}" }
    }
  }).reasons, ["no_environment_final_agent_message_order_invalid"]);
});

test("event gate enforces exact 0.144.1 fields, transcript ordering, replay consumption, and immutable bindings", () => {
  const contract = contractFor("hello\n");
  const replayStore = createInMemoryNoEnvironmentProposalReplayStore();
  const gate = gateFor(contract, replayStore);
  contract.turnStart.params.threadId = "mutated-after-construction";
  assert.equal(observe(gate, {
    method: "turn/started",
    params: { threadId: "thread-no-environment", turn: exactTurn("turn", "inProgress") }
  }).status, "pending");
  assert.deepEqual(observe(gate, {
    method: "item/started",
    params: {
      threadId: "thread-no-environment",
      turnId: "turn",
      item: exactAgentMessage("message", "")
    }
  }).reasons, ["no_environment_exact_event_schema_invalid"]);

  const wrongSequence = gateFor(contractFor("hello\n"));
  assert.deepEqual(wrongSequence.ingest({ method: "turn/started", params: {} }, {
    transcriptNonce: TRANSCRIPT_NONCE,
    sequence: 1
  }).reasons, ["no_environment_transcript_binding_invalid"]);

  const first = gateFor(contractFor("hello\n"), replayStore);
  assert.deepEqual(first.ingest({ method: "turn/started", params: {} }, {
    transcriptNonce: TRANSCRIPT_NONCE,
    sequence: 0
  }).reasons, ["no_environment_transcript_replay"]);

  for (const invalidTurn of [
    { ...exactTurn("turn", "inProgress"), error: "synthetic" },
    { ...exactTurn("turn", "inProgress"), startedAt: 1.5 }
  ]) {
    const strictGate = gateFor(contractFor("hello\n"));
    assert.deepEqual(observe(strictGate, {
      method: "turn/started",
      params: { threadId: "thread-no-environment", turn: invalidTurn }
    }).reasons, ["no_environment_exact_event_schema_invalid"]);
  }

  const citationGate = gateFor(contractFor("hello\n"));
  assert.equal(observe(citationGate, {
    method: "turn/started",
    params: { threadId: "thread-no-environment", turn: exactTurn("turn", "inProgress") }
  }).status, "pending");
  assert.deepEqual(observe(citationGate, {
    method: "item/started",
    params: {
      threadId: "thread-no-environment",
      turnId: "turn",
      startedAtMs: 1,
      item: {
        ...exactAgentMessage("message", ""),
        memoryCitation: { entries: [], threadIds: [] }
      }
    }
  }).reasons, ["no_environment_exact_event_schema_invalid"]);
});

test("offline verification applies the proposal only in an independent clone and preserves source hashes", async () => {
  const fixture = await createRepo("hello\n");
  try {
    const before = await readFile(join(fixture.repoRoot, "docs/guide.md"), "utf8");
    const receipt = await verifyNoEnvironmentProposalInIndependentClone({
      sourceRepo: fixture.repoRoot,
      expectedHead: fixture.head,
      proposal: proposalFor("hello\n", "hello governed\n"),
      tempRoot: fixture.tempRoot
    });
    assert.deepEqual(receipt, {
      schemaVersion: "codex-app-server-no-environment-offline-verification.v1",
      status: "verified",
      sourceHead: fixture.head,
      targetPath: "docs/guide.md",
      baseSha256: sha256("hello\n"),
      afterSha256: sha256("hello governed\n"),
      independentCloneUsed: true,
      sourceWorkspaceUnchanged: true,
      cleanupStatus: "passed",
      liveSmokeEligible: false,
      realWorkspaceWriteAuthorized: false,
      reasons: []
    });
    assert.equal(await readFile(join(fixture.repoRoot, "docs/guide.md"), "utf8"), before);
    assert.equal((await git(fixture.repoRoot, ["status", "--porcelain=v1", "-z"])), "");
  } finally {
    await rm(fixture.tempRoot, { recursive: true, force: true });
  }
});

test("offline verification rejects target expansion, base drift, filters, attributes, and dirty sources", async () => {
  const scenarios: Array<{
    prepare?: (fixture: RepoFixture) => Promise<void>;
    proposal?: NoEnvironmentProposedPatch;
    reason: string;
  }> = [
    {
      proposal: {
        ...proposalFor("hello\n", "hello governed\n"),
        unifiedDiff: `${diff("docs/guide.md", "hello", "hello governed")}\n${diff("docs/other.md", "other", "changed")}`
      },
      reason: "offline_patch_apply_failed"
    },
    {
      proposal: {
        ...proposalFor("hello\n", "hello governed\n"),
        unifiedDiff: newFileDiff("docs/new.md", "new")
      },
      reason: "offline_proposal_invalid"
    },
    {
      proposal: proposalFor("different\n", "changed\n"),
      reason: "offline_proposal_base_hash_mismatch"
    },
    {
      prepare: async (fixture) => { await git(fixture.repoRoot, ["config", "filter.hostile.smudge", "touch should-not-run"]); },
      reason: "offline_source_git_filters_forbidden"
    },
    {
      prepare: async (fixture) => { await git(fixture.repoRoot, ["config", "extensions.partialClone", "origin"]); },
      reason: "offline_source_partial_clone_forbidden"
    },
    {
      prepare: async (fixture) => {
        await writeFile(join(fixture.repoRoot, ".GITATTRIBUTES"), "*.md filter=hostile\n");
      },
      reason: "offline_source_worktree_git_attributes_forbidden"
    },
    {
      prepare: async (fixture) => {
        await writeFile(join(fixture.repoRoot, ".gitattributes"), "*.md filter=hostile\n");
        await git(fixture.repoRoot, ["add", ".gitattributes"]);
        await git(fixture.repoRoot, ["commit", "-m", "attributes"]);
        fixture.head = (await git(fixture.repoRoot, ["rev-parse", "HEAD"])).trim();
      },
      reason: "offline_source_git_attributes_forbidden"
    },
    {
      prepare: async (fixture) => { await writeFile(join(fixture.repoRoot, "untracked.txt"), "dirty\n"); },
      reason: "offline_source_worktree_not_clean"
    }
  ];
  for (const scenario of scenarios) {
    const fixture = await createRepo("hello\n", true);
    try {
      await scenario.prepare?.(fixture);
      const receipt = await verifyNoEnvironmentProposalInIndependentClone({
        sourceRepo: fixture.repoRoot,
        expectedHead: fixture.head,
        proposal: scenario.proposal ?? proposalFor("hello\n", "hello governed\n"),
        tempRoot: fixture.tempRoot
      });
      assert.equal(receipt.status, "blocked", scenario.reason);
      assert.ok(receipt.reasons.includes(scenario.reason), JSON.stringify(receipt));
      assert.equal(receipt.liveSmokeEligible, false);
      assert.equal(receipt.realWorkspaceWriteAuthorized, false);
    } finally {
      await rm(fixture.tempRoot, { recursive: true, force: true });
    }
  }
});

test("offline source preflight rejects direct/included hooks before any sentinel executes", async () => {
  for (const kind of ["fsmonitor", "filter", "include-filter", "uploadpack"] as const) {
    const fixture = await createRepo("hello\n");
    const marker = join(fixture.tempRoot, `${kind}-executed`);
    try {
      const hook = await writeSentinelHook(fixture.tempRoot, kind, marker);
      if (kind === "fsmonitor") {
        await git(fixture.repoRoot, ["config", "core.fsmonitor", hook]);
      } else if (kind === "filter") {
        await git(fixture.repoRoot, ["config", "filter.hostile.clean", hook]);
        await writeFile(join(fixture.repoRoot, ".gitattributes"), "*.md filter=hostile\n");
      } else if (kind === "include-filter") {
        const includedConfig = join(fixture.tempRoot, "included-filter.config");
        await git(fixture.repoRoot, ["config", "--file", includedConfig, "filter.hostile.clean", hook]);
        await git(fixture.repoRoot, ["config", "--add", "include.path", includedConfig]);
        await writeFile(join(fixture.repoRoot, ".gitattributes"), "*.md filter=hostile\n");
      } else {
        await git(fixture.repoRoot, ["config", "uploadpack.packObjectsHook", hook]);
      }
      await rm(marker, { force: true });

      const receipt = await verifyNoEnvironmentProposalInIndependentClone({
        sourceRepo: fixture.repoRoot,
        expectedHead: fixture.head,
        proposal: proposalFor("hello\n", "hello governed\n"),
        tempRoot: fixture.tempRoot
      });
      assert.equal(receipt.status, "blocked");
      const expectedReason = kind === "fsmonitor"
        ? "offline_source_git_fsmonitor_forbidden"
        : kind === "include-filter"
          ? "offline_source_git_includes_forbidden"
          : kind === "filter"
          ? "offline_source_git_filters_forbidden"
          : "offline_source_upload_pack_hook_forbidden";
      assert.ok(receipt.reasons.includes(expectedReason), JSON.stringify(receipt));
      assert.equal(await fileExists(marker), false, `${kind} sentinel executed during preflight`);
    } finally {
      await rm(fixture.tempRoot, { recursive: true, force: true });
    }
  }
});

test("offline source preflight rejects unsafe target and Git redirection before following them", async () => {
  const scenarios: Array<{
    name: string;
    prepare: (fixture: RepoFixture) => Promise<void>;
    reason: string;
  }> = [
    {
      name: "target parent symlink",
      prepare: async (fixture) => {
        const outside = join(fixture.tempRoot, "outside-target");
        await mkdir(outside);
        await rm(join(fixture.repoRoot, "docs"), { recursive: true, force: true });
        await symlink(
          outside,
          join(fixture.repoRoot, "docs"),
          process.platform === "win32" ? "junction" : "dir"
        );
      },
      reason: "offline_source_target_topology_unsafe"
    },
    {
      name: "core.worktree",
      prepare: async (fixture) => {
        const outside = join(fixture.tempRoot, "outside-worktree");
        await mkdir(outside);
        await git(fixture.repoRoot, ["config", "core.worktree", outside]);
      },
      reason: "offline_source_git_worktree_redirection_forbidden"
    },
    {
      name: "include.path",
      prepare: async (fixture) => {
        const malformed = join(fixture.tempRoot, "must-not-be-read.config");
        await writeFile(malformed, "this is not valid git config\n");
        await git(fixture.repoRoot, ["config", "--add", "include.path", malformed]);
      },
      reason: "offline_source_git_includes_forbidden"
    },
    {
      name: "config.worktree",
      prepare: async (fixture) => {
        await writeFile(
          join(fixture.repoRoot, ".git/config.worktree"),
          `[core]\n\tworktree = ${join(fixture.tempRoot, "outside-config-worktree")}\n`
        );
      },
      reason: "offline_source_worktree_config_forbidden"
    },
    {
      name: "commondir",
      prepare: async (fixture) => {
        await writeFile(join(fixture.repoRoot, ".git/commondir"), "../outside-common-git\n");
      },
      reason: "offline_source_git_commondir_forbidden"
    }
  ];
  for (const scenario of scenarios) {
    const fixture = await createRepo("hello\n");
    try {
      await scenario.prepare(fixture);
      const receipt = await verifyNoEnvironmentProposalInIndependentClone({
        sourceRepo: fixture.repoRoot,
        expectedHead: fixture.head,
        proposal: proposalFor("hello\n", "hello governed\n"),
        tempRoot: fixture.tempRoot
      });
      assert.equal(receipt.status, "blocked", scenario.name);
      assert.ok(receipt.reasons.includes(scenario.reason), `${scenario.name}: ${JSON.stringify(receipt)}`);
      assert.equal(receipt.reasons.includes("offline_source_preflight_failed"), false, scenario.name);
    } finally {
      await rm(fixture.tempRoot, { recursive: true, force: true });
    }
  }
});

test("identity-bound source reads reject target and config replacement before reading content", async () => {
  for (const kind of ["target", "config"] as const) {
    const fixture = await createRepo("hello\n");
    const identityReads: string[] = [];
    try {
      const receipt = await verifyNoEnvironmentProposalInIndependentClone({
        sourceRepo: fixture.repoRoot,
        expectedHead: fixture.head,
        proposal: proposalFor("hello\n", "hello governed\n"),
        tempRoot: fixture.tempRoot,
        testOnlyHooks: {
          afterInitialSourceBindingsCaptured: async () => {
            if (kind === "target") {
              const outside = join(fixture.tempRoot, "race-target");
              await mkdir(outside);
              await writeFile(join(outside, "guide.md"), "must not be read\n");
              await rm(join(fixture.repoRoot, "docs"), { recursive: true, force: true });
              await symlink(
                outside,
                join(fixture.repoRoot, "docs"),
                process.platform === "win32" ? "junction" : "dir"
              );
              return;
            }
            const originalGit = join(fixture.tempRoot, "original-git");
            const outsideGit = join(fixture.tempRoot, "race-git");
            await rename(join(fixture.repoRoot, ".git"), originalGit);
            await mkdir(outsideGit);
            await writeFile(join(outsideGit, "config"), "[include]\n\tpath = /must-not-be-read\n");
            await symlink(
              outsideGit,
              join(fixture.repoRoot, ".git"),
              process.platform === "win32" ? "junction" : "dir"
            );
          },
          onIdentityBoundRead: (path) => identityReads.push(path)
        }
      });
      assert.equal(receipt.status, "blocked", `${kind}: ${JSON.stringify(receipt)}`);
      const forbiddenSuffix = kind === "target" ? "docs/guide.md" : ".git/config";
      assert.equal(
        identityReads.some((path) => path.replaceAll("\\", "/").endsWith(forbiddenSuffix)),
        false,
        `${kind} replacement reached content read: ${JSON.stringify(identityReads)}`
      );
    } finally {
      await rm(fixture.tempRoot, { recursive: true, force: true });
    }
  }
});

test("config replacement after its bound read cannot execute a new upload-pack hook", async () => {
  const fixture = await createRepo("hello\n");
  const marker = join(fixture.tempRoot, "post-config-read-uploadpack-executed");
  let replaced = false;
  try {
    const hook = await writeSentinelHook(fixture.tempRoot, "post-config-read-uploadpack", marker);
    const replacement = join(fixture.tempRoot, "replacement.config");
    await writeFile(replacement, await readFile(join(fixture.repoRoot, ".git/config")));
    await git(fixture.repoRoot, ["config", "--file", replacement, "uploadpack.packObjectsHook", hook]);
    await rm(marker, { force: true });

    const receipt = await verifyNoEnvironmentProposalInIndependentClone({
      sourceRepo: fixture.repoRoot,
      expectedHead: fixture.head,
      proposal: proposalFor("hello\n", "hello governed\n"),
      tempRoot: fixture.tempRoot,
      testOnlyHooks: {
        afterLocalConfigRead: async () => {
          if (replaced) return;
          replaced = true;
          await rename(replacement, join(fixture.repoRoot, ".git/config"));
        }
      }
    });

    assert.equal(replaced, true);
    assert.equal(receipt.status, "blocked", JSON.stringify(receipt));
    assert.equal(receipt.sourceWorkspaceUnchanged, false, JSON.stringify(receipt));
    assert.equal(await fileExists(marker), false, "replacement upload-pack hook executed");
  } finally {
    await rm(fixture.tempRoot, { recursive: true, force: true });
  }
});

test("post-config filter and info-attributes replacement cannot execute during source status", async () => {
  const fixture = await createRepo("hello\n");
  const marker = join(fixture.tempRoot, "post-config-read-filter-executed");
  let replaced = false;
  try {
    const filter = await writeSentinelHook(fixture.tempRoot, "post-config-read-filter", marker);
    const replacement = join(fixture.tempRoot, "replacement-filter.config");
    await writeFile(replacement, await readFile(join(fixture.repoRoot, ".git/config")));
    await git(fixture.repoRoot, ["config", "--file", replacement, "filter.hostile.clean", filter]);
    await rm(marker, { force: true });

    const receipt = await verifyNoEnvironmentProposalInIndependentClone({
      sourceRepo: fixture.repoRoot,
      expectedHead: fixture.head,
      proposal: proposalFor("hello\n", "hello governed\n"),
      tempRoot: fixture.tempRoot,
      testOnlyHooks: {
        afterLocalConfigRead: async () => {
          if (replaced) return;
          replaced = true;
          await rename(replacement, join(fixture.repoRoot, ".git/config"));
          await writeFile(join(fixture.repoRoot, ".git/info/attributes"), "*.md filter=hostile\n");
        }
      }
    });

    assert.equal(replaced, true);
    assert.equal(receipt.status, "blocked", JSON.stringify(receipt));
    assert.equal(receipt.sourceWorkspaceUnchanged, false, JSON.stringify(receipt));
    assert.equal(await fileExists(marker), false, "replacement clean filter executed");
  } finally {
    await rm(fixture.tempRoot, { recursive: true, force: true });
  }
});

test("offline source preflight rejects gitlinks even when .gitmodules is absent", async () => {
  const fixture = await createRepo("hello\n");
  try {
    await git(fixture.repoRoot, [
      "update-index",
      "--add",
      "--cacheinfo",
      `160000,${fixture.head},vendor/dependency`
    ]);
    await git(fixture.repoRoot, ["commit", "-m", "synthetic gitlink without metadata"]);
    fixture.head = (await git(fixture.repoRoot, ["rev-parse", "HEAD"])).trim();
    assert.equal(await fileExists(join(fixture.repoRoot, ".gitmodules")), false);

    const receipt = await verifyNoEnvironmentProposalInIndependentClone({
      sourceRepo: fixture.repoRoot,
      expectedHead: fixture.head,
      proposal: proposalFor("hello\n", "hello governed\n"),
      tempRoot: fixture.tempRoot
    });
    assert.equal(receipt.status, "blocked", JSON.stringify(receipt));
    assert.ok(receipt.reasons.includes("offline_source_submodules_forbidden"), JSON.stringify(receipt));
  } finally {
    await rm(fixture.tempRoot, { recursive: true, force: true });
  }
});

test("offline source preflight rejects staged gitlinks and stale expected HEAD before status", async () => {
  for (const kind of ["staged", "head-mismatch"] as const) {
    const fixture = await createRepo("hello\n");
    const expectedHead = fixture.head;
    try {
      await git(fixture.repoRoot, [
        "update-index",
        "--add",
        "--cacheinfo",
        `160000,${fixture.head},vendor/dependency`
      ]);
      if (kind === "head-mismatch") {
        await git(fixture.repoRoot, ["commit", "-m", "advance HEAD with synthetic gitlink"]);
      }
      const receipt = await verifyNoEnvironmentProposalInIndependentClone({
        sourceRepo: fixture.repoRoot,
        expectedHead,
        proposal: proposalFor("hello\n", "hello governed\n"),
        tempRoot: fixture.tempRoot
      });
      const expectedReason = kind === "staged"
        ? "offline_source_submodules_forbidden"
        : "offline_source_head_mismatch";
      assert.equal(receipt.status, "blocked", `${kind}: ${JSON.stringify(receipt)}`);
      assert.ok(receipt.reasons.includes(expectedReason), `${kind}: ${JSON.stringify(receipt)}`);
    } finally {
      await rm(fixture.tempRoot, { recursive: true, force: true });
    }
  }
});

test("offline verification rejects ignored extra paths, mode changes, and source-contained temp roots", async () => {
  const scenarios: Array<{
    prepare?: (fixture: RepoFixture) => Promise<void>;
    proposal: NoEnvironmentProposedPatch;
    tempRoot?: (fixture: RepoFixture) => string;
    reason: string;
  }> = [
    {
      prepare: async (fixture) => {
        await writeFile(join(fixture.repoRoot, ".gitignore"), "ignored.local\n");
        await git(fixture.repoRoot, ["add", ".gitignore"]);
        await git(fixture.repoRoot, ["commit", "-m", "ignore local artifact"]);
        fixture.head = (await git(fixture.repoRoot, ["rev-parse", "HEAD"])).trim();
        await writeFile(join(fixture.repoRoot, "ignored.local"), "local-only fixture\n");
      },
      proposal: proposalFor("hello\n", "hello governed\n"),
      reason: "offline_source_worktree_not_clean"
    },
    {
      prepare: async (fixture) => {
        await mkdir(join(fixture.repoRoot, "scratch"));
        await writeFile(join(fixture.repoRoot, "scratch/.keep"), "tracked\n");
        await writeFile(join(fixture.repoRoot, ".gitignore"), "scratch/payload\n");
        await git(fixture.repoRoot, ["add", ".gitignore", "scratch/.keep"]);
        await git(fixture.repoRoot, ["commit", "-m", "ignore scratch"]);
        fixture.head = (await git(fixture.repoRoot, ["rev-parse", "HEAD"])).trim();
      },
      proposal: {
        ...proposalFor("hello\n", "hello governed\n"),
        unifiedDiff: `${diff("docs/guide.md", "hello", "hello governed")}${newFileDiff("scratch/payload", "hidden")}`
      },
      reason: "offline_proposal_invalid"
    },
    {
      proposal: {
        ...proposalFor("hello\n", "hello governed\n"),
        unifiedDiff: modeChangeDiff("docs/guide.md", "hello", "hello governed")
      },
      reason: "offline_proposal_invalid"
    },
    {
      proposal: proposalFor("hello\n", "hello governed\n"),
      tempRoot: (fixture) => join(fixture.repoRoot, ".git"),
      reason: "offline_temp_root_unsafe"
    }
  ];
  for (const scenario of scenarios) {
    const fixture = await createRepo("hello\n");
    try {
      await scenario.prepare?.(fixture);
      const receipt = await verifyNoEnvironmentProposalInIndependentClone({
        sourceRepo: fixture.repoRoot,
        expectedHead: fixture.head,
        proposal: scenario.proposal,
        tempRoot: scenario.tempRoot?.(fixture) ?? fixture.tempRoot
      });
      assert.equal(receipt.status, "blocked", JSON.stringify(receipt));
      assert.ok(receipt.reasons.includes(scenario.reason), JSON.stringify(receipt));
    } finally {
      await rm(fixture.tempRoot, { recursive: true, force: true });
    }
  }
});

type RepoFixture = { tempRoot: string; repoRoot: string; head: string };

async function createRepo(content: string, withOther = false): Promise<RepoFixture> {
  const tempRoot = await mkdtemp(join(tmpdir(), "codex-router-no-env-test-"));
  const repoRoot = join(tempRoot, "source");
  await mkdir(join(repoRoot, "docs"), { recursive: true });
  await writeFile(join(repoRoot, "docs/guide.md"), content);
  if (withOther) await writeFile(join(repoRoot, "docs/other.md"), "other\n");
  await git(repoRoot, ["init", "-b", "feature/no-environment"]);
  await git(repoRoot, ["config", "user.email", "test@example.com"]);
  await git(repoRoot, ["config", "user.name", "Test"]);
  await git(repoRoot, ["add", "."]);
  await git(repoRoot, ["commit", "-m", "initial"]);
  return { tempRoot, repoRoot, head: (await git(repoRoot, ["rev-parse", "HEAD"])).trim() };
}

async function writeSentinelHook(root: string, name: string, marker: string): Promise<string> {
  const hook = join(root, process.platform === "win32" ? `${name}.cmd` : `${name}.sh`);
  if (process.platform === "win32") {
    await writeFile(hook, `@echo off\r\ntype nul > "${marker}"\r\nexit /b 0\r\n`);
  } else {
    await writeFile(hook, `#!/bin/sh\n: > '${marker.replaceAll("'", "'\\''")}'\nexit 0\n`);
    await chmod(hook, 0o700);
  }
  return hook;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await readFile(path);
    return true;
  } catch (error) {
    return typeof error === "object" && error !== null && "code" in error
      && (error as { code?: unknown }).code === "ENOENT"
      ? false
      : Promise.reject(error);
  }
}

function contractFor(content: string) {
  return createNoEnvironmentProposalContract({
    threadId: "thread-no-environment",
    transcriptNonce: TRANSCRIPT_NONCE,
    targetPath: "docs/guide.md",
    baseContent: content,
    nonSensitiveContentAttested: true
  });
}

function observe(gate: NoEnvironmentProposalEventGate, message: unknown) {
  const sequence = eventSequences.get(gate) ?? 0;
  eventSequences.set(gate, sequence + 1);
  return gate.ingest(message, { transcriptNonce: TRANSCRIPT_NONCE, sequence });
}

function gateFor(contract: ReturnType<typeof contractFor>, replayStore = createInMemoryNoEnvironmentProposalReplayStore()) {
  return new NoEnvironmentProposalEventGate(contract, replayStore);
}

function exactTurn(id: string, status: "inProgress" | "completed") {
  return {
    id,
    items: [],
    itemsView: "full",
    status,
    error: null,
    startedAt: 1,
    completedAt: status === "completed" ? 2 : null,
    durationMs: status === "completed" ? 1_000 : null
  } as const;
}

function exactAgentMessage(id: string, text: string) {
  return {
    type: "agentMessage",
    id,
    text,
    phase: "final_answer",
    memoryCitation: null
  } as const;
}

function proposalFor(before: string, after: string): NoEnvironmentProposedPatch {
  return {
    schemaVersion: NO_ENVIRONMENT_PROPOSAL_SCHEMA_VERSION,
    operation: "update",
    targetPath: "docs/guide.md",
    baseSha256: sha256(before),
    afterSha256: sha256(after),
    unifiedDiff: diff("docs/guide.md", before.trimEnd(), after.trimEnd())
  };
}

function diff(path: string, before: string, after: string): string {
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

function newFileDiff(path: string, content: string): string {
  return [
    `diff --git a/${path} b/${path}`,
    "new file mode 100644",
    "--- /dev/null",
    `+++ b/${path}`,
    "@@ -0,0 +1 @@",
    `+${content}`,
    ""
  ].join("\n");
}

function modeChangeDiff(path: string, before: string, after: string): string {
  return [
    `diff --git a/${path} b/${path}`,
    "old mode 100644",
    "new mode 100755",
    `--- a/${path}`,
    `+++ b/${path}`,
    "@@ -1 +1 @@",
    `-${before}`,
    `+${after}`,
    ""
  ].join("\n");
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

async function git(cwd: string, args: string[]): Promise<string> {
  return (await execFileAsync("git", args, { cwd, encoding: "utf8" })).stdout;
}
