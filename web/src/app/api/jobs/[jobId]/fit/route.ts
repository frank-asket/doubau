import { NextResponse } from "next/server";

import { getApiBaseUrl, getBackendAuthHeaders } from "../../../_server";

export async function POST(_req: Request, ctx: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await ctx.params;
  const resp = await fetch(`${getApiBaseUrl()}/jobs/${jobId}/fit`, {
    method: "POST",
    headers: await getBackendAuthHeaders(),
  });
  return NextResponse.json(await resp.json().catch(() => ({})), {
    status: resp.status,
  });
}
