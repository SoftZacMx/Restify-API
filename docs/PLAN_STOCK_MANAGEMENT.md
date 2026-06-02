# Plan de Implementación — Stock Management (Nivel 3: Stock + Recetas + Merma)

## Contexto

Feature: gestión completa de inventario en Restify, con **recetas** que descuentan ingredientes automáticamente al vender un platillo cocinado, además de soportar items "directos" (bebidas embotelladas, paquetes) sin receta. Incluye merma manual con motivo, ajustes por conteo físico, alertas de stock mínimo y reportes.

### Alcance

- **Sí entra**:
    - Stock real por producto, con unidad de medida (kg, g, l, ml, pcs, otros).
    - Compras (`ExpenseItem` con `type=MERCHANDISE`) **suman** stock automáticamente.
    - **Recetas** (`MenuItemIngredient`): cada `MenuItem` puede tener N ingredientes con cantidad. Al vender, se descuenta cada ingrediente proporcionalmente.
    - **Items directos**: un `MenuItem` con `productId` (1:1) y sin receta descuenta una unidad de ese producto al vender. Útil para bebidas y paquetes.
    - Items sin receta y sin `productId`: el `MenuItem` se vende sin afectar inventario (caso de transición o platos sin trackear).
    - Merma manual con motivo (vencido, roto, robo, otro).
    - Ajustes manuales después de conteo físico.
    - Alertas de stock mínimo.
    - Costo teórico de cada `MenuItem` calculado a partir de su receta y el costo promedio ponderado de cada producto.
    - Reportes: merma por periodo, top de productos consumidos, productos bajo mínimo, costo y margen por platillo.

- **No entra (diferido)**:
    - Productos compuestos / combos como un solo `MenuItem` con sub-platillos (ej. "Combo Familiar = 2 baguettes + 4 bebidas + papas grandes"). Se puede modelar como receta con productos individuales, pero no como composición de `MenuItem`s.
    - Trazabilidad por lote y vencimiento.
    - Conteos físicos masivos vía app móvil.
    - Compras a proveedores con orden de compra formal (PO).

### Base del trabajo

- Branch: `feature/stock-management` (creada desde `qa`).
- Schema actual: single-tenant (`userId` por tabla, sin `organizationId`/`branchId`).
- **Forward compat**: cuando `feature/multi-tenancy` aterrice, todas las tablas que toquemos en este plan ganarán `branch_id`. No se diseña hoy multi-sucursal en este plan, pero el modelo no impide la migración futura.

### Trade-off aceptado

Nivel 3 implica setup inicial más costoso: cargar la receta de cada platillo del menú, mantenerla cuando cambie. Y la precisión real diverge del teórico (un cocinero rara vez echa exactamente 150g de pollo). Se reconcilia con conteo físico periódico + ajustes manuales. A cambio, el owner tiene visibilidad real de consumo, costos y márgenes.

### Estrategia de adopción gradual

- El feature se implementa completo, pero el owner **no está obligado** a cargar receta de todos los platos al estrenar.
- Un `MenuItem` sin receta y sin `productId` simplemente no afecta stock al venderse (igual que hoy). Esto permite arrancar trackeando solo bebidas/empaquetados, e ir agregando recetas a los platos más vendidos cuando el owner tenga tiempo.

---

## Resumen de fases

| Fase | Nombre | Bloquea a | Estimación |
|------|--------|-----------|------------|
| 1 | Schema y migración | 2, 3, 4, 5 | 1-2 días |
| 2 | Servicio de stock (lógica core, soporta receta y directo) | 3, 4, 5 | 3 días |
| 3 | Integración con compras (ExpenseItem) | 9 | medio día |
| 4 | Integración con ventas (Order/MenuItem, con receta) | 9 | 2 días |
| 5 | Endpoints REST + auth | 6, 7, 8 | 1-2 días |
| 6 | Frontend: pantalla de stock | 9 | 2-3 días |
| 7 | Frontend: editor de receta + merma + ajustes | 9 | 3-4 días |
| 8 | Reportes (alertas, merma, costos, consumo) | 9 | 2-3 días |
| 9 | Tests y QA | 10 | 2-3 días |
| 10 | Deploy a qa y producción | — | medio día |

**Total estimado:** ~3 semanas de un dev concentrado.

---

## Fase 1 — Schema y migración

