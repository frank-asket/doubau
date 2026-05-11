import { NextResponse } from "next/server";

import { getApiBaseUrl, getBackendAuthHeaders } from "../../../_server";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const resp = await fetch(`${getApiBaseUrl()}/me/milestones/${id}`, {
    method: "PATCH",
    headers: {
      ...(await getBackendAuthHeaders()),
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return NextResponse.json(await resp.json().catch(() => ({})), { status: resp.status });
}
