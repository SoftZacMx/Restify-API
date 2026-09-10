import { inject, injectable } from 'tsyringe';
import { ISubscriptionRepository } from '../../domain/interfaces/subscription-repository.interface';
import { ISubscriptionPlanRepository } from '../../domain/interfaces/subscription-plan-repository.interface';

/** Sucursales permitidas cuando la suscripción no tiene plan asignado. */
const DEFAULT_MAX_BRANCHES = 3;

@injectable()
export class BranchLimitService {
  constructor(
    @inject('ISubscriptionRepository')
    private readonly subscriptionRepository: ISubscriptionRepository,
    @inject('ISubscriptionPlanRepository')
    private readonly planRepository: ISubscriptionPlanRepository
  ) {}

  /**
   * Límite de sucursales del plan al que apunta la suscripción de la organización.
   *
   * Única fuente del límite: la fila del plan. Así, al pagar un plano mayor el
   * límite sube sin que haya que sincronizar nada más.
   */
  async getMaxBranches(): Promise<number> {
    const subscription = await this.subscriptionRepository.find();
    if (!subscription?.planId) {
      return DEFAULT_MAX_BRANCHES;
    }

    const plan = await this.planRepository.findById(subscription.planId);
    return plan?.maxBranches ?? DEFAULT_MAX_BRANCHES;
  }
}
