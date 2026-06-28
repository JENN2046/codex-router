#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  parseStateSyncClaim,
  type StateSyncClaim
} from "../packages/state-sync-audit/src/index.js";

const CURRENT_STATE_DOC = "docs/current/CURRENT_STATE.md";
const STATE_SYNC_RECORD_DOC = "docs/current/state-sync-record.json";
const AGENT_BOARD_FILES = [
  ".agent_board/CHECKPOINT.md",
  ".agent_board/HANDOFF.md",
  ".agent_board/RUN_STATE.md",
  ".agent_board/TASK_QUEUE.md",
  ".agent_board/VALIDATION_LOG.md"
] as const;

const DISPLAY_START = "<!-- state-sync-display:start -->";
const DISPLAY_END = "<!-- state-sync-display:end -->";

export interface StateSyncDisplaySyncOptions {
  write?: boolean;
}

export interface StateSyncDisplaySyncResult {
  checkedPaths: string[];
  changedPaths: string[];
  mode: "check" | "write";
}

interface DisplayFields {
  branch: string;
  upstream: string;
  currentHead: string;
  validatedSourceCommit: string;
  latestValidatedCommit: string;
  recordedDivergence: string;
  transitionKind: string;
  stateRecordMode: string;
  sourceTreeDigestAlgorithm: string;
  sourceTreeDigestValue: string;
  strictStatePaths: string[];
  validatedSourceDivergenceExpectation: string;
}

export async function syncStateSyncDisplay(
  cwd = process.cwd(),
  options: StateSyncDisplaySyncOptions = {}
): Promise<StateSyncDisplaySyncResult> {
  const claimText = await read(cwd, STATE_SYNC_RECORD_DOC);
  const parsedClaim = parseStateSyncClaim(claimText);
  if (parsedClaim.status !== "valid") {
    throw new Error(`Cannot sync state-sync display from ${parsedClaim.status} claim`);
  }

  const display = displayFieldsFromClaim(parsedClaim.claim);
  const checkedPaths = [CURRENT_STATE_DOC, ...AGENT_BOARD_FILES];
  const changedPaths: string[] = [];

  for (const filePath of checkedPaths) {
    const before = await read(cwd, filePath);
    const after = updateDisplayFile(filePath, before, display);
    if (after !== before) {
      changedPaths.push(filePath);
      if (options.write === true) {
        await writeFile(join(cwd, filePath), after, "utf8");
      }
    }
  }

  return {
    checkedPaths,
    changedPaths,
    mode: options.write === true ? "write" : "check"
  };
}

function displayFieldsFromClaim(claim: StateSyncClaim): DisplayFields {
  const recordedDivergence = formatDivergence(claim.source.recordedDivergence);

  return {
    branch: claim.subject.branch,
    upstream: normalizeClaimUpstreamRef(claim.subject.upstream),
    currentHead: claim.source.validatedSourceCommit,
    validatedSourceCommit: claim.source.validatedSourceCommit,
    latestValidatedCommit: claim.source.latestValidatedCommit,
    recordedDivergence,
    transitionKind: claim.transition.kind,
    stateRecordMode: stateRecordModeForTransition(claim.transition.kind),
    sourceTreeDigestAlgorithm: claim.source.sourceTreeDigest.algorithm,
    sourceTreeDigestValue: claim.source.sourceTreeDigest.value,
    strictStatePaths: claim.transition.allowedStatePaths,
    validatedSourceDivergenceExpectation:
      validatedSourceDivergenceExpectation(claim, recordedDivergence)
  };
}

function updateDisplayFile(
  filePath: string,
  text: string,
  display: DisplayFields
): string {
  if (filePath === CURRENT_STATE_DOC) {
    return updateCurrentState(text, display);
  }

  return upsertGeneratedDisplayBlock(
    updateVolatileAgentBoardProse(
      filePath,
      updateAgentBoardFields(text, display),
      display
    ),
    display
  );
}

