import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher(["/app(.*)", "/onboarding(.*)"]);
const isAuthRoute = createRouteMatcher(["/login(.*)", "/signup(.*)"]);

export default clerkMiddleware((auth, req) => {
  return (async () => {
    const { userId } = await auth();

    if (isProtectedRoute(req)) {
      if (!userId) {
        const url = req.nextUrl.clone();
        url.pathname = "/login";
        url.searchParams.set("next", req.nextUrl.pathname);
        return NextResponse.redirect(url);
      }
    }

    if (isAuthRoute(req) && userId) {
      const url = req.nextUrl.clone();
      url.pathname = "/app/dashboard";
      url.search = "";
      return NextResponse.redirect(url);
    }
  })();
});

export const config = {
  matcher: ["/app/:path*", "/onboarding/:path*", "/login(.*)", "/signup(.*)"],
};

