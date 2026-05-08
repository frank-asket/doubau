import { NextResponse } from "next/server";

import { getApiBaseUrl, getBackendAuthHeaders } from "../../_server";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const resp = await fetch(`${getApiBaseUrl()}/jobs/scrape`, {
    method: "POST",
    headers: await getBackendAuthHeaders(),
    body: JSON.stringify(body),
  });
  return NextResponse.json(await resp.json().catch(() => ({})), {
    status: resp.status,
  });
}
