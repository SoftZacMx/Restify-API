import { SignupUseCase } from '../../../../src/core/application/use-cases/auth/signup.use-case';
import { CreateFirstBranchUseCase } from '../../../../src/core/application/use-cases/branches/create-first-branch.use-case';
import { BootstrapBranchService } from '../../../../src/core/application/services/bootstrap-branch.service';
import { SendVerificationEmailUseCase } from '../../../../src/core/application/use-cases/auth/send-verification-email.use-case';
import { BcryptUtil } from '../../../../src/shared/utils/bcrypt.util';
import { JwtUtil } from '../../../../src/shared/utils/jwt.util';
import { addDays } from '../../../../src/shared/utils/date.utils';
import { Branch } from '../../../../src/core/domain/entities/branch.entity';
import { SubscriptionStatus } from '@prisma/client';

jest.mock('../../../../src/shared/utils/bcrypt.util');
jest.mock('../../../../src/shared/utils/jwt.util');

function makeBranch(): Branch {
  const now = new Date();
  return new Branch(
    'branch-1',
    'org-1',
    'Sucursal Uno',
    'CDMX',
    'CDMX',
    'Reforma',
    '123',
    '5512345678',
    null,
    null,
    null,
    null,
    null,
    null,
    'America/Mexico_City',
    'MXN',
    'active',
    now,
    now,
    null,
    'sucursal-uno'
  );
}

