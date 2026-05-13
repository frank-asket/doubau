import { NextResponse } from "next/server";

import type { EmployerBrandPayload, LogoDevDescribeJson } from "@/lib/logo-dev-describe-types";
import {
  buildPartialEmployerDescription,
  displayBrandNameFromDomain,
  heuristicBrandPaletteHex,
} from "@/lib/logo-dev-partial-brand";

export type LogoDevDescribeRouteEnv = {
  NEXT_PUBLIC_LOGO_DEV_KEY?: string | undefined;
  NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY?: string | undefined;
  LOGO_DEV_SECRET_KEY?: string | undefined;
};

export type LogoDevDescribeHandlerDeps = {
  userId: string | null;
  env: LogoDevDescribeRouteEnv;
  fetch: typeof fetch;
};

/** Logo.dev image CDN URL for the browser (publishable key; safe to expose to client). */
export function buildClientLogoDevImageUrl(domain: string, env: LogoDevDescribeRouteEnv): string | null {
  const pk =
    (env.NEXT_PUBLIC_LOGO_DEV_KEY ?? "").trim() ||
    (env.NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY ?? "").trim();
  if (!pk) return null;
  const safe = domain.trim().toLowerCase();
  if (!safe.includes(".")) return null;
  return `https://img.logo.dev/${encodeURIComponent(safe)}?token=${encodeURIComponent(pk)}&size=128`;
}

/** Describe API may return a ready-to-use `logo` URL (img.logo.dev with token) when no local publishable key is set. */
export function trustedDescribeLogoUrl(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "https:") return null;
    if (u.hostname !== "img.logo.dev") return null;
    return u.toString();
  } catch {
    return null;
  }
}

function buildPartialPayload(
  domain: string,
  logoUrl: string | null,
  partialWhy: "publishable_key_only" | "describe_404",
): EmployerBrandPayload {
  const displayName = displayBrandNameFromDomain(domain);
  return {
    source: "logo.dev",
    partial: true,
    partial_why: partialWhy,
    partial_palette_heuristic: true,
    name: displayName,
    domain,
    description: buildPartialEmployerDescription(domain, displayName, { hasLogoUrl: Boolean(logoUrl) }),
    indexed_at: null,
    socials: {},
    colors_hex: heuristicBrandPaletteHex(domain),
    logo_url: logoUrl,
    blurhash: null,
  };
}

/** Sanitize `domain` query for Logo.dev `/describe/:domain` (no path, scheme, or port). */
export function sanitizeEmployerDomain(raw: string | null): string | null {
  if (!raw?.trim()) return null;
  let s = raw.trim().toLowerCase();
  if (/^https?:\/\//i.test(s)) {
    try {
      s = new URL(s).hostname.replace(/^www\./i, "");
    } catch {
      return null;
    }
  } else {
    s = s.replace(/^www\./i, "");
    s = s.split("/")[0]!.split(":")[0]!;
  }
  if (s.length > 253 || s.length < 3 || !s.includes(".")) return null;
  if (s.includes("..") || s.startsWith(".") || s.endsWith(".")) return null;
  if (!/^[a-z0-9.-]+$/.test(s)) return null;
  return s;
}

type RawDescribe = {
  name?: string;
  domain?: string;
  description?: string;
  indexed_at?: string;
  socials?: Record<string, string>;
  colors?: Array<{ hex?: string }>;
  blurhash?: string;
  logo?: string;
};

/**
 * Core handler for `GET /api/employers/logo-dev/describe` — inject `deps` for tests.
 */
