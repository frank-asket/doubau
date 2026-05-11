import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
}

/** BFF GET proxy: returns 503 JSON when the backend is unreachable (ECONNREFUSED) instead of throwing. */
export async function proxyBackendGet(pathWithLeadingSlash: string): Promise<NextResponse> {
  const base = getApiBaseUrl().replace(/\/$/, "");
  const path = pathWithLeadingSlash.startsWith("/") ? pathWithLeadingSlash : `/${pathWithLeadingSlash}`;
  try {
    const resp = await fetch(`${base}${path}`, {
      headers: await getBackendAuthHeaders(),
      cache: "no-store",
    });
    const data = await resp.json().catch(() => (resp.ok ? [] : { detail: "Invalid JSON from API" }));
    return NextResponse.json(data, { status: resp.status });
  } catch {
    return NextResponse.json(
      {
        detail: `Cannot reach API at ${getApiBaseUrl()}. Start FastAPI (e.g. \`docker compose up\` from the repo root, or \`cd api && uv run uvicorn app.main:app --reload --port 8000\`).`,
      },
      { status: 503 },
    );
  }
}

export async function getBackendAuthHeaders(): Promise<HeadersInit> {
  const { getToken } = await auth();
  // JWT template name must match Clerk Dashboard → JWT Templates (e.g. "doubow-api").
  // Template audience must match api DOUBOW_CLERK_AUDIENCE; include email in claims so
  // the API can map Clerk users (see api/app/api/deps.py). If getToken returns null,
  // BFF calls go out with no Bearer token → FastAPI returns 401 on /me/* routes.
  const token = await getToken({ template: "doubow-api" });
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  return headers;
}

/** For multipart uploads: do not set Content-Type (boundary set by fetch + FormData). */
export async function getBackendAuthBearerOnly(): Promise<HeadersInit> {
  const { getToken } = await auth();
  const token = await getToken({ template: "doubow-api" });
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  return headers;
}

