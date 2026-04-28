import test from "node:test";
import assert from "node:assert/strict";
import {
  createTaskGraph,
  addNodeToGraph,
  updateNodeStatus,
  addEdgeToGraph,
  addDependencyEdge,
  addConflictEdge,
  createBranch,
  switchBranch,
  getNode,
  getNodesByStatus,
  getDependencies,
  getConflicts,
  hasConflict,
  getReachableNodes,
  isGraphComplete,
  parseTaskGraph,
  parseTaskGraphDelta,
  createGraphDelta,
  applyGraphDelta,
  recordCheckpointNode,
  rollbackToCheckpoint,
  listCheckpoints,
  mergeBranch,
  createRecordingTaskGraphStore,
  createFileTaskGraphStore
} from "../packages/task-graph/src/index.js";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

// ── Factory tests ────────────────────────────────────────────────────────────

test("task-graph: createTaskGraph creates a graph with root node", () => {
  const graph = createTaskGraph({
    taskId: "test-task",
    branchId: "main",
    now: () => "2026-04-28T00:00:00.000Z"
  });

  assert.equal(graph.schemaVersion, "task-graph.v2");
  assert.equal(graph.rootTaskId, "test-task");
  assert.equal(graph.activeBranch, "main");
  assert.equal(graph.nodes.length, 1);
  assert.equal(graph.nodes[0]?.type, "root");
  assert.equal(graph.nodes[0]?.status, "pending");
  assert.equal(graph.nodes[0]?.branchId, "main");
  assert.equal(graph.nodes[0]?.originBranchId, "main");
  assert.deepEqual(graph.nodes[0]?.mergedFromBranchIds, []);
});

test("task-graph: parseTaskGraph validates input", () => {
  const graph = createTaskGraph({ taskId: "test-task" });
  const parsed = parseTaskGraph(graph);
  assert.equal(parsed.graphId, graph.graphId);
});

test("task-graph: parseTaskGraph rejects legacy v1 graph payloads", () => {
  assert.throws(() =>
    parseTaskGraph({
      schemaVersion: "task-graph.v1",
      graphId: "graph:legacy",
      rootTaskId: "legacy",
      nodes: [
        {
          nodeId: "legacy:root",
          taskId: "legacy",
          type: "root",
          status: "pending",
          createdAt: "2026-04-28T00:00:00.000Z",
          updatedAt: "2026-04-28T00:00:00.000Z"
        }
      ],
      edges: [],
      branches: ["main"],
      activeBranch: "main",
      createdAt: "2026-04-28T00:00:00.000Z",
      updatedAt: "2026-04-28T00:00:00.000Z"
    } as unknown as Parameters<typeof parseTaskGraph>[0])
  );
});

test("task-graph: parseTaskGraph rejects v2 nodes without branch ownership", () => {
  assert.throws(() =>
    parseTaskGraph({
      schemaVersion: "task-graph.v2",
      graphId: "graph:missing-ownership",
      rootTaskId: "missing-ownership",
      nodes: [
        {
          nodeId: "missing-ownership:root",
          taskId: "missing-ownership",
          type: "root",
          status: "pending",
          createdAt: "2026-04-28T00:00:00.000Z",
          updatedAt: "2026-04-28T00:00:00.000Z"
        }
      ],
      edges: [],
      branches: ["main"],
      activeBranch: "main",
      createdAt: "2026-04-28T00:00:00.000Z",
      updatedAt: "2026-04-28T00:00:00.000Z"
    } as unknown as Parameters<typeof parseTaskGraph>[0])
  );
});

// ── Node operations tests ───────────────────────────────────────────────────

test("task-graph: addNodeToGraph adds a node", () => {
  const graph = createTaskGraph({ taskId: "test-task" });
  const updated = addNodeToGraph(graph, {
    nodeId: "node-1",
    taskId: "test-task",
    type: "subtask",
    status: "pending"
  });

  assert.equal(updated.nodes.length, 2);
  assert.ok(updated.nodes.some(n => n.nodeId === "node-1"));
  const node = getNode(updated, "node-1");
  assert.equal(node?.branchId, "main");
  assert.equal(node?.originBranchId, "main");
  assert.deepEqual(node?.mergedFromBranchIds, []);
});

