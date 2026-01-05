# Plan de Desarrollo - Restify API Serverless

## 📋 Información del Proyecto

**Nombre del Proyecto:** Restify  
**Tipo:** Migración de API REST a Arquitectura Serverless  
**Stack Principal:** Node.js, TypeScript, AWS Lambda, Prisma, Stripe  
**Fecha de Inicio:** [Por definir]  
**Duración Estimada:** 12 semanas (3 meses)

---

## 🎯 Objetivos del Proyecto

1. Migrar API Express.js actual a arquitectura serverless en AWS
2. Implementar sistema de pagos robusto con Stripe
3. Integrar notificaciones en tiempo real vía WebSockets
4. Aplicar principios SOLID y Clean Architecture
5. Mejorar escalabilidad, mantenibilidad y performance
6. Implementar procesamiento asíncrono con colas (SQS)
7. **Simplificar arquitectura eliminando módulo Cash Register innecesario**

---

## ⚠️ Decisiones Arquitectónicas Importantes

### Eliminación del Módulo Cash Register

**Decisión:** El módulo `cash_register` y `cash_register_operations` será eliminado y reemplazado por un sistema simplificado de reportes de flujo de caja.

**Razones:**
- El flujo de caja se puede calcular directamente desde las órdenes agrupadas por método de pago
- Reduce complejidad innecesaria (3 pasos: crear caja → asignar → abrir)
- Mejora UX eliminando pasos extra para usuarios
- Simplifica el código y reduce mantenimiento
- Mejor performance (menos joins en queries)

**Reemplazo:**
- Nuevo módulo: **Cash Flow Reports**
- Calcula flujo de caja directamente desde órdenes
- Agrupa por método de pago (efectivo, tarjeta, transferencia)
- Filtros por fecha, rango de fechas, y mesero (opcional)
- Incluye tips y pagos divididos

**Impacto en migración:**
- Eliminar tablas: `cash_registers`, `cash_registers_open`, `cash_registers_close`
- Eliminar campo `opening_cash_register_id` de `orders`
- Eliminar validación de caja abierta en login de meseros
- Crear nuevo servicio de reportes de flujo de caja

---

## 🏗️ Arquitectura Propuesta

### Stack Tecnológico

#### Core
- **Runtime:** Node.js 20.x (AWS Lambda)
- **Lenguaje:** TypeScript 5.x
- **Framework:** Serverless Framework / AWS SAM
- **ORM:** Prisma 5.x
- **Validaciones:** Zod

#### AWS Services
- **Compute:** AWS Lambda
- **API:** API Gateway (REST + WebSocket)
- **Database:** RDS Aurora Serverless v2 (MySQL)
- **Cache:** ElastiCache (Redis)
- **NoSQL:** DynamoDB
- **Colas:** Amazon SQS
- **Eventos:** Amazon EventBridge
- **Secrets:** AWS Secrets Manager
- **Storage:** S3 (para archivos/receipts)

#### Servicios Externos
- **Pagos:** Stripe (Payment Intents API)
- **Monitoreo:** CloudWatch, X-Ray

#### Desarrollo Local
- **Docker Compose:** MySQL, Redis, LocalStack
- **LocalStack:** Emulación de servicios AWS
- **Stripe CLI:** Webhooks locales

---

## 📅 Cronograma de Desarrollo

### **FASE 1: Setup y Fundación** (Semanas 1-2)

#### Semana 1: Configuración Inicial

**Día 1-2: Setup del Proyecto**
- [ ] Crear estructura de carpetas base
- [ ] Configurar TypeScript y ESLint
- [ ] Setup de Prisma con schema inicial
- [ ] Configurar package.json con dependencias
- [ ] Setup de variables de entorno (.env.example)

**Día 3-4: Infraestructura Local**
- [ ] Crear docker-compose.yml (MySQL, Redis, LocalStack)
- [ ] Configurar LocalStack con servicios necesarios
- [ ] Scripts de inicialización de LocalStack
- [ ] Configurar scripts de desarrollo (npm scripts)
- [ ] Documentar setup local en README

**Día 5: Testing del Setup**
- [ ] Verificar que todos los servicios locales funcionan
- [ ] Probar conexión a base de datos
- [ ] Probar LocalStack (SQS, EventBridge, DynamoDB)
- [ ] Crear script de seed de datos de prueba

