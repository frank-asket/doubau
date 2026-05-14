import { NextResponse } from "next/server";

import { getApiBaseUrl, getBackendAuthHeaders } from "../../../_server";

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const resp = await fetch(`${getApiBaseUrl()}/applications/${id}/role-report`, {
    headers: await getBackendAuthHeaders(),
    cache: "no-store",
  });
  return NextResponse.json(await resp.json().catch(() => ({})), { status: resp.status });
}

export async function POST(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const resp = await fetch(`${getApiBaseUrl()}/applications/${id}/role-report`, {
    method: "POST",
    headers: await getBackendAuthHeaders(),
  });
  return NextResponse.json(await resp.json().catch(() => ({})), { status: resp.status });
}
