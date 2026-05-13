"use client";

import { useEffect, useState } from "react";

import type { EmployerBrandPayload } from "@/lib/logo-dev-describe-types";
import { fetchLogoDevEmployerDescribe } from "@/lib/logo-dev-employer-load";

export type LogoDevEmployerDescribeState = {
  payload: EmployerBrandPayload | null;
  blocked: string | null;
  loading: boolean;
};

export function useLogoDevEmployerDescribe(domain: string | null, enabled: boolean): LogoDevEmployerDescribeState {
  const [payload, setPayload] = useState<EmployerBrandPayload | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !domain) {
      setPayload(null);
      setBlocked(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setBlocked(null);
    setPayload(null);

    void (async () => {
      const out = await fetchLogoDevEmployerDescribe(domain);
      if (cancelled) return;
      setPayload(out.payload);
      setBlocked(out.blocked);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [domain, enabled]);

  return { payload, blocked, loading };
}