**Objetivo:** dejar las tablas y columnas listas para que el servicio escriba.

### 1.1 Modificación de la tabla `products`

Agregar:
- `stock_actual` (Decimal, default `0`).
- `unit_of_measure` (enum `UnitOfMeasure`: `KG`, `G`, `L`, `ML`, `PCS`, `OTHER`) — reusar el enum que ya existe.
- `track_stock` (Boolean, default `false`).
- `min_stock_alert` (Decimal, nullable).
- `average_cost` (Decimal, default `0`) — costo promedio ponderado calculado a partir de las compras. Se actualiza con cada `PURCHASE`.

### 1.2 Modificación de la tabla `menu_items`

- Agregar `product_id` (FK opcional a `products.id`) — para items directos sin receta (cerveza, gaseosa).
- **Regla de exclusividad**: un `MenuItem` tiene receta (filas en `menu_item_ingredients`) **O** `product_id` set, no ambos. Validación a nivel servicio.
- Si no tiene ninguno, el `MenuItem` no afecta stock al venderse.

### 1.3 Nueva tabla `menu_item_ingredients` (recetas)

```
menu_item_ingredients
- id (UUID)
- menu_item_id (FK a menu_items, NOT NULL)
- product_id (FK a products, NOT NULL)
- quantity (Decimal, NOT NULL) — cantidad consumida por unidad vendida del MenuItem
- created_at, updated_at
- @@unique([menu_item_id, product_id])
- @@index([menu_item_id])
- @@index([product_id])
```

- `ON DELETE CASCADE` desde `menu_items` (borrar plato borra su receta).
- `ON DELETE RESTRICT` desde `products` (no se puede borrar un producto si está usado en alguna receta — el owner debe sacarlo de las recetas primero).

### 1.4 Nueva tabla `stock_movements` (ledger inmutable)

```
stock_movements
- id (UUID)
- product_id (FK a products, NOT NULL)
- quantity (Decimal, FIRMADA: + entrada, − salida)
- type (enum: PURCHASE, SALE, WASTE, ADJUSTMENT, SALE_REVERSAL)
- reason (string, nullable, obligatorio para WASTE y ADJUSTMENT)
- notes (text, nullable)
- expense_item_id (FK opcional a expense_items)
- order_item_id (FK opcional a order_items)
- user_id (FK a users, NULLABLE — null cuando el movement lo origina el sistema, ej. SALE de orden pública sin user humano)
- created_at (DateTime, default now)
```

Índices:
- `(product_id, created_at desc)` — historial por producto.
- `(type, created_at desc)` — reportes por tipo.
- `(order_item_id)` — para reversiones idempotentes.
- `(expense_item_id)`.

### 1.5 Migración Prisma

- Una sola migración aditiva: agrega columnas a `products` y `menu_items`, crea `menu_item_ingredients` y `stock_movements`.
- `stock_actual` y `average_cost` arrancan en `0`. `track_stock` arranca en `false`. El owner activa explícitamente cuáles trackear.
- Sin downtime (todas las columnas tienen default).

### 1.6 Tests de la fase

- `prisma migrate deploy` corre limpio.
- Crear un `Product` con defaults; verificar `stock_actual=0`, `average_cost=0`, `track_stock=false`.
- FK constraints: no se puede crear `MenuItemIngredient` con product_id inexistente; cascade desde `menu_items` al borrar.
- Constraint `@@unique([menu_item_id, product_id])` impide duplicar el mismo ingrediente en una receta.

---

## Fase 2 — Servicio de stock (lógica core)

**Objetivo:** un único punto del código que sabe cómo mover stock, soportando tanto items directos como recetas. Nadie más toca `Product.stock_actual` directamente.

### 2.1 `StockService`

Clase en `src/core/application/services/stock.service.ts`:

```ts
class StockService {
  // Entradas
  recordPurchase(productId, quantity, unitCost, expenseItemId, userId, notes?): Promise<StockMovement>
  
  // Salidas — el método principal: resuelve si es item directo o con receta
  recordSaleForOrderItem(orderItem, userId): Promise<StockMovement[]>
  reverseSaleForOrderItem(orderItemId, userId, reason): Promise<StockMovement[]>
  
  // Manuales
  recordWaste(productId, quantity, reason, userId, notes?): Promise<StockMovement>
  recordAdjustment(productId, newStock, reason, userId, notes?): Promise<StockMovement>
  
  // Lecturas
  getStockSummary(filters): Promise<StockSummary[]>
  getMovements(filters): Promise<StockMovement[]>
}
```

