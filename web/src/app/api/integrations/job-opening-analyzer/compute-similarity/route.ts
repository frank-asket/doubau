import { NextResponse } from "next/server";

import { getApiBaseUrl, getBackendAuthHeaders } from "../../../_server";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ detail: "Invalid JSON body." }, { status: 400 });
  }
  const resp = await fetch(`${getApiBaseUrl()}/integrations/job-opening-analyzer/compute-similarity`, {
    method: "POST",
    headers: await getBackendAuthHeaders(),
    body: JSON.stringify(body),
  });
  const out = await resp.json().catch(() => ({}));
  return NextResponse.json(out, { status: resp.status });
}