**Entregables:**
- ✅ Proyecto base configurado
- ✅ Docker Compose funcionando
- ✅ LocalStack inicializado
- ✅ Prisma conectado a MySQL local
- ✅ Documentación de setup

---

#### Semana 2: Arquitectura Base

**Día 1-2: Domain Layer**
- [ ] Crear estructura de carpetas (domain, application, infrastructure)
- [ ] Definir entidades de dominio base (User, Order, Payment)
- [ ] Crear interfaces de repositorios
- [ ] Definir value objects (Money, PaymentMethod, etc.)
- [ ] Crear eventos de dominio

**Día 3-4: Application Layer**
- [ ] Setup de inyección de dependencias (tsyringe o inversify)
- [ ] Crear estructura de Use Cases
- [ ] Definir DTOs base
- [ ] Crear interfaces de servicios
- [ ] Implementar response handler estandarizado

**Día 5: Infrastructure Layer Base**
- [ ] Configurar Prisma client
- [ ] Crear repositorio base abstracto
- [ ] Configurar AWS clients (SQS, EventBridge, DynamoDB)
- [ ] Crear adaptador de configuración AWS (local vs cloud)
- [ ] Implementar logger estructurado

**Entregables:**
- ✅ Arquitectura base implementada
- ✅ Estructura de carpetas completa
- ✅ Configuración de AWS clients
- ✅ Sistema de logging

---

### **FASE 2: Refactorización Core** (Semanas 3-4)

#### Semana 3: Módulo Auth (POC)

**Día 1-2: Domain y Repository**
- [ ] Crear entidad User
- [ ] Implementar IUserRepository
- [ ] Implementar UserRepository con Prisma
- [ ] Tests unitarios del repositorio

**Día 3-4: Use Cases**
- [ ] LoginUseCase
- [ ] VerifyUserUseCase
- [ ] SetPasswordUseCase
- [ ] Tests unitarios de use cases

**Día 5: Lambda Handlers**
- [ ] Crear login.handler.ts
- [ ] Crear verify-user.handler.ts
- [ ] Crear set-password.handler.ts
- [ ] Configurar validaciones con Zod
- [ ] Configurar API Gateway routes
- [ ] Testing end-to-end

**Entregables:**
- ✅ Módulo Auth completamente migrado
- ✅ Funcionando en local con LocalStack
- ✅ Tests completos
- ✅ Documentación del módulo

---

#### Semana 4: Sistema de Pagos Base

**Día 1-2: Payment Domain**
- [ ] Crear entidad Payment
- [ ] Crear entidad PaymentSession
- [ ] Definir estados de pago (enum)
- [ ] Crear interfaces de payment gateway
- [ ] Implementar IPaymentRepository

**Día 3-4: Stripe Integration**
- [ ] Configurar Stripe SDK
- [ ] Implementar StripeGateway
- [ ] Crear PaymentIntent use case
- [ ] Implementar webhook handler base
- [ ] Testing con Stripe test mode

**Día 5: Payment Handlers**
- [ ] Crear initiate-payment.handler.ts
- [ ] Crear confirm-payment.handler.ts
- [ ] Crear get-payment-status.handler.ts
- [ ] Configurar rutas de API Gateway
- [ ] Testing completo

**Entregables:**
- ✅ Integración con Stripe funcionando
- ✅ Handlers de pago implementados
- ✅ Webhook handler base
- ✅ Tests de integración con Stripe

---

### **FASE 3: Procesamiento Asíncrono** (Semanas 5-6)

#### Semana 5: Colas y Workers

**Día 1-2: SQS Setup**
- [ ] Configurar colas en LocalStack
- [ ] Crear SQSQueueService
- [ ] Implementar envío de mensajes a colas
- [ ] Configurar Dead Letter Queue (DLQ)

**Día 3-4: Workers**
- [ ] Crear PaymentQueueWorker
- [ ] Implementar procesamiento asíncrono de pagos
- [ ] Manejo de errores y reintentos
- [ ] Logging y monitoreo de workers

**Día 5: EventBridge Integration**
- [ ] Configurar EventBridge en LocalStack
- [ ] Crear event publisher service
- [ ] Definir eventos de pago (initiated, completed, failed)
- [ ] Crear event handlers
- [ ] Testing de flujo completo

