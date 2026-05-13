import { NextResponse } from "next/server";

import { getApiBaseUrl, getBackendAuthHeaders } from "../../../../_server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");
  const origin = url.origin;

  if (err) {
    return NextResponse.redirect(
      new URL(`/app/settings?linkedin=denied&reason=${encodeURIComponent(err)}`, origin),
    );
  }
  if (!code || !state) {
    return NextResponse.redirect(new URL("/app/settings?linkedin=missing", origin));
  }

  const base = getApiBaseUrl().replace(/\/$/, "");
  try {
    const resp = await fetch(`${base}/me/linkedin/oauth/callback`, {
      method: "POST",
      headers: await getBackendAuthHeaders(),
      body: JSON.stringify({ code, state }),
      cache: "no-store",
    });
    if (!resp.ok) {
      const body = (await resp.json().catch(() => ({}))) as { detail?: string };
      const msg = typeof body.detail === "string" ? body.detail : "callback_failed";
      return NextResponse.redirect(
        new URL(`/app/settings?linkedin=error&reason=${encodeURIComponent(msg)}`, origin),
      );
    }
  } catch {
    return NextResponse.redirect(new URL("/app/settings?linkedin=error&reason=api_unreachable", origin));
  }
  return NextResponse.redirect(new URL("/app/settings?linkedin=connected", origin));
}
