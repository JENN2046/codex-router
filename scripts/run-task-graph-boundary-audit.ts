#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const GOVERNANCE_CONTROL_PLANE = "docs/governance/GOVERNANCE_CONTROL_PLANE.md";
const GOVERNANCE_README = "docs/governance/README.md";
const GOVERNANCE_RUNNER = "scripts/run-governance-check.ts";
const TASK_GRAPH_SOURCE = "packages/task-graph/src/index.ts";
const TASK_GRAPH_TEST = "tests/task-graph.test.ts";

const REQUIRED_SOURCE_MARKERS = [
  "TaskGraphNodeSchema",
  "TaskGraphEdgeSchema",
  "TaskGraphSchema",
  "TaskGraphDeltaSchema",
  "createTaskGraph",
  "addNodeToGraph",
  "updateNodeStatus",
  "addEdgeToGraph",
  "getReachableNodes",
  "isGraphComplete",
  "createGraphDelta",
  "applyGraphDelta",
  "recordCheckpointNode",
  "rollbackToCheckpoint",
  "mergeBranch",
  "TaskGraphStore",
  "RecordingTaskGraphStore",
  "FileTaskGraphStore",
  "writeFile(filePath, JSON.stringify(graph, null, 2), \"utf-8\")",
  "const safeId = graphId.replace(/[^a-zA-Z0-9_:-]/g, \"_\")"
] as const;

const REQUIRED_TEST_MARKERS = [
  "task-graph: createTaskGraph creates a graph with root node",
  "task-graph: parseTaskGraph rejects legacy v1 graph payloads",
  "task-graph: updateNodeStatus only updates active branch duplicate when present",
  "task-graph: getReachableNodes returns reachable nodes",
  "task-graph: isGraphComplete returns true when all nodes completed",
  "task-graph: createGraphDelta captures full graph state",
  "task-graph: applyGraphDelta restores graph to checkpoint state",
  "task-graph: recordCheckpointNode adds checkpoint node and returns delta",
  "task-graph: rollbackToCheckpoint restores graph state",
  "task-graph: rollbackToCheckpoint returns original on missing checkpoint",
  "task-graph: mergeBranch with union copies new nodes to target",
  "task-graph: mergeBranch keep_source retargets source-owned conflicting node",
  "task-graph: FileTaskGraphStore persists and loads from disk"
] as const;

const FORBIDDEN_RUNTIME_SOURCE_MARKERS = [
  "provider.execute(",
  ".executeProvider(",
  "runCodexCli(",
  "CodexCliExecutorProvider",
  "dispatchGovernanceOperatorActionHostExecutor",
  "dispatchToHost(",
  "runDesktopTask(",
  "resumeDesktopTask(",
  "invokeSubAgent",
  "spawnSubAgent",
  "hostExecutor(",
  "spawn(",
  "execFile(",
  "exec(",
  "child_process",
  "new Worker(",
  "fetch(",
  "apply_patch("
] as const;

const FORBIDDEN_OUTPUT_MARKERS = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
] as const;

export interface TaskGraphBoundaryAuditInput {
  governanceControlPlaneText: string;
  governanceReadmeText: string;
  governanceRunnerText: string;
  taskGraphSourceText: string;
  taskGraphTestText: string;
}

export interface TaskGraphBoundaryAuditResult {
  status: "passed" | "blocked";
  checks: {
    controlPlaneAuthorityRecorded: boolean;
    governanceReadmeListsBoundary: boolean;
    governanceRunnerRegistered: boolean;
    sourceGraphMarkersPresent: boolean;
    coverageRecorded: boolean;
    noRuntimeInvocationSurface: boolean;
    outputSanitized: boolean;
  };
  summary: {
    taskGraphMode: "structural_task_graph_state_only";
    nodeStatusIsExecutionAuthorization: false;
    graphCompletionIsRuntimeCompletion: false;
    dependencyEdgeIsSchedulerDispatch: false;
    conflictEdgeIsRuntimeBlockExecution: false;
    checkpointNodeIsRollbackExecution: false;
    graphDeltaIsWorkspaceRollbackAuthorization: false;
    rollbackToCheckpointIsHostExecutorAuthorization: false;
    branchMergeIsGitMergeOrWorkspaceWrite: false;
    fileStorePersistenceIsWorkspaceWriteExecution: false;
    taskGraphCallsDuringAudit: 0;
    taskGraphStoreWritesDuringAudit: 0;
    providerExecuteCallsDuringAudit: 0;
    codexCliCallsDuringAudit: 0;
    subAgentRuntimeCallsDuringAudit: 0;
    hostExecutorCallsDuringAudit: 0;
    hostDispatchCallsDuringAudit: 0;
    toolRuntimeCallsDuringAudit: 0;
    shellProcessCallsDuringAudit: 0;
    workspaceWriteCallsDuringAudit: 0;
    externalWriteCallsDuringAudit: 0;
  };
  reasons: string[];
}

