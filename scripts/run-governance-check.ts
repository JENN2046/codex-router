#!/usr/bin/env node

import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

export type ValidationTier = "daily" | "pr" | "release";
export type GovernanceCheckCategory = "audit" | "acceptance" | "operator";

export interface CommandSpec {
  id: string;
  command: string;
  args: string[];
  description: string;
}

export interface ValidationTierOptions {
  targetedTests?: readonly string[];
}

export interface GovernanceCheckListOptions {
  includeArchived?: boolean;
}

interface GovernanceCheckDefinition {
  category: GovernanceCheckCategory;
  name: string;
  scriptPath: string;
  listSurface?: "current" | "archive";
}

const VALIDATION_TIERS: readonly ValidationTier[] = ["daily", "pr", "release"];
const GOVERNANCE_CHECK_CATEGORIES: readonly GovernanceCheckCategory[] = [
  "audit",
  "acceptance",
  "operator"
];
const DEFAULT_LIST_SURFACE = "current";

const GOVERNANCE_CHECKS: readonly GovernanceCheckDefinition[] = [
  operatorCheck("default", "scripts/run-codex-cli-operator-acceptance.ts", "archive"),
  operatorCheck("readonly", "scripts/run-codex-cli-operator-acceptance-readonly.ts"),
  operatorCheck("release", "scripts/run-codex-cli-operator-acceptance-release.ts", "archive"),
  operatorCheck("telemetry", "scripts/run-codex-cli-operator-acceptance-telemetry.ts", "archive"),
  acceptanceCheck("readonly-chain", "scripts/run-readonly-control-chain-acceptance.ts"),
  acceptanceCheck("provider-registry", "scripts/run-provider-registry-selection-acceptance.ts", "archive"),
  acceptanceCheck("policy-registry-selection", "scripts/run-policy-registry-selection-acceptance.ts", "archive"),
  acceptanceCheck("real-readonly-dispatch", "scripts/run-real-readonly-dispatch-acceptance.ts", "archive"),
  acceptanceCheck("formal-readonly-integration", "scripts/run-formal-readonly-cli-integration-readiness.ts", "archive"),
  acceptanceCheck("formal-readonly-integration-auth", "scripts/run-formal-readonly-cli-integration-authorization-acceptance.ts", "archive"),
  acceptanceCheck("formal-readonly-provider-integration-taskbook", "scripts/run-formal-readonly-provider-integration-taskbook-acceptance.ts", "archive"),
  acceptanceCheck("formal-readonly-provider-integration", "scripts/run-formal-readonly-provider-integration-acceptance.ts", "archive"),
  acceptanceCheck("formal-readonly-dispatch-boundary", "scripts/run-formal-readonly-dispatch-boundary-acceptance.ts", "archive"),
  acceptanceCheck("real-readonly-smoke-auth", "scripts/run-real-readonly-smoke-authorization-acceptance.ts", "archive"),
  acceptanceCheck("formal-real-readonly-smoke-taskbook", "scripts/run-formal-real-readonly-smoke-taskbook-acceptance.ts", "archive"),
  acceptanceCheck("formal-real-readonly-smoke-pre-execution", "scripts/run-formal-real-readonly-smoke-pre-execution-acceptance.ts", "archive"),
  acceptanceCheck("formal-real-readonly-smoke-execution-auth", "scripts/run-formal-real-readonly-smoke-execution-authorization-acceptance.ts", "archive"),
  acceptanceCheck("formal-real-readonly-smoke-final-preflight", "scripts/run-formal-real-readonly-smoke-final-preflight-acceptance.ts", "archive"),
  acceptanceCheck("workspace-write-governance", "scripts/run-workspace-write-governance-acceptance.ts", "archive"),
  acceptanceCheck("workspace-write-fake-canary", "scripts/run-workspace-write-fake-canary-acceptance.ts", "archive"),
  acceptanceCheck("workspace-write-real-canary-auth", "scripts/run-workspace-write-real-canary-authorization-acceptance.ts", "archive"),
  acceptanceCheck("workspace-write-real-canary-pre-execution", "scripts/run-workspace-write-real-canary-pre-execution-acceptance.ts", "archive"),
  acceptanceCheck("controlled-readonly-provider-execution", "scripts/run-controlled-readonly-provider-execution-acceptance.ts"),
  auditCheck("real-readonly-smoke-local", "scripts/run-real-readonly-smoke-local-closeout-audit.ts", "archive"),
  auditCheck("formal-readonly-integration-local", "scripts/run-formal-readonly-cli-integration-local-closeout-audit.ts", "archive"),
  auditCheck("formal-readonly-provider-integration-local", "scripts/run-formal-readonly-provider-integration-local-closeout-audit.ts", "archive"),
  auditCheck("formal-readonly-dispatch-boundary-local", "scripts/run-formal-readonly-dispatch-boundary-local-closeout-audit.ts", "archive"),
  auditCheck("formal-real-readonly-smoke-local", "scripts/run-formal-real-readonly-smoke-local-closeout-audit.ts", "archive"),
  auditCheck("formal-real-readonly-smoke-execution-local", "scripts/run-formal-real-readonly-smoke-execution-local-closeout-audit.ts", "archive"),
  auditCheck("formal-real-readonly-smoke-receipt-local", "scripts/run-formal-real-readonly-smoke-receipt-local-audit.ts", "archive"),
  auditCheck("formal-real-readonly-smoke-local-rc", "scripts/run-formal-real-readonly-smoke-local-rc-review.ts", "archive"),
  auditCheck("formal-real-readonly-smoke-rc-local-closeout", "scripts/run-formal-real-readonly-smoke-rc-local-closeout-audit.ts", "archive"),
  auditCheck("readonly-real-smoke-chain-index", "scripts/run-readonly-real-smoke-chain-index-audit.ts", "archive"),
  auditCheck("readonly-real-smoke-chain-candidate", "scripts/run-readonly-real-smoke-chain-local-candidate-consistency.ts", "archive"),
  auditCheck("readonly-real-smoke-chain-local-closeout", "scripts/run-readonly-real-smoke-chain-local-closeout-audit.ts", "archive"),
  auditCheck("readonly-formal-integration-matrix", "scripts/run-readonly-formal-integration-readiness-matrix-audit.ts", "archive"),
  auditCheck("readonly-productization-boundary", "scripts/run-readonly-productization-boundary-audit.ts"),
  auditCheck("readonly-productization", "scripts/run-readonly-productization-acceptance.ts", "archive"),
  auditCheck("approval-consumption-dispatch-matrix-boundary", "scripts/run-approval-consumption-dispatch-matrix-boundary-audit.ts"),
  auditCheck("approval-consumption-dispatch-matrix", "scripts/run-approval-consumption-dispatch-matrix-audit.ts", "archive"),
  auditCheck("controlled-execution-gate-design", "scripts/run-controlled-execution-gate-design-audit.ts", "archive"),
  auditCheck("future-codex-cli-canary-packet-checklist", "scripts/run-future-codex-cli-canary-packet-checklist-audit.ts", "archive"),
  auditCheck("future-codex-cli-canary-authorization-packet", "scripts/run-future-codex-cli-canary-authorization-packet-audit.ts", "archive"),
  auditCheck("future-codex-cli-canary-execution-gate", "scripts/run-future-codex-cli-canary-execution-gate-audit.ts", "archive"),
  auditCheck("future-codex-cli-canary-pre-execution-review", "scripts/run-future-codex-cli-canary-pre-execution-review-audit.ts", "archive"),
  auditCheck("post-canary-receipt-rollback-gate", "scripts/run-post-canary-receipt-rollback-verification-gate-audit.ts", "archive"),
  auditCheck("capability-taxonomy-escalation-policy-boundary", "scripts/run-capability-taxonomy-escalation-policy-boundary-audit.ts"),
  auditCheck("capability-taxonomy-escalation-policy", "scripts/run-capability-taxonomy-escalation-policy-audit.ts", "archive"),
  auditCheck("strategy-router-execution-boundary", "scripts/run-strategy-router-execution-boundary-audit.ts"),
  auditCheck("execution-profiles-boundary", "scripts/run-execution-profiles-boundary-audit.ts"),
  auditCheck("policy-config-boundary", "scripts/run-policy-config-boundary-audit.ts"),
  auditCheck("capability-taxonomy-boundary", "scripts/run-capability-taxonomy-boundary-audit.ts"),
  auditCheck("routing-engine-boundary", "scripts/run-routing-engine-boundary-audit.ts"),
  auditCheck("recovery-control-orchestration-boundary", "scripts/run-recovery-control-orchestration-boundary-audit.ts"),
  auditCheck("runtime-control-boundary", "scripts/run-runtime-control-boundary-audit.ts"),
  auditCheck("operator-action-executor-gate-boundary", "scripts/run-operator-action-executor-gate-boundary-audit.ts"),
  auditCheck("codex-cli-host-boundary", "scripts/run-codex-cli-host-boundary-audit.ts"),
  auditCheck("public-api-execution-boundary", "scripts/run-public-api-execution-boundary-audit.ts"),
  auditCheck("agent-os-local-runtime-boundary", "scripts/run-agent-os-local-runtime-boundary-audit.ts"),
  auditCheck("agent-os-mcp-server-manifest-boundary", "scripts/run-agent-os-mcp-server-manifest-boundary-audit.ts"),
  auditCheck("protocol-mcp-provider-skeleton-boundary", "scripts/run-protocol-mcp-provider-skeleton-boundary-audit.ts"),
  auditCheck("protocol-a2a-remote-provider-skeleton-boundary", "scripts/run-protocol-a2a-remote-provider-skeleton-boundary-audit.ts"),
  auditCheck("agent-os-sdk-boundary", "scripts/run-agent-os-sdk-boundary-audit.ts"),
  auditCheck("agent-os-cli-boundary", "scripts/run-agent-os-cli-boundary-audit.ts"),
  auditCheck("agent-os-app-server-boundary", "scripts/run-agent-os-app-server-boundary-audit.ts"),
  auditCheck("agent-os-public-surfaces-boundary", "scripts/run-agent-os-public-surfaces-boundary-audit.ts"),
  auditCheck("codex-provider-execution-boundary", "scripts/run-codex-provider-execution-boundary-audit.ts"),
  auditCheck("preflight-boundary", "scripts/run-preflight-boundary-audit.ts"),
  auditCheck("approval-permit-boundary", "scripts/run-approval-permit-boundary-audit.ts"),
  auditCheck("approval-gate-boundary", "scripts/run-approval-gate-boundary-audit.ts"),
  auditCheck("approval-consumption-dispatch-boundary", "scripts/run-approval-consumption-dispatch-boundary-audit.ts"),
  auditCheck("admission-control-boundary", "scripts/run-admission-control-boundary-audit.ts"),
  auditCheck("delegation-policy-boundary", "scripts/run-delegation-policy-boundary-audit.ts"),
  auditCheck("execution-eligibility-boundary", "scripts/run-execution-eligibility-boundary-audit.ts"),
  auditCheck("execution-observation-boundary", "scripts/run-execution-observation-boundary-audit.ts"),
  auditCheck("governance-failure-reducer-boundary", "scripts/run-governance-failure-reducer-boundary-audit.ts"),
  auditCheck("task-graph-boundary", "scripts/run-task-graph-boundary-audit.ts"),
  auditCheck("scheduler-boundary", "scripts/run-scheduler-boundary-audit.ts"),
  auditCheck("execution-planner-boundary", "scripts/run-execution-planner-boundary-audit.ts"),
  auditCheck("provider-registry-boundary", "scripts/run-provider-registry-boundary-audit.ts"),
  auditCheck("controlled-provider-execution-dispatch-preflight-boundary", "scripts/run-controlled-provider-execution-dispatch-preflight-boundary-audit.ts"),
  auditCheck("controlled-provider-execution-dispatcher-boundary", "scripts/run-controlled-provider-execution-dispatcher-boundary-audit.ts"),
  auditCheck("provider-execution-runner-boundary", "scripts/run-provider-execution-runner-boundary-audit.ts"),
  auditCheck("provider-core-execution-primitives-boundary", "scripts/run-provider-core-execution-primitives-boundary-audit.ts"),
  auditCheck("tool-invocation-planner-boundary", "scripts/run-tool-invocation-planner-boundary-audit.ts"),
  auditCheck("desktop-agent-strategy-boundary", "scripts/run-desktop-agent-strategy-boundary-audit.ts"),
  auditCheck("desktop-decision-runner-boundary", "scripts/run-desktop-decision-runner-boundary-audit.ts"),
  auditCheck("final-host-locator-boundary", "scripts/run-final-host-locator-boundary-audit.ts"),
  auditCheck("host-dispatcher-provider-boundary", "scripts/run-host-dispatcher-provider-boundary-audit.ts"),
  auditCheck("codex-desktop-bridge-boundary", "scripts/run-codex-desktop-bridge-boundary-audit.ts"),
  auditCheck("codex-desktop-live-host-boundary", "scripts/run-codex-desktop-live-host-boundary-audit.ts"),
  auditCheck("codex-memory-mcp-client-boundary", "scripts/run-codex-memory-mcp-client-boundary-audit.ts"),
  auditCheck("codex-memory-host-client-boundary", "scripts/run-codex-memory-host-client-boundary-audit.ts"),
  auditCheck("desktop-host-client-boundary", "scripts/run-desktop-host-client-boundary-audit.ts"),
  auditCheck("desktop-live-adapter-dispatch-boundary", "scripts/run-desktop-live-adapter-dispatch-boundary-audit.ts"),
  auditCheck("host-client-example-boundary", "scripts/run-host-client-example-boundary-audit.ts"),
  auditCheck("target-host-embedding-boundary", "scripts/run-target-host-embedding-boundary-audit.ts"),
  auditCheck("host-executor-boundary", "scripts/run-host-executor-boundary-audit.ts"),
  auditCheck("host-executor-taskbook-boundary", "scripts/run-host-executor-taskbook-boundary-audit.ts"),
  auditCheck("host-client-executor-review-boundary", "scripts/run-host-client-executor-review-boundary-audit.ts"),
  auditCheck("host-executor-receipt-boundary", "scripts/run-host-executor-receipt-boundary-audit.ts"),
  auditCheck("agent-backed-recovery-executor-boundary", "scripts/run-agent-backed-recovery-executor-boundary-audit.ts"),
  auditCheck("agent-executor-adapter-taskbook-boundary", "scripts/run-agent-executor-adapter-taskbook-boundary-audit.ts"),
  auditCheck("agent-executor-adapter-review-boundary", "scripts/run-agent-executor-adapter-review-boundary-audit.ts"),
  auditCheck("agent-executor-adapter-sandbox-boundary", "scripts/run-agent-executor-adapter-sandbox-boundary-audit.ts"),
  auditCheck("agent-task-control-taskbook-boundary", "scripts/run-agent-task-control-taskbook-boundary-audit.ts"),
  auditCheck("agent-task-control-review-boundary", "scripts/run-agent-task-control-review-boundary-audit.ts"),
  auditCheck("agent-task-control-sandbox-boundary", "scripts/run-agent-task-control-sandbox-boundary-audit.ts"),
  auditCheck("sub-agent-runtime-boundary", "scripts/run-sub-agent-runtime-boundary-audit.ts"),
  auditCheck("execution-boundary-current-surface", "scripts/run-execution-boundary-current-surface-audit.ts"),
  auditCheck("controlled-provider-execution-taskbook-boundary", "scripts/run-controlled-provider-execution-taskbook-boundary-audit.ts"),
  auditCheck("controlled-provider-execution-taskbook-review-boundary", "scripts/run-controlled-provider-execution-taskbook-review-boundary-audit.ts"),
  auditCheck("controlled-provider-execution-taskbook-review", "scripts/run-controlled-provider-execution-taskbook-review-audit.ts", "archive"),
  auditCheck("workspace-write-real-canary-candidate", "scripts/run-workspace-write-real-canary-local-candidate-consistency.ts", "archive"),
  auditCheck("workspace-write-real-canary-sensitive-scan", "scripts/run-workspace-write-real-canary-sensitive-scan.ts", "archive"),
  auditCheck("workspace-write-real-canary-final-local", "scripts/run-workspace-write-real-canary-final-local-audit.ts", "archive"),
  auditCheck("workspace-write-release-gate", "scripts/run-workspace-write-release-gate-audit.ts"),
  auditCheck("workspace-write-real-canary-authorization-design", "scripts/run-workspace-write-real-canary-authorization-design-audit.ts"),
  auditCheck("source-release-package-boundary", "scripts/run-source-release-package-boundary-audit.ts"),
  auditCheck("state-sync-boundary", "scripts/run-state-sync-boundary-audit.ts"),
  auditCheck("state-sync", "scripts/run-state-sync-audit.ts")
];

