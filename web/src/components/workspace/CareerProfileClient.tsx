"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { AppIcon } from "@/components/ui/app-icon";
import {
  getResumeStructured,
  goalFocusList,
  labelForGoalId,
  personaLabel,
  readinessPercent,
  resumeSkills,
  type ProfileDto,
  type ResumeLatestDto,
} from "@/lib/career-data";
import { queryKeys } from "@/lib/query-keys";

import { ProgressLine, Tag } from "./CareerHeroMockSections";
import { ProductPageChrome } from "./ProductPageChrome";

type WorkspaceSummary = {
  resume_status?: string | null;
  current_role?: string | null;
  location?: string | null;
};

const WIZARD_STORAGE_KEY = "career-profile-wizard-step";

type WizardStepDef = {
  id: "personal" | "skills" | "goals" | "workstyle";
  label: string;
  headline: string;
  subtitle: string;
};

const WIZARD_STEPS: WizardStepDef[] = [
  {
    id: "personal",
    label: "Personal",
    headline: "Personal & role",
    subtitle: "Email, current role, experience, location, and your parsed professional summary.",
  },
  {
    id: "skills",
    label: "Skills",
    headline: "Skills & expertise",
    subtitle: "Signals extracted from your latest résumé — refine your CV to update this list.",
  },
  {
    id: "goals",
    label: "Goals",
    headline: "Career goals",
    subtitle: "Focus areas saved on your profile. Edit selections in Settings when your priorities shift.",
  },
  {
    id: "workstyle",
    label: "Work style",
    headline: "Persona & preferences",
    subtitle: "How you prefer to work and communicate — from your saved profile fields.",
  },
];

