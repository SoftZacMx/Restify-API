#!/usr/bin/env ts-node

/**
 * Seed general: usuarios, categorías, platillos, mesas, productos, gastos.
 * NO crea órdenes.
 *
 * Uso: npm run seed:general
 * Requiere: DATABASE_URL en .env (apuntando a la BDD remota o local).
 * Antes: npx prisma migrate deploy
 */

import { PrismaClient, UserRole, ExpenseType } from '@prisma/client';
import { BcryptUtil } from '../src/shared/utils/bcrypt.util';

const prisma = new PrismaClient();

const DEFAULT_PASSWORD = 'Restify123!';

// --- Usuarios (por si acaso; upsert por email) ---
const seedUsers = [
  { name: 'Admin', last_name: 'System', email: 'admin@restify.com', rol: UserRole.ADMIN },
  { name: 'Manager', last_name: 'Test', email: 'manager@restify.com', rol: UserRole.MANAGER },
  { name: 'Juan', last_name: 'Pérez', email: 'waiter@restify.com', rol: UserRole.WAITER },
  { name: 'María', last_name: 'López', email: 'chef@restify.com', rol: UserRole.CHEF },
];

// --- Categorías de menú (platos principales, postres, bebidas, extras, entradas) ---
const seedCategories = [
  { name: 'Platos Principales', status: true },
  { name: 'Postres', status: true },
  { name: 'Bebidas', status: true },
  { name: 'Extras', status: true },
  { name: 'Entradas', status: true },
];

// --- Platillos por categoría (nombre, precio, categoría por índice en seedCategories) ---
const seedDishes: { name: string; price: number; categoryIndex: number }[] = [
  { name: 'Pasta Carbonara', price: 18.5, categoryIndex: 0 },
  { name: 'Pizza Margherita', price: 15, categoryIndex: 0 },
  { name: 'Hamburguesa Clásica', price: 14.5, categoryIndex: 0 },
  { name: 'Pollo a la Parrilla', price: 16, categoryIndex: 0 },
  { name: 'Salmón a la Plancha', price: 22, categoryIndex: 0 },
  { name: 'Arroz con Pollo', price: 13, categoryIndex: 0 },
  { name: 'Tiramisú', price: 9.5, categoryIndex: 1 },
  { name: 'Brownie con Helado', price: 8.5, categoryIndex: 1 },
  { name: 'Flan Casero', price: 7, categoryIndex: 1 },
  { name: 'Cheesecake', price: 10, categoryIndex: 1 },
  { name: 'Agua Natural', price: 2.5, categoryIndex: 2 },
  { name: 'Refresco', price: 3, categoryIndex: 2 },
  { name: 'Café', price: 4, categoryIndex: 2 },
  { name: 'Jugo de Naranja', price: 5, categoryIndex: 2 },
  { name: 'Cerveza', price: 6, categoryIndex: 2 },
  { name: 'Ensalada César', price: 12.5, categoryIndex: 4 },
  { name: 'Sopa de Tomate', price: 8, categoryIndex: 4 },
  { name: 'Nachos', price: 9, categoryIndex: 4 },
];

// --- Extras (isExtra: true, sin categoría) ---
const seedExtras: { name: string; price: number }[] = [
  { name: 'Queso Extra', price: 2.5 },
  { name: 'Tocino', price: 3 },
  { name: 'Aguacate', price: 2 },
  { name: 'Huevo Frito', price: 2.5 },
  { name: 'Champiñones', price: 3.5 },
  { name: 'Salsa Extra', price: 1 },
  { name: 'Papas Fritas', price: 4 },
  { name: 'Aros de Cebolla', price: 5.5 },
];

// --- Mesas ---
/** Nombres de mesa (texto único, ej. "1", "1A", "Terraza") */
const tableNames = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

// --- Productos (para inventario/gastos) ---
const seedProducts = [
  { name: 'Tomate', description: 'Tomate para cocina' },
  { name: 'Pasta', description: 'Pasta seca' },
  { name: 'Pollo', description: 'Pollo fresco' },
  { name: 'Café en grano', description: 'Café para servicio' },
  { name: 'Papas', description: 'Papas para fritas' },
  { name: 'Lechuga', description: 'Lechuga para ensaladas' },
  { name: 'Queso', description: 'Queso para pizzas y extras' },
  { name: 'Refrescos (caja)', description: 'Refrescos para bar' },
];

// --- Gastos de ejemplo (sin órdenes) ---
const seedExpenses: { title: string; type: ExpenseType; total: number; subtotal: number; iva: number; paymentMethod: number; description?: string }[] = [
  { title: 'Limpieza mensual', type: ExpenseType.SERVICE_BUSINESS, total: 500, subtotal: 500, iva: 0, paymentMethod: 2, description: 'Limpieza de locales' },
  { title: 'Luz', type: ExpenseType.UTILITY, total: 220, subtotal: 220, iva: 0, paymentMethod: 2 },
  { title: 'Agua', type: ExpenseType.UTILITY, total: 80, subtotal: 80, iva: 0, paymentMethod: 2 },
  { title: 'Renta local', type: ExpenseType.RENT, total: 1500, subtotal: 1500, iva: 0, paymentMethod: 2 },
  { title: 'Otros gastos varios', type: ExpenseType.OTHER, total: 100, subtotal: 100, iva: 0, paymentMethod: 1 },
];

