export type EmployerBrandPayload = {
  source: "logo.dev";
  name: string;
  domain: string;
  description: string | null;
  indexed_at: string | null;
  socials: Record<string, string>;
  /** Prominent brand colors (hex), most prominent first */
  colors_hex: string[];
};

export type LogoDevDescribeJson =
  | { ok: true; data: EmployerBrandPayload }
  | { ok: false; reason: "not_signed_in" | "bad_domain" | "not_configured" | "upstream"; message: string };
