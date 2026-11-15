/**
 * Key for per-client limits. Behind a trusted proxy the proxy appends the address it saw to
 * `X-Forwarded-For`, so the rightmost entry is the only one a client cannot choose. The
 * leftmost entries are client-supplied and must never be used as a key.
 */
export function clientIp(request: Request, clientAddress: string, trustProxy: boolean): string {
  if (!trustProxy) return clientAddress;
  const parts = (request.headers.get('x-forwarded-for') ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.at(-1) ?? clientAddress;
}
