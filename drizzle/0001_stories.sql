CREATE TABLE `stories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`hook` text NOT NULL,
	`action` text NOT NULL,
	`lesson` text NOT NULL,
	`theme` text NOT NULL,
	`tags` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
