"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useMemo, useState } from "react";

import {
  useMinWidthXl,
  usePrefersReducedMotion,
} from "@/hooks/use-sidebar-media";

function navActive(pathname: string, href: string) {
  if (pathname === href) return true;
  return pathname.startsWith(`${href}/`);
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export type AppNavItem = {
  href: string;
  label: string;
  /** One-line purpose — shallow IA without extra navigation depth. */
  subtitle?: string;
};

export type AppNavSection = {
  id: string;
  title: string;
  items: AppNavItem[];
  /**
   * When true, links render inside a collapsible submenu (disclosure).
   * On viewports ≥1280px (`xl`), sections default to expanded when no child route is active;
   * below that, they default collapsed to save vertical space. Active routes always expand their section.
   */
  collapsible?: boolean;
};

function NavLinkStack({
  pathname,
  items,
  submenu = false,
}: {
  pathname: string;
  items: AppNavItem[];
  /** Indent + divider when links live inside a collapsible submenu. */
  submenu?: boolean;
}) {
  return (
    <ul
      className={
        submenu ? "space-y-0.5 border-l border-white/[0.08] pl-2" : "space-y-0.5"
      }
    >
      {items.map(({ href, label, subtitle }) => {
        const active = navActive(pathname, href);
        return (
          <li key={`${href}:${label}`}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={`relative block min-h-10 rounded-md px-3 py-2 transition-[background-color,color,box-shadow] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--app-sidebar)] ${
                active
                  ? "bg-[var(--app-sidebar-active-bg)] text-white shadow-[inset_3px_0_0_var(--app-accent)]"
                  : "text-[var(--app-sidebar-muted)] hover:bg-[var(--app-sidebar-hover-bg)] hover:text-white/80"
              }`}
            >
              <span className={`block text-[12.5px] leading-tight ${active ? "font-medium" : ""}`}>{label}</span>
              {subtitle ? (
                <span
                  className={`mt-0.5 block text-[10.5px] leading-snug ${
                    active ? "text-white/55" : "text-white/35"
                  }`}
                >
                  {subtitle}
                </span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function SidebarSection({ section, pathname }: { section: AppNavSection; pathname: string }) {
  const hasActiveChild = useMemo(
    () => section.items.some((i) => navActive(pathname, i.href)),
    [pathname, section.items],
  );

  const collapsible = section.collapsible === true;
  const isXl = useMinWidthXl();
  const reducedMotion = usePrefersReducedMotion();

  const [manualOpen, setManualOpen] = useState(false);

  /**
   * ≥xl: roadmap groups default open when no child route is active (easier discovery on wide layouts).
   * &lt;xl: default collapsed (vertical space).
   * Active child: always expanded. Manual toggle sticks until URL or breakpoint drives a new sync.
   * Crossing the xl boundary re-applies the layout default (collapse on narrow, expand on wide).
   */
  useLayoutEffect(() => {
    if (!collapsible) return;
    if (hasActiveChild) {
      setManualOpen(true);
      return;
    }
    setManualOpen(isXl);
  }, [collapsible, hasActiveChild, isXl]);

  const expanded = collapsible ? hasActiveChild || manualOpen : true;

  const sectionHeadingId = `nav-section-${section.id}`;
  const submenuId = `nav-submenu-${section.id}`;

  const chevronMotion = reducedMotion ? "" : "transition-transform duration-200 ease-out";

  if (!collapsible) {
    return (
      <div>
        <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/35">
          {section.title}
        </div>
        <NavLinkStack pathname={pathname} items={section.items} submenu={false} />
      </div>
    );
  }

  return (
    <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-1">
      <button
        type="button"
        id={sectionHeadingId}
        aria-expanded={expanded}
        aria-controls={submenuId}
        title={
          hasActiveChild
            ? "This section stays open while you’re on one of its pages."
            : undefined
        }
        onClick={() => {
          if (hasActiveChild) return;
          setManualOpen((o) => !o);
        }}
        className={`flex w-full items-center justify-between gap-2 rounded px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-white/45 transition-colors hover:bg-[var(--app-sidebar-hover-bg)] hover:text-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--app-sidebar)] ${
          hasActiveChild ? "cursor-default text-white/55" : ""
        }`}
      >
        <span>{section.title}</span>
        <ChevronIcon
          className={`shrink-0 text-white/45 ${chevronMotion} ${expanded ? "rotate-180" : ""}`}
        />
      </button>
      {expanded ? (
        <div id={submenuId} role="region" aria-labelledby={sectionHeadingId} className="mt-1 pb-1">
          <NavLinkStack pathname={pathname} items={section.items} submenu />
        </div>
      ) : null}
    </div>
  );
}

export function AppSidebarNav({ sections }: { sections: AppNavSection[] }) {
  const pathname = usePathname();

  return (
    <nav className="space-y-5" aria-label="Workspace">
      {sections.map((section) => (
        <SidebarSection key={section.id} section={section} pathname={pathname} />
      ))}
    </nav>
  );
}
