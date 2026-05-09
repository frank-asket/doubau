import type { ReactNode } from "react";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

import { AppThemeShell } from "@/components/app/AppThemeShell";
import { DouBowLogo } from "@/components/brand/DouBowLogo";

function NavItem({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="block rounded-md px-3 py-2 text-[12.5px] text-[var(--app-sidebar-muted)] transition-colors hover:bg-[var(--app-sidebar-hover-bg)] hover:text-white/80"
    >
      {children}
    </Link>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AppThemeShell className="flex flex-row">
      <aside
        className="flex w-[var(--app-sidebar-w)] shrink-0 flex-col border-r border-white/[0.06] px-4 py-8"
        style={{ backgroundColor: "var(--app-sidebar)" }}
      >
        <Link href="/app/dashboard" className="inline-flex items-center gap-2 px-2 font-semibold">
          <DouBowLogo variant="white" text="DouBow" size={26} />
        </Link>
        <nav className="mt-8 space-y-0.5">
          <NavItem href="/app/dashboard">Dashboard</NavItem>
          <NavItem href="/app/analytics">Match analytics</NavItem>
          <NavItem href="/app/discovery">Job Discovery</NavItem>
          <NavItem href="/app/tracker">Job Tracker</NavItem>
          <NavItem href="/app/approvals">Approvals</NavItem>
          <NavItem href="/app/copilot">Copilot</NavItem>
        </nav>
      </aside>

      <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-[var(--app-bg-page)]">
        <header
          className="flex h-[var(--app-topbar-h)] shrink-0 items-center justify-between border-b-[0.5px] border-[var(--app-border)] bg-[var(--app-bg-elevated)] px-6"
        >
          <div className="text-[13px] font-semibold text-[var(--app-text-primary)]">Workspace</div>
          <UserButton />
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>
      </main>
    </AppThemeShell>
  );
}
