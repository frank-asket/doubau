import { proxyBackendGetJson } from "../../../_proxy";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = url.searchParams.get("limit") ?? "100";
  const offset = url.searchParams.get("offset") ?? "0";
  const qs = new URLSearchParams({ limit, offset });
  return proxyBackendGetJson("/me/match/events", qs, []);
}
