"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { ChromePrimaryLink } from "@/components/ui/chrome-motion";
import { AppIcon } from "@/components/ui/app-icon";
import { queryKeys } from "@/lib/query-keys";

import { FeatureListCard, MixPanel, SegmentedTabs, Tag } from "./CareerHeroMockSections";
import { ProductPageChrome } from "./ProductPageChrome";

type FeedRow = {
  job: {
    id: string;
    company: string;
    title: string;
    location: string | null;
    description: string | null;
    tags: string[];
    source_url: string | null;
  };
  score: number;
};

const SPONSOR_RE = /\b(visa|sponsor|sponsorship|certificate\s+of\s+sponsorship|cos)\b/i;

const HUB_TABS = ["Overview", "Point Calculator", "Graduate Visa", "Find Sponsors"] as const;
type HubTab = (typeof HUB_TABS)[number];

export function SponsorshipHubClient() {
  const [tab, setTab] = useState<HubTab>("Overview");

  const feedQ = useQuery({
    queryKey: queryKeys.jobsFeed(80),
    queryFn: async () => {
      const r = await fetch("/api/jobs/feed?limit=80", { cache: "no-store" });
      if (!r.ok) throw new Error("feed");
      return (await r.json()) as FeedRow[];
    },
  });

  const sponsorHits = useMemo(() => {
    const rows = feedQ.data ?? [];
    return rows.filter((row) => {
      const blob = `${row.job.description ?? ""} ${row.job.title} ${row.job.tags.join(" ")}`;
      return SPONSOR_RE.test(blob);
    });
  }, [feedQ.data]);

  const sponsorList = (
    <>
      {feedQ.isLoading ? (
        <p className="mt-6 text-[13px] text-[var(--app-text-secondary)]">Scanning feed…</p>
      ) : sponsorHits.length === 0 ? (
        <p className="mt-6 text-[13px] text-[var(--app-text-secondary)]">
          No matches in the current sample — widen Discovery or sync providers on the API side.
        </p>
      ) : (
        <ul className="mt-6 space-y-4">
          {sponsorHits.slice(0, 12).map(({ job }) => (
            <li key={job.id} className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-[var(--app-text-primary)]">{job.title}</p>
                  <p className="text-[13px] font-semibold text-[var(--app-accent)]">{job.company}</p>
                  {job.location ? <p className="mt-1 text-[12px] text-[var(--app-text-secondary)]">{job.location}</p> : null}
                </div>
                <Link className="text-[13px] font-semibold text-[var(--app-accent)] hover:underline" href={`/app/discovery/${job.id}`}>
                  Details
                </Link>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Tag>Sponsorship keyword</Tag>
                {job.tags.slice(0, 3).map((t) => (
                  <Tag key={t}>{t}</Tag>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );

  return (
    <ProductPageChrome
      title="Sponsorship Hub"
      description="Static UK visa context plus live roles from your discovery feed whose text mentions sponsorship or visas."
    >
      <section className="ch-panel p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-4xl flex-1">
            <SegmentedTabs
              ariaLabel="Sponsorship hub sections"
              items={[...HUB_TABS]}
              value={tab}
              onChange={(v) => setTab(v as HubTab)}
            />
          </div>
          <ChromePrimaryLink href="/app/copilot">
            <AppIcon name="sparkle" className="size-5" /> Get guidance
          </ChromePrimaryLink>
        </div>
        <p className="mt-4 text-[13px] text-[var(--app-text-secondary)]">
          Points totals are not computed in-app — use GOV.UK and licensed advisers before making decisions.
        </p>
        <div className="my-8 border-t border-[var(--app-border)]" />

        {tab === "Overview" ? (
          <>
            <div className="grid gap-5 md:grid-cols-3">
              {[
                ["Eligibility Check", "Cross-check role seniority and sponsor licence assumptions with official guidance"],
                ["Feed keyword scan", "We surface discovery roles whose descriptions mention visas or sponsorship"],
                ["Tracker hand-off", "Save promising roles from Discovery and route drafts through Approvals"],
              ].map(([title, text]) => (
                <article key={title} className="ch-soft-card flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-[18px] font-bold">{title}</h3>
                    <p className="mt-3 text-[14px] text-[var(--app-text-secondary)]">{text}</p>
                  </div>
                  <Link
                    href="/app/discovery"
                    className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-full px-3 font-semibold text-[var(--app-accent)] hover:bg-[var(--app-bg-muted)]"
                  >
                    Open <AppIcon name="chevron-right" className="size-4" />
                  </Link>
                </article>
              ))}
            </div>

            <MixPanel variant="accent" className="mt-8">
              <p className="text-[13px] font-semibold text-[var(--app-text-primary)]">Sponsorship matches in your feed</p>
              <p className="mt-1 text-[12px] text-[var(--app-text-secondary)]">
                {feedQ.isLoading ? "Loading…" : `${sponsorHits.length} roles in this sample mention visas or sponsorship.`}{" "}
                <button
                  type="button"
                  className="font-medium text-[var(--app-accent)] underline-offset-2 hover:underline"
                  onClick={() => setTab("Find Sponsors")}
                >
                  Open full list
                </button>
              </p>
            </MixPanel>

            <div className="mt-8 grid gap-5 lg:grid-cols-2">
              <FeatureListCard
                title="April 2024 Changes"
                items={[
                  "New salary thresholds",
                  "Health & care workers lower threshold at £26,200",
                  "English requirements: minimum B1 level required",
                  "Updated shortage occupation list",
                ]}
              />
              <FeatureListCard
                title="Points System"
                items={[
                  "70 points required",
                  "Mandatory criteria plus tradeable points",
                  "Additional points for listed roles",
                  "Extra points for PhD level",
                ]}
              />
            </div>

            <div className="mt-8 border-t border-[var(--app-border)] pt-6">
              <h2 className="text-[20px] font-bold">Helpful Resources</h2>
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <a
                  href="https://www.gov.uk/browse/visas-immigration"
                  target="_blank"
                  rel="noreferrer"
                  className="ch-soft-card inline-flex min-h-12 items-center justify-center gap-2 font-semibold text-[var(--app-accent)]"
                >
                  GOV.UK visas <AppIcon name="arrow-up-right" className="size-4" />
                </a>
                <Link
                  href="/app/discovery"
                  className="ch-soft-card inline-flex min-h-12 items-center justify-center gap-2 font-semibold text-[var(--app-accent)]"
                >
                  Discovery <AppIcon name="chevron-right" className="size-4" />
                </Link>
                <Link
                  href="/app/career-steps"
                  className="ch-soft-card inline-flex min-h-12 items-center justify-center gap-2 font-semibold text-[var(--app-accent)]"
                >
                  Milestones <AppIcon name="chevron-right" className="size-4" />
                </Link>
              </div>
            </div>
          </>
        ) : null}

        {tab === "Point Calculator" ? (
          <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <div className="ch-panel border-[var(--app-border)] p-6">
              <h2 className="text-[20px] font-bold">Points Calculator</h2>
              <p className="mt-2 text-[var(--app-text-secondary)]">
                Placeholder fields mirror common Skilled Worker criteria — Doubow does not score these yet.
              </p>
              <div className="mt-8 space-y-7">
                {["Job Offer from Licensed Sponsor", "Job at Required Skill Level", "English Language Requirement"].map((label) => (
                  <label key={label} className="block font-semibold opacity-70">
                    {label} *
                    <div className="mt-3 flex h-14 cursor-not-allowed items-center justify-between rounded-full border border-[var(--app-border)] px-5 text-[var(--app-text-secondary)]">
                      Select an option <AppIcon name="chevron-down" className="size-4" />
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <aside className="space-y-4">
              <MixPanel variant="danger">
                <h3 className="text-[17px] font-bold text-[var(--app-danger)]">Calculator offline</h3>
                <p className="mt-3 text-[13px] text-[var(--app-text-secondary)]">
                  Points totals are not computed in-app — validate against UKVI tooling before relying on numbers.
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                  <Tag>Verify externally</Tag>
                </div>
              </MixPanel>
              <FeatureListCard
                title="Important Changes (April 2024)"
                items={["New salary threshold of £38,700", "Lower health & care threshold", "Minimum B1 English level required"]}
              />
            </aside>
          </div>
        ) : null}

        {tab === "Graduate Visa" ? (
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <MixPanel variant="muted">
              <h2 className="text-[18px] font-bold text-[var(--app-text-primary)]">Graduate route (high level)</h2>
              <p className="mt-3 text-[14px] leading-relaxed text-[var(--app-text-secondary)]">
                The Graduate visa lets eligible students stay in the UK to work or look for work after completing a course
                with a licensed provider. Length of leave, switching into work routes, and dependants change with policy —
                always read the current immigration rules.
              </p>
              <a
                href="https://www.gov.uk/graduate-visa"
                target="_blank"
                rel="noreferrer"
                className="mt-5 inline-flex min-h-10 items-center gap-2 font-semibold text-[var(--app-accent)] hover:underline"
              >
                GOV.UK: Graduate visa <AppIcon name="arrow-up-right" className="size-4" />
              </a>
            </MixPanel>
            <FeatureListCard
              title="Before you apply"
              items={[
                "Confirm your institution reported successful completion in time",
                "Check you are applying from inside the UK where required",
                "Plan how this route intersects with Skilled Worker sponsorship later",
              ]}
            />
          </div>
        ) : null}

        {tab === "Find Sponsors" ? (
          <div>
            <h2 className="text-[20px] font-bold">Roles mentioning sponsorship / visas</h2>
            <p className="mt-2 text-[13px] text-[var(--app-text-secondary)]">
              Keyword filter over your ranked feed — always verify on the employer site.
            </p>
            {sponsorList}
          </div>
        ) : null}
      </section>
    </ProductPageChrome>
  );
}