test("task-graph: updateNodeStatus updates node status", () => {
  const graph = createTaskGraph({ taskId: "test-task" });
  const updated = updateNodeStatus(graph, `${graph.rootTaskId}:root`, "completed");
  const node = getNode(updated, `${graph.rootTaskId}:root`);

  assert.equal(node?.status, "completed");
});

test("task-graph: updateNodeStatus only updates active branch duplicate when present", () => {
  let graph = createTaskGraph({ taskId: "branch-update-test" });
  graph = addNodeToGraph(graph, {
    nodeId: "shared-node",
    taskId: "branch-update-test",
    type: "subtask",
    status: "pending",
    branchId: "main",
    originBranchId: "main",
    mergedFromBranchIds: []
  });

  graph = createBranch(graph, "feature");
  graph = addNodeToGraph(graph, {
    nodeId: "shared-node",
    taskId: "branch-update-test",
    type: "subtask",
    status: "in_progress",
    branchId: "feature",
    originBranchId: "main",
    mergedFromBranchIds: []
  });

  const updated = updateNodeStatus(graph, "shared-node", "completed");
  const sharedNodes = updated.nodes.filter(n => n.nodeId === "shared-node");

  assert.equal(sharedNodes.find(n => n.branchId === "main")?.status, "pending");
  assert.equal(sharedNodes.find(n => n.branchId === "feature")?.status, "completed");
});

test("task-graph: getNodesByStatus filters nodes", () => {
  let graph = createTaskGraph({ taskId: "test-task" });
  graph = addNodeToGraph(graph, {
    nodeId: "node-1",
    taskId: "test-task",
    type: "subtask",
    status: "completed"
  });
  graph = addNodeToGraph(graph, {
    nodeId: "node-2",
    taskId: "test-task",
    type: "subtask",
    status: "pending"
  });

  const completed = getNodesByStatus(graph, "completed");
  assert.equal(completed.length, 1);
  assert.equal(completed[0]?.nodeId, "node-1");
});

// ── Edge operations tests ───────────────────────────────────────────────────

test("task-graph: addEdgeToGraph adds an edge", () => {
  let graph = createTaskGraph({ taskId: "test-task" });
  graph = addNodeToGraph(graph, {
    nodeId: "node-1",
    taskId: "test-task",
    type: "subtask",
    status: "pending"
  });

  const updated = addEdgeToGraph(graph, {
    sourceNodeId: `${graph.rootTaskId}:root`,
    targetNodeId: "node-1",
    type: "dependency"
  });

  assert.equal(updated.edges.length, 1);
  assert.equal(updated.edges[0]?.type, "dependency");
  assert.equal(updated.edges[0]?.branchId, "main");
  assert.equal(updated.edges[0]?.originBranchId, "main");
  assert.deepEqual(updated.edges[0]?.mergedFromBranchIds, []);
});

test("task-graph: addDependencyEdge adds dependency edge", () => {
  let graph = createTaskGraph({ taskId: "test-task" });
  graph = addNodeToGraph(graph, {
    nodeId: "node-1",
    taskId: "test-task",
    type: "subtask",
    status: "pending"
  });

  const updated = addDependencyEdge(graph, `${graph.rootTaskId}:root`, "node-1");
  const deps = getDependencies(updated, "node-1");

  assert.equal(deps.length, 1);
  assert.equal(deps[0], `${graph.rootTaskId}:root`);
});

test("task-graph: addConflictEdge adds conflict edge", () => {
  let graph = createTaskGraph({ taskId: "test-task" });
  graph = addNodeToGraph(graph, {
    nodeId: "node-1",
    taskId: "test-task",
    type: "subtask",
    status: "pending"
  });

  const updated = addConflictEdge(graph, "node-1", "node-2");
  const conflicts = getConflicts(updated, "node-1");

  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0], "node-2");
});

// ── Branch operations tests ─────────────────────────────────────────────────

