import { inject, injectable } from 'tsyringe';
import { randomUUID } from 'crypto';
import { IMenuItemRepository } from '../../../domain/interfaces/menu-item-repository.interface';
import { IBranchRepository } from '../../../domain/interfaces/branch-repository.interface';
import { getPrisma } from '../../../infrastructure/database/prisma/get-prisma';
import { PrismaService } from '../../../infrastructure/config/prisma.config';
import { StockService, StockBatchSaleItem } from '../../services/stock.service';
import { AppError } from '../../../../shared/errors';
import { isWithinOperatingHours } from '../../../../shared/utils/operating-hours.util';

export interface CreatePublicOrderInput {
  branchId: string; // Required for multi-tenancy
  customerName: string;
  customerPhone: string;
  orderType: 'DELIVERY' | 'PICKUP';
  deliveryAddress?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  scheduledAt?: string | null;
  items: {
    menuItemId: string;
    quantity: number;
    note?: string | null;
    extras?: { extraId: string; quantity: number }[];
  }[];
}

export interface CreatePublicOrderResult {
  id: string;
  trackingToken: string;
  total: number;
  subtotal: number;
  origin: string;
  customerName: string;
  orderType: 'DELIVERY' | 'PICKUP';
  createdAt: Date;
}

@injectable()
export class CreatePublicOrderUseCase {
  constructor(
    @inject('IMenuItemRepository') private readonly menuItemRepository: IMenuItemRepository,
    @inject('IBranchRepository') private readonly branchRepository: IBranchRepository,
    @inject(PrismaService) private readonly prismaService: PrismaService,
    @inject(StockService) private readonly stockService: StockService,
  ) {}

  async execute(input: CreatePublicOrderInput): Promise<CreatePublicOrderResult> {
    // 1. Validar que la sucursal existe y obtener horarios
    const branch = await this.branchRepository.findById(input.branchId);
    if (!branch) {
      throw new AppError('BRANCH_NOT_FOUND', 'Branch not found');
    }

    // 2. Validar horario de operación
    if (branch.startOperations && branch.endOperations) {
      const timeToCheck = input.scheduledAt
        ? new Date(input.scheduledAt)
        : new Date();
      const hhmm = `${String(timeToCheck.getHours()).padStart(2, '0')}:${String(timeToCheck.getMinutes()).padStart(2, '0')}`;

      if (!isWithinOperatingHours(hhmm, branch.startOperations, branch.endOperations)) {
        throw new AppError(
          'OUTSIDE_OPERATING_HOURS',
          `Horario de operación: ${branch.startOperations} - ${branch.endOperations}. No se pueden crear pedidos fuera de este horario.`
        );
      }
    }

    // 3. Validar que hay items
    if (!input.items || input.items.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'At least one item is required');
    }

    // 3b. Bulk-load menuItems con ingredientes y productos asociados.
    const prisma = getPrisma();

