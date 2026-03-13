-- AlterTable: add SALARY to ExpenseType enum (expenses.type)
ALTER TABLE `expenses` MODIFY COLUMN `type` ENUM('SERVICE_BUSINESS', 'UTILITY', 'RENT', 'MERCHANDISE', 'SALARY', 'OTHER') NOT NULL;
