#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const LOCK_MARKER = "codex-router-merge-lock:v1";
const LOCK_BLOCK = new RegExp(
  String.raw`<!--\s*${LOCK_MARKER}\s*\r?\n([\s\S]*?)\r?\n\s*-->`,
  "g"
);
const LOCK_PREFIX = new RegExp(
  String.raw`<!--\s*${LOCK_MARKER}`,
  "g"
);
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
export const MERGE_LOCK_PROTECTED_PATHS = [
  ".github/actions/**",
  ".github/workflows/**",
  "package-lock.json",
  "package.json",
  "scripts/run-governance-check.ts",
  "scripts/run-merge-integrity-check.ts",
  "tests/merge-integrity-check.test.ts",
  "docs/governance/MERGE_INTEGRITY.md",
  "docs/governance/RELEASE_GATE_MATRIX.md"
] as const;

const PROTECTED_PATH_PREFIXES = [
  ".github/actions/",
  ".github/workflows/"
] as const;
const PROTECTED_EXACT_PATHS = new Set<string>(
  MERGE_LOCK_PROTECTED_PATHS.filter((path) => !path.endsWith("/**"))
);

const TRUSTED_ASSOCIATIONS = new Set(["OWNER", "MEMBER", "COLLABORATOR"]);

export interface MergeLockMetadata {
  schemaVersion: 1;
  lockId: string;
  repository: string;
  pullRequest: number;
  baseRef: string;
  reason: string;
  locked: true;
}

export interface MergeAuthorization {
  schemaVersion: 1;
  decision: "unlock";
  lockId: string;
  lockDigest: string;
  repository: string;
  pullRequest: number;
  baseRef: string;
  headSha: string;
  approver: string;
  approvedAt: string;
}

export interface MergeIntegrityComment {
  id: string;
  body: string;
  authorLogin: string;
  authorAssociation: string;
  createdAt: string;
  updatedAt: string;
}

export interface MergeIntegrityInput {
  repository: string;
  pullRequest: number;
  baseRef: string;
  headSha: string;
  body: string;
  changedPaths: string[];
  allowedApprovers: string[];
  comments: MergeIntegrityComment[];
}

export interface MergeIntegrityAuthorizationEvidence {
  source: "comment";
  sourceId: string;
  approver: string;
  approvedAt: string;
  commentUpdatedAt: string;
  lockId: string;
  lockDigest: string;
  baseRef: string;
  headSha: string;
}

export interface MergeIntegrityLockEvidence {
  lockId: string;
  lockDigest: string;
}

export interface MergeIntegrityResult {
  status: "passed" | "blocked";
  lockRequired: boolean;
  lockActive: boolean;
  reason:
    | "no_merge_lock_required"
    | "merge_lock_authorized"
    | "merge_lock_metadata_required"
    | "invalid_merge_lock_metadata"
    | "merge_lock_active"
    | "invalid_unlock_claim"
    | "invalid_gate_input";
  protectedPaths: string[];
  lock?: MergeIntegrityLockEvidence;
  authorization?: MergeIntegrityAuthorizationEvidence;
}

