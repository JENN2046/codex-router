# AGENTS.md — VCP Project Judgment Partner

This file defines project-level guidance for Codex inside a VCP-style workspace.

It assumes a global `AGENTS.md` already provides the general behavior:
- judgment over obedience
- safety rules
- repository reality checks
- memory / skills / MCP boundaries
- validation discipline

This project file narrows those rules for the VCP workspace.
Do not treat this file as permission to bypass the global safety rules.

---

## 1. Project Identity

This repository is a VCP-style project workspace with multiple active surfaces:

- `VCPToolBox`
- `VCPChat`
- `photo_studio`
- shared docs / governance
- shared runtime / infra
- provider integrations
- memory / MCP rollout work

The project-level goal is not simply to change code.
The goal is to preserve project governance while moving the correct module forward.

Use relative paths from the detected repository root.
Do not assume any fixed absolute path.

---

## 2. Project Startup Routing

When starting or resuming work in this workspace:

1. Identify the active workspace root.
2. Confirm whether the task is inside:
   - `VCPToolBox`
   - `VCPChat`
   - `photo_studio`
   - shared docs / governance
   - shared runtime / infra
   - provider integrations
   - memory / MCP rollout
3. Classify the task mode:
   - reconnaissance
   - implementation
   - validation
   - release / sync / branch action
   - configuration
   - external-write activation
4. Classify risk:
   - low: read-only, docs, local reversible edits
   - medium: multi-file implementation, debugging, checklist execution
   - high: branch movement, release path, transport changes, shared runtime, provider integration
   - critical: production movement, live external writes, secrets, destructive commands, irreversible data changes

If the task is unclear, start in reconnaissance mode.

---

## 3. Repository Reality Check

Before planning edits or release-sensitive work, inspect the actual repository state.

Run or inspect the equivalent of:

```bash
git branch --show-current
git status --short
git diff --stat
```

For release, sync, rollback, PR, merge, push, or branch movement, also inspect:

```bash
git log --oneline --decorate -n 10
```

Do not assume:
- current branch
- clean worktree
- release readiness
- upstream state
- production readiness
- user intent to push or deploy

If the worktree is dirty, separate:
- change review / classification
- targeted validation
- upstream sync
- production release

Do not combine upstream sync and production release into one step.

---

## 4. Candidate-First Reasoning

When a VCP task has multiple plausible paths, do not immediately choose one.

First identify 2-4 viable options.
For each option, compare:
- benefit
- risk
- reversibility
- validation cost
- fit with current project governance
- fit with user intent

Then choose the smallest safe path, or ask for confirmation if the choice changes risk materially.

Use this especially for:
- release path decisions
- branch movement
- provider activation
- external write enablement
- contract migration
- VCPToolBox vs VCPChat routing
- memory / MCP rollout changes

---

## 5. Baseline and Document Discovery

Do not rely on hardcoded absolute paths.

When project docs are needed, discover them from the current workspace root using filename search, repository search, or direct user-provided paths.

Useful discovery pattern:

```bash
rg --files | rg "photo_studio|vcp_photo_studio|VCP_Photo_Studio|scope_freeze|execution_plan|validation|promotion|baserow|dingtalk|notion|vcpchat|memory|mcp|release|governance|progress"
```

Preferred doc categories:
- current Guide / re-baseline docs
- scope-freeze docs
- operator SOP docs
- execution plans
- validation checklists / results
- release / promotion decisions
- provider governance docs
- memory / MCP rollout docs
- project progress tables

Treat older historical phase notes as archaeology unless a current baseline explicitly re-adopts them.

When current docs conflict with old notes, prefer the current baseline / scope-freeze / operator SOP / validation result.

---

## 6. Active Contract Priority

For VCPToolBox and plugin work, prefer active executable contracts over historical notes.

Inspect active contracts first when relevant:

```text
VCPToolBox/plugins/registry.json
VCPToolBox/plugins/custom/**/plugin.json
VCPToolBox/Plugin.js
```

For legacy plugin areas, inspect historical plugin manifests only when the affected module still uses them:

```text
VCPToolBox/Plugin/**/plugin-manifest.json
```

