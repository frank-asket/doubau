import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, ".."),
  output: "standalone",
  async redirects() {
    return [{ source: "/design-system", destination: "/app/design-system", permanent: false }];
  },
};

export default nextConfig;