function updateCurrentState(text: string, display: DisplayFields): string {
  let updated = text;
  updated = replaceTableField(updated, "Current branch", display.branch);
  updated = replaceTableField(updated, "Current head", display.currentHead);
  updated = replaceTableField(
    updated,
    "Validated source commit",
    display.validatedSourceCommit
  );
  updated = replaceTableField(updated, "Upstream", display.upstream);
  updated = replaceTableField(
    updated,
    "Upstream divergence",
    display.recordedDivergence
  );
  updated = replaceTableField(
    updated,
    "Latest validated commit",
    display.latestValidatedCommit
  );
  updated = replaceTableField(
    updated,
    "State record mode",
    display.stateRecordMode
  );
  updated = replaceBulletCode(updated, "schema version", "1");
  updated = replaceBulletCode(updated, "policy version", "state-sync-policy.v1");
  updated = replaceBulletCode(
    updated,
    "transition kind",
    display.transitionKind
  );
  updated = replaceBulletCode(
    updated,
    "validated source commit",
    display.validatedSourceCommit
  );
  updated = replaceBulletCode(
    updated,
    "latest validated commit",
    display.latestValidatedCommit
  );
  updated = replaceBulletCode(updated, "upstream baseline", display.upstream);
  updated = replaceBulletCode(
    updated,
    "recorded divergence baseline",
    display.recordedDivergence
  );
  updated = replaceSourceTreeDigest(updated, display);
  updated = replaceStrictStatePathList(updated, display.strictStatePaths);
  updated = replaceValidationSourceCommit(updated, display.validatedSourceCommit);
  updated = replaceStateSyncExpectation(updated, "branch", display.branch);
  updated = replaceStateSyncExpectation(
    updated,
    "upstream",
    display.upstream
  );
  updated = replaceStateSyncExpectation(
    updated,
    "validated source commit",
    display.validatedSourceCommit
  );
  updated = replaceStateSyncExpectation(
    updated,
    "recorded divergence baseline",
    display.recordedDivergence
  );
  updated = replaceStateSyncExpectation(
    updated,
    "transition",
    display.transitionKind
  );
  updated = replaceValidatedSourceDivergenceExpectation(
    updated,
    display.validatedSourceDivergenceExpectation
  );

  return updated;
}

function updateAgentBoardFields(text: string, display: DisplayFields): string {
  let updated = text;
  updated = replaceHeadingValueIfPresent(updated, "Branch:", display.branch);
  updated = replaceHeadingValueIfPresent(
    updated,
    "Current branch:",
    display.branch
  );
  updated = replaceHeadingValueIfPresent(
    updated,
    "Current head:",
    display.currentHead
  );
  updated = replaceHeadingValueIfPresent(
    updated,
    "Validated source commit:",
    display.validatedSourceCommit
  );
  updated = replaceHeadingValueIfPresent(
    updated,
    "Current validated source:",
    display.validatedSourceCommit
  );
  updated = replaceHeadingValueIfPresent(
    updated,
    "Latest validated commit:",
    display.latestValidatedCommit
  );
  updated = replaceHeadingValueIfPresent(
    updated,
    "Upstream baseline:",
    display.upstream
  );
  updated = replaceHeadingValueIfPresent(
    updated,
    "Upstream divergence baseline:",
    display.recordedDivergence
  );
  updated = replaceHeadingValueIfPresent(
    updated,
    "Recorded divergence baseline:",
    display.recordedDivergence
  );
  updated = replaceHeadingValueIfPresent(
    updated,
    "Transition:",
    display.transitionKind
  );
  updated = replaceHeadingValueIfPresent(
    updated,
    "Current transition:",
    display.transitionKind
  );

  return updated;
}

function updateVolatileAgentBoardProse(
  filePath: string,
  text: string,
  display: DisplayFields
): string {
  if (
    display.branch !== "main"
    || display.transitionKind !== "state_only_pushed"
  ) {
    return text;
  }

  if (filePath === ".agent_board/RUN_STATE.md") {
    return replaceLineIfPresent(
      text,
      /^Status: .*$/m,
      "Status: Main state-sync record is current and pushed."
    );
  }

  if (filePath === ".agent_board/TASK_QUEUE.md") {
    return replaceSectionIfPresent(
      replaceSectionIfPresent(
        text,
        "Current task:",
        "Done:",
        [
          "Current task:",
          "",
          "- Keep state-sync structured record automation current; no post-merge",
          "  reanchor is pending.",
          ""
        ].join("\n")
      ),
      "Todo:",
      "Blocked until separately authorized:",
      [
        "Todo:",
        "",
        "- use focused PRs for the next governance semantic changes unless separately",
        "  authorized",
        ""
      ].join("\n")
    );
  }

  return text;
}