### 2.2 Cómo `recordSaleForOrderItem` decide qué descontar

Lógica del método (todo dentro de un `prisma.$transaction`):

1. Recibir el `orderItem` (que trae `menuItemId` y `quantity`).
2. Buscar el `MenuItem` con su receta y su `productId` (si tiene).
3. **Caso A — receta**: si hay filas en `menu_item_ingredients`, por cada ingrediente:
    - `movementQty = -ingredient.quantity * orderItem.quantity`.
    - Crear `StockMovement(type=SALE, productId=ingredient.productId, quantity=movementQty, orderItemId, userId)`.
    - `UPDATE products SET stock_actual = stock_actual + movementQty WHERE id = ingredient.productId`.
    - Solo si el producto tiene `track_stock=true`. Si no, skip ese ingrediente sin error.
4. **Caso B — directo**: si no hay receta pero hay `menuItem.productId` y ese producto tiene `track_stock=true`:
    - `movementQty = -orderItem.quantity` (1 a 1, asumiendo que la unidad del producto matchea con "una unidad vendida").
    - Crear movement y actualizar stock.
5. **Caso C — nada**: ni receta ni `productId`, o todos los productos tienen `track_stock=false` → no-op silencioso.
6. Devolver el array de movements creados.

### 2.3 Cómo `reverseSaleForOrderItem` deshace una venta

1. Buscar todos los movements con `orderItemId = X` y `type = SALE`.
2. Para cada uno, crear un movement con `type = SALE_REVERSAL` y `quantity = -original.quantity` (o sea, positivo).
3. Actualizar `products.stock_actual` correspondientemente.
4. **Idempotente**: si ya existe un `SALE_REVERSAL` para ese `orderItemId`, no duplica (chequear antes).

### 2.4 Costo promedio ponderado al comprar

Cuando se llama `recordPurchase(productId, quantity, unitCost, ...)`:

1. Antes de actualizar el stock, calcular el nuevo `average_cost`:
    ```
    nuevoCosto = (stockActual * averageCostActual + quantity * unitCost) / (stockActual + quantity)
    ```
2. Si `stockActual + quantity = 0` (raro, casi nunca), usar `unitCost` directamente.
3. Actualizar `products.stock_actual` y `products.average_cost` en la misma operación.
4. El `unitCost` viene del `ExpenseItem.subtotal / amount`.

Esto permite calcular el costo teórico de cada `MenuItem` después.

### 2.5 Reglas y validaciones

- **Atomicidad**: todo dentro de `prisma.$transaction`.
- **`track_stock=false`**: no-op para ese producto. Útil cuando la receta tiene un ingrediente que el owner no quiere trackear (ej. mayonesa sí, sal no).
- **Stock negativo**: permitido pero loggeado (warning). Restaurantes a veces venden antes de cargar la compra.
- **Reversiones**: idempotentes. Cancelar dos veces no duplica.
- **Validación de receta vs producto directo**: a nivel servicio, no permitir un `MenuItem` con receta Y `product_id` set (mutuamente excluyente).

### 2.6 Tests de la fase

Tests unitarios sobre `StockService`, con DB de test sembrada.

- **Receta**:
    - Sembrar un `MenuItem` "Baguette" con receta de 5 ingredientes, todos con `track_stock=true`.
    - Llamar `recordSaleForOrderItem` con `quantity=2` → 5 movements creados, cada producto descontado por `quantity_receta * 2`.
    - Llamar `reverseSaleForOrderItem` → 5 movements de tipo `SALE_REVERSAL` que restauran el stock.
- **Receta con un ingrediente sin track_stock**:
    - 4 ingredientes con track, 1 sin → solo 4 movements.
- **Item directo**:
    - `MenuItem.productId` set, sin receta → 1 movement con cantidad = `orderItem.quantity`.
- **Item sin tracking**:
    - Ni receta ni `productId` → 0 movements, sin error.
- **Mutua exclusión**: intentar guardar un `MenuItem` con receta Y `productId` → error de validación.
- **Costo promedio**:
    - Stock 10, costo 5. Comprar 5 a costo 7. Nuevo costo = (10*5 + 5*7) / 15 = 5.67.
    - Stock 0, comprar 10 a costo 8 → costo = 8.
