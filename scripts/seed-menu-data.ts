#!/usr/bin/env ts-node

/**
 * Database Seeding Script - Menu Data
 * Creates menu categories, menu items (dishes and extras), and tables
 * 
 * Usage: npm run seed:menu
 * or: ts-node scripts/seed-menu-data.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface SeedMenuCategory {
  name: string;
  status: boolean;
}

interface SeedMenuItem {
  name: string;
  price: number;
  status: boolean;
  isExtra: boolean;
  categoryId?: string | null;
}

interface SeedTable {
  name: string;
  status: boolean;
  availabilityStatus: boolean;
}

// 5 Categorías de Menú
const seedCategories: SeedMenuCategory[] = [
  { name: 'Entradas', status: true },
  { name: 'Platos Principales', status: true },
  { name: 'Postres', status: true },
  { name: 'Bebidas', status: true },
  { name: 'Especialidades', status: true },
];

// 10 Platillos (Menu Items con isExtra: false)
const seedMenuItems: SeedMenuItem[] = [
  { name: 'Ensalada César', price: 12.50, status: true, isExtra: false },
  { name: 'Sopa de Tomate', price: 8.00, status: true, isExtra: false },
  { name: 'Pasta Carbonara', price: 18.50, status: true, isExtra: false },
  { name: 'Pizza Margherita', price: 15.00, status: true, isExtra: false },
  { name: 'Hamburguesa Clásica', price: 14.50, status: true, isExtra: false },
  { name: 'Pollo a la Parrilla', price: 16.00, status: true, isExtra: false },
  { name: 'Salmón a la Plancha', price: 22.00, status: true, isExtra: false },
  { name: 'Tiramisú', price: 9.50, status: true, isExtra: false },
  { name: 'Brownie con Helado', price: 8.50, status: true, isExtra: false },
  { name: 'Flan Casero', price: 7.00, status: true, isExtra: false },
];

// 10 Extras (Menu Items con isExtra: true)
const seedExtras: SeedMenuItem[] = [
  { name: 'Queso Extra', price: 2.50, status: true, isExtra: true },
  { name: 'Tocino', price: 3.00, status: true, isExtra: true },
  { name: 'Aguacate', price: 2.00, status: true, isExtra: true },
  { name: 'Huevo Frito', price: 2.50, status: true, isExtra: true },
  { name: 'Cebolla Caramelizada', price: 1.50, status: true, isExtra: true },
  { name: 'Champiñones', price: 3.50, status: true, isExtra: true },
  { name: 'Salsa Extra', price: 1.00, status: true, isExtra: true },
  { name: 'Papas Fritas', price: 4.00, status: true, isExtra: true },
  { name: 'Aros de Cebolla', price: 5.50, status: true, isExtra: true },
  { name: 'Nachos', price: 4.50, status: true, isExtra: true },
];

// 10 Mesas
const seedTables: SeedTable[] = [
  { name: '1', status: true, availabilityStatus: true },
  { name: '2', status: true, availabilityStatus: true },
  { name: '3', status: true, availabilityStatus: true },
  { name: '4', status: true, availabilityStatus: true },
  { name: '5', status: true, availabilityStatus: true },
  { name: '6', status: true, availabilityStatus: true },
  { name: '7', status: true, availabilityStatus: true },
  { name: '8', status: true, availabilityStatus: true },
  { name: '9', status: true, availabilityStatus: true },
  { name: '10', status: true, availabilityStatus: true },
];

async function seedMenuData(): Promise<void> {
  console.log('🌱 Starting menu data seeding...\n');

  try {
    // 1. Obtener o crear un usuario admin para asociar los datos
    let adminUser = await prisma.user.findFirst({
      where: { rol: 'ADMIN' },
    });

    if (!adminUser) {
      console.log('⚠️  No admin user found. Creating one...');
      // Crear usuario admin temporal (sin password hasheado, solo para seed)
      adminUser = await prisma.user.create({
        data: {
          name: 'Admin',
          last_name: 'Seed',
          email: 'admin-seed@restify.com',
          password: 'temp_password_for_seed_only',
          rol: 'ADMIN',
          status: true,
        },
      });
      console.log(`✅ Created admin user: ${adminUser.email}\n`);
    } else {
      console.log(`✅ Using existing admin user: ${adminUser.email}\n`);
    }

    const userId = adminUser.id;

    // 2. Crear Categorías de Menú
    console.log('📁 Creating menu categories...');
    const createdCategories: { id: string; name: string }[] = [];

    for (const categoryData of seedCategories) {
      // Verificar si la categoría ya existe
      const existing = await prisma.menuCategory.findFirst({
        where: { name: categoryData.name },
      });

      if (existing) {
        console.log(`   ⏭️  Category "${categoryData.name}" already exists, skipping...`);
        createdCategories.push({ id: existing.id, name: existing.name });
      } else {
        const category = await prisma.menuCategory.create({
          data: {
            name: categoryData.name,
            status: categoryData.status,
          },
        });
        console.log(`   ✅ Created category: ${category.name}`);
        createdCategories.push({ id: category.id, name: category.name });
      }
    }

    console.log('');

    // 3. Crear Platillos (Menu Items)
    console.log('🍽️  Creating menu items (dishes)...');
    const categoryMap: Record<string, string> = {
      'Entradas': createdCategories[0].id,
      'Platos Principales': createdCategories[1].id,
      'Postres': createdCategories[2].id,
      'Bebidas': createdCategories[3].id,
      'Especialidades': createdCategories[4].id,
    };

    // Asignar categorías a los platillos
    const menuItemsWithCategories = [
      { ...seedMenuItems[0], categoryId: categoryMap['Entradas'] }, // Ensalada César
      { ...seedMenuItems[1], categoryId: categoryMap['Entradas'] }, // Sopa de Tomate
      { ...seedMenuItems[2], categoryId: categoryMap['Platos Principales'] }, // Pasta Carbonara
      { ...seedMenuItems[3], categoryId: categoryMap['Platos Principales'] }, // Pizza Margherita
      { ...seedMenuItems[4], categoryId: categoryMap['Platos Principales'] }, // Hamburguesa
      { ...seedMenuItems[5], categoryId: categoryMap['Platos Principales'] }, // Pollo
      { ...seedMenuItems[6], categoryId: categoryMap['Especialidades'] }, // Salmón
      { ...seedMenuItems[7], categoryId: categoryMap['Postres'] }, // Tiramisú
      { ...seedMenuItems[8], categoryId: categoryMap['Postres'] }, // Brownie
      { ...seedMenuItems[9], categoryId: categoryMap['Postres'] }, // Flan
    ];

    for (const itemData of menuItemsWithCategories) {
      const existing = await prisma.menuItem.findFirst({
        where: { name: itemData.name, isExtra: false },
      });

      if (existing) {
        console.log(`   ⏭️  Menu item "${itemData.name}" already exists, skipping...`);
      } else {
        const menuItem = await prisma.menuItem.create({
          data: {
            name: itemData.name,
            price: itemData.price,
            status: itemData.status,
            isExtra: false,
            categoryId: itemData.categoryId || null,
            userId,
          },
        });
        console.log(`   ✅ Created dish: ${menuItem.name} - $${menuItem.price}`);
      }
    }

    console.log('');

    // 4. Crear Extras
    console.log('➕ Creating extras...');
    for (const extraData of seedExtras) {
      // Verificar que el extra tenga isExtra: true
      if (!extraData.isExtra) {
        console.log(`   ⚠️  Warning: "${extraData.name}" is marked as isExtra=false, skipping...`);
        continue;
      }

      const existing = await prisma.menuItem.findFirst({
        where: { name: extraData.name, isExtra: true },
      });

      if (existing) {
        console.log(`   ⏭️  Extra "${extraData.name}" already exists, skipping...`);
      } else {
        const extra = await prisma.menuItem.create({
          data: {
            name: extraData.name,
            price: extraData.price,
            status: extraData.status,
            isExtra: extraData.isExtra, // Usar el valor del array explícitamente
            categoryId: null, // Los extras no tienen categoría
            userId,
          },
        });
        console.log(`   ✅ Created extra: ${extra.name} - $${extra.price} (isExtra: ${extra.isExtra})`);
      }
    }

    console.log('');

    // 5. Crear Mesas
    console.log('🪑 Creating tables...');
    for (const tableData of seedTables) {
      const existing = await prisma.table.findFirst({
        where: { name: tableData.name },
      });

      if (existing) {
        console.log(`   ⏭️  Table "${tableData.name}" already exists, skipping...`);
      } else {
        const table = await prisma.table.create({
          data: {
            name: tableData.name,
            status: tableData.status,
            availabilityStatus: tableData.availabilityStatus,
            userId,
          },
        });
        console.log(`   ✅ Created table: ${table.name}`);
      }
    }

    console.log('\n✨ Menu data seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Categories: ${createdCategories.length}`);
    console.log(`   Menu Items (Dishes): ${menuItemsWithCategories.length}`);
    console.log(`   Extras: ${seedExtras.length}`);
    console.log(`   Tables: ${seedTables.length}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  } catch (error) {
    console.error('❌ Error seeding menu data:', error);
    throw error;
  }
}

async function main(): Promise<void> {
  try {
    await seedMenuData();
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run seed if executed directly
if (require.main === module) {
  main();
}

export { seedMenuData };