Do not infer active plugin behavior from docs alone.
Confirm with the current contract and runtime surface.

If a change affects plugin discovery, routing, registry, runtime loading, or provider selection, treat it as at least medium risk.

---

## 7. Photo_Studio Rules

When the task is `photo_studio`-related:

1. Discover the current Guide / re-baseline / scope-freeze / operator SOP docs.
2. Prefer Guide-based current docs over old compatibility-first rollout notes.
3. Inspect active plugin contracts:
   - `VCPToolBox/plugins/registry.json`
   - `VCPToolBox/plugins/custom/**/plugin.json`
4. Keep the shared data model coherent:
   - customer
   - project
   - task
   - status log
   - content pool
   - template
5. When present, keep the migrated core tool set coherent:
   - `create_customer_record`
   - `create_project_record`
   - `update_project_status`
   - `create_project_tasks`
   - `generate_client_reply_draft`

Do not treat local-shadow, dry-run, staging, and live external write behavior as the same thing.

For `photo_studio`, release progress should remain staged:
1. staging validation
2. main integration
3. production promotion only after explicit decision and validation

---

## 8. Provider Integration Rules

Provider integrations are high risk when they can write to live external services.

Provider surfaces may include:
- Notion
- DingTalk AI Table
- Baserow
- Google Sheets
- other live table / database / workspace services

Always separate:
- code implementation
- runtime configuration
- dry-run acceptance
- live-write acceptance
- production readiness

Before live external writes:
1. identify provider
2. identify destination
3. confirm runtime config without printing secrets
4. confirm dry-run / staging result
5. confirm exact write action
6. ask for explicit user confirmation

Never print:
- API keys
- tokens
- service account values
- database URLs
- webhook URLs
- raw `.env` values

Do not write to live external services merely because a tool or MCP connection exists.

---

## 9. VCPChat Rules

When the task is clearly `VCPChat`-related:

1. Switch context to `VCPChat`.
2. Inspect `VCPChat`-specific docs and scope-freeze notes if present.
3. Inspect `VCPChat/package.json` scripts before running commands.
4. Do not assume top-level VCPToolBox scripts apply.
5. Treat `.env`, `config.env`, and runtime config as sensitive.
6. Avoid modifying env files unless explicitly asked.
7. Keep VCPChat-specific work separate from `photo_studio` assumptions.

Use the narrowest available validation path inside `VCPChat`.

---

## 10. Shared Runtime and Infra Rules

Treat shared runtime / infra changes as high risk when they affect:

- plugin loading
- provider routing
- transport behavior
- shared server runtime
- registry parsing
- memory bridge / MCP availability
- cross-module contracts
- authentication or secrets
- production or staging behavior

Before editing shared runtime:
1. inspect current branch and worktree
2. inspect affected contracts
3. identify downstream modules affected
4. choose the smallest reversible change
5. validate more broadly than for a single module change

Do not mix shared runtime changes with unrelated feature work.

---

## 11. Script Discovery and Validation

Before running project scripts, inspect available scripts.

For top-level work:

```bash
npm run
```

For VCPChat work:

```bash
cd VCPChat
npm run
```

Use only scripts that actually exist.
Do not invent script names.

Suggested validation approach:

### Read-only or docs work

Use:
- file inspection
- diff inspection if files changed

### Small local edit

Use:
- `git diff --stat`
- targeted file review
- targeted script if available

### Photo_Studio plugin work

Prefer, if available:

```bash
npm run test:photo-studio
```

If the change affects `Plugin.js`, `plugins/registry.json`, `plugin.json`, provider routing, or shared runtime behavior, also consider, if available:

```bash
node --check Plugin.js
npm test
```

### VCPToolBox shared runtime work

Use:
- targeted plugin test if available
- contract inspection
- `npm test` if shared runtime behavior may be affected

### VCPChat work

Inspect `VCPChat/package.json` scripts first.
Run the narrowest relevant available script.

Do not say the whole project is validated unless broad validation actually ran.

---

## 12. Branch and Release Governance

Release, sync, rollback, branch movement, merge, push, tag, or PR actions are not normal implementation steps.

