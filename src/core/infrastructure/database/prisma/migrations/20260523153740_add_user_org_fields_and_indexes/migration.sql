-- AlterTable: Add new enums and User fields for multi-tenancy (Phase 1)

-- Step 1: Add OWNER to UserRole enum
ALTER TABLE `users` MODIFY `rol` ENUM('OWNER', 'ADMIN', 'MANAGER', 'WAITER', 'CHEF') NOT NULL;

-- Step 2: Add new columns to User (nullable first for safe migration)
ALTER TABLE `users` ADD COLUMN `organizationId` VARCHAR(191) NULL;
ALTER TABLE `users` ADD COLUMN `accountStatus` ENUM('ACTIVE', 'DISABLED') NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE `users` ADD COLUMN `tokenVersion` INTEGER NOT NULL DEFAULT 0;
ALTER TABLE `users` ADD COLUMN `emailVerifiedAt` DATETIME(3) NULL;
ALTER TABLE `users` ADD COLUMN `mustChangePassword` BOOLEAN NOT NULL DEFAULT false;

-- Step 3: Create default organization if users exist without organizationId
INSERT INTO `organizations` (`id`, `name`, `slug`, `plan`, `status`, `createdAt`, `updatedAt`)
SELECT
  UUID(),
  'Legacy Organization',
  'legacy',
  'FREE',
  'ACTIVE',
  NOW(3),
  NOW(3)
WHERE EXISTS (SELECT 1 FROM `users` WHERE `organizationId` IS NULL)
  AND NOT EXISTS (SELECT 1 FROM `organizations` WHERE `slug` = 'legacy');

-- Step 4: Assign existing users to default organization
UPDATE `users`
SET `organizationId` = (SELECT `id` FROM `organizations` WHERE `slug` = 'legacy' LIMIT 1)
WHERE `organizationId` IS NULL;

-- Step 5: Make organizationId NOT NULL and add foreign key
ALTER TABLE `users` MODIFY `organizationId` VARCHAR(191) NOT NULL;
ALTER TABLE `users` ADD CONSTRAINT `users_organizationId_fkey`
  FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 6: Add new indexes for User
CREATE INDEX `users_organizationId_idx` ON `users`(`organizationId`);
CREATE INDEX `users_organizationId_rol_idx` ON `users`(`organizationId`, `rol`);
CREATE INDEX `users_organizationId_accountStatus_idx` ON `users`(`organizationId`, `accountStatus`);

-- Step 7: Add performance indexes for multi-tenant queries

-- Order indexes
CREATE INDEX `orders_branchId_status_date_idx` ON `orders`(`branchId`, `status`, `date`);
CREATE INDEX `orders_branchId_userId_idx` ON `orders`(`branchId`, `userId`);

-- Table indexes
CREATE INDEX `tables_branchId_availabilityStatus_idx` ON `tables`(`branchId`, `availabilityStatus`);

-- MenuCategory indexes
CREATE INDEX `menu_categories_branchId_status_idx` ON `menu_categories`(`branchId`, `status`);

-- MenuItem indexes
CREATE INDEX `menu_items_branchId_categoryId_idx` ON `menu_items`(`branchId`, `categoryId`);
CREATE INDEX `menu_items_branchId_status_idx` ON `menu_items`(`branchId`, `status`);

-- Payment indexes
CREATE INDEX `payments_branchId_createdAt_idx` ON `payments`(`branchId`, `createdAt`);

-- Product indexes
CREATE INDEX `products_branchId_status_idx` ON `products`(`branchId`, `status`);
