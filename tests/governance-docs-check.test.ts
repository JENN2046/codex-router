import test from "node:test";
import assert from "node:assert/strict";
import { checkGovernanceDocs } from "../scripts/check-governance-docs.js";

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
