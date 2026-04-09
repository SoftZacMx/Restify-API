import { inject, injectable } from 'tsyringe';
import { ISubscriptionPlanRepository } from '../../../domain/interfaces/subscription-plan-repository.interface';

export interface SubscriptionPlanDTO {
  id: string;
  name: string;
  billingPeriod: string;
  price: number;
}

@injectable()
export class ListSubscriptionPlansUseCase {
  constructor(
    @inject('ISubscriptionPlanRepository') private readonly planRepository: ISubscriptionPlanRepository
  ) {}

  async execute(): Promise<SubscriptionPlanDTO[]> {
    const plans = await this.planRepository.findActive();

    return plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      billingPeriod: plan.billingPeriod,
      price: plan.price,
    }));
  }
}
