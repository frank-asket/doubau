import { NextResponse } from "next/server";

import { getApiBaseUrl, getBackendAuthBearerOnly } from "../../_server";

export async function POST(req: Request) {
  const formData = await req.formData();
  const resp = await fetch(`${getApiBaseUrl()}/me/resume`, {
    method: "POST",
    headers: await getBackendAuthBearerOnly(),
    body: formData,
  });

  return NextResponse.json(await resp.json().catch(() => ({})), {
    status: resp.status,
  });
}
