CREATE TABLE `chapter_downloads` (
	`source_id` text NOT NULL,
	`novel_id` text NOT NULL,
	`chapter_id` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`error` text,
	`bytes` integer,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`source_id`, `novel_id`, `chapter_id`)
);
--> statement-breakpoint
CREATE INDEX `chapter_downloads_status_idx` ON `chapter_downloads` (`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `chapter_reads` (
	`source_id` text NOT NULL,
	`novel_id` text NOT NULL,
	`chapter_id` text NOT NULL,
	`read_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`source_id`, `novel_id`, `chapter_id`)
);
--> statement-breakpoint
CREATE INDEX `chapter_reads_novel_idx` ON `chapter_reads` (`source_id`,`novel_id`);--> statement-breakpoint
CREATE TABLE `chapters` (
	`source_id` text NOT NULL,
	`novel_id` text NOT NULL,
	`id` text NOT NULL,
	`position` integer NOT NULL,
	`number` real,
	`title` text,
	`volume` text,
	`volume_index` integer,
	`released_at` integer,
	`word_count` integer,
	`content` text,
	`content_hash` text,
	`orphaned` integer DEFAULT false NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`source_id`, `novel_id`, `id`)
);
--> statement-breakpoint
CREATE INDEX `chapters_order_idx` ON `chapters` (`source_id`,`novel_id`,`orphaned`,`position`);--> statement-breakpoint
CREATE TABLE `source_health` (
	`source_id` text NOT NULL,
	`operation` text NOT NULL,
	`last_ok_at` integer,
	`last_error_at` integer,
	`last_error_kind` text,
	`fail_count` integer DEFAULT 0 NOT NULL,
	`ewma_latency_ms` real,
	`parser_version` text,
	PRIMARY KEY(`source_id`, `operation`)
);
--> statement-breakpoint
CREATE TABLE `story_updates` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`novel_id` text NOT NULL,
	`chapter_id` text NOT NULL,
	`chapter_title` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`seen_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `story_updates_unique_idx` ON `story_updates` (`source_id`,`novel_id`,`chapter_id`);--> statement-breakpoint
CREATE INDEX `story_updates_seen_idx` ON `story_updates` (`seen_at`,`created_at`);--> statement-breakpoint
ALTER TABLE `history` ADD `chapter_id` text;--> statement-breakpoint
ALTER TABLE `history` ADD `paragraph_index` integer;--> statement-breakpoint
ALTER TABLE `narration_bookmarks` ADD `chapter_id` text;--> statement-breakpoint
ALTER TABLE `narration_bookmarks` ADD `paragraph_index` integer;--> statement-breakpoint
ALTER TABLE `narration_state` ADD `chapter_id` text;--> statement-breakpoint
ALTER TABLE `narration_state` ADD `paragraph_index` integer;--> statement-breakpoint
ALTER TABLE `reading_progress` ADD `chapter_id` text;--> statement-breakpoint
ALTER TABLE `reading_progress` ADD `paragraph_index` integer;--> statement-breakpoint
ALTER TABLE `reading_progress` ADD `char_offset` integer;--> statement-breakpoint
ALTER TABLE `stories` ADD `status` text;--> statement-breakpoint
ALTER TABLE `stories` ADD `genres` text;--> statement-breakpoint
ALTER TABLE `stories` ADD `stats` text;--> statement-breakpoint
ALTER TABLE `stories` ADD `chapter_count` integer;--> statement-breakpoint
ALTER TABLE `stories` ADD `chapters_synced_at` integer;--> statement-breakpoint
ALTER TABLE `stories` ADD `updated_at` integer;