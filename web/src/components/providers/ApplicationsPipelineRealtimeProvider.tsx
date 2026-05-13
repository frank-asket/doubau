"use client";

import { useAuth } from "@clerk/nextjs";
import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { queryKeys } from "@/lib/query-keys";
import { wsBaseFromHttp } from "@/lib/ws-base";

/** When WS is up, rare REST poll catches anything the socket missed. */
const POLL_WHEN_WS_OPEN_MS = 90_000;
/** When WS is down or API URL missing, poll often enough to feel “live”. */
const POLL_WHEN_WS_DOWN_MS = 6_000;

const BASE_RECONNECT_MS = 2_000;
const MAX_RECONNECT_MS = 45_000;

export type ApplicationsPipelineRealtime = {
  /** Use as TanStack `refetchInterval` for `applications` / `applicationDrafts` queries. */
  applicationsRefetchIntervalMs: number;
  /** WebSocket to FastAPI `/applications/ws` is connected. */
  wsConnected: boolean;
  /** False when `NEXT_PUBLIC_API_BASE_URL` is unset — only polling runs. */
  wsConfigured: boolean;
};

const defaultCtx: ApplicationsPipelineRealtime = {
  applicationsRefetchIntervalMs: POLL_WHEN_WS_DOWN_MS,
  wsConnected: false,
  wsConfigured: false,
};

const ApplicationsPipelineRealtimeContext = createContext<ApplicationsPipelineRealtime>(defaultCtx);

export function useApplicationsPipelineRealtime(): ApplicationsPipelineRealtime {
  return useContext(ApplicationsPipelineRealtimeContext);
}

/**
 * One browser WebSocket to FastAPI `GET /applications/ws` for the signed-in user.
 * Invalidates `applications` + `applicationDrafts` when the server reports pipeline changes.
 * Tracker / Approvals / notifications read {@link useApplicationsPipelineRealtime} for adaptive polling.
 */
export function ApplicationsPipelineRealtimeProvider({ children }: { children: ReactNode }) {
  const { getToken, isSignedIn } = useAuth();
  const qc = useQueryClient();
  const apiHttp = useMemo(
    () => (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").trim(),
    [],
  );
  const wsConfigured = Boolean(apiHttp);

  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const cancelledRef = useRef(false);

  const applicationsRefetchIntervalMs = wsConnected ? POLL_WHEN_WS_OPEN_MS : POLL_WHEN_WS_DOWN_MS;

  const value = useMemo<ApplicationsPipelineRealtime>(
    () => ({
      applicationsRefetchIntervalMs,
      wsConnected,
      wsConfigured,
    }),
    [applicationsRefetchIntervalMs, wsConnected, wsConfigured],
  );

  useEffect(() => {
    cancelledRef.current = false;

    const invalidatePipeline = () => {
      void qc.invalidateQueries({ queryKey: queryKeys.applications });
      void qc.invalidateQueries({ queryKey: queryKeys.applicationDrafts });
    };

    if (!isSignedIn || !wsConfigured) {
      setWsConnected(false);
      return () => {
        cancelledRef.current = true;
      };
    }

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const scheduleReconnect = () => {
      clearReconnectTimer();
      if (cancelledRef.current) return;
      const exp = Math.min(
        MAX_RECONNECT_MS,
        BASE_RECONNECT_MS * 2 ** Math.min(reconnectAttemptRef.current, 6),
      );
      const jitter = Math.floor(Math.random() * 900);
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        if (cancelledRef.current) return;
        void connect();
      }, exp + jitter);
      reconnectAttemptRef.current += 1;
    };

    const connect = async () => {
      if (cancelledRef.current) return;

      const token = await getToken({ template: "doubow-api" });
      if (!token || cancelledRef.current) return;

      wsRef.current?.close();
      wsRef.current = null;

      const wsUrl = new URL("/applications/ws", `${wsBaseFromHttp(apiHttp)}/`);
      wsUrl.searchParams.set("token", token);

      let ws: WebSocket;
      try {
        ws = new WebSocket(wsUrl.toString());
      } catch {
        setWsConnected(false);
        scheduleReconnect();
        return;
      }
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttemptRef.current = 0;
        setWsConnected(true);
        void invalidatePipeline();
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data)) as { type?: string };
          if (msg.type === "applications_changed") {
            void invalidatePipeline();
          }
        } catch {
          /* ignore */
        }
      };

      ws.onclose = () => {
        if (wsRef.current === ws) wsRef.current = null;
        setWsConnected(false);
        if (cancelledRef.current) return;
        scheduleReconnect();
      };

      ws.onerror = () => {
        try {
          ws.close();
        } catch {
          /* ignore */
        }
      };
    };

    void connect();

    return () => {
      cancelledRef.current = true;
      clearReconnectTimer();
      wsRef.current?.close();
      wsRef.current = null;
      setWsConnected(false);
    };
  }, [apiHttp, getToken, isSignedIn, qc, wsConfigured]);

  return (
    <ApplicationsPipelineRealtimeContext.Provider value={value}>
      {children}
    </ApplicationsPipelineRealtimeContext.Provider>
  );
}
