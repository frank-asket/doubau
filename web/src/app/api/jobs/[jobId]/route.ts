import { NextResponse } from "next/server";

import { getApiBaseUrl, getBackendAuthHeaders } from "../../_server";

export async function GET(_req: Request, ctx: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await ctx.params;
  const resp = await fetch(`${getApiBaseUrl()}/jobs/${jobId}`, {
    headers: await getBackendAuthHeaders(),
    cache: "no-store",
  });
  return NextResponse.json(await resp.json().catch(() => ({})), { status: resp.status });
}
