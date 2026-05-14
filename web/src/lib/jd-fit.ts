/** Response from ``POST /me/jd-fit`` (LLM ATS-style compare). */

export type JdFitResult = {
  score: number;
  match_pct: number;
  rationale: string;
  gap_skills: string[];
  strength_skills: string[];
};

export async function postJdFit(body: {
  job_description: string;
  job_title?: string | null;
  company?: string | null;
}): Promise<JdFitResult> {
  const r = await fetch("/api/me/jd-fit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await r.json().catch(() => ({}))) as { detail?: string } & Partial<JdFitResult>;
  if (!r.ok) {
    throw new Error(typeof data.detail === "string" ? data.detail : "Could not analyse résumé for this job.");
  }
  return data as JdFitResult;
}
