import { inject, injectable } from 'tsyringe';
import { IUserRepository } from '../../../domain/interfaces/user-repository.interface';
import { ITableRepository } from '../../../domain/interfaces/table-repository.interface';
import { IProductRepository } from '../../../domain/interfaces/product-repository.interface';
import { IMenuItemRepository } from '../../../domain/interfaces/menu-item-repository.interface';
import { ICompanyRepository } from '../../../domain/interfaces/company-repository.interface';
import { PrismaService } from '../../../infrastructure/config/prisma.config';
import { CreateOrderInput } from '../../dto/order.dto';
import { AppError } from '../../../../shared/errors';
import { isWithinOperatingHours } from '../../../../shared/utils/operating-hours.util';

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
    @inject('IProductRepository') private readonly productRepository: IProductRepository,
    @inject('IMenuItemRepository') private readonly menuItemRepository: IMenuItemRepository,
    @inject('ICompanyRepository') private readonly companyRepository: ICompanyRepository,
    @inject(PrismaService) private readonly prismaService: PrismaService,
  ) {}

  async execute(input: CreateOrderInput): Promise<CreateOrderResult> {
    // --- Validaciones (fuera de transacción, solo lecturas) ---

    // Validar horario de operación
    const company = await this.companyRepository.findFirst();
    if (company?.startOperations && company?.endOperations) {
      const now = new Date();
      const nowHhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      if (!isWithinOperatingHours(nowHhmm, company.startOperations, company.endOperations)) {
        throw new AppError(
          'OUTSIDE_OPERATING_HOURS',
          `Horario de operación: ${company.startOperations} - ${company.endOperations}. No se pueden crear órdenes fuera de este horario.`
        );
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

    // Validar items y calcular subtotal
    let subtotal = 0;
    if (input.orderItems && input.orderItems.length > 0) {
      for (const item of input.orderItems) {
        if (item.productId) {
          const product = await this.productRepository.findById(item.productId);
          if (!product) {
            throw new AppError('PRODUCT_NOT_FOUND', `Product with ID ${item.productId} not found`);
          }
        } else if (item.menuItemId) {
          const menuItem = await this.menuItemRepository.findById(item.menuItemId);
          if (!menuItem) {
            throw new AppError('MENU_ITEM_NOT_FOUND', `Menu item with ID ${item.menuItemId} not found`);
          }
          if (menuItem.isExtra) {
            throw new AppError('INVALID_MENU_ITEM', `Menu item with ID ${item.menuItemId} is an extra and should be in the extras array`);
          }
        }

        subtotal += item.price * item.quantity;

        if (item.extras && item.extras.length > 0) {
          for (const extra of item.extras) {
            const extraMenuItem = await this.menuItemRepository.findById(extra.extraId);
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

    // --- Escrituras (dentro de transacción) ---
    const prisma = this.prismaService.getClient();

    const result = await prisma.$transaction(async (tx) => {
      // Crear orden
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
          userId: input.userId,
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

      // Crear order items y extras
      if (input.orderItems && input.orderItems.length > 0) {
        for (const item of input.orderItems) {
          const createdOrderItem = await tx.orderItem.create({
            data: {
              quantity: item.quantity,
              price: item.price,
              orderId: order.id,
              productId: item.productId || null,
              menuItemId: item.menuItemId || null,
              note: item.note || null,
            },
          });

          if (item.extras && item.extras.length > 0) {
            for (const extra of item.extras) {
              await tx.orderItemExtra.create({
                data: {
                  orderId: order.id,
                  orderItemId: createdOrderItem.id,
                  extraId: extra.extraId,
                  quantity: extra.quantity,
                  price: extra.price,
                },
              });
            }
          }
        }
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

    // --- Formatear respuesta ---
    const { order, createdOrderItems, allExtras } = result;

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
