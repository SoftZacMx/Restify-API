import { PrismaClient, Prisma } from '@prisma/client';
import {
  IPendingCheckoutRepository,
  PendingCheckout,
  PendingCheckoutCartItem,
  CreatePendingCheckoutData,
  UpdatePendingCheckoutData,
} from '../../../domain/interfaces/pending-checkout-repository.interface';

type PendingCheckoutRow = Prisma.PendingCheckoutGetPayload<{}>;

function toDomain(row: PendingCheckoutRow): PendingCheckout {
  return {
    id: row.id,
    branchId: row.branchId,
    status: row.status,
    cart: row.cart as unknown as PendingCheckoutCartItem[],
    customerName: row.customerName,
    customerPhone: row.customerPhone,
    orderType: row.orderType as 'DELIVERY' | 'PICKUP',
    deliveryAddress: row.deliveryAddress,
    latitude: row.latitude,
    longitude: row.longitude,
    scheduledAt: row.scheduledAt,
    total: Number(row.total),
    subtotal: Number(row.subtotal),
    trackingToken: row.trackingToken,
    mpPreferenceId: row.mpPreferenceId,
    paymentId: row.paymentId,
    orderId: row.orderId,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
  };
}

export class PendingCheckoutRepository implements IPendingCheckoutRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<PendingCheckout | null> {
    const row = await this.prisma.pendingCheckout.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async findByTrackingToken(trackingToken: string): Promise<PendingCheckout | null> {
    const row = await this.prisma.pendingCheckout.findUnique({ where: { trackingToken } });
    return row ? toDomain(row) : null;
  }

  async create(data: CreatePendingCheckoutData): Promise<PendingCheckout> {
    const row = await this.prisma.pendingCheckout.create({
      data: {
        branchId: data.branchId,
        cart: data.cart as unknown as Prisma.InputJsonValue,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        orderType: data.orderType,
        deliveryAddress: data.deliveryAddress ?? null,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        scheduledAt: data.scheduledAt ?? null,
        total: data.total,
        subtotal: data.subtotal,
        trackingToken: data.trackingToken,
        expiresAt: data.expiresAt,
      },
    });
    return toDomain(row);
  }

  async update(id: string, data: UpdatePendingCheckoutData): Promise<PendingCheckout> {
    const row = await this.prisma.pendingCheckout.update({
      where: { id },
      data: {
        ...(data.status !== undefined && { status: data.status }),
        ...(data.mpPreferenceId !== undefined && { mpPreferenceId: data.mpPreferenceId }),
        ...(data.paymentId !== undefined && { paymentId: data.paymentId }),
        ...(data.orderId !== undefined && { orderId: data.orderId }),
      },
    });
    return toDomain(row);
  }
}
