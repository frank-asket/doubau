import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";

import { getSiteUrl } from "@/lib/site-url";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "DouBow",
    template: "%s · DouBow",
  },
  description:
    "AI-assisted job search workspace with strict human-in-the-loop approval for every outbound action.",
  applicationName: "DouBow",
  openGraph: {
    type: "website",
    title: "DouBow",
    description: "AI drafts. You decide. Nothing moves without you.",
    siteName: "DouBow",
  },
  twitter: {
    card: "summary_large_image",
    title: "DouBow",
    description: "AI drafts. You decide. Nothing moves without you.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[var(--background)] text-[var(--foreground)]">
        <ClerkProvider>{children}</ClerkProvider>
      </body>
    </html>
  );
}
