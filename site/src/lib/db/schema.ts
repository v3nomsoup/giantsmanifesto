import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

// Timestamps are integer milliseconds since the epoch.
export const signatures = sqliteTable(
  'signatures',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    createdAt: integer('created_at').notNull(),
    displayName: text('display_name').notNull(),
    affiliation: text('affiliation').notNull().default(''),
    country: text('country').notNull().default(''),
    provider: text('provider').notNull(),
    providerSubject: text('provider_subject').notNull(),
    profileUrl: text('profile_url').notNull().default(''),
    manifestoVersion: text('manifesto_version').notNull(),
    consentAt: integer('consent_at').notNull(),
    hidden: integer('hidden', { mode: 'boolean' }).notNull().default(false),
  },
  (t) => [
    uniqueIndex('signatures_provider_subject').on(t.provider, t.providerSubject),
    index('signatures_created_at').on(t.createdAt),
  ],
);

export const emailTokens = sqliteTable('email_tokens', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tokenHash: text('token_hash').notNull().unique(),
  purpose: text('purpose').notNull(),
  payload: text('payload').notNull().default('{}'),
  createdAt: integer('created_at').notNull(),
  expiresAt: integer('expires_at').notNull(),
  usedAt: integer('used_at'),
});

export const mailQueue = sqliteTable('mail_queue', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  to: text('to').notNull(),
  subject: text('subject').notNull(),
  text: text('text').notNull(),
  html: text('html').notNull(),
  attempts: integer('attempts').notNull().default(0),
  sendAfter: integer('send_after').notNull(),
  createdAt: integer('created_at').notNull(),
});
