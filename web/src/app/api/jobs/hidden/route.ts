import { proxyBackendGet } from "../../_server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const qs = url.searchParams.toString();
  return proxyBackendGet(`/jobs/hidden${qs ? `?${qs}` : ""}`);
}

