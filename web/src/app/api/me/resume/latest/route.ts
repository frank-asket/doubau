import { NextResponse } from "next/server";

import { clerkTokenMissingResponse, getApiBaseUrl, getBackendAuthBearerOnly } from "../../../_server";

export async function GET() {
  const headers = await getBackendAuthBearerOnly();
  if (!("authorization" in headers)) {
    return clerkTokenMissingResponse();
  }
  const resp = await fetch(`${getApiBaseUrl()}/me/resume/latest`, {
    headers,
    cache: "no-store",
  });

  return NextResponse.json(await resp.json().catch(() => ({})), {
    status: resp.status,
  });
}
