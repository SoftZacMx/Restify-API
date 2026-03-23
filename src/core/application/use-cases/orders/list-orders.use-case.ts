import { inject, injectable } from 'tsyringe';
import {
  IOrderRepository,
  OrderFilters,
} from '../../../domain/interfaces/order-repository.interface';
import { ListOrdersInput } from '../../dto/order.dto';

export interface ListOrdersItem {
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
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ListOrdersResult {
  data: ListOrdersItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  /** Totales globales (sin paginación): pendientes vs pagadas, mismo rango/fecha y filtros que `summaryBase` (sin filtro de estado del listado). */
  summary: {
    totalOrdersPending: number;
    totalOrdersPaid: number;
  };
}

@injectable()
export class ListOrdersUseCase {
  constructor(
    @inject('IOrderRepository') private readonly orderRepository: IOrderRepository
  ) {}

  async execute(input?: ListOrdersInput): Promise<ListOrdersResult> {
    const filters = input
      ? {
          status: input.status,
          userId: input.userId,
          tableId: input.tableId,
          paymentMethod: input.paymentMethod,
          origin: input.origin,
          dateFrom: input.dateFrom ? new Date(input.dateFrom) : undefined,
          dateTo: input.dateTo ? new Date(input.dateTo) : undefined,
        }
      : undefined;

    const page = input?.page ?? 1;
    const limit = Math.min(input?.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const summaryBase: OrderFilters | undefined = filters
      ? {
          userId: filters.userId,
          tableId: filters.tableId,
          paymentMethod: filters.paymentMethod,
          origin: filters.origin,
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
        }
      : undefined;

    const [orders, total, totalOrdersPending, totalOrdersPaid] = await Promise.all([
      this.orderRepository.findAll(filters, { skip, take: limit }),
      this.orderRepository.count(filters),
      this.orderRepository.count({ ...summaryBase, status: false }),
      this.orderRepository.count({ ...summaryBase, status: true }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      data: orders.map((order) => ({
        id: order.id,
        date: order.date,
        status: order.status,
        paymentMethod: order.paymentMethod,
        total: order.total,
        subtotal: order.subtotal,
        iva: order.iva,
        delivered: order.delivered,
        tableId: order.tableId,
        tip: order.tip,
        origin: order.origin,
        client: order.client,
        paymentDiffer: order.paymentDiffer,
        note: order.note,
        userId: order.userId,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
      summary: {
        totalOrdersPending,
        totalOrdersPaid,
      },
    };
  }
}

