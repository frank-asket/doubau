import type { ReactNode } from "react";
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-app-sans",
  display: "swap",
});

export function AppThemeShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`theme-app min-h-0 flex flex-1 flex-col font-[family-name:var(--font-app-sans)] ${inter.variable} ${className ?? ""}`}
    >
      {children}
    </div>
  );
}
