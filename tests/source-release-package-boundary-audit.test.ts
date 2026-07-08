import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  collectSourceReleasePackageBoundaryAuditInput,
  formatSourceReleasePackageBoundaryAuditResult,
  reviewSourceReleasePackageBoundaryAudit,
  type SourceReleasePackageBoundaryAuditInput
} from "../scripts/run-source-release-package-boundary-audit.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "sk-live-",
  "Bearer",
  "raw env",
  "raw token",
  "raw command",
  "raw stdout",
  "raw stderr",
  "requestedAction",
  "prompt"
];

test("source/release package boundary passes for local pack-plan manifests", async () => {
  const review = reviewSourceReleasePackageBoundaryAudit(
    await createInputFromWorkspace()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.sourceReviewForbiddenPathsExcluded, true);
  assert.equal(review.checks.sourceReviewRootAgentInstructionPresent, true);
  assert.equal(
    review.checks.sourceReviewRootAgentInstructionBoundaryRecorded,
    true
  );
  assert.equal(review.checks.releaseEvidenceSourceRootsExcluded, true);
  assert.equal(review.checks.releaseEvidenceForbiddenPathsExcluded, true);
  assert.equal(review.checks.profilesDisjoint, true);
  assert.equal(review.checks.environmentArtifactsAbsent, true);
  assert.equal(review.summary.archivePackPlanCount, 2);
  assert.equal(review.summary.profileOverlapCount, 0);
  assert.equal(review.summary.sourceReviewRootAgentInstructionPresent, true);
  assert.equal(
    review.summary.sourceReviewRootAgentInstructionBoundaryRecorded,
    true
  );
  assert.equal(review.summary.dirtyWorktreeEntryCount, 0);
  assert.equal(review.summary.dirtyBoundarySourceEntryCount, 0);
  assert.equal(review.summary.dirtyBoundarySourceRegisteredEntryCount, 0);
  assert.equal(review.summary.dirtyBoundarySourceUnregisteredEntryCount, 0);
  assert.equal(review.summary.dirtyBoundaryAuditScriptEntryCount, 0);
  assert.equal(review.summary.dirtyBoundaryAuditTestEntryCount, 0);
  assert.equal(review.summary.dirtyBoundaryAuditPairedAuditCount, 0);
  assert.equal(review.summary.dirtyBoundaryAuditUnpairedAuditCount, 0);
  assert.equal(review.summary.dirtyEnvironmentArtifactEntryCount, 0);
  assert.equal(review.summary.archiveWritesDuringAudit, 0);
});

test("source/release package boundary blocks stale package configuration", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewSourceReleasePackageBoundaryAudit({
    ...input,
    gitStatusShort: " M package.json\n",
    branch: "feature",
    aheadBehind: "0\t1",
    packageJsonText: JSON.stringify({ scripts: {} }),
    boundaryDocText: "stale"
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("source_release_package_boundary_worktreeClean"));
  assert.ok(review.reasons.includes("source_release_package_boundary_branchMain"));
  assert.ok(review.reasons.includes("source_release_package_boundary_notBehindOrigin"));
  assert.ok(review.reasons.includes("source_release_package_boundary_packageScriptPresent"));
  assert.ok(review.reasons.includes("source_release_package_boundary_boundaryDocRecorded"));
});

test("source/release package boundary blocks missing root AGENTS instruction", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewSourceReleasePackageBoundaryAudit({
    ...input,
    sourceReviewManifestFiles: input.sourceReviewManifestFiles.filter(
      (filePath) => filePath !== "AGENTS.md"
    ),
    rootAgentInstructionText: ""
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "source_release_package_boundary_sourceReviewRootAgentInstructionPresent"
    )
  );
  assert.equal(review.summary.sourceReviewRootAgentInstructionPresent, false);
  assert.equal(
    review.summary.sourceReviewRootAgentInstructionBoundaryRecorded,
    false
  );
});

test("source/release package boundary blocks root AGENTS without boundary markers", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewSourceReleasePackageBoundaryAudit({
    ...input,
    rootAgentInstructionText: input.rootAgentInstructionText.replaceAll(
      "Codex CLI host does not authorize host executor or sub-agent runtime",
      "Codex CLI host authority is summarized"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "source_release_package_boundary_sourceReviewRootAgentInstructionBoundaryRecorded"
    )
  );
});

test("source/release package boundary blocks missing documented root AGENTS and environment artifact rules", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewSourceReleasePackageBoundaryAudit({
    ...input,
    boundaryDocText: input.boundaryDocText
      .replaceAll("source-review root AGENTS must be present", "source-review roots are summarized")
      .replaceAll("source-review root AGENTS boundary must be recorded", "source-review root AGENTS boundary is summarized")
      .replaceAll("Zone.Identifier environment artifacts absent", "environment artifacts are summarized")
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("source_release_package_boundary_boundaryDocRecorded"));
});

