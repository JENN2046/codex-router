import type {
  CodexDesktopLiveHostBundle
} from "../../codex-desktop-live-host/src/index.js";
import {
  assertCodexDesktopTargetHostObjectContract,
  CODEX_DESKTOP_TARGET_HOST_OPTIONAL_MEMORY_METHODS,
  CODEX_DESKTOP_TARGET_HOST_REQUIRED_MEMORY_METHODS,
  CODEX_DESKTOP_TARGET_HOST_REQUIRED_RUNTIME_METHODS,
  createCodexDesktopTargetHostObjectContract,
  inspectCodexDesktopTargetHostObjectContract,
  type CodexDesktopTargetHostContractInspection,
  type CodexDesktopTargetHostOverrides
} from "./target-host-object-contract.js";
import {
  createCodexDesktopTargetHostLayerSkeleton,
  type CodexDesktopTargetHostLayerSkeletonOptions
} from "./target-host-layer-skeleton.js";

export interface CodexDesktopTargetHostEmbeddingStarterOptions
  extends Omit<CodexDesktopTargetHostLayerSkeletonOptions, "host"> {
  host?: CodexDesktopTargetHostOverrides;
}

export interface CodexDesktopTargetHostEmbeddingStarter {
  host: ReturnType<typeof createCodexDesktopTargetHostObjectContract>;
  inspect(): CodexDesktopTargetHostContractInspection;
  getStatus(): CodexDesktopTargetHostEmbeddingStatus;
  assertReady(): void;
  createBundle(): CodexDesktopLiveHostBundle;
}

export interface CodexDesktopTargetHostEmbeddingStatus {
  ready: boolean;
  wiredRuntimeMethods: string[];
  wiredMemoryMethods: string[];
  pendingRequiredMethods: string[];
  pendingOptionalMethods: string[];
  placeholderMethods: string[];
  nextAction: "wire_required_methods" | "create_bundle";
}

export function createCodexDesktopTargetHostEmbeddingStarter(
  options: CodexDesktopTargetHostEmbeddingStarterOptions
): CodexDesktopTargetHostEmbeddingStarter {
  const host = createCodexDesktopTargetHostObjectContract(options.host);

  return {
    host,
    inspect() {
      return inspectCodexDesktopTargetHostObjectContract(host);
    },
    getStatus() {
      return getCodexDesktopTargetHostEmbeddingStatus(host);
    },
    assertReady() {
      assertCodexDesktopTargetHostObjectContract(host);
    },
    createBundle() {
      return createCodexDesktopTargetHostLayerSkeleton({
        ...options,
        host
      });
    }
  };
}

export function getCodexDesktopTargetHostEmbeddingStatus(
  host: ReturnType<typeof createCodexDesktopTargetHostObjectContract>
): CodexDesktopTargetHostEmbeddingStatus {
  const inspection = inspectCodexDesktopTargetHostObjectContract(host);
  const placeholderSet = new Set(inspection.placeholderMethods);
  const missingSet = new Set(inspection.missingMethods);

  const wiredRuntimeMethods = CODEX_DESKTOP_TARGET_HOST_REQUIRED_RUNTIME_METHODS
    .filter((method) => !placeholderSet.has(method) && !missingSet.has(method));
  const wiredMemoryMethods = [
    ...CODEX_DESKTOP_TARGET_HOST_REQUIRED_MEMORY_METHODS
  ].filter((method) => !placeholderSet.has(method) && !missingSet.has(method));
  const wiredOptionalMemoryMethods = CODEX_DESKTOP_TARGET_HOST_OPTIONAL_MEMORY_METHODS
    .filter((method) => typeof host[method] === "function" && !placeholderSet.has(method));
  const pendingRequiredMethods = [
    ...CODEX_DESKTOP_TARGET_HOST_REQUIRED_RUNTIME_METHODS,
    ...CODEX_DESKTOP_TARGET_HOST_REQUIRED_MEMORY_METHODS
  ].filter((method) => placeholderSet.has(method) || missingSet.has(method));
  const pendingOptionalMethods = CODEX_DESKTOP_TARGET_HOST_OPTIONAL_MEMORY_METHODS
    .filter((method) => typeof host[method] !== "function" || placeholderSet.has(method));

  return {
    ready: inspection.ready,
    wiredRuntimeMethods,
    wiredMemoryMethods: [...wiredMemoryMethods, ...wiredOptionalMemoryMethods],
    pendingRequiredMethods,
    pendingOptionalMethods,
    placeholderMethods: [...inspection.placeholderMethods],
    nextAction: inspection.ready ? "create_bundle" : "wire_required_methods"
  };
}