function upsertGeneratedDisplayBlock(
  text: string,
  display: DisplayFields
): string {
  const block = renderGeneratedDisplayBlock(display);
  const pattern = new RegExp(
    `${escapeRegExp(DISPLAY_START)}[\\s\\S]*?${escapeRegExp(DISPLAY_END)}`
  );
  if (pattern.test(text)) {
    return text.replace(pattern, block);
  }

  return `${text.trimEnd()}\n\n${block}\n`;
}

function renderGeneratedDisplayBlock(display: DisplayFields): string {
  return [
    DISPLAY_START,
    "Generated from `docs/current/state-sync-record.json`.",
    "",
    `- branch: \`${display.branch}\``,
    `- upstream: \`${display.upstream}\``,
    `- validated source commit: \`${display.validatedSourceCommit}\``,
    `- latest validated commit: \`${display.latestValidatedCommit}\``,
    `- recorded divergence baseline: \`${display.recordedDivergence}\``,
    `- transition: \`${display.transitionKind}\``,
    DISPLAY_END
  ].join("\n");
}

function replaceTableField(text: string, field: string, value: string): string {
  const pattern = new RegExp(
    `(\\| ${escapeRegExp(field)} \\| \`)[^\`\\r\\n]*(\` \\|)`
  );
  return replaceRequired(text, pattern, `$table:${field}`, (_match, start, end) =>
    `${start}${value}${end}`
  );
}

function replaceBulletCode(text: string, label: string, value: string): string {
  const pattern = new RegExp(`(- ${escapeRegExp(label)}: \`)[^\`\\r\\n]*(\`)`);
  return replaceRequired(text, pattern, `$bullet:${label}`, (_match, start, end) =>
    `${start}${value}${end}`
  );
}

function replaceSourceTreeDigest(
  text: string,
  display: DisplayFields
): string {
  const pattern = /(- source tree digest: `)[^`\r\n]+(`\r?\n  `)[^`\r\n]+(`)/;
  return replaceRequired(
    text,
    pattern,
    "$source-tree-digest",
    (_match, start, middle, end) =>
      `${start}${display.sourceTreeDigestAlgorithm}${middle}${display.sourceTreeDigestValue}${end}`
  );
}

function replaceStrictStatePathList(text: string, paths: string[]): string {
  const pattern = /(Strict state record paths:\r?\n\r?\n)(?:- `[^`\r\n]+`\r?\n)+/;
  return replaceRequired(text, pattern, "$strict-state-paths", (_match, start) =>
    `${start}${paths.map((path) => `- \`${path}\``).join("\n")}\n`
  );
}

function replaceValidationSourceCommit(text: string, commit: string): string {
  const pattern = /(Validation recorded for source commit `)[^`\r\n]+(`:)/;
  return replaceRequired(
    text,
    pattern,
    "$validation-source-commit",
    (_match, start, end) => `${start}${commit}${end}`
  );
}

function replaceStateSyncExpectation(
  text: string,
  label: string,
  value: string
): string {
  const pattern = new RegExp(`(- ${escapeRegExp(label)}: \`)[^\`\\r\\n]*(\`)`);
  return replaceInSection(
    text,
    "## State Sync Expectations",
    pattern,
    `$expectation:${label}`,
    (_match, start, end) => `${start}${value}${end}`
  );
}

function replaceValidatedSourceDivergenceExpectation(
  text: string,
  value: string
): string {
  const pattern = /(?:For this|After the state record is pushed, Git observation should compute)[\s\S]*?source divergence as\s*`[^`\r\n]+`\s*against\s*`[^`\r\n]+`[\s\S]*?\./;
  return replaceInSection(
    text,
    "## State Sync Expectations",
    pattern,
    "$validated-source-divergence-expectation",
    () => value
  );
}

