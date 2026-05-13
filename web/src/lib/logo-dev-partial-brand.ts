/**
 * Helpers when only Logo.dev **publishable** key is set (no Describe / secret).
 * We still return a stable, useful `EmployerBrandPayload` for the job-detail panel.
 */

function titleCaseWords(s: string): string {
  return s
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** Best-effort display label from a registrable domain (not from Logo.dev). */
export function displayBrandNameFromDomain(domain: string): string {
  const d = domain.trim().toLowerCase();
  const parts = d.split(".").filter(Boolean);
  if (parts.length < 2) return titleCaseWords(d.replace(/-/g, " "));

  // foo.co.uk → foo
  if (parts.length >= 3 && parts[parts.length - 1] === "uk" && parts[parts.length - 2] === "co") {
    return titleCaseWords((parts[0] ?? d).replace(/-/g, " "));
  }

  const sld = parts[parts.length - 2] ?? parts[0] ?? d;
  return titleCaseWords(String(sld).replace(/-/g, " "));
}

const HEURISTIC_ACCENTS = ["#2563eb", "#0891b2", "#059669", "#7c3aed", "#c026d3", "#dc2626"] as const;

/** Deterministic accent + neutral slate for partial UI (not Logo.dev brand kit). */
export function heuristicBrandPaletteHex(domain: string): string[] {
  let h = 0;
  for (let i = 0; i < domain.length; i++) {
    h = (h * 31 + domain.charCodeAt(i)) >>> 0;
  }
  const accent = HEURISTIC_ACCENTS[h % HEURISTIC_ACCENTS.length]!;
  return [accent, "#64748b"];
}

export function buildPartialEmployerDescription(
  domain: string,
  displayName: string,
  opts?: { hasLogoUrl?: boolean },
): string {
  const hasLogo = opts?.hasLogoUrl !== false;
  const lines = [
    hasLogo
      ? `Official logo from the Logo.dev image CDN for ${displayName} (${domain}).`
      : `No Logo.dev image is available yet for ${displayName} (${domain}) — Describe returned 404 for this domain and no publishable CDN key is configured on this deployment.`,
    "Long-form company description, verified brand colours, and social links come from the Logo.dev Describe API. Set LOGO_DEV_SECRET_KEY on your Next.js server (never as NEXT_PUBLIC_*) to load that data.",
    "The two colour chips below are a local heuristic (domain hash) for UI balance only — they are not from Logo.dev.",
  ];
  return lines.join(" ");
}