- **Idempotencia de reversal**: llamar `reverseSaleForOrderItem` dos veces para el mismo `orderItemId` → solo se crea una vez el reversal.
- **Invariante**: `Product.stock_actual === sum(StockMovement.quantity WHERE product_id = X)` para cualquier producto en cualquier momento.

---

## Fase 3 — Integración con compras (ExpenseItem)

**Objetivo:** registrar una compra de mercadería actualiza stock y costo promedio automáticamente.

### 3.1 Hook en el caso de uso de Expense

- En `CreateExpenseUseCase`, después de crear los `ExpenseItem` con `type=MERCHANDISE`:
    - Para cada item:
        - `unitCost = item.subtotal / item.amount`.
        - `StockService.recordPurchase(productId, amount, unitCost, expenseItemId, userId, notes)`.
- Todo en la misma transacción que la creación del Expense.

### 3.2 Edición / eliminación de Expense

- Edición de `amount` o `subtotal`: generar un movement compensatorio (`type=ADJUSTMENT`, razón "expense edited") con la diferencia. No tocar el original.
- Eliminación: generar un movement de tipo `ADJUSTMENT` con cantidad opuesta. El movement original queda como historial.

### 3.3 Tests de la fase

- E2E: crear `Expense MERCHANDISE` con 3 items → 3 movements de `PURCHASE`, stock y costo promedio actualizados.
- E2E: editar `amount` de un item → movement compensatorio.
- E2E: producto con `track_stock=false` no genera movement aunque la compra se registre, pero `average_cost` igual se actualiza (para que al activar `track_stock` después tenga el costo correcto).

---

## Fase 4 — Integración con ventas (Order / OrderItem)

**Objetivo:** vender un `MenuItem` con receta o item directo descuenta stock automáticamente.

### 4.1 Cuándo se descuenta

**Decisión:** el descuento ocurre cuando el `OrderItem` se crea (orden creada o item agregado), no al pagar. La cocina ya saca los productos del depósito al armar el plato, independientemente de si el cliente paga después.

- En `CreateOrderUseCase` y `UpdateOrderUseCase` (cuando reemplaza items), después de persistir cada `OrderItem`:
    - `StockService.recordSaleForOrderItem(orderItem.id, userId, tx)`.
- En `CreatePublicOrderUseCase`: igual, con `userId = null`. Las órdenes públicas también consumen producto, así que descuentan stock; el movement queda atribuido al sistema (no a un user humano). Por eso `stock_movements.userId` es nullable.

### 4.2 Reversión por cancelación o eliminación

- Cancelar/borrar orden (`DeleteOrderUseCase`) → para cada `OrderItem`, `reverseSaleForOrderItem(orderItem.id, actorUserId, "order cancelled", tx)`. El `actorUserId` viene del `req.user` del admin/manager autenticado que ejecuta el delete (puede ser null si la acción es del sistema).
- Eliminar un `OrderItem` específico (a través del reemplazo de items en `UpdateOrderUseCase`) → idem para cada item viejo, con `reason: 'order edited'`.
- **Idempotencia**: si ya existe un `SALE_REVERSAL` para ese `orderItemId`, no se duplica (chequea antes de crear).

### 4.3 Edición de items en una orden

`UpdateOrderUseCase` reemplaza los items de una orden por una lista nueva. Estrategia "**reversal + resale**" dentro de una sola transacción:

1. Snapshot de items actuales.
2. Por cada item viejo: `reverseSaleForOrderItem(item.id, actorUserId, 'order edited', tx)`.
3. Borrar `orderItemExtras` y `orderItems` viejos.
4. Crear los items+extras nuevos.
5. Por cada item nuevo: `recordSaleForOrderItem(newItem.id, actorUserId, tx)`.

Más simple que generar movements diferenciales y mantiene el ledger limpio (un `SALE` original + un `SALE_REVERSAL` + un `SALE` nuevo, todos linkeados al `orderItemId` correspondiente).

### 4.4 Tests de la fase

- E2E: crear orden con `MenuItem` de receta → N movements según ingredientes, stock baja.
- E2E: crear orden con `MenuItem` directo → 1 movement, stock baja.
- E2E: crear orden con `MenuItem` sin tracking → 0 movements.
- E2E: cancelar orden → reversals correctos por cada item.
- E2E: editar cantidad de un item → movements diferenciales correctos.
- Idempotencia: cancelar dos veces no duplica reversals.
- E2E mixto: una orden con `MenuItem` de receta + `MenuItem` directo + `MenuItem` sin tracking → todos los descuentos correctos.

