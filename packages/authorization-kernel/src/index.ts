import { isAbsolute, posix as pathPosix } from "node:path";
import {
  AuthorizationDecisionSchema,
  CapabilityFactsSchema,
  hashKernelObject,
  type AuthorizationDecision,
  type CapabilityFacts,
  type CapabilityFactCommand,
  type CapabilityFactFileChange,
  type CapabilityScope,
  type GovernanceRiskLevel,
  type GovernedFileChangeSet
} from "../../kernel-contracts/src/index.js";
import {
  capabilityImplies,
  capabilityScopeToCanonicalString
} from "../../capability/src/index.js";

const RISK_RANK: Record<GovernanceRiskLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3
};

const PROTECTED_BRANCHES = new Set([
  "main",
  "master",
  "production",
  "release",
  "prod/stable"
]);

const CRITICAL_SEMANTIC_MARKERS = [
  "deploy",
  "deployment",
  "publish",
  "release",
  "production",
  "prod/stable",
  "credential",
  "credentials",
  "secret",
  "private key",
  ".env",
  "部署",
  "发布",
  "生产",
  "上线",
  "凭证",
  "密钥",
  "私钥",
  "环境变量",
  "远程写"
];

const HIGH_SEMANTIC_MARKERS = [
  "delete",
  "remove",
  "rename",
  "permission",
  "network",
  "external",
  "push",
  "merge",
  "command",
  "shell",
  "migration",
  "删除",
  "移除",
  "重命名",
  "权限",
  "网络",
  "外部",
  "推送",
  "合并",
  "命令",
  "迁移"
];

const MEDIUM_SEMANTIC_MARKERS = [
  "write",
  "edit",
  "modify",
  "create",
  "update",
  "implement",
  "写入",
  "编辑",
  "修改",
  "新增",
  "创建",
  "更新",
  "实现"
];

const READ_ONLY_SEMANTIC_MARKERS = [
  "read",
  "review",
  "inspect",
  "explain",
  "summarize",
  "analyze",
  "读取",
  "审查",
  "检查",
  "解释",
  "总结",
  "分析"
];

const SENSITIVE_PATH_COMPONENTS = new Set([
  ".git",
  ".env",
  ".netrc",
  ".npmrc",
  ".pypirc",
  ".ssh",
  ".codex-home",
  ".omc",
  "auth.json",
  "config.json",
  "state-private",
  "secret",
  "secrets",
  "credential",
  "credentials",
  "id_dsa",
  "id_ecdsa",
  "id_ed25519",
  "id_rsa"
]);

const WINDOWS_RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;

const SENSITIVE_DIFF_MARKERS = [
  "-----begin private key-----",
  "-----begin openssh private key-----",
  "aws_secret_access_key",
  "github_token",
  "npm_token",
  "openai_api_key",
  "private_key=",
  "secret_access_key",
  "api_key=",
  "authorization: bearer "
];

export interface CapabilityFactsInput {
  subjectId: string;
  fileChanges?: CapabilityFactFileChange[];
  commands?: CapabilityFactCommand[];
  permissionRequests?: string[];
  repository: CapabilityFacts["repository"];
  networkAccess?: CapabilityFacts["networkAccess"];
  credentialAccess?: CapabilityFacts["credentialAccess"];
  externalTargets?: string[];
  releaseAction?: boolean;
  exactTargets?: boolean;
  ambiguous?: boolean;
  unknowns?: string[];
  observedAt: string;
}

export interface AuthorizeCapabilityFactsInput {
  decisionId?: string;
  surface: AuthorizationDecision["surface"];
  facts: CapabilityFacts;
  semanticRisk: GovernanceRiskLevel;
  requestedCapabilities: CapabilityScope[];
  capabilityCeiling: CapabilityScope[];
  createdAt: string;
}

export function deriveCapabilityFacts(input: CapabilityFactsInput): CapabilityFacts {
  const inputFileChanges = [...(input.fileChanges ?? [])];
  const unsafeGovernedPathDetected = inputFileChanges.some(hasUnsafeGovernedPath);
  const fileChanges = inputFileChanges
    .map((change) => ({
      ...change,
      path: normalizeGovernedPath(change.path),
      ...(change.oldPath === undefined
        ? {}
        : { oldPath: normalizeGovernedPath(change.oldPath) })
    }))
    .sort(compareFileChanges);
  const commands = [...(input.commands ?? [])]
    .map((command) => ({
      argv: [...command.argv],
      ...(command.cwd === undefined ? {} : { cwd: command.cwd })
    }))
    .sort((left, right) => compareCodeUnits(
      left.argv.join("\0"),
      right.argv.join("\0")
    ));
  const sensitivePaths = uniqueStrings(
    fileChanges
      .flatMap((change) => [change.path, ...(change.oldPath ? [change.oldPath] : [])])
      .filter(isSensitiveGovernedPath)
  );
  const unknowns = uniqueStrings([
    ...(input.unknowns ?? []),
    ...(unsafeGovernedPathDetected ? ["unsafe_governed_path"] : [])
  ]);

  return CapabilityFactsSchema.parse({
    subjectId: input.subjectId,
    fileChanges,
    commands,
    permissionRequests: uniqueStrings(input.permissionRequests ?? []),
    repository: input.repository,
    networkAccess: input.networkAccess ?? "none",
    credentialAccess: input.credentialAccess ?? "none",
    externalTargets: uniqueStrings(input.externalTargets ?? []),
    sensitivePaths,
    releaseAction: input.releaseAction ?? false,
    exactTargets: (input.exactTargets ?? fileChanges.length > 0)
      && !unsafeGovernedPathDetected,
    ambiguous: input.ambiguous ?? false,
    unknowns,
    observedAt: input.observedAt
  });
}

