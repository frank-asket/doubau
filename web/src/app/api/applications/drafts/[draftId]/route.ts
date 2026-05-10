import { NextResponse } from "next/server";

import { getApiBaseUrl, getBackendAuthHeaders } from "../../../_server";

export async function PATCH(req: Request, ctx: { params: Promise<{ draftId: string }> }) {
  const { draftId } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const resp = await fetch(`${getApiBaseUrl()}/applications/drafts/${draftId}`, {
    method: "PATCH",
    headers: await getBackendAuthHeaders(),
    body: JSON.stringify(body),
  });
  return NextResponse.json(await resp.json().catch(() => ({})), { status: resp.status });
}
