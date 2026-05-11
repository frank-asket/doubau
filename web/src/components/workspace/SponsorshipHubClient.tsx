"use client";

import { FeatureListCard, SegmentedTabs, Tag } from "./CareerHeroMockSections";
import { ProductPageChrome } from "./ProductPageChrome";

export function SponsorshipHubClient() {
  return (
    <ProductPageChrome title="Sponsorship Hub">
      <section className="ch-panel p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-4xl"><SegmentedTabs items={["Overview", "Point Calculator", "Graduate Visa", "Find Sponsors"]} active="Overview" /></div>
          <button className="ch-primary-button" type="button">Get Guidance</button>
        </div>
        <div className="my-8 border-t border-[var(--app-border)]" />

        <div className="grid gap-5 md:grid-cols-3">
          {[
            ["Eligibility Check", "Check if you qualify for a UK work visa", "Start"],
            ["Visa Calculator", "Calculate points and visa costs", "Calculate"],
            ["Visa Guide", "Step-by-step application guide", "View"],
          ].map(([title, text, action]) => (
            <article key={title} className="ch-soft-card flex items-center justify-between p-5">
              <div>
                <h3 className="text-[18px] font-bold">{title}</h3>
                <p className="mt-3 text-[14px] text-[var(--app-text-secondary)]">{text}</p>
              </div>
              <button className="font-semibold text-[var(--app-accent)]" type="button">{action} ›</button>
            </article>
          ))}
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
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
            {["Official Guide", "Shortage List", "Find Job"].map((item) => (
              <button key={item} className="ch-soft-card min-h-12 font-semibold text-[var(--app-accent)]" type="button">{item} ›</button>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="ch-panel p-6">
          <h2 className="text-[20px] font-bold">Points Calculator</h2>
          <p className="mt-2 text-[var(--app-text-secondary)]">Updated for April 2024 rules</p>
          <div className="mt-8 space-y-7">
            {["Job Offer from Licensed Sponsor", "Job at Required Skill Level", "English Language Requirement"].map((label) => (
              <label key={label} className="block font-semibold">
                {label} *
                <div className="mt-3 flex h-14 items-center justify-between rounded-full border border-[var(--app-border)] px-5 text-[var(--app-text-secondary)]">
                  Select an option <span>⌄</span>
                </div>
              </label>
            ))}
            <div className="border-t border-[var(--app-border)] pt-6 text-[20px] font-bold">▸ Salary Requirements</div>
            <div className="border-t border-[var(--app-border)] pt-6 text-[20px] font-bold">▸ Additional Points</div>
          </div>
        </div>
        <aside className="space-y-4">
          <div className="ch-panel p-6">
            <h3 className="text-[20px] font-bold text-[var(--app-danger)]">Total Points: 50</h3>
            <p className="mt-3 text-[var(--app-text-secondary)]">You need 20 more points to meet the minimum requirement</p>
            <div className="mt-6 space-y-3"><Tag>Add relevant PhD qualification (+10 points)</Tag><Tag>Check shortage occupation list (+20 points)</Tag></div>
          </div>
          <FeatureListCard title="Important Changes (April 2024)" items={["New salary threshold of £38,700", "Lower health & care threshold", "Minimum B1 English level required"]} />
        </aside>
      </section>
    </ProductPageChrome>
  );
}
