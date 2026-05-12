import { NextResponse } from "next/server";

import { getApiBaseUrl, getBackendAuthHeaders } from "../../../_server";

export async function POST() {
  const resp = await fetch(`${getApiBaseUrl()}/jobs/ingest/scrapling`, {
    method: "POST",
    headers: await getBackendAuthHeaders(),
  });
  return NextResponse.json(await resp.json().catch(() => ({})), {
    status: resp.status,
  });
}
