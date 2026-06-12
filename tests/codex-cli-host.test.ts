import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import codexCliHostPublicExportLockFixture from "../tests/fixtures/codex-cli-host-public-export-lock.fixture.json" with { type: "json" };
import codexCliHostGovernanceV2PublicExportLockFixture from "../tests/fixtures/codex-cli-host-governance-v2-public-export-lock.fixture.json" with { type: "json" };
import { createRecordingTelemetrySink } from "../packages/observability/src/index.js";
import {
  CODEX_CLI_READONLY_SMOKE_OK,
  CODEX_CLI_WORKSPACE_WRITE_SMOKE_CONFIRMATION,
  checkCodexCliExecPlanModelAvailability,
  checkCodexCliModelAvailability,
  checkCodexCliModelCatalogAtStartup,
  clearCodexCliModelProbeCache,
  createCodexCliGovernanceBundle,
  createCodexCliModelCliProbeEvidence,
  createCodexCliModelCheckEvidence,
  createCodexCliOperatorAcceptanceEvidence,
  createCodexCliReadOnlySmokeEvidence,
  createCodexCliReadOnlySmokeTask,
  createCodexCliExecPlan,
  createCodexCliExecPlanFromRoutingDecision,
  createCodexCliWorkspaceWriteSmokeApprovalPacket,
  createCodexCliWorkspaceWriteSmokeEvidence,
  createCodexCliWorkspaceWriteSmokePreflight,
  createCodexCliWorkspaceWriteSmokePreflightEvidence,
  createCodexCliWorkspaceWriteSmokeTask,
  inspectCodexCliCommandOutput,
  parseCodexCliJsonl,
  runAndWriteCodexCliReadOnlySmokeEvidence,
  runAndWriteCodexCliModelCliProbeEvidence,
  runAndWriteCodexCliModelCheckEvidence,
  runAndWriteCodexCliOperatorAcceptanceEvidence,
  runCodexCliReadOnlySmoke,
  runCodexCliOperatorAcceptance,
  runCodexCliExecPlan,
  runAndWriteCodexCliWorkspaceWriteSmokeEvidence,
  runCodexCliWorkspaceWriteSmoke,
  type CodexCliProcessSpawner,
  compareCodexCliModelStrength,
  detectCodexCliModelCatalogDrift,
  fetchOpenAiModelCatalog,
  getCodexCliModelStrengthProfile,
  getKnownCodexCliModelIds,
  parseOpenAiModelCatalogResponse,
  validateCodexCliExecPlanForRun,
  writeCodexCliWorkspaceWriteSmokeEvidenceFile,
  writeCodexCliWorkspaceWriteSmokeApprovalPacketFile,
  writeCodexCliWorkspaceWriteSmokePreflightEvidenceFile,
  writeCodexCliReadOnlySmokeEvidenceFile,
  writeCodexCliOperatorAcceptanceEvidenceFile,
  resolveCodexCliModelForRoutingDecision,
  resolveCodexCliSandboxForRoutingDecision,
  resolveCodexCliSandbox
} from "../packages/codex-cli-host/src/index.js";
import { parseTaskEnvelope } from "../packages/contracts/src/index.js";
import { classifyIntent } from "../packages/intent-gate/src/index.js";
import { loadPolicyFromFile } from "../packages/policy-config/src/index.js";
import { routeTask } from "../packages/routing-engine/src/index.js";

const policyPath = fileURLToPath(new URL("../routing-policy.yaml", import.meta.url));

test("codex cli host public export surface is lock-stable", async () => {
  const moduleExports = await import("../packages/codex-cli-host/src/index.js");
  const actualExports = Object.keys(moduleExports)
    .filter((name) => !name.startsWith("__") && name !== "default")
    .sort();

  assert.deepEqual(actualExports, codexCliHostPublicExportLockFixture);
});

test("codex cli host governance-v2 public export surface is lock-stable", async () => {
  const moduleExports = await import("../packages/codex-cli-host/src/governance-v2.js");
  const actualExports = Object.keys(moduleExports)
    .filter((name) => !name.startsWith("__") && name !== "default")
    .sort();

  assert.deepEqual(
    actualExports,
    codexCliHostGovernanceV2PublicExportLockFixture
  );
});

test.beforeEach(() => {
  clearCodexCliModelProbeCache();
});

test("codex cli host builds a read-only exec json plan without running the CLI", () => {
  const plan = createCodexCliExecPlan({
    taskId: "cli-readonly",
    source: "cli",
    intent: {
      summary: "inspect repo",
      requestedAction: "inspect current repo state",
      successCriteria: [],
      outOfScope: ["file edits"]
    },
    repoContext: {
      repoRoot: "A:/codex-router"
    },
    target: {
      branches: [],
      files: ["README.md"],
      modules: ["codex-cli-host"]
    },
    constraints: {},
    hints: {
      taskClassHint: "read_only",
      riskHints: [],
      tags: ["codex-cli-host-smoke"]
    }
  }, {
    skipGitRepoCheck: true,
    ephemeral: true
  });

  assert.equal(plan.command, "codex");
  assert.equal(plan.sandbox, "read-only");
  assert.equal(plan.approvalPolicy, "on-request");
  assert.equal(plan.workdir, "A:/codex-router");
  assert.deepEqual(plan.args.slice(0, 7), [
    "-a",
    "on-request",
    "exec",
    "--json",
    "--sandbox",
    "read-only",
    "--cd"
  ]);
  assert.ok(plan.args.includes("--skip-git-repo-check"));
  assert.ok(plan.args.includes("--ephemeral"));
  assert.equal(plan.args.at(-1), plan.prompt);
  assert.match(plan.prompt, /"source": "cli"/);
});

test("codex cli host derives CLI model and sandbox from routing decisions", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const readOnlyTask = parseTaskEnvelope({
    taskId: "cli-decision-readonly",
    source: "cli",
    intent: {
      summary: "inspect repo",
      requestedAction: "inspect and summarize the current config without edits",
      successCriteria: [],
      outOfScope: ["file edits"]
    },
    repoContext: {
      repoRoot: "A:/codex-router"
    },
    target: {
      branches: [],
      files: ["routing-policy.yaml"],
      modules: ["codex-cli-host"]
    },
    constraints: {},
    hints: {
      riskHints: [],
      tags: []
    }
  });
  const smallEditTask = parseTaskEnvelope({
    taskId: "cli-decision-small-edit",
    source: "cli",
    intent: {
      summary: "small fix",
      requestedAction: "single file typo fix in README.md",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: {
      repoRoot: "A:/codex-router"
    },
    target: {
      branches: [],
      files: ["README.md"],
      modules: ["codex-cli-host"]
    },
    constraints: {},
    hints: {
      riskHints: [],
      tags: []
    }
  });

  const readOnlyDecision = routeTask(readOnlyTask, classifyIntent(readOnlyTask), policy);
  const smallEditDecision = routeTask(smallEditTask, classifyIntent(smallEditTask), policy);
  const readOnlyPlan = createCodexCliExecPlanFromRoutingDecision(
    readOnlyTask,
    readOnlyDecision,
    {
      skipGitRepoCheck: true,
      ephemeral: true
    }
  );
  const smallEditPlan = createCodexCliExecPlanFromRoutingDecision(
    smallEditTask,
    smallEditDecision,
    {
      skipGitRepoCheck: true,
      ephemeral: true
    }
  );

  assert.equal(readOnlyDecision.execution.selectedModel, "gpt-5.4-mini");
  assert.equal(readOnlyPlan.sandbox, "read-only");
  assert.equal(readOnlyPlan.model, "gpt-5.4-mini");
  assert.equal(readOnlyPlan.modelResolution?.mode, "auto");
  assert.equal(readOnlyPlan.modelResolution?.source, "router");
  assert.equal(resolveCodexCliSandboxForRoutingDecision(readOnlyDecision), "read-only");
  assert.equal(getArgValue(readOnlyPlan.args, "--model"), readOnlyDecision.execution.selectedModel);
  assert.equal(getArgValue(readOnlyPlan.args, "--sandbox"), "read-only");

  assert.equal(smallEditDecision.execution.selectedModel, "gpt-5.3-codex-spark");
  assert.equal(smallEditPlan.sandbox, "workspace-write");
  assert.equal(smallEditPlan.model, "gpt-5.3-codex-spark");
  assert.equal(smallEditPlan.modelResolution?.mode, "auto");
  assert.equal(smallEditPlan.modelResolution?.source, "router");
  assert.equal(resolveCodexCliSandboxForRoutingDecision(smallEditDecision), "workspace-write");
  assert.equal(getArgValue(smallEditPlan.args, "--model"), smallEditDecision.execution.selectedModel);
  assert.equal(getArgValue(smallEditPlan.args, "--sandbox"), "workspace-write");
});

test("codex cli model strength ranks gpt-5.4-mini above codex spark on capability", () => {
  const sparkProfile = getCodexCliModelStrengthProfile("gpt-5.3-codex-spark");
  const miniProfile = getCodexCliModelStrengthProfile("gpt-5.4-mini");

  assert.equal(sparkProfile.specialization, "codex_realtime");
  assert.equal(miniProfile.specialization, "general_small");
  assert.ok(miniProfile.capabilityRank > sparkProfile.capabilityRank);
  assert.ok(sparkProfile.latencyRank > miniProfile.latencyRank);
  assert.ok(compareCodexCliModelStrength("gpt-5.4-mini", "gpt-5.3-codex-spark") > 0);
  assert.ok(compareCodexCliModelStrength("gpt-5.3-codex-spark", "gpt-5.4-mini") < 0);
});

test("codex cli model selection switch accepts stronger user preferences", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const task = parseTaskEnvelope({
    taskId: "cli-model-switch-stronger",
    source: "cli",
    intent: {
      summary: "inspect repo",
      requestedAction: "inspect current config without edits",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: {
      repoRoot: "A:/codex-router"
    },
    target: {
      branches: [],
      files: ["routing-policy.yaml"],
      modules: ["codex-cli-host"]
    },
    constraints: {},
    hints: {
      riskHints: [],
      tags: []
    }
  });
  const decision = routeTask(task, classifyIntent(task), policy);
  const plan = createCodexCliExecPlanFromRoutingDecision(task, decision, {
    modelSelection: {
      mode: "user_preference",
      requestedModel: "gpt-5.3-codex"
    }
  });
  const resolution = resolveCodexCliModelForRoutingDecision(decision, {
    mode: "user_preference",
    requestedModel: "gpt-5.3-codex"
  });

  assert.equal(decision.execution.selectedModel, "gpt-5.4-mini");
  assert.equal(resolution.accepted, true);
  assert.equal(resolution.source, "user");
  assert.equal(resolution.selectedModel, "gpt-5.3-codex");
  assert.equal(plan.modelResolution?.accepted, true);
  assert.equal(plan.modelResolution?.source, "user");
  assert.equal(plan.model, "gpt-5.3-codex");
  assert.equal(getArgValue(plan.args, "--model"), "gpt-5.3-codex");
});

test("codex cli model selection switch accepts gpt-5.4-mini over codex spark", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const task = parseTaskEnvelope({
    taskId: "cli-model-switch-mini-over-spark",
    source: "cli",
    intent: {
      summary: "small fix",
      requestedAction: "single file typo fix in README.md",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: {
      repoRoot: "A:/codex-router"
    },
    target: {
      branches: [],
      files: ["README.md"],
      modules: ["codex-cli-host"]
    },
    constraints: {},
    hints: {
      riskHints: [],
      tags: []
    }
  });
  const decision = routeTask(task, classifyIntent(task), policy);
  const plan = createCodexCliExecPlanFromRoutingDecision(task, decision, {
    modelSelection: {
      mode: "user_preference",
      requestedModel: "gpt-5.4-mini"
    }
  });

  assert.equal(decision.execution.selectedModel, "gpt-5.3-codex-spark");
  assert.equal(plan.modelResolution?.accepted, true);
  assert.equal(plan.modelResolution?.requestedModel, "gpt-5.4-mini");
  assert.equal(plan.modelResolution?.selectedModel, "gpt-5.4-mini");
  assert.equal(plan.modelResolution?.source, "user");
  assert.equal(plan.model, "gpt-5.4-mini");
  assert.equal(getArgValue(plan.args, "--model"), "gpt-5.4-mini");
  assert.equal(plan.warnings.includes(
    "codex_cli_model_selection:requested_model_rejected_weaker_than_router_model"
  ), false);
});

test("codex cli model selection switch still rejects genuinely unsafe downgrades", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const task = parseTaskEnvelope({
    taskId: "cli-model-switch-unsafe-downgrade",
    source: "cli",
    intent: {
      summary: "implement new package",
      requestedAction: "add multi-file TypeScript modules and tests",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: {
      repoRoot: "A:/codex-router"
    },
    target: {
      branches: [],
      files: ["packages/contracts/src/index.ts", "packages/routing-engine/src/index.ts"],
      modules: ["codex-cli-host"]
    },
    constraints: {},
    hints: {
      riskHints: [],
      tags: []
    }
  });
  const decision = routeTask(task, classifyIntent(task), policy);
  const plan = createCodexCliExecPlanFromRoutingDecision(task, decision, {
    modelSelection: {
      mode: "user_preference",
      requestedModel: "gpt-5.4-mini"
    }
  });

  assert.equal(decision.execution.selectedModel, "gpt-5.3-codex");
  assert.equal(plan.modelResolution?.accepted, false);
  assert.equal(plan.modelResolution?.requestedModel, "gpt-5.4-mini");
  assert.equal(plan.modelResolution?.selectedModel, "gpt-5.3-codex");
  assert.equal(plan.modelResolution?.source, "router");
  assert.equal(plan.model, "gpt-5.3-codex");
  assert.equal(getArgValue(plan.args, "--model"), "gpt-5.3-codex");
  assert.ok(plan.warnings.includes(
    "codex_cli_model_selection:requested_model_rejected_weaker_than_router_model"
  ));
});

test("codex cli model catalog detection reports current official coverage", () => {
  const knownModels = getKnownCodexCliModelIds();
  const detection = detectCodexCliModelCatalogDrift({
    officialModels: [
      ...knownModels,
      "text-embedding-3-large"
    ]
  });

  assert.equal(detection.status, "current");
  assert.deepEqual(detection.missingKnownModels, []);
  assert.deepEqual(detection.untrackedOfficialModels, []);
  assert.equal(detection.ignoredOfficialModelCount, 1);
  assert.equal(detection.availableKnownModels.length, knownModels.length);
});

test("codex cli model catalog detection catches additions and removals", () => {
  const detection = detectCodexCliModelCatalogDrift({
    officialModels: [
      "gpt-5.3-codex-spark",
      "gpt-5.4-mini",
      "gpt-5.3-codex",
      "gpt-5.4",
      "gpt-5.4-nano",
      "gpt-5.5-codex"
    ]
  });

  assert.equal(detection.status, "drift_detected");
  assert.deepEqual(detection.missingKnownModels, ["gpt-5.1-codex-max"]);
  assert.deepEqual(detection.untrackedOfficialModels, [
    "gpt-5.4-nano",
    "gpt-5.5-codex"
  ]);
  assert.ok(detection.warnings.includes("known_models_missing_from_official_catalog"));
  assert.ok(detection.warnings.includes("official_models_untracked_by_local_policy"));
});

