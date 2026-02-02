-- AlterTable: add mandatory title to expenses (existing rows get default 'Sin título')
ALTER TABLE `expenses` ADD COLUMN `title` VARCHAR(200) NOT NULL DEFAULT 'Sin título' AFTER `id`;
