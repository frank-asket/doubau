import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { clerkTokenMissingResponse, getApiBaseUrl, getBackendAuthBearerOnly } from "../../_server";

export async function DELETE() {
  const { userId } = await auth();
  const headers = await getBackendAuthBearerOnly();
  if (!("authorization" in headers)) {
    return clerkTokenMissingResponse();
  }

  const resp = await fetch(`${getApiBaseUrl()}/me/account`, {
    method: "DELETE",
    headers,
    cache: "no-store",
  });

  const body = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    return NextResponse.json(body, { status: resp.status });
  }

  const clerkSecret = process.env.CLERK_SECRET_KEY?.trim();
  if (userId && clerkSecret) {
    const clerkResp = await fetch(`https://api.clerk.com/v1/users/${encodeURIComponent(userId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${clerkSecret}` },
      cache: "no-store",
    });
    if (!clerkResp.ok && clerkResp.status !== 404) {
      return NextResponse.json(
        {
          ...body,
          detail:
            "App data was deleted, but Clerk account deletion failed. Contact support to finish account removal.",
        },
        { status: 502 },
      );
    }
  }

  return NextResponse.json(body, { status: resp.status });
}
