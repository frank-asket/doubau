"use client";

import { useEffect, useMemo, useState } from "react";

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
];

export function resolveCompanyLogoHost(company: string, sourceUrl: string | null | undefined): string | null {
  const fromUrl = hostnameFromSourceUrl(sourceUrl);
  if (fromUrl) return fromUrl;
  const c = company.toLowerCase().trim();
  for (const { needle, host } of BRAND_HOST_BY_SUBSTRING) {
    if (c.includes(needle)) return host;
  }
  return null;
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

function faviconServiceUrl(host: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`;
}

export type JobCompanyMarkSize = "card" | "detail" | "hero";

export function JobCompanyMark({
  company,
  sourceUrl,
  size = "card",
  className = "",
}: {
  company: string;
  sourceUrl?: string | null;
  size?: JobCompanyMarkSize;
  className?: string;
}) {
  const host = useMemo(() => resolveCompanyLogoHost(company, sourceUrl), [company, sourceUrl]);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [host]);

  const initials = companyInitials(company);
  const showFavicon = Boolean(host && !imgFailed);

  const box =
    size === "hero"
      ? `grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl shadow-[inset_0_0_0_1px_rgba(20,24,32,0.06),0_14px_28px_rgba(9,28,17,0.1)] ${className}`
      : size === "detail"
        ? `grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-[var(--app-radius-md)] ring-1 ring-[color-mix(in_srgb,var(--app-border)_80%,transparent)] ${className}`
        : `grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl shadow-[inset_0_0_0_1px_rgba(20,24,32,0.06),0_14px_28px_rgba(9,28,17,0.08)] ${className}`;

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
      {showFavicon ? (
        <img
          src={faviconServiceUrl(host!)}
          alt=""
          width={pxSize}
          height={pxSize}
          className="size-full bg-white object-contain p-1.5"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
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
