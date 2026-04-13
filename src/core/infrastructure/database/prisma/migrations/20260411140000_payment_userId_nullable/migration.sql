-- DropForeignKey
ALTER TABLE `payments` DROP FOREIGN KEY `payments_userId_fkey`;

-- AlterTable
ALTER TABLE `payments` MODIFY `userId` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
