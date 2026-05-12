"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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

const TABS = ["Personal Info", "Skills & Expertise", "Career Goals", "Work Style"] as const;

export function CareerProfileClient() {
  const [tab, setTab] = useState<string>("Personal Info");

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

  return (
    <ProductPageChrome
      title="Career profile"
      description="Live data from your Doubow profile and latest parsed résumé."
    >
      <section className="ch-panel p-6">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-wrap gap-2">
            {TABS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setTab(item)}
                className={`min-h-10 rounded-full px-4 text-[14px] font-semibold transition ${
                  item === tab
                    ? "bg-white text-[var(--app-accent)] shadow-[var(--app-shadow-1)]"
                    : "text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)]"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-6 grid grid-cols-[1fr_auto] items-center gap-4">
          <ProgressLine value={readiness} />
          <span className="text-[20px] font-bold tabular-nums">{readiness}%</span>
        </div>
        <p className="mt-3 text-[13px] text-[var(--app-text-secondary)]">
          Résumé pipeline readiness (embedding drives job matching).{" "}
          <Link href="/app/cv-builder" className="font-medium text-[var(--app-accent)] hover:underline">
            Manage CV
          </Link>
        </p>
      </section>

      {profileQ.isLoading || workspaceQ.isLoading ? (
        <p className="text-[13px] text-[var(--app-text-secondary)]">Loading profile…</p>
      ) : profileQ.isError ? (
        <p className="text-[13px] text-[var(--app-badge-red-fg)]">Could not load profile.</p>
      ) : null}

      {tab === "Personal Info" ? (
        <section className="ch-panel p-7">
          <h2 className="text-[18px] font-bold">Personal & role</h2>
          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">Email</dt>
              <dd className="mt-1 text-[15px] text-[var(--app-text-primary)]">{profile?.email ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">Current role</dt>
              <dd className="mt-1 text-[15px] text-[var(--app-text-primary)]">{profile?.current_role?.trim() || "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">Experience</dt>
              <dd className="mt-1 text-[15px] text-[var(--app-text-primary)]">{profile?.years_experience?.trim() || "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">Location</dt>
              <dd className="mt-1 text-[15px] text-[var(--app-text-primary)]">{profile?.location?.trim() || "—"}</dd>
            </div>
          </dl>
          {summaryBlurb ? (
            <div className="mt-8 border-t border-dashed border-[var(--app-border)] pt-6">
              <h3 className="font-bold">Professional summary</h3>
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
        </section>
      ) : null}

      {tab === "Skills & Expertise" ? (
        <section className="ch-panel p-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-[18px] font-bold">Skills from résumé</h2>
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
            <div className="mt-8 grid gap-5 lg:grid-cols-3">
              {skills.map((name) => (
                <article key={name} className="ch-soft-card p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-4">
                      <span className="grid size-12 place-items-center rounded-full bg-[#1d1d1f] text-white">
                        <AppIcon name="layers" className="size-5" />
                      </span>
                      <h3 className="text-[17px] font-bold">{name}</h3>
                    </div>
                  </div>
                  <div className="mt-5 flex gap-2">
                    <Tag>On résumé</Tag>
                  </div>
                  <div className="mt-6">
                    <div className="mb-2 flex justify-between text-[13px] font-semibold">
                      <span>Profile signal</span>
                      <span>{readiness}%</span>
                    </div>
                    <ProgressLine value={readiness} />
                  </div>
                  <p className="mt-4 text-[12px] text-[var(--app-text-tertiary)]">
                    Skill list comes from your latest structured résumé parse — refine wording on your CV to update.
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {tab === "Career Goals" ? (
        <section className="ch-panel p-7">
          <h2 className="text-[18px] font-bold">Goals</h2>
          <p className="mt-2 text-[13px] text-[var(--app-text-secondary)]">
            Pulled from onboarding / profile <code className="text-[12px]">goals.focus</code>. Edit in{" "}
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
        </section>
      ) : null}

      {tab === "Work Style" ? (
        <section className="ch-panel p-7">
          <h2 className="text-[18px] font-bold">Persona & preferences</h2>
          <div className="mt-6 grid gap-5 lg:grid-cols-3">
            <article className="rounded-2xl border border-[var(--app-border)] bg-white p-6">
              <h3 className="text-[16px] font-bold">Persona</h3>
              <p className="mt-4 text-[15px] text-[var(--app-text-primary)]">{personaLabel(profile?.persona)}</p>
            </article>
            <article className="rounded-2xl border border-[var(--app-border)] bg-white p-6 lg:col-span-2">
              <h3 className="text-[16px] font-bold">Contact preferences</h3>
              <p className="mt-4 text-[15px] leading-7 text-[var(--app-text-secondary)]">
                {profile?.contact_preferences?.trim() || "—"}
              </p>
            </article>
          </div>
          <p className="mt-6 text-[12px] text-[var(--app-text-tertiary)]">
            Preference quiz outputs (e.g. MBTI-style types) are not stored in Doubow yet — this section shows only saved profile fields.
          </p>
        </section>
      ) : null}
    </ProductPageChrome>
  );
}
