import { container } from 'tsyringe';
import { PaymentRepository } from '../../database/repositories/payment.repository';
import { IPaymentRepository } from '../../../domain/interfaces/payment-repository.interface';
import { PaymentSessionRepository } from '../../database/repositories/payment-session.repository';
import { IPaymentSessionRepository } from '../../../domain/interfaces/payment-session-repository.interface';
import { PaymentDifferentiationRepository } from '../../database/repositories/payment-differentiation.repository';
import { IPaymentDifferentiationRepository } from '../../../domain/interfaces/payment-differentiation-repository.interface';
import { StripeService } from '../../payment-gateways/stripe.service';
import { StripeSubscriptionService } from '../../payment-gateways/stripe-subscription.service';
import { MercadoPagoService } from '../../payment-gateways/mercado-pago.service';
import { PayOrderWithQRMercadoPagoUseCase } from '../../../application/use-cases/payments/pay-order-with-qr-mercado-pago.use-case';
import { ConfirmMercadoPagoPaymentUseCase } from '../../../application/use-cases/payments/confirm-mercado-pago-payment.use-case';
import { GetQRPaymentStatusUseCase } from '../../../application/use-cases/payments/get-qr-payment-status.use-case';
import { prismaClient } from './prisma.module';

container.register<IPaymentRepository>('IPaymentRepository', {
  useFactory: () => new PaymentRepository(prismaClient),
});

container.register<IPaymentSessionRepository>('IPaymentSessionRepository', {
  useFactory: () => new PaymentSessionRepository(prismaClient),
});

container.register<IPaymentDifferentiationRepository>('IPaymentDifferentiationRepository', {
  useFactory: () => new PaymentDifferentiationRepository(prismaClient),
});

container.registerSingleton(StripeService);
container.registerSingleton(StripeSubscriptionService);
container.registerSingleton(MercadoPagoService);
container.register('MercadoPagoService', { useFactory: () => container.resolve(MercadoPagoService) });

container.register(PayOrderWithQRMercadoPagoUseCase, PayOrderWithQRMercadoPagoUseCase);
container.register(ConfirmMercadoPagoPaymentUseCase, ConfirmMercadoPagoPaymentUseCase);
container.register(GetQRPaymentStatusUseCase, GetQRPaymentStatusUseCase);