export function deriveCapabilityFactsFromChangeSet(
  changeSet: GovernedFileChangeSet,
  context: Omit<CapabilityFactsInput, "subjectId" | "fileChanges" | "observedAt"> & {
    observedAt?: string;
  }
): CapabilityFacts {
  const diffSignalsCredentialMaterial = changeSet.changes.some((change) => (
    containsSensitiveDiffSignal(change.unifiedDiff)
  ));
  const credentialAccess = diffSignalsCredentialMaterial
    ? "requested" as const
    : context.credentialAccess;
  return deriveCapabilityFacts({
    subjectId: changeSet.changeSetId,
    fileChanges: changeSet.changes.map(({ unifiedDiff: _unifiedDiff, ...change }) => change),
    repository: context.repository,
    observedAt: context.observedAt ?? changeSet.proposedAt,
    ...(context.commands === undefined ? {} : { commands: context.commands }),
    ...(context.permissionRequests === undefined
      ? {}
      : { permissionRequests: context.permissionRequests }),
    ...(context.networkAccess === undefined ? {} : { networkAccess: context.networkAccess }),
    ...(credentialAccess === undefined
      ? {}
      : { credentialAccess }),
    ...(context.externalTargets === undefined
      ? {}
      : { externalTargets: context.externalTargets }),
    ...(context.releaseAction === undefined ? {} : { releaseAction: context.releaseAction }),
    ...(context.exactTargets === undefined ? {} : { exactTargets: context.exactTargets }),
    ...(context.ambiguous === undefined ? {} : { ambiguous: context.ambiguous }),
    ...(context.unknowns === undefined ? {} : { unknowns: context.unknowns })
  });
}

export function classifySemanticRiskSignal(text: string): GovernanceRiskLevel {
  const normalized = text.normalize("NFKC").toLocaleLowerCase("en-US");
  if (normalized.trim() === "") {
    return "high";
  }
  if (CRITICAL_SEMANTIC_MARKERS.some((marker) => normalized.includes(marker))) {
    return "critical";
  }
  if (HIGH_SEMANTIC_MARKERS.some((marker) => normalized.includes(marker))) {
    return "high";
  }
  if (MEDIUM_SEMANTIC_MARKERS.some((marker) => normalized.includes(marker))) {
    return "medium";
  }
  if (READ_ONLY_SEMANTIC_MARKERS.some((marker) => normalized.includes(marker))) {
    return "low";
  }
  return "medium";
}

