import { createTransport } from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import type { Config } from '../config';
import type { SendFn } from './queue';

const TIMEOUT_MS = 20_000;

export function transportOptions(config: Config): SMTPTransport.Options {
  if (!config.smtp) throw new Error('SMTP is not configured');
  const { host, port, secure, user, password } = config.smtp;
  return {
    host,
    port,
    secure,
    // Credentials never go over an unencrypted connection: without implicit TLS, STARTTLS
    // is required as soon as we authenticate.
    requireTLS: !secure && Boolean(user),
    auth: user ? { user, pass: password } : undefined,
    // A hanging server must not block the worker (it skips ticks while a run is going).
    connectionTimeout: TIMEOUT_MS,
    greetingTimeout: TIMEOUT_MS,
    socketTimeout: TIMEOUT_MS,
  };
}

export function createSend(config: Config): SendFn {
  if (!config.mailFrom) throw new Error('SMTP is not configured');
  const transport = createTransport(transportOptions(config));
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
