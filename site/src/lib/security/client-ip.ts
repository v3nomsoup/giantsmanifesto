/**
 * Limiter key for an address. One IPv6 subscriber controls a whole /64, so IPv6 addresses are
 * keyed by their first four groups; IPv4 and IPv4-mapped IPv6 are used as they are.
 */
export function limiterKey(ip: string): string {
  const addr = ip.split('%')[0];
  if (!addr.includes(':') || addr.includes('.')) return ip;
  const [head, tail] = addr.split('::');
  const headGroups = head ? head.split(':') : [];
  const tailGroups = tail === undefined ? [] : tail ? tail.split(':') : [];
  const missing = 8 - headGroups.length - tailGroups.length;
  if (tail === undefined ? headGroups.length !== 8 : missing < 1) return ip;
  const groups = [
    ...headGroups,
    ...Array<string>(tail === undefined ? 0 : missing).fill('0'),
    ...tailGroups,
  ];
  const prefix = groups.slice(0, 4).map((g) => Number.parseInt(g, 16));
  if (prefix.some(Number.isNaN)) return ip;
  return `${prefix.map((n) => n.toString(16)).join(':')}::/64`;
}

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
