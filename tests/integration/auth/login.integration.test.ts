import { container } from 'tsyringe';
import { LoginUseCase } from '../../../src/core/application/use-cases/auth/login.use-case';
import { PrismaService } from '../../../src/core/infrastructure/config/prisma.config';
import '../../../src/core/infrastructure/config/dependency-injection';

describe('Login Integration Test', () => {
  let loginUseCase: LoginUseCase;
  let prismaService: PrismaService;

  // Skip if DATABASE_URL is not set or points to test database
  const shouldSkip = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes('test');

  beforeAll(async () => {
    if (shouldSkip) {
      console.log('⚠️  Skipping integration test: DATABASE_URL not configured for integration tests');
      return;
    }
    prismaService = container.resolve(PrismaService);
    await prismaService.connect();
    loginUseCase = container.resolve(LoginUseCase);
  });

  afterAll(async () => {
    if (shouldSkip || !prismaService) {
      return;
    }
    await prismaService.disconnect();
  });

  it('should login successfully with valid credentials', async () => {
    if (shouldSkip) {
      console.log('⚠️  Skipping integration test: DATABASE_URL not configured for integration tests');
      return;
    }
    
    const input = {
      email: 'admin@restify.com',
      password: 'Restify123!',
      rol: 'ADMIN',
    };

    const result = await loginUseCase.execute(input);
    expect(result).toHaveProperty('token');
    expect(result).toHaveProperty('user');
    expect(result.user.id).toBeDefined();
    expect(result.user.name).toBeDefined();
    expect(result.user.rol).toBe('ADMIN');
  });
});
