import { type Locale, t } from '../../i18n';
import type { OutgoingMail } from './queue';

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

/** `before` paragraphs, then the link, then `after` paragraphs and the sign-off. */
function build(
  to: string,
  subject: string,
  before: string[],
  link: string,
  after: string[],
  signOff: string,
): OutgoingMail {
  const text = [...before, link, ...after, signOff].join('\n\n');
  const html = [
    ...before.map((line) => `<p>${escapeHtml(line)}</p>`),
    `<p><a href="${escapeHtml(link)}">${escapeHtml(link)}</a></p>`,
    ...after.map((line) => `<p>${escapeHtml(line)}</p>`),
    `<p>${escapeHtml(signOff)}</p>`,
  ].join('\n');
  return { to, subject, text, html };
}

/** The greeting has no name: it was typed by whoever filled the form, not yet confirmed. */
export function signConfirmMail(lang: Locale, to: string, link: string): OutgoingMail {
  return build(
    to,
    t(lang, 'mail.signConfirm.subject'),
    [t(lang, 'mail.greeting'), t(lang, 'mail.signConfirm.intro')],
    link,
    [t(lang, 'mail.validity'), t(lang, 'mail.signConfirm.ignore')],
    t(lang, 'mail.signOff'),
  );
}

export function withdrawMail(lang: Locale, to: string, link: string): OutgoingMail {
  return build(
    to,
    t(lang, 'mail.withdraw.subject'),
    [t(lang, 'mail.withdraw.intro')],
    link,
    [t(lang, 'mail.validity'), t(lang, 'mail.withdraw.ignore')],
    t(lang, 'mail.signOff'),
  );
}
