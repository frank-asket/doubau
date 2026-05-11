"use client";

import { ProgressLine, SegmentedTabs, Tag } from "./CareerHeroMockSections";

export function CareerProfileClient() {
  return (
    <div className="flex w-full flex-col gap-4">
      <section className="ch-panel p-6">
        <div className="mx-auto max-w-5xl">
          <SegmentedTabs items={["Personal Info", "Skills & Expertise", "Career Goals", "Work Style"]} active="Skills & Expertise" />
        </div>
        <div className="mt-6 grid grid-cols-[1fr_auto] items-center gap-4">
          <ProgressLine value={50} />
          <span className="text-[20px] font-bold">50%</span>
        </div>
      </section>

      <section className="ch-panel p-7">
        <h2 className="text-[18px] font-bold">Technical Skills</h2>
        <div className="mt-4 flex gap-4">
          <input className="h-14 flex-1 rounded-full border border-[var(--app-border)] px-6 outline-none focus:ring-2 focus:ring-[var(--app-focus-ring)]" placeholder="Search technical skills..." />
          <button className="ch-primary-button" type="button">+ Add Skill</button>
        </div>
        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          {[
            ["React", 50, 80, ["Know how JSX works"], ["BASF Certified Agronomy Advisor"], ["Fertilizer Trial Program"]],
            ["Kubernetes", 24, 100, ["Deploy apps with YAML", "Scale clusters efficiently"], ["No certification"], []],
            ["Docker", 62, 90, ["Build lightweight containers"], ["Docker Certified Associate (DCA)"], ["No projects"]],
          ].map(([name, current, target, goals, certs, projects]) => (
            <article key={String(name)} className="ch-soft-card p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="grid size-12 place-items-center rounded-full bg-[#1d1d1f] text-white">◉</span>
                  <h3 className="text-[20px] font-bold">{name}</h3>
                </div>
                <span className="text-[var(--app-text-secondary)]">×</span>
              </div>
              <div className="mt-5 flex gap-2"><Tag>1 year exp</Tag><Tag>Learning</Tag></div>
              <div className="mt-6 space-y-5">
                <div><div className="mb-2 flex justify-between font-semibold"><span>Current Proficiency</span><span>{String(current)}%</span></div><ProgressLine value={Number(current)} /></div>
                <div><div className="mb-2 flex justify-between font-semibold"><span>Target Level</span><span>{String(target)}%</span></div><ProgressLine value={Number(target)} /></div>
              </div>
              {[
                ["Learning Goals", goals as string[]],
                ["Certifications", certs as string[]],
                ["Relevant Projects", projects as string[]],
              ].map(([label, items]) => (
                <div key={String(label)} className="mt-6 border-t border-dashed border-[var(--app-border)] pt-5">
                  <h4 className="font-bold">{label}</h4>
                  <ul className="mt-2 space-y-1 text-[13px] text-[var(--app-text-secondary)]">
                    {(items as string[]).length ? (items as string[]).map((item) => <li key={item}>- {item}</li>) : <li>- No projects</li>}
                  </ul>
                </div>
              ))}
            </article>
          ))}
        </div>
      </section>

      <section className="ch-panel p-7">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-[28px] font-bold">Your Personality Type: INTJ <Tag>Architect</Tag></h2>
          <div className="flex gap-4 font-semibold text-[var(--app-accent)]"><button type="button">Download Report</button><button type="button">Share Results</button></div>
        </div>
        <div className="mt-6 grid gap-5 lg:grid-cols-3">
          {[
            ["Key Strengths", ["Strategic planning", "Complex problem solving", "Independent thinking", "High standards"]],
            ["Work Style", ["Prefers independent work", "Focuses on long-term strategy", "Values efficiency and logic", "Driven by continuous improvement"]],
            ["Communication", ["Direct and concise", "Focuses on facts and logic", "Prefers written communication", "Values intellectual discourse"]],
          ].map(([title, items]) => (
            <article key={String(title)} className="rounded-2xl border border-[var(--app-border)] bg-white p-6">
              <h3 className="text-[20px] font-bold">{title}</h3>
              <ul className="mt-5 space-y-3 text-[15px] text-[var(--app-text-secondary)]">
                {(items as string[]).map((item) => <li key={item}>• {item}</li>)}
              </ul>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
