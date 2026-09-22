CREATE TABLE `extensions` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`version` text NOT NULL,
	`lang` text DEFAULT 'en' NOT NULL,
	`base_url` text NOT NULL,
	`manifest` text,
	`code` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`source_url` text,
	`installed_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
