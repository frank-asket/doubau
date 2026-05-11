import { NextResponse } from "next/server";

import { clerkTokenMissingResponse, getApiBaseUrl, getBackendAuthBearerOnly } from "../../_server";

export async function POST(req: Request) {
  const headers = await getBackendAuthBearerOnly();
  if (!("authorization" in headers)) {
    return clerkTokenMissingResponse();
  }
  const formData = await req.formData();
  const resp = await fetch(`${getApiBaseUrl()}/me/resume`, {
    method: "POST",
    headers,
    body: formData,
  });

  return NextResponse.json(await resp.json().catch(() => ({})), {
    status: resp.status,
  });
}
