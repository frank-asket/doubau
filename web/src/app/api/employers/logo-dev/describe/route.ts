import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import type { EmployerBrandPayload, LogoDevDescribeJson } from "@/lib/logo-dev-describe-types";

/** Sanitize `domain` query for Logo.dev `/describe/:domain` (no path, scheme, or port). */
function sanitizeEmployerDomain(raw: string | null): string | null {
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
};

export async function GET(req: Request) {
  const { userId } = await auth();
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

  const secret = (process.env.LOGO_DEV_SECRET_KEY ?? "").trim();
  if (!secret) {
    return NextResponse.json({
      ok: false as const,
      reason: "not_configured",
      message:
        "Logo.dev Describe API is not configured. Set LOGO_DEV_SECRET_KEY (sk_…) on the server — Brand/describe requires a Logo.dev plan that includes this API.",
    } satisfies LogoDevDescribeJson);
  }

  const upstreamUrl = `https://api.logo.dev/describe/${encodeURIComponent(domain)}`;
  try {
    const resp = await fetch(upstreamUrl, {
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
      const msg =
        parsed && typeof parsed === "object" && parsed !== null && "message" in parsed
          ? String((parsed as { message?: unknown }).message)
          : text.slice(0, 200) || `Logo.dev returned HTTP ${resp.status}.`;
      return NextResponse.json(
        {
          ok: false as const,
          reason: "upstream",
          message: msg,
        } satisfies LogoDevDescribeJson,
        { status: resp.status === 404 ? 404 : 502 },
      );
    }

    const raw = (parsed ?? {}) as RawDescribe;
    const colorsHex = Array.isArray(raw.colors)
      ? raw.colors.map((c) => (typeof c?.hex === "string" ? c.hex.trim() : "")).filter(Boolean)
      : [];
    const socials =
      raw.socials && typeof raw.socials === "object" && !Array.isArray(raw.socials)
        ? Object.fromEntries(
            Object.entries(raw.socials).filter(
              ([k, v]) => typeof k === "string" && typeof v === "string" && v.trim().length > 0,
            ),
          )
        : {};

    const data: EmployerBrandPayload = {
      source: "logo.dev",
      name: typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : domain,
      domain: typeof raw.domain === "string" && raw.domain.trim() ? raw.domain.trim() : domain,
      description: typeof raw.description === "string" && raw.description.trim() ? raw.description.trim() : null,
      indexed_at: typeof raw.indexed_at === "string" ? raw.indexed_at : null,
      socials,
      colors_hex: colorsHex,
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
