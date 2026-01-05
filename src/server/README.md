# Server - Local Development

Esta carpeta contiene todo lo relacionado con el servidor HTTP local para desarrollo.

## Estructura

```
server/
├── config/              # Configuración del servidor
│   └── server.config.ts # Configuración (puerto, CORS, etc.)
├── middleware/          # Middlewares del servidor HTTP
│   ├── error-handler.middleware.ts    # Manejo de errores
│   ├── not-found.middleware.ts         # 404 handler
│   └── request-logger.middleware.ts    # Logging de requests
├── routes/             # Rutas del servidor
│   ├── auth.routes.ts  # Rutas de autenticación
│   ├── health.routes.ts # Health check
│   └── index.ts        # Agregador de rutas
└── server.ts           # Servidor principal
```

## Capas

### 1. Config (`config/`)
- **Responsabilidad**: Configuración del servidor
- **Contiene**: Variables de entorno, configuración de CORS, puerto, etc.

### 2. Middleware (`middleware/`)
- **Responsabilidad**: Procesamiento de requests/responses
- **Contiene**: 
  - Error handling
  - Logging
  - 404 handling

### 3. Routes (`routes/`)
- **Responsabilidad**: Definición de endpoints HTTP
- **Contiene**: 
  - Mapeo de rutas HTTP a handlers Lambda
  - Conversión HTTP ↔ Lambda events
  - Manejo de parámetros

### 4. Server (`server.ts`)
- **Responsabilidad**: Inicialización y arranque del servidor
- **Contiene**: 
  - Setup de Express
  - Configuración de middlewares
  - Registro de rutas
  - Manejo de errores

## Flujo de Request

```
HTTP Request
    ↓
Express Middleware (CORS, Body Parser, Logger)
    ↓
Routes (auth.routes.ts, etc.)
    ↓
HttpToLambdaAdapter (convierte HTTP → Lambda Event)
    ↓
Lambda Handler (handlers/auth/login.handler.ts)
    ↓
Use Case (core/application/use-cases/)
    ↓
Repository (core/infrastructure/database/repositories/)
    ↓
Database (Prisma)
    ↓
Response (Lambda → HTTP)
```

## Agregar Nuevas Rutas

1. Crear archivo en `routes/` (ej: `users.routes.ts`)
2. Importar el handler Lambda correspondiente
3. Usar `HttpToLambdaAdapter` para convertir requests
4. Registrar la ruta en `routes/index.ts`

Ejemplo:
```typescript
// routes/users.routes.ts
import { Router, Request, Response } from 'express';
import { getUserHandler } from '../../handlers/users/get-user.handler';
import { HttpToLambdaAdapter } from '../../shared/utils/http-to-lambda.adapter';

const router = Router();

router.get('/:id', async (req: Request, res: Response) => {
  const event = HttpToLambdaAdapter.convertRequest(req, { id: req.params.id });
  const context = HttpToLambdaAdapter.createContext();
  const response = await getUserHandler(event, context);
  HttpToLambdaAdapter.convertResponse(response, res);
});

export default router;
```

