-- Normalize existing unitOfMeasure values to enum form (column is still VARCHAR here)
UPDATE `expense_items` SET `unitOfMeasure` = 'KG' WHERE LOWER(TRIM(`unitOfMeasure`)) IN ('kg', 'kilogramo', 'kilogramos');
UPDATE `expense_items` SET `unitOfMeasure` = 'G' WHERE LOWER(TRIM(`unitOfMeasure`)) IN ('g', 'gramo', 'gramos');
UPDATE `expense_items` SET `unitOfMeasure` = 'PCS' WHERE LOWER(TRIM(`unitOfMeasure`)) IN ('pcs', 'pieza', 'piezas', 'unit', 'unidad', 'u', 'pza', 'pzas');
UPDATE `expense_items` SET `unitOfMeasure` = 'OTHER' WHERE `unitOfMeasure` IS NOT NULL AND `unitOfMeasure` NOT IN ('KG', 'G', 'PCS', 'OTHER');

-- AlterTable: change column to ENUM (Kilogramos, Gramos, Piezas, Otros)
ALTER TABLE `expense_items` MODIFY `unitOfMeasure` ENUM('KG', 'G', 'PCS', 'OTHER') NULL;
