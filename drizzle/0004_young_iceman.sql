CREATE TABLE `uploaded_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`collectionId` int NOT NULL,
	`pageId` int NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`mimeType` varchar(120) NOT NULL,
	`byteSize` int NOT NULL,
	`storageKey` varchar(1024) NOT NULL,
	`storageUrl` varchar(1024) NOT NULL,
	`status` enum('processing','ready','failed') NOT NULL DEFAULT 'processing',
	`importError` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `uploaded_documents_id` PRIMARY KEY(`id`),
	CONSTRAINT `uploaded_documents_storage_key_unique` UNIQUE(`storageKey`)
);
--> statement-breakpoint
CREATE INDEX `uploaded_documents_user_idx` ON `uploaded_documents` (`userId`);--> statement-breakpoint
CREATE INDEX `uploaded_documents_collection_idx` ON `uploaded_documents` (`collectionId`);