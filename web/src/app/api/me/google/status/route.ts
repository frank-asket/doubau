import { NextResponse } from "next/server";

import { proxyBackendGet } from "../../../_server";

export async function GET() {
  return proxyBackendGet("/me/google/status");
}
