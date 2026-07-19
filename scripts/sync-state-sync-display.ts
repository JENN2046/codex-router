#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  parseStateSyncClaim,
  parseStateSyncPolicyV2Claim,
  type StateSyncPolicyV2Claim,
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
  authority: "display_only";
  authoritativeClaimPath: typeof STATE_SYNC_RECORD_DOC;
  checkedPaths: string[];
  changedPaths: string[];
  mode: "check" | "write";
  requiredForAudit: false;
}

interface DisplayFields {
  schemaVersion: string;
  policyVersion: string;
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
  statePathListHeading: string;
  strictStatePaths: string[];
  validatedSourceDivergenceExpectation: string;
}

export async function syncStateSyncDisplay(
  cwd = process.cwd(),
  options: StateSyncDisplaySyncOptions = {}
): Promise<StateSyncDisplaySyncResult> {
  const claimText = await read(cwd, STATE_SYNC_RECORD_DOC);
  const parsedClaim = parseStateSyncClaim(claimText);
  const parsedPolicyV2Claim = parseStateSyncPolicyV2Claim(claimText);
  if (parsedClaim.status !== "valid") {
    if (parsedPolicyV2Claim.status !== "valid") {
      throw new Error(`Cannot sync state-sync display from ${parsedClaim.status} claim`);
    }
  }

  const display = parsedClaim.status === "valid"
    ? displayFieldsFromClaim(parsedClaim.claim)
    : parsedPolicyV2Claim.status === "valid"
      ? displayFieldsFromPolicyV2Claim(parsedPolicyV2Claim.claim)
      : undefined;
  if (display === undefined) {
    throw new Error(`Cannot sync state-sync display from ${parsedClaim.status} claim`);
  }
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
    authority: "display_only",
    authoritativeClaimPath: STATE_SYNC_RECORD_DOC,
    checkedPaths,
    changedPaths,
    mode: options.write === true ? "write" : "check",
    requiredForAudit: false
  };
}

function displayFieldsFromClaim(claim: StateSyncClaim): DisplayFields {
  const recordedDivergence = formatDivergence(claim.source.recordedDivergence);

  return {
    schemaVersion: String(claim.schemaVersion),
    policyVersion: claim.policyVersion,
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
    statePathListHeading: "Strict state record paths:",
    strictStatePaths: claim.transition.allowedStatePaths,
    validatedSourceDivergenceExpectation:
      validatedSourceDivergenceExpectation(claim, recordedDivergence)
  };
}

