import type { SandboxProfile } from "../src/index.js";

export const validSandboxProfile = {
  schemaVersion: "sandbox-profile.v1",
  sandboxId: "sandbox_readonly_001",
  mode: "read-only",
  networkAccess: "none",
  writableRoots: [],
  envPolicy: {
    inheritProcessEnv: false,
    allowlist: []
  }
} as const satisfies SandboxProfile;
