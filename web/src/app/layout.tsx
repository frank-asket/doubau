import type { Metadata } from "next";
import { Instrument_Sans, Newsreader } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const instrumentSans = Instrument_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

const newsreader = Newsreader({
  variable: "--font-display",
  subsets: ["latin"],
  style: ["normal", "italic"],
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
      className={`${instrumentSans.variable} ${newsreader.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[var(--background)] text-[var(--foreground)]">
        <ClerkProvider>{children}</ClerkProvider>
      </body>
    </html>
  );
}
