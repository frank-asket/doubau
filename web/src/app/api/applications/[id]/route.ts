import { NextResponse } from "next/server";

import { clerkTokenMissingResponse, getApiBaseUrl, getBackendAuthHeaders } from "../../_server";

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const headers = await getBackendAuthHeaders();
  if (!("authorization" in headers)) {
    return clerkTokenMissingResponse();
  }
  const resp = await fetch(`${getApiBaseUrl()}/applications/${id}`, {
    headers,
    cache: "no-store",
  });
  return NextResponse.json(await resp.json().catch(() => ({})), { status: resp.status });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const headers = await getBackendAuthHeaders();
  if (!("authorization" in headers)) {
    return clerkTokenMissingResponse();
  }
  const body = await req.json();
  const resp = await fetch(`${getApiBaseUrl()}/applications/${id}`, {
    method: "PATCH",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return NextResponse.json(await resp.json().catch(() => ({})), { status: resp.status });
}
