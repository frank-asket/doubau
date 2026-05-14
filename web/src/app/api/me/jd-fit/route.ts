import { NextResponse } from "next/server";

import { clerkTokenMissingResponse, getApiBaseUrl, getBackendAuthHeaders } from "../../_server";

export async function POST(req: Request) {
  const headers = await getBackendAuthHeaders();
  if (!("authorization" in headers)) {
    return clerkTokenMissingResponse();
  }
  const body = await req.json().catch(() => ({}));
  const resp = await fetch(`${getApiBaseUrl()}/me/jd-fit`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  return NextResponse.json(await resp.json().catch(() => ({})), {
    status: resp.status,
  });
}
