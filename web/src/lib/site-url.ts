/**
 * Canonical origin for metadata, sitemap, and robots.
 * On Vercel, `VERCEL_URL` is set (no scheme) — use https.
 * Override with `NEXT_PUBLIC_SITE_URL` when you use a custom domain.
 */
export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}
