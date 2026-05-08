"use client";

import { useCallback, useEffect, useState } from "react";

import type { AppBadgeVariant } from "@/components/ui/badge";
import { AppBadge } from "@/components/ui/badge";

import type { ResumeStatusResponse } from "./ResumeUploadSection";
import { ResumeUploadSection } from "./ResumeUploadSection";

function statusLabel(status: string | undefined): string {
  switch (status) {
    case "PARSED":
      return "Ready for matching";
    case "UPLOADED":
      return "Queued for parsing";
    case "FAILED":
      return "Processing failed";
    case "EMBEDDED":
      return "Indexed";
    default:
      return status ?? "Unknown";
  }
}

function statusBadgeVariant(status: string | undefined): AppBadgeVariant {
  switch (status) {
    case "PARSED":
    case "EMBEDDED":
      return "green";
    case "UPLOADED":
      return "blue";
    case "FAILED":
      return "red";
    default:
      return "gray";
  }
}

export function DashboardResumePanel() {
  const [latest, setLatest] = useState<ResumeStatusResponse | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoadError(null);
    try {
      const r = await fetch("/api/me/resume/latest", { cache: "no-store" });
      if (r.status === 404) {
        setLatest(null);
        return;
      }
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { detail?: string };
        throw new Error(body.detail ?? `Could not load résumé (${r.status})`);
      }
      setLatest((await r.json()) as ResumeStatusResponse);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load résumé.");
      setLatest((prev) => (prev === undefined ? null : prev));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onParsed = useCallback(() => {
    void refresh();
  }, [refresh]);

  const snippet =
    latest?.parsed_json?.structured?.headline?.trim() ||
    latest?.parsed_json?.text?.slice(0, 220)?.trim() ||
    null;
  const extended = snippet && latest?.parsed_json?.text && latest.parsed_json.text.length > 220;

  return (
    <div className="rounded-[var(--app-radius-lg)] border-[0.5px] border-solid border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-5 shadow-[var(--app-shadow-0)]">
      <div className="text-[15px] font-semibold tracking-tight text-[var(--app-text-primary)]">Résumé</div>
      <p className="mt-1 text-[14px] leading-6 text-[var(--app-text-secondary)]">
        Your résumé powers job matching and outreach drafts. Upload PDF or Word (.docx), max 10&nbsp;MB.
      </p>

      {loadError ? (
        <p className="mt-4 text-[13px] text-[var(--app-danger)]">{loadError}</p>
      ) : null}

      {latest === undefined && !loadError ? (
        <p className="mt-4 text-[13px] text-[var(--app-text-secondary)]">Loading…</p>
      ) : null}

      {latest === null && !loadError ? (
        <p className="mt-4 text-[13px] text-[var(--app-text-secondary)]">No résumé on file yet.</p>
      ) : null}

      {latest?.id ? (
        <div className="mt-4 rounded-[var(--app-radius-md)] border-[0.5px] border-solid border-[var(--app-border)] bg-[var(--app-bg-muted)] px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[13px] font-semibold text-[var(--app-text-primary)]">
              {latest.file_name ?? "Résumé"}
            </span>
            <AppBadge variant={statusBadgeVariant(latest.status)}>{statusLabel(latest.status)}</AppBadge>
          </div>
          {snippet ? (
            <p className="mt-2 text-[12px] leading-relaxed text-[var(--app-text-secondary)]">
              {snippet}
              {extended ? "…" : ""}
            </p>
          ) : null}
          {latest.status === "FAILED" && latest.error ? (
            <p className="mt-2 text-[12px] text-[var(--app-danger)]">{latest.error}</p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-6">
        <ResumeUploadSection variant="dashboard" onParsed={onParsed} />
      </div>
    </div>
  );
}
