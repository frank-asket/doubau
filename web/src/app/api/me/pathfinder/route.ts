import { NextResponse } from "next/server";

import { getApiBaseUrl, getBackendAuthHeaders } from "../../_server";

export async function GET() {
  const resp = await fetch(`${getApiBaseUrl()}/me/pathfinder`, {
    headers: await getBackendAuthHeaders(),
    cache: "no-store",
  });
  return NextResponse.json(await resp.json().catch(() => ({})), { status: resp.status });
}

export async function PUT(req: Request) {
  const body = await req.json().catch(() => ({}));
  const resp = await fetch(`${getApiBaseUrl()}/me/pathfinder`, {
    method: "PUT",
    headers: {
      ...(await getBackendAuthHeaders()),
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return NextResponse.json(await resp.json().catch(() => ({})), { status: resp.status });
}