**Entregables:**
- ✅ Sistema de colas funcionando
- ✅ Workers procesando mensajes
- ✅ EventBridge integrado
- ✅ Flujo asíncrono completo

---

#### Semana 6: WebSockets y Notificaciones

**Día 1-2: WebSocket API Setup**
- [ ] Configurar API Gateway WebSocket
- [ ] Crear connect.handler.ts
- [ ] Crear disconnect.handler.ts
- [ ] Guardar conexiones en DynamoDB
- [ ] Testing de conexión/desconexión

**Día 3-4: Notification Service**
- [ ] Crear WebSocketNotificationService
- [ ] Implementar envío de notificaciones
- [ ] Integrar con eventos de pago
- [ ] Manejo de conexiones múltiples por usuario

**Día 5: Testing y Refinamiento**
- [ ] Testing completo de WebSockets
- [ ] Manejo de reconexiones
- [ ] Optimización de performance
- [ ] Documentación de WebSocket API

**Entregables:**
- ✅ WebSocket API funcionando
- ✅ Notificaciones en tiempo real
- ✅ Integración con eventos de pago
- ✅ Tests completos

---

### **FASE 4: Migración de Módulos** (Semanas 7-10)

#### Semana 7: Módulo Products

**Día 1-2: Domain y Repository**
- [ ] Crear entidad Product
- [ ] Implementar IProductRepository
- [ ] Implementar ProductRepository con Prisma
- [ ] Tests del repositorio

**Día 3-4: Use Cases**
- [ ] CreateProductUseCase
- [ ] GetProductsUseCase
- [ ] UpdateProductUseCase
- [ ] DeleteProductUseCase
- [ ] Tests unitarios

**Día 5: Handlers y Routes**
- [ ] Crear handlers de productos
- [ ] Configurar validaciones con Zod
- [ ] Configurar rutas en API Gateway
- [ ] Testing end-to-end

**Entregables:**
- ✅ Módulo Products migrado
- ✅ Tests completos
- ✅ Documentación

---

#### Semana 8: Módulo Orders (con Pagos)

**Día 1-2: Domain y Repository**
- [ ] Crear entidad Order
- [ ] Crear entidad OrderItem
- [ ] Implementar IOrderRepository
- [ ] Implementar OrderRepository con Prisma
- [ ] Tests del repositorio

**Día 3-4: Use Cases**
- [ ] CreateOrderUseCase
- [ ] GetOrderUseCase
- [ ] UpdateOrderStatusUseCase
- [ ] PayOrderUseCase (integración con pagos)
- [ ] Tests unitarios

**Día 5: Handlers y Integración**
- [ ] Crear handlers de órdenes
- [ ] Integrar con sistema de pagos
- [ ] Configurar eventos de orden
- [ ] Testing completo

**Entregables:**
- ✅ Módulo Orders migrado
- ✅ Integración con pagos
- ✅ Tests completos

---

#### Semana 9: Módulos Restantes (Parte 1)

**Día 1-2: Users Module**
- [ ] Migrar módulo de usuarios
- [ ] CRUD completo
- [ ] Tests

**Día 3-4: Tables Module**
- [ ] Migrar módulo de mesas
- [ ] Integrar con órdenes
- [ ] Tests

**Día 5: Cash Flow Reports Module** ⚠️ **NUEVO - Reemplaza Cash Register**
- [ ] Crear servicio de reportes de flujo de caja
- [ ] Implementar agrupación por método de pago
- [ ] Reportes por fecha/rango de fechas
- [ ] Reportes por mesero (opcional)
- [ ] Incluir tips y pagos divididos
- [ ] Tests

**Entregables:**
- ✅ Módulos Users, Tables migrados
- ✅ Módulo Cash Flow Reports implementado (reemplaza Cash Register)

---

#### Semana 10: Módulos Restantes (Parte 2)

**Día 1-2: Business Services**
- [ ] Migrar módulo de servicios de negocio
- [ ] Migrar pagos de servicios
- [ ] Tests

**Día 3-4: Employees Salaries**
- [ ] Migrar módulo de salarios
- [ ] Migrar pagos de salarios
- [ ] Tests

**Día 5: Reports y Otros**
- [ ] Migrar módulos de reportes existentes
- [ ] Integrar con Cash Flow Reports
- [ ] Optimizar queries
- [ ] Tests

