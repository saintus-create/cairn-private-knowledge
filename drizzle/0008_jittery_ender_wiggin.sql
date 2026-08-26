ALTER TABLE `collection_pages` ADD `officialRecordKey` varchar(255);--> statement-breakpoint
ALTER TABLE `page_snapshots` ADD `sourceArchiveId` int;--> statement-breakpoint
ALTER TABLE `collection_pages` ADD CONSTRAINT `collection_page_official_record_unique` UNIQUE(`collectionId`,`officialRecordKey`);--> statement-breakpoint
CREATE INDEX `page_snapshots_archive_idx` ON `page_snapshots` (`sourceArchiveId`);