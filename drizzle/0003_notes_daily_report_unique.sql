ALTER TABLE `notes` ADD `report_date` text;--> statement-breakpoint
CREATE UNIQUE INDEX `notes_daily_report_unique_idx` ON `notes` (`workspace_id`,`type`,`report_date`);