import type { Principal } from "../src/index.js";

export const validPrincipal = {
  schemaVersion: "principal.v1",
  principalId: "principal_user_001",
  kind: "user",
  displayName: "Phase 1 Operator",
  tenantId: "tenant_local_001",
  workspaceId: "workspace_codex_router_001",
  createdAt: "2026-06-04T00:00:00.000Z"
} as const satisfies Principal;
