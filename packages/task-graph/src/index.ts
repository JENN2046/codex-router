import { z } from "zod";

// ── Branch Ownership ────────────────────────────────────────────────────────

const BranchOwnershipSchema = {
  branchId: z.string().min(1),
  originBranchId: z.string().min(1),
  mergedFromBranchIds: z.array(z.string().min(1))
};

interface BranchOwned {
  branchId: string;
  originBranchId: string;
  mergedFromBranchIds: string[];
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(value => value.length > 0)));
}

function applyBranchOwnership<T extends Partial<BranchOwned>>(
  item: T,
  defaultBranchId: string
): T & BranchOwned {
  const branchId = item.branchId ?? defaultBranchId;
  return {
    ...item,
    branchId,
    originBranchId: item.originBranchId ?? branchId,
    mergedFromBranchIds: uniqueStrings(item.mergedFromBranchIds ?? [])
  };
}

function markMergedIntoTarget<T extends BranchOwned>(
  item: T,
  targetBranchId: string,
  sourceBranchId: string,
  extraMergedFromBranchIds: string[] = []
): T {
  return {
    ...item,
    branchId: targetBranchId,
    mergedFromBranchIds: uniqueStrings([
      ...item.mergedFromBranchIds,
      ...extraMergedFromBranchIds,
      sourceBranchId
    ])
  };
}

function collectMergedFrom(...items: BranchOwned[]): string[] {
  return uniqueStrings(items.flatMap(item => item.mergedFromBranchIds));
}

function edgeOwnedKey(edge: { sourceNodeId: string; targetNodeId: string; type: string }): string {
  return `${edge.sourceNodeId}->${edge.targetNodeId}:${edge.type}`;
}

function groupByKey<T>(items: T[], getKey: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = getKey(item);
    const group = groups.get(key);
    if (group) {
      group.push(item);
    } else {
      groups.set(key, [item]);
    }
  }
  return groups;
}

function mergeBranchOwnedItems<T extends BranchOwned>(
  items: T[],
  sourceBranchId: string,
  targetBranchId: string,
  strategy: MergeStrategy
): T[] {
  const mergedItems: T[] = [];

  for (const group of groupByKey(items, itemKey).values()) {
    const sourceItem = group.find(item => item.branchId === sourceBranchId);
    const targetItem = group.find(item => item.branchId === targetBranchId);
    const unrelatedItems = group.filter(
      item => item.branchId !== sourceBranchId && item.branchId !== targetBranchId
    );

    mergedItems.push(...unrelatedItems);

    if (sourceItem && targetItem) {
      if (strategy === "keep_source") {
        mergedItems.push(
          markMergedIntoTarget(
            sourceItem,
            targetBranchId,
            sourceBranchId,
            collectMergedFrom(targetItem)
          )
        );
      } else {
        mergedItems.push(
          markMergedIntoTarget(
            targetItem,
            targetBranchId,
            sourceBranchId,
            collectMergedFrom(sourceItem)
          )
        );
      }
      continue;
    }

    if (sourceItem) {
      mergedItems.push(markMergedIntoTarget(sourceItem, targetBranchId, sourceBranchId));
      continue;
    }

    if (targetItem) {
      mergedItems.push(targetItem);
    }
  }

  return mergedItems;
}

function itemKey(item: BranchOwned): string {
  const maybeNode = item as BranchOwned & { nodeId?: unknown };
  if (typeof maybeNode.nodeId === "string") {
    return maybeNode.nodeId;
  }

  const maybeEdge = item as BranchOwned & {
    sourceNodeId?: unknown;
    targetNodeId?: unknown;
    type?: unknown;
  };
  if (
    typeof maybeEdge.sourceNodeId === "string" &&
    typeof maybeEdge.targetNodeId === "string" &&
    typeof maybeEdge.type === "string"
  ) {
    return edgeOwnedKey({
      sourceNodeId: maybeEdge.sourceNodeId,
      targetNodeId: maybeEdge.targetNodeId,
      type: maybeEdge.type
    });
  }

  return JSON.stringify(item);
}

// ── Task Graph Node ──────────────────────────────────────────────────────────

