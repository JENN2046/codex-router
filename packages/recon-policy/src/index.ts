export interface ReconSummaryTemplate {
  sections: string[];
  maxBulletsPerSection: number;
}

const ALLOWED_RECON_PREFIXES = [
  "git status",
  "git diff --stat",
  "git log --oneline",
  "rg ",
  "Get-ChildItem",
  "Select-String",
  "Get-Content",
  "cat ",
  "ls "
];

export const RECON_SUMMARY_TEMPLATE: ReconSummaryTemplate = {
  sections: ["surface", "risks", "next"],
  maxBulletsPerSection: 4
};

export function isReconCommandAllowed(command: string): boolean {
  return ALLOWED_RECON_PREFIXES.some((prefix) => command.startsWith(prefix));
}