test("task-graph: createBranch adds a new branch", () => {
  const graph = createTaskGraph({ taskId: "test-task" });
  const updated = createBranch(graph, "feature-1");

  assert.equal(updated.branches.length, 2);
  assert.ok(updated.branches.includes("feature-1"));
  assert.equal(updated.activeBranch, "feature-1");
});

test("task-graph: switchBranch changes active branch", () => {
  let graph = createTaskGraph({ taskId: "test-task" });
  graph = createBranch(graph, "feature-1");
  const updated = switchBranch(graph, "main");

  assert.equal(updated.activeBranch, "main");
});

test("task-graph: switchBranch does nothing for non-existent branch", () => {
  const graph = createTaskGraph({ taskId: "test-task" });
  const updated = switchBranch(graph, "non-existent");

  assert.equal(updated.activeBranch, "main");
});

// ── Query tests ─────────────────────────────────────────────────────────────

test("task-graph: getNode returns undefined for non-existent node", () => {
  const graph = createTaskGraph({ taskId: "test-task" });
  const node = getNode(graph, "non-existent");
  assert.equal(node, undefined);
});

test("task-graph: hasConflict detects conflict", () => {
  let graph = createTaskGraph({ taskId: "test-task" });
  graph = addConflictEdge(graph, "node-1", "node-2");

  assert.equal(hasConflict(graph, "node-1", "node-2"), true);
  assert.equal(hasConflict(graph, "node-2", "node-1"), true);
});

// ── Graph traversal tests ───────────────────────────────────────────────────

test("task-graph: getReachableNodes returns reachable nodes", () => {
  let graph = createTaskGraph({ taskId: "test-task" });
  graph = addNodeToGraph(graph, {
    nodeId: "node-1",
    taskId: "test-task",
    type: "subtask",
    status: "pending"
  });
  graph = addNodeToGraph(graph, {
    nodeId: "node-2",
    taskId: "test-task",
    type: "subtask",
    status: "pending"
  });
  graph = addDependencyEdge(graph, `${graph.rootTaskId}:root`, "node-1");
  graph = addDependencyEdge(graph, "node-1", "node-2");

  const reachable = getReachableNodes(graph, `${graph.rootTaskId}:root`);

  assert.ok(reachable.includes(`${graph.rootTaskId}:root`));
  assert.ok(reachable.includes("node-1"));
  assert.ok(reachable.includes("node-2"));
});

test("task-graph: isGraphComplete returns true when all nodes completed", () => {
  let graph = createTaskGraph({ taskId: "test-task" });
  graph = updateNodeStatus(graph, `${graph.rootTaskId}:root`, "completed");

  assert.equal(isGraphComplete(graph), true);
});

// ── Graph Delta tests ────────────────────────────────────────────────────────

test("task-graph: createGraphDelta captures full graph state", () => {
  let graph = createTaskGraph({ taskId: "delta-test" });
  graph = addNodeToGraph(graph, {
    nodeId: "node-1",
    taskId: "delta-test",
    type: "subtask",
    status: "completed"
  });

  const delta = createGraphDelta(graph, "cp-1");

  assert.equal(delta.schemaVersion, "task-graph-delta.v2");
  assert.equal(delta.graphId, graph.graphId);
  assert.equal(delta.checkpointId, "cp-1");
  assert.equal(delta.nodes.length, 2);
  assert.equal(delta.edges.length, 0);
  assert.equal(delta.rootTaskId, "delta-test");
});

test("task-graph: parseTaskGraphDelta rejects legacy v1 delta payloads", () => {
  assert.throws(() =>
    parseTaskGraphDelta({
      schemaVersion: "task-graph-delta.v1",
      graphId: "graph:legacy",
      checkpointId: "cp-legacy",
      branchId: "main",
      nodes: [],
      edges: [],
      activeBranch: "main",
      rootTaskId: "legacy",
      createdAt: "2026-04-28T00:00:00.000Z"
    } as unknown as Parameters<typeof parseTaskGraphDelta>[0])
  );
});

