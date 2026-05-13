import { describe, expect, it, vi } from "vitest";

import { fetchLogoDevEmployerDescribe } from "./logo-dev-employer-load";

describe("fetchLogoDevEmployerDescribe", () => {
  it("returns payload on ok true", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({
          ok: true,
          data: {
            source: "logo.dev",
            partial: true,
            partial_why: "publishable_key_only",
            partial_palette_heuristic: true,
            name: "Stripe",
            domain: "stripe.com",
            description: "x",
            indexed_at: null,
            socials: {},
            colors_hex: ["#2563eb", "#64748b"],
            logo_url: "https://img.logo.dev/stripe.com?token=pk&size=128",
            blurhash: null,
          },
        }),
      }),
    );
    const out = await fetchLogoDevEmployerDescribe("stripe.com");
    expect(out.blocked).toBeNull();
    expect(out.payload?.domain).toBe("stripe.com");
    vi.unstubAllGlobals();
  });

  it("maps not_signed_in", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({ ok: false, reason: "not_signed_in", message: "Sign in" }),
      }),
    );
    const out = await fetchLogoDevEmployerDescribe("a.com");
    expect(out.payload).toBeNull();
    expect(out.blocked).toContain("Sign in");
    vi.unstubAllGlobals();
  });

  it("maps not_configured", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({ ok: false, reason: "not_configured", message: "Add keys" }),
      }),
    );
    const out = await fetchLogoDevEmployerDescribe("a.com");
    expect(out.blocked).toContain("NEXT_PUBLIC_LOGO_DEV_KEY");
    vi.unstubAllGlobals();
  });

  it("maps upstream with message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({ ok: false, reason: "upstream", message: "boom" }),
      }),
    );
    const out = await fetchLogoDevEmployerDescribe("a.com");
    expect(out.blocked).toBe("boom");
    vi.unstubAllGlobals();
  });

  it("handles network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const out = await fetchLogoDevEmployerDescribe("a.com");
    expect(out.blocked).toContain("unavailable");
    vi.unstubAllGlobals();
  });
});