async function main(): Promise<void> {
  console.log('🌱 Seed general: usuarios, categorías, platillos, mesas, productos, gastos (sin órdenes)\n');

  const adminId = await seedUsersSection();
  const categoryIds = await seedCategoriesSection();
  await seedMenuItemsSection(adminId, categoryIds);
  await seedTablesSection(adminId);
  const productIds = await seedProductsSection(adminId);
  await seedExpensesSection(adminId, productIds);

  console.log('\n✨ Seed general terminado correctamente.');
}

async function seedUsersSection(): Promise<string> {
  console.log('👥 Usuarios (upsert por email)...');
  let adminId = '';

  for (const u of seedUsers) {
    const hashed = await BcryptUtil.hash(DEFAULT_PASSWORD);
    const user = await prisma.user.upsert({
      where: { email: u.email },
      create: {
        name: u.name,
        last_name: u.last_name,
        email: u.email,
        password: hashed,
        rol: u.rol,
        status: true,
      },
      update: {},
    });
    if (u.rol === UserRole.ADMIN) adminId = user.id;
    console.log(`   ${user.email} (${user.rol})`);
  }
  if (!adminId) {
    const admin = await prisma.user.findFirst({ where: { rol: UserRole.ADMIN } });
    if (admin) adminId = admin.id;
  }
  if (!adminId) throw new Error('No hay usuario ADMIN para asociar mesas/productos/platillos/gastos.');
  console.log('');
  return adminId;
}

async function seedCategoriesSection(): Promise<string[]> {
  console.log('📁 Categorías de menú...');
  const ids: string[] = [];

  for (const c of seedCategories) {
    let cat = await prisma.menuCategory.findFirst({ where: { name: c.name } });
    if (!cat) {
      cat = await prisma.menuCategory.create({ data: { name: c.name, status: c.status } });
    }
    ids.push(cat.id);
    console.log(`   ${c.name}`);
  }
  console.log('');
  return ids;
}

async function seedMenuItemsSection(userId: string, categoryIds: string[]): Promise<void> {
  console.log('🍽️  Platillos por categoría...');

  for (const d of seedDishes) {
    const categoryId = categoryIds[d.categoryIndex] ?? null;
    const existing = await prisma.menuItem.findFirst({ where: { name: d.name, isExtra: false } });
    if (!existing) {
      await prisma.menuItem.create({
        data: { name: d.name, price: d.price, status: true, isExtra: false, categoryId, userId },
      });
      console.log(`   ${d.name} - $${d.price}`);
    }
  }

  console.log('➕ Extras...');
  for (const e of seedExtras) {
    const existing = await prisma.menuItem.findFirst({ where: { name: e.name, isExtra: true } });
    if (!existing) {
      await prisma.menuItem.create({
        data: { name: e.name, price: e.price, status: true, isExtra: true, categoryId: null, userId },
      });
      console.log(`   ${e.name} - $${e.price}`);
    }
  }
  console.log('');
}

async function seedTablesSection(userId: string): Promise<void> {
  console.log('🪑 Mesas...');
  for (const name of tableNames) {
    const existing = await prisma.table.findFirst({ where: { name } });
    if (!existing) {
      await prisma.table.create({
        data: { name, userId, status: true, availabilityStatus: true },
      });
      console.log(`   Mesa ${name}`);
    }
  }
  console.log('');
}

async function seedProductsSection(userId: string): Promise<string[]> {
  console.log('📦 Productos...');
  const ids: string[] = [];

  for (const p of seedProducts) {
    let prod = await prisma.product.findFirst({ where: { name: p.name } });
    if (!prod) {
      prod = await prisma.product.create({
        data: { name: p.name, description: p.description ?? null, userId, status: true },
      });
      console.log(`   ${p.name}`);
    }
    ids.push(prod.id);
  }
  console.log('');
  return ids;
}

async function seedExpensesSection(userId: string, productIds: string[]): Promise<void> {
  console.log('💰 Gastos...');

  for (const e of seedExpenses) {
    const existing = await prisma.expense.findFirst({
      where: { title: e.title, userId, date: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
    });
    if (!existing) {
      await prisma.expense.create({
        data: {
          title: e.title,
          type: e.type,
          total: e.total,
          subtotal: e.subtotal,
          iva: e.iva,
          paymentMethod: e.paymentMethod,
          description: e.description ?? null,
          userId,
        },
      });
      console.log(`   ${e.title} - $${e.total}`);
    }
  }

  // Un gasto tipo MERCHANDISE con ítems (productos)
  const merchTitle = 'Compra mercancía semanal';
  const existingMerch = await prisma.expense.findFirst({
    where: { title: merchTitle, type: ExpenseType.MERCHANDISE, userId },
  });
  if (!existingMerch && productIds.length >= 2) {
    const subtotal = 150;
    const iva = 24;
    const total = 174;
    const exp = await prisma.expense.create({
      data: {
        title: merchTitle,
        type: ExpenseType.MERCHANDISE,
        subtotal,
        iva,
        total,
        paymentMethod: 2,
        userId,
      },
    });
    await prisma.expenseItem.createMany({
      data: [
        { expenseId: exp.id, productId: productIds[0], amount: 50, subtotal: 50, total: 50 },
        { expenseId: exp.id, productId: productIds[1], amount: 100, subtotal: 100, total: 100 },
      ],
    });
    console.log(`   ${merchTitle} - $${total}`);
  }
  console.log('');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed general:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
