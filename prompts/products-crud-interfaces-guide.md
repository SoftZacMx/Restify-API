# Guía de Interfaces Frontend - CRUD de Productos

Este documento describe las interfaces TypeScript/JavaScript que el frontend debe implementar para el CRUD (Create, Read, Update, Delete) de productos, asegurando compatibilidad total con el backend.

## 📋 Índice

1. [Contexto: ¿Qué es un Product?](#contexto-qué-es-un-product)
2. [Interfaces de Request (Envío al Backend)](#interfaces-de-request)
3. [Interfaces de Response (Respuesta del Backend)](#interfaces-de-response)
4. [Endpoints y Métodos HTTP](#endpoints-y-métodos-http)
5. [Validaciones y Reglas de Negocio](#validaciones-y-reglas-de-negocio)
6. [Ejemplos Completos](#ejemplos-completos)
7. [Uso en Órdenes](#uso-en-órdenes)

---

## Contexto: ¿Qué es un Product?

**IMPORTANTE:** En este sistema, un `Product` es diferente de un `MenuItem`:

- **Product**: Producto genérico/inventario que puede venderse en órdenes pero NO es parte del menú del restaurante. Se usa para productos adicionales, inventario, o items que no son platillos.
- **MenuItem**: Platillo del menú del restaurante (hamburguesas, pizzas, etc.) que SÍ aparece en el menú.

**Nota:** Los productos NO pueden tener extras. Solo los `MenuItem` pueden tener extras asociados.

---

## Interfaces de Request

### 1. CreateProductRequest

Interfaz para crear un nuevo producto.

```typescript
interface CreateProductRequest {
  name: string;                    // REQUERIDO - Nombre del producto (mín 1, máx 200 caracteres)
  description?: string | null;      // Opcional - Descripción del producto (máx 1000 caracteres)
  status?: boolean;                 // Opcional - Estado activo/inactivo (default: true)
  userId: string;                    // REQUERIDO - UUID del usuario que crea el producto
}
```

**Reglas de Validación:**
- `name`: Requerido, mínimo 1 carácter, máximo 200 caracteres
- `description`: Opcional, máximo 1000 caracteres si se proporciona
- `status`: Opcional, default `true` (activo)
- `userId`: Requerido, debe ser un UUID válido y el usuario debe existir

---

### 2. UpdateProductRequest

Interfaz para actualizar un producto existente.

```typescript
interface UpdateProductRequest {
  name?: string;                    // Opcional - Nombre del producto (mín 1, máx 200 caracteres)
  description?: string | null;      // Opcional - Descripción (máx 1000 caracteres, puede ser null)
  status?: boolean;                 // Opcional - Estado activo/inactivo
}
```

**Reglas de Validación:**
- Todos los campos son opcionales
- Si se envía `name`, debe cumplir las mismas reglas que en create
- Si se envía `description`, máximo 1000 caracteres
- `userId` NO se puede actualizar (es inmutable)

---

### 3. ListProductsRequest (Query Parameters)

Interfaz para filtrar la lista de productos.

```typescript
interface ListProductsRequest {
  status?: boolean;                 // Filtrar por estado (true = activos, false = inactivos)
  userId?: string;                  // Filtrar por usuario (UUID)
  search?: string;                  // Buscar por nombre (búsqueda parcial)
}
```

**Nota:** Todos los parámetros son opcionales. Si no se envían, se devuelven todos los productos.

---

## Interfaces de Response

### 1. CreateProductResponse

Respuesta al crear un producto.

```typescript
interface CreateProductResponse {
  id: string;                       // UUID del producto creado
  name: string;
  description: string | null;
  registrationDate: string;        // ISO 8601 date string
  status: boolean;
  userId: string;                   // UUID del usuario propietario
  createdAt: string;               // ISO 8601 date string
  updatedAt: string;               // ISO 8601 date string
}
```

---

### 2. GetProductResponse

Respuesta al obtener un producto (misma estructura que CreateProductResponse).

```typescript
interface GetProductResponse {
  // Misma estructura que CreateProductResponse
  id: string;
  name: string;
  description: string | null;
  registrationDate: string;
  status: boolean;
  userId: string;
  createdAt: string;
  updatedAt: string;
}
```

---

### 3. ListProductsResponse

Respuesta al listar productos (array de productos).

```typescript
interface ListProductsResponse extends Array<GetProductResponse> {}
// O simplemente:
type ListProductsResponse = GetProductResponse[];
```

---

### 4. UpdateProductResponse

Respuesta al actualizar un producto (misma estructura que CreateProductResponse).

```typescript
interface UpdateProductResponse {
  // Misma estructura que CreateProductResponse
  id: string;
  name: string;
  description: string | null;
  registrationDate: string;
  status: boolean;
  userId: string;
  createdAt: string;
  updatedAt: string;
}
```

---

### 5. DeleteProductResponse

Respuesta al eliminar un producto.

```typescript
// DELETE devuelve 204 No Content (sin body)
// O 200 OK con:
interface DeleteProductResponse {
  success: boolean;
  message?: string;
}
```

---

## Endpoints y Métodos HTTP

### Crear Producto
- **Endpoint:** `POST /api/products`
- **Autenticación:** Requerida
- **Content-Type:** `application/json`
- **Request:** `CreateProductRequest`
- **Response:** `CreateProductResponse` (200 OK)

### Obtener Producto
- **Endpoint:** `GET /api/products/:product_id`
- **Autenticación:** Requerida
- **Request:** Ninguno (product_id en URL)
- **Response:** `GetProductResponse` (200 OK)

### Listar Productos
- **Endpoint:** `GET /api/products?status=true&userId=...&search=...`
- **Autenticación:** Requerida
- **Request:** Query parameters opcionales (`ListProductsRequest`)
- **Response:** `ListProductsResponse` (200 OK) - Array de productos

### Actualizar Producto
- **Endpoint:** `PUT /api/products/:product_id`
- **Autenticación:** Requerida
- **Content-Type:** `application/json`
- **Request:** `UpdateProductRequest`
- **Response:** `UpdateProductResponse` (200 OK)

### Eliminar Producto
- **Endpoint:** `DELETE /api/products/:product_id`
- **Autenticación:** Requerida
- **Request:** Ninguno
- **Response:** 204 No Content o 200 OK

---

## Validaciones y Reglas de Negocio

### Validaciones del Frontend (antes de enviar)

1. **CreateProductRequest:**
   - `name`: No vacío, máximo 200 caracteres
   - `description`: Máximo 1000 caracteres si se proporciona
   - `userId`: UUID válido
   - `status`: Boolean (default: true)

2. **UpdateProductRequest:**
   - Todos los campos son opcionales
   - Si se envía `name`, debe cumplir las mismas reglas que en create
   - Si se envía `description`, máximo 1000 caracteres

3. **ListProductsRequest:**
   - `status`: Boolean (true/false)
   - `userId`: UUID válido
   - `search`: String (búsqueda por nombre)

### Reglas de Negocio del Backend

1. **Usuario debe existir:** El `userId` debe referenciar un usuario válido
2. **userId es inmutable:** No se puede cambiar el propietario de un producto
3. **registrationDate es automático:** Se asigna automáticamente al crear, no se puede modificar
4. **Soft delete:** Al eliminar, el producto se marca como inactivo (si aplica) o se elimina físicamente
5. **Productos en órdenes:** Si un producto está en órdenes existentes, verificar si se puede eliminar

---

## Ejemplos Completos

### Ejemplo 1: Crear Producto (Request)

```json
{
  "name": "Coca Cola 500ml",
  "description": "Refresco de cola en botella de 500ml",
  "status": true,
  "userId": "123e4567-e89b-12d3-a456-426614174000"
}
```

### Ejemplo 2: Respuesta del Backend (CreateProductResponse)

```json
{
  "id": "product-123",
  "name": "Coca Cola 500ml",
  "description": "Refresco de cola en botella de 500ml",
  "registrationDate": "2024-01-15T10:30:00.000Z",
  "status": true,
  "userId": "123e4567-e89b-12d3-a456-426614174000",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

### Ejemplo 3: Actualizar Producto (Request)

```json
{
  "name": "Coca Cola 500ml - Actualizado",
  "description": "Refresco de cola actualizado",
  "status": false
}
```

**Nota:** Solo envía los campos que quieres actualizar. Los demás permanecen igual.

### Ejemplo 4: Listar Productos con Filtros

**Request:**
```
GET /api/products?status=true&userId=123e4567-e89b-12d3-a456-426614174000&search=coca
```

**Response:**
```json
[
  {
    "id": "product-123",
    "name": "Coca Cola 500ml",
    "description": "Refresco de cola en botella de 500ml",
    "registrationDate": "2024-01-15T10:30:00.000Z",
    "status": true,
    "userId": "123e4567-e89b-12d3-a456-426614174000",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  },
  {
    "id": "product-124",
    "name": "Coca Cola 1L",
    "description": "Refresco de cola en botella de 1 litro",
    "registrationDate": "2024-01-15T11:00:00.000Z",
    "status": true,
    "userId": "123e4567-e89b-12d3-a456-426614174000",
    "createdAt": "2024-01-15T11:00:00.000Z",
    "updatedAt": "2024-01-15T11:00:00.000Z"
  }
]
```

### Ejemplo 5: Producto Mínimo (Request)

```json
{
  "name": "Agua embotellada",
  "userId": "123e4567-e89b-12d3-a456-426614174000"
}
```

**Nota:** `description` y `status` son opcionales. Si no se envían, `description` será `null` y `status` será `true`.

---

## Uso en Órdenes

### Cómo usar Productos en una Orden

Los productos se pueden agregar a una orden usando el campo `itemId` en `OrderItemRequest`:

```typescript
interface CreateOrderRequest {
  // ... otros campos de la orden
  orderItems: [
    {
      itemId: "product-123",  // ← ID del producto
      quantity: 2,
      price: 25.00,
      note: "Producto adicional",
      extras: []  // ← Los productos NO pueden tener extras
    }
  ]
}
```

**IMPORTANTE:**
- Los productos se identifican por su `id` (UUID)
- Los productos NO pueden tener extras (solo `MenuItem` puede tener extras)
- El `price` en la orden puede ser diferente al precio base del producto (permite variaciones)

---

## Tipos TypeScript Completos

```typescript
// ============================================
// REQUEST INTERFACES
// ============================================

export interface CreateProductRequest {
  name: string;
  description?: string | null;
  status?: boolean;
  userId: string;
}

export interface UpdateProductRequest {
  name?: string;
  description?: string | null;
  status?: boolean;
}

export interface ListProductsRequest {
  status?: boolean;
  userId?: string;
  search?: string;
}

// ============================================
// RESPONSE INTERFACES
// ============================================

export interface ProductResponse {
  id: string;
  name: string;
  description: string | null;
  registrationDate: string;  // ISO 8601
  status: boolean;
  userId: string;
  createdAt: string;         // ISO 8601
  updatedAt: string;         // ISO 8601
}

// Aliases para claridad
export type CreateProductResponse = ProductResponse;
export type GetProductResponse = ProductResponse;
export type UpdateProductResponse = ProductResponse;
export type ListProductsResponse = ProductResponse[];

// ============================================
// UTILITY TYPES
// ============================================

// Para formularios de creación
export type ProductFormData = Omit<CreateProductRequest, 'userId'> & {
  userId?: string;  // Opcional en el formulario, requerido al enviar
};

// Para formularios de edición
export type ProductEditFormData = UpdateProductRequest;

// Para mostrar en listas/tablas
export type ProductListItem = Pick<ProductResponse, 'id' | 'name' | 'status' | 'description'>;
```

---

## Errores Comunes a Evitar

1. ❌ Enviar `userId` en `UpdateProductRequest` (no se puede cambiar)
2. ❌ Enviar `id`, `registrationDate`, `createdAt`, `updatedAt` en requests (son generados por el backend)
3. ❌ Enviar `name` vacío o con más de 200 caracteres
4. ❌ Enviar `description` con más de 1000 caracteres
5. ❌ Intentar agregar `extras` a un producto en una orden (solo `MenuItem` puede tener extras)
6. ❌ Asumir que `status` es requerido (tiene default: true)
7. ❌ No validar que `userId` sea un UUID válido antes de enviar

---

## Flujo Recomendado en el Frontend

### 1. Crear Producto

```typescript
async function createProduct(data: CreateProductRequest): Promise<ProductResponse> {
  const response = await fetch('/api/products', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });
  
  if (!response.ok) {
    throw new Error('Error al crear producto');
  }
  
  return response.json();
}
```

### 2. Listar Productos

```typescript
async function listProducts(filters?: ListProductsRequest): Promise<ProductResponse[]> {
  const params = new URLSearchParams();
  if (filters?.status !== undefined) params.append('status', String(filters.status));
  if (filters?.userId) params.append('userId', filters.userId);
  if (filters?.search) params.append('search', filters.search);
  
  const response = await fetch(`/api/products?${params.toString()}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  return response.json();
}
```

### 3. Actualizar Producto

```typescript
async function updateProduct(
  productId: string, 
  data: UpdateProductRequest
): Promise<ProductResponse> {
  const response = await fetch(`/api/products/${productId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });
  
  if (!response.ok) {
    throw new Error('Error al actualizar producto');
  }
  
  return response.json();
}
```

### 4. Eliminar Producto

```typescript
async function deleteProduct(productId: string): Promise<void> {
  const response = await fetch(`/api/products/${productId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (!response.ok) {
    throw new Error('Error al eliminar producto');
  }
}
```

---

## Validaciones Recomendadas en el Frontend

```typescript
// Validación antes de enviar CreateProductRequest
function validateCreateProduct(data: CreateProductRequest): string[] {
  const errors: string[] = [];
  
  if (!data.name || data.name.trim().length === 0) {
    errors.push('El nombre es requerido');
  }
  
  if (data.name && data.name.length > 200) {
    errors.push('El nombre no puede exceder 200 caracteres');
  }
  
  if (data.description && data.description.length > 1000) {
    errors.push('La descripción no puede exceder 1000 caracteres');
  }
  
  if (!data.userId || !isValidUUID(data.userId)) {
    errors.push('El userId debe ser un UUID válido');
  }
  
  return errors;
}

// Validación antes de enviar UpdateProductRequest
function validateUpdateProduct(data: UpdateProductRequest): string[] {
  const errors: string[] = [];
  
  if (data.name !== undefined) {
    if (data.name.trim().length === 0) {
      errors.push('El nombre no puede estar vacío');
    }
    if (data.name.length > 200) {
      errors.push('El nombre no puede exceder 200 caracteres');
    }
  }
  
  if (data.description !== undefined && data.description && data.description.length > 1000) {
    errors.push('La descripción no puede exceder 1000 caracteres');
  }
  
  return errors;
}
```

---

## Notas Importantes

1. **Fechas:** Todas las fechas vienen en formato ISO 8601 (string)
2. **UUIDs:** Todos los IDs son UUIDs v4 (string)
3. **Campos inmutables:** `id`, `userId`, `registrationDate`, `createdAt` no se pueden modificar
4. **Campos opcionales:** `description` puede ser `null` o `undefined`
5. **Estado por defecto:** `status` es `true` por defecto si no se especifica
6. **Búsqueda:** El parámetro `search` busca en el nombre del producto (búsqueda parcial, case-insensitive)

---

## Diferencias Clave: Product vs MenuItem

| Característica | Product | MenuItem |
|---------------|---------|----------|
| **Puede tener extras** | ❌ No | ✅ Sí |
| **Aparece en el menú** | ❌ No | ✅ Sí |
| **Tiene categoría** | ❌ No | ✅ Sí |
| **Tiene precio fijo** | ❌ No (precio variable en orden) | ✅ Sí (precio en el menú) |
| **Uso principal** | Inventario/productos adicionales | Platillos del restaurante |

**En una orden:**
- Si `itemId` apunta a un `Product`: No puede tener extras
- Si `itemId` apunta a un `MenuItem`: Puede tener extras

---

## Checklist de Implementación

- [ ] Crear interfaces TypeScript para todos los requests
- [ ] Crear interfaces TypeScript para todos los responses
- [ ] Implementar validaciones en el frontend antes de enviar
- [ ] Manejar errores del backend (USER_NOT_FOUND, PRODUCT_NOT_FOUND, etc.)
- [ ] Implementar funciones para cada operación CRUD
- [ ] Manejar estados de carga y errores en la UI
- [ ] Validar UUIDs antes de enviar requests
- [ ] Validar longitudes de strings según las reglas
- [ ] No enviar campos inmutables en updates
- [ ] Manejar campos opcionales correctamente (null vs undefined)

---

**Última actualización:** 2024-01-15  
**Versión del Backend:** Compatible con schema actual  
**Relacionado con:** `frontend-interfaces-guide.md` (para uso en órdenes)
