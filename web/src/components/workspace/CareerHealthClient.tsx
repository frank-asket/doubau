"use client";

import { MetricCard, ProgressLine, Tag } from "./CareerHeroMockSections";
import { ProductPageChrome } from "./ProductPageChrome";

export function CareerHealthClient() {
  return (
    <ProductPageChrome title="Career Health">
      <div className="grid gap-4 xl:grid-cols-[2fr_1.25fr]">
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <MetricCard title="Good Days Streak" value="12" unit="(days)" delta="+25%" icon="☼">
              You have had <b>25%</b> more good days this month compared to last.
            </MetricCard>
            <MetricCard title="Energy" value="70%" unit="(avg. energy)" delta="-18%" tone="red" icon="↯">
              Your daily energy has decreased by <b>18%</b> in the past 30 days.
            </MetricCard>
            <MetricCard title="Weekly Mood Average" value="7.5" unit="(points)" delta="-0.5" tone="red" icon="☺">
              Your average mood has decreased by <b>0.5 points</b> in the past 30 days.
            </MetricCard>
            <MetricCard title="Workload Balance" value="65%" unit="(moderate balance)" delta="+10%" icon="▣">
              Workload balance has increased by <b>10%</b> over the last 30 days.
            </MetricCard>
          </div>

          <section className="ch-panel p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-[20px] font-bold">Career Health Metrics</h2>
              <Tag>Last 7 days</Tag>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {[
                ["Job Satisfaction", 37, "Warning", "#e879d2"],
                ["Work-Life Balance", 60, "Good", "var(--app-success)"],
              ].map(([label, pct, status, color]) => (
                <article key={label} className="ch-soft-card p-5">
                  <div className="flex justify-between">
                    <h3 className="font-bold">{label}</h3>
                    <span className="font-bold text-[var(--app-danger)]">-25%</span>
                  </div>
                  <div className="mt-5 flex items-center gap-3">
                    <span className="text-[30px] font-bold">{pct}%</span>
                    <Tag>{status}</Tag>
                  </div>
                  <div className="mt-4"><ProgressLine value={Number(pct)} color={String(color)} /></div>
                  <h4 className="mt-6 font-bold">Key Insights</h4>
                  <ul className="mt-3 space-y-2 text-[13px] text-[var(--app-text-secondary)]">
                    <li>- Slight decrease in overall satisfaction</li>
                    <li>- Strong team collaboration</li>
                    <li>- Project challenges noted</li>
                  </ul>
                  <h4 className="mt-6 font-bold">Recommendations</h4>
                  <ul className="mt-3 space-y-2 text-[13px] text-[var(--app-text-secondary)]">
                    <li>- Schedule 1:1 with manager</li>
                    <li>- Define clear project goals</li>
                    <li>- Plan regular time off</li>
                  </ul>
                </article>
              ))}
            </div>
          </section>
        </div>

        <aside className="ch-panel p-6">
          <h2 className="text-[20px] font-bold">Daily Career Check-in</h2>
          <p className="mt-6 font-semibold">How are you feeling about work today?</p>
          <div className="mt-4 flex flex-wrap gap-3">
            {["Terrible", "Bad", "Neutral", "Good", "Great"].map((mood) => <Tag key={mood}>{mood}</Tag>)}
          </div>
          <div className="my-6 border-t border-[var(--app-border)]" />
          {["Energy Level", "Workload Level"].map((label) => (
            <div key={label} className="mb-7">
              <div className="flex justify-between font-semibold">
                <span>{label}</span>
                <span className="text-[var(--app-accent)]">(50%)</span>
              </div>
              <input className="mt-4 w-full accent-[var(--app-accent)]" type="range" defaultValue={50} />
              <div className="mt-2 flex justify-between text-[13px] text-[var(--app-text-secondary)]">
                <span>{label === "Energy Level" ? "Exhausted" : "Very light"}</span>
                <span>{label === "Energy Level" ? "Highly energized" : "Heavy workload"}</span>
              </div>
            </div>
          ))}
          <div className="border-t border-[var(--app-border)] pt-6">
            <h3 className="font-semibold">Add tags</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {["Motivated", "Productive", "Joyful", "Focused", "Energized", "Tired", "Stressed"].map((tag) => <Tag key={tag}>{tag}</Tag>)}
            </div>
          </div>
          <label className="mt-7 block font-semibold">
            What is on your mind? (Optional)
            <textarea className="mt-3 min-h-36 w-full rounded-2xl border border-[var(--app-border)] p-4 text-[14px] outline-none focus:ring-2 focus:ring-[var(--app-focus-ring)]" placeholder="Share your thoughts here..." />
          </label>
          <button className="ch-primary-button mt-6 w-full" type="button">Save Today&apos;s Check-in</button>
        </aside>
      </div>
    </ProductPageChrome>
  );
}
