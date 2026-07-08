#!/usr/bin/env node

import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, extname, isAbsolute, join, normalize, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export type GovernanceDocsCheckStatus = "passed" | "failed";

export interface GovernanceDocsIssue {
  code: string;
  path: string;
  message: string;
}

export interface GovernanceDocsCheckResult {
  status: GovernanceDocsCheckStatus;
  checkedFiles: string[];
  issues: GovernanceDocsIssue[];
}

const CORE_GOVERNANCE_DOCS = [
  "README.md",
  "docs/README.md",
  "docs/validation-tiers.md",
  "docs/governance/README.md",
  "docs/governance/GOVERNANCE_CONTROL_PLANE.md",
  "docs/governance/RELEASE_GATE_MATRIX.md",
  "docs/governance/EVIDENCE_POLICY.md",
  "docs/governance/GLOSSARY.md",
  "docs/governance/THREAT_MODEL.md",
  "docs/governance/CHANGE_CONTROL.md",
  "docs/governance/WORKSPACE_WRITE_RELEASE_GATE.md",
  "docs/governance/DOCS_AUTOMATION_SPEC.md",
  "docs/governance/inventory/DOCUMENT_INVENTORY.md",
  "docs/governance/inventory/DOCUMENT_BASELINE.md",
  "docs/governance/inventory/DOCUMENT_LINK_RISK_REGISTER.md"
] as const;

const ACTIVE_FRONTMATTER_DOCS = [
  "docs/governance/GOVERNANCE_CONTROL_PLANE.md",
  "docs/governance/RELEASE_GATE_MATRIX.md",
  "docs/governance/EVIDENCE_POLICY.md",
  "docs/governance/GLOSSARY.md",
  "docs/governance/THREAT_MODEL.md",
  "docs/governance/CHANGE_CONTROL.md",
  "docs/governance/WORKSPACE_WRITE_RELEASE_GATE.md",
  "docs/governance/DOCS_AUTOMATION_SPEC.md"
] as const;

const README_LINK_DOCS = [
  "README.md",
  "docs/README.md",
  "docs/governance/README.md",
  "docs/governance/GOVERNANCE_CONTROL_PLANE.md",
  "docs/governance/RELEASE_GATE_MATRIX.md",
  "docs/governance/EVIDENCE_POLICY.md",
  "docs/governance/THREAT_MODEL.md",
  "docs/governance/CHANGE_CONTROL.md",
  "docs/governance/WORKSPACE_WRITE_RELEASE_GATE.md"
] as const;

const RUNBOOK_REQUIRED_HEADINGS = [
  "## Preconditions",
  "## Blocking Conditions",
  "## Evidence Produced",
  "## Rollback"
] as const;

const ADR_REQUIRED_HEADINGS = [
  "## Context",
  "## Decision",
  "## Consequences"
] as const;

const CLOSEOUT_REQUIRED_MARKERS = [
  "status:",
  "## Verification Commands",
  "## Remaining Risks"
] as const;

export const RELEASE_GATE_EXECUTION_BOUNDARY_MARKERS = [
  "narrow_readonly_provider_dispatch_without_boundary_inheritance",
  "read-only provider dispatch does not inherit into host executor authorization",
  "read-only provider dispatch does not inherit into sub-agent runtime authorization",
  "read-only provider dispatch does not inherit into workspace-write authorization",
  "read-only provider dispatch does not inherit into release authorization",
  "Codex CLI host does not authorize host executor or sub-agent runtime",
  "sub-agent runtime does not invoke Codex CLI or provider execution",
  "host executor does not execute provider or sub-agent runtime"
] as const;

export const GOVERNANCE_README_RUNNER_ENTRY_MARKERS = [
  "npm run governance -- audit execution-boundary-current-surface",
  "npm run governance -- audit source-release-package-boundary"
] as const;

export async function checkGovernanceDocs(
  cwd = process.cwd()
): Promise<GovernanceDocsCheckResult> {
  const issues: GovernanceDocsIssue[] = [];
  const checkedFiles = new Set<string>();

  await checkRequiredFiles(cwd, issues, checkedFiles);
  await checkActiveFrontmatter(cwd, issues, checkedFiles);
  await checkRunbooks(cwd, issues, checkedFiles);
  await checkAdrs(cwd, issues, checkedFiles);
  await checkCloseoutTemplate(cwd, issues, checkedFiles);
  await checkReleaseGateCommands(cwd, issues, checkedFiles);
  await checkReleaseGateExecutionBoundaryMarkers(cwd, issues, checkedFiles);
  await checkGovernanceReadmeRunnerEntries(cwd, issues, checkedFiles);
  await checkMarkdownLinks(cwd, issues, checkedFiles);

  return {
    status: issues.length === 0 ? "passed" : "failed",
    checkedFiles: [...checkedFiles].sort(),
    issues
  };
}

async function checkRequiredFiles(
  cwd: string,
  issues: GovernanceDocsIssue[],
  checkedFiles: Set<string>
): Promise<void> {
  for (const filePath of CORE_GOVERNANCE_DOCS) {
    checkedFiles.add(filePath);
    if (!await exists(cwd, filePath)) {
      issues.push(issue("governance_doc_missing", filePath, "Required governance document is missing"));
    }
  }
}

