import { randomUUID } from 'crypto';
import {
  PrismaClient,
  UserRole,
  UserAccountStatus,
  PaymentStatus,
  PaymentMethod,
  PaymentGateway,
  ExpenseType,
} from '@prisma/client';

/**
 * Migra los datos del Deliyunos viejo (mono-tenant) al esquema nuevo (multi-tenant).
 *
 * Fuente  (OLD_DATABASE_URL): dump viejo cargado en una base aparte.
 * Destino (DATABASE_URL):     base con el esquema nuevo ya aplicado.
 *
 * Preserva la relación semántica, no los IDs: por cada tabla guarda un mapa
 * idViejo -> idNuevo y resuelve las llaves foráneas con ese mapa.
 *
 * DRY_RUN=1 (o --dry-run): solo lee la base vieja, arma los mapas, valida la
 * integridad de las relaciones y reporta qué insertaría. No escribe nada.
 *
 * MARK_VERIFIED=1 (o --verified): marca todos los usuarios con email verificado y
 * cuenta activa, para que puedan entrar sin esperar el correo de verificación
 * (útil en migraciones de prueba). Sin el flag: emailVerifiedAt queda null y la
 * cuenta respeta el estado original.
 */

const OWNER_EMAIL = 'karinaorlaz@hotmail.com';
const DRY = process.env.DRY_RUN === '1' || process.argv.includes('--dry-run');
const VERIFIED = process.env.MARK_VERIFIED === '1' || process.argv.includes('--verified');
// Reemplaza una migración previa: borra la org Deliyunos existente (cascade) antes de migrar.
const RESET = process.env.RESET === '1' || process.argv.includes('--reset');

// Cuentas demo/seed/test: no se migran como usuarios. Su catálogo (si tiene) se
// reasigna al OWNER; el resto no posee nada, así que se descartan sin efecto.
const DEMO_EMAILS = new Set(
  [
    'admin@restify.com',
    'chef@restify.com',
    'manager@restify.com',
    'waiter@restify.com',
    'karibartolo97@gmail.com',
    'e2e-1773424194129@test.com',
    'e2e-1773424236580@test.com',
    'e2e-1773424291346@test.com',
    'mesero@gmail.com',
    'test@gmail.com',
  ].map((e) => e.toLowerCase())
);

const OLD_URL = process.env.OLD_DATABASE_URL;
if (!OLD_URL) throw new Error('Falta OLD_DATABASE_URL (base con el dump viejo).');

const oldDb = new PrismaClient({ datasources: { db: { url: OLD_URL } } });
const db = new PrismaClient(); // destino = DATABASE_URL (no se conecta en dry-run)

const bool = (v: unknown) => v === true || v === 1 || v === '1';
const json = (v: unknown) =>
  v == null ? undefined : typeof v === 'string' ? JSON.parse(v) : v;

const warnings: string[] = [];
const warn = (m: string) => warnings.push(m);

async function chunked<T>(rows: T[], size: number, fn: (batch: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += size) await fn(rows.slice(i, i + size));
}

// Resuelve un FK opcional: null si viene null o si no está mapeado (se degrada a null).
function optional(map: Map<string, string>, oldId: string | null): string | null {
  return oldId ? map.get(oldId) ?? null : null;
}

