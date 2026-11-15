export interface Config {
  siteUrl: string;
  dataDir: string;
  sessionSecret?: string;
  smtp?: { host: string; port: number; secure: boolean; user?: string; password?: string };
  mailFrom?: string;
  mailMaxPerHour: number;
  rateLimitMax: number;
  trustProxy: boolean;
  altchaMaxNumber: number;
}

function int(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  if (!/^\d+$/.test(raw.trim())) throw new Error(`${name} must be a non-negative integer`);
  return Number(raw.trim());
}

const flag = (value: string | undefined) => value === '1' || value === 'true';

export function readConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    siteUrl: env.SITE_URL || 'https://giantsmanifesto.org',
    dataDir: env.DATA_DIR || './data',
    sessionSecret: env.SESSION_SECRET || undefined,
    smtp: env.SMTP_HOST
      ? {
          host: env.SMTP_HOST,
          port: int(env, 'SMTP_PORT', 587),
          secure: flag(env.SMTP_SECURE),
          user: env.SMTP_USER || undefined,
          password: env.SMTP_PASSWORD || undefined,
        }
      : undefined,
    mailFrom: env.MAIL_FROM || undefined,
    mailMaxPerHour: int(env, 'MAIL_MAX_PER_HOUR', 60),
    rateLimitMax: int(env, 'RATE_LIMIT_MAX', 10),
    trustProxy: flag(env.TRUST_PROXY),
    altchaMaxNumber: int(env, 'ALTCHA_MAX_NUMBER', 100000),
  };
}

export function signingEnabled(config: Config): boolean {
  return Boolean(config.smtp && config.mailFrom && config.sessionSecret);
}
