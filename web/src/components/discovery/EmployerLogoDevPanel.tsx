"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import { AppIcon } from "@/components/ui/app-icon";

import type { EmployerBrandPayload, LogoDevDescribeJson } from "@/lib/logo-dev-describe-types";

const SOCIAL_LABEL: Record<string, string> = {
  linkedin: "LinkedIn",
  twitter: "X / Twitter",
  facebook: "Facebook",
  instagram: "Instagram",
  github: "GitHub",
  youtube: "YouTube",
  reddit: "Reddit",
  pinterest: "Pinterest",
  snapchat: "Snapchat",
  telegram: "Telegram",
  tumblr: "Tumblr",
  wechat: "WeChat",
  whatsapp: "WhatsApp",
};

function socialLabel(key: string): string {
  return SOCIAL_LABEL[key] ?? key.replace(/_/g, " ");
}

function isEmployerPayload(d: Partial<EmployerBrandPayload>): d is EmployerBrandPayload {
  if (d.source !== "logo.dev" || typeof d.domain !== "string" || typeof d.name !== "string") return false;
  if (!Array.isArray(d.colors_hex) || !d.socials || typeof d.socials !== "object" || Array.isArray(d.socials)) {
    return false;
  }
  if (typeof d.logo_url !== "string" && d.logo_url !== null) return false;
  if (d.description !== null && typeof d.description !== "string") return false;
  if (d.indexed_at !== null && typeof d.indexed_at !== "string") return false;
  return true;
}

/**
 * Default employer context from Logo.dev: Describe JSON when configured, otherwise the
 * Logo.dev image CDN (partial). ``LOGO_DEV_SECRET_KEY`` never reaches the browser.
 */
