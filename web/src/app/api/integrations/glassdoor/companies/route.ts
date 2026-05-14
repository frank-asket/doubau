import { proxyGlassdoorGet } from "../_proxy";

export async function GET(req: Request) {
  return proxyGlassdoorGet(req, "/integrations/glassdoor/companies");
}
