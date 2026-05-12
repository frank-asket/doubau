#!/usr/bin/env node

import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const env = process.env;
const strict =
  env.VERCEL_ENV === "production" ||
  env.NODE_ENV === "production" ||
  ["1", "true", "yes"].includes(String(env.DOUBOW_LAUNCH_STRICT || "").toLowerCase());

const blockers = [];
const warnings = [];

function value(name) {
  return String(env[name] || "").trim();
}

const apiBase = value("NEXT_PUBLIC_API_BASE_URL");
const publishableKey = value("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY");
const secretKey = value("CLERK_SECRET_KEY");
const jwtTemplate = value("CLERK_JWT_TEMPLATE") || "doubow-api";

if (!apiBase) {
  blockers.push("NEXT_PUBLIC_API_BASE_URL is required.");
} else {
  try {
    const u = new URL(apiBase);
    if (strict && u.protocol !== "https:") {
      blockers.push("NEXT_PUBLIC_API_BASE_URL must be HTTPS in production.");
    }
    if (strict && ["localhost", "127.0.0.1"].includes(u.hostname)) {
      blockers.push("NEXT_PUBLIC_API_BASE_URL points to localhost in production.");
    }
    if (apiBase.endsWith("/")) {
      warnings.push("NEXT_PUBLIC_API_BASE_URL should not have a trailing slash.");
    }
  } catch {
    blockers.push("NEXT_PUBLIC_API_BASE_URL must be an absolute URL.");
  }
}

if (!publishableKey) {
  blockers.push("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required.");
} else if (strict) {
  if (publishableKey.startsWith("pk_live_")) {
    if (!secretKey.startsWith("sk_live_")) {
      blockers.push(
        "CLERK_SECRET_KEY must start with sk_live_ when NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is pk_live_…",
      );
    }
  } else if (publishableKey.startsWith("pk_test_")) {
    if (!secretKey.startsWith("sk_test_")) {
      blockers.push(
        "CLERK_SECRET_KEY must start with sk_test_ when NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is pk_test_… (demo on *.vercel.app).",
      );
    }
  } else {
    blockers.push(
      "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY must start with pk_live_ or pk_test_ (Clerk publishable key).",
    );
  }
}

if (!secretKey) {
  blockers.push("CLERK_SECRET_KEY is required.");
}

if (jwtTemplate !== "doubow-api") {
  warnings.push(`CLERK_JWT_TEMPLATE is "${jwtTemplate}". Confirm it matches the API audience/template setup.`);
}

if (strict && value("NEXT_PUBLIC_API_BASE_URL").includes("localhost")) {
  blockers.push("Web production env still references localhost.");
}

console.error("Doubow web launch env check\n");

if (!blockers.length && !warnings.length) {
  console.log("No launch env warnings detected.");
  process.exit(0);
}

if (blockers.length) {
  console.error(`${blockers.length} blocker(s):\n`);
  for (const b of blockers) console.error(`  - ${b}`);
  console.error("");
}

if (warnings.length) {
  console.error(`${warnings.length} warning(s):\n`);
  for (const w of warnings) console.error(`  - ${w}`);
  console.error("");
}

if (blockers.length) process.exit(1);
