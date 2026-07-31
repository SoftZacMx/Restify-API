import { randomUUID } from 'crypto';
import { inject, injectable } from 'tsyringe';
import { IUserRepository } from '../../../domain/interfaces/user-repository.interface';
import { ITableRepository } from '../../../domain/interfaces/table-repository.interface';
import { IBranchRepository } from '../../../domain/interfaces/branch-repository.interface';
import { getPrisma } from '../../../infrastructure/database/prisma/get-prisma';
import { PrismaService } from '../../../infrastructure/config/prisma.config';
import { StockService, StockBatchSaleItem } from '../../services/stock.service';
import { CreateOrderInput } from '../../dto/order.dto';
import { AppError } from '../../../../shared/errors';
import { formatInTimeZone } from 'date-fns-tz';
import { isWithinOperatingHours } from '../../../../shared/utils/operating-hours.util';
import { getBranchId } from '../../../infrastructure/tenant/tenant-context';

export interface CreateOrderResult {
  id: string;
  date: Date;
  status: boolean;
  paymentMethod: number | null;
  total: number;
  subtotal: number;
  iva: number;
  delivered: boolean;
  tableId: string | null;
  tip: number;
  origin: string;
  client: string | null;
  paymentDiffer: boolean;
  note: string | null;
  userId: string | null;
  createdAt: Date;
  updatedAt: Date;
  orderItems?: Array<{
    id: string;
    quantity: number;
    price: number;
    productId: string | null;
    menuItemId: string | null;
    note: string | null;
    createdAt: Date;
    updatedAt: Date;
    extras?: Array<{
      id: string;
      extraId: string;
      quantity: number;
      price: number;
      createdAt: Date;
      updatedAt: Date;
    }>;
  }>;
}

@injectable()
export class CreateOrderUseCase {
  constructor(
    @inject('IUserRepository') private readonly userRepository: IUserRepository,
    @inject('ITableRepository') private readonly tableRepository: ITableRepository,
    @inject('IBranchRepository') private readonly branchRepository: IBranchRepository,
    @inject(PrismaService) private readonly prismaService: PrismaService,
    @inject(StockService) private readonly stockService: StockService,
  ) {}