export function getValidationTierPlan(
  tier: ValidationTier,
  options: ValidationTierOptions = {}
): CommandSpec[] {
  const targetedTests = [...(options.targetedTests ?? [])];
  const dailyPlan: CommandSpec[] = [
    npmScript("typecheck", "typecheck", "TypeScript no-emit check")
  ];

  if (targetedTests.length > 0) {
    dailyPlan.push(tsxCommand(
      "targeted-tests",
      ["--test", ...targetedTests],
      "Targeted test files supplied by the caller"
    ));
  }

  if (tier === "daily") {
    return dailyPlan;
  }

  const prPlan: CommandSpec[] = [
    npmScript("typecheck", "typecheck", "TypeScript no-emit check"),
    npmScript("test", "test", "Full unit and integration test suite"),
    npmScript("build", "build", "Production TypeScript build"),
    npmScript("docs:governance", "docs:governance", "Governance documentation structure check"),
    resolveGovernanceCheck("audit", "execution-boundary-current-surface"),
    resolveGovernanceCheck("audit", "state-sync")
  ];

  if (tier === "pr") {
    return prPlan;
  }

  return [
    ...prPlan,
    npmScript("canary", "canary", "Deterministic low-risk canary"),
    npmScript("canary:write", "canary:write", "Deterministic medium-risk canary"),
    npmScript("smoke:contract", "smoke:contract", "Host contract smoke without real CLI dependency"),
    resolveGovernanceCheck("audit", "workspace-write-release-gate"),
    npmScript("evidence:collect", "evidence:collect", "Evidence manifest collection")
  ];
}

