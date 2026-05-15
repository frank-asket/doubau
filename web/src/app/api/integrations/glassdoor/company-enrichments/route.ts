import { NextResponse } from "next/server";

import { getApiBaseUrl, getBackendAuthHeaders } from "../../../_server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const resp = await fetch(`${getApiBaseUrl()}/integrations/glassdoor/company-enrichments?${url.searchParams}`, {
    method: "GET",
    headers: await getBackendAuthHeaders(),
  });
  const payload = await resp.json().catch(() => []);
  return NextResponse.json(payload, { status: resp.status });
}
