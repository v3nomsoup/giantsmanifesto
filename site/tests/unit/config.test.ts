import { describe, expect, it } from 'vitest';
import { readConfig, signingEnabled } from '../../src/lib/config';

describe('readConfig', () => {
  it('uses defaults for an empty environment', () => {
    const config = readConfig({});
    expect(config.dataDir).toBe('./data');
    expect(config.mailMaxPerHour).toBe(60);
    expect(config.altchaMaxNumber).toBe(100000);
    expect(config.rateLimitMax).toBe(10);
    expect(config.trustProxy).toBe(false);
    expect(config.smtp).toBeUndefined();
  });

  it('parses SMTP port and secure flag', () => {
    const config = readConfig({ SMTP_HOST: 'mail.test', SMTP_PORT: '465', SMTP_SECURE: 'true' });
    expect(config.smtp).toMatchObject({ host: 'mail.test', port: 465, secure: true });
  });

  it('reads RATE_LIMIT_MAX and TRUST_PROXY', () => {
    const config = readConfig({ RATE_LIMIT_MAX: '1000', TRUST_PROXY: '1' });
    expect(config.rateLimitMax).toBe(1000);
    expect(config.trustProxy).toBe(true);
  });

  it('throws naming the variable for invalid numbers', () => {
    expect(() => readConfig({ MAIL_MAX_PER_HOUR: 'abc' })).toThrow(/MAIL_MAX_PER_HOUR/);
    expect(() => readConfig({ RATE_LIMIT_MAX: 'x' })).toThrow(/RATE_LIMIT_MAX/);
  });
});

describe('signingEnabled', () => {
  const full = { SMTP_HOST: 'mail.test', MAIL_FROM: 'a@b.test', SESSION_SECRET: 's' };

  it('is true when SMTP_HOST, MAIL_FROM and SESSION_SECRET are set', () => {
    expect(signingEnabled(readConfig(full))).toBe(true);
  });

  it.each(Object.keys(full))('is false without %s', (key) => {
    const env: Record<string, string> = { ...full };
    delete env[key];
    expect(signingEnabled(readConfig(env))).toBe(false);
  });
});
