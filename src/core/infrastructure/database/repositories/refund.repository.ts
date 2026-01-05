import { PrismaClient, RefundStatus } from '@prisma/client';
import { IRefundRepository, RefundFilters } from '../../../domain/interfaces/refund-repository.interface';
import { Refund } from '../../../domain/entities/refund.entity';

export class RefundRepository implements IRefundRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Refund | null> {
    const refund = await this.prisma.refund.findUnique({
      where: { id },
    });

    if (!refund) {
      return null;
    }

    return new Refund(
      refund.id,
      refund.paymentId,
      Number(refund.amount),
      refund.reason,
      refund.gatewayRefundId,
      refund.status,
      refund.createdAt
    );
  }

  async findByPaymentId(paymentId: string): Promise<Refund[]> {
    const refunds = await this.prisma.refund.findMany({
      where: { paymentId },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return refunds.map(
      (refund) =>
        new Refund(
          refund.id,
          refund.paymentId,
          Number(refund.amount),
          refund.reason,
          refund.gatewayRefundId,
          refund.status,
          refund.createdAt
        )
    );
  }

  async findAll(filters?: RefundFilters): Promise<Refund[]> {
    const where: any = {};

    if (filters?.paymentId) {
      where.paymentId = filters.paymentId;
    }

    if (filters?.status) {
      where.status = filters.status;
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

    const refunds = await this.prisma.refund.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return refunds.map(
      (refund) =>
        new Refund(
          refund.id,
          refund.paymentId,
          Number(refund.amount),
          refund.reason,
          refund.gatewayRefundId,
          refund.status,
          refund.createdAt
        )
    );
  }

  async create(data: {
    paymentId: string;
    amount: number;
    reason?: string | null;
    gatewayRefundId?: string | null;
    status: RefundStatus;
  }): Promise<Refund> {
    const refund = await this.prisma.refund.create({
      data: {
        paymentId: data.paymentId,
        amount: data.amount,
        reason: data.reason || null,
        gatewayRefundId: data.gatewayRefundId || null,
        status: data.status,
      },
    });

    return new Refund(
      refund.id,
      refund.paymentId,
      Number(refund.amount),
      refund.reason,
      refund.gatewayRefundId,
      refund.status,
      refund.createdAt
    );
  }

  async update(id: string, data: {
    status?: RefundStatus;
    gatewayRefundId?: string | null;
    reason?: string | null;
  }): Promise<Refund> {
    const updateData: any = {};

    if (data.status !== undefined) updateData.status = data.status;
    if (data.gatewayRefundId !== undefined) updateData.gatewayRefundId = data.gatewayRefundId;
    if (data.reason !== undefined) updateData.reason = data.reason;

    const refund = await this.prisma.refund.update({
      where: { id },
      data: updateData,
    });

    return new Refund(
      refund.id,
      refund.paymentId,
      Number(refund.amount),
      refund.reason,
      refund.gatewayRefundId,
      refund.status,
      refund.createdAt
    );
  }

  async delete(id: string): Promise<void> {
    await this.prisma.refund.delete({
      where: { id },
    });
  }
}

