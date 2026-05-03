-- Stock Management — Fase 1 (Nivel 3: Stock + Recetas + Merma)
-- Aditiva: agrega columnas a products y menu_items, crea menu_item_ingredients y stock_movements.
-- Sin downtime: todas las columnas nuevas tienen default. Productos existentes quedan con
-- trackStock=false y stockActual=0; el feature está "off" hasta que el owner lo active producto por producto.

-- AlterTable: extender enum UnitOfMeasure con L y ML (en expense_items, donde ya se usa)
ALTER TABLE `expense_items` MODIFY `unitOfMeasure` ENUM('KG', 'G', 'L', 'ML', 'PCS', 'OTHER') NULL;

-- AlterTable: agregar columnas de stock a products
ALTER TABLE `products`
    ADD COLUMN `stockActual` DECIMAL(12, 3) NOT NULL DEFAULT 0,
    ADD COLUMN `unitOfMeasure` ENUM('KG', 'G', 'L', 'ML', 'PCS', 'OTHER') NULL,
    ADD COLUMN `trackStock` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `minStockAlert` DECIMAL(12, 3) NULL,
    ADD COLUMN `averageCost` DECIMAL(12, 4) NOT NULL DEFAULT 0;

-- CreateIndex: products.trackStock para listar rápido los rastreados
CREATE INDEX `products_trackStock_idx` ON `products`(`trackStock`);

-- AlterTable: agregar productId opcional a menu_items (item directo, ej. cerveza)
ALTER TABLE `menu_items` ADD COLUMN `productId` VARCHAR(191) NULL;

-- CreateIndex: menu_items.productId
CREATE INDEX `menu_items_productId_idx` ON `menu_items`(`productId`);

-- AddForeignKey: menu_items.productId -> products.id
ALTER TABLE `menu_items`
    ADD CONSTRAINT `menu_items_productId_fkey`
    FOREIGN KEY (`productId`) REFERENCES `products`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: menu_item_ingredients (recetas)
CREATE TABLE `menu_item_ingredients` (
    `id` VARCHAR(191) NOT NULL,
    `menuItemId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `quantity` DECIMAL(12, 3) NOT NULL,
    -- Si null, la cantidad se interpreta en la unidad del producto. Si difiere (ej. receta en G,
    -- producto en KG), el StockService convierte al base unit antes de descontar.
    `unit` ENUM('KG', 'G', 'L', 'ML', 'PCS', 'OTHER') NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `menu_item_ingredients_menuItemId_productId_key`(`menuItemId`, `productId`),
    INDEX `menu_item_ingredients_menuItemId_idx`(`menuItemId`),
    INDEX `menu_item_ingredients_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey: menu_item_ingredients.menuItemId -> menu_items.id (cascade: borrar plato borra su receta)
ALTER TABLE `menu_item_ingredients`
    ADD CONSTRAINT `menu_item_ingredients_menuItemId_fkey`
    FOREIGN KEY (`menuItemId`) REFERENCES `menu_items`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: menu_item_ingredients.productId -> products.id (restrict: no borrar producto en uso)
ALTER TABLE `menu_item_ingredients`
    ADD CONSTRAINT `menu_item_ingredients_productId_fkey`
    FOREIGN KEY (`productId`) REFERENCES `products`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: stock_movements (ledger inmutable)
CREATE TABLE `stock_movements` (
    `id` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `quantity` DECIMAL(12, 3) NOT NULL,
    `type` ENUM('PURCHASE', 'SALE', 'WASTE', 'ADJUSTMENT', 'SALE_REVERSAL') NOT NULL,
    `reason` VARCHAR(120) NULL,
    `notes` TEXT NULL,
    `expenseItemId` VARCHAR(191) NULL,
    `orderItemId` VARCHAR(191) NULL,
    `userId` VARCHAR(191) NULL, -- null para movements del sistema (ej. ventas de órdenes públicas)
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `stock_movements_productId_createdAt_idx`(`productId`, `createdAt`),
    INDEX `stock_movements_type_createdAt_idx`(`type`, `createdAt`),
    INDEX `stock_movements_expenseItemId_idx`(`expenseItemId`),
    INDEX `stock_movements_orderItemId_idx`(`orderItemId`),
    INDEX `stock_movements_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey: stock_movements.productId -> products.id (cascade: borrar producto borra su historial)
ALTER TABLE `stock_movements`
    ADD CONSTRAINT `stock_movements_productId_fkey`
    FOREIGN KEY (`productId`) REFERENCES `products`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: stock_movements.expenseItemId -> expense_items.id (set null al editar/borrar gasto)
ALTER TABLE `stock_movements`
    ADD CONSTRAINT `stock_movements_expenseItemId_fkey`
    FOREIGN KEY (`expenseItemId`) REFERENCES `expense_items`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: stock_movements.orderItemId -> order_items.id (set null al borrar orden, preserva ledger)
ALTER TABLE `stock_movements`
    ADD CONSTRAINT `stock_movements_orderItemId_fkey`
    FOREIGN KEY (`orderItemId`) REFERENCES `order_items`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: stock_movements.userId -> users.id (set null si el user se borra; movements del sistema ya nacen con null)
ALTER TABLE `stock_movements`
    ADD CONSTRAINT `stock_movements_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `users`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
