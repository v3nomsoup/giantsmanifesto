import { describe, expect, it } from 'vitest';
import { readConfig } from '../../src/lib/config';
import { transportOptions } from '../../src/lib/mail/transport';

const base = { SMTP_HOST: 'mail.test', MAIL_FROM: 'a@b.test' };

describe('transportOptions', () => {
  it('requires STARTTLS when authenticating on a plain port', () => {
    const options = transportOptions(
      readConfig({ ...base, SMTP_PORT: '587', SMTP_USER: 'u', SMTP_PASSWORD: 'p' }),
    );
    expect(options).toMatchObject({
      host: 'mail.test',
      port: 587,
      secure: false,
      requireTLS: true,
      auth: { user: 'u', pass: 'p' },
    });
  });

  it('does not ask for STARTTLS on an implicit-TLS port', () => {
    const options = transportOptions(
      readConfig({ ...base, SMTP_PORT: '465', SMTP_SECURE: 'true', SMTP_USER: 'u' }),
    );
    expect(options).toMatchObject({ secure: true, requireTLS: false });
  });

  it('does not ask for STARTTLS without credentials (e.g. Mailpit)', () => {
    const options = transportOptions(readConfig({ ...base, SMTP_PORT: '1025' }));
    expect(options).toMatchObject({ secure: false, requireTLS: false, auth: undefined });
  });

  it('sets 20-second connection, greeting and socket timeouts', () => {
    const options = transportOptions(readConfig(base));
    expect(options).toMatchObject({
      connectionTimeout: 20_000,
      greetingTimeout: 20_000,
      socketTimeout: 20_000,
    });
  });

  it('throws without SMTP settings', () => {
    expect(() => transportOptions(readConfig({}))).toThrow('SMTP is not configured');
  });
});