function replaceHeadingValueIfPresent(
  text: string,
  heading: string,
  value: string
): string {
  const pattern = new RegExp(
    `(${escapeRegExp(heading)}\\r?\\n\\r?\\n- \`)[^\`\\r\\n]*(\`)`
  );
  if (!pattern.test(text)) {
    return text;
  }

  return text.replace(pattern, (_match, start, end) => `${start}${value}${end}`);
}

function replaceLineIfPresent(
  text: string,
  pattern: RegExp,
  replacement: string
): string {
  return pattern.test(text) ? text.replace(pattern, replacement) : text;
}

function replaceSectionIfPresent(
  text: string,
  startMarker: string,
  endMarker: string,
  replacement: string
): string {
  const startIndex = text.indexOf(startMarker);
  if (startIndex < 0) {
    return text;
  }

  const endIndex = text.indexOf(endMarker, startIndex);
  if (endIndex < 0) {
    return text;
  }

  return `${text.slice(0, startIndex)}${replacement}${text.slice(endIndex)}`;
}

function replaceRequired(
  text: string,
  pattern: RegExp,
  label: string,
  replacement: (...args: string[]) => string
): string {
  let matched = false;
  const updated = text.replace(pattern, (...args) => {
    matched = true;
    return replacement(...args.map(String));
  });
  if (!matched) {
    throw new Error(`State-sync display field not found: ${label}`);
  }

  return updated;
}

function replaceInSection(
  text: string,
  heading: string,
  pattern: RegExp,
  label: string,
  replacement: (...args: string[]) => string
): string {
  const headingIndex = text.indexOf(heading);
  if (headingIndex < 0) {
    throw new Error(`State-sync display section not found: ${heading}`);
  }

  const before = text.slice(0, headingIndex);
  const section = text.slice(headingIndex);
  return before + replaceRequired(section, pattern, label, replacement);
}

function formatDivergence(input: { ahead: number; behind: number }): string {
  return `ahead ${input.ahead} / behind ${input.behind}`;
}

function validatedSourceDivergenceExpectation(
  claim: StateSyncClaim,
  recordedDivergence: string
): string {
  const upstream = normalizeClaimUpstreamRef(claim.subject.upstream);
  if (claim.transition.kind === "state_only_pushed") {
    const pushedDivergence = formatDivergence({
      ahead: claim.source.recordedDivergence.behind,
      behind: claim.source.recordedDivergence.ahead
    });
    return [
      "For this `state_only_pushed` state-only record, Git observation should",
      `compute the validated source divergence as \`${pushedDivergence}\` against`,
      `\`${upstream}\` after the state-only record is on upstream.`
    ].join("\n");
  }

  if (claim.transition.kind === "state_only_pending_push") {
    return [
      `For this \`state_only_pending_push\` record on branch \`${claim.subject.branch}\`,`,
      "Git observation should compute the validated source divergence as",
      `\`${recordedDivergence}\` against \`${upstream}\` before the state-only`,
      "record is pushed."
    ].join("\n");
  }

  return [
    `For this \`${claim.transition.kind}\` record, Git observation should compute`,
    `the validated source divergence as \`${recordedDivergence}\` against`,
    `\`${upstream}\` at the validated source commit.`
  ].join("\n");
}

function stateRecordModeForTransition(kind: StateSyncClaim["transition"]["kind"]): string {
  if (kind === "state_only_pending_push" || kind === "state_only_pushed") {
    return "state-only descendant allowed";
  }

  return kind;
}

function normalizeClaimUpstreamRef(ref: string): string {
  return ref.startsWith("origin/") ? `refs/remotes/${ref}` : ref;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function read(cwd: string, filePath: string): Promise<string> {
  return readFile(join(cwd, filePath), "utf8");
}

async function main(): Promise<void> {
  const write = process.argv.includes("--write");
  const check = process.argv.includes("--check") || !write;
  if (write && check && process.argv.includes("--check")) {
    throw new Error("Use either --check or --write, not both");
  }

  const result = await syncStateSyncDisplay(process.cwd(), { write });
  console.log(JSON.stringify(result, null, 2));
  if (!write && result.changedPaths.length > 0) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      "State sync display sync failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
