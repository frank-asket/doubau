import type { ReactNode } from "react";
import Link from "next/link";

import { DouBowLogo } from "@/components/brand/DouBowLogo";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grain flex min-h-dvh flex-1">
      <div className="grid w-full items-stretch lg:grid-cols-2">
        <aside className="hidden lg:block">
          <div className="relative h-full overflow-hidden border-r border-[var(--border)] bg-[color-mix(in_srgb,var(--background)_76%,transparent)] p-12 shadow-sm shadow-black/5 backdrop-blur dark:shadow-black/25">
              <div className="absolute inset-0 -z-10 opacity-70">
                <div className="absolute -left-24 -top-24 size-80 rounded-full bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] blur-3xl" />
                <div className="absolute -bottom-40 -right-28 size-[28rem] rounded-full bg-[color-mix(in_srgb,var(--deep)_18%,transparent)] blur-3xl" />
              </div>

              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-md px-2 py-2 font-semibold tracking-tight hover:bg-black/5 dark:hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              >
                <DouBowLogo variant="black" text="DouBow" size={26} />
              </Link>

              <h2 className="mt-8 text-balance text-3xl font-semibold tracking-tight">
                AI drafts. You decide.
                <span className="block text-[color-mix(in_srgb,var(--foreground)_72%,transparent)]">
                  Nothing moves without you.
                </span>
              </h2>
              <p className="mt-4 max-w-md text-sm leading-6 text-[var(--muted)]">
                A job search workspace that keeps everything in one place: discovery, scoring, outreach drafts, approvals, and
                tracking — with human-in-the-loop safety rails.
              </p>

              <ul className="mt-8 space-y-3 text-sm">
                <li className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--accent)_22%,transparent)] text-[var(--accent-foreground)]"
                  >
                    ✓
                  </span>
                  <span>
                    <span className="font-semibold">HITL enforcement</span> at the API layer — no “auto-apply” surprises.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--accent)_22%,transparent)] text-[var(--accent-foreground)]"
                  >
                    ✓
                  </span>
                  <span>
                    <span className="font-semibold">Résumé-grounded</span> scoring and drafting — less generic output.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--accent)_22%,transparent)] text-[var(--accent-foreground)]"
                  >
                    ✓
                  </span>
                  <span>
                    <span className="font-semibold">One system</span> for discovery → approvals → tracker.
                  </span>
                </li>
              </ul>

              <div className="mt-10 grid grid-cols-3 gap-3">
                <div className="rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--background)_88%,transparent)] px-4 py-3 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
                  <div className="text-xs text-[var(--muted)]">Setup</div>
                  <div className="mt-1 text-sm font-semibold">~5 min</div>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--background)_88%,transparent)] px-4 py-3 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
                  <div className="text-xs text-[var(--muted)]">Approvals</div>
                  <div className="mt-1 text-sm font-semibold">Always</div>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--background)_88%,transparent)] px-4 py-3 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
                  <div className="text-xs text-[var(--muted)]">Flow</div>
                  <div className="mt-1 text-sm font-semibold">End-to-end</div>
                </div>
              </div>

              <div className="mt-10 rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--background)_86%,transparent)] p-5">
                <p className="text-sm leading-6 text-[var(--muted)]">
                  “It feels like a project dashboard for my job search. The drafts save time, and approvals keep me in control.”
                </p>
                <p className="mt-3 text-xs font-semibold text-[var(--foreground)]">
                  Student / recent grad · Job search sprint
                </p>
              </div>
          </div>
        </aside>

        <div className="flex items-center justify-center px-4 py-10 lg:px-12">
          <div className="w-full max-w-md">
            <Link
              href="/"
              className="mb-6 inline-flex items-center gap-2 rounded-md px-2 py-2 font-semibold tracking-tight hover:bg-black/5 dark:hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] lg:hidden"
            >
              <DouBowLogo variant="black" text="DouBow" size={26} />
            </Link>

            {children}

            <p className="mt-6 text-xs text-[var(--muted)]">
              By continuing, you agree to our{" "}
              <Link href="/security" className="font-semibold text-[var(--foreground)] hover:underline">
                security practices
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

