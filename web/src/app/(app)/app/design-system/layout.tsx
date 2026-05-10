import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Design references",
  description:
    "DouBow and CareerHero design system HTML references served from public/.",
};

export default function DesignSystemLayout({ children }: { children: ReactNode }) {
  return children;
}
