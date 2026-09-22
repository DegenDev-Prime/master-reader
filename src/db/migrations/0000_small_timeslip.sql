CREATE TABLE `authors` (
	`source_id` text NOT NULL,
	`id` text NOT NULL,
	`name` text NOT NULL,
	`url` text,
	`avatar_url` text,
	`bio` text,
	`following` integer,
	`fetched_at` integer,
	PRIMARY KEY(`source_id`, `id`)
);
--> statement-breakpoint
CREATE INDEX `authors_name_idx` ON `authors` (`name`);--> statement-breakpoint
CREATE TABLE `cached_responses` (
	`key` text PRIMARY KEY NOT NULL,
	`source_id` text,
	`status` integer,
	`etag` text,
	`last_modified` text,
	`body` text,
	`fetched_at` integer DEFAULT (unixepoch()) NOT NULL,
	`expires_at` integer
);
--> statement-breakpoint
CREATE INDEX `cached_responses_expires_idx` ON `cached_responses` (`expires_at`);--> statement-breakpoint
CREATE TABLE `categories` (
	`source_id` text NOT NULL,
	`id` text NOT NULL,
	`name` text NOT NULL,
	PRIMARY KEY(`source_id`, `id`)
);
--> statement-breakpoint
CREATE TABLE `downloads` (
	`source_id` text NOT NULL,
	`story_id` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`total_pages` integer,
	`downloaded_pages` integer DEFAULT 0 NOT NULL,
	`size_bytes` integer,
	`path` text,
	`error` text,
	`started_at` integer,
	`completed_at` integer,
	PRIMARY KEY(`source_id`, `story_id`)
);
--> statement-breakpoint
CREATE INDEX `downloads_status_idx` ON `downloads` (`status`);--> statement-breakpoint
CREATE TABLE `history` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`story_id` text NOT NULL,
	`page_index` integer DEFAULT 0 NOT NULL,
	`duration_ms` integer,
	`read_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `history_read_at_idx` ON `history` (`read_at`);--> statement-breakpoint
CREATE TABLE `library_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `library_category_entries` (
	`category_id` text NOT NULL,
	`source_id` text NOT NULL,
	`story_id` text NOT NULL,
	PRIMARY KEY(`category_id`, `source_id`, `story_id`)
);
--> statement-breakpoint
CREATE TABLE `library_entries` (
	`source_id` text NOT NULL,
	`story_id` text NOT NULL,
	`added_at` integer DEFAULT (unixepoch()) NOT NULL,
	`sort_order` integer,
	`last_read_at` integer,
	`is_unread` integer DEFAULT true NOT NULL,
	PRIMARY KEY(`source_id`, `story_id`)
);
--> statement-breakpoint
CREATE TABLE `pages` (
	`source_id` text NOT NULL,
	`story_id` text NOT NULL,
	`index` integer NOT NULL,
	`title` text,
	`content` text,
	`word_count` integer,
	PRIMARY KEY(`source_id`, `story_id`, `index`)
);
--> statement-breakpoint
CREATE TABLE `reading_progress` (
	`source_id` text NOT NULL,
	`story_id` text NOT NULL,
	`page_index` integer DEFAULT 0 NOT NULL,
	`page_count` integer,
	`scroll_pct` real DEFAULT 0 NOT NULL,
	`read_pages` text,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`source_id`, `story_id`)
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `source_list_cache` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`kind` text NOT NULL,
	`page` integer DEFAULT 1 NOT NULL,
	`params_hash` text NOT NULL,
	`story_refs` text,
	`total` integer,
	`fetched_at` integer DEFAULT (unixepoch()) NOT NULL,
	`expires_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `source_list_cache_unique_idx` ON `source_list_cache` (`source_id`,`kind`,`page`,`params_hash`);--> statement-breakpoint
CREATE TABLE `sources` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`lang` text DEFAULT 'en' NOT NULL,
	`base_url` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`config` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `stories` (
	`source_id` text NOT NULL,
	`id` text NOT NULL,
	`title` text NOT NULL,
	`author_id` text,
	`author_name` text,
	`description` text,
	`category_id` text,
	`category_name` text,
	`lang` text,
	`url` text,
	`cover_url` text,
	`rating` real,
	`votes` integer,
	`views` integer,
	`word_count` integer,
	`is_new` integer,
	`is_hot` integer,
	`is_writers_pick` integer,
	`is_contest_winner` integer,
	`comments_enabled` integer,
	`rating_enabled` integer,
	`published_at` integer,
	`fetched_at` integer DEFAULT (unixepoch()) NOT NULL,
	`raw` text,
	PRIMARY KEY(`source_id`, `id`)
);
--> statement-breakpoint
CREATE INDEX `stories_author_idx` ON `stories` (`source_id`,`author_id`);--> statement-breakpoint
CREATE INDEX `stories_category_idx` ON `stories` (`source_id`,`category_id`);--> statement-breakpoint
CREATE INDEX `stories_published_idx` ON `stories` (`source_id`,`published_at`);--> statement-breakpoint
CREATE TABLE `story_tags` (
	`source_id` text NOT NULL,
	`story_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`source_id`, `story_id`, `tag_id`)
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`source_id` text NOT NULL,
	`id` text NOT NULL,
	`name` text NOT NULL,
	PRIMARY KEY(`source_id`, `id`)
);
--> statement-breakpoint
CREATE INDEX `tags_name_idx` ON `tags` (`name`);