  async execute(input: CreateOrderInput): Promise<CreateOrderResult> {
    // --- Validaciones (fuera de transacción, solo lecturas) ---

    // branchId del contexto tenant: se asigna explícitamente en cada escritura
    // (la tenant extension no se propaga de forma fiable dentro de $transaction).
    const branchId = getBranchId();

    // Validar horario de operación
    if (branchId) {
      const branch = await this.branchRepository.findById(branchId);
      if (branch?.startOperations && branch?.endOperations) {
        const nowHhmm = formatInTimeZone(new Date(), branch.timezone, 'HH:mm');
        if (!isWithinOperatingHours(nowHhmm, branch.startOperations, branch.endOperations)) {
          throw new AppError(
            'OUTSIDE_OPERATING_HOURS',
            `Horario de operación: ${branch.startOperations} - ${branch.endOperations}. No se pueden crear órdenes fuera de este horario.`
          );
        }
      }
    }

    if (input.userId) {
      const user = await this.userRepository.findById(input.userId);
      if (!user) {
        throw new AppError('USER_NOT_FOUND');
      }
    }

    if (input.tableId) {
      const table = await this.tableRepository.findById(input.tableId);
      if (!table) {
        throw new AppError('TABLE_NOT_FOUND');
      }
      if (input.origin.toLowerCase() === 'local' && !table.availabilityStatus) {
        throw new AppError('TABLE_NOT_AVAILABLE');
      }
    }

    // Bulk-load: una sola query por tabla en vez de N findById dentro de la tx.
    // Trae TODO lo necesario para validar items, calcular subtotal y descontar stock.
    // Cliente extendido para reads: los modelos branch-level se filtran por branchId.
    const prisma = getPrisma();

    const menuItemIdsToLoad = new Set<string>();
    const directProductIds = new Set<string>();
    for (const item of input.orderItems ?? []) {
      if (item.menuItemId) menuItemIdsToLoad.add(item.menuItemId);
      if (item.productId) directProductIds.add(item.productId);
      for (const extra of item.extras ?? []) {
        menuItemIdsToLoad.add(extra.extraId);
      }
    }

    const menuItems = menuItemIdsToLoad.size > 0
      ? await prisma.menuItem.findMany({
          where: { id: { in: [...menuItemIdsToLoad] } },
          include: { ingredients: true },
        })
      : [];
    const menuItemMap = new Map(menuItems.map((m) => [m.id, m]));

    // IDs de TODOS los productos que pueden tocar stock: directos en items, productId
    // de cada menuItem (1:1) y productId de cada ingrediente de receta.
    const stockProductIds = new Set<string>(directProductIds);
    for (const mi of menuItems) {
      if (mi.productId) stockProductIds.add(mi.productId);
      for (const ing of mi.ingredients) stockProductIds.add(ing.productId);
    }

    const products = stockProductIds.size > 0
      ? await prisma.product.findMany({ where: { id: { in: [...stockProductIds] } } })
      : [];
    const productMap = new Map(products.map((p) => [p.id, p]));

    // Validar items y calcular subtotal usando los maps cargados.
    let subtotal = 0;
    if (input.orderItems && input.orderItems.length > 0) {
      for (const item of input.orderItems) {
        if (item.productId) {
          if (!productMap.has(item.productId)) {
            throw new AppError('PRODUCT_NOT_FOUND', `Product with ID ${item.productId} not found`);
          }
        } else if (item.menuItemId) {
          const mi = menuItemMap.get(item.menuItemId);
          if (!mi) {
            throw new AppError('MENU_ITEM_NOT_FOUND', `Menu item with ID ${item.menuItemId} not found`);
          }
          if (mi.isExtra) {
            throw new AppError('INVALID_MENU_ITEM', `Menu item with ID ${item.menuItemId} is an extra and should be in the extras array`);
          }
        }

        subtotal += item.price * item.quantity;

        if (item.extras && item.extras.length > 0) {
          for (const extra of item.extras) {
            const extraMenuItem = menuItemMap.get(extra.extraId);
            if (!extraMenuItem) {
              throw new AppError('MENU_ITEM_NOT_FOUND', `Extra with ID ${extra.extraId} not found`);
            }
            if (!extraMenuItem.isExtra) {
              throw new AppError('INVALID_EXTRA', `Menu item with ID ${extra.extraId} is not an extra`);
            }
            subtotal += extra.price * extra.quantity;
          }
        }
      }
    }

    const iva = 0;
    const total = subtotal + (input.tip || 0);

    // Pre-generar IDs para usar createMany (MySQL no devuelve los autogenerados en batch).
    const prepared = (input.orderItems ?? []).map((item) => ({
      id: randomUUID(),
      input: item,
      extras: (item.extras ?? []).map((extra) => ({
        id: randomUUID(),
        input: extra,
      })),
    }));

    // --- Escrituras (dentro de transacción) ---
    // Cliente base para la tx: el tipo de `tx` debe ser Prisma.TransactionClient
    // (requerido por stockService); el aislamiento se garantiza con branchId explícito.
    const result = await this.prismaService.getClient().$transaction(async (tx) => {
      // Crear orden (branchId explícito desde el contexto tenant)
      const order = await tx.order.create({
        data: {
          status: false,
          paymentMethod: input.paymentMethod ?? 1,
          total,
          subtotal,
          iva,
          delivered: false,
          tableId: input.tableId || null,
          tip: input.tip || 0,
          origin: input.origin,
          client: input.client || null,
          paymentDiffer: input.paymentDiffer ?? false,
          note: input.note || null,
          userId: input.userId ?? null,
          branchId: branchId ?? null,
        },
      });

      // Marcar mesa como no disponible (con lock para evitar doble reserva)
      if (order.tableId && input.origin.toLowerCase() === 'local') {
        await tx.$queryRaw`SELECT id FROM tables WHERE id = ${order.tableId} FOR UPDATE`;
        await tx.table.update({
          where: { id: order.tableId },
          data: { availabilityStatus: false },
        });
      }

      if (prepared.length > 0) {
        // Insertar todos los order items en una sola query.
        await tx.orderItem.createMany({
          data: prepared.map((p) => ({
            id: p.id,
            quantity: p.input.quantity,
            price: p.input.price,
            orderId: order.id,
            productId: p.input.productId || null,
            menuItemId: p.input.menuItemId || null,
            note: p.input.note || null,
            branchId: branchId ?? null,
          })),
        });

        // Insertar todos los extras en una sola query.
        const extraRows = prepared.flatMap((p) =>
          p.extras.map((e) => ({
            id: e.id,
            orderId: order.id,
            orderItemId: p.id,
            extraId: e.input.extraId,
            quantity: e.input.quantity,
            price: e.input.price,
            branchId: branchId ?? null,
          }))
        );
        if (extraRows.length > 0) {
          await tx.orderItemExtra.createMany({ data: extraRows });
        }

        // Stock batch — un solo createMany de movements + un update por producto único.
        const saleBatch: StockBatchSaleItem[] = prepared.map((p) => {
          const menuItem = p.input.menuItemId ? menuItemMap.get(p.input.menuItemId) ?? null : null;
          return {
            orderItemId: p.id,
            quantity: p.input.quantity,
            menuItem: menuItem
              ? {
                  productId: menuItem.productId,
                  ingredients: menuItem.ingredients.map((i) => ({
                    productId: i.productId,
                    quantity: i.quantity,
                    unit: i.unit,
                  })),
                }
              : null,
            productId: p.input.productId ?? null,
            extras: p.extras.map((e) => {
              const extraMI = menuItemMap.get(e.input.extraId)!;
              return {
                quantity: e.input.quantity,
                menuItem: {
                  productId: extraMI.productId,
                  ingredients: extraMI.ingredients.map((i) => ({
                    productId: i.productId,
                    quantity: i.quantity,
                    unit: i.unit,
                  })),
                },
              };
            }),
          };
        });

        await this.stockService.recordSalesBatch(
          saleBatch,
          productMap,
          input.userId ?? null,
          tx
        );
      }

      // Leer items y extras creados dentro de la misma transacción
      const createdOrderItems = await tx.orderItem.findMany({
        where: { orderId: order.id },
      });
      const allExtras = await tx.orderItemExtra.findMany({
        where: { orderId: order.id },
      });

      return { order, createdOrderItems, allExtras };
    });

    const { order, createdOrderItems, allExtras } = result;

    // --- Formatear respuesta ---
    const extrasByItemId = allExtras.reduce((acc, extra) => {
      if (!acc[extra.orderItemId]) {
        acc[extra.orderItemId] = [];
      }
      acc[extra.orderItemId].push(extra);
      return acc;
    }, {} as Record<string, typeof allExtras>);

    return {
      id: order.id,
      date: order.date,
      status: order.status,
      paymentMethod: order.paymentMethod,
      total: Number(order.total),
      subtotal: Number(order.subtotal),
      iva: Number(order.iva),
      delivered: order.delivered,
      tableId: order.tableId,
      tip: Number(order.tip),
      origin: order.origin,
      client: order.client,
      paymentDiffer: order.paymentDiffer,
      note: order.note,
      userId: order.userId,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      orderItems: createdOrderItems.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        price: Number(item.price),
        productId: item.productId,
        menuItemId: item.menuItemId,
        note: item.note,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        extras: (extrasByItemId[item.id] || []).map((extra) => ({
          id: extra.id,
          extraId: extra.extraId,
          quantity: extra.quantity,
          price: Number(extra.price),
          createdAt: extra.createdAt,
          updatedAt: extra.updatedAt,
        })),
      })),
    };
  }
}
