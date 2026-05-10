/** Build WebSocket origin from `NEXT_PUBLIC_API_BASE_URL` (http/https → ws/wss). */
export function wsBaseFromHttp(httpUrl: string): string {
  if (httpUrl.startsWith("https://")) return `wss://${httpUrl.slice("https://".length)}`;
  if (httpUrl.startsWith("http://")) return `ws://${httpUrl.slice("http://".length)}`;
  return httpUrl;
}
