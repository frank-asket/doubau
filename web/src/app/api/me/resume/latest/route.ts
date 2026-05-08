import { NextResponse } from "next/server";

import { getApiBaseUrl, getBackendAuthBearerOnly } from "../../../_server";

export async function GET() {
  const resp = await fetch(`${getApiBaseUrl()}/me/resume/latest`, {
    headers: await getBackendAuthBearerOnly(),
    cache: "no-store",
  });

  return NextResponse.json(await resp.json().catch(() => ({})), {
    status: resp.status,
  });
}