    const menuItemIds = new Set<string>();
    for (const item of input.items) {
      menuItemIds.add(item.menuItemId);
      for (const extra of item.extras ?? []) {
        menuItemIds.add(extra.extraId);
      }
    }

    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: [...menuItemIds] } },
      include: { ingredients: true },
    });
    const menuItemMap = new Map(menuItems.map((m) => [m.id, m]));

    const stockProductIds = new Set<string>();
    for (const mi of menuItems) {
      if (mi.productId) stockProductIds.add(mi.productId);
      for (const ing of mi.ingredients) stockProductIds.add(ing.productId);
    }
    const products = stockProductIds.size > 0
      ? await prisma.product.findMany({ where: { id: { in: [...stockProductIds] } } })
      : [];
    const productMap = new Map(products.map((p) => [p.id, p]));

    // 4. Validar y calcular subtotal usando los maps.
    let subtotal = 0;
    for (const item of input.items) {
      const menuItem = menuItemMap.get(item.menuItemId);
      if (!menuItem) {
        throw new AppError('MENU_ITEM_NOT_FOUND', `Menu item with ID ${item.menuItemId} not found`);
      }
      if (!menuItem.status) {
        throw new AppError('MENU_ITEM_NOT_AVAILABLE', `Menu item "${menuItem.name}" is not available`);
      }
      if (menuItem.isExtra) {
        throw new AppError('INVALID_MENU_ITEM', `Menu item "${menuItem.name}" is an extra and should be in the extras array`);
      }

      subtotal += Number(menuItem.price) * item.quantity;

      if (item.extras && item.extras.length > 0) {
        for (const extra of item.extras) {
          const extraMenuItem = menuItemMap.get(extra.extraId);
          if (!extraMenuItem) {
            throw new AppError('MENU_ITEM_NOT_FOUND', `Extra with ID ${extra.extraId} not found`);
          }
          if (!extraMenuItem.status) {
            throw new AppError('MENU_ITEM_NOT_AVAILABLE', `Extra "${extraMenuItem.name}" is not available`);
          }
          if (!extraMenuItem.isExtra) {
            throw new AppError('INVALID_EXTRA', `Menu item "${extraMenuItem.name}" is not an extra`);
          }

          subtotal += Number(extraMenuItem.price) * extra.quantity;
        }
      }
    }

    const total = subtotal;
    const trackingToken = randomUUID();
    const origin = input.orderType === 'DELIVERY' ? 'online-delivery' : 'online-pickup';

    // Pre-generar IDs para createMany.
    const prepared = input.items.map((item) => ({
      id: randomUUID(),
      input: item,
      extras: (item.extras ?? []).map((extra) => ({
        id: randomUUID(),
        input: extra,
      })),
    }));

    // 5. Escrituras dentro de transacción (branchId explícito: viene del parámetro público).
    // Cliente base para la tx: `tx` debe ser Prisma.TransactionClient (requerido por stockService).
    const result = await this.prismaService.getClient().$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          status: false,
          paymentMethod: null,
          total,
          subtotal,
          iva: 0,
          delivered: false,
          tableId: null,
          tip: 0,
          origin,
          client: null,
          paymentDiffer: false,
          note: null,
          userId: null,
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          latitude: input.latitude ?? null,
          longitude: input.longitude ?? null,
          deliveryAddress: input.deliveryAddress ?? null,
          scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
          trackingToken,
          branchId: input.branchId,
        },
      });

      await tx.orderItem.createMany({
        data: prepared.map((p) => ({
          id: p.id,
          quantity: p.input.quantity,
          price: Number(menuItemMap.get(p.input.menuItemId)!.price),
          orderId: order.id,
          productId: null,
          menuItemId: p.input.menuItemId,
          note: p.input.note ?? null,
          branchId: input.branchId,
        })),
      });

      const extraRows = prepared.flatMap((p) =>
        p.extras.map((e) => ({
          id: e.id,
          orderId: order.id,
          orderItemId: p.id,
          extraId: e.input.extraId,
          quantity: e.input.quantity,
          price: Number(menuItemMap.get(e.input.extraId)!.price),
          branchId: input.branchId,
        }))
      );
      if (extraRows.length > 0) {
        await tx.orderItemExtra.createMany({ data: extraRows });
      }

      // Stock batch — userId=null (movement del sistema, sin user humano).
      const saleBatch: StockBatchSaleItem[] = prepared.map((p) => {
        const menuItem = menuItemMap.get(p.input.menuItemId)!;
        return {
          orderItemId: p.id,
          quantity: p.input.quantity,
          menuItem: {
            productId: menuItem.productId,
            ingredients: menuItem.ingredients.map((i) => ({
              productId: i.productId,
              quantity: i.quantity,
              unit: i.unit,
            })),
          },
          productId: null,
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

      await this.stockService.recordSalesBatch(saleBatch, productMap, null, tx);

      return order;
    });

    return {
      id: result.id,
      trackingToken,
      total,
      subtotal,
      origin,
      customerName: input.customerName,
      orderType: input.orderType,
      createdAt: result.createdAt,
    };
  }
}
