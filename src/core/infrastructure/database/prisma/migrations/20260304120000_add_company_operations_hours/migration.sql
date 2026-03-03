-- AlterTable: add startOperations and endOperations to companies (format "HH:mm")
ALTER TABLE `companies` ADD COLUMN `startOperations` VARCHAR(5) NULL,
    ADD COLUMN `endOperations` VARCHAR(5) NULL;
