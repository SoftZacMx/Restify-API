# Error Handling System

Sistema centralizado de manejo de errores basado en códigos de error, mensajes y categorías.

## Estructura

```
shared/errors/
├── error-config.ts    # Configuración centralizada de errores
├── app-error.ts       # Clase base AppError
├── index.ts          # Exports
└── README.md         # Esta documentación
```

## Uso Básico

### Crear un error

```typescript
import { AppError } from '../../shared/errors';

// Error con mensaje por defecto
throw new AppError('USER_NOT_FOUND');

// Error con mensaje personalizado
throw new AppError('USER_NOT_FOUND', 'Usuario no encontrado en el sistema');

// Error con metadata (útil para debugging)
throw new AppError('USER_NOT_FOUND', undefined, { 
  userId: '123', 
  email: 'test@test.com' 
});

// Usando el método estático (más limpio)
throw AppError.create('PASSWORD_INCORRECT', 'Contraseña incorrecta');
```

### Agregar un nuevo código de error

1. Agrega el código en `error-config.ts`:

```typescript
export const ERROR_CONFIG = {
  // ... errores existentes
  NEW_ERROR_CODE: {
    message: 'Default message for new error',
    statusCode: 400,
    category: 'VALIDATION', // o 'AUTH', 'BUSINESS', 'SYSTEM'
  },
} as const;
```

2. TypeScript automáticamente lo reconocerá en `ErrorCode`

## Categorías de Errores

- **AUTH**: Errores de autenticación y autorización
- **VALIDATION**: Errores de validación de datos
- **BUSINESS**: Errores de lógica de negocio
- **SYSTEM**: Errores del sistema (BD, servicios externos, etc.)

## Métodos Útiles

```typescript
const error = new AppError('USER_NOT_FOUND');

// Convertir a JSON
error.toJSON();

// Verificar categoría
error.isCategory('AUTH'); // true

// Verificar tipo de error
error.isClientError(); // true (4xx)
error.isServerError(); // false (5xx)
```

## Ventajas

✅ **Type-safe**: TypeScript valida los códigos de error  
✅ **Centralizado**: Todos los errores en un solo lugar  
✅ **Escalable**: Fácil agregar nuevos errores  
✅ **Consistente**: Mismos códigos en toda la aplicación  
✅ **Metadata**: Soporte para contexto adicional  
✅ **Categorización**: Útil para logs y monitoreo  

