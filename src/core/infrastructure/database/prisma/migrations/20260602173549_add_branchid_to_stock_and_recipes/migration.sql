-- AlterTable
ALTER TABLE `menu_item_ingredients` ADD COLUMN `branchId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `stock_movements` ADD COLUMN `branchId` VARCHAR(191) NULL;

-- Backfill branchId desde el registro padre (datos existentes no deben quedar NULL).
-- En deploy nuevo la DB está vacía → estos UPDATE son no-op.
UPDATE `menu_item_ingredients` `mii`
JOIN `menu_items` `mi` ON `mi`.`id` = `mii`.`menuItemId`
SET `mii`.`branchId` = `mi`.`branchId`;

UPDATE `stock_movements` `sm`
JOIN `products` `p` ON `p`.`id` = `sm`.`productId`
SET `sm`.`branchId` = `p`.`branchId`;

-- CreateIndex
CREATE INDEX `menu_item_ingredients_branchId_idx` ON `menu_item_ingredients`(`branchId`);

-- CreateIndex
CREATE INDEX `stock_movements_branchId_idx` ON `stock_movements`(`branchId`);

-- CreateIndex
CREATE INDEX `stock_movements_branchId_createdAt_idx` ON `stock_movements`(`branchId`, `createdAt`);

-- AddForeignKey
ALTER TABLE `menu_item_ingredients` ADD CONSTRAINT `menu_item_ingredients_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
