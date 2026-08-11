CREATE TABLE `activity_logs` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`shop_domain` varchar(255) NOT NULL,
	`action_type` varchar(50) NOT NULL,
	`description` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activity_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `batch_losses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shop_domain` varchar(255) NOT NULL,
	`product_profile_id` int NOT NULL,
	`batch_number` varchar(100) NOT NULL,
	`quantity_lost` int NOT NULL,
	`prepared_date` varchar(50) NOT NULL,
	`expiration_date` varchar(50) NOT NULL,
	`reason` varchar(50) NOT NULL,
	`archived_at` timestamp DEFAULT (now()),
	CONSTRAINT `batch_losses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_batches` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`shop_domain` varchar(255) NOT NULL,
	`product_profile_id` int NOT NULL,
	`batch_number` varchar(100) NOT NULL,
	`quantity` int NOT NULL,
	`prepared_date` varchar(50) NOT NULL,
	`expiration_date` varchar(50) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `product_batches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_meta_profiles` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`shop_domain` varchar(255) NOT NULL,
	`shopify_product_id` varchar(100),
	`title` varchar(100) NOT NULL,
	`handle` varchar(150),
	`image_url` varchar(500),
	`diet_type` varchar(50) NOT NULL,
	`protein_grams` int NOT NULL,
	`carb_grams` int NOT NULL,
	`fat_grams` int NOT NULL,
	`calories` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `product_meta_profiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `recommendation_rules` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`shop_domain` varchar(255) NOT NULL,
	`rule_name` varchar(100) NOT NULL,
	`target_diet` varchar(50) NOT NULL,
	`protein_weight` int NOT NULL DEFAULT 50,
	`is_priority_active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `recommendation_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shopify_sessions` (
	`id` varchar(255) NOT NULL,
	`shop` varchar(255) NOT NULL,
	`state` varchar(255) NOT NULL,
	`isOnline` boolean NOT NULL DEFAULT false,
	`scope` text,
	`expires` bigint,
	`accessToken` text,
	`userId` bigint,
	`firstName` varchar(255),
	`lastName` varchar(255),
	`email` varchar(255),
	`accountOwner` boolean DEFAULT false,
	`locale` varchar(255),
	`collaborator` boolean DEFAULT false,
	`emailVerified` boolean DEFAULT false,
	`refreshToken` text,
	`refreshTokenExpires` bigint,
	CONSTRAINT `shopify_sessions_id` PRIMARY KEY(`id`)
);
