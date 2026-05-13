"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

/** Logo.dev publishable token (https://www.logo.dev/docs). Alias for older env name. */
function logoDevPublishableKey(): string {
  return (
    (process.env.NEXT_PUBLIC_LOGO_DEV_KEY ?? "").trim() ||
    (process.env.NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY ?? "").trim()
  );
}

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
 * We skip these for logo resolution so we fall back to employer name heuristics or initials.
 */
function isLowSignalLogoHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "remoteok.com" || h.endsWith(".remoteok.com")) return true;
  if (h.includes("adzuna.")) return true;
  if (h.includes("indeed.") || h.includes("glassdoor.") || h.includes("linkedin.") || h.includes("monster.")) return true;
  if (h.includes("ziprecruiter.") || h.includes("reed.co") || h.includes("totaljobs.") || h.includes("seek.com")) return true;
  if (h === "boards-api.greenhouse.io") return true;
  if (
    h === "boards.greenhouse.io" ||
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

/**
 * Many listings point at ATS hosts (Greenhouse, Lever, …) where the hostname is not the employer.
 * We still derive a **likely corporate domain** from the first path segment so Logo.dev / favicons
 * can resolve — otherwise the employer metadata panel stays empty.
 */
const GREENHOUSE_LEVER_SLUG_DOMAIN_OVERRIDES: Record<string, string> = {
  doordashusa: "doordash.com",
  doordash: "doordash.com",
  reddit: "reddit.com",
  lyft: "lyft.com",
  airbnb: "airbnb.com",
  stripe: "stripe.com",
};

function boardSlugToEmployerDomain(slugRaw: string): string | null {
  const slug = slugRaw.trim().toLowerCase().replace(/_/g, "-");
  if (!slug || slug.length < 2 || slug.length > 48) return null;
  if (GREENHOUSE_LEVER_SLUG_DOMAIN_OVERRIDES[slug]) return GREENHOUSE_LEVER_SLUG_DOMAIN_OVERRIDES[slug];
  // "acme-corp" → too ambiguous for auto-.com; skip hyphens in slug
  if (slug.includes("-")) return null;
  // Strip common regional suffixes before guessing .com
  const stripped = slug.replace(/(usa|uk|eu|global)$/i, "");
  if (stripped !== slug && GREENHOUSE_LEVER_SLUG_DOMAIN_OVERRIDES[stripped]) {
    return GREENHOUSE_LEVER_SLUG_DOMAIN_OVERRIDES[stripped];
  }
  const base = stripped.length >= 2 ? stripped : slug;
  if (!/^[a-z0-9]+$/.test(base)) return null;
  return `${base}.com`;
}

/** Infer hiring company domain from ATS listing URL (Greenhouse / Lever paths). */
export function inferEmployerDomainFromListingUrl(sourceUrl: string | null | undefined): string | null {
  if (!sourceUrl || sourceUrl === "#") return null;
  try {
    const parsed = new URL(/^https?:\/\//i.test(sourceUrl) ? sourceUrl : `https://${sourceUrl}`);
    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    const parts = parsed.pathname.split("/").filter(Boolean);

    if (host === "boards.greenhouse.io" || host === "job-boards.greenhouse.io") {
      return boardSlugToEmployerDomain(parts[0] ?? "");
    }
    if (host === "jobs.lever.co" && parts[0]) {
      return boardSlugToEmployerDomain(parts[0]);
    }
    if (host === "boards-api.greenhouse.io" && parts[0] === "v1" && parts[1] === "boards" && parts[2]) {
      return boardSlugToEmployerDomain(parts[2]);
    }
  } catch {
    return null;
  }
  return null;
}

/** When the listing has no URL, infer a corporate domain from the employer name (substring match). */
const BRAND_HOST_BY_SUBSTRING: { needle: string; host: string }[] = [
  { needle: "meta", host: "meta.com" },
  { needle: "facebook", host: "meta.com" },
  { needle: "google", host: "google.com" },
  { needle: "alphabet", host: "abc.xyz" },
  { needle: "amazon", host: "amazon.com" },
  { needle: "aws", host: "aws.amazon.com" },
  { needle: "microsoft", host: "microsoft.com" },
  { needle: "apple", host: "apple.com" },
  { needle: "netflix", host: "netflix.com" },
  { needle: "airbnb", host: "airbnb.com" },
  { needle: "uber", host: "uber.com" },
  { needle: "spotify", host: "spotify.com" },
  { needle: "shopify", host: "shopify.com" },
  { needle: "stripe", host: "stripe.com" },
  { needle: "salesforce", host: "salesforce.com" },
  { needle: "oracle", host: "oracle.com" },
  { needle: "ibm", host: "ibm.com" },
  { needle: "intel", host: "intel.com" },
  { needle: "nvidia", host: "nvidia.com" },
  { needle: "adobe", host: "adobe.com" },
  { needle: "zalando", host: "zalando.com" },
  { needle: "glovo", host: "glovoapp.com" },
  { needle: "revolut", host: "revolut.com" },
  { needle: "wise", host: "wise.com" },
  { needle: "monzo", host: "monzo.com" },
  { needle: "n26", host: "n26.com" },
  { needle: "deliveroo", host: "deliveroo.com" },
  { needle: "doordash", host: "doordash.com" },
  { needle: "atlassian", host: "atlassian.com" },
  { needle: "figma", host: "figma.com" },
  { needle: "notion", host: "notion.so" },
  { needle: "linear", host: "linear.app" },
  { needle: "vercel", host: "vercel.com" },
  { needle: "gitlab", host: "gitlab.com" },
  { needle: "github", host: "github.com" },
  { needle: "docker", host: "docker.com" },
  { needle: "datadog", host: "datadoghq.com" },
  { needle: "snowflake", host: "snowflake.com" },
  { needle: "mongodb", host: "mongodb.com" },
  { needle: "elastic", host: "elastic.co" },
  { needle: "twilio", host: "twilio.com" },
];

export function resolveCompanyLogoHost(company: string, sourceUrl: string | null | undefined): string | null {
  const fromUrl = hostnameFromSourceUrl(sourceUrl);
  if (fromUrl && !isLowSignalLogoHost(fromUrl)) return fromUrl;

  const fromAtsSlug = inferEmployerDomainFromListingUrl(sourceUrl);
  if (fromAtsSlug) return fromAtsSlug;

  const c = company.toLowerCase().trim();
  for (const { needle, host } of BRAND_HOST_BY_SUBSTRING) {
    if (c.includes(needle)) return host;
  }
  return null;
}

/** Ordered logo URLs for a corporate domain (high-res brand assets where available). */
export function buildCompanyLogoCandidates(host: string): string[] {
  const safe = host.trim().toLowerCase().replace(/[^a-z0-9.-]/g, "");
  if (!safe || !safe.includes(".")) return [];
  const enc = encodeURIComponent(safe);
  const token = logoDevPublishableKey();
  const out: string[] = [];
  if (token) {
    out.push(`https://img.logo.dev/${safe}?token=${encodeURIComponent(token)}&size=128`);
  }
  out.push(
    `https://logo.clearbit.com/${safe}`,
    `https://unavatar.io/${safe}`,
    `https://www.google.com/s2/favicons?domain=${enc}&sz=128`,
  );
  return out;
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
  sourceUrl,
  size = "card",
  presentation = "default",
  className = "",
}: {
  company: string;
  sourceUrl?: string | null;
  size?: JobCompanyMarkSize;
  /** Muted logos — soft grayscale for dense lists (e.g. dashboard picks). */
  presentation?: "default" | "muted";
  className?: string;
}) {
  const host = useMemo(() => resolveCompanyLogoHost(company, sourceUrl), [company, sourceUrl]);
  const candidates = useMemo(() => (host ? buildCompanyLogoCandidates(host) : []), [host]);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setAttempt(0);
  }, [host]);

  const initials = companyInitials(company);
  const src: string | undefined =
    candidates.length > 0 && attempt < candidates.length ? candidates[attempt] : undefined;

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

  return (
    <span
      className={box}
      role="img"
      aria-label={`${company} logo`}
    >
      {src ? (
        <Image
          key={`${attempt}-${src}`}
          src={src}
          alt=""
          width={pxSize}
          height={pxSize}
          sizes={`${pxSize}px`}
          className={`bg-white object-contain p-1.5 ${muted ? "grayscale-[0.35] opacity-[0.92]" : ""}`}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setAttempt((a) => Math.min(a + 1, candidates.length))}
        />
      ) : (
        <span
          className={`flex size-full items-center justify-center bg-[var(--app-badge-blue-bg)] ${textCls} text-[var(--app-badge-blue-fg)]`}
        >
          {initials}
        </span>
      )}
    </span>
  );
}