export function authorizeCapabilityFacts(
  input: AuthorizeCapabilityFactsInput
): AuthorizationDecision {
  const facts = CapabilityFactsSchema.parse(input.facts);
  const factual = scoreCapabilityFactsRisk(facts);
  const effectiveRisk = maxRisk(input.semanticRisk, factual.level);
  const ceiling = narrowToCapabilityCeiling(
    input.requestedCapabilities,
    input.capabilityCeiling
  );
  const sideEffectRequested = input.requestedCapabilities.some(isSideEffectingCapability);
  const unsafeGovernedPathDetected = facts.fileChanges.some(hasUnsafeGovernedPath)
    || facts.unknowns.includes("unsafe_governed_path");
  const unsafeGovernedPathWriteBlocked = sideEffectRequested && unsafeGovernedPathDetected;
  const unknownWriteBlocked = sideEffectRequested && (
    facts.ambiguous
    || !facts.exactTargets
    || facts.unknowns.length > 0
    || facts.networkAccess === "unknown"
    || facts.credentialAccess === "unknown"
  );
  const missingCeiling = ceiling.missing.length > 0;
  const policyAutoEligible = isPolicyAutoCandidate(facts, effectiveRisk)
    && !missingCeiling
    && !unsafeGovernedPathWriteBlocked
    && !unknownWriteBlocked;
  const reasons = uniqueStrings([
    ...factual.reasons,
    `semantic_risk:${input.semanticRisk}`,
    `factual_risk:${factual.level}`,
    `effective_risk:${effectiveRisk}`,
    ...ceiling.missing.map((scope) => `capability_ceiling_missing:${scope}`),
    ...(unsafeGovernedPathWriteBlocked ? ["unsafe_governed_path_forbidden"] : []),
    ...(unknownWriteBlocked ? ["unknown_or_ambiguous_write_forbidden"] : [])
  ]);
  const blocked = missingCeiling || unsafeGovernedPathWriteBlocked || unknownWriteBlocked;
  const approvalMode = blocked
    ? "human_required"
    : !sideEffectRequested && effectiveRisk !== "high" && effectiveRisk !== "critical"
      ? "not_required"
      : policyAutoEligible
        ? "policy_auto"
        : "human_required";
  const approvalRequired = approvalMode !== "not_required";
  const disposition = blocked
    ? "blocked"
    : approvalRequired
      ? "approval_required"
      : "authorized";
  const factsHash = hashKernelObject(facts);

  return AuthorizationDecisionSchema.parse({
    decisionId: input.decisionId
      ?? `authorization_${facts.subjectId}_${factsHash.slice(0, 16)}`,
    subjectId: facts.subjectId,
    surface: input.surface,
    factsHash,
    semanticRisk: input.semanticRisk,
    factualRisk: factual.level,
    effectiveRisk,
    requestedCapabilities: input.requestedCapabilities,
    authorizedCapabilities: blocked ? ceiling.allowed.filter(isReadOnlyCapability) : ceiling.allowed,
    approvalMode,
    disposition,
    approvalRequired,
    reasons,
    createdAt: input.createdAt
  });
}

export function narrowToCapabilityCeiling(
  requestedCapabilities: CapabilityScope[],
  capabilityCeiling: CapabilityScope[]
): { allowed: CapabilityScope[]; missing: string[] } {
  const allowed: CapabilityScope[] = [];
  const missing: string[] = [];
  const ceilingScopes = capabilityCeiling.map(capabilityScopeToCanonicalString);

  for (const requested of requestedCapabilities) {
    const requestedCanonical = capabilityScopeToCanonicalString(requested);
    const isAllowed = ceilingScopes.some((ceilingScope) => (
      capabilityImplies(ceilingScope, requestedCanonical)
    ));
    if (isAllowed) {
      allowed.push(structuredClone(requested) as CapabilityScope);
    } else {
      missing.push(requestedCanonical);
    }
  }

  return {
    allowed: dedupeCapabilityScopes(allowed),
    missing: uniqueStrings(missing)
  };
}

export function scoreCapabilityFactsRisk(
  factsInput: CapabilityFacts
): { level: GovernanceRiskLevel; reasons: string[] } {
  const facts = CapabilityFactsSchema.parse(factsInput);
  const reasons: string[] = [];
  let level: GovernanceRiskLevel = "low";
  const raise = (risk: GovernanceRiskLevel, reason: string): void => {
    level = maxRisk(level, risk);
    reasons.push(reason);
  };

  if (facts.fileChanges.length > 0) {
    raise("medium", "facts:file_changes");
  }
  if (
    facts.fileChanges.some(hasUnsafeGovernedPath)
    || facts.unknowns.includes("unsafe_governed_path")
  ) {
    raise("critical", "facts:unsafe_path");
  }
  for (const change of facts.fileChanges) {
    if (change.kind === "delete") {
      raise("high", `facts:delete:${change.path}`);
    }
    if (change.kind === "rename") {
      raise("high", `facts:rename:${change.oldPath ?? "unknown"}:${change.path}`);
    }
  }
  if (facts.commands.length > 0) {
    raise("high", "facts:command");
  }
  if (facts.permissionRequests.length > 0) {
    raise("high", "facts:permission");
  }
  if (
    facts.repository.protectedBranch
    || isProtectedBranchName(facts.repository.branch)
  ) {
    raise("high", "facts:protected_branch");
  }
  if (!facts.repository.worktreeClean) {
    raise("high", "facts:dirty_worktree");
  }
  if (
    facts.repository.expectedHead !== undefined
    && facts.repository.headCommit !== facts.repository.expectedHead
  ) {
    raise("high", "facts:head_mismatch");
  }
  if (facts.sensitivePaths.length > 0) {
    raise("critical", "facts:sensitive_path");
  }
  if (facts.networkAccess !== "none") {
    raise(facts.networkAccess === "unknown" ? "high" : "critical", "facts:network");
  }
  if (facts.credentialAccess !== "none") {
    raise("critical", "facts:credential");
  }
  if (facts.externalTargets.length > 0) {
    raise("critical", "facts:external_target");
  }
  if (facts.releaseAction) {
    raise("critical", "facts:release_action");
  }
  if (!facts.exactTargets) {
    raise("high", "facts:inexact_targets");
  }
  if (facts.ambiguous) {
    raise("high", "facts:ambiguous");
  }
  if (facts.unknowns.length > 0) {
    raise("high", "facts:unknown");
  }

  return { level, reasons: uniqueStrings(reasons) };
}