export const TaskGraphNodeSchema = z.object({
  nodeId: z.string().min(1),
  taskId: z.string().min(1),
  type: z.enum(["root", "subtask", "checkpoint", "branch"]),
  status: z.enum(["pending", "in_progress", "completed", "failed", "blocked"]),
  data: z.record(z.unknown()).optional(),
  ...BranchOwnershipSchema,
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1)
});

export type TaskGraphNode = z.infer<typeof TaskGraphNodeSchema>;
export type TaskGraphNodeStatus = z.infer<typeof TaskGraphNodeSchema>["status"];
export type TaskGraphNodeInput = Omit<
  TaskGraphNode,
  "createdAt" | "updatedAt" | "branchId" | "originBranchId" | "mergedFromBranchIds"
> &
  Partial<Pick<TaskGraphNode, "branchId" | "originBranchId" | "mergedFromBranchIds">>;

// ── Task Graph Edge ──────────────────────────────────────────────────────────

export const TaskGraphEdgeSchema = z.object({
  edgeId: z.string().min(1),
  sourceNodeId: z.string().min(1),
  targetNodeId: z.string().min(1),
  type: z.enum(["dependency", "conflict", "parent_child", "sequential"]),
  ...BranchOwnershipSchema,
  metadata: z.record(z.unknown()).optional()
});

export type TaskGraphEdge = z.infer<typeof TaskGraphEdgeSchema>;
export type TaskGraphEdgeInput = Omit<
  TaskGraphEdge,
  "edgeId" | "branchId" | "originBranchId" | "mergedFromBranchIds"
> &
  Partial<Pick<TaskGraphEdge, "branchId" | "originBranchId" | "mergedFromBranchIds">>;

// ── Task Graph ───────────────────────────────────────────────────────────────

export const TaskGraphSchema = z.object({
  schemaVersion: z.literal("task-graph.v2").default("task-graph.v2"),
  graphId: z.string().min(1),
  rootTaskId: z.string().min(1),
  nodes: z.array(TaskGraphNodeSchema).default([]),
  edges: z.array(TaskGraphEdgeSchema).default([]),
  branches: z.array(z.string()).default([]),
  activeBranch: z.string().min(1),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1)
});

export type TaskGraph = z.infer<typeof TaskGraphSchema>;
export type TaskGraphInput = z.input<typeof TaskGraphSchema>;

// ── Parse helper ────────────────────────────────────────────────────────────

export function parseTaskGraph(input: TaskGraphInput): TaskGraph {
  return TaskGraphSchema.parse(input);
}

// ── Factory ─────────────────────────────────────────────────────────────────

export interface CreateTaskGraphInput {
  taskId: string;
  branchId?: string;
  now?: () => string;
}

export function createTaskGraph(input: CreateTaskGraphInput): TaskGraph {
  const now = input.now ?? (() => new Date().toISOString());
  const timestamp = now();
  const branchId = input.branchId ?? "main";

  const rootNode: TaskGraphNode = {
    nodeId: `${input.taskId}:root`,
    taskId: input.taskId,
    type: "root",
    status: "pending",
    branchId,
    originBranchId: branchId,
    mergedFromBranchIds: [],
    createdAt: timestamp,
    updatedAt: timestamp
  };

  return parseTaskGraph({
    graphId: `graph:${input.taskId}`,
    rootTaskId: input.taskId,
    nodes: [rootNode],
    edges: [],
    branches: [branchId],
    activeBranch: branchId,
    createdAt: timestamp,
    updatedAt: timestamp
  });
}

// ── Node operations ─────────────────────────────────────────────────────────

export function addNodeToGraph(graph: TaskGraph, node: TaskGraphNodeInput): TaskGraph {
  const now = new Date().toISOString();
  const newNode: TaskGraphNode = {
    ...applyBranchOwnership(node, graph.activeBranch),
    createdAt: now,
    updatedAt: now
  };

  return {
    ...graph,
    nodes: [...graph.nodes, newNode],
    updatedAt: now
  };
}

export function updateNodeStatus(
  graph: TaskGraph,
  nodeId: string,
  status: TaskGraphNodeStatus
): TaskGraph {
  const now = new Date().toISOString();
  const activeBranchHasNode = graph.nodes.some(
    n => n.nodeId === nodeId && n.branchId === graph.activeBranch
  );
  return {
    ...graph,
    nodes: graph.nodes.map(n =>
      n.nodeId === nodeId && (!activeBranchHasNode || n.branchId === graph.activeBranch)
        ? { ...n, status, updatedAt: now }
        : n
    ),
    updatedAt: now
  };
}

