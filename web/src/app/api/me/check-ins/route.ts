import { NextResponse } from "next/server";

import { getApiBaseUrl, getBackendAuthHeaders } from "../../_server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = url.searchParams.get("limit") ?? "60";
  const resp = await fetch(`${getApiBaseUrl()}/me/check-ins?limit=${encodeURIComponent(limit)}`, {
    headers: await getBackendAuthHeaders(),
    cache: "no-store",
  });
  return NextResponse.json(await resp.json().catch(() => []), { status: resp.status });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const resp = await fetch(`${getApiBaseUrl()}/me/check-ins`, {
    method: "POST",
    headers: {
      ...(await getBackendAuthHeaders()),
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return NextResponse.json(await resp.json().catch(() => ({})), { status: resp.status });
}
