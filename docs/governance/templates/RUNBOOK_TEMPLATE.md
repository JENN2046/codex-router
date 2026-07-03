---
title: Runbook: <Name>
status: draft
owner: governance
created: YYYY-MM-DD
last_verified: null
verified_by: []
applies_to: []
---

# Runbook: <Name>

## Purpose

What operator workflow this runbook performs.

## Preconditions

- Required branch or checkout state:
- Required authorization:
- Required worktree state:
- Required capability boundary:

## Required Environment

List required binaries, local services, credentials, or explicit absence of
credentials. Never record secret values.

## Required Commands

```bash
# exact commands or command families
```

## Procedure

1. Inspect current state.
2. Run preflight checks.
3. Execute only the authorized step.
4. Capture sanitized evidence.
5. Run post-checks.

## Expected Result

Describe the pass condition.

## Blocking Conditions

List fail-closed conditions.

## Evidence Produced

List allowed evidence fields, refs, or artifact paths.

## Rollback

Describe rollback or state restoration.

## Incident Handling

Describe what to do if the run produces unexpected side effects, unsafe
evidence, or a failed gate.

## Post-run Documentation

List docs, closeouts, PR notes, or evidence manifests to update.