export function listGovernanceChecks(
  options: GovernanceCheckListOptions = {}
): Record<GovernanceCheckCategory, string[]> {
  const includeArchived = options.includeArchived === true;
  const checks: Record<GovernanceCheckCategory, string[]> = {
    audit: [],
    acceptance: [],
    operator: []
  };

  for (const check of GOVERNANCE_CHECKS) {
    if (!includeArchived && (check.listSurface ?? DEFAULT_LIST_SURFACE) !== "current") {
      continue;
    }
    checks[check.category].push(check.name);
  }

  for (const category of GOVERNANCE_CHECK_CATEGORIES) {
    checks[category].sort();
  }

  return checks;
}

export function resolveGovernanceCheck(
  category: GovernanceCheckCategory,
  name: string,
  extraArgs: readonly string[] = []
): CommandSpec {
  const check = GOVERNANCE_CHECKS.find(
    (candidate) => candidate.category === category && candidate.name === name
  );
  if (check === undefined) {
    const available = listGovernanceChecks()[category];
    throw new Error(
      `Unknown ${category} check '${name}'. Available: ${available.join(", ") || "(none)"}`
    );
  }

  const normalizedExtraArgs = normalizeExtraArgs(extraArgs);
  return tsxScript(
    `governance-${category}-${name}`,
    check.scriptPath,
    `Run ${category} ${name}`,
    normalizedExtraArgs
  );
}

