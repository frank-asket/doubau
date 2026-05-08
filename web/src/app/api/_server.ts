import { auth } from "@clerk/nextjs/server";

export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
}

export async function getBackendAuthHeaders(): Promise<HeadersInit> {
  const { getToken } = await auth();
  // Use a JWT template so `aud` matches the API's expected audience.
  // Configure this template in Clerk Dashboard (e.g. name "doubow-api").
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

