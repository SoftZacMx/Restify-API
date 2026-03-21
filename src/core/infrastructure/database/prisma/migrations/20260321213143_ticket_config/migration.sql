/*
  Warnings:

  - You are about to alter the column `title` on the `expenses` table. The data in that column could be lost. The data in that column will be cast from `VarChar(200)` to `VarChar(191)`.

*/
-- AlterTable
ALTER TABLE `companies` MODIFY `startOperations` VARCHAR(191) NULL,
    MODIFY `endOperations` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `expenses` MODIFY `title` VARCHAR(191) NOT NULL;
