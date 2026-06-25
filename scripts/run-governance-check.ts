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

interface GovernanceCheckDefinition {
  category: GovernanceCheckCategory;
  name: string;
  scriptPath: string;
}

const VALIDATION_TIERS: readonly ValidationTier[] = ["daily", "pr", "release"];
const GOVERNANCE_CHECK_CATEGORIES: readonly GovernanceCheckCategory[] = [
  "audit",
  "acceptance",
  "operator"
];
const TSX_CLI_PATH = "node_modules/tsx/dist/cli.mjs";

const GOVERNANCE_CHECKS: readonly GovernanceCheckDefinition[] = [
  operatorCheck("default", "scripts/run-codex-cli-operator-acceptance.ts"),
  operatorCheck("readonly", "scripts/run-codex-cli-operator-acceptance-readonly.ts"),
  operatorCheck("release", "scripts/run-codex-cli-operator-acceptance-release.ts"),
  operatorCheck("telemetry", "scripts/run-codex-cli-operator-acceptance-telemetry.ts"),
  acceptanceCheck("readonly-chain", "scripts/run-readonly-control-chain-acceptance.ts"),
  acceptanceCheck("provider-registry", "scripts/run-provider-registry-selection-acceptance.ts"),
  acceptanceCheck("policy-registry-selection", "scripts/run-policy-registry-selection-acceptance.ts"),
  acceptanceCheck("real-readonly-dispatch", "scripts/run-real-readonly-dispatch-acceptance.ts"),
  acceptanceCheck("formal-readonly-integration", "scripts/run-formal-readonly-cli-integration-readiness.ts"),
  acceptanceCheck("formal-readonly-integration-auth", "scripts/run-formal-readonly-cli-integration-authorization-acceptance.ts"),
  acceptanceCheck("formal-readonly-provider-integration-taskbook", "scripts/run-formal-readonly-provider-integration-taskbook-acceptance.ts"),
  acceptanceCheck("formal-readonly-provider-integration", "scripts/run-formal-readonly-provider-integration-acceptance.ts"),
  acceptanceCheck("formal-readonly-dispatch-boundary", "scripts/run-formal-readonly-dispatch-boundary-acceptance.ts"),
  acceptanceCheck("real-readonly-smoke-auth", "scripts/run-real-readonly-smoke-authorization-acceptance.ts"),
  acceptanceCheck("formal-real-readonly-smoke-taskbook", "scripts/run-formal-real-readonly-smoke-taskbook-acceptance.ts"),
  acceptanceCheck("formal-real-readonly-smoke-pre-execution", "scripts/run-formal-real-readonly-smoke-pre-execution-acceptance.ts"),
  acceptanceCheck("formal-real-readonly-smoke-execution-auth", "scripts/run-formal-real-readonly-smoke-execution-authorization-acceptance.ts"),
  acceptanceCheck("formal-real-readonly-smoke-final-preflight", "scripts/run-formal-real-readonly-smoke-final-preflight-acceptance.ts"),
  acceptanceCheck("workspace-write-governance", "scripts/run-workspace-write-governance-acceptance.ts"),
  acceptanceCheck("workspace-write-fake-canary", "scripts/run-workspace-write-fake-canary-acceptance.ts"),
  acceptanceCheck("workspace-write-real-canary-auth", "scripts/run-workspace-write-real-canary-authorization-acceptance.ts"),
  acceptanceCheck("workspace-write-real-canary-pre-execution", "scripts/run-workspace-write-real-canary-pre-execution-acceptance.ts"),
  acceptanceCheck("controlled-readonly-provider-execution", "scripts/run-controlled-readonly-provider-execution-acceptance.ts"),
  auditCheck("real-readonly-smoke-local", "scripts/run-real-readonly-smoke-local-closeout-audit.ts"),
  auditCheck("formal-readonly-integration-local", "scripts/run-formal-readonly-cli-integration-local-closeout-audit.ts"),
  auditCheck("formal-readonly-provider-integration-local", "scripts/run-formal-readonly-provider-integration-local-closeout-audit.ts"),
  auditCheck("formal-readonly-dispatch-boundary-local", "scripts/run-formal-readonly-dispatch-boundary-local-closeout-audit.ts"),
  auditCheck("formal-real-readonly-smoke-local", "scripts/run-formal-real-readonly-smoke-local-closeout-audit.ts"),
  auditCheck("formal-real-readonly-smoke-execution-local", "scripts/run-formal-real-readonly-smoke-execution-local-closeout-audit.ts"),
  auditCheck("formal-real-readonly-smoke-receipt-local", "scripts/run-formal-real-readonly-smoke-receipt-local-audit.ts"),
  auditCheck("formal-real-readonly-smoke-local-rc", "scripts/run-formal-real-readonly-smoke-local-rc-review.ts"),
  auditCheck("formal-real-readonly-smoke-rc-local-closeout", "scripts/run-formal-real-readonly-smoke-rc-local-closeout-audit.ts"),
  auditCheck("readonly-real-smoke-chain-index", "scripts/run-readonly-real-smoke-chain-index-audit.ts"),
  auditCheck("readonly-real-smoke-chain-candidate", "scripts/run-readonly-real-smoke-chain-local-candidate-consistency.ts"),
  auditCheck("readonly-real-smoke-chain-local-closeout", "scripts/run-readonly-real-smoke-chain-local-closeout-audit.ts"),
  auditCheck("readonly-formal-integration-matrix", "scripts/run-readonly-formal-integration-readiness-matrix-audit.ts"),
  auditCheck("readonly-productization", "scripts/run-readonly-productization-acceptance.ts"),
  auditCheck("approval-consumption-dispatch-matrix", "scripts/run-approval-consumption-dispatch-matrix-audit.ts"),
  auditCheck("controlled-execution-gate-design", "scripts/run-controlled-execution-gate-design-audit.ts"),
  auditCheck("future-codex-cli-canary-packet-checklist", "scripts/run-future-codex-cli-canary-packet-checklist-audit.ts"),
  auditCheck("future-codex-cli-canary-authorization-packet", "scripts/run-future-codex-cli-canary-authorization-packet-audit.ts"),
  auditCheck("future-codex-cli-canary-execution-gate", "scripts/run-future-codex-cli-canary-execution-gate-audit.ts"),
  auditCheck("future-codex-cli-canary-pre-execution-review", "scripts/run-future-codex-cli-canary-pre-execution-review-audit.ts"),
  auditCheck("post-canary-receipt-rollback-gate", "scripts/run-post-canary-receipt-rollback-verification-gate-audit.ts"),
  auditCheck("capability-taxonomy-escalation-policy", "scripts/run-capability-taxonomy-escalation-policy-audit.ts"),
  auditCheck("controlled-provider-execution-taskbook-review", "scripts/run-controlled-provider-execution-taskbook-review-audit.ts"),
  auditCheck("workspace-write-real-canary-candidate", "scripts/run-workspace-write-real-canary-local-candidate-consistency.ts"),
  auditCheck("workspace-write-real-canary-sensitive-scan", "scripts/run-workspace-write-real-canary-sensitive-scan.ts"),
  auditCheck("workspace-write-real-canary-final-local", "scripts/run-workspace-write-real-canary-final-local-audit.ts"),
  auditCheck("source-release-package-boundary", "scripts/run-source-release-package-boundary-audit.ts"),
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
    npmScript("evidence:collect", "evidence:collect", "Evidence manifest collection")
  ];
}