export function CareerProfileClient() {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(WIZARD_STORAGE_KEY);
      if (raw == null) return;
      const n = Number.parseInt(raw, 10);
      if (Number.isFinite(n) && n >= 0 && n < WIZARD_STEPS.length) setStepIndex(n);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(WIZARD_STORAGE_KEY, String(stepIndex));
    } catch {
      /* ignore */
    }
  }, [stepIndex]);

  const profileQ = useQuery({
    queryKey: queryKeys.profile,
    queryFn: async () => {
      const r = await fetch("/api/me/profile", { cache: "no-store" });
      if (!r.ok) throw new Error("profile");
      return (await r.json()) as ProfileDto;
    },
  });

  const workspaceQ = useQuery({
    queryKey: queryKeys.workspaceSummary,
    queryFn: async () => {
      const r = await fetch("/api/me/workspace/summary", { cache: "no-store" });
      if (!r.ok) throw new Error("workspace");
      return (await r.json()) as WorkspaceSummary;
    },
  });

  const resumeQ = useQuery({
    queryKey: queryKeys.resumeLatest,
    queryFn: async () => {
      const r = await fetch("/api/me/resume/latest", { cache: "no-store" });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error("resume");
      return (await r.json()) as ResumeLatestDto;
    },
  });

  const profile = profileQ.data;
  const structured = useMemo(
    () => getResumeStructured(resumeQ.data?.parsed_json ?? null),
    [resumeQ.data?.parsed_json],
  );
  const skills = useMemo(() => resumeSkills(structured), [structured]);
  const readiness = readinessPercent(workspaceQ.data?.resume_status ?? resumeQ.data?.status);
  const focuses = goalFocusList(profile?.goals ?? null);

  const summaryBlurb =
    typeof structured?.summary === "string" && structured.summary.trim()
      ? structured.summary.trim().slice(0, 420)
      : null;

  const current = WIZARD_STEPS[stepIndex] ?? WIZARD_STEPS[0];
  const wizardPct = Math.round(((stepIndex + 1) / WIZARD_STEPS.length) * 100);
  const loading = profileQ.isLoading || workspaceQ.isLoading;

  const goBack = () => setStepIndex((i) => Math.max(0, i - 1));
  const goNext = () => setStepIndex((i) => Math.min(WIZARD_STEPS.length - 1, i + 1));

  return (
    <ProductPageChrome
      title="Career profile"
      description="Four-step walkthrough (Personal → Skills → Goals → Work style) over your live Doubow profile and latest parsed résumé — same data as before, with onboarding-style navigation."
    >
      <section className="ch-panel p-6">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-[22px] font-bold tracking-tight text-[var(--app-text-primary)]">
                Career profile wizard
              </h2>
              <p className="mt-2 max-w-3xl text-[14px] leading-6 text-[var(--app-text-secondary)]">
                Step through the four areas we use for matching and drafts. Edit underlying fields in Settings or CV
                Builder; this page is your consolidated read-out.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Tag active>Step {stepIndex + 1} of 4</Tag>
                <Tag>{current.label}</Tag>
                <Link
                  href="/app/settings"
                  className="inline-flex min-h-8 items-center rounded-full border border-[var(--app-border)] bg-[var(--app-bg-elevated)] px-3 text-[12px] font-semibold text-[var(--app-text-secondary)] hover:bg-[var(--app-bg-muted)]"
                >
                  Edit in Settings
                </Link>
              </div>
            </div>
          </div>
        </div>
        <div className="mx-auto mt-6 max-w-5xl">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--app-accent)]">
                Résumé pipeline
              </p>
              <p className="mt-1 text-[13px] text-[var(--app-text-secondary)]">
                Readiness drives embeddings and job fit.{" "}
                <Link href="/app/cv-builder" className="font-medium text-[var(--app-accent)] hover:underline">
                  Manage CV
                </Link>
              </p>
            </div>
            <span className="text-[20px] font-bold tabular-nums text-[var(--app-text-primary)]">{readiness}%</span>
          </div>
          <div className="mt-3 grid grid-cols-[1fr_auto] items-center gap-4">
            <ProgressLine value={readiness} />
          </div>
        </div>
      </section>

      {loading ? (
        <p className="text-[13px] text-[var(--app-text-secondary)]">Loading profile…</p>
      ) : profileQ.isError ? (
        <p className="text-[13px] text-[var(--app-badge-red-fg)]">Could not load profile.</p>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,220px)_1fr]">
          <nav
            aria-label="Career profile steps"
            className="rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-3 lg:sticky lg:top-24 lg:self-start"
          >
            <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--app-text-tertiary)]">
              Sections
            </p>
            <ul className="space-y-1">
              {WIZARD_STEPS.map((s, i) => {
                const active = i === stepIndex;
                const done = i < stepIndex;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => setStepIndex(i)}
                      className={`flex w-full min-h-11 items-center gap-3 rounded-[var(--app-radius-md)] px-2 py-2 text-left transition ${
                        active
                          ? "bg-[color-mix(in_srgb,var(--app-accent)_12%,transparent)] shadow-[var(--app-shadow-0)]"
                          : "hover:bg-[var(--app-bg-muted)]"
                      }`}
                    >
                      <span
                        className={`grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-bold tabular-nums ${
                          done
                            ? "bg-[var(--app-accent)] text-white"
                            : active
                              ? "border-2 border-[var(--app-accent)] text-[var(--app-accent)]"
                              : "border border-[var(--app-border)] text-[var(--app-text-tertiary)]"
                        }`}
                      >
                        {done ? "✓" : i + 1}
                      </span>
                      <span className="min-w-0">
                        <span
                          className={`block text-[13px] font-semibold leading-tight ${
                            active ? "text-[var(--app-text-primary)]" : "text-[var(--app-text-secondary)]"
                          }`}
                        >
                          {s.label}
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] text-[var(--app-text-tertiary)]">
                          {s.headline}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="min-w-0">
            <section className="rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-5 sm:p-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--app-accent)]">
                    Step {stepIndex + 1} of {WIZARD_STEPS.length}
                  </p>
                  <h3 className="mt-1 text-[20px] font-bold text-[var(--app-text-primary)]">{current.headline}</h3>
                  <p className="mt-1 max-w-2xl text-[14px] leading-snug text-[var(--app-text-secondary)]">{current.subtitle}</p>
                </div>
                <span className="text-[12px] tabular-nums text-[var(--app-text-tertiary)]">{wizardPct}%</span>
              </div>
              <div className="mt-4 max-w-xl">
                <ProgressLine value={wizardPct} color="var(--app-accent)" />
              </div>

              <div className="mt-8 border-t border-[var(--app-border)] pt-8">
                {current.id === "personal" ? (
                  <>
                    <dl className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">
                          Email
                        </dt>
                        <dd className="mt-1 text-[15px] text-[var(--app-text-primary)]">{profile?.email ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">
                          Current role
                        </dt>
                        <dd className="mt-1 text-[15px] text-[var(--app-text-primary)]">{profile?.current_role?.trim() || "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">
                          Experience
                        </dt>
                        <dd className="mt-1 text-[15px] text-[var(--app-text-primary)]">{profile?.years_experience?.trim() || "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">
                          Location
                        </dt>
                        <dd className="mt-1 text-[15px] text-[var(--app-text-primary)]">{profile?.location?.trim() || "—"}</dd>
                      </div>
                    </dl>
                    {summaryBlurb ? (
                      <div className="mt-8 border-t border-dashed border-[var(--app-border)] pt-6">
                        <h4 className="text-[15px] font-bold">Professional summary</h4>
                        <p className="mt-3 text-[15px] leading-7 text-[var(--app-text-secondary)]">{summaryBlurb}</p>
                      </div>
                    ) : (
                      <p className="mt-8 text-[13px] text-[var(--app-text-secondary)]">
                        No structured summary yet — upload a résumé on{" "}
                        <Link href="/app/cv-builder" className="font-medium text-[var(--app-accent)] hover:underline">
                          CV Builder
                        </Link>{" "}
                        to populate this section.
                      </p>
                    )}
                  </>
                ) : null}

                {current.id === "skills" ? (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <p className="text-[13px] text-[var(--app-text-secondary)]">Parsed from your latest résumé.</p>
                      <span className="text-[12px] font-medium text-[var(--app-text-tertiary)]">
                        Status: {resumeQ.data?.status ?? "No upload"}
                      </span>
                    </div>
                    {resumeQ.isLoading ? (
                      <p className="mt-6 text-[13px] text-[var(--app-text-secondary)]">Loading résumé…</p>
                    ) : !skills.length ? (
                      <p className="mt-6 text-[13px] text-[var(--app-text-secondary)]">
                        Parsed skills will appear after your résumé is processed.{" "}
                        <Link href="/app/cv-builder" className="font-medium text-[var(--app-accent)] hover:underline">
                          Upload a CV
                        </Link>
                        .
                      </p>
                    ) : (
                      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {skills.map((name) => (
                          <article key={name} className="ch-soft-card p-4">
                            <div className="flex items-center gap-3">
                              <span className="grid size-10 place-items-center rounded-full bg-[#1d1d1f] text-white">
                                <AppIcon name="layers" className="size-4" />
                              </span>
                              <h4 className="text-[15px] font-bold leading-snug">{name}</h4>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Tag>On résumé</Tag>
                            </div>
                            <div className="mt-4">
                              <div className="mb-1.5 flex justify-between text-[12px] font-semibold">
                                <span>Pipeline signal</span>
                                <span className="tabular-nums">{readiness}%</span>
                              </div>
                              <ProgressLine value={readiness} />
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </>
                ) : null}

                {current.id === "goals" ? (
                  <>
                    <p className="text-[13px] text-[var(--app-text-secondary)]">
                      Pulled from <code className="text-[12px]">goals.focus</code>. Changes apply from{" "}
                      <Link href="/app/settings" className="font-medium text-[var(--app-accent)] hover:underline">
                        Settings
                      </Link>
                      .
                    </p>
                    {focuses.length ? (
                      <ul className="mt-6 flex flex-wrap gap-2">
                        {focuses.map((id) => (
                          <Tag key={id} active>
                            {labelForGoalId(id)}
                          </Tag>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-6 text-[13px] text-[var(--app-text-secondary)]">No saved goals yet.</p>
                    )}
                  </>
                ) : null}

                {current.id === "workstyle" ? (
                  <>
                    <div className="grid gap-5 lg:grid-cols-3">
                      <article className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-bg-page)] p-5">
                        <h4 className="text-[14px] font-bold">Persona</h4>
                        <p className="mt-3 text-[15px] text-[var(--app-text-primary)]">{personaLabel(profile?.persona)}</p>
                      </article>
                      <article className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-bg-page)] p-5 lg:col-span-2">
                        <h4 className="text-[14px] font-bold">Contact preferences</h4>
                        <p className="mt-3 text-[15px] leading-7 text-[var(--app-text-secondary)]">
                          {profile?.contact_preferences?.trim() || "—"}
                        </p>
                      </article>
                    </div>
                    <p className="mt-6 text-[12px] text-[var(--app-text-tertiary)]">
                      Quiz-style work-style types are not stored yet — this step reflects saved profile text only.
                    </p>
                  </>
                ) : null}
              </div>

              <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--app-border)] pt-5">
                <button
                  type="button"
                  onClick={goBack}
                  disabled={stepIndex === 0}
                  className="min-h-10 rounded-full px-4 text-[13px] font-semibold text-[var(--app-text-secondary)] hover:bg-[var(--app-bg-muted)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Back
                </button>
                <div className="flex flex-wrap items-center gap-2">
                  {stepIndex === WIZARD_STEPS.length - 1 ? (
                    <span className="text-[13px] text-[var(--app-text-secondary)]">All four sections reviewed.</span>
                  ) : null}
                  {stepIndex === WIZARD_STEPS.length - 1 ? (
                    <button
                      type="button"
                      onClick={() => setStepIndex(0)}
                      className="min-h-10 rounded-full bg-[var(--app-accent)] px-6 text-[14px] font-semibold text-white shadow-[var(--app-shadow-0)] hover:bg-[var(--app-accent-hover)]"
                    >
                      Start from Personal
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={goNext}
                      className="min-h-10 rounded-full bg-[var(--app-accent)] px-6 text-[14px] font-semibold text-white shadow-[var(--app-shadow-0)] hover:bg-[var(--app-accent-hover)]"
                    >
                      Continue
                    </button>
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>
      )}
    </ProductPageChrome>
  );
}
