"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";

import { AppIcon, type AppIconName } from "@/components/ui/app-icon";
import { wsBaseFromHttp } from "@/lib/ws-base";
import { cn } from "@/lib/utils";

import {
  CAREER_COPILOT_POPULAR_TOPICS,
  CAREER_COPILOT_QUICK_ACTIONS,
  CAREER_COPILOT_WELCOME_CARDS,
} from "./career-copilot-prompts";

type ChatMessage = { role: "user" | "assistant"; text: string };

function CopilotComposerBar({
  value,
  onChange,
  disabled,
  busy,
  onSend,
  inputRef,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  busy: boolean;
  onSend: () => void;
  inputRef: RefObject<HTMLInputElement | null>;
}) {
  return (
    <div className="flex items-center gap-2 rounded-[999px] border-[0.5px] border-solid border-[var(--app-border)] bg-[var(--app-bg-page)] px-1.5 py-1 pl-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
      <button
        type="button"
        disabled={disabled}
        className="grid size-9 shrink-0 place-items-center rounded-full text-[var(--app-text-tertiary)] transition-colors hover:bg-[var(--app-bg-muted)] hover:text-[var(--app-text-primary)] disabled:opacity-40"
        aria-label="Attach file (coming soon)"
        title="Attachments coming soon"
      >
        <PaperclipIcon className="size-[18px]" />
      </button>
      <input
        ref={inputRef}
        type="text"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSend();
          }
        }}
        placeholder="Type a message…"
        className="min-w-0 flex-1 border-0 bg-transparent py-2 text-[13px] text-[var(--app-text-primary)] outline-none placeholder:text-[var(--app-text-tertiary)]"
      />
      <button
        type="button"
        disabled={disabled || busy || !value.trim()}
        onClick={onSend}
        className="inline-flex h-10 shrink-0 items-center justify-center rounded-[999px] bg-[#0c1210] px-5 text-[13px] font-semibold text-white shadow-[0_6px_20px_rgba(12,18,16,0.25)] transition-[transform,background-color,opacity] duration-150 hover:bg-[#151c19] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45"
      >
        {busy ? "Sending…" : "Send"}
      </button>
    </div>
  );
}

function PaperclipIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M21.44 11.05 12.25 20.24a5.47 5.47 0 0 1-7.75-7.75l9.19-9.19a3.65 3.65 0 0 1 5.16 5.16l-9.2 9.19a1.82 1.82 0 0 1-2.58-2.58l8.36-8.36" />
    </svg>
  );
}

function CopyGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function PromptMenu({
  label,
  icon,
  items,
  disabled,
  onPick,
}: {
  label: string;
  icon: AppIconName;
  items: { label: string; prompt: string }[];
  disabled: boolean;
  onPick: (prompt: string) => void;
}) {
  return (
    <details className="group relative">
      <summary
        className={cn(
          "flex cursor-pointer list-none items-center gap-2 rounded-[999px] border-[0.5px] border-solid border-[var(--app-border)] bg-[var(--app-bg-elevated)] px-3 py-1.5 text-[12px] font-medium text-[var(--app-text-secondary)] shadow-[var(--app-shadow-0)] transition-[border-color,background-color,color]",
          "hover:border-[color-mix(in_srgb,var(--app-accent)_45%,var(--app-border))] hover:text-[var(--app-text-primary)]",
          "[&::-webkit-details-marker]:hidden",
        )}
      >
        <AppIcon name={icon} className="size-3.5 text-[var(--app-accent)]" />
        {label}
        <AppIcon name="chevron-down" className="size-3 text-[var(--app-text-tertiary)] transition-transform group-open:rotate-180" />
      </summary>
      <div
        className="absolute bottom-[calc(100%+6px)] left-0 z-20 min-w-[220px] max-w-[min(320px,85vw)] overflow-hidden rounded-[var(--app-radius-lg)] border-[0.5px] border-solid border-[var(--app-border)] bg-[var(--app-bg-elevated)] py-1 shadow-[var(--app-shadow-1)]"
        role="menu"
      >
        {items.map((row) => (
          <button
            key={row.label}
            type="button"
            role="menuitem"
            disabled={disabled}
            className="flex w-full px-3 py-2.5 text-left text-[12px] leading-snug text-[var(--app-text-primary)] transition-colors hover:bg-[var(--app-bg-muted)] disabled:opacity-50"
            onClick={(e) => {
              onPick(row.prompt);
              const root = (e.currentTarget as HTMLElement).closest("details");
              if (root) (root as HTMLDetailsElement).open = false;
            }}
          >
            {row.label}
          </button>
        ))}
      </div>
    </details>
  );
}

