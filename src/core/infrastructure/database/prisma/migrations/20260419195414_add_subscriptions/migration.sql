/*
  Warnings:

  - You are about to alter the column `customerName` on the `orders` table. The data in that column could be lost. The data in that column will be cast from `VarChar(200)` to `VarChar(191)`.

*/
-- AlterTable
ALTER TABLE `companies` ADD COLUMN `paymentConfig` TEXT NULL;

-- AlterTable
ALTER TABLE `orders` MODIFY `customerName` VARCHAR(191) NULL,
    MODIFY `customerPhone` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `subscription_plans` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `billingPeriod` ENUM('MONTHLY', 'ANNUAL') NOT NULL,
    `price` INTEGER NOT NULL,
    `stripePriceId` VARCHAR(191) NOT NULL,
    `status` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `subscription_plans_stripePriceId_key`(`stripePriceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subscriptions` (
    `id` VARCHAR(191) NOT NULL,
    `stripeCustomerId` VARCHAR(191) NOT NULL,
    `stripeSubscriptionId` VARCHAR(191) NULL,
    `status` ENUM('ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED', 'TRIALING') NOT NULL DEFAULT 'EXPIRED',
    `currentPeriodStart` DATETIME(3) NULL,
    `currentPeriodEnd` DATETIME(3) NULL,
    `cancelAtPeriodEnd` BOOLEAN NOT NULL DEFAULT false,
    `planId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `subscriptions_stripeCustomerId_key`(`stripeCustomerId`),
    UNIQUE INDEX `subscriptions_stripeSubscriptionId_key`(`stripeSubscriptionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `subscription_plans`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
