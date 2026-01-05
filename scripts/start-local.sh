#!/bin/bash

# Script para iniciar servicios locales con Docker

set -e

echo "🚀 Iniciando servicios locales con Docker..."

# Verificar que Docker está corriendo
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker no está corriendo. Por favor inicia Docker Desktop."
    exit 1
fi

# Iniciar servicios con docker-compose
echo "📦 Iniciando contenedores..."
docker-compose up -d

# Esperar a que los servicios estén listos
echo "⏳ Esperando a que los servicios estén listos..."
sleep 5

# Verificar estado de los servicios
echo "🔍 Verificando estado de los servicios..."

# Verificar MySQL
if docker exec restify-mysql mysqladmin ping -h localhost -u root -proot_password --silent; then
    echo "✅ MySQL está listo"
else
    echo "⏳ MySQL aún no está listo, esperando..."
    sleep 10
fi

# Verificar Redis
if docker exec restify-redis redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis está listo"
else
    echo "⏳ Redis aún no está listo, esperando..."
    sleep 5
fi

# Verificar LocalStack
if curl -f http://localhost:4566/_localstack/health > /dev/null 2>&1; then
    echo "✅ LocalStack está listo"
else
    echo "⏳ LocalStack aún no está listo, esperando..."
    sleep 10
fi

echo ""
echo "✨ Servicios iniciados correctamente!"
echo ""
echo "📋 Servicios disponibles:"
echo "   - MySQL:     localhost:3306"
echo "   - Redis:     localhost:6379"
echo "   - LocalStack: http://localhost:4566"
echo ""
echo "💡 Próximos pasos:"
echo "   1. Asegúrate de tener un archivo .env.local configurado"
echo "   2. Ejecuta: npm run prisma:generate"
echo "   3. Ejecuta: npm run prisma:migrate:dev"
echo "   4. Ejecuta: npm run dev"
echo ""

