CREATE TABLE `projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(80) NOT NULL,
	`description` varchar(220) NOT NULL DEFAULT '',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`),
	CONSTRAINT `projects_user_name_unique` UNIQUE(`userId`,`name`)
);
--> statement-breakpoint
INSERT INTO `projects` (`userId`, `name`, `description`)
SELECT DISTINCT `userId`, 'Unfiled research', '' FROM `collections`;
--> statement-breakpoint
ALTER TABLE `collections` ADD `projectId` int;--> statement-breakpoint
UPDATE `collections`
INNER JOIN `projects` ON `projects`.`userId` = `collections`.`userId` AND `projects`.`name` = 'Unfiled research'
SET `collections`.`projectId` = `projects`.`id`;
--> statement-breakpoint
ALTER TABLE `collections` MODIFY `projectId` int NOT NULL;--> statement-breakpoint
CREATE INDEX `projects_user_idx` ON `projects` (`userId`);--> statement-breakpoint
CREATE INDEX `collections_project_idx` ON `collections` (`projectId`);
