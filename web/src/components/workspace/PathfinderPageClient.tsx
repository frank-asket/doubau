"use client";

import {
  BottomActions,
  ProgressLine,
  Tag,
} from "./CareerHeroMockSections";
import { ProductPageChrome } from "./ProductPageChrome";

const paths = [
  {
    title: "Senior UX Designer",
    meta: ["0-6 months transition", "£45,000-£65,000", "Moderate to High"],
    match: 90,
    body: "A Senior UX Designer is responsible for leading the design of digital products.",
    required: ["UI design proficiency", "UX design principles", "User research", "Prototyping and wireframing"],
  },
  {
    title: "UX Researcher",
    meta: ["3-9 months transition", "£35,000-£55,000", "Moderate"],
    match: 75,
    body: "A UX Researcher is focused on understanding user behaviours, needs, and motivations.",
    required: ["User testing", "Data analysis", "Survey design", "Qualitative research"],
  },
  {
    title: "Product Manager",
    meta: ["6-12 months transition", "£40,000-£70,000", "High"],
    match: 70,
    body: "A Product Manager owns the strategy, roadmap, and feature definition for a product line.",
    required: ["Product strategy", "Stakeholder management", "Roadmapping", "Prioritisation"],
  },
];

export function PathfinderPageClient() {
  return (
    <ProductPageChrome
      title="Career Pathfinder"
      description="Personalized career paths based on your skills, interests, and goals."
    >
      <section className="ch-panel p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-[28px] font-bold tracking-tight text-[var(--app-text-primary)]">
              Your Personalized Career Paths
            </h2>
            <p className="mt-2 max-w-4xl text-[15px] leading-6 text-[var(--app-text-primary)]">
              Based on your skills, interests, and goals, we have identified these promising career transitions. Each path includes detailed insights, upskilling recommendations, and a roadmap for success.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Tag active>AI-Powered Matching</Tag>
              <Tag active>Real Success Stories</Tag>
              <Tag active>Live Opportunities</Tag>
            </div>
          </div>
          <button className="font-semibold text-[var(--app-accent)]" type="button">+ Explore New Path</button>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          {paths.map((path) => (
            <article key={path.title} className="ch-soft-card overflow-hidden">
              <div className="p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-[20px] font-bold text-[var(--app-text-primary)]">{path.title}</h3>
                  <span className="text-[22px] text-[var(--app-text-secondary)]">⋮</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {path.meta.map((item) => <Tag key={item}>{item}</Tag>)}
                </div>
                <p className="mt-6 min-h-[72px] text-[15px] leading-6 text-[var(--app-text-primary)]">{path.body}</p>
                <div className="mt-4 grid grid-cols-[1fr_auto] items-center gap-4">
                  <ProgressLine value={path.match} />
                  <span className="text-[14px] font-semibold text-[var(--app-text-primary)]">{path.match}% match</span>
                </div>
              </div>
              <div className="border-t border-dashed border-[var(--app-border)] p-5">
                <div className="flex items-center justify-between text-[16px] font-bold text-[var(--app-accent)]">
                  Skills <span>⌃</span>
                </div>
                <p className="mt-5 text-[14px] font-semibold text-[var(--app-text-primary)]">Your transferable skills:</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {["Problem-solving", "Creativity", "Analytical"].map((skill) => <Tag key={skill} active>✓ {skill}</Tag>)}
                </div>
                <p className="mt-5 text-[14px] font-semibold text-[var(--app-text-primary)]">Required skills:</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {path.required.map((skill) => <Tag key={skill}>{skill} +</Tag>)}
                </div>
              </div>
              {["Learning Path", "Market Insights", "Target Companies"].map((label) => (
                <div key={label} className="flex items-center justify-between border-t border-dashed border-[var(--app-border)] px-5 py-4 font-semibold text-[var(--app-text-primary)]">
                  {label} <span>⌄</span>
                </div>
              ))}
              <div className="p-5">
                <button className="ch-primary-button w-full" type="button">Create Transition Plan</button>
              </div>
            </article>
          ))}
        </div>
        <div className="mt-8">
          <BottomActions />
        </div>
      </section>
    </ProductPageChrome>
  );
}
