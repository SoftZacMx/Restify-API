# Restify - API Serverless

## 📖 Descripción

Restify es la migración del proyecto SIDGDER-API-DEMO a una arquitectura serverless moderna en AWS, implementando buenas prácticas de programación, principios SOLID y un sistema robusto de pagos con notificaciones en tiempo real.

## 🎯 Características Principales

- ✅ Arquitectura Serverless con AWS Lambda
- ✅ Sistema de pagos con Stripe
- ✅ Notificaciones en tiempo real vía WebSockets
- ✅ Procesamiento asíncrono con colas (SQS)
- ✅ Event-driven architecture con EventBridge
- ✅ Clean Architecture + SOLID Principles
- ✅ Type-safe con TypeScript y Prisma
- ✅ Desarrollo local completo con Docker

## 🚀 Inicio Rápido

### Prerrequisitos

- Node.js 20.x o superior
- Docker Desktop instalado y corriendo
- Docker Compose
- Stripe CLI (opcional, para webhooks locales)

### Instalación

```bash
# Instalar dependencias
npm install

# Copiar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus configuraciones

# Generar Prisma Client
npm run prisma:generate

# Iniciar servicios locales (Docker)
npm run local:start

# Ejecutar migraciones de base de datos
npm run prisma:migrate:dev

# Iniciar desarrollo
npm run dev
```

## 📁 Estructura del Proyecto

```
Restify/
├── src/
│   ├── core/              # Capa de dominio y aplicación
│   │   ├── domain/         # Entidades, value objects, interfaces
│   │   ├── application/    # Use cases, DTOs
│   │   └── infrastructure/ # Repositorios, servicios externos
│   ├── handlers/          # Lambda handlers
│   ├── shared/             # Código compartido
│   └── validators/        # Validaciones Zod
├── tests/                 # Tests
├── scripts/               # Scripts de utilidad
└── localstack/            # Configuración LocalStack
```

## 🛠️ Scripts Disponibles

```bash
# Desarrollo
npm run dev              # Desarrollo con hot reload
npm run build            # Compilar TypeScript
npm run start            # Ejecutar versión compilada

# Base de datos
npm run prisma:generate  # Generar Prisma Client
npm run prisma:migrate:dev # Crear y aplicar migraciones
npm run prisma:studio    # Abrir Prisma Studio
npm run prisma:seed      # Crear usuarios por defecto (ver sección Usuarios por Defecto)

# Testing
npm run test             # Ejecutar todos los tests
npm run test:unit        # Solo unit tests
npm run test:integration # Solo integration tests
npm run test:e2e         # Solo E2E tests
npm run test:coverage    # Con cobertura

# Linting y formato
npm run lint             # Ejecutar ESLint
npm run lint:fix         # Arreglar errores de linting
npm run format           # Formatear código con Prettier

# Docker Local
npm run local:start      # Iniciar servicios Docker
npm run local:stop       # Detener servicios Docker
npm run local:clean      # Limpiar volúmenes Docker
```

## 👤 Usuarios por Defecto

Después de ejecutar `npm run prisma:seed`, tendrás los siguientes usuarios disponibles:

| Email | Role | Password | Descripción |
|-------|------|----------|-------------|
| `admin@restify.com` | ADMIN | `Restify123!` | Usuario administrador |
| `manager@restify.com` | MANAGER | `Restify123!` | Usuario manager |
| `waiter@restify.com` | WAITER | `Restify123!` | Usuario mesero |
| `chef@restify.com` | CHEF | `Restify123!` | Usuario chef |

**Nota:** Estos usuarios son solo para desarrollo. Cambia las contraseñas en producción.

### Probar Autenticación

```bash
# Login como admin
curl -X POST http://localhost:3000/api/auth/login/ADMIN \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@restify.com","password":"Restify123!"}'
```

## 🔧 Configuración

### Variables de Entorno

Crea un archivo `.env.local` basado en `.env.example` con las siguientes variables:

```bash
# Database
DATABASE_URL="mysql://user:password@localhost:3306/database"

# AWS (LocalStack)
AWS_ENDPOINT_URL="http://localhost:4566"
AWS_REGION="us-east-1"

# Stripe
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# JWT
JWT_SECRET="your_secret_key"
```

## 🧪 Testing

```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Coverage
npm run test:coverage
```

## 📚 Documentación

- [Plan de Desarrollo](./PLAN_DE_DESARROLLO.md) - Plan detallado de migración
- [Checklist de Migración](./CHECKLIST_MIGRACION.md) - Checklist por módulo
- [Tecnologías](./TECNOLOGIAS.md) - Stack tecnológico completo
- [Resumen del Plan](./RESUMEN_PLAN.md) - Resumen ejecutivo

## 🔐 Seguridad

- No commitear archivos `.env`
- Usar AWS Secrets Manager en producción
- Validar todas las entradas con Zod
- Implementar rate limiting

## 📝 Licencia

ISC

## 👥 Equipo

SOFTZAC

---

**Estado del Proyecto:** 🚧 En Desarrollo - Fase 1
