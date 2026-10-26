ALTER TABLE `transactions` ADD `sort_order` real DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_transactions_date_sort` ON `transactions` (`transaction_date`,`sort_order`);
