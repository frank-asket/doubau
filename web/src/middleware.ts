import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher(["/app(.*)", "/onboarding(.*)"]);
const isAuthRoute = createRouteMatcher(["/login(.*)", "/signup(.*)"]);

export default clerkMiddleware(async (auth, req) => {
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

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and static assets so chunks (main-app.js, layout.css, etc.) always 200.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
