ALTER TABLE `source_archives` ADD `sourceFileStorageKey` varchar(1024);--> statement-breakpoint
ALTER TABLE `source_archives` ADD `sourceFileStorageUrl` varchar(1024);--> statement-breakpoint
ALTER TABLE `source_archives` ADD `sourceFileSha256` varchar(64);--> statement-breakpoint
ALTER TABLE `source_archives` ADD `sourceFileBytes` int;