# TaskGraph v2 Migration Notes

> Date: 2026-04-28
> Scope: Phase 21.3 TaskGraph branch ownership metadata
> Status: implementation pending validation

## Summary

TaskGraph v2 adds explicit branch ownership metadata to every node and edge so
`mergeBranch()` can distinguish source-owned, target-owned, and unrelated graph
items during a branch merge.

This is a strict schema change. `parseTaskGraph()` accepts only
`task-graph.v2`, and `parseTaskGraphDelta()` accepts only
`task-graph-delta.v2`. Legacy `task-graph.v1` and `task-graph-delta.v1`
payloads must be migrated before being passed to the v2 parsers.

## New Required Fields

Each `TaskGraphNode` and `TaskGraphEdge` now requires:

```ts
branchId: string;
originBranchId: string;
mergedFromBranchIds: string[];
```

Field meanings:

- `branchId`: the branch that currently owns the item.
- `originBranchId`: the branch where the item first originated.
- `mergedFromBranchIds`: branches already merged into this item, kept unique.

## Migration Rule

For a legacy graph with no per-item ownership metadata:

```ts
const branchId = graph.activeBranch || "main";
```

Then add this to every node and edge:

```ts
{
  branchId,
  originBranchId: branchId,
  mergedFromBranchIds: []
}
```

For a legacy delta, use `delta.branchId || delta.activeBranch || "main"` and
apply the same item-level defaults.

## Merge Semantics

`mergeBranch(source, target)` groups nodes by `nodeId` and edges by
`sourceNodeId`, `targetNodeId`, and `type`.

- Source-only items are retargeted to the target branch and record the source in
  `mergedFromBranchIds`.
- Target-only items remain unchanged.
- `keep_target` keeps the target-owned conflicting item and records source
  provenance.
- `keep_source` retargets the source-owned conflicting item to the target branch
  and preserves source origin metadata.
- `union` copies source-only items; conflicting target-owned items are kept with
  source provenance.

This is branch ownership metadata hardening, not a full branch isolation model.
Callers that need divergent versions of the same logical node may store
branch-owned duplicates with the same `nodeId`; operations such as
`mergeBranch()` then use `branchId` to resolve ownership.
