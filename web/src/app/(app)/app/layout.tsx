import type { ReactNode } from "react";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

import { DouBowLogo } from "@/components/brand/DouBowLogo";

function NavItem({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="block rounded-md px-3 py-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-black/5 dark:hover:bg-white/10"
    >
      {children}
    </Link>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1">
      <aside className="w-72 border-r border-[var(--border)] px-6 py-10">
        <Link href="/app/dashboard" className="inline-flex items-center gap-2 font-semibold">
          <DouBowLogo variant="black" text="DouBow" size={26} />
        </Link>
        <nav className="mt-8 space-y-1">
          <NavItem href="/app/dashboard">Dashboard</NavItem>
          <NavItem href="/app/discovery">Job Discovery</NavItem>
          <NavItem href="/app/tracker">Job Tracker</NavItem>
          <NavItem href="/app/approvals">Approvals</NavItem>
          <NavItem href="/app/copilot">Copilot</NavItem>
        </nav>
      </aside>

      <main className="flex flex-1 flex-col">
        <div className="border-b border-[var(--border)] px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Workspace</div>
            <UserButton />
          </div>
        </div>
        <div className="flex-1 px-6 py-10">{children}</div>
      </main>
    </div>
  );
}

