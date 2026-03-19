#!/usr/bin/env ts-node

/**
 * Script to generate Postman collection from route files
 * Generates a JSON collection file grouped by modules
 */

import * as fs from 'fs';
import * as path from 'path';

interface RouteInfo {
  method: string;
  path: string;
  description: string;
  module: string;
  requiresAuth?: boolean;
  exampleBody?: any;
}

// Module mapping from route file names to display names
const moduleMap: Record<string, string> = {
  'auth': 'Auth',
  'user': 'Users',
  'product': 'Products',
  'table': 'Tables',
  'menu-category': 'Menu Categories',
  'menu-item': 'Menu Items',
  'order': 'Orders',
  'payment': 'Payments',
  'refund': 'Refunds',
  'expense': 'Expenses',
  'employee-salary': 'Employee Salaries',
  'report': 'Reports',
  'health': 'Health',
};

// Example request bodies based on DTOs
const exampleBodies: Record<string, any> = {
  'POST /api/auth/login/:rol': {
    email: 'admin@restify.com',
    password: 'Restify123!',
  },
  'POST /api/auth/verify-user': {
    email: 'user@example.com',
  },
  'POST /api/auth/set-password/:user_id': {
    password: 'NewPassword123!',
  },
  'POST /api/users': {
    name: 'John',
    last_name: 'Doe',
    second_last_name: 'Smith',
    email: 'john.doe@example.com',
    password: 'Password123!',
    phone: '+1234567890',
    status: true,
    rol: 'WAITER',
  },
  'PUT /api/users/:user_id': {
    name: 'John',
    last_name: 'Doe Updated',
    phone: '+1234567890',
    status: true,
  },
  'POST /api/products': {
    name: 'Product Name',
    description: 'Product description',
    status: true,
  },
  'PUT /api/products/:product_id': {
    name: 'Updated Product Name',
    description: 'Updated description',
    status: true,
  },
  'POST /api/tables': {
    name: '1',
    status: true,
    availabilityStatus: true,
  },
  'PUT /api/tables/:table_id': {
    name: '1',
    status: true,
    availabilityStatus: false,
  },
  'POST /api/menu-categories': {
    name: 'Main Course',
    status: true,
  },
  'PUT /api/menu-categories/:category_id': {
    name: 'Updated Category',
    status: true,
  },
  'POST /api/menu-items': {
    name: 'Pasta Carbonara',
    price: 15.99,
    status: true,
    categoryId: 'category-uuid-here',
  },
  'PUT /api/menu-items/:menu_item_id': {
    name: 'Updated Menu Item',
    price: 18.99,
    status: true,
  },
  'POST /api/orders': {
    status: false,
    paymentMethod: 1,
    total: 50.00,
    subtotal: 45.00,
    iva: 5.00,
    delivered: false,
    tableId: 'table-uuid-here',
    tip: 5.00,
    origin: 'Local',
    client: 'John Doe',
    paymentDiffer: false,
    note: 'No onions',
    orderItems: [
      {
        productId: 'product-uuid-here',
        quantity: 2,
        price: 25.00,
      },
    ],
    orderMenuItems: [
      {
        menuItemId: 'menu-item-uuid-here',
        amount: 1,
        unitPrice: 15.99,
        note: 'Extra cheese',
      },
    ],
  },
  'PUT /api/orders/:order_id': {
    status: true,
    delivered: true,
  },
  'POST /api/payments': {
    orderId: 'order-uuid-here',
    amount: 50.00,
    currency: 'USD',
    paymentMethod: 'CASH',
    gateway: null,
  },
  'POST /api/refunds': {
    paymentId: 'payment-uuid-here',
    amount: 25.00,
    reason: 'Customer request',
  },
  'POST /api/expenses': {
    title: 'Compra de insumos',
    type: 'MERCHANDISE',
    date: new Date().toISOString(),
    total: 100.00,
    subtotal: 90.00,
    iva: 10.00,
    description: 'Purchase of ingredients',
    paymentMethod: 1,
    userId: 'user-uuid-here',
    items: [
      {
        productId: 'product-uuid-here',
        amount: 10.00,
        subtotal: 9.00,
        total: 10.00,
        unitOfMeasure: 'KG',
      },
    ],
  },
  'POST /api/employee-salaries': {
    userId: 'user-uuid-here',
    amount: 1000.00,
    paymentMethod: 1,
    date: new Date().toISOString(),
  },
};

// Routes that require authentication
const authRequiredRoutes = [
  '/api/users',
  '/api/products',
  '/api/tables',
  '/api/menu-categories',
  '/api/menu-items',
  '/api/orders',
  '/api/payments',
  '/api/refunds',
  '/api/expenses',
  '/api/employee-salaries',
  '/api/reports',
];

