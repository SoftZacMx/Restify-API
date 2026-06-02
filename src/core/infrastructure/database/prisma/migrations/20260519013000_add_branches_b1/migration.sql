-- B1: organizations, branches, user_branch_access, branch_id on operational tables

-- CreateTable
CREATE TABLE `organizations` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NULL,
    `plan` ENUM('FREE', 'PRO', 'ENTERPRISE') NOT NULL DEFAULT 'FREE',
    `status` ENUM('ACTIVE', 'SUSPENDED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `organizations_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `branches` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `state` VARCHAR(191) NOT NULL,
    `city` VARCHAR(191) NOT NULL,
    `street` VARCHAR(191) NOT NULL,
    `exteriorNumber` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `rfc` VARCHAR(191) NULL,
    `logoUrl` VARCHAR(191) NULL,
    `startOperations` VARCHAR(191) NULL,
    `endOperations` VARCHAR(191) NULL,
    `ticketConfig` JSON NULL,
    `paymentConfig` TEXT NULL,
    `timezone` VARCHAR(191) NOT NULL DEFAULT 'America/Mexico_City',
    `currency` VARCHAR(191) NOT NULL DEFAULT 'MXN',
    `status` ENUM('ACTIVE', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `branches_organizationId_status_idx`(`organizationId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_branch_access` (
    `userId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `user_branch_access_branchId_idx`(`branchId`),
    PRIMARY KEY (`userId`, `branchId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable: branch_id columns (nullable until backfill / tenant rollout)
ALTER TABLE `products` ADD COLUMN `branchId` VARCHAR(191) NULL;
ALTER TABLE `orders` ADD COLUMN `branchId` VARCHAR(191) NULL;
ALTER TABLE `order_items` ADD COLUMN `branchId` VARCHAR(191) NULL;
ALTER TABLE `order_item_extras` ADD COLUMN `branchId` VARCHAR(191) NULL;
ALTER TABLE `payments` ADD COLUMN `branchId` VARCHAR(191) NULL;
ALTER TABLE `payment_sessions` ADD COLUMN `branchId` VARCHAR(191) NULL;
ALTER TABLE `payments_differentiations` ADD COLUMN `branchId` VARCHAR(191) NULL;
ALTER TABLE `refunds` ADD COLUMN `branchId` VARCHAR(191) NULL;
ALTER TABLE `employee_salaries_payments` ADD COLUMN `branchId` VARCHAR(191) NULL;
ALTER TABLE `tables` ADD COLUMN `branchId` VARCHAR(191) NULL;
ALTER TABLE `menu_categories` ADD COLUMN `branchId` VARCHAR(191) NULL;
ALTER TABLE `menu_items` ADD COLUMN `branchId` VARCHAR(191) NULL;
ALTER TABLE `expenses` ADD COLUMN `branchId` VARCHAR(191) NULL;
ALTER TABLE `expense_items` ADD COLUMN `branchId` VARCHAR(191) NULL;

-- tables: replace global unique name with per-branch unique
DROP INDEX `tables_name_key` ON `tables`;
CREATE UNIQUE INDEX `tables_branchId_name_key` ON `tables`(`branchId`, `name`);

-- Indexes
CREATE INDEX `products_branchId_idx` ON `products`(`branchId`);
CREATE INDEX `orders_branchId_idx` ON `orders`(`branchId`);
CREATE INDEX `orders_branchId_date_idx` ON `orders`(`branchId`, `date`);
CREATE INDEX `order_items_branchId_idx` ON `order_items`(`branchId`);
CREATE INDEX `order_item_extras_branchId_idx` ON `order_item_extras`(`branchId`);
CREATE INDEX `payments_branchId_idx` ON `payments`(`branchId`);
CREATE INDEX `payment_sessions_branchId_idx` ON `payment_sessions`(`branchId`);
CREATE INDEX `payments_differentiations_branchId_idx` ON `payments_differentiations`(`branchId`);
CREATE INDEX `refunds_branchId_idx` ON `refunds`(`branchId`);
CREATE INDEX `employee_salaries_payments_branchId_idx` ON `employee_salaries_payments`(`branchId`);
CREATE INDEX `tables_branchId_idx` ON `tables`(`branchId`);
CREATE INDEX `tables_branchId_status_idx` ON `tables`(`branchId`, `status`);
CREATE INDEX `menu_categories_branchId_idx` ON `menu_categories`(`branchId`);
CREATE INDEX `menu_items_branchId_idx` ON `menu_items`(`branchId`);
CREATE INDEX `expenses_branchId_idx` ON `expenses`(`branchId`);
CREATE INDEX `expense_items_branchId_idx` ON `expense_items`(`branchId`);

-- Foreign keys
ALTER TABLE `branches` ADD CONSTRAINT `branches_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `user_branch_access` ADD CONSTRAINT `user_branch_access_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `user_branch_access` ADD CONSTRAINT `user_branch_access_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `products` ADD CONSTRAINT `products_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `orders` ADD CONSTRAINT `orders_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `order_item_extras` ADD CONSTRAINT `order_item_extras_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `payments` ADD CONSTRAINT `payments_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `payment_sessions` ADD CONSTRAINT `payment_sessions_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `payments_differentiations` ADD CONSTRAINT `payments_differentiations_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `refunds` ADD CONSTRAINT `refunds_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `employee_salaries_payments` ADD CONSTRAINT `employee_salaries_payments_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `tables` ADD CONSTRAINT `tables_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `menu_categories` ADD CONSTRAINT `menu_categories_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `menu_items` ADD CONSTRAINT `menu_items_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `expense_items` ADD CONSTRAINT `expense_items_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
