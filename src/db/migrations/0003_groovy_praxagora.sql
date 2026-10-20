CREATE TABLE `narration_bookmarks` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`story_id` text NOT NULL,
	`chunk_index` integer DEFAULT 0 NOT NULL,
	`label` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `narration_bookmarks_story_idx` ON `narration_bookmarks` (`source_id`,`story_id`);--> statement-breakpoint
CREATE TABLE `narration_state` (
	`source_id` text NOT NULL,
	`story_id` text NOT NULL,
	`engine` text DEFAULT 'system' NOT NULL,
	`voice_id` text,
	`speed` real DEFAULT 1 NOT NULL,
	`chunk_index` integer DEFAULT 0 NOT NULL,
	`char_offset` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`source_id`, `story_id`)
);