function parseRouteFile(filePath: string, moduleName: string): RouteInfo[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const routes: RouteInfo[] = [];
  
  const lines = content.split('\n');
  let currentDescription = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check for JSDoc comment
    if (line.includes('/**')) {
      currentDescription = '';
      let j = i + 1;
      while (j < lines.length && !lines[j].includes('*/')) {
        const descLine = lines[j].replace(/^\s*\*\s*/, '').trim();
        if (descLine && !descLine.startsWith('@') && !descLine.startsWith('*')) {
          currentDescription += descLine + ' ';
        }
        j++;
      }
      currentDescription = currentDescription.trim();
      i = j;
      continue;
    }
    
    // Check for route definition
    const routeMatch = line.match(/router\.(get|post|put|delete|patch)\s*\(['"`]([^'"`]+)['"`]/);
    if (routeMatch) {
      const method = routeMatch[1].toUpperCase();
      let routePath = routeMatch[2];
      
      routePath = routePath.replace(/\/$/, '');
      
      // Determine base path from module
      let basePath = '';
      if (moduleName === 'auth') {
        basePath = '/api/auth';
      } else if (moduleName === 'health') {
        basePath = '/health';
      } else {
        basePath = `/api/${moduleName.replace(/-/g, '-')}`;
      }
      
      const fullPath = basePath + (routePath.startsWith('/') ? routePath : '/' + routePath);
      
      routes.push({
        method,
        path: fullPath,
        description: currentDescription || `${method} ${fullPath}`,
        module: moduleMap[moduleName] || moduleName,
        requiresAuth: authRequiredRoutes.some(route => fullPath.startsWith(route)),
        exampleBody: exampleBodies[`${method} ${fullPath}`],
      });
      
      currentDescription = '';
    }
  }
  
  return routes;
}

function generatePostmanCollection(routes: RouteInfo[]): any {
  // Group routes by module
  const routesByModule: Record<string, RouteInfo[]> = {};
  
  routes.forEach(route => {
    if (!routesByModule[route.module]) {
      routesByModule[route.module] = [];
    }
    routesByModule[route.module].push(route);
  });
  
  // Generate collection structure
  const collection: any = {
    info: {
      name: 'Restify API',
      description: 'Restify API - Collection generated from route files',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      _exporter_id: 'restify-api-generator',
    },
    variable: [
      {
        key: 'baseUrl',
        value: 'http://localhost:3000',
        type: 'string',
      },
      {
        key: 'token',
        value: '',
        type: 'string',
      },
    ],
    item: [],
  };
  
  // Create folders for each module
  Object.keys(routesByModule).sort().forEach(moduleName => {
    const moduleRoutes = routesByModule[moduleName];
    
    const folder: any = {
      name: moduleName,
      item: [],
    };
    
    moduleRoutes.forEach(route => {
      const pathSegments = route.path.split('/').filter((p: string) => p);
      const urlPath: any[] = [];
      const pathVars: any[] = [];
      
      pathSegments.forEach((segment: string) => {
        if (segment.startsWith(':')) {
          const varName = segment.substring(1);
          urlPath.push(`:${varName}`);
          pathVars.push({
            key: varName,
            value: `{{${varName}}}`,
            description: `${varName} parameter`,
          });
        } else {
          urlPath.push(segment);
        }
      });
      
      const request: any = {
        name: `${route.method} ${route.path}`,
        request: {
          method: route.method,
          header: [
            {
              key: 'Content-Type',
              value: 'application/json',
            },
          ],
          url: {
            raw: '{{baseUrl}}' + route.path,
            host: ['{{baseUrl}}'],
            path: urlPath,
          },
          description: route.description,
        },
        response: [],
      };
      
      // Add path variables if any
      if (pathVars.length > 0) {
        request.request.url.variable = pathVars;
      }
      
      // Add auth header if required
      if (route.requiresAuth) {
        request.request.header.push({
          key: 'Authorization',
          value: 'Bearer {{token}}',
        });
      }
      
      // Add body if it's a POST, PUT, or PATCH request
      if (['POST', 'PUT', 'PATCH'].includes(route.method) && route.exampleBody) {
        request.request.body = {
          mode: 'raw',
          raw: JSON.stringify(route.exampleBody, null, 2),
          options: {
            raw: {
              language: 'json',
            },
          },
        };
      }
      
      folder.item.push(request);
    });
    
    collection.item.push(folder);
  });
  
  return collection;
}

function main() {
  const routesDir = path.join(__dirname, '../src/server/routes');
  const outputPath = path.join(__dirname, '../postman-collection.json');
  
  console.log('🚀 Generating Postman collection...\n');
  
  const allRoutes: RouteInfo[] = [];
  
  // Read all route files
  const routeFiles = fs.readdirSync(routesDir).filter(file => 
    file.endsWith('.routes.ts') && file !== 'index.ts'
  );
  
  routeFiles.forEach(file => {
    const filePath = path.join(routesDir, file);
    const moduleName = file.replace('.routes.ts', '');
    
    console.log(`📄 Processing ${file}...`);
    
    try {
      const routes = parseRouteFile(filePath, moduleName);
      allRoutes.push(...routes);
      console.log(`   ✅ Found ${routes.length} route(s)`);
    } catch (error) {
      console.error(`   ❌ Error processing ${file}:`, error);
    }
  });
  
  console.log(`\n📊 Total routes found: ${allRoutes.length}\n`);
  
  // Generate collection
  const collection = generatePostmanCollection(allRoutes);
  
  // Write to file
  fs.writeFileSync(outputPath, JSON.stringify(collection, null, 2));
  
  console.log(`✨ Collection generated successfully!`);
  console.log(`📁 Output: ${outputPath}`);
  console.log(`\n📦 Collection includes:`);
  console.log(`   - ${Object.keys(collection.item).length} module(s)`);
  console.log(`   - ${allRoutes.length} request(s)`);
  console.log(`\n💡 Import this file into Postman to use the collection.`);
}

if (require.main === module) {
  main();
}

