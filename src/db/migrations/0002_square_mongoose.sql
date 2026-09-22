ALTER TABLE `stories` ADD `series_id` text;--> statement-breakpoint
ALTER TABLE `stories` ADD `series_title` text;--> statement-breakpoint
ALTER TABLE `stories` ADD `series_position` integer;--> statement-breakpoint
CREATE INDEX `stories_series_idx` ON `stories` (`source_id`,`series_id`);