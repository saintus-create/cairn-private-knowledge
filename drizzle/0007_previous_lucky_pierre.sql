CREATE TABLE `source_archives` (
	`id` int AUTO_INCREMENT NOT NULL,
	`collectionId` int NOT NULL,
	`sourceUrl` varchar(1024) NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`archiveSha256` varchar(64) NOT NULL,
	`observedEtag` varchar(128),
	`observedLastModified` timestamp,
	`acquiredAt` timestamp NOT NULL,
	`recordCount` int NOT NULL,
	`extractStorageKey` varchar(1024) NOT NULL,
	`extractStorageUrl` varchar(1024) NOT NULL,
	`extractSha256` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `source_archives_id` PRIMARY KEY(`id`),
	CONSTRAINT `source_archives_collection_hash_unique` UNIQUE(`collectionId`,`archiveSha256`)
);
--> statement-breakpoint
CREATE INDEX `source_archives_collection_idx` ON `source_archives` (`collectionId`);