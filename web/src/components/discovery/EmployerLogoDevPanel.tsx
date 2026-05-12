"use client";

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

/**
 * Loads Logo.dev Brand (Describe) metadata for a corporate domain via the Next BFF
 * (`LOGO_DEV_SECRET_KEY` never reaches the browser).
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
        const json = (await r.json().catch(() => ({}))) as LogoDevDescribeJson;
        if (cancelled) return;
        if (json.ok) {
          setPayload(json.data);
          return;
        }
        if (json.reason === "not_signed_in") {
          setBlocked("Sign in to load employer brand data.");
          return;
        }
        if (json.reason === "not_configured") {
          setBlocked("Brand directory is not enabled on this deployment.");
          return;
        }
        if (json.reason === "upstream" && r.status === 404) {
          setBlocked("No brand profile found for this domain in Logo.dev yet.");
          return;
        }
        setBlocked(json.message || "Could not load brand data.");
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

  if (!enabled || !domain) return null;

  if (loading) {
    return (
      <div className="mt-4 rounded-[var(--app-radius-md)] border border-dashed border-[var(--app-border)] bg-[var(--app-bg-muted)] px-3 py-3 text-[12px] text-[var(--app-text-secondary)]">
        Loading employer brand data…
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
      <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">
        Employer profile
      </div>
      {companyName.trim() && payload.name.trim().toLowerCase() !== companyName.trim().toLowerCase() ? (
        <p className="text-[12px] text-[var(--app-text-tertiary)]">
          Brand directory name: <span className="font-medium text-[var(--app-text-secondary)]">{payload.name}</span>
        </p>
      ) : null}

      {payload.description ? (
        <p className="text-[13px] leading-relaxed text-[var(--app-text-secondary)]">{payload.description}</p>
      ) : (
        <p className="text-[12px] text-[var(--app-text-tertiary)]">No short description in the brand directory.</p>
      )}

      {payload.colors_hex.length > 0 ? (
        <div>
          <div className="mb-1.5 text-[11px] font-medium text-[var(--app-text-tertiary)]">Brand colors</div>
          <div className="flex flex-wrap gap-2">
            {payload.colors_hex.slice(0, 6).map((hex) => (
              <span
                key={hex}
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
      ) : null}

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[var(--app-text-tertiary)]">
        <span className="tabular-nums">Domain: {payload.domain}</span>
        {indexed ? <span className="text-[var(--app-text-tertiary)]">· Indexed {indexed}</span> : null}
      </div>

      <p className="text-[11px] leading-relaxed text-[var(--app-text-tertiary)]">
        <a href="https://logo.dev" target="_blank" rel="noopener noreferrer" className="font-medium text-[var(--app-accent)] underline-offset-2 hover:underline">
          Employer brand data
        </a>{" "}
        from Logo.dev (Describe API). Free plans may require a public attribution link on your marketing site — see their
        attribution guidelines.
      </p>
    </div>
  );
}
