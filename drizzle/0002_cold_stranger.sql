CREATE TABLE `__new_budgets` (
	`owner_id` text DEFAULT '' NOT NULL,
	`category` text NOT NULL,
	`amount` integer NOT NULL,
	`demo` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`owner_id`, `category`)
);
--> statement-breakpoint
INSERT INTO `__new_budgets`("owner_id", "category", "amount", "demo") SELECT '', "category", "amount", "demo" FROM `budgets`;--> statement-breakpoint
DROP TABLE `budgets`;--> statement-breakpoint
ALTER TABLE `__new_budgets` RENAME TO `budgets`;--> statement-breakpoint
CREATE TABLE `__new_settings` (
	`owner_id` text DEFAULT '' NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	PRIMARY KEY(`owner_id`, `key`)
);
--> statement-breakpoint
INSERT INTO `__new_settings`("owner_id", "key", "value") SELECT '', "key", "value" FROM `settings`;--> statement-breakpoint
DROP TABLE `settings`;--> statement-breakpoint
ALTER TABLE `__new_settings` RENAME TO `settings`;--> statement-breakpoint
ALTER TABLE `goals` ADD `owner_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_goals_owner` ON `goals` (`owner_id`);--> statement-breakpoint
ALTER TABLE `transactions` ADD `owner_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_transactions_owner_date` ON `transactions` (`owner_id`,`date`);