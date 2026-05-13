"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";

import { ChromePrimaryLink } from "@/components/ui/chrome-motion";
import { AppIcon } from "@/components/ui/app-icon";
import { goalFocusList, type PathfinderWizardAnswers, type ProfileDto } from "@/lib/career-data";
import { queryKeys } from "@/lib/query-keys";

import { BottomActions, ProgressLine, Tag } from "./CareerHeroMockSections";
import { ProductPageChrome } from "./ProductPageChrome";

type StepField = keyof PathfinderWizardAnswers;

type StepOption = { value: string; label: string; hint: string };

type WizardStepDef = {
  field: StepField;
  title: string;
  subtitle: string;
  options: StepOption[];
};

const WIZARD_STEPS: WizardStepDef[] = [
  {
    field: "northStar",
    title: "In the next 12 months you mostly want to…",
    subtitle: "Pick the closest north star — you can change this anytime.",
    options: [
      { value: "ic_depth", label: "Grow as an IC", hint: "Depth, craft, technical leadership" },
      { value: "leadership", label: "Lead people & strategy", hint: "Team scope, hiring, direction" },
      { value: "new_company", label: "Land a new company", hint: "External search, offers, transitions" },
      { value: "promotion", label: "Earn a promotion", hint: "Same org, next level" },
      { value: "pivot", label: "Pivot function or industry", hint: "Reframe story + proof" },
      { value: "exploring", label: "Still exploring", hint: "Keep options open while learning" },
    ],
  },
  {
    field: "constraint",
    title: "The biggest constraint right now is…",
    subtitle: "We weight paths (e.g. visa vs time) using this answer only — no HR database.",
    options: [
      { value: "time", label: "Limited time", hint: "<5h/week for search" },
      { value: "location", label: "Location / remote", hint: "Geo or commute limits" },
      { value: "visa", label: "Visa / sponsorship", hint: "Needs sponsor clarity" },
      { value: "confidence", label: "Interview confidence", hint: "Practice-heavy" },
      { value: "comp", label: "Compensation clarity", hint: "Benchmarking & negotiation" },
      { value: "none", label: "No major blocker", hint: "Execution mode" },
    ],
  },
  {
    field: "weeklyCapacity",
    title: "This week you can realistically invest…",
    subtitle: "Sets suggested timeboxes on path cards.",
    options: [
      { value: "low", label: "Under 5 hours", hint: "Nights / weekends only" },
      { value: "mid", label: "5–10 hours", hint: "Steady side bandwidth" },
      { value: "high", label: "10+ hours", hint: "Search as a priority" },
    ],
  },
  {
    field: "proof",
    title: "Your strongest proof today is…",
    subtitle: "We emphasise different skills to build on each path.",
    options: [
      { value: "metrics", label: "Metrics & outcomes", hint: "Revenue, cost, velocity" },
      { value: "shipping", label: "Shipping & delivery", hint: "Launches, releases, reliability" },
      { value: "people", label: "People & influence", hint: "Stakeholders, mentoring" },
      { value: "learning", label: "Learning velocity", hint: "Courses, certs, upskilling" },
    ],
  },
  {
    field: "risk",
    title: "For outreach and positioning you prefer…",
    subtitle: "Higher risk nudges bolder discovery and narrative paths.",
    options: [
      { value: "low", label: "Conservative & precise", hint: "Fewer, tighter applications" },
      { value: "mid", label: "Balanced", hint: "Mix volume with tailoring" },
      { value: "high", label: "Bold & visible", hint: "More reach, stronger POV" },
    ],
  },
];

type PathfinderCta = { label: string; href: string };

export type CareerPathCardApi = {
  id: string;
  title: string;
  subtitle: string;
  body: string;
  meta: string[];
  match: number;
  timeframe: string;
  required: string[];
  transferable: string[];
  primary_cta: PathfinderCta;
  secondary_cta?: PathfinderCta | null;
};

type PathfinderBundle = {
  wizard: {
    completed: boolean;
    current_step: number;
    answers: Record<string, string>;
    completed_at: string | null;
  };
  paths: CareerPathCardApi[];
};

