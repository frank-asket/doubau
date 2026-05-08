import { NextResponse } from "next/server";

import { getApiBaseUrl, getBackendAuthHeaders } from "../../_server";

export async function GET() {
  const resp = await fetch(`${getApiBaseUrl()}/me/profile`, {
    headers: await getBackendAuthHeaders(),
    cache: "no-store",
  });

  return NextResponse.json(await resp.json().catch(() => ({})), {
    status: resp.status,
  });
}

export async function PUT(req: Request) {
  const body = await req.json();
  const resp = await fetch(`${getApiBaseUrl()}/me/profile`, {
    method: "PUT",
    headers: await getBackendAuthHeaders(),
    body: JSON.stringify(body),
  });

  return NextResponse.json(await resp.json().catch(() => ({})), {
    status: resp.status,
  });
}

