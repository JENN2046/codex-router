import type { ToolManifest } from "../src/index.js";
import { validToolExecuteScope } from "./valid-capability-scope.js";

export const validToolManifest = {
  schemaVersion: "tool-manifest.v1",
  toolId: "tool_apply_patch_001",
  name: "Apply Patch",
  version: "1.0.0",
  description: "Stable fixture tool manifest for apply_patch.",
  requiredScopes: [validToolExecuteScope],
  sideEffectLevel: "local",
  inputSchema: {
    type: "object"
  },
  outputSchema: {
    type: "object"
  }
} as const satisfies ToolManifest;
