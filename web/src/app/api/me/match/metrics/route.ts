import { proxyBackendGetJson } from "../../../_proxy";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const days = url.searchParams.get("days") ?? "14";
  const qs = new URLSearchParams({ days });
  return proxyBackendGetJson("/me/match/metrics", qs, {});
}