---

## Fase 5 — Endpoints REST

**Objetivo:** exponer la lógica del servicio para el frontend.

### 5.1 Endpoints de stock

| Método | Ruta | Descripción | Auth |
|---|---|---|---|
| `GET` | `/api/products/stock` | Lista de productos con `track_stock=true`, su stock actual, unit, costo promedio, indicador de alerta. Filtros: `?lowStock=true&search=&categoryId=`. | Autenticado |
| `GET` | `/api/products/:id/movements` | Historial filtrable por producto. Filtros: `?from=&to=&type=`. | Autenticado |
| `POST` | `/api/stock/waste` | Registrar merma. Body: `{ productId, quantity, reason: 'EXPIRED' \| 'BROKEN' \| 'THEFT' \| 'OTHER', notes? }`. | `MANAGER`+ |
| `POST` | `/api/stock/adjust` | Ajuste de stock. Body: `{ productId, newStock, reason, notes? }`. | `MANAGER`+ |
| `GET` | `/api/stock/movements` | Historial general filtrable. | Autenticado |
| `GET` | `/api/stock/alerts` | Productos bajo mínimo. | Autenticado |
| `PATCH` | `/api/products/:id/stock-config` | Configurar `track_stock`, `unit_of_measure`, `min_stock_alert`. | `ADMIN`+ |

### 5.2 Endpoints de recetas

| Método | Ruta | Descripción | Auth |
|---|---|---|---|
| `GET` | `/api/menu-items/:id/recipe` | Devuelve la receta del `MenuItem` (lista de ingredientes con quantity y producto). | Autenticado |
| `PUT` | `/api/menu-items/:id/recipe` | Reemplaza la receta completa. Body: `{ ingredients: [{ productId, quantity }, ...] }`. Útil para edición masiva en UI. | `ADMIN`+ |
| `POST` | `/api/menu-items/:id/recipe/items` | Agregar un ingrediente. Body: `{ productId, quantity }`. | `ADMIN`+ |
| `PATCH` | `/api/menu-items/:id/recipe/items/:productId` | Cambiar la cantidad de un ingrediente existente. | `ADMIN`+ |
| `DELETE` | `/api/menu-items/:id/recipe/items/:productId` | Quitar un ingrediente. | `ADMIN`+ |

### 5.3 Endpoints de reportes

| Método | Ruta | Descripción | Auth |
|---|---|---|---|
| `GET` | `/api/reports/waste?from=&to=` | Merma agrupada por motivo en un rango. | `MANAGER`+ |
| `GET` | `/api/reports/products/consumption?from=&to=&top=` | Top productos consumidos por periodo (movimientos negativos). | `MANAGER`+ |
| `GET` | `/api/reports/menu-items/cost` | Costo teórico y margen por `MenuItem` (precio venta − suma de `quantity * average_cost` de cada ingrediente). | `MANAGER`+ |

### 5.4 Validaciones

- `quantity > 0` en endpoints de waste y receta. El servicio convierte a negativo cuando corresponde.
- `productId` debe pertenecer al tenant.
- `ingredients` no vacío en `PUT /recipe`. Permitir vacío significa borrar la receta — usar `DELETE` para eso explícitamente.
- Mutua exclusión: no permitir un `MenuItem` con `productId` que tenga receta cargada.

### 5.5 Tests de la fase

- 200 con body válido.
- 400 con body inválido.
- 403 si rol insuficiente.
- 404 si `MenuItem` o `Product` no existe.
- Aislamiento single-tenant: producto/recipe de otro user no aparecen.

---

## Fase 6 — Frontend: pantalla de stock

**Objetivo:** el owner/manager ve el inventario y filtra alertas.

### 6.1 Sidebar

- Item "Stock" en el menú lateral, visible para `ADMIN`, `MANAGER`, `OWNER`. Oculto para `WAITER`, `CHEF`.
- Ícono: `Package` o `Boxes` (lucide-react).

### 6.2 Página principal `/stock`+

