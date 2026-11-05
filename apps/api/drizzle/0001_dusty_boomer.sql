ALTER TABLE `users` ADD `email` varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `full_name` varchar(100) NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `status` enum('active','suspended','invited') DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_email_unique` UNIQUE(`email`);