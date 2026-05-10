"use client";

import { useAuth } from "@clerk/nextjs";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";

import { queryKeys } from "@/lib/query-keys";
import { wsBaseFromHttp } from "@/lib/ws-base";

/**
 * Subscribes to FastAPI `/applications/ws` and invalidates TanStack Query caches when the
 * pipeline signature changes (approve, reject, draft PATCH, generate draft, submit).
 */
export function useApplicationsPipelineWs(enabled: boolean) {
  const { getToken, isSignedIn } = useAuth();
  const qc = useQueryClient();
  const apiHttp = useMemo(
    () => process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000",
    [],
  );
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!enabled || !isSignedIn) return;

    let cancelled = false;

    const invalidatePipeline = () => {
      void qc.invalidateQueries({ queryKey: queryKeys.applications });
      void qc.invalidateQueries({ queryKey: queryKeys.applicationDrafts });
    };

    const connect = async () => {
      const token = await getToken({ template: "doubow-api" });
      if (!token || cancelled) return;

      wsRef.current?.close();
      wsRef.current = null;

      const wsUrl = new URL("/applications/ws", `${wsBaseFromHttp(apiHttp)}/`);
      wsUrl.searchParams.set("token", token);

      const ws = new WebSocket(wsUrl.toString());
      wsRef.current = ws;

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data)) as { type?: string };
          if (msg.type === "applications_changed" || msg.type === "connected") {
            invalidatePipeline();
          }
        } catch {
          /* ignore */
        }
      };

      ws.onclose = () => {
        if (wsRef.current === ws) wsRef.current = null;
        if (cancelled) return;
        reconnectTimerRef.current = setTimeout(() => {
          void connect();
        }, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    void connect();

    return () => {
      cancelled = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [apiHttp, enabled, getToken, isSignedIn, qc]);
}
