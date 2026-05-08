import { NextResponse } from "next/server";

import { getApiBaseUrl, getBackendAuthHeaders } from "../_server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const qs = url.searchParams.toString();
  const backend = `${getApiBaseUrl()}/jobs${qs ? `?${qs}` : ""}`;
  const resp = await fetch(backend, {
    headers: await getBackendAuthHeaders(),
    cache: "no-store",
  });
  return NextResponse.json(await resp.json().catch(() => []), {
    status: resp.status,
  });
}
