#!/usr/bin/env node

/**
 * Extrae datos crudos de usuarios y platillos (saources) desde railway_dump.sql
 * y escribe JSON en scripts/seed-data/.
 *
 * Uso: node scripts/parse-railway-dump.js
 */

const fs = require('fs');
const path = require('path');

const dumpPath = path.join(__dirname, '..', 'railway_dump.sql');
const outDir = path.join(__dirname, 'seed-data');

const sql = fs.readFileSync(dumpPath, 'utf8');

// Users: (id, name, last_name, second_last_name, email, rol, password, phone, status)
const usersMatch = sql.match(/INSERT INTO `users` VALUES (.+);/s);
const users = [];
if (usersMatch) {
  const content = usersMatch[1];
  const regex = /\((\d+),'([^']*)','([^']*)','([^']*)','([^']*)','([^']*)','([^']*)','([^']*)',(\d)\)/g;
  let m;
  while ((m = regex.exec(content)) !== null) {
    users.push({
      name: m[2],
      last_name: m[3],
      second_last_name: m[4],
      email: m[5],
      rol: m[6],
      password: m[7],
      phone: m[8],
      status: m[9] === '1',
    });
  }
}

// Categories_saources: (id, name, status, date)
const catMatch = sql.match(/INSERT INTO `categories_saources` VALUES (.+);/s);
const categories = [];
if (catMatch) {
  const content = catMatch[1];
  const regex = /\((\d+),'([^']*)',(\d),'\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}'\)/g;
  let m;
  while ((m = regex.exec(content)) !== null) {
    categories.push({
      old_id: parseInt(m[1], 10),
      name: m[2],
      status: m[3] === '1',
    });
  }
}

// Saources: (id, name, date, price, status, category_id, is_extra)
const saourcesMatch = sql.match(/INSERT INTO `saources` VALUES (.+);/s);
const menuItems = [];
if (saourcesMatch) {
  const content = saourcesMatch[1];
  const regex = /\((\d+),'([^']*)','\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}',([\d.]+),(\d),(\d+),(\d)\)/g;
  let m;
  while ((m = regex.exec(content)) !== null) {
    menuItems.push({
      name: m[2],
      price: parseFloat(m[3]),
      status: m[4] === '1',
      category_id: parseInt(m[5], 10),
      is_extra: m[6] === '1',
    });
  }
}

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'railway-raw-users.json'), JSON.stringify(users, null, 2));
fs.writeFileSync(path.join(outDir, 'railway-raw-categories.json'), JSON.stringify(categories, null, 2));
fs.writeFileSync(path.join(outDir, 'railway-raw-menu-items.json'), JSON.stringify(menuItems, null, 2));
console.log('OK: Users', users.length, '| Categories', categories.length, '| Menu items', menuItems.length);
