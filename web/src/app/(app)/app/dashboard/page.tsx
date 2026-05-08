import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
};

type Profile = {
  email?: string;
  persona?: string | null;
  goals?: { focus?: string[] } | null;
  plan_tier?: string | null;
};

function personaLabel(persona: string | null | undefined): string {
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
      return "Career stage not set";
  }
}

function goalLabel(id: string): string {
  switch (id) {
    case "improve_cv":
      return "Improve CV";
    case "find_jobs":
      return "Find jobs";
    case "interview_prep":
      return "Interview prep";
    case "get_promoted":
      return "Get promoted";
    case "boost_linkedin":
      return "Boost LinkedIn";
    default:
      return id;
  }
}

export default async function DashboardPage() {
  const profile = await fetch("/api/me/profile", { cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<Profile>) : ({} as Profile)))
    .catch(() => ({} as Profile));

  const focus = Array.isArray(profile.goals?.focus) ? profile.goals?.focus : [];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-balance text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-2 max-w-2xl text-pretty text-sm leading-6 text-[var(--muted)]">
          {profile.email ? (
            <>
              Signed in as <span className="font-semibold text-[var(--foreground)]">{profile.email}</span> ·{" "}
              <span className="font-semibold text-[var(--foreground)]">{personaLabel(profile.persona)}</span>
              {profile.plan_tier ? (
                <>
                  {" "}
                  · Plan: <span className="font-semibold text-[var(--foreground)]">{profile.plan_tier}</span>
                </>
              ) : null}
            </>
          ) : (
            "Personalizing your workspace…"
          )}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--border)] p-6">
          <div className="text-sm font-semibold tracking-tight">Your focus</div>
          <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
            These defaults come from your career stage — you can edit them in onboarding anytime.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {focus.length ? (
              focus.map((g) => (
                <span
                  key={g}
                  className="inline-flex items-center rounded-full border border-[var(--border)] bg-black/5 px-3 py-1 text-xs font-semibold text-[var(--foreground)] dark:bg-white/5"
                >
                  {goalLabel(g)}
                </span>
              ))
            ) : (
              <span className="text-sm text-[var(--muted)]">No goals selected yet.</span>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] p-6">
          <div className="text-sm font-semibold tracking-tight">Recommended next steps</div>
          <ul className="mt-4 space-y-2 text-sm text-[var(--muted)]">
            <li>
              - Go to <span className="font-semibold text-[var(--foreground)]">Job Discovery</span> and save 10 roles.
            </li>
            <li>
              - Generate an outreach draft and approve it in <span className="font-semibold text-[var(--foreground)]">Approvals</span>.
            </li>
            <li>
              - Ask Copilot for a 7-day sprint plan tailored to your persona.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

