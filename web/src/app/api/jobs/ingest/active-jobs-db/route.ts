import { NextResponse } from "next/server";

import { getApiBaseUrl, getBackendAuthHeaders } from "../../../_server";

export async function POST(req: Request) {
  let body = "{}";
  try {
    const raw = await req.text();
    if (raw.trim()) body = raw;
  } catch {
    /* no body */
  }
  const resp = await fetch(`${getApiBaseUrl()}/jobs/ingest/active-jobs-db`, {
    method: "POST",
    headers: await getBackendAuthHeaders(),
    body,
  });
  return NextResponse.json(await resp.json().catch(() => ({})), {
    status: resp.status,
  });
}
