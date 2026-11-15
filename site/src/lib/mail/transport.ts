import { createTransport } from 'nodemailer';
import type { Config } from '../config';
import type { SendFn } from './queue';

export function createSend(config: Config): SendFn {
  if (!config.smtp || !config.mailFrom) throw new Error('SMTP is not configured');
  const { host, port, secure, user, password } = config.smtp;
  const transport = createTransport({
    host,
    port,
    secure,
    auth: user ? { user, pass: password } : undefined,
  });
  const from = config.mailFrom;
  return async (mail) => {
    await transport.sendMail({
      from,
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    });
  };
}