async function checkActiveFrontmatter(
  cwd: string,
  issues: GovernanceDocsIssue[],
  checkedFiles: Set<string>
): Promise<void> {
  for (const filePath of ACTIVE_FRONTMATTER_DOCS) {
    const text = await readOptional(cwd, filePath);
    if (text === undefined) {
      continue;
    }
    checkedFiles.add(filePath);
    const frontmatter = parseFrontmatter(text);
    if (frontmatter === undefined) {
      issues.push(issue("active_doc_frontmatter_missing", filePath, "Active governance document must have frontmatter"));
      continue;
    }
    if (!/^status:\s*active/m.test(frontmatter)) {
      issues.push(issue("active_doc_status_missing", filePath, "Active governance document frontmatter must declare status: active"));
    }
  }
}

async function checkRunbooks(
  cwd: string,
  issues: GovernanceDocsIssue[],
  checkedFiles: Set<string>
): Promise<void> {
  const runbooks = await listMarkdownFiles(cwd, "docs/governance/runbooks");
  const files = [...runbooks, "docs/governance/templates/RUNBOOK_TEMPLATE.md"];
  for (const filePath of files) {
    const text = await readOptional(cwd, filePath);
    if (text === undefined) {
      issues.push(issue("runbook_missing", filePath, "Runbook file is missing"));
      continue;
    }
    checkedFiles.add(filePath);
    if (parseFrontmatter(text) === undefined) {
      issues.push(issue("runbook_frontmatter_missing", filePath, "Runbook must have frontmatter"));
    }
    requireHeadings(filePath, text, RUNBOOK_REQUIRED_HEADINGS, issues, "runbook_heading_missing");
  }
}

async function checkAdrs(
  cwd: string,
  issues: GovernanceDocsIssue[],
  checkedFiles: Set<string>
): Promise<void> {
  const decisions = await listMarkdownFiles(cwd, "docs/governance/decisions");
  const files = [...decisions, "docs/governance/templates/ADR_TEMPLATE.md"];
  for (const filePath of files) {
    const text = await readOptional(cwd, filePath);
    if (text === undefined) {
      issues.push(issue("adr_missing", filePath, "ADR file is missing"));
      continue;
    }
    checkedFiles.add(filePath);
    if (parseFrontmatter(text) === undefined) {
      issues.push(issue("adr_frontmatter_missing", filePath, "ADR must have frontmatter"));
    }
    requireHeadings(filePath, text, ADR_REQUIRED_HEADINGS, issues, "adr_heading_missing");
  }
}

async function checkCloseoutTemplate(
  cwd: string,
  issues: GovernanceDocsIssue[],
  checkedFiles: Set<string>
): Promise<void> {
  const filePath = "docs/governance/templates/CLOSEOUT_TEMPLATE.md";
  const text = await readOptional(cwd, filePath);
  if (text === undefined) {
    issues.push(issue("closeout_template_missing", filePath, "Closeout template is missing"));
    return;
  }
  checkedFiles.add(filePath);
  for (const marker of CLOSEOUT_REQUIRED_MARKERS) {
    if (!text.includes(marker)) {
      issues.push(issue("closeout_marker_missing", filePath, `Closeout template must include ${marker}`));
    }
  }
}

async function checkReleaseGateCommands(
  cwd: string,
  issues: GovernanceDocsIssue[],
  checkedFiles: Set<string>
): Promise<void> {
  const filePath = "docs/governance/RELEASE_GATE_MATRIX.md";
  const text = await readOptional(cwd, filePath);
  const packageJsonText = await readOptional(cwd, "package.json");
  if (text === undefined || packageJsonText === undefined) {
    return;
  }
  checkedFiles.add(filePath);
  checkedFiles.add("package.json");

  const packageJson = JSON.parse(packageJsonText) as { scripts?: Record<string, string> };
  const scripts = packageJson.scripts ?? {};
  for (const scriptName of npmRunScriptsIn(text)) {
    if (scripts[scriptName] === undefined) {
      issues.push(issue(
        "release_gate_command_missing",
        filePath,
        `Release gate references missing package script: npm run ${scriptName}`
      ));
    }
  }
}

async function checkReleaseGateExecutionBoundaryMarkers(
  cwd: string,
  issues: GovernanceDocsIssue[],
  checkedFiles: Set<string>
): Promise<void> {
  const filePath = "docs/governance/RELEASE_GATE_MATRIX.md";
  const text = await readOptional(cwd, filePath);
  if (text === undefined) {
    return;
  }
  checkedFiles.add(filePath);

  for (const marker of missingReleaseGateExecutionBoundaryMarkers(text)) {
    issues.push(issue(
      "release_gate_execution_boundary_marker_missing",
      filePath,
      `Release gate matrix must record execution boundary marker: ${marker}`
    ));
  }
}

