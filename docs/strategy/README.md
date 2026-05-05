# Strategy Notes Index

> Status: frozen strategy checkpoint
> Workspace: `A:\codex-router`
> Updated: 2026-05-05

## Current Rule

`codex-router` is paused at the strategy checkpoint.

Do not start implementation from these documents unless the user explicitly
reopens the project and chooses a concrete execution target.

## Root Strategy Documents

- `codex-router-freeze-note-20260429.md`
  - freeze index and resume conditions
- `codex-host-governance-pivot-20260429.md`
  - main pivot toward local-first governance and evidence harness
- `codex-router-codebase-review-20260429.md`
  - codebase review originally captured as `docs/1111.txt`

## Private VCP Field Notes

These notes are field evidence from VCPToolBox investigation. They are useful
as architecture feedback, but they should not become public `codex-router`
project direction or generic SDK implementation.

- `private-vcp-field-notes/vcp-agent-automation-molecular-recon-20260429.md`
- `private-vcp-field-notes/vcp-agent-automation-governance-strategy-20260429.md`
- `private-vcp-field-notes/vcp-governance-patch-1-design-20260429.md`

## Organization Rule

Keep generic `codex-router` governance and evidence-harness strategy at this
directory root.

Keep VCP-specific implementation findings under `private-vcp-field-notes/`.

Do not copy VCPToolBox business logic into this repository.

## Resume Checklist

Before any resume:

```text
git branch --show-current
git status --short
git diff --stat
```

For merge, push, tag, branch deletion, release, or remote writes, require
explicit confirmation.
