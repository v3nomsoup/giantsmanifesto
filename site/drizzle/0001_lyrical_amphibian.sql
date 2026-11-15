ALTER TABLE `email_tokens` ADD `email_hash` text;--> statement-breakpoint
CREATE INDEX `email_tokens_cooldown` ON `email_tokens` (`purpose`,`email_hash`,`created_at`);