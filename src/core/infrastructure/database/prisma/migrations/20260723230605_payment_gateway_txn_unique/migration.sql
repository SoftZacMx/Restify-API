/*
  Warnings:

  - A unique constraint covering the columns `[gatewayTransactionId]` on the table `payments` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX `payments_gatewayTransactionId_idx` ON `payments`;

-- CreateIndex
CREATE UNIQUE INDEX `payments_gatewayTransactionId_key` ON `payments`(`gatewayTransactionId`);
