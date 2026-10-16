CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`parent_id` text,
	`classification` text NOT NULL,
	`normal_balance` text NOT NULL,
	`level` integer DEFAULT 1 NOT NULL,
	`is_group` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT '(datetime(''now''))' NOT NULL,
	`updated_at` text DEFAULT '(datetime(''now''))' NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_code_unique` ON `accounts` (`code`);--> statement-breakpoint
CREATE INDEX `idx_accounts_code` ON `accounts` (`code`);--> statement-breakpoint
CREATE INDEX `idx_accounts_parent` ON `accounts` (`parent_id`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`action` text NOT NULL,
	`actor` text NOT NULL,
	`before_data` text,
	`after_data` text,
	`occurred_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_audit_logs_entity` ON `audit_logs` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `idx_audit_logs_occurred_at` ON `audit_logs` (`occurred_at`);--> statement-breakpoint
CREATE TABLE `journal_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`journal_id` text NOT NULL,
	`line_number` integer NOT NULL,
	`account_id` text NOT NULL,
	`description` text,
	`debit` integer DEFAULT 0 NOT NULL,
	`credit` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`journal_id`) REFERENCES `journals`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_journal_lines_account_id` ON `journal_lines` (`account_id`);--> statement-breakpoint
CREATE INDEX `idx_journal_lines_journal_id` ON `journal_lines` (`journal_id`);--> statement-breakpoint
CREATE TABLE `journals` (
	`id` text PRIMARY KEY NOT NULL,
	`journal_no` text NOT NULL,
	`entry_date` text NOT NULL,
	`reference_no` text,
	`source_module` text NOT NULL,
	`source_id` text,
	`memo` text,
	`created_by` text,
	`created_at` text DEFAULT '(datetime(''now''))' NOT NULL,
	`updated_at` text DEFAULT '(datetime(''now''))' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `journals_journal_no_unique` ON `journals` (`journal_no`);--> statement-breakpoint
CREATE TABLE `opening_balances` (
	`id` text PRIMARY KEY NOT NULL,
	`cutoff_date` text NOT NULL,
	`account_id` text NOT NULL,
	`debit_amount` integer DEFAULT 0 NOT NULL,
	`credit_amount` integer DEFAULT 0 NOT NULL,
	`notes` text,
	`is_locked` integer DEFAULT false NOT NULL,
	`created_by` text,
	`created_at` text DEFAULT '(datetime(''now''))' NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_opening_balances_cutoff_account` ON `opening_balances` (`cutoff_date`,`account_id`);--> statement-breakpoint
CREATE TABLE `transaction_types` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`debit_account_id` text NOT NULL,
	`credit_account_id` text NOT NULL,
	`description` text,
	`metadata_schema` text DEFAULT '[]' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT '(datetime(''now''))' NOT NULL,
	`updated_at` text DEFAULT '(datetime(''now''))' NOT NULL,
	FOREIGN KEY (`debit_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`credit_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `transaction_types_code_unique` ON `transaction_types` (`code`);--> statement-breakpoint
CREATE INDEX `idx_transaction_types_code` ON `transaction_types` (`code`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`transaction_date` text NOT NULL,
	`transaction_type_id` text NOT NULL,
	`amount` integer DEFAULT 0 NOT NULL,
	`debit_account_id` text NOT NULL,
	`credit_account_id` text NOT NULL,
	`memo` text,
	`metadata` text DEFAULT '{}' NOT NULL,
	`journal_id` text,
	`created_at` text DEFAULT '(datetime(''now''))' NOT NULL,
	`updated_at` text DEFAULT '(datetime(''now''))' NOT NULL,
	FOREIGN KEY (`transaction_type_id`) REFERENCES `transaction_types`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`debit_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`credit_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`journal_id`) REFERENCES `journals`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_transactions_date` ON `transactions` (`transaction_date`);--> statement-breakpoint
CREATE INDEX `idx_transactions_type` ON `transactions` (`transaction_type_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`salt` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`allowed_coa_codes` text DEFAULT '[]' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT '(datetime(''now''))' NOT NULL,
	`updated_at` text DEFAULT '(datetime(''now''))' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE INDEX `idx_users_username` ON `users` (`username`);