export function listGovernanceChecks(): Record<GovernanceCheckCategory, string[]> {
  const checks: Record<GovernanceCheckCategory, string[]> = {
    audit: [],
    acceptance: [],
    operator: []
  };

  for (const check of GOVERNANCE_CHECKS) {
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
  if (process.platform === "win32") {
    return {
      id,
      command: process.execPath,
      args: [TSX_CLI_PATH, ...args],
      description
    };
  }

  return {
    id,
    command: "tsx",
    args: [...args],
    description
  };
}

function operatorCheck(name: string, scriptPath: string): GovernanceCheckDefinition {
  return { category: "operator", name, scriptPath };
}

function acceptanceCheck(name: string, scriptPath: string): GovernanceCheckDefinition {
  return { category: "acceptance", name, scriptPath };
}

function auditCheck(name: string, scriptPath: string): GovernanceCheckDefinition {
  return { category: "audit", name, scriptPath };
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
  npm run governance -- list
  npm run governance -- tier <daily|pr|release> [--test tests/file.test.ts]
  npm run governance -- audit <name> [args...]
  npm run governance -- acceptance <name> [args...]
  npm run governance -- operator <default|readonly|release|telemetry> [args...]

Shortcuts:
  npm run validate:daily [-- --test tests/file.test.ts]
  npm run validate:pr
  npm run validate:release
`);
}

function printList(): void {
  const checks = listGovernanceChecks();

  console.log("Validation tiers:");
  console.log("  daily   typecheck plus optional targeted tests");
  console.log("  pr      typecheck, full tests, build, state-sync audit");
  console.log("  release pr tier plus deterministic canary, contract smoke, evidence collection");
  console.log("");
  console.log("Governance checks:");
  for (const category of GOVERNANCE_CHECK_CATEGORIES) {
    console.log(`  ${category}: ${checks[category].join(", ") || "(none)"}`);
  }
}

async function main(argv = process.argv.slice(2)): Promise<void> {
  const [command, ...rest] = argv;

  if (command === undefined || command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command === "list") {
    printList();
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