function npmScript(
  id: string,
  scriptName: string,
  description: string,
  extraArgs: readonly string[] = []
): CommandSpec {
  const args = ["run", scriptName];
  if (extraArgs.length > 0) {
    args.push("--", ...extraArgs);
  }

  return npmCommand(id, args, description);
}

function tsxScript(
  id: string,
  scriptPath: string,
  description: string,
  extraArgs: readonly string[] = []
): CommandSpec {
  return tsxCommand(id, [scriptPath, ...extraArgs], description);
}

function npmCommand(
  id: string,
  args: readonly string[],
  description: string
): CommandSpec {
  const npmExecPath = process.env.npm_execpath;
  if (process.platform === "win32" && npmExecPath) {
    return {
      id,
      command: process.execPath,
      args: [npmExecPath, ...args],
      description
    };
  }

  return {
    id,
    command: process.platform === "win32" ? "npm.cmd" : "npm",
    args: [...args],
    description
  };
}

function tsxCommand(
  id: string,
  args: readonly string[],
  description: string
): CommandSpec {
  return {
    id,
    command: process.execPath,
    args: ["--import", "tsx", ...args],
    description
  };
}

function operatorCheck(
  name: string,
  scriptPath: string,
  listSurface: GovernanceCheckDefinition["listSurface"] = DEFAULT_LIST_SURFACE
): GovernanceCheckDefinition {
  return { category: "operator", name, scriptPath, listSurface };
}

