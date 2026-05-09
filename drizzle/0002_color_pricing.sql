ALTER TABLE `devices` ADD COLUMN `pricePerPageBW` decimal(10,2) NOT NULL DEFAULT '0.50';
--> statement-breakpoint
ALTER TABLE `devices` ADD COLUMN `pricePerPageColor` decimal(10,2) NOT NULL DEFAULT '1.00';
--> statement-breakpoint
ALTER TABLE `printJobFiles` ADD COLUMN `colorMode` enum('bw','color') NOT NULL DEFAULT 'bw';
--> statement-breakpoint
ALTER TABLE `printJobs` ADD COLUMN `customerPhone` varchar(32);