function displayFieldsFromPolicyV2Claim(claim: StateSyncPolicyV2Claim): DisplayFields {
  return {
    schemaVersion: String(claim.schemaVersion),
    policyVersion: claim.policyVersion,
    branch: "content-attestation",
    upstream: "refs/remotes/origin/main",
    currentHead: "observed at audit time",
    validatedSourceCommit: "content digest only",
    latestValidatedCommit: "content digest only",
    recordedDivergence: "observed at audit time",
    transitionKind: "content_attestation",
    stateRecordMode: "content attestation",
    sourceTreeDigestAlgorithm: claim.source.sourceTreeDigest.algorithm,
    sourceTreeDigestValue: claim.source.sourceTreeDigest.value,
    statePathListHeading: "Source digest excluded paths:",
    strictStatePaths: claim.source.sourceTreeDigest.excludedPaths,
    validatedSourceDivergenceExpectation:
      "Policy v2 records bind the filtered source tree digest to explicit "
      + "local, pull_request, and push contexts; branch identity, commit "
      + "identity, and divergence are audit-time observations."
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
  if (
    display.policyVersion === "state-sync-policy.v2"
    && standaloneLineIndex(text, "## Machine Authority") >= 0
  ) {
    return updateCompactPolicyV2CurrentState(text, display);
  }

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
  updated = replaceBulletCode(updated, "schema version", display.schemaVersion);
  updated = replaceBulletCode(updated, "policy version", display.policyVersion);
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
  updated = replaceStrictStatePathList(updated, display);
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
  updated = replaceSectionIfPresent(
    updated,
    "Current structured state-sync audit status:",
    "## Execution Boundary",
    renderCurrentStateAuditStatus(display)
  );

  return updated;
}

function updateCompactPolicyV2CurrentState(
  text: string,
  display: DisplayFields
): string {
  let updated = text;
  updated = replaceTableField(updated, "Schema", display.schemaVersion);
  updated = replaceTableField(updated, "Policy", display.policyVersion);
  updated = replaceTableField(
    updated,
    "Source tree digest",
    display.sourceTreeDigestValue
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
  let updated = updateAgentBoardStateSyncStatus(filePath, text, display);

  if (
    display.branch !== "main"
    || display.transitionKind !== "state_only_pushed"
  ) {
    return updated;
  }

  if (filePath === ".agent_board/RUN_STATE.md") {
    return replaceLineIfPresent(
      updated,
      /^Status: .*$/m,
      "Status: Main state-sync record is current and pushed."
    );
  }

  if (filePath === ".agent_board/TASK_QUEUE.md") {
    return replaceSectionIfPresent(
      replaceSectionIfPresent(
        updated,
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

  return updated;
}

function updateAgentBoardStateSyncStatus(
  filePath: string,
  text: string,
  display: DisplayFields
): string {
  if (filePath === ".agent_board/CHECKPOINT.md") {
    return replaceSectionBeforeMarkerOrNextSectionIfPresent(
      text,
      "State-sync observation:",
      DISPLAY_START,
      renderAgentBoardAuditStatus("State-sync observation:", display)
    );
  }

  if (filePath === ".agent_board/HANDOFF.md") {
    return replaceSectionIfPresent(
      text,
      "State-sync status:",
      "Not authorized:",
      renderAgentBoardAuditStatus("State-sync status:", display)
    );
  }

  if (filePath === ".agent_board/RUN_STATE.md") {
    return replaceSectionIfPresent(
      text,
      "State-sync audit expectation:",
      "Boundary:",
      renderAgentBoardAuditStatus("State-sync audit expectation:", display)
    );
  }

  if (filePath === ".agent_board/VALIDATION_LOG.md") {
    return replaceSectionIfPresent(
      text,
      "State-sync audit observation:",
      "Execution boundary:",
      renderAgentBoardAuditStatus("State-sync audit observation:", display)
    );
  }

  return text;
}

function renderCurrentStateAuditStatus(display: DisplayFields): string {
  return [
    "Current structured state-sync audit status:",
    "",
    ...renderStateSyncStatusBullets(display),
    "- Generated display, Markdown mirrors, and `.agent_board/*` mirrors are",
    "  optional operator-facing views derived from `docs/current/state-sync-record.json`.",
    "- Display drift is informational; branch-head audit reads the structured",
    "  record directly and does not require display sync.",
    ""
  ].join("\n");
}

function renderAgentBoardAuditStatus(
  heading: string,
  display: DisplayFields
): string {
  return [
    heading,
    "",
    ...renderStateSyncStatusBullets(display),
    ""
  ].join("\n");
}

function renderStateSyncStatusBullets(display: DisplayFields): string[] {
  if (display.policyVersion === "state-sync-policy.v2") {
    return [
      `- structured claim: \`${display.policyVersion}\` content attestation`,
      `- upstream target: \`${display.upstream}\``,
      "- source identity: filtered tree digest, not a recorded commit SHA",
      "- branch, commit, and divergence are observed by the audit at runtime",
      "- branch-head audit command:",
      "  `node --import tsx scripts/run-state-sync-audit.ts --json`",
      "- expected audit source: `claimSource: structured`",
      "- Source-tree digest, allowed context, clean worktree, and read-only",
      "  checks remain enforced by the state-sync audit."
    ];
  }

  return [
    "- compatibility path: legacy v1 state-only record",
    `- legacy structured claim: \`${display.branch}\` / \`${display.transitionKind}\` against`,
    `  \`${display.upstream}\``,
    `- validated source commit: \`${display.validatedSourceCommit}\``,
    `- latest validated commit: \`${display.latestValidatedCommit}\``,
    `- recorded divergence baseline: \`${display.recordedDivergence}\``,
    "- branch-head audit command:",
    "  `node --import tsx scripts/run-state-sync-audit.ts --json`",
    "- expected audit source: `claimSource: structured`",
    "- Git ancestry, divergence, source-tree digest, and strict state path",
    "  checks remain enforced by the state-sync audit."
  ];
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
    "Optional display generated from `docs/current/state-sync-record.json`.",
    "",
    `- schema version: \`${display.schemaVersion}\``,
    `- policy version: \`${display.policyVersion}\``,
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

function replaceStrictStatePathList(text: string, display: DisplayFields): string {
  const pattern =
    /((?:Strict state record paths|Source digest excluded paths):\r?\n\r?\n)(?:- `[^`\r\n]+`\r?\n)+/;
  return replaceRequired(text, pattern, "$state-path-list", () =>
    `${display.statePathListHeading}\n\n${
      display.strictStatePaths.map((path) => `- \`${path}\``).join("\n")
    }\n`
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
  const pattern = /(?:For this|When this PR branch state record is committed and pushed, Git observation should|After the state record is pushed, Git observation should compute|Git observation should compute|Policy v2 records bind)[\s\S]*?(?=\r?\n\r?\n|$)/;
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

function replaceSectionBeforeMarkerOrNextSectionIfPresent(
  text: string,
  startMarker: string,
  preferredEndMarker: string,
  replacement: string
): string {
  const startIndex = text.indexOf(startMarker);
  if (startIndex < 0) {
    return text;
  }

  const preferredEndIndex = text.indexOf(preferredEndMarker, startIndex);
  const nextSectionIndex = nextSectionIndexAfter(
    text,
    startIndex + startMarker.length
  );
  const endIndexCandidates = [
    preferredEndIndex >= 0 ? preferredEndIndex : undefined,
    nextSectionIndex
  ].filter((value): value is number => value !== undefined);
  const endIndex = endIndexCandidates.length > 0
    ? Math.min(...endIndexCandidates)
    : text.length;
  return `${text.slice(0, startIndex)}${replacement}${text.slice(endIndex)}`;
}

function nextSectionIndexAfter(
  text: string,
  startIndex: number
): number | undefined {
  const sectionPattern = /\n(?=(?:#{1,6} .+|[A-Z][A-Za-z0-9 -]+:)\r?\n)/g;
  sectionPattern.lastIndex = startIndex;
  const match = sectionPattern.exec(text);
  return match?.index === undefined ? undefined : match.index + 1;
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
  const headingIndex = standaloneLineIndex(text, heading);
  if (headingIndex < 0) {
    throw new Error(`State-sync display section not found: ${heading}`);
  }

  const before = text.slice(0, headingIndex);
  const section = text.slice(headingIndex);
  return before + replaceRequired(section, pattern, label, replacement);
}

function standaloneLineIndex(text: string, line: string): number {
  const pattern = new RegExp(`^${escapeRegExp(line)}\\s*$`, "m");
  const match = pattern.exec(text);
  return match?.index ?? -1;
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
      "For this legacy v1 `state_only_pushed` state-only compatibility record, Git",
      "observation should",
      `compute the validated source divergence as \`${pushedDivergence}\` against`,
      `\`${upstream}\` after the state-only record is on upstream. Policy v2`,
      "content attestations are the main path and do not require this reanchor",
      "prose."
    ].join("\n");
  }

  if (claim.transition.kind === "state_only_pending_push") {
    return [
      `For this legacy v1 \`state_only_pending_push\` compatibility record on branch \`${claim.subject.branch}\`,`,
      "Git observation should compute the validated source divergence as",
      `\`${recordedDivergence}\` against \`${upstream}\` before the state-only`,
      "record is pushed. Policy v2 content attestations are the main path and do",
      "not require this pending-push narrative."
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
