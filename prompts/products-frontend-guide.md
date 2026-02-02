# Guía Frontend - Módulo de Productos (Products)

Guía de implementación para el frontend del **módulo de productos**: CRUD de productos (crear, listar, obtener, actualizar, eliminar). Los productos son items genéricos/inventario que pueden usarse en órdenes o en gastos tipo MERCHANDISE; no son platillos del menú.

**Base URL:** `http://localhost:3000/api`

---

## Índice

1. [Contexto: Product vs MenuItem](#contexto-product-vs-menuitem)
2. [Endpoints y métodos HTTP](#endpoints-y-métodos-http)
3. [Crear producto](#crear-producto)
4. [Obtener producto](#obtener-producto)
5. [Listar productos](#listar-productos)
6. [Actualizar producto](#actualizar-producto)
7. [Eliminar producto](#eliminar-producto)
8. [Interfaces TypeScript](#interfaces-typescript)
9. [Validaciones y errores](#validaciones-y-errores)
10. [Ejemplos de implementación](#ejemplos-de-implementación)
11. [Uso en órdenes y gastos](#uso-en-órdenes-y-gastos)

---

## Contexto: Product vs MenuItem

**IMPORTANTE:** En este sistema, **Product** y **MenuItem** son distintos:

| Concepto    | Descripción |
|------------|-------------|
| **Product**   | Producto genérico/inventario. Se usa en órdenes como item adicional o en gastos tipo MERCHANDISE. **No** tiene extras. |
| **MenuItem**  | Platillo del menú del restaurante (hamburguesas, pizzas, etc.) que **sí** aparece en el menú y puede tener extras. |

Los productos se gestionan en **`/api/products`**. Los ítems del menú en **`/api/menu-items`**.

---

## Endpoints y métodos HTTP

| Operación        | Método   | Endpoint                        |
|------------------|----------|----------------------------------|
| Crear producto   | `POST`   | `/api/products`                  |
| Listar productos | `GET`    | `/api/products`                  |
| Obtener producto | `GET`    | `/api/products/:product_id`      |
| Actualizar producto | `PUT`  | `/api/products/:product_id`     |
| Eliminar producto | `DELETE` | `/api/products/:product_id`   |

**Autenticación:** Si el backend aplica autenticación en `/api/products`, incluir header `Authorization: Bearer <token>`.

---

## Crear producto

**Request**

```http
POST /api/products
Content-Type: application/json
```

**Body (JSON):**

| Campo         | Tipo     | Requerido | Descripción |
|---------------|----------|-----------|-------------|
| `name`        | `string` | **Sí**    | Nombre del producto (mín. 1 carácter, máx. 200). |
| `userId`      | `string` | **Sí**    | UUID del usuario que crea el producto (propietario). |
| `description` | `string` \| `null` | No | Descripción (máx. 1000 caracteres). |
| `status`      | `boolean` | No      | Activo/inactivo. Por defecto: `true`. |

**Ejemplo:**

```json
{
  "name": "Coca Cola 500ml",
  "description": "Refresco de cola en botella de 500ml",
  "status": true,
  "userId": "123e4567-e89b-12d3-a456-426614174000"
}
```

**Ejemplo mínimo (solo campos obligatorios):**

```json
{
  "name": "Agua embotellada",
  "userId": "123e4567-e89b-12d3-a456-426614174000"
}
```

**Response 200:**

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "name": "Coca Cola 500ml",
    "description": "Refresco de cola en botella de 500ml",
    "registrationDate": "2026-01-31T12:00:00.000Z",
    "status": true,
    "userId": "123e4567-e89b-12d3-a456-426614174000",
    "createdAt": "2026-01-31T12:00:00.000Z",
    "updatedAt": "2026-01-31T12:00:00.000Z"
  }
}
```

---

## Obtener producto

**Request**

```http
GET /api/products/:product_id
```

**Response 200:** Objeto producto con `id`, `name`, `description`, `registrationDate`, `status`, `userId`, `createdAt`, `updatedAt`.

**Ejemplo:**

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "name": "Coca Cola 500ml",
    "description": "Refresco de cola en botella de 500ml",
    "registrationDate": "2026-01-31T12:00:00.000Z",
    "status": true,
    "userId": "123e4567-e89b-12d3-a456-426614174000",
    "createdAt": "2026-01-31T12:00:00.000Z",
    "updatedAt": "2026-01-31T12:00:00.000Z"
  }
}
```

---

## Listar productos

**Request**

```http
GET /api/products?status=true&userId=...&search=...
```

**Query params (todos opcionales):**

| Parámetro | Tipo     | Descripción |
|-----------|----------|-------------|
| `status`  | `boolean` (string `"true"`/`"false"`) | Filtrar por activos (`true`) o inactivos (`false`). |
| `userId`  | `string` | UUID del usuario propietario. |
| `search`  | `string` | Búsqueda por nombre (parcial). |

**Response 200:** Array de productos (misma estructura que un solo producto).

```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "name": "Coca Cola 500ml",
      "description": "Refresco de cola en botella de 500ml",
      "registrationDate": "2026-01-31T12:00:00.000Z",
      "status": true,
      "userId": "123e4567-e89b-12d3-a456-426614174000",
      "createdAt": "2026-01-31T12:00:00.000Z",
      "updatedAt": "2026-01-31T12:00:00.000Z"
    }
  ]
}
```

---

## Actualizar producto

**Request**

```http
PUT /api/products/:product_id
Content-Type: application/json
```

**Body (todos los campos opcionales):**

| Campo         | Tipo     | Descripción |
|---------------|----------|-------------|
| `name`        | `string` | Nombre (mín. 1, máx. 200). |
| `description` | `string` \| `null` | Descripción (máx. 1000) o `null`. |
| `status`      | `boolean` | Activo/inactivo. |

**Nota:** `userId` y `registrationDate` **no** se pueden cambiar.

**Ejemplo:**

```json
{
  "name": "Coca Cola 500ml - Actualizado",
  "description": "Refresco de cola actualizado",
  "status": false
}
```

**Response 200:** Objeto producto actualizado (misma estructura que crear/obtener).

---

## Eliminar producto

**Request**

```http
DELETE /api/products/:product_id
```

**Response:** 200 OK (o 204 No Content según backend). El producto se elimina; si está referenciado en órdenes o gastos, el backend puede devolver error según reglas de negocio.

---

## Interfaces TypeScript

```typescript
// --- Crear ---
interface CreateProductRequest {
  name: string;                     // Obligatorio, mín. 1, máx. 200
  userId: string;                   // UUID
  description?: string | null;      // Opcional, máx. 1000
  status?: boolean;                 // Opcional, default true
}

// --- Actualizar ---
interface UpdateProductRequest {
  name?: string;                    // Opcional, mín. 1, máx. 200
  description?: string | null;      // Opcional, máx. 1000
  status?: boolean;
}

// --- Producto (respuesta crear / get / update / list) ---
interface Product {
  id: string;
  name: string;
  description: string | null;
  registrationDate: string;         // ISO 8601
  status: boolean;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

// --- Listar (query) ---
interface ListProductsQuery {
  status?: boolean;                 // true | false
  userId?: string;
  search?: string;
}

// List response: Product[] dentro de data
type ListProductsResponse = Product[];
```

---

## Validaciones y errores

**Validaciones:**
- `name`: Obligatorio en creación; mín. 1 carácter, máx. 200.
- `description`: Máx. 1000 caracteres; puede ser `null`.
- `userId`: UUID válido; el usuario debe existir.
- `status`: Boolean; por defecto `true`.

**Errores estándar del API:**

```json
{
  "success": false,
  "error": {
    "code": "CODIGO_ERROR",
    "message": "Descripción"
  }
}
```

| Código               | HTTP | Descripción |
|----------------------|------|-------------|
| `PRODUCT_NOT_FOUND`  | 404  | Producto no encontrado. |
| Errores de validación (Zod) | 400 | Campos inválidos (name vacío, userId no UUID, etc.). |

---

## Ejemplos de implementación

**Crear producto:**

```typescript
const createProduct = async (
  payload: CreateProductRequest,
  token?: string
): Promise<Product> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch('/api/products', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message ?? 'Error al crear producto');
  return json.data;
};
```

**Listar productos:**

```typescript
const listProducts = async (
  query: ListProductsQuery,
  token?: string
): Promise<Product[]> => {
  const params = new URLSearchParams();
  if (query.status !== undefined) params.set('status', String(query.status));
  if (query.userId) params.set('userId', query.userId);
  if (query.search) params.set('search', query.search);

  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`/api/products?${params.toString()}`, { headers });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message ?? 'Error al listar productos');
  return json.data;
};
```

**Obtener producto:**

```typescript
const getProduct = async (productId: string, token?: string): Promise<Product> => {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`/api/products/${productId}`, { headers });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message ?? 'Producto no encontrado');
  return json.data;
};
```

**Actualizar producto:**

```typescript
const updateProduct = async (
  productId: string,
  payload: UpdateProductRequest,
  token?: string
): Promise<Product> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`/api/products/${productId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message ?? 'Error al actualizar producto');
  return json.data;
};
```

**Eliminar producto:**

```typescript
const deleteProduct = async (productId: string, token?: string): Promise<void> => {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`/api/products/${productId}`, {
    method: 'DELETE',
    headers,
  });
  if (!res.ok) {
    const json = await res.json();
    throw new Error(json.error?.message ?? 'Error al eliminar producto');
  }
};
```

---

## Uso en órdenes y gastos

- **Órdenes:** Los productos pueden usarse como ítems de una orden (por ejemplo mediante `productId` o el identificador que use el endpoint de órdenes). Los productos **no** tienen extras.
- **Gastos MERCHANDISE:** En el módulo de gastos, los ítems de tipo MERCHANDISE llevan `productId` (UUID del producto). El backend valida que el producto exista. Ver [expenses-frontend-guide.md](./expenses-frontend-guide.md).

---

## Resumen

- **Base:** Operaciones sobre **`/api/products`** (crear, listar, obtener, actualizar, eliminar).
- **Crear:** Body con `name` y `userId` obligatorios; `description` y `status` opcionales.
- **Listar:** Query params opcionales `status`, `userId`, `search`.
- **Actualizar:** Body con `name`, `description`, `status` opcionales; `userId` no se puede cambiar.
- **Eliminar:** DELETE en `/api/products/:product_id`.
- **Product vs MenuItem:** Productos = inventario/genéricos; ítems del menú = `/api/menu-items`.