test("task-graph: applyGraphDelta restores graph to checkpoint state", () => {
  let graph = createTaskGraph({ taskId: "delta-test" });
  graph = addNodeToGraph(graph, {
    nodeId: "node-original",
    taskId: "delta-test",
    type: "subtask",
    status: "completed"
  });

  // Create delta at this point
  const delta = createGraphDelta(graph, "cp-1");

  // Add more nodes after checkpoint
  graph = addNodeToGraph(graph, {
    nodeId: "node-after-cp",
    taskId: "delta-test",
    type: "subtask",
    status: "pending"
  });

  // Apply delta to roll back
  const restored = applyGraphDelta(graph, delta);

  assert.equal(restored.nodes.length, 2);
  assert.ok(restored.nodes.some(n => n.nodeId === "node-original"));
  assert.ok(!restored.nodes.some(n => n.nodeId === "node-after-cp"));
});

// ── Checkpoint Node tests ────────────────────────────────────────────────────

test("task-graph: recordCheckpointNode adds checkpoint node and returns delta", () => {
  let graph = createTaskGraph({ taskId: "cp-test" });
  graph = addNodeToGraph(graph, {
    nodeId: "node-1",
    taskId: "cp-test",
    type: "subtask",
    status: "completed"
  });

  const { graph: updated, delta } = recordCheckpointNode(graph, "cp-1");

  const cpNode = getNode(updated, "checkpoint:cp-1");
  assert.ok(cpNode);
  assert.equal(cpNode?.type, "checkpoint");
  assert.equal(cpNode?.status, "completed");
  assert.equal(cpNode?.branchId, "main");
  assert.equal(cpNode?.originBranchId, "main");
  assert.deepEqual(cpNode?.mergedFromBranchIds, []);
  assert.ok(cpNode?.data?.delta);
  assert.equal(delta.checkpointId, "cp-1");
  assert.equal(updated.nodes.length, 3); // root + node-1 + checkpoint
});

// ── Rollback tests ───────────────────────────────────────────────────────────

test("task-graph: rollbackToCheckpoint restores graph state", () => {
  let graph = createTaskGraph({ taskId: "rollback-test" });
  graph = addNodeToGraph(graph, {
    nodeId: "node-safe",
    taskId: "rollback-test",
    type: "subtask",
    status: "completed"
  });

  // Record checkpoint
  const { graph: afterCp } = recordCheckpointNode(graph, "cp-safe");

  // Add more nodes
  let modified = addNodeToGraph(afterCp, {
    nodeId: "node-danger",
    taskId: "rollback-test",
    type: "subtask",
    status: "in_progress"
  });

  // Rollback
  const restored = rollbackToCheckpoint(modified, "cp-safe");

  assert.ok(restored.nodes.some(n => n.nodeId === "node-safe"));
  assert.ok(!restored.nodes.some(n => n.nodeId === "node-danger"));
  // Checkpoint node itself should still be there
  assert.ok(restored.nodes.some(n => n.nodeId === "checkpoint:cp-safe"));
});

test("task-graph: rollbackToCheckpoint returns original on missing checkpoint", () => {
  const graph = createTaskGraph({ taskId: "rollback-test" });
  const result = rollbackToCheckpoint(graph, "nonexistent");
  assert.equal(result.nodes.length, 1);
});

test("task-graph: listCheckpoints returns all checkpoint IDs", () => {
  let graph = createTaskGraph({ taskId: "list-cp-test" });
  const { graph: g1 } = recordCheckpointNode(graph, "cp-a");
  const { graph: g2 } = recordCheckpointNode(g1, "cp-b");

  const cps = listCheckpoints(g2);
  assert.equal(cps.length, 2);
  assert.ok(cps.includes("cp-a"));
  assert.ok(cps.includes("cp-b"));
});

// ── Branch Merge tests ───────────────────────────────────────────────────────

