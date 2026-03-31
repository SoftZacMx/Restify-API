import { container } from 'tsyringe';
import { SubscriptionRepository } from '../../database/repositories/subscription.repository';
import { ISubscriptionRepository } from '../../../domain/interfaces/subscription-repository.interface';
import { CreateSubscriptionCheckoutUseCase } from '../../../application/use-cases/subscription/create-subscription-checkout.use-case';
import { HandleSubscriptionWebhookUseCase } from '../../../application/use-cases/subscription/handle-subscription-webhook.use-case';
import { GetSubscriptionStatusUseCase } from '../../../application/use-cases/subscription/get-subscription-status.use-case';
import { CancelSubscriptionUseCase } from '../../../application/use-cases/subscription/cancel-subscription.use-case';
import { ReactivateSubscriptionUseCase } from '../../../application/use-cases/subscription/reactivate-subscription.use-case';
import { prismaClient } from './prisma.module';

container.register<ISubscriptionRepository>('ISubscriptionRepository', {
  useFactory: () => new SubscriptionRepository(prismaClient),
});

container.register(CreateSubscriptionCheckoutUseCase, CreateSubscriptionCheckoutUseCase);
container.register(HandleSubscriptionWebhookUseCase, HandleSubscriptionWebhookUseCase);
container.register(GetSubscriptionStatusUseCase, GetSubscriptionStatusUseCase);
container.register(CancelSubscriptionUseCase, CancelSubscriptionUseCase);
container.register(ReactivateSubscriptionUseCase, ReactivateSubscriptionUseCase);
