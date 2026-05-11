"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AppBadge } from "@/components/ui/badge";
import { AppButton } from "@/components/ui/button";

type Profile = {
  email?: string;
  current_role?: string | null;
  years_experience?: string | null;
  persona?: string | null;
  location?: string | null;
  contact_preferences?: string | null;
  goals?: {
    focus?: string[];
    opportunity_locations?: string[];
    job_pool_strategy?: string;
  } | null;
  plan_tier?: string | null;
};

const personaOptions = [
  { id: "student", label: "Student / recent graduate" },
  { id: "employed_exploring", label: "Employed, exploring" },
  { id: "active_search", label: "Actively job searching" },
  { id: "career_switcher", label: "Career switcher" },
];

const focusOptions = [
  { id: "improve_cv", label: "Improve CV" },
  { id: "find_jobs", label: "Find jobs" },
  { id: "interview_prep", label: "Interview prep" },
  { id: "get_promoted", label: "Get promoted" },
  { id: "boost_linkedin", label: "Boost LinkedIn" },
];

const planOptions = [
  { id: "standard", label: "Standard" },
  { id: "pro", label: "Pro" },
  { id: "ultimate", label: "Ultimate" },
];

function profileCompletion(profile: Profile): number {
  const checks = [
    Boolean(profile.persona),
    Boolean(profile.current_role),
    Boolean(profile.years_experience),
    Boolean(profile.location),
    Boolean(profile.contact_preferences),
    Boolean(profile.goals?.focus?.length),
    Boolean(profile.plan_tier),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function mergeGoals(profile: Profile, focus: string[], location: string): Profile["goals"] {
  const existing = profile.goals && typeof profile.goals === "object" ? profile.goals : {};
  const places = Array.from(
    new Set([location.trim(), ...(existing.opportunity_locations ?? []), "Remote"].filter(Boolean)),
  );
  return {
    ...existing,
    focus,
    opportunity_locations: places,
    job_pool_strategy: existing.job_pool_strategy ?? "controlled_feeds_first",
  };
}

export function CareerProfileClient() {
  const [profile, setProfile] = useState<Profile>({});
  const [persona, setPersona] = useState("active_search");
  const [currentRole, setCurrentRole] = useState("");
  const [yearsExperience, setYearsExperience] = useState("");
  const [location, setLocation] = useState("");
  const [contactPreferences, setContactPreferences] = useState("");
  const [focus, setFocus] = useState<string[]>(["find_jobs"]);
  const [planTier, setPlanTier] = useState("pro");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const completion = useMemo(() => profileCompletion(profile), [profile]);
  const focusSet = useMemo(() => new Set(focus), [focus]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const resp = await fetch("/api/me/profile", { cache: "no-store" });
        const data = (await resp.json().catch(() => ({}))) as Profile;
        if (!resp.ok || cancelled) return;
        setProfile(data);
        setPersona(data.persona || "active_search");
        setCurrentRole(data.current_role || "");
        setYearsExperience(data.years_experience || "");
        setLocation(data.location || "");
        setContactPreferences(data.contact_preferences || "");
        setFocus(data.goals?.focus?.length ? data.goals.focus : ["find_jobs"]);
        setPlanTier(data.plan_tier || "pro");
      } catch {
        if (!cancelled) setError("Could not load your profile.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function toggleFocus(id: string) {
    setFocus((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setSaving(true);
    const body: Profile = {
      persona,
      current_role: currentRole.trim() || null,
      years_experience: yearsExperience.trim() || null,
      location: location.trim() || null,
      contact_preferences: contactPreferences.trim() || null,
      goals: mergeGoals(profile, focus, location),
      plan_tier: planTier,
    };
    try {
      const resp = await fetch("/api/me/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await resp.json().catch(() => ({}))) as Profile;
      if (!resp.ok) {
        setError("Could not save your career profile.");
        return;
      }
      setProfile(data);
      setMessage("Profile saved. Your job feed, drafts, and match checks will use these details.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={saveProfile} className="mx-auto flex w-full max-w-[var(--app-content-max)] flex-col gap-[var(--app-space-lg)]">
      <section className="app-surface rounded-[var(--app-radius-lg)] p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">
              Career profile
            </div>
            <h1 className="mt-1 text-balance text-[length:var(--app-text-display)] font-medium tracking-tight text-[var(--app-text-primary)]">
              Keep your matching profile current
            </h1>
            <p className="mt-2 max-w-2xl text-pretty text-[14px] leading-6 text-[var(--app-text-secondary)]">
              These details tune your job ranking, outreach drafts, career guidance, and CV match checks.
            </p>
          </div>
          <div className="w-full max-w-sm rounded-[var(--app-radius-md)] bg-[var(--app-bg-muted)] p-3 shadow-[inset_0_0_0_0.5px_var(--app-border)]">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[12px] font-medium text-[var(--app-text-secondary)]">Profile strength</span>
              <span className="tabular-nums text-[18px] font-semibold text-[var(--app-text-primary)]">{completion}%</span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--app-bg-page)]">
              <div className="h-full rounded-full bg-[var(--app-accent)]" style={{ width: `${completion}%` }} />
            </div>
          </div>
        </div>
      </section>

      {error ? (
        <div role="alert" className="rounded-[var(--app-radius-md)] border-[0.5px] border-[color-mix(in_srgb,var(--app-danger)_35%,var(--app-border))] bg-[color-mix(in_srgb,var(--app-danger)_10%,transparent)] px-4 py-3 text-[13px] text-[var(--app-danger)]">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-[var(--app-radius-md)] border-[0.5px] border-[color-mix(in_srgb,var(--app-success)_35%,var(--app-border))] bg-[color-mix(in_srgb,var(--app-success)_10%,transparent)] px-4 py-3 text-[13px] text-[var(--app-success)]">
          {message}
        </div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="app-surface rounded-[var(--app-radius-lg)] p-5">
          <div className="grid gap-5">
            <div>
              <label className="text-[13px] font-medium text-[var(--app-text-primary)]" htmlFor="current-role">
                Current role
              </label>
              <input
                id="current-role"
                value={currentRole}
                disabled={loading}
                onChange={(e) => setCurrentRole(e.target.value)}
                className="mt-2 h-11 w-full rounded-[var(--app-radius-md)] border-[0.5px] border-[var(--app-border)] bg-[var(--app-bg-page)] px-3 text-[14px] text-[var(--app-text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)]"
                placeholder="Product Manager, Backend Engineer, Student…"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-[13px] font-medium text-[var(--app-text-primary)]" htmlFor="years">
                Years of experience
                <input
                  id="years"
                  value={yearsExperience}
                  disabled={loading}
                  onChange={(e) => setYearsExperience(e.target.value)}
                  className="mt-2 h-11 w-full rounded-[var(--app-radius-md)] border-[0.5px] border-[var(--app-border)] bg-[var(--app-bg-page)] px-3 text-[14px] text-[var(--app-text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)]"
                  placeholder="3-5"
                />
              </label>
              <label className="text-[13px] font-medium text-[var(--app-text-primary)]" htmlFor="location">
                Location
                <input
                  id="location"
                  value={location}
                  disabled={loading}
                  onChange={(e) => setLocation(e.target.value)}
                  className="mt-2 h-11 w-full rounded-[var(--app-radius-md)] border-[0.5px] border-[var(--app-border)] bg-[var(--app-bg-page)] px-3 text-[14px] text-[var(--app-text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)]"
                  placeholder="Accra, Ghana"
                />
              </label>
            </div>
            <label className="text-[13px] font-medium text-[var(--app-text-primary)]" htmlFor="contact">
              Contact preference
              <input
                id="contact"
                value={contactPreferences}
                disabled={loading}
                onChange={(e) => setContactPreferences(e.target.value)}
                className="mt-2 h-11 w-full rounded-[var(--app-radius-md)] border-[0.5px] border-[var(--app-border)] bg-[var(--app-bg-page)] px-3 text-[14px] text-[var(--app-text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)]"
                placeholder="Email first, LinkedIn ok, recruiters ok…"
              />
            </label>
          </div>
        </div>

        <aside className="app-surface rounded-[var(--app-radius-lg)] p-5">
          <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">
            Profile signals
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {profile.email ? <AppBadge variant="gray">{profile.email}</AppBadge> : null}
            {profile.goals?.job_pool_strategy ? <AppBadge variant="blue">Controlled feeds</AppBadge> : null}
            {profile.location ? <AppBadge variant="green">{profile.location}</AppBadge> : null}
          </div>
          <p className="mt-4 text-[12px] leading-5 text-[var(--app-text-secondary)]">
            To refresh location detection or re-run the guided setup, open onboarding anytime.
          </p>
          <Link className="mt-4 inline-flex text-[12px] font-semibold text-[var(--app-accent)] underline-offset-4 hover:underline" href="/onboarding/contact">
            Update guided setup
          </Link>
        </aside>
      </section>

      <section className="app-surface rounded-[var(--app-radius-lg)] p-5">
        <div className="grid gap-6 lg:grid-cols-3">
          <div>
            <div className="text-[13px] font-medium text-[var(--app-text-primary)]">Career stage</div>
            <div className="mt-3 grid gap-2">
              {personaOptions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={loading}
                  onClick={() => setPersona(item.id)}
                  aria-pressed={persona === item.id}
                  className={`min-h-10 rounded-[var(--app-radius-md)] border-[0.5px] px-3 text-left text-[13px] font-medium transition-colors ${
                    persona === item.id
                      ? "border-[color-mix(in_srgb,var(--app-accent)_55%,var(--app-border))] bg-[color-mix(in_srgb,var(--app-accent)_9%,var(--app-bg-elevated))] text-[var(--app-text-primary)]"
                      : "border-[var(--app-border)] text-[var(--app-text-secondary)] hover:bg-[var(--app-bg-muted)]"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[13px] font-medium text-[var(--app-text-primary)]">Focus areas</div>
            <div className="mt-3 grid gap-2">
              {focusOptions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={loading}
                  onClick={() => toggleFocus(item.id)}
                  aria-pressed={focusSet.has(item.id)}
                  className={`min-h-10 rounded-[var(--app-radius-md)] border-[0.5px] px-3 text-left text-[13px] font-medium transition-colors ${
                    focusSet.has(item.id)
                      ? "border-[color-mix(in_srgb,var(--app-accent)_55%,var(--app-border))] bg-[color-mix(in_srgb,var(--app-accent)_9%,var(--app-bg-elevated))] text-[var(--app-text-primary)]"
                      : "border-[var(--app-border)] text-[var(--app-text-secondary)] hover:bg-[var(--app-bg-muted)]"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[13px] font-medium text-[var(--app-text-primary)]">Plan tier</div>
            <div className="mt-3 grid gap-2">
              {planOptions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={loading}
                  onClick={() => setPlanTier(item.id)}
                  aria-pressed={planTier === item.id}
                  className={`min-h-10 rounded-[var(--app-radius-md)] border-[0.5px] px-3 text-left text-[13px] font-medium transition-colors ${
                    planTier === item.id
                      ? "border-[color-mix(in_srgb,var(--app-accent)_55%,var(--app-border))] bg-[color-mix(in_srgb,var(--app-accent)_9%,var(--app-bg-elevated))] text-[var(--app-text-primary)]"
                      : "border-[var(--app-border)] text-[var(--app-text-secondary)] hover:bg-[var(--app-bg-muted)]"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="sticky bottom-4 z-10 flex justify-end">
        <AppButton disabled={loading || saving || focus.length === 0} type="submit" variant="primary">
          {saving ? "Saving..." : "Save career profile"}
        </AppButton>
      </div>
    </form>
  );
}
