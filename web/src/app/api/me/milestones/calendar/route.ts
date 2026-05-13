import { NextResponse } from "next/server";

import { getApiBaseUrl, getBackendAuthHeaders } from "../../../_server";

export async function GET(req: Request) {
  const month = new URL(req.url).searchParams.get("month")?.trim();
  if (!month) {
    return NextResponse.json({ detail: "Query parameter month (YYYY-MM) is required." }, { status: 400 });
  }
  const resp = await fetch(
    `${getApiBaseUrl()}/me/milestones/calendar?month=${encodeURIComponent(month)}`,
    {
      headers: await getBackendAuthHeaders(),
      cache: "no-store",
    },
  );
  return NextResponse.json(await resp.json().catch(() => ({})), { status: resp.status });
}