export function CareerCopilotClient() {
  const { getToken } = useAuth();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const apiHttp = useMemo(
    () => process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000",
    [],
  );

  const startSession = useCallback(async () => {
    setError(null);
    const resp = await fetch("/api/copilot/sessions", { method: "POST" });
    if (!resp.ok) {
      setError("Could not start your coaching session.");
      return;
    }
    const data = (await resp.json()) as { id?: string };
    if (data.id) setSessionId(data.id);
  }, []);

  useEffect(() => {
    void startSession();
  }, [startSession]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || !sessionId) return;
    setInput("");
    setBusy(true);
    setError(null);
    setMessages((m) => [...m, { role: "user", text }]);

    const token = await getToken({ template: "doubow-api" });
    if (!token) {
      setError("Sign in required.");
      setBusy(false);
      return;
    }

    const wsUrl = new URL("/copilot/ws", `${wsBaseFromHttp(apiHttp)}/`);
    wsUrl.searchParams.set("session_id", sessionId);
    wsUrl.searchParams.set("token", token);

    let assistant = "";
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(wsUrl.toString());
      ws.onopen = () => {
        ws.send(JSON.stringify({ text }));
      };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data)) as { type?: string; text?: string; detail?: string };
          if (msg.type === "delta" && msg.text) {
            assistant += msg.text;
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.role === "assistant") {
                next[next.length - 1] = { role: "assistant", text: assistant };
              } else {
                next.push({ role: "assistant", text: assistant });
              }
              return next;
            });
          }
          if (msg.type === "error") {
            setError(typeof msg.detail === "string" ? msg.detail : "Copilot error.");
          }
          if (msg.type === "done") {
            ws.close();
          }
        } catch {
          /* ignore */
        }
      };
      ws.onerror = () => {
        reject(new Error("ws_error"));
      };
      ws.onclose = () => resolve();
    }).catch(() => {
      setError("Connection failed. Please refresh and try again.");
    });

    setBusy(false);
  }, [apiHttp, getToken, input, sessionId]);

  const newChat = useCallback(async () => {
    if (busy) return;
    setMessages([]);
    setInput("");
    setError(null);
    setSessionId(null);
    await startSession();
    inputRef.current?.focus();
  }, [busy, startSession]);

  const hasThread = messages.length > 0;
  const composerDisabled = busy || !sessionId;

  return (
    <div className="mx-auto flex w-full max-w-[880px] flex-col gap-5 pb-8">
      {error ? (
        <div
          role="alert"
          className="rounded-[var(--app-radius-md)] border-[0.5px] border-solid border-[color-mix(in_srgb,var(--app-danger)_35%,var(--app-border))] bg-[color-mix(in_srgb,var(--app-danger)_10%,transparent)] px-4 py-3 text-[13px] text-[var(--app-danger)]"
        >
          {error}
        </div>
      ) : null}

      <div
        className={cn(
          "flex min-h-[min(72vh,640px)] flex-col overflow-hidden rounded-[var(--app-radius-lg)] border-[0.5px] border-solid border-[var(--app-border)] bg-[var(--app-bg-elevated)] shadow-[var(--app-shadow-1)]",
        )}
      >
        {!hasThread ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-8 px-5 py-10 sm:px-10 sm:py-12">
            <header className="max-w-xl text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--app-text-tertiary)]">
                Doubow · Career Copilot
              </p>
              <h1 className="mt-2 text-balance text-[clamp(1.65rem,4vw,2.35rem)] font-semibold tracking-tight text-[var(--app-text-primary)]">
                Hi! I&apos;m your Career Copilot <span aria-hidden>👋</span>
              </h1>
              <p className="mt-2 text-[15px] text-[var(--app-text-secondary)]">I can help you with:</p>
            </header>

            <div className="grid w-full max-w-[640px] gap-3 sm:grid-cols-2 sm:gap-4">
              {CAREER_COPILOT_WELCOME_CARDS.map((card) => (
                <button
                  key={card.title}
                  type="button"
                  disabled={composerDisabled}
                  onClick={() => {
                    setInput(card.prompt);
                    requestAnimationFrame(() => inputRef.current?.focus());
                  }}
                  className="group relative flex flex-col gap-3 overflow-hidden rounded-2xl border-[0.5px] border-solid border-[color-mix(in_srgb,var(--app-accent)_22%,var(--app-border))] bg-gradient-to-br from-[color-mix(in_srgb,var(--app-accent)_14%,var(--app-bg-page))] via-[var(--app-bg-elevated)] to-[var(--app-bg-page)] p-5 text-left shadow-[var(--app-shadow-0)] transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--app-accent)_40%,var(--app-border))] hover:shadow-[var(--app-shadow-1)] disabled:pointer-events-none disabled:opacity-50"
                >
                  <span className="grid size-11 place-items-center rounded-full border border-white/60 bg-white/85 text-[var(--app-accent)] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                    <AppIcon name={card.icon} className="size-5" />
                  </span>
                  <div>
                    <div className="text-[15px] font-semibold text-[var(--app-text-primary)]">{card.title}</div>
                    <p className="mt-1 text-pretty text-[12px] leading-relaxed text-[var(--app-text-secondary)]">
                      {card.description}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6">
              {messages.map((m, i) => (
                <div
                  key={`${i}-${m.role}-${m.text.slice(0, 24)}`}
                  className={cn("flex gap-3", m.role === "user" ? "flex-row-reverse" : "flex-row")}
                >
                  <div
                    className={cn(
                      "grid size-9 shrink-0 place-items-center rounded-full border text-[11px] font-bold",
                      m.role === "user"
                        ? "border-[color-mix(in_srgb,var(--app-accent)_35%,var(--app-border))] bg-[color-mix(in_srgb,var(--app-accent)_16%,white)] text-[var(--app-accent-700)]"
                        : "border-[var(--app-border)] bg-[var(--app-bg-muted)] text-[var(--app-text-secondary)]",
                    )}
                    aria-hidden
                  >
                    {m.role === "user" ? "You" : "AI"}
                  </div>
                  <div
                    className={cn(
                      "max-w-[min(100%,560px)] rounded-2xl px-4 py-3 text-[13px] leading-relaxed shadow-[var(--app-shadow-0)]",
                      m.role === "user"
                        ? "bg-[color-mix(in_srgb,var(--app-accent)_88%,#0a3224)] text-white"
                        : "border-[0.5px] border-solid border-[var(--app-border)] bg-[var(--app-bg-page)] text-[var(--app-text-primary)]",
                    )}
                  >
                    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[inherit] opacity-80">
                      {m.role === "user" ? "You" : "AI assistant"}
                    </div>
                    <div className="mt-1 whitespace-pre-wrap font-[family-name:var(--font-app-mono)] text-[12.5px] leading-relaxed">
                      {m.text}
                    </div>
                    {m.role === "assistant" && m.text.trim() ? (
                      <div className="mt-3 flex flex-wrap gap-1 border-t border-[var(--app-border)] pt-2">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium text-[var(--app-text-tertiary)] hover:bg-[var(--app-bg-muted)] hover:text-[var(--app-text-primary)]"
                          onClick={() => void navigator.clipboard.writeText(m.text)}
                        >
                          <CopyGlyph className="size-3.5" />
                          Copy
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          </div>
        )}

        <div className="border-t-[0.5px] border-solid border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-bg-page)_88%,var(--app-bg-elevated))] px-3 py-3 sm:px-5 sm:py-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <PromptMenu
              label="Quick actions"
              icon="sparkle"
              items={CAREER_COPILOT_QUICK_ACTIONS}
              disabled={composerDisabled}
              onPick={(prompt) => {
                setInput(prompt);
                requestAnimationFrame(() => inputRef.current?.focus());
              }}
            />
            <PromptMenu
              label="Popular topics"
              icon="file-text"
              items={CAREER_COPILOT_POPULAR_TOPICS}
              disabled={composerDisabled}
              onPick={(prompt) => {
                setInput(prompt);
                requestAnimationFrame(() => inputRef.current?.focus());
              }}
            />
            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                className="grid size-9 place-items-center rounded-full text-[var(--app-text-tertiary)] hover:bg-[var(--app-bg-muted)] hover:text-[var(--app-text-primary)]"
                aria-label="Scroll to latest"
                onClick={() => bottomRef.current?.scrollIntoView({ behavior: "smooth" })}
              >
                <AppIcon name="chevron-down" className="size-4" />
              </button>
              <button
                type="button"
                disabled={busy}
                className="grid size-9 place-items-center rounded-full text-[var(--app-text-tertiary)] hover:bg-[var(--app-bg-muted)] hover:text-[var(--app-text-primary)] disabled:opacity-40"
                aria-label="Start new chat"
                title="New chat"
                onClick={() => void newChat()}
              >
                <AppIcon name="message-circle" className="size-4" />
              </button>
            </div>
          </div>
          <CopilotComposerBar
            value={input}
            onChange={setInput}
            disabled={composerDisabled}
            busy={busy}
            onSend={() => void send()}
            inputRef={inputRef}
          />
        </div>
      </div>
    </div>
  );
}
