import type { ReactNode } from "react";

export function AppThemeShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`theme-app min-h-0 flex flex-1 flex-col font-[family-name:var(--font-app-sans)] antialiased ${className ?? ""}`}
    >
      {children}
    </div>
  );
}
