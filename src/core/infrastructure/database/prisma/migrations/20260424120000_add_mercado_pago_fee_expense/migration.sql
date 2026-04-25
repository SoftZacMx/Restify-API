-- AlterTable: extend ExpenseType enum with MERCADO_PAGO_FEE
ALTER TABLE `expenses` MODIFY `type` ENUM('SERVICE_BUSINESS', 'UTILITY', 'RENT', 'MERCHANDISE', 'SALARY', 'OTHER', 'MERCADO_PAGO_FEE') NOT NULL;

-- DropForeignKey
ALTER TABLE `expenses` DROP FOREIGN KEY `expenses_userId_fkey`;

-- AlterTable: make userId nullable, add paymentId
ALTER TABLE `expenses` MODIFY `userId` VARCHAR(191) NULL,
    ADD COLUMN `paymentId` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX `expenses_paymentId_idx` ON `expenses`(`paymentId`);
