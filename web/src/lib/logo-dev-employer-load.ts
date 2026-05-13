import type { EmployerBrandPayload, LogoDevDescribeJson } from "@/lib/logo-dev-describe-types";

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
 * Load employer brand JSON from the Next route (Clerk session cookie).
 * Browser-only (uses `fetch` to same-origin `/api/...`).
 */
export async function fetchLogoDevEmployerDescribe(domain: string): Promise<{
  payload: EmployerBrandPayload | null;
  blocked: string | null;
}> {
  try {
    const r = await fetch(`/api/employers/logo-dev/describe?domain=${encodeURIComponent(domain)}`, {
      cache: "no-store",
    });
    const raw = (await r.json().catch(() => null)) as unknown;
    const json = raw as Partial<LogoDevDescribeJson>;

    if (json && typeof json === "object" && json.ok === true && json.data && typeof json.data === "object") {
      const d = json.data as Partial<EmployerBrandPayload>;
      if (isEmployerPayload(d)) {
        return { payload: d, blocked: null };
      }
    }

    if (json && typeof json === "object" && json.ok === false && typeof json.reason === "string") {
      if (json.reason === "not_signed_in") {
        return { payload: null, blocked: "Sign in to load employer brand data." };
      }
      if (json.reason === "not_configured") {
        return {
          payload: null,
          blocked:
            "Add NEXT_PUBLIC_LOGO_DEV_KEY for Logo.dev logos, or LOGO_DEV_SECRET_KEY on the server for full brand metadata.",
        };
      }
      if (json.reason === "upstream" && r.status === 404) {
        return { payload: null, blocked: "No brand profile found for this domain in Logo.dev yet." };
      }
      const msg = typeof json.message === "string" ? json.message : "Could not load brand data.";
      return { payload: null, blocked: msg };
    }

    return { payload: null, blocked: "Could not load brand data." };
  } catch {
    return { payload: null, blocked: "Brand data is temporarily unavailable." };
  }
}
