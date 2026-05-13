import { describe, expect, it, vi } from "vitest";

import {
  buildClientLogoDevImageUrl,
  handleLogoDevDescribeGET,
  sanitizeEmployerDomain,
  trustedDescribeLogoUrl,
} from "./logo-dev-describe-handler";

function req(url: string) {
  return new Request(url);
}

async function readJson(res: Response) {
  return (await res.json()) as Record<string, unknown>;
}

describe("sanitizeEmployerDomain", () => {
  it.each([
    [null, null],
    ["", null],
    ["  ", null],
    ["notld", null],
    ["..bad.com", null],
    [".bad.com", null],
    ["bad..com", null],
    ["bad.com.", null],
    ["https://www.Stripe.com/jobs", "stripe.com"],
    ["WWW.EXAMPLE.ORG", "example.org"],
    ["sub.example.co.uk", "sub.example.co.uk"],
  ])("%s → %s", (input, expected) => {
    expect(sanitizeEmployerDomain(input)).toBe(expected);
  });
});

describe("trustedDescribeLogoUrl", () => {
  it("accepts https img.logo.dev only", () => {
    expect(trustedDescribeLogoUrl("https://img.logo.dev/stripe.com?token=pk_x")).toContain("img.logo.dev");
    expect(trustedDescribeLogoUrl("http://img.logo.dev/x")).toBeNull();
    expect(trustedDescribeLogoUrl("https://evil.com/img.logo.dev")).toBeNull();
    expect(trustedDescribeLogoUrl("")).toBeNull();
  });
});

describe("buildClientLogoDevImageUrl", () => {
  it("builds CDN URL when publishable key present", () => {
    const u = buildClientLogoDevImageUrl("stripe.com", { NEXT_PUBLIC_LOGO_DEV_KEY: "pk_test_1" });
    expect(u).toBe("https://img.logo.dev/stripe.com?token=pk_test_1&size=128");
  });

  it("prefers NEXT_PUBLIC_LOGO_DEV_KEY over PUBLISHABLE alias", () => {
    const u = buildClientLogoDevImageUrl("a.com", {
      NEXT_PUBLIC_LOGO_DEV_KEY: "pk_a",
      NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY: "pk_b",
    });
    expect(u).toContain("token=pk_a");
  });

  it("uses alias when primary empty", () => {
    const u = buildClientLogoDevImageUrl("a.com", { NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY: "pk_b" });
    expect(u).toContain("token=pk_b");
  });

  it("returns null without key", () => {
    expect(buildClientLogoDevImageUrl("a.com", {})).toBeNull();
  });
});

