#!/usr/bin/env ts-node

/**
 * Seed a partir de datos crudos extraídos del dump de Railway:
 * - Usuarios (railway-raw-users.json)
 * - Categorías (railway-raw-categories.json): solo para saber old_id → nombre (no se crean categorías)
 * - Platillos (railway-raw-menu-items.json): name, price, status, category_id (old), is_extra
 *
 * Las categorías no se crean: se usa el nombre de la categoría del dump para buscar en la BDD
 * existente (menu_categories) por nombre y asignar ese categoryId al platillo.
 *
 * Uso: npm run seed:railway
 * Requiere: DATABASE_URL en .env. Ejecutar antes: npx prisma migrate deploy
 */

import { PrismaClient, UserRole } from '@prisma/client';
import * as path from 'path';
import * as fs from 'fs';

const prisma = new PrismaClient();

const RAW_USERS_PATH = path.join(__dirname, 'seed-data', 'railway-raw-users.json');
const RAW_CATEGORIES_PATH = path.join(__dirname, 'seed-data', 'railway-raw-categories.json');
const RAW_MENU_ITEMS_PATH = path.join(__dirname, 'seed-data', 'railway-raw-menu-items.json');

type RawUser = {
  name: string;
  last_name: string;
  second_last_name: string;
  email: string;
  rol: string;
  password: string;
  phone: string;
  status: boolean;
};

type RawCategory = { old_id: number; name: string; status: boolean };

type RawMenuItem = {
  name: string;
  price: number;
  status: boolean;
  category_id?: number;
  is_extra: boolean;
};

function mapRol(rol: string): UserRole {
  const r = rol?.trim().toLowerCase();
  if (r === 'administrator' || r === 'admin') return UserRole.ADMIN;
  if (r === 'manager') return UserRole.MANAGER;
  if (r === 'chef') return UserRole.CHEF;
  return UserRole.WAITER;
}

async function main(): Promise<void> {
  console.log('🌱 Seed datos Railway (usuarios + platillos)\n');

  if (!fs.existsSync(RAW_USERS_PATH) || !fs.existsSync(RAW_MENU_ITEMS_PATH)) {
    throw new Error(
      `Faltan archivos de datos. Asegúrate de tener:\n  - ${RAW_USERS_PATH}\n  - ${RAW_MENU_ITEMS_PATH}`
    );
  }

  const rawUsers: RawUser[] = JSON.parse(fs.readFileSync(RAW_USERS_PATH, 'utf8'));
  const rawMenuItems: RawMenuItem[] = JSON.parse(fs.readFileSync(RAW_MENU_ITEMS_PATH, 'utf8'));
  const rawCategories: RawCategory[] = fs.existsSync(RAW_CATEGORIES_PATH)
    ? JSON.parse(fs.readFileSync(RAW_CATEGORIES_PATH, 'utf8'))
    : [];

  // Cargar todas las categorías de la BDD y mapear por nombre normalizado (trim + minúsculas)
  const dbCategories = await prisma.menuCategory.findMany();
  const categoryIdByNormalizedName: Record<string, string> = {};
  for (const cat of dbCategories) {
    const key = cat.name.trim().toLowerCase();
    if (!categoryIdByNormalizedName[key]) categoryIdByNormalizedName[key] = cat.id;
  }
  console.log(`📁 Categorías en BDD (menu_categories): ${dbCategories.length}\n`);

  // old_id → nombre del dump (para saber qué categoría tiene cada platillo)
  const categoryNameByOldId: Record<number, string> = {};
  for (const c of rawCategories) {
    categoryNameByOldId[c.old_id] = c.name.trim();
  }

  let firstUserId = '';

  console.log('👥 Usuarios (upsert por email, rol mapeado a UserRole)...');
  for (const u of rawUsers) {
    const rol = mapRol(u.rol);
    const user = await prisma.user.upsert({
      where: { email: u.email },
      create: {
        name: u.name.trim(),
        last_name: u.last_name.trim(),
        second_last_name: u.second_last_name?.trim() || null,
        email: u.email.trim(),
        password: u.password,
        phone: u.phone?.trim() || null,
        status: u.status,
        rol,
      },
      update: {
        name: u.name.trim(),
        last_name: u.last_name.trim(),
        second_last_name: u.second_last_name?.trim() || null,
        phone: u.phone?.trim() || null,
        status: u.status,
        rol,
      },
    });
    if (!firstUserId) firstUserId = user.id;
    console.log(`   ${user.email} (${user.rol})`);
  }

  if (!firstUserId) {
    const admin = await prisma.user.findFirst({ where: { rol: UserRole.ADMIN } });
    if (admin) firstUserId = admin.id;
  }
  if (!firstUserId) throw new Error('No hay ningún usuario para asociar platillos.');

  console.log('🍽️  Platillos (categoryId por nombre normalizado vs menu_categories)...');
  let created = 0;
  let skipped = 0;
  let updated = 0;
  let withCategory = 0;
  for (const item of rawMenuItems) {
    let categoryId: string | null = null;
    if (item.category_id != null) {
      const dumpCategoryName = categoryNameByOldId[item.category_id];
      if (dumpCategoryName) {
        const key = dumpCategoryName.toLowerCase();
        categoryId = categoryIdByNormalizedName[key] ?? null;
        if (categoryId) withCategory++;
      }
    }
    const existing = await prisma.menuItem.findFirst({
      where: { name: item.name.trim(), isExtra: item.is_extra },
    });
    if (existing) {
      skipped++;
      if (categoryId != null && existing.categoryId === null) {
        await prisma.menuItem.update({ where: { id: existing.id }, data: { categoryId } });
        updated++;
      }
      continue;
    }
    await prisma.menuItem.create({
      data: {
        name: item.name.trim(),
        price: item.price,
        status: item.status,
        isExtra: item.is_extra,
        categoryId,
        userId: firstUserId,
      },
    });
    created++;
    if (created <= 20) console.log(`   ${item.name} - $${item.price}${item.is_extra ? ' (extra)' : ''}`);
  }
  if (created > 20) console.log(`   ... y ${created - 20} más.`);
  console.log(`   Creados: ${created}, ya existían: ${skipped}, actualizados (categoryId): ${updated}, con categoría asignada: ${withCategory}.`);

  console.log('\n✨ Seed Railway terminado.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