export type TaskGraphBoundaryAuditOutputFormat = "text" | "json";

export async function collectTaskGraphBoundaryAuditInput(
  cwd = process.cwd()
): Promise<TaskGraphBoundaryAuditInput> {
  const [
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    taskGraphSourceText,
    taskGraphTestText
  ] = await Promise.all([
    read(cwd, GOVERNANCE_CONTROL_PLANE),
    read(cwd, GOVERNANCE_README),
    read(cwd, GOVERNANCE_RUNNER),
    read(cwd, TASK_GRAPH_SOURCE),
    read(cwd, TASK_GRAPH_TEST)
  ]);

  return {
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    taskGraphSourceText,
    taskGraphTestText
  };
}

export function reviewTaskGraphBoundaryAudit(
  input: TaskGraphBoundaryAuditInput
): TaskGraphBoundaryAuditResult {
  const checks = {
    controlPlaneAuthorityRecorded: controlPlaneAuthorityRecorded(
      input.governanceControlPlaneText
    ),
    governanceReadmeListsBoundary: input.governanceReadmeText.includes(
      "npm run governance -- audit task-graph-boundary"
    ),
    governanceRunnerRegistered: input.governanceRunnerText.includes(
      "task-graph-boundary"
    ),
    sourceGraphMarkersPresent: REQUIRED_SOURCE_MARKERS.every((marker) =>
      input.taskGraphSourceText.includes(marker)
    ),
    coverageRecorded: REQUIRED_TEST_MARKERS.every((marker) =>
      input.taskGraphTestText.includes(marker)
    ),
    noRuntimeInvocationSurface: noRuntimeInvocationSurface(
      input.taskGraphSourceText
    ),
    outputSanitized: outputSanitized(input)
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      taskGraphMode: "structural_task_graph_state_only",
      nodeStatusIsExecutionAuthorization: false,
      graphCompletionIsRuntimeCompletion: false,
      dependencyEdgeIsSchedulerDispatch: false,
      conflictEdgeIsRuntimeBlockExecution: false,
      checkpointNodeIsRollbackExecution: false,
      graphDeltaIsWorkspaceRollbackAuthorization: false,
      rollbackToCheckpointIsHostExecutorAuthorization: false,
      branchMergeIsGitMergeOrWorkspaceWrite: false,
      fileStorePersistenceIsWorkspaceWriteExecution: false,
      taskGraphCallsDuringAudit: 0,
      taskGraphStoreWritesDuringAudit: 0,
      providerExecuteCallsDuringAudit: 0,
      codexCliCallsDuringAudit: 0,
      subAgentRuntimeCallsDuringAudit: 0,
      hostExecutorCallsDuringAudit: 0,
      hostDispatchCallsDuringAudit: 0,
      toolRuntimeCallsDuringAudit: 0,
      shellProcessCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0
    },
    reasons
  };
}

export function formatTaskGraphBoundaryAuditResult(
  review: TaskGraphBoundaryAuditResult,
  format: TaskGraphBoundaryAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Task graph boundary audit",
    `status: ${review.status}`,
    `task graph mode: ${review.summary.taskGraphMode}`,
    `node status is execution authorization: ${review.summary.nodeStatusIsExecutionAuthorization}`,
    `graph completion is runtime completion: ${review.summary.graphCompletionIsRuntimeCompletion}`,
    `dependency edge is scheduler dispatch: ${review.summary.dependencyEdgeIsSchedulerDispatch}`,
    `conflict edge is runtime block execution: ${review.summary.conflictEdgeIsRuntimeBlockExecution}`,
    `checkpoint node is rollback execution: ${review.summary.checkpointNodeIsRollbackExecution}`,
    `graph delta is workspace rollback authorization: ${review.summary.graphDeltaIsWorkspaceRollbackAuthorization}`,
    `rollbackToCheckpoint is host executor authorization: ${review.summary.rollbackToCheckpointIsHostExecutorAuthorization}`,
    `branch merge is git merge or workspace-write: ${review.summary.branchMergeIsGitMergeOrWorkspaceWrite}`,
    `file-store persistence is workspace-write execution: ${review.summary.fileStorePersistenceIsWorkspaceWriteExecution}`,
    `task graph calls during audit: ${review.summary.taskGraphCallsDuringAudit}`,
    `task graph store writes during audit: ${review.summary.taskGraphStoreWritesDuringAudit}`,
    `provider execute calls during audit: ${review.summary.providerExecuteCallsDuringAudit}`,
    `Codex CLI calls during audit: ${review.summary.codexCliCallsDuringAudit}`,
    `sub-agent runtime calls during audit: ${review.summary.subAgentRuntimeCallsDuringAudit}`,
    `host executor calls during audit: ${review.summary.hostExecutorCallsDuringAudit}`,
    `host dispatch calls during audit: ${review.summary.hostDispatchCallsDuringAudit}`,
    `tool runtime calls during audit: ${review.summary.toolRuntimeCallsDuringAudit}`,
    `shell/process calls during audit: ${review.summary.shellProcessCallsDuringAudit}`,
    `workspace-write calls during audit: ${review.summary.workspaceWriteCallsDuringAudit}`,
    `external write calls during audit: ${review.summary.externalWriteCallsDuringAudit}`,
    ...(review.reasons.length > 0 ? [`reasons: ${review.reasons.join(",")}`] : [])
  ].join("\n");
}

