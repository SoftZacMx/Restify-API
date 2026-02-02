-- Script de inicialización MySQL
-- Este script se ejecuta automáticamente cuando MySQL se inicializa por primera vez
-- Configura el usuario con mysql_native_password para compatibilidad con Prisma

-- Asegurar que el usuario use mysql_native_password (compatible con Prisma)
-- Esto es necesario porque MySQL 8.0 usa caching_sha2_password por defecto
-- que puede causar problemas con algunos clientes MySQL

-- Eliminar usuario si existe (para recrearlo con el plugin correcto)
DROP USER IF EXISTS 'restify_user'@'%';

-- Crear usuario con el plugin mysql_native_password (compatible con Prisma)
CREATE USER 'restify_user'@'%' IDENTIFIED WITH mysql_native_password BY 'restify_password';

-- Otorgar todos los privilegios en la base de datos restify
GRANT ALL PRIVILEGES ON restify.* TO 'restify_user'@'%';

-- Otorgar permisos adicionales para Prisma Migrate (necesita crear shadow database)
GRANT CREATE ON *.* TO 'restify_user'@'%';

-- Aplicar cambios
FLUSH PRIVILEGES;
