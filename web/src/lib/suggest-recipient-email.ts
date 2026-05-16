/** Best-effort careers@domain from a job listing URL (same heuristics as API). */

const BLOCKED = new Set([
  "linkedin.com",
  "indeed.com",
  "glassdoor.com",
  "greenhouse.io",
  "lever.co",
  "workday.com",
  "myworkdayjobs.com",
  "ziprecruiter.com",
]);

export function suggestRecipientEmailFromJobUrl(sourceUrl: string | null | undefined): string {
  if (!sourceUrl?.trim()) return "";
  try {
    const host = new URL(sourceUrl.trim()).hostname.toLowerCase().replace(/^www\./, "");
    if (!host || !host.includes(".")) return "";
    for (const b of BLOCKED) {
      if (host === b || host.endsWith(`.${b}`)) return "";
    }
    const parts = host.split(".");
    if (parts.length < 2) return "";
    const root = parts.slice(-2).join(".");
    return `careers@${root}`;
  } catch {
    return "";
  }
}