- Tabla: nombre, categoría, stock actual, unidad, mínimo, costo promedio, indicador visual (verde / amarillo / rojo).
- Filtros: búsqueda, "solo bajo mínimo", por categoría.
- Botón "Registrar merma" (modal en Fase 7).
- Botón "Ajustar stock" (modal en Fase 7).
- Botón por fila "Ver historial" → `/stock/products/:id/movements`.

### 6.3 Sección "Inventario" en edición de producto

- En la pantalla de edición de `Product` (existente), agregar:
    - Toggle `track_stock`.
    - Si on: select `unit_of_measure`, input `min_stock_alert`.
    - Botón "Guardar configuración" → `PATCH /api/products/:id/stock-config`.

### 6.4 Tests de la fase

- Component test: la tabla renderiza con datos mock; filtros funcionan.
- Component test: el toggle `track_stock` muestra/oculta dependientes.
- Component test: rol `WAITER` no ve el item de sidebar.

---

## Fase 7 — Frontend: editor de receta + merma + ajustes

**Objetivo:** cargar recetas y registrar merma/ajustes desde la UI con fricción mínima.

### 7.1 Editor de receta en la pantalla de `MenuItem`

En la pantalla de creación/edición de un `MenuItem` (`MenuItemsPage.tsx`), agregar una sección "Receta" debajo de los datos básicos.

- **Modo selector**: arriba de la sección, un radio:
    - "Item directo (1 producto)": muestra select para elegir un producto. Sin tabla de ingredientes.
    - "Platillo con receta (N ingredientes)": muestra la tabla editable.
    - "Sin tracking (no afecta stock)": ambas opciones ocultas.
- **Tabla de receta** (cuando aplica):
    - Filas: producto (select con búsqueda), cantidad (numérico con la unidad del producto), botón eliminar.
    - Botón "Agregar ingrediente" al final.
    - Validación: no permitir el mismo producto dos veces, cantidad > 0.
- Al guardar el `MenuItem`, se llama a `PUT /api/menu-items/:id/recipe` con el array de ingredientes (o se borra la receta si pasó a modo directo / sin tracking).

### 7.2 Modal "Registrar merma"

- Inputs: producto (select con búsqueda), cantidad (numérico con unidad), motivo (radio: Vencido, Roto, Robo, Otro), notas (textarea).
- Validación inline: cantidad > 0, motivo obligatorio.
- Al confirmar: `POST /api/stock/waste`, toast de éxito, recarga tabla.

### 7.3 Modal "Ajuste de stock"

- Inputs: producto (preseleccionado si se abrió desde fila), stock actual (readonly), nuevo stock (input), motivo (texto libre obligatorio).
- Preview: "Stock pasará de X a Y (diferencia: ±Z)".
- Al confirmar: `POST /api/stock/adjust`.

### 7.4 Página de historial por producto

- Tabla cronológica: fecha, tipo (badge), cantidad firmada, razón, user.
- Filtros: rango de fechas, tipo.
- Export a CSV (opcional).

### 7.5 Indicador en la lista de menú

- En la tabla de `MenuItems`, columna nueva "Stock":
    - 🥗 ícono receta (verde) si tiene receta cargada.
    - 📦 ícono producto (azul) si es item directo.
    - ⚠️ alerta amarilla si no tiene tracking configurado.
- Permite al owner ver de un vistazo qué platos faltan por configurar.

### 7.6 Tests de la fase

- Component test del editor de receta:
    - Al elegir "Platillo con receta", se muestra la tabla.
    - Agregar/quitar ingrediente.
    - Validación: mismo producto duplicado se bloquea.
    - Al guardar, se llama al endpoint correcto.
- Component test del modal de merma: validación, integración endpoint.
- Component test del modal de ajuste: preview de diferencia.
- Component test del historial: ordena por fecha desc.
- Component test del indicador: ícono correcto según el estado del `MenuItem`.

---

## Fase 8 — Reportes

**Objetivo:** dar al owner visibilidad de pérdida, consumo y márgenes.

### 8.1 Reporte "Merma por periodo"

- Endpoint: `GET /api/reports/waste`.
- UI: gráfico de barras (Recharts) con totales por motivo, tabla detallada, total general en valor (cantidad × `average_cost`).
- Acceso: `MANAGER`+.

### 8.2 Reporte "Productos bajo mínimo"

- Endpoint: ya cubierto en `GET /api/stock/alerts`.
- UI: tabla resaltada en rojo. Botón "Crear gasto de compra" pre-llena un form de gasto con esos productos.

