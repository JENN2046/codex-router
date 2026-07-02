#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export const STATE_SYNC_REANCHOR_BRANCH = "state-sync/reanchor-main";
export const STATE_SYNC_REANCHOR_PR_TITLE =
  "docs(state): reanchor main state-sync record";

export interface CreateStateSyncReanchorPrOptions {
  token: string;
  repository: string;
  baseBranch?: string;
  headBranch?: string;
  triggeringSha: string;
  workflowRunUrl: string;
  changedPaths: string[];
  validationCommands: string[];
  fetchImpl?: typeof fetch;
}

export interface CreateStateSyncReanchorPrResult {
  action: "created" | "updated";
  number: number;
  url: string;
}

interface GitHubPullRequest {
  number: number;
  html_url: string;
}

export async function createOrUpdateStateSyncReanchorPr(
  options: CreateStateSyncReanchorPrOptions
): Promise<CreateStateSyncReanchorPrResult> {
  const [owner, repo] = parseRepository(options.repository);
  const baseBranch = options.baseBranch ?? "main";
  const headBranch = options.headBranch ?? STATE_SYNC_REANCHOR_BRANCH;
  const fetchImpl = options.fetchImpl ?? fetch;
  const body = stateSyncReanchorPrBody({
    triggeringSha: options.triggeringSha,
    headBranch,
    changedPaths: options.changedPaths,
    validationCommands: options.validationCommands,
    workflowRunUrl: options.workflowRunUrl
  });
  const openPr = await findOpenReanchorPr({
    fetchImpl,
    token: options.token,
    owner,
    repo,
    baseBranch,
    head: `${owner}:${headBranch}`
  });

  if (openPr !== undefined) {
    const updated = await githubJson<GitHubPullRequest>({
      fetchImpl,
      token: options.token,
      method: "PATCH",
      url: `https://api.github.com/repos/${owner}/${repo}/pulls/${openPr.number}`,
      body: {
        title: STATE_SYNC_REANCHOR_PR_TITLE,
        body
      }
    });
    return {
      action: "updated",
      number: updated.number,
      url: updated.html_url
    };
  }

  const created = await githubJson<GitHubPullRequest>({
    fetchImpl,
    token: options.token,
    method: "POST",
    url: `https://api.github.com/repos/${owner}/${repo}/pulls`,
    body: {
      title: STATE_SYNC_REANCHOR_PR_TITLE,
      head: headBranch,
      base: baseBranch,
      body,
      maintainer_can_modify: true
    }
  });
  return {
    action: "created",
    number: created.number,
    url: created.html_url
  };
}

export function stateSyncReanchorPrBody(input: {
  triggeringSha: string;
  headBranch: string;
  changedPaths: string[];
  validationCommands: string[];
  workflowRunUrl: string;
}): string {
  return [
    "## Summary",
    "",
    "Manual legacy v1 compatibility state-sync reanchor PR.",
    "",
    "- Compatibility fallback for schema v1 state-only records.",
    "- Created only from the manual `workflow_dispatch` fallback, not from the normal `main` push path.",
    "- Policy v2 content attestations are the main path and do not require this post-squash reanchor.",
    "- Records `main` as the legacy structured state-sync subject.",
    "- Records `state_only_pushed` as the legacy transition.",
    "- Keeps the diff limited to the structured state-sync record.",
    "",
    "## Trigger",
    "",
    `- main SHA: \`${input.triggeringSha}\``,
    `- reanchor branch: \`${input.headBranch}\``,
    `- workflow run: ${input.workflowRunUrl}`,
    "",
    "## Changed Paths",
    "",
    ...input.changedPaths.map((filePath) => `- \`${filePath}\``),
    "",
    "## Validation",
    "",
    ...input.validationCommands.map((command) => `- \`${command}\``),
    "",
    "## CI Trigger Note",
    "",
    "- This PR is created or updated by a workflow using `GITHUB_TOKEN`.",
    "- GitHub may leave the resulting `pull_request` workflow runs in an approval-required state until a user with write permission approves them.",
    "- Treat approval-required workflow runs as an expected GitHub authorization gate, not as evidence that the reanchor PR failed to trigger CI.",
    "",
    "## Boundaries",
    "",
    "- No source, workflow, dependency, provider, environment, secret, user config, or system config changes.",
    "- No automatic merge.",
    "- No real provider execution.",
    "- No real Codex CLI execution.",
    ""
  ].join("\n");
}

async function findOpenReanchorPr(input: {
  fetchImpl: typeof fetch;
  token: string;
  owner: string;
  repo: string;
  baseBranch: string;
  head: string;
}): Promise<GitHubPullRequest | undefined> {
  const query = new URLSearchParams({
    state: "open",
    base: input.baseBranch,
    head: input.head
  });
  const pulls = await githubJson<GitHubPullRequest[]>({
    fetchImpl: input.fetchImpl,
    token: input.token,
    method: "GET",
    url: `https://api.github.com/repos/${input.owner}/${input.repo}/pulls?${query}`
  });
  return pulls[0];
}

async function githubJson<T>(input: {
  fetchImpl: typeof fetch;
  token: string;
  method: "GET" | "POST" | "PATCH";
  url: string;
  body?: unknown;
}): Promise<T> {
  const response = await input.fetchImpl(input.url, {
    method: input.method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${input.token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(input.body === undefined ? {} : { "Content-Type": "application/json" })
    },
    ...(input.body === undefined ? {} : { body: JSON.stringify(input.body) })
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `GitHub API ${input.method} ${input.url} failed with ${response.status}: ${text}`
    );
  }

  return await response.json() as T;
}

function parseRepository(repository: string): [string, string] {
  const [owner, repo] = repository.split("/");
  if (owner === undefined || owner === "" || repo === undefined || repo === "") {
    throw new Error(`Invalid GITHUB_REPOSITORY value: ${repository}`);
  }

  return [owner, repo];
}

async function changedPathsFromFile(filePath: string | undefined): Promise<string[]> {
  if (filePath === undefined) {
    return [];
  }

  const text = await readFile(filePath, "utf8");
  return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function argValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index < 0) {
    return undefined;
  }

  const value = args[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`Missing value for ${name}`);
  }

  return value;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const token = process.env.GITHUB_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY;
  const triggeringSha = process.env.GITHUB_SHA;
  const serverUrl = process.env.GITHUB_SERVER_URL ?? "https://github.com";
  const runId = process.env.GITHUB_RUN_ID;
  if (!token || !repository || !triggeringSha || !runId) {
    throw new Error(
      "GITHUB_TOKEN, GITHUB_REPOSITORY, GITHUB_SHA, and GITHUB_RUN_ID are required"
    );
  }

  const changedPaths = await changedPathsFromFile(
    argValue(args, "--changed-paths-file")
  );
  const result = await createOrUpdateStateSyncReanchorPr({
    token,
    repository,
    triggeringSha,
    workflowRunUrl: `${serverUrl}/${repository}/actions/runs/${runId}`,
    changedPaths,
    validationCommands: [
      "node --import tsx scripts/prepare-state-sync-reanchor.ts --write",
      "node --import tsx scripts/verify-state-sync-reanchor-diff.ts",
      "git diff --check",
      "node --import tsx scripts/run-state-sync-audit.ts --json"
    ]
  });
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      "State-sync reanchor PR creation failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
