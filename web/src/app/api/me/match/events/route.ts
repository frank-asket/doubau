import { NextResponse } from "next/server";

import { getApiBaseUrl, getBackendAuthHeaders } from "../../../_server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = url.searchParams.get("limit") ?? "100";
  const offset = url.searchParams.get("offset") ?? "0";
  const qs = new URLSearchParams({ limit, offset });
  const resp = await fetch(`${getApiBaseUrl()}/me/match/events?${qs.toString()}`, {
    headers: await getBackendAuthHeaders(),
    cache: "no-store",
  });

  return NextResponse.json(await resp.json().catch(() => []), {
    status: resp.status,
  });
}