### 8.3 Reporte "Top productos consumidos"

- Endpoint: `GET /api/reports/products/consumption`.
- UI: ranking de los N productos con mayor cantidad descontada (suma de movements `SALE` en valor absoluto). Tabla con columnas: producto, cantidad consumida, valor consumido (cantidad × `average_cost`), participación %.
- Útil para saber qué hay que comprar más seguido.

### 8.4 Reporte "Costo y margen por platillo"

- Endpoint: `GET /api/reports/menu-items/cost`.
- Para cada `MenuItem` con receta:
    - **Costo teórico** = `sum(ingrediente.quantity * producto.average_cost)`.
    - **Margen** = `precio_venta − costo_teórico`.
    - **Margen %** = `(margen / precio_venta) * 100`.
- UI: tabla ordenable por margen %, costo, precio. Resalta los platos con margen bajo (< 30%).
- Útil para el owner que quiere subir precio o cambiar receta.

### 8.5 Movimientos del día

- Sección en el dashboard mostrando los últimos N movements.
- Card simple: tipo, producto, cantidad, hora.

### 8.6 Tests de la fase

- Reporte de merma agrupa correctamente por motivo en un rango dado.
- Reporte de consumo top N coincide con la suma de movements.
- Costo teórico se calcula correctamente con receta sembrada.
- Productos sin alerta configurada no aparecen en `/stock/alerts`.

---

## Fase 9 — Tests y QA

**Objetivo:** confianza para mergear a `qa` y desplegar.

### 9.1 E2E del flujo completo

1. Crear productos: `Pollo (KG)`, `Pan baguette (PCS)`, `Lechuga (G)`, todos con `track_stock=true`.
2. Crear `MenuItem` "Baguette de Pollo" con receta:
    - 1 PCS pan, 0.150 KG pollo, 30 G lechuga.
3. Crear `Expense MERCHANDISE`:
    - 50 PCS pan a $5 c/u.
    - 5 KG pollo a $200/kg.
    - 1000 G lechuga a $0.05/g.
    - Verificar stock: pan=50, pollo=5, lechuga=1000.
    - Verificar `average_cost`: pan=$5, pollo=$200/kg, lechuga=$0.05/g.
4. Crear orden con 3 baguettes.
    - Verificar movements: pan=-3, pollo=-0.450, lechuga=-90.
    - Stock: pan=47, pollo=4.55, lechuga=910.
5. Cancelar la orden → reversals, stock vuelve a 50, 5, 1000.
6. Registrar merma de pollo: 0.5 KG, motivo "vencido".
    - Stock: pollo=4.5.
7. Ajustar lechuga a 950 (conteo físico) → movement de `-50`, stock=950.
8. Verificar reporte de costo:
    - Costo teórico baguette = 1*5 + 0.150*200 + 30*0.05 = 5 + 30 + 1.5 = $36.50.
    - Si precio de venta es $80, margen = $43.50 (54.4%).
9. Verificar `alerts`: si min_stock_alert de pollo es 1 KG, no aparece. Si es 5 KG, sí.

### 9.2 Tests de coherencia

- **Invariante**: `Product.stock_actual === sum(StockMovement.quantity)` para cualquier producto.
- Job de validación que se puede correr manualmente para detectar inconsistencias.

### 9.3 Performance

- Tabla de stock con 500 productos paginada o virtualizada.
- Historial con miles de filas responde rápido (índice `(product_id, created_at desc)`).
- Crear una orden con un `MenuItem` con receta de 10 ingredientes no aumenta significativamente el tiempo de respuesta (transacción acotada).

### 9.4 Edge cases

- `track_stock` cambiado de `true` a `false` en un producto que está en una receta: la venta del `MenuItem` no descuenta ese ingrediente, pero el resto sí.
- Borrar un `Product` que está en alguna receta: bloqueado por FK `RESTRICT`, mensaje claro al user.
- Borrar un `MenuItem` con receta: cascade borra `menu_item_ingredients`.
- Receta con un `Product` inexistente: imposible por FK.
- `MenuItem` con receta vacía (0 ingredientes): se trata como "sin tracking".
- Orden con 0 items o cancelada antes de tener items: no genera movements.

---

## Fase 10 — Deploy

**Objetivo:** llevar el feature a `qa` y producción.

### 10.1 Pre-deploy

