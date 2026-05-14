import { NextResponse } from "next/server";

import { getApiBaseUrl, getBackendAuthHeaders } from "../../_server";

export async function proxyGlassdoorGet(req: Request, backendPath: string) {
  const url = new URL(req.url);
  const qs = url.searchParams.toString();
  const resp = await fetch(`${getApiBaseUrl()}${backendPath}${qs ? `?${qs}` : ""}`, {
    method: "GET",
    headers: await getBackendAuthHeaders(),
  });
  const body = await resp.json().catch(() => ({}));
  return NextResponse.json(body, { status: resp.status });
}