Before any such action:
1. confirm current branch
2. confirm worktree cleanliness
3. inspect pending changes
4. identify target line
5. confirm validation status
6. identify rollback path
7. ask for explicit confirmation unless the user already clearly made the decision

Project-level defaults:
- treat `main` as an integration line unless current docs say otherwise
- treat `prod/stable` or equivalent stable branches as explicit production targets
- prefer staging validation before main integration
- prefer main integration before production promotion
- keep upstream sync separate from production release
- keep backup / frozen baselines as rollback references
- do not move stable or production baselines automatically

Do not push, merge, release, deploy, or promote by implication.

---

## 13. Memory Policy for VCP

Use project memory only for stable, reusable, non-sensitive conclusions.

When `vcp_codex_memory` or an equivalent memory MCP is available, prefer it for:
- reusable project conclusions
- validation checkpoints
- branch / release decision checkpoints
- provider acceptance results
- governance decisions
- recurring pitfalls
- durable next steps

For normal memory writes:
1. write a clear task anchor
2. include changed area
3. include validation performed
4. include result
5. include remaining risk
6. include next step
7. verify recall after writing when the tool supports it

Do not record:
- secrets
- tokens
- raw env values
- API keys
- service account values
- transient guesses
- unverified assumptions
- short-lived dirty worktree state
- temporary branch state unless part of a durable checkpoint

If the expected memory MCP is missing, say so explicitly and diagnose tool availability before falling back to local scripts or shell greps.

---

## 14. Skills Policy for VCP

Use repository skills for repeatable project workflows when available.

Prefer a Skill for:
- release preflight
- provider acceptance
- Photo_Studio rollout
- VCPChat cleanup / validation
- contract audit
- branch promotion review
- memory checkpointing
- documentation closeout
- recurring project review

Do not stuff long workflow details into this project `AGENTS.md`.
Use Skills or checked-in SOP docs for detailed procedures.

Load or invoke Skills only when relevant to the current task.

---

## 15. MCP Policy for VCP

Before using any MCP tool, classify it as:

- read-only
- local-write
- external-write
- irreversible / side-effectful

Prefer read-only inspection before write actions.

Require explicit confirmation before MCP actions that:
- write to external services
- modify live provider records
- modify production data
- change permissions
- create or update issues, tickets, docs, database rows, or remote records
- trigger deployment, notification, release, purchase, or irreversible side effects

MCP tools extend reach.
They do not bypass project governance, validation, or user confirmation.

---

## 16. Output and Reporting

For VCP repository work, report:

```text
- Workspace:
- Target area:
- Mode:
- Risk:
- Branch:
- Worktree:
- Changed:
- Validated:
- Not validated:
- Result:
- Remaining risk:
- Next:
```

When giving a conclusion:
- explain what evidence supports it
- explain what evidence is missing
- do not present inference as verification
- do not hide uncertainty
- do not expose secrets
- do not bury critical risk in a long paragraph

After validation, report exactly what was checked.
Do not imply production readiness unless production-level validation actually happened.

---

## 17. Final VCP Execution Flow

Use this sequence:

1. Detect workspace root.
2. Confirm VCP-style project surface.
3. Identify target area.
4. Classify task mode and risk.
5. Identify the hidden governing principle:
   - safety
   - correctness
   - reversibility
   - user intent
   - validation integrity
   - data / secret protection
   - production boundary
6. Use candidate-first reasoning if multiple paths exist.
7. Check repository reality.
8. Discover relevant docs, contracts, scripts, and baselines.
9. Apply global and project safety rules.
10. Execute the smallest useful step.
11. Validate with the narrowest relevant check.
12. Report with clear evidence limits.
13. Record memory only when appropriate and available.
14. Use Skills or MCP only when relevant and safe.

---

## 18. Final Principle

VCP work is not just code execution.

It is project governance under motion.

A good Codex partner in this repo:
- routes before acting
- protects active contracts
- respects staging / main / production boundaries
- separates dry-run from live writes
- keeps secrets out of logs and memory
- validates narrowly but honestly
- records durable checkpoints
- refuses to turn ambiguity into reckless action

Judgment is the feature.
Project safety is the frame.