function acceptanceCheck(
  name: string,
  scriptPath: string,
  listSurface: GovernanceCheckDefinition["listSurface"] = DEFAULT_LIST_SURFACE
): GovernanceCheckDefinition {
  return { category: "acceptance", name, scriptPath, listSurface };
}

function auditCheck(
  name: string,
  scriptPath: string,
  listSurface: GovernanceCheckDefinition["listSurface"] = DEFAULT_LIST_SURFACE
): GovernanceCheckDefinition {
  return { category: "audit", name, scriptPath, listSurface };
}

function normalizeExtraArgs(args: readonly string[]): string[] {
  if (args[0] === "--") {
    return [...args.slice(1)];
  }

  return [...args];
}

function parseValidationTierOptions(args: readonly string[]): ValidationTierOptions {
  const targetedTests: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === undefined || arg === "--") {
      continue;
    }

    if (arg === "--test" || arg === "--targeted-test") {
      const testPath = args[index + 1];
      if (testPath === undefined) {
        throw new Error(`${arg} requires a test file path`);
      }
      targetedTests.push(testPath);
      index += 1;
      continue;
    }

    if (arg.startsWith("--test=")) {
      targetedTests.push(arg.slice("--test=".length));
      continue;
    }

    if (arg.startsWith("--targeted-test=")) {
      targetedTests.push(arg.slice("--targeted-test=".length));
      continue;
    }

    if (arg.startsWith("-")) {
      throw new Error(`Unknown validation tier option '${arg}'`);
    }

    targetedTests.push(arg);
  }

  return { targetedTests };
}