test("codex cli model catalog parser and fetch wrapper handle official list shape", async () => {
  const parsed = parseOpenAiModelCatalogResponse({
    object: "list",
    data: [
      {
        id: "gpt-5.4-mini",
        object: "model",
        created: 1770000000,
        owned_by: "openai"
      }
    ]
  });
  let authorizationHeader = "";

  assert.equal(parsed.object, "list");
  assert.equal(parsed.data[0]?.id, "gpt-5.4-mini");
  assert.equal(parsed.data[0]?.owned_by, "openai");

  const fetched = await fetchOpenAiModelCatalog({
    apiKey: "test-key",
    baseUrl: "https://api.openai.example/v1/",
    fetch: async (url, init) => {
      assert.equal(url, "https://api.openai.example/v1/models");
      authorizationHeader = init.headers.Authorization ?? "";
      return {
        ok: true,
        status: 200,
        async text() {
          return JSON.stringify({
            object: "list",
            data: [
              {
                id: "gpt-5.4-mini",
                object: "model"
              }
            ]
          });
        }
      };
    }
  });

  assert.equal(authorizationHeader, "Bearer test-key");
  assert.equal(fetched.data[0]?.id, "gpt-5.4-mini");
  assert.throws(
    () => parseOpenAiModelCatalogResponse({ object: "list", data: [{ object: "model" }] }),
    /openai_model_catalog_model_id_missing/
  );
});

test("codex cli startup catalog check fetches once and returns reusable catalog", async () => {
  const knownModels = getKnownCodexCliModelIds();
  let requestCount = 0;
  const startupCheck = await checkCodexCliModelCatalogAtStartup({
    apiKey: "test-key",
    baseUrl: "https://api.openai.example/v1",
    checkedAt: "2026-04-25T12:00:00.000Z",
    fetch: async (url, init) => {
      requestCount += 1;
      assert.equal(url, "https://api.openai.example/v1/models");
      assert.equal(init.headers.Authorization, "Bearer test-key");
      return {
        ok: true,
        status: 200,
        async text() {
          return JSON.stringify({
            object: "list",
            data: knownModels.map((id) => ({
              id,
              object: "model",
              owned_by: "openai"
            }))
          });
        }
      };
    }
  });

  assert.equal(requestCount, 1);
  assert.equal(startupCheck.status, "ready");
  assert.equal(startupCheck.checkedAt, "2026-04-25T12:00:00.000Z");
  assert.deepEqual(startupCheck.warnings, []);
  assert.equal(startupCheck.catalog.data.length, knownModels.length);
});

test("codex cli model availability check blocks missing selected models", () => {
  const available = checkCodexCliModelAvailability({
    model: "gpt-5.4-mini",
    officialModels: ["gpt-5.4-mini", "gpt-5.3-codex"]
  });
  const missing = checkCodexCliModelAvailability({
    model: "gpt-5.4-mini",
    officialModels: ["gpt-5.3-codex"],
    requireCatalog: true
  });
  const required = checkCodexCliModelAvailability({
    model: "gpt-5.4-mini",
    requireCatalog: true
  });

  assert.equal(available.status, "available");
  assert.deepEqual(available.blockingReasons, []);
  assert.equal(missing.status, "missing");
  assert.deepEqual(missing.blockingReasons, [
    "codex_cli_model_unavailable:gpt-5.4-mini"
  ]);
  assert.equal(required.status, "not_checked");
  assert.deepEqual(required.blockingReasons, ["codex_cli_model_catalog_required"]);
});

test("codex cli runner checks selected model against startup catalog before spawn", async () => {
  const plan = createCodexCliExecPlan({
    taskId: "cli-runner-model-catalog",
    source: "cli",
    intent: {
      summary: "inspect",
      requestedAction: "inspect repo without edits",
      successCriteria: [],
      outOfScope: ["file edits"]
    },
    repoContext: {
      repoRoot: "A:/codex-router"
    },
    target: {
      branches: [],
      files: ["README.md"],
      modules: ["codex-cli-host"]
    },
    constraints: {},
    hints: {
      taskClassHint: "read_only",
      riskHints: [],
      tags: []
    }
  }, {
    model: "gpt-5.4-mini",
    skipGitRepoCheck: true
  });
  let successfulRunCalls = 0;

  assert.deepEqual(
    checkCodexCliExecPlanModelAvailability(plan, {
      modelCatalog: ["gpt-5.4-mini"],
      requireModelCatalog: true
    }).blockingReasons,
    []
  );
  assert.ok(validateCodexCliExecPlanForRun(plan, {
    requireModelCatalog: true
  }).includes("codex_cli_model_catalog_required"));

  const result = await runCodexCliExecPlan(plan, {
    modelCatalog: ["gpt-5.4-mini"],
    requireModelCatalog: true,
    spawn: () => {
      successfulRunCalls += 1;
      return createFakeCodexCliChild({
        stdout: successfulRunCalls === 1
          ? "{\"type\":\"agent_message\",\"message\":\"CODEX_CLI_MODEL_PROBE_OK\"}\n"
          : "{\"type\":\"agent_message\",\"message\":\"model checked\"}\n",
        exitCode: 0
      });
    }
  });

  assert.equal(successfulRunCalls, 2);
  assert.equal(result.modelAvailability?.status, "available");
  assert.equal(result.inspection.status, "completed");

  let blockedRunCalls = 0;
  await assert.rejects(
    () => runCodexCliExecPlan(plan, {
      modelCatalog: ["gpt-5.3-codex"],
      requireModelCatalog: true,
      spawn: () => {
        blockedRunCalls += 1;
        return createFakeCodexCliChild({
          stdout: "",
          exitCode: 0
        });
      }
    }),
    /codex_cli_model_unavailable:gpt-5\.4-mini/
  );
  assert.equal(blockedRunCalls, 0);
});

test("codex cli model probe evidence uses logged-in CLI path without API key", async () => {
  const calls: Array<{ command: string; args: string[]; cwd?: string }> = [];
  const evidence = await createCodexCliModelCliProbeEvidence({
    generatedAt: "2026-04-25T14:03:00.000Z",
    model: "gpt-5.4-mini",
    codexCommand: "codex",
    cwd: "A:/codex-router",
    spawn: (command, args, options) => {
      calls.push({
        command,
        args,
        ...(options.cwd ? { cwd: options.cwd } : {})
      });
      return createFakeCodexCliChild({
        stdout: "{\"type\":\"agent_message\",\"message\":\"CODEX_CLI_MODEL_PROBE_OK\"}\n",
        exitCode: 0
      });
    }
  });

  assert.equal(evidence.schemaVersion, "codex-cli-model-cli-probe-evidence.v1");
  assert.equal(evidence.source, "cli");
  assert.equal(evidence.status, "passed");
  assert.equal(evidence.mode, "strict");
  assert.equal(evidence.model, "gpt-5.4-mini");
  assert.equal(evidence.cli.command, "codex");
  assert.equal(evidence.cli.sandbox, "read-only");
  assert.equal(evidence.cli.approvalPolicy, "never");
  assert.equal(evidence.cli.usesJson, true);
  assert.equal(evidence.cli.skipGitRepoCheck, true);
  assert.equal(evidence.cli.ephemeral, true);
  assert.equal(evidence.run?.eventCount, 1);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.cwd, "A:/codex-router");
  assert.equal(calls[0]?.args.includes("--model"), true);
  assert.equal(getArgValue(calls[0]?.args ?? [], "--model"), "gpt-5.4-mini");
  const prompt = calls[0]?.args.at(-1) ?? "";
  assert.equal(prompt.includes("Task envelope"), false);
  assert.equal(prompt.includes("requestedAction"), false);
  assert.ok(prompt.includes("CODEX_CLI_MODEL_PROBE_OK"));
  assert.ok(prompt.includes("Do not run shell commands"));
});

test("codex cli model probe evidence can warn on CLI probe failure", async () => {
  const evidence = await createCodexCliModelCliProbeEvidence({
    generatedAt: "2026-04-25T14:04:00.000Z",
    model: "gpt-5.4-mini",
    strict: false,
    codexCommand: "codex",
    cwd: "A:/codex-router",
    spawn: () => createFakeCodexCliChild({
      stdout: "",
      stderr: "model unavailable",
      exitCode: 1
    })
  });

  assert.equal(evidence.status, "unavailable");
  assert.equal(evidence.mode, "warn");
  assert.deepEqual(evidence.blockingReasons, []);
  assert.ok(evidence.run?.blockingReasons.includes("codex_cli_exit_code:1"));
});

test("codex cli model probe evidence writes without raw prompt", async () => {
  const dir = await mkdtemp(join(tmpdir(), "codex-cli-model-probe-"));
  const path = join(dir, "nested", "model-probe.json");
  const persisted = await runAndWriteCodexCliModelCliProbeEvidence({
    evidencePath: path,
    generatedAt: "2026-04-25T14:05:00.000Z",
    model: "gpt-5.4-mini",
    codexCommand: "codex",
    cwd: "A:/codex-router",
    spawn: () => createFakeCodexCliChild({
      stdout: "{\"type\":\"agent_message\",\"message\":\"CODEX_CLI_MODEL_PROBE_OK\"}\n",
      exitCode: 0
    })
  });
  const content = await readFile(path, "utf8");
  const written = JSON.parse(content) as typeof persisted.evidence;

  assert.equal(written.status, "passed");
  assert.equal(written.source, "cli");
  assert.equal(content.includes("CODEX_CLI_MODEL_PROBE_OK"), false);
  assert.equal(content.includes("requestedAction"), false);
});

test("codex cli model probe accepts current item.completed agent message shape", async () => {
  const evidence = await createCodexCliModelCliProbeEvidence({
    generatedAt: "2026-04-25T14:05:30.000Z",
    model: "gpt-5.4-mini",
    codexCommand: "codex",
    cwd: "A:/codex-router",
    spawn: () => createFakeCodexCliChild({
      stdout: [
        "{\"type\":\"thread.started\",\"thread_id\":\"test\"}",
        "{\"type\":\"turn.started\"}",
        "{\"type\":\"item.completed\",\"item\":{\"id\":\"item_0\",\"type\":\"agent_message\",\"text\":\"CODEX_CLI_MODEL_PROBE_OK\"}}",
        "{\"type\":\"turn.completed\"}"
      ].join("\n"),
      exitCode: 0
    })
  });

  assert.equal(evidence.status, "passed");
  assert.equal(evidence.run?.eventCount, 4);
});

test("codex cli model probe fails on unexpected response even when process succeeds", async () => {
  const evidence = await createCodexCliModelCliProbeEvidence({
    generatedAt: "2026-04-25T14:05:40.000Z",
    model: "gpt-5.4-mini",
    codexCommand: "codex",
    cwd: "A:/codex-router",
    spawn: () => createFakeCodexCliChild({
      stdout: "{\"type\":\"agent_message\",\"message\":\"not ok\"}\n",
      exitCode: 0
    })
  });

  assert.equal(evidence.status, "failed");
  assert.ok(evidence.blockingReasons.includes(
    "codex_cli_model_probe_unexpected_response"
  ));
});

test("codex cli model probe warn mode records unexpected response without blocking", async () => {
  const evidence = await createCodexCliModelCliProbeEvidence({
    generatedAt: "2026-04-25T14:05:45.000Z",
    model: "gpt-5.4-mini",
    strict: false,
    codexCommand: "codex",
    cwd: "A:/codex-router",
    spawn: () => createFakeCodexCliChild({
      stdout: "{\"type\":\"agent_message\",\"message\":\"not ok\"}\n",
      exitCode: 0
    })
  });

  assert.equal(evidence.status, "unavailable");
  assert.deepEqual(evidence.blockingReasons, []);
  assert.ok(evidence.warnings.includes(
    "codex_cli_model_probe_unexpected_response"
  ));
});

test("codex cli model probe fails if the model tries to use commands", async () => {
  const evidence = await createCodexCliModelCliProbeEvidence({
    generatedAt: "2026-04-25T14:05:50.000Z",
    model: "gpt-5.4-mini",
    codexCommand: "codex",
    cwd: "A:/codex-router",
    spawn: () => createFakeCodexCliChild({
      stdout: [
        "{\"type\":\"thread.started\",\"thread_id\":\"test\"}",
        "{\"type\":\"turn.started\"}",
        "{\"type\":\"item.started\",\"item\":{\"id\":\"item_1\",\"type\":\"command_execution\",\"command\":\"codex exec --help\",\"status\":\"in_progress\"}}",
        "{\"type\":\"item.completed\",\"item\":{\"id\":\"item_2\",\"type\":\"agent_message\",\"text\":\"CODEX_CLI_MODEL_PROBE_OK\"}}",
        "{\"type\":\"turn.completed\"}"
      ].join("\n"),
      exitCode: 0
    })
  });

  assert.equal(evidence.status, "failed");
  assert.ok(evidence.blockingReasons.includes(
    "codex_cli_model_probe_unexpected_tool_use:command_execution"
  ));
});

test("codex cli runner blocks strict model probe unexpected response before main run", async () => {
  const plan = createCodexCliExecPlan({
    taskId: "cli-runner-auto-probe-unexpected-response",
    source: "cli",
    intent: {
      summary: "inspect",
      requestedAction: "inspect repo without edits",
      successCriteria: [],
      outOfScope: ["file edits"]
    },
    repoContext: {
      repoRoot: "A:/codex-router"
    },
    target: {
      branches: [],
      files: ["README.md"],
      modules: ["codex-cli-host"]
    },
    constraints: {},
    hints: {
      taskClassHint: "read_only",
      riskHints: [],
      tags: []
    }
  }, {
    model: "gpt-5.4-mini",
    skipGitRepoCheck: true
  });
  let calls = 0;

  await assert.rejects(
    () => runCodexCliExecPlan(plan, {
      spawn: () => {
        calls += 1;
        return createFakeCodexCliChild({
          stdout: "{\"type\":\"agent_message\",\"message\":\"not ok\"}\n",
          exitCode: 0
        });
      }
    }),
    /codex_cli_model_probe_unexpected_response/
  );

  assert.equal(calls, 1);
});

test("codex cli runner can require a cached model probe", () => {
  const plan = createCodexCliExecPlan({
    taskId: "cli-runner-probe-required",
    source: "cli",
    intent: {
      summary: "inspect",
      requestedAction: "inspect repo without edits",
      successCriteria: [],
      outOfScope: ["file edits"]
    },
    repoContext: {
      repoRoot: "A:/codex-router"
    },
    target: {
      branches: [],
      files: ["README.md"],
      modules: ["codex-cli-host"]
    },
    constraints: {},
    hints: {
      taskClassHint: "read_only",
      riskHints: [],
      tags: []
    }
  }, {
    model: "gpt-5.4-mini",
    skipGitRepoCheck: true
  });

  assert.ok(validateCodexCliExecPlanForRun(plan, {
    requireModelProbe: true
  }).includes("codex_cli_model_probe_required"));
});

