import { NextResponse } from "next/server";

import { getApiBaseUrl } from "../_server";

export const dynamic = "force-dynamic";

/**
 * Lightweight deployment probe: Next route handler + optional FastAPI `/health`
 * (no auth — backend `/health` is public).
 */
export async function GET() {
  const payload: Record<string, unknown> = {
    next: "ok",
    checked_at: new Date().toISOString(),
  };

  try {
    const base = getApiBaseUrl().replace(/\/$/, "");
    const ctrl = new AbortController();
    const kill = setTimeout(() => ctrl.abort(), 5000);
    try {
      const resp = await fetch(`${base}/health`, {
        cache: "no-store",
        signal: ctrl.signal,
      });
      const text = await resp.text();
      let body: unknown = { status: resp.status };
      try {
        body = text ? JSON.parse(text) : {};
      } catch {
        body = { raw: text.slice(0, 200) };
      }
      payload.api_reachable = resp.ok;
      payload.api_status = resp.status;
      payload.api_body = body;
    } finally {
      clearTimeout(kill);
    }
  } catch (e) {
    payload.api_reachable = false;
    payload.api_error = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json(payload);
}
