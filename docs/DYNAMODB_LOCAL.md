# DynamoDB Local - Guía de Uso

## 🎯 Resumen

Este proyecto usa **LocalStack** para ejecutar DynamoDB localmente. LocalStack emula los servicios de AWS, incluyendo DynamoDB, en tu máquina local.

## 🚀 Inicio Rápido

### 1. Iniciar LocalStack

```bash
# Iniciar todos los servicios (MySQL, Redis, LocalStack)
npm run local:start

# O solo LocalStack
docker-compose up -d localstack
```

### 2. Verificar que LocalStack está corriendo

```bash
# Verificar salud de LocalStack
curl http://localhost:4566/_localstack/health

# Deberías ver algo como:
# {"services": {"dynamodb": "available", "sqs": "available", ...}}
```

### 3. Inicializar recursos DynamoDB

```bash
# Crear tablas en DynamoDB (LocalStack)
npm run localstack:init
```

Este script crea:
- Tabla `websocket-connections` con índices GSI
- Tabla `payment-sessions`

### 4. Probar DynamoDB

```bash
# Ejecutar pruebas de DynamoDB
npm run test:dynamodb
```

## 📋 Configuración

### Variables de Entorno

Asegúrate de tener estas variables en tu archivo `.env` o `.env.local`:

```env
# AWS Configuration (LocalStack)
AWS_ENDPOINT_URL="http://localhost:4566"
AWS_REGION="us-east-1"
AWS_ACCESS_KEY_ID="test"
AWS_SECRET_ACCESS_KEY="test"

# DynamoDB
DYNAMODB_ENDPOINT="http://localhost:4566"
WEBSOCKET_CONNECTIONS_TABLE="websocket-connections"
PAYMENT_SESSIONS_TABLE="payment-sessions"
```

### Docker Compose

LocalStack está configurado en `docker-compose.yml`:

```yaml
localstack:
  image: localstack/localstack:latest
  ports:
    - "4566:4566"
  environment:
    - SERVICES=sqs,dynamodb,eventbridge,secretsmanager
```

## 🔧 Comandos Útiles

### Listar tablas DynamoDB

```bash
aws --endpoint-url=http://localhost:4566 dynamodb list-tables --region us-east-1
```

### Ver estructura de una tabla

```bash
aws --endpoint-url=http://localhost:4566 dynamodb describe-table \
  --table-name websocket-connections \
  --region us-east-1
```

### Insertar un item de prueba

```bash
aws --endpoint-url=http://localhost:4566 dynamodb put-item \
  --table-name websocket-connections \
  --item '{
    "connectionId": {"S": "test-123"},
    "customConnectionId": {"S": "custom-123"},
    "userId": {"S": "user-123"},
    "connectedAt": {"S": "2024-01-01T00:00:00Z"}
  }' \
  --region us-east-1
```

### Consultar items

```bash
aws --endpoint-url=http://localhost:4566 dynamodb get-item \
  --table-name websocket-connections \
  --key '{"connectionId": {"S": "test-123"}}' \
  --region us-east-1
```

### Escanear tabla

```bash
aws --endpoint-url=http://localhost:4566 dynamodb scan \
  --table-name websocket-connections \
  --region us-east-1
```

## 🧪 Testing

### Ejecutar pruebas de DynamoDB

```bash
npm run test:dynamodb
```

Este script:
1. Lista todas las tablas
2. Verifica que `websocket-connections` existe
3. Inserta un item de prueba
4. Lee el item
5. Elimina el item

### En el código

El repositorio `WebSocketConnectionRepository` está configurado para usar LocalStack automáticamente cuando `AWS_ENDPOINT_URL` apunta a `http://localhost:4566`.

```typescript
// El repositorio detecta automáticamente LocalStack
const repository = container.resolve<IWebSocketConnectionRepository>(
  'IWebSocketConnectionRepository'
);

// Guardar conexión
await repository.save({
  connectionId: 'conn-123',
  customConnectionId: 'custom-123',
  userId: 'user-123',
  connectedAt: new Date().toISOString(),
});
```

## 🐛 Troubleshooting

### LocalStack no está corriendo

```bash
# Verificar estado
docker-compose ps

# Iniciar LocalStack
docker-compose up -d localstack

# Ver logs
docker-compose logs localstack
```

### Tablas no existen

```bash
# Inicializar recursos
npm run localstack:init

# Verificar tablas
aws --endpoint-url=http://localhost:4566 dynamodb list-tables --region us-east-1
```

### Error de conexión

1. Verifica que LocalStack esté corriendo: `curl http://localhost:4566/_localstack/health`
2. Verifica las variables de entorno: `AWS_ENDPOINT_URL=http://localhost:4566`
3. Verifica que el puerto 4566 no esté ocupado: `lsof -i :4566`

### Datos no persisten

LocalStack tiene persistencia habilitada en `docker-compose.yml`:

```yaml
volumes:
  - localstack_data:/tmp/localstack
```

Los datos se guardan en el volumen `localstack_data`. Para limpiar:

```bash
docker-compose down -v  # Elimina volúmenes
```

## 📚 Recursos

- [LocalStack Documentation](https://docs.localstack.cloud/)
- [DynamoDB Local](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBLocal.html)
- [AWS SDK v3 DynamoDB](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-dynamodb/)

## ✅ Checklist

- [ ] LocalStack corriendo (`docker-compose ps`)
- [ ] Variables de entorno configuradas
- [ ] Tablas creadas (`npm run localstack:init`)
- [ ] Pruebas pasando (`npm run test:dynamodb`)
- [ ] Repositorio funcionando en código

