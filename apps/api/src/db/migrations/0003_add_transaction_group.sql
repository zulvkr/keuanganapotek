ALTER TABLE `transaction_types` ADD `group` text NOT NULL DEFAULT 'tidak_terkategori';--> statement-breakpoint
ALTER TABLE `transaction_types` ADD `pos_sync_category` text;--> statement-breakpoint
CREATE INDEX `idx_transaction_types_group` ON `transaction_types` (`group`);
