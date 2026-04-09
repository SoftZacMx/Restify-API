import { inject, injectable } from 'tsyringe';
import { ISubscriptionRepository } from '../../../domain/interfaces/subscription-repository.interface';
import { ISubscriptionPlanRepository } from '../../../domain/interfaces/subscription-plan-repository.interface';
import { ICompanyRepository } from '../../../domain/interfaces/company-repository.interface';
import { IUserRepository } from '../../../domain/interfaces/user-repository.interface';
import { StripeSubscriptionService } from '../../../infrastructure/payment-gateways/stripe-subscription.service';
import { AppError } from '../../../../shared/errors';

export interface CreateSubscriptionCheckoutInput {
  userId: string;
  planId: string;
}

export interface CreateSubscriptionCheckoutResult {
  checkoutUrl: string;
  sessionId: string;
}

@injectable()
export class CreateSubscriptionCheckoutUseCase {
  constructor(
    @inject('ISubscriptionRepository') private readonly subscriptionRepository: ISubscriptionRepository,
    @inject('ISubscriptionPlanRepository') private readonly planRepository: ISubscriptionPlanRepository,
    @inject('ICompanyRepository') private readonly companyRepository: ICompanyRepository,
    @inject('IUserRepository') private readonly userRepository: IUserRepository,
    @inject(StripeSubscriptionService) private readonly stripeSubscriptionService: StripeSubscriptionService
  ) {}

  async execute(input: CreateSubscriptionCheckoutInput): Promise<CreateSubscriptionCheckoutResult> {
    // 0. Validar que sea ADMIN
    const user = await this.userRepository.findById(input.userId);
    if (!user || user.rol !== 'ADMIN') {
      throw new AppError('FORBIDDEN', 'Solo el administrador puede gestionar la suscripción');
    }

    // 1. Buscar el plan en la base de datos
    const plan = await this.planRepository.findById(input.planId);
    if (!plan || !plan.status) {
      throw new AppError('SUBSCRIPTION_PLAN_NOT_FOUND');
    }

    // 2. Buscar suscripción existente
    const existing = await this.subscriptionRepository.find();

    // 3. Si ya existe y está activa, no permitir otra
    if (existing && existing.status === 'ACTIVE') {
      throw new AppError('SUBSCRIPTION_ALREADY_ACTIVE');
    }

    // 4. Obtener datos del negocio para el Customer de Stripe
    const company = await this.companyRepository.findFirst();
    const customerEmail = user.email;
    const customerName = company?.name || 'Mi Restaurante';

    // 5. Obtener o crear Stripe Customer
    let stripeCustomerId: string;

    if (existing?.stripeCustomerId) {
      stripeCustomerId = existing.stripeCustomerId;
    } else {
      stripeCustomerId = await this.stripeSubscriptionService.createCustomer({
        email: customerEmail,
        name: customerName,
      });
    }

    // 6. Crear Checkout Session con el stripePriceId del plan
    const successUrl = process.env.STRIPE_SUCCESS_URL || 'http://localhost:5173/subscription/success';
    const cancelUrl = process.env.STRIPE_CANCEL_URL || 'http://localhost:5173/subscription/cancel';

    const session = await this.stripeSubscriptionService.createCheckoutSession({
      customerId: stripeCustomerId,
      priceId: plan.stripePriceId,
      successUrl,
      cancelUrl,
      metadata: { planId: plan.id },
    });

    // 7. Si no existía registro, crear uno con status EXPIRED (se activa via webhook)
    if (!existing) {
      await this.subscriptionRepository.create({
        stripeCustomerId,
        planId: plan.id,
      });
    } else {
      // Actualizar el planId en la suscripción existente
      await this.subscriptionRepository.update(existing.id, {
        planId: plan.id,
      });
    }

    return {
      checkoutUrl: session.url,
      sessionId: session.sessionId,
    };
  }
}