describe('SignupUseCase', () => {
  let useCase: SignupUseCase;
  let prismaMock: any;
  let txMock: any;
  let createFirstBranch: jest.Mocked<CreateFirstBranchUseCase>;
  let bootstrapBranch: jest.Mocked<BootstrapBranchService>;
  let sendVerificationEmail: jest.Mocked<SendVerificationEmailUseCase>;

  const validInput = {
    planId: 'plan-free',
    user: { email: 'juan@example.com', password: 'Password123', name: 'Juan', lastName: 'Perez' },
    organization: { name: 'Acme' },
    branch: {
      name: 'Sucursal Uno',
      state: 'CDMX',
      city: 'CDMX',
      street: 'Reforma',
      exteriorNumber: '123',
      phone: '5512345678',
      timezone: 'America/Mexico_City',
    },
  };

  beforeEach(() => {
    process.env.BILLING_ENABLED = 'true';

    txMock = {
      organization: { create: jest.fn().mockResolvedValue({ id: 'org-1', name: 'Acme' }) },
      subscription: { create: jest.fn().mockResolvedValue({}) },
      user: {
        create: jest.fn().mockResolvedValue({
          id: 'user-1',
          email: 'juan@example.com',
          name: 'Juan',
          last_name: 'Perez',
          rol: 'OWNER',
          organizationId: 'org-1',
        }),
      },
      branch: { findUnique: jest.fn(), create: jest.fn() },
    };

    prismaMock = {
      user: { findUnique: jest.fn().mockResolvedValue(null) },
      // El plan se busca fuera de la transacción (antes de crear nada).
      subscriptionPlan: {
        findUnique: jest.fn().mockResolvedValue({ id: 'plan-free', name: 'Free Legacy', status: true, stripePriceId: null }),
      },
      $transaction: jest.fn(async (fn: any) => fn(txMock)),
    };

    createFirstBranch = { execute: jest.fn().mockResolvedValue(makeBranch()) } as any;
    bootstrapBranch = { execute: jest.fn() } as any;
    sendVerificationEmail = { execute: jest.fn().mockResolvedValue(undefined) } as any;

    useCase = new SignupUseCase(
      prismaMock,
      createFirstBranch,
      bootstrapBranch,
      sendVerificationEmail
    );

    (BcryptUtil.hash as jest.Mock).mockResolvedValue('hashed-password');
    (JwtUtil.generateToken as jest.Mock).mockReturnValue('signup-token');
  });

  afterEach(() => {
    delete process.env.BILLING_ENABLED;
  });

  it('crea org, suscripción, usuario owner, branch y hace bootstrap (flujo feliz)', async () => {
    const result = await useCase.execute(validInput as any);

    expect(BcryptUtil.hash).toHaveBeenCalledWith('Password123');
    expect(txMock.organization.create).toHaveBeenCalledWith({
      data: { name: 'Acme' },
    });
    const subscriptionData = txMock.subscription.create.mock.calls[0][0].data;
    expect(subscriptionData).toMatchObject({
      organizationId: 'org-1',
      status: SubscriptionStatus.TRIALING,
      planId: 'plan-free',
    });
    expect(subscriptionData.currentPeriodStart).toBeInstanceOf(Date);
    expect(subscriptionData.currentPeriodEnd).toBeInstanceOf(Date);
    const trialDays =
      (subscriptionData.currentPeriodEnd.getTime() - subscriptionData.currentPeriodStart.getTime()) / 86_400_000;
    expect(Math.round(trialDays)).toBe(45);
    expect(txMock.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ email: 'juan@example.com', rol: 'OWNER', organizationId: 'org-1' }),
    });
    expect(createFirstBranch.execute).toHaveBeenCalledWith(
      txMock,
      expect.objectContaining({ organizationId: 'org-1', name: 'Sucursal Uno' })
    );
    expect(bootstrapBranch.execute).toHaveBeenCalledWith(txMock, 'branch-1', 'user-1');
    expect(sendVerificationEmail.execute).toHaveBeenCalledWith({
      userId: 'user-1',
      email: 'juan@example.com',
      name: 'Juan',
    });
    expect(JwtUtil.generateToken).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 'user-1', org: 'org-1', branch: 'branch-1' })
    );
    expect(result).toMatchObject({
      token: 'signup-token',
      user: { id: 'user-1', organizationId: 'org-1' },
      organization: { id: 'org-1', name: 'Acme' },
      branch: { id: 'branch-1', name: 'Sucursal Uno' },
    });
  });

  it('rechaza con EMAIL_ALREADY_EXISTS si el correo ya está registrado', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'user-9' });

    await expect(useCase.execute(validInput as any)).rejects.toMatchObject({
      code: 'EMAIL_ALREADY_EXISTS',
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('rechaza con SUBSCRIPTION_PLAN_NOT_FOUND si el plan no existe o está inactivo', async () => {
    prismaMock.subscriptionPlan.findUnique.mockResolvedValue(null);

    await expect(useCase.execute(validInput as any)).rejects.toMatchObject({
      code: 'SUBSCRIPTION_PLAN_NOT_FOUND',
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('plan de pago con billing habilitado: crea suscripción TRIALING, requiereCheckout=false', async () => {
    prismaMock.subscriptionPlan.findUnique.mockResolvedValue({
      id: 'plan-paid',
      name: 'Mensual',
      status: true,
      stripePriceId: 'price_123',
    });

    const result = await useCase.execute({ ...validInput, planId: 'plan-paid' } as any);

    const subscriptionData = txMock.subscription.create.mock.calls[0][0].data;
    expect(subscriptionData.status).toBe(SubscriptionStatus.TRIALING);
    expect(result.planId).toBe('plan-paid');
    expect(result.requiresCheckout).toBe(false);
  });

  it('plan Free (legacy): crea suscripción TRIALING, requiereCheckout=false', async () => {
    const result = await useCase.execute(validInput as any);

    const subscriptionData = txMock.subscription.create.mock.calls[0][0].data;
    expect(subscriptionData.status).toBe(SubscriptionStatus.TRIALING);
    expect(result.planId).toBe('plan-free');
    expect(result.requiresCheckout).toBe(false);
  });

  it('plan de pago con billing deshabilitado: se trata como Free (crea suscripción, requiresCheckout=false)', async () => {
    process.env.BILLING_ENABLED = 'false';
    prismaMock.subscriptionPlan.findUnique.mockResolvedValue({
      id: 'plan-paid',
      name: 'Mensual',
      status: true,
      stripePriceId: 'price_123',
    });

    const result = await useCase.execute({ ...validInput, planId: 'plan-paid' } as any);

    expect(txMock.subscription.create).toHaveBeenCalled();
    expect(result.requiresCheckout).toBe(false);
  });

  it('asigna un período de 3 años a la suscripción cuando el billing está deshabilitado', async () => {
    process.env.BILLING_ENABLED = 'false';

    const executeStart = new Date();
    await useCase.execute(validInput as any);
    const executeEnd = new Date();

    const subscriptionData = txMock.subscription.create.mock.calls[0][0].data;
    expect(subscriptionData.status).toBe(SubscriptionStatus.ACTIVE);
    expect(subscriptionData.currentPeriodEnd).toBeInstanceOf(Date);
    const expectedStart = addDays(executeStart, 365 * 3);
    const expectedEnd = addDays(executeEnd, 365 * 3);
    expect(subscriptionData.currentPeriodEnd.getTime()).toBeGreaterThanOrEqual(expectedStart.getTime());
    expect(subscriptionData.currentPeriodEnd.getTime()).toBeLessThanOrEqual(expectedEnd.getTime());
  });

  it('un fallo del correo de verificación no aborta el alta', async () => {
    sendVerificationEmail.execute.mockRejectedValue(new Error('SES down'));

    const result = await useCase.execute(validInput as any);

    expect(result.user.id).toBe('user-1');
  });
});