// ── Edge operations ─────────────────────────────────────────────────────────

export function addEdgeToGraph(
  graph: TaskGraph,
  edge: TaskGraphEdgeInput
): TaskGraph {
  const now = new Date().toISOString();
  const newEdge: TaskGraphEdge = {
    ...applyBranchOwnership(edge, graph.activeBranch),
    edgeId: `edge:${edge.sourceNodeId}->${edge.targetNodeId}:${now}`
  };

  return {
    ...graph,
    edges: [...graph.edges, newEdge],
    updatedAt: now
  };
}

export function addDependencyEdge(
  graph: TaskGraph,
  sourceNodeId: string,
  targetNodeId: string
): TaskGraph {
  return addEdgeToGraph(graph, {
    sourceNodeId,
    targetNodeId,
    type: "dependency"
  });
}

export function addConflictEdge(
  graph: TaskGraph,
  sourceNodeId: string,
  targetNodeId: string
): TaskGraph {
  return addEdgeToGraph(graph, {
    sourceNodeId,
    targetNodeId,
    type: "conflict"
  });
}

// ── Branch operations ───────────────────────────────────────────────────────

export function createBranch(graph: TaskGraph, branchId: string): TaskGraph {
  const now = new Date().toISOString();
  if (graph.branches.includes(branchId)) {
    return graph;
  }

  return {
    ...graph,
    branches: [...graph.branches, branchId],
    activeBranch: branchId,
    updatedAt: now
  };
}

export function switchBranch(graph: TaskGraph, branchId: string): TaskGraph {
  const now = new Date().toISOString();
  if (!graph.branches.includes(branchId)) {
    return graph;
  }

  return {
    ...graph,
    activeBranch: branchId,
    updatedAt: now
  };
}

// ── Query helpers ───────────────────────────────────────────────────────────

export function getNode(graph: TaskGraph, nodeId: string): TaskGraphNode | undefined {
  return graph.nodes.find(n => n.nodeId === nodeId);
}

export function getNodesByStatus(graph: TaskGraph, status: TaskGraphNodeStatus): TaskGraphNode[] {
  return graph.nodes.filter(n => n.status === status);
}

export function getDependencies(graph: TaskGraph, nodeId: string): string[] {
  return graph.edges
    .filter(e => e.targetNodeId === nodeId && e.type === "dependency")
    .map(e => e.sourceNodeId);
}

export function getConflicts(graph: TaskGraph, nodeId: string): string[] {
  return graph.edges
    .filter(e => e.sourceNodeId === nodeId && e.type === "conflict")
    .map(e => e.targetNodeId);
}

export function hasConflict(graph: TaskGraph, nodeId1: string, nodeId2: string): boolean {
  return graph.edges.some(
    e =>
      e.type === "conflict" &&
      ((e.sourceNodeId === nodeId1 && e.targetNodeId === nodeId2) ||
        (e.sourceNodeId === nodeId2 && e.targetNodeId === nodeId1))
  );
}

// ── Graph traversal ─────────────────────────────────────────────────────────

export function getReachableNodes(graph: TaskGraph, startNodeId: string): string[] {
  const visited = new Set<string>();
  const queue = [startNodeId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    const neighbors = graph.edges
      .filter(e => e.sourceNodeId === current && e.type === "dependency")
      .map(e => e.targetNodeId);

    queue.push(...neighbors.filter(n => !visited.has(n)));
  }

  return Array.from(visited);
}

export function isGraphComplete(graph: TaskGraph): boolean {
  return graph.nodes.every(n => n.status === "completed" || n.status === "blocked");
}

// ── Graph Delta ──────────────────────────────────────────────────────────────

export const TaskGraphDeltaSchema = z.object({
  schemaVersion: z.literal("task-graph-delta.v2").default("task-graph-delta.v2"),
  graphId: z.string().min(1),
  checkpointId: z.string().min(1),
  branchId: z.string().min(1),
  nodes: z.array(TaskGraphNodeSchema),
  edges: z.array(TaskGraphEdgeSchema),
  activeBranch: z.string().min(1),
  rootTaskId: z.string().min(1),
  createdAt: z.string().min(1)
});

