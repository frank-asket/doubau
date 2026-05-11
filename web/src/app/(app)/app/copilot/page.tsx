"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AppButton } from "@/components/ui/button";
import { wsBaseFromHttp } from "@/lib/ws-base";

export default function CopilotPage() {
  const { getToken } = useAuth();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

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

  return (
    <div className="mx-auto flex w-full max-w-[var(--app-content-max)] flex-col gap-4">
      <div>
        <h1 className="text-balance text-[length:var(--app-text-display)] font-medium tracking-tight text-[var(--app-text-primary)]">
          Career coach
        </h1>
        <p className="mt-2 max-w-2xl text-pretty text-[14px] leading-6 text-[var(--app-text-secondary)]">
          Ask questions about your applications, drafts, jobs, and next steps.
        </p>
      </div>

      {error ? (
        <div className="rounded-[var(--app-radius-md)] border-[0.5px] border-solid border-[color-mix(in_srgb,var(--app-danger)_35%,var(--app-border))] bg-[color-mix(in_srgb,var(--app-danger)_10%,transparent)] px-3 py-2 text-[13px] text-[var(--app-danger)]">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <span className="w-full text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">
          Quick actions
        </span>
        {[
          { label: "Career strategy", prompt: "Given my persona and goals, what should I prioritize this week?" },
          { label: "Résumé review", prompt: "Review my latest résumé text and list the top 5 improvements before I apply." },
          { label: "Interview prep", prompt: "What interview questions should I expect for my target role, and how should I structure answers?" },
          { label: "Skill analysis", prompt: "Which skills should I emphasize next based on typical job postings in my field?" },
        ].map((a) => (
          <button
            key={a.label}
            type="button"
            disabled={busy || !sessionId}
            onClick={() => setInput(a.prompt)}
            className="rounded-[var(--app-radius-pill)] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] px-3 py-1.5 text-[12px] font-medium text-[var(--app-text-secondary)] transition-colors hover:border-[var(--app-accent)] hover:text-[var(--app-text-primary)] disabled:opacity-50"
          >
            {a.label}
          </button>
        ))}
      </div>

      <div className="flex min-h-[320px] flex-col gap-3 rounded-[var(--app-radius-lg)] border-[0.5px] border-solid border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-4">
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto text-[13px] leading-6">
          {messages.length === 0 ? (
            <p className="text-[var(--app-text-secondary)]">
              Ask anything about your pipeline — for example: “List my applications” or “Search jobs for product
              manager”.
            </p>
          ) : null}
          {messages.map((m, i) => (
            <div
              key={`${i}-${m.role}`}
              className={
                m.role === "user"
                  ? "ml-auto max-w-[92%] rounded-[var(--app-radius-md)] bg-[color-mix(in_srgb,var(--app-accent)_18%,transparent)] px-3 py-2 text-[var(--app-text-primary)]"
                  : "mr-auto max-w-[92%] rounded-[var(--app-radius-md)] border-[0.5px] border-solid border-[var(--app-border)] px-3 py-2 text-[var(--app-text-primary)]"
              }
            >
              <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">
                {m.role === "user" ? "You" : "Coach"}
              </div>
              <div className="mt-1 whitespace-pre-wrap font-[family-name:var(--font-app-mono)] text-[12.5px] leading-relaxed">
                {m.text}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="flex flex-col gap-2 border-t-[0.5px] border-solid border-[var(--app-border)] pt-3 sm:flex-row">
          <textarea
            className="min-h-[44px] flex-1 resize-none rounded-[var(--app-radius-md)] border-[0.5px] border-solid border-[var(--app-border)] bg-[var(--app-bg-page)] px-3 py-2 font-[family-name:var(--font-app-mono)] text-[13px] leading-relaxed text-[var(--app-text-primary)] outline-none placeholder:text-[var(--app-text-tertiary)]"
            placeholder="Message your career coach…"
            rows={2}
            value={input}
            disabled={busy || !sessionId}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <AppButton disabled={busy || !sessionId || !input.trim()} type="button" variant="primary" onClick={() => void send()}>
            Send
          </AppButton>
        </div>
      </div>
    </div>
  );
}
