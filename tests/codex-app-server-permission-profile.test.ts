import test from "node:test";
import assert from "node:assert/strict";
import {
  CodexAppServerPermissionGrantSchema,
  CodexAppServerPermissionProfileSchema,
  isPermissionGrantSubset
} from "../packages/codex-adapter/src/permission-profile.js";

test("permission grants accept only exact structural subsets", () => {
  const requested = {
    fileSystem: {
      entries: [{
        access: "write" as const,
        path: { path: "/tmp/codex-router/docs", type: "path" as const }
      }],
      globScanMaxDepth: 4,
      read: [
        "/tmp/codex-router/docs",
        "/tmp/codex-router/reference"
      ],
      write: [
        "/tmp/codex-router/docs",
        "/tmp/codex-router/shared"
      ]
    },
    network: { enabled: true }
  };

  assert.equal(isPermissionGrantSubset(requested, {}), true);
  assert.equal(isPermissionGrantSubset(requested, {
    fileSystem: {
      read: ["/tmp/codex-router/docs"],
      write: null,
      globScanMaxDepth: 4
    }
  }), true);
  assert.equal(isPermissionGrantSubset(requested, {
    fileSystem: {
      read: [
        "/tmp/codex-router/docs",
        "/tmp/codex-router/reference"
      ],
      write: ["/tmp/codex-router/docs"],
      globScanMaxDepth: 4
    }
  }), true);
  assert.equal(isPermissionGrantSubset(requested, {
    fileSystem: {
      read: [
        "/tmp/codex-router/docs",
        "/tmp/codex-router/reference"
      ],
      write: null,
      globScanMaxDepth: 4,
      entries: [{
        path: { type: "path", path: "/tmp/codex-router/docs" },
        access: "write"
      }]
    },
    network: { enabled: true }
  }), true);

  assert.equal(isPermissionGrantSubset(requested, {
    fileSystem: {
      read: [
        "/tmp/codex-router/docs",
        "/tmp/codex-router/reference"
      ],
      write: ["/tmp/codex-router/unrequested"],
      globScanMaxDepth: 4
    }
  }), false);
  assert.equal(isPermissionGrantSubset(requested, {
    fileSystem: {
      read: null,
      write: null,
      globScanMaxDepth: 4,
      entries: [{
        access: "read",
        path: { path: "/tmp/codex-router/docs", type: "path" }
      }]
    }
  }), false);
  assert.equal(isPermissionGrantSubset(requested, {
    fileSystem: {
      read: null,
      write: null,
      globScanMaxDepth: 3
    }
  }), false);
  assert.equal(isPermissionGrantSubset(requested, {
    network: { enabled: false }
  }), false);
  assert.equal(isPermissionGrantSubset({
    fileSystem: requested.fileSystem,
    network: null
  }, {
    network: { enabled: true }
  }), false);
});

