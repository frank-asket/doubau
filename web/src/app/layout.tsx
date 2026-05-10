import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Inter, JetBrains_Mono } from "next/font/google";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://doubow.com"),
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
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[var(--background)] text-[var(--foreground)]">
        <ClerkProvider>{children}</ClerkProvider>
      </body>
    </html>
  );
}