interface LockBlockParseResult {
  lock?: MergeLockMetadata;
  present: boolean;
  malformed: boolean;
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

export interface MergeIntegrityGateOptions {
  eventName: string;
  token: string;
  allowedApprovers: string[];
  apiUrl?: string;
  fetchImpl?: FetchLike;
}

export interface MergeIntegrityCommandRun {
  run: MergeIntegrityGateRun;
  output: string;
}

export function isMergeLockProtectedPath(path: string): boolean {
  return PROTECTED_EXACT_PATHS.has(path)
    || PROTECTED_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export function computeMergeLockDigest(lock: MergeLockMetadata): string {
  const canonical = JSON.stringify({
    schemaVersion: lock.schemaVersion,
    lockId: lock.lockId,
    repository: lock.repository,
    pullRequest: lock.pullRequest,
    baseRef: lock.baseRef,
    reason: lock.reason,
    locked: lock.locked
  });
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

export function evaluateMergeIntegrity(
  input: MergeIntegrityInput
): MergeIntegrityResult {
  const protectedPaths = collectProtectedPaths(input.changedPaths);
  const lockRequired = protectedPaths.length > 0;
  const parsedLock = parseLockBlock(input.body);
  if (!validGateInput(input)) {
    return {
      status: "blocked",
      lockRequired,
      lockActive: parsedLock.present,
      reason: "invalid_gate_input",
      protectedPaths
    };
  }

  if (parsedLock.malformed) {
    return {
      status: "blocked",
      lockRequired,
      lockActive: true,
      reason: "invalid_merge_lock_metadata",
      protectedPaths
    };
  }

  if (parsedLock.lock === undefined) {
    if (lockRequired) {
      return {
        status: "blocked",
        lockRequired: true,
        lockActive: false,
        reason: "merge_lock_metadata_required",
        protectedPaths
      };
    }
    return {
      status: "passed",
      lockRequired: false,
      lockActive: false,
      reason: "no_merge_lock_required",
      protectedPaths
    };
  }

  const lock = parsedLock.lock;
  const lockDigest = computeMergeLockDigest(lock);
  const lockEvidence = { lockId: lock.lockId, lockDigest };
  if (!validLockBinding(input, lock)) {
    return {
      status: "blocked",
      lockRequired,
      lockActive: true,
      reason: "invalid_merge_lock_metadata",
      protectedPaths,
      lock: lockEvidence
    };
  }

  const allowedApprovers = new Set(
    input.allowedApprovers.map(normalizeLogin)
  );
  let trustedMalformedClaim = false;
  let supersededHeadClaim = false;
  let validAuthorization: {
    comment: MergeIntegrityComment;
    claim: MergeAuthorization;
  } | undefined;

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
      if (validCommentAuthorization(
        input,
        lock,
        lockDigest,
        comment,
        claim,
        allowedApprovers
      )) {
        validAuthorization ??= { comment, claim };
      } else if (validSupersededHeadAuthorization(
        input,
        lock,
        lockDigest,
        comment,
        claim,
        allowedApprovers
      )) {
        supersededHeadClaim = true;
      } else {
        trustedMalformedClaim = true;
      }
    }
  }

  if (!trustedMalformedClaim && validAuthorization !== undefined) {
    return authorizedResult(
      lockRequired,
      protectedPaths,
      lockEvidence,
      validAuthorization.comment,
      validAuthorization.claim
    );
  }

  return {
    status: "blocked",
    lockRequired,
    lockActive: true,
    reason: trustedMalformedClaim || supersededHeadClaim
      ? "invalid_unlock_claim"
      : "merge_lock_active",
    protectedPaths,
    lock: lockEvidence
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
  options: MergeIntegrityGateOptions
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
  if (options.token.trim() === "") {
    throw new Error("github_token_missing_for_changed_file_inventory");
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiUrl = normalizedApiUrl(options.apiUrl);
  const encodedRepository = encodeRepository(facts.repository);
  const changedPaths = await fetchChangedPaths(
    `${apiUrl}/repos/${encodedRepository}/pulls/${facts.pullRequest}/files`,
    options.token,
    fetchImpl
  );
  const baseInput: MergeIntegrityInput = {
    ...facts,
    changedPaths,
    allowedApprovers: options.allowedApprovers,
    comments: []
  };

  const parsedLock = parseLockBlock(facts.body);
  if (parsedLock.lock === undefined) {
    return baseInput;
  }
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
    && typeof input.body === "string"
    && input.changedPaths.every(isRepositoryPath)
    && input.allowedApprovers.length > 0
    && input.allowedApprovers.every((login) => /^[A-Za-z0-9-]+$/u.test(login));
}

function validCommentAuthorization(
  input: MergeIntegrityInput,
  lock: MergeLockMetadata,
  lockDigest: string,
  comment: MergeIntegrityComment,
  claim: MergeAuthorization,
  allowedApprovers: Set<string>
): boolean {
  return validCommonAuthorization(
    input,
    lock,
    lockDigest,
    claim,
    allowedApprovers
  )
    && sameSha(claim.headSha, input.headSha)
    && normalizeLogin(claim.approver) === normalizeLogin(comment.authorLogin)
    && commentWasNotEdited(comment)
    && authorizationTimeMatches(claim.approvedAt, comment.updatedAt);
}

function validSupersededHeadAuthorization(
  input: MergeIntegrityInput,
  lock: MergeLockMetadata,
  lockDigest: string,
  comment: MergeIntegrityComment,
  claim: MergeAuthorization,
  allowedApprovers: Set<string>
): boolean {
  return validCommonAuthorization(
    input,
    lock,
    lockDigest,
    claim,
    allowedApprovers
  )
    && !sameSha(claim.headSha, input.headSha)
    && normalizeLogin(claim.approver) === normalizeLogin(comment.authorLogin)
    && commentWasNotEdited(comment)
    && authorizationTimeMatches(claim.approvedAt, comment.updatedAt);
}

function validCommonAuthorization(
  input: MergeIntegrityInput,
  lock: MergeLockMetadata,
  lockDigest: string,
  claim: MergeAuthorization,
  allowedApprovers: Set<string>
): boolean {
  return claim.schemaVersion === 1
    && claim.decision === "unlock"
    && claim.lockId === lock.lockId
    && claim.lockDigest === lockDigest
    && claim.repository === input.repository
    && claim.pullRequest === input.pullRequest
    && claim.baseRef === input.baseRef
    && allowedApprovers.has(normalizeLogin(claim.approver))
    && claim.repository === lock.repository
    && claim.pullRequest === lock.pullRequest
    && claim.baseRef === lock.baseRef;
}

function validLockBinding(
  input: MergeIntegrityInput,
  lock: MergeLockMetadata
): boolean {
  return lock.repository === input.repository
    && lock.pullRequest === input.pullRequest
    && lock.baseRef === input.baseRef;
}

function commentWasNotEdited(comment: MergeIntegrityComment): boolean {
  const createdMs = Date.parse(comment.createdAt);
  const updatedMs = Date.parse(comment.updatedAt);
  return Number.isFinite(createdMs)
    && Number.isFinite(updatedMs)
    && createdMs === updatedMs;
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
  lockRequired: boolean,
  protectedPaths: string[],
  lock: MergeIntegrityLockEvidence,
  comment: MergeIntegrityComment,
  claim: MergeAuthorization
): MergeIntegrityResult {
  return {
    status: "passed",
    lockRequired,
    lockActive: true,
    reason: "merge_lock_authorized",
    protectedPaths,
    lock,
    authorization: {
      source: "comment",
      sourceId: comment.id,
      approver: claim.approver,
      approvedAt: claim.approvedAt,
      commentUpdatedAt: comment.updatedAt,
      lockId: claim.lockId,
      lockDigest: claim.lockDigest,
      baseRef: claim.baseRef,
      headSha: claim.headSha
    }
  };
}

function parseLockBlock(text: string): LockBlockParseResult {
  const prefixCount = [...text.matchAll(LOCK_PREFIX)].length;
  const matches = [...text.matchAll(LOCK_BLOCK)];
  if (prefixCount === 0) {
    return { present: false, malformed: false };
  }
  if (prefixCount !== 1 || matches.length !== 1) {
    return { present: true, malformed: true };
  }
  const rawJson = matches[0]?.[1];
  if (rawJson === undefined) {
    return { present: true, malformed: true };
  }
  try {
    const lock = parseLockMetadata(JSON.parse(rawJson) as unknown);
    return lock === undefined
      ? { present: true, malformed: true }
      : { present: true, malformed: false, lock };
  } catch {
    return { present: true, malformed: true };
  }
}

function parseLockMetadata(value: unknown): MergeLockMetadata | undefined {
  if (!isRecord(value) || !hasExactKeys(value, [
    "schemaVersion",
    "lockId",
    "repository",
    "pullRequest",
    "baseRef",
    "reason",
    "locked"
  ])) {
    return undefined;
  }
  if (
    value.schemaVersion !== 1
    || typeof value.lockId !== "string"
    || !isLockId(value.lockId)
    || typeof value.repository !== "string"
    || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(value.repository)
    || typeof value.pullRequest !== "number"
    || !Number.isSafeInteger(value.pullRequest)
    || value.pullRequest <= 0
    || typeof value.baseRef !== "string"
    || !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/u.test(value.baseRef)
    || typeof value.reason !== "string"
    || !isLockReason(value.reason)
    || value.locked !== true
  ) {
    return undefined;
  }
  return {
    schemaVersion: 1,
    lockId: value.lockId,
    repository: value.repository,
    pullRequest: value.pullRequest,
    baseRef: value.baseRef,
    reason: value.reason,
    locked: true
  };
}

function parseAuthorizationBlocks(text: string): AuthorizationBlockParseResult {
  const prefixCount = [...text.matchAll(AUTHORIZATION_PREFIX)].length;
  const matches = [...text.matchAll(AUTHORIZATION_BLOCK)];
  if (prefixCount === 0) {
    return { claims: [], malformed: false };
  }
  if (prefixCount !== 1 || matches.length !== 1) {
    return { claims: [], malformed: true };
  }
  const rawJson = matches[0]?.[1];
  if (rawJson === undefined) {
    return { claims: [], malformed: true };
  }
  try {
    const claim = parseAuthorization(JSON.parse(rawJson) as unknown);
    if (claim === undefined || text !== canonicalAuthorizationBlock(claim)) {
      return { claims: [], malformed: true };
    }
    return { claims: [claim], malformed: false };
  } catch {
    return { claims: [], malformed: true };
  }
}

function canonicalAuthorizationBlock(claim: MergeAuthorization): string {
  return `<!-- ${AUTHORIZATION_MARKER}\n${JSON.stringify(claim)}\n-->`;
}

function parseAuthorization(value: unknown): MergeAuthorization | undefined {
  if (!isRecord(value) || !hasExactKeys(value, [
    "schemaVersion",
    "decision",
    "lockId",
    "lockDigest",
    "repository",
    "pullRequest",
    "baseRef",
    "headSha",
    "approver",
    "approvedAt"
  ])) {
    return undefined;
  }
  if (
    value.schemaVersion !== 1
    || value.decision !== "unlock"
    || typeof value.lockId !== "string"
    || !isLockId(value.lockId)
    || typeof value.lockDigest !== "string"
    || !isSha256(value.lockDigest)
    || typeof value.repository !== "string"
    || !Number.isSafeInteger(value.pullRequest)
    || typeof value.pullRequest !== "number"
    || typeof value.baseRef !== "string"
    || typeof value.headSha !== "string"
    || !isFullSha(value.headSha)
    || typeof value.approver !== "string"
    || typeof value.approvedAt !== "string"
  ) {
    return undefined;
  }
  return {
    schemaVersion: 1,
    decision: "unlock",
    lockId: value.lockId,
    lockDigest: value.lockDigest,
    repository: value.repository,
    pullRequest: value.pullRequest,
    baseRef: value.baseRef,
    headSha: value.headSha,
    approver: value.approver,
    approvedAt: value.approvedAt
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

async function fetchChangedPaths(
  url: string,
  token: string,
  fetchImpl: FetchLike
): Promise<string[]> {
  const files = await fetchAllPages(url, token, fetchImpl);
  const paths = files.flatMap((file) => {
    if (!isRecord(file) || typeof file.filename !== "string") {
      throw new Error("github_changed_file_inventory_invalid");
    }
    if (
      file.previous_filename !== undefined
      && typeof file.previous_filename !== "string"
    ) {
      throw new Error("github_changed_file_inventory_invalid");
    }
    const observed = [
      file.filename,
      ...(typeof file.previous_filename === "string"
        ? [file.previous_filename]
        : [])
    ];
    if (!observed.every(isRepositoryPath)) {
      throw new Error("github_changed_file_path_invalid");
    }
    return observed;
  });
  return [...new Set(paths)].sort();
}

function collectProtectedPaths(paths: string[]): string[] {
  return [...new Set(paths.filter(isMergeLockProtectedPath))].sort();
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
    || typeof value.updated_at !== "string"
  ) {
    throw new Error("github_comment_inventory_invalid");
  }
  return {
    id: String(value.id),
    body: value.body,
    authorLogin: value.user.login,
    authorAssociation: value.author_association,
    createdAt: value.created_at,
    updatedAt: value.updated_at
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

function isSha256(value: string): boolean {
  return /^[0-9a-f]{64}$/iu.test(value);
}

function isLockId(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(value);
}

function isLockReason(value: string): boolean {
  return value.length > 0
    && value.length <= 256
    && value.trim() === value
    && !/[\u0000-\u001f\u007f]/u.test(value);
}

function isRepositoryPath(value: string): boolean {
  if (
    value.length === 0
    || value.length > 4096
    || value.startsWith("/")
    || value.includes("\\")
    || /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    return false;
  }
  return value.split("/").every((segment) =>
    segment !== "" && segment !== "." && segment !== ".."
  );
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
    `lock required: ${result.lockRequired}`,
    `lock active: ${result.lockActive}`,
    `reason: ${result.reason}`,
    `protected paths: ${result.protectedPaths.join(",") || "none"}`
  ];
  if (result.lock !== undefined) {
    lines.push(
      `lock id: ${result.lock.lockId}`,
      `lock digest: ${result.lock.lockDigest}`
    );
  }
  if (result.authorization !== undefined) {
    lines.push(
      `authorization source: ${result.authorization.source}`,
      `authorization source id: ${result.authorization.sourceId}`,
      `authorization approver: ${result.authorization.approver}`,
      `authorization time: ${result.authorization.approvedAt}`,
      `authorization comment updated at: ${result.authorization.commentUpdatedAt}`,
      `authorization lock id: ${result.authorization.lockId}`,
      `authorization lock digest: ${result.authorization.lockDigest}`,
      `authorization base ref: ${result.authorization.baseRef}`,
      `authorization head binding: ${result.authorization.headSha}`
    );
  }
  return lines.join("\n");
}

export async function runMergeIntegrityCommand(
  event: unknown,
  options: MergeIntegrityGateOptions
): Promise<MergeIntegrityCommandRun> {
  const run = await runMergeIntegrityGate(event, options);
  return {
    run,
    output: run.mode === "not_applicable"
      ? `Merge integrity gate\nstatus: passed\nreason: not_applicable_${run.reason}`
      : formatResult(run.result)
  };
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
  const command = await runMergeIntegrityCommand(event, {
    eventName,
    token: process.env.GITHUB_TOKEN ?? "",
    allowedApprovers,
    ...(process.env.GITHUB_API_URL === undefined
      ? {}
      : { apiUrl: process.env.GITHUB_API_URL })
  });
  console.log(command.output);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    const reason = error instanceof Error ? error.message : "unknown_merge_integrity_error";
    console.error(`Merge integrity gate failed closed: ${reason}`);
    process.exitCode = 1;
  });
}
