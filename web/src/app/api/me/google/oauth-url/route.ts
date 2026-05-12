import { NextResponse } from "next/server";

import { getApiBaseUrl, getBackendAuthHeaders } from "../../../_server";

export async function GET() {
  const base = getApiBaseUrl().replace(/\/$/, "");
  try {
    const resp = await fetch(`${base}/me/google/oauth-url`, {
      headers: await getBackendAuthHeaders(),
      cache: "no-store",
    });
    const data = await resp.json().catch(() => ({}));
    return NextResponse.json(data, { status: resp.status });
  } catch {
    return NextResponse.json({ detail: "Cannot reach API." }, { status: 503 });
  }
}
