# Guía de Interfaces Frontend - CRUD de Platillos (MenuItems)

Este documento describe las interfaces TypeScript/JavaScript que el frontend debe implementar para el CRUD (Create, Read, Update, Delete) de platillos del menú (MenuItems), asegurando compatibilidad total con el backend.

## 📋 Índice

1. [Contexto: ¿Qué es un MenuItem?](#contexto-qué-es-un-menuitem)
2. [Interfaces de Request (Envío al Backend)](#interfaces-de-request)
3. [Interfaces de Response (Respuesta del Backend)](#interfaces-de-response)
4. [Endpoints y Métodos HTTP](#endpoints-y-métodos-http)
5. [Validaciones y Reglas de Negocio](#validaciones-y-reglas-de-negocio)
6. [Ejemplos Completos](#ejemplos-completos)
7. [Uso en Órdenes](#uso-en-órdenes)
8. [Extras: MenuItems como Extras](#extras-menuitems-como-extras)

---

## Contexto: ¿Qué es un MenuItem?

**IMPORTANTE:** En este sistema, un `MenuItem` es un **platillo del menú del restaurante**:

- **MenuItem**: Platillo del menú (hamburguesas, pizzas, bebidas, etc.) que aparece en el menú del restaurante.
- **Características clave:**
  - Tiene un **precio fijo** en el menú
  - Pertenece a una **categoría** (MenuCategory)
  - Puede tener **extras** asociados (otros MenuItems con `isExtra: true`)
  - Puede ser usado como **extra** de otro platillo (`isExtra: true`)
  - Tiene un **propietario** (userId)

**Diferencia con Product:**
- **Product**: Producto genérico/inventario que NO es parte del menú
- **MenuItem**: Platillo del menú que SÍ aparece en el menú del restaurante

---

## Interfaces de Request

### 1. CreateMenuItemRequest

Interfaz para crear un nuevo platillo del menú.

```typescript
interface CreateMenuItemRequest {
  name: string;                    // REQUERIDO - Nombre del platillo (mín 1, máx 200 caracteres)
  price: number;                   // REQUERIDO - Precio del platillo (positivo, máximo 2 decimales)
  status?: boolean;                // Opcional - Estado activo/inactivo (default: true)
  categoryId: string;              // REQUERIDO - UUID de la categoría del menú
  userId: string;                   // REQUERIDO - UUID del usuario que crea el platillo
}
```

**Reglas de Validación:**
- `name`: Requerido, mínimo 1 carácter, máximo 200 caracteres
- `price`: Requerido, debe ser positivo, máximo 2 decimales (ej: 25.50, 100.00)
- `status`: Opcional, default `true` (activo)
- `categoryId`: Requerido, debe ser un UUID válido y la categoría debe existir
- `userId`: Requerido, debe ser un UUID válido y el usuario debe existir

---

### 2. UpdateMenuItemRequest

Interfaz para actualizar un platillo existente.

```typescript
interface UpdateMenuItemRequest {
  name?: string;                   // Opcional - Nombre del platillo (mín 1, máx 200 caracteres)
  price?: number;                  // Opcional - Precio (positivo, máximo 2 decimales)
  status?: boolean;                // Opcional - Estado activo/inactivo
  categoryId?: string;             // Opcional - UUID de la categoría (debe existir)
  userId?: string;                 // Opcional - UUID del usuario propietario (debe existir)
}
```

**Reglas de Validación:**
- Todos los campos son opcionales
- Si se envía `name`, debe cumplir las mismas reglas que en create
- Si se envía `price`, debe ser positivo y máximo 2 decimales
- Si se envía `categoryId`, debe ser un UUID válido y la categoría debe existir
- Si se envía `userId`, debe ser un UUID válido y el usuario debe existir

---

### 3. ListMenuItemsRequest (Query Parameters)

Interfaz para filtrar la lista de platillos.

```typescript
interface ListMenuItemsRequest {
  status?: boolean;                // Filtrar por estado (true = activos, false = inactivos)
  categoryId?: string;              // Filtrar por categoría (UUID)
  userId?: string;                  // Filtrar por usuario (UUID)
  search?: string;                  // Buscar por nombre (búsqueda parcial)
}
```

**Nota:** Todos los parámetros son opcionales. Si no se envían, se devuelven todos los platillos.

**Nota sobre `status`:** En query parameters, `status` viene como string (`"true"` o `"false"`), el backend lo convierte a boolean.

---

## Interfaces de Response

### 1. CreateMenuItemResponse

Respuesta al crear un platillo.

```typescript
interface CreateMenuItemResponse {
  id: string;                       // UUID del platillo creado
  name: string;
  price: number;                     // Número (no string)
  status: boolean;
  isExtra: boolean;                 // Indica si es un extra (default: false)
  categoryId: string;               // UUID de la categoría
  userId: string;                   // UUID del usuario propietario
  createdAt: string;                // ISO 8601 date string
  updatedAt: string;                // ISO 8601 date string
}
```

---

### 2. GetMenuItemResponse

Respuesta al obtener un platillo (misma estructura que CreateMenuItemResponse).

```typescript
interface GetMenuItemResponse {
  // Misma estructura que CreateMenuItemResponse
  id: string;
  name: string;
  price: number;
  status: boolean;
  isExtra: boolean;
  categoryId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}
```

---

### 3. ListMenuItemsResponse

Respuesta al listar platillos (array de platillos).

```typescript
interface ListMenuItemsResponse extends Array<GetMenuItemResponse> {}
// O simplemente:
type ListMenuItemsResponse = GetMenuItemResponse[];
```

---

### 4. UpdateMenuItemResponse

Respuesta al actualizar un platillo (misma estructura que CreateMenuItemResponse).

```typescript
interface UpdateMenuItemResponse {
  // Misma estructura que CreateMenuItemResponse
  id: string;
  name: string;
  price: number;
  status: boolean;
  isExtra: boolean;
  categoryId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}
```

---

### 5. DeleteMenuItemResponse

Respuesta al eliminar un platillo.

```typescript
// DELETE devuelve 204 No Content (sin body)
// O 200 OK con:
interface DeleteMenuItemResponse {
  success: boolean;
  message?: string;
}
```

---

## Endpoints y Métodos HTTP

### Crear Platillo
- **Endpoint:** `POST /api/menu-items`
- **Autenticación:** Requerida
- **Content-Type:** `application/json`
- **Request:** `CreateMenuItemRequest`
- **Response:** `CreateMenuItemResponse` (200 OK)

### Obtener Platillo
- **Endpoint:** `GET /api/menu-items/:menu_item_id`
- **Autenticación:** Requerida
- **Request:** Ninguno (menu_item_id en URL)
- **Response:** `GetMenuItemResponse` (200 OK)

### Listar Platillos
- **Endpoint:** `GET /api/menu-items?status=true&categoryId=...&userId=...&search=...`
- **Autenticación:** Requerida
- **Request:** Query parameters opcionales (`ListMenuItemsRequest`)
- **Response:** `ListMenuItemsResponse` (200 OK) - Array de platillos

### Actualizar Platillo
- **Endpoint:** `PUT /api/menu-items/:menu_item_id`
- **Autenticación:** Requerida
- **Content-Type:** `application/json`
- **Request:** `UpdateMenuItemRequest`
- **Response:** `UpdateMenuItemResponse` (200 OK)

### Eliminar Platillo
- **Endpoint:** `DELETE /api/menu-items/:menu_item_id`
- **Autenticación:** Requerida
- **Request:** Ninguno
- **Response:** 204 No Content o 200 OK

---

## Validaciones y Reglas de Negocio

### Validaciones del Frontend (antes de enviar)

1. **CreateMenuItemRequest:**
   - `name`: No vacío, máximo 200 caracteres
   - `price`: Positivo, máximo 2 decimales (ej: 25.50, 100.00)
   - `categoryId`: UUID válido
   - `userId`: UUID válido
   - `status`: Boolean (default: true)

2. **UpdateMenuItemRequest:**
   - Todos los campos son opcionales
   - Si se envía `name`, debe cumplir las mismas reglas que en create
   - Si se envía `price`, debe ser positivo y máximo 2 decimales
   - Si se envía `categoryId`, debe ser un UUID válido
   - Si se envía `userId`, debe ser un UUID válido

3. **ListMenuItemsRequest:**
   - `status`: Boolean (true/false) - En query params viene como string
   - `categoryId`: UUID válido
   - `userId`: UUID válido
   - `search`: String (búsqueda por nombre)

### Reglas de Negocio del Backend

1. **Categoría debe existir:** El `categoryId` debe referenciar una categoría válida
2. **Usuario debe existir:** El `userId` debe referenciar un usuario válido
3. **Precio positivo:** El precio debe ser mayor a 0
4. **Precio con 2 decimales:** El precio debe tener máximo 2 decimales
5. **isExtra es automático:** El campo `isExtra` se establece automáticamente (default: false) y no se puede modificar desde la API actual
6. **Campos inmutables:** `id`, `createdAt` no se pueden modificar
7. **Platillos en órdenes:** Si un platillo está en órdenes existentes, verificar si se puede eliminar

---

## Ejemplos Completos

### Ejemplo 1: Crear Platillo (Request)

```json
{
  "name": "Hamburguesa Clásica",
  "price": 15.50,
  "status": true,
  "categoryId": "cat-123",
  "userId": "user-456"
}
```

### Ejemplo 2: Respuesta del Backend (CreateMenuItemResponse)

```json
{
  "id": "menu-item-123",
  "name": "Hamburguesa Clásica",
  "price": 15.50,
  "status": true,
  "isExtra": false,
  "categoryId": "cat-123",
  "userId": "user-456",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

### Ejemplo 3: Actualizar Platillo (Request)

```json
{
  "name": "Hamburguesa Clásica - Actualizada",
  "price": 16.00,
  "status": true
}
```

**Nota:** Solo envía los campos que quieres actualizar. Los demás permanecen igual.

### Ejemplo 4: Actualizar Solo el Precio

```json
{
  "price": 17.50
}
```

**Nota:** Puedes actualizar solo un campo si lo deseas.

### Ejemplo 5: Listar Platillos con Filtros

**Request:**
```
GET /api/menu-items?status=true&categoryId=cat-123&search=hamburguesa
```

**Response:**
```json
[
  {
    "id": "menu-item-123",
    "name": "Hamburguesa Clásica",
    "price": 15.50,
    "status": true,
    "isExtra": false,
    "categoryId": "cat-123",
    "userId": "user-456",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  },
  {
    "id": "menu-item-124",
    "name": "Hamburguesa Doble",
    "price": 20.00,
    "status": true,
    "isExtra": false,
    "categoryId": "cat-123",
    "userId": "user-456",
    "createdAt": "2024-01-15T11:00:00.000Z",
    "updatedAt": "2024-01-15T11:00:00.000Z"
  }
]
```

### Ejemplo 6: Platillo Mínimo (Request)

```json
{
  "name": "Pizza Margarita",
  "price": 12.00,
  "categoryId": "cat-789",
  "userId": "user-456"
}
```

**Nota:** `status` es opcional. Si no se envía, será `true` por defecto.

### Ejemplo 7: Listar Solo Extras

**Request:**
```
GET /api/menu-items?isExtra=true
```

**Nota:** Actualmente el backend no filtra por `isExtra` en los query parameters, pero puedes filtrar en el frontend después de recibir la respuesta.

---

## Uso en Órdenes

### Cómo usar MenuItems en una Orden

Los platillos se pueden agregar a una orden usando el campo `itemId` en `OrderItemRequest`:

```typescript
interface CreateOrderRequest {
  // ... otros campos de la orden
  orderItems: [
    {
      itemId: "menu-item-123",  // ← ID del platillo
      quantity: 2,
      price: 15.50,              // ← Precio al momento de la orden (puede variar)
      note: "Sin cebolla",
      extras: [                  // ← Los MenuItems SÍ pueden tener extras
        {
          extraId: "menu-item-456",  // ← ID de otro MenuItem con isExtra: true
          quantity: 1,
          price: 2.50
        }
      ]
    }
  ]
}
```

**IMPORTANTE:**
- Los platillos se identifican por su `id` (UUID)
- Los platillos **SÍ pueden tener extras** (otros MenuItems con `isExtra: true`)
- El `price` en la orden puede ser diferente al precio base del platillo (permite variaciones)
- Los extras son otros MenuItems que tienen `isExtra: true`

---

## Extras: MenuItems como Extras

### ¿Qué es un Extra?

Un **extra** es un `MenuItem` que tiene el campo `isExtra: true`. Estos extras se pueden agregar a otros platillos en una orden.

**Ejemplo:**
- **Platillo principal:** "Hamburguesa Clásica" (`isExtra: false`)
- **Extras disponibles:** "Queso Extra", "Tocino Extra", "Huevo Extra" (todos con `isExtra: true`)

### Cómo Identificar Extras

Los extras son MenuItems normales, pero con `isExtra: true`. Para obtener solo los extras:

```typescript
// Después de obtener todos los MenuItems, filtrar en el frontend:
const extras = menuItems.filter(item => item.isExtra === true);
```

### Uso de Extras en Órdenes

Cuando un platillo se agrega a una orden, puede incluir extras:

```typescript
{
  itemId: "menu-item-123",  // Hamburguesa Clásica
  quantity: 1,
  price: 15.50,
  note: "Sin cebolla",
  extras: [
    {
      extraId: "menu-item-456",  // Queso Extra (isExtra: true)
      quantity: 1,
      price: 2.50
    },
    {
      extraId: "menu-item-457",  // Tocino Extra (isExtra: true)
      quantity: 1,
      price: 3.00
    }
  ]
}
```

**Nota:** Los extras también son MenuItems, pero se usan de manera diferente en las órdenes.

---

## Tipos TypeScript Completos

```typescript
// ============================================
// REQUEST INTERFACES
// ============================================

export interface CreateMenuItemRequest {
  name: string;
  price: number;
  status?: boolean;
  categoryId: string;
  userId: string;
}

export interface UpdateMenuItemRequest {
  name?: string;
  price?: number;
  status?: boolean;
  categoryId?: string;
  userId?: string;
}

export interface ListMenuItemsRequest {
  status?: boolean | string;  // En query params viene como string
  categoryId?: string;
  userId?: string;
  search?: string;
}

// ============================================
// RESPONSE INTERFACES
// ============================================

export interface MenuItemResponse {
  id: string;
  name: string;
  price: number;
  status: boolean;
  isExtra: boolean;  // Campo automático, no se puede modificar desde la API
  categoryId: string;
  userId: string;
  createdAt: string;  // ISO 8601
  updatedAt: string;  // ISO 8601
}

// Aliases para claridad
export type CreateMenuItemResponse = MenuItemResponse;
export type GetMenuItemResponse = MenuItemResponse;
export type UpdateMenuItemResponse = MenuItemResponse;
export type ListMenuItemsResponse = MenuItemResponse[];

// ============================================
// UTILITY TYPES
// ============================================

// Para formularios de creación
export type MenuItemFormData = Omit<CreateMenuItemRequest, 'userId'> & {
  userId?: string;  // Opcional en el formulario, requerido al enviar
};

// Para formularios de edición
export type MenuItemEditFormData = UpdateMenuItemRequest;

// Para mostrar en listas/tablas
export type MenuItemListItem = Pick<MenuItemResponse, 'id' | 'name' | 'price' | 'status' | 'isExtra' | 'categoryId'>;

// Para filtrar extras
export type ExtraMenuItem = MenuItemResponse & { isExtra: true };

// Para platillos normales (no extras)
export type RegularMenuItem = MenuItemResponse & { isExtra: false };
```

---

## Errores Comunes a Evitar

1. ❌ Enviar `isExtra` en `CreateMenuItemRequest` o `UpdateMenuItemRequest` (no se puede modificar desde la API)
2. ❌ Enviar `id`, `createdAt`, `updatedAt` en requests (son generados por el backend)
3. ❌ Enviar `name` vacío o con más de 200 caracteres
4. ❌ Enviar `price` negativo, cero, o con más de 2 decimales
5. ❌ Enviar `categoryId` o `userId` que no existan en la base de datos
6. ❌ Asumir que `status` es requerido (tiene default: true)
7. ❌ No validar que `categoryId` y `userId` sean UUIDs válidos antes de enviar
8. ❌ Intentar usar un `Product` como extra (solo `MenuItem` con `isExtra: true` puede ser extra)
9. ❌ Asumir que `price` en la respuesta es string (es number)

---

## Flujo Recomendado en el Frontend

### 1. Crear Platillo

```typescript
async function createMenuItem(data: CreateMenuItemRequest): Promise<MenuItemResponse> {
  const response = await fetch('/api/menu-items', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Error al crear platillo');
  }
  
  return response.json();
}
```

### 2. Listar Platillos

```typescript
async function listMenuItems(filters?: ListMenuItemsRequest): Promise<MenuItemResponse[]> {
  const params = new URLSearchParams();
  if (filters?.status !== undefined) {
    params.append('status', String(filters.status));
  }
  if (filters?.categoryId) params.append('categoryId', filters.categoryId);
  if (filters?.userId) params.append('userId', filters.userId);
  if (filters?.search) params.append('search', filters.search);
  
  const response = await fetch(`/api/menu-items?${params.toString()}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (!response.ok) {
    throw new Error('Error al listar platillos');
  }
  
  return response.json();
}
```

### 3. Obtener Platillo por ID

```typescript
async function getMenuItem(menuItemId: string): Promise<MenuItemResponse> {
  const response = await fetch(`/api/menu-items/${menuItemId}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Platillo no encontrado');
    }
    throw new Error('Error al obtener platillo');
  }
  
  return response.json();
}
```

### 4. Actualizar Platillo

```typescript
async function updateMenuItem(
  menuItemId: string, 
  data: UpdateMenuItemRequest
): Promise<MenuItemResponse> {
  const response = await fetch(`/api/menu-items/${menuItemId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Error al actualizar platillo');
  }
  
  return response.json();
}
```

### 5. Eliminar Platillo

```typescript
async function deleteMenuItem(menuItemId: string): Promise<void> {
  const response = await fetch(`/api/menu-items/${menuItemId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (!response.ok) {
    throw new Error('Error al eliminar platillo');
  }
}
```

### 6. Obtener Solo Extras

```typescript
async function getExtras(): Promise<MenuItemResponse[]> {
  const allMenuItems = await listMenuItems();
  return allMenuItems.filter(item => item.isExtra === true);
}
```

---

## Validaciones Recomendadas en el Frontend

```typescript
// Validación antes de enviar CreateMenuItemRequest
function validateCreateMenuItem(data: CreateMenuItemRequest): string[] {
  const errors: string[] = [];
  
  if (!data.name || data.name.trim().length === 0) {
    errors.push('El nombre es requerido');
  }
  
  if (data.name && data.name.length > 200) {
    errors.push('El nombre no puede exceder 200 caracteres');
  }
  
  if (data.price === undefined || data.price === null) {
    errors.push('El precio es requerido');
  } else {
    if (data.price <= 0) {
      errors.push('El precio debe ser mayor a 0');
    }
    if (!isValidPrice(data.price)) {
      errors.push('El precio debe tener máximo 2 decimales');
    }
  }
  
  if (!data.categoryId || !isValidUUID(data.categoryId)) {
    errors.push('El categoryId debe ser un UUID válido');
  }
  
  if (!data.userId || !isValidUUID(data.userId)) {
    errors.push('El userId debe ser un UUID válido');
  }
  
  return errors;
}

// Validación antes de enviar UpdateMenuItemRequest
function validateUpdateMenuItem(data: UpdateMenuItemRequest): string[] {
  const errors: string[] = [];
  
  if (data.name !== undefined) {
    if (data.name.trim().length === 0) {
      errors.push('El nombre no puede estar vacío');
    }
    if (data.name.length > 200) {
      errors.push('El nombre no puede exceder 200 caracteres');
    }
  }
  
  if (data.price !== undefined) {
    if (data.price <= 0) {
      errors.push('El precio debe ser mayor a 0');
    }
    if (!isValidPrice(data.price)) {
      errors.push('El precio debe tener máximo 2 decimales');
    }
  }
  
  if (data.categoryId !== undefined && !isValidUUID(data.categoryId)) {
    errors.push('El categoryId debe ser un UUID válido');
  }
  
  if (data.userId !== undefined && !isValidUUID(data.userId)) {
    errors.push('El userId debe ser un UUID válido');
  }
  
  return errors;
}

// Función auxiliar para validar precio (máximo 2 decimales)
function isValidPrice(price: number): boolean {
  const decimalPlaces = (price.toString().split('.')[1] || '').length;
  return decimalPlaces <= 2;
}

// Función auxiliar para validar UUID
function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}
```

---

## Notas Importantes

1. **Fechas:** Todas las fechas vienen en formato ISO 8601 (string)
2. **UUIDs:** Todos los IDs son UUIDs v4 (string)
3. **Precios:** Los precios son números (number), no strings
4. **Precios con decimales:** Máximo 2 decimales (ej: 15.50, 100.00)
5. **Campos inmutables:** `id`, `createdAt` no se pueden modificar
6. **isExtra:** Campo automático, no se puede modificar desde la API actual (default: false)
7. **Búsqueda:** El parámetro `search` busca en el nombre del platillo (búsqueda parcial, case-insensitive)
8. **Status en query params:** Viene como string (`"true"` o `"false"`), el backend lo convierte a boolean

---

## Diferencias Clave: MenuItem vs Product

| Característica | MenuItem | Product |
|---------------|----------|---------|
| **Puede tener extras** | ✅ Sí | ❌ No |
| **Aparece en el menú** | ✅ Sí | ❌ No |
| **Tiene categoría** | ✅ Sí (MenuCategory) | ❌ No |
| **Tiene precio fijo** | ✅ Sí (en el menú) | ❌ No (precio variable en orden) |
| **Puede ser extra** | ✅ Sí (isExtra: true) | ❌ No |
| **Uso principal** | Platillos del restaurante | Inventario/productos adicionales |

**En una orden:**
- Si `itemId` apunta a un `MenuItem`: Puede tener extras
- Si `itemId` apunta a un `Product`: No puede tener extras

---

## Relación con Categorías

### MenuCategory

Los platillos pertenecen a una categoría (`MenuCategory`). Antes de crear un platillo, asegúrate de que la categoría exista:

```typescript
// Ejemplo: Obtener categorías disponibles
async function getCategories(): Promise<MenuCategoryResponse[]> {
  const response = await fetch('/api/menu-categories', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.json();
}

// Luego usar el categoryId en CreateMenuItemRequest
const categories = await getCategories();
const selectedCategoryId = categories[0].id;

const newMenuItem: CreateMenuItemRequest = {
  name: "Hamburguesa Clásica",
  price: 15.50,
  categoryId: selectedCategoryId,
  userId: currentUserId
};
```

---

## Checklist de Implementación

- [ ] Crear interfaces TypeScript para todos los requests
- [ ] Crear interfaces TypeScript para todos los responses
- [ ] Implementar validaciones en el frontend antes de enviar
- [ ] Manejar errores del backend (MENU_ITEM_NOT_FOUND, MENU_CATEGORY_NOT_FOUND, USER_NOT_FOUND, etc.)
- [ ] Implementar funciones para cada operación CRUD
- [ ] Manejar estados de carga y errores en la UI
- [ ] Validar UUIDs antes de enviar requests
- [ ] Validar precios (positivos, máximo 2 decimales)
- [ ] Validar longitudes de strings según las reglas
- [ ] No enviar campos inmutables en updates
- [ ] Manejar campos opcionales correctamente
- [ ] Implementar filtrado de extras (`isExtra: true`)
- [ ] Manejar la relación con categorías (MenuCategory)
- [ ] Validar que categoryId y userId existan antes de crear/actualizar

---

**Última actualización:** 2024-01-15  
**Versión del Backend:** Compatible con schema actual  
**Relacionado con:** 
- `products-crud-interfaces-guide.md` (para comparar con Product)
- `frontend-interfaces-guide.md` (para uso en órdenes)
