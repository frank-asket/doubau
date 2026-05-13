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

/** Five-step Pathfinder wizard — all optional fields; partial answers still tune cards. */
export type PathfinderNorthStar =
  | "ic_depth"
  | "leadership"
  | "new_company"
  | "promotion"
  | "pivot"
  | "exploring";

export type PathfinderConstraint = "time" | "location" | "visa" | "confidence" | "comp" | "none";
export type PathfinderWeeklyCapacity = "low" | "mid" | "high";
export type PathfinderProof = "metrics" | "shipping" | "people" | "learning";
export type PathfinderRisk = "low" | "mid" | "high";

export type PathfinderWizardAnswers = {
  northStar: PathfinderNorthStar;
  constraint: PathfinderConstraint;
  weeklyCapacity: PathfinderWeeklyCapacity;
  proof: PathfinderProof;
  risk: PathfinderRisk;
};

export type CareerPathCard = {
  id: string;
  title: string;
  subtitle: string;
  body: string;
  meta: string[];
  match: number;
  timeframe: string;
  required: string[];
  transferable: string[];
  primaryCta: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
};

export type WorkspacePathfinderDto = {
  resume_status?: string | null;
  persona?: string | null;
  current_role?: string | null;
  applications_total?: number;
  applications_by_status?: Record<string, number>;
  pending_approval_count?: number;
};

function clampMatch(n: number): number {
  return Math.min(96, Math.max(38, Math.round(n)));
}

function goalRequiredSkills(goalId: string): string[] {
  if (goalId === "interview_prep") return ["Structured stories", "Role-specific practice", "Feedback loop"];
  if (goalId === "find_jobs") return ["Market mapping", "Tailored CV bullets", "Outbound sequencing"];
  if (goalId === "improve_cv") return ["ATS-ready layout", "Quantified wins", "Keyword alignment"];
  if (goalId === "boost_linkedin") return ["Headline clarity", "Featured proof points", "Consistent narrative"];
  if (goalId === "get_promoted") return ["Stakeholder visibility", "Impact metrics", "Prioritisation"];
  return ["Clarity on outcomes", "Evidence of impact", "Consistent narrative"];
}

function wizardBoost(pathId: string, w: Partial<PathfinderWizardAnswers>): number {
  let b = 0;
  const ns = w.northStar;
  if (ns === "new_company" && (pathId.includes("find_jobs") || pathId === "pipeline-momentum")) b += 5;
  if (ns === "promotion" && (pathId.includes("get_promoted") || pathId.includes("boost_linkedin"))) b += 5;
  if (ns === "pivot" && (pathId.includes("improve_cv") || pathId === "archetype-pivot")) b += 5;
  if (ns === "ic_depth" && pathId.includes("improve_cv")) b += 4;
  if (ns === "leadership" && (pathId.includes("get_promoted") || pathId.includes("interview_prep"))) b += 4;
  if (ns === "exploring" && pathId === "foundation-clarify") b += 3;

  const c = w.constraint;
  if (c === "time" && pathId.includes("find_jobs")) b += 2;
  if (c === "visa" && pathId.includes("find_jobs")) b += 3;
  if (c === "confidence" && pathId.includes("interview_prep")) b += 4;

  const cap = w.weeklyCapacity;
  if (cap === "high" && pathId === "pipeline-momentum") b += 3;
  if (cap === "low" && (pathId.includes("improve_cv") || pathId.includes("linkedin"))) b += 2;

  const p = w.proof;
  if (p === "metrics" && pathId.includes("get_promoted")) b += 3;
  if (p === "shipping" && pathId.includes("find_jobs")) b += 3;
  if (p === "people" && pathId.includes("boost_linkedin")) b += 3;

  const r = w.risk;
  if (r === "high" && pathId.includes("find_jobs")) b += 2;
  if (r === "low" && (pathId.includes("interview_prep") || pathId.includes("improve_cv"))) b += 2;

  return b;
}

function timeframeFor(pathId: string, weekly: PathfinderWeeklyCapacity | undefined): string {
  const base = weekly === "low" ? "4–8 wks" : weekly === "high" ? "2–4 wks" : "3–6 wks";
  if (pathId.includes("interview_prep")) return "1–3 wks";
  if (pathId === "foundation-clarify") return "3–5 days";
  if (pathId === "pipeline-momentum") return "ongoing";
  return base;
}

/**
 * Deterministic “path” cards from profile, goals, résumé structure, workspace counts, and optional wizard answers.
 * No external ML — scores are transparent heuristics for prioritisation and copy.
 */
