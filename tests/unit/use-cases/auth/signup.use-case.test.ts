import { SignupUseCase } from '../../../../src/core/application/use-cases/auth/signup.use-case';
import { CreateFirstBranchUseCase } from '../../../../src/core/application/use-cases/branches/create-first-branch.use-case';
import { BootstrapBranchService } from '../../../../src/core/application/services/bootstrap-branch.service';
import { SendVerificationEmailUseCase } from '../../../../src/core/application/use-cases/auth/send-verification-email.use-case';
import { BcryptUtil } from '../../../../src/shared/utils/bcrypt.util';
import { JwtUtil } from '../../../../src/shared/utils/jwt.util';
import { Branch } from '../../../../src/core/domain/entities/branch.entity';
import { OrganizationPlan, SubscriptionStatus } from '@prisma/client';

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
      data: { name: 'Acme', plan: OrganizationPlan.FREE },
    });
    expect(txMock.subscription.create).toHaveBeenCalledWith({
      data: { organizationId: 'org-1', status: SubscriptionStatus.ACTIVE, currentPeriodEnd: undefined },
    });
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

  it('asigna un período de 3 años a la suscripción cuando el billing está deshabilitado', async () => {
    process.env.BILLING_ENABLED = 'false';

    const before = new Date();
    before.setFullYear(before.getFullYear() + 3);
    await useCase.execute(validInput as any);
    const after = new Date();
    after.setFullYear(after.getFullYear() + 3);

    const subscriptionData = txMock.subscription.create.mock.calls[0][0].data;
    expect(subscriptionData.status).toBe(SubscriptionStatus.ACTIVE);
    expect(subscriptionData.currentPeriodEnd).toBeInstanceOf(Date);
    expect(subscriptionData.currentPeriodEnd.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(subscriptionData.currentPeriodEnd.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it('un fallo del correo de verificación no aborta el alta', async () => {
    sendVerificationEmail.execute.mockRejectedValue(new Error('SES down'));

    const result = await useCase.execute(validInput as any);

    expect(result.user.id).toBe('user-1');
  });
});
