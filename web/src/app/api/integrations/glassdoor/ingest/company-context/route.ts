import { NextResponse } from "next/server";

import { getApiBaseUrl, getBackendAuthHeaders } from "../../../../_server";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const resp = await fetch(`${getApiBaseUrl()}/integrations/glassdoor/ingest/company-context`, {
    method: "POST",
    headers: await getBackendAuthHeaders(),
    body: JSON.stringify(body),
  });
  const payload = await resp.json().catch(() => ({}));
  return NextResponse.json(payload, { status: resp.status });
}
