import { describe, expect, it } from 'vitest';
import { t } from '../../src/i18n';
import { signConfirmMail, withdrawMail } from '../../src/lib/mail/templates';

const link = 'https://x/en/sign/confirm?token=abc';

describe('mail templates', () => {
  it('builds the sign confirmation mail', () => {
    const mail = signConfirmMail('en', 'a@b.de', link, '<Ada>');
    expect(mail.to).toBe('a@b.de');
    expect(mail.subject).toBe(t('en', 'mail.signConfirm.subject'));
    expect(mail.subject).not.toBe('');
    expect(mail.text).toContain(link);
    expect(mail.text).toContain('<Ada>');
    expect(mail.html).toContain(link);
    expect(mail.html).toContain('&lt;Ada&gt;');
    expect(mail.html).not.toContain('<Ada>');
  });

  it('builds the withdraw mail', () => {
    const mail = withdrawMail('en', 'a@b.de', link);
    expect(mail.subject).toBe(t('en', 'mail.withdraw.subject'));
    expect(mail.text).toContain(link);
    expect(mail.html).toContain(link);
  });

  it('escapes the link in HTML', () => {
    const mail = withdrawMail('en', 'a@b.de', 'https://x/?a=1&b="2"');
    expect(mail.html).toContain('a=1&amp;b=&quot;2&quot;');
  });
});
