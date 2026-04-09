import { Subscription } from '../entities/subscription.entity';
import { SubscriptionStatus } from '@prisma/client';

export interface CreateSubscriptionData {
  stripeCustomerId: string;
  stripeSubscriptionId?: string | null;
  status?: SubscriptionStatus;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  cancelAtPeriodEnd?: boolean;
  planId?: string | null;
}

export interface UpdateSubscriptionData {
  stripeSubscriptionId?: string | null;
  status?: SubscriptionStatus;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  cancelAtPeriodEnd?: boolean;
  planId?: string | null;
}

export interface ISubscriptionRepository {
  find(): Promise<Subscription | null>;
  create(data: CreateSubscriptionData): Promise<Subscription>;
  update(id: string, data: UpdateSubscriptionData): Promise<Subscription>;
}
