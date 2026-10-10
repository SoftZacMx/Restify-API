import { inject, injectable } from 'tsyringe';
import { PrismaClient, SubscriptionStatus } from '@prisma/client';
import { BcryptUtil } from '../../../../shared/utils/bcrypt.util';
import { JwtUtil } from '../../../../shared/utils/jwt.util';
import { addDays } from '../../../../shared/utils/date.utils';
import { SignupInput } from '../../dto/auth.dto';
import { AppError } from '../../../../shared/errors';
import { CreateFirstBranchUseCase } from '../branches/create-first-branch.use-case';
import { BootstrapBranchService } from '../../services/bootstrap-branch.service';
import { SendVerificationEmailUseCase } from './send-verification-email.use-case';
import { withoutTenant } from '../../../infrastructure/tenant/tenant-context';
import { logger } from '../../../../shared/utils/logger';

export interface SignupResult {
  token: string;
  user: {
    id: string;
    name: string;
    last_name: string;
    email: string;
    rol: string;
    organizationId: string;
  };
  organization: {
    id: string;
    name: string;
  };
  branch: {
    id: string;
    name: string;
  };
  /** Plan elegido en el registro. */
  planId: string;
  /** El registro ya no pide pago: siempre false, se mantiene por compatibilidad. */
  requiresCheckout: boolean;
}

@injectable()
export class SignupUseCase {
  constructor(
    @inject('PrismaClient') private readonly prisma: PrismaClient,
    @inject(CreateFirstBranchUseCase) private readonly createFirstBranch: CreateFirstBranchUseCase,
    @inject(BootstrapBranchService) private readonly bootstrapBranch: BootstrapBranchService,
    @inject(SendVerificationEmailUseCase)
    private readonly sendVerificationEmail: SendVerificationEmailUseCase
  ) {}

  async execute(input: SignupInput): Promise<SignupResult> {
    const { planId, user: userInput, organization: orgInput, branch: branchInput } = input;

    // Verificar email único (fuera de transacción para fail-fast)
    const existingUser = await withoutTenant(async () => {
      return this.prisma.user.findUnique({ where: { email: userInput.email } });
    });

    if (existingUser) {
      throw new AppError('EMAIL_ALREADY_EXISTS', 'An account with this email already exists');
    }

    // Validar el plan elegido (fuera de transacción, igual que la validación de email)
    const plan = await withoutTenant(async () => {
      return this.prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    });

    if (!plan || !plan.status) {
      throw new AppError('SUBSCRIPTION_PLAN_NOT_FOUND');
    }

    // Ya no existe plan gratuito: todo signup arranca con un período de prueba.
    // Sin billing (dev/tests) no hay flujo de cobro, así que se otorga un período
    // largo que mantiene la suscripción activa sin intervención.
    const billingDisabled = process.env.BILLING_ENABLED === 'false';
    const trialDays = parseInt(process.env.SUBSCRIPTION_TRIAL_DAYS || '45', 10);
    const trialStart = new Date();
    const trialEnd = addDays(trialStart, trialDays);

    // Hash password
    const passwordHash = await BcryptUtil.hash(userInput.password);

    // Transacción atómica: org → subscription → user → branch → bootstrap
    const result = await withoutTenant(async () => {
      return this.prisma.$transaction(async (tx) => {
        // 1. Crear organización
        const org = await tx.organization.create({
          data: {
            name: orgInput.name,
          },
        });

        // 2. Crear subscription — el trial barre el onboarding y el acceso se
        // otorga al instante; el pago solo se pide al vencer o si el negocio
        // decide "pagar antes".
        await tx.subscription.create({
          data:
            billingDisabled
              ? {
                  organizationId: org.id,
                  planId: plan.id,
                  status: SubscriptionStatus.ACTIVE,
                  currentPeriodStart: trialStart,
                  currentPeriodEnd: addDays(trialStart, 365 * 3),
                }
              : {
                  organizationId: org.id,
                  planId: plan.id,
                  status: SubscriptionStatus.TRIALING,
                  currentPeriodStart: trialStart,
                  currentPeriodEnd: trialEnd,
                },
        });

        // 3. Crear usuario owner
        const user = await tx.user.create({
          data: {
            email: userInput.email,
            password: passwordHash,
            name: userInput.name,
            last_name: userInput.lastName,
            organizationId: org.id,
            rol: 'OWNER',
            status: true,
          },
        });

        // 4. Crear primera sucursal
        const branch = await this.createFirstBranch.execute(tx, {
          organizationId: org.id,
          name: branchInput.name,
          state: branchInput.state,
          city: branchInput.city,
          street: branchInput.street,
          exteriorNumber: branchInput.exteriorNumber,
          phone: branchInput.phone,
          rfc: branchInput.rfc ?? null,
          startOperations: branchInput.startOperations ?? null,
          endOperations: branchInput.endOperations ?? null,
          timezone: branchInput.timezone,
        });

        // 5. Bootstrap (categorías + mesa 1)
        await this.bootstrapBranch.execute(tx, branch.id, user.id);

        return { org, user, branch };
      });
    });

    // Enviar correo de verificación (4.1.E). Fuera de la transacción y best-effort:
    // un fallo del email no debe abortar el alta ya persistida. El usuario puede
    // reenviarlo con /auth/resend-verification.
    try {
      await this.sendVerificationEmail.execute({
        userId: result.user.id,
        email: result.user.email,
        name: result.user.name,
      });
    } catch (error) {
      logger.error(
        { err: error, userId: result.user.id },
        '[Signup] No se pudo enviar el correo de verificación (alta no afectada)'
      );
    }

    // Generar JWT
    const token = JwtUtil.generateToken({
      sub: result.user.id,
      email: result.user.email,
      rol: result.user.rol,
      org: result.org.id,
      branch: result.branch.id,
      tokenVersion: 0,
      emailVerified: false,
      mustChangePassword: false,
    });

    return {
      token,
      user: {
        id: result.user.id,
        name: result.user.name,
        last_name: result.user.last_name,
        email: result.user.email,
        rol: result.user.rol,
        organizationId: result.org.id,
      },
      organization: {
        id: result.org.id,
        name: result.org.name,
      },
      branch: {
        id: result.branch.id,
        name: result.branch.name,
      },
      planId: plan.id,
      requiresCheckout: false,
    };
  }
}