test("task-graph: mergeBranch with union copies new nodes to target", () => {
  let graph = createTaskGraph({ taskId: "merge-test" });
  graph = createBranch(graph, "feature-x");

  graph = addNodeToGraph(graph, {
    nodeId: "feat-node",
    taskId: "merge-test",
    type: "subtask",
    status: "completed"
  });

  const merged = mergeBranch(graph, "feature-x", "main", "union");
  const featureNode = getNode(merged, "feat-node");

  assert.ok(featureNode);
  assert.equal(featureNode?.branchId, "main");
  assert.equal(featureNode?.originBranchId, "feature-x");
  assert.deepEqual(featureNode?.mergedFromBranchIds, ["feature-x"]);
  assert.equal(merged.activeBranch, "main");
});

test("task-graph: mergeBranch copies source-only edges to target with provenance", () => {
  let graph = createTaskGraph({ taskId: "merge-edge-test" });
  graph = createBranch(graph, "feature-x");
  graph = addNodeToGraph(graph, {
    nodeId: "feat-node",
    taskId: "merge-edge-test",
    type: "subtask",
    status: "completed"
  });
  graph = addDependencyEdge(graph, `${graph.rootTaskId}:root`, "feat-node");

  const merged = mergeBranch(graph, "feature-x", "main", "union");
  const featureEdge = merged.edges.find(
    e =>
      e.sourceNodeId === `${graph.rootTaskId}:root` &&
      e.targetNodeId === "feat-node" &&
      e.type === "dependency"
  );

  assert.ok(featureEdge);
  assert.equal(featureEdge?.branchId, "main");
  assert.equal(featureEdge?.originBranchId, "feature-x");
  assert.deepEqual(featureEdge?.mergedFromBranchIds, ["feature-x"]);
});

test("task-graph: mergeBranch returns original if source branch missing", () => {
  const graph = createTaskGraph({ taskId: "merge-test" });
  const result = mergeBranch(graph, "nonexistent", "main");
  assert.equal(result.nodes.length, 1);
});

test("task-graph: mergeBranch returns original if source equals target", () => {
  const graph = createTaskGraph({ taskId: "merge-test" });
  const result = mergeBranch(graph, "main", "main");
  assert.equal(result.nodes.length, 1);
});

test("task-graph: mergeBranch keep_target keeps target-owned conflicting node", () => {
  let graph = createTaskGraph({ taskId: "merge-kt-test" });

  graph = addNodeToGraph(graph, {
    nodeId: "node-1",
    taskId: "merge-kt-test",
    type: "subtask",
    status: "pending",
    branchId: "main",
    originBranchId: "main",
    mergedFromBranchIds: ["main-base"]
  });

  graph = createBranch(graph, "feature");
  graph = addNodeToGraph(graph, {
    nodeId: "node-1",
    taskId: "merge-kt-test",
    type: "subtask",
    status: "completed",
    branchId: "feature",
    originBranchId: "main",
    mergedFromBranchIds: ["feature-base"]
  });

  const merged = mergeBranch(graph, "feature", "main", "keep_target");
  const mergedNodes = merged.nodes.filter(n => n.nodeId === "node-1");

  assert.equal(mergedNodes.length, 1);
  assert.equal(mergedNodes[0]?.status, "pending");
  assert.equal(mergedNodes[0]?.branchId, "main");
  assert.equal(mergedNodes[0]?.originBranchId, "main");
  assert.deepEqual(mergedNodes[0]?.mergedFromBranchIds, [
    "main-base",
    "feature-base",
    "feature"
  ]);
});

test("task-graph: mergeBranch keep_source retargets source-owned conflicting node", () => {
  let graph = createTaskGraph({ taskId: "merge-ks-test" });

  graph = addNodeToGraph(graph, {
    nodeId: "node-1",
    taskId: "merge-ks-test",
    type: "subtask",
    status: "pending",
    branchId: "main",
    originBranchId: "main",
    mergedFromBranchIds: ["main-base"]
  });

  graph = createBranch(graph, "feature");
  graph = addNodeToGraph(graph, {
    nodeId: "node-1",
    taskId: "merge-ks-test",
    type: "subtask",
    status: "completed",
    branchId: "feature",
    originBranchId: "feature",
    mergedFromBranchIds: ["feature-base"]
  });

  const merged = mergeBranch(graph, "feature", "main", "keep_source");
  const mergedNodes = merged.nodes.filter(n => n.nodeId === "node-1");

  assert.equal(mergedNodes.length, 1);
  assert.equal(mergedNodes[0]?.status, "completed");
  assert.equal(mergedNodes[0]?.branchId, "main");
  assert.equal(mergedNodes[0]?.originBranchId, "feature");
  assert.deepEqual(mergedNodes[0]?.mergedFromBranchIds, [
    "feature-base",
    "main-base",
    "feature"
  ]);
});

