-- Migrate tables: numberTable (Int) -> name (Varchar), preserve data as string (e.g. 1 -> "1", allows "1A", "1B")

ALTER TABLE `tables` ADD COLUMN `name` VARCHAR(64) NOT NULL DEFAULT '';

UPDATE `tables` SET `name` = CAST(`numberTable` AS CHAR);

ALTER TABLE `tables` DROP INDEX `tables_numberTable_key`;
ALTER TABLE `tables` DROP INDEX `tables_numberTable_idx`;

ALTER TABLE `tables` DROP COLUMN `numberTable`;

ALTER TABLE `tables` ALTER COLUMN `name` DROP DEFAULT;

CREATE UNIQUE INDEX `tables_name_key` ON `tables`(`name`);