async function read(cwd: string, filePath: string): Promise<string> {
  return readFile(join(cwd, filePath), "utf8");
}

function controlPlaneAuthorityRecorded(text: string): boolean {
  return text.includes("Task graph boundary")
    && text.includes("structural task graph state only")
    && text.includes("node statuses are not execution authorization")
    && text.includes("graph completion is not runtime completion")
    && text.includes("dependency edges are not scheduler dispatch")
    && text.includes("conflict edges are not runtime block execution")
    && text.includes("checkpoint nodes are not rollback execution")
    && text.includes("graph deltas are not workspace rollback authorization")
    && text.includes("rollbackToCheckpoint is not host executor authorization")
    && text.includes("branch merges are not git merge or workspace-write")
    && text.includes("task graph file-store persistence is not workspace-write execution");
}

function noRuntimeInvocationSurface(text: string): boolean {
  return FORBIDDEN_RUNTIME_SOURCE_MARKERS.every((marker) => !text.includes(marker));
}

function outputSanitized(input: TaskGraphBoundaryAuditInput): boolean {
  const output = formatTaskGraphBoundaryAuditResult({
    status: "passed",
    checks: {
      controlPlaneAuthorityRecorded: true,
      governanceReadmeListsBoundary: true,
      governanceRunnerRegistered: true,
      sourceGraphMarkersPresent: true,
      coverageRecorded: true,
      noRuntimeInvocationSurface: true,
      outputSanitized: true
    },
    summary: {
      taskGraphMode: "structural_task_graph_state_only",
      nodeStatusIsExecutionAuthorization: false,
      graphCompletionIsRuntimeCompletion: false,
      dependencyEdgeIsSchedulerDispatch: false,
      conflictEdgeIsRuntimeBlockExecution: false,
      checkpointNodeIsRollbackExecution: false,
      graphDeltaIsWorkspaceRollbackAuthorization: false,
      rollbackToCheckpointIsHostExecutorAuthorization: false,
      branchMergeIsGitMergeOrWorkspaceWrite: false,
      fileStorePersistenceIsWorkspaceWriteExecution: false,
      taskGraphCallsDuringAudit: 0,
      taskGraphStoreWritesDuringAudit: 0,
      providerExecuteCallsDuringAudit: 0,
      codexCliCallsDuringAudit: 0,
      subAgentRuntimeCallsDuringAudit: 0,
      hostExecutorCallsDuringAudit: 0,
      hostDispatchCallsDuringAudit: 0,
      toolRuntimeCallsDuringAudit: 0,
      shellProcessCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0
    },
    reasons: []
  });
  const aggregateText = [
    input.governanceControlPlaneText,
    input.governanceReadmeText,
    input.governanceRunnerText,
    input.taskGraphSourceText,
    input.taskGraphTestText,
    output
  ].join("\n");

  return FORBIDDEN_OUTPUT_MARKERS.every((marker) => !aggregateText.includes(marker));
}

function collectReasons(
  checks: TaskGraphBoundaryAuditResult["checks"]
): string[] {
  return Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => `task_graph_boundary_${name}`);
}

async function main(): Promise<void> {
  const format = process.argv.includes("--json") ? "json" : "text";
  const input = await collectTaskGraphBoundaryAuditInput();
  const review = reviewTaskGraphBoundaryAudit(input);
  console.log(formatTaskGraphBoundaryAuditResult(review, format));
  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

const isMain = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().catch((error: unknown) => {
    console.error(
      "Task graph boundary audit failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
