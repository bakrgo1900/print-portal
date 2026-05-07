CREATE TABLE `devices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`location` varchar(255),
	`printNodePrinterId` varchar(64),
	`pricePerPage` decimal(10,2) NOT NULL DEFAULT '0.50',
	`qrToken` varchar(128) NOT NULL,
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `devices_id` PRIMARY KEY(`id`),
	CONSTRAINT `devices_qrToken_unique` UNIQUE(`qrToken`)
);
--> statement-breakpoint
CREATE TABLE `printJobFiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobId` int NOT NULL,
	`fileName` varchar(500) NOT NULL,
	`fileType` enum('pdf','docx','jpg','png','jpeg') NOT NULL,
	`fileKey` varchar(500) NOT NULL,
	`fileUrl` varchar(1000) NOT NULL,
	`pageCount` int NOT NULL DEFAULT 1,
	`copies` int NOT NULL DEFAULT 1,
	`fileSizeBytes` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `printJobFiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `printJobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`deviceId` int NOT NULL,
	`sessionToken` varchar(128) NOT NULL,
	`status` enum('pending','paid','printing','done','failed') NOT NULL DEFAULT 'pending',
	`totalPages` int NOT NULL DEFAULT 0,
	`totalCost` decimal(10,2) NOT NULL DEFAULT '0.00',
	`paymentRef` varchar(255),
	`paymentMethod` varchar(64),
	`printNodeJobId` varchar(64),
	`customerEmail` varchar(320),
	`customerName` varchar(255),
	`notes` text,
	`paidAt` timestamp,
	`printedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `printJobs_id` PRIMARY KEY(`id`),
	CONSTRAINT `printJobs_sessionToken_unique` UNIQUE(`sessionToken`)
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(128) NOT NULL,
	`value` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `settings_key_unique` UNIQUE(`key`)
);
