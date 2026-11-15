CREATE TABLE `email_tokens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`token_hash` text NOT NULL,
	`purpose` text NOT NULL,
	`payload` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `email_tokens_token_hash_unique` ON `email_tokens` (`token_hash`);--> statement-breakpoint
CREATE TABLE `mail_queue` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`to` text NOT NULL,
	`subject` text NOT NULL,
	`text` text NOT NULL,
	`html` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`send_after` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `signatures` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` integer NOT NULL,
	`display_name` text NOT NULL,
	`affiliation` text DEFAULT '' NOT NULL,
	`country` text DEFAULT '' NOT NULL,
	`provider` text NOT NULL,
	`provider_subject` text NOT NULL,
	`profile_url` text DEFAULT '' NOT NULL,
	`manifesto_version` text NOT NULL,
	`consent_at` integer NOT NULL,
	`hidden` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `signatures_provider_subject` ON `signatures` (`provider`,`provider_subject`);--> statement-breakpoint
CREATE INDEX `signatures_created_at` ON `signatures` (`created_at`);