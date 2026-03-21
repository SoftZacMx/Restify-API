# Datos crudos para seed (Railway dump)

Estos JSON contienen **solo datos crudos** extraídos de `railway_dump.sql`, sin IDs ni relaciones.

- **railway-raw-users.json**: `name`, `last_name`, `second_last_name`, `email`, `rol`, `password`, `phone`, `status`
- **railway-raw-categories.json**: `old_id`, `name`, `status` (para mapear platillos a categorías)
- **railway-raw-menu-items.json**: `name`, `price`, `status`, `category_id` (id viejo), `is_extra`

Para volver a extraer desde el dump (por si se actualiza el SQL):

```bash
node scripts/parse-railway-dump.js
```

Para cargar estos datos en la BD actual:

```bash
npm run seed:railway
```

Requisitos: `DATABASE_URL` en `.env` y migraciones aplicadas (`npx prisma migrate deploy`).

---

## Solo actualizar precios desde un dump (`backups_bdd/dump.sql`)

Para **no re-seedear** todo: copia el SQL a `backups_bdd/dump.sql` y ejecuta:

```bash
DRY_RUN=1 npm run sync:prices:dump   # ver qué cambiaría
npm run sync:prices:dump             # aplicar en la BDD de DATABASE_URL
```

Detalle: `scripts/sync-menu-prices-from-dump.ts` — lee precios desde `INSERT INTO \`saources\`` y actualiza `menu_items` por nombre. Ver `backups_bdd/README.md`.
