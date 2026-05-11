"use client";

import { Gauge, ProgressLine } from "./CareerHeroMockSections";
import { ProductPageChrome } from "./ProductPageChrome";

const sections = [
  ["Headline", 7, "green"],
  ["Summary", 2, "red"],
  ["Experience", 5, "pink"],
  ["Education", 10, "green"],
  ["Other", 6, "pink"],
];

export function LinkedinAnalysisClient() {
  return (
    <ProductPageChrome title="LinkedIn Analysis">
      <div className="grid gap-4 lg:grid-cols-[390px_1fr]">
        <aside className="ch-panel flex flex-col p-7">
          <Gauge value={50} label="Overall score" icon="👍" />
          <div className="my-8 border-t border-[var(--app-border)]" />
          <div className="space-y-4">
            {sections.map(([label, score, tone]) => (
              <button key={label} className="flex min-h-12 w-full items-center justify-between rounded-full bg-[var(--app-bg-muted)] px-5 text-left font-semibold" type="button">
                <span className={label === "Headline" ? "text-[var(--app-accent)]" : ""}>{label}</span>
                <span className={tone === "red" ? "text-[var(--app-danger)]" : tone === "pink" ? "text-[#e879d2]" : "text-[var(--app-success)]"}>{score}/10</span>
              </button>
            ))}
          </div>
          <div className="mt-auto pt-10">
            <button className="ch-primary-button w-full" type="button">Analyze Profile</button>
          </div>
        </aside>

        <section className="ch-panel p-7">
          <h2 className="text-[20px] font-bold">Headline: <span className="text-[var(--app-success)]">7/10</span></h2>
          <div className="my-5 border-t border-dashed border-[var(--app-border)]" />
          <p className="text-[15px]"><b>Current Headline:</b> <i>Helping brands grow through words | Content Creator & Strategist</i></p>
          {[
            ["Critique", "The tone is friendly, but lacks specifics. No mention of industries, key skills, or experience level. Doesn't highlight measurable impact."],
            ["Suggestions & Tips", "Add industry focus, target audience, and specific outcomes. Recruiters should understand your value in one scan."],
            ["Example Headlines", "Content Marketing Strategist | 5+ Years Driving Growth for SaaS & B2B Brands | SEO + Copywriting"],
          ].map(([title, body]) => (
            <article key={title} className="ch-soft-card mt-6 p-5">
              <h3 className="font-bold">{title}</h3>
              <p className="mt-3 text-[15px] leading-6 text-[var(--app-text-secondary)]">{body}</p>
            </article>
          ))}
        </section>
      </div>

      <section className="ch-panel p-6">
        <h2 className="text-[20px] font-bold">LinkedIn Profile URL</h2>
        <p className="mt-2 text-[var(--app-text-secondary)]">Enter your LinkedIn profile URL</p>
        <div className="mt-5 flex gap-3">
          <input className="h-14 flex-1 rounded-full border border-[var(--app-border)] px-6 outline-none focus:ring-2 focus:ring-[var(--app-focus-ring)]" placeholder="https://www.linkedin.com/in/username" />
          <button className="ch-primary-button" type="button">Run</button>
        </div>
        <div className="mt-8"><ProgressLine value={64} /></div>
      </section>
    </ProductPageChrome>
  );
}
