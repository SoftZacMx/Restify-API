# Módulo Auth - Documentación

## 📋 Descripción

Módulo de autenticación y autorización implementado siguiendo principios SOLID y Clean Architecture.

## 🏗️ Arquitectura

### Domain Layer
- **User Entity**: Entidad de dominio que representa un usuario
- **IUserRepository**: Interface del repositorio de usuarios

### Application Layer
- **Use Cases**:
  - `LoginUseCase`: Autenticación de usuarios
  - `VerifyUserUseCase`: Verificación de existencia de usuario
  - `SetPasswordUseCase`: Actualización de contraseña

### Infrastructure Layer
- **UserRepository**: Implementación del repositorio con Prisma
- **PrismaService**: Servicio de conexión a base de datos

### Handlers
- `login.handler.ts`: Handler Lambda para login
- `verify-user.handler.ts`: Handler Lambda para verificar usuario
- `set-password.handler.ts`: Handler Lambda para actualizar contraseña

## 🔐 Endpoints

### POST /auth/login
Autentica un usuario y retorna un token JWT.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "rol": "Waiter" // Opcional
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "jwt_token_here",
    "user": {
      "id": "uuid",
      "name": "John",
      "last_name": "Doe",
      "second_last_name": "Smith",
      "rol": "Waiter",
      "cash_register_id": null
    }
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### POST /auth/verify_user
Verifica si un usuario existe y genera un token para reset de contraseña.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John",
    "last_name": "Doe",
    "second_last_name": "Smith",
    "rol": "Waiter",
    "token": "reset_token_here"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### PUT /auth/set-password/:user_id
Actualiza la contraseña de un usuario.

**Request Body:**
```json
{
  "password": "newPassword123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Password updated successfully"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## 🧪 Testing

### Unit Tests
```bash
npm run test:unit -- auth
```

### Integration Tests
```bash
npm run test:integration -- auth
```

## 🔒 Seguridad

- Passwords hasheados con bcrypt (10 salt rounds)
- JWT tokens con expiración configurable
- Validación de entrada con Zod
- Manejo seguro de errores

## 📝 Notas

- El módulo elimina la dependencia de `cash_register` para el login de meseros
- Los tokens JWT incluyen información del usuario (email, userId, rol)
- Las contraseñas se validan con mínimo 6 caracteres

---

**Última actualización:** [Fecha]

