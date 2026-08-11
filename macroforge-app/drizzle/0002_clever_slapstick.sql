CREATE TABLE `batch_waitlists` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`shop_domain` varchar(255) NOT NULL,
	`product_id` varchar(255) NOT NULL,
	`product_title` varchar(255) NOT NULL,
	`customer_email` varchar(255) NOT NULL,
	`status` enum('waiting','notified','fulfilled') NOT NULL DEFAULT 'waiting',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `batch_waitlists_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `product_batches` DROP FOREIGN KEY `product_batches_product_profile_id_product_meta_profiles_id_fk`;
--> statement-breakpoint
ALTER TABLE `product_batches` ADD `product_id` varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE `product_batches` ADD `initial_quantity` int NOT NULL;--> statement-breakpoint
ALTER TABLE `product_batches` ADD `remaining_quantity` int NOT NULL;--> statement-breakpoint
ALTER TABLE `product_batches` ADD `production_date` timestamp DEFAULT (now()) NOT NULL;--> statement-breakpoint
ALTER TABLE `product_batches` ADD `expiry_date` timestamp;--> statement-breakpoint
ALTER TABLE `product_batches` ADD `is_active` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `product_batches` DROP COLUMN `product_profile_id`;--> statement-breakpoint
ALTER TABLE `product_batches` DROP COLUMN `quantity`;--> statement-breakpoint
ALTER TABLE `product_batches` DROP COLUMN `prepared_date`;--> statement-breakpoint
ALTER TABLE `product_batches` DROP COLUMN `expiration_date`;