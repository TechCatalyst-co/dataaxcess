CREATE TABLE `invoices` (
	`invoice_number` varchar(50) NOT NULL,
	`vin` char(17) NOT NULL,
	`vehicle_stock` varchar(50),
	`year` int NOT NULL,
	`make` varchar(50) NOT NULL,
	`model` varchar(50) NOT NULL,
	`body_style` varchar(30),
	`country_of_origin` varchar(50),
	`odometer` int,
	`title_status` varchar(30),
	`damage_history` text,
	`sale_date` date,
	`date_of_sale` date,
	`vehicle_price` decimal(10,2),
	`total_sales` decimal(10,2),
	`auction_source` varchar(100),
	`buyer_type` varchar(20),
	`buyer_company` varchar(100),
	`buyer_address` varchar(200),
	`buyer_city` varchar(100),
	`buyer_rfc` varchar(20),
	`data_analyst` varchar(255),
	`source_verification` varchar(50),
	`verified` varchar(10) DEFAULT 'No',
	`report_date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `invoices_invoice_number` PRIMARY KEY(`invoice_number`),
	CONSTRAINT `invoices_vin_unique` UNIQUE(`vin`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` char(64) NOT NULL,
	`user_id` int NOT NULL,
	`expires_at` datetime NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`username` varchar(50) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`role` enum('admin','agent') NOT NULL DEFAULT 'agent',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_username_unique` UNIQUE(`username`)
);
--> statement-breakpoint
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `invoices_year_idx` ON `invoices` (`year`);--> statement-breakpoint
CREATE INDEX `invoices_title_status_idx` ON `invoices` (`title_status`);--> statement-breakpoint
CREATE INDEX `invoices_date_of_sale_idx` ON `invoices` (`date_of_sale`);--> statement-breakpoint
CREATE INDEX `invoices_buyer_type_idx` ON `invoices` (`buyer_type`);--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);