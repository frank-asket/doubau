import { auth } from "@clerk/nextjs/server";

export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
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

