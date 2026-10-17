ALTER TABLE `transactions` ADD `idempotency_key` text;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_transactions_idempotency_key` ON `transactions` (`idempotency_key`);
