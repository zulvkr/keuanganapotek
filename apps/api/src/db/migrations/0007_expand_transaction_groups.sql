ALTER TABLE `transaction_group_configs` ADD `label` text;--> statement-breakpoint
ALTER TABLE `transaction_group_configs` ADD `badge_label` text;--> statement-breakpoint
ALTER TABLE `transaction_group_configs` ADD `description` text;--> statement-breakpoint
ALTER TABLE `transaction_group_configs` ADD `badge_class` text;--> statement-breakpoint
ALTER TABLE `transaction_group_configs` ADD `sort_order` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `transaction_group_configs` ADD `is_system` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `users` SET `role` = 'kasir' WHERE `role` = 'asisten';