function isValidationTier(value: string): value is ValidationTier {
  return (VALIDATION_TIERS as readonly string[]).includes(value);
}

function isGovernanceCheckCategory(value: string): value is GovernanceCheckCategory {
  return (GOVERNANCE_CHECK_CATEGORIES as readonly string[]).includes(value);
}

function formatCommand(command: CommandSpec): string {
  return [command.command, ...command.args].map(quoteShellToken).join(" ");
}

function quoteShellToken(value: string): string {
  if (/^[A-Za-z0-9_./:@=-]+$/.test(value)) {
    return value;
  }

  return JSON.stringify(value);
}

async function runPlan(plan: readonly CommandSpec[]): Promise<void> {
  for (const command of plan) {
    console.log(`\n[${command.id}] ${command.description}`);
    console.log(`$ ${formatCommand(command)}`);
    await runCommand(command);
  }
}

async function runCommand(command: CommandSpec): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command.command, command.args, {
      stdio: "inherit",
      windowsHide: true
    });

    child.on("error", reject);
    child.on("close", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      const suffix = signal ? `signal ${signal}` : `exit code ${code ?? "unknown"}`;
      reject(new Error(`${command.id} failed with ${suffix}`));
    });
  });
}

function printHelp(): void {
  console.log(`Codex Router governance check runner

Usage:
  npm run governance -- list [--all]
  npm run governance -- tier <daily|pr|release> [--test tests/file.test.ts]
  npm run governance -- audit <name> [args...]
  npm run governance -- acceptance <name> [--check] [args...]
  npm run governance -- operator <default|readonly|release|telemetry> [args...]

Shortcuts:
  npm run validate:daily [-- --test tests/file.test.ts]
  npm run validate:pr
  npm run validate:release
`);
}