test("codex cli runner auto-probes model with cli before main execution", async () => {
  const plan = createCodexCliExecPlan({
    taskId: "cli-runner-auto-probe",
    source: "cli",
    intent: {
      summary: "inspect",
      requestedAction: "inspect repo without edits",
      successCriteria: [],
      outOfScope: ["file edits"]
    },
    repoContext: {
      repoRoot: "A:/codex-router"
    },
    target: {
      branches: [],
      files: ["README.md"],
      modules: ["codex-cli-host"]
    },
    constraints: {},
    hints: {
      taskClassHint: "read_only",
      riskHints: [],
      tags: []
    }
  }, {
    model: "gpt-5.4-mini",
    skipGitRepoCheck: true
  });
  const calls: Array<{ command: string; args: string[]; cwd?: string }> = [];

  const result = await runCodexCliExecPlan(plan, {
    autoProbeModelWithCli: true,
    requireModelProbe: true,
    spawn: (command, args, options) => {
      calls.push({
        command,
        args,
        ...(options.cwd ? { cwd: options.cwd } : {})
      });

      if (calls.length === 1) {
        return createFakeCodexCliChild({
          stdout: "{\"type\":\"agent_message\",\"message\":\"CODEX_CLI_MODEL_PROBE_OK\"}\n",
          exitCode: 0
        });
      }

      return createFakeCodexCliChild({
        stdout: "{\"type\":\"agent_message\",\"message\":\"main run ok\"}\n",
        exitCode: 0
      });
    }
  });

  assert.equal(calls.length, 2);
  assert.equal(getArgValue(calls[0]?.args ?? [], "--model"), "gpt-5.4-mini");
  assert.equal(getArgValue(calls[1]?.args ?? [], "--model"), "gpt-5.4-mini");
  assert.equal(result.modelProbe?.status, "passed");
  assert.equal(result.output.exitCode, 0);
  assert.equal(result.inspection.status, "completed");
});

test("codex cli runner defaults to automatic strict model probe when plan has a model", async () => {
  const plan = createCodexCliExecPlan({
    taskId: "cli-runner-default-auto-probe",
    source: "cli",
    intent: {
      summary: "inspect",
      requestedAction: "inspect repo without edits",
      successCriteria: [],
      outOfScope: ["file edits"]
    },
    repoContext: {
      repoRoot: "A:/codex-router"
    },
    target: {
      branches: [],
      files: ["README.md"],
      modules: ["codex-cli-host"]
    },
    constraints: {},
    hints: {
      taskClassHint: "read_only",
      riskHints: [],
      tags: []
    }
  }, {
    model: "gpt-5.4-mini",
    skipGitRepoCheck: true
  });
  let calls = 0;

  const result = await runCodexCliExecPlan(plan, {
    spawn: () => {
      calls += 1;
      return createFakeCodexCliChild({
        stdout: calls === 1
          ? "{\"type\":\"agent_message\",\"message\":\"CODEX_CLI_MODEL_PROBE_OK\"}\n"
          : "{\"type\":\"agent_message\",\"message\":\"main run ok\"}\n",
        exitCode: 0
      });
    }
  });

  assert.equal(calls, 2);
  assert.equal(result.modelProbe?.status, "passed");
  assert.equal(result.inspection.status, "completed");
});

test("codex cli runner blocks when auto model probe fails in strict mode", async () => {
  const plan = createCodexCliExecPlan({
    taskId: "cli-runner-auto-probe-blocked",
    source: "cli",
    intent: {
      summary: "inspect",
      requestedAction: "inspect repo without edits",
      successCriteria: [],
      outOfScope: ["file edits"]
    },
    repoContext: {
      repoRoot: "A:/codex-router"
    },
    target: {
      branches: [],
      files: ["README.md"],
      modules: ["codex-cli-host"]
    },
    constraints: {},
    hints: {
      taskClassHint: "read_only",
      riskHints: [],
      tags: []
    }
  }, {
    model: "gpt-5.4-mini",
    skipGitRepoCheck: true
  });
  let calls = 0;

  await assert.rejects(
    () => runCodexCliExecPlan(plan, {
      autoProbeModelWithCli: true,
      requireModelProbe: true,
      spawn: () => {
        calls += 1;
        return createFakeCodexCliChild({
          stdout: "",
          stderr: "model unavailable",
          exitCode: 1
        });
      }
    }),
    /codex_cli_model_probe_failed/
  );

  assert.equal(calls, 1);
});

test("codex cli runner can explicitly skip default execution model probe", async () => {
  const plan = createCodexCliExecPlan({
    taskId: "cli-runner-skip-default-probe",
    source: "cli",
    intent: {
      summary: "inspect",
      requestedAction: "inspect repo without edits",
      successCriteria: [],
      outOfScope: ["file edits"]
    },
    repoContext: {
      repoRoot: "A:/codex-router"
    },
    target: {
      branches: [],
      files: ["README.md"],
      modules: ["codex-cli-host"]
    },
    constraints: {},
    hints: {
      taskClassHint: "read_only",
      riskHints: [],
      tags: []
    }
  }, {
    model: "gpt-5.4-mini",
    skipGitRepoCheck: true
  });
  let calls = 0;

  const result = await runCodexCliExecPlan(plan, {
    skipExecutionModelProbe: true,
    spawn: () => {
      calls += 1;
      return createFakeCodexCliChild({
        stdout: "{\"type\":\"agent_message\",\"message\":\"main run ok\"}\n",
        exitCode: 0
      });
    }
  });

  assert.equal(calls, 1);
  assert.equal(result.modelProbe, undefined);
  assert.equal(result.inspection.status, "completed");
});

test("codex cli runner reuses a cached passed model probe within the ttl", async () => {
  const plan = createCodexCliExecPlan({
    taskId: "cli-runner-probe-cache-hit",
    source: "cli",
    intent: {
      summary: "inspect",
      requestedAction: "inspect repo without edits",
      successCriteria: [],
      outOfScope: ["file edits"]
    },
    repoContext: {
      repoRoot: "A:/codex-router"
    },
    target: {
      branches: [],
      files: ["README.md"],
      modules: ["codex-cli-host"]
    },
    constraints: {},
    hints: {
      taskClassHint: "read_only",
      riskHints: [],
      tags: []
    }
  }, {
    model: "gpt-5.4-mini",
    skipGitRepoCheck: true
  });
  let calls = 0;

  const spawn: CodexCliProcessSpawner = () => {
    calls += 1;
    return createFakeCodexCliChild({
      stdout: calls === 1 || calls === 3
        ? "{\"type\":\"agent_message\",\"message\":\"CODEX_CLI_MODEL_PROBE_OK\"}\n"
        : "{\"type\":\"agent_message\",\"message\":\"main run ok\"}\n",
      exitCode: 0
    });
  };

  const first = await runCodexCliExecPlan(plan, {
    spawn,
    modelProbeCacheTtlMs: 60_000
  });
  const second = await runCodexCliExecPlan(plan, {
    spawn,
    modelProbeCacheTtlMs: 60_000
  });

  assert.equal(calls, 3);
  assert.equal(first.modelProbe?.status, "passed");
  assert.equal(second.modelProbe?.status, "passed");
  assert.equal(second.inspection.status, "completed");
});

test("codex cli runner refreshes the model probe after cache ttl expiry", async () => {
  const plan = createCodexCliExecPlan({
    taskId: "cli-runner-probe-cache-expired",
    source: "cli",
    intent: {
      summary: "inspect",
      requestedAction: "inspect repo without edits",
      successCriteria: [],
      outOfScope: ["file edits"]
    },
    repoContext: {
      repoRoot: "A:/codex-router"
    },
    target: {
      branches: [],
      files: ["README.md"],
      modules: ["codex-cli-host"]
    },
    constraints: {},
    hints: {
      taskClassHint: "read_only",
      riskHints: [],
      tags: []
    }
  }, {
    model: "gpt-5.4-mini",
    skipGitRepoCheck: true
  });
  let calls = 0;

  const spawn: CodexCliProcessSpawner = () => {
    calls += 1;
    return createFakeCodexCliChild({
      stdout: calls % 2 === 1
        ? "{\"type\":\"agent_message\",\"message\":\"CODEX_CLI_MODEL_PROBE_OK\"}\n"
        : "{\"type\":\"agent_message\",\"message\":\"main run ok\"}\n",
      exitCode: 0
    });
  };

  await runCodexCliExecPlan(plan, {
    spawn,
    modelProbeCacheTtlMs: 0
  });
  await runCodexCliExecPlan(plan, {
    spawn,
    modelProbeCacheTtlMs: 0
  });

  assert.equal(calls, 4);
});

test("codex cli runner can disable the passed probe cache explicitly", async () => {
  const plan = createCodexCliExecPlan({
    taskId: "cli-runner-probe-cache-disabled",
    source: "cli",
    intent: {
      summary: "inspect",
      requestedAction: "inspect repo without edits",
      successCriteria: [],
      outOfScope: ["file edits"]
    },
    repoContext: {
      repoRoot: "A:/codex-router"
    },
    target: {
      branches: [],
      files: ["README.md"],
      modules: ["codex-cli-host"]
    },
    constraints: {},
    hints: {
      taskClassHint: "read_only",
      riskHints: [],
      tags: []
    }
  }, {
    model: "gpt-5.4-mini",
    skipGitRepoCheck: true
  });
  let calls = 0;

  const spawn: CodexCliProcessSpawner = () => {
    calls += 1;
    return createFakeCodexCliChild({
      stdout: calls % 2 === 1
        ? "{\"type\":\"agent_message\",\"message\":\"CODEX_CLI_MODEL_PROBE_OK\"}\n"
        : "{\"type\":\"agent_message\",\"message\":\"main run ok\"}\n",
      exitCode: 0
    });
  };

  await runCodexCliExecPlan(plan, {
    spawn,
    disableModelProbeCache: true
  });
  await runCodexCliExecPlan(plan, {
    spawn,
    disableModelProbeCache: true
  });

  assert.equal(calls, 4);
});

test("codex cli runner emits telemetry for model probe cache miss and hit", async () => {
  const plan = createCodexCliExecPlan({
    taskId: "cli-runner-probe-cache-telemetry",
    source: "cli",
    intent: {
      summary: "inspect",
      requestedAction: "inspect repo without edits",
      successCriteria: [],
      outOfScope: ["file edits"]
    },
    repoContext: {
      repoRoot: "A:/codex-router"
    },
    target: {
      branches: [],
      files: ["README.md"],
      modules: ["codex-cli-host"]
    },
    constraints: {},
    hints: {
      taskClassHint: "read_only",
      riskHints: [],
      tags: []
    }
  }, {
    model: "gpt-5.4-mini",
    skipGitRepoCheck: true
  });
  const telemetryStore = createRecordingTelemetrySink();
  let calls = 0;

  const spawn: CodexCliProcessSpawner = () => {
    calls += 1;
    return createFakeCodexCliChild({
      stdout: calls === 1 || calls === 3
        ? "{\"type\":\"agent_message\",\"message\":\"CODEX_CLI_MODEL_PROBE_OK\"}\n"
        : "{\"type\":\"agent_message\",\"message\":\"main run ok\"}\n",
      exitCode: 0
    });
  };

  await runCodexCliExecPlan(plan, {
    spawn,
    telemetryStore,
    modelProbeCacheTtlMs: 60_000
  });
  await runCodexCliExecPlan(plan, {
    spawn,
    telemetryStore,
    modelProbeCacheTtlMs: 60_000
  });

  const events = await telemetryStore.loadAll();
  assert.equal(calls, 3);
  assert.equal(events.length, 3);
  assert.equal(events[0]?.message, "codex cli model probe cache miss");
  assert.equal(events[1]?.message, "codex cli model probe result");
  assert.equal(events[2]?.message, "codex cli model probe cache hit");
  assert.equal(events[0]?.context?.source, "codex-cli-host");
  assert.equal(events[1]?.context?.model, "gpt-5.4-mini");
  assert.equal(events[1]?.context?.status, "passed");
  assert.equal((events[1]?.context?.run as Record<string, unknown> | undefined)?.stdinClosed, true);
  assert.equal((events[1]?.context?.run as Record<string, unknown> | undefined)?.stdinDestroyed, true);
  assert.equal(events[2]?.context?.model, "gpt-5.4-mini");
});

test("codex cli model check evidence records drift as strict failure", async () => {
  const evidence = await createCodexCliModelCheckEvidence({
    apiKey: "test-key",
    generatedAt: "2026-04-25T14:00:00.000Z",
    fetch: async () => ({
      ok: true,
      status: 200,
      async text() {
        return JSON.stringify({
          object: "list",
          data: [
            { id: "gpt-5.3-codex-spark", object: "model" },
            { id: "gpt-5.4-mini", object: "model" },
            { id: "gpt-5.3-codex", object: "model" },
            { id: "gpt-5.4", object: "model" },
            { id: "gpt-5.5-codex", object: "model" }
          ]
        });
      }
    })
  });

  assert.equal(evidence.schemaVersion, "codex-cli-model-check-evidence.v1");
  assert.equal(evidence.status, "failed");
  assert.equal(evidence.mode, "strict");
  assert.equal(evidence.api.apiKeyConfigured, true);
  assert.deepEqual(evidence.blockingReasons, [
    "codex_cli_model_catalog_drift_detected"
  ]);
  assert.deepEqual(evidence.detection?.missingKnownModels, ["gpt-5.1-codex-max"]);
  assert.deepEqual(evidence.detection?.untrackedOfficialModels, ["gpt-5.5-codex"]);
});

test("codex cli model check evidence can warn when catalog access is unavailable", async () => {
  const evidence = await createCodexCliModelCheckEvidence({
    apiKey: "",
    strict: false,
    generatedAt: "2026-04-25T14:01:00.000Z"
  });

  assert.equal(evidence.status, "unavailable");
  assert.equal(evidence.mode, "warn");
  assert.equal(evidence.api.apiKeyConfigured, false);
  assert.deepEqual(evidence.blockingReasons, []);
  assert.deepEqual(evidence.warnings, ["openai_api_key_missing"]);
});

test("codex cli model check command evidence writes without raw credentials", async () => {
  const dir = await mkdtemp(join(tmpdir(), "codex-cli-model-check-"));
  const path = join(dir, "nested", "model-check.json");
  const knownModels = getKnownCodexCliModelIds();
  const persisted = await runAndWriteCodexCliModelCheckEvidence({
    evidencePath: path,
    apiKey: "secret-test-key",
    baseUrl: "https://user:password@api.openai.example/v1?token=secret",
    generatedAt: "2026-04-25T14:02:00.000Z",
    fetch: async (url, init) => {
      assert.equal(url, "https://user:password@api.openai.example/v1?token=secret/models");
      assert.equal(init.headers.Authorization, "Bearer secret-test-key");
      return {
        ok: true,
        status: 200,
        async text() {
          return JSON.stringify({
            object: "list",
            data: knownModels.map((id) => ({ id, object: "model" }))
          });
        }
      };
    }
  });
  const content = await readFile(path, "utf8");
  const written = JSON.parse(content) as typeof persisted.evidence;

  assert.equal(persisted.write.path, path);
  assert.equal(written.status, "passed");
  assert.equal(written.api.baseUrl, "https://api.openai.example/v1");
  assert.equal(content.includes("secret-test-key"), false);
  assert.equal(content.includes("password"), false);
  assert.equal(content.includes("token=secret"), false);
});

