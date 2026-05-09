import { NextResponse } from "next/server";

import { getApiBaseUrl, getBackendAuthHeaders } from "../../../_server";

type Ctx = { params: Promise<{ jobId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { jobId } = await ctx.params;
  const backend = `${getApiBaseUrl()}/jobs/${encodeURIComponent(jobId)}/feedback`;
  const resp = await fetch(backend, {
    method: "POST",
    headers: await getBackendAuthHeaders(),
    body: await req.text(),
    cache: "no-store",
  });
  return NextResponse.json(await resp.json().catch(() => ({})), { status: resp.status });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { jobId } = await ctx.params;
  const backend = `${getApiBaseUrl()}/jobs/${encodeURIComponent(jobId)}/feedback`;
  const resp = await fetch(backend, {
    method: "DELETE",
    headers: await getBackendAuthHeaders(),
    cache: "no-store",
  });
  return NextResponse.json(await resp.json().catch(() => ({})), { status: resp.status });
}

