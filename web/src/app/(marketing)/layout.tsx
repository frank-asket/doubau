import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "DouBow — AI drafts. You decide.",
  description:
    "AI drafts. You decide. Nothing moves without you.",
};

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return <div className="flex-1 hirslamsScope">{children}</div>;
}

