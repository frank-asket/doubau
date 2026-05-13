import { auth } from "@clerk/nextjs/server";

import { handleLogoDevDescribeGET } from "@/lib/logo-dev-describe-handler";

export async function GET(req: Request) {
  const { userId } = await auth();
  return handleLogoDevDescribeGET(req, {
    userId,
    env: {
      NEXT_PUBLIC_LOGO_DEV_KEY: process.env.NEXT_PUBLIC_LOGO_DEV_KEY,
      NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY,
      LOGO_DEV_SECRET_KEY: process.env.LOGO_DEV_SECRET_KEY,
    },
    fetch: globalThis.fetch.bind(globalThis),
  });
}
