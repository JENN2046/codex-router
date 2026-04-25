import type {
  ExecutionProfileName,
  IntentClassification,
  TaskClass,
  TaskEnvelope,
  TaskEnvelopeInput
} from "../../contracts/src/index.js";
import { parseTaskEnvelope } from "../../contracts/src/index.js";

const HIGH_RISK_KEYWORDS = [
  "auth",
  "permission",
  "billing",
  "payment",
  "secret",
  "env",
  "production",
  "database",
  "migration",
  "delete"
];

const RELEASE_KEYWORDS = ["release", "merge", "push", "prod/stable", "main"];
const SMALL_EDIT_KEYWORDS = ["rename", "typo", "copy", "comment", "single file", "small fix"];
const READ_ONLY_KEYWORDS = ["explain", "review", "summarize", "inspect", "analyze", "read"];
const AMBIGUOUS_SHORTCUTS = ["continue", "do it", "fix it", "that one", "same as before"];

export function classifyIntent(taskInput: TaskEnvelopeInput): IntentClassification {
  const task: TaskEnvelope = parseTaskEnvelope(taskInput);
  if (task.hints.taskClassHint) {
    return buildClassification(task.hints.taskClassHint, 0, [], false);
  }

  const haystack = `${task.intent.summary} ${task.intent.requestedAction}`.toLowerCase();
  const ambiguityReasons: string[] = [];
  let taskClass: TaskClass = "engineering";

  if (RELEASE_KEYWORDS.some((keyword) => haystack.includes(keyword))) {
    taskClass = "release_external_action";
  } else if (HIGH_RISK_KEYWORDS.some((keyword) => haystack.includes(keyword))) {
    taskClass = "high_risk";
  } else if (SMALL_EDIT_KEYWORDS.some((keyword) => haystack.includes(keyword))) {
    taskClass = "small_edit";
  } else if (READ_ONLY_KEYWORDS.some((keyword) => haystack.includes(keyword))) {
    taskClass = "read_only";
  }

  if (task.intent.summary.trim().length < 12) {
    ambiguityReasons.push("summary_too_short");
  }

  if (AMBIGUOUS_SHORTCUTS.some((keyword) => haystack.includes(keyword))) {
    ambiguityReasons.push("context_dependent_shortcut");
  }

  if (taskClass !== "read_only" && task.target.files.length === 0 && !task.repoContext.repoRoot) {
    ambiguityReasons.push("missing_target_surface");
  }

  const ambiguityScore = Math.min(1, ambiguityReasons.length * 0.35);
  const clarificationRequired = ambiguityScore >= 0.5;

  return buildClassification(taskClass, ambiguityScore, ambiguityReasons, clarificationRequired);
}

function buildClassification(
  taskClass: TaskClass,
  ambiguityScore: number,
  ambiguityReasons: string[],
  clarificationRequired: boolean
): IntentClassification {
  return {
    taskClass,
    ambiguityScore,
    ambiguityReasons,
    clarificationRequired,
    recommendedProfile: taskClassToProfile(taskClass, clarificationRequired)
  };
}

function taskClassToProfile(
  taskClass: TaskClass,
  clarificationRequired: boolean
): ExecutionProfileName {
  if (clarificationRequired) {
    return "clarify-then-plan";
  }

  switch (taskClass) {
    case "read_only":
      return "recon-only";
    case "high_risk":
      return "high-risk-change";
    case "release_external_action":
      return "release-governance";
    case "engineering":
    case "small_edit":
    default:
      return "engineering";
  }
}
