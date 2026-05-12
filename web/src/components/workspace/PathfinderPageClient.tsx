"use client";

import Link from "next/link";

import { ChromePrimaryLink } from "@/components/ui/chrome-motion";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { AppIcon } from "@/components/ui/app-icon";
import {
  getResumeStructured,
  goalFocusList,
  labelForGoalId,
  readinessPercent,
  resumeSkills,
  type ProfileDto,
  type ResumeLatestDto,
} from "@/lib/career-data";
import { queryKeys } from "@/lib/query-keys";

import {
  BottomActions,
  ProgressLine,
  Tag,
} from "./CareerHeroMockSections";
import { ProductPageChrome } from "./ProductPageChrome";

type WorkspaceSummary = {
  resume_status?: string | null;
};

export function PathfinderPageClient() {
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

  const paths = useMemo(() => {
    const role = profile?.current_role?.trim() || "your current target role";
    const loc = profile?.location?.trim() || "your location";
    const exp = profile?.years_experience?.trim() || "Experience not set";
    const focusIds = goalFocusList(profile?.goals ?? null);
    const transfer = skills.slice(0, 3);

    const baseMeta = [loc, exp, `${readiness}% résumé readiness`];

    if (!focusIds.length) {
      return [
        {
          title: "Clarify your goals",
          meta: baseMeta,
          match: Math.min(92, 60 + Math.floor(readiness / 5)),
          body: `Add goal focus in Settings so Doubow can prioritize discovery, CV work, and milestones around ${role}.`,
          required: transfer.length ? transfer : ["Upload a résumé with skills"],
          transferable: transfer.length ? transfer : ["Communication", "Ownership", "Learning agility"],
        },
      ];
    }

    return focusIds.map((id, index) => {
      const label = labelForGoalId(id);
      const match = Math.min(95, 58 + index * 6 + Math.floor(readiness / 8));
      return {
        title: `${label} track`,
        meta: baseMeta,
        match,
        body: `Aligned with your goal “${label}” while you position as ${role}. Next steps combine Discovery, CV updates, and milestones.`,
        required:
          id === "interview_prep"
            ? ["Structured stories", "Role-specific practice", "Feedback loop"]
            : id === "find_jobs"
              ? ["Market mapping", "Tailored CV bullets", "Outbound sequencing"]
              : id === "improve_cv"
                ? ["ATS-ready layout", "Quantified wins", "Keyword alignment"]
                : id === "boost_linkedin"
                  ? ["Headline clarity", "Featured proof points", "Consistent narrative"]
                  : ["Stakeholder visibility", "Impact metrics", "Prioritisation"],
        transferable: transfer.length ? transfer : ["Problem solving", "Collaboration", "Delivery"],
      };
    });
  }, [profile?.current_role, profile?.goals, profile?.location, profile?.years_experience, readiness, skills]);

  return (
    <ProductPageChrome
      title="Career Pathfinder"
      description="Derived from your saved goals, profile, and parsed résumé — not a separate labour-market dataset."
    >
      <section className="ch-panel p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-[28px] font-bold tracking-tight text-[var(--app-text-primary)]">
              Personalized directions from your data
            </h2>
            <p className="mt-2 max-w-4xl text-[15px] leading-6 text-[var(--app-text-primary)]">
              Each card combines onboarding goals, role context, and résumé readiness. Tune inputs in Settings or CV Builder,
              then revisit after your next upload.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Tag active>Goals-driven</Tag>
              <Tag active>Résumé-aware</Tag>
              <Tag active>Workspace-linked</Tag>
            </div>
          </div>
          <Link
            href="/app/settings"
            className="inline-flex min-h-10 items-center gap-2 rounded-full px-3 font-semibold text-[var(--app-accent)] hover:bg-[var(--app-bg-muted)]"
          >
            <AppIcon name="plus" className="size-4" /> Update goals
          </Link>
        </div>

        {profileQ.isLoading ? (
          <p className="mt-8 text-[13px] text-[var(--app-text-secondary)]">Loading profile…</p>
        ) : (
          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {paths.map((path) => (
              <article key={path.title} className="ch-soft-card overflow-hidden">
                <div className="p-5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-[20px] font-bold text-[var(--app-text-primary)]">{path.title}</h3>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {path.meta.map((item) => (
                      <Tag key={item}>{item}</Tag>
                    ))}
                  </div>
                  <p className="mt-6 min-h-[72px] text-[15px] leading-6 text-[var(--app-text-primary)]">{path.body}</p>
                  <div className="mt-4 grid grid-cols-[1fr_auto] items-center gap-4">
                    <ProgressLine value={path.match} />
                    <span className="text-[14px] font-semibold text-[var(--app-text-primary)] tabular-nums">{path.match}% fit</span>
                  </div>
                </div>
                <div className="border-t border-dashed border-[var(--app-border)] p-5">
                  <div className="flex items-center justify-between text-[16px] font-bold text-[var(--app-accent)]">
                    Skills <AppIcon name="chevron-down" className="size-4 rotate-180" />
                  </div>
                  <p className="mt-5 text-[14px] font-semibold text-[var(--app-text-primary)]">Transferable signals:</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {path.transferable.map((skill) => (
                      <Tag key={skill} active>
                        <span className="inline-flex items-center gap-1">
                          <AppIcon name="check-circle" className="size-3.5" /> {skill}
                        </span>
                      </Tag>
                    ))}
                  </div>
                  <p className="mt-5 text-[14px] font-semibold text-[var(--app-text-primary)]">Focus skills:</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {path.required.map((skill) => (
                      <Tag key={skill}>
                        <span className="inline-flex items-center gap-1">
                          {skill} <AppIcon name="plus" className="size-3.5" />
                        </span>
                      </Tag>
                    ))}
                  </div>
                </div>
                <div className="p-5">
                  <ChromePrimaryLink href="/app/planner" className="w-full">
                    <AppIcon name="layers" className="size-5" /> Plan milestones
                  </ChromePrimaryLink>
                </div>
              </article>
            ))}
          </div>
        )}
        <div className="mt-8">
          <BottomActions />
        </div>
      </section>
    </ProductPageChrome>
  );
}
