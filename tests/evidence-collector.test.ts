import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  collectEvidenceManifest,
  normalizeTextEvidenceContent,
  scanEvidenceDir
} from "../scripts/collect-evidence.js";

test("evidence collector records normalized text byte sizes", async () => {
  const evidenceDir = await mkdtemp(join(tmpdir(), "codex-router-evidence-"));
  const content = [
    "{",
    '  "schemaVersion": "codex-router-evidence.v1",',
    '  "generatedAt": "2026-06-11T02:57:35.591Z",',
    '  "result": {',
    '    "status": "passed"',
    "  }",
    "}",
    ""
  ].join("\r\n");

  try {
    await writeFile(join(evidenceDir, "codex-cli-canary-latest.json"), content, "utf-8");

    const [entry] = await scanEvidenceDir(evidenceDir);
    const expectedSize = Buffer.byteLength(normalizeTextEvidenceContent(content), "utf-8");

    assert.ok(entry);
    assert.equal(entry.file, "codex-cli-canary-latest.json");
    assert.equal(entry.size, expectedSize);
    assert.notEqual(entry.size, Buffer.byteLength(content, "utf-8"));
    assert.equal(entry.status, "passed");

    const manifest = await collectEvidenceManifest(evidenceDir);
    assert.equal(manifest.totalSize, expectedSize);
    assert.equal(manifest.byPhase["phase20-canary"]?.[0]?.size, expectedSize);
    assert.equal(manifest.byStatus.passed?.[0]?.size, expectedSize);
  } finally {
    await rm(evidenceDir, { recursive: true, force: true });
  }
});
