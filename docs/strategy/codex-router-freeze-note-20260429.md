# codex-router Freeze Note

> Date: 2026-04-29
> Status: frozen / strategy archived
> Scope: `codex-router` project direction checkpoint
> Constraint: no implementation work continues from this note

## Decision

`codex-router` is paused and sealed at the strategy checkpoint.

The project should not continue into implementation until the user explicitly
reopens the work and chooses a concrete execution target.

## Current Position

The durable project direction is:

```text
codex-router -> local-first governance and evidence harness
```

The project should not compete with OpenAI Codex on:

- command center UI
- generic multi-agent orchestration
- worktree management
- skills/plugin runtime
- broad host execution
- sandbox ownership

The defensible gap remains:

```text
prove what a host/agent run did,
under which identity/context/approval boundary,
with evidence suitable for review.
```

## VCP Strategy Outcome

The VCPToolBox strategy line concluded:

```text
governed automation before autonomous automation
```

VCP should not jump directly into high-autonomy agent execution.

The first governance foundation should be:

```text
ToolIdentityResolver
+ approval compatibility
+ executionContext normalization
+ regression tests
```

Do not start with:

- full `RiskPolicyEngine`
- low-risk auto-allow
- bridge enablement
- external-write automation
- VCP business logic copied into `codex-router`

## Strategy Artifacts

Root strategy artifacts:

- `docs/strategy/codex-router-freeze-note-20260429.md`
- `docs/strategy/codex-host-governance-pivot-20260429.md`
- `docs/strategy/codex-router-codebase-review-20260429.md`
- `docs/strategy/codex-router-checkpoint-change-note-20260505.md`

Private VCP field notes:

- `docs/strategy/private-vcp-field-notes/vcp-agent-automation-molecular-recon-20260429.md`
- `docs/strategy/private-vcp-field-notes/vcp-agent-automation-governance-strategy-20260429.md`
- `docs/strategy/private-vcp-field-notes/vcp-governance-patch-1-design-20260429.md`

`docs/strategy/README.md` is the current directory index.

## Known State At Freeze

Observed repository state during freeze:

```text
Workspace: A:\codex-router
Branch: pivot-codex-host-governance-recon
Tracked diff: none observed before this freeze note
Untracked before this note: docs/1111.txt, docs/strategy/
```

`docs/1111.txt` was pre-existing and was not inspected or modified as part of
the freeze.

Post-freeze organization on 2026-05-05:

```text
docs/1111.txt -> docs/strategy/codex-router-codebase-review-20260429.md
VCP-specific notes -> docs/strategy/private-vcp-field-notes/
No strategy documents were deleted.
```

## Resume Conditions

Only resume implementation if the user explicitly chooses one of these targets:

1. Convert the strategy docs into a commit or PR.
2. Start VCP Patch 1 design review.
3. Implement VCP Patch 1 in the VCP repository.
4. Refocus `codex-router` around governance/evidence harness modules.
5. Archive or prune obsolete `codex-router` modules.

Before any resume, re-check:

```text
git branch --show-current
git status --short
git diff --stat
```

For merge, push, tag, branch deletion, or release-style work, require explicit
confirmation.

## Non-Goals While Frozen

Do not:

- start implementation from these strategy docs
- modify VCPToolBox
- enable bridge execution
- change approval config
- delete branches
- push or tag
- claim the project is complete beyond strategy archival

## Memory Summary

The stable memory to carry forward:

```text
codex-router is paused at a strategy checkpoint.
The preferred future direction is governance/evidence harness, not command
center or generic router.
For VCP, first stabilize identity and context before risk scoring or autonomy.
```

## Final Freeze Statement

The project is sealed for now.

Future work should restart from evidence and explicit user direction, not from
momentum.
