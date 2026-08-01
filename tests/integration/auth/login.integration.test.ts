import { container } from 'tsyringe';
import { PrismaClient, OrganizationPlan } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { LoginUseCase } from '../../../src/core/application/use-cases/auth/login.use-case';
import { PrismaService } from '../../../src/core/infrastructure/config/prisma.config';
import '../../../src/core/infrastructure/config/dependency-injection';
import { shouldSkipIntegration } from '../utils';

describe('Login Integration Test', () => {
  const basePrisma = new PrismaClient();
  let loginUseCase: LoginUseCase;
  let prismaService: PrismaService;
  let skipped = true;

  const email = `login-test-${Date.now()}@test.local`;
  const password = 'Test1234!';

  let createdOrgId: string;
  let createdUserId: string;

  beforeAll(async () => {
    skipped = shouldSkipIntegration();
    if (skipped) return;

    const org = await basePrisma.organization.create({
      data: { name: `Login Test Org ${Date.now()}`, plan: OrganizationPlan.FREE },
    });
    createdOrgId = org.id;

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await basePrisma.user.create({
      data: {
        email,
        password: passwordHash,
        name: 'Login',
        last_name: 'Test',
        rol: 'ADMIN',
        organizationId: org.id,
      },
    });
    createdUserId = user.id;

    prismaService = container.resolve(PrismaService);
    await prismaService.connect();
    loginUseCase = container.resolve(LoginUseCase);
  });

  afterAll(async () => {
    if (skipped) return;
    await basePrisma.user.deleteMany({ where: { id: createdUserId } });
    await basePrisma.organization.deleteMany({ where: { id: createdOrgId } });
    await basePrisma.$disconnect();
    if (prismaService) {
      await prismaService.disconnect();
    }
  });

  it('should login successfully with valid credentials', async () => {
    if (skipped) return;

    const result = await loginUseCase.execute({
      email,
      password,
      rol: 'ADMIN',
    });

    expect(result).toHaveProperty('token');
    expect(result).toHaveProperty('user');
    expect(result.user.id).toBe(createdUserId);
    expect(result.user.name).toBe('Login');
    expect(result.user.rol).toBe('ADMIN');
    expect(result.user.organizationId).toBe(createdOrgId);
  });

  it('should reject invalid credentials', async () => {
    if (skipped) return;

    await expect(
      loginUseCase.execute({
        email,
        password: 'wrong-password',
        rol: 'ADMIN',
      })
    ).rejects.toThrow('Invalid email or password');
  });
});
