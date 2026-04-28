#!/usr/bin/env node
/**
 * Evidence Collection Script
 *
 * Aggregates evidence artifacts from all sources (canary, smoke, operator acceptance)
 * into a unified evidence manifest.
 *
 * Usage:
 *   npm run evidence:collect
 *   npx tsx scripts/collect-evidence.ts --output docs/evidence/manifest.json
 */

import { readdir, readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const EVIDENCE_DIR = join(__dirname, "..", "docs", "evidence");
const DEFAULT_OUTPUT = join(EVIDENCE_DIR, "manifest-latest.json");

interface EvidenceEntry {
  file: string;
  schemaVersion: string;
  generatedAt: string;
  size: number;
  status?: string;
}

interface EvidenceManifest {
  schemaVersion: "codex-router-evidence-manifest.v1";
  generatedAt: string;
  totalFiles: number;
  totalSize: number;
  byPhase: Record<string, EvidenceEntry[]>;
  byStatus: Record<string, EvidenceEntry[]>;
  entries: EvidenceEntry[];
}

async function scanEvidenceDir(): Promise<EvidenceEntry[]> {
  const entries: EvidenceEntry[] = [];

  try {
    const files = await readdir(EVIDENCE_DIR);
    for (const file of files) {
      if (file.startsWith("manifest")) continue;
      if (extname(file) !== ".json" && extname(file) !== ".txt") continue;

      const filePath = join(EVIDENCE_DIR, file);
      const fileStat = await stat(filePath);
      const entry: EvidenceEntry = {
        file,
        schemaVersion: "unknown",
        generatedAt: fileStat.mtime.toISOString(),
        size: fileStat.size
      };

      // Try to parse JSON evidence files for metadata
      if (extname(file) === ".json") {
        try {
          const content = await readFile(filePath, "utf-8");
          const parsed = JSON.parse(content);
          if (parsed.schemaVersion) entry.schemaVersion = parsed.schemaVersion;
          if (parsed.generatedAt) entry.generatedAt = parsed.generatedAt;
          if (parsed.result?.status) entry.status = parsed.result.status;
          if (parsed.status) entry.status = parsed.status;
        } catch {
          // Non-JSON or unparseable; keep defaults
        }
      }

      entries.push(entry);
    }
  } catch {
    // Evidence directory may not exist yet
  }

  return entries;
}

async function main(): Promise<void> {
  const outputIdx = process.argv.indexOf("--output");
  const outputPath = outputIdx >= 0 ? process.argv[outputIdx + 1]! : DEFAULT_OUTPUT;

  console.log("=== Codex Router Evidence Collection ===");
  console.log(`Evidence dir: ${EVIDENCE_DIR}`);
  console.log(`Output:       ${outputPath}`);
  console.log("");

  const entries = await scanEvidenceDir();
  entries.sort((a, b) => a.file.localeCompare(b.file));

  // Build phase buckets
  const byPhase: Record<string, EvidenceEntry[]> = {};
  const byStatus: Record<string, EvidenceEntry[]> = {};

  for (const entry of entries) {
    // Phase detection heuristics from filename
    let phase = "unknown";
    if (entry.file.includes("canary")) phase = "phase20-canary";
    else if (entry.file.includes("smoke")) phase = "phase20-smoke";
    else if (entry.file.includes("operator")) phase = "phase17-operator";
    else if (entry.file.includes("model-check")) phase = "phase16-model-check";

    (byPhase[phase] ??= []).push(entry);

    const status = entry.status ?? "unknown";
    (byStatus[status] ??= []).push(entry);
  }

  const manifest: EvidenceManifest = {
    schemaVersion: "codex-router-evidence-manifest.v1",
    generatedAt: new Date().toISOString(),
    totalFiles: entries.length,
    totalSize: entries.reduce((sum, e) => sum + e.size, 0),
    byPhase,
    byStatus,
    entries
  };

  await mkdir(join(outputPath, ".."), { recursive: true });
  await writeFile(outputPath, JSON.stringify(manifest, null, 2), "utf-8");

  console.log(`Total evidence files: ${entries.length}`);
  console.log(`Total size:           ${(manifest.totalSize / 1024).toFixed(1)} KB`);
  console.log("");
  for (const [phase, phaseEntries] of Object.entries(byPhase).sort()) {
    console.log(`  ${phase}: ${phaseEntries.length} files`);
  }
  console.log("");
  for (const [status, statusEntries] of Object.entries(byStatus).sort()) {
    console.log(`  status=${status}: ${statusEntries.length} files`);
  }
  console.log(`\nManifest written to: ${outputPath}`);
}

main().catch((err) => {
  console.error("Evidence collection failed:", err);
  process.exitCode = 1;
});
