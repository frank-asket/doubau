"use client";

import { useState } from "react";

import { AppIcon } from "@/components/ui/app-icon";

const SYSTEMS = [
  {
    id: "doubow",
    title: "DouBow design system",
    src: "/doubow_design_system.html",
    hint: "Sidebar #0F1117, accent #1a5cff — matches `.theme-app` in app-theme.css (Phase 4).",
  },
  {
    id: "careerhero",
    title: "CareerHero v2",
    src: "/careerhero_design_system_v2.html",
    hint: "Inter + JetBrains Mono, Tabler icons — `--ch-*` bridge tokens in `.theme-app`.",
  },
] as const;

export default function DesignSystemPage() {
  const [active, setActive] = useState(0);
  const current = SYSTEMS[active];

  return (
    <div className="theme-app -mx-6 -my-6 flex min-h-[calc(100dvh-var(--app-topbar-h)-48px)] flex-col bg-[var(--app-bg-page)] font-[family-name:var(--font-app-sans)]">
      <header className="shrink-0 border-b border-[var(--app-border)] bg-[var(--app-bg-elevated)] px-6 py-4">
        <div className="mx-auto flex max-w-[var(--app-content-max)] flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-lg font-semibold text-[var(--app-text-primary)]">Design references</h1>
              <p className="mt-1 max-w-2xl text-sm text-[var(--app-text-secondary)]">{current.hint}</p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <a
                href="/product-userflow-spec.html"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-[var(--app-text-secondary)] hover:text-[var(--app-accent)]"
              >
                Userflow spec
              </a>
              <a
                href="/product-screens-part2-spec.html"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-[var(--app-text-secondary)] hover:text-[var(--app-accent)]"
              >
                Screens part 2
              </a>
              <a
                href="/app/dashboard"
                className="inline-flex min-h-9 items-center gap-1 rounded-full px-2 text-sm font-medium text-[var(--app-accent)] transition-[background-color,transform] duration-150 ease-out hover:bg-[var(--app-bg-muted)] hover:text-[var(--app-accent-hover)] active:scale-[0.96]"
              >
                <AppIcon name="chevron-right" className="size-4 rotate-180" /> Back to workspace
              </a>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {SYSTEMS.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setActive(i)}
                className={`rounded-[var(--app-radius-md)] px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)] focus-visible:ring-offset-2 ${
                  active === i
                    ? "bg-[var(--app-accent)] text-white"
                    : "bg-[var(--app-bg-muted)] text-[var(--app-text-secondary)] hover:bg-[var(--app-border)]"
                }`}
              >
                {s.title}
              </button>
            ))}
            <a
              href={current.src}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-[var(--app-radius-md)] border border-[var(--app-border)] px-4 py-2 text-sm font-medium text-[var(--app-accent)] hover:bg-[var(--app-blue-50)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)] focus-visible:ring-offset-2"
            >
              Open in new tab
            </a>
          </div>
        </div>
      </header>
      <iframe
        title={current.title}
        src={current.src}
        className="min-h-[min(720px,calc(100dvh-var(--app-topbar-h)-220px))] w-full flex-1 border-0 bg-white"
      />
    </div>
  );
}
