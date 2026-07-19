-- CreateTable
CREATE TABLE `pending_checkouts` (
    `id` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `status` ENUM('WAITING', 'CONSUMED', 'EXPIRED') NOT NULL DEFAULT 'WAITING',
    `cart` JSON NOT NULL,
    `customerName` VARCHAR(191) NOT NULL,
    `customerPhone` VARCHAR(191) NOT NULL,
    `orderType` VARCHAR(191) NOT NULL,
    `deliveryAddress` TEXT NULL,
    `latitude` DOUBLE NULL,
    `longitude` DOUBLE NULL,
    `scheduledAt` DATETIME(3) NULL,
    `total` DECIMAL(10, 2) NOT NULL,
    `subtotal` DECIMAL(10, 2) NOT NULL,
    `trackingToken` VARCHAR(191) NOT NULL,
    `mpPreferenceId` VARCHAR(191) NULL,
    `paymentId` VARCHAR(191) NULL,
    `orderId` VARCHAR(191) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `pending_checkouts_trackingToken_key`(`trackingToken`),
    INDEX `pending_checkouts_branchId_idx`(`branchId`),
    INDEX `pending_checkouts_trackingToken_idx`(`trackingToken`),
    INDEX `pending_checkouts_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `pending_checkouts` ADD CONSTRAINT `pending_checkouts_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
