# Source/Release Package Boundary

SOURCE_RELEASE_PACKAGE_BOUNDARY_RECORDED

This repository keeps the reviewable source package separate from release
evidence. The audit is intentionally read-only and builds an archive pack-plan
manifest from the local filesystem; it does not create archives, copy files, or
print file contents.

## source-review.zip

The source review package is for human and automated source inspection. It may
include repository policy and review inputs:

- `.github/`
- `docs/`, excluding `docs/evidence/`
- `packages/`
- `scripts/`
- `tests/`
- `AGENTS.md`
- `PROJECT_CONTINUE_ANCHOR.md`
- `README.md`
- `README.AGENTS_OS.md`
- `package.json`
- `package-lock.json`
- `routing-policy.yaml`
- `tsconfig.json`

The root `AGENTS.md` instruction file is required in `source-review.zip`;
source-review root AGENTS must be present before source/release package
separation can be claimed.
The same root instruction must record the execution boundary invariant;
source-review root AGENTS boundary must be recorded before source/release
package separation can be claimed.

It must not include generated release material, local state, dependencies, or
temporary files:

- `.git/`
- `.agent_board/`
- `.codex-home/`
- `.omc/`
- `node_modules/`
- `dist/`
- `coverage/`
- `docs/evidence/`
- `.env`, `.env.*`, `config.env`
- `.test-*`
- `tmp-*`
- `Zone.Identifier` environment artifacts

## release-evidence.zip

The release evidence package is for generated build, test, and audit artifacts.
It may include:

- `docs/evidence/`
- `dist/`
- `coverage/`
- `test-output/`
- `test-results/`
- `reports/`
- `logs/`

It must not include source roots or local state:

- `.git/`
- `.agent_board/`
- `.codex-home/`
- `.omc/`
- `node_modules/`
- `.github/`
- `packages/`
- `scripts/`
- `tests/`
- `docs/` outside `docs/evidence/`
- root review files such as `package.json`, `tsconfig.json`, or
  `routing-policy.yaml`
- `.env`, `.env.*`, `config.env`
- `.test-*`
- `tmp-*`
- `Zone.Identifier` environment artifacts

## Audit

Before release/source packaging review, run the execution-boundary current
surface audit so strategy router, execution profiles, policy config, capability taxonomy, capability taxonomy escalation policy, routing engine, recovery control orchestration, runtime control, operator action executor gate, Codex CLI
host, public API facade, Agent OS local runtime, Agent OS MCP server manifest, Protocol MCP provider skeleton, Protocol A2A remote provider skeleton, Agent OS SDK, Agent OS CLI, Agent OS app-server wrapper, Agent OS public surfaces, Codex provider, preflight, approval
permit, approval gate, approval consumption dispatch matrix, approval consumption dispatch, admission control, delegation policy, execution eligibility, execution observation, governance failure reducer, task graph, scheduler, execution planner,
provider registry, controlled provider execution taskbook, controlled provider execution taskbook review, provider execution runner, provider-core primitives, tool
invocation planner, desktop decision runner, final host locator,
host-dispatcher provider, Codex
desktop bridge, Codex desktop live host, Codex memory MCP client, Codex memory
host client, desktop host client, desktop live adapter dispatch, host-client
example, target host embedding, host executor, host executor taskbook,
host-client executor review, host executor receipt, agent-backed recovery
executor, agent executor adapter taskbook, agent executor adapter review, agent
executor adapter sandbox, task-control taskbook, task-control review, sub-agent
runtime, and task-control sandbox boundaries are checked
before package separation is claimed:

The same prerequisite records the execution authority lattice mode
`narrow_readonly_provider_dispatch_without_boundary_inheritance`: read-only provider dispatch does not inherit into host executor authorization, read-only provider dispatch does not inherit into sub-agent runtime authorization, read-only provider dispatch does not inherit into workspace-write authorization, and read-only provider dispatch does not inherit into release authorization.
Codex CLI host does not authorize host executor or sub-agent runtime;
sub-agent runtime does not invoke Codex CLI or provider execution; host executor
does not execute provider or sub-agent runtime.

```bash
npm run governance -- audit execution-boundary-current-surface
```

Then run:

```bash
npm run governance -- audit source-release-package-boundary
```

The source/release audit scans the archive pack-plan manifest that would feed
`source-review.zip` and `release-evidence.zip`, requires a clean `main` worktree
that is not behind `origin/main`, verifies that the two profiles are disjoint,
requires source-review root AGENTS present, requires Zone.Identifier environment artifacts absent, and reports only summarized counts.
Dirty document summaries split governance boundary docs, current-state docs,
validation-tier docs, and roadmap docs so source/release review can separate
release boundary evidence from planning context before packaging is claimed.
