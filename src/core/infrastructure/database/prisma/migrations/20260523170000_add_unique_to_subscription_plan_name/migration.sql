-- AlterTable: Add unique constraint to subscription_plans.name
CREATE UNIQUE INDEX `subscription_plans_name_key` ON `subscription_plans`(`name`);
