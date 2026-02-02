# Guía de Interfaces Frontend - CRUD de Mesas

Este documento describe las interfaces TypeScript/JavaScript que el frontend debe implementar para el CRUD (Create, Read, Update, Delete) de mesas, asegurando compatibilidad total con el backend.

## 📋 Índice

1. [Contexto: ¿Qué es una Table?](#contexto-qué-es-una-table)
2. [Interfaces de Request (Envío al Backend)](#interfaces-de-request)
3. [Interfaces de Response (Respuesta del Backend)](#interfaces-de-response)
4. [Endpoints y Métodos HTTP](#endpoints-y-métodos-http)
5. [Validaciones y Reglas de Negocio](#validaciones-y-reglas-de-negocio)
6. [Ejemplos Completos](#ejemplos-completos)
7. [Estados de la Mesa](#estados-de-la-mesa)
8. [Integración con Órdenes](#integración-con-órdenes)
9. [Tipos TypeScript Completos](#tipos-typescript-completos)
10. [Errores Comunes](#errores-comunes)
11. [Flujo Recomendado](#flujo-recomendado)

---

## Contexto: ¿Qué es una Table?

Una `Table` representa una mesa física del restaurante. Se usa para:
- Asignar órdenes a mesas específicas
- Controlar la disponibilidad de mesas
- Gestionar el flujo de clientes en el punto de venta

**Campos importantes:**
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `numberTable` | number | Número identificador de la mesa (ej: 1, 2, 3...) |
| `status` | boolean | Estado general de la mesa (activa/inactiva en el sistema) |
| `availabilityStatus` | boolean | Disponibilidad (true = libre, false = ocupada) |
| `userId` | string | Usuario que creó/administra la mesa |

---

## Interfaces de Request

### 1. CreateTableRequest

Interfaz para crear una nueva mesa.

```typescript
interface CreateTableRequest {
  numberTable: number;          // REQUERIDO - Número de la mesa (entero positivo)
  status?: boolean;             // Opcional - Estado activo/inactivo (default: true)
  availabilityStatus?: boolean; // Opcional - Disponibilidad (default: true = libre)
  userId: string;               // REQUERIDO - UUID del usuario que crea la mesa
}
```

**Reglas de Validación:**
- `numberTable`: Requerido, debe ser un entero positivo (> 0)
- `status`: Opcional, default `true` (activa)
- `availabilityStatus`: Opcional, default `true` (disponible/libre)
- `userId`: Requerido, debe ser un UUID válido

---

### 2. UpdateTableRequest

Interfaz para actualizar una mesa existente.

```typescript
interface UpdateTableRequest {
  numberTable?: number;          // Opcional - Número de la mesa (entero positivo)
  status?: boolean;              // Opcional - Estado activo/inactivo
  availabilityStatus?: boolean;  // Opcional - Disponibilidad
}
```

**Reglas de Validación:**
- Todos los campos son opcionales
- Si se envía `numberTable`, debe ser un entero positivo
- `userId` NO se puede actualizar (es inmutable)

---

### 3. ListTablesRequest (Query Parameters)

Interfaz para filtrar la lista de mesas.

```typescript
interface ListTablesRequest {
  status?: boolean;              // Filtrar por estado (true = activas, false = inactivas)
  availabilityStatus?: boolean;  // Filtrar por disponibilidad (true = libres, false = ocupadas)
  userId?: string;               // Filtrar por usuario (UUID)
  numberTable?: number;          // Filtrar por número de mesa
}
```

**Nota:** Todos los parámetros son opcionales. Si no se envían, se devuelven todas las mesas.

---

## Interfaces de Response

### 1. TableResponse

Respuesta estándar para una mesa.

```typescript
interface TableResponse {
  id: string;                    // UUID de la mesa
  numberTable: number;           // Número de la mesa
  userId: string;                // UUID del usuario propietario
  status: boolean;               // Estado activo/inactivo
  availabilityStatus: boolean;   // Disponibilidad (true = libre, false = ocupada)
  createdAt: string;             // ISO 8601 date string
  updatedAt: string;             // ISO 8601 date string
}
```

---

### 2. Aliases de Response

```typescript
type CreateTableResponse = TableResponse;
type GetTableResponse = TableResponse;
type UpdateTableResponse = TableResponse;
type ListTablesResponse = TableResponse[];
```

---

### 3. DeleteTableResponse

```typescript
// DELETE devuelve 204 No Content (sin body)
// O 200 OK con:
interface DeleteTableResponse {
  success: boolean;
  message?: string;
}
```

---

## Endpoints y Métodos HTTP

| Operación | Método | Endpoint | Request | Response |
|-----------|--------|----------|---------|----------|
| Crear | `POST` | `/api/tables` | `CreateTableRequest` | `CreateTableResponse` |
| Listar | `GET` | `/api/tables` | Query params | `ListTablesResponse` |
| Obtener | `GET` | `/api/tables/:table_id` | - | `GetTableResponse` |
| Actualizar | `PUT` | `/api/tables/:table_id` | `UpdateTableRequest` | `UpdateTableResponse` |
| Eliminar | `DELETE` | `/api/tables/:table_id` | - | 204 No Content |

### Detalles de cada endpoint:

#### Crear Mesa
```
POST /api/tables
Content-Type: application/json
Authorization: Bearer {token}

Body: CreateTableRequest
Response: 200 OK - CreateTableResponse
```

#### Listar Mesas
```
GET /api/tables?status=true&availabilityStatus=true
Authorization: Bearer {token}

Response: 200 OK - ListTablesResponse (array)
```

#### Obtener Mesa
```
GET /api/tables/{table_id}
Authorization: Bearer {token}

Response: 200 OK - GetTableResponse
```

#### Actualizar Mesa
```
PUT /api/tables/{table_id}
Content-Type: application/json
Authorization: Bearer {token}

Body: UpdateTableRequest
Response: 200 OK - UpdateTableResponse
```

#### Eliminar Mesa
```
DELETE /api/tables/{table_id}
Authorization: Bearer {token}

Response: 204 No Content
```

---

## Validaciones y Reglas de Negocio

### Validaciones del Frontend (antes de enviar)

```typescript
function validateCreateTable(data: CreateTableRequest): string[] {
  const errors: string[] = [];
  
  if (!data.numberTable || data.numberTable <= 0) {
    errors.push('El número de mesa debe ser un entero positivo');
  }
  
  if (!Number.isInteger(data.numberTable)) {
    errors.push('El número de mesa debe ser un entero');
  }
  
  if (!data.userId || !isValidUUID(data.userId)) {
    errors.push('El userId debe ser un UUID válido');
  }
  
  return errors;
}

function validateUpdateTable(data: UpdateTableRequest): string[] {
  const errors: string[] = [];
  
  if (data.numberTable !== undefined) {
    if (data.numberTable <= 0) {
      errors.push('El número de mesa debe ser un entero positivo');
    }
    if (!Number.isInteger(data.numberTable)) {
      errors.push('El número de mesa debe ser un entero');
    }
  }
  
  return errors;
}

// Helper para validar UUID
function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}
```

### Reglas de Negocio del Backend

1. **Número de mesa único:** Considera validar en el frontend que no exista otra mesa con el mismo número
2. **userId inmutable:** No se puede cambiar el usuario propietario después de crear
3. **Mesa con orden activa:** Si una mesa tiene una orden activa, no se puede eliminar
4. **Disponibilidad automática:** El backend gestiona automáticamente `availabilityStatus`:
   - **Al crear una orden local con mesa:** La mesa se marca automáticamente como no disponible (`availabilityStatus: false`)
   - **Al pagar una orden local con mesa:** La mesa se marca automáticamente como disponible (`availabilityStatus: true`)
   - **Validación:** El backend valida que la mesa esté disponible antes de permitir crear una orden con esa mesa (solo para órdenes locales)

---

## Ejemplos Completos

### Ejemplo 1: Crear Mesa

**Request:**
```json
POST /api/tables
{
  "numberTable": 1,
  "status": true,
  "availabilityStatus": true,
  "userId": "123e4567-e89b-12d3-a456-426614174000"
}
```

**Response:**
```json
{
  "id": "table-uuid-001",
  "numberTable": 1,
  "userId": "123e4567-e89b-12d3-a456-426614174000",
  "status": true,
  "availabilityStatus": true,
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

---

### Ejemplo 2: Crear Mesa Mínima

**Request:**
```json
POST /api/tables
{
  "numberTable": 5,
  "userId": "123e4567-e89b-12d3-a456-426614174000"
}
```

**Response:**
```json
{
  "id": "table-uuid-005",
  "numberTable": 5,
  "userId": "123e4567-e89b-12d3-a456-426614174000",
  "status": true,
  "availabilityStatus": true,
  "createdAt": "2024-01-15T10:35:00.000Z",
  "updatedAt": "2024-01-15T10:35:00.000Z"
}
```

**Nota:** `status` y `availabilityStatus` son `true` por defecto.

---

### Ejemplo 3: Listar Mesas Disponibles

**Request:**
```
GET /api/tables?status=true&availabilityStatus=true
```

**Response:**
```json
[
  {
    "id": "table-uuid-001",
    "numberTable": 1,
    "userId": "123e4567-e89b-12d3-a456-426614174000",
    "status": true,
    "availabilityStatus": true,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  },
  {
    "id": "table-uuid-003",
    "numberTable": 3,
    "userId": "123e4567-e89b-12d3-a456-426614174000",
    "status": true,
    "availabilityStatus": true,
    "createdAt": "2024-01-15T10:32:00.000Z",
    "updatedAt": "2024-01-15T10:32:00.000Z"
  }
]
```

---

### Ejemplo 4: Listar Mesas Ocupadas

**Request:**
```
GET /api/tables?availabilityStatus=false
```

**Response:**
```json
[
  {
    "id": "table-uuid-002",
    "numberTable": 2,
    "userId": "123e4567-e89b-12d3-a456-426614174000",
    "status": true,
    "availabilityStatus": false,
    "createdAt": "2024-01-15T10:31:00.000Z",
    "updatedAt": "2024-01-15T11:00:00.000Z"
  }
]
```

---

### Ejemplo 5: Marcar Mesa como Ocupada

**Request:**
```json
PUT /api/tables/table-uuid-001
{
  "availabilityStatus": false
}
```

**Response:**
```json
{
  "id": "table-uuid-001",
  "numberTable": 1,
  "userId": "123e4567-e89b-12d3-a456-426614174000",
  "status": true,
  "availabilityStatus": false,
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T11:30:00.000Z"
}
```

---

### Ejemplo 6: Liberar Mesa (Marcar como Disponible)

**Request:**
```json
PUT /api/tables/table-uuid-001
{
  "availabilityStatus": true
}
```

**Response:**
```json
{
  "id": "table-uuid-001",
  "numberTable": 1,
  "userId": "123e4567-e89b-12d3-a456-426614174000",
  "status": true,
  "availabilityStatus": true,
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T12:00:00.000Z"
}
```

---

### Ejemplo 7: Desactivar Mesa

**Request:**
```json
PUT /api/tables/table-uuid-001
{
  "status": false
}
```

**Response:**
```json
{
  "id": "table-uuid-001",
  "numberTable": 1,
  "userId": "123e4567-e89b-12d3-a456-426614174000",
  "status": false,
  "availabilityStatus": true,
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T12:30:00.000Z"
}
```

---

## Estados de la Mesa

### Diagrama de Estados

```
┌─────────────────────────────────────────────────────────────┐
│                      ESTADOS DE MESA                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  status: true (Activa)                                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                     │   │
│  │  availabilityStatus: true    availabilityStatus: false  │
│  │  ┌─────────────┐             ┌─────────────┐       │   │
│  │  │   LIBRE     │ ◄────────►  │   OCUPADA   │       │   │
│  │  │   (Verde)   │             │   (Rojo)    │       │   │
│  │  └─────────────┘             └─────────────┘       │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                           │                                 │
│                           ▼                                 │
│  status: false (Inactiva)                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ┌─────────────────────────────────────────────┐   │   │
│  │  │              DESHABILITADA                  │   │   │
│  │  │                (Gris)                       │   │   │
│  │  └─────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Estados Combinados

| status | availabilityStatus | Estado Visual | Color Sugerido | Acción |
|--------|-------------------|---------------|----------------|--------|
| true | true | Libre | 🟢 Verde | Puede asignarse orden |
| true | false | Ocupada | 🔴 Rojo | Tiene orden activa |
| false | - | Deshabilitada | ⚫ Gris | No visible para clientes |

### Componente de Estado Visual

```typescript
// Utility para determinar el estado visual
function getTableStatus(table: TableResponse): {
  label: string;
  color: string;
  canAssignOrder: boolean;
} {
  if (!table.status) {
    return {
      label: 'Deshabilitada',
      color: 'gray',
      canAssignOrder: false
    };
  }
  
  if (table.availabilityStatus) {
    return {
      label: 'Libre',
      color: 'green',
      canAssignOrder: true
    };
  }
  
  return {
    label: 'Ocupada',
    color: 'red',
    canAssignOrder: false
  };
}
```

---

## Integración con Órdenes

### ⚠️ Gestión Automática de Disponibilidad de Mesas

El backend gestiona automáticamente el estado de disponibilidad (`availabilityStatus`) de las mesas cuando se crean o pagan órdenes locales. **No es necesario gestionar esto manualmente desde el frontend.**

#### Comportamiento Automático:

1. **Al crear una orden local con mesa asignada:**
   ```typescript
   // El backend automáticamente:
   // 1. Valida que la mesa existe
   // 2. Valida que la mesa esté disponible (availabilityStatus: true)
   // 3. Si no está disponible → Error: TABLE_NOT_AVAILABLE (400)
   // 4. Si está disponible → Crea la orden Y marca la mesa como ocupada (availabilityStatus: false)
   
   POST /api/orders
   {
     "tableId": "table-uuid-001",
     "origin": "local",  // ← Solo para órdenes locales
     "userId": "user-uuid",
     "orderItems": [...]
   }
   ```

2. **Al pagar una orden local con mesa asignada:** usar el endpoint de pago. El backend en una transacción crea el pago, actualiza la orden y marca la mesa como disponible si `origin === "Local"`. **Guía única de pago:** [payment-frontend-guide.md](./payment-frontend-guide.md).

#### Endpoint de Pago (libera mesa si orden Local con mesa):

- ✅ `POST /api/orders/:order_id/pay` — Ver [payment-frontend-guide.md](./payment-frontend-guide.md) para request, response, interfaces y errores. Body: `paymentMethod`, `amount`, `transferNumber?`. Si la orden es Local con mesa, la mesa se marca disponible en la misma transacción.

#### Importante:

- **Solo órdenes locales:** La gestión automática solo aplica para órdenes con `origin: "local"`
- **Órdenes delivery/takeout:** No afectan el estado de disponibilidad de mesas
- **Manejo de errores:** Si intentas crear una orden con una mesa ocupada, recibirás `TABLE_NOT_AVAILABLE`

### Uso de Mesas al Crear Órdenes

Cuando creas una orden, puedes asociarla a una mesa usando su `tableId`:

```typescript
// Crear orden para una mesa específica
const createOrder = {
  tableId: "table-uuid-001",  // ID de la mesa
  origin: "local",              // IMPORTANTE: Solo para órdenes locales se gestiona automáticamente
  userId: "user-uuid",
  orderItems: [
    {
      itemId: "menu-item-uuid",
      quantity: 2,
      price: 150.00
    }
  ]
};
```

### Gestión Automática de Disponibilidad

**⚠️ IMPORTANTE:** El backend gestiona automáticamente el estado de disponibilidad de las mesas:

1. **Al crear una orden local con mesa:**
   - El backend valida que la mesa esté disponible (`availabilityStatus: true`)
   - Si la mesa no está disponible, retorna error `TABLE_NOT_AVAILABLE`
   - Si la mesa está disponible, la marca automáticamente como ocupada (`availabilityStatus: false`)

2. **Al pagar una orden local con mesa:**
   - El backend marca automáticamente la mesa como disponible (`availabilityStatus: true`) en la misma transacción. Ver [payment-frontend-guide.md](./payment-frontend-guide.md) para el endpoint y el body.

**Nota:** Solo las órdenes con `origin: "local"` gestionan automáticamente la disponibilidad de mesas.

### Flujo Recomendado: Asignar Mesa a Orden

```typescript
// 1. Cargar mesas disponibles
const loadAvailableTables = async () => {
  const response = await fetch('/api/tables?status=true&availabilityStatus=true');
  const tables = await response.json();
  setAvailableTables(tables);
};

// 2. Al seleccionar mesa para orden, solo guardar la selección
// NO es necesario marcar manualmente como ocupada - el backend lo hace automáticamente
const selectTableForOrder = (tableId: string) => {
  setSelectedTable(tableId);
};

// 3. Crear orden con mesa asignada
const createOrderWithTable = async (orderData: CreateOrderInput) => {
  try {
    // El backend automáticamente:
    // - Valida que la mesa esté disponible
    // - Marca la mesa como ocupada
    const order = await orderService.create({
      ...orderData,
      tableId: selectedTableId,
      origin: 'local'  // Importante para gestión automática
    });
    return order;
  } catch (error) {
    if (error.code === 'TABLE_NOT_AVAILABLE') {
      // La mesa ya está ocupada - actualizar lista y mostrar error
      await loadAvailableTables();
      showError('La mesa seleccionada ya está ocupada');
    }
    throw error;
  }
};

// 4. Al pagar orden, la mesa se libera automáticamente (misma transacción).
// Ver payment-frontend-guide.md para request/response y ejemplo completo.
const payOrder = async (orderId: string, orderTotal: number, method: 'CASH' | 'TRANSFER' | 'CARD_PHYSICAL', transferNumber?: string) => {
  const body = { paymentMethod: method, amount: orderTotal, ...(method === 'TRANSFER' && transferNumber && { transferNumber }) };
  const res = await fetch(`/api/orders/${orderId}/pay`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  const json = await res.json();
  // json.data.tableReleased === true si se liberó la mesa
  return json.data;
};
```

### Selector de Mesa en UI

```typescript
// Componente selector de mesa para punto de venta
<select 
  value={selectedTableId} 
  onChange={(e) => selectTableForOrder(e.target.value)}
>
  <option value="">Selecciona una mesa</option>
  {availableTables.map(table => (
    <option key={table.id} value={table.id}>
      Mesa {table.numberTable}
    </option>
  ))}
</select>
```

---

## Tipos TypeScript Completos

```typescript
// ============================================
// REQUEST INTERFACES
// ============================================

export interface CreateTableRequest {
  numberTable: number;
  status?: boolean;
  availabilityStatus?: boolean;
  userId: string;
}

export interface UpdateTableRequest {
  numberTable?: number;
  status?: boolean;
  availabilityStatus?: boolean;
}

export interface ListTablesRequest {
  status?: boolean;
  availabilityStatus?: boolean;
  userId?: string;
  numberTable?: number;
}

// ============================================
// RESPONSE INTERFACES
// ============================================

export interface TableResponse {
  id: string;
  numberTable: number;
  userId: string;
  status: boolean;
  availabilityStatus: boolean;
  createdAt: string;  // ISO 8601
  updatedAt: string;  // ISO 8601
}

// Aliases para claridad
export type CreateTableResponse = TableResponse;
export type GetTableResponse = TableResponse;
export type UpdateTableResponse = TableResponse;
export type ListTablesResponse = TableResponse[];

// ============================================
// UTILITY TYPES
// ============================================

// Para formularios de creación
export type TableFormData = Omit<CreateTableRequest, 'userId'>;

// Para formularios de edición
export type TableEditFormData = UpdateTableRequest;

// Para mostrar en listas/selectores (mesas disponibles)
export type AvailableTableOption = Pick<TableResponse, 'id' | 'numberTable'>;

// Para uso en Order
export type TableForOrder = Pick<TableResponse, 'id' | 'numberTable' | 'availabilityStatus'>;

// Estado visual de la mesa
export interface TableStatusInfo {
  label: string;
  color: 'green' | 'red' | 'gray';
  canAssignOrder: boolean;
}
```

---

## Errores Comunes

### Errores a Evitar

1. ❌ Enviar `numberTable` como string (debe ser number)
2. ❌ Enviar `numberTable` negativo o cero
3. ❌ Enviar `numberTable` decimal (debe ser entero)
4. ❌ Intentar actualizar `userId` (es inmutable)
5. ❌ Eliminar mesa con orden activa
6. ❌ Intentar crear orden local con mesa ocupada (el backend lo valida automáticamente)
7. ❌ Intentar marcar manualmente la mesa como ocupada al crear orden (el backend lo hace automáticamente)
8. ❌ Intentar liberar manualmente la mesa al pagar orden (el backend lo hace automáticamente)
9. ❌ No enviar el token JWT en el header `Authorization`

### Códigos de Error del Backend

| Código | HTTP Status | Descripción |
|--------|-------------|-------------|
| `TABLE_NOT_FOUND` | 404 | Mesa no encontrada |
| `TABLE_NOT_AVAILABLE` | 400 | Mesa no está disponible |
| `VALIDATION_ERROR` | 400 | Error de validación |
| `USER_NOT_FOUND` | 404 | Usuario no encontrado |
| `UNAUTHORIZED` | 401 | Token no proporcionado o inválido |

### Manejo de Errores

```typescript
try {
  const response = await createTable(data);
  // Éxito
} catch (error) {
  switch (error.code) {
    case 'VALIDATION_ERROR':
      showValidationErrors(error.message);
      break;
    case 'TABLE_NOT_FOUND':
      showError('La mesa no existe');
      break;
    case 'TABLE_NOT_AVAILABLE':
      showError('La mesa no está disponible');
      break;
    case 'USER_NOT_FOUND':
      showError('Usuario no válido');
      break;
    case 'UNAUTHORIZED':
      redirectToLogin();
      break;
    default:
      showError('Error al procesar la solicitud');
  }
}
```

---

## Flujo Recomendado

### 1. Servicio de Mesas

```typescript
// services/table.service.ts

const API_URL = '/api/tables';

export const tableService = {
  async getAll(filters?: ListTablesRequest): Promise<TableResponse[]> {
    const params = new URLSearchParams();
    if (filters?.status !== undefined) params.append('status', String(filters.status));
    if (filters?.availabilityStatus !== undefined) params.append('availabilityStatus', String(filters.availabilityStatus));
    if (filters?.userId) params.append('userId', filters.userId);
    if (filters?.numberTable) params.append('numberTable', String(filters.numberTable));
    
    const response = await fetch(`${API_URL}?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${getToken()}`
      }
    });
    
    if (!response.ok) throw await handleError(response);
    return response.json();
  },
  
  async getById(id: string): Promise<TableResponse> {
    const response = await fetch(`${API_URL}/${id}`, {
      headers: {
        'Authorization': `Bearer ${getToken()}`
      }
    });
    
    if (!response.ok) throw await handleError(response);
    return response.json();
  },
  
  async create(data: CreateTableRequest): Promise<TableResponse> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) throw await handleError(response);
    return response.json();
  },
  
  async update(id: string, data: UpdateTableRequest): Promise<TableResponse> {
    const response = await fetch(`${API_URL}/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) throw await handleError(response);
    return response.json();
  },
  
  async delete(id: string): Promise<void> {
    const response = await fetch(`${API_URL}/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${getToken()}`
      }
    });
    
    if (!response.ok) throw await handleError(response);
  },
  
  // Métodos de conveniencia
  async getAvailable(): Promise<TableResponse[]> {
    return this.getAll({ status: true, availabilityStatus: true });
  },
  
  async getOccupied(): Promise<TableResponse[]> {
    return this.getAll({ status: true, availabilityStatus: false });
  },
  
  // NOTA: Estos métodos son para uso manual/administrativo
  // La disponibilidad se gestiona automáticamente al crear/pagar órdenes locales
  async markAsOccupied(id: string): Promise<TableResponse> {
    return this.update(id, { availabilityStatus: false });
  },
  
  async markAsFree(id: string): Promise<TableResponse> {
    return this.update(id, { availabilityStatus: true });
  }
};
```

---

### 2. Hook Personalizado (React)

```typescript
// hooks/useTables.ts

import { useState, useEffect, useCallback } from 'react';
import { tableService } from '../services/table.service';

export function useTables(filters?: ListTablesRequest) {
  const [tables, setTables] = useState<TableResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTables = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await tableService.getAll(filters);
      // Ordenar por número de mesa
      data.sort((a, b) => a.numberTable - b.numberTable);
      setTables(data);
    } catch (err: any) {
      setError(err.message || 'Error al cargar mesas');
    } finally {
      setLoading(false);
    }
  }, [filters?.status, filters?.availabilityStatus]);

  useEffect(() => {
    loadTables();
  }, [loadTables]);

  const createTable = async (data: CreateTableRequest) => {
    const newTable = await tableService.create(data);
    setTables(prev => [...prev, newTable].sort((a, b) => a.numberTable - b.numberTable));
    return newTable;
  };

  const updateTable = async (id: string, data: UpdateTableRequest) => {
    const updated = await tableService.update(id, data);
    setTables(prev => prev.map(t => t.id === id ? updated : t));
    return updated;
  };

  const deleteTable = async (id: string) => {
    await tableService.delete(id);
    setTables(prev => prev.filter(t => t.id !== id));
  };

  const markAsOccupied = async (id: string) => {
    return updateTable(id, { availabilityStatus: false });
  };

  const markAsFree = async (id: string) => {
    return updateTable(id, { availabilityStatus: true });
  };

  return {
    tables,
    loading,
    error,
    refresh: loadTables,
    createTable,
    updateTable,
    deleteTable,
    markAsOccupied,
    markAsFree
  };
}

// Hook específico para mesas disponibles
export function useAvailableTables() {
  return useTables({ status: true, availabilityStatus: true });
}
```

---

### 3. Componente Mapa de Mesas (Punto de Venta)

```typescript
// components/TableMap.tsx

import { useTables } from '../hooks/useTables';

interface TableMapProps {
  onSelectTable: (table: TableResponse) => void;
}

export function TableMap({ onSelectTable }: TableMapProps) {
  const { tables, loading, error, markAsOccupied, markAsFree } = useTables({ status: true });

  if (loading) return <p>Cargando mesas...</p>;
  if (error) return <p>Error: {error}</p>;

  const getTableStyle = (table: TableResponse) => {
    if (table.availabilityStatus) {
      return { backgroundColor: '#4CAF50', cursor: 'pointer' }; // Verde - Libre
    }
    return { backgroundColor: '#f44336', cursor: 'pointer' }; // Rojo - Ocupada
  };

  const handleTableClick = (table: TableResponse) => {
    if (table.availabilityStatus) {
      // Mesa libre - asignar orden
      onSelectTable(table);
    } else {
      // Mesa ocupada - ver orden actual
      onSelectTable(table);
    }
  };

  return (
    <div className="table-map">
      <h2>Mapa de Mesas</h2>
      
      <div className="legend">
        <span className="legend-item">
          <span style={{ backgroundColor: '#4CAF50' }}></span> Libre
        </span>
        <span className="legend-item">
          <span style={{ backgroundColor: '#f44336' }}></span> Ocupada
        </span>
      </div>
      
      <div className="tables-grid">
        {tables.map(table => (
          <div
            key={table.id}
            className="table-card"
            style={getTableStyle(table)}
            onClick={() => handleTableClick(table)}
          >
            <span className="table-number">Mesa {table.numberTable}</span>
            <span className="table-status">
              {table.availabilityStatus ? 'Libre' : 'Ocupada'}
            </span>
          </div>
        ))}
      </div>
      
      {tables.length === 0 && (
        <p>No hay mesas registradas</p>
      )}
    </div>
  );
}
```

---

### 4. Componente de Formulario

```typescript
// components/TableForm.tsx

import { useState } from 'react';

interface TableFormProps {
  initialData?: TableResponse;
  userId: string;
  onSubmit: (data: CreateTableRequest | UpdateTableRequest) => Promise<void>;
  onCancel: () => void;
}

export function TableForm({ initialData, userId, onSubmit, onCancel }: TableFormProps) {
  const [numberTable, setNumberTable] = useState(initialData?.numberTable || '');
  const [status, setStatus] = useState(initialData?.status ?? true);
  const [availabilityStatus, setAvailabilityStatus] = useState(initialData?.availabilityStatus ?? true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!initialData;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const tableNumber = parseInt(String(numberTable), 10);
    
    // Validación
    if (!tableNumber || tableNumber <= 0) {
      setError('El número de mesa debe ser un entero positivo');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      if (isEditing) {
        await onSubmit({ numberTable: tableNumber, status, availabilityStatus });
      } else {
        await onSubmit({ numberTable: tableNumber, status, availabilityStatus, userId });
      }
    } catch (err: any) {
      setError(err.message || 'Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h3>{isEditing ? 'Editar Mesa' : 'Nueva Mesa'}</h3>
      
      {error && <p style={{ color: 'red' }}>{error}</p>}
      
      <div>
        <label>Número de Mesa:</label>
        <input
          type="number"
          value={numberTable}
          onChange={(e) => setNumberTable(e.target.value)}
          min="1"
          step="1"
          required
        />
      </div>
      
      <div>
        <label>
          <input
            type="checkbox"
            checked={status}
            onChange={(e) => setStatus(e.target.checked)}
          />
          Mesa Activa
        </label>
      </div>
      
      <div>
        <label>
          <input
            type="checkbox"
            checked={availabilityStatus}
            onChange={(e) => setAvailabilityStatus(e.target.checked)}
          />
          Disponible (Libre)
        </label>
      </div>
      
      <div>
        <button type="submit" disabled={loading}>
          {loading ? 'Guardando...' : 'Guardar'}
        </button>
        <button type="button" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
```

---

## Checklist de Implementación

- [ ] Crear interfaces TypeScript para requests y responses
- [ ] Implementar servicio de mesas (API calls)
- [ ] Crear hook personalizado `useTables`
- [ ] Implementar componente de mapa de mesas (visual)
- [ ] Implementar formulario de crear/editar mesa
- [ ] Agregar validaciones en el frontend
- [ ] Manejar estados de carga y errores
- [ ] Implementar lógica de estados (libre/ocupada)
- [ ] Integrar selector de mesas en creación de órdenes
- [ ] Manejar error `TABLE_NOT_AVAILABLE` al crear orden con mesa ocupada
- [ ] Actualizar lista de mesas disponibles después de crear/pagar órdenes
- [ ] Agregar confirmación antes de eliminar
- [ ] Implementar vista de mesas por estado (todas/libres/ocupadas)
- [ ] **Nota:** No es necesario marcar/liberar mesas manualmente - el backend lo hace automáticamente

---

**Última actualización:** 2025-01-24  
**Versión del Backend:** Compatible con schema actual  
**Relacionado con:** `frontend-interfaces-guide.md` (para uso en órdenes)

### Cambios Recientes (2025-01-24)

- ✅ **Gestión automática de disponibilidad:** El backend ahora gestiona automáticamente el estado de disponibilidad de las mesas:
  - Al crear una orden local con mesa: valida disponibilidad y marca como ocupada automáticamente
  - Al pagar una orden local con mesa: marca como disponible automáticamente
  - Ya no es necesario marcar/liberar mesas manualmente desde el frontend