export function maxRisk(
  left: GovernanceRiskLevel,
  right: GovernanceRiskLevel
): GovernanceRiskLevel {
  return RISK_RANK[left] >= RISK_RANK[right] ? left : right;
}

export function isSensitiveGovernedPath(path: string): boolean {
  const components = normalizeGovernedPath(path)
    .toLocaleLowerCase("en-US")
    .split("/");
  return components.some((component) => (
    SENSITIVE_PATH_COMPONENTS.has(component)
    || component.startsWith(".env.")
    || component.endsWith(".pem")
    || component.endsWith(".key")
    || component.endsWith(".p12")
    || component.endsWith(".pfx")
    || component.includes("token")
    || component.includes("cookie")
  ));
}

function containsSensitiveDiffSignal(diff: string): boolean {
  const normalized = diff.normalize("NFKC").toLocaleLowerCase("en-US");
  return SENSITIVE_DIFF_MARKERS.some((marker) => normalized.includes(marker));
}

function isPolicyAutoCandidate(
  facts: CapabilityFacts,
  risk: GovernanceRiskLevel
): boolean {
  return (risk === "low" || risk === "medium")
    && facts.fileChanges.length > 0
    && facts.fileChanges.every((change) => change.kind === "create" || change.kind === "update")
    && facts.fileChanges.every((change) => !hasUnsafeGovernedPath(change))
    && facts.commands.length === 0
    && facts.permissionRequests.length === 0
    && !facts.repository.protectedBranch
    && !isProtectedBranchName(facts.repository.branch)
    && facts.repository.worktreeClean
    && facts.repository.headCommit !== undefined
    && facts.repository.headCommit === facts.repository.expectedHead
    && facts.networkAccess === "none"
    && facts.credentialAccess === "none"
    && facts.externalTargets.length === 0
    && facts.sensitivePaths.length === 0
    && !facts.releaseAction
    && facts.exactTargets
    && !facts.ambiguous
    && facts.unknowns.length === 0;
}

function normalizeGovernedPath(path: string): string {
  return pathPosix.normalize(path.replace(/\\/g, "/"));
}

function isProtectedBranchName(branch?: string): boolean {
  if (branch === undefined || branch.trim() !== branch) {
    return true;
  }
  const normalized = branch.toLocaleLowerCase("en-US");
  return PROTECTED_BRANCHES.has(normalized)
    || normalized.startsWith("release/")
    || normalized.startsWith("production/");
}

function hasUnsafeGovernedPath(change: CapabilityFactFileChange): boolean {
  return !isSafeGovernedPath(change.path)
    || (change.oldPath !== undefined && !isSafeGovernedPath(change.oldPath));
}

function isSafeGovernedPath(input: string): boolean {
  if (input.normalize("NFC") !== input) {
    return false;
  }
  const slashPath = input.replace(/\\/g, "/");
  const normalized = pathPosix.normalize(slashPath);
  const parts = normalized.split("/");
  return !(
    input === ""
    || normalized === "."
    || normalized === ".."
    || normalized.startsWith("../")
    || pathPosix.isAbsolute(normalized)
    || isAbsolute(input)
    || /^[a-zA-Z]:/.test(input)
    || slashPath.startsWith("//")
    || normalized !== slashPath
    || input.includes("\0")
    || input.includes("\n")
    || input.includes("\r")
    || parts.some((part) => part === "" || part === "." || part === "..")
    || parts.some((part) => part.toLocaleLowerCase("en-US") === ".git")
    || parts.some((part) => part.includes(":"))
    || parts.some((part) => part.endsWith(".") || part.endsWith(" "))
    || parts.some((part) => WINDOWS_RESERVED_NAMES.test(part))
  );
}

function compareFileChanges(
  left: CapabilityFactFileChange,
  right: CapabilityFactFileChange
): number {
  return compareCodeUnits(
    `${left.path}\0${left.kind}\0${left.oldPath ?? ""}`,
    `${right.path}\0${right.kind}\0${right.oldPath ?? ""}`
  );
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isSideEffectingCapability(scope: CapabilityScope): boolean {
  return scope.access !== "read";
}

function isReadOnlyCapability(scope: CapabilityScope): boolean {
  return scope.access === "read";
}

function dedupeCapabilityScopes(scopes: CapabilityScope[]): CapabilityScope[] {
  const seen = new Set<string>();
  const result: CapabilityScope[] = [];
  for (const scope of scopes) {
    const key = capabilityScopeToCanonicalString(scope);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(scope);
    }
  }
  return result;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)].sort();
}
