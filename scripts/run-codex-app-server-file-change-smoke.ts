#!/usr/bin/env node

import {
  APP_SERVER_FILE_CHANGE_INTERCEPTION_PROVEN
} from "./lib/codex-app-server-live-smoke-safety.js";

console.error(JSON.stringify({
  schemaVersion: "codex-app-server-file-change-smoke-preflight.v1",
  status: "blocked",
  interceptionProven: APP_SERVER_FILE_CHANGE_INTERCEPTION_PROVEN,
  reason: "app_server_file_change_interception_unproven",
  realAppServerStarted: false,
  clientConnected: false,
  workspaceWriteAttempted: false
}, null, 2));
process.exitCode = 1;
