-- DropForeignKey
ALTER TABLE `employee_salaries_payments` DROP FOREIGN KEY `employee_salaries_payments_userId_fkey`;

-- DropForeignKey
ALTER TABLE `expense_items` DROP FOREIGN KEY `expense_items_productId_fkey`;

-- DropForeignKey
ALTER TABLE `menu_item_ingredients` DROP FOREIGN KEY `menu_item_ingredients_productId_fkey`;

-- DropForeignKey
ALTER TABLE `menu_items` DROP FOREIGN KEY `menu_items_userId_fkey`;

-- DropForeignKey
ALTER TABLE `order_item_extras` DROP FOREIGN KEY `order_item_extras_extraId_fkey`;

-- DropForeignKey
ALTER TABLE `products` DROP FOREIGN KEY `products_userId_fkey`;

-- DropForeignKey
ALTER TABLE `tables` DROP FOREIGN KEY `tables_userId_fkey`;

-- AddForeignKey
ALTER TABLE `products` ADD CONSTRAINT `products_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_item_extras` ADD CONSTRAINT `order_item_extras_extraId_fkey` FOREIGN KEY (`extraId`) REFERENCES `menu_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_salaries_payments` ADD CONSTRAINT `employee_salaries_payments_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tables` ADD CONSTRAINT `tables_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `menu_items` ADD CONSTRAINT `menu_items_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `menu_item_ingredients` ADD CONSTRAINT `menu_item_ingredients_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expense_items` ADD CONSTRAINT `expense_items_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
