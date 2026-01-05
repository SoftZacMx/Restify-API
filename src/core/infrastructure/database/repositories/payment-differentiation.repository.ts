import { PrismaClient, PaymentMethod } from '@prisma/client';
import { IPaymentDifferentiationRepository } from '../../../domain/interfaces/payment-differentiation-repository.interface';
import { PaymentDifferentiation } from '../../../domain/entities/payment-differentiation.entity';

export class PaymentDifferentiationRepository implements IPaymentDifferentiationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<PaymentDifferentiation | null> {
    const paymentDiff = await this.prisma.paymentDifferentiation.findUnique({
      where: { id },
    });

    if (!paymentDiff) {
      return null;
    }

    return new PaymentDifferentiation(
      paymentDiff.id,
      paymentDiff.orderId,
      Number(paymentDiff.firstPaymentAmount),
      paymentDiff.firstPaymentMethod,
      Number(paymentDiff.secondPaymentAmount),
      paymentDiff.secondPaymentMethod,
      paymentDiff.createdAt,
      paymentDiff.updatedAt
    );
  }

  async findByOrderId(orderId: string): Promise<PaymentDifferentiation | null> {
    const paymentDiff = await this.prisma.paymentDifferentiation.findUnique({
      where: { orderId },
    });

    if (!paymentDiff) {
      return null;
    }

    return new PaymentDifferentiation(
      paymentDiff.id,
      paymentDiff.orderId,
      Number(paymentDiff.firstPaymentAmount),
      paymentDiff.firstPaymentMethod,
      Number(paymentDiff.secondPaymentAmount),
      paymentDiff.secondPaymentMethod,
      paymentDiff.createdAt,
      paymentDiff.updatedAt
    );
  }

  async create(data: {
    orderId: string;
    firstPaymentAmount: number;
    firstPaymentMethod: PaymentMethod;
    secondPaymentAmount: number;
    secondPaymentMethod: PaymentMethod;
  }): Promise<PaymentDifferentiation> {
    const paymentDiff = await this.prisma.paymentDifferentiation.create({
      data: {
        orderId: data.orderId,
        firstPaymentAmount: data.firstPaymentAmount,
        firstPaymentMethod: data.firstPaymentMethod,
        secondPaymentAmount: data.secondPaymentAmount,
        secondPaymentMethod: data.secondPaymentMethod,
      },
    });

    return new PaymentDifferentiation(
      paymentDiff.id,
      paymentDiff.orderId,
      Number(paymentDiff.firstPaymentAmount),
      paymentDiff.firstPaymentMethod,
      Number(paymentDiff.secondPaymentAmount),
      paymentDiff.secondPaymentMethod,
      paymentDiff.createdAt,
      paymentDiff.updatedAt
    );
  }

  async update(id: string, data: {
    firstPaymentAmount?: number;
    firstPaymentMethod?: PaymentMethod;
    secondPaymentAmount?: number;
    secondPaymentMethod?: PaymentMethod;
  }): Promise<PaymentDifferentiation> {
    const updateData: any = {};

    if (data.firstPaymentAmount !== undefined) updateData.firstPaymentAmount = data.firstPaymentAmount;
    if (data.firstPaymentMethod !== undefined) updateData.firstPaymentMethod = data.firstPaymentMethod;
    if (data.secondPaymentAmount !== undefined) updateData.secondPaymentAmount = data.secondPaymentAmount;
    if (data.secondPaymentMethod !== undefined) updateData.secondPaymentMethod = data.secondPaymentMethod;

    const paymentDiff = await this.prisma.paymentDifferentiation.update({
      where: { id },
      data: updateData,
    });

    return new PaymentDifferentiation(
      paymentDiff.id,
      paymentDiff.orderId,
      Number(paymentDiff.firstPaymentAmount),
      paymentDiff.firstPaymentMethod,
      Number(paymentDiff.secondPaymentAmount),
      paymentDiff.secondPaymentMethod,
      paymentDiff.createdAt,
      paymentDiff.updatedAt
    );
  }

  async delete(id: string): Promise<void> {
    await this.prisma.paymentDifferentiation.delete({
      where: { id },
    });
  }

  async deleteByOrderId(orderId: string): Promise<void> {
    await this.prisma.paymentDifferentiation.deleteMany({
      where: { orderId },
    });
  }
}

