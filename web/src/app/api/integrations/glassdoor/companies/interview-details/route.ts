import { NextResponse } from "next/server";

import { getApiBaseUrl, getBackendAuthHeaders } from "../../../../_server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const interviewId = url.searchParams.get("interview_id") ?? url.searchParams.get("interviewId");
  if (!interviewId?.trim()) {
    return NextResponse.json({ detail: "Missing interview_id query parameter." }, { status: 400 });
  }
  const qs = new URLSearchParams({ interview_id: interviewId.trim() });
  const resp = await fetch(
    `${getApiBaseUrl()}/integrations/glassdoor/companies/interview-details?${qs.toString()}`,
    {
      method: "GET",
      headers: await getBackendAuthHeaders(),
    },
  );
  const body = await resp.json().catch(() => ({}));
  return NextResponse.json(body, { status: resp.status });
}
