import type { ReactNode } from "react";

export function ProductPageChrome({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex w-full max-w-[var(--app-content-max)] flex-col gap-4">
      <div className={description ? "px-1" : "sr-only"}>
        <h1 className="sr-only">
          {title}
        </h1>
        {description ? (
          <p className="max-w-3xl text-pretty text-[13px] leading-6 text-[var(--app-text-secondary)]">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </div>
  );
}
