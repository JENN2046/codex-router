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
  "authentication",
  "authorization",
  "permission",
  "billing",
  "payment",
  "secret",
  "env",
  "production",
  "database",
  "migration",
  "delete",
  "删除",
  "移除",
  "重命名",
  "权限",
  "凭证",
  "密钥",
  "私钥",
  "环境变量",
  "生产",
  "网络",
  "外部"
];

const RELEASE_KEYWORDS = [
  "release",
  "merge",
  "push",
  "prod/stable",
  "main",
  "发布",
  "部署",
  "上线",
  "推送",
  "合并"
];
const ENGINEERING_KEYWORDS = ["implement", "multi-file", "refactor", "实现", "重构", "多文件"];
const SMALL_EDIT_KEYWORDS = [
  "rename",
  "typo",
  "copy",
  "comment",
  "single file",
  "small fix",
  "单文件",
  "小修改",
  "错别字"
];
const READ_ONLY_KEYWORDS = [
  "explain",
  "review",
  "summarize",
  "inspect",
  "analyze",
  "read",
  "解释",
  "审查",
  "总结",
  "检查",
  "分析",
  "读取",
  "只读"
];
const AMBIGUOUS_SHORTCUTS = [
  "continue",
  "do it",
  "fix it",
  "that one",
  "same as before",
  "继续",
  "照做",
  "就这样",
  "修一下"
];
const TASK_CLASS_RANK: Record<TaskClass, number> = {
  read_only: 0,
  small_edit: 1,
  engineering: 2,
  high_risk: 3,
  release_external_action: 4
};
const TRUSTED_HINT_SOURCES = new Set(["system", "policy", "operator"]);

export function classifyIntent(taskInput: TaskEnvelopeInput): IntentClassification {
  const task: TaskEnvelope = parseTaskEnvelope(taskInput);
  const haystack = `${task.intent.summary} ${task.intent.requestedAction}`.toLowerCase();
  const ambiguityReasons: string[] = [];
  let taskClass: TaskClass = "engineering";
  let matchedTaskClass: TaskClass | undefined;

  if (RELEASE_KEYWORDS.some((keyword) => containsKeyword(haystack, keyword))) {
    taskClass = "release_external_action";
    matchedTaskClass = taskClass;
  } else if (HIGH_RISK_KEYWORDS.some((keyword) => containsKeyword(haystack, keyword))) {
    taskClass = "high_risk";
    matchedTaskClass = taskClass;
  } else if (ENGINEERING_KEYWORDS.some((keyword) => containsKeyword(haystack, keyword))) {
    taskClass = "engineering";
    matchedTaskClass = taskClass;
  } else if (SMALL_EDIT_KEYWORDS.some((keyword) => containsKeyword(haystack, keyword))) {
    taskClass = "small_edit";
    matchedTaskClass = taskClass;
  } else if (READ_ONLY_KEYWORDS.some((keyword) => containsKeyword(haystack, keyword))) {
    taskClass = "read_only";
    matchedTaskClass = taskClass;
  }

  if (task.intent.summary.trim().length < 12) {
    ambiguityReasons.push("summary_too_short");
  }

  if (AMBIGUOUS_SHORTCUTS.some((keyword) => containsKeyword(haystack, keyword))) {
    ambiguityReasons.push("context_dependent_shortcut");
  }

  const hint = task.hints.taskClassHint;
  if (hint && hint !== taskClass) {
    const hintTrust = classifyTaskClassHintTrust(task, hint);
    if (!matchedTaskClass) {
      if (hintTrust.canSetNeutralClass || TASK_CLASS_RANK[hint] > TASK_CLASS_RANK[taskClass]) {
        taskClass = hint;
      } else {
        ambiguityReasons.push(`task_class_hint_untrusted:${hintTrust.sources.join("+")}:${hint}`);
      }
    } else {
      ambiguityReasons.push(`task_class_hint_conflict:${hint}:${taskClass}`);
      if (TASK_CLASS_RANK[hint] > TASK_CLASS_RANK[taskClass]) {
        taskClass = hint;
      }
    }
  }

  if (taskClass !== "read_only" && task.target.files.length === 0 && !task.repoContext.repoRoot) {
    ambiguityReasons.push("missing_target_surface");
  }

  const ambiguityScore = Math.min(1, ambiguityReasons.length * 0.35);
  const clarificationRequired = ambiguityScore >= 0.5;

  return buildClassification(taskClass, ambiguityScore, ambiguityReasons, clarificationRequired);
}

function containsKeyword(haystack: string, keyword: string): boolean {
  if (!/^[a-z0-9_]+$/i.test(keyword)) {
    return haystack.includes(keyword);
  }
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9_])${escaped}($|[^a-z0-9_])`, "i").test(haystack);
}

function classifyTaskClassHintTrust(
  task: TaskEnvelope,
  hint: TaskClass
): { canSetNeutralClass: boolean; sources: string[] } {
  const provenance = task.hints.provenance.filter((entry) => (
    entry.field === "taskClassHint" && entry.value === hint
  ));

  if (provenance.length === 0) {
    return {
      canSetNeutralClass: false,
      sources: ["unspecified"]
    };
  }

  const sources = [...new Set(provenance.map((entry) => entry.source))].sort();
  return {
    canSetNeutralClass: sources.some((source) => TRUSTED_HINT_SOURCES.has(source)),
    sources
  };
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