describe("handleLogoDevDescribeGET", () => {
  const envPk = { NEXT_PUBLIC_LOGO_DEV_KEY: "pk_test_logo" };
  const envSecret = { LOGO_DEV_SECRET_KEY: "sk_test_describe" };

  it("401 when not signed in", async () => {
    const res = await handleLogoDevDescribeGET(req("http://x/api?domain=stripe.com"), {
      userId: null,
      env: { ...envPk, ...envSecret },
      fetch: vi.fn(),
    });
    expect(res.status).toBe(401);
    const j = await readJson(res);
    expect(j.ok).toBe(false);
    expect(j.reason).toBe("not_signed_in");
  });

  it("400 when domain missing or invalid", async () => {
    const deps = { userId: "u1", env: envPk, fetch: vi.fn() };
    const r1 = await handleLogoDevDescribeGET(req("http://x/api"), deps);
    expect(r1.status).toBe(400);
    const r2 = await handleLogoDevDescribeGET(req("http://x/api?domain=nodots"), deps);
    expect(r2.status).toBe(400);
  });

  it("not_configured when no secret and no publishable key", async () => {
    const res = await handleLogoDevDescribeGET(req("http://x/api?domain=stripe.com"), {
      userId: "u1",
      env: {},
      fetch: vi.fn(),
    });
    expect(res.status).toBe(200);
    const j = await readJson(res);
    expect(j.ok).toBe(false);
    expect(j.reason).toBe("not_configured");
  });

  it("partial publishable_key_only when only publishable key", async () => {
    const res = await handleLogoDevDescribeGET(req("http://x/api?domain=stripe.com"), {
      userId: "u1",
      env: envPk,
      fetch: vi.fn(),
    });
    expect(res.status).toBe(200);
    const j = await readJson(res);
    expect(j.ok).toBe(true);
    const data = j.data as Record<string, unknown>;
    expect(data.partial).toBe(true);
    expect(data.partial_why).toBe("publishable_key_only");
    expect(data.logo_url).toContain("img.logo.dev");
    expect(data.logo_url).toContain("token=pk_test_logo");
    expect(data.partial_palette_heuristic).toBe(true);
  });

  it("describe 404 → partial describe_404", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => '{"message":"not found"}',
    });
    const res = await handleLogoDevDescribeGET(req("http://x/api?domain=unknown-brand-zz.com"), {
      userId: "u1",
      env: { ...envSecret },
      fetch: fetchFn,
    });
    expect(res.status).toBe(200);
    const j = await readJson(res);
    expect(j.ok).toBe(true);
    const data = j.data as Record<string, unknown>;
    expect(data.partial_why).toBe("describe_404");
    expect(data.logo_url).toBeNull();
    expect(fetchFn).toHaveBeenCalledWith(
      "https://api.logo.dev/describe/unknown-brand-zz.com",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("describe 404 with publishable key keeps CDN logo in partial", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => "{}",
    });
    const res = await handleLogoDevDescribeGET(req("http://x/api?domain=stripe.com"), {
      userId: "u1",
      env: { ...envPk, ...envSecret },
      fetch: fetchFn,
    });
    const j = await readJson(res);
    expect(j.ok).toBe(true);
    const data = j.data as Record<string, unknown>;
    expect(data.partial_why).toBe("describe_404");
    expect(String(data.logo_url)).toContain("img.logo.dev");
  });

  it("describe 500 → upstream 502", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => '{"message":"boom"}',
    });
    const res = await handleLogoDevDescribeGET(req("http://x/api?domain=stripe.com"), {
      userId: "u1",
      env: { ...envSecret },
      fetch: fetchFn,
    });
    expect(res.status).toBe(502);
    const j = await readJson(res);
    expect(j.ok).toBe(false);
    expect(j.reason).toBe("upstream");
    expect(j.message).toBe("boom");
  });

  it("describe 200 with full payload", async () => {
    const body = JSON.stringify({
      name: "Stripe",
      domain: "stripe.com",
      description: "Payments infra.",
      indexed_at: "2025-01-01T00:00:00Z",
      socials: { twitter: "https://x.com/stripe" },
      colors: [{ hex: "#635BFF" }],
      blurhash: "LEHV6nWB2yk8pyo0adR*.7kCMdnj",
    });
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => body,
    });
    const res = await handleLogoDevDescribeGET(req("http://x/api?domain=stripe.com"), {
      userId: "u1",
      env: { ...envPk, ...envSecret },
      fetch: fetchFn,
    });
    expect(res.status).toBe(200);
    const j = await readJson(res);
    expect(j.ok).toBe(true);
    const data = j.data as Record<string, unknown>;
    expect(data.partial).toBe(false);
    expect(data.name).toBe("Stripe");
    expect(data.description).toBe("Payments infra.");
    expect(data.colors_hex).toEqual(["#635BFF"]);
    expect((data.socials as Record<string, string>).twitter).toContain("stripe");
    expect(String(data.logo_url)).toContain("img.logo.dev");
  });

  it("describe 200 uses Describe logo when no publishable key", async () => {
    const describeLogo = "https://img.logo.dev/stripe.com?token=pk_from_describe&size=128";
    const body = JSON.stringify({
      name: "Stripe",
      domain: "stripe.com",
      logo: describeLogo,
    });
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => body,
    });
    const res = await handleLogoDevDescribeGET(req("http://x/api?domain=stripe.com"), {
      userId: "u1",
      env: { ...envSecret },
      fetch: fetchFn,
    });
    const j = await readJson(res);
    expect(j.ok).toBe(true);
    const data = j.data as Record<string, unknown>;
    expect(data.logo_url).toBe(describeLogo);
  });

  it("describe 200 rejects non-img logo host", async () => {
    const body = JSON.stringify({
      name: "Co",
      domain: "co.com",
      logo: "https://evil.example/phish.png",
    });
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => body,
    });
    const res = await handleLogoDevDescribeGET(req("http://x/api?domain=co.com"), {
      userId: "u1",
      env: { ...envSecret },
      fetch: fetchFn,
    });
    const j = await readJson(res);
    const data = j.data as Record<string, unknown>;
    expect(data.logo_url).toBeNull();
  });

  it("describe 200 invalid JSON body → 502", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "not-json",
    });
    const res = await handleLogoDevDescribeGET(req("http://x/api?domain=stripe.com"), {
      userId: "u1",
      env: { ...envSecret },
      fetch: fetchFn,
    });
    expect(res.status).toBe(502);
    const j = await readJson(res);
    expect(j.message).toContain("invalid");
  });

  it("describe 200 JSON array → 502", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "[]",
    });
    const res = await handleLogoDevDescribeGET(req("http://x/api?domain=stripe.com"), {
      userId: "u1",
      env: { ...envSecret },
      fetch: fetchFn,
    });
    expect(res.status).toBe(502);
  });

  it("fetch throws → 502", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error("network down"));
    const res = await handleLogoDevDescribeGET(req("http://x/api?domain=stripe.com"), {
      userId: "u1",
      env: { ...envSecret },
      fetch: fetchFn,
    });
    expect(res.status).toBe(502);
    const j = await readJson(res);
    expect(j.message).toBe("network down");
  });
});