export async function handleLogoDevDescribeGET(req: Request, deps: LogoDevDescribeHandlerDeps): Promise<Response> {
  const { userId, env, fetch: fetchFn } = deps;

  if (!userId) {
    return NextResponse.json(
      { ok: false as const, reason: "not_signed_in", message: "Sign in to load employer brand data." } satisfies LogoDevDescribeJson,
      { status: 401 },
    );
  }

  const url = new URL(req.url);
  const domain = sanitizeEmployerDomain(url.searchParams.get("domain"));
  if (!domain) {
    return NextResponse.json(
      { ok: false as const, reason: "bad_domain", message: "Provide a valid domain query parameter." } satisfies LogoDevDescribeJson,
      { status: 400 },
    );
  }

  const logoUrl = buildClientLogoDevImageUrl(domain, env);
  const secret = (env.LOGO_DEV_SECRET_KEY ?? "").trim();

  if (!secret) {
    if (!logoUrl) {
      return NextResponse.json({
        ok: false as const,
        reason: "not_configured",
        message:
          "Employer metadata needs at least NEXT_PUBLIC_LOGO_DEV_KEY (logos) or LOGO_DEV_SECRET_KEY (full Describe API on a paid Logo.dev plan).",
      } satisfies LogoDevDescribeJson);
    }
    const partial = buildPartialPayload(domain, logoUrl, "publishable_key_only");
    return NextResponse.json({ ok: true as const, data: partial } satisfies LogoDevDescribeJson);
  }

  const upstreamUrl = `https://api.logo.dev/describe/${encodeURIComponent(domain)}`;
  try {
    const resp = await fetchFn(upstreamUrl, {
      method: "GET",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${secret}`,
      },
      cache: "no-store",
    });

    const text = await resp.text();
    let parsed: unknown = null;
    if (text) {
      try {
        parsed = JSON.parse(text) as unknown;
      } catch {
        parsed = null;
      }
    }

    if (!resp.ok) {
      if (resp.status === 404) {
        const fallback = buildPartialPayload(domain, logoUrl, "describe_404");
        return NextResponse.json({ ok: true as const, data: fallback } satisfies LogoDevDescribeJson);
      }
      const msg =
        parsed && typeof parsed === "object" && parsed !== null && "message" in parsed
          ? String((parsed as { message?: unknown }).message)
          : text.slice(0, 200) || `Logo.dev returned HTTP ${resp.status}.`;
      const statusOut = resp.status === 404 ? 404 : 502;
      return NextResponse.json(
        {
          ok: false as const,
          reason: "upstream",
          message: msg,
        } satisfies LogoDevDescribeJson,
        { status: statusOut },
      );
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return NextResponse.json(
        {
          ok: false as const,
          reason: "upstream",
          message: "Logo.dev returned an empty or invalid JSON body.",
        } satisfies LogoDevDescribeJson,
        { status: 502 },
      );
    }
    const raw = parsed as RawDescribe;
    const colorsHex = Array.isArray(raw.colors)
      ? raw.colors.map((c: { hex?: string }) => (typeof c?.hex === "string" ? c.hex.trim() : "")).filter(Boolean)
      : [];
    const socials =
      raw.socials && typeof raw.socials === "object" && !Array.isArray(raw.socials)
        ? Object.fromEntries(
            Object.entries(raw.socials).filter(
              ([k, v]) => typeof k === "string" && typeof v === "string" && v.trim().length > 0,
            ),
          )
        : {};

    const resolvedDomain =
      typeof raw.domain === "string" && raw.domain.trim() ? raw.domain.trim() : domain;
    const blurhashRaw = typeof raw.blurhash === "string" ? raw.blurhash.trim() : "";
    const logoFromDescribe = trustedDescribeLogoUrl(raw.logo);
    const data: EmployerBrandPayload = {
      source: "logo.dev",
      partial: false,
      partial_palette_heuristic: false,
      name: typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : resolvedDomain,
      domain: resolvedDomain,
      description: typeof raw.description === "string" && raw.description.trim() ? raw.description.trim() : null,
      indexed_at: typeof raw.indexed_at === "string" ? raw.indexed_at : null,
      socials,
      colors_hex: colorsHex,
      logo_url: buildClientLogoDevImageUrl(resolvedDomain, env) ?? logoFromDescribe,
      blurhash: blurhashRaw || null,
    };

    return NextResponse.json({ ok: true as const, data } satisfies LogoDevDescribeJson);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Logo.dev request failed.";
    return NextResponse.json(
      { ok: false as const, reason: "upstream", message } satisfies LogoDevDescribeJson,
      { status: 502 },
    );
  }
}
