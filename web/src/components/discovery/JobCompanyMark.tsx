"use client";

import { useEffect, useState } from "react";

/** Parse a listing URL and return a bare hostname (no www), or null. */
export function hostnameFromSourceUrl(url: string | null | undefined): string | null {
  if (!url || url === "#") return null;
  try {
    const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    const u = new URL(normalized);
    const h = u.hostname.replace(/^www\./i, "").toLowerCase();
    return h || null;
  } catch {
    return null;
  }
}

/**
 * Hosts where the public site favicon is the job board / ATS, not the hiring company.
 * We skip these for employer-site links because they are not corporate domains.
 */
export function isLowSignalLogoHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h.includes("adzuna.")) return true;
  if (h.includes("indeed.") || h.includes("glassdoor.") || h.includes("linkedin.") || h.includes("monster.")) return true;
  if (h.includes("ziprecruiter.") || h.includes("reed.co") || h.includes("totaljobs.") || h.includes("seek.com")) return true;
  if (h === "boards-api.greenhouse.io") return true;
  if (
    h === "boards.greenhouse.io" ||
    h === "job-boards.greenhouse.io" ||
    h === "jobs.greenhouse.io" ||
    h === "my.greenhouse.io" ||
    h === "jobs.lever.co" ||
    h === "lever.co" ||
    h.includes(".lever.co")
  ) {
    return true;
  }
  if (h.includes("smartrecruiters.com") || h.includes("workable.com") || h.includes("ashbyhq.com")) return true;
  return false;
}

function isProviderLogoUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

export function companyInitials(company: string): string {
  const parts = company.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) {
    const w = parts[0];
    return w.length >= 2 ? w.slice(0, 2).toUpperCase() : w[0]!.toUpperCase();
  }
  return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
}

export type JobCompanyMarkSize = "card" | "detail" | "hero";

export function JobCompanyMark({
  company,
  preferredLogoSrc,
  size = "card",
  presentation = "default",
  className = "",
}: {
  company: string;
  sourceUrl?: string | null;
  /** Provider-supplied logo URL from RapidAPI/JSearch or stored catalog enrichment. */
  preferredLogoSrc?: string | null;
  size?: JobCompanyMarkSize;
  /** Muted logos — soft grayscale for dense lists (e.g. dashboard picks). */
  presentation?: "default" | "muted";
  className?: string;
}) {
  const providerLogo = preferredLogoSrc?.trim();
  const [externalFailed, setExternalFailed] = useState(false);

  useEffect(() => {
    setExternalFailed(false);
  }, [providerLogo]);

  const initials = companyInitials(company);

  const muted = presentation === "muted";
  const mutedBox = muted ? " saturate-[0.88] contrast-[0.98] " : " ";

  const box =
    size === "hero"
      ? `relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl shadow-[inset_0_0_0_1px_rgba(20,24,32,0.06),0_14px_28px_rgba(9,28,17,0.1)]${mutedBox}${className}`
      : size === "detail"
        ? `relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-[var(--app-radius-md)] ring-1 ring-[color-mix(in_srgb,var(--app-border)_80%,transparent)]${mutedBox}${className}`
        : `relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl shadow-[inset_0_0_0_1px_rgba(20,24,32,0.06),0_14px_28px_rgba(9,28,17,0.08)]${mutedBox}${className}`;

  const textCls =
    size === "hero"
      ? "text-3xl font-black tracking-tight"
      : size === "detail"
        ? "text-[18px] font-semibold tracking-tight"
        : "text-[28px] font-black";

  const pxSize = size === "hero" ? 64 : size === "detail" ? 48 : 56;

  if (providerLogo && isProviderLogoUrl(providerLogo) && !externalFailed) {
    return (
      <span className={box} role="img" aria-label={`${company} logo`}>
        <img
          src={providerLogo}
          alt=""
          width={pxSize}
          height={pxSize}
          className={`bg-white object-contain p-1.5 ${muted ? "grayscale-[0.35] opacity-[0.92]" : ""}`}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setExternalFailed(true)}
        />
      </span>
    );
  }

  return (
    <span
      className={box}
      role="img"
      aria-label={`${company} logo`}
    >
      <span
        className={`flex size-full items-center justify-center bg-[var(--app-badge-blue-bg)] ${textCls} text-[var(--app-badge-blue-fg)]`}
      >
        {initials}
      </span>
    </span>
  );
}
