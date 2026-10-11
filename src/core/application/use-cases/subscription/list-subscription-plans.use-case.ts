import { inject, injectable } from 'tsyringe';
import { ISubscriptionPlanRepository } from '../../../domain/interfaces/subscription-plan-repository.interface';

export interface SubscriptionPlanDTO {
  id: string;
  name: string;
  billingPeriod: string | null;
  price: number;
}

@injectable()
export class ListSubscriptionPlansUseCase {
  constructor(
    @inject('ISubscriptionPlanRepository') private readonly planRepository: ISubscriptionPlanRepository
  ) {}

  async execute(organizationId?: string): Promise<SubscriptionPlanDTO[]> {
    const plans = organizationId
      ? await this.planRepository.findAvailableFor(organizationId)
      : await this.planRepository.findPublic();

    return plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      billingPeriod: plan.billingPeriod,
      price: plan.price,
    }));
  }
}
