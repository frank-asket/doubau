import { NextResponse } from "next/server";

import { getApiBaseUrl, getBackendAuthHeaders } from "../../../_server";

export async function DELETE() {
  const base = getApiBaseUrl().replace(/\/$/, "");
  try {
    const resp = await fetch(`${base}/me/google/disconnect`, {
      method: "DELETE",
      headers: await getBackendAuthHeaders(),
      cache: "no-store",
    });
    return NextResponse.json(await resp.json().catch(() => ({})), { status: resp.status });
  } catch {
    return NextResponse.json({ detail: "Cannot reach API." }, { status: 503 });
  }
}
