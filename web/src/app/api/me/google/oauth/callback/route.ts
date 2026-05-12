import { NextResponse } from "next/server";

import { getApiBaseUrl, getBackendAuthHeaders } from "../../../../_server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");
  const origin = url.origin;

  if (err) {
    return NextResponse.redirect(new URL(`/app/settings?gmail=denied&reason=${encodeURIComponent(err)}`, origin));
  }
  if (!code || !state) {
    return NextResponse.redirect(new URL("/app/settings?gmail=missing", origin));
  }

  const base = getApiBaseUrl().replace(/\/$/, "");
  try {
    const resp = await fetch(`${base}/me/google/oauth/callback`, {
      method: "POST",
      headers: await getBackendAuthHeaders(),
      body: JSON.stringify({ code, state }),
      cache: "no-store",
    });
    if (!resp.ok) {
      const body = (await resp.json().catch(() => ({}))) as { detail?: string };
      const msg = typeof body.detail === "string" ? body.detail : "callback_failed";
      return NextResponse.redirect(new URL(`/app/settings?gmail=error&reason=${encodeURIComponent(msg)}`, origin));
    }
  } catch {
    return NextResponse.redirect(new URL("/app/settings?gmail=error&reason=api_unreachable", origin));
  }
  return NextResponse.redirect(new URL("/app/settings?gmail=connected", origin));
}
