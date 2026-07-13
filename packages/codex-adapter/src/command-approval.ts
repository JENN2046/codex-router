import { z } from "zod";
import { hashKernelObject } from "../../kernel-contracts/src/index.js";

const ExecPolicyAmendmentSchema = z.array(z.string());

const NetworkPolicyAmendmentSchema = z.object({
  action: z.enum(["allow", "deny"]),
  host: z.string()
}).strict();

export const CodexCommandApprovalDecisionSchema = z.union([
  z.enum(["accept", "acceptForSession", "decline", "cancel"]),
  z.object({
    acceptWithExecpolicyAmendment: z.object({
      execpolicy_amendment: ExecPolicyAmendmentSchema
    }).strict()
  }).strict(),
  z.object({
    applyNetworkPolicyAmendment: z.object({
      network_policy_amendment: NetworkPolicyAmendmentSchema
    }).strict()
  }).strict()
]);

export type CodexCommandApprovalDecision = z.infer<
  typeof CodexCommandApprovalDecisionSchema
>;

export function commandApprovalDecisionDisposition(
  decision: CodexCommandApprovalDecision
): "accept" | "decline" {
  return decision === "decline" || decision === "cancel" ? "decline" : "accept";
}

export function commandApprovalDecisionEquals(
  left: CodexCommandApprovalDecision,
  right: CodexCommandApprovalDecision
): boolean {
  return hashKernelObject(left) === hashKernelObject(right);
}

export function isPlainCommandApprovalDecision(
  decision: CodexCommandApprovalDecision
): decision is "accept" | "decline" {
  return decision === "accept" || decision === "decline";
}
