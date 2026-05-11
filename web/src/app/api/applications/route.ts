import { NextResponse } from "next/server";

import { clerkTokenMissingResponse, getApiBaseUrl, getBackendAuthHeaders } from "../_server";

export async function GET() {
  const headers = await getBackendAuthHeaders();
  if (!("authorization" in headers)) {
    return clerkTokenMissingResponse();
  }
  const resp = await fetch(`${getApiBaseUrl()}/applications`, {
    headers,
    cache: "no-store",
  });
  return NextResponse.json(await resp.json().catch(() => ({})), { status: resp.status });
}

export async function POST(req: Request) {
  const headers = await getBackendAuthHeaders();
  if (!("authorization" in headers)) {
    return clerkTokenMissingResponse();
  }
  const body = await req.json();
  const resp = await fetch(`${getApiBaseUrl()}/applications`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  return NextResponse.json(await resp.json().catch(() => ({})), { status: resp.status });
}

