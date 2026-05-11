import { proxyBackendGet } from "../../../_server";

export async function GET() {
  return proxyBackendGet("/jobs/catalog/summary");
}
