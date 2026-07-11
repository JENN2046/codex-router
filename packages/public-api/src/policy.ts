export {
  authorizeCapabilityFacts,
  classifySemanticRiskSignal,
  deriveCapabilityFacts,
  deriveCapabilityFactsFromChangeSet,
  isSensitiveGovernedPath,
  maxRisk,
  narrowToCapabilityCeiling,
  scoreCapabilityFactsRisk
} from "../../authorization-kernel/src/index.js";
export type {
  AuthorizeCapabilityFactsInput,
  CapabilityFactsInput
} from "../../authorization-kernel/src/index.js";

export {
  canonicalizeGovernedFileChangeSet,
  evaluateAutoApprovalPolicy
} from "../../file-change-preview/src/index.js";
export type {
  AutoApprovalEvaluation,
  GovernedFileChangeDraft,
  GovernedFileChangeSetDraft
} from "../../file-change-preview/src/index.js";

export {
  AutoApprovalRuleSchema,
  ExactArgvCommandSchema,
  PreviewPolicySchema
} from "../../kernel-contracts/src/index.js";
export type {
  AutoApprovalRule,
  ExactArgvCommand,
  PreviewPolicy
} from "../../kernel-contracts/src/index.js";
