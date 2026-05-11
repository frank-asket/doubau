"use client";

import { JobPickCard, Tag } from "./CareerHeroMockSections";
import { ProductPageChrome } from "./ProductPageChrome";

export function SalaryBenchmarkClient() {
  const points = [38, 72, 40, 25, 50, 57, 78, 42, 54, 58, 69, 42];

  return (
    <ProductPageChrome title="Salary Benchmark">
      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <section className="ch-panel p-6">
            <h2 className="text-[20px] font-bold">Salary Overview</h2>
            <div className="mt-8 flex items-baseline gap-3">
              <span className="grid size-12 place-items-center rounded-full bg-[var(--app-blue-50)] text-[var(--app-accent)]">$</span>
              <span className="text-[34px] font-bold">£65,000</span>
              <span className="font-semibold">(Average annual salary)</span>
              <span className="font-bold text-[var(--app-success)]">+5.2% YoY</span>
            </div>
            <div className="relative mt-8 h-80">
              <div className="absolute inset-x-0 top-1/2 border-t border-dotted border-[var(--app-text-secondary)]" />
              <svg className="h-full w-full overflow-visible" viewBox="0 0 720 260" preserveAspectRatio="none" aria-label="Salary trend chart">
                <polyline
                  fill="none"
                  stroke="var(--app-accent)"
                  strokeWidth="4"
                  points={points.map((p, i) => `${(i / (points.length - 1)) * 720},${250 - p * 2.6}`).join(" ")}
                />
                {points.map((p, i) => (
                  <circle key={`${p}-${i}`} cx={(i / (points.length - 1)) * 720} cy={250 - p * 2.6} r="7" fill="var(--app-accent)" stroke="white" strokeWidth="3" />
                ))}
              </svg>
              <div className="mt-2 grid grid-cols-6 gap-2 text-center text-[12px] font-semibold text-[var(--app-text-secondary)] md:grid-cols-12">
                {["06/24", "07/24", "08/24", "09/24", "10/24", "11/24", "12/24", "01/25", "02/25", "03/25", "04/25", "05/25"].map((m) => <Tag key={m}>{m}</Tag>)}
              </div>
            </div>
          </section>

          <section className="ch-panel p-6">
            <h2 className="text-[20px] font-bold">Top Companies</h2>
            {["Google", "Amazon", "Apple"].map((company) => (
              <article key={company} className="mt-5 border-b border-dashed border-[var(--app-border)] pb-5 last:border-0">
                <div className="flex justify-between gap-4">
                  <div>
                    <h3 className="font-bold">{company}</h3>
                    <p className="mt-2 text-[15px] text-[var(--app-text-primary)]">Leading the way in tech and innovation</p>
                  </div>
                  <div className="text-right font-bold text-[var(--app-accent)]">£85,000<p className="text-[12px] text-[var(--app-text-secondary)]">Median Salary</p></div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2"><Tag>Remote Work</Tag><Tag>Health Insurance</Tag><Tag>Stock Options</Tag><Tag>Learning Budget</Tag></div>
              </article>
            ))}
          </section>
        </div>
        <aside className="space-y-4">
          <section className="ch-panel p-6">
            <h2 className="text-[20px] font-bold">Salary Predictor</h2>
            {["Job Title", "Location (optional)", "Years of Experience", "Skills & Requirements (Optional)"].map((label) => (
              <label key={label} className="mt-6 block font-semibold">
                {label}
                <input className="mt-3 h-12 w-full rounded-full border border-[var(--app-border)] px-5 outline-none focus:ring-2 focus:ring-[var(--app-focus-ring)]" placeholder="e.g. Software Engineer" />
              </label>
            ))}
            <button className="ch-primary-button mt-7 w-full" type="button">Predict Salary</button>
          </section>
          <section className="ch-panel p-6">
            <h2 className="text-[20px] font-bold">Top Picks for your next role</h2>
            <div className="mt-5"><JobPickCard /></div>
          </section>
        </aside>
      </div>
    </ProductPageChrome>
  );
}
