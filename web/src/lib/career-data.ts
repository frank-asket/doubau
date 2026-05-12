/** Helpers for Career growth pages — normalize profile, résumé JSON, and check-ins. */

export type ProfileDto = {
  email?: string;
  persona?: string | null;
  current_role?: string | null;
  years_experience?: string | null;
  location?: string | null;
  contact_preferences?: string | null;
  goals?: Record<string, unknown> | null;
  plan_tier?: string | null;
};

export type ResumeLatestDto = {
  status?: string | null;
  parsed_json?: Record<string, unknown> | null;
  extracted_text?: string | null;
  embedding_dimensions?: number | null;
};

export type CheckInDto = {
  id: string;
  mood: number | null;
  energy: number | null;
  workload: number | null;
  notes: string | null;
  created_at: string;
};

const GOAL_LABELS: Record<string, string> = {
  improve_cv: "Improve CV",
  find_jobs: "Find jobs",
  interview_prep: "Interview prep",
  get_promoted: "Get promoted",
  boost_linkedin: "Boost LinkedIn",
};

export function labelForGoalId(id: string): string {
  return GOAL_LABELS[id] ?? id.replaceAll("_", " ");
}

export function goalFocusList(goals: Record<string, unknown> | null | undefined): string[] {
  if (!goals || typeof goals !== "object") return [];
  const raw = goals.focus;
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string" && x.length > 0);
}

/** Prefer LLM-structured résumé JSON, then heuristic structure. */
export function getResumeStructured(parsedJson: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!parsedJson || typeof parsedJson !== "object") return null;
  const llm = parsedJson.structured_llm;
  if (llm && typeof llm === "object") return llm as Record<string, unknown>;
  const st = parsedJson.structured;
  if (st && typeof st === "object") return st as Record<string, unknown>;
  return null;
}

export function resumeSkills(structured: Record<string, unknown> | null): string[] {
  if (!structured) return [];
  const skills = structured.skills;
  if (!Array.isArray(skills)) return [];
  return skills.filter((s): s is string => typeof s === "string" && s.trim().length > 0).slice(0, 24);
}

export function personaLabel(persona: string | null | undefined): string {
  switch (persona) {
    case "student":
      return "Student / recent graduate";
    case "employed_exploring":
      return "Employed, exploring";
    case "active_search":
      return "Actively job searching";
    case "career_switcher":
      return "Career switcher";
    default:
      return persona?.replaceAll("_", " ") ?? "—";
  }
}

export function readinessPercent(resumeStatus: string | null | undefined): number {
  const s = (resumeStatus ?? "").toUpperCase();
  if (s === "EMBEDDED") return 100;
  if (s === "PARSED") return 72;
  if (s === "UPLOADED") return 40;
  if (s === "FAILED") return 12;
  return 0;
}

export function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/** Consecutive UTC days (from today backward) with mood ≥ threshold. */
export function goodDayStreak(checkIns: CheckInDto[], moodThreshold = 4): number {
  const goodDays = new Set<string>();
  for (const c of checkIns) {
    if (c.mood == null || c.mood < moodThreshold) continue;
    const d = new Date(c.created_at);
    if (Number.isNaN(d.getTime())) continue;
    goodDays.add(d.toISOString().slice(0, 10));
  }
  let streak = 0;
  const d = new Date();
  for (let i = 0; i < 365; i++) {
    const key = d.toISOString().slice(0, 10);
    if (goodDays.has(key)) streak += 1;
    else break;
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return streak;
}

export function moodSeriesLastN(checkIns: CheckInDto[], n = 14): { label: string; mood: number | null }[] {
  const byDay = new Map<string, CheckInDto>();
  const sorted = [...checkIns].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  for (const c of sorted) {
    const day = new Date(c.created_at).toISOString().slice(0, 10);
    byDay.set(day, c);
  }
  const out: { label: string; mood: number | null }[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const dt = new Date(today);
    dt.setUTCDate(dt.getUTCDate() - i);
    const key = dt.toISOString().slice(0, 10);
    const row = byDay.get(key);
    out.push({
      label: `${dt.getUTCMonth() + 1}/${dt.getUTCDate()}`,
      mood: row?.mood ?? null,
    });
  }
  return out;
}

/** Simple 1–10 scores from structured résumé fields (UX hint, not ML). */
export function linkedinStyleScores(structured: Record<string, unknown> | null, extractedFallback: string | null): {
  headline: number;
  summary: number;
  experience: number;
  education: number;
  other: number;
} {
  const headline = typeof structured?.headline === "string" ? structured.headline.trim() : "";
  const summary = typeof structured?.summary === "string" ? structured.summary.trim() : "";
  const exp = Array.isArray(structured?.experience) ? structured!.experience : [];
  const edu = Array.isArray(structured?.education) ? structured!.education : [];

  const scoreHeadline = () => {
    const h = headline || (extractedFallback ? extractedFallback.split("\n")[0]?.trim() : "") || "";
    if (!h) return 2;
    const len = h.length;
    if (len >= 35 && len <= 220) return 8;
    if (len >= 20) return 6;
    return 4;
  };

  const scoreSummary = () => {
    const s = summary;
    if (!s) return 3;
    if (s.length >= 320) return 9;
    if (s.length >= 160) return 7;
    if (s.length >= 80) return 5;
    return 4;
  };

  const scoreExp = () => {
    let bullets = 0;
    for (const row of exp as unknown[]) {
      if (!row || typeof row !== "object") continue;
      const b = (row as { bullets?: unknown }).bullets;
      if (Array.isArray(b)) bullets += b.filter((x) => typeof x === "string" && x.trim()).length;
    }
    if (bullets >= 8) return 9;
    if (bullets >= 4) return 7;
    if (bullets >= 1) return 5;
    return 3;
  };

  const scoreEdu = () => {
    if (edu.length >= 2) return 8;
    if (edu.length === 1) return 6;
    return 4;
  };

  const scoreOther = () => {
    const skills = resumeSkills(structured);
    const links = Array.isArray(structured?.links) ? structured!.links : [];
    const linkN = links.filter((x) => typeof x === "string").length;
    const raw = skills.length + linkN * 2;
    if (raw >= 10) return 8;
    if (raw >= 5) return 6;
    if (raw >= 1) return 5;
    return 4;
  };

  return {
    headline: scoreHeadline(),
    summary: scoreSummary(),
    experience: scoreExp(),
    education: scoreEdu(),
    other: scoreOther(),
  };
}

export function overallProfileScore(scores: ReturnType<typeof linkedinStyleScores>): number {
  const vals = Object.values(scores);
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) * 10;
}
