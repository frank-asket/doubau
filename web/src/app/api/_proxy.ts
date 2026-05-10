import { NextResponse } from "next/server";

import { getApiBaseUrl, getBackendAuthHeaders } from "./_server";

function joinApiUrl(path: string): string {
  const base = getApiBaseUrl().replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

/**
 * Proxies GET to FastAPI. Never throws — returns JSON with a stable shape so the UI
 * does not see opaque Next.js 500s when auth(), fetch, or non-JSON bodies fail.
 */
export async function proxyBackendGetJson(
  backendPath: string,
  searchParams: URLSearchParams,
  emptyFallback: unknown,
): Promise<NextResponse> {
  if (process.env.VERCEL === "1" && !process.env.NEXT_PUBLIC_API_BASE_URL?.trim()) {
    return NextResponse.json(
      {
        detail:
          "NEXT_PUBLIC_API_BASE_URL is not set on Vercel. Add your public Railway API URL (e.g. https://doubau-production.up.railway.app).",
      },
      { status: 503 },
    );
  }

  try {
    const url = `${joinApiUrl(backendPath)}?${searchParams.toString()}`;
    const resp = await fetch(url, {
      headers: await getBackendAuthHeaders(),
      cache: "no-store",
    });
    const text = await resp.text();
    let body: unknown = emptyFallback;
    if (text) {
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        body = {
          detail: text.length > 400 ? `${text.slice(0, 400)}…` : text,
          non_json_response: true,
        };
      }
    }
    return NextResponse.json(body, { status: resp.status });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Upstream request failed";
    console.error("[proxyBackendGetJson]", backendPath, message);
    return NextResponse.json(
      {
        detail: message,
        hint:
          "Check Railway API logs, NEXT_PUBLIC_API_BASE_URL, sign-in, and Clerk JWT template doubow-api vs API DOUBOW_CLERK_*.",
      },
      { status: 503 },
    );
  }
}