- Merge de `feature/stock-management` a `qa` por PR.
- Tests CI pasan.
- Smoke test manual en `qa`.

### 10.2 Migración

- `prisma migrate deploy` corre la migración aditiva.
- Sin downtime (todas las columnas tienen default).
- Productos existentes quedan con `track_stock=false` y `average_cost=0`. El feature está "off" hasta que el owner active producto por producto.
- `MenuItem`s existentes quedan sin receta. No hay impacto en ventas actuales.

### 10.3 Validación post-deploy

- Pantallas existentes (`/products`, `/menu-items`, `/expenses`, `/orders`) siguen funcionando.
- Nueva pantalla `/stock` carga.
- Probar: prender `track_stock` en un producto, registrar compra, ver stock subir. Crear receta de un `MenuItem`, vender, ver descuento.

### 10.4 Comunicación al cliente

- Mensaje al owner: "Nueva funcionalidad de inventario y recetas. Activá los productos a trackear desde Productos, y cargá la receta de tus platillos para descuento automático."
- Guía corta con ejemplo de baguette de pollo.

---

## Criterios de "listo" (Definition of Done)

- [ ] Schema migrado: `products` con columnas nuevas, `menu_items` con `product_id`, tablas `menu_item_ingredients` y `stock_movements` creadas.
- [ ] `StockService` implementado con todos los métodos y tests unitarios pasando.
- [ ] Compras (`Expense MERCHANDISE`) generan automáticamente movements `PURCHASE` y actualizan `average_cost`.
- [ ] Ventas de `MenuItem` con receta generan movements por cada ingrediente trackeado.
- [ ] Ventas de `MenuItem` directo generan 1 movement.
- [ ] Cancelación / edición de orden genera reversals correctos.
- [ ] Endpoints de stock y recetas documentados y con tests de validación + auth.
- [ ] Editor de receta en frontend permite agregar/editar/borrar ingredientes con validación.
- [ ] Pantalla `/stock` muestra inventario con alertas.
- [ ] Modales de merma y ajuste funcionan.
- [ ] Reporte de merma por periodo, top consumo, costo y margen por platillo accesibles.
- [ ] Invariante `Product.stock_actual === sum(StockMovement.quantity)` se mantiene en todos los flujos.
- [ ] Productos con `track_stock=false` no son afectados.
- [ ] Mutua exclusión `MenuItem.productId` vs receta validada en backend y UI.
- [ ] E2E del flujo completo (Fase 9.1) pasa.

--
## Apéndice — Decisiones diferidas (no bloquean este plan)

- **Productos compuestos / combos** como composición de varios `MenuItem`s (ej. "Combo Familiar" que incluye 2 baguettes + 4 bebidas). Hoy se modela como receta con productos individuales. Si más adelante hace falta una jerarquía `MenuItem → MenuItem`, se introduce.
- **Stock por sucursal**: cuando `feature/multi-tenancy` aterrice, agregar `branch_id` a `stock_movements` y considerar si `stock_actual` y `average_cost` deben moverse a una tabla `branch_product_stock`.
- **Trazabilidad por lote / vencimientos**: tabla `ProductBatch` con fecha de vencimiento, FIFO al descontar. Útil para perecederos.
- **Conteos físicos masivos**: pantalla "Inventario rápido" que carga todos los productos y permite ajustar en batch (idealmente con app móvil que escanea códigos).
- **Compras a proveedores con orden de compra (PO)**: workflow más formal que `Expense` (cotización → orden → recepción parcial).
- **Costo FIFO o LIFO** en lugar de promedio ponderado. Hoy promedio es lo más simple y suficiente para márgenes.
- **Alertas push / email** cuando un producto cae bajo mínimo. Hoy solo es visible en la pantalla de alertas.
- **Bloqueo de venta cuando stock = 0**: hoy se permite stock negativo silenciosamente. Configurable más adelante con un toggle global o por producto.
- **Versionado de recetas**: si la receta cambia, los reportes históricos calculan costo con la receta de hoy, no la del momento de la venta. Para reportes precisos a futuro, se podría versionar (overhead alto, valor bajo en MVP).
- **Mermas automáticas por proporción** (ej. "siempre se pierde 5% de pollo al cocinar"): hoy es manual. Modelable como factor de receta más adelante.
- **Integración con balanzas / códigos de barra**: lectura directa al cargar compras o hacer conteos. Diferido.
