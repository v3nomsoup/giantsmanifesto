import { describe, expect, it } from 'vitest';
import { clientIp, limiterKey } from '../../src/lib/security/client-ip';

const req = (xff?: string) =>
  new Request('http://localhost/', xff ? { headers: { 'x-forwarded-for': xff } } : undefined);

describe('limiterKey', () => {
  it('groups IPv6 addresses by /64', () => {
    const a = limiterKey('2001:db8:1:2:aaaa:bbbb:cccc:dddd');
    expect(limiterKey('2001:0db8:0001:0002::1')).toBe(a);
    expect(limiterKey('2001:db8:1:2::')).toBe(a);
    expect(limiterKey('2001:db8:1:3::1')).not.toBe(a);
    expect(limiterKey('2001:db8::1')).toBe(limiterKey('2001:db8:0:0:5::9'));
    expect(limiterKey('::1')).toBe(limiterKey('0:0:0:0::2'));
  });

  it('leaves IPv4 and IPv4-mapped IPv6 unchanged', () => {
    expect(limiterKey('203.0.113.7')).toBe('203.0.113.7');
    expect(limiterKey('::ffff:203.0.113.7')).toBe('::ffff:203.0.113.7');
  });

  it('leaves unparsable values unchanged', () => {
    expect(limiterKey('unknown')).toBe('unknown');
  });
});

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