async function main() {
  if (!DRY) {
    const existing = await db.organization.findFirst({ where: { name: 'Deliyunos' } });
    if (existing) {
      if (!RESET) throw new Error('Ya existe "Deliyunos" en el destino. Usá --reset para reemplazarla.');
      await db.organization.delete({ where: { id: existing.id } }); // cascade borra sucursal + datos + usuarios
      console.log('Reset: organización Deliyunos previa eliminada (cascade).');
    }
  }

  const userMap = new Map<string, string>();
  const demoIds = new Set<string>(); // ids viejos de usuarios demo/test excluidos
  const productMap = new Map<string, string>();
  const categoryMap = new Map<string, string>();
  const menuItemMap = new Map<string, string>();
  const tableMap = new Map<string, string>();
  const orderMap = new Map<string, string>();
  const orderItemMap = new Map<string, string>();
  const paymentMap = new Map<string, string>();

  // ── 0. Organización + Sucursal + Suscripción ────────────────────────────
  const orgId = randomUUID();
  const branchId = randomUUID();
  const [company] = (await oldDb.$queryRawUnsafe<any[]>('SELECT * FROM companies LIMIT 1')) ?? [];

  if (!DRY) {
    await db.organization.create({
      data: { id: orgId, name: 'Deliyunos', slug: 'deliyunos', plan: 'FREE', status: 'ACTIVE' },
    });
    await db.branch.create({
      data: {
        id: branchId,
        organizationId: orgId,
        name: 'Deliyunos Condesa',
        slug: 'deliyunos-condesa',
        state: 'Zacatecas',
        city: 'Guadalupe',
        street: company?.street ?? 'N/D',
        exteriorNumber: company?.exteriorNumber ?? 'N/D',
        phone: company?.phone ?? 'N/D',
        rfc: company?.rfc ?? null,
        logoUrl: company?.logoUrl ?? null,
        startOperations: company?.startOperations ?? null,
        endOperations: company?.endOperations ?? null,
        ticketConfig: json(company?.ticketConfig),
        paymentConfig: company?.paymentConfig ?? null,
        timezone: 'America/Mexico_City',
        currency: 'MXN',
        status: 'ACTIVE',
      },
    });
    const plan = await db.subscriptionPlan.upsert({
      where: { name: 'Free Legacy' },
      update: {},
      create: { name: 'Free Legacy', price: 0, maxBranches: 3, status: true },
    });
    await db.subscription.create({
      data: { organizationId: orgId, planId: plan.id, status: 'ACTIVE' },
    });
  }

  // ── 1. Usuarios (+ acceso a la sucursal) ────────────────────────────────
  const users = await oldDb.$queryRawUnsafe<any[]>('SELECT * FROM users');
  const emailsVistos = new Set<string>();
  let karinaOldId: string | null = null;
  for (const u of users) {
    const email = String(u.email).toLowerCase();
    if (DEMO_EMAILS.has(email)) {
      demoIds.add(u.id); // no se migra; su catálogo se reasigna al OWNER
      continue;
    }
    const id = randomUUID();
    userMap.set(u.id, id);
    if (email === OWNER_EMAIL) karinaOldId = u.id;
    if (emailsVistos.has(email)) warn(`Email duplicado en users: ${email}`);
    emailsVistos.add(email);
    if (DRY) continue;
    await db.user.create({
      data: {
        id,
        name: u.name,
        last_name: u.last_name,
        second_last_name: u.second_last_name ?? null,
        email: u.email,
        password: u.password, // hash bcrypt tal cual
        phone: u.phone ?? null,
        status: VERIFIED ? true : bool(u.status),
        rol: (email === OWNER_EMAIL ? 'OWNER' : u.rol) as UserRole,
        organizationId: orgId,
        accountStatus: (VERIFIED || bool(u.status) ? 'ACTIVE' : 'DISABLED') as UserAccountStatus,
        tokenVersion: 0,
        mustChangePassword: false,
        emailVerifiedAt: VERIFIED ? new Date() : null,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      },
    });
    await db.userBranchAccess.create({ data: { userId: id, branchId } });
  }
  const karinaNewId = karinaOldId ? userMap.get(karinaOldId) ?? null : null;
  if (!karinaNewId) warn(`No se encontró el OWNER (${OWNER_EMAIL}); no puedo reasignar el catálogo demo.`);

  // userId requerido: si pertenece a un usuario demo excluido, se reasigna al OWNER.
  const ownerRequired = (oldUserId: string, ctx: string): string => {
    if (demoIds.has(oldUserId)) return karinaNewId as string;
    const v = userMap.get(oldUserId);
    if (!v) {
      warn(`FK huérfana requerida en ${ctx}: user "${oldUserId}"`);
      return karinaNewId as string;
    }
    return v;
  };
  // userId opcional: null si viene null; si es demo se reasigna al OWNER.
  const ownerOptional = (oldUserId: string | null): string | null => {
    if (!oldUserId) return null;
    if (demoIds.has(oldUserId)) return karinaNewId;
    return userMap.get(oldUserId) ?? null;
  };

  // ── 1b. Categorías de menú ──────────────────────────────────────────────
  const categories = await oldDb.$queryRawUnsafe<any[]>('SELECT * FROM menu_categories');
  for (const c of categories) {
    const id = randomUUID();
    categoryMap.set(c.id, id);
    if (DRY) continue;
    await db.menuCategory.create({
      data: { id, name: c.name, status: bool(c.status), branchId, createdAt: c.createdAt, updatedAt: c.updatedAt },
    });
  }

  // ── 2. Productos ────────────────────────────────────────────────────────
  const products = await oldDb.$queryRawUnsafe<any[]>('SELECT * FROM products');
  for (const p of products) {
    const id = randomUUID();
    productMap.set(p.id, id);
    const userId = ownerRequired(p.userId, `product ${p.id}`);
    if (DRY) continue;
    await db.product.create({
      data: {
        id,
        name: p.name,
        description: p.description ?? null,
        registrationDate: p.registrationDate,
        status: bool(p.status),
        userId,
        branchId,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      },
    });
  }

  // ── 2. Mesas (unique [branchId, name]) ──────────────────────────────────
  const tables = await oldDb.$queryRawUnsafe<any[]>('SELECT * FROM tables');
  const nombresMesa = new Set<string>();
  for (const t of tables) {
    const id = randomUUID();
    tableMap.set(t.id, id);
    if (nombresMesa.has(t.name)) warn(`Nombre de mesa duplicado (viola unique por sucursal): ${t.name}`);
    nombresMesa.add(t.name);
    const userId = ownerRequired(t.userId, `table ${t.id}`);
    if (DRY) continue;
    await db.table.create({
      data: {
        id,
        name: t.name,
        userId,
        branchId,
        status: bool(t.status),
        availabilityStatus: bool(t.availabilityStatus),
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      },
    });
  }

  // ── 2. Platillos ────────────────────────────────────────────────────────
  const menuItems = await oldDb.$queryRawUnsafe<any[]>('SELECT * FROM menu_items');
  for (const m of menuItems) {
    const id = randomUUID();
    menuItemMap.set(m.id, id);
    const userId = ownerRequired(m.userId, `menu_item ${m.id}`);
    if (DRY) continue;
    await db.menuItem.create({
      data: {
        id,
        name: m.name,
        price: m.price,
        status: bool(m.status),
        isExtra: bool(m.isExtra),
        categoryId: optional(categoryMap, m.categoryId),
        userId,
        branchId,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
      },
    });
  }

  // ── 3. Órdenes ──────────────────────────────────────────────────────────
  const orders = await oldDb.$queryRawUnsafe<any[]>('SELECT * FROM orders');
  const orderRows = orders.map((o) => {
    const id = randomUUID();
    orderMap.set(o.id, id);
    return {
      id,
      date: o.date,
      status: bool(o.status),
      paymentMethod: o.paymentMethod ?? null,
      total: o.total,
      subtotal: o.subtotal,
      iva: o.iva,
      delivered: bool(o.delivered),
      tableId: optional(tableMap, o.tableId),
      tip: o.tip,
      origin: o.origin,
      client: o.client ?? null,
      paymentDiffer: bool(o.paymentDiffer),
      note: o.note ?? null,
      userId: ownerOptional(o.userId),
      customerName: o.customerName ?? null,
      customerPhone: o.customerPhone ?? null,
      latitude: o.latitude ?? null,
      longitude: o.longitude ?? null,
      deliveryAddress: o.deliveryAddress ?? null,
      scheduledAt: o.scheduledAt ?? null,
      trackingToken: o.trackingToken ?? null,
      deliveryStatus: o.deliveryStatus ?? null,
      branchId,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
    };
  });
  if (!DRY) await chunked(orderRows, 1000, (b) => db.order.createMany({ data: b }));

  // ── 4. Renglones de orden ───────────────────────────────────────────────
  const orderItems = await oldDb.$queryRawUnsafe<any[]>('SELECT * FROM order_items');
  let renglonesSinOrden = 0;
  const orderItemRows = orderItems.map((it) => {
    const id = randomUUID();
    orderItemMap.set(it.id, id);
    const orderId = orderMap.get(it.orderId);
    if (!orderId) renglonesSinOrden++;
    return {
      id,
      quantity: it.quantity,
      price: it.price,
      orderId: orderId!,
      productId: optional(productMap, it.productId),
      menuItemId: optional(menuItemMap, it.menuItemId),
      note: it.note ?? null,
      branchId,
      createdAt: it.createdAt,
      updatedAt: it.updatedAt,
    };
  });
  if (renglonesSinOrden) warn(`${renglonesSinOrden} renglones sin orden mapeada (se omitirían).`);
  if (!DRY)
    await chunked(orderItemRows.filter((r) => r.orderId), 1000, (b) => db.orderItem.createMany({ data: b }));

  // ── 5. Extras de renglón ────────────────────────────────────────────────
  const extras = await oldDb.$queryRawUnsafe<any[]>('SELECT * FROM order_item_extras');
  const extraRows = extras.map((e) => ({
    id: randomUUID(),
    orderId: orderMap.get(e.orderId),
    orderItemId: orderItemMap.get(e.orderItemId),
    extraId: menuItemMap.get(e.extraId),
    quantity: e.quantity,
    price: e.price,
    branchId,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  }));
  const extrasValidos = extraRows.filter((e) => e.orderId && e.orderItemId && e.extraId);
  if (extrasValidos.length !== extraRows.length)
    warn(`${extraRows.length - extrasValidos.length} extras con referencia faltante (se omitirían).`);
  if (!DRY) await chunked(extrasValidos as any[], 1000, (b) => db.orderItemExtra.createMany({ data: b }));

  // ── 4. Pagos ──────────────────────────────────────────────────────────────
  const payments = await oldDb.$queryRawUnsafe<any[]>('SELECT * FROM payments');
  const seenGatewayTx = new Set<string>();
  let gatewayTxAnulados = 0;
  const paymentRows = payments.map((p) => {
    const id = randomUUID();
    paymentMap.set(p.id, id);
    let gatewayTx: string | null = p.gatewayTransactionId ?? null;
    if (gatewayTx) {
      if (seenGatewayTx.has(gatewayTx)) {
        gatewayTx = null;
        gatewayTxAnulados++;
      } else seenGatewayTx.add(gatewayTx);
    }
    return {
      id,
      orderId: optional(orderMap, p.orderId),
      userId: ownerOptional(p.userId),
      amount: p.amount,
      currency: p.currency,
      status: p.status as PaymentStatus,
      paymentMethod: p.paymentMethod as PaymentMethod,
      gateway: (p.gateway ?? null) as PaymentGateway | null,
      gatewayTransactionId: gatewayTx,
      metadata: json(p.metadata),
      branchId,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  });
  if (gatewayTxAnulados) warn(`${gatewayTxAnulados} gatewayTransactionId duplicados → anulados.`);
  if (!DRY) await chunked(paymentRows, 1000, (b) => db.payment.createMany({ data: b }));

  // ── 4. Pagos divididos ──────────────────────────────────────────────────
  const diffs = await oldDb.$queryRawUnsafe<any[]>('SELECT * FROM payments_differentiations');
  const diffRows = diffs
    .map((d) => ({
      id: randomUUID(),
      orderId: orderMap.get(d.orderId),
      firstPaymentAmount: d.firstPaymentAmount,
      firstPaymentMethod: d.firstPaymentMethod as PaymentMethod,
      secondPaymentAmount: d.secondPaymentAmount,
      secondPaymentMethod: d.secondPaymentMethod as PaymentMethod,
      branchId,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    }))
    .filter((d) => d.orderId);
  if (!DRY) await chunked(diffRows as any[], 1000, (b) => db.paymentDifferentiation.createMany({ data: b }));

  // ── 5. Gastos ─────────────────────────────────────────────────────────────
  const expenses = await oldDb.$queryRawUnsafe<any[]>('SELECT * FROM expenses');
  for (const e of expenses) {
    if (DRY) continue;
    await db.expense.create({
      data: {
        title: e.title,
        type: e.type as ExpenseType,
        date: e.date,
        total: e.total,
        subtotal: e.subtotal,
        iva: e.iva,
        description: e.description ?? null,
        paymentMethod: e.paymentMethod,
        userId: ownerOptional(e.userId),
        paymentId: optional(paymentMap, e.paymentId),
        branchId,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
      },
    });
  }

  const modo = DRY ? 'DRY-RUN (no se escribió nada)' : 'ESCRITO en destino';
  console.log(`\n=== Migración Deliyunos — ${modo} ===`);
  console.log(`Emails/cuentas verificados: ${VERIFIED ? 'SÍ (forzado por flag)' : 'no (estado original)'}`);
  console.table({
    usuarios_reales: userMap.size,
    usuarios_demo_excluidos: demoIds.size,
    categorias: categories.length,
    productos: products.length,
    platillos: menuItems.length,
    mesas: tables.length,
    ordenes: orders.length,
    renglones: orderItems.length,
    extras_validos: extrasValidos.length,
    pagos: payments.length,
    pagos_divididos: diffRows.length,
    gastos: expenses.length,
  });
  if (warnings.length) {
    console.log(`\n⚠️  ${warnings.length} avisos:`);
    warnings.forEach((w) => console.log('  - ' + w));
  } else {
    console.log('\n✅ Sin avisos: relaciones íntegras.');
  }
}

main()
  .then(async () => {
    await oldDb.$disconnect();
    await db.$disconnect().catch(() => {});
    process.exit(0);
  })
  .catch(async (e) => {
    console.error(e);
    await oldDb.$disconnect();
    await db.$disconnect().catch(() => {});
    process.exit(1);
  });