export function buildCareerPathCards(opts: {
  profile: ProfileDto | undefined;
  structured: Record<string, unknown> | null;
  skills: string[];
  readiness: number;
  workspace: WorkspacePathfinderDto | undefined;
  wizard: Partial<PathfinderWizardAnswers>;
  extractedText: string | null | undefined;
}): CareerPathCard[] {
  const { profile, structured, skills, readiness, workspace, wizard, extractedText } = opts;
  const role = profile?.current_role?.trim() || "your target role";
  const loc = profile?.location?.trim() || "your location";
  const exp = profile?.years_experience?.trim() || "Experience not set";
  const personaRaw = (workspace?.persona ?? profile?.persona ?? "").trim();
  const persona = personaRaw.toLowerCase();
  const transfer = skills.slice(0, 5);
  const fallbackTransfer = ["Problem solving", "Collaboration", "Delivery"];
  const transferOut = transfer.length ? transfer : fallbackTransfer;

  const scores = linkedinStyleScores(structured, extractedText?.trim() || null);
  const profileSignal = structured ? overallProfileScore(scores) : null;
  const baseMeta = [loc, exp, `${readiness}% résumé readiness`];
  if (profileSignal != null) baseMeta.push(`${profileSignal}/100 profile signal`);

  const totalApps = workspace?.applications_total ?? 0;
  const pending = workspace?.pending_approval_count ?? 0;
  const by = workspace?.applications_by_status ?? {};
  const submitted = typeof by.SUBMITTED === "number" ? by.SUBMITTED : 0;

  const focusIds = goalFocusList(profile?.goals ?? null);
  const paths: CareerPathCard[] = [];

  const push = (card: CareerPathCard) => {
    paths.push({
      ...card,
      match: clampMatch(card.match + wizardBoost(card.id, wizard)),
    });
  };

  if (!focusIds.length) {
    push({
      id: "foundation-clarify",
      title: "Clarify your goals",
      subtitle: "Unlock sharper discovery and CV work",
      body: `Add goal focus in Settings so Doubow can prioritise discovery, CV iterations, and milestones around ${role}.`,
      meta: baseMeta,
      match: 58 + readiness / 6 + (profileSignal ? profileSignal / 25 : 0),
      timeframe: timeframeFor("foundation-clarify", wizard.weeklyCapacity),
      required: transferOut.slice(0, 3),
      transferable: transferOut,
      primaryCta: { label: "Set goals", href: "/app/settings" },
      secondaryCta: { label: "Career profile", href: "/app/career-profile" },
    });
  } else {
    focusIds.forEach((id, index) => {
      const label = labelForGoalId(id);
      const pid = `goal-${id}`;
      push({
        id: pid,
        title: `${label} track`,
        subtitle: `Goal-led plan for ${role}`,
        body: `Aligned with “${label}” while you position as ${role}. Combine Discovery, CV updates, and milestones — wizard answers tune how aggressive this path reads.`,
        meta: baseMeta,
        match: 56 + index * 4 + readiness / 8 + (profileSignal ? profileSignal / 30 : 0),
        timeframe: timeframeFor(pid, wizard.weeklyCapacity),
        required: goalRequiredSkills(id),
        transferable: transferOut,
        primaryCta:
          id === "find_jobs"
            ? { label: "Open Discovery", href: "/app/discovery" }
            : id === "interview_prep"
              ? { label: "Interview prep", href: "/app/interview-prep" }
              : { label: "Open Planner", href: "/app/planner" },
        secondaryCta: { label: "Career steps", href: "/app/career-steps" },
      });
    });
  }

  if (persona === "career_switcher" || wizard.northStar === "pivot") {
    push({
      id: "archetype-pivot",
      title: "Credibility bridge",
      subtitle: "Reframe past wins for a new lane",
      body: `Package transferable proof so hiring managers see continuity into ${role}, not just domain change.`,
      meta: [...baseMeta, personaRaw ? `Persona: ${personaLabel(personaRaw)}` : "Persona unset"],
      match: 62 + readiness / 10,
      timeframe: timeframeFor("archetype-pivot", wizard.weeklyCapacity),
      required: ["One-page narrative", "Two proof stories", "Keyword bridge table"],
      transferable: transferOut,
      primaryCta: { label: "CV builder", href: "/app/cv-builder" },
      secondaryCta: { label: "Skill gap", href: "/app/skill-gap-analysis" },
    });
  }

  if (persona === "student" || persona === "employed_exploring") {
    push({
      id: "archetype-first-proof",
      title: "First-proof packaging",
      subtitle: "Projects, coursework, and volunteer signal",
      body: `Stack evidence that substitutes for years in-role — especially useful while targeting ${role}.`,
      meta: baseMeta,
      match: 60 + readiness / 9,
      timeframe: timeframeFor("archetype-first-proof", wizard.weeklyCapacity),
      required: ["Project blurbs", "Impact bullets", "Skills block"],
      transferable: transferOut,
      primaryCta: { label: "CV builder", href: "/app/cv-builder" },
      secondaryCta: { label: "LinkedIn analysis", href: "/app/linkedin-analysis" },
    });
  }

  if (totalApps >= 3) {
    push({
      id: "pipeline-momentum",
      title: "Pipeline hygiene",
      subtitle: "Tighten quality as volume grows",
      body: `You have ${totalApps} applications (${submitted} submitted). Use approvals and tracker to keep outreach on-brand for ${role}.${pending ? ` ${pending} draft(s) awaiting approval.` : ""}`,
      meta: [...baseMeta, `${totalApps} applications`],
      match: 64 + Math.min(12, totalApps) + (pending ? 3 : 0),
      timeframe: timeframeFor("pipeline-momentum", wizard.weeklyCapacity),
      required: ["Approval rhythm", "Recipient QA", "Status hygiene"],
      transferable: transferOut,
      primaryCta: { label: "Job Tracker", href: "/app/tracker" },
      secondaryCta: { label: "Approvals", href: "/app/approvals" },
    });
  }

  paths.sort((a, b) => b.match - a.match);
  return paths.slice(0, 6);
}