test("permission grants preserve read carve-outs, denies, and constraints", () => {
  const requested = {
    fileSystem: {
      read: ["/tmp/codex-router/private"],
      write: ["/tmp/codex-router"],
      globScanMaxDepth: 2,
      entries: [
        {
          access: "write" as const,
          path: { path: "/tmp/codex-router", type: "path" as const }
        },
        {
          access: "read" as const,
          path: { path: "/tmp/codex-router/private", type: "path" as const }
        },
        {
          access: "deny" as const,
          path: { path: "/tmp/codex-router/private/secrets", type: "path" as const }
        }
      ]
    },
    network: null
  };

  assert.equal(isPermissionGrantSubset(requested, {
    fileSystem: {
      read: ["/tmp/codex-router/private"],
      write: ["/tmp/codex-router"],
      globScanMaxDepth: 2
    }
  }), false);
  assert.equal(isPermissionGrantSubset(requested, {
    fileSystem: {
      read: ["/tmp/codex-router/private"],
      write: ["/tmp/codex-router"],
      globScanMaxDepth: 2,
      entries: [requested.fileSystem.entries[2]]
    }
  }), false);
  assert.equal(isPermissionGrantSubset(requested, {
    fileSystem: {
      read: ["/tmp/codex-router/private"],
      write: ["/tmp/codex-router"],
      globScanMaxDepth: 2,
      entries: [requested.fileSystem.entries[1]]
    }
  }), false);
  assert.equal(isPermissionGrantSubset(requested, {
    fileSystem: {
      read: null,
      write: ["/tmp/codex-router"],
      globScanMaxDepth: 2,
      entries: [
        requested.fileSystem.entries[1],
        requested.fileSystem.entries[2]
      ]
    }
  }), false);
  assert.equal(isPermissionGrantSubset(requested, {
    fileSystem: {
      read: ["/tmp/codex-router/private"],
      write: ["/tmp/codex-router"],
      entries: [
        requested.fileSystem.entries[1],
        requested.fileSystem.entries[2]
      ]
    }
  }), false);
  assert.equal(isPermissionGrantSubset(requested, {
    fileSystem: {
      read: ["/tmp/codex-router/private"],
      write: ["/tmp/codex-router"],
      globScanMaxDepth: 2,
      entries: [
        requested.fileSystem.entries[1],
        requested.fileSystem.entries[2]
      ]
    }
  }), true);

  const readOnlyRequested = {
    fileSystem: {
      read: ["/tmp/codex-router/docs"],
      write: null,
      entries: [
        {
          access: "read" as const,
          path: { path: "/tmp/codex-router/docs", type: "path" as const }
        },
        {
          access: "deny" as const,
          path: { path: "/tmp/codex-router/docs/secrets", type: "path" as const }
        }
      ]
    },
    network: null
  };
  assert.equal(isPermissionGrantSubset(readOnlyRequested, {
    fileSystem: {
      read: ["/tmp/codex-router/docs"],
      write: null,
      entries: [readOnlyRequested.fileSystem.entries[0]]
    }
  }), false);
  assert.equal(isPermissionGrantSubset(readOnlyRequested, {
    fileSystem: {
      read: ["/tmp/codex-router/docs"],
      write: null,
      entries: readOnlyRequested.fileSystem.entries
    }
  }), true);
});

test("permission grant schema represents denial by omission", () => {
  assert.equal(CodexAppServerPermissionGrantSchema.safeParse({}).success, true);
  assert.equal(CodexAppServerPermissionGrantSchema.safeParse({
    fileSystem: { write: ["/tmp/codex-router/docs"] }
  }).success, true);
  assert.equal(CodexAppServerPermissionGrantSchema.safeParse({
    fileSystem: null
  }).success, false);
  assert.equal(CodexAppServerPermissionGrantSchema.safeParse({
    fileSystem: { read: null, write: null, entries: null }
  }).success, false);
  assert.equal(CodexAppServerPermissionGrantSchema.safeParse({
    fileSystem: { read: null, write: null, globScanMaxDepth: null }
  }).success, false);
  assert.equal(CodexAppServerPermissionGrantSchema.safeParse({
    network: { enabled: true },
    futurePermission: true
  }).success, false);
});

test("permission request schema accepts generated nulls and README omissions", () => {
  assert.equal(CodexAppServerPermissionProfileSchema.safeParse({
    fileSystem: {
      entries: [],
      read: null,
      write: ["/tmp/codex-router/docs"]
    },
    network: null
  }).success, true);
  assert.equal(CodexAppServerPermissionProfileSchema.safeParse({
    fileSystem: { read: null, write: null },
    network: { enabled: null }
  }).success, true);
  assert.equal(CodexAppServerPermissionProfileSchema.safeParse({
    fileSystem: { read: null, write: null }
  }).success, true);
  assert.equal(CodexAppServerPermissionProfileSchema.safeParse({
    fileSystem: { write: ["/tmp/codex-router/docs"] }
  }).success, true);
  assert.equal(CodexAppServerPermissionProfileSchema.safeParse({
    fileSystem: { entries: null }
  }).success, false);
  assert.equal(CodexAppServerPermissionProfileSchema.safeParse({
    fileSystem: { globScanMaxDepth: null }
  }).success, false);
});