export type TaskGraphDelta = z.infer<typeof TaskGraphDeltaSchema>;
export type TaskGraphDeltaInput = z.input<typeof TaskGraphDeltaSchema>;

export function parseTaskGraphDelta(input: TaskGraphDeltaInput): TaskGraphDelta {
  return TaskGraphDeltaSchema.parse(input);
}

/**
 * Creates a full snapshot delta from the current graph state.
 * Used to save graph state alongside a checkpoint for later rollback.
 */
export function createGraphDelta(
  graph: TaskGraph,
  checkpointId: string
): TaskGraphDelta {
  const checkpointNodeId = `checkpoint:${checkpointId}`;
  return parseTaskGraphDelta({
    graphId: graph.graphId,
    checkpointId,
    branchId: graph.activeBranch,
    nodes: graph.nodes.filter(n => n.nodeId !== checkpointNodeId),
    edges: graph.edges,
    activeBranch: graph.activeBranch,
    rootTaskId: graph.rootTaskId,
    createdAt: new Date().toISOString()
  });
}

/**
 * Applies a delta to restore graph state to a previous checkpoint.
 * Application nodes are replaced from the delta snapshot.
 * Checkpoint nodes from the current graph are preserved (they hold delta data for rollback).
 */
export function applyGraphDelta(
  graph: TaskGraph,
  delta: TaskGraphDelta
): TaskGraph {
  const now = new Date().toISOString();
  const deltaNodeIds = new Set(delta.nodes.map(n => n.nodeId));

  // Keep checkpoint nodes from current graph (they hold delta data for rollback)
  const checkpointNodes = graph.nodes.filter(
    n => n.type === "checkpoint" && !deltaNodeIds.has(n.nodeId)
  );

  return {
    ...graph,
    nodes: [
      ...delta.nodes.map(n => ({ ...n })),
      ...checkpointNodes
    ],
    edges: delta.edges.map(e => ({ ...e })),
    activeBranch: delta.activeBranch,
    updatedAt: now
  };
}

// ── Checkpoint Node ──────────────────────────────────────────────────────────

/**
 * Creates a checkpoint node on the graph and returns both the updated graph
 * and a snapshot delta that can be stored in the checkpoint ledger.
 */
export function recordCheckpointNode(
  graph: TaskGraph,
  checkpointId: string
): { graph: TaskGraph; delta: TaskGraphDelta } {
  const checkpointNodeId = `checkpoint:${checkpointId}`;
  const checkpointNode: TaskGraphNodeInput = {
    nodeId: checkpointNodeId,
    taskId: graph.rootTaskId,
    type: "checkpoint",
    status: "completed",
    branchId: graph.activeBranch,
    originBranchId: graph.activeBranch,
    mergedFromBranchIds: []
  };

  const updated = addNodeToGraph(graph, checkpointNode);

  // Create delta AFTER adding checkpoint node, so delta includes it
  const delta = createGraphDelta(updated, checkpointId);
  // Store delta reference on the node
  updated.nodes = updated.nodes.map(n =>
    n.nodeId === checkpointNodeId
      ? { ...n, data: { delta: delta as unknown as Record<string, unknown> } }
      : n
  );

  return { graph: updated, delta };
}

// ── Rollback ─────────────────────────────────────────────────────────────────

/**
 * Rolls back the graph to a previously recorded checkpoint node.
 *
 * 1. Finds the checkpoint node by ID
 * 2. Extracts the stored delta from node data
 * 3. Applies the delta to restore nodes/edges to checkpoint state
 *
 * Returns the restored graph, or the original graph if the checkpoint
 * is not found or has no stored delta.
 */
export function rollbackToCheckpoint(
  graph: TaskGraph,
  checkpointId: string
): TaskGraph {
  const nodeId = `checkpoint:${checkpointId}`;
  const checkpointNode = getNode(graph, nodeId);

  if (!checkpointNode) {
    return graph;
  }

  const rawDelta = checkpointNode.data?.delta;
  if (!rawDelta) {
    return graph;
  }

  try {
    const delta = parseTaskGraphDelta(rawDelta as TaskGraphDeltaInput);
    return applyGraphDelta(graph, delta);
  } catch {
    return graph;
  }
}