test("task-graph: mergeBranch keep_source retargets source-owned conflicting edge", () => {
  let graph = createTaskGraph({ taskId: "merge-edge-ks-test" });
  graph = addNodeToGraph(graph, {
    nodeId: "node-1",
    taskId: "merge-edge-ks-test",
    type: "subtask",
    status: "pending"
  });
  graph = addEdgeToGraph(graph, {
    sourceNodeId: `${graph.rootTaskId}:root`,
    targetNodeId: "node-1",
    type: "dependency",
    branchId: "main",
    originBranchId: "main",
    mergedFromBranchIds: [],
    metadata: { owner: "target" }
  });

  graph = createBranch(graph, "feature");
  graph = addEdgeToGraph(graph, {
    sourceNodeId: `${graph.rootTaskId}:root`,
    targetNodeId: "node-1",
    type: "dependency",
    branchId: "feature",
    originBranchId: "feature",
    mergedFromBranchIds: [],
    metadata: { owner: "source" }
  });

  const merged = mergeBranch(graph, "feature", "main", "keep_source");
  const mergedEdges = merged.edges.filter(
    e =>
      e.sourceNodeId === `${graph.rootTaskId}:root` &&
      e.targetNodeId === "node-1" &&
      e.type === "dependency"
  );

  assert.equal(mergedEdges.length, 1);
  assert.equal(mergedEdges[0]?.branchId, "main");
  assert.equal(mergedEdges[0]?.originBranchId, "feature");
  assert.deepEqual(mergedEdges[0]?.mergedFromBranchIds, ["feature"]);
  assert.equal(mergedEdges[0]?.metadata?.owner, "source");
});

// ── Store tests ──────────────────────────────────────────────────────────────

test("task-graph: RecordingTaskGraphStore saves and loads graph", async () => {
  const store = createRecordingTaskGraphStore();
  const graph = createTaskGraph({ taskId: "store-test" });

  await store.save(graph);
  const loaded = await store.load(graph.graphId);

  assert.ok(loaded);
  assert.equal(loaded?.rootTaskId, "store-test");
});

test("task-graph: RecordingTaskGraphStore finds by root task ID", async () => {
  const store = createRecordingTaskGraphStore();
  const graph = createTaskGraph({ taskId: "find-test" });

  await store.save(graph);
  const found = await store.findByRootTaskId("find-test");

  assert.ok(found);
  assert.equal(found?.graphId, graph.graphId);
});

test("task-graph: RecordingTaskGraphStore returns undefined for missing", async () => {
  const store = createRecordingTaskGraphStore();
  const result = await store.load("nonexistent");
  assert.equal(result, undefined);
});

test("task-graph: FileTaskGraphStore persists and loads from disk", async () => {
  const TEST_PATH = join(__dirname, "..", ".test-task-graph-store");
  const store = createFileTaskGraphStore({ basePath: TEST_PATH });
  const graph = createTaskGraph({ taskId: "file-store-test" });

  await store.save(graph);
  const loaded = await store.load(graph.graphId);

  assert.ok(loaded);
  assert.equal(loaded?.rootTaskId, "file-store-test");
  assert.equal(loaded?.graphId, graph.graphId);

  // Cleanup
  await rm(TEST_PATH, { recursive: true, force: true }).catch(() => {});
});

test("task-graph: FileTaskGraphStore returns undefined for missing", async () => {
  const TEST_PATH = join(__dirname, "..", ".test-task-graph-store-missing");
  const store = createFileTaskGraphStore({ basePath: TEST_PATH });
  const result = await store.load("nonexistent");
  assert.equal(result, undefined);
});
