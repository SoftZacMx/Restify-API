# Guía de Interfaces Frontend - CRUD de Categorías de Menú

Este documento describe las interfaces TypeScript/JavaScript que el frontend debe implementar para el CRUD (Create, Read, Update, Delete) de categorías de menú, asegurando compatibilidad total con el backend.

## 📋 Índice

1. [Contexto: ¿Qué es una MenuCategory?](#contexto-qué-es-una-menucategory)
2. [Interfaces de Request (Envío al Backend)](#interfaces-de-request)
3. [Interfaces de Response (Respuesta del Backend)](#interfaces-de-response)
4. [Endpoints y Métodos HTTP](#endpoints-y-métodos-http)
5. [Validaciones y Reglas de Negocio](#validaciones-y-reglas-de-negocio)
6. [Ejemplos Completos](#ejemplos-completos)
7. [Integración con MenuItem](#integración-con-menuitem)
8. [Tipos TypeScript Completos](#tipos-typescript-completos)
9. [Errores Comunes](#errores-comunes)
10. [Flujo Recomendado](#flujo-recomendado)

---

## Contexto: ¿Qué es una MenuCategory?

Una `MenuCategory` representa una categoría del menú del restaurante. Se usa para organizar los platillos (`MenuItem`) en grupos lógicos.

**Ejemplos de categorías:**
- Entradas
- Platos Fuertes
- Postres
- Bebidas
- Sopas
- Ensaladas
- Desayunos
- Combos

**Relación con MenuItem:**
- Una categoría puede tener **múltiples platillos** (1:N)
- Un platillo puede tener **una categoría o ninguna** (categoryId es opcional)

---

## Interfaces de Request

### 1. CreateMenuCategoryRequest

Interfaz para crear una nueva categoría.

```typescript
interface CreateMenuCategoryRequest {
  name: string;       // REQUERIDO - Nombre de la categoría (mín 1, máx 200 caracteres)
  status?: boolean;   // Opcional - Estado activo/inactivo (default: true)
}
```

**Reglas de Validación:**
- `name`: Requerido, mínimo 1 carácter, máximo 200 caracteres
- `status`: Opcional, default `true` (activo)

---

### 2. UpdateMenuCategoryRequest

Interfaz para actualizar una categoría existente.

```typescript
interface UpdateMenuCategoryRequest {
  name?: string;      // Opcional - Nombre de la categoría (mín 1, máx 200 caracteres)
  status?: boolean;   // Opcional - Estado activo/inactivo
}
```

**Reglas de Validación:**
- Todos los campos son opcionales
- Si se envía `name`, debe cumplir las mismas reglas que en create
- Solo envía los campos que quieres actualizar

---

### 3. ListMenuCategoriesRequest (Query Parameters)

Interfaz para filtrar la lista de categorías.

```typescript
interface ListMenuCategoriesRequest {
  status?: boolean;   // Filtrar por estado (true = activas, false = inactivas)
  search?: string;    // Buscar por nombre (búsqueda parcial)
}
```

**Nota:** Todos los parámetros son opcionales. Si no se envían, se devuelven todas las categorías.

---

## Interfaces de Response

### 1. MenuCategoryResponse

Respuesta estándar para una categoría.

```typescript
interface MenuCategoryResponse {
  id: string;           // UUID de la categoría
  name: string;         // Nombre de la categoría
  status: boolean;      // Estado activo/inactivo
  createdAt: string;    // ISO 8601 date string
  updatedAt: string;    // ISO 8601 date string
}
```

---

### 2. CreateMenuCategoryResponse

Respuesta al crear una categoría (misma estructura que MenuCategoryResponse).

```typescript
type CreateMenuCategoryResponse = MenuCategoryResponse;
```

---

### 3. GetMenuCategoryResponse

Respuesta al obtener una categoría (misma estructura que MenuCategoryResponse).

```typescript
type GetMenuCategoryResponse = MenuCategoryResponse;
```

---

### 4. ListMenuCategoriesResponse

Respuesta al listar categorías (array de categorías).

```typescript
type ListMenuCategoriesResponse = MenuCategoryResponse[];
```

---

### 5. UpdateMenuCategoryResponse

Respuesta al actualizar una categoría (misma estructura que MenuCategoryResponse).

```typescript
type UpdateMenuCategoryResponse = MenuCategoryResponse;
```

---

### 6. DeleteMenuCategoryResponse

Respuesta al eliminar una categoría.

```typescript
// DELETE devuelve 204 No Content (sin body)
// O 200 OK con:
interface DeleteMenuCategoryResponse {
  success: boolean;
  message?: string;
}
```

---

## Endpoints y Métodos HTTP

| Operación | Método | Endpoint | Request | Response |
|-----------|--------|----------|---------|----------|
| Crear | `POST` | `/api/menu-categories` | `CreateMenuCategoryRequest` | `CreateMenuCategoryResponse` |
| Listar | `GET` | `/api/menu-categories` | Query params | `ListMenuCategoriesResponse` |
| Obtener | `GET` | `/api/menu-categories/:category_id` | - | `GetMenuCategoryResponse` |
| Actualizar | `PUT` | `/api/menu-categories/:category_id` | `UpdateMenuCategoryRequest` | `UpdateMenuCategoryResponse` |
| Eliminar | `DELETE` | `/api/menu-categories/:category_id` | - | 204 No Content |

### Detalles de cada endpoint:

#### Crear Categoría
```
POST /api/menu-categories
Content-Type: application/json
Authorization: Bearer {token}

Body: CreateMenuCategoryRequest
Response: 200 OK - CreateMenuCategoryResponse
```

#### Listar Categorías
```
GET /api/menu-categories?status=true&search=bebidas
Authorization: Bearer {token}

Response: 200 OK - ListMenuCategoriesResponse (array)
```

#### Obtener Categoría
```
GET /api/menu-categories/{category_id}
Authorization: Bearer {token}

Response: 200 OK - GetMenuCategoryResponse
```

#### Actualizar Categoría
```
PUT /api/menu-categories/{category_id}
Content-Type: application/json
Authorization: Bearer {token}

Body: UpdateMenuCategoryRequest
Response: 200 OK - UpdateMenuCategoryResponse
```

#### Eliminar Categoría
```
DELETE /api/menu-categories/{category_id}
Authorization: Bearer {token}

Response: 204 No Content
```

---

## Validaciones y Reglas de Negocio

### Validaciones del Frontend (antes de enviar)

```typescript
function validateCreateCategory(data: CreateMenuCategoryRequest): string[] {
  const errors: string[] = [];
  
  if (!data.name || data.name.trim().length === 0) {
    errors.push('El nombre es requerido');
  }
  
  if (data.name && data.name.length > 200) {
    errors.push('El nombre no puede exceder 200 caracteres');
  }
  
  return errors;
}

function validateUpdateCategory(data: UpdateMenuCategoryRequest): string[] {
  const errors: string[] = [];
  
  if (data.name !== undefined) {
    if (data.name.trim().length === 0) {
      errors.push('El nombre no puede estar vacío');
    }
    if (data.name.length > 200) {
      errors.push('El nombre no puede exceder 200 caracteres');
    }
  }
  
  return errors;
}
```

### Reglas de Negocio del Backend

1. **Nombre requerido:** El nombre es obligatorio al crear
2. **Estado por defecto:** Si no se envía `status`, será `true` (activo)
3. **Categorías con platillos:** Si una categoría tiene platillos asociados, considera si desactivarla en lugar de eliminarla
4. **Campos inmutables:** `id`, `createdAt` no se pueden modificar

---

## Ejemplos Completos

### Ejemplo 1: Crear Categoría

**Request:**
```json
POST /api/menu-categories
{
  "name": "Bebidas",
  "status": true
}
```

**Response:**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "name": "Bebidas",
  "status": true,
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

---

### Ejemplo 2: Crear Categoría Mínima

**Request:**
```json
POST /api/menu-categories
{
  "name": "Postres"
}
```

**Response:**
```json
{
  "id": "223e4567-e89b-12d3-a456-426614174001",
  "name": "Postres",
  "status": true,
  "createdAt": "2024-01-15T10:35:00.000Z",
  "updatedAt": "2024-01-15T10:35:00.000Z"
}
```

**Nota:** `status` es `true` por defecto.

---

### Ejemplo 3: Listar Categorías Activas

**Request:**
```
GET /api/menu-categories?status=true
```

**Response:**
```json
[
  {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "Bebidas",
    "status": true,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  },
  {
    "id": "223e4567-e89b-12d3-a456-426614174001",
    "name": "Postres",
    "status": true,
    "createdAt": "2024-01-15T10:35:00.000Z",
    "updatedAt": "2024-01-15T10:35:00.000Z"
  }
]
```

---

### Ejemplo 4: Buscar Categorías por Nombre

**Request:**
```
GET /api/menu-categories?search=beb
```

**Response:**
```json
[
  {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "Bebidas",
    "status": true,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
]
```

---

### Ejemplo 5: Actualizar Categoría

**Request:**
```json
PUT /api/menu-categories/123e4567-e89b-12d3-a456-426614174000
{
  "name": "Bebidas Frías"
}
```

**Response:**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "name": "Bebidas Frías",
  "status": true,
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T11:00:00.000Z"
}
```

---

### Ejemplo 6: Desactivar Categoría

**Request:**
```json
PUT /api/menu-categories/123e4567-e89b-12d3-a456-426614174000
{
  "status": false
}
```

**Response:**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "name": "Bebidas Frías",
  "status": false,
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T11:30:00.000Z"
}
```

---

## Integración con MenuItem

### Uso de Categorías al Crear Platillos

Cuando creas un `MenuItem`, puedes asociarlo a una categoría usando su `categoryId`:

```typescript
// Crear un platillo con categoría
const createMenuItem = {
  name: "Coca Cola 500ml",
  price: 25.00,
  categoryId: "123e4567-e89b-12d3-a456-426614174000", // ID de la categoría "Bebidas"
  userId: "user-uuid"
};

// Crear un platillo SIN categoría (categoryId es opcional)
const createMenuItemSinCategoria = {
  name: "Producto especial",
  price: 50.00,
  userId: "user-uuid"
  // categoryId no se envía
};
```

### Filtrar Platillos por Categoría

```typescript
// Obtener todos los platillos de una categoría específica
GET /api/menu-items?categoryId=123e4567-e89b-12d3-a456-426614174000
```

### Flujo Recomendado: Selector de Categoría

```typescript
// 1. Cargar categorías activas para el selector
const loadCategories = async () => {
  const response = await fetch('/api/menu-categories?status=true');
  const categories = await response.json();
  setCategoriesOptions(categories);
};

// 2. Usar en un formulario de creación de platillo
<select 
  value={selectedCategoryId} 
  onChange={(e) => setSelectedCategoryId(e.target.value)}
>
  <option value="">Sin categoría</option>
  {categoriesOptions.map(cat => (
    <option key={cat.id} value={cat.id}>{cat.name}</option>
  ))}
</select>
```

---

## Tipos TypeScript Completos

```typescript
// ============================================
// REQUEST INTERFACES
// ============================================

export interface CreateMenuCategoryRequest {
  name: string;
  status?: boolean;
}

export interface UpdateMenuCategoryRequest {
  name?: string;
  status?: boolean;
}

export interface ListMenuCategoriesRequest {
  status?: boolean;
  search?: string;
}

// ============================================
// RESPONSE INTERFACES
// ============================================

export interface MenuCategoryResponse {
  id: string;
  name: string;
  status: boolean;
  createdAt: string;  // ISO 8601
  updatedAt: string;  // ISO 8601
}

// Aliases para claridad
export type CreateMenuCategoryResponse = MenuCategoryResponse;
export type GetMenuCategoryResponse = MenuCategoryResponse;
export type UpdateMenuCategoryResponse = MenuCategoryResponse;
export type ListMenuCategoriesResponse = MenuCategoryResponse[];

// ============================================
// UTILITY TYPES
// ============================================

// Para formularios de creación
export type CategoryFormData = CreateMenuCategoryRequest;

// Para formularios de edición
export type CategoryEditFormData = UpdateMenuCategoryRequest;

// Para mostrar en listas/selectores
export type CategorySelectOption = Pick<MenuCategoryResponse, 'id' | 'name'>;

// Para uso en MenuItem
export type CategoryForMenuItem = Pick<MenuCategoryResponse, 'id' | 'name' | 'status'>;
```

---

## Errores Comunes

### Errores a Evitar

1. ❌ Enviar `id`, `createdAt`, `updatedAt` en requests (son generados por el backend)
2. ❌ Enviar `name` vacío o con más de 200 caracteres
3. ❌ Eliminar una categoría sin verificar si tiene platillos asociados
4. ❌ No enviar el token JWT en el header `Authorization`
5. ❌ Asumir que `status` es requerido (tiene default: true)

### Códigos de Error del Backend

| Código | HTTP Status | Descripción |
|--------|-------------|-------------|
| `MENU_CATEGORY_NOT_FOUND` | 404 | Categoría no encontrada |
| `VALIDATION_ERROR` | 400 | Error de validación (nombre vacío, etc.) |
| `UNAUTHORIZED` | 401 | Token no proporcionado o inválido |

### Manejo de Errores

```typescript
try {
  const response = await createCategory(data);
  // Éxito
} catch (error) {
  if (error.code === 'VALIDATION_ERROR') {
    // Mostrar errores de validación
    showValidationErrors(error.message);
  } else if (error.code === 'MENU_CATEGORY_NOT_FOUND') {
    // Categoría no existe
    showError('La categoría no existe');
  } else if (error.code === 'UNAUTHORIZED') {
    // Redirigir a login
    redirectToLogin();
  } else {
    // Error genérico
    showError('Error al procesar la solicitud');
  }
}
```

---

## Flujo Recomendado

### 1. Servicio de Categorías

```typescript
// services/menu-category.service.ts

const API_URL = '/api/menu-categories';

export const menuCategoryService = {
  async getAll(filters?: ListMenuCategoriesRequest): Promise<MenuCategoryResponse[]> {
    const params = new URLSearchParams();
    if (filters?.status !== undefined) params.append('status', String(filters.status));
    if (filters?.search) params.append('search', filters.search);
    
    const response = await fetch(`${API_URL}?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${getToken()}`
      }
    });
    
    if (!response.ok) throw await handleError(response);
    return response.json();
  },
  
  async getById(id: string): Promise<MenuCategoryResponse> {
    const response = await fetch(`${API_URL}/${id}`, {
      headers: {
        'Authorization': `Bearer ${getToken()}`
      }
    });
    
    if (!response.ok) throw await handleError(response);
    return response.json();
  },
  
  async create(data: CreateMenuCategoryRequest): Promise<MenuCategoryResponse> {
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
  
  async update(id: string, data: UpdateMenuCategoryRequest): Promise<MenuCategoryResponse> {
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
  }
};
```

---

### 2. Hook Personalizado (React)

```typescript
// hooks/useMenuCategories.ts

import { useState, useEffect, useCallback } from 'react';
import { menuCategoryService } from '../services/menu-category.service';

export function useMenuCategories(filters?: ListMenuCategoriesRequest) {
  const [categories, setCategories] = useState<MenuCategoryResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCategories = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await menuCategoryService.getAll(filters);
      setCategories(data);
    } catch (err: any) {
      setError(err.message || 'Error al cargar categorías');
    } finally {
      setLoading(false);
    }
  }, [filters?.status, filters?.search]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const createCategory = async (data: CreateMenuCategoryRequest) => {
    const newCategory = await menuCategoryService.create(data);
    setCategories(prev => [...prev, newCategory]);
    return newCategory;
  };

  const updateCategory = async (id: string, data: UpdateMenuCategoryRequest) => {
    const updated = await menuCategoryService.update(id, data);
    setCategories(prev => prev.map(cat => cat.id === id ? updated : cat));
    return updated;
  };

  const deleteCategory = async (id: string) => {
    await menuCategoryService.delete(id);
    setCategories(prev => prev.filter(cat => cat.id !== id));
  };

  return {
    categories,
    loading,
    error,
    refresh: loadCategories,
    createCategory,
    updateCategory,
    deleteCategory
  };
}
```

---

### 3. Componente de Lista de Categorías

```typescript
// components/CategoriesList.tsx

import { useMenuCategories } from '../hooks/useMenuCategories';

export function CategoriesList() {
  const { 
    categories, 
    loading, 
    error, 
    deleteCategory,
    refresh 
  } = useMenuCategories({ status: true });

  if (loading) return <p>Cargando categorías...</p>;
  if (error) return <p>Error: {error}</p>;

  return (
    <div>
      <h2>Categorías del Menú</h2>
      <button onClick={refresh}>Actualizar</button>
      
      <ul>
        {categories.map(category => (
          <li key={category.id}>
            <span>{category.name}</span>
            <span>{category.status ? '✅ Activa' : '❌ Inactiva'}</span>
            <button onClick={() => deleteCategory(category.id)}>
              Eliminar
            </button>
          </li>
        ))}
      </ul>
      
      {categories.length === 0 && (
        <p>No hay categorías registradas</p>
      )}
    </div>
  );
}
```

---

### 4. Componente de Formulario

```typescript
// components/CategoryForm.tsx

import { useState } from 'react';

interface CategoryFormProps {
  initialData?: MenuCategoryResponse;
  onSubmit: (data: CreateMenuCategoryRequest | UpdateMenuCategoryRequest) => Promise<void>;
  onCancel: () => void;
}

export function CategoryForm({ initialData, onSubmit, onCancel }: CategoryFormProps) {
  const [name, setName] = useState(initialData?.name || '');
  const [status, setStatus] = useState(initialData?.status ?? true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!initialData;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validación
    if (!name.trim()) {
      setError('El nombre es requerido');
      return;
    }
    if (name.length > 200) {
      setError('El nombre no puede exceder 200 caracteres');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await onSubmit({ name, status });
    } catch (err: any) {
      setError(err.message || 'Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h3>{isEditing ? 'Editar Categoría' : 'Nueva Categoría'}</h3>
      
      {error && <p style={{ color: 'red' }}>{error}</p>}
      
      <div>
        <label>Nombre:</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={200}
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
          Activa
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
- [ ] Implementar servicio de categorías (API calls)
- [ ] Crear hook personalizado `useMenuCategories`
- [ ] Implementar componente de lista de categorías
- [ ] Implementar formulario de crear/editar categoría
- [ ] Agregar validaciones en el frontend
- [ ] Manejar estados de carga y errores
- [ ] Implementar confirmación antes de eliminar
- [ ] Integrar selector de categorías en formulario de MenuItem
- [ ] Agregar búsqueda/filtrado de categorías
- [ ] Manejar caso de categorías sin platillos al eliminar

---

**Última actualización:** 2024-01-22  
**Versión del Backend:** Compatible con schema actual  
**Relacionado con:** `menu-items-crud-interfaces-guide.md`
