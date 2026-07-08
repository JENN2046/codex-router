import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  checkGovernanceDocs,
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
