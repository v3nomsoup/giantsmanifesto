import { describe, expect, it } from 'vitest';
import { clientIp } from '../../src/lib/security/client-ip';

const req = (xff?: string) =>
  new Request('http://localhost/', xff ? { headers: { 'x-forwarded-for': xff } } : undefined);

describe('clientIp', () => {
  it('ignores X-Forwarded-For when the proxy is not trusted', () => {
    expect(clientIp(req('1.1.1.1, 2.2.2.2'), '9.9.9.9', false)).toBe('9.9.9.9');
  });

  it('uses the rightmost X-Forwarded-For entry behind a trusted proxy', () => {
    expect(clientIp(req('1.1.1.1, 2.2.2.2'), '9.9.9.9', true)).toBe('2.2.2.2');
  });

  it('falls back to the socket address without the header', () => {
    expect(clientIp(req(), '9.9.9.9', true)).toBe('9.9.9.9');
  });

  it('falls back to the socket address when the header is blank', () => {
    expect(clientIp(req(' , '), '9.9.9.9', true)).toBe('9.9.9.9');
  });
});
