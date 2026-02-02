# 🚀 Guía de Inicio Rápido

Esta guía te ayudará a iniciar el proyecto Restify con Docker.

## 📋 Prerrequisitos

- ✅ Node.js 20.x o superior
- ✅ Docker Desktop instalado y corriendo
- ✅ Docker Compose instalado
- ✅ npm o yarn

## 🔧 Pasos para Iniciar el Proyecto

### 1. Instalar Dependencias

```bash
cd Restify
npm install
```

### 2. Configurar Variables de Entorno

Copia el archivo de ejemplo y crea tu archivo `.env.local`:

```bash
cp env.example.txt .env.local
```

Edita `.env.local` con tus configuraciones. Los valores por defecto deberían funcionar para desarrollo local.

### 3. Iniciar Servicios Docker

Inicia todos los servicios (MySQL, Redis, LocalStack) con:

```bash
npm run local:start
```

O directamente con docker-compose:

```bash
docker-compose up -d
```

Esto iniciará:
- **MySQL** en el puerto `3306` (configurado con `mysql_native_password` para compatibilidad con Prisma)
- **Redis** en el puerto `6379`
- **LocalStack** (AWS services) en el puerto `4566`

**Nota:** Si es la primera vez que inicias el proyecto, MySQL se configurará automáticamente con el plugin de autenticación correcto. Espera 30-60 segundos después de iniciar los contenedores para que MySQL se inicialice completamente.

### 4. Generar Prisma Client

```bash
npm run prisma:generate
```

### 5. Ejecutar Migraciones de Base de Datos

```bash
npm run prisma:migrate:dev
```

Esto creará las tablas en la base de datos MySQL.

### 6. (Opcional) Seed de Datos

Si tienes un script de seed:

```bash
npm run prisma:seed
```

### 7. Iniciar el Servidor de Desarrollo

Para desarrollo local, puedes usar:

```bash
npm run dev
```

**Nota:** Como este proyecto está diseñado para AWS Lambda, para desarrollo local podrías necesitar:
- `serverless-offline` para simular Lambda localmente
- O crear un servidor HTTP simple que envuelva los handlers

## 🛠️ Comandos Útiles

### Docker

```bash
# Iniciar servicios
npm run local:start
# o
docker-compose up -d

# Ver logs
docker-compose logs -f

# Detener servicios
npm run local:stop
# o
docker-compose down

# Detener y eliminar volúmenes (limpiar todo)
npm run local:clean
# o
docker-compose down -v

# Ver estado de contenedores
docker-compose ps
```

### Base de Datos

```bash
# Generar Prisma Client
npm run prisma:generate

# Crear migración
npm run prisma:migrate:dev

# Abrir Prisma Studio (GUI para la BD)
npm run prisma:studio
```

### Desarrollo

```bash
# Modo desarrollo con hot reload
npm run dev

# Compilar TypeScript
npm run build

# Ejecutar versión compilada
npm run start
```

## 🔍 Verificar que Todo Está Funcionando

### Verificar Servicios Docker

```bash
# Ver estado de contenedores
docker-compose ps

# Ver logs de MySQL
docker-compose logs mysql

# Ver logs de Redis
docker-compose logs redis

# Ver logs de LocalStack
docker-compose logs localstack
```

### Verificar Conexión a MySQL

```bash
# Desde el contenedor
docker exec -it restify-mysql mysql -u sidgder_user -psidgder_password sidgder_db

# O desde tu máquina (si tienes mysql client)
mysql -h localhost -u sidgder_user -psidgder_password sidgder_db
```

### Verificar LocalStack

```bash
# Health check
curl http://localhost:4566/_localstack/health

# Listar colas SQS
aws --endpoint-url=http://localhost:4566 sqs list-queues --region us-east-1

# Listar tablas DynamoDB
aws --endpoint-url=http://localhost:4566 dynamodb list-tables --region us-east-1
```

## 🐛 Solución de Problemas

### Docker no está corriendo

```bash
# Verificar que Docker está corriendo
docker info

# Si no está corriendo, inicia Docker Desktop
```

### Puerto ya en uso

Si algún puerto (3306, 6379, 4566) ya está en uso, puedes cambiarlo en `docker-compose.yml`:

```yaml
ports:
  - "3307:3306"  # Cambiar puerto externo
```

### Los servicios no inician

```bash
# Ver logs detallados
docker-compose logs

# Reiniciar servicios
docker-compose restart

# Limpiar y reiniciar
docker-compose down -v
docker-compose up -d
```

### Error de conexión a la base de datos

Asegúrate de que:
1. MySQL está corriendo: `docker-compose ps`
2. La URL en `.env.local` es correcta
3. Has esperado suficiente tiempo para que MySQL inicie (puede tardar 10-20 segundos)

### Error: "Unknown authentication plugin 'sha256_password'"

Este error ocurre cuando MySQL 8.0 usa un plugin de autenticación incompatible con Prisma.

**Solución automática (recomendada para equipos nuevos):**
El proyecto ya está configurado para evitar este problema. Si es la primera vez que inicias el proyecto, simplemente:

```bash
# Limpiar volúmenes existentes (si los hay)
docker compose down -v

# Iniciar servicios (se configurará automáticamente)
docker compose up -d

# Esperar 30-60 segundos para que MySQL se inicialice completamente
```

**Solución para bases de datos existentes:**
Si ya tienes una base de datos con este problema, ejecuta el script de corrección:

```bash
# Opción 1: Usar el script automático
./scripts/fix-mysql-auth.sh

# Opción 2: Manualmente
docker exec -it restify-mysql mysql -u root -proot_password -e "ALTER USER 'restify_user'@'%' IDENTIFIED WITH mysql_native_password BY 'restify_password'; FLUSH PRIVILEGES;"
```

**Verificar que está corregido:**
```bash
docker exec -it restify-mysql mysql -u root -proot_password -e "SELECT user, host, plugin FROM mysql.user WHERE user = 'restify_user';"
```

Deberías ver `mysql_native_password` en la columna `plugin`.

## 📚 Próximos Pasos

- Revisa la [documentación completa](./README.md)
- Consulta el [Plan de Desarrollo](./docs/PLAN_DE_DESARROLLO.md)
- Revisa el [Checklist de Migración](./docs/CHECKLIST_MIGRACION.md)

## 💡 Tips

- Usa `docker-compose logs -f` para ver logs en tiempo real
- Prisma Studio es muy útil para explorar datos: `npm run prisma:studio`
- Los recursos de LocalStack se crean automáticamente al iniciar
- Puedes usar `docker-compose exec mysql bash` para acceder al contenedor MySQL

