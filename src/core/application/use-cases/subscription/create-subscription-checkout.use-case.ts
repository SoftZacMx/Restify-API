import { inject, injectable } from 'tsyringe';
import { ISubscriptionRepository } from '../../../domain/interfaces/subscription-repository.interface';
import { ISubscriptionPlanRepository } from '../../../domain/interfaces/subscription-plan-repository.interface';
import { IOrganizationRepository } from '../../../domain/interfaces/organization-repository.interface';
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
    @inject('ISubscriptionRepository')
    private readonly subscriptionRepository: ISubscriptionRepository,
    @inject('ISubscriptionPlanRepository')
    private readonly planRepository: ISubscriptionPlanRepository,
    @inject('IOrganizationRepository')
    private readonly organizationRepository: IOrganizationRepository,
    @inject('IUserRepository') private readonly userRepository: IUserRepository,
    @inject(StripeSubscriptionService)
    private readonly stripeSubscriptionService: StripeSubscriptionService
  ) {}

  async execute(input: CreateSubscriptionCheckoutInput): Promise<CreateSubscriptionCheckoutResult> {
    // 0. Obtener el usuario (para el Customer de Stripe). El rol ya lo valida la
    // ruta con AuthMiddleware.authorize(...OWNER_ADMIN) antes de llegar aquí.
    const user = await this.userRepository.findById(input.userId);
    if (!user) {
      throw new AppError('USER_NOT_FOUND');
    }

    // 1. Buscar el plan en la base de datos
    const plan = await this.planRepository.findById(input.planId);
    if (!plan || !plan.status) {
      throw new AppError('SUBSCRIPTION_PLAN_NOT_FOUND');
    }

    // 2. Buscar suscripción existente
    const existing = await this.subscriptionRepository.find();

    // 3. Solo bloquear si ya está pagando activamente ese MISMO plan (evita
    // duplicar la suscripción en Stripe). Si la activa es otra (p. ej. el Free del
    // onboarding, o un plan distinto), se permite continuar: es un upgrade/cambio
    // de plan y el webhook actualizará esta misma fila al confirmarse el pago.
    const isActiveOnSamePlan =
      existing?.status === 'ACTIVE' &&
      !!existing.stripeSubscriptionId &&
      existing.planId === plan.id;

    if (isActiveOnSamePlan) {
      throw new AppError('SUBSCRIPTION_ALREADY_ACTIVE');
    }

    // 4. Obtener datos de la organización para el Customer de Stripe
    const organization = await this.organizationRepository.findById(user.organizationId);
    const customerEmail = user.email;
    const customerName = organization?.name || 'Mi Restaurante';

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
    const baseSuccessUrl =
      process.env.STRIPE_SUCCESS_URL || 'http://localhost:5173/subscription/success';
    const successUrl = `${baseSuccessUrl}?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = process.env.STRIPE_CANCEL_URL || 'http://localhost:5173/subscription/cancel';

    if (!plan.stripePriceId) {
      throw new AppError('SUBSCRIPTION_PRICE_NOT_CONFIGURED');
    }

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
        organizationId: user.organizationId,
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
