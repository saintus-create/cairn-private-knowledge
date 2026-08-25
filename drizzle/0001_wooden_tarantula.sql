CREATE TABLE `collection_pages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`collectionId` int NOT NULL,
	`importBatchId` int,
	`canonicalUrl` varchar(1024) NOT NULL,
	`pageTitle` text NOT NULL,
	`headings` json NOT NULL,
	`cleanText` longtext,
	`contentHash` varchar(64) NOT NULL,
	`sourceStatus` enum('queued','ready','unchanged','failed','skipped') NOT NULL DEFAULT 'queued',
	`importError` text,
	`fetchedAt` timestamp,
	`importedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `collection_pages_id` PRIMARY KEY(`id`),
	CONSTRAINT `collection_page_url_unique` UNIQUE(`collectionId`,`canonicalUrl`)
);
--> statement-breakpoint
CREATE TABLE `collections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(80) NOT NULL,
	`rootUrl` varchar(1024) NOT NULL,
	`scope` text NOT NULL,
	`audience` varchar(120) NOT NULL,
	`tone` varchar(120) NOT NULL,
	`answerMode` enum('extractive','source-backed','labeled-synthesis') NOT NULL DEFAULT 'extractive',
	`includePaths` text NOT NULL,
	`excludePaths` text NOT NULL,
	`pageLimit` int NOT NULL DEFAULT 20,
	`importStatus` enum('idle','importing','ready','attention') NOT NULL DEFAULT 'idle',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `collections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `import_batches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`collectionId` int NOT NULL,
	`status` enum('running','paused','complete','failed') NOT NULL DEFAULT 'running',
	`requestedCount` int NOT NULL,
	`processedCount` int NOT NULL DEFAULT 0,
	`unchangedCount` int NOT NULL DEFAULT 0,
	`failedCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `import_batches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `passages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`collectionId` int NOT NULL,
	`pageId` int NOT NULL,
	`position` int NOT NULL,
	`headingPath` text NOT NULL,
	`anchor` varchar(180) NOT NULL,
	`text` longtext NOT NULL,
	`contentHash` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `passages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `collection_pages_batch_idx` ON `collection_pages` (`importBatchId`);--> statement-breakpoint
CREATE INDEX `collections_user_idx` ON `collections` (`userId`);--> statement-breakpoint
CREATE INDEX `import_batches_collection_idx` ON `import_batches` (`collectionId`);--> statement-breakpoint
CREATE INDEX `passages_collection_idx` ON `passages` (`collectionId`);--> statement-breakpoint
CREATE INDEX `passages_page_idx` ON `passages` (`pageId`);