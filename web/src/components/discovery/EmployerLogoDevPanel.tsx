"use client";

import Image from "next/image";

import { AppIcon } from "@/components/ui/app-icon";
import type { LogoDevEmployerDescribeState } from "@/hooks/use-logo-dev-employer-describe";
import { useLogoDevEmployerDescribe } from "@/hooks/use-logo-dev-employer-describe";

import type { EmployerBrandPayload } from "@/lib/logo-dev-describe-types";

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
 * Default employer context from Logo.dev: Describe JSON when configured, otherwise the
 * Logo.dev image CDN (partial). ``LOGO_DEV_SECRET_KEY`` never reaches the browser.
 *
 * Pass ``remote`` from a parent that already calls ``useLogoDevEmployerDescribe`` (e.g. job detail)
 * so the panel and ``JobCompanyMark`` share one request.
 */
export function EmployerLogoDevPanel({
  domain,
  enabled,
  companyName,
  awaitingDomain = false,
  remote,
}: {
  domain: string | null;
  enabled: boolean;
  /** Listing employer string — shown when it differs from Logo.dev canonical name */
  companyName: string;
  /** True while an upstream enrichment call may still provide a corporate website/domain. */
  awaitingDomain?: boolean;
  /** When set, render this state instead of fetching internally (avoids duplicate describe calls). */
  remote?: LogoDevEmployerDescribeState;
}) {
  const internal = useLogoDevEmployerDescribe(domain, Boolean(enabled && remote === undefined));
  const payload = remote !== undefined ? remote.payload : internal.payload;
  const blocked = remote !== undefined ? remote.blocked : internal.blocked;
  const loading = remote !== undefined ? remote.loading : internal.loading;

  if (!enabled) return null;

  if (!domain) {
    if (awaitingDomain) {
      return (
        <div className="mt-4 overflow-hidden rounded-[var(--app-radius-md)] border border-dashed border-[color-mix(in_srgb,var(--app-accent)_22%,var(--app-border))] bg-[color-mix(in_srgb,var(--app-accent)_04%,var(--app-bg-muted))] px-3 py-3">
          <div className="flex items-center gap-3 text-[12px] font-medium text-[var(--app-text-secondary)]">
            <span className="relative flex size-8 shrink-0 items-center justify-center rounded-full bg-white/90 shadow-[inset_0_0_0_1px_rgba(20,24,32,0.06)]">
              <span className="size-4 animate-pulse rounded-full bg-[var(--app-accent)]/35" />
            </span>
            Checking RapidAPI for employer website…
          </div>
        </div>
      );
    }
    return (
      <div
        role="note"
        aria-label="Logo.dev employer directory unavailable for this listing"
        className="mt-4 rounded-[var(--app-radius-md)] border border-dashed border-[var(--app-border)] bg-[var(--app-bg-muted)]/40 px-3 py-3 text-[12px] leading-relaxed text-[var(--app-text-tertiary)]"
      >
        <span className="font-medium text-[var(--app-text-secondary)]">Company directory:</span>{" "}
        RapidAPI did not provide an employer website for this listing, and the posting URL points to an aggregator or
        ATS instead of a corporate domain. The employer name and initials above still reflect the source listing.
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

  return <EmployerLogoDevPanelBody companyName={companyName} payload={payload} />;
}

function EmployerLogoDevPanelBody({ companyName, payload }: { companyName: string; payload: EmployerBrandPayload }) {
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
          {payload.partial_why === "describe_404" ? (
            <>
              <span className="font-semibold text-[var(--app-text-primary)]">Describe miss.</span> Logo.dev has no
              directory match for this domain yet. Heuristic colours and the note below stand in until the brand is
              indexed or the domain is corrected.{" "}
            </>
          ) : (
            <>
              <span className="font-semibold text-[var(--app-text-primary)]">Publishable-key mode.</span> The logo uses
              the Logo.dev image CDN; long-form directory fields need{" "}
              <span className="font-mono text-[11px]">LOGO_DEV_SECRET_KEY</span> on the server.{" "}
            </>
          )}
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

      {payload.partial && !payload.logo_url ? (
        <p className="rounded-[var(--app-radius-md)] border border-dashed border-[var(--app-border)] bg-[var(--app-bg-muted)]/40 px-3 py-2 text-[12px] text-[var(--app-text-tertiary)]">
          No logo image for this domain yet. Add <span className="font-mono text-[11px]">NEXT_PUBLIC_LOGO_DEV_KEY</span>{" "}
          for the CDN, or rely on the <span className="font-mono text-[11px]">logo</span> field when Describe returns
          200.
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
          {payload.partial_why === "describe_404" ? (
            <>No social links — Describe had no profile for this domain.</>
          ) : (
            <>
              Social links load from the Describe API when{" "}
              <span className="font-mono text-[11px]">LOGO_DEV_SECRET_KEY</span> is set on the server.
            </>
          )}
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
