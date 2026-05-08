import { NextResponse } from "next/server";

import { getApiBaseUrl, getBackendAuthBearerOnly } from "../../../_server";

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const resp = await fetch(`${getApiBaseUrl()}/me/resume/${encodeURIComponent(id)}`, {
    headers: await getBackendAuthBearerOnly(),
    cache: "no-store",
  });

  return NextResponse.json(await resp.json().catch(() => ({})), {
    status: resp.status,
  });
}
