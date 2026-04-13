import { inject, injectable } from 'tsyringe';
import { randomUUID } from 'crypto';
import { IMenuItemRepository } from '../../../domain/interfaces/menu-item-repository.interface';
import { ICompanyRepository } from '../../../domain/interfaces/company-repository.interface';
import { PrismaService } from '../../../infrastructure/config/prisma.config';
import { AppError } from '../../../../shared/errors';
import { isWithinOperatingHours } from '../../../../shared/utils/operating-hours.util';

export interface CreatePublicOrderInput {
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
    @inject('ICompanyRepository') private readonly companyRepository: ICompanyRepository,
    @inject(PrismaService) private readonly prismaService: PrismaService
  ) {}

  async execute(input: CreatePublicOrderInput): Promise<CreatePublicOrderResult> {
    // 1. Validar horario de operación
    const company = await this.companyRepository.findFirst();
    if (company?.startOperations && company?.endOperations) {
      const timeToCheck = input.scheduledAt
        ? new Date(input.scheduledAt)
        : new Date();
      const hhmm = `${String(timeToCheck.getHours()).padStart(2, '0')}:${String(timeToCheck.getMinutes()).padStart(2, '0')}`;

      if (!isWithinOperatingHours(hhmm, company.startOperations, company.endOperations)) {
        throw new AppError(
          'OUTSIDE_OPERATING_HOURS',
          `Horario de operación: ${company.startOperations} - ${company.endOperations}. No se pueden crear pedidos fuera de este horario.`
        );
      }
    }

    // 2. Validar que hay items
    if (!input.items || input.items.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'At least one item is required');
    }

    // 3. Validar items y extras (lecturas fuera de transacción), cachear precios
    let subtotal = 0;
    const itemPrices: Map<string, number> = new Map();

    for (const item of input.items) {
      const menuItem = await this.menuItemRepository.findById(item.menuItemId);
      if (!menuItem) {
        throw new AppError('MENU_ITEM_NOT_FOUND', `Menu item with ID ${item.menuItemId} not found`);
      }
      if (!menuItem.status) {
        throw new AppError('MENU_ITEM_NOT_AVAILABLE', `Menu item "${menuItem.name}" is not available`);
      }
      if (menuItem.isExtra) {
        throw new AppError('INVALID_MENU_ITEM', `Menu item "${menuItem.name}" is an extra and should be in the extras array`);
      }

      itemPrices.set(menuItem.id, menuItem.price);
      subtotal += menuItem.price * item.quantity;

      if (item.extras && item.extras.length > 0) {
        for (const extra of item.extras) {
          const extraMenuItem = await this.menuItemRepository.findById(extra.extraId);
          if (!extraMenuItem) {
            throw new AppError('MENU_ITEM_NOT_FOUND', `Extra with ID ${extra.extraId} not found`);
          }
          if (!extraMenuItem.status) {
            throw new AppError('MENU_ITEM_NOT_AVAILABLE', `Extra "${extraMenuItem.name}" is not available`);
          }
          if (!extraMenuItem.isExtra) {
            throw new AppError('INVALID_EXTRA', `Menu item "${extraMenuItem.name}" is not an extra`);
          }

          itemPrices.set(extraMenuItem.id, extraMenuItem.price);
          subtotal += extraMenuItem.price * extra.quantity;
        }
      }
    }

    const total = subtotal;
    const trackingToken = randomUUID();
    const origin = input.orderType === 'DELIVERY' ? 'online-delivery' : 'online-pickup';

    // 4. Escrituras dentro de transacción
    const prisma = this.prismaService.getClient();

    const result = await prisma.$transaction(async (tx) => {
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
        },
      });

      for (const item of input.items) {
        const createdItem = await tx.orderItem.create({
          data: {
            quantity: item.quantity,
            price: itemPrices.get(item.menuItemId)!,
            orderId: order.id,
            productId: null,
            menuItemId: item.menuItemId,
            note: item.note ?? null,
          },
        });

        if (item.extras && item.extras.length > 0) {
          for (const extra of item.extras) {
            await tx.orderItemExtra.create({
              data: {
                orderId: order.id,
                orderItemId: createdItem.id,
                extraId: extra.extraId,
                quantity: extra.quantity,
                price: itemPrices.get(extra.extraId)!,
              },
            });
          }
        }
      }

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
