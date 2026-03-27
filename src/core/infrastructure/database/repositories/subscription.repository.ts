import { PrismaClient } from '@prisma/client';
import { ISubscriptionRepository, CreateSubscriptionData, UpdateSubscriptionData } from '../../../domain/interfaces/subscription-repository.interface';
import { Subscription } from '../../../domain/entities/subscription.entity';

export class SubscriptionRepository implements ISubscriptionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async find(): Promise<Subscription | null> {
    const subscription = await this.prisma.subscription.findFirst();

    if (!subscription) {
      return null;
    }

    return new Subscription(
      subscription.id,
      subscription.stripeCustomerId,
      subscription.stripeSubscriptionId,
      subscription.status,
      subscription.currentPeriodStart,
      subscription.currentPeriodEnd,
      subscription.cancelAtPeriodEnd,
      subscription.createdAt,
      subscription.updatedAt
    );
  }

  async create(data: CreateSubscriptionData): Promise<Subscription> {
    const subscription = await this.prisma.subscription.create({
      data: {
        stripeCustomerId: data.stripeCustomerId,
        stripeSubscriptionId: data.stripeSubscriptionId || null,
        status: data.status || 'EXPIRED',
        currentPeriodStart: data.currentPeriodStart || null,
        currentPeriodEnd: data.currentPeriodEnd || null,
        cancelAtPeriodEnd: data.cancelAtPeriodEnd || false,
      },
    });

    return new Subscription(
      subscription.id,
      subscription.stripeCustomerId,
      subscription.stripeSubscriptionId,
      subscription.status,
      subscription.currentPeriodStart,
      subscription.currentPeriodEnd,
      subscription.cancelAtPeriodEnd,
      subscription.createdAt,
      subscription.updatedAt
    );
  }

  async update(id: string, data: UpdateSubscriptionData): Promise<Subscription> {
    const updateData: any = {};

    if (data.stripeSubscriptionId !== undefined) updateData.stripeSubscriptionId = data.stripeSubscriptionId;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.currentPeriodStart !== undefined) updateData.currentPeriodStart = data.currentPeriodStart;
    if (data.currentPeriodEnd !== undefined) updateData.currentPeriodEnd = data.currentPeriodEnd;
    if (data.cancelAtPeriodEnd !== undefined) updateData.cancelAtPeriodEnd = data.cancelAtPeriodEnd;

    const subscription = await this.prisma.subscription.update({
      where: { id },
      data: updateData,
    });

    return new Subscription(
      subscription.id,
      subscription.stripeCustomerId,
      subscription.stripeSubscriptionId,
      subscription.status,
      subscription.currentPeriodStart,
      subscription.currentPeriodEnd,
      subscription.cancelAtPeriodEnd,
      subscription.createdAt,
      subscription.updatedAt
    );
  }
}
