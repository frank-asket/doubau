"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { ProductPageChrome } from "./ProductPageChrome";

type ResumePayload = {
  id?: string;
  status?: string;
  file_name?: string;
  parsed_json?: { text?: string } | null;
  extracted_text?: string | null;
};

export function CvBuilderClient() {
  const q = useQuery({
    queryKey: ["me-resume-latest"],
    queryFn: async () => {
      const r = await fetch("/api/me/resume/latest", { cache: "no-store" });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error("resume");
      return r.json() as Promise<ResumePayload>;
    },
  });

  const text =
    (typeof q.data?.extracted_text === "string" && q.data.extracted_text.trim()) ||
    q.data?.parsed_json?.text?.trim() ||
    "";

  return (
    <ProductPageChrome
      title="CV builder"
      description="Review the résumé DouBow has on file and use it as the starting point for tailored applications."
    >
      {q.isLoading ? (
        <p className="text-[13px] text-[var(--app-text-secondary)]">Loading résumé…</p>
      ) : q.isError ? (
        <p className="text-[13px] text-[var(--app-badge-red-fg)]">Could not load résumé metadata.</p>
      ) : !q.data?.id ? (
        <div className="rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-5 text-[13px] text-[var(--app-text-secondary)]">
          No résumé on file yet.{" "}
          <Link href="/onboarding/resume" className="font-medium text-[var(--app-accent)] hover:underline">
            Upload during onboarding
          </Link>{" "}
          or use the dashboard resume panel when available.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-4 text-[13px] text-[var(--app-text-secondary)]">
            <span className="font-medium text-[var(--app-text-primary)]">{q.data.file_name ?? "Résumé"}</span>
            {" · "}
            Status:{" "}
            <span className="font-mono text-[12px] text-[var(--app-text-primary)]">{q.data.status ?? "—"}</span>
          </div>
          <div className="rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">
              Parsed text (read-only)
            </div>
            <pre className="mt-3 max-h-[min(480px,55vh)] overflow-auto whitespace-pre-wrap rounded-md bg-[var(--app-bg-page)] p-4 font-[family-name:var(--font-app-mono)] text-[11px] leading-relaxed text-[var(--app-text-secondary)]">
              {text || "No extracted text is ready yet. Try again after your résumé finishes processing."}
            </pre>
          </div>
        </div>
      )}
    </ProductPageChrome>
  );
}
