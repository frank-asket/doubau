"use client";

import Link from "next/link";

import { CareerFlowProgress, FieldShell, ProgressLine, SegmentedTabs, Tag } from "./CareerHeroMockSections";

const profileSteps = ["Personal Info", "Skills & Expertise", "Career Goals", "Work Style"];
const skills = [
  {
    name: "React",
    current: 50,
    target: 80,
    experience: "1 year exp",
    goals: ["Know how JSX works"],
    certifications: ["React foundations"],
    projects: ["Portfolio dashboard"],
  },
  {
    name: "Kubernetes",
    current: 24,
    target: 100,
    experience: "2 year exp",
    goals: ["Deploy apps with YAML", "Scale clusters efficiently"],
    certifications: ["No certification"],
    projects: ["Cluster migration plan"],
  },
  {
    name: "Docker",
    current: 62,
    target: 90,
    experience: "3 year exp",
    goals: ["Build lightweight containers"],
    certifications: ["Docker Certified Associate"],
    projects: ["Containerized job scraper"],
  },
];

export function CareerProfileClient() {
  return (
    <div className="flex w-full flex-col gap-4">
      <CareerFlowProgress steps={profileSteps} active="Skills & Expertise" value={50} />

      <section className="ch-panel p-7">
        <div className="mx-auto max-w-5xl">
          <SegmentedTabs items={["Basic Info", "Work Preferences", "Skills & Expertise", "Career Motivations"]} active="Skills & Expertise" />
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <FieldShell label="Current role" value="Frontend Engineer" icon="ID" />
          <FieldShell label="Target role" value="Senior Product Designer" icon="TR" />
          <FieldShell label="Preferred work mode" value="Hybrid or remote" icon="WM" />
          <FieldShell label="Preferred industries" value="Technology, product, design systems" icon="IN" />
          <FieldShell label="Location preference" value="London, Manchester, remote UK" icon="LO" wide />
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-[20px] font-black tracking-tight">Technical Skills</h2>
            <p className="mt-1 text-[13px] text-[var(--app-text-secondary)]">
              Skills are weighted against the career paths you are exploring.
            </p>
          </div>
          <button className="ch-primary-button" type="button">+ Add Skill</button>
        </div>
        <div className="mt-4 flex gap-4">
          <input className="h-14 flex-1 rounded-full border border-[var(--app-border)] bg-white/86 px-6 outline-none shadow-[var(--app-shadow-0)] placeholder:text-[var(--app-text-tertiary)] focus:ring-2 focus:ring-[var(--app-focus-ring)]" placeholder="Search technical skills..." />
        </div>
        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          {skills.map((skill) => (
            <article key={skill.name} className="ch-soft-card p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="grid size-12 place-items-center rounded-full bg-[#111612] text-[13px] font-black text-white">
                    {skill.name.slice(0, 2).toUpperCase()}
                  </span>
                  <h3 className="text-[20px] font-bold">{skill.name}</h3>
                </div>
                <span className="text-[var(--app-text-secondary)]">×</span>
              </div>
              <div className="mt-5 flex gap-2"><Tag>{skill.experience}</Tag><Tag>Learning</Tag></div>
              <div className="mt-6 space-y-5">
                <div><div className="mb-2 flex justify-between font-semibold"><span>Current Proficiency</span><span>{skill.current}%</span></div><ProgressLine value={skill.current} /></div>
                <div><div className="mb-2 flex justify-between font-semibold"><span>Target Level</span><span>{skill.target}%</span></div><ProgressLine value={skill.target} /></div>
              </div>
              {([
                ["Learning Goals", skill.goals],
                ["Certifications", skill.certifications],
                ["Relevant Projects", skill.projects],
              ] satisfies Array<[string, string[]]>).map(([label, items]) => (
                <div key={label} className="mt-6 border-t border-dashed border-[var(--app-border)] pt-5">
                  <h4 className="font-bold">{label}</h4>
                  <ul className="mt-2 space-y-1 text-[13px] text-[var(--app-text-secondary)]">
                    {items.map((item) => <li key={item}>- {item}</li>)}
                  </ul>
                </div>
              ))}
            </article>
          ))}
        </div>
      </section>

      <section className="ch-panel p-7">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-[28px] font-black tracking-tight">Your Personality Type: INTJ <Tag>Architect</Tag></h2>
          <div className="flex gap-4 font-semibold text-[var(--app-blue-500)]"><button type="button">Download Report</button><button type="button">Share Results</button></div>
        </div>
        <div className="mt-6 grid gap-5 lg:grid-cols-3">
          {[
            ["Key Strengths", "ST", ["Strategic planning", "Complex problem solving", "Independent thinking", "High standards"]],
            ["Work Style", "WS", ["Prefers independent work", "Focuses on long-term strategy", "Values efficiency and logic", "Driven by continuous improvement"]],
            ["Communication", "CM", ["Direct and concise", "Focuses on facts and logic", "Prefers written communication", "Values intellectual discourse"]],
          ].map(([title, icon, items]) => (
            <article key={String(title)} className="rounded-2xl border border-[var(--app-border)] bg-white p-6">
              <div className="flex items-center gap-4">
                <span className="grid size-12 place-items-center rounded-full bg-[var(--app-blue-50)] text-[12px] font-black text-[var(--app-blue-500)]">
                  {icon}
                </span>
                <h3 className="text-[20px] font-bold">{title}</h3>
              </div>
              <ul className="mt-5 space-y-3 text-[15px] text-[var(--app-text-secondary)]">
                {(items as string[]).map((item) => <li key={item} className="flex gap-3"><span className="text-[var(--app-success)]">•</span>{item}</li>)}
              </ul>
            </article>
          ))}
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <Link className="ch-soft-card flex min-h-14 items-center justify-center font-bold text-[var(--app-blue-500)]" href="/app/pathfinder">
            Next: Explore Career Pathfinder
          </Link>
          <Link className="ch-primary-button min-h-14" href="/app/planner">
            Build Career Plan
          </Link>
        </div>
      </section>
    </div>
  );
}
