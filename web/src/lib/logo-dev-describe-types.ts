export type EmployerBrandPayload = {
  source: "logo.dev";
  /** True when only the Logo.dev image CDN is available (no Describe / secret key). */
  partial?: boolean;
  name: string;
  domain: string;
  description: string | null;
  indexed_at: string | null;
  socials: Record<string, string>;
  /** Prominent brand colors (hex), most prominent first */
  colors_hex: string[];
  /** Official mark from Logo.dev image CDN (publishable token applied server-side). */
  logo_url: string | null;
  /** Optional blurhash from Describe API for instant placeholder. */
  blurhash?: string | null;
};

export type LogoDevDescribeJson =
  | { ok: true; data: EmployerBrandPayload }
  | { ok: false; reason: "not_signed_in" | "bad_domain" | "not_configured" | "upstream"; message: string };