test("source/release package boundary blocks missing execution-boundary prerequisite", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewSourceReleasePackageBoundaryAudit({
    ...input,
    boundaryDocText: input.boundaryDocText
      .replaceAll(
        "npm run governance -- audit execution-boundary-current-surface",
        "npm run governance -- audit archived-execution-boundary"
      )
      .replaceAll(
        "strategy router, execution profiles, policy config, capability taxonomy, capability taxonomy escalation policy, routing engine, recovery control orchestration, runtime control, operator action executor gate, Codex CLI\n" +
        "host, public API facade, Agent OS local runtime, Agent OS MCP server manifest, Protocol MCP provider skeleton, Protocol A2A remote provider skeleton, Agent OS SDK, Agent OS CLI, Agent OS app-server wrapper, Agent OS public surfaces, Codex provider, preflight, approval\n" +
        "permit, approval gate, approval consumption dispatch matrix, approval consumption dispatch, admission control, delegation policy, execution eligibility, execution observation, governance failure reducer, task graph, scheduler, execution planner,\n" +
        "provider registry, controlled provider execution taskbook, controlled provider execution taskbook review, provider execution runner, provider-core primitives, tool\n" +
        "invocation planner, desktop decision runner, final host locator,\n" +
        "host-dispatcher provider, Codex\n" +
        "desktop bridge, Codex desktop live host, Codex memory MCP client, Codex memory\n" +
        "host client, desktop host client, desktop live adapter dispatch, host-client\n" +
        "example, target host embedding, host executor, host executor taskbook,\n" +
        "host-client executor review, host executor receipt, agent-backed recovery\n" +
        "executor, agent executor adapter taskbook, agent executor adapter review, agent\n" +
        "executor adapter sandbox, task-control taskbook, task-control review, sub-agent\n" +
        "runtime, and task-control sandbox boundaries",
        "archived execution boundaries"
      )
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("source_release_package_boundary_boundaryDocRecorded"));
});