test("codex cli decision plan rejects task mismatches and policy overrides", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const task = parseTaskEnvelope({
    taskId: "cli-decision-guard",
    source: "cli",
    intent: {
      summary: "inspect",
      requestedAction: "inspect current files",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: {
      repoRoot: "A:/codex-router"
    },
    target: {
      branches: [],
      files: ["routing-policy.yaml"],
      modules: ["codex-cli-host"]
    },
    constraints: {},
    hints: {
      riskHints: [],
      tags: []
    }
  });
  const decision = routeTask(task, classifyIntent(task), policy);

  assert.throws(
    () => createCodexCliExecPlanFromRoutingDecision(
      {
        ...task,
        taskId: "different-task"
      },
      decision
    ),
    /codex_cli_decision_task_id_mismatch/
  );

  assert.throws(
    () => createCodexCliExecPlanFromRoutingDecision(task, decision, {
      model: "gpt-5.1-codex-max"
    } as never),
    /codex_cli_decision_plan_disallows_policy_override:model/
  );

  assert.throws(
    () => createCodexCliExecPlanFromRoutingDecision(task, decision, {
      sandbox: "workspace-write"
    } as never),
    /codex_cli_decision_plan_disallows_policy_override:sandbox/
  );

  for (const [option, value] of [
    ["approvalFlagPlacement", "after-command"],
    ["approvalPolicy", "never"],
    ["codexCommand", "custom-codex"],
    ["configOverrides", ["model=gpt-5.4"]],
    ["cwd", "A:/other"],
    ["extraArgs", ["--ask-for-approval", "never"]],
    ["ignoreRules", true],
    ["profile", "custom-profile"]
  ] as const) {
    assert.throws(
      () => createCodexCliExecPlanFromRoutingDecision(task, decision, {
        [option]: value
      } as never),
      new RegExp(`codex_cli_decision_plan_disallows_policy_override:${option}`)
    );
  }

  const ignoreUserConfigPlan = createCodexCliExecPlanFromRoutingDecision(
    task,
    decision,
    {
      ignoreUserConfig: true
    }
  );
  assert.ok(ignoreUserConfigPlan.args.includes("--ignore-user-config"));
});

