---
title: Governance Docs Automation Spec
status: active
owner: governance
created: 2026-07-03
last_verified: 2026-07-03
verified_by:
  - npm run docs:governance
  - npm run validate:daily
supersedes: []
superseded_by: null
applies_to:
  - documentation-governance
  - validation
---

# Governance Docs Automation Spec

This spec defines the lightweight documentation checks used by
`npm run docs:governance`.

The check is intentionally structural. It does not try to decide whether a
governance argument is correct. It only catches low-cost drift that should not
depend on memory or manual review.

## Scope

The MVP check covers:

- required current governance documents exist;
- active current governance documents have frontmatter with `status: active`;
- runbooks have required operator headings;
- ADRs have required decision headings;
- the closeout template has status, verification, and remaining-risk markers;
- `RELEASE_GATE_MATRIX.md` only references existing `package.json` scripts for
  `npm run ...` commands;
- current README/control-plane markdown links resolve to existing repository
  files.

## Archived Evidence Policy

Historical `PR_*`, `FUTURE_*`, receipt, and closeout files are evidence-heavy
and may predate the current template set. The default docs check does not lint
those files as current authority.

If a historical file becomes current authority, link it from a current
authority document and add a focused check or migration in the same PR.

## Non-goals

The MVP check does not do:

- natural-language semantic review;
- real execution checks;
- provider or Codex CLI execution;
- evidence payload parsing;
- GitHub Actions restructuring;
- historical evidence migration.

## Required Headings

Runbooks must include:

- `## Preconditions`
- `## Blocking Conditions`
- `## Evidence Produced`
- `## Rollback`

ADRs must include:

- `## Context`
- `## Decision`
- `## Consequences`

The closeout template must include:

- `status:`
- `## Verification Commands`
- `## Remaining Risks`

## Validation Integration

`npm run docs:governance` is part of the PR validation tier. It runs before the
state-sync audit so broken documentation structure is reported before state
authority checks.

## Change Control

Changing this check requires updating:

- this spec;
- [Release Gate Matrix](RELEASE_GATE_MATRIX.md);
- tests for `scripts/check-governance-docs.ts`;
- `tests/governance-check.test.ts` when validation tier composition changes.
