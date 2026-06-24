/*
  Warnings:

  - A unique constraint covering the columns `[slug]` on the table `branches` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `branches` ADD COLUMN `slug` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `branches_slug_key` ON `branches`(`slug`);