**Nota:** El módulo Cash Register ha sido eliminado y reemplazado por Cash Flow Reports que calcula el flujo de caja directamente desde las órdenes.

**Entregables:**
- ✅ Todos los módulos migrados
- ✅ Sistema completo funcionando

---

### **FASE 5: Refinamiento y Testing** (Semana 11)

**Día 1-2: Testing Comprehensivo**
- [ ] Unit tests (cobertura > 80%)
- [ ] Integration tests
- [ ] E2E tests de flujos críticos
- [ ] Load testing básico

**Día 3-4: Optimización**
- [ ] Optimizar cold starts
- [ ] Optimizar queries de base de datos
- [ ] Implementar caching donde sea necesario
- [ ] Revisar y optimizar bundle sizes

**Día 5: Documentación**
- [ ] Documentar API (OpenAPI/Swagger)
- [ ] Documentar arquitectura
- [ ] Guías de deployment
- [ ] README completo

**Entregables:**
- ✅ Tests completos
- ✅ Optimizaciones aplicadas
- ✅ Documentación completa

---

### **FASE 6: Deployment y Producción** (Semana 12)

**Día 1-2: Setup de Infraestructura AWS**
- [ ] Configurar RDS Aurora Serverless
- [ ] Configurar ElastiCache
- [ ] Configurar Secrets Manager
- [ ] Setup de VPC y seguridad

**Día 3-4: CI/CD**
- [ ] Configurar GitHub Actions / AWS CodePipeline
- [ ] Pipeline de testing
- [ ] Pipeline de deployment a staging
- [ ] Pipeline de deployment a producción

**Día 5: Deployment y Monitoreo**
- [ ] Deploy a staging
- [ ] Testing en staging
- [ ] Configurar CloudWatch alarms
- [ ] Setup de X-Ray tracing
- [ ] Deploy a producción (si todo OK)

**Entregables:**
- ✅ Sistema desplegado en AWS
- ✅ CI/CD funcionando
- ✅ Monitoreo configurado
- ✅ Sistema en producción

---

## 📁 Estructura de Carpetas

