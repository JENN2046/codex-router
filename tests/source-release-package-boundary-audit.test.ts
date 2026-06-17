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
  "sk-",
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
  assert.equal(review.checks.releaseEvidenceSourceRootsExcluded, true);
  assert.equal(review.checks.releaseEvidenceForbiddenPathsExcluded, true);
  assert.equal(review.checks.profilesDisjoint, true);
  assert.equal(review.summary.archivePackPlanCount, 2);
  assert.equal(review.summary.profileOverlapCount, 0);
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
    packageJsonText: await readFile("package.json", "utf8"),
    boundaryDocText: await readFile(
      "docs/governance/SOURCE_RELEASE_PACKAGE_BOUNDARY.md",
      "utf8"
    ),
    ...overrides
  };
}
