-- Backfill de branchId nulos en registros de pago legacy.
-- Las filas con branchId NULL escapan del aislamiento por sucursal (el filtro de
-- lectura por id las deja pasar y los listados del comercio no las ven). Se deriva
-- la sucursal de la orden relacionada; lo que no se pueda derivar queda NULL y se
-- revisa a mano.

-- Pagos: sucursal de su orden
UPDATE payments p
INNER JOIN orders o ON p.orderId = o.id
SET p.branchId = o.branchId
WHERE p.branchId IS NULL
  AND o.branchId IS NOT NULL;

-- Sesiones de pago: sucursal de su pago
UPDATE payment_sessions ps
INNER JOIN payments p ON ps.paymentId = p.id
SET ps.branchId = p.branchId
WHERE ps.branchId IS NULL
  AND p.branchId IS NOT NULL;

-- Reembolsos: sucursal de su pago
UPDATE refunds r
INNER JOIN payments p ON r.paymentId = p.id
SET r.branchId = p.branchId
WHERE r.branchId IS NULL
  AND p.branchId IS NOT NULL;

-- Diferenciaciones de pago dividido: sucursal de su orden
UPDATE payments_differentiations pd
INNER JOIN orders o ON pd.orderId = o.id
SET pd.branchId = o.branchId
WHERE pd.branchId IS NULL
  AND o.branchId IS NOT NULL;
