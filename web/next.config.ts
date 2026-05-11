import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, ".."),
  output: "standalone",
  async redirects() {
    return [
      { source: "/design-system", destination: "/app/design-system", permanent: false },
      { source: "/billing", destination: "/app/billing", permanent: false },
      { source: "/billing/checkout", destination: "/app/billing/checkout", permanent: false },
      { source: "/billing/portal", destination: "/app/billing/portal", permanent: false },
    ];
  },
};

export default nextConfig;
