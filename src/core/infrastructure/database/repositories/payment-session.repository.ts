import { PrismaClient } from '@prisma/client';
import { IPaymentSessionRepository } from '../../../domain/interfaces/payment-session-repository.interface';
import { PaymentSession } from '../../../domain/entities/payment-session.entity';

export class PaymentSessionRepository implements IPaymentSessionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<PaymentSession | null> {
    const session = await this.prisma.paymentSession.findUnique({
      where: { id },
    });

    if (!session) {
      return null;
    }

    return new PaymentSession(
      session.id,
      session.paymentId,
      session.clientSecret,
      session.connectionId,
      session.expiresAt,
      session.createdAt
    );
  }

  async findByPaymentId(paymentId: string): Promise<PaymentSession | null> {
    const session = await this.prisma.paymentSession.findUnique({
      where: { paymentId },
    });

    if (!session) {
      return null;
    }

    return new PaymentSession(
      session.id,
      session.paymentId,
      session.clientSecret,
      session.connectionId,
      session.expiresAt,
      session.createdAt
    );
  }

  async create(data: {
    paymentId: string;
    clientSecret: string;
    connectionId?: string | null;
    expiresAt: Date;
  }): Promise<PaymentSession> {
    const session = await this.prisma.paymentSession.create({
      data: {
        paymentId: data.paymentId,
        clientSecret: data.clientSecret,
        connectionId: data.connectionId || null,
        expiresAt: data.expiresAt,
      },
    });

    return new PaymentSession(
      session.id,
      session.paymentId,
      session.clientSecret,
      session.connectionId,
      session.expiresAt,
      session.createdAt
    );
  }

  async update(id: string, data: {
    connectionId?: string | null;
  }): Promise<PaymentSession> {
    const updateData: any = {};

    if (data.connectionId !== undefined) updateData.connectionId = data.connectionId;

    const session = await this.prisma.paymentSession.update({
      where: { id },
      data: updateData,
    });

    return new PaymentSession(
      session.id,
      session.paymentId,
      session.clientSecret,
      session.connectionId,
      session.expiresAt,
      session.createdAt
    );
  }

  async delete(id: string): Promise<void> {
    await this.prisma.paymentSession.delete({
      where: { id },
    });
  }

  async deleteByPaymentId(paymentId: string): Promise<void> {
    await this.prisma.paymentSession.deleteMany({
      where: { paymentId },
    });
  }
}