```
Restify/
├── src/
│   ├── core/
│   │   ├── domain/
│   │   │   ├── entities/
│   │   │   ├── value-objects/
│   │   │   └── interfaces/
│   │   ├── application/
│   │   │   ├── use-cases/
│   │   │   ├── dto/
│   │   │   └── interfaces/
│   │   └── infrastructure/
│   │       ├── database/
│   │       │   ├── prisma/
│   │       │   └── repositories/
│   │       ├── payment-gateways/
│   │       ├── events/
│   │       ├── notifications/
│   │       └── config/
│   ├── handlers/
│   │   ├── auth/
│   │   ├── payments/
│   │   ├── websocket/
│   │   └── [otros módulos]/
│   ├── shared/
│   │   ├── middleware/
│   │   ├── utils/
│   │   └── types/
│   └── validators/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── scripts/
│   ├── dev-setup.sh
│   ├── start-local.sh
│   └── seed-db.ts
├── docker-compose.yml
├── docker-compose.dev.yml
├── localstack/
│   └── init-scripts/
├── serverless.yml
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

---

## 🔧 Configuración de Desarrollo Local

### Requisitos Previos

- Node.js 20.x
- Docker Desktop
- Docker Compose
- Stripe CLI (opcional, para webhooks)

### Servicios Locales

1. **MySQL** (puerto 3306)
2. **Redis** (puerto 6379)
3. **LocalStack** (puerto 4566)
   - SQS
   - EventBridge
   - DynamoDB
   - Secrets Manager
   - API Gateway (emulado)

### Scripts Principales

```json
{
  "dev": "nodemon --watch src --exec \"ts-node src/app.ts\"",
  "dev:local": "npm run local:start && npm run dev",
  "local:start": "./scripts/start-local.sh",
  "local:stop": "docker-compose down",
  "prisma:migrate:dev": "prisma migrate dev",
  "prisma:studio": "prisma studio",
  "test": "jest",
  "test:watch": "jest --watch",
  "test:coverage": "jest --coverage"
}
```

---

## 🧪 Estrategia de Testing

### Unit Tests
- **Target:** Use Cases, Services, Utils
- **Cobertura mínima:** 80%
- **Framework:** Jest
- **Mocks:** Para repositorios y servicios externos

### Integration Tests
- **Target:** Handlers, Repositories, AWS Services (LocalStack)
- **Framework:** Jest + Supertest
- **Base de datos:** MySQL local o test container

### E2E Tests
- **Target:** Flujos completos (pago, orden, etc.)
- **Framework:** Jest
- **Servicios:** Todos los servicios locales

---

## 📊 Métricas de Éxito

### Funcionalidad
- ✅ Todos los endpoints migrados y funcionando
- ✅ Sistema de pagos operativo
- ✅ Notificaciones en tiempo real funcionando
- ✅ Procesamiento asíncrono funcionando

### Performance
- ✅ Cold start < 1 segundo
- ✅ Response time p95 < 500ms
- ✅ Throughput adecuado para carga esperada

### Calidad
- ✅ Cobertura de tests > 80%
- ✅ Sin errores críticos
- ✅ Documentación completa
- ✅ Código siguiendo principios SOLID

### Costos
- ✅ Dentro del presupuesto estimado ($100-400/mes)
- ✅ Optimización de recursos

---

## 🚨 Riesgos y Mitigaciones

### Riesgo 1: Complejidad de Migración
- **Mitigación:** Migración incremental, módulo por módulo
- **Contingencia:** Mantener sistema legacy funcionando durante migración

### Riesgo 2: Cold Starts en Lambda
- **Mitigación:** Provisioned concurrency para endpoints críticos
- **Contingencia:** Optimizar bundle size, lazy loading

### Riesgo 3: Integración con Stripe
- **Mitigación:** Testing exhaustivo con Stripe test mode
- **Contingencia:** Implementar fallback a otro gateway si es necesario

### Riesgo 4: WebSockets en Producción
- **Mitigación:** Testing de carga, manejo de reconexiones
- **Contingencia:** Implementar polling como fallback

---

## 📚 Documentación Requerida

1. **README.md** - Setup y uso básico
2. **ARCHITECTURE.md** - Arquitectura detallada
3. **API_DOCS.md** - Documentación de API (OpenAPI)
4. **DEPLOYMENT.md** - Guía de deployment
5. **DEVELOPMENT.md** - Guía para desarrolladores
6. **PAYMENTS.md** - Documentación del sistema de pagos

---

## 👥 Roles y Responsabilidades

### Desarrollador Backend
- Implementación de módulos
- Creación de tests
- Code reviews

### DevOps
- Configuración de infraestructura AWS
- Setup de CI/CD
- Monitoreo y alertas

### QA
- Testing de integración
- E2E testing
- Testing de carga

---

## 🔄 Proceso de Desarrollo

### Workflow
1. Crear branch desde `main` (feature/nombre-modulo)
2. Implementar cambios siguiendo arquitectura
3. Escribir tests
4. Code review
5. Merge a `main`
6. Deploy automático a staging
7. Testing en staging
8. Deploy a producción

### Code Review Checklist
- [ ] Código sigue principios SOLID
- [ ] Tests escritos y pasando
- [ ] Documentación actualizada
- [ ] Sin errores de linting
- [ ] Performance considerado

---

## 📞 Contactos y Recursos

### Documentación Externa
- [AWS Lambda Docs](https://docs.aws.amazon.com/lambda/)
- [Prisma Docs](https://www.prisma.io/docs)
- [Stripe Docs](https://stripe.com/docs)
- [Serverless Framework](https://www.serverless.com/framework/docs)

### Herramientas
- LocalStack: https://localstack.cloud/
- Stripe CLI: https://stripe.com/docs/stripe-cli

---

## ✅ Checklist de Inicio

Antes de comenzar, verificar:

- [ ] Node.js 20.x instalado
- [ ] Docker Desktop instalado y corriendo
- [ ] Cuenta de AWS configurada
- [ ] Cuenta de Stripe (test mode)
- [ ] Acceso a base de datos actual
- [ ] Git configurado
- [ ] Editor de código configurado (VS Code recomendado)

---

## 📝 Notas Adicionales

- Este plan es flexible y puede ajustarse según necesidades
- Priorizar calidad sobre velocidad
- Documentar decisiones arquitectónicas importantes
- Mantener comunicación constante con el equipo
- Realizar demos periódicas del progreso

---

**Última actualización:** [Fecha]  
**Versión del Plan:** 1.0

