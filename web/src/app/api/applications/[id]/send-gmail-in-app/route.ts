import { NextResponse } from "next/server";

import { getApiBaseUrl, getBackendAuthHeaders } from "../../../_server";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = await req.text();
  const base = getApiBaseUrl().replace(/\/$/, "");
  try {
    const resp = await fetch(`${base}/applications/${encodeURIComponent(id)}/send-gmail-in-app`, {
      method: "POST",
      headers: await getBackendAuthHeaders(),
      body: body || "{}",
      cache: "no-store",
    });
    return NextResponse.json(await resp.json().catch(() => ({})), { status: resp.status });
  } catch {
    return NextResponse.json({ detail: "Cannot reach API." }, { status: 503 });
  }
}
