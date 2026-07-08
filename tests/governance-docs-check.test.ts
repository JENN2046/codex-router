import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  checkGovernanceDocs,
  GOVERNANCE_README_RUNNER_ENTRY_MARKERS,
  missingGovernanceReadmeRunnerEntryMarkers,
  missingReleaseGateExecutionBoundaryMarkers
} from "../scripts/check-governance-docs.js";

test("governance docs check passes for current repository docs", async () => {
  const result = await checkGovernanceDocs(process.cwd());

  assert.equal(result.status, "passed");
  assert.deepEqual(result.issues, []);
  assert.ok(result.checkedFiles.includes("docs/governance/DOCS_AUTOMATION_SPEC.md"));
  assert.ok(result.checkedFiles.includes("docs/governance/WORKSPACE_WRITE_RELEASE_GATE.md"));
  assert.ok(
    result.checkedFiles.includes(
      "docs/governance/decisions/ADR_005_WORKSPACE_WRITE_PERMIT_V2.md"
    )
  );
});

test("release gate matrix records execution authority lattice markers", async () => {
  const text = await readFile(
    new URL("../docs/governance/RELEASE_GATE_MATRIX.md", import.meta.url),
    "utf8"
  );

  assert.deepEqual(missingReleaseGateExecutionBoundaryMarkers(text), []);
  assert.deepEqual(
    missingReleaseGateExecutionBoundaryMarkers(
      text.replaceAll(
        "Codex CLI host does not authorize host executor or sub-agent runtime",
        "Codex CLI host authority is summarized"
      )
    ),
    ["Codex CLI host does not authorize host executor or sub-agent runtime"]
  );
});

test("governance README records current runner entries", async () => {
  const text = await readFile(
    new URL("../docs/governance/README.md", import.meta.url),
    "utf8"
  );

  for (const marker of GOVERNANCE_README_RUNNER_ENTRY_MARKERS) {
    assert.match(text, new RegExp(escapeRegExp(marker)));
  }

  assert.deepEqual(missingGovernanceReadmeRunnerEntryMarkers(text), []);
  assert.deepEqual(
    missingGovernanceReadmeRunnerEntryMarkers(
      text.replaceAll(
        "npm run governance -- audit source-release-package-boundary",
        "npm run governance -- audit source-release-package"
      )
    ),
    ["npm run governance -- audit source-release-package-boundary"]
  );
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
