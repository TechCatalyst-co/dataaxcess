ALTER TABLE `sessions` ADD `last_activity_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE `sessions` ADD `ended_at` datetime;--> statement-breakpoint
ALTER TABLE `invoices` ADD `created_by_user_id` int;--> statement-breakpoint
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `invoices_created_by_user_id_idx` ON `invoices` (`created_by_user_id`);
