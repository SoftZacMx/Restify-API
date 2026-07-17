import { inject, injectable } from 'tsyringe';
import { PrismaClient, OrganizationPlan, SubscriptionStatus } from '@prisma/client';
import { BcryptUtil } from '../../../../shared/utils/bcrypt.util';
import { JwtUtil } from '../../../../shared/utils/jwt.util';
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
    const { user: userInput, organization: orgInput, branch: branchInput } = input;

    // Verificar email único (fuera de transacción para fail-fast)
    const existingUser = await withoutTenant(async () => {
      return this.prisma.user.findUnique({ where: { email: userInput.email } });
    });

    if (existingUser) {
      throw new AppError('EMAIL_ALREADY_EXISTS', 'An account with this email already exists');
    }

    // Hash password
    const passwordHash = await BcryptUtil.hash(userInput.password);

    // Transacción atómica: org → subscription → user → branch → bootstrap
    const result = await withoutTenant(async () => {
      return this.prisma.$transaction(async (tx) => {
        // 1. Crear organización
        const org = await tx.organization.create({
          data: {
            name: orgInput.name,
            plan: OrganizationPlan.FREE,
          },
        });

        // 2. Crear subscription free.
        // Cuando el billing está deshabilitado (BILLING_ENABLED=false) no hay flujo de
        // pago que asigne un período, así que la suscripción quedaría ACTIVE pero sin
        // currentPeriodEnd → la lógica de estado la trataría como "expirada". Para evitarlo
        // le damos un período largo (hoy + 3 años) que la mantiene activa sin intervención.
        const billingDisabled = process.env.BILLING_ENABLED === 'false';
        let currentPeriodEnd: Date | undefined;
        if (billingDisabled) {
          currentPeriodEnd = new Date();
          currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 3);
        }

        await tx.subscription.create({
          data: {
            organizationId: org.id,
            status: SubscriptionStatus.ACTIVE,
            currentPeriodEnd,
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
    };
  }
}
