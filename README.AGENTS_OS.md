# governance/codex-router

This directory is reserved for the `codex-router` repository.

## Purpose

`codex-router` belongs to the governance layer.

It should provide:

```text
task classification
ambiguity gate
model routing
execution profile selection
approval requirement detection
checkpoint / audit helpers
runtime routing decisions
```

## Role In AGENTS OS

```text
TaskEnvelope
↓
codex-router
↓
RoutingDecision
↓
Bounded-High-Autonomy / Approval Gate
```

## Must Not Do

```text
read real secrets by default
execute shell directly without gate
push to remote
release
deploy
modify VCPToolBox main directly
```

## Expected Interface

```text
input: TaskEnvelope
output: RoutingDecision
```

## Validation

Use this AGENTS OS overlay README as boundary guidance.  
The real repository should keep its own project README.

```bash
npm test
npm run lint
```

If scripts do not exist, record that honestly.
