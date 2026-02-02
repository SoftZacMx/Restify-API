# Scripts de Inicialización MySQL

Este directorio contiene scripts SQL que se ejecutan automáticamente cuando MySQL se inicializa por primera vez.

## ¿Cómo funciona?

MySQL Docker ejecuta automáticamente todos los archivos `.sql` y `.sh` en `/docker-entrypoint-initdb.d/` cuando el contenedor se inicializa por primera vez (cuando el volumen de datos está vacío).

## Archivos

- `01-setup-user.sql`: Configura el usuario `restify_user` con el plugin `mysql_native_password` para compatibilidad con Prisma.

## ¿Por qué es necesario?

MySQL 8.0 usa por defecto el plugin `caching_sha2_password`, que puede causar problemas de compatibilidad con algunos clientes MySQL, incluyendo Prisma en ciertas configuraciones. Este script asegura que el usuario use `mysql_native_password`, que es más compatible.

## Notas

- Estos scripts solo se ejecutan cuando MySQL se inicializa por primera vez
- Si ya tienes datos en el volumen, estos scripts NO se ejecutarán automáticamente
- Para corregir una base de datos existente, usa `../fix-mysql-auth.sh`