/**
 * Returns all checkpoint node IDs in the graph, ordered by creation time.
 */
export function listCheckpoints(graph: TaskGraph): string[] {
  return graph.nodes
    .filter(n => n.type === "checkpoint" && n.data?.delta != null)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map(n => n.nodeId.replace(/^checkpoint:/, ""));
}

// ── Branch Merge ─────────────────────────────────────────────────────────────

export type MergeStrategy = "keep_source" | "keep_target" | "union";

/**
 * Merges nodes and edges from sourceBranch into targetBranch.
 *
 * Strategies:
 * - "keep_source": on conflict, source branch wins and is retargeted
 * - "keep_target": on conflict, target branch wins (default)
 * - "union": source-only items are copied, conflicting target items are kept with merge provenance
 */
export function mergeBranch(
  graph: TaskGraph,
  sourceBranchId: string,
  targetBranchId: string,
  strategy: MergeStrategy = "keep_target"
): TaskGraph {
  if (!graph.branches.includes(sourceBranchId)) {
    return graph;
  }
  if (!graph.branches.includes(targetBranchId)) {
    return graph;
  }
  if (sourceBranchId === targetBranchId) {
    return graph;
  }

  const now = new Date().toISOString();

  return {
    ...graph,
    nodes: mergeBranchOwnedItems(graph.nodes, sourceBranchId, targetBranchId, strategy),
    edges: mergeBranchOwnedItems(graph.edges, sourceBranchId, targetBranchId, strategy),
    activeBranch: targetBranchId,
    updatedAt: now
  };
}

// ── Store interface ──────────────────────────────────────────────────────────

export interface TaskGraphStore {
  save(graph: TaskGraph): Promise<void>;
  load(graphId: string): Promise<TaskGraph | undefined>;
  findByRootTaskId(taskId: string): Promise<TaskGraph | undefined>;
}

// ── In-memory store ──────────────────────────────────────────────────────────

export class RecordingTaskGraphStore implements TaskGraphStore {
  private readonly graphs = new Map<string, TaskGraph>();

  async save(graph: TaskGraph): Promise<void> {
    this.graphs.set(graph.graphId, graph);
  }

  async load(graphId: string): Promise<TaskGraph | undefined> {
    return this.graphs.get(graphId);
  }

  async findByRootTaskId(taskId: string): Promise<TaskGraph | undefined> {
    const graphId = `graph:${taskId}`;
    return this.graphs.get(graphId);
  }
}

export function createRecordingTaskGraphStore(): RecordingTaskGraphStore {
  return new RecordingTaskGraphStore();
}

// ── File-based store ─────────────────────────────────────────────────────────

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

export interface FileTaskGraphStoreOptions {
  basePath: string;
}

export class FileTaskGraphStore implements TaskGraphStore {
  private readonly basePath: string;

  constructor(options: FileTaskGraphStoreOptions) {
    this.basePath = options.basePath;
  }

  private async ensureBaseDir(): Promise<void> {
    await mkdir(this.basePath, { recursive: true });
  }

  private getFilePath(graphId: string): string {
    const safeId = graphId.replace(/[^a-zA-Z0-9_:-]/g, "_");
    return join(this.basePath, `${safeId}.json`);
  }

  async save(graph: TaskGraph): Promise<void> {
    await this.ensureBaseDir();
    const filePath = this.getFilePath(graph.graphId);
    await writeFile(filePath, JSON.stringify(graph, null, 2), "utf-8");
  }

  async load(graphId: string): Promise<TaskGraph | undefined> {
    await this.ensureBaseDir();
    const filePath = this.getFilePath(graphId);
    try {
      const content = await readFile(filePath, "utf-8");
      return parseTaskGraph(JSON.parse(content));
    } catch {
      return undefined;
    }
  }

  async findByRootTaskId(taskId: string): Promise<TaskGraph | undefined> {
    return this.load(`graph:${taskId}`);
  }
}

export function createFileTaskGraphStore(
  options: FileTaskGraphStoreOptions
): FileTaskGraphStore {
  return new FileTaskGraphStore(options);
}
