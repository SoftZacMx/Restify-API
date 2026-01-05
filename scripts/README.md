# Scripts de Utilidad

## Seed Database

Crea usuarios por defecto para desarrollo y testing.

### Uso

```bash
npm run prisma:seed
```

### Usuarios creados

| Email | Role | Password | Descripción |
|-------|------|----------|-------------|
| `admin@restify.com` | ADMIN | `Restify123!` | Usuario administrador |
| `manager@restify.com` | MANAGER | `Restify123!` | Usuario manager |
| `waiter@restify.com` | WAITER | `Restify123!` | Usuario mesero |
| `chef@restify.com` | CHEF | `Restify123!` | Usuario chef |

### Características

- ✅ Verifica si los usuarios ya existen antes de crearlos
- ✅ Hashea las contraseñas automáticamente
- ✅ Crea usuarios con diferentes roles
- ✅ Muestra información clara de los usuarios creados

### Notas

- El script no sobrescribe usuarios existentes
- Para recrear usuarios, elimínalos primero o resetea la base de datos
- Las contraseñas están hardcodeadas para desarrollo (cambiar en producción)

