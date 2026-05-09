import { NextResponse } from "next/server";

import { getApiBaseUrl, getBackendAuthHeaders } from "../../../_server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const days = url.searchParams.get("days") ?? "14";
  const qs = new URLSearchParams({ days });
  const resp = await fetch(`${getApiBaseUrl()}/me/match/metrics?${qs.toString()}`, {
    headers: await getBackendAuthHeaders(),
    cache: "no-store",
  });

  return NextResponse.json(await resp.json().catch(() => ({})), {
    status: resp.status,
  });
}
