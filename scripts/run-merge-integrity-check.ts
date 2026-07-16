#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const AUTHORIZATION_MARKER = "codex-router-merge-authorization:v1";
const AUTHORIZATION_BLOCK = new RegExp(
  String.raw`<!--\s*${AUTHORIZATION_MARKER}\s*\r?\n([\s\S]*?)\r?\n\s*-->`,
  "g"
);
const AUTHORIZATION_PREFIX = new RegExp(
  String.raw`<!--\s*${AUTHORIZATION_MARKER}`,
  "g"
);
const MAX_GITHUB_PAGES = 10;
const GITHUB_PAGE_SIZE = 100;
const AUTHORIZATION_CLOCK_SKEW_MS = 60_000;
const AUTHORIZATION_MAX_AGE_MS = 15 * 60_000;
export const MERGE_INTEGRITY_STATUS_CONTEXT = "Merge Integrity";

const LOCK_MARKERS = [
  { id: "must_remain_draft", pattern: /\bmust\s+remain\s+draft\b/iu },
  { id: "do_not_merge", pattern: /\bdo\s+not\s+merge\b/iu },
  { id: "dont_merge", pattern: /\bdon['’]t\s+merge\b/iu },
  { id: "must_keep_draft_zh", pattern: /必须(?:保持|维持)\s*(?:为\s*)?draft/iu },
  { id: "do_not_merge_zh", pattern: /不得合并/u },
  { id: "forbid_merge_zh", pattern: /禁止合并/u }
] as const;

const TRUSTED_ASSOCIATIONS = new Set(["OWNER", "MEMBER", "COLLABORATOR"]);

export interface MergeAuthorizationScope {
  operation: "merge";
  baseRef: string;
}

export interface MergeAuthorization {
  schemaVersion: 1;
  decision: "unlock";
  repository: string;
  pullRequest: number;
  headSha: string;
  approver: string;
  approvedAt: string;
  scope: MergeAuthorizationScope;
}

export interface MergeIntegrityComment {
  id: string;
  body: string;
  authorLogin: string;
  authorAssociation: string;
  createdAt: string;
}

export interface MergeIntegrityInput {
  repository: string;
  pullRequest: number;
  baseRef: string;
  headSha: string;
  body: string;
  allowedApprovers: string[];
  comments: MergeIntegrityComment[];
}

export interface MergeIntegrityAuthorizationEvidence {
  source: "comment";
  sourceId: string;
  approver: string;
  approvedAt: string;
  scope: MergeAuthorizationScope;
  headSha: string;
}

export interface MergeIntegrityResult {
  status: "passed" | "blocked";
  lockActive: boolean;
  reason:
    | "no_active_merge_lock"
    | "merge_lock_authorized"
    | "merge_lock_active"
    | "invalid_authorization_claim"
    | "invalid_gate_input";
  matchedMarkers: string[];
  authorization?: MergeIntegrityAuthorizationEvidence;
}

interface AuthorizationBlockParseResult {
  claims: MergeAuthorization[];
  malformed: boolean;
}

export interface PullRequestEventFacts {
  repository: string;
  pullRequest: number;
  baseRef: string;
  headSha: string;
  body: string;
}

export type MergeIntegrityGateRun =
  | {
    mode: "not_applicable";
    reason: "event" | "base";
  }
  | {
    mode: "evaluated";
    result: MergeIntegrityResult;
  };

type FetchLike = typeof fetch;

export function findMergeLockMarkers(body: string): string[] {
  return LOCK_MARKERS
    .filter(({ pattern }) => pattern.test(body))
    .map(({ id }) => id);
}

export function evaluateMergeIntegrity(
  input: MergeIntegrityInput
): MergeIntegrityResult {
  const matchedMarkers = findMergeLockMarkers(input.body);
  if (!validGateInput(input)) {
    return {
      status: "blocked",
      lockActive: matchedMarkers.length > 0,
      reason: "invalid_gate_input",
      matchedMarkers
    };
  }

  if (matchedMarkers.length === 0) {
    return {
      status: "passed",
      lockActive: false,
      reason: "no_active_merge_lock",
      matchedMarkers
    };
  }

  const allowedApprovers = new Set(
    input.allowedApprovers.map(normalizeLogin)
  );
  let trustedMalformedClaim = false;

  for (const comment of input.comments) {
    if (
      !allowedApprovers.has(normalizeLogin(comment.authorLogin))
      || !TRUSTED_ASSOCIATIONS.has(comment.authorAssociation)
    ) {
      continue;
    }

    const parsed = parseAuthorizationBlocks(comment.body);
    trustedMalformedClaim ||= parsed.malformed;
    for (const claim of parsed.claims) {
      if (validCommentAuthorization(input, comment, claim, allowedApprovers)) {
        return authorizedResult(matchedMarkers, comment.id, claim);
      }
      trustedMalformedClaim = true;
    }
  }

  return {
    status: "blocked",
    lockActive: true,
    reason: trustedMalformedClaim
      ? "invalid_authorization_claim"
      : "merge_lock_active",
    matchedMarkers
  };
}

export async function collectMergeIntegrityInput(
  event: unknown,
  options: {
    token: string;
    allowedApprovers: string[];
    apiUrl?: string;
    fetchImpl?: FetchLike;
  }
): Promise<MergeIntegrityInput> {
  const facts = await resolvePullRequestEventFacts(event, options);
  return collectMergeIntegrityInputForFacts(facts, options);
}

export async function resolvePullRequestEventFacts(
  event: unknown,
  options: {
    token: string;
    apiUrl?: string;
    fetchImpl?: FetchLike;
  }
): Promise<PullRequestEventFacts> {
  if (isRecord(event) && isRecord(event.pull_request)) {
    return parsePullRequestTargetEvent(event);
  }
  const envelope = parseIssueCommentEvent(event);
  if (options.token.trim() === "") {
    throw new Error("github_token_missing_for_pull_request_refresh");
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiUrl = normalizedApiUrl(options.apiUrl);
  const encodedRepository = encodeRepository(envelope.repository);
  const response = await fetchImpl(
    `${apiUrl}/repos/${encodedRepository}/pulls/${envelope.pullRequest}`,
    githubRequest(options.token)
  );
  if (!response.ok) {
    throw new Error(`github_pull_request_failed_status_${response.status}`);
  }
  const pullRequest = await response.json() as unknown;
  return parsePullRequestRecord(
    envelope.repository,
    pullRequest,
    envelope.pullRequest
  );
}

export async function publishMergeIntegrityStatus(
  input: {
    repository: string;
    headSha: string;
    state: "pending" | "success" | "failure";
    description: string;
    token: string;
    apiUrl?: string;
    fetchImpl?: FetchLike;
  }
): Promise<void> {
  if (
    !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(input.repository)
    || !isFullSha(input.headSha)
    || input.token.trim() === ""
    || input.description.length === 0
    || input.description.length > 140
  ) {
    throw new Error("github_commit_status_input_invalid");
  }
  const fetchImpl = input.fetchImpl ?? fetch;
  const apiUrl = normalizedApiUrl(input.apiUrl);
  const encodedRepository = encodeRepository(input.repository);
  const response = await fetchImpl(
    `${apiUrl}/repos/${encodedRepository}/statuses/${input.headSha}`,
    {
      headers: {
        ...githubHeaders(input.token),
        "content-type": "application/json"
      },
      method: "POST",
      body: JSON.stringify({
        state: input.state,
        description: input.description,
        context: MERGE_INTEGRITY_STATUS_CONTEXT
      })
    }
  );
  if (!response.ok) {
    throw new Error(`github_commit_status_failed_status_${response.status}`);
  }
}

export async function runMergeIntegrityGate(
  event: unknown,
  options: {
    eventName: string;
    token: string;
    allowedApprovers: string[];
    apiUrl?: string;
    fetchImpl?: FetchLike;
  }
): Promise<MergeIntegrityGateRun> {
  if (!isMergeIntegrityEventName(options.eventName)) {
    return { mode: "not_applicable", reason: "event" };
  }
  const facts = await resolvePullRequestEventFacts(event, options);
  if (facts.baseRef !== "main") {
    return { mode: "not_applicable", reason: "base" };
  }
  const statusInput = {
    repository: facts.repository,
    headSha: facts.headSha,
    token: options.token,
    ...(options.apiUrl === undefined ? {} : { apiUrl: options.apiUrl }),
    ...(options.fetchImpl === undefined
      ? {}
      : { fetchImpl: options.fetchImpl })
  };
  await publishMergeIntegrityStatus({
    ...statusInput,
    state: "pending",
    description: "Merge authorization evaluation in progress."
  });
  try {
    const input = await collectMergeIntegrityInputForFacts(facts, options);
    const result = evaluateMergeIntegrity(input);
    await publishMergeIntegrityStatus({
      ...statusInput,
      state: result.status === "passed" ? "success" : "failure",
      description: result.status === "passed"
        ? "Merge authorization evaluation passed."
        : `Merge authorization blocked: ${result.reason}.`
    });
    return { mode: "evaluated", result };
  } catch (error) {
    try {
      await publishMergeIntegrityStatus({
        ...statusInput,
        state: "failure",
        description: "Merge authorization evaluation failed closed."
      });
    } catch {
      // Keep the pending status and fail the trusted workflow when publishing fails.
    }
    throw error;
  }
}

async function collectMergeIntegrityInputForFacts(
  facts: PullRequestEventFacts,
  options: {
    token: string;
    allowedApprovers: string[];
    apiUrl?: string;
    fetchImpl?: FetchLike;
  }
): Promise<MergeIntegrityInput> {
  const baseInput: MergeIntegrityInput = {
    ...facts,
    allowedApprovers: options.allowedApprovers,
    comments: []
  };

  if (findMergeLockMarkers(facts.body).length === 0) {
    return baseInput;
  }
  if (options.token.trim() === "") {
    throw new Error("github_token_missing_for_active_merge_lock");
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const apiUrl = normalizedApiUrl(options.apiUrl);
  const encodedRepository = encodeRepository(facts.repository);
  const comments = await fetchAllPages(
    `${apiUrl}/repos/${encodedRepository}/issues/${facts.pullRequest}/comments`,
    options.token,
    fetchImpl
  );
  return {
    ...baseInput,
    comments: comments.map(parseComment)
  };
}

function validGateInput(input: MergeIntegrityInput): boolean {
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(input.repository)
    && Number.isSafeInteger(input.pullRequest)
    && input.pullRequest > 0
    && /^[A-Za-z0-9][A-Za-z0-9._/-]*$/u.test(input.baseRef)
    && isFullSha(input.headSha)
    && input.allowedApprovers.length > 0
    && input.allowedApprovers.every((login) => /^[A-Za-z0-9-]+$/u.test(login));
}

function validCommentAuthorization(
  input: MergeIntegrityInput,
  comment: MergeIntegrityComment,
  claim: MergeAuthorization,
  allowedApprovers: Set<string>
): boolean {
  return validCommonAuthorization(input, claim, allowedApprovers)
    && sameSha(claim.headSha, input.headSha)
    && normalizeLogin(claim.approver) === normalizeLogin(comment.authorLogin)
    && authorizationTimeMatches(claim.approvedAt, comment.createdAt);
}

function validCommonAuthorization(
  input: MergeIntegrityInput,
  claim: MergeAuthorization,
  allowedApprovers: Set<string>
): boolean {
  return claim.schemaVersion === 1
    && claim.decision === "unlock"
    && claim.repository === input.repository
    && claim.pullRequest === input.pullRequest
    && allowedApprovers.has(normalizeLogin(claim.approver))
    && claim.scope.operation === "merge"
    && claim.scope.baseRef === input.baseRef;
}

function authorizationTimeMatches(declared: string, observed: string): boolean {
  const declaredMs = Date.parse(declared);
  const observedMs = Date.parse(observed);
  if (!Number.isFinite(declaredMs) || !Number.isFinite(observedMs)) {
    return false;
  }
  const ageMs = observedMs - declaredMs;
  return ageMs >= -AUTHORIZATION_CLOCK_SKEW_MS
    && ageMs <= AUTHORIZATION_MAX_AGE_MS;
}

function authorizedResult(
  matchedMarkers: string[],
  sourceId: string,
  claim: MergeAuthorization
): MergeIntegrityResult {
  return {
    status: "passed",
    lockActive: true,
    reason: "merge_lock_authorized",
    matchedMarkers,
    authorization: {
      source: "comment",
      sourceId,
      approver: claim.approver,
      approvedAt: claim.approvedAt,
      scope: claim.scope,
      headSha: claim.headSha
    }
  };
}

function parseAuthorizationBlocks(text: string): AuthorizationBlockParseResult {
  const prefixCount = [...text.matchAll(AUTHORIZATION_PREFIX)].length;
  const matches = [...text.matchAll(AUTHORIZATION_BLOCK)];
  const claims: MergeAuthorization[] = [];
  let malformed = prefixCount !== matches.length;

  for (const match of matches) {
    const rawJson = match[1];
    if (rawJson === undefined) {
      malformed = true;
      continue;
    }
    try {
      const claim = parseAuthorization(JSON.parse(rawJson) as unknown);
      if (claim === undefined) {
        malformed = true;
      } else {
        claims.push(claim);
      }
    } catch {
      malformed = true;
    }
  }

  return { claims, malformed };
}

function parseAuthorization(value: unknown): MergeAuthorization | undefined {
  if (!isRecord(value) || !hasExactKeys(value, [
    "schemaVersion",
    "decision",
    "repository",
    "pullRequest",
    "headSha",
    "approver",
    "approvedAt",
    "scope"
  ])) {
    return undefined;
  }
  const scope = value.scope;
  if (!isRecord(scope) || !hasExactKeys(scope, ["operation", "baseRef"])) {
    return undefined;
  }
  if (
    value.schemaVersion !== 1
    || value.decision !== "unlock"
    || typeof value.repository !== "string"
    || !Number.isSafeInteger(value.pullRequest)
    || typeof value.pullRequest !== "number"
    || typeof value.headSha !== "string"
    || !isFullSha(value.headSha)
    || typeof value.approver !== "string"
    || typeof value.approvedAt !== "string"
    || scope.operation !== "merge"
    || typeof scope.baseRef !== "string"
  ) {
    return undefined;
  }
  return {
    schemaVersion: 1,
    decision: "unlock",
    repository: value.repository,
    pullRequest: value.pullRequest,
    headSha: value.headSha,
    approver: value.approver,
    approvedAt: value.approvedAt,
    scope: {
      operation: "merge",
      baseRef: scope.baseRef
    }
  };
}

function parsePullRequestTargetEvent(event: unknown): PullRequestEventFacts {
  if (!isRecord(event)) {
    throw new Error("pull_request_event_invalid");
  }
  const repository = event.repository;
  const pullRequest = event.pull_request;
  if (!isRecord(repository) || !isRecord(pullRequest)) {
    throw new Error("pull_request_event_invalid");
  }
  if (typeof repository.full_name !== "string") {
    throw new Error("pull_request_event_invalid");
  }
  return parsePullRequestRecord(repository.full_name, pullRequest);
}

function parsePullRequestRecord(
  repository: string,
  pullRequest: unknown,
  expectedNumber?: number
): PullRequestEventFacts {
  if (!isRecord(pullRequest)) {
    throw new Error("pull_request_event_invalid");
  }
  const head = pullRequest.head;
  const base = pullRequest.base;
  if (!isRecord(head) || !isRecord(base)) {
    throw new Error("pull_request_event_invalid");
  }
  if (
    typeof pullRequest.number !== "number"
    || !Number.isSafeInteger(pullRequest.number)
    || typeof head.sha !== "string"
    || typeof base.ref !== "string"
    || (pullRequest.body !== null && typeof pullRequest.body !== "string")
  ) {
    throw new Error("pull_request_event_invalid");
  }
  if (expectedNumber !== undefined && pullRequest.number !== expectedNumber) {
    throw new Error("pull_request_event_invalid");
  }
  return {
    repository,
    pullRequest: pullRequest.number,
    baseRef: base.ref,
    headSha: head.sha,
    body: pullRequest.body ?? ""
  };
}

function parseIssueCommentEvent(event: unknown): {
  repository: string;
  pullRequest: number;
} {
  if (!isRecord(event) || !isRecord(event.repository) || !isRecord(event.issue)) {
    throw new Error("pull_request_comment_event_invalid");
  }
  if (
    typeof event.repository.full_name !== "string"
    || typeof event.issue.number !== "number"
    || !Number.isSafeInteger(event.issue.number)
    || !isRecord(event.issue.pull_request)
  ) {
    throw new Error("pull_request_comment_event_invalid");
  }
  return {
    repository: event.repository.full_name,
    pullRequest: event.issue.number
  };
}

async function fetchAllPages(
  url: string,
  token: string,
  fetchImpl: FetchLike
): Promise<unknown[]> {
  const values: unknown[] = [];
  for (let page = 1; page <= MAX_GITHUB_PAGES; page += 1) {
    const response = await fetchImpl(
      `${url}?per_page=${GITHUB_PAGE_SIZE}&page=${page}`,
      githubRequest(token)
    );
    if (!response.ok) {
      throw new Error(`github_inventory_failed_status_${response.status}`);
    }
    const parsed = await response.json() as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error("github_inventory_invalid");
    }
    values.push(...parsed);
    if (parsed.length < GITHUB_PAGE_SIZE) {
      return values;
    }
  }
  throw new Error("github_inventory_page_limit_exceeded");
}

function normalizedApiUrl(value: string | undefined): string {
  return (value ?? "https://api.github.com").replace(/\/$/u, "");
}

function encodeRepository(repository: string): string {
  return repository.split("/").map(encodeURIComponent).join("/");
}

function githubRequest(token: string): RequestInit {
  return {
    headers: githubHeaders(token)
  };
}

function githubHeaders(token: string): Record<string, string> {
  return {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${token}`,
    "x-github-api-version": "2022-11-28"
  };
}

function parseComment(value: unknown): MergeIntegrityComment {
  if (!isRecord(value) || !isRecord(value.user)) {
    throw new Error("github_comment_inventory_invalid");
  }
  if (
    (typeof value.id !== "number" && typeof value.id !== "string")
    || typeof value.body !== "string"
    || typeof value.user.login !== "string"
    || typeof value.author_association !== "string"
    || typeof value.created_at !== "string"
  ) {
    throw new Error("github_comment_inventory_invalid");
  }
  return {
    id: String(value.id),
    body: value.body,
    authorLogin: value.user.login,
    authorAssociation: value.author_association,
    createdAt: value.created_at
  };
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFullSha(value: string): boolean {
  return /^[0-9a-f]{40}$/iu.test(value);
}

function sameSha(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

function normalizeLogin(value: string): string {
  return value.toLowerCase();
}

function formatResult(result: MergeIntegrityResult): string {
  const lines = [
    "Merge integrity gate",
    `status: ${result.status}`,
    `lock active: ${result.lockActive}`,
    `reason: ${result.reason}`,
    `matched markers: ${result.matchedMarkers.join(",") || "none"}`
  ];
  if (result.authorization !== undefined) {
    lines.push(
      `authorization source: ${result.authorization.source}`,
      `authorization source id: ${result.authorization.sourceId}`,
      `authorization approver: ${result.authorization.approver}`,
      `authorization time: ${result.authorization.approvedAt}`,
      `authorization scope: ${result.authorization.scope.operation}:${result.authorization.scope.baseRef}`,
      `authorization head binding: ${result.authorization.headSha}`
    );
  }
  return lines.join("\n");
}

export function isMergeIntegrityEventName(value: string): boolean {
  return value === "pull_request_target" || value === "issue_comment";
}

async function main(): Promise<void> {
  const eventPath = process.env.GITHUB_EVENT_PATH?.trim() ?? "";
  const eventName = process.env.GITHUB_EVENT_NAME ?? "";
  if (isMergeIntegrityEventName(eventName) && eventPath === "") {
    throw new Error("github_event_path_missing");
  }
  const event = eventPath === ""
    ? undefined
    : JSON.parse(await readFile(eventPath, "utf8")) as unknown;
  const allowedApprovers = (process.env.MERGE_INTEGRITY_ALLOWED_APPROVERS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const run = await runMergeIntegrityGate(event, {
    eventName,
    token: process.env.GITHUB_TOKEN ?? "",
    allowedApprovers,
    ...(process.env.GITHUB_API_URL === undefined
      ? {}
      : { apiUrl: process.env.GITHUB_API_URL })
  });
  if (run.mode === "not_applicable") {
    console.log(`Merge integrity gate\nstatus: passed\nreason: not_applicable_${run.reason}`);
    return;
  }
  console.log(formatResult(run.result));
  if (run.result.status !== "passed") {
    process.exitCode = 1;
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    const reason = error instanceof Error ? error.message : "unknown_merge_integrity_error";
    console.error(`Merge integrity gate failed closed: ${reason}`);
    process.exitCode = 1;
  });
}
