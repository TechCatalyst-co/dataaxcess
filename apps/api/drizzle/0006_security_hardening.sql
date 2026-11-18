-- Migration 0006: Security hardening

ALTER TABLE `users` ADD `failed_login_attempts` int NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `users` ADD `locked_until` datetime;--> statement-breakpoint
ALTER TABLE `users` ADD `deleted_at` datetime;--> statement-breakpoint