test("source/release package boundary blocks missing authority lattice prerequisite", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewSourceReleasePackageBoundaryAudit({
    ...input,
    boundaryDocText: input.boundaryDocText.replaceAll(
      "narrow_readonly_provider_dispatch_without_boundary_inheritance",
      "legacy_readonly_dispatch_boundary"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("source_release_package_boundary_boundaryDocRecorded"));
});

test("source/release package boundary blocks missing authority inheritance prerequisite", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewSourceReleasePackageBoundaryAudit({
    ...input,
    boundaryDocText: input.boundaryDocText.replaceAll(
      "Codex CLI host does not authorize host executor or sub-agent runtime",
      "Codex CLI host authority is summarized"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("source_release_package_boundary_boundaryDocRecorded"));
});

test("source/release package boundary summarizes dirty worktree categories", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewSourceReleasePackageBoundaryAudit({
    ...input,
    gitStatusShort: [
      " M docs/governance/README.md",
      " M docs/current/CURRENT_STATE.md",
      " M docs/validation-tiers.md",
      " M docs/agent-os-transformation/current-roadmap-20260610.md",
      " M .github/workflows/ci.yml",
      " D AGENTS.md",
      "?? scripts/run-host-executor-boundary-audit.ts",
      "?? tests/host-executor-boundary-audit.test.ts",
      "?? scripts/run-orphan-boundary-audit.ts",
      "?? tests/orphan-boundary-audit.test.ts",
      "?? scripts/run-lone-boundary-audit.ts",
      "?? AGENTS.md:Zone.Identifier"
    ].join("\n")
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("source_release_package_boundary_worktreeClean"));
  assert.ok(
    review.reasons.includes(
      "source_release_package_boundary_environmentArtifactsAbsent"
    )
  );
  assert.equal(review.summary.dirtyWorktreeEntryCount, 12);
  assert.equal(review.summary.dirtyTrackedEntryCount, 6);
  assert.equal(review.summary.dirtyUntrackedEntryCount, 6);
  assert.equal(review.summary.dirtyDeletedEntryCount, 1);
  assert.equal(review.summary.dirtyBoundarySourceEntryCount, 5);
  assert.equal(review.summary.dirtyBoundarySourceRegisteredEntryCount, 2);
  assert.equal(review.summary.dirtyBoundarySourceUnregisteredEntryCount, 3);
  assert.equal(review.summary.dirtyBoundaryAuditScriptEntryCount, 3);
  assert.equal(review.summary.dirtyBoundaryAuditTestEntryCount, 2);
  assert.equal(review.summary.dirtyBoundaryAuditPairedAuditCount, 2);
  assert.equal(review.summary.dirtyBoundaryAuditUnpairedAuditCount, 1);
  assert.equal(review.summary.dirtyGovernanceDocEntryCount, 3);
  assert.equal(review.summary.dirtyGovernanceBoundaryDocEntryCount, 1);
  assert.equal(review.summary.dirtyCurrentStateDocEntryCount, 1);
  assert.equal(review.summary.dirtyValidationTierDocEntryCount, 1);
  assert.equal(review.summary.dirtyRoadmapDocEntryCount, 1);
  assert.equal(review.summary.dirtyCiWorkflowEntryCount, 1);
  assert.equal(review.summary.dirtyRootAgentInstructionEntryCount, 2);
  assert.equal(review.summary.dirtyRootAgentInstructionDeletedEntryCount, 1);
  assert.equal(review.summary.dirtyEnvironmentArtifactEntryCount, 1);
});

test("source/release package boundary fails closed when origin freshness is unknown", async () => {
  const review = reviewSourceReleasePackageBoundaryAudit({
    ...(await createInputFromWorkspace()),
    aheadBehind: "unknown\tunknown"
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("source_release_package_boundary_notBehindOrigin"));
});

test("source/release package boundary blocks dirty source-review manifests", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewSourceReleasePackageBoundaryAudit({
    ...input,
    sourceReviewManifestFiles: [
      ...input.sourceReviewManifestFiles,
      ".git/config",
      ".agent_board/HANDOFF.md",
      "node_modules/pkg/index.js",
      "dist/packages/router/src/index.js",
      "docs/evidence/receipt.json",
      ".test-pack/tmp.json",
      "tmp-source-review.txt"
    ]
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("source_release_package_boundary_sourceReviewForbiddenPathsExcluded"));
  assert.equal(review.summary.sourceReviewForbiddenMatchCount, 7);
  assert.equal(review.summary.archiveWritesDuringAudit, 0);
});

test("source/release package boundary blocks dirty release-evidence manifests", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewSourceReleasePackageBoundaryAudit({
    ...input,
    releaseEvidenceManifestFiles: [
      ...input.releaseEvidenceManifestFiles,
      "packages/router/src/index.ts",
      "scripts/run.ts",
      "tests/router.test.ts",
      "docs/governance/SOURCE_RELEASE_PACKAGE_BOUNDARY.md",
      "package.json",
      "logs/.env"
    ]
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("source_release_package_boundary_releaseEvidenceSourceRootsExcluded"));
  assert.ok(review.reasons.includes("source_release_package_boundary_releaseEvidenceForbiddenPathsExcluded"));
  assert.equal(review.summary.releaseEvidenceSourceRootLeakCount, 5);
  assert.equal(review.summary.releaseEvidenceForbiddenMatchCount, 1);
  assert.equal(review.summary.archiveWritesDuringAudit, 0);
});

test("source/release package boundary output stays summarized", async () => {
  const review = reviewSourceReleasePackageBoundaryAudit(
    await createInputFromWorkspace()
  );
  const text = formatSourceReleasePackageBoundaryAuditResult(review);
  const json = formatSourceReleasePackageBoundaryAuditResult(review, "json");
  const parsed = JSON.parse(json) as typeof review;

  assert.match(text, /status: passed/);
  assert.match(text, /archive pack-plans: 2/);
  assert.match(text, /source-review manifest files: \d+/);
  assert.match(text, /release-evidence manifest files: \d+/);
  assert.match(text, /source-review root AGENTS present: true/);
  assert.match(text, /source-review root AGENTS boundary recorded: true/);
  assert.match(text, /dirty worktree entries: 0/);
  assert.match(text, /dirty boundary source entries: 0/);
  assert.match(text, /dirty boundary source registered entries: 0/);
  assert.match(text, /dirty boundary source unregistered entries: 0/);
  assert.match(text, /dirty boundary audit script entries: 0/);
  assert.match(text, /dirty boundary audit test entries: 0/);
  assert.match(text, /dirty boundary audit paired audits: 0/);
  assert.match(text, /dirty boundary audit unpaired audits: 0/);
  assert.match(text, /dirty governance boundary doc entries: 0/);
  assert.match(text, /dirty current state doc entries: 0/);
  assert.match(text, /dirty validation tier doc entries: 0/);
  assert.match(text, /dirty roadmap doc entries: 0/);
  assert.match(text, /dirty root AGENTS deleted entries: 0/);
  assert.match(text, /dirty environment artifact entries: 0/);
  assert.equal(parsed.status, "passed");

  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false, `text output must omit ${marker}`);
    assert.equal(json.includes(marker), false, `json output must omit ${marker}`);
  }
});

async function createInputFromWorkspace(
  overrides: Partial<SourceReleasePackageBoundaryAuditInput> = {}
): Promise<SourceReleasePackageBoundaryAuditInput> {
  const input = await collectSourceReleasePackageBoundaryAuditInput();

  return {
    ...input,
    gitStatusShort: "",
    branch: "main",
    aheadBehind: "0\t0",
    sourceReviewManifestFiles: [
      ...input.sourceReviewManifestFiles.filter(
        (filePath) => filePath !== "AGENTS.md"
      ),
      "AGENTS.md"
    ].sort(),
    packageJsonText: await readFile("package.json", "utf8"),
    boundaryDocText: await readFile(
      "docs/governance/SOURCE_RELEASE_PACKAGE_BOUNDARY.md",
      "utf8"
    ),
    governanceRunnerText: await readFile(
      "scripts/run-governance-check.ts",
      "utf8"
    ),
    rootAgentInstructionText: await readFile("AGENTS.md", "utf8"),
    ...overrides
  };
}
