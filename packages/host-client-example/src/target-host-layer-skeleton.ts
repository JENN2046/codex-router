import type {
  CodexDesktopAutomationUpdateRequest,
  CodexDesktopDirectiveResolvers,
  CodexDesktopShellCommandRequest
} from "../../codex-desktop-bindings/src/index.js";
import {
  createCodexDesktopLiveHostStarter,
  type CodexDesktopLiveHostBundle,
  type CodexDesktopLiveHostStarterOptions
} from "../../codex-desktop-live-host/src/index.js";
import type { DesktopPrimitiveInvocation } from "../../desktop-live-adapter/src/index.js";
import { assertCodexDesktopTargetHostObjectContract } from "./target-host-object-contract.js";

export interface CodexDesktopTargetHostDirectiveBuilders {
  shellCommand?(
    invocation: DesktopPrimitiveInvocation
  ): CodexDesktopShellCommandRequest | undefined;
  applyPatch?(invocation: DesktopPrimitiveInvocation): string | undefined;
  automationUpdate?(
    invocation: DesktopPrimitiveInvocation
  ): CodexDesktopAutomationUpdateRequest | undefined;
}

export interface CodexDesktopTargetHostLayerSkeletonOptions
  extends Omit<CodexDesktopLiveHostStarterOptions, "directives"> {
  directiveBuilders?: CodexDesktopTargetHostDirectiveBuilders;
  directives?: CodexDesktopDirectiveResolvers;
}

export function createCodexDesktopTargetHostDirectives(
  builders: CodexDesktopTargetHostDirectiveBuilders = {}
): CodexDesktopDirectiveResolvers {
  return {
    ...(builders.shellCommand
      ? {
          shellCommand(invocation) {
            return builders.shellCommand?.(invocation);
          }
        }
      : {}),
    ...(builders.applyPatch
      ? {
          applyPatch(invocation) {
            return builders.applyPatch?.(invocation);
          }
        }
      : {}),
    ...(builders.automationUpdate
      ? {
          automationUpdate(invocation) {
            return builders.automationUpdate?.(invocation);
          }
        }
      : {})
  };
}

export function createCodexDesktopTargetHostLayerSkeleton(
  options: CodexDesktopTargetHostLayerSkeletonOptions
): CodexDesktopLiveHostBundle {
  assertCodexDesktopTargetHostObjectContract(options.host);

  const builtDirectives = createCodexDesktopTargetHostDirectives(
    options.directiveBuilders
  );
  const directives = mergeDirectiveResolvers(builtDirectives, options.directives);

  return createCodexDesktopLiveHostStarter({
    ...options,
    ...(directives !== undefined ? { directives } : {})
  });
}

function mergeDirectiveResolvers(
  built: CodexDesktopDirectiveResolvers,
  explicit: CodexDesktopDirectiveResolvers | undefined
): CodexDesktopDirectiveResolvers | undefined {
  const merged = {
    ...built,
    ...(explicit ?? {})
  };

  return hasDirectiveResolvers(merged) ? merged : undefined;
}

function hasDirectiveResolvers(
  directives: CodexDesktopDirectiveResolvers
): boolean {
  return (
    typeof directives.shellCommand === "function"
    || typeof directives.applyPatch === "function"
    || typeof directives.automationUpdate === "function"
    || typeof directives.spawnAgent === "function"
    || typeof directives.sendInput === "function"
    || typeof directives.waitAgent === "function"
    || typeof directives.closeAgent === "function"
  );
}
