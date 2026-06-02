-- AlterTable: Add multi-tenancy fields to subscriptions and subscription_plans

-- Step 1: Add maxBranches to subscription_plans
ALTER TABLE `subscription_plans` ADD COLUMN `maxBranches` INTEGER NOT NULL DEFAULT 1;

-- Step 2: Make billingPeriod and stripePriceId nullable (for Free Legacy plan)
ALTER TABLE `subscription_plans` MODIFY `billingPeriod` ENUM('MONTHLY', 'ANNUAL') NULL;
ALTER TABLE `subscription_plans` MODIFY `stripePriceId` VARCHAR(191) NULL;
ALTER TABLE `subscription_plans` MODIFY `price` INTEGER NOT NULL DEFAULT 0;

-- Step 3: Add organizationId to subscriptions (nullable first)
ALTER TABLE `subscriptions` ADD COLUMN `organizationId` VARCHAR(191) NULL;

-- Step 4: Make stripeCustomerId nullable (for Free Legacy)
ALTER TABLE `subscriptions` MODIFY `stripeCustomerId` VARCHAR(191) NULL;

-- Step 5: Change default status to ACTIVE (from EXPIRED)
ALTER TABLE `subscriptions` MODIFY `status` ENUM('ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED', 'TRIALING', 'INCOMPLETE') NOT NULL DEFAULT 'ACTIVE';

-- Step 6: Update existing subscriptions to belong to Legacy Organization
UPDATE `subscriptions` sub
SET sub.`organizationId` = (
  SELECT org.id FROM `organizations` org WHERE org.slug = 'legacy' LIMIT 1
)
WHERE sub.`organizationId` IS NULL;

-- Step 7: Create subscription for Legacy Organization if none exists
INSERT INTO `subscriptions` (
  `id`,
  `organizationId`,
  `stripeCustomerId`,
  `status`,
  `planId`,
  `createdAt`,
  `updatedAt`
)
SELECT
  UUID(),
  org.id,
  NULL,
  'ACTIVE',
  NULL, -- Will be set to Free Legacy plan in seed
  NOW(3),
  NOW(3)
FROM `organizations` org
WHERE org.slug = 'legacy'
  AND NOT EXISTS (
    SELECT 1 FROM `subscriptions` WHERE `organizationId` = org.id
  );

-- Step 8: Make organizationId NOT NULL and add unique constraint
ALTER TABLE `subscriptions` MODIFY `organizationId` VARCHAR(191) NOT NULL;
CREATE UNIQUE INDEX `subscriptions_organizationId_key` ON `subscriptions`(`organizationId`);

-- Step 9: Add foreign key constraint
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_organizationId_fkey`
  FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 10: Add indexes
CREATE INDEX `subscriptions_organizationId_idx` ON `subscriptions`(`organizationId`);
CREATE INDEX `subscriptions_status_idx` ON `subscriptions`(`status`);
