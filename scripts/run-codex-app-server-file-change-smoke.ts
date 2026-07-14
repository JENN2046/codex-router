#!/usr/bin/env node

import {
  evaluateAppServerFileChangeInterceptionPreflight
} from "./lib/codex-app-server-live-smoke-safety.js";

const preflight = evaluateAppServerFileChangeInterceptionPreflight({
  sandboxPolicy: "workspace-write",
  approvalPolicy: "on-request",
  proposalMode: "approval-request"
});

console.error(JSON.stringify({
  schemaVersion: "codex-app-server-file-change-smoke-preflight.v1",
  status: preflight.status,
  interceptionProven: preflight.interceptionProven,
  connectionAllowed: preflight.connectionAllowed,
  reason: preflight.reason,
  plan: preflight.plan,
  realAppServerStarted: false,
  clientConnected: false,
  workspaceWriteAttempted: false
}, null, 2));
process.exitCode = 1;