export function EmployerLogoDevPanel({
  domain,
  enabled,
  companyName,
}: {
  domain: string | null;
  enabled: boolean;
  /** Listing employer string — shown when it differs from Logo.dev canonical name */
  companyName: string;
}) {
  const [payload, setPayload] = useState<EmployerBrandPayload | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !domain) {
      setPayload(null);
      setBlocked(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setBlocked(null);
    setPayload(null);

    void (async () => {
      try {
        const r = await fetch(`/api/employers/logo-dev/describe?domain=${encodeURIComponent(domain)}`, {
          cache: "no-store",
        });
        const raw = (await r.json().catch(() => null)) as unknown;
        if (cancelled) return;

        const json = raw as Partial<LogoDevDescribeJson>;
        if (json && typeof json === "object" && json.ok === true && json.data && typeof json.data === "object") {
          const d = json.data as Partial<EmployerBrandPayload>;
          if (isEmployerPayload(d)) {
            setPayload(d);
            return;
          }
        }

        if (json && typeof json === "object" && json.ok === false && typeof json.reason === "string") {
          if (json.reason === "not_signed_in") {
            setBlocked("Sign in to load employer brand data.");
            return;
          }
          if (json.reason === "not_configured") {
            setBlocked(
              "Add NEXT_PUBLIC_LOGO_DEV_KEY for Logo.dev logos, or LOGO_DEV_SECRET_KEY on the server for full brand metadata.",
            );
            return;
          }
          if (json.reason === "upstream" && r.status === 404) {
            setBlocked("No brand profile found for this domain in Logo.dev yet.");
            return;
          }
          const msg = typeof json.message === "string" ? json.message : "Could not load brand data.";
          setBlocked(msg);
          return;
        }

        setBlocked("Could not load brand data.");
      } catch {
        if (!cancelled) setBlocked("Brand data is temporarily unavailable.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [domain, enabled]);

  if (!enabled) return null;

  if (!domain) {
    return (
      <div className="mt-4 rounded-[var(--app-radius-md)] border border-dashed border-[var(--app-border)] bg-[var(--app-bg-muted)]/40 px-3 py-3 text-[12px] leading-relaxed text-[var(--app-text-tertiary)]">
        Employer directory (Logo.dev) needs a guessable corporate domain. Aggregator or ATS-only links often hide
        this — we still show the listing employer name and initials above.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mt-4 overflow-hidden rounded-[var(--app-radius-md)] border border-dashed border-[color-mix(in_srgb,var(--app-accent)_22%,var(--app-border))] bg-[color-mix(in_srgb,var(--app-accent)_04%,var(--app-bg-muted))] px-3 py-3">
        <div className="flex items-center gap-3 text-[12px] font-medium text-[var(--app-text-secondary)]">
          <span className="relative flex size-8 shrink-0 items-center justify-center rounded-full bg-white/90 shadow-[inset_0_0_0_1px_rgba(20,24,32,0.06)]">
            <span className="size-4 animate-pulse rounded-full bg-[var(--app-accent)]/35" />
          </span>
          Loading Logo.dev employer profile…
        </div>
      </div>
    );
  }

  if (blocked) {
    return (
      <div className="mt-4 rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--app-bg-muted)] px-3 py-3 text-[12px] leading-relaxed text-[var(--app-text-secondary)]">
        {blocked}
      </div>
    );
  }

  if (!payload) return null;

  const socialEntries = Object.entries(payload.socials);
  const indexed =
    payload.indexed_at && !Number.isNaN(Date.parse(payload.indexed_at))
      ? new Date(payload.indexed_at).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : null;

  return (
    <div className="mt-4 space-y-3 border-t border-[var(--app-border)] pt-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--app-accent)_25%,var(--app-border))] bg-[color-mix(in_srgb,var(--app-accent)_08%,var(--app-bg-elevated))] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--app-accent)]">
            Logo.dev
          </div>
          <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">
            Employer metadata
          </div>
        </div>
        {payload.logo_url ? (
          <div className="relative size-14 shrink-0 overflow-hidden rounded-2xl bg-white shadow-[inset_0_0_0_1px_rgba(20,24,32,0.06)] ring-1 ring-[color-mix(in_srgb,var(--app-border)_70%,transparent)]">
            <Image
              src={payload.logo_url}
              alt=""
              width={56}
              height={56}
              sizes="56px"
              className="size-full object-contain p-1.5"
            />
          </div>
        ) : null}
      </div>

      {payload.partial ? (
        <p className="rounded-[var(--app-radius-md)] border border-[color-mix(in_srgb,var(--app-warning)_30%,var(--app-border))] bg-[color-mix(in_srgb,var(--app-warning)_08%,var(--app-bg-elevated))] px-3 py-2 text-[12px] leading-relaxed text-[var(--app-text-secondary)]">
          <span className="font-semibold text-[var(--app-text-primary)]">Publishable-key mode.</span> Logo image is from
          Logo.dev CDN; Describe fields require{" "}
          <span className="font-mono text-[11px]">LOGO_DEV_SECRET_KEY</span> on the server.{" "}
          <a
            href="https://logo.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-[var(--app-accent)] underline-offset-2 hover:underline"
          >
            Logo.dev
          </a>
        </p>
      ) : null}

      {companyName.trim() && payload.name.trim().toLowerCase() !== companyName.trim().toLowerCase() ? (
        <p className="text-[12px] text-[var(--app-text-tertiary)]">
          Listing employer: <span className="font-medium text-[var(--app-text-secondary)]">{companyName.trim()}</span>
          {" · "}
          Brand label: <span className="font-medium text-[var(--app-text-secondary)]">{payload.name}</span>
        </p>
      ) : null}

      <a
        href={`https://${payload.domain}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 text-[13px] font-semibold text-[var(--app-accent)] underline-offset-2 hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        <AppIcon name="arrow-up-right" className="size-3.5 shrink-0 opacity-80" />
        Open {payload.domain}
      </a>

      {payload.description ? (
        <p className="text-[13px] leading-relaxed text-[var(--app-text-secondary)]">{payload.description}</p>
      ) : !payload.partial ? (
        <p className="text-[12px] text-[var(--app-text-tertiary)]">No short description in the brand directory.</p>
      ) : null}

      {payload.colors_hex.length > 0 ? (
        <div>
          <div className="mb-1.5 text-[11px] font-medium text-[var(--app-text-tertiary)]">
            {payload.partial_palette_heuristic ? "Suggested palette (local heuristic)" : "Brand colors"}
          </div>
          {payload.partial_palette_heuristic ? (
            <p className="mb-2 text-[11px] leading-relaxed text-[var(--app-text-tertiary)]">
              Not from Logo.dev — two stable accents derived from the domain string for layout only.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {payload.colors_hex.slice(0, 6).map((hex, i) => (
              <span
                key={`${hex}-${i}`}
                title={hex}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--app-border)] bg-[var(--app-bg-muted)] py-1 pl-1 pr-2 text-[11px] font-medium tabular-nums text-[var(--app-text-secondary)]"
              >
                <span
                  className="size-5 shrink-0 rounded-full border border-[color-mix(in_srgb,var(--app-border)_60%,transparent)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.35)]"
                  style={{ backgroundColor: hex }}
                />
                {hex}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {socialEntries.length > 0 ? (
        <div>
          <div className="mb-1.5 text-[11px] font-medium text-[var(--app-text-tertiary)]">Social</div>
          <ul className="space-y-1.5">
            {socialEntries.map(([key, href]) => (
              <li key={key}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-[13px] font-medium text-[var(--app-accent)] underline-offset-2 hover:underline"
                >
                  <AppIcon name="arrow-up-right" className="size-3.5 shrink-0 opacity-80" />
                  {socialLabel(key)}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : payload.partial ? (
        <div className="rounded-[var(--app-radius-md)] border border-dashed border-[var(--app-border)] bg-[var(--app-bg-muted)]/40 px-3 py-2 text-[12px] text-[var(--app-text-tertiary)]">
          Social links load from the Describe API when <span className="font-mono text-[11px]">LOGO_DEV_SECRET_KEY</span>{" "}
          is set on the server.
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[var(--app-text-tertiary)]">
        <span className="tabular-nums">Domain: {payload.domain}</span>
        {indexed ? <span className="text-[var(--app-text-tertiary)]">· Indexed {indexed}</span> : null}
      </div>

      <p className="text-[11px] leading-relaxed text-[var(--app-text-tertiary)]">
        <a
          href="https://logo.dev"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-[var(--app-accent)] underline-offset-2 hover:underline"
        >
          Logo.dev
        </a>{" "}
        is the default employer directory for this panel. Free plans may require public attribution on your marketing
        site.
      </p>
    </div>
  );
}
