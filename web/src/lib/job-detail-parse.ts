/** Extract markdown-style or plain bullet lines from a job description. */
export function extractBulletLines(description: string): string[] {
  const out: string[] = [];
  for (const raw of description.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^[-•*]\s+(.+)$|^(\d+)[.)]\s*(.+)$/);
    if (m) out.push((m[1] || m[3] || "").trim());
  }
  return out;
}

/**
 * Split long description text into an overview paragraph and bullet groups.
 * When there are many bullets, the list is split for Responsibilities vs Requirements.
 */
export function parseJobDescriptionSections(description: string | null | undefined): {
  overview: string;
  responsibilities: string[];
  requirements: string[];
} {
  const d = (description || "").trim();
  if (!d) return { overview: "", responsibilities: [], requirements: [] };

  const bullets = extractBulletLines(d);
  const nonBulletLines = d
    .split(/\r?\n/)
    .filter((raw) => {
      const t = raw.trim();
      if (!t) return false;
      return !/^[-•*]\s+/.test(t) && !/^\d+[.)]\s/.test(t);
    })
    .join("\n")
    .trim();

  const overview =
    nonBulletLines.split(/\n\n+/)[0]?.trim() ||
    d.split(/\n\n+/)[0]?.trim() ||
    d.slice(0, 560).trim();

  let responsibilities = [...bullets];
  let requirements: string[] = [];
  if (bullets.length >= 8) {
    const mid = Math.ceil(bullets.length / 2);
    responsibilities = bullets.slice(0, mid);
    requirements = bullets.slice(mid);
  }

  return { overview, responsibilities, requirements };
}
