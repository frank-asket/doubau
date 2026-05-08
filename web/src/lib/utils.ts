export function cn(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(" ");
}
