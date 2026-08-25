CREATE TABLE `page_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pageId` int NOT NULL,
	`importBatchId` int,
	`version` int NOT NULL,
	`pageTitle` text NOT NULL,
	`headings` json NOT NULL,
	`cleanText` longtext NOT NULL,
	`contentHash` varchar(64) NOT NULL,
	`fetchedAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `page_snapshots_id` PRIMARY KEY(`id`),
	CONSTRAINT `page_snapshot_version_unique` UNIQUE(`pageId`,`version`)
);
--> statement-breakpoint
CREATE INDEX `page_snapshots_page_idx` ON `page_snapshots` (`pageId`);--> statement-breakpoint
CREATE INDEX `page_snapshots_batch_idx` ON `page_snapshots` (`importBatchId`);