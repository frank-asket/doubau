"use client";

import { useState } from "react";

import { CareerFlowProgress, MetricCard, ProgressLine, SegmentedTabs, Tag } from "./CareerHeroMockSections";
import { ProductPageChrome } from "./ProductPageChrome";

const tasks = [
  ["Software Engineer", "Full-stack development role focusing on web applications", 33, "React"],
  ["AWS Solutions Architect Associate", "Cloud architecture certification", 50, "Cloud"],
  ["Senior Software Portfolio", "Showcase production-ready work", 75, "Career"],
];

export function PlannerPageClient() {
  const [view, setView] = useState("List");

  return (
    <ProductPageChrome title="Career Planner">
      <CareerFlowProgress
        steps={["Profile", "Pathfinder", "Roadmap", "Weekly Plan"]}
        active="Roadmap"
        value={75}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <MetricCard title="Planned Tasks" value="10" unit="(tasks)" delta="+13%" icon="⌛">
          Your planned tasks increased by <b>13%</b> in the last 30 days.
        </MetricCard>
        <MetricCard title="In Progress Tasks" value="5" unit="(tasks)" delta="-8%" tone="red" icon="◔">
          Your in-progress tasks decreased by <b>8%</b> in the last 30 days.
        </MetricCard>
        <MetricCard title="Completed Tasks" value="10" unit="(tasks)" delta="+10%" icon="✓">
          Your completed tasks increased by <b>10%</b> in the last 30 days.
        </MetricCard>
      </div>

      <section className="ch-panel p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <SegmentedTabs items={["List", "Kanban", "Calendar"]} active={view} />
          </div>
          <div className="flex gap-3">
            <button className="ch-icon-button" type="button" aria-label="Filters">≡</button>
            <button className="ch-icon-button" type="button" aria-label="Import">⇧</button>
            <button className="ch-primary-button" type="button" onClick={() => setView(view === "List" ? "Kanban" : "List")}>
              + Add Milestone
            </button>
          </div>
        </div>

        {view === "List" ? (
          <div className="mt-8 space-y-5">
            <div className="flex items-center gap-3 text-[20px] font-black">
              <span>v</span> In Progress <Tag>5</Tag>
            </div>
            {tasks.map(([title, desc, pct, tag]) => (
              <article key={title} className="rounded-[20px] border border-[var(--app-border)] bg-white/92 p-5 shadow-[var(--app-shadow-0)]">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="text-[18px] font-black text-[var(--app-text-primary)]">v {title}</h3>
                    <p className="mt-2 text-[15px] text-[var(--app-text-secondary)]">{desc}</p>
                  </div>
                  <div className="flex items-center gap-3 text-[14px] text-[var(--app-text-primary)]">
                    <span>□ Due: 30/06/2025</span>
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-[1fr_auto] items-center gap-4">
                  <ProgressLine value={Number(pct)} />
                  <span className="font-bold">{pct}%</span>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Tag>{tag}</Tag>
                  <Tag>Node.js</Tag>
                  <Tag>TypeScript</Tag>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {["Planned", "In Progress", "Completed"].map((column, idx) => (
              <section key={column} className="rounded-[20px] border border-[var(--app-border)] bg-[var(--app-bg-muted)] p-5">
                <h3 className="text-[20px] font-black">{column} <span className="ml-2 text-[13px] text-[var(--app-text-secondary)]">{idx === 1 ? 5 : 10}</span></h3>
                <div className="mt-5 space-y-4">
                  {tasks.slice(0, idx === 1 ? 1 : 3).map(([title, desc], i) => (
                    <article key={`${column}-${title}-${i}`} className="rounded-2xl bg-white p-4 shadow-[var(--app-shadow-0)]">
                      <div className="flex justify-between text-[13px]"><span>□ Due: 30/06/2025</span></div>
                      <h4 className="mt-3 font-black">{title}</h4>
                      <p className="mt-2 text-[13px] leading-5 text-[var(--app-text-secondary)]">{desc}</p>
                      <div className="mt-4"><ProgressLine value={idx === 2 ? 100 : i * 25} /></div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>
    </ProductPageChrome>
  );
}
