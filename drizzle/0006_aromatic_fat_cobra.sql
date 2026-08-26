ALTER TABLE `collections` ADD `sourceAuthority` enum('general','official_primary','official_procedural','user_reference') DEFAULT 'general' NOT NULL;--> statement-breakpoint
ALTER TABLE `collections` ADD `publisher` varchar(180) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `collections` ADD `sourceMapUrl` varchar(1024);--> statement-breakpoint
ALTER TABLE `projects` ADD `projectKind` enum('general','primary_law') DEFAULT 'general' NOT NULL;