"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";

import { AppButton } from "@/components/ui/button";

export type ResumeStatusResponse = {
  id?: string;
  status?: string;
  error?: string | null;
  parsed_json?: {
    text?: string;
    length?: number;
    structured?: { headline?: string; word_count?: number; section_ids_found?: string[] };
  } | null;
  file_name?: string | null;
};

const ACCEPT = ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export type ResumeUploadSectionProps = {
  variant: "onboarding" | "dashboard";
  /** Called after pipeline succeeds (PARSED without embeddings, or EMBEDDED with OpenAI). */
  onParsed?: (result: ResumeStatusResponse) => void;
};

export function ResumeUploadSection({ variant, onParsed }: ResumeUploadSectionProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<"idle" | "uploading" | "processing" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [detail, setDetail] = useState<string | null>(null);

  const pollUntilParsed = useCallback(async (id: string) => {
    const maxAttempts = 48;
    for (let i = 0; i < maxAttempts; i++) {
      const rr = await fetch(`/api/me/resume/${id}`, { cache: "no-store" });
      if (!rr.ok) {
        const errBody = (await rr.json().catch(() => ({}))) as { detail?: string };
        throw new Error(errBody.detail ?? `Status ${rr.status}`);
      }
      const data = (await rr.json()) as ResumeStatusResponse;
      const st = data.status ?? "";
      if (st === "PARSED" || st === "EMBEDDED") {
        return data;
      }
      if (st === "FAILED") {
        throw new Error(data.error ?? "Parsing failed.");
      }
      await sleep(500);
    }
    throw new Error(
      variant === "dashboard"
        ? "Parsing is taking longer than expected. Refresh in a moment."
        : "Parsing is taking longer than expected. You can continue and try again from settings later.",
    );
  }, [variant]);

  function formatDetail(result: ResumeStatusResponse) {
    const structured = result.parsed_json?.structured;
    const headline = structured?.headline?.trim();
    const text = result.parsed_json?.text;
    if (headline) {
      const snippet = headline.slice(0, 280);
      return headline.length > 280 ? `${snippet}…` : snippet;
    }
    if (!text) return null;
    const snippet = text.slice(0, 280);
    return text.length > 280 ? `${snippet}…` : snippet;
  }

  async function runUpload(file: File) {
    setPhase("uploading");
    setMessage(null);
    setDetail(null);

    const fd = new FormData();
    fd.append("file", file, file.name);

    const up = await fetch("/api/me/resume", {
      method: "POST",
      body: fd,
    });

    if (!up.ok) {
      const err = (await up.json().catch(() => ({}))) as { detail?: unknown };
      const msg =
        typeof err.detail === "string"
          ? err.detail
          : Array.isArray(err.detail)
            ? err.detail
                .map((x) => (typeof x === "object" && x && "msg" in x ? String((x as { msg?: string }).msg) : ""))
                .filter(Boolean)
                .join(" ")
            : `Upload failed (${up.status})`;
      throw new Error(msg || `Upload failed (${up.status})`);
    }

    const created = (await up.json()) as { id?: string };
    if (!created.id) {
      throw new Error("Unexpected response from server.");
    }

    setPhase("processing");
    const result = await pollUntilParsed(created.id);
    setPhase("done");
    setMessage(variant === "dashboard" ? "Résumé updated." : "Résumé processed successfully.");
    setDetail(formatDetail(result));
    onParsed?.(result);
    if (variant === "dashboard") {
      window.setTimeout(() => {
        setPhase("idle");
        setMessage(null);
        setDetail(null);
      }, 2200);
    }
  }

  async function handleFile(file: File) {
    try {
      await runUpload(file);
    } catch (err) {
      setPhase("error");
      setMessage(err instanceof Error ? err.message : "Something went wrong.");
      setDetail(null);
    }
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    void handleFile(file);
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    void handleFile(file);
  }

  const dropClass =
    variant === "dashboard"
      ? "min-h-[96px] py-6"
      : "min-h-[120px] py-8";

  return (
    <div className="space-y-4">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        aria-hidden
        tabIndex={-1}
        onChange={onPick}
      />

      {phase === "idle" || phase === "error" ? (
        <>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={onDragOver}
            onDrop={onDrop}
            className={`flex w-full flex-col items-center justify-center rounded-[var(--app-radius-lg)] border-[0.5px] border-dashed border-[var(--app-border-strong)] bg-[var(--app-bg-muted)] px-4 text-center transition-colors hover:bg-[color-mix(in_srgb,var(--app-blue-50)_55%,var(--app-bg-muted))] ${dropClass}`}
          >
            <span className="text-[13px] font-semibold text-[var(--app-text-primary)]">
              {variant === "dashboard" ? "Replace résumé" : "Choose a file"}
            </span>
            <span className="mt-1 text-[12px] text-[var(--app-text-secondary)]">
              {variant === "dashboard" ? "PDF or DOCX · max 10 MB" : "or drag and drop — PDF, DOCX"}
            </span>
          </button>
          {variant === "onboarding" ? (
            <p className="text-center text-[12px] text-[var(--app-text-secondary)]">
              <button
                type="button"
                onClick={() => router.push("/onboarding/goals")}
                className="underline underline-offset-2 hover:text-[var(--app-text-primary)]"
              >
                Skip for now
              </button>
            </p>
          ) : null}
        </>
      ) : null}

      {phase === "uploading" ? (
        <div className="rounded-[var(--app-radius-lg)] border-[0.5px] border-solid border-[var(--app-border)] bg-[var(--app-bg-elevated)] px-4 py-6 text-center text-[13px] text-[var(--app-text-secondary)]">
          Uploading…
        </div>
      ) : null}

      {phase === "processing" ? (
        <div className="rounded-[var(--app-radius-lg)] border-[0.5px] border-solid border-[var(--app-border)] bg-[var(--app-bg-elevated)] px-4 py-8 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[var(--app-accent)] border-t-transparent" />
          <p className="mt-4 text-[13px] font-medium text-[var(--app-text-primary)]">Parsing your résumé…</p>
          <p className="mt-1 text-[12px] text-[var(--app-text-secondary)]">Usually a few seconds.</p>
        </div>
      ) : null}

      {phase === "done" ? (
        <div className="space-y-4">
          <div className="rounded-[var(--app-radius-md)] border-[0.5px] border-solid border-[color-mix(in_srgb,var(--app-success)_35%,var(--app-border))] bg-[color-mix(in_srgb,var(--app-success)_12%,transparent)] px-4 py-3 text-[13px] text-[var(--app-badge-green-fg)]">
            {message}
          </div>
          {detail ? (
            <blockquote className="rounded-[var(--app-radius-md)] border-[0.5px] border-solid border-[var(--app-border)] bg-[var(--app-bg-muted)] px-3 py-2 text-[12px] leading-relaxed text-[var(--app-text-secondary)]">
              {detail}
            </blockquote>
          ) : null}
          {variant === "onboarding" ? (
            <AppButton className="h-11 w-full" size="lg" variant="primary" onClick={() => router.push("/onboarding/goals")}>
              Continue
            </AppButton>
          ) : null}
        </div>
      ) : null}

      {phase === "error" ? (
        <div className="space-y-4">
          <div className="rounded-[var(--app-radius-md)] border-[0.5px] border-solid border-[color-mix(in_srgb,var(--app-danger)_35%,var(--app-border))] bg-[color-mix(in_srgb,var(--app-danger)_10%,transparent)] px-3 py-2 text-[13px] text-[var(--app-danger)]">
            {message}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <AppButton
              className="h-11 flex-1"
              variant="outline"
              onClick={() => {
                setPhase("idle");
                setMessage(null);
              }}
            >
              Try again
            </AppButton>
            {variant === "onboarding" ? (
              <AppButton className="h-11 flex-1" variant="primary" onClick={() => router.push("/onboarding/goals")}>
                Skip for now
              </AppButton>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
