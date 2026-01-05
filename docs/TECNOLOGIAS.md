# Stack Tecnológico - Restify

## 🛠️ Tecnologías Principales

### Runtime y Lenguaje
- **Node.js:** 20.x LTS
- **TypeScript:** 5.x
- **Package Manager:** npm

### Framework y Deployment
- **Serverless Framework:** Para deployment y gestión de Lambda
- **AWS SAM:** Alternativa (opcional)

### Base de Datos
- **Prisma:** 5.x (ORM)
- **MySQL:** 8.0 (vía RDS Aurora Serverless v2)
- **DynamoDB:** Para sesiones y WebSocket connections
- **Redis:** Para cache y rate limiting (ElastiCache)

### Validaciones
- **Zod:** Validación type-safe de schemas

### Pagos
- **Stripe:** Payment Intents API
- **Stripe CLI:** Para webhooks locales

### AWS Services
- **Lambda:** Compute serverless
- **API Gateway:** REST API + WebSocket API
- **SQS:** Colas de mensajes
- **EventBridge:** Event bus
- **Secrets Manager:** Gestión de secrets
- **CloudWatch:** Logs y métricas
- **X-Ray:** Distributed tracing
- **S3:** Storage para archivos

### Desarrollo Local
- **Docker:** Contenedores
- **Docker Compose:** Orquestación
- **LocalStack:** Emulación de servicios AWS
- **MySQL (Docker):** Base de datos local
- **Redis (Docker):** Cache local

### Testing
- **Jest:** Framework de testing
- **Supertest:** Testing de HTTP
- **Prisma Mock:** Para mocking de base de datos

### Desarrollo
- **ESLint:** Linting
- **Prettier:** Code formatting
- **Nodemon:** Hot reload
- **ts-node:** Ejecutar TypeScript directamente

### Inyección de Dependencias
- **tsyringe:** Container de DI (recomendado)
- **inversify:** Alternativa

### Utilities
- **bcryptjs:** Hashing de passwords
- **jsonwebtoken:** JWT tokens
- **moment / date-fns:** Manejo de fechas

---

## 📦 Dependencias Principales

### Production Dependencies

```json
{
  "@aws-sdk/client-sqs": "^3.x",
  "@aws-sdk/client-eventbridge": "^3.x",
  "@aws-sdk/client-dynamodb": "^3.x",
  "@aws-sdk/client-secrets-manager": "^3.x",
  "@prisma/client": "^5.x",
  "zod": "^3.x",
  "stripe": "^14.x",
  "bcryptjs": "^2.x",
  "jsonwebtoken": "^9.x",
  "tsyringe": "^4.x"
}
```

### Development Dependencies

```json
{
  "@types/node": "^20.x",
  "@types/bcryptjs": "^2.x",
  "@types/jsonwebtoken": "^9.x",
  "typescript": "^5.x",
  "prisma": "^5.x",
  "jest": "^29.x",
  "@types/jest": "^29.x",
  "ts-jest": "^29.x",
  "supertest": "^6.x",
  "@types/supertest": "^6.x",
  "eslint": "^8.x",
  "prettier": "^3.x",
  "nodemon": "^3.x",
  "ts-node": "^10.x",
  "serverless": "^3.x",
  "serverless-offline": "^13.x"
}
```

---

## 🔄 Versiones Específicas Recomendadas

| Paquete | Versión | Notas |
|---------|---------|-------|
| Node.js | 20.11.0+ | LTS |
| TypeScript | 5.3.3+ | Última estable |
| Prisma | 5.7.1+ | Última estable |
| Zod | 3.22.4+ | Última estable |
| Stripe | 14.10.0+ | Última estable |
| Serverless | 3.38.0+ | Última estable |
| Jest | 29.7.0+ | Última estable |

---

## 🐳 Docker Images

### Servicios Locales

```yaml
services:
  mysql:
    image: mysql:8.0
    version: 8.0
    
  redis:
    image: redis:7-alpine
    version: 7-alpine
    
  localstack:
    image: localstack/localstack:latest
    version: latest
```

---

## 📚 Recursos de Aprendizaje

### Documentación Oficial
- [Node.js Docs](https://nodejs.org/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Prisma Docs](https://www.prisma.io/docs)
- [AWS Lambda Docs](https://docs.aws.amazon.com/lambda/)
- [Stripe Docs](https://stripe.com/docs)
- [Zod Docs](https://zod.dev/)
- [Serverless Framework](https://www.serverless.com/framework/docs)

### Tutoriales Recomendados
- Clean Architecture con TypeScript
- AWS Lambda best practices
- Stripe Payment Intents
- Prisma migrations
- Event-driven architecture

---

## 🔍 Herramientas de Desarrollo

### IDE/Editor
- **VS Code** (recomendado)
  - Extensiones:
    - Prisma
    - ESLint
    - Prettier
    - AWS Toolkit
    - Docker

### CLI Tools
- **AWS CLI:** Para gestión de recursos AWS
- **Stripe CLI:** Para webhooks locales
- **Docker CLI:** Para gestión de contenedores
- **Serverless CLI:** Para deployment

### Monitoreo y Debugging
- **CloudWatch:** Logs y métricas
- **X-Ray:** Tracing
- **Prisma Studio:** Visualización de datos
- **Redis Commander:** UI para Redis (opcional)

---

## ⚙️ Configuración Recomendada

### Node.js
```bash
# Usar nvm para gestión de versiones
nvm install 20
nvm use 20
```

### TypeScript
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

### ESLint
```json
{
  "extends": [
    "eslint:recommended",
    "@typescript-eslint/recommended"
  ],
  "rules": {
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/explicit-function-return-type": "warn"
  }
}
```

---

## 🔐 Seguridad

### Dependencias de Seguridad
- **npm audit:** Revisar regularmente
- **Snyk:** Scanning de vulnerabilidades (opcional)
- **Dependabot:** Actualizaciones automáticas (GitHub)

### Best Practices
- No commitear secrets
- Usar AWS Secrets Manager
- Validar todas las entradas
- Sanitizar outputs
- Rate limiting
- CORS configurado correctamente

---

**Última actualización:** [Fecha]

