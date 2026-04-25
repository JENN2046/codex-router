import { constants } from "node:fs";
import { access, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

export type FinalHostCandidateRole =
  | "final_host_candidate"
  | "reference_host"
  | "packaged_runtime";

export type FinalHostCandidateKind =
  | "editable_source"
  | "reference_host"
  | "packaged_runtime"
  | "unknown";

export type FinalHostCandidateStatus =
  | "ready_for_mapping"
  | "reference_only"
  | "blocked";

export type FinalHostSourceGateStatus =
  | "ready_for_mapping"
  | "blocked_missing_editable_source";

export interface FinalHostCandidateSignals {
  editableSource?: boolean;
  installedPackage?: boolean;
  gitRepository?: boolean;
  writableWorkspace?: boolean;
  startupSeam?: boolean;
  hostRuntimeSurface?: boolean;
  validationSurface?: boolean;
  existingCodexRouterBridge?: boolean;
}

export interface FinalHostCandidateInput {
  path: string;
  label?: string;
  role?: FinalHostCandidateRole;
  signals?: FinalHostCandidateSignals;
  notes?: string[];
}

export interface FinalHostCandidateInspection {
  path: string;
  label: string;
  kind: FinalHostCandidateKind;
  status: FinalHostCandidateStatus;
  canUseAsFinalHostSource: boolean;
  signals: Required<FinalHostCandidateSignals>;
  blockingReasons: string[];
  notes: string[];
}

export interface FinalHostSourceGateOptions {
  candidates: FinalHostCandidateInput[];
  generatedAt?: string;
  requiredInputs?: string[];
}

export interface FinalHostSourceGate {
  schemaVersion: 1;
  generatedAt: string;
  status: FinalHostSourceGateStatus;
  selectedSource?: FinalHostCandidateInspection;
  candidates: FinalHostCandidateInspection[];
  packagedRuntimes: FinalHostCandidateInspection[];
  referenceHosts: FinalHostCandidateInspection[];
  blockingReasons: string[];
  requiredInputs: string[];
}

export interface FinalHostPathProbeOptions extends FinalHostCandidateInput {
  startupSeamMarkers?: string[];
  hostRuntimeSurfaceMarkers?: string[];
  validationSurfaceMarkers?: string[];
  existingCodexRouterBridgeMarkers?: string[];
}

export interface FinalHostPathProbe {
  path: string;
  label: string;
  exists: boolean;
  isDirectory: boolean;
  readable: boolean;
  writable: boolean;
  directEntries: string[];
  candidate: FinalHostCandidateInput;
  notes: string[];
}

export interface FinalHostSourceGateFromPathProbesOptions {
  candidates: FinalHostPathProbeOptions[];
  generatedAt?: string;
  requiredInputs?: string[];
}

export interface FinalHostSourceGateEvidenceOptions {
  generatedAt?: string;
  hostLabel?: string;
  notes?: string[];
  includeCandidateSignals?: boolean;
}

export interface FinalHostSourceGateEvidenceCandidate {
  path: string;
  label: string;
  kind: FinalHostCandidateKind;
  status: FinalHostCandidateStatus;
  canUseAsFinalHostSource: boolean;
  blockingReasons: string[];
  notes: string[];
  signals?: Required<FinalHostCandidateSignals>;
}

export interface FinalHostSourceGateEvidence {
  schemaVersion: 1;
  generatedAt: string;
  hostLabel?: string;
  status: FinalHostSourceGateStatus;
  ready: boolean;
  selectedSource?: {
    path: string;
    label: string;
  };
  summary: {
    totalCandidates: number;
    editableSourceCandidates: number;
    packagedRuntimeCandidates: number;
    referenceHostCandidates: number;
    blockedCandidates: number;
  };
  blockingReasons: string[];
  requiredInputs: string[];
  candidates: FinalHostSourceGateEvidenceCandidate[];
  notes: string[];
}

const DEFAULT_REQUIRED_INPUTS = [
  "editable_final_host_source",
  "startup_or_extension_seam",
  "host_runtime_surface",
  "validation_surface"
];

export function inspectFinalHostCandidate(
  input: FinalHostCandidateInput
): FinalHostCandidateInspection {
  const signals = normalizeSignals(input.signals);
  const kind = classifyFinalHostCandidateKind(input, signals);
  const blockingReasons = getFinalHostCandidateBlockingReasons(kind, signals);
  const canUseAsFinalHostSource = (
    kind === "editable_source" && blockingReasons.length === 0
  );

  return {
    path: input.path,
    label: input.label ?? input.path,
    kind,
    status: resolveCandidateStatus(kind, canUseAsFinalHostSource),
    canUseAsFinalHostSource,
    signals,
    blockingReasons,
    notes: input.notes ?? []
  };
}

export function createFinalHostSourceGate(
  options: FinalHostSourceGateOptions
): FinalHostSourceGate {
  const candidates = options.candidates.map(inspectFinalHostCandidate);
  const selectedSource = candidates.find((candidate) => (
    candidate.canUseAsFinalHostSource
  ));
  const packagedRuntimes = candidates.filter((candidate) => (
    candidate.kind === "packaged_runtime"
  ));
  const referenceHosts = candidates.filter((candidate) => (
    candidate.kind === "reference_host"
  ));
  const blockingReasons = selectedSource ? [] : createSourceGateBlockers(candidates);

  return {
    schemaVersion: 1,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    status: selectedSource
      ? "ready_for_mapping"
      : "blocked_missing_editable_source",
    ...(selectedSource ? { selectedSource } : {}),
    candidates,
    packagedRuntimes,
    referenceHosts,
    blockingReasons,
    requiredInputs: options.requiredInputs ?? DEFAULT_REQUIRED_INPUTS
  };
}

export async function probeFinalHostCandidatePath(
  options: FinalHostPathProbeOptions
): Promise<FinalHostPathProbe> {
  const pathExists = await exists(options.path);
  const isDirectory = pathExists ? await isDirectoryPath(options.path) : false;
  const readable = pathExists ? await canAccess(options.path, constants.R_OK) : false;
  const writable = pathExists ? await canAccess(options.path, constants.W_OK) : false;
  const directEntries = isDirectory && readable
    ? await readDirectEntries(options.path)
    : [];
  const notes = [
    ...(options.notes ?? []),
    ...(pathExists ? [] : ["path_not_found"]),
    ...(pathExists && !isDirectory ? ["path_is_not_directory"] : []),
    ...(pathExists && !readable ? ["path_not_readable"] : [])
  ];
  const markerSignals = await probeMarkerSignals(options, pathExists && isDirectory);
  const signals: FinalHostCandidateSignals = {
    ...options.signals,
    editableSource: options.signals?.editableSource ?? (
      options.role === "final_host_candidate" && isDirectory && readable
    ),
    installedPackage: options.signals?.installedPackage ?? (
      options.role === "packaged_runtime"
    ),
    gitRepository: options.signals?.gitRepository ?? (
      isDirectory && directEntries.includes(".git")
    ),
    writableWorkspace: options.signals?.writableWorkspace ?? writable,
    ...markerSignals
  };

  return {
    path: options.path,
    label: options.label ?? options.path,
    exists: pathExists,
    isDirectory,
    readable,
    writable,
    directEntries,
    candidate: {
      path: options.path,
      ...(options.label ? { label: options.label } : {}),
      ...(options.role ? { role: options.role } : {}),
      signals,
      notes
    },
    notes
  };
}

export async function createFinalHostSourceGateFromPathProbes(
  options: FinalHostSourceGateFromPathProbesOptions
): Promise<FinalHostSourceGate> {
  const probes = await Promise.all(
    options.candidates.map((candidate) => probeFinalHostCandidatePath(candidate))
  );

  return createFinalHostSourceGate({
    candidates: probes.map((probe) => probe.candidate),
    ...(options.generatedAt ? { generatedAt: options.generatedAt } : {}),
    ...(options.requiredInputs ? { requiredInputs: options.requiredInputs } : {})
  });
}

export function createFinalHostSourceGateEvidence(
  gate: FinalHostSourceGate,
  options: FinalHostSourceGateEvidenceOptions = {}
): FinalHostSourceGateEvidence {
  const includeCandidateSignals = options.includeCandidateSignals ?? true;
  const candidates = gate.candidates.map((candidate) => ({
    path: candidate.path,
    label: candidate.label,
    kind: candidate.kind,
    status: candidate.status,
    canUseAsFinalHostSource: candidate.canUseAsFinalHostSource,
    blockingReasons: candidate.blockingReasons,
    notes: candidate.notes,
    ...(includeCandidateSignals ? { signals: candidate.signals } : {})
  }));

  return {
    schemaVersion: 1,
    generatedAt: options.generatedAt ?? gate.generatedAt,
    ...(options.hostLabel ? { hostLabel: options.hostLabel } : {}),
    status: gate.status,
    ready: gate.status === "ready_for_mapping",
    ...(gate.selectedSource ? {
      selectedSource: {
        path: gate.selectedSource.path,
        label: gate.selectedSource.label
      }
    } : {}),
    summary: {
      totalCandidates: gate.candidates.length,
      editableSourceCandidates: gate.candidates.filter((candidate) => (
        candidate.kind === "editable_source"
      )).length,
      packagedRuntimeCandidates: gate.packagedRuntimes.length,
      referenceHostCandidates: gate.referenceHosts.length,
      blockedCandidates: gate.candidates.filter((candidate) => (
        candidate.status === "blocked"
      )).length
    },
    blockingReasons: gate.blockingReasons,
    requiredInputs: gate.requiredInputs,
    candidates,
    notes: options.notes ?? []
  };
}

function classifyFinalHostCandidateKind(
  input: FinalHostCandidateInput,
  signals: Required<FinalHostCandidateSignals>
): FinalHostCandidateKind {
  if (input.role === "packaged_runtime" || signals.installedPackage) {
    return "packaged_runtime";
  }

  if (input.role === "reference_host") {
    return "reference_host";
  }

  if (
    input.role === "final_host_candidate" ||
    signals.editableSource ||
    signals.startupSeam ||
    signals.hostRuntimeSurface
  ) {
    return "editable_source";
  }

  return "unknown";
}

function getFinalHostCandidateBlockingReasons(
  kind: FinalHostCandidateKind,
  signals: Required<FinalHostCandidateSignals>
): string[] {
  if (kind === "packaged_runtime") {
    return ["final_host_source_is_packaged_runtime"];
  }

  if (kind === "reference_host") {
    return ["final_host_source_is_reference_host_only"];
  }

  if (kind === "unknown") {
    return ["final_host_source_kind_unknown"];
  }

  return [
    ...(signals.editableSource ? [] : ["missing_editable_source_signal"]),
    ...(signals.startupSeam ? [] : ["missing_startup_or_extension_seam"]),
    ...(signals.hostRuntimeSurface ? [] : ["missing_host_runtime_surface"]),
    ...(signals.validationSurface ? [] : ["missing_validation_surface"])
  ];
}

function resolveCandidateStatus(
  kind: FinalHostCandidateKind,
  canUseAsFinalHostSource: boolean
): FinalHostCandidateStatus {
  if (canUseAsFinalHostSource) {
    return "ready_for_mapping";
  }

  if (kind === "reference_host") {
    return "reference_only";
  }

  return "blocked";
}

function createSourceGateBlockers(
  candidates: FinalHostCandidateInspection[]
): string[] {
  if (candidates.length === 0) {
    return ["final_host_source_candidate_missing"];
  }

  const uniqueReasons = new Set<string>(["editable_final_host_source_not_found"]);

  for (const candidate of candidates) {
    for (const reason of candidate.blockingReasons) {
      uniqueReasons.add(reason);
    }
  }

  return [...uniqueReasons];
}

function normalizeSignals(
  signals: FinalHostCandidateSignals = {}
): Required<FinalHostCandidateSignals> {
  return {
    editableSource: signals.editableSource ?? false,
    installedPackage: signals.installedPackage ?? false,
    gitRepository: signals.gitRepository ?? false,
    writableWorkspace: signals.writableWorkspace ?? false,
    startupSeam: signals.startupSeam ?? false,
    hostRuntimeSurface: signals.hostRuntimeSurface ?? false,
    validationSurface: signals.validationSurface ?? false,
    existingCodexRouterBridge: signals.existingCodexRouterBridge ?? false
  };
}

async function probeMarkerSignals(
  options: FinalHostPathProbeOptions,
  canProbeMarkers: boolean
): Promise<FinalHostCandidateSignals> {
  if (!canProbeMarkers) {
    return {};
  }

  const [
    startupSeam,
    hostRuntimeSurface,
    validationSurface,
    existingCodexRouterBridge
  ] = await Promise.all([
    hasAnyMarker(options.path, options.startupSeamMarkers ?? []),
    hasAnyMarker(options.path, options.hostRuntimeSurfaceMarkers ?? []),
    hasAnyMarker(options.path, options.validationSurfaceMarkers ?? []),
    hasAnyMarker(options.path, options.existingCodexRouterBridgeMarkers ?? [])
  ]);

  return {
    ...(options.signals?.startupSeam === undefined ? { startupSeam } : {}),
    ...(options.signals?.hostRuntimeSurface === undefined ? { hostRuntimeSurface } : {}),
    ...(options.signals?.validationSurface === undefined ? { validationSurface } : {}),
    ...(options.signals?.existingCodexRouterBridge === undefined
      ? { existingCodexRouterBridge }
      : {})
  };
}

async function hasAnyMarker(root: string, markers: string[]): Promise<boolean> {
  if (markers.length === 0) {
    return false;
  }

  const results = await Promise.all(
    markers.map((marker) => exists(join(root, marker)))
  );

  return results.some(Boolean);
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function isDirectoryPath(path: string): Promise<boolean> {
  try {
    const result = await stat(path);
    return result.isDirectory();
  } catch {
    return false;
  }
}

async function canAccess(path: string, mode: number): Promise<boolean> {
  try {
    await access(path, mode);
    return true;
  } catch {
    return false;
  }
}

async function readDirectEntries(path: string): Promise<string[]> {
  try {
    return await readdir(path);
  } catch {
    return [];
  }
}
