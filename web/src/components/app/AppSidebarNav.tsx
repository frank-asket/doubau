"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useMemo, useState } from "react";

import {
  useMinWidthXl,
  usePrefersReducedMotion,
} from "@/hooks/use-sidebar-media";
import { useCareerGrowthHoverPrefetch } from "@/components/providers/CareerGrowthProvider";
import { AppIcon, type AppIconName } from "@/components/ui/app-icon";

function navActive(pathname: string, href: string) {
  if (pathname === href) return true;
  return pathname.startsWith(`${href}/`);
}

export type AppNavItem = {
  href: string;
  label: string;
  icon?: AppIconName;
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
    <ul className={submenu ? "space-y-1 border-l border-white/[0.08] pl-2" : "space-y-1"}>
      {items.map(({ href, label, subtitle, icon }) => {
        const active = navActive(pathname, href);
        return (
          <li key={`${href}:${label}`}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={`relative flex min-h-11 items-center gap-3 rounded-2xl px-3 py-2 transition-[background-color,color,box-shadow,transform] duration-150 ease-out hover:translate-x-0.5 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--app-sidebar)] ${
                active
                  ? "bg-[var(--app-sidebar-active-bg)] text-[var(--app-accent)] shadow-[inset_0_0_0_1px_rgba(32,209,125,0.16)]"
                  : "text-[var(--app-sidebar-muted)] hover:bg-[var(--app-sidebar-hover-bg)] hover:text-white/80"
              }`}
            >
              <span className={`grid size-7 shrink-0 place-items-center rounded-xl ${active ? "bg-[rgba(32,209,125,0.14)]" : "bg-white/[0.04]"}`} aria-hidden>
                <AppIcon name={icon ?? "circle"} className="size-4" />
              </span>
              <span className="min-w-0">
                <span className={`block truncate text-[14px] leading-tight ${active ? "font-semibold" : "font-medium"}`}>{label}</span>
                {subtitle ? (
                  <span
                    className={`mt-0.5 hidden text-[10.5px] leading-snug ${
                      active ? "text-white/55" : "text-white/35"
                    }`}
                  >
                    {subtitle}
                  </span>
                ) : null}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function SidebarSection({ section, pathname }: { section: AppNavSection; pathname: string }) {
  const prefetchCareerData = useCareerGrowthHoverPrefetch();
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
    <div>
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
        onPointerEnter={() => {
          if (section.id === "career-growth") prefetchCareerData();
        }}
        onClick={() => {
          if (hasActiveChild) return;
          setManualOpen((o) => !o);
        }}
        className={`flex w-full items-center justify-between gap-2 rounded-2xl px-3 py-2 text-left text-[14px] font-semibold text-white/55 transition-colors hover:bg-[var(--app-sidebar-hover-bg)] hover:text-white/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--app-sidebar)] ${
          hasActiveChild ? "bg-[var(--app-sidebar-active-bg)] text-[var(--app-accent)]" : ""
        }`}
      >
        <span>{section.title}</span>
        <AppIcon name="chevron-down" className={`size-4 text-white/45 ${chevronMotion} ${expanded ? "rotate-180" : ""}`} />
      </button>
      {expanded ? (
        <div id={submenuId} role="region" aria-labelledby={sectionHeadingId} className="mt-2 pb-1 pl-5">
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
