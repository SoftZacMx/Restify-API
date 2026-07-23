import { PrismaClient, PaymentStatus, PaymentMethod, PaymentGateway, Prisma } from '@prisma/client';
import { IPaymentRepository, PaymentFilters } from '../../../domain/interfaces/payment-repository.interface';
import { Payment } from '../../../domain/entities/payment.entity';

export class PaymentRepository implements IPaymentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Payment | null> {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
    });

    if (!payment) {
      return null;
    }

    return new Payment(
      payment.id,
      payment.orderId,
      payment.userId,
      Number(payment.amount),
      payment.currency,
      payment.status,
      payment.paymentMethod,
      payment.gateway,
      payment.gatewayTransactionId,
      payment.metadata as any,
      payment.createdAt,
      payment.updatedAt
    );
  }

  async findByGatewayTransactionId(gatewayTransactionId: string): Promise<Payment | null> {
    const payment = await this.prisma.payment.findFirst({
      where: { gatewayTransactionId },
    });

    if (!payment) {
      return null;
    }

    return new Payment(
      payment.id,
      payment.orderId,
      payment.userId,
      Number(payment.amount),
      payment.currency,
      payment.status,
      payment.paymentMethod,
      payment.gateway,
      payment.gatewayTransactionId,
      payment.metadata as any,
      payment.createdAt,
      payment.updatedAt
    );
  }

  async findAll(filters?: PaymentFilters): Promise<Payment[]> {
    const where: any = {};

    if (filters?.orderIds !== undefined && filters.orderIds.length > 0) {
      where.orderId = { in: filters.orderIds };
    } else if (filters?.orderId) {
      where.orderId = filters.orderId;
    }

    if (filters?.userId) {
      where.userId = filters.userId;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.paymentMethod) {
      where.paymentMethod = filters.paymentMethod;
    }

    if (filters?.dateFrom || filters?.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) {
        where.createdAt.gte = filters.dateFrom;
      }
      if (filters.dateTo) {
        where.createdAt.lte = filters.dateTo;
      }
    }

    const payments = await this.prisma.payment.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return payments.map(
      (payment) =>
        new Payment(
          payment.id,
          payment.orderId,
          payment.userId,
          Number(payment.amount),
          payment.currency,
          payment.status,
          payment.paymentMethod,
          payment.gateway,
          payment.gatewayTransactionId,
          payment.metadata as any,
          payment.createdAt,
          payment.updatedAt
        )
    );
  }

  async create(data: {
    orderId?: string | null;
    userId: string;
    amount: number;
    currency?: string;
    status: PaymentStatus;
    paymentMethod: PaymentMethod;
    gateway?: PaymentGateway | null;
    gatewayTransactionId?: string | null;
    metadata?: any | null;
  }): Promise<Payment> {
    let payment;
    try {
      payment = await this.prisma.payment.create({
        data: {
          orderId: data.orderId || null,
          userId: data.userId,
          amount: data.amount,
          currency: data.currency || 'USD',
          status: data.status,
          paymentMethod: data.paymentMethod,
          gateway: data.gateway || null,
          gatewayTransactionId: data.gatewayTransactionId || null,
          metadata: data.metadata || null,
        },
      });
    } catch (error) {
      // Carrera de webhooks: dos avisos del mismo pago de MP intentan crear la fila a la
      // vez. El único en gatewayTransactionId hace que uno gane; el otro recibe P2002.
      // Se trata como "ya procesado": se recupera la fila ganadora en vez de fallar.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        data.gatewayTransactionId
      ) {
        const existing = await this.findByGatewayTransactionId(data.gatewayTransactionId);
        if (existing) {
          return existing;
        }
      }
      throw error;
    }

    return new Payment(
      payment.id,
      payment.orderId,
      payment.userId,
      Number(payment.amount),
      payment.currency,
      payment.status,
      payment.paymentMethod,
      payment.gateway,
      payment.gatewayTransactionId,
      payment.metadata as any,
      payment.createdAt,
      payment.updatedAt
    );
  }

  async update(id: string, data: {
    status?: PaymentStatus;
    orderId?: string | null;
    gatewayTransactionId?: string | null;
    metadata?: any | null;
  }): Promise<Payment> {
    const updateData: any = {};

    if (data.status !== undefined) updateData.status = data.status;
    if (data.orderId !== undefined) updateData.orderId = data.orderId;
    if (data.gatewayTransactionId !== undefined) updateData.gatewayTransactionId = data.gatewayTransactionId;
    if (data.metadata !== undefined) updateData.metadata = data.metadata;

    const payment = await this.prisma.payment.update({
      where: { id },
      data: updateData,
    });

    return new Payment(
      payment.id,
      payment.orderId,
      payment.userId,
      Number(payment.amount),
      payment.currency,
      payment.status,
      payment.paymentMethod,
      payment.gateway,
      payment.gatewayTransactionId,
      payment.metadata as any,
      payment.createdAt,
      payment.updatedAt
    );
  }

  async delete(id: string): Promise<void> {
    await this.prisma.payment.delete({
      where: { id },
    });
  }
}