export function PathfinderPageClient() {
  const qc = useQueryClient();
  const [wizardStep, setWizardStep] = useState(0);
  const [wizardAnswers, setWizardAnswers] = useState<Partial<PathfinderWizardAnswers>>({});
  const [wizardDone, setWizardDone] = useState(false);

  const pathfinderQ = useQuery({
    queryKey: queryKeys.pathfinder,
    queryFn: async () => {
      const r = await fetch("/api/me/pathfinder", { cache: "no-store" });
      if (!r.ok) throw new Error("pathfinder");
      return (await r.json()) as PathfinderBundle;
    },
  });

  const profileQ = useQuery({
    queryKey: queryKeys.profile,
    queryFn: async () => {
      const r = await fetch("/api/me/profile", { cache: "no-store" });
      if (!r.ok) throw new Error("profile");
      return (await r.json()) as ProfileDto;
    },
  });

  useEffect(() => {
    if (!pathfinderQ.data) return;
    const w = pathfinderQ.data.wizard;
    setWizardDone(Boolean(w.completed));
    setWizardAnswers((w.answers ?? {}) as Partial<PathfinderWizardAnswers>);
    setWizardStep(typeof w.current_step === "number" ? Math.max(0, Math.min(4, w.current_step)) : 0);
  }, [pathfinderQ.data]);

  const putPathfinder = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const r = await fetch("/api/me/pathfinder", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error("pathfinder-put");
      return (await r.json()) as PathfinderBundle;
    },
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.pathfinder, data);
      void qc.invalidateQueries({ queryKey: queryKeys.profile });
    },
  });

  const persist = useCallback(
    (body: Record<string, unknown>) => {
      putPathfinder.mutate(body);
    },
    [putPathfinder],
  );

  const profile = profileQ.data;
  const paths = pathfinderQ.data?.paths ?? [];

  const goalCount = goalFocusList(profile?.goals ?? null).length;

  const currentStep = WIZARD_STEPS[wizardStep];
  const currentValue = currentStep ? wizardAnswers[currentStep.field] : undefined;

  const selectOption = (value: string) => {
    if (!currentStep) return;
    const field = currentStep.field;
    const next = { ...wizardAnswers, [field]: value } as Partial<PathfinderWizardAnswers>;
    setWizardAnswers(next);
    persist({
      answers: { [field]: value },
      current_step: wizardStep,
      completed: false,
    });
  };

  const goNext = () => {
    if (wizardStep >= WIZARD_STEPS.length - 1) {
      persist({
        answers: wizardAnswers as Record<string, string>,
        current_step: 4,
        completed: true,
      });
      return;
    }
    const nextStep = wizardStep + 1;
    setWizardStep(nextStep);
    persist({
      answers: wizardAnswers as Record<string, string>,
      current_step: nextStep,
      completed: false,
    });
  };

  const goBack = () => {
    const nextStep = Math.max(0, wizardStep - 1);
    setWizardStep(nextStep);
    persist({ current_step: nextStep, completed: false });
  };

  const resetWizard = () => {
    setWizardStep(0);
    setWizardAnswers({});
    setWizardDone(false);
    persist({ reset: true });
  };

  const wizardProgressPct = Math.round(((wizardStep + 1) / WIZARD_STEPS.length) * 100);

  const loading = pathfinderQ.isPending;

  const pathsSection =
    pathfinderQ.isError ? (
      <p className="mt-8 text-[13px] text-[var(--app-badge-red-fg)]">Could not load path cards.</p>
    ) : (
      <div className="mt-8 grid gap-5 lg:grid-cols-3">
        {paths.map((path) => (
          <article key={path.id} className="ch-soft-card flex flex-col overflow-hidden">
            <div className="flex flex-1 flex-col p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-[19px] font-bold leading-snug text-[var(--app-text-primary)]">{path.title}</h3>
                  <p className="mt-1 text-[13px] font-medium text-[var(--app-text-secondary)]">{path.subtitle}</p>
                </div>
                <span className="shrink-0 rounded-full border border-[var(--app-border)] bg-[var(--app-bg-muted)] px-2 py-1 text-[11px] font-semibold tabular-nums text-[var(--app-text-secondary)]">
                  {path.timeframe}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {path.meta.map((item) => (
                  <Tag key={item}>{item}</Tag>
                ))}
              </div>
              <p className="mt-5 min-h-[72px] flex-1 text-[14px] leading-6 text-[var(--app-text-primary)]">{path.body}</p>
              <div className="mt-5 grid grid-cols-[1fr_auto] items-center gap-4">
                <ProgressLine value={path.match} />
                <span className="text-[13px] font-semibold tabular-nums text-[var(--app-text-primary)]">{path.match}% fit</span>
              </div>
            </div>
            <div className="border-t border-dashed border-[var(--app-border)] p-5">
              <div className="flex items-center justify-between text-[15px] font-bold text-[var(--app-accent)]">
                Skills <AppIcon name="chevron-down" className="size-4 rotate-180" />
              </div>
              <p className="mt-4 text-[13px] font-semibold text-[var(--app-text-primary)]">Transferable signals</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {path.transferable.map((skill) => (
                  <Tag key={skill} active>
                    <span className="inline-flex items-center gap-1">
                      <AppIcon name="check-circle" className="size-3.5" /> {skill}
                    </span>
                  </Tag>
                ))}
              </div>
              <p className="mt-4 text-[13px] font-semibold text-[var(--app-text-primary)]">Focus skills</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {path.required.map((skill) => (
                  <Tag key={skill}>
                    <span className="inline-flex items-center gap-1">
                      {skill} <AppIcon name="plus" className="size-3.5" />
                    </span>
                  </Tag>
                ))}
              </div>
            </div>
            <div className="mt-auto flex flex-col gap-2 border-t border-[var(--app-border)] p-5 sm:flex-row">
              <ChromePrimaryLink href={path.primary_cta.href} className="flex-1 justify-center">
                <AppIcon name="arrow-up-right" className="size-4" /> {path.primary_cta.label}
              </ChromePrimaryLink>
              {path.secondary_cta ? (
                <Link
                  href={path.secondary_cta.href}
                  className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full border border-[var(--app-border)] bg-[var(--app-bg-page)] px-4 text-[13px] font-semibold text-[var(--app-text-primary)] hover:bg-[var(--app-bg-muted)]"
                >
                  {path.secondary_cta.label}
                </Link>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    );

  return (
    <ProductPageChrome
      title="Career Pathfinder"
      description="Five-step questionnaire (saved to your profile) plus server-built path cards from goals, pipeline, and résumé heuristics — same deterministic engine as before, now delivered via API."
    >
      <section className="ch-panel p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-[28px] font-bold tracking-tight text-[var(--app-text-primary)]">
              Shape directions, then review path cards
            </h2>
            <p className="mt-2 max-w-4xl text-[15px] leading-6 text-[var(--app-text-primary)]">
              Answer five quick questions — progress is stored on your account (under profile goals). Path cards are
              computed on the server from your goals, workspace pipeline, and parsed résumé.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Tag active>Question 1 of 5 flow</Tag>
              <Tag active>GET /me/pathfinder</Tag>
              <Tag active>{goalCount ? `${goalCount} saved goals` : "Goals from Settings"}</Tag>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={resetWizard}
              disabled={putPathfinder.isPending}
              className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[var(--app-border)] bg-[var(--app-bg-elevated)] px-4 text-[13px] font-semibold text-[var(--app-text-secondary)] hover:bg-[var(--app-bg-muted)] disabled:opacity-50"
            >
              Reset wizard
            </button>
            <Link
              href="/app/settings"
              className="inline-flex min-h-10 items-center gap-2 rounded-full px-3 font-semibold text-[var(--app-accent)] hover:bg-[var(--app-bg-muted)]"
            >
              <AppIcon name="plus" className="size-4" /> Goals in Settings
            </Link>
          </div>
        </div>

        {loading ? (
          <p className="mt-8 text-[13px] text-[var(--app-text-secondary)]">Loading pathfinder…</p>
        ) : (
          <>
            {!wizardDone ? (
              <div className="mt-8 rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-5 sm:p-6">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--app-accent)]">
                      Question {wizardStep + 1} of {WIZARD_STEPS.length}
                    </p>
                    <h3 className="mt-1 text-[20px] font-bold text-[var(--app-text-primary)]">{currentStep?.title}</h3>
                    <p className="mt-1 max-w-2xl text-[14px] text-[var(--app-text-secondary)]">{currentStep?.subtitle}</p>
                  </div>
                  <span className="text-[12px] tabular-nums text-[var(--app-text-tertiary)]">{wizardProgressPct}%</span>
                </div>
                <div className="mt-4 max-w-xl">
                  <ProgressLine value={wizardProgressPct} />
                </div>

                <div className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {currentStep?.options.map((opt) => {
                    const selected = currentValue === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => selectOption(opt.value)}
                        disabled={putPathfinder.isPending}
                        className={`rounded-[var(--app-radius-lg)] border px-4 py-3 text-left transition disabled:opacity-50 ${
                          selected
                            ? "border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_10%,transparent)] shadow-[var(--app-shadow-0)]"
                            : "border-[var(--app-border)] bg-[var(--app-bg-page)] hover:border-[color-mix(in_srgb,var(--app-accent)_35%,var(--app-border))]"
                        }`}
                      >
                        <span className="block text-[14px] font-semibold text-[var(--app-text-primary)]">{opt.label}</span>
                        <span className="mt-1 block text-[12px] leading-snug text-[var(--app-text-secondary)]">{opt.hint}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--app-border)] pt-5">
                  <button
                    type="button"
                    onClick={goBack}
                    disabled={wizardStep === 0 || putPathfinder.isPending}
                    className="min-h-10 rounded-full px-4 text-[13px] font-semibold text-[var(--app-text-secondary)] hover:bg-[var(--app-bg-muted)] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={goNext}
                    disabled={currentValue === undefined || putPathfinder.isPending}
                    className="min-h-10 rounded-full bg-[var(--app-accent)] px-6 text-[14px] font-semibold text-white shadow-[var(--app-shadow-0)] hover:bg-[var(--app-accent-hover)] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {wizardStep >= WIZARD_STEPS.length - 1 ? "See my paths" : "Continue"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-[var(--app-radius-lg)] border border-dashed border-[color-mix(in_srgb,var(--app-accent)_30%,var(--app-border))] bg-[color-mix(in_srgb,var(--app-accent)_6%,transparent)] px-4 py-3 text-[13px] text-[var(--app-text-secondary)]">
                <span>
                  Wizard complete — <span className="font-medium text-[var(--app-text-primary)]">paths below</span> are
                  rebuilt on the server from your answers.
                </span>
                <button
                  type="button"
                  disabled={putPathfinder.isPending}
                  onClick={resetWizard}
                  className="font-semibold text-[var(--app-accent)] hover:underline disabled:opacity-50"
                >
                  Re-run questionnaire
                </button>
              </div>
            )}
            {pathsSection}
          </>
        )}

        <div className="mt-8">
          <BottomActions />
        </div>
      </section>
    </ProductPageChrome>
  );
}
