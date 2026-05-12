"use client";

import { CareerFlowProgress, MetricCard, ProgressLine, Tag } from "./CareerHeroMockSections";
import { ProductPageChrome } from "./ProductPageChrome";

export function CareerSuccessPageClient() {
  return (
    <ProductPageChrome title="Career Success">
      <CareerFlowProgress
        steps={["Personal Info", "Skills & Expertise", "Career Goals", "Work Style"]}
        active="Work Style"
        value={100}
      />

      <section className="ch-panel p-7">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-[30px] font-black tracking-[-0.03em]">Your Personality Type: INTJ <Tag>Architect</Tag></h2>
            <p className="mt-2 max-w-3xl text-[14px] leading-6 text-[var(--app-text-secondary)]">
              A strategy-first profile with strong independent planning, system thinking, and written communication preferences.
            </p>
          </div>
          <div className="flex gap-4 font-bold text-[var(--app-blue-500)]">
            <button type="button">Download Report</button>
            <button type="button">Share Results</button>
          </div>
        </div>

        <div className="mt-7 grid gap-5 lg:grid-cols-3">
          {[
            ["Key Strengths", ["Strategic planning", "Complex problem solving", "Independent thinking", "High standards"]],
            ["Work Style", ["Prefers independent work", "Focuses on long-term strategy", "Values efficiency and logic", "Driven by continuous improvement"]],
            ["Communication", ["Direct and concise", "Focuses on facts and logic", "Prefers written communication", "Values intellectual discourse"]],
          ].map(([title, items]) => (
            <article key={title as string} className="rounded-[20px] border border-[var(--app-border)] bg-white/92 p-6 shadow-[var(--app-shadow-0)]">
              <h3 className="text-[20px] font-black">{title as string}</h3>
              <ul className="mt-5 space-y-3 text-[15px] leading-6 text-[var(--app-text-secondary)]">
                {(items as string[]).map((item) => <li key={item}>- {item}</li>)}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <div className="grid gap-4 md:grid-cols-2">
          <MetricCard title="Skills Mastery" value="35%" unit="(total)" delta="+15%" icon="◒">
            You have made <b>15%</b> more progress on your skills in the past 30 days.
          </MetricCard>
          <MetricCard title="Career Progress" value="65%" unit="(total)" delta="-8%" tone="red" icon="▣">
            Your career progress dropped by <b>8%</b> over the past 30 days.
          </MetricCard>
          <MetricCard title="Interview Success" value="5" unit="(interviews)" delta="-20%" tone="red" icon="◌">
            Your interview success dropped by <b>20%</b> over the past 30 days.
          </MetricCard>
          <MetricCard title="Market Value" value="£40k" unit="(current)" delta="+16%" icon="$">
            Market value increased by <b>16%</b> in 30 days.
          </MetricCard>
        </div>
        <section className="ch-panel p-6">
          <h2 className="text-[18px] font-black">Skills Growth</h2>
          {[
            ["Strategic planning", 30, "+12% value"],
            ["Communication and negotiation", 40, "+18% value"],
            ["Data analysis", 50, "+22% value"],
          ].map(([label, pct, delta]) => (
            <div key={label} className="mt-7">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-bold">{label}</h3>
                <span className="font-semibold text-[var(--app-accent)]">{delta}</span>
              </div>
              <div className="mt-4 grid grid-cols-[1fr_42px] items-center gap-4">
                <ProgressLine value={Number(pct)} />
                <span className="text-right text-[13px] font-semibold">{pct}%</span>
              </div>
            </div>
          ))}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="ch-panel p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-[20px] font-black">Career Goals</h2>
            <button className="font-bold text-[var(--app-blue-500)]" type="button">+ Add Goals</button>
          </div>
          {[
            ["Complete System Design Course", 75, "Learning"],
            ["Apply to 5 Senior Positions", 42, "Career"],
            ["Earn AWS Certification", 15, "Project"],
          ].map(([label, pct, tag]) => (
            <article key={label} className="mt-5 border-b border-dashed border-[var(--app-border)] pb-5 last:border-0">
              <div className="flex items-center justify-between gap-4">
                <h3 className="font-bold">{label}</h3>
                <span className="font-semibold">{pct}%</span>
              </div>
              <div className="mt-4"><ProgressLine value={Number(pct)} /></div>
              <div className="mt-4 flex gap-2"><Tag>{tag}</Tag><Tag>12/06/2025</Tag></div>
            </article>
          ))}
        </section>

        <section className="ch-panel p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-[20px] font-black">Recent Achievements</h2>
            <button className="font-bold text-[var(--app-blue-500)]" type="button">+ Add Achievement</button>
          </div>
          {[
            ["Profile Strength Increased", "Your LinkedIn profile is now in the top 10%"],
            ["New Skill Badge", "Earned React Expert certification"],
            ["Completed Milestone", "Successfully completed 5 learning modules"],
          ].map(([title, body]) => (
            <article key={title} className="mt-5 border-b border-dashed border-[var(--app-border)] pb-5 last:border-0">
              <h3 className="font-bold">{title}</h3>
              <p className="mt-2 text-[15px] text-[var(--app-text-primary)]">{body}</p>
              <div className="mt-4 flex gap-2"><Tag>Award</Tag><Tag>15/05/2025</Tag></div>
            </article>
          ))}
        </section>
      </div>
    </ProductPageChrome>
  );
}
