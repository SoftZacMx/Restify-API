-- DropForeignKey
ALTER TABLE `menu_items` DROP FOREIGN KEY `menu_items_categoryId_fkey`;

-- AlterTable
ALTER TABLE `menu_items` MODIFY `categoryId` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `menu_items` ADD CONSTRAINT `menu_items_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `menu_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
