import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "DouBow — AI drafts. You decide.",
  description:
    "AI drafts. You decide. Nothing moves without you.",
};

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="hirslamsScope font-sans flex min-h-0 flex-1 flex-col bg-[var(--bg)] text-[var(--text)]">
      {children}
    </div>
  );
}

