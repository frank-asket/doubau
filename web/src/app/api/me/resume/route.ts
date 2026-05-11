import { NextResponse } from "next/server";

import { clerkTokenMissingResponse, getApiBaseUrl, getBackendAuthBearerOnly } from "../../_server";

export async function GET() {
  return NextResponse.json(
    { detail: "Method Not Allowed. Use POST /api/me/resume to upload a résumé." },
    { status: 405 },
  );
}

export async function POST(req: Request) {
  const headers = await getBackendAuthBearerOnly();
  if (!("authorization" in headers)) {
    return clerkTokenMissingResponse();
  }
  const formData = await req.formData();
  try {
    const resp = await fetch(`${getApiBaseUrl()}/me/resume`, {
      method: "POST",
      headers,
      body: formData,
    });

    const text = await resp.text();
    let body: unknown = {};
    if (text) {
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        body = { detail: text.length > 400 ? `${text.slice(0, 400)}…` : text };
      }
    }
    return NextResponse.json(body, { status: resp.status });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Upstream request failed";
    return NextResponse.json(
      {
        detail: message,
        hint: "FastAPI upload failed. On Railway, ensure DOUBOW_S3_ENDPOINT_URL is unset (AWS S3), not http://minio:9000.",
      },
      { status: 503 },
    );
  }
}