async function checkGovernanceReadmeRunnerEntries(
  cwd: string,
  issues: GovernanceDocsIssue[],
  checkedFiles: Set<string>
): Promise<void> {
  const filePath = "docs/governance/README.md";
  const text = await readOptional(cwd, filePath);
  if (text === undefined) {
    return;
  }
  checkedFiles.add(filePath);

  for (const marker of GOVERNANCE_README_RUNNER_ENTRY_MARKERS) {
    if (!text.includes(marker)) {
      issues.push(issue(
        "governance_readme_runner_entry_missing",
        filePath,
        `Governance README must list runner entry: ${marker}`
      ));
    }
  }
}

export function missingReleaseGateExecutionBoundaryMarkers(text: string): string[] {
  const normalizedText = normalizeDocTextForMarkerSearch(text);

  return RELEASE_GATE_EXECUTION_BOUNDARY_MARKERS.filter((marker) =>
    !normalizedText.includes(normalizeDocTextForMarkerSearch(marker))
  );
}

function normalizeDocTextForMarkerSearch(text: string): string {
  return text.replace(/\s+/g, " ");
}

async function checkMarkdownLinks(
  cwd: string,
  issues: GovernanceDocsIssue[],
  checkedFiles: Set<string>
): Promise<void> {
  for (const filePath of README_LINK_DOCS) {
    const text = await readOptional(cwd, filePath);
    if (text === undefined) {
      continue;
    }
    checkedFiles.add(filePath);
    for (const link of markdownLinksIn(text)) {
      const target = stripAnchor(link);
      if (!shouldCheckRelativeMarkdownLink(target)) {
        continue;
      }
      const absoluteTarget = resolve(cwd, dirname(filePath), target);
      if (isOutsideDirectory(resolve(cwd), absoluteTarget)) {
        issues.push(issue("markdown_link_outside_repo", filePath, `Link escapes repository: ${link}`));
        continue;
      }
      if (!await pathExists(absoluteTarget)) {
        issues.push(issue("markdown_link_missing", filePath, `Broken relative markdown link: ${link}`));
      }
    }
  }
}

function requireHeadings(
  filePath: string,
  text: string,
  headings: readonly string[],
  issues: GovernanceDocsIssue[],
  code: string
): void {
  for (const heading of headings) {
    if (!text.includes(heading)) {
      issues.push(issue(code, filePath, `Required heading missing: ${heading}`));
    }
  }
}

function parseFrontmatter(text: string): string | undefined {
  if (!text.startsWith("---\n")) {
    return undefined;
  }
  const closingIndex = text.indexOf("\n---\n", 4);
  if (closingIndex < 0) {
    return undefined;
  }
  return text.slice(4, closingIndex);
}

function npmRunScriptsIn(text: string): string[] {
  const scripts = new Set<string>();
  const regex = /`npm run ([a-zA-Z0-9:_-]+)(?:\s|`)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const scriptName = match[1];
    if (scriptName !== undefined) {
      scripts.add(scriptName);
    }
  }
  return [...scripts].sort();
}

function markdownLinksIn(text: string): string[] {
  const links: string[] = [];
  const regex = /\[[^\]\n]+\]\(([^)\n]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const link = match[1]?.trim();
    if (link !== undefined && link !== "") {
      links.push(link);
    }
  }
  return links;
}

function stripAnchor(link: string): string {
  const hashIndex = link.indexOf("#");
  return hashIndex < 0 ? link : link.slice(0, hashIndex);
}

function shouldCheckRelativeMarkdownLink(link: string): boolean {
  if (link === "" || link.startsWith("#")) {
    return false;
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(link)) {
    return false;
  }
  return extname(link) === ".md";
}

function isOutsideDirectory(parent: string, candidate: string): boolean {
  const relativePath = relative(parent, candidate);
  return relativePath === ".."
    || relativePath.startsWith(`..${"/"}`)
    || relativePath.startsWith(`..${"\\"}`)
    || isAbsolute(relativePath);
}

async function listMarkdownFiles(cwd: string, dirPath: string): Promise<string[]> {
  const absoluteDir = join(cwd, dirPath);
  try {
    const entries = await readdir(absoluteDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .map((entry) => normalize(join(dirPath, entry.name)).replace(/\\/g, "/"))
      .sort();
  } catch {
    return [];
  }
}

async function exists(cwd: string, filePath: string): Promise<boolean> {
  return pathExists(join(cwd, filePath));
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readOptional(cwd: string, filePath: string): Promise<string | undefined> {
  try {
    return await readFile(join(cwd, filePath), "utf8");
  } catch {
    return undefined;
  }
}

function issue(code: string, path: string, message: string): GovernanceDocsIssue {
  return { code, path, message };
}

function printText(result: GovernanceDocsCheckResult): void {
  console.log(`Governance docs check: ${result.status}`);
  console.log(`Checked files: ${result.checkedFiles.length}`);
  if (result.issues.length === 0) {
    return;
  }
  for (const issueItem of result.issues) {
    console.log(`- ${issueItem.code} ${issueItem.path}: ${issueItem.message}`);
  }
}

async function main(): Promise<void> {
  const json = process.argv.includes("--json");
  const result = await checkGovernanceDocs(process.cwd());
  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printText(result);
  }
  if (result.status !== "passed") {
    process.exitCode = 1;
  }
}

if (process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
