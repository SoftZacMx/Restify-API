#!/bin/bash

# Script para corregir el plugin de autenticación MySQL
# Úsalo si ya tienes una base de datos existente con el problema de sha256_password

set -e

echo "🔧 Corrigiendo plugin de autenticación MySQL..."

# Verificar que el contenedor esté corriendo
if ! docker ps | grep -q restify-mysql; then
    echo "❌ Error: El contenedor restify-mysql no está corriendo"
    echo "   Ejecuta: docker compose up -d mysql"
    exit 1
fi

echo "📝 Cambiando plugin de autenticación a mysql_native_password..."

# Ejecutar comando SQL para cambiar el plugin
docker exec -i restify-mysql mysql -u root -proot_password <<EOF
ALTER USER 'restify_user'@'%' IDENTIFIED WITH mysql_native_password BY 'restify_password';
FLUSH PRIVILEGES;
SELECT user, host, plugin FROM mysql.user WHERE user = 'restify_user';
EOF

echo ""
echo "✅ Plugin de autenticación corregido exitosamente"
echo "   Ahora puedes reiniciar tu aplicación"
