/*
  Warnings:

  - The values [CANCELLED] on the enum `subscriptions_status` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterTable
ALTER TABLE `subscriptions` MODIFY `status` ENUM('ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED', 'TRIALING', 'INCOMPLETE') NOT NULL DEFAULT 'ACTIVE';