function printList(options: GovernanceCheckListOptions = {}): void {
  const includeArchived = options.includeArchived === true;
  const checks = listGovernanceChecks(options);

  console.log("Validation tiers:");
  console.log("  daily   typecheck plus optional targeted tests");
  console.log("  pr      typecheck, full tests, build, docs governance, execution boundary audit, state-sync audit");
  console.log("  release pr tier plus deterministic canary, contract smoke, evidence collection");
  console.log("");
  console.log(includeArchived ? "Governance checks (all registered):" : "Governance checks (current surface):");
  for (const category of GOVERNANCE_CHECK_CATEGORIES) {
    console.log(`  ${category}: ${checks[category].join(", ") || "(none)"}`);
  }
  if (!includeArchived) {
    console.log("");
    console.log("Current acceptance checks refresh evidence by default when they pass.");
    console.log("Use `--check` for a no-write local review pass when the check supports it.");
    console.log("");
    console.log("Archived one-off checks are still registered and executable.");
    console.log("Use `npm run governance -- list --all` to show the full historical registry.");
  }
}

async function main(argv = process.argv.slice(2)): Promise<void> {
  const [command, ...rest] = argv;

  if (command === undefined || command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command === "list") {
    const includeArchived = rest.includes("--all") || rest.includes("--archive");
    const unknownArgs = rest.filter((arg) => arg !== "--all" && arg !== "--archive");
    if (unknownArgs.length > 0) {
      throw new Error(`Unknown list option '${unknownArgs[0]}'`);
    }
    printList({ includeArchived });
    return;
  }

  if (command === "tier" || command === "validation") {
    const [tierValue, ...tierArgs] = rest;
    if (tierValue === undefined || !isValidationTier(tierValue)) {
      throw new Error(`Expected validation tier: ${VALIDATION_TIERS.join(", ")}`);
    }

    const options = parseValidationTierOptions(tierArgs);
    const plan = getValidationTierPlan(tierValue, options);

    if (tierValue === "daily" && (options.targetedTests ?? []).length === 0) {
      console.log("Daily tier: no targeted tests supplied, running typecheck only.");
    }

    await runPlan(plan);
    return;
  }

  if (isGovernanceCheckCategory(command)) {
    const [name, ...extraArgs] = rest;
    if (name === undefined) {
      const checks = listGovernanceChecks()[command];
      throw new Error(`Expected ${command} check name. Available: ${checks.join(", ") || "(none)"}`);
    }

    await runPlan([resolveGovernanceCheck(command, name, extraArgs)]);
    return;
  }

  throw new Error(`Unknown governance command '${command}'`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
