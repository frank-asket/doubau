import type { NextConfig } from "next";
import path from "node:path";

/** Same semantics as `scripts/check-launch-env.mjs` for `DOUBOW_LAUNCH_STRICT`. */
function isDoubowLaunchStrictEnv(): boolean {
  const v = String(process.env.DOUBOW_LAUNCH_STRICT ?? "")
    .trim()
    .toLowerCase();
  return ["1", "true", "yes"].includes(v);
}

function validateProductionAuthEnv() {
  const strict =
    process.env.VERCEL_ENV === "production" || isDoubowLaunchStrictEnv();
  if (!strict) return;

  const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
  const sk = process.env.CLERK_SECRET_KEY ?? "";
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

  const failures: string[] = [];
  if (!pk.startsWith("pk_live_")) failures.push("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY must be pk_live_...");
  if (!sk.startsWith("sk_live_")) failures.push("CLERK_SECRET_KEY must be sk_live_...");
  if (!apiBase.startsWith("https://")) failures.push("NEXT_PUBLIC_API_BASE_URL must be an HTTPS production URL.");
  if (apiBase.includes("localhost") || apiBase.includes("127.0.0.1")) {
    failures.push("NEXT_PUBLIC_API_BASE_URL must not point to localhost in production.");
  }

  if (failures.length) {
    throw new Error(`Production auth/env check failed:\n- ${failures.join("\n- ")}`);
  }
}

validateProductionAuthEnv();

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
