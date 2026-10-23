CREATE TABLE IF NOT EXISTS `transaction_group_configs` (
	`group` text PRIMARY KEY NOT NULL,
	`metadata_schema` text NOT NULL DEFAULT '[]',
	`updated_at` text NOT NULL DEFAULT (datetime('now'))
);
