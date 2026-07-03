---
title: Evidence Policy
status: active
owner: governance
created: 2026-07-03
last_verified: 2026-07-03
verified_by:
  - docs review
  - npm run validate:daily
supersedes: []
superseded_by: null
applies_to:
  - evidence
  - runtime-governance
  - release-review
---

# Evidence Policy

This policy defines what governance evidence may store and what must stay out
of repository documents, PR bodies, logs, receipts, and committed artifacts.

Evidence should make a governance decision reviewable without exposing raw
private, secret, provider, or user material.

## Forbidden Raw Material

Do not store or publish:

- secrets, tokens, cookies, credentials, API keys, or auth headers;
- `.env`, `config.env`, provider config, or secret-like raw values;
- private raw memory or private identity material;
- browser profiles, login state, session stores, or cookies;
- provider raw responses or raw model transcripts;
- raw prompts when they contain private, secret, or user-sensitive content;
- unredacted stdout/stderr transcripts from real host or provider execution;
- database dumps, production payloads, or webhook bodies;
- full raw patches when they may contain secret-like values;
- files from `state-private/`, credential folders, or local-only profiles.

If the evidence source might contain forbidden material, store a sanitized
summary, digest, or reference instead.

## Allowed Evidence Fields

Allowed evidence should be structured and minimal:

| Field class | Examples |
| --- | --- |
| Identity refs | commit SHA, branch name, check name, observation id, checkpoint ref |
| Digests | SHA-256 digest, filtered tree digest, patch hash |
| Status | passed, failed, blocked, skipped, not run |
| Reason codes | stable `reasonCode`, `errorClass`, policy name |
| Counts | file count, issue count, anomaly count, strike count |
| Bounded paths | repository-relative non-secret file paths |
| Sanitized summaries | short explanation without raw secrets or provider payloads |
| Timestamps | ISO timestamp for audit ordering |
| Capability class | read-only, guarded, blocked, release action |

## Evidence Refs

When runtime governance produces detailed observations, downstream outputs
should prefer refs over raw payloads.

Examples:

- `execution-observation:<observationId>`
- checkpoint refs
- sanitized evidence manifest paths
- GitHub check URLs

Refs must be resolvable within their declared scope. If a ref cannot be
resolved, fail closed for claims that depend on it.

## Storage Surfaces

| Surface | Evidence role |
| --- | --- |
| `docs/evidence/` | Sanitized evidence artifacts and manifests. |
| `docs/governance/PR_*` | Historical taskbooks, packets, closeouts, receipts. |
| PR body/comments | Review summary and validation result; no raw secrets. |
| `docs/current/state-sync-record.json` | Machine-readable state-sync claim. |
| `CURRENT_STATE.md` and `.agent_board/*` | Display only; not source of authority. |

## Redaction Rules

Use stable placeholders when redacting:

- `[REDACTED_SECRET]`
- `[REDACTED_TOKEN]`
- `[REDACTED_COOKIE]`
- `[REDACTED_PRIVATE_MEMORY]`
- `[REDACTED_PROVIDER_PAYLOAD]`

Do not replace a secret with a reversible encoding, partial token, or enough
context to reconstruct it.

## Failure Policy

- If evidence contains forbidden raw material, do not commit it.
- If unsafe evidence was already produced locally, remove it from the commit
  surface and record only a sanitized summary.
- If a governance decision needs evidence that cannot be safely stored, record
  the reason and require human review.
- If an execution path cannot produce consumable evidence refs, do not claim
  that operator recovery evidence is available.

