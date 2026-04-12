-- DropForeignKey (recrear como ON DELETE SET NULL)
ALTER TABLE `orders` DROP FOREIGN KEY `orders_userId_fkey`;

-- AlterTable: hacer userId nullable y agregar campos de pedidos online
ALTER TABLE `orders`
    MODIFY `userId` VARCHAR(191) NULL,
    ADD COLUMN `customerName` VARCHAR(200) NULL,
    ADD COLUMN `customerPhone` VARCHAR(13) NULL,
    ADD COLUMN `latitude` DOUBLE NULL,
    ADD COLUMN `longitude` DOUBLE NULL,
    ADD COLUMN `deliveryAddress` TEXT NULL,
    ADD COLUMN `scheduledAt` DATETIME(3) NULL,
    ADD COLUMN `trackingToken` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `orders_trackingToken_key` ON `orders`(`trackingToken`);

-- AddForeignKey (ahora con SET NULL)
ALTER TABLE `orders` ADD CONSTRAINT `orders_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