test("codex cli host keeps write and release tasks sandboxed without bypass flags", () => {
  const engineeringTask = parseTaskEnvelope({
    taskId: "cli-engineering",
    source: "cli",
    intent: {
      summary: "implement",
      requestedAction: "make a small change",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: {
      repoRoot: "A:/codex-router"
    },
    target: {
      branches: [],
      files: ["packages/codex-cli-host/src/index.ts"],
      modules: ["codex-cli-host"]
    },
    constraints: {
      explicitOwnership: true
    },
    hints: {
      taskClassHint: "engineering",
      riskHints: [],
      tags: []
    }
  });
  const releasePlan = createCodexCliExecPlan({
    ...engineeringTask,
    taskId: "cli-release",
    hints: {
      taskClassHint: "release_external_action",
      riskHints: [],
      tags: []
    }
  });

  assert.equal(resolveCodexCliSandbox(engineeringTask), "workspace-write");
  assert.equal(releasePlan.sandbox, "workspace-write");
  assert.ok(releasePlan.warnings.includes("codex_cli_release_posture_requires_external_approval_gate"));
  assert.equal(releasePlan.args.includes("--dangerously-bypass-approvals-and-sandbox"), false);
  assert.equal(releasePlan.args.includes("--full-auto"), false);

  assert.throws(
    () => createCodexCliExecPlan(engineeringTask, {
      extraArgs: ["--dangerously-bypass-approvals-and-sandbox"]
    }),
    /codex_cli_dangerous_arg_not_allowed/
  );

  assert.throws(
    () => createCodexCliExecPlan(engineeringTask, {
      extraArgs: ["--sandbox", "read-only"]
    }),
    /codex_cli_duplicate_security_arg:sandbox/
  );

  assert.throws(
    () => createCodexCliExecPlan(engineeringTask, {
      extraArgs: ["--ask-for-approval", "never"]
    }),
    /codex_cli_duplicate_security_arg:approval/
  );

  assert.throws(
    () => createCodexCliExecPlan(engineeringTask, {
      model: "gpt-5.4-mini",
      extraArgs: ["--model", "gpt-5.3-codex"]
    }),
    /codex_cli_duplicate_security_arg:model/
  );

  assert.throws(
    () => createCodexCliExecPlan(engineeringTask, {
      configOverrides: ["sandbox.mode=workspace-write"],
      extraArgs: ["-c", "sandbox.mode=read-only"]
    }),
    /codex_cli_governed_config_override_not_allowed:sandbox\.mode/
  );

  const multipleConfigPlan = createCodexCliExecPlan(engineeringTask, {
    configOverrides: ["telemetry.enabled=false", "history.persistence=none"]
  });
  assert.deepEqual(
    multipleConfigPlan.args.filter((arg) => arg === "-c"),
    ["-c", "-c"]
  );
});

test("codex cli host parses jsonl events and preserves parse diagnostics", () => {
  const parsed = parseCodexCliJsonl([
    "{\"type\":\"session.started\",\"id\":\"s1\"}",
    "not-json",
    "42",
    "{\"type\":\"agent_message\",\"message\":\"done\"}",
    ""
  ].join("\n"));

  assert.equal(parsed.events.length, 2);
  assert.deepEqual(parsed.events.map((event) => event.event.type), [
    "session.started",
    "agent_message"
  ]);
  assert.equal(parsed.parseErrors.length, 2);
  assert.equal(parsed.parseErrors[1]?.error, "codex_cli_jsonl_event_not_object");
});

test("codex cli host inspects command output without treating stderr warnings as failure", () => {
  const inspection = inspectCodexCliCommandOutput({
    exitCode: 0,
    stdout: "{\"type\":\"agent_message\",\"message\":\"ok\"}\n",
    stderr: [
      "WARNING: failed to clean up stale arg0 temp dirs: access denied",
      "WARNING: proceeding, even though we could not update PATH"
    ].join("\n")
  });

  assert.equal(inspection.status, "completed");
  assert.equal(inspection.events.length, 1);
  assert.equal(inspection.warnings.length, 2);
  assert.deepEqual(inspection.blockingReasons, []);
});

test("codex cli host runner captures read-only process output through an injectable spawner", async () => {
  const calls: Array<{ command: string; args: string[]; cwd?: string; stdio?: unknown }> = [];
  let child: FakeCodexCliChild | undefined;
  const spawner: CodexCliProcessSpawner = (command, args, options) => {
    calls.push({
      command,
      args,
      ...(options.cwd ? { cwd: options.cwd } : {}),
      stdio: options.stdio
    });

    child = createFakeCodexCliChild({
      stdout: "{\"type\":\"agent_message\",\"message\":\"ok\"}\n",
      stderr: "WARNING: diagnostic only\n",
      exitCode: 0
    });
    return child;
  };
  const plan = createCodexCliExecPlan({
    taskId: "cli-runner-readonly",
    source: "cli",
    intent: {
      summary: "inspect",
      requestedAction: "inspect repo without edits",
      successCriteria: [],
      outOfScope: ["file edits"]
    },
    repoContext: {
      repoRoot: "A:/codex-router"
    },
    target: {
      branches: [],
      files: ["README.md"],
      modules: ["codex-cli-host"]
    },
    constraints: {},
    hints: {
      taskClassHint: "read_only",
      riskHints: [],
      tags: []
    }
  }, {
    skipGitRepoCheck: true,
    ephemeral: true
  });

  const result = await runCodexCliExecPlan(plan, {
    spawn: spawner
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.command, "codex");
  assert.equal(calls[0]?.cwd, "A:/codex-router");
  assert.deepEqual(calls[0]?.stdio, ["pipe", "pipe", "pipe"]);
  assert.deepEqual(calls[0]?.args.slice(0, 4), [
    "-a",
    "on-request",
    "exec",
    "--json"
  ]);
  assert.equal(result.output.exitCode, 0);
  assert.equal(result.inspection.status, "completed");
  assert.equal(result.inspection.events.length, 1);
  assert.equal(child?.stdin.ended, true);
  assert.equal(child?.stdin.destroyed, true);
  assert.equal(result.lifecycle.stdin.closed, true);
  assert.equal(result.lifecycle.stdin.destroyed, true);
  assert.equal(result.lifecycle.termination.closeReceived, true);
  assert.equal(result.lifecycle.termination.forcedSettled, false);
  assert.deepEqual(result.inspection.warnings, ["WARNING: diagnostic only"]);
});

test("codex cli runner prepends packaged helper PATH for Windows bin executable layout", async () => {
  const originalPlatform = Object.getOwnPropertyDescriptor(process, "platform");
  const vendorRoot = await mkdtemp(join(tmpdir(), "codex-cli-vendor-"));
  const command = join(vendorRoot, "bin", "codex.exe");
  const helperPath = join(vendorRoot, "codex-path");
  const calls: Array<{ command: string; env?: NodeJS.ProcessEnv }> = [];
  const spawner: CodexCliProcessSpawner = (spawnCommand, args, options) => {
    calls.push({
      command: spawnCommand,
      ...(options.env ? { env: options.env } : {})
    });

    return createFakeCodexCliChild({
      stdout: "{\"type\":\"agent_message\",\"message\":\"ok\"}\n",
      exitCode: 0
    });
  };
  const plan = createCodexCliExecPlan(createCodexCliReadOnlySmokeTask({
    taskId: "cli-runner-windows-bin-helper-path"
  }), {
    codexCommand: command,
    skipGitRepoCheck: true,
    ephemeral: true
  });

  Object.defineProperty(process, "platform", { value: "win32" });
  try {
    const result = await runCodexCliExecPlan(plan, {
      env: {
        Path: "C:/Windows/System32",
        CODEX_TEST_ENV: "preserved"
      },
      skipExecutionModelProbe: true,
      spawn: spawner
    });

    assert.equal(result.inspection.status, "completed");
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.command, command);
    assert.equal(calls[0]?.env?.CODEX_TEST_ENV, "preserved");
    assert.equal(calls[0]?.env?.Path, `${helperPath};C:/Windows/System32`);
  } finally {
    if (originalPlatform) {
      Object.defineProperty(process, "platform", originalPlatform);
    }
  }
});

test("codex cli runner converts synchronous spawner failure into a failed execution result", async () => {
  const plan = createCodexCliExecPlan(createCodexCliReadOnlySmokeTask({
    taskId: "cli-runner-sync-spawn-error"
  }), {
    skipGitRepoCheck: true,
    ephemeral: true
  });

  const result = await runCodexCliExecPlan(plan, {
    spawn: () => {
      throw new Error("spawn EPERM");
    }
  });

  assert.equal(result.output.exitCode, 1);
  assert.equal(result.inspection.status, "failed");
  assert.equal(result.error, "spawn EPERM");
  assert.deepEqual(result.inspection.blockingReasons, [
    "codex_cli_exit_code:1",
    "codex_cli_process_error:spawn EPERM"
  ]);
});

test("codex cli operator acceptance runs a task through the guarded exec runner and captures telemetry", async () => {
  const telemetryStore = createRecordingTelemetrySink();
  let calls = 0;

  const result = await runCodexCliOperatorAcceptance({
    task: {
      taskId: "cli-operator-acceptance",
      source: "cli",
      intent: {
        summary: "inspect codex router readiness",
        requestedAction: "inspect the workspace without edits",
        successCriteria: [],
        outOfScope: ["file edits"]
      },
      repoContext: {
        repoRoot: "A:/codex-router"
      },
      target: {
        branches: [],
        files: ["README.md"],
        modules: ["codex-cli-host"]
      },
      constraints: {},
      hints: {
        taskClassHint: "read_only",
        riskHints: [],
        tags: ["operator-acceptance"]
      }
    },
    planOptions: {
      model: "gpt-5.4-mini",
      skipGitRepoCheck: true,
      ephemeral: true
    },
    telemetryStore,
    spawn: () => createFakeCodexCliChild({
      stdout: (++calls === 1)
        ? "{\"type\":\"agent_message\",\"message\":\"CODEX_CLI_MODEL_PROBE_OK\"}\n"
        : "{\"type\":\"agent_message\",\"message\":\"acceptance ok\"}\n",
      exitCode: 0
    })
  });

  assert.equal(result.status, "passed");
  assert.equal(result.run?.inspection.status, "completed");
  assert.equal(
    result.telemetryEvents.some((event) => event.message === "codex cli model probe cache miss"),
    true
  );
  assert.equal((await telemetryStore.loadAll()).length >= 1, true);
});

test("codex cli operator acceptance emits cache miss then hit across consecutive runs", async () => {
  const telemetryStore = createRecordingTelemetrySink();
  let calls = 0;
  const task = {
    taskId: "cli-operator-acceptance-cache",
    source: "cli" as const,
    intent: {
      summary: "inspect codex router readiness",
      requestedAction: "inspect the workspace without edits",
      successCriteria: [],
      outOfScope: ["file edits"]
    },
    repoContext: {
      repoRoot: "A:/codex-router"
    },
    target: {
      branches: [],
      files: ["README.md"],
      modules: ["codex-cli-host"]
    },
    constraints: {},
    hints: {
      taskClassHint: "read_only" as const,
      riskHints: [],
      tags: ["operator-acceptance"]
    }
  };
  const spawn = () => createFakeCodexCliChild({
    stdout: (++calls === 1)
      ? "{\"type\":\"agent_message\",\"message\":\"CODEX_CLI_MODEL_PROBE_OK\"}\n"
      : "{\"type\":\"agent_message\",\"message\":\"acceptance ok\"}\n",
    exitCode: 0
  });

  const first = await runCodexCliOperatorAcceptance({
    task,
    planOptions: {
      model: "gpt-5.4-mini",
      skipGitRepoCheck: true,
      ephemeral: true
    },
    telemetryStore,
    spawn
  });
  const second = await runCodexCliOperatorAcceptance({
    task,
    planOptions: {
      model: "gpt-5.4-mini",
      skipGitRepoCheck: true,
      ephemeral: true
    },
    telemetryStore,
    spawn
  });
  const events = await telemetryStore.loadAll();
  const messages = events.map((event) => event.message);

  assert.equal(first.status, "passed");
  assert.equal(second.status, "passed");
  assert.equal(calls, 3);
  assert.deepEqual(messages, [
    "codex cli model probe cache miss",
    "codex cli model probe result",
    "codex cli model probe cache hit"
  ]);
  assert.equal(events[1]?.context?.status, "passed");
  assert.equal((events[1]?.context?.run as Record<string, unknown> | undefined)?.stdinClosed, true);
});

test("codex cli operator acceptance evidence writes without raw prompt or argv", async () => {
  const dir = await mkdtemp(join(tmpdir(), "codex-cli-operator-acceptance-"));
  const path = join(dir, "operator", "evidence.json");
  let calls = 0;
  const persisted = await runAndWriteCodexCliOperatorAcceptanceEvidence({
    evidencePath: path,
    task: {
      taskId: "cli-operator-acceptance-write",
      source: "cli",
      intent: {
        summary: "inspect codex router readiness",
        requestedAction: "inspect the workspace without edits",
        successCriteria: [],
        outOfScope: ["file edits"]
      },
      repoContext: {
        repoRoot: "A:/codex-router"
      },
      target: {
        branches: [],
        files: ["README.md"],
        modules: ["codex-cli-host"]
      },
      constraints: {},
      hints: {
        taskClassHint: "read_only",
        riskHints: [],
        tags: ["operator-acceptance"]
      }
    },
    planOptions: {
      model: "gpt-5.4-mini",
      skipGitRepoCheck: true,
      ephemeral: true
    },
    spawn: () => createFakeCodexCliChild({
      stdout: (++calls === 1)
        ? "{\"type\":\"agent_message\",\"message\":\"CODEX_CLI_MODEL_PROBE_OK\"}\n"
        : "{\"type\":\"agent_message\",\"message\":\"acceptance ok\"}\n",
      exitCode: 0
    })
  });
  const content = await readFile(path, "utf8");
  const written = JSON.parse(content) as typeof persisted.evidence;

  assert.equal(persisted.result.status, "passed");
  assert.equal(persisted.evidence.schemaVersion, "codex-cli-operator-acceptance-evidence.v1");
  assert.equal(persisted.evidence.taskId, "cli-operator-acceptance-write");
  assert.equal(persisted.evidence.plan.model, "gpt-5.4-mini");
  assert.equal(
    persisted.evidence.summary.telemetryMessages.includes("codex cli model probe cache miss"),
    true
  );
  assert.equal("prompt" in written.plan, false);
  assert.equal("args" in written.plan, false);
});

test("codex cli operator acceptance blocks workspace-write plans without explicit allowance", async () => {
  const result = await runCodexCliOperatorAcceptance({
    task: {
      taskId: "cli-operator-acceptance-write-blocked",
      source: "cli",
      intent: {
        summary: "perform a bounded operator acceptance write",
        requestedAction: "update the bounded acceptance evidence file and report the result",
        successCriteria: [],
        outOfScope: ["external writes"]
      },
      repoContext: {
        repoRoot: "A:/codex-router"
      },
      target: {
        branches: [],
        files: ["docs/evidence/codex-cli-workspace-write-smoke.txt"],
        modules: ["codex-cli-host"]
      },
      constraints: {},
      hints: {
        taskClassHint: "engineering",
        riskHints: [],
        tags: ["operator-acceptance"]
      }
    },
    planOptions: {
      model: "gpt-5.4-mini",
      sandbox: "workspace-write",
      approvalPolicy: "on-request",
      skipGitRepoCheck: true,
      ephemeral: true
    }
  });

  assert.equal(result.status, "failed");
  assert.ok(result.validationBlockers.includes(
    "codex_cli_write_sandbox_requires_explicit_allowance"
  ));
  assert.equal(result.run, undefined);
});

test("codex cli host runner blocks write sandbox unless explicitly allowed", async () => {
  const task = parseTaskEnvelope({
    taskId: "cli-runner-write",
    source: "cli",
    intent: {
      summary: "edit",
      requestedAction: "edit a file",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: {
      repoRoot: "A:/codex-router"
    },
    target: {
      branches: [],
      files: ["README.md"],
      modules: ["codex-cli-host"]
    },
    constraints: {},
    hints: {
      taskClassHint: "engineering",
      riskHints: [],
      tags: []
    }
  });
  const plan = createCodexCliExecPlan(task);

  assert.ok(validateCodexCliExecPlanForRun(plan).includes(
    "codex_cli_write_sandbox_requires_explicit_allowance"
  ));
  await assert.rejects(
    () => runCodexCliExecPlan(plan, {
      spawn: () => createFakeCodexCliChild({
        stdout: "",
        exitCode: 0
      })
    }),
    /codex_cli_write_sandbox_requires_explicit_allowance/
  );

  const result = await runCodexCliExecPlan(plan, {
    allowWriteSandbox: true,
    spawn: () => createFakeCodexCliChild({
      stdout: "{\"type\":\"agent_message\",\"message\":\"allowed\"}\n",
      exitCode: 0
    })
  });

  assert.equal(result.inspection.status, "completed");
});

test("codex cli host runner rejects manually forged dangerous plans", async () => {
  const plan = createCodexCliExecPlan({
    taskId: "cli-runner-danger",
    source: "cli",
    intent: {
      summary: "inspect",
      requestedAction: "inspect",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: {
      repoRoot: "A:/codex-router"
    },
    target: {
      branches: [],
      files: [],
      modules: []
    },
    constraints: {},
    hints: {
      taskClassHint: "read_only",
      riskHints: [],
      tags: []
    }
  });
  const forgedPlan = {
    ...plan,
    args: [...plan.args, "--dangerously-bypass-approvals-and-sandbox"]
  };

  assert.ok(validateCodexCliExecPlanForRun(forgedPlan).some((reason) => (
    reason.includes("codex_cli_dangerous_arg_not_allowed")
  )));
  await assert.rejects(
    () => runCodexCliExecPlan(forgedPlan, {
      spawn: () => createFakeCodexCliChild({
        stdout: "",
        exitCode: 0
      })
    }),
    /codex_cli_dangerous_arg_not_allowed/
  );
});

test("codex cli host runner rejects forged sandbox argv mismatches", async () => {
  const plan = createCodexCliExecPlan({
    taskId: "cli-runner-forged-sandbox",
    source: "cli",
    intent: {
      summary: "inspect",
      requestedAction: "inspect",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: {
      repoRoot: "A:/codex-router"
    },
    target: {
      branches: [],
      files: [],
      modules: []
    },
    constraints: {},
    hints: {
      taskClassHint: "read_only",
      riskHints: [],
      tags: []
    }
  });
  const sandboxIndex = plan.args.indexOf("--sandbox") + 1;
  const forgedPlan = {
    ...plan,
    args: plan.args.map((arg, index) => (
      index === sandboxIndex ? "workspace-write" : arg
    ))
  };

  assert.ok(validateCodexCliExecPlanForRun(forgedPlan).includes(
    "codex_cli_sandbox_arg_mismatch:workspace-write:read-only"
  ));
  await assert.rejects(
    () => runCodexCliExecPlan(forgedPlan, {
      spawn: () => createFakeCodexCliChild({
        stdout: "",
        exitCode: 0
      })
    }),
    /codex_cli_sandbox_arg_mismatch/
  );
});

test("codex cli host runner rejects forged duplicate security argv", async () => {
  const plan = createCodexCliExecPlan({
    taskId: "cli-runner-forged-duplicate-security-argv",
    source: "cli",
    intent: {
      summary: "inspect",
      requestedAction: "inspect",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: {
      repoRoot: "A:/codex-router"
    },
    target: {
      branches: [],
      files: [],
      modules: []
    },
    constraints: {},
    hints: {
      taskClassHint: "read_only" as const,
      riskHints: [],
      tags: []
    }
  });
  const forgedSandboxPlan = {
    ...plan,
    args: [
      "-a",
      "on-request",
      "exec",
      "--json",
      "--sandbox",
      "read-only",
      "-s",
      "workspace-write",
      plan.prompt
    ]
  };
  const forgedApprovalPlan = {
    ...plan,
    args: [
      "-a",
      "on-request",
      "exec",
      "--json",
      "--sandbox",
      "read-only",
      "--ask-for-approval",
      "never",
      plan.prompt
    ]
  };
  const forgedWorkdirPlan = {
    ...plan,
    args: [
      ...plan.args.slice(0, -1),
      "-C",
      "A:/other",
      plan.prompt
    ]
  };
  const forgedCwdPlan = {
    ...plan,
    args: [
      ...plan.args.slice(0, -1),
      "--cwd",
      "A:/other",
      plan.prompt
    ]
  };
  const forgedCompactSandboxPlan = {
    ...plan,
    args: [
      ...plan.args.slice(0, -1),
      "-sworkspace-write",
      plan.prompt
    ]
  };
  const forgedCompactModelPlan = {
    ...plan,
    args: [
      ...plan.args.slice(0, -1),
      "--model",
      "gpt-5.4-mini",
      "-mgpt-5.3-codex",
      plan.prompt
    ]
  };
  const forgedCompactProfilePlan = {
    ...plan,
    args: [
      ...plan.args.slice(0, -1),
      "--profile",
      "safe-profile",
      "-punsafe-profile",
      plan.prompt
    ]
  };

  assert.ok(validateCodexCliExecPlanForRun(forgedSandboxPlan).some((reason) => (
    reason.includes("codex_cli_duplicate_security_arg:sandbox")
  )));
  assert.ok(validateCodexCliExecPlanForRun(forgedApprovalPlan).some((reason) => (
    reason.includes("codex_cli_duplicate_security_arg:approval")
  )));
  assert.ok(validateCodexCliExecPlanForRun(forgedWorkdirPlan).some((reason) => (
    reason.includes("codex_cli_duplicate_security_arg:workdir")
  )));
  assert.ok(validateCodexCliExecPlanForRun(forgedCwdPlan).some((reason) => (
    reason.includes("codex_cli_duplicate_security_arg:workdir")
  )));
  assert.ok(validateCodexCliExecPlanForRun(forgedCompactSandboxPlan).some((reason) => (
    reason.includes("codex_cli_duplicate_security_arg:sandbox")
  )));
  assert.ok(validateCodexCliExecPlanForRun(forgedCompactModelPlan).some((reason) => (
    reason.includes("codex_cli_duplicate_security_arg:model")
  )));
  assert.ok(validateCodexCliExecPlanForRun(forgedCompactProfilePlan).some((reason) => (
    reason.includes("codex_cli_duplicate_security_arg:profile")
  )));
  await assert.rejects(
    () => runCodexCliExecPlan(forgedSandboxPlan, {
      spawn: () => createFakeCodexCliChild({
        stdout: "",
        exitCode: 0
      })
    }),
    /codex_cli_duplicate_security_arg/
  );
});

test("codex cli host runner rejects forged workspace root argv", async () => {
  const task = {
    taskId: "cli-runner-forged-workspace-root",
    source: "cli" as const,
    intent: {
      summary: "inspect",
      requestedAction: "inspect",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: {
      repoRoot: "A:/codex-router"
    },
    target: {
      branches: [],
      files: [],
      modules: []
    },
    constraints: {},
    hints: {
      taskClassHint: "read_only" as const,
      riskHints: [],
      tags: []
    }
  };
  const plan = createCodexCliExecPlan(task);
  const workdirIndex = plan.args.indexOf("--cd") + 1;
  const forgedWorkdirValuePlan = {
    ...plan,
    args: plan.args.map((arg, index) => (
      index === workdirIndex ? "A:/other" : arg
    ))
  };

  assert.ok(validateCodexCliExecPlanForRun(forgedWorkdirValuePlan).includes(
    "codex_cli_workdir_arg_mismatch:A:/other:A:/codex-router"
  ));
  await assert.rejects(
    () => runCodexCliExecPlan(forgedWorkdirValuePlan, {
      spawn: () => createFakeCodexCliChild({
        stdout: "",
        exitCode: 0
      })
    }),
    /codex_cli_workdir_arg_mismatch/
  );

  const forgedInlineWorkdirPlan = {
    ...plan,
    args: plan.args.map((arg) => (
      arg === "--cd" ? "--cd=A:/other" : arg
    )).filter((arg) => arg !== "A:/codex-router")
  };
  const forgedInlineCwdPlan = {
    ...plan,
    args: plan.args.map((arg) => (
      arg === "--cd" ? "--cwd=A:/other" : arg
    )).filter((arg) => arg !== "A:/codex-router")
  };
  const forgedCompactWorkdirPlan = {
    ...plan,
    args: plan.args.map((arg) => (
      arg === "--cd" ? "-CA:/other" : arg
    )).filter((arg) => arg !== "A:/codex-router")
  };

  assert.ok(validateCodexCliExecPlanForRun(forgedInlineWorkdirPlan).includes(
    "codex_cli_workdir_arg_mismatch:A:/other:A:/codex-router"
  ));
  assert.ok(validateCodexCliExecPlanForRun(forgedInlineCwdPlan).includes(
    "codex_cli_workdir_arg_mismatch:A:/other:A:/codex-router"
  ));
  assert.ok(validateCodexCliExecPlanForRun(forgedCompactWorkdirPlan).includes(
    "codex_cli_workdir_arg_mismatch:A:/other:A:/codex-router"
  ));

  assert.throws(
    () => createCodexCliExecPlan(task, {
      extraArgs: ["--add-dir", "A:/other"]
    }),
    /codex_cli_workspace_expansion_arg_not_allowed:--add-dir/
  );
  assert.throws(
    () => createCodexCliExecPlan(task, {
      extraArgs: ["--cwd", "A:/other"]
    }),
    /codex_cli_duplicate_security_arg:workdir/
  );

  const forgedAddDirPlan = {
    ...plan,
    args: [
      ...plan.args.slice(0, -1),
      "--add-dir=A:/other",
      plan.prompt
    ]
  };

  assert.ok(validateCodexCliExecPlanForRun(forgedAddDirPlan).includes(
    "codex_cli_workspace_expansion_arg_not_allowed:--add-dir=A:/other"
  ));
  await assert.rejects(
    () => runCodexCliExecPlan(forgedAddDirPlan, {
      spawn: () => createFakeCodexCliChild({
        stdout: "",
        exitCode: 0
      })
    }),
    /codex_cli_workspace_expansion_arg_not_allowed/
  );
});

test("codex cli host runner rejects forged policy bypass argv", async () => {
  const plan = createCodexCliExecPlan({
    taskId: "cli-runner-forged-policy-bypass",
    source: "cli",
    intent: {
      summary: "inspect",
      requestedAction: "inspect",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: {
      repoRoot: "A:/codex-router"
    },
    target: {
      branches: [],
      files: [],
      modules: []
    },
    constraints: {},
    hints: {
      taskClassHint: "read_only",
      riskHints: [],
      tags: []
    }
  });
  const forgedPlan = {
    ...plan,
    args: [...plan.args, "--ignore-rules"]
  };

  assert.ok(validateCodexCliExecPlanForRun(forgedPlan).includes(
    "codex_cli_policy_bypass_arg_not_allowed:--ignore-rules"
  ));
  await assert.rejects(
    () => runCodexCliExecPlan(forgedPlan, {
      spawn: () => createFakeCodexCliChild({
        stdout: "",
        exitCode: 0
      })
    }),
    /codex_cli_policy_bypass_arg_not_allowed:--ignore-rules/
  );
});

test("codex cli host runner rejects forged provider override argv", async () => {
  const task = {
    taskId: "cli-runner-forged-provider-override",
    source: "cli" as const,
    intent: {
      summary: "inspect",
      requestedAction: "inspect",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: {
      repoRoot: "A:/codex-router"
    },
    target: {
      branches: [],
      files: [],
      modules: []
    },
    constraints: {},
    hints: {
      taskClassHint: "read_only" as const,
      riskHints: [],
      tags: []
    }
  };
  const plan = createCodexCliExecPlan(task);
  const forgedOssPlan = {
    ...plan,
    args: [
      ...plan.args.slice(0, -1),
      "--oss",
      plan.prompt
    ]
  };
  const forgedLocalProviderPlan = {
    ...plan,
    args: [
      ...plan.args.slice(0, -1),
      "--local-provider=ollama",
      plan.prompt
    ]
  };

  assert.throws(
    () => createCodexCliExecPlan(task, {
      extraArgs: ["--local-provider", "lmstudio"]
    }),
    /codex_cli_provider_override_arg_not_allowed:--local-provider/
  );
  assert.ok(validateCodexCliExecPlanForRun(forgedOssPlan).includes(
    "codex_cli_provider_override_arg_not_allowed:--oss"
  ));
  assert.ok(validateCodexCliExecPlanForRun(forgedLocalProviderPlan).includes(
    "codex_cli_provider_override_arg_not_allowed:--local-provider=ollama"
  ));
  await assert.rejects(
    () => runCodexCliExecPlan(forgedOssPlan, {
      spawn: () => createFakeCodexCliChild({
        stdout: "",
        exitCode: 0
      })
    }),
    /codex_cli_provider_override_arg_not_allowed:--oss/
  );
});

test("codex cli host runner rejects forged output write argv", async () => {
  const task = {
    taskId: "cli-runner-forged-output-write",
    source: "cli" as const,
    intent: {
      summary: "inspect",
      requestedAction: "inspect",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: {
      repoRoot: "A:/codex-router"
    },
    target: {
      branches: [],
      files: [],
      modules: []
    },
    constraints: {},
    hints: {
      taskClassHint: "read_only" as const,
      riskHints: [],
      tags: []
    }
  };
  const plan = createCodexCliExecPlan(task);
  const forgedLongOutputPlan = {
    ...plan,
    args: [
      ...plan.args.slice(0, -1),
      "--output-last-message=A:/other/result.txt",
      plan.prompt
    ]
  };
  const forgedCompactOutputPlan = {
    ...plan,
    args: [
      ...plan.args.slice(0, -1),
      "-oA:/other/result.txt",
      plan.prompt
    ]
  };

  assert.throws(
    () => createCodexCliExecPlan(task, {
      extraArgs: ["--output-last-message", "A:/other/result.txt"]
    }),
    /codex_cli_output_write_arg_not_allowed:--output-last-message/
  );
  assert.ok(validateCodexCliExecPlanForRun(forgedLongOutputPlan).includes(
    "codex_cli_output_write_arg_not_allowed:--output-last-message=A:/other/result.txt"
  ));
  assert.ok(validateCodexCliExecPlanForRun(forgedCompactOutputPlan).includes(
    "codex_cli_output_write_arg_not_allowed:-oA:/other/result.txt"
  ));
  await assert.rejects(
    () => runCodexCliExecPlan(forgedLongOutputPlan, {
      spawn: () => createFakeCodexCliChild({
        stdout: "",
        exitCode: 0
      })
    }),
    /codex_cli_output_write_arg_not_allowed:--output-last-message/
  );
});

test("codex cli host runner rejects forged output schema argv", async () => {
  const task = {
    taskId: "cli-runner-forged-output-schema",
    source: "cli" as const,
    intent: {
      summary: "inspect",
      requestedAction: "inspect",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: {
      repoRoot: "A:/codex-router"
    },
    target: {
      branches: [],
      files: [],
      modules: []
    },
    constraints: {},
    hints: {
      taskClassHint: "read_only" as const,
      riskHints: [],
      tags: []
    }
  };
  const plan = createCodexCliExecPlan(task);
  const forgedOutputSchemaPlan = {
    ...plan,
    args: [
      ...plan.args.slice(0, -1),
      "--output-schema=A:/outside/schema.json",
      plan.prompt
    ]
  };

  assert.throws(
    () => createCodexCliExecPlan(task, {
      extraArgs: ["--output-schema", "A:/outside/schema.json"]
    }),
    /codex_cli_output_schema_arg_not_allowed:--output-schema/
  );
  assert.ok(validateCodexCliExecPlanForRun(forgedOutputSchemaPlan).includes(
    "codex_cli_output_schema_arg_not_allowed:--output-schema=A:/outside/schema.json"
  ));
  await assert.rejects(
    () => runCodexCliExecPlan(forgedOutputSchemaPlan, {
      spawn: () => createFakeCodexCliChild({
        stdout: "",
        exitCode: 0
      })
    }),
    /codex_cli_output_schema_arg_not_allowed:--output-schema/
  );
});

test("codex cli host runner rejects forged image attachment argv", async () => {
  const task = {
    taskId: "cli-runner-forged-image-attachment",
    source: "cli" as const,
    intent: {
      summary: "inspect",
      requestedAction: "inspect",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: {
      repoRoot: "A:/codex-router"
    },
    target: {
      branches: [],
      files: [],
      modules: []
    },
    constraints: {},
    hints: {
      taskClassHint: "read_only" as const,
      riskHints: [],
      tags: []
    }
  };
  const plan = createCodexCliExecPlan(task);
  const forgedLongImagePlan = {
    ...plan,
    args: [
      ...plan.args.slice(0, -1),
      "--image=A:/outside/secret.png",
      plan.prompt
    ]
  };
  const forgedCompactImagePlan = {
    ...plan,
    args: [
      ...plan.args.slice(0, -1),
      "-iA:/outside/secret.png",
      plan.prompt
    ]
  };
  const forgedImagesPlan = {
    ...plan,
    args: [
      ...plan.args.slice(0, -1),
      "--images=A:/outside/secret.png",
      plan.prompt
    ]
  };

  assert.throws(
    () => createCodexCliExecPlan(task, {
      extraArgs: ["--image", "A:/outside/secret.png"]
    }),
    /codex_cli_image_attachment_arg_not_allowed:--image/
  );
  assert.throws(
    () => createCodexCliExecPlan(task, {
      extraArgs: ["--images", "A:/outside/secret.png"]
    }),
    /codex_cli_image_attachment_arg_not_allowed:--images/
  );
  assert.ok(validateCodexCliExecPlanForRun(forgedLongImagePlan).includes(
    "codex_cli_image_attachment_arg_not_allowed:--image=A:/outside/secret.png"
  ));
  assert.ok(validateCodexCliExecPlanForRun(forgedCompactImagePlan).includes(
    "codex_cli_image_attachment_arg_not_allowed:-iA:/outside/secret.png"
  ));
  assert.ok(validateCodexCliExecPlanForRun(forgedImagesPlan).includes(
    "codex_cli_image_attachment_arg_not_allowed:--images=A:/outside/secret.png"
  ));
  await assert.rejects(
    () => runCodexCliExecPlan(forgedLongImagePlan, {
      spawn: () => createFakeCodexCliChild({
        stdout: "",
        exitCode: 0
      })
    }),
    /codex_cli_image_attachment_arg_not_allowed:--image/
  );
  await assert.rejects(
    () => runCodexCliExecPlan(forgedImagesPlan, {
      spawn: () => createFakeCodexCliChild({
        stdout: "",
        exitCode: 0
      })
    }),
    /codex_cli_image_attachment_arg_not_allowed:--images/
  );
});

test("codex cli host runner rejects forged exec subcommand argv", async () => {
  const task = {
    taskId: "cli-runner-forged-exec-subcommand",
    source: "cli" as const,
    intent: {
      summary: "inspect",
      requestedAction: "inspect",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: {
      repoRoot: "A:/codex-router"
    },
    target: {
      branches: [],
      files: [],
      modules: []
    },
    constraints: {},
    hints: {
      taskClassHint: "read_only" as const,
      riskHints: [],
      tags: []
    }
  };
  const plan = createCodexCliExecPlan(task);
  const forgedResumePlan = {
    ...plan,
    args: [
      ...plan.args.slice(0, -1),
      "resume",
      "--last",
      "--all",
      plan.prompt
    ]
  };
  const forgedReviewPlan = {
    ...plan,
    args: [
      ...plan.args.slice(0, -1),
      "review",
      "--uncommitted",
      plan.prompt
    ]
  };
  const forgedPostPromptResumePlan = {
    ...plan,
    args: [
      ...plan.args,
      "resume",
      "--last",
      "--all"
    ]
  };

  assert.throws(
    () => createCodexCliExecPlan(task, {
      extraArgs: ["resume", "--last", "--all"]
    }),
    /codex_cli_exec_subcommand_arg_not_allowed:resume/
  );
  assert.throws(
    () => createCodexCliExecPlan(task, {
      extraArgs: ["review", "--uncommitted"]
    }),
    /codex_cli_exec_subcommand_arg_not_allowed:review/
  );
  assert.ok(validateCodexCliExecPlanForRun(forgedResumePlan).includes(
    "codex_cli_exec_subcommand_arg_not_allowed:resume"
  ));
  assert.ok(validateCodexCliExecPlanForRun(forgedReviewPlan).includes(
    "codex_cli_exec_subcommand_arg_not_allowed:review"
  ));
  assert.ok(validateCodexCliExecPlanForRun(forgedPostPromptResumePlan).includes(
    "codex_cli_exec_subcommand_arg_not_allowed:resume"
  ));
  await assert.rejects(
    () => runCodexCliExecPlan(forgedReviewPlan, {
      spawn: () => createFakeCodexCliChild({
        stdout: "",
        exitCode: 0
      })
    }),
    /codex_cli_exec_subcommand_arg_not_allowed:review/
  );
  await assert.rejects(
    () => runCodexCliExecPlan(forgedPostPromptResumePlan, {
      spawn: () => createFakeCodexCliChild({
        stdout: "",
        exitCode: 0
      })
    }),
    /codex_cli_exec_subcommand_arg_not_allowed:resume/
  );
});

test("codex cli host runner allows repeated non-governed config overrides", async () => {
  const plan = createCodexCliExecPlan({
    taskId: "cli-runner-repeated-non-governed-config",
    source: "cli",
    intent: {
      summary: "inspect",
      requestedAction: "inspect",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: {
      repoRoot: "A:/codex-router"
    },
    target: {
      branches: [],
      files: [],
      modules: []
    },
    constraints: {},
    hints: {
      taskClassHint: "read_only",
      riskHints: [],
      tags: []
    }
  }, {
    configOverrides: ["telemetry.enabled=false", "history.persistence=none"]
  });

  assert.deepEqual(
    validateCodexCliExecPlanForRun(plan),
    []
  );
  const result = await runCodexCliExecPlan(plan, {
    spawn: () => createFakeCodexCliChild({
      stdout: "{\"type\":\"agent_message\",\"message\":\"allowed\"}\n",
      exitCode: 0
    })
  });

  assert.equal(result.inspection.status, "completed");
});

test("codex cli host runner rejects governed config overrides", async () => {
  const task = {
    taskId: "cli-runner-governed-config",
    source: "cli" as const,
    intent: {
      summary: "inspect",
      requestedAction: "inspect",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: {
      repoRoot: "A:/codex-router"
    },
    target: {
      branches: [],
      files: [],
      modules: []
    },
    constraints: {},
    hints: {
      taskClassHint: "read_only" as const,
      riskHints: [],
      tags: []
    }
  };

  assert.throws(
    () => createCodexCliExecPlan(task, {
      configOverrides: ["model=gpt-5.3-codex"]
    }),
    /codex_cli_governed_config_override_not_allowed:model/
  );
  assert.throws(
    () => createCodexCliExecPlan(task, {
      configOverrides: ["model_provider=ollama"]
    }),
    /codex_cli_governed_config_override_not_allowed:model_provider/
  );
  assert.throws(
    () => createCodexCliExecPlan(task, {
      configOverrides: ["sandbox_mode=danger-full-access"]
    }),
    /codex_cli_governed_config_override_not_allowed:sandbox_mode/
  );
  assert.throws(
    () => createCodexCliExecPlan(task, {
      configOverrides: ['sandbox_permissions=["disk-full-read-access"]']
    }),
    /codex_cli_governed_config_override_not_allowed:sandbox_permissions/
  );
  assert.throws(
    () => createCodexCliExecPlan(task, {
      configOverrides: ["sandbox_workspace_write.network_access=true"]
    }),
    /codex_cli_governed_config_override_not_allowed:sandbox_workspace_write\.network_access/
  );

  const plan = createCodexCliExecPlan(task);
  const forgedPlan = {
    ...plan,
    args: [
      ...plan.args.slice(0, -1),
      "--config=sandbox.mode=workspace-write",
      plan.prompt
    ]
  };

  assert.ok(validateCodexCliExecPlanForRun(forgedPlan).includes(
    "codex_cli_governed_config_override_not_allowed:sandbox.mode"
  ));
  await assert.rejects(
    () => runCodexCliExecPlan(forgedPlan, {
      spawn: () => createFakeCodexCliChild({
        stdout: "",
        exitCode: 0
      })
    }),
    /codex_cli_governed_config_override_not_allowed:sandbox\.mode/
  );

  const forgedSandboxModePlan = {
    ...plan,
    args: [
      ...plan.args.slice(0, -1),
      "-c",
      "sandbox_mode=danger-full-access",
      plan.prompt
    ]
  };

  assert.ok(validateCodexCliExecPlanForRun(forgedSandboxModePlan).includes(
    "codex_cli_governed_config_override_not_allowed:sandbox_mode"
  ));
  await assert.rejects(
    () => runCodexCliExecPlan(forgedSandboxModePlan, {
      spawn: () => createFakeCodexCliChild({
        stdout: "",
        exitCode: 0
      })
    }),
    /codex_cli_governed_config_override_not_allowed:sandbox_mode/
  );

  const forgedSandboxPermissionsPlan = {
    ...plan,
    args: [
      ...plan.args.slice(0, -1),
      '--config=sandbox_permissions=["disk-full-read-access"]',
      plan.prompt
    ]
  };

  assert.ok(validateCodexCliExecPlanForRun(forgedSandboxPermissionsPlan).includes(
    "codex_cli_governed_config_override_not_allowed:sandbox_permissions"
  ));
  await assert.rejects(
    () => runCodexCliExecPlan(forgedSandboxPermissionsPlan, {
      spawn: () => createFakeCodexCliChild({
        stdout: "",
        exitCode: 0
      })
    }),
    /codex_cli_governed_config_override_not_allowed:sandbox_permissions/
  );

  const forgedModelProviderPlan = {
    ...plan,
    args: [
      ...plan.args.slice(0, -1),
      "--config=model_provider=ollama",
      plan.prompt
    ]
  };
  const forgedSandboxWorkspaceWritePlan = {
    ...plan,
    args: [
      ...plan.args.slice(0, -1),
      "-c",
      "sandbox_workspace_write.network_access=true",
      plan.prompt
    ]
  };

  assert.ok(validateCodexCliExecPlanForRun(forgedModelProviderPlan).includes(
    "codex_cli_governed_config_override_not_allowed:model_provider"
  ));
  assert.ok(validateCodexCliExecPlanForRun(forgedSandboxWorkspaceWritePlan).includes(
    "codex_cli_governed_config_override_not_allowed:sandbox_workspace_write.network_access"
  ));
  await assert.rejects(
    () => runCodexCliExecPlan(forgedModelProviderPlan, {
      spawn: () => createFakeCodexCliChild({
        stdout: "",
        exitCode: 0
      })
    }),
    /codex_cli_governed_config_override_not_allowed:model_provider/
  );

  const forgedCompactConfigPlan = {
    ...plan,
    args: [
      ...plan.args.slice(0, -1),
      '-csandbox_permissions=["disk-full-read-access"]',
      plan.prompt
    ]
  };
  const forgedEqualsCompactConfigPlan = {
    ...plan,
    args: [
      ...plan.args.slice(0, -1),
      "-c=sandbox_mode=workspace-write",
      plan.prompt
    ]
  };

  assert.ok(validateCodexCliExecPlanForRun(forgedCompactConfigPlan).includes(
    "codex_cli_governed_config_override_not_allowed:sandbox_permissions"
  ));
  assert.ok(validateCodexCliExecPlanForRun(forgedEqualsCompactConfigPlan).includes(
    "codex_cli_governed_config_override_not_allowed:sandbox_mode"
  ));
});

test("codex cli host runner reports timeout as failed evidence", async () => {
  const plan = createCodexCliExecPlan({
    taskId: "cli-runner-timeout",
    source: "cli",
    intent: {
      summary: "inspect",
      requestedAction: "inspect",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: {
      repoRoot: "A:/codex-router"
    },
    target: {
      branches: [],
      files: [],
      modules: []
    },
    constraints: {},
    hints: {
      taskClassHint: "read_only",
      riskHints: [],
      tags: []
    }
  });
  const child = createFakeCodexCliChild({
    stdout: "{\"type\":\"agent_message\",\"message\":\"slow\"}\n",
    exitCode: 0,
    autoClose: false
  });

  const result = await runCodexCliExecPlan(plan, {
    timeoutMs: 1,
    spawn: () => child
  });

  assert.equal(result.timedOut, true);
  assert.equal(result.killed, true);
  assert.equal(result.inspection.status, "failed");
  assert.ok(result.inspection.blockingReasons.includes("codex_cli_process_timeout"));
});

test("codex cli host runner force-settles when timed-out child never closes", async () => {
  const plan = createCodexCliExecPlan({
    taskId: "cli-runner-timeout-no-close",
    source: "cli",
    intent: {
      summary: "inspect",
      requestedAction: "inspect",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: {
      repoRoot: "A:/codex-router"
    },
    target: {
      branches: [],
      files: [],
      modules: []
    },
    constraints: {},
    hints: {
      taskClassHint: "read_only",
      riskHints: [],
      tags: []
    }
  });
  const child = createFakeCodexCliChild({
    stdout: "{\"type\":\"agent_message\",\"message\":\"slow\"}\n",
    exitCode: 0,
    autoClose: false,
    closeOnKill: false
  });

  const result = await runCodexCliExecPlan(plan, {
    timeoutMs: 1,
    terminationGraceMs: 1,
    spawn: () => child
  });

  assert.equal(result.timedOut, true);
  assert.equal(result.killed, true);
  assert.equal(result.inspection.status, "failed");
  assert.equal(result.lifecycle.stdin.closed, true);
  assert.equal(result.lifecycle.stdin.destroyed, true);
  assert.equal(result.lifecycle.termination.closeReceived, false);
  assert.equal(result.lifecycle.termination.forcedSettled, true);
  assert.equal(result.lifecycle.termination.stdioDestroyed, true);
  assert.equal(result.lifecycle.termination.unrefCalled, true);
  assert.equal(result.lifecycle.termination.escalated, true);
  assert.equal(result.lifecycle.termination.escalationKilled, true);
  assert.equal(result.lifecycle.termination.graceMs, 1);
  assert.ok(result.output.stderr?.includes("codex_cli_process_forced_settle_after_timeout"));
  assert.ok(result.inspection.blockingReasons.includes("codex_cli_process_timeout"));
});

test("codex cli read-only smoke creates a fixed safe task envelope", () => {
  const task = createCodexCliReadOnlySmokeTask({
    taskId: "cli-smoke-safe",
    repoRoot: "A:/codex-router",
    branch: "main"
  });

  assert.equal(task.taskId, "cli-smoke-safe");
  assert.equal(task.source, "cli");
  assert.equal(task.repoContext?.repoRoot, "A:/codex-router");
  assert.equal(task.repoContext?.branch, "main");
  assert.equal(task.hints?.taskClassHint, "read_only");
  assert.deepEqual(task.hints?.tags, ["codex-cli-host-smoke", "read-only"]);
  assert.ok(task.intent.outOfScope?.includes("workspace-write sandbox"));
  assert.deepEqual(task.target?.modules, ["codex-cli-host"]);
});

test("codex cli read-only smoke runs through guarded runner and captures evidence", async () => {
  const calls: Array<{ command: string; args: string[]; cwd?: string }> = [];
  const spawner: CodexCliProcessSpawner = (command, args, options) => {
    calls.push({
      command,
      args,
      ...(options.cwd ? { cwd: options.cwd } : {})
    });

    return createFakeCodexCliChild({
      stdout: `{"type":"agent_message","message":"${CODEX_CLI_READONLY_SMOKE_OK}"}\n`,
      stderr: "WARNING: diagnostic only\n",
      exitCode: 0
    });
  };

  const result = await runCodexCliReadOnlySmoke({
    taskOptions: {
      taskId: "cli-smoke-readonly",
      repoRoot: "A:/codex-router"
    },
    spawn: spawner
  });
  const evidence = createCodexCliReadOnlySmokeEvidence(result, {
    generatedAt: "2026-04-25T12:30:00.000Z",
    notes: ["fake spawner validation"]
  });

  assert.equal(result.status, "passed");
  if (process.platform === "win32") {
    assert.match(calls[0]?.command ?? "", /codex\.exe$/i);
  } else {
    assert.equal(calls[0]?.command, "codex");
  }
  assert.equal(result.plan.sandbox, "read-only");
  assert.equal(result.plan.approvalPolicy, "never");
  assert.deepEqual(result.plan.args.slice(0, 4), [
    "-a",
    "never",
    "exec",
    "--json"
  ]);
  assert.equal(result.plan.args.includes("--skip-git-repo-check"), true);
  assert.equal(result.plan.args.includes("--ephemeral"), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.cwd, "A:/codex-router");
  assert.equal(calls[0]?.args.includes("workspace-write"), false);
  assert.equal(result.plan.prompt.includes("Task envelope"), false);
  assert.equal(result.plan.prompt.includes("requestedAction"), false);
  assert.ok(result.plan.prompt.includes(CODEX_CLI_READONLY_SMOKE_OK));
  assert.ok(result.plan.prompt.includes("Do not run shell commands"));

  assert.equal(evidence.schemaVersion, "codex-cli-readonly-smoke-evidence.v1");
  assert.equal(evidence.status, "passed");
  assert.equal(evidence.taskId, "cli-smoke-readonly");
  assert.equal(evidence.plan.usesJson, true);
  assert.equal(evidence.plan.skipGitRepoCheck, true);
  assert.equal(evidence.plan.ephemeral, true);
  assert.equal(evidence.run.eventCount, 1);
  assert.deepEqual(evidence.summary.warnings, ["WARNING: diagnostic only"]);
  assert.deepEqual(evidence.notes, ["fake spawner validation"]);
  assert.equal("prompt" in evidence.plan, false);
  assert.equal(result.governance?.observation.status, "succeeded");
  assert.equal(result.governance?.strategy.action, "continue");
  assert.equal(result.governance?.ledgerEntry.schemaVersion, "codex-cli-checkpoint-ledger-entry.v2");
  assert.equal(evidence.governance?.schemaVersion, "codex-cli-governance-evidence-summary.v1");
  assert.equal(evidence.governance?.observationStatus, "succeeded");
  assert.equal(evidence.governance?.anomalyCount, 0);
});

test("codex cli read-only smoke fails on unexpected response even when process succeeds", async () => {
  const result = await runCodexCliReadOnlySmoke({
    spawn: () => createFakeCodexCliChild({
      stdout: "{\"type\":\"agent_message\",\"message\":\"read-only ok\"}\n",
      exitCode: 0
    })
  });
  const evidence = createCodexCliReadOnlySmokeEvidence(result, {
    generatedAt: "2026-04-25T14:10:00.000Z"
  });

  assert.equal(result.status, "failed");
  assert.deepEqual(result.run?.inspection.blockingReasons, [
    "codex_cli_readonly_smoke_unexpected_response"
  ]);
  assert.equal(result.governance?.observation.stage, "read-only-smoke-semantic-validation");
  assert.equal(result.governance?.observation.status, "failed");
  assert.equal(result.governance?.state.anomalies.count, 1);
  assert.deepEqual(result.governance?.state.anomalies.entries.at(-1)?.reasons, [
    "codex_cli_readonly_smoke_unexpected_response"
  ]);
  assert.equal(evidence.governance?.observationStatus, "failed");
  assert.equal(evidence.governance?.anomalyCount, 1);
});

test("codex cli read-only smoke fails if the model tries to use commands", async () => {
  const result = await runCodexCliReadOnlySmoke({
    spawn: () => createFakeCodexCliChild({
      stdout: [
        "{\"type\":\"item.completed\",\"item\":{\"id\":\"item_1\",\"type\":\"command_execution\"}}",
        `{"type":"item.completed","item":{"id":"item_2","type":"agent_message","text":"${CODEX_CLI_READONLY_SMOKE_OK}"}}`
      ].join("\n") + "\n",
      exitCode: 0
    })
  });

  assert.equal(result.status, "failed");
  assert.ok(result.run?.inspection.blockingReasons.includes(
    "codex_cli_readonly_smoke_unexpected_tool_use:command_execution"
  ));
  assert.equal(result.governance?.observation.stage, "read-only-smoke-semantic-validation");
  assert.equal(result.governance?.observation.status, "failed");
  assert.ok(result.governance?.observation.blockingReasons.includes(
    "codex_cli_readonly_smoke_unexpected_tool_use:command_execution"
  ));
});

test("codex cli read-only smoke forwards telemetryStore into probe cache telemetry", async () => {
  const telemetryStore = createRecordingTelemetrySink();
  let calls = 0;

  const spawner: CodexCliProcessSpawner = () => {
    calls += 1;
    return createFakeCodexCliChild({
      stdout: calls === 1
        ? "{\"type\":\"agent_message\",\"message\":\"CODEX_CLI_MODEL_PROBE_OK\"}\n"
        : `{"type":"agent_message","message":"${CODEX_CLI_READONLY_SMOKE_OK}"}\n`,
      exitCode: 0
    });
  };

  const first = await runCodexCliReadOnlySmoke({
    telemetryStore,
    planOptions: {
      model: "gpt-5.4-mini"
    },
    spawn: spawner
  });
  const second = await runCodexCliReadOnlySmoke({
    telemetryStore,
    planOptions: {
      model: "gpt-5.4-mini"
    },
    spawn: spawner
  });
  const telemetryEvents = await telemetryStore.loadAll();

  assert.equal(first.status, "passed");
  assert.equal(second.status, "passed");
  assert.equal(calls, 3);
  assert.equal(
    telemetryEvents.some((event) => event.message === "codex cli model probe cache miss"),
    true
  );
  assert.equal(
    telemetryEvents.some((event) => event.message === "codex cli model probe cache hit"),
    true
  );
});

test("codex cli read-only smoke evidence records validation blockers without running", async () => {
  let didSpawn = false;
  const result = await runCodexCliReadOnlySmoke({
    task: {
      ...createCodexCliReadOnlySmokeTask(),
      repoContext: {}
    },
    planOptions: {
      codexCommand: "   "
    },
    spawn: () => {
      didSpawn = true;
      return createFakeCodexCliChild({
        stdout: "",
        exitCode: 0
      });
    }
  });
  const evidence = createCodexCliReadOnlySmokeEvidence(result, {
    generatedAt: "2026-04-25T12:31:00.000Z"
  });

  assert.equal(didSpawn, false);
  assert.equal(result.status, "failed");
  assert.ok(result.validationBlockers.includes("codex_cli_command_missing"));
  assert.equal(evidence.status, "failed");
  assert.deepEqual(evidence.run.blockingReasons, ["codex_cli_command_missing"]);
  assert.deepEqual(evidence.summary.blockingReasons, ["codex_cli_command_missing"]);
});

test("codex cli read-only smoke evidence mirrors process errors into run blockers", () => {
  const task = parseTaskEnvelope(createCodexCliReadOnlySmokeTask({
    taskId: "cli-smoke-process-error"
  }));
  const plan = createCodexCliExecPlan(task, {
    sandbox: "read-only",
    approvalPolicy: "never"
  });
  const evidence = createCodexCliReadOnlySmokeEvidence({
    status: "failed",
    task,
    plan,
    validationBlockers: [],
    error: "spawn EPERM"
  });

  assert.deepEqual(evidence.run.blockingReasons, [
    "codex_cli_process_error:spawn EPERM"
  ]);
  assert.deepEqual(evidence.summary.blockingReasons, [
    "codex_cli_process_error:spawn EPERM"
  ]);
});

test("codex cli read-only smoke evidence can be written to disk without raw prompt", async () => {
  const dir = await mkdtemp(join(tmpdir(), "codex-cli-smoke-"));
  const path = join(dir, "nested", "evidence.json");
  const result = await runCodexCliReadOnlySmoke({
    taskOptions: {
      taskId: "cli-smoke-write-file"
    },
    spawn: () => createFakeCodexCliChild({
      stdout: `{"type":"agent_message","message":"${CODEX_CLI_READONLY_SMOKE_OK}"}\n`,
      exitCode: 0
    })
  });
  const evidence = createCodexCliReadOnlySmokeEvidence(result, {
    generatedAt: "2026-04-25T12:40:00.000Z"
  });

  const write = await writeCodexCliReadOnlySmokeEvidenceFile(evidence, path);
  const written = JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;

  assert.equal(write.path, path);
  assert.ok(write.bytes > 0);
  assert.equal(written.schemaVersion, "codex-cli-readonly-smoke-evidence.v1");
  assert.equal(written.status, "passed");
  assert.equal("prompt" in (written.plan as Record<string, unknown>), false);
  assert.equal("args" in (written.plan as Record<string, unknown>), false);
});

test("codex cli read-only smoke run-and-write persists failed validation evidence without spawning", async () => {
  const dir = await mkdtemp(join(tmpdir(), "codex-cli-smoke-"));
  const path = join(dir, "failed", "evidence.json");
  let didSpawn = false;

  const persisted = await runAndWriteCodexCliReadOnlySmokeEvidence({
    evidencePath: path,
    task: {
      ...createCodexCliReadOnlySmokeTask({
        taskId: "cli-smoke-persist-failed"
      }),
      repoContext: {}
    },
    planOptions: {
      codexCommand: "   "
    },
    evidenceOptions: {
      generatedAt: "2026-04-25T12:41:00.000Z",
      notes: ["failed pre-run validation"]
    },
    spawn: () => {
      didSpawn = true;
      return createFakeCodexCliChild({
        stdout: "",
        exitCode: 0
      });
    }
  });
  const written = JSON.parse(await readFile(path, "utf8")) as {
    status: string;
    summary: { blockingReasons: string[] };
    notes: string[];
  };

  assert.equal(didSpawn, false);
  assert.equal(persisted.result.status, "failed");
  assert.equal(persisted.evidence.status, "failed");
  assert.equal(persisted.write.path, path);
  assert.deepEqual(written.summary.blockingReasons, ["codex_cli_command_missing"]);
  assert.deepEqual(written.notes, ["failed pre-run validation"]);
});

test("codex cli workspace-write smoke task is bounded to one local evidence file", () => {
  const task = createCodexCliWorkspaceWriteSmokeTask({
    taskId: "cli-write-smoke-task",
    repoRoot: "A:/codex-router",
    file: "docs/evidence/write-smoke.txt"
  });

  assert.equal(task.taskId, "cli-write-smoke-task");
  assert.equal(task.source, "cli");
  assert.equal(task.hints?.taskClassHint, "small_edit");
  assert.deepEqual(task.hints?.riskHints, ["workspace-write"]);
  assert.deepEqual(task.target?.files, ["docs/evidence/write-smoke.txt"]);
  assert.equal(task.constraints?.explicitOwnership, true);
  assert.ok(task.intent.outOfScope?.includes("external writes"));
  assert.ok(task.intent.outOfScope?.includes("secret or env file changes"));
});

test("codex cli workspace-write smoke preflight blocks without explicit allowance and confirmation", () => {
  const preflight = createCodexCliWorkspaceWriteSmokePreflight({
    taskOptions: {
      taskId: "cli-write-smoke-blocked",
      repoRoot: "A:/codex-router"
    }
  });
  const evidence = createCodexCliWorkspaceWriteSmokePreflightEvidence(preflight, {
    generatedAt: "2026-04-25T13:00:00.000Z",
    notes: ["preflight only"]
  });

  assert.equal(preflight.status, "blocked");
  assert.equal(preflight.plan.sandbox, "workspace-write");
  assert.deepEqual(preflight.plan.args.slice(0, 4), [
    "-a",
    "on-request",
    "exec",
    "--json"
  ]);
  assert.ok(preflight.blockingReasons.includes(
    "codex_cli_write_sandbox_requires_explicit_allowance"
  ));
  assert.ok(preflight.blockingReasons.includes(
    "codex_cli_workspace_write_smoke_requires_confirmation"
  ));

  assert.equal(evidence.schemaVersion, "codex-cli-workspace-write-smoke-preflight.v1");
  assert.equal(evidence.status, "blocked");
  assert.equal(evidence.summary.readyToRun, false);
  assert.equal(evidence.requiredConfirmation, CODEX_CLI_WORKSPACE_WRITE_SMOKE_CONFIRMATION);
  assert.equal("prompt" in evidence.plan, false);
  assert.equal("args" in evidence.plan, false);
});

test("codex cli workspace-write smoke preflight becomes ready only with both gates", async () => {
  const dir = await mkdtemp(join(tmpdir(), "codex-cli-write-smoke-"));
  const path = join(dir, "preflight", "evidence.json");
  const preflight = createCodexCliWorkspaceWriteSmokePreflight({
    taskOptions: {
      taskId: "cli-write-smoke-ready",
      repoRoot: "A:/codex-router",
      file: "docs/evidence/codex-cli-workspace-write-smoke.txt"
    },
    allowWriteSandbox: true,
    confirmation: CODEX_CLI_WORKSPACE_WRITE_SMOKE_CONFIRMATION
  });
  const evidence = createCodexCliWorkspaceWriteSmokePreflightEvidence(preflight, {
    generatedAt: "2026-04-25T13:01:00.000Z"
  });

  const write = await writeCodexCliWorkspaceWriteSmokePreflightEvidenceFile(
    evidence,
    path
  );
  const written = JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;

  assert.equal(preflight.status, "ready");
  assert.deepEqual(preflight.blockingReasons, []);
  assert.equal(evidence.summary.readyToRun, true);
  assert.deepEqual(evidence.plan.targetFiles, [
    "docs/evidence/codex-cli-workspace-write-smoke.txt"
  ]);
  assert.equal(write.path, path);
  assert.ok(write.bytes > 0);
  assert.equal(written.status, "ready");
});

test("codex cli workspace-write approval packet summarizes exact gates without raw prompt", async () => {
  const dir = await mkdtemp(join(tmpdir(), "codex-cli-write-approval-"));
  const path = join(dir, "approval", "packet.json");
  const preflight = createCodexCliWorkspaceWriteSmokePreflight({
    taskOptions: {
      taskId: "cli-write-smoke-approval",
      repoRoot: "A:/codex-router"
    }
  });
  const packet = createCodexCliWorkspaceWriteSmokeApprovalPacket(preflight, {
    generatedAt: "2026-04-25T13:20:00.000Z",
    host: "Codex CLI native 0.125.0",
    repoState: {
      isGitRepository: false,
      worktree: "not_git_repository"
    },
    notes: ["approval packet only"]
  });

  const write = await writeCodexCliWorkspaceWriteSmokeApprovalPacketFile(
    packet,
    path
  );
  const written = JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;

  assert.equal(packet.schemaVersion, "codex-cli-workspace-write-smoke-approval-packet.v1");
  assert.equal(packet.status, "blocked");
  assert.equal(packet.risk, "medium");
  assert.equal(packet.repoState.isGitRepository, false);
  assert.deepEqual(packet.proposedAction.targetFiles, [
    "docs/evidence/codex-cli-workspace-write-smoke.txt"
  ]);
  assert.match(packet.proposedAction.commandPreview, /workspace-write/);
  assert.match(packet.proposedAction.commandPreview, /<task-envelope-prompt omitted>/);
  assert.doesNotMatch(packet.proposedAction.commandPreview, /Task envelope/);
  assert.equal(
    packet.requiredGates.confirmation,
    CODEX_CLI_WORKSPACE_WRITE_SMOKE_CONFIRMATION
  );
  assert.ok(packet.blockers.includes("codex_cli_write_sandbox_requires_explicit_allowance"));
  assert.ok(packet.rollback.affectedFiles.includes(
    "docs/evidence/codex-cli-workspace-write-smoke.txt"
  ));
  assert.equal(write.path, path);
  assert.ok(write.bytes > 0);
  assert.equal(written.schemaVersion, "codex-cli-workspace-write-smoke-approval-packet.v1");
});

test("codex cli workspace-write smoke runner does not spawn while gates are missing", async () => {
  let didSpawn = false;
  const result = await runCodexCliWorkspaceWriteSmoke({
    taskOptions: {
      taskId: "cli-write-smoke-run-blocked",
      repoRoot: "A:/codex-router"
    },
    spawn: () => {
      didSpawn = true;
      return createFakeCodexCliChild({
        stdout: "",
        exitCode: 0
      });
    }
  });

  assert.equal(didSpawn, false);
  assert.equal(result.status, "blocked");
  assert.equal(result.preflight.status, "blocked");
  assert.ok(result.validationBlockers.includes(
    "codex_cli_write_sandbox_requires_explicit_allowance"
  ));
  assert.ok(result.validationBlockers.includes(
    "codex_cli_workspace_write_smoke_requires_confirmation"
  ));
  assert.equal(result.governance?.observation.status, "blocked");
  assert.equal(result.governance?.observation.signals.sandboxBlocked, true);
  assert.equal(result.governance?.observation.signals.writeSandboxRequested, true);
  assert.equal(result.governance?.state.anomalies.count, 1);
  assert.equal(result.governance?.strategy.action, "verify");
});

test("codex cli workspace-write smoke runner executes only after both gates", async () => {
  const calls: Array<{ command: string; args: string[]; cwd?: string; stdio?: unknown }> = [];
  let child: FakeCodexCliChild | undefined;
  const spawner: CodexCliProcessSpawner = (command, args, options) => {
    calls.push({
      command,
      args,
      ...(options.cwd ? { cwd: options.cwd } : {}),
      stdio: options.stdio
    });

    child = createFakeCodexCliChild({
      stdout: "{\"type\":\"agent_message\",\"message\":\"workspace-write ok\"}\n",
      exitCode: 0
    });
    return child;
  };

  const result = await runCodexCliWorkspaceWriteSmoke({
    taskOptions: {
      taskId: "cli-write-smoke-run-ready",
      repoRoot: "A:/codex-router"
    },
    allowWriteSandbox: true,
    confirmation: CODEX_CLI_WORKSPACE_WRITE_SMOKE_CONFIRMATION,
    spawn: spawner
  });

  assert.equal(result.status, "passed");
  assert.equal(result.preflight.status, "ready");
  assert.deepEqual(result.validationBlockers, []);
  assert.equal(calls.length, 1);
  if (process.platform === "win32") {
    assert.match(calls[0]?.command ?? "", /codex\.exe$/i);
  } else {
    assert.equal(calls[0]?.command, "codex");
  }
  assert.equal(calls[0]?.cwd, "A:/codex-router");
  assert.deepEqual(calls[0]?.stdio, ["pipe", "pipe", "pipe"]);
  assert.deepEqual(calls[0]?.args.slice(0, 6), [
    "-a",
    "on-request",
    "exec",
    "--json",
    "--sandbox",
    "workspace-write"
  ]);
  assert.equal(result.run?.inspection.status, "completed");
  assert.equal(result.run?.inspection.events.length, 1);
  assert.equal(child?.stdin.ended, true);
  assert.equal(child?.stdin.destroyed, true);
  assert.equal(result.run?.lifecycle.stdin.closed, true);
  assert.equal(result.run?.lifecycle.stdin.destroyed, true);
  assert.equal(result.governance?.observation.status, "succeeded");
  assert.equal(result.governance?.strategy.writeSandboxAllowed, true);
});

test("codex cli governance forces step-back after three anomalies and blocks write sandbox", async () => {
  const task = parseTaskEnvelope(createCodexCliWorkspaceWriteSmokeTask({
    taskId: "cli-governance-three-strike",
    repoRoot: "A:/codex-router"
  }));
  const plan = createCodexCliExecPlan(task, {
    codexCommand: "codex",
    sandbox: "workspace-write",
    approvalPolicy: "on-request",
    skipGitRepoCheck: true,
    ephemeral: true
  });
  const first = createCodexCliGovernanceBundle({
    task,
    plan,
    stage: "attempt-1",
    status: "failed",
    blockingReasons: ["codex_cli_process_timeout"],
    timedOut: true,
    now: () => "2026-04-27T01:00:00.000Z"
  });
  const second = createCodexCliGovernanceBundle({
    task,
    plan,
    stage: "attempt-2",
    status: "failed",
    blockingReasons: ["codex_cli_process_timeout"],
    timedOut: true,
    previousState: first.state,
    now: () => "2026-04-27T01:01:00.000Z"
  });
  const third = createCodexCliGovernanceBundle({
    task,
    plan,
    stage: "attempt-3",
    status: "failed",
    blockingReasons: ["codex_cli_process_timeout"],
    timedOut: true,
    previousState: second.state,
    now: () => "2026-04-27T01:02:00.000Z"
  });
  let didSpawn = false;

  assert.equal(first.strategy.action, "verify");
  assert.equal(second.strategy.action, "lockdown");
  assert.equal(second.arbitrationPacket?.trigger, "second_anomaly");
  assert.equal(second.arbitrationPacket?.probabilityPredictionAllowed, false);
  assert.equal(third.strategy.action, "step_back");
  assert.equal(third.strategy.writeSandboxAllowed, false);
  assert.equal(third.arbitrationPacket?.trigger, "third_anomaly");
  assert.equal(third.arbitrationPacket?.probabilityPredictionAllowed, false);

  await assert.rejects(
    () => runCodexCliExecPlan(plan, {
      allowWriteSandbox: true,
      skipExecutionModelProbe: true,
      governance: {
        previousState: third.state
      },
      spawn: () => {
        didSpawn = true;
        return createFakeCodexCliChild({
          stdout: "{\"type\":\"agent_message\",\"message\":\"should not run\"}\n",
          exitCode: 0
        });
      }
    }),
    /codex_cli_governance_step_back_active/
  );
  assert.equal(didSpawn, false);
});

test("codex cli workspace-write smoke runner respects an explicit codex command override", async () => {
  const calls: Array<{ command: string; args: string[]; cwd?: string; stdio?: unknown }> = [];
  const spawner: CodexCliProcessSpawner = (command, args, options) => {
    calls.push({
      command,
      args,
      ...(options.cwd ? { cwd: options.cwd } : {}),
      stdio: options.stdio
    });

    return createFakeCodexCliChild({
      stdout: "{\"type\":\"agent_message\",\"message\":\"workspace-write ok\"}\n",
      exitCode: 0
    });
  };

  const result = await runCodexCliWorkspaceWriteSmoke({
    taskOptions: {
      taskId: "cli-write-smoke-run-custom-command",
      repoRoot: "A:/codex-router"
    },
    planOptions: {
      codexCommand: "custom-codex"
    },
    allowWriteSandbox: true,
    confirmation: CODEX_CLI_WORKSPACE_WRITE_SMOKE_CONFIRMATION,
    spawn: spawner
  });

  assert.equal(result.status, "passed");
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.command, "custom-codex");
  assert.equal(calls[0]?.cwd, "A:/codex-router");
});

test("codex cli workspace-write smoke evidence can be written without raw prompt", async () => {
  const dir = await mkdtemp(join(tmpdir(), "codex-cli-write-evidence-"));
  const path = join(dir, "nested", "evidence.json");
  const result = await runCodexCliWorkspaceWriteSmoke({
    taskOptions: {
      taskId: "cli-write-smoke-evidence"
    }
  });
  const evidence = createCodexCliWorkspaceWriteSmokeEvidence(result, {
    generatedAt: "2026-04-25T13:40:00.000Z"
  });

  const write = await writeCodexCliWorkspaceWriteSmokeEvidenceFile(evidence, path);
  const written = JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;

  assert.equal(write.path, path);
  assert.ok(write.bytes > 0);
  assert.equal(written.schemaVersion, "codex-cli-workspace-write-smoke-evidence.v1");
  assert.equal(written.status, "blocked");
  assert.equal("prompt" in (written.plan as Record<string, unknown>), false);
});

test("codex cli workspace-write run-and-write persists blocked evidence without spawning", async () => {
  const dir = await mkdtemp(join(tmpdir(), "codex-cli-write-persist-"));
  const path = join(dir, "blocked", "evidence.json");
  let didSpawn = false;

  const persisted = await runAndWriteCodexCliWorkspaceWriteSmokeEvidence({
    evidencePath: path,
    taskOptions: {
      taskId: "cli-write-smoke-persist-blocked"
    },
    spawn: () => {
      didSpawn = true;
      return createFakeCodexCliChild({
        stdout: "",
        exitCode: 0
      });
    }
  });
  const written = JSON.parse(await readFile(path, "utf8")) as {
    status: string;
    summary: { blockingReasons: string[] };
  };

  assert.equal(didSpawn, false);
  assert.equal(persisted.result.status, "blocked");
  assert.equal(persisted.evidence.status, "blocked");
  assert.equal(persisted.write.path, path);
  assert.ok(written.summary.blockingReasons.includes(
    "codex_cli_write_sandbox_requires_explicit_allowance"
  ));
});

function getArgValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

class FakeCodexCliStream extends EventEmitter {
  destroyed = false;

  setEncoding(_encoding: BufferEncoding): void {}

  destroy(): void {
    this.destroyed = true;
  }
}

class FakeCodexCliWritableStream {
  ended = false;
  destroyed = false;

  end(): void {
    this.ended = true;
  }

  destroy(): void {
    this.destroyed = true;
  }
}

class FakeCodexCliChild extends EventEmitter {
  readonly stdin = new FakeCodexCliWritableStream();
  readonly stdout = new FakeCodexCliStream();
  readonly stderr = new FakeCodexCliStream();
  unrefCalled = false;
  private readonly closeCode: number;
  private readonly closeSignal: NodeJS.Signals | null;
  private readonly closeOnKill: boolean;

  constructor(
    closeCode: number,
    closeSignal: NodeJS.Signals | null,
    closeOnKill: boolean
  ) {
    super();
    this.closeCode = closeCode;
    this.closeSignal = closeSignal;
    this.closeOnKill = closeOnKill;
  }

  kill(_signal?: NodeJS.Signals | number): boolean {
    if (this.closeOnKill) {
      queueMicrotask(() => {
        this.emit("close", this.closeCode, this.closeSignal);
      });
    }
    return true;
  }

  unref(): void {
    this.unrefCalled = true;
  }
}

function createFakeCodexCliChild(options: {
  stdout: string;
  stderr?: string;
  exitCode: number;
  signal?: NodeJS.Signals | null;
  autoClose?: boolean;
  closeOnKill?: boolean;
}): FakeCodexCliChild {
  const child = new FakeCodexCliChild(
    options.exitCode,
    options.signal ?? null,
    options.closeOnKill ?? true
  );

  if (options.autoClose !== false) {
    queueMicrotask(() => {
      if (options.stdout) {
        child.stdout.emit("data", options.stdout);
      }
      if (options.stderr) {
        child.stderr.emit("data", options.stderr);
      }
      child.emit("close", options.exitCode, options.signal ?? null);
    });
  }

  return child;
